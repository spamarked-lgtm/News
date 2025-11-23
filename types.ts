
export enum BiasRating {
  FAR_LEFT = 'Far Left',
  LEFT = 'Left',
  CENTER_LEFT = 'Center Left',
  CENTER = 'Center',
  CENTER_RIGHT = 'Center Right',
  RIGHT = 'Right',
  FAR_RIGHT = 'Far Right',
}

export enum Factuality {
  VERY_HIGH = 'Very High',
  HIGH = 'High',
  MIXED = 'Mixed',
  LOW = 'Low',
}

export interface NewsSource {
  id: string;
  name: string;
  biasRating: BiasRating;
  factuality: Factuality;
  domain: string;
}

// Database Schema: Table 'news_articles'
export interface DBArticle {
  id: string; // URL hash or unique ID
  sourceId: string;
  sourceName: string;
  biasRating: BiasRating;
  factuality: Factuality;
  headline: string;
  url: string;
  pubDate: string;
  fetchedAt: string;
  summary?: string; // Raw snippet from RSS
  imageUrl?: string;
  clusterId?: string; // Foreign key to news_clusters
  
  // New Analysis Fields
  embedding?: number[]; // Vector representation
  entities?: string[];  // List of extracted Named Entities
}

// Database Schema: Table 'news_clusters'
export interface DBCluster {
  id: string;
  headline: string; // Neutral headline
  summary: string; // Neutral summary
  category: string;
  mainImageUrl?: string;
  createdAt: string;
  stats: {
    totalSources: number;
    biasDistribution: BiasDistribution;
    blindspot: 'Left' | 'Right' | 'None';
  };
}

export interface Article {
  title: string;
  url: string;
  source: NewsSource;
  publishedAt: string; // ISO date string
  summary?: string;
}

export interface BiasDistribution {
  left: number;   // percentage 0-100
  center: number; // percentage 0-100
  right: number;  // percentage 0-100
}

export interface NewsStory {
  id: string;
  headline: string; // Neutral AI generated headline
  summary: string;
  articles: Article[];
  biasDistribution: BiasDistribution;
  totalSources: number;
  blindspot: 'Left' | 'Right' | 'None'; // Which side is ignoring this?
  lastUpdated: string;
  category: string;
  imageUrl?: string; // New field for story image
}

export interface SearchParams {
  query: string;
}
