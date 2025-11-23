import { DBArticle } from "../types";

const API_BASE = '/api';

export const analysisService = {

  /**
   * Triggers the backend to run the ML Pipeline:
   * 1. Load Unclustered Articles from DB
   * 2. Embed (MiniLM) + NER (DistilBERT)
   * 3. Cluster (DBSTREAM)
   * 4. Label (Gemini)
   * 5. Save Clusters to DB
   */
  triggerPipeline: async (): Promise<{ success: boolean, message: string }> => {
    try {
      console.log("Triggering Backend ML Pipeline...");
      const response = await fetch(`${API_BASE}/pipeline/process`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Backend pipeline failed');
      }

      const result = await response.json();
      console.log("Pipeline Result:", result);
      return result;
    } catch (error) {
      console.error("Error triggering pipeline:", error);
      return { success: false, message: "Failed to trigger pipeline" };
    }
  },

  // Legacy placeholders to satisfy interfaces if needed, though not used in new flow
  enrichArticles: async (articles: DBArticle[]) => articles,
  clusterArticles: (articles: DBArticle[]) => [],
  generateClusterLabels: async (clusters: any[]) => []
};