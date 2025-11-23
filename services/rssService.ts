import { RSS_FEEDS, KNOWN_SOURCES } from '../constants';
import { DBArticle, BiasRating, Factuality } from '../types';
import { dbService } from './dbService';

// List of CORS proxies to try in order. 
const PROXY_LIST = [
    'https://api.allorigins.win/raw?url=', 
    'https://corsproxy.io/?',
    'https://api.codetabs.com/v1/proxy?quest=',
    'https://thingproxy.freeboard.io/fetch/'
];

// Helper to create a deterministic ID from URL
const generateId = (url: string) => {
    return url.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
    }, 0).toString(36) + url.length;
};

const mapSourceToMetadata = (sourceName: string, link: string): { bias: BiasRating, factuality: Factuality, id: string } => {
    const lowerName = sourceName.toLowerCase();
    const domain = new URL(link).hostname;
    
    const knownKey = Object.keys(KNOWN_SOURCES).find(key => 
        lowerName.includes(key) || domain.includes(key.replace(/\s/g, ''))
    );

    if (knownKey) {
        return {
            bias: KNOWN_SOURCES[knownKey].biasRating as BiasRating,
            factuality: KNOWN_SOURCES[knownKey].factuality as Factuality,
            id: knownKey.replace(/\s/g, '-')
        };
    }

    return {
        bias: BiasRating.CENTER,
        factuality: Factuality.MIXED,
        id: sourceName.replace(/\s/g, '-').toLowerCase()
    };
};

// Strategy 0: Fetch via Local Backend Proxy (Most reliable)
async function fetchWithLocalProxy(targetUrl: string): Promise<string | null> {
    try {
        // This hits the server endpoint we just added in index.js
        const response = await fetch(`/api/proxy?url=${encodeURIComponent(targetUrl)}`);
        if (response.ok) {
            const text = await response.text();
            if (text.includes('<rss') || text.includes('<feed') || text.startsWith('<?xml')) {
                return text;
            }
        }
    } catch (e) {
        // Silent fail, try next strategy
    }
    return null;
}

// Strategy 1: Fetch Raw XML via Public Proxies
async function fetchWithXmlProxies(targetUrl: string): Promise<string | null> {
    for (const proxyBase of PROXY_LIST) {
        try {
            const encodedUrl = encodeURIComponent(targetUrl);
            let fetchUrl = `${proxyBase}${encodedUrl}`;
            
            // Add cache buster for allorigins to prevent stale errors
            if (proxyBase.includes('allorigins')) {
                fetchUrl += `&t=${Date.now()}`;
            }
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

            const response = await fetch(fetchUrl, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const text = await response.text();
                // Basic validation
                if (text.includes('<rss') || text.includes('<feed') || text.startsWith('<?xml')) {
                    return text;
                }
            }
        } catch (err) {
            // Continue to next proxy
        }
    }
    return null;
}

// Strategy 2: Fetch via RSS2JSON API (Fallback for stubborn CORS/WAF)
async function fetchWithJsonApi(targetUrl: string): Promise<any[] | null> {
    try {
        const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(targetUrl)}`;
        const response = await fetch(apiUrl);
        if (response.ok) {
            const data = await response.json();
            if (data.status === 'ok' && Array.isArray(data.items)) {
                return data.items;
            }
        }
    } catch (e) {
        console.warn(`JSON Fallback failed for ${targetUrl}`);
    }
    return null;
}

// Extract Image from XML Item
const extractImageFromXml = (item: Element): string | undefined => {
    // Strategy 1: Media Content
    const mediaContent = item.getElementsByTagNameNS("*", "content");
    if (mediaContent.length > 0) {
        const url = mediaContent[0].getAttribute("url");
        if (url) return url;
    }
    
    // Strategy 2: Enclosure
    const enclosure = item.querySelector("enclosure");
    if (enclosure?.getAttribute("type")?.startsWith("image")) {
        const url = enclosure.getAttribute("url");
        if (url) return url;
    }
    
    // Strategy 3: Media Thumbnail
    const thumbnail = item.getElementsByTagNameNS("*", "thumbnail");
    if (thumbnail.length > 0) {
        const url = thumbnail[0].getAttribute("url");
        if (url) return url;
    }
    
    // Strategy 4: Description Regex
    const description = item.querySelector("description")?.textContent || "";
    const imgMatch = description.match(/src=["'](.*?)["']/);
    if (imgMatch) return imgMatch[1];

    return undefined;
};

/**
 * PIPELINE STAGE 1: INGESTION
 * Fetches all configured RSS feeds and stores them in the 'news_articles' database table.
 */
export const ingestRSSFeeds = async (): Promise<void> => {
  const promises = RSS_FEEDS.map(async (feed) => {
    try {
      let dbArticles: DBArticle[] = [];
      
      // Attempt 0: Local Proxy (Primary)
      let xmlText = await fetchWithLocalProxy(feed.url);

      // Attempt 1: XML Public Proxies (Secondary)
      if (!xmlText) {
        xmlText = await fetchWithXmlProxies(feed.url);
      }
      
      if (xmlText) {
          const parser = new DOMParser();
          const xml = parser.parseFromString(xmlText, "text/xml");
          const items = Array.from(xml.querySelectorAll("item")).slice(0, 15);
          
          dbArticles = items.map(item => {
            const title = item.querySelector("title")?.textContent?.trim() || "No Title";
            const link = item.querySelector("link")?.textContent?.trim() || "";
            const pubDateRaw = item.querySelector("pubDate")?.textContent || item.querySelector("dc\\:date")?.textContent || new Date().toISOString();
            const description = item.querySelector("description")?.textContent || "";
            
            if (!link) return null;

            const metadata = mapSourceToMetadata(feed.name, link);

            return {
                id: generateId(link),
                sourceId: metadata.id,
                sourceName: feed.name,
                biasRating: metadata.bias,
                factuality: metadata.factuality,
                headline: title,
                url: link,
                pubDate: new Date(pubDateRaw).toISOString(),
                fetchedAt: new Date().toISOString(),
                summary: description.replace(/<[^>]*>/g, '').trim().substring(0, 200) + "...",
                imageUrl: extractImageFromXml(item),
                clusterId: undefined
            };
          }).filter(Boolean) as DBArticle[];
      } 
      else {
          // Attempt 2: JSON Fallback
          const jsonItems = await fetchWithJsonApi(feed.url);
          
          if (jsonItems) {
              dbArticles = jsonItems.slice(0, 15).map((item: any) => {
                  const metadata = mapSourceToMetadata(feed.name, item.link);
                  return {
                      id: generateId(item.link),
                      sourceId: metadata.id,
                      sourceName: feed.name,
                      biasRating: metadata.bias,
                      factuality: metadata.factuality,
                      headline: item.title,
                      url: item.link,
                      pubDate: new Date(item.pubDate).toISOString(),
                      fetchedAt: new Date().toISOString(),
                      summary: (item.description || "").replace(/<[^>]*>/g, '').trim().substring(0, 200) + "...",
                      imageUrl: item.thumbnail || item.enclosure?.link,
                      clusterId: undefined
                  };
              });
          }
      }

      // 3. Store in Central Database
      if (dbArticles.length > 0) {
        await dbService.upsertArticles(dbArticles);
        console.log(`Ingested ${dbArticles.length} articles from ${feed.name}`);
      } else {
        console.warn(`Failed to ingest ${feed.name} (All strategies failed)`);
      }
      
    } catch (error) {
      console.warn(`Error processing feed ${feed.name}:`, error);
    }
  });

  await Promise.all(promises);
};