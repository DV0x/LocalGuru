export type Database = {
  public: {
    Tables: {
      reddit_posts: {
        Row: {
          id: number
          post_id: string
          title: string
          content: string | null
          subreddit: string
          author: string | null
          created_at: string
          url: string | null
          score: number | null
          num_comments: number | null
        }
        Insert: {
          id?: number
          post_id: string
          title: string
          content?: string | null
          subreddit: string
          author?: string | null
          created_at?: string
          url?: string | null
          score?: number | null
          num_comments?: number | null
        }
        Update: {
          id?: number
          post_id?: string
          title?: string
          content?: string | null
          subreddit?: string
          author?: string | null
          created_at?: string
          url?: string | null
          score?: number | null
          num_comments?: number | null
        }
      }
      reddit_embeddings: {
        Row: {
          id: number
          post_id: string
          embedding: number[]
          created_at: string
        }
        Insert: {
          id?: number
          post_id: string
          embedding: number[]
          created_at?: string
        }
        Update: {
          id?: number
          post_id?: string
          embedding?: number[]
          created_at?: string
        }
      }
      query_logs: {
        Row: {
          id: number
          query: string
          query_embedding: number[] | null
          response: string | null
          created_at: string
          response_time_ms: number | null
          user_id: string | null
        }
        Insert: {
          id?: number
          query: string
          query_embedding?: number[] | null
          response?: string | null
          created_at?: string
          response_time_ms?: number | null
          user_id?: string | null
        }
        Update: {
          id?: number
          query?: string
          query_embedding?: number[] | null
          response?: string | null
          created_at?: string
          response_time_ms?: number | null
          user_id?: string | null
        }
      }
    }
    Functions: {
      match_reddit_posts: {
        Args: {
          query_embedding: number[]
          match_threshold: number
          match_count: number
        }
        Returns: {
          post_id: string
          title: string
          content: string
          subreddit: string
          url: string
          similarity: number
        }[]
      }
    }
  }
} 