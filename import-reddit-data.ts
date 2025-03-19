import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

// Load environment variables from root .env.local file
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Initialize Supabase client with schema setting
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    db: {
      schema: 'public',
    }
  }
);

console.log("Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log("Service role key exists:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);

// Reddit API configuration
const REDDIT_USER_AGENT = 'LocalGuru:v1.0 (by /u/yourusername)';
const SUBREDDIT = 'AskSF';
const POST_LIMIT = 10; 