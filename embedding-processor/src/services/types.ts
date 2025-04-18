// src/services/types.ts
export interface QueueItem {
  id: string;
  content_id: string;
  content_type: 'post' | 'comment';
  status: string;
  priority: number;
  created_at: string;
  updated_at?: string;
  processed_at?: string;
  error_message?: string;
}

export interface Post {
  id: string;
  title: string;
  content?: string;
  subreddit: string;
}

export interface Comment {
  id: string;
  content?: string;
  post_id: string;
  parent_id?: string;
  path?: string[];
  post?: {
    title: string;
    subreddit: string;
    content?: string;
  };
}

export interface ThreadContext {
  postId: string;
  postTitle: string;
  postContent?: string;
  subreddit: string;
  parentId?: string;
  path?: string[];
  depth?: number;
  summary?: string;
  parent_comments?: ParentComment[];
}

export interface ParentComment {
  id: string;
  content: string;
}

export interface EntityExtractionResult {
  entities: Record<string, string[] | undefined>;
  topics: string[];
  locations: string[];
  semanticTags: string[];
}

export interface EntityTags {
  topics: string[];
  locations?: string[];
  semanticTags?: string[];
} 