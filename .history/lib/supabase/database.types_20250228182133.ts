export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      reddit_posts: {
        Row: {
          id: string
          post_id: string
          title: string
          content: string
          url: string
          subreddit: string
          author: string
          score: number
          created_at: string
          embedding: number[] | null
          metadata: Json | null
        }
        Insert: {
          id?: string
          post_id: string
          title: string
          content: string
          url: string
          subreddit: string
          author: string
          score: number
          created_at: string
          embedding?: number[] | null
          metadata?: Json | null
        }
        Update: {
          id?: string
          post_id?: string
          title?: string
          content?: string
          url?: string
          subreddit?: string
          author?: string
          score?: number
          created_at?: string
          embedding?: number[] | null
          metadata?: Json | null
        }
      }
      queries: {
        Row: {
          id: string
          query: string
          embedding: number[] | null
          results: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          query: string
          embedding?: number[] | null
          results?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          query?: string
          embedding?: number[] | null
          results?: Json | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      enable_pgvector_extension: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      match_documents: {
        Args: {
          query_embedding: number[]
          match_threshold: number
          match_count: number
        }
        Returns: {
          id: string
          post_id: string
          title: string
          content: string
          url: string
          subreddit: string
          author: string
          score: number
          created_at: string
          similarity: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
} 