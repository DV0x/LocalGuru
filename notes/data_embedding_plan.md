
# Detailed Implementation Plan: Reddit Data Ingestion & Embedding System

## Phase 1: Environment Setup (Days 1-2)

### Step 1: Project Initialization
```bash
# Create project directory
mkdir -p localguru-ingestion/src/{fetchers,processors,db,queue,utils}
mkdir -p localguru-ingestion/scripts
mkdir -p localguru-ingestion/logs

# Initialize npm project
cd localguru-ingestion
npm init -y

# Install dependencies
npm install @supabase/supabase-js axios dotenv typescript ts-node
npm install --save-dev @types/node

# Initialize TypeScript configuration
npx tsc --init
```

### Step 2: Environment Configuration
```bash
# Create .env file
cat > .env << EOF
# Supabase configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# Reddit API configuration
REDDIT_USER_AGENT=Localguru/1.0 (WebApp, https://example.com)
REDDIT_REQUEST_DELAY=2000

# Logging configuration
LOG_LEVEL=info
LOG_FORMAT=json
LOG_TO_FILE=true

# Email notifications (optional)
NOTIFICATION_EMAIL=
SMTP_SERVER=
EOF
```

### Step 3: Create Base Configuration File
```typescript
// src/config.ts
export const config = {
  reddit: {
    userAgent: process.env.REDDIT_USER_AGENT || 'Localguru/1.0',
    requestDelay: parseInt(process.env.REDDIT_REQUEST_DELAY || '2000', 10),
    initialSubreddit: 'AskSF',
  },
  
  changeDetection: {
    checksumFields: ['title', 'content', 'score', 'upvote_ratio'],
    ignoreFields: ['last_updated', 'last_checked', 'content_checksum'],
    forceUpdateAfterDays: 7,
  },
  
  database: {
    batchSize: 50,
    retryAttempts: 3,
    disableTriggers: true,
  },
  
  queue: {
    priorityMapping: {
      post: 8,
      comment: 5,
      updated_post: 9,
      updated_comment: 6,
    },
    defaultPriority: 5,
    maxQueueSize: 10000,
    cooldownMinutes: 60,
  },
  
  processQueue: {
    triggerAfterIngestion: true,
    batchSize: 50,
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    logToFile: process.env.LOG_TO_FILE === 'true',
    logDirectory: './logs',
  },
};
```

## Phase 2: Database Schema Setup (Day 3)

### Step 4: Create Database Schema Update Script
```sql
-- scripts/db-schema-updates.sql

-- Add change tracking columns to reddit_posts
ALTER TABLE reddit_posts 
ADD COLUMN IF NOT EXISTS content_checksum TEXT,
ADD COLUMN IF NOT EXISTS last_checked TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS update_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_removed BOOLEAN DEFAULT FALSE;

-- Add change tracking columns to reddit_comments
ALTER TABLE reddit_comments 
ADD COLUMN IF NOT EXISTS content_checksum TEXT,
ADD COLUMN IF NOT EXISTS last_checked TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS update_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_removed BOOLEAN DEFAULT FALSE;

-- Add columns to embedding_queue
ALTER TABLE embedding_queue
ADD COLUMN IF NOT EXISTS is_update BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reason TEXT,
ADD COLUMN IF NOT EXISTS cooldown_until TIMESTAMP WITH TIME ZONE;

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_posts_checksum ON reddit_posts(content_checksum);
CREATE INDEX IF NOT EXISTS idx_comments_checksum ON reddit_comments(content_checksum);
CREATE INDEX IF NOT EXISTS idx_posts_last_checked ON reddit_posts(last_checked);
CREATE INDEX IF NOT EXISTS idx_comments_last_checked ON reddit_comments(last_checked);
CREATE INDEX IF NOT EXISTS idx_queue_cooldown ON embedding_queue(cooldown_until);

-- Create function to calculate content checksum
CREATE OR REPLACE FUNCTION calculate_content_checksum(
  p_content JSONB,
  p_fields TEXT[] DEFAULT ARRAY['title', 'content', 'score']
) RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_checksum_input TEXT := '';
  v_field TEXT;
BEGIN
  -- Build a string of the fields to hash
  FOREACH v_field IN ARRAY p_fields
  LOOP
    IF p_content ? v_field THEN
      v_checksum_input := v_checksum_input || COALESCE(p_content->>v_field, '');
    END IF;
  END LOOP;

  -- Return MD5 hash
  RETURN MD5(v_checksum_input);
END;
$$;

-- Create queue management functions
CREATE OR REPLACE FUNCTION reset_stuck_processing_jobs(max_processing_time_minutes integer DEFAULT 60)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  reset_count integer;
BEGIN
  UPDATE embedding_queue
  SET 
    status = 'pending',
    attempts = attempts + 1,
    updated_at = NOW()
  WHERE
    status = 'processing'
    AND updated_at < NOW() - (max_processing_time_minutes || ' minutes')::interval;
    
  GET DIAGNOSTICS reset_count = ROW_COUNT;
  RETURN reset_count;
END;
$$;

CREATE OR REPLACE FUNCTION prune_completed_jobs(keep_count integer DEFAULT 1000)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count integer;
  completed_count integer;
BEGIN
  -- Count total completed jobs
  SELECT COUNT(*) INTO completed_count
  FROM embedding_queue
  WHERE status = 'completed';
  
  -- If we're under the keep count, do nothing
  IF completed_count <= keep_count THEN
    RETURN 0;
  END IF;
  
  -- Delete excess completed jobs
  DELETE FROM embedding_queue
  WHERE id IN (
    SELECT id
    FROM embedding_queue
    WHERE status = 'completed'
    ORDER BY updated_at ASC
    LIMIT (completed_count - keep_count)
  );
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION trim_queue_to_size(max_size integer DEFAULT 10000)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count integer;
  queue_size integer;
BEGIN
  -- Count pending queue items
  SELECT COUNT(*) INTO queue_size
  FROM embedding_queue
  WHERE status = 'pending';
  
  -- If we're under the max size, do nothing
  IF queue_size <= max_size THEN
    RETURN 0;
  END IF;
  
  -- Delete excess items (lowest priority first)
  DELETE FROM embedding_queue
  WHERE id IN (
    SELECT id
    FROM embedding_queue
    WHERE status = 'pending'
    ORDER BY priority ASC, created_at DESC
    LIMIT (queue_size - max_size)
  );
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
```

### Step 5: Apply Database Schema Updates
```bash
# Create script to apply database updates
cat > scripts/apply-db-updates.sh << 'EOF'
#!/bin/bash
# Script to apply database schema updates

# Load environment variables
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Check if SUPABASE_DB_URL is provided
if [ -z "$SUPABASE_DB_URL" ]; then
  echo "Error: SUPABASE_DB_URL environment variable is not set"
  echo "Format: postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"
  exit 1
fi

echo "Applying database schema updates..."
psql "$SUPABASE_DB_URL" -f scripts/db-schema-updates.sql

if [ $? -eq 0 ]; then
  echo "Database schema updated successfully"
  exit 0
else
  echo "Failed to update database schema"
  exit 1
fi
EOF

chmod +x scripts/apply-db-updates.sh
./scripts/apply-db-updates.sh
```

## Phase 3: Core Components Implementation (Days 4-7)

