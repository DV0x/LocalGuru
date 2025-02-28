// Types for API responses and data structures

// Reddit post data structure
export interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  url: string;
  permalink: string;
  author: string;
  created_utc: number;
  subreddit: string;
  score: number;
  num_comments: number;
}

// Structure for a travel recommendation
export interface TravelRecommendation {
  title: string;
  description: string;
  highlights: string[];
  tips: string[];
  source?: string;
  sourceUrl?: string;
}

// Structure for the query API request
export interface QueryRequest {
  query: string;
  limit?: number;
}

// Structure for the query API response
export interface QueryResponse {
  recommendations: TravelRecommendation[];
  relatedTopics?: string[];
  error?: string;
} 