import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  },
  db: {
    schema: 'public'
  }
});

// Database types for our tables with the new columns
export interface RedditPost {
  id: string;
  subreddit: string;
  title: string;
  content?: string;
  url?: string;
  permalink?: string;
  author_id?: string;
  created_at?: Date;
  score?: number;
  upvote_ratio?: number;
  is_nsfw?: boolean;
  is_spoiler?: boolean;
  flair?: string;
  is_self_post?: boolean;
  embedding?: any; // The vector type
  search_vector?: any;
  last_updated?: Date;
  original_json?: any;
  // New change tracking columns
  content_checksum?: string;
  last_checked?: Date;
  update_count?: number;
  is_removed?: boolean;
}

export interface RedditComment {
  id: string;
  post_id: string;
  parent_id?: string;
  author_id?: string;
  content: string;
  created_at?: Date;
  score?: number;
  depth?: number;
  path?: string[];
  is_stickied?: boolean;
  embedding?: any; // The vector type
  search_vector?: any;
  original_json?: any;
  // New change tracking columns
  content_checksum?: string;
  last_checked?: Date;
  update_count?: number;
  is_removed?: boolean;
}

export interface EmbeddingQueueItem {
  id: number;
  record_id: string;
  schema_name: string;
  table_name: string;
  content_function: string;
  embedding_column: string;
  created_at: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  last_error?: string;
  processed_at?: Date;
  priority?: number;
  subreddit?: string;
  estimated_tokens?: number;
  // New queue tracking columns
  is_update?: boolean;
  reason?: string;
  cooldown_until?: Date;
}

/**
 * Apply database schema updates by running the update script
 */
export const applyDatabaseUpdates = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const scriptPath = path.resolve(__dirname, '../../scripts/apply-db-updates.sh');
    
    if (!fs.existsSync(scriptPath)) {
      reject(new Error(`Schema update script not found at ${scriptPath}`));
      return;
    }
    
    exec(scriptPath, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error applying schema updates: ${error.message}`);
        console.error(stderr);
        reject(error);
        return;
      }
      
      console.log(stdout);
      resolve();
    });
  });
};

/**
 * Calculate content checksum for change detection
 * @param content The content object to calculate checksum for
 * @param fields Fields to include in the checksum calculation
 */
export const calculateContentChecksum = (
  content: Record<string, any>,
  fields: string[] = config.changeDetection.checksumFields
): string => {
  let checksumInput = '';
  
  for (const field of fields) {
    if (content[field] !== undefined) {
      checksumInput += String(content[field] || '');
    }
  }
  
  // Simple hash function for the checksum
  // In a real implementation, you'd use a proper hashing function like MD5
  let hash = 0;
  for (let i = 0; i < checksumInput.length; i++) {
    const char = checksumInput.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return hash.toString(16);
};

export default {
  supabase,
  applyDatabaseUpdates,
  calculateContentChecksum
}; 