### Step 6: Implement Utility Classes
```typescript
// src/utils/logger.ts
import fs from 'fs';
import path from 'path';
import { config } from '../config';

enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const logLevelMap: Record<string, LogLevel> = {
  'debug': LogLevel.DEBUG,
  'info': LogLevel.INFO,
  'warn': LogLevel.WARN,
  'error': LogLevel.ERROR,
};

export class Logger {
  private module: string;
  private minLevel: LogLevel;
  private logToFile: boolean;
  private logDirectory: string;
  
  constructor(module: string) {
    this.module = module;
    this.minLevel = logLevelMap[config.logging.level] || LogLevel.INFO;
    this.logToFile = config.logging.logToFile;
    this.logDirectory = config.logging.logDirectory;
    
    if (this.logToFile && !fs.existsSync(this.logDirectory)) {
      fs.mkdirSync(this.logDirectory, { recursive: true });
    }
  }
  
  private formatLog(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    
    if (config.logging.format === 'json') {
      const logEntry = {
        timestamp,
        level,
        module: this.module,
        message,
        ...(data ? { data } : {}),
      };
      
      return JSON.stringify(logEntry);
    } else {
      return `[${timestamp}] [${level.toUpperCase()}] [${this.module}] ${message}${data ? ' ' + JSON.stringify(data) : ''}`;
    }
  }
  
  private writeToFile(entry: string, level: string): void {
    if (!this.logToFile) return;
    
    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(this.logDirectory, `${today}.log`);
    
    fs.appendFileSync(logFile, entry + '\n');
    
    if (level === 'error') {
      const errorLogFile = path.join(this.logDirectory, `${today}-errors.log`);
      fs.appendFileSync(errorLogFile, entry + '\n');
    }
  }
  
  debug(message: string, data?: any): void {
    if (this.minLevel <= LogLevel.DEBUG) {
      const entry = this.formatLog('debug', message, data);
      console.debug(entry);
      this.writeToFile(entry, 'debug');
    }
  }
  
  info(message: string, data?: any): void {
    if (this.minLevel <= LogLevel.INFO) {
      const entry = this.formatLog('info', message, data);
      console.info(entry);
      this.writeToFile(entry, 'info');
    }
  }
  
  warn(message: string, data?: any): void {
    if (this.minLevel <= LogLevel.WARN) {
      const entry = this.formatLog('warn', message, data);
      console.warn(entry);
      this.writeToFile(entry, 'warn');
    }
  }
  
  error(message: string, error?: Error, data?: any): void {
    if (this.minLevel <= LogLevel.ERROR) {
      const errorData = error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...data
      } : data;
      
      const entry = this.formatLog('error', message, errorData);
      console.error(entry);
      this.writeToFile(entry, 'error');
    }
  }
}

// src/utils/helpers.ts
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffFactor: number;
    shouldRetry?: (error: Error) => boolean;
  }
): Promise<T> {
  const { maxAttempts, initialDelayMs, maxDelayMs, backoffFactor, shouldRetry } = options;
  
  let lastError: Error;
  let currentDelay = initialDelayMs;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (shouldRetry && !shouldRetry(error)) {
        throw error;
      }
      
      if (attempt === maxAttempts) {
        throw error;
      }
      
      await delay(currentDelay);
      currentDelay = Math.min(currentDelay * backoffFactor, maxDelayMs);
    }
  }
  
  throw lastError!;
}

export function processArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  
  process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      args[key] = value || 'true';
    }
  });
  
  return args;
}
```

### Step 7: Implement Reddit API Client
```typescript
// src/fetchers/reddit-api.ts
import axios from 'axios';
import { delay } from '../utils/helpers';
import { Logger } from '../utils/logger';

export interface RedditAPIConfig {
  userAgent: string;
  clientId?: string;
  clientSecret?: string;
  requestDelay?: number;
}

export class RedditAPI {
  private userAgent: string;
  private auth: any;
  private requestDelay: number;
  private lastRequestTime: number = 0;
  private logger: Logger;

  constructor(config: RedditAPIConfig) {
    this.userAgent = config.userAgent;
    this.requestDelay = config.requestDelay || 2000;
    this.logger = new Logger('RedditAPI');
    
    if (config.clientId && config.clientSecret) {
      this.auth = {
        username: config.clientId,
        password: config.clientSecret
      };
    }
  }

  private async respectRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.requestDelay) {
      await delay(this.requestDelay - timeSinceLastRequest);
    }
    
    this.lastRequestTime = Date.now();
  }

  async get(endpoint: string, params: any = {}): Promise<any> {
    await this.respectRateLimit();
    
    try {
      const response = await axios.get(`https://www.reddit.com${endpoint}`, {
        params: {
          ...params,
          raw_json: 1
        },
        headers: {
          'User-Agent': this.userAgent
        },
        auth: this.auth
      });
      
      return response.data;
    } catch (error) {
      this.logger.error(`Reddit API error: ${error.message}`, error);
      throw error;
    }
  }

  async getSubredditPosts(subreddit: string, options: {
    limit?: number;
    after?: string;
    sort?: 'new' | 'hot' | 'top';
    time?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
  } = {}): Promise<any> {
    const params: any = {
      limit: options.limit || 100
    };
    
    if (options.after) params.after = options.after;
    if (options.time) params.t = options.time;
    
    const sort = options.sort || 'new';
    
    return this.get(`/r/${subreddit}/${sort}.json`, params);
  }

  async getAllSubredditPosts(subreddit: string, options: {
    maxPosts?: number;
    sort?: 'new' | 'hot' | 'top';
    time?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
  } = {}): Promise<any[]> {
    const maxPosts = options.maxPosts || 1000;
    let allPosts: any[] = [];
    let after: string | null = null;
    
    this.logger.info(`Fetching up to ${maxPosts} posts from r/${subreddit}`);
    
    while (allPosts.length < maxPosts) {
      const data = await this.getSubredditPosts(subreddit, {
        limit: 100,
        after,
        sort: options.sort,
        time: options.time
      });
      
      const posts = data.data.children;
      
      if (posts.length === 0) break;
      
      allPosts = [...allPosts, ...posts];
      after = data.data.after;
      
      this.logger.debug(`Fetched batch of ${posts.length} posts, total so far: ${allPosts.length}`);
      
      if (!after) break;
    }
    
    return allPosts.slice(0, maxPosts);
  }

  async getPostComments(postId: string, options: {
    sort?: 'confidence' | 'top' | 'new' | 'controversial' | 'old';
    limit?: number;
  } = {}): Promise<any> {
    const params: any = {};
    
    if (options.sort) params.sort = options.sort;
    if (options.limit) params.limit = options.limit;
    
    return this.get(`/comments/${postId}.json`, params);
  }
}
```

### Step 8: Implement Reddit Fetcher with Historical Support
```typescript
// src/fetchers/reddit-fetcher.ts
import { RedditAPI } from './reddit-api';
import { Logger } from '../utils/logger';
import { delay } from '../utils/helpers';

export interface RedditPost {
  id: string;
  subreddit: string;
  title: string;
  content: string;
  url: string;
  permalink: string;
  author_id: string;
  created_at: Date;
  score: number;
  upvote_ratio: number;
  is_nsfw: boolean;
  is_spoiler: boolean;
  flair: string;
  is_self_post: boolean;
  original_json: any;
}

export interface RedditComment {
  id: string;
  post_id: string;
  parent_id: string | null;
  content: string;
  author_id: string;
  created_at: Date;
  score: number;
  path: string[];
  depth: number;
  original_json: any;
}

export class RedditFetcher {
  private api: RedditAPI;
  private logger: Logger;
  
  constructor(config: {
    userAgent: string;
    requestDelay?: number;
  }) {
    this.api = new RedditAPI({
      userAgent: config.userAgent,
      requestDelay: config.requestDelay
    });
    
    this.logger = new Logger('RedditFetcher');
  }
  
  // Transform Reddit API post to our format
  private transformPost(rawPost: any): RedditPost {
    const post = rawPost.data;
    
    return {
      id: post.id,
      subreddit: post.subreddit,
      title: post.title,
      content: post.selftext || '',
      url: post.url,
      permalink: post.permalink,
      author_id: post.author,
      created_at: new Date(post.created_utc * 1000),
      score: post.score,
      upvote_ratio: post.upvote_ratio,
      is_nsfw: post.over_18,
      is_spoiler: post.spoiler,
      flair: post.link_flair_text || '',
      is_self_post: post.is_self,
      original_json: post
    };
  }
  
  // Process comments recursively
  private processComments(
    comments: any[],
    postId: string,
    parentId: string | null = null,
    depth: number = 0,
    path: string[] = []
  ): RedditComment[] {
    let allComments: RedditComment[] = [];
    
    for (const comment of comments) {
      // Skip non-comment items like "more" links
      if (comment.kind !== 't1') continue;
      
      const data = comment.data;
      
      // Skip deleted/removed comments
      if (data.body === '[deleted]' || data.body === '[removed]') continue;
      
      const commentId = data.id;
      const newPath = [...path, commentId];
      
      // Create comment object
      const transformedComment: RedditComment = {
        id: commentId,
        post_id: postId,
        parent_id: parentId,
        content: data.body,
        author_id: data.author,
        created_at: new Date(data.created_utc * 1000),
        score: data.score,
        path: newPath,
        depth: depth,
        original_json: data
      };
      
      // Add to results
      allComments.push(transformedComment);
      
      // Process replies recursively
      if (data.replies && data.replies.data && data.replies.data.children) {
        const childComments = this.processComments(
          data.replies.data.children,
          postId,
          commentId,
          depth + 1,
          newPath
        );
        
        allComments = [...allComments, ...childComments];
      }
    }
    
    return allComments;
  }
  
