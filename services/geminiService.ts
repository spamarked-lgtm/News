
import { NewsStory, NewsSource, DBCluster } from "../types";
import { ingestRSSFeeds } from "./rssService";
import { dbService } from "./dbService";
import { analysisService } from "./analysisService";

// Helper to join Clusters + Articles for the UI
const hydrateStoriesFromDB = async (clusters: DBCluster[]): Promise<NewsStory[]> => {
    const storyPromises = clusters.map(async (c) => {
        const articles = await dbService.getAllArticlesForCluster(c.id);
        
        const uiArticles = articles.map(a => ({
            title: a.headline,
            url: a.url,
            publishedAt: a.pubDate,
            summary: a.summary,
            source: {
                id: a.sourceId,
                name: a.sourceName,
                biasRating: a.biasRating,
                factuality: a.factuality,
                domain: new URL(a.url).hostname
            } as NewsSource
        }));

        return {
            id: c.id,
            headline: c.headline,
            summary: c.summary,
            articles: uiArticles,
            biasDistribution: c.stats.biasDistribution,
            totalSources: c.stats.totalSources,
            blindspot: c.stats.blindspot,
            lastUpdated: c.createdAt,
            category: c.category,
            imageUrl: c.mainImageUrl
        } as NewsStory;
    });

    return Promise.all(storyPromises);
};

/**
 * UPDATED PIPELINE:
 * 1. Ingest RSS (Frontend) -> Save to DB
 * 2. Trigger Backend Pipeline (Embed/NER/Cluster/Label)
 * 3. Fetch Results from DB
 */
export const fetchTrendingStories = async (): Promise<NewsStory[]> => {
  try {
    // --- STAGE 1: INGESTION (Frontend) ---
    // We still fetch RSS on client because of CORS/Proxy complexity on node without heavy libraries
    await ingestRSSFeeds();

    // --- STAGE 2: CHECK CACHE ---
    // If we have recent clusters, return them immediately to speed up UI
    const existingClusters = await dbService.getRecentClusters();
    const now = new Date();
    
    if (existingClusters.length > 0) {
        const newest = new Date(existingClusters[0].createdAt);
        const diffMins = (now.getTime() - newest.getTime()) / 1000 / 60;
        
        // If clusters are fresh (less than 30 mins), don't re-run heavy backend ML
        if (diffMins < 30) {
            console.log("Serving cached clusters from DB");
            return hydrateStoriesFromDB(existingClusters);
        }
    }

    // --- STAGE 3: TRIGGER BACKEND PIPELINE ---
    // This tells the server: "I've just saved new articles. Go process them."
    await analysisService.triggerPipeline();

    // --- STAGE 4: FETCH RESULTS ---
    const freshClusters = await dbService.getRecentClusters();
    return hydrateStoriesFromDB(freshClusters);

  } catch (error) {
    console.error("Pipeline failed:", error);
    throw error;
  }
};