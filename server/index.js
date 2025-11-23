require('dotenv').config(); // Load .env file
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

// --- ML IMPORTS ---
const { GoogleGenAI } = require("@google/genai");

// Transformers.js configuration
let pipeline, env;
try {
    const transformers = require('@xenova/transformers');
    pipeline = transformers.pipeline;
    env = transformers.env;
    env.allowLocalModels = false; // Force remote download if local not found
    env.useBrowserCache = false;  // Not needed in Node
} catch (e) {
    console.warn("Transformers.js not found. Run 'npm install @xenova/transformers'");
}

const app = express();
const port = process.env.PORT ? parseInt(process.env.PORT) : 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

// Health Check
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// --- NEW: SERVER-SIDE PROXY ---
// Bypasses CORS and unstable public proxies for RSS fetching
app.get('/api/proxy', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).send("Missing URL");
    try {
        // Node 18+ has native fetch. If using older Node, this needs a polyfill.
        // We add headers to mimic a real browser to avoid 403s from strict WAFs (like News18)
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });
        
        if (!response.ok) throw new Error(`Fetch failed with status: ${response.status}`);
        const text = await response.text();
        res.send(text);
    } catch (e) {
        console.error(`Proxy error for ${url}:`, e.message);
        res.status(500).send(e.message);
    }
});

app.use(express.static(path.join(__dirname, '../')));

// --- DATABASE SETUP ---
const isCloud = process.env.NODE_ENV === 'production';
const dbPath = isCloud 
  ? path.join('/tmp', 'indiview.db') 
  : path.join(__dirname, '../indiview.db');

console.log(`Initializing SQLite database at: ${dbPath}`);

let db;

try {
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('CRITICAL: Error opening database', err);
      if (err.code === 'SQLITE_CANTOPEN' || err.code === 'EROFS') {
        db = new sqlite3.Database(':memory:');
        initDb();
      }
    } else {
      console.log('Connected to SQLite database.');
      initDb();
    }
  });
} catch (e) {
  console.error("Failed to initialize sqlite3 module", e);
}