  // Fetch a single post with its comments
  async fetchPost(postId: string): Promise<{
    post: RedditPost;
    comments: RedditComment[];
  }> {
    this.logger.info(`Fetching post ${postId}`);
    
    const response = await this.api.getPostComments(postId);
    
    // Response is an array: [post, comments]
    const postData = response[0].data.children[0];
    const commentsData = response[1].data.children;
    
    const post = this.transformPost(postData);
    const comments = this.processComments(commentsData, postId);
    
    this.logger.info(`Fetched post ${postId} with ${comments.length} comments`);
    
    return { post, comments };
  }
  
  // Fetch all posts from a subreddit with their comments
  async fetchSubreddit(subreddit: string, options: {
    maxPosts?: number;
    fetchAllTime?: boolean;
    sort?: 'new' | 'hot' | 'top';
  } = {}): Promise<{
    posts: RedditPost[];
    comments: RedditComment[];
  }> {
    this.logger.info(`Fetching content from r/${subreddit}`);
    
    const timeRange = options.fetchAllTime ? 'all' : 'day';
    const sort = options.sort || (options.fetchAllTime ? 'top' : 'new');
    
    // Get posts from the subreddit
    const rawPosts = await this.api.getAllSubredditPosts(subreddit, {
      maxPosts: options.maxPosts || 100,
      sort: sort,
      time: timeRange
    });
    
    const posts: RedditPost[] = [];
    let allComments: RedditComment[] = [];
    
    // Process each post and its comments
    for (const rawPost of rawPosts) {
      const post = this.transformPost(rawPost);
      posts.push(post);
      
      try {
        // Fetch comments for this post
        const { comments } = await this.fetchPost(post.id);
        allComments = [...allComments, ...comments];
        
        this.logger.info(`Processed post ${post.id} with ${comments.length} comments`);
        
        // Rate limiting between posts
        await delay(2000);
      } catch (error) {
        this.logger.error(`Error fetching comments for post ${post.id}: ${error.message}`);
      }
    }
    
    this.logger.info(`Completed fetch from r/${subreddit}: ${posts.length} posts, ${allComments.length} comments`);
    
    return {
      posts,
      comments: allComments
    };
  }
  
  // Fetch historical data from a subreddit
  async fetchSubredditHistory(subreddit: string, options: {
    startDate?: Date;
    endDate?: Date;
    maxPosts?: number;
  } = {}): Promise<{
    posts: RedditPost[];
    comments: RedditComment[];
  }> {
    this.logger.info(`Fetching historical content from r/${subreddit}`);
    
    const startDate = options.startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // Default to 1 year ago
    const endDate = options.endDate || new Date();
    
    let allPosts: RedditPost[] = [];
    let allComments: RedditComment[] = [];
    
    // Loop through each month in the range to work around Reddit API limitations
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const monthEnd = new Date(currentDate);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      
      // Don't go past the end date
      if (monthEnd > endDate) {
        monthEnd.setTime(endDate.getTime());
      }
      
      this.logger.info(`Fetching posts from ${currentDate.toISOString().split('T')[0]} to ${monthEnd.toISOString().split('T')[0]}`);
      
      // First try getting 'top' posts for this month period
      try {
        let monthPosts: RedditPost[] = [];
        const rawTopPosts = await this.api.getAllSubredditPosts(subreddit, {
          maxPosts: 250, // More posts for historical periods
          sort: 'top',
          time: 'month'
        });
        
        for (const rawPost of rawTopPosts) {
          const post = this.transformPost(rawPost);
          const postDate = new Date(post.created_at);
          
          // Filter by date range
          if (postDate >= currentDate && postDate <= monthEnd) {
            monthPosts.push(post);
          }
        }
        
        // Then get 'new' posts for the same period to ensure we get them all
        const rawNewPosts = await this.api.getAllSubredditPosts(subreddit, {
          maxPosts: 250,
          sort: 'new',
          time: 'month'
        });
        
        for (const rawPost of rawNewPosts) {
          const post = this.transformPost(rawPost);
          const postDate = new Date(post.created_at);
          
          // Filter by date range
          if (postDate >= currentDate && postDate <= monthEnd) {
            // Check if we already have this post to avoid duplicates
            if (!monthPosts.some(p => p.id === post.id)) {
              monthPosts.push(post);
            }
          }
        }
        
        this.logger.info(`Found ${monthPosts.length} posts for this month`);
        
        // Process each post and fetch its comments
        for (const post of monthPosts) {
          allPosts.push(post);
          
          try {
            // Fetch comments for this post
            const { comments } = await this.fetchPost(post.id);
            allComments = [...allComments, ...comments];
            
            this.logger.info(`Processed post ${post.id} with ${comments.length} comments`);
            
            // Rate limiting between posts
            await delay(2000);
          } catch (error) {
            this.logger.error(`Error fetching comments for post ${post.id}: ${error.message}`);
          }
        }
      } catch (error) {
        this.logger.error(`Error fetching posts for month ${currentDate.toISOString().split('T')[0]}: ${error.message}`);
      }
      
      // Move to next month
      currentDate.setMonth(currentDate.getMonth() + 1);
      
      // Add a longer delay between months to respect rate limits
      await delay(5000);
    }
    
    this.logger.info(`Completed historical fetch from r/${subreddit}: ${allPosts.length} posts, ${allComments.length} comments`);
    
    return {
      posts: allPosts,
      comments: allComments
    };
  }
}
```

## Phase 4: Core Processing Implementation (Days 8-11)

### Step 9: Implement Change Detector
```typescript
// src/processors/change-detector.ts
import { createHash } from 'crypto';
import { Logger } from '../utils/logger';

interface ChangeDetectorConfig {
  checksumFields: string[];
  ignoreFields: string[];
  forceUpdateAfterDays: number;
}

export class ChangeDetector {
  private config: ChangeDetectorConfig;
  private logger: Logger;
  
  constructor(config: ChangeDetectorConfig) {
    this.config = {
      checksumFields: config.checksumFields || ['title', 'content', 'score'],
      ignoreFields: config.ignoreFields || ['last_updated'],
      forceUpdateAfterDays: config.forceUpdateAfterDays || 7
    };
    
    this.logger = new Logger('ChangeDetector');
  }
  
  // Generate checksum for content
  generateChecksum(content: any): string {
    const fields = this.config.checksumFields;
    let checksumInput = '';
    
    for (const field of fields) {
      if (content[field] !== undefined) {
        checksumInput += String(content[field]);
      }
    }
    
    return createHash('md5').update(checksumInput).digest('hex');
  }
  
  // Check if content needs updating based on age
  private needsForcedUpdate(lastChecked: Date): boolean {
    if (!lastChecked) return true;
    
    const now = new Date();
    const diffDays = (now.getTime() - lastChecked.getTime()) / (1000 * 60 * 60 * 24);
    
    return diffDays >= this.config.forceUpdateAfterDays;
  }
  
  // Detect changes in posts
  async detectPostChanges(
    posts: any[],
    existingPosts: Map<string, any>
  ): Promise<{
    new: any[],
    updated: any[],
    unchanged: any[]
  }> {
    const newPosts: any[] = [];
    const updatedPosts: any[] = [];
    const unchangedPosts: any[] = [];
    
    for (const post of posts) {
      const postId = post.id;
      const newChecksum = this.generateChecksum(post);
      
      // Set the checksum on the post object
      post.content_checksum = newChecksum;
      
      const existingPost = existingPosts.get(postId);
      
      if (!existingPost) {
        // New post
        this.logger.debug(`New post detected: ${postId}`);
        newPosts.push(post);
      } else {
        // Check if the post has changed
        const existingChecksum = existingPost.content_checksum;
        const needsForceUpdate = this.needsForcedUpdate(existingPost.last_checked);
        
        if (newChecksum !== existingChecksum || needsForceUpdate) {
          // Post has changed or needs a forced update
          this.logger.debug(`Updated post detected: ${postId}`);
          
          // Copy fields that should persist
          for (const field of this.config.ignoreFields) {
            if (existingPost[field] !== undefined && post[field] === undefined) {
              post[field] = existingPost[field];
            }
          }
          
          // Increment update count
          post.update_count = (existingPost.update_count || 0) + 1;
          
          updatedPosts.push(post);
        } else {
          // Post hasn't changed
          this.logger.debug(`Unchanged post: ${postId}`);
          unchangedPosts.push(post);
        }
      }
    }
    
    this.logger.info(`Change detection complete: ${newPosts.length} new, ${updatedPosts.length} updated, ${unchangedPosts.length} unchanged`);
    
    return {
      new: newPosts,
      updated: updatedPosts,
      unchanged: unchangedPosts
    };
  }
  
  // Detect changes in comments (similar to posts)
  async detectCommentChanges(
    comments: any[],
    existingComments: Map<string, any>
  ): Promise<{
    new: any[],
    updated: any[],
    unchanged: any[]
  }> {
    const newComments: any[] = [];
    const updatedComments: any[] = [];
    const unchangedComments: any[] = [];
    
    for (const comment of comments) {
      const commentId = comment.id;
      const newChecksum = this.generateChecksum(comment);
      
      // Set the checksum on the comment object
      comment.content_checksum = newChecksum;
      
      const existingComment = existingComments.get(commentId);
      
      if (!existingComment) {
        // New comment
        this.logger.debug(`New comment detected: ${commentId}`);
        newComments.push(comment);
      } else {
        // Check if the comment has changed
        const existingChecksum = existingComment.content_checksum;
        const needsForceUpdate = this.needsForcedUpdate(existingComment.last_checked);
        
        if (newChecksum !== existingChecksum || needsForceUpdate) {
          // Comment has changed or needs a forced update
          this.logger.debug(`Updated comment detected: ${commentId}`);
          
          // Copy fields that should persist
          for (const field of this.config.ignoreFields) {
            if (existingComment[field] !== undefined && comment[field] === undefined) {
              comment[field] = existingComment[field];
            }
          }
          
          // Increment update count
          comment.update_count = (existingComment.update_count || 0) + 1;
          
          updatedComments.push(comment);
        } else {
          // Comment hasn't changed
          this.logger.debug(`Unchanged comment: ${commentId}`);
          unchangedComments.push(comment);
        }
      }
    }
    
    this.logger.info(`Comment change detection complete: ${newComments.length} new, ${updatedComments.length} updated, ${unchangedComments.length} unchanged`);
    
    return {
      new: newComments,
      updated: updatedComments,
      unchanged: unchangedComments
    };
  }
}
```

### Step 10: Implement Database Handler
```typescript
// src/db/db-handler.ts
import { createClient } from '@supabase/supabase-js';
import { Logger } from '../utils/logger';

interface DBHandlerConfig {
  batchSize: number;
  retryAttempts: number;
  disableTriggers: boolean;
}

export class DBHandler {
  private supabase: any;
  private config: DBHandlerConfig;
  private logger: Logger;
  
  constructor(supabaseUrl: string, supabaseKey: string, config: DBHandlerConfig) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    
    this.config = {
      batchSize: config.batchSize || 50,
      retryAttempts: config.retryAttempts || 3,
      disableTriggers: config.disableTriggers || false
    };
    
    this.logger = new Logger('DBHandler');
  }
  
  // Disable triggers for better performance during bulk operations
  async disableTriggers(): Promise<void> {
    this.logger.info('Disabling database triggers');
    
    try {
      // Disable for posts
      await this.supabase.rpc('alter_triggers', {
        table_name: 'reddit_posts',
        enable: false
      });
      
      // Disable for comments
      await this.supabase.rpc('alter_triggers', {
        table_name: 'reddit_comments',
        enable: false
      });
      
      this.logger.info('Triggers disabled successfully');
    } catch (error) {
      this.logger.error(`Error disabling triggers: ${error.message}`, error);
      throw error;
    }
  }
  
  // Re-enable triggers after operations
  async enableTriggers(): Promise<void> {
    this.logger.info('Re-enabling database triggers');
    
    try {
      // Enable for posts
      await this.supabase.rpc('alter_triggers', {
        table_name: 'reddit_posts',
        enable: true
      });
      
      // Enable for comments
      await this.supabase.rpc('alter_triggers', {
        table_name: 'reddit_comments',
        enable: true
      });
      
      this.logger.info('Triggers enabled successfully');
    } catch (error) {
      this.logger.error(`Error enabling triggers: ${error.message}`, error);
      throw error;
    }
  }
  
  // Insert posts in batches
  async insertPosts(posts: any[]): Promise<string[]> {
    const insertedIds: string[] = [];
    const batchSize = this.config.batchSize;
    
    this.logger.info(`Inserting ${posts.length} posts in batches of ${batchSize}`);
    
    // Process in batches
    for (let i = 0; i < posts.length; i += batchSize) {
      const batch = posts.slice(i, i + batchSize);
      
      try {
        // Set last_checked to now
        const postsWithTimestamp = batch.map(post => ({
          ...post,
          last_checked: new Date()
        }));
        
        const { data, error } = await this.supabase
          .from('reddit_posts')
          .insert(postsWithTimestamp)
          .select('id');
        
        if (error) throw error;
        
        const batchIds = data.map((item: any) => item.id);
        insertedIds.push(...batchIds);
        
        this.logger.info(`Inserted batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(posts.length/batchSize)}`);
      } catch (error) {
        this.logger.error(`Error inserting batch: ${error.message}`, error);
        throw error;
      }
    }
    
    this.logger.info(`Inserted ${insertedIds.length} posts successfully`);
    return insertedIds;
  }
  
  // Update existing posts
  async updatePosts(posts: any[]): Promise<string[]> {
    const updatedIds: string[] = [];
    const batchSize = this.config.batchSize;
    
    this.logger.info(`Updating ${posts.length} posts in batches of ${batchSize}`);
    
    // Process in batches
    for (let i = 0; i < posts.length; i += batchSize) {
      const batch = posts.slice(i, i + batchSize);
      
      // Update one by one to avoid conflicts
      for (const post of batch) {
        try {
          // Set last_checked to now
          post.last_checked = new Date();
          
          const { error } = await this.supabase
            .from('reddit_posts')
            .update(post)
            .eq('id', post.id);
          
          if (error) throw error;
          
          updatedIds.push(post.id);
        } catch (error) {
          this.logger.error(`Error updating post ${post.id}: ${error.message}`, error);
          // Continue with other posts
        }
      }
      
      this.logger.info(`Updated batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(posts.length/batchSize)}`);
    }
    
    this.logger.info(`Updated ${updatedIds.length} posts successfully`);
    return updatedIds;
  }
  
  // Insert comments in batches
  async insertComments(comments: any[]): Promise<string[]> {
    const insertedIds: string[] = [];
    const batchSize = this.config.batchSize;
    
    this.logger.info(`Inserting ${comments.length} comments in batches of ${batchSize}`);
    
    // Process in batches
    for (let i = 0; i < comments.length; i += batchSize) {
      const batch = comments.slice(i, i + batchSize);
      
      try {
        // Set last_checked to now
        const commentsWithTimestamp = batch.map(comment => ({
          ...comment,
          last_checked: new Date()
        }));
        
        const { data, error } = await this.supabase
          .from('reddit_comments')
          .insert(commentsWithTimestamp)
          .select('id');
        
        if (error) throw error;
        
        const batchIds = data.map((item: any) => item.id);
        insertedIds.push(...batchIds);
        
        this.logger.info(`Inserted batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(comments.length/batchSize)}`);
      } catch (error) {
        this.logger.error(`Error inserting batch: ${error.message}`, error);
        // Continue with next batch
      }
    }
    
    this.logger.info(`Inserted ${insertedIds.length} comments successfully`);
    return insertedIds;
  }
  
  // Update existing comments
  async updateComments(comments: any[]): Promise<string[]> {
    const updatedIds: string[] = [];
    const batchSize = this.config.batchSize;
    
    this.logger.info(`Updating ${comments.length} comments in batches of ${batchSize}`);
    
    // Process in batches
    for (let i = 0; i < comments.length; i += batchSize) {
      const batch = comments.slice(i, i + batchSize);
      
      // Update one by one to avoid conflicts
      for (const comment of batch) {
        try {
          // Set last_checked to now
          comment.last_checked = new Date();
          
          const { error } = await this.supabase
            .from('reddit_comments')
            .update(comment)
            .eq('id', comment.id);
          
          if (error) throw error;
          
          updatedIds.push(comment.id);
        } catch (error) {
          this.logger.error(`Error updating comment ${comment.id}: ${error.message}`, error);
          // Continue with other comments
        }
      }
      
      this.logger.info(`Updated batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(comments.length/batchSize)}`);
    }
    
    this.logger.info(`Updated ${updatedIds.length} comments successfully`);
    return updatedIds;
  }
  
  // Get all existing posts by ID
  async getExistingPosts(postIds: string[]): Promise<Map<string, any>> {
    const result = new Map<string, any>();
    const batchSize = this.config.batchSize;
    
    this.logger.info(`Fetching ${postIds.length} existing posts in batches of ${batchSize}`);
    
    // Process in batches to avoid query size limits
    for (let i = 0; i < postIds.length; i += batchSize) {
      const batchIds = postIds.slice(i, i + batchSize);
      
      try {
        const { data, error } = await this.supabase
          .from('reddit_posts')
          .select('*')
          .in('id', batchIds);
        
        if (error) throw error;
        
        // Add to result map
        data.forEach((post: any) => {
          result.set(post.id, post);
        });
        
        this.logger.debug(`Fetched batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(postIds.length/batchSize)}`);
      } catch (error) {
        this.logger.error(`Error fetching posts batch: ${error.message}`, error);
        // Continue with next batch
      }
    }
    
    this.logger.info(`Fetched ${result.size} existing posts`);
    return result;
  }
  // Get all existing comments by ID
  async getExistingComments(commentIds: string[]): Promise<Map<string, any>> {
    const result = new Map<string, any>();
    const batchSize = this.config.batchSize;
    
    this.logger.info(`Fetching ${commentIds.length} existing comments in batches of ${batchSize}`);
    
    // Process in batches to avoid query size limits
    for (let i = 0; i < commentIds.length; i += batchSize) {
      const batchIds = commentIds.slice(i, i + batchSize);
      
      try {
        const { data, error } = await this.supabase
          .from('reddit_comments')
          .select('*')
          .in('id', batchIds);
        
        if (error) throw error;
        
        // Add to result map
        data.forEach((comment: any) => {
          result.set(comment.id, comment);
        });
        
        this.logger.debug(`Fetched batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(commentIds.length/batchSize)}`);
      } catch (error) {
        this.logger.error(`Error fetching comments batch: ${error.message}`, error);
        // Continue with next batch
      }
    }
    
    this.logger.info(`Fetched ${result.size} existing comments`);
    return result;
  }
}
```

### Step 11: Implement Queue Manager
```typescript
// src/queue/queue-manager.ts
import { createClient } from '@supabase/supabase-js';
import { Logger } from '../utils/logger';

interface QueueConfig {
  priorityMapping: Record<string, number>;
  defaultPriority: number;
  maxQueueSize: number;
  cooldownMinutes: number;
}

interface QueueItem {
  id: string;
  type: 'post' | 'comment' | 'updated_post' | 'updated_comment';
  subreddit: string;
}

export class QueueManager {
  private supabase: any;
  private config: QueueConfig;
  private logger: Logger;
  
  constructor(supabaseUrl: string, supabaseKey: string, config: QueueConfig) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    
    this.config = {
      priorityMapping: config.priorityMapping || {
        post: 8,
        comment: 5,
        updated_post: 9,
        updated_comment: 6
      },
      defaultPriority: config.defaultPriority || 5,
      maxQueueSize: config.maxQueueSize || 10000,
      cooldownMinutes: config.cooldownMinutes || 60
    };
    
    this.logger = new Logger('QueueManager');
  }
  
  // Calculate priority for a queue item
  calculatePriority(item: QueueItem): number {
    // Base priority from content type
    const priority = this.config.priorityMapping[item.type] || this.config.defaultPriority;
    
    // Ensure priority is within limits (1-10)
    return Math.min(Math.max(priority, 1), 10);
  }
  
  // Add a cooldown timestamp for this item
  private getCooldownTimestamp(): Date {
    const now = new Date();
    now.setMinutes(now.getMinutes() + this.config.cooldownMinutes);
    return now;
  }
  
  // Queue a single item for embedding
  async queueItemForEmbedding(item: QueueItem): Promise<boolean> {
    try {
      const priority = this.calculatePriority(item);
      const isUpdate = item.type.startsWith('updated_');
      const contentType = item.type.endsWith('post') ? 'post' : 'comment';
      const tableName = `reddit_${contentType}s`;
      
      // Check if already in queue to prevent duplicates
      const { data: existingItems, error: checkError } = await this.supabase
        .from('embedding_queue')
        .select('id, status')
        .eq('record_id', item.id)
        .not('status', 'eq', 'completed')
        .not('status', 'eq', 'failed');
      
      if (checkError) throw checkError;
      
      if (existingItems && existingItems.length > 0) {
        // Already queued - update priority if higher
        const existingItem = existingItems[0];
        
        const { error } = await this.supabase
          .from('embedding_queue')
          .update({
            priority: priority,
            is_update: isUpdate,
            reason: item.type
          })
          .eq('id', existingItem.id);
        
        if (error) throw error;
        
        this.logger.debug(`Updated priority for existing queue item: ${item.id}`);
        return false;
      }
      
      // Add new queue item
      const { error } = await this.supabase
        .from('embedding_queue')
        .insert({
          record_id: item.id,
          schema_name: 'public',
          table_name: tableName,
          content_function: contentType === 'post' ? 'get_post_content' : 'get_comment_content',
          embedding_column: 'embedding',
          status: 'pending',
          attempts: 0,
          priority: priority,
          subreddit: item.subreddit,
          is_update: isUpdate,
          reason: item.type,
          cooldown_until: isUpdate ? this.getCooldownTimestamp() : null
        });
      
      if (error) throw error;
      
      this.logger.debug(`Queued item for embedding: ${item.id} (${item.type}, priority: ${priority})`);
      return true;
    } catch (error) {
      this.logger.error(`Error queueing item ${item.id}: ${error.message}`, error);
      return false;
    }
  }
  
  // Queue multiple items in batch
  async queueBatch(items: QueueItem[]): Promise<number> {
    this.logger.info(`Queueing batch of ${items.length} items for embedding`);
    
    let successCount = 0;
    
    // Queue items one by one to handle duplication checks
    for (const item of items) {
      const success = await this.queueItemForEmbedding(item);
      if (success) successCount++;
    }
    
    this.logger.info(`Successfully queued ${successCount} new items for embedding`);
    return successCount;
  }
  
  // Clean up the queue (remove old completed items, reset stuck items)
  async cleanupQueue(): Promise<void> {
    this.logger.info('Performing queue cleanup');
    
    try {
      // Reset items stuck in "processing" state for too long (1 hour)
      const { error: resetError } = await this.supabase.rpc(
        'reset_stuck_processing_jobs',
        { max_processing_time_minutes: 60 }
      );
      
      if (resetError) throw resetError;
      
      // Delete old completed jobs (keep last 1000)
      const { error: pruneError } = await this.supabase.rpc(
        'prune_completed_jobs',
        { keep_count: 1000 }
      );
      
      if (pruneError) throw pruneError;
      
      // Remove items over max queue size (keeping highest priority)
      const { error: trimError } = await this.supabase.rpc(
        'trim_queue_to_size',
        { max_size: this.config.maxQueueSize }
      );
      
      if (trimError) throw trimError;
      
      this.logger.info('Queue cleanup completed successfully');
    } catch (error) {
      this.logger.error(`Error during queue cleanup: ${error.message}`, error);
      throw error;
    }
  }
}
```

## Phase 5: Main Application (Days 12-13)

### Step 12: Implement Main Orchestrator
```typescript
// src/index.ts
import dotenv from 'dotenv';
import { RedditFetcher } from './fetchers/reddit-fetcher';
import { ChangeDetector } from './processors/change-detector';
import { DBHandler } from './db/db-handler';
import { QueueManager } from './queue/queue-manager';
import { Logger } from './utils/logger';
import { config } from './config';
import { processArgs } from './utils/helpers';

// Load environment variables
dotenv.config();

// Parse command line arguments
const args = processArgs();
const MODE = args.mode || 'ingestion';
const SUBREDDIT = args.subreddit || config.reddit.initialSubreddit;
const FETCH_ALL = args.fetchAll === 'true';
const MONTHS = parseInt(args.months || '12', 10);

// Main logger
const logger = new Logger('Main');

// Check for required environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  logger.error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_KEY');
  process.exit(1);
}

