
import { DBArticle, DBCluster } from '../types';

// Use relative path so it works on localhost:3001 AND production EC2 IP
const API_BASE = '/api';

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url: string, options?: RequestInit, retries = 5): Promise<Response> {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      // Retry on Server Errors (5xx) or if proxy is not ready (504/502)
      if (!res.ok && (res.status === 502 || res.status === 503 || res.status === 504)) {
         throw new Error(`Server returned ${res.status}`);
      }
      return res;
    } catch (e) {
      lastError = e;
      if (i < retries - 1) {
          const delay = 500 * Math.pow(2, i); // 500, 1000, 2000, 4000...
          console.warn(`Connection to ${url} failed. Retrying in ${delay}ms...`);
          await wait(delay);
      }
    }
  }
  throw lastError;
}

class DatabaseService {
  
  // --- ARTICLE OPERATIONS ---

  async upsertArticles(articles: DBArticle[]): Promise<void> {
    try {
      const response = await fetchWithRetry(`${API_BASE}/articles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(articles),
      });
      if (!response.ok) throw new Error('Failed to upsert articles');
    } catch (error) {
      console.error("DB Error (Upsert):", error);
    }
  }

  async getUnclusteredArticles(): Promise<DBArticle[]> {
    try {
      const response = await fetchWithRetry(`${API_BASE}/articles/unclustered`);
      if (!response.ok) return [];
      return await response.json();
    } catch (error) {
      console.error("DB Error (Get Unclustered):", error);
      return [];
    }
  }

  async getAllArticlesForCluster(clusterId: string): Promise<DBArticle[]> {
    try {
      const response = await fetchWithRetry(`${API_BASE}/articles/by-cluster/${clusterId}`);
      if (!response.ok) return [];
      return await response.json();
    } catch (error) {
      console.error("DB Error (Get Cluster Articles):", error);
      return [];
    }
  }

  // --- CLUSTER OPERATIONS ---

  async saveClusters(clusters: DBCluster[]): Promise<void> {
    try {
      const response = await fetchWithRetry(`${API_BASE}/clusters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clusters),
      });
      if (!response.ok) throw new Error('Failed to save clusters');
    } catch (error) {
      console.error("DB Error (Save Clusters):", error);
    }
  }

  async linkArticlesToCluster(clusterId: string, articleIds: string[]): Promise<void> {
    try {
      const response = await fetchWithRetry(`${API_BASE}/articles/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clusterId, articleIds }),
      });
      if (!response.ok) throw new Error('Failed to link articles');
    } catch (error) {
      console.error("DB Error (Link Articles):", error);
    }
  }

  async getRecentClusters(): Promise<DBCluster[]> {
    try {
      const response = await fetchWithRetry(`${API_BASE}/clusters`);
      if (!response.ok) return [];
      return await response.json();
    } catch (error) {
      console.error("DB Error (Get Recent Clusters):", error);
      return [];
    }
  }
  
  async clearDatabase(): Promise<void> {
      console.warn("clearDatabase called but disabled for Production DB");
  }
}

export const dbService = new DatabaseService();