function initDb() {
  if (!db) return;
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS news_clusters (
      id TEXT PRIMARY KEY,
      headline TEXT NOT NULL,
      summary TEXT,
      category TEXT,
      main_image_url TEXT,
      created_at TEXT,
      stats TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS news_articles (
      id TEXT PRIMARY KEY,
      source_id TEXT,
      source_name TEXT,
      bias_rating TEXT,
      factuality TEXT,
      headline TEXT,
      url TEXT UNIQUE,
      pub_date TEXT,
      fetched_at TEXT,
      summary TEXT,
      image_url TEXT,
      cluster_id TEXT,
      embedding TEXT,
      entities TEXT,
      FOREIGN KEY(cluster_id) REFERENCES news_clusters(id)
    )`);
    
    db.run(`CREATE INDEX IF NOT EXISTS idx_articles_cluster ON news_articles(cluster_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_articles_pubdate ON news_articles(pub_date DESC)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_clusters_created ON news_clusters(created_at DESC)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_articles_unclustered ON news_articles(id) WHERE cluster_id IS NULL`);
    
    // Migrations
    db.run(`ALTER TABLE news_articles ADD COLUMN embedding TEXT`, (err) => {});
    db.run(`ALTER TABLE news_articles ADD COLUMN entities TEXT`, (err) => {});
  });
}

// --- DB HELPER FUNCTIONS ---
const run = (sql, params = []) => new Promise((resolve, reject) => {
  if (!db) return reject(new Error("Database not initialized"));
  db.run(sql, params, function (err) {
    if (err) reject(err);
    else resolve(this);
  });
});

const all = (sql, params = []) => new Promise((resolve, reject) => {
  if (!db) return reject(new Error("Database not initialized"));
  db.all(sql, params, (err, rows) => {
    if (err) reject(err);
    else resolve(rows);
  });
});

// --- ML PIPELINE LOGIC (Backend Version) ---

const TEXT_WEIGHT = 0.7;
const ENTITY_WEIGHT = 0.3;
// Lowered threshold to 0.55 to encourage more grouping of related stories.
// MiniLM embeddings can be quite specific, so 0.65 was splitting too much.
const CLUSTERING_THRESHOLD = 0.55; 
const DUPLICATE_THRESHOLD = 0.90; // Threshold for near-duplicate detection
const STOPWORDS = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','with','by','is','are','was','were','be','been','this','that','these','those','it','he','she','they','news','report','breaking','today','live','update','updates','latest']);

let embedder = null;
let nerModel = null;
let nerDisabled = false; // Flag to prevent repetitive retry failures

// Math Utils
const cosineSimilarity = (vecA, vecB) => {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dot += vecA[i] * vecB[i];
        magA += vecA[i] * vecA[i];
        magB += vecB[i] * vecB[i];
    }
    return dot / ((Math.sqrt(magA) * Math.sqrt(magB)) || 1);
};

const weightedVectorAdd = (vecA, vecB, weightA, weightB) => {
    if (!vecA) return vecB;
    if (!vecB) return vecA;
    return vecA.map((val, i) => val * weightA + vecB[i] * weightB);
};

const normalizeVector = (vec) => {
    const mag = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
    return vec.map(val => val / (mag || 1));
};

// Pipeline Service
const backendAnalysisService = {
    initModels: async () => {
        if (!pipeline) throw new Error("Transformers.js not loaded");
        
        if (!embedder) {
            try {
                console.log("Loading Embedding Model (MiniLM-L6-v2)...");
                embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
            } catch (e) {
                console.error("CRITICAL: Failed to load Embedding Model.", e);
                throw e;
            }
        }
        
        // Only try loading NER if it hasn't failed previously
        if (!nerModel && !nerDisabled) {
            try {
                console.log("Loading NER Model (DistilBERT)...");
                nerModel = await pipeline('token-classification', 'Xenova/distilbert-base-uncased-finetuned-ner');
            } catch (e) {
                console.warn("WARNING: Failed to load NER Model. Disabling NER for this session to prevent crashes.");
                console.warn(`Reason: ${e.message}`);
                nerModel = null;
                nerDisabled = true; // Stop future attempts
            }
        }
    },

    enrichArticles: async (articles) => {
        await backendAnalysisService.initModels();
        const enriched = [];
        
        for (const article of articles) {
            try {
                const fullText = `${article.headline}. ${article.summary}`;
                
                // 1. Embed Text
                const textOutput = await embedder(fullText, { pooling: 'mean', normalize: true });
                const textVector = Array.from(textOutput.data);

                // 2. NER (Optional)
                let entityList = [];
                if (nerModel) {
                    try {
                        const nerOutput = await nerModel(fullText);
                        const entities = new Set();
                        let currentEntity = "";
                        for (const token of nerOutput) {
                            const word = token.word.replace('##', '');
                            if (token.entity.startsWith('B-') || (token.entity.startsWith('I-') && currentEntity === "")) {
                                if (currentEntity) entities.add(currentEntity);
                                currentEntity = word;
                            } else if (token.entity.startsWith('I-')) {
                                currentEntity += word;
                            } else {
                                if (currentEntity) entities.add(currentEntity);
                                currentEntity = "";
                            }
                        }
                        if (currentEntity) entities.add(currentEntity);
                        entityList = Array.from(entities).filter(e => e.length > 2);
                    } catch (nerErr) {
                        console.warn(`NER extraction failed for article ${article.id} (skipping NER)`);
                    }
                }

                // 3. Entity Vector
                let entityVector = textVector; // Fallback
                if (entityList.length > 0) {
                    const entOutput = await embedder(entityList.join(" "), { pooling: 'mean', normalize: true });
                    entityVector = Array.from(entOutput.data);
                }

                // 4. Weighted Fusion (Use simple text vector if NER disabled)
                const finalVector = nerModel && entityList.length > 0
                    ? weightedVectorAdd(textVector, entityVector, TEXT_WEIGHT, ENTITY_WEIGHT)
                    : textVector;
                
                enriched.push({
                    ...article,
                    embedding: normalizeVector(finalVector),
                    entities: entityList
                });
            } catch (e) {
                console.error(`Enrichment error for ${article.id}:`, e.message);
                enriched.push(article); // Keep original if fail
            }
        }
        return enriched;
    },

    clusterArticles: (articles) => {
        const microClusters = [];
        const validArticles = articles.filter(a => a.embedding);
        
        // TIME WINDOW: 48 Hours
        const MAX_TIME_DIFF_MS = 48 * 60 * 60 * 1000;

        for (const article of validArticles) {
            const vec = article.embedding;
            const articleTime = article.pubDate ? new Date(article.pubDate).getTime() : Date.now();

            let bestIdx = -1;
            let maxSim = -1;
            let isDuplicate = false;

            for (let i = 0; i < microClusters.length; i++) {
                const cluster = microClusters[i];

                // 1. TIME CHECK
                const timeDiff = Math.abs(articleTime - cluster.latestTime);
                if (timeDiff > MAX_TIME_DIFF_MS) {
                    continue; 
                }

                // 2. DUPLICATE CHECK
                const duplicateMatch = cluster.articles.some(existing => {
                    if (existing.headline.toLowerCase().trim() === article.headline.toLowerCase().trim()) return true;
                    const pairSim = cosineSimilarity(vec, existing.embedding);
                    return pairSim >= DUPLICATE_THRESHOLD;
                });

                if (duplicateMatch) {
                    cluster.articles.push(article);
                    isDuplicate = true;
                    break;
                }

                // 3. SEMANTIC CENTROID CHECK
                const sim = cosineSimilarity(vec, cluster.centroid);
                if (sim > maxSim) {
                    maxSim = sim;
                    bestIdx = i;
                }
            }

            if (isDuplicate) continue;

            if (maxSim >= CLUSTERING_THRESHOLD && bestIdx !== -1) {
                const cluster = microClusters[bestIdx];
                cluster.articles.push(article);
                // Update Centroid
                cluster.centroid = normalizeVector(weightedVectorAdd(cluster.centroid, vec, 0.8, 0.2));
                if (articleTime > cluster.latestTime) {
                    cluster.latestTime = articleTime;
                }
            } else {
                microClusters.push({ 
                    centroid: vec, 
                    articles: [article],
                    latestTime: articleTime
                });
            }
        }
        return microClusters;
    },

    generateLabels: async (clusters) => {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const labeled = [];

        // Helper function to process a single cluster
        const processCluster = async (cluster) => {
            if (cluster.articles.length === 0) return null;

            const wordCounts = {};
            cluster.articles.forEach(a => {
                const words = (a.headline + " " + (a.summary || "")).toLowerCase()
                    .replace(/[^\w\s]/g, '').split(/\s+/);
                words.forEach(w => {
                    if (w.length > 3 && !STOPWORDS.has(w)) wordCounts[w] = (wordCounts[w] || 0) + 1;
                });
            });

            const keywords = Object.entries(wordCounts)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10).map(([k]) => k);

            // Limit headlines to top 5 to save tokens
            const prompt = `
              Topic Keywords: ${keywords.join(', ')}
              Sample Headlines:
              ${cluster.articles.slice(0, 5).map(a => `- ${a.headline}`).join('\n')}
              
              Create a JSON object for a news aggregation card with:
              1. "headline": A neutral, objective headline summarizing the story.
              2. "summary": A brief neutral summary (max 30 words).
              3. "category": One of [Politics, Business, Technology, Sports, Entertainment, General].
            `;

            try {
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: prompt,
                    config: { responseMimeType: 'application/json' }
                });
                
                const data = JSON.parse(response.text || '{}');
                return {
                    ...data,
                    articles: cluster.articles
                };
            } catch (e) {
                console.error("Labeling error:", e.message);
                // Fallback label
                return {
                    headline: cluster.articles[0].headline,
                    summary: cluster.articles[0].summary,
                    category: 'General',
                    articles: cluster.articles
                };
            }
        };

        // BATCH PROCESSING:
        // Parallelize requests to speed up labeling. 
        // We use chunks of 5 to balance speed with rate limits.
        const BATCH_SIZE = 5;
        for (let i = 0; i < clusters.length; i += BATCH_SIZE) {
            const batch = clusters.slice(i, i + BATCH_SIZE);
            const results = await Promise.all(batch.map(c => processCluster(c)));
            labeled.push(...results.filter(Boolean));
        }

        return labeled;
    },

    // --- COHERENCE CHECK ---
    refineClusters: async () => {
        console.log("--- Running Cluster Coherence Check ---");
        const COHERENCE_THRESHOLD = 0.60;
        
        try {
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const clusters = await all(`SELECT * FROM news_clusters WHERE created_at > ?`, [oneDayAgo]);

            for (const cluster of clusters) {
                // Get full article data for cluster
                const articlesRaw = await all(`SELECT * FROM news_articles WHERE cluster_id = ?`, [cluster.id]);
                if (articlesRaw.length < 4) continue;

                const articles = articlesRaw.map(a => {
                    try {
                        return { ...a, embedding: JSON.parse(a.embedding) };
                    } catch (e) { return null; }
                }).filter(a => a && a.embedding && a.embedding.length > 0);

                if (articles.length < 4) continue;

                // Compute Centroid
                let centroid = new Array(articles[0].embedding.length).fill(0);
                for (const a of articles) {
                    centroid = weightedVectorAdd(centroid, a.embedding, 1, 1);
                }
                centroid = normalizeVector(centroid);

                // Compute Coherence
                let totalSim = 0;
                for (const a of articles) {
                    totalSim += cosineSimilarity(a.embedding, centroid);
                }
                const avgSim = totalSim / articles.length;

                // Split if incoherent
                if (avgSim < COHERENCE_THRESHOLD) {
                    console.log(`Cluster ${cluster.headline.substring(0, 20)}... is incoherent (Avg Sim: ${avgSim.toFixed(2)}). Splitting...`);
                    
                    // Re-cluster ONLY these articles
                    const newMicroClusters = backendAnalysisService.clusterArticles(articles);

                    if (newMicroClusters.length > 1) {
                        console.log(`-> Split into ${newMicroClusters.length} new clusters.`);
                        
                        const labeledSubClusters = await backendAnalysisService.generateLabels(newMicroClusters);

                        // Safe Transactional Swap
                        try {
                            await run("BEGIN TRANSACTION");
                            
                            // 1. Delete old cluster
                            await run(`DELETE FROM news_clusters WHERE id = ?`, [cluster.id]);

                            // 2. Insert new clusters
                            for (const c of labeledSubClusters) {
                                 const newClusterId = `cluster-split-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                                 
                                 let left=0, right=0, center=0, total=c.articles.length;
                                 c.articles.forEach(a => {
                                    if (a.bias_rating && a.bias_rating.includes('Left')) left++;
                                    else if (a.bias_rating && a.bias_rating.includes('Right')) right++;
                                    else center++;
                                 });
                                 const leftPct = Math.round((left/total)*100);
                                 const rightPct = Math.round((right/total)*100);
                                 let blindspot = 'None';
                                 if (rightPct < 15 && leftPct > 50) blindspot = 'Right';
                                 if (leftPct < 15 && rightPct > 50) blindspot = 'Left';

                                 const bestImage = c.articles.find(a => a.image_url)?.image_url;
                                 
                                 const stats = {
                                    totalSources: total,
                                    biasDistribution: { left: leftPct, center: 100-leftPct-rightPct, right: rightPct },
                                    blindspot
                                };

                                await run(`INSERT INTO news_clusters (id, headline, summary, category, main_image_url, created_at, stats) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
                                    newClusterId, c.headline, c.summary, c.category, bestImage, new Date().toISOString(), JSON.stringify(stats)
                                ]);

                                const articleIds = c.articles.map(a => a.id);
                                const placeholders = articleIds.map(() => '?').join(',');
                                await run(`UPDATE news_articles SET cluster_id = ? WHERE id IN (${placeholders})`, [newClusterId, ...articleIds]);
                            }
                            
                            await run("COMMIT");
                            console.log(`-> Successfully split cluster ${cluster.id}`);

                        } catch (txError) {
                            await run("ROLLBACK");
                            console.error("-> Transaction failed during cluster split, rolled back.", txError);
                        }
                    }
                }
            }
        } catch (e) {
            console.error("Coherence check failed:", e);
        }
    }
};


// --- ROUTE: TRIGGER PIPELINE ---
app.post('/api/pipeline/process', async (req, res) => {
    try {
        console.log("--- STARTING BACKEND PIPELINE ---");
        
        const cutoffDate = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
        
        const rows = await all(`
            SELECT * FROM news_articles 
            WHERE cluster_id IS NULL 
            AND pub_date > ? 
            LIMIT 50
        `, [cutoffDate]);

        if (rows.length < 2) {
            await backendAnalysisService.refineClusters();
            return res.json({ success: true, message: "Maintenance run completed (No new articles)." });
        }

        const articles = rows.map(row => ({
            ...row,
            embedding: row.embedding ? JSON.parse(row.embedding) : undefined,
            entities: row.entities ? JSON.parse(row.entities) : undefined
        }));

        console.log(`Enriching ${articles.length} articles...`);
        const enrichedArticles = await backendAnalysisService.enrichArticles(articles);

        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            const stmt = db.prepare(`UPDATE news_articles SET embedding = ?, entities = ? WHERE id = ?`);
            enrichedArticles.forEach(a => {
                stmt.run([JSON.stringify(a.embedding), JSON.stringify(a.entities), a.id]);
            });
            stmt.finalize();
            db.run("COMMIT");
        });

        console.log("Clustering...");
        const rawClusters = backendAnalysisService.clusterArticles(enrichedArticles);

        console.log(`Labeling ${rawClusters.length} clusters...`);
        const labeledClusters = await backendAnalysisService.generateLabels(rawClusters);

        const dbClusters = [];
        
        // Batch Cluster Insert
        try {
             await run("BEGIN TRANSACTION");
             
             for (const c of labeledClusters) {
                const clusterId = `cluster-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                const articleIds = c.articles.map(a => a.id);
                
                let left=0, right=0, center=0, total=c.articles.length;
                c.articles.forEach(a => {
                    if (a.bias_rating && a.bias_rating.includes('Left')) left++;
                    else if (a.bias_rating && a.bias_rating.includes('Right')) right++;
                    else center++;
                });
                const leftPct = Math.round((left/total)*100);
                const rightPct = Math.round((right/total)*100);
                let blindspot = 'None';
                if (rightPct < 15 && leftPct > 50) blindspot = 'Right';
                if (leftPct < 15 && rightPct > 50) blindspot = 'Left';

                const bestImage = c.articles.find(a => a.image_url)?.image_url;

                const clusterData = {
                    id: clusterId,
                    headline: c.headline,
                    summary: c.summary,
                    category: c.category || 'General',
                    mainImageUrl: bestImage,
                    createdAt: new Date().toISOString(),
                    stats: {
                        totalSources: total,
                        biasDistribution: { left: leftPct, center: 100-leftPct-rightPct, right: rightPct },
                        blindspot
                    }
                };
                dbClusters.push(clusterData);

                await run(`INSERT INTO news_clusters (id, headline, summary, category, main_image_url, created_at, stats) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
                    clusterData.id, clusterData.headline, clusterData.summary, clusterData.category, clusterData.mainImageUrl, clusterData.createdAt, JSON.stringify(clusterData.stats)
                ]);
                
                const placeholders = articleIds.map(() => '?').join(',');
                await run(`UPDATE news_articles SET cluster_id = ? WHERE id IN (${placeholders})`, [clusterId, ...articleIds]);
            }
            
            await run("COMMIT");
            
        } catch (err) {
            await run("ROLLBACK");
            throw err;
        }

        console.log("Pipeline Complete.");

        await backendAnalysisService.refineClusters();

        res.json({ success: true, clustersGenerated: dbClusters.length });

    } catch (e) {
        console.error("Pipeline Error:", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// --- EXISTING API ROUTES ---

app.post('/api/articles', async (req, res) => {
  if (!db) return res.status(503).send("Database not available");
  const articles = req.body;
  if (!Array.isArray(articles)) return res.status(400).send('Invalid input');

  try {
    db.serialize(() => {
      db.run("BEGIN TRANSACTION");
      const stmt = db.prepare(`
        INSERT INTO news_articles 
        (id, source_id, source_name, bias_rating, factuality, headline, url, pub_date, fetched_at, summary, image_url, cluster_id, embedding, entities)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          fetched_at = excluded.fetched_at,
          headline = excluded.headline,
          image_url = COALESCE(image_url, excluded.image_url)
      `);
      for (const a of articles) {
        stmt.run([
          a.id, a.sourceId, a.sourceName, a.biasRating, a.factuality, 
          a.headline, a.url, a.pubDate, a.fetchedAt, a.summary, a.imageUrl, 
          a.clusterId || null,
          a.embedding ? JSON.stringify(a.embedding) : null,
          a.entities ? JSON.stringify(a.entities) : null
        ]);
      }
      stmt.finalize();
      db.run("COMMIT", (err) => {
        if(err) res.status(500).send(err.message);
        else res.status(200).send({ message: 'Articles ingested', count: articles.length });
      });
    });
  } catch (e) {
    res.status(500).send(e.message);
  }
});

app.get('/api/articles/unclustered', async (req, res) => {
  try {
    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const rows = await all(`SELECT * FROM news_articles WHERE cluster_id IS NULL AND pub_date > ? LIMIT 100`, [cutoffDate]);
    res.json(rows.map(r => ({...r, embedding: undefined, entities: undefined}))); // Light payload
  } catch (e) {
    res.status(500).send(e.message);
  }
});

app.get('/api/articles/by-cluster/:clusterId', async (req, res) => {
  try {
    const rows = await all(`SELECT * FROM news_articles WHERE cluster_id = ? ORDER BY pub_date DESC`, [req.params.clusterId]);
    res.json(rows.map(r => ({
        id: r.id, sourceId: r.source_id, sourceName: r.source_name, biasRating: r.bias_rating, factuality: r.factuality,
        headline: r.headline, url: r.url, pubDate: r.pub_date, summary: r.summary, imageUrl: r.image_url
    })));
  } catch (e) {
    res.status(500).send(e.message);
  }
});

app.post('/api/clusters', async (req, res) => {
  res.json({success:true});
});

app.post('/api/articles/link', async (req, res) => {
  res.json({success:true});
});

app.get('/api/clusters', async (req, res) => {
  try {
    const rows = await all(`SELECT * FROM news_clusters ORDER BY created_at DESC LIMIT 20`);
    res.json(rows.map(r => ({
        id: r.id, headline: r.headline, summary: r.summary, category: r.category, mainImageUrl: r.main_image_url,
        createdAt: r.created_at, stats: JSON.parse(r.stats || '{}')
    })));
  } catch (e) {
    res.status(500).send(e.message);
  }
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).send('API Not Found');
  res.sendFile(path.join(__dirname, '../index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`IndiView Backend running on port ${port}`);
});