// Initialize components
const fetcher = new RedditFetcher({
  userAgent: config.reddit.userAgent,
  requestDelay: config.reddit.requestDelay
});

const changeDetector = new ChangeDetector({
  checksumFields: config.changeDetection.checksumFields,
  ignoreFields: config.changeDetection.ignoreFields,
  forceUpdateAfterDays: config.changeDetection.forceUpdateAfterDays
});

const dbHandler = new DBHandler(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  {
    batchSize: config.database.batchSize,
    retryAttempts: config.database.retryAttempts,
    disableTriggers: config.database.disableTriggers
  }
);

const queueManager = new QueueManager(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  {
    priorityMapping: config.queue.priorityMapping,
    defaultPriority: config.queue.defaultPriority,
    maxQueueSize: config.queue.maxQueueSize,
    cooldownMinutes: config.queue.cooldownMinutes
  }
);

// Function to run the ingestion process
async function runIngestion(subreddit: string, fetchAllTime: boolean): Promise<void> {
  try {
    logger.info(`Starting ingestion for r/${subreddit}${fetchAllTime ? ' (all time)' : ' (recent)'}`);
    
    // 1. Fetch data from Reddit
    const { posts, comments } = await fetcher.fetchSubreddit(subreddit, {
      maxPosts: fetchAllTime ? 1000 : 100,  // Fetch more posts for all-time ingestion
      fetchAllTime: fetchAllTime,
      sort: fetchAllTime ? 'top' : 'new'
    });
    
    logger.info(`Fetched ${posts.length} posts and ${comments.length} comments from r/${subreddit}`);
    
    // 2. Get existing content for change detection
    const postIds = posts.map(p => p.id);
    const commentIds = comments.map(c => c.id);
    
    const existingPosts = await dbHandler.getExistingPosts(postIds);
    const existingComments = await dbHandler.getExistingComments(commentIds);
    
    // 3. Detect changes
    const postChanges = await changeDetector.detectPostChanges(posts, existingPosts);
    const commentChanges = await changeDetector.detectCommentChanges(comments, existingComments);
    
    logger.info(`Detected changes - Posts: ${postChanges.new.length} new, ${postChanges.updated.length} updated`);
    logger.info(`Detected changes - Comments: ${commentChanges.new.length} new, ${commentChanges.updated.length} updated`);
    
    // 4. Handle database operations
    if (config.database.disableTriggers) {
      await dbHandler.disableTriggers();
    }
    
    const newPostIds = await dbHandler.insertPosts(postChanges.new);
    const updatedPostIds = await dbHandler.updatePosts(postChanges.updated);
    const newCommentIds = await dbHandler.insertComments(commentChanges.new);
    const updatedCommentIds = await dbHandler.updateComments(commentChanges.updated);
    
    if (config.database.disableTriggers) {
      await dbHandler.enableTriggers();
    }
    
    // 5. Queue items for embedding
    const queueItems = [
      ...newPostIds.map(id => ({ id, type: 'post' as const, subreddit })),
      ...updatedPostIds.map(id => ({ id, type: 'updated_post' as const, subreddit })),
      ...newCommentIds.map(id => ({ id, type: 'comment' as const, subreddit })),
      ...updatedCommentIds.map(id => ({ id, type: 'updated_comment' as const, subreddit })),
    ];
    
    const queuedCount = await queueManager.queueBatch(queueItems);
    logger.info(`Queued ${queuedCount} items for embedding`);
    
    // 6. Optionally trigger process-queue
    if (config.processQueue.triggerAfterIngestion) {
      await triggerProcessQueue();
    }
    
    // 7. Queue cleanup
    await queueManager.cleanupQueue();
    
    logger.info(`Completed ingestion for r/${subreddit}`);
  } catch (error) {
    logger.error(`Error during ingestion: ${error.message}`, error);
    throw error;
  }
}

// Function to run historical ingestion
async function runHistoricalIngestion(subreddit: string, months: number): Promise<void> {
  try {
    logger.info(`Starting historical ingestion for r/${subreddit} (${months} months)`);
    
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    
    // 1. Fetch historical data from Reddit
    const { posts, comments } = await fetcher.fetchSubredditHistory(subreddit, {
      startDate,
      endDate: new Date()
    });
    
    logger.info(`Fetched ${posts.length} posts and ${comments.length} comments from r/${subreddit}`);
    
    // 2. Get existing content for change detection
    const postIds = posts.map(p => p.id);
    const commentIds = comments.map(c => c.id);
    
    const existingPosts = await dbHandler.getExistingPosts(postIds);
    const existingComments = await dbHandler.getExistingComments(commentIds);
    
    // 3. Detect changes
    const postChanges = await changeDetector.detectPostChanges(posts, existingPosts);
    const commentChanges = await changeDetector.detectCommentChanges(comments, existingComments);
    
    logger.info(`Detected changes - Posts: ${postChanges.new.length} new, ${postChanges.updated.length} updated`);
    logger.info(`Detected changes - Comments: ${commentChanges.new.length} new, ${commentChanges.updated.length} updated`);
    
    // 4. Handle database operations
    if (config.database.disableTriggers) {
      await dbHandler.disableTriggers();
    }
    
    const newPostIds = await dbHandler.insertPosts(postChanges.new);
    const updatedPostIds = await dbHandler.updatePosts(postChanges.updated);
    const newCommentIds = await dbHandler.insertComments(commentChanges.new);
    const updatedCommentIds = await dbHandler.updateComments(commentChanges.updated);
    
    if (config.database.disableTriggers) {
      await dbHandler.enableTriggers();
    }
    
    // 5. Queue items for embedding
    const queueItems = [
      ...newPostIds.map(id => ({ id, type: 'post' as const, subreddit })),
      ...updatedPostIds.map(id => ({ id, type: 'updated_post' as const, subreddit })),
      ...newCommentIds.map(id => ({ id, type: 'comment' as const, subreddit })),
      ...updatedCommentIds.map(id => ({ id, type: 'updated_comment' as const, subreddit })),
    ];
    
    const queuedCount = await queueManager.queueBatch(queueItems);
    logger.info(`Queued ${queuedCount} items for embedding`);
    
    // 6. Optionally trigger process-queue
    if (config.processQueue.triggerAfterIngestion) {
      await triggerProcessQueue();
    }
    
    // 7. Queue cleanup
    await queueManager.cleanupQueue();
    
    logger.info(`Completed historical ingestion for r/${subreddit}`);
  } catch (error) {
    logger.error(`Error during historical ingestion: ${error.message}`, error);
    throw error;
  }
}

// Function to trigger the process-queue Edge Function
async function triggerProcessQueue(): Promise<void> {
  logger.info('Triggering process-queue Edge Function');
  
  try {
    const response = await fetch(`${process.env.SUPABASE_URL}/functions/v1/process-queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
      },
      body: JSON.stringify({
        batchSize: config.processQueue.batchSize
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to trigger process-queue: ${errorText}`);
    }
    
    logger.info('Successfully triggered process-queue');
  } catch (error) {
    logger.error(`Error triggering process-queue: ${error.message}`, error);
    // Continue execution even if process-queue trigger fails
  }
}

// Main execution
(async function main() {
  try {
    switch (MODE) {
      case 'ingestion':
        await runIngestion(SUBREDDIT, FETCH_ALL);
        break;
        
      case 'historical-ingestion':
        await runHistoricalIngestion(SUBREDDIT, MONTHS);
        break;
        
      case 'queue-cleanup':
        await queueManager.cleanupQueue();
        break;
        
      case 'trigger-process':
        await triggerProcessQueue();
        break;
        
      default:
        logger.error(`Unknown mode: ${MODE}`);
        process.exit(1);
    }
    
    logger.info('Execution completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error(`Fatal error: ${error.message}`, error);
    process.exit(1);
  }
})();
```

## Phase 6: Automation Scripts (Days 14-15)

### Step 13: Create Initial Load Script
```bash
#!/bin/bash
# scripts/initial-load.sh
# Script to perform the initial load of the past year of data

# Set default values
SUBREDDIT=${1:-"AskSF"}
MONTHS=${2:-"12"}
LOG_DIR="./logs"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="${LOG_DIR}/initial_load_${SUBREDDIT}_${TIMESTAMP}.log"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Load environment variables
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

echo "=============================================" | tee -a "$LOG_FILE"
echo "Starting initial historical load for r/${SUBREDDIT}" | tee -a "$LOG_FILE"
echo "Loading data from past ${MONTHS} months" | tee -a "$LOG_FILE"
echo "Started at: $(date)" | tee -a "$LOG_FILE"
echo "=============================================" | tee -a "$LOG_FILE"

# Run the historical ingestion process
node dist/index.js --mode=historical-ingestion --subreddit="$SUBREDDIT" --months="$MONTHS" 2>&1 | tee -a "$LOG_FILE"

# Check if execution was successful
if [ $? -eq 0 ]; then
  echo "=============================================" | tee -a "$LOG_FILE"
  echo "Initial load completed successfully!" | tee -a "$LOG_FILE"
  echo "Completed at: $(date)" | tee -a "$LOG_FILE"
  echo "=============================================" | tee -a "$LOG_FILE"
  EXIT_CODE=0
else
  echo "=============================================" | tee -a "$LOG_FILE"
  echo "Initial load FAILED with error!" | tee -a "$LOG_FILE"
  echo "Failed at: $(date)" | tee -a "$LOG_FILE"
  echo "Check logs for details." | tee -a "$LOG_FILE"
  echo "=============================================" | tee -a "$LOG_FILE"
  EXIT_CODE=1
fi

# Send notification email with summary if configured
if [ ! -z "$NOTIFICATION_EMAIL" ] && [ ! -z "$SMTP_SERVER" ]; then
  SUBJECT="Initial Load Report: r/${SUBREDDIT} (${TIMESTAMP})"
  
  if [ $EXIT_CODE -eq 0 ]; then
    SUBJECT="✅ ${SUBJECT}"
  else
    SUBJECT="❌ ${SUBJECT}"
  fi
  
  # Create a summary from the log file (last 50 lines)
  SUMMARY=$(tail -n 50 "$LOG_FILE")
  
  # Send email
  echo -e "Initial load process summary for r/${SUBREDDIT}\n\nTime: $(date)\n\n${SUMMARY}" | \
    mail -s "$SUBJECT" -S smtp="$SMTP_SERVER" "$NOTIFICATION_EMAIL"
fi

exit $EXIT_CODE
```

### Step 14: Create Daily Ingestion Script
```bash
#!/bin/bash
# scripts/daily-ingestion.sh
# Script to run the daily ingestion process

# Set default values
SUBREDDIT=${1:-"AskSF"}
LOG_DIR="./logs"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="${LOG_DIR}/daily_${SUBREDDIT}_${TIMESTAMP}.log"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Load environment variables
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

echo "=============================================" | tee -a "$LOG_FILE"
echo "Starting daily ingestion for r/${SUBREDDIT}" | tee -a "$LOG_FILE"
echo "Started at: $(date)" | tee -a "$LOG_FILE"
echo "=============================================" | tee -a "$LOG_FILE"

# Run the ingestion process
node dist/index.js --mode=ingestion --subreddit="$SUBREDDIT" --fetchAll=false 2>&1 | tee -a "$LOG_FILE"

# Check if execution was successful
if [ $? -eq 0 ]; then
  echo "=============================================" | tee -a "$LOG_FILE"
  echo "Daily ingestion completed successfully!" | tee -a "$LOG_FILE"
  echo "Completed at: $(date)" | tee -a "$LOG_FILE"
  echo "=============================================" | tee -a "$LOG_FILE"
  EXIT_CODE=0
else
  echo "=============================================" | tee -a "$LOG_FILE"
  echo "Daily ingestion FAILED with error!" | tee -a "$LOG_FILE"
  echo "Failed at: $(date)" | tee -a "$LOG_FILE"
  echo "Check logs for details." | tee -a "$LOG_FILE"
  echo "=============================================" | tee -a "$LOG_FILE"
  EXIT_CODE=1
fi

# Send notification email with summary if configured
if [ ! -z "$NOTIFICATION_EMAIL" ] && [ ! -z "$SMTP_SERVER" ]; then
  SUBJECT="Daily Ingestion Report: r/${SUBREDDIT} (${TIMESTAMP})"
  
  if [ $EXIT_CODE -eq 0 ]; then
    SUBJECT="✅ ${SUBJECT}"
  else
    SUBJECT="❌ ${SUBJECT}"
  fi
  
  # Create a summary from the log file (last 30 lines)
  SUMMARY=$(tail -n 30 "$LOG_FILE")
  
  # Send email
  echo -e "Daily ingestion process summary for r/${SUBREDDIT}\n\nTime: $(date)\n\n${SUMMARY}" | \
    mail -s "$SUBJECT" -S smtp="$SMTP_SERVER" "$NOTIFICATION_EMAIL"
fi

exit $EXIT_CODE
```

### Step 15: Create Process Queue Trigger Script
```bash
#!/bin/bash
# scripts/trigger-process-queue.sh
# Script to trigger the process-queue Edge Function

# Set default values
BATCH_SIZE=${1:-50}
MIN_PRIORITY=${2:-1}
LOG_DIR="./logs"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="${LOG_DIR}/process_queue_${TIMESTAMP}.log"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Load environment variables
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Check required environment variables
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
  echo "Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set" | tee -a "$LOG_FILE"
  exit 1
fi

echo "=============================================" | tee -a "$LOG_FILE"
echo "Triggering process-queue with:" | tee -a "$LOG_FILE"
echo "- Batch size: $BATCH_SIZE" | tee -a "$LOG_FILE"
echo "- Min priority: $MIN_PRIORITY" | tee -a "$LOG_FILE"
echo "Started at: $(date)" | tee -a "$LOG_FILE"
echo "=============================================" | tee -a "$LOG_FILE"

# Make API call to trigger process-queue
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${SUPABASE_URL}/functions/v1/process-queue" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"batchSize\": $BATCH_SIZE, \"minPriority\": $MIN_PRIORITY}")

# Extract the HTTP status code
HTTP_STATUS=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "Response body: ${BODY}" | tee -a "$LOG_FILE"
echo "HTTP status: ${HTTP_STATUS}" | tee -a "$LOG_FILE"

# Check if curl was successful
if [ "$HTTP_STATUS" -ge 200 ] && [ "$HTTP_STATUS" -lt 300 ]; then
  echo "=============================================" | tee -a "$LOG_FILE"
  echo "Process-queue triggered successfully" | tee -a "$LOG_FILE"
  echo "Completed at: $(date)" | tee -a "$LOG_FILE"
  echo "=============================================" | tee -a "$LOG_FILE"
  exit 0
else
  echo "=============================================" | tee -a "$LOG_FILE"
  echo "Failed to trigger process-queue" | tee -a "$LOG_FILE"
  echo "Failed at: $(date)" | tee -a "$LOG_FILE"
  echo "=============================================" | tee -a "$LOG_FILE"
  exit 1
fi
```

### Step 16: Create Cron Setup Script
```bash
#!/bin/bash
# scripts/setup-cron.sh
# Script to set up cron jobs for Reddit data ingestion and processing

# Get the absolute path of the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BASE_DIR="$(dirname "$SCRIPT_DIR")"

# Load environment variables
if [ -f "$BASE_DIR/.env" ]; then
  source "$BASE_DIR/.env"
fi

echo "Setting up cron jobs for Reddit data ingestion and processing"
echo "Using base directory: $BASE_DIR"

# Generate cron entries for initial setup with just AskSF
cat << EOF > /tmp/localguru_cron

# Localguru Reddit Ingestion Crontab
# Generated on $(date)
# Initially configured for r/AskSF only

# Environment variables
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
MAILTO=${NOTIFICATION_EMAIL:-""}

# Daily ingestion for AskSF (at 1 AM)
0 1 * * * cd ${BASE_DIR} && ./scripts/daily-ingestion.sh AskSF >> ./logs/cron.log 2>&1

# Process queue trigger (runs every 15 minutes)
*/15 * * * * cd ${BASE_DIR} && ./scripts/trigger-process-queue.sh 50 1 >> ./logs/cron.log 2>&1

# Queue cleanup (runs every 6 hours)
0 */6 * * * cd ${BASE_DIR} && node dist/index.js --mode=queue-cleanup >> ./logs/cron.log 2>&1

# Log rotation (daily at midnight)
0 0 * * * find ${BASE_DIR}/logs -name "*.log" -type f -mtime +14 -delete

EOF

# Install the crontab for the current user
crontab /tmp/localguru_cron

# Check if crontab was installed successfully
if [ $? -eq 0 ]; then
  echo "Cron jobs installed successfully"
  echo "You can view your crontab with: crontab -l"
  echo "To add more subreddits later, edit your crontab and add more daily ingestion lines"
  rm /tmp/localguru_cron
  exit 0
else
  echo "Failed to install cron jobs"
  echo "You can manually install them from /tmp/localguru_cron"
  exit 1
fi
```

## Phase 7: Project Build (Day 16)

### Step 17: Create TypeScript Configuration
```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020", "DOM"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Step 18: Update Package.json
```json
// package.json
{
  "name": "localguru-ingestion",
  "version": "1.0.0",
  "description": "Reddit data ingestion and embedding system for Localguru",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "ingest": "node dist/index.js --mode=ingestion",
    "historical": "node dist/index.js --mode=historical-ingestion",
    "cleanup": "node dist/index.js --mode=queue-cleanup",
    "trigger": "node dist/index.js --mode=trigger-process",
    "initial-load": "./scripts/initial-load.sh",
    "daily": "./scripts/daily-ingestion.sh",
    "setup-cron": "./scripts/setup-cron.sh",
    "apply-db": "./scripts/apply-db-updates.sh"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.38.4",
    "axios": "^1.6.2",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "typescript": "^5.3.2"
  }
}
```

## Phase 8: Implementation Plan (Day 17)

### Step 19: Create Main Implementation Script
```bash
#!/bin/bash
# Implementation Plan Script

# Define colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=============================================${NC}"
echo -e "${BLUE}  Reddit Data Ingestion Implementation Plan  ${NC}"
echo -e "${BLUE}=============================================${NC}\n"

echo -e "${YELLOW}This script will guide you through implementing the Reddit data ingestion system.${NC}\n"

# Step 1: Check prerequisites
echo -e "${GREEN}Step 1: Checking prerequisites...${NC}"
command -v node >/dev/null 2>&1 || { echo -e "${RED}Node.js is required but not installed. Aborting.${NC}"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo -e "${RED}npm is required but not installed. Aborting.${NC}"; exit 1; }

# Ensure we have a recent version of Node.js
NODE_VERSION=$(node -v | cut -d 'v' -f 2)
NODE_MAJOR_VERSION=$(echo $NODE_VERSION | cut -d '.' -f 1)
if [ "$NODE_MAJOR_VERSION" -lt 16 ]; then
  echo -e "${RED}Node.js version 16 or higher is required (found v${NODE_VERSION}).${NC}"
  echo -e "${RED}Please upgrade Node.js and try again.${NC}"
  exit 1
fi

echo -e "Node.js v${NODE_VERSION} found.\n"

# Step 2: Collect configuration
echo -e "${GREEN}Step 2: Setting up configuration...${NC}"

if [ ! -f .env ]; then
  echo -e "${YELLOW}Creating .env file...${NC}"
  
  read -p "Enter your Supabase URL: " SUPABASE_URL
  read -p "Enter your Supabase Service Key: " SUPABASE_SERVICE_KEY
  read -p "Enter your Supabase Database URL (for schema updates): " SUPABASE_DB_URL
  
  cat > .env << EOF
# Supabase configuration
SUPABASE_URL=${SUPABASE_URL}
SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
SUPABASE_DB_URL=${SUPABASE_DB_URL}

# Reddit API configuration
REDDIT_USER_AGENT=Localguru/1.0 (WebApp)
REDDIT_REQUEST_DELAY=2000

# Logging configuration
LOG_LEVEL=info
LOG_FORMAT=json
LOG_TO_FILE=true
EOF

  echo -e "Created .env file with your configuration.\n"
else
  echo -e "${YELLOW}.env file already exists. Using existing configuration.${NC}\n"
fi

# Step 3: Install dependencies
echo -e "${GREEN}Step 3: Installing dependencies...${NC}"
npm install
echo -e "Dependencies installed successfully.\n"

# Step 4: Set up database schema
echo -e "${GREEN}Step 4: Setting up database schema...${NC}"
chmod +x scripts/apply-db-updates.sh
if ./scripts/apply-db-updates.sh; then
  echo -e "Database schema updated successfully.\n"
else
  echo -e "${RED}Failed to update database schema. Check errors above.${NC}\n"
  read -p "Do you want to continue anyway? (y/n): " CONTINUE
  if [ "$CONTINUE" != "y" ]; then
    exit 1
  fi
fi

# Step 5: Build the project
echo -e "${GREEN}Step 5: Building the project...${NC}"
npm run build
echo -e "Project built successfully.\n"

# Step 6: Run initial ingestion
echo -e "${GREEN}Step 6: Initial data load...${NC}"
echo -e "${YELLOW}Ready to perform initial load of r/AskSF data from the past year.${NC}"
echo -e "${YELLOW}This will fetch all AskSF posts and comments from the last 12 months.${NC}"
echo -e "${YELLOW}This process may take several hours due to Reddit API rate limits.${NC}"
read -p "Do you want to continue with the initial load? (y/n): " RUN_INITIAL

if [ "$RUN_INITIAL" = "y" ]; then
  chmod +x scripts/initial-load.sh
  ./scripts/initial-load.sh AskSF 12
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}Initial load completed successfully!${NC}\n"
  else
    echo -e "${RED}Initial load encountered errors. Check logs for details.${NC}\n"
  fi
else
  echo -e "Skipping initial load.\n"
fi

# Step 7: Set up daily ingestion
echo -e "${GREEN}Step 7: Setting up daily ingestion...${NC}"
chmod +x scripts/daily-ingestion.sh
chmod +x scripts/trigger-process-queue.sh
chmod +x scripts/setup-cron.sh

echo -e "${YELLOW}Ready to set up automated daily ingestion via cron jobs.${NC}"
echo -e "${YELLOW}This will create cron jobs for daily ingestion and process-queue triggering.${NC}"
read -p "Do you want to set up cron jobs? (y/n): " SETUP_CRON

if [ "$SETUP_CRON" = "y" ]; then
  ./scripts/setup-cron.sh
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}Cron jobs set up successfully!${NC}\n"
  else
    echo -e "${RED}Failed to set up cron jobs. Check errors above.${NC}\n"
  fi
else
  echo -e "Skipping cron setup.\n"
  echo -e "${YELLOW}You can run the following commands manually:${NC}"
  echo -e "  npm run daily         - Run daily ingestion"
  echo -e "  npm run trigger       - Trigger process-queue"
  echo -e "  npm run cleanup       - Clean up the queue"
  echo -e "  npm run setup-cron    - Set up cron jobs later\n"
fi

# Final instructions
echo -e "${BLUE}=============================================${NC}"
echo -e "${GREEN}Implementation Complete!${NC}"
echo -e "${BLUE}=============================================${NC}\n"

echo -e "${YELLOW}Next Steps:${NC}"
echo -e "1. Monitor the logs in the ./logs directory"
echo -e "2. Check the database to verify data ingestion"
echo -e "3. When ready to add more subreddits, edit your crontab (crontab -e)"
echo -e "   and add additional daily ingestion lines like:"
echo -e "   0 2 * * * cd $(pwd) && ./scripts/daily-ingestion.sh AnotherSubreddit >> ./logs/cron.log 2>&1\n"

echo -e "For each new subreddit, run an initial load first:"
echo -e "  ./scripts/initial-load.sh NewSubredditName 12\n"

echo -e "${GREEN}Happy data ingestion!${NC}\n"
```

## Complete End-to-End Execution Flow

1. **Initial Setup**:
   - Run implementation script to set up the entire system
   - Installs dependencies and builds the project
   - Sets up database schema with required columns
   - Configures environment variables

2. **Initial Data Load (r/AskSF)**:
   - Load full year of historical data from r/AskSF
   - Fetches all posts and comments
   - Stores in database tables
   - Queues content for embedding generation

3. **Daily Ingestion**:
   - Automatically runs via cron job each day
   - Fetches only new content from last 24 hours
   - Detects and processes updates to existing content
   - Queues new and updated content for embedding

4. **Process Queue Execution**:
   - Triggered automatically every 15 minutes
   - Processes items in priority order
   - Calls enhanced-embeddings Edge Function
   - Generates embeddings for search

5. **Queue Maintenance**:
   - Runs automatically every 6 hours
   - Cleans up completed jobs
   - Resets stuck processing jobs
   - Optimizes queue size

This plan will successfully implement the Reddit data ingestion system, focusing initially on r/AskSF as required, with the flexibility to add more subreddits in the future.
