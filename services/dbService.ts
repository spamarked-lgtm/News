
import { DBArticle, DBCluster } from '../types';

// Use relative path so it works on localhost:3001 AND production EC2 IP
const API_BASE = '/api';

class DatabaseService {
  
  // --- ARTICLE OPERATIONS ---

  async upsertArticles(articles: DBArticle[]): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/articles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(articles),
      });
      if (!response.ok) throw new Error('Failed to upsert articles');
    } catch (error) {
      console.error("DB Error:", error);
    }
  }

  async getUnclusteredArticles(): Promise<DBArticle[]> {
    try {
      const response = await fetch(`${API_BASE}/articles/unclustered`);
      if (!response.ok) return [];
      return await response.json();
    } catch (error) {
      console.error("DB Error:", error);
      return [];
    }
  }

  async getAllArticlesForCluster(clusterId: string): Promise<DBArticle[]> {
    try {
      const response = await fetch(`${API_BASE}/articles/by-cluster/${clusterId}`);
      if (!response.ok) return [];
      return await response.json();
    } catch (error) {
      console.error("DB Error:", error);
      return [];
    }
  }

  // --- CLUSTER OPERATIONS ---

  async saveClusters(clusters: DBCluster[]): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/clusters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clusters),
      });
      if (!response.ok) throw new Error('Failed to save clusters');
    } catch (error) {
      console.error("DB Error:", error);
    }
  }

  async linkArticlesToCluster(clusterId: string, articleIds: string[]): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/articles/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clusterId, articleIds }),
      });
      if (!response.ok) throw new Error('Failed to link articles');
    } catch (error) {
      console.error("DB Error:", error);
    }
  }

  async getRecentClusters(): Promise<DBCluster[]> {
    try {
      const response = await fetch(`${API_BASE}/clusters`);
      if (!response.ok) return [];
      return await response.json();
    } catch (error) {
      console.error("DB Error:", error);
      return [];
    }
  }
  
  async clearDatabase(): Promise<void> {
      console.warn("clearDatabase called but disabled for Production DB");
  }
}

export const dbService = new DatabaseService();
