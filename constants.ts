
import { BiasRating, Factuality, NewsSource } from './types';

// A static map to help the AI map common Indian sources if it hallucinates or to provide fallbacks
export const KNOWN_SOURCES: Record<string, Partial<NewsSource>> = {
  'ndtv': { biasRating: BiasRating.LEFT, factuality: Factuality.HIGH },
  'the wire': { biasRating: BiasRating.FAR_LEFT, factuality: Factuality.MIXED },
  'republic': { biasRating: BiasRating.RIGHT, factuality: Factuality.LOW }, // Covers republic world/tv
  'opindia': { biasRating: BiasRating.FAR_RIGHT, factuality: Factuality.LOW },
  'the hindu': { biasRating: BiasRating.CENTER_LEFT, factuality: Factuality.VERY_HIGH },
  'indian express': { biasRating: BiasRating.CENTER_LEFT, factuality: Factuality.HIGH },
  'times of india': { biasRating: BiasRating.CENTER, factuality: Factuality.HIGH },
  'hindustan times': { biasRating: BiasRating.CENTER, factuality: Factuality.HIGH },
  'india today': { biasRating: BiasRating.CENTER, factuality: Factuality.HIGH },
  'scroll.in': { biasRating: BiasRating.LEFT, factuality: Factuality.HIGH },
  'newslaundry': { biasRating: BiasRating.LEFT, factuality: Factuality.HIGH },
  'swarajya': { biasRating: BiasRating.RIGHT, factuality: Factuality.MIXED },
  'firstpost': { biasRating: BiasRating.CENTER_RIGHT, factuality: Factuality.MIXED },
  'zee news': { biasRating: BiasRating.RIGHT, factuality: Factuality.MIXED },
  'news18': { biasRating: BiasRating.CENTER_RIGHT, factuality: Factuality.HIGH },
  'aaj tak': { biasRating: BiasRating.CENTER_RIGHT, factuality: Factuality.HIGH },
  'abp': { biasRating: BiasRating.CENTER, factuality: Factuality.HIGH },
  'amar ujala': { biasRating: BiasRating.CENTER, factuality: Factuality.HIGH },
  'dainik jagran': { biasRating: BiasRating.RIGHT, factuality: Factuality.MIXED },
};

export const CATEGORIES = ['All', 'Politics', 'Business', 'Technology', 'Entertainment', 'Sports'];

export const RSS_FEEDS = [
  { id: 'ndtv', name: 'NDTV', url: 'https://feeds.feedburner.com/ndtvnews-latest' },
  { id: 'toi', name: 'Times of India', url: 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms' },
  { id: 'the-hindu', name: 'The Hindu', url: 'https://www.thehindu.com/news/national/feeder/default.rss' },
  { id: 'indian-express', name: 'Indian Express', url: 'https://indianexpress.com/section/india/feed/' },
  { id: 'hindustan-times', name: 'Hindustan Times', url: 'https://www.hindustantimes.com/feeds/rss/latest/rssfeed.xml' },
  { id: 'news18', name: 'News18', url: 'https://www.news18.com/commonfeeds/v1/eng/rss/india.xml' },
  { id: 'zee-news', name: 'Zee News', url: 'https://zeenews.india.com/rss/india-national-news.xml' },
  { id: 'india-today-home', name: 'India Today', url: 'https://www.indiatoday.in/rss/home' },
];
