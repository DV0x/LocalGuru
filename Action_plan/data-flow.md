# Reddit Data Backend Implementation: Phases 4-6

## Phase 4: Data Access Functions

1. **Create Supabase functions for data access**
   ```sql
   -- Get post with comments (paginated)
   CREATE OR REPLACE FUNCTION get_post_with_comments(
     post_id_param TEXT,
     page_size INTEGER DEFAULT 50,
     page_number INTEGER DEFAULT 1
   )
   RETURNS JSON
   LANGUAGE plpgsql
   AS $$
   DECLARE
     post_json JSON;
     comments_json JSON;
   BEGIN
     -- Get the post
     SELECT 
       json_build_object(
         'id', p.id,
         'subreddit', p.subreddit,
         'title', p.title,
         'content', p.content,
         'author', u.username,
         'created_at', p.created_at,
         'score', p.score,
         'upvote_ratio', p.upvote_ratio
       )
     INTO post_json
     FROM reddit_posts p
     JOIN reddit_users u ON p.author_id = u.id
     WHERE p.id = post_id_param;
     
     -- Get the comments (paginated)
     SELECT 
       json_agg(
         json_build_object(
           'id', c.id,
           'parent_id', c.parent_id,
           'author', u.username,
           'content', c.content,
           'created_at', c.created_at,
           'score', c.score,
           'depth', c.depth,
           'path', c.path
         )
       )
     INTO comments_json
     FROM reddit_comments c
     JOIN reddit_users u ON c.author_id = u.id
     WHERE c.post_id = post_id_param
     ORDER BY c.path
     LIMIT page_size
     OFFSET ((page_number - 1) * page_size);
     
     -- Return combined result
     RETURN json_build_object(
       'post', post_json,
       'comments', COALESCE(comments_json, '[]'::JSON)
     );
   END;
   $$;
   
   -- Get posts from subreddit (paginated)
   CREATE OR REPLACE FUNCTION get_subreddit_posts(
     subreddit_param TEXT,
     page_size INTEGER DEFAULT 25,
     page_number INTEGER DEFAULT 1,
     sort_by TEXT DEFAULT 'score', -- score, created_at, title
     sort_direction TEXT DEFAULT 'desc', -- asc, desc
     min_score INTEGER DEFAULT NULL
   )
   RETURNS JSON
   LANGUAGE plpgsql
   AS $$
   DECLARE
     posts_json JSON;
     total_count INTEGER;
   BEGIN
     -- Get total count for pagination
     SELECT COUNT(*) INTO total_count
     FROM reddit_posts
     WHERE subreddit = subreddit_param
       AND (min_score IS NULL OR score >= min_score);
     
     -- Get posts with dynamic sorting
     EXECUTE format('
       SELECT json_agg(
         json_build_object(
           ''id'', p.id,
           ''title'', p.title,
           ''content'', p.content,
           ''author'', u.username,
           ''created_at'', p.created_at,
           ''score'', p.score,
           ''upvote_ratio'', p.upvote_ratio,
           ''comment_count'', (
             SELECT COUNT(*) FROM reddit_comments WHERE post_id = p.id
           )
         )
       )
       FROM reddit_posts p
       JOIN reddit_users u ON p.author_id = u.id
       WHERE p.subreddit = %L
         AND (%L IS NULL OR p.score >= %L)
       ORDER BY p.%I %s
       LIMIT %L
       OFFSET %L',
       subreddit_param,
       min_score, min_score,
       sort_by, sort_direction,
       page_size, (page_number - 1) * page_size
     ) INTO posts_json;
     
     -- Return results with pagination info
     RETURN json_build_object(
       'posts', COALESCE(posts_json, '[]'::JSON),
       'pagination', json_build_object(
         'total_count', total_count,
         'page_size', page_size,
         'page_number', page_number,
         'total_pages', CEIL(total_count::numeric / page_size)
       )
     );
   END;
   $$;
   
   -- Full text search
   CREATE OR REPLACE FUNCTION text_search_posts(
     search_query TEXT,
     filter_subreddit TEXT DEFAULT NULL,
     min_score INTEGER DEFAULT NULL,
     page_size INTEGER DEFAULT 25,
     page_number INTEGER DEFAULT 1
   )
   RETURNS JSON
   LANGUAGE plpgsql
   AS $$
   DECLARE
     posts_json JSON;
     total_count INTEGER;
     search_ts_query TSQUERY;
   BEGIN
     -- Convert to ts_query
     search_ts_query := to_tsquery('english', search_query);
     
     -- Get total count
     SELECT COUNT(*) INTO total_count
     FROM reddit_posts p
     WHERE p.search_vector @@ search_ts_query
       AND (filter_subreddit IS NULL OR p.subreddit = filter_subreddit)
       AND (min_score IS NULL OR p.score >= min_score);
     
     -- Get matching posts
     SELECT json_agg(
       json_build_object(
         'id', p.id,
         'subreddit', p.subreddit,
         'title', p.title,
         'content', p.content,
         'author', u.username,
         'created_at', p.created_at,
         'score', p.score,
         'rank', ts_rank(p.search_vector, search_ts_query)
       )
     )
     INTO posts_json
     FROM reddit_posts p
     JOIN reddit_users u ON p.author_id = u.id
     WHERE p.search_vector @@ search_ts_query
       AND (filter_subreddit IS NULL OR p.subreddit = filter_subreddit)
       AND (min_score IS NULL OR p.score >= min_score)
     ORDER BY ts_rank(p.search_vector, search_ts_query) DESC
     LIMIT page_size
     OFFSET ((page_number - 1) * page_size);
     
     -- Return results with pagination
     RETURN json_build_object(
       'posts', COALESCE(posts_json, '[]'::JSON),
       'pagination', json_build_object(
         'total_count', total_count,
         'page_size', page_size,
         'page_number', page_number,
         'total_pages', CEIL(total_count::numeric / page_size)
       )
     );
   END;
   $$;
   ```

## Phase 5: Regular Updates

1. **Create a TypeScript update script** (scripts/update-reddit-data.ts)

```typescript
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { OpenAI } from 'openai';

// Initialize clients
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Get Reddit access token
async function getRedditAccessToken(): Promise<string> {
  const clientId = process.env.REDDIT_CLIENT_ID!;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET!;
  const username = process.env.REDDIT_USERNAME!;
  const password = process.env.REDDIT_PASSWORD!;

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await axios.post(
    'https://www.reddit.com/api/v1/access_token',
    `grant_type=password&username=${username}&password=${password}`,
    {
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  return response.data.access_token;
}

// Generate embedding for text
async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    const truncatedText = text.slice(0, 8000);
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: truncatedText,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    return null;
  }
}

// Update posts that are older than X days
async function updateOldPosts(days: number = 7): Promise<void> {
  const token = await getRedditAccessToken();
  
  // Get posts older than X days
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  const { data: oldPosts, error } = await supabase
    .from('reddit_posts')
    .select('id, subreddit, permalink, last_updated')
    .lt('last_updated', cutoffDate.toISOString())
    .limit(10); // Process in batches
  
  if (error) {
    console.error('Error fetching old posts:', error);
    return;
  }
  
  for (const post of oldPosts) {
    try {
      // Get fresh data from Reddit API
      const postUrl = `https://oauth.reddit.com${post.permalink}`;
      const response = await axios.get(postUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      const freshPostData = response.data[0].data.children[0].data;
      const freshCommentsData = response.data[1].data.children;
      
      // Update post data
      const textForEmbedding = `${freshPostData.title} ${freshPostData.selftext || ''}`;
      const embedding = await generateEmbedding(textForEmbedding);
      
      await supabase
        .from('reddit_posts')
        .update({
          score: freshPostData.score,
          upvote_ratio: freshPostData.upvote_ratio,
          embedding: embedding,
          last_updated: new Date().toISOString(),
          original_json: freshPostData
        })
        .eq('id', post.id);
      
      // Update existing comments
      for (const comment of freshCommentsData) {
        if (comment.kind !== 't1') continue;
        
        const commentData = comment.data;
        await updateCommentAndReplies(commentData, post.id);
      }
      
      console.log(`Updated post ${post.id} from ${post.subreddit}`);
    } catch (error) {
      console.error(`Error updating post ${post.id}:`, error);
    }
  }
}

// Recursively update a comment and its replies
async function updateCommentAndReplies(commentData: any, postId: string, parentId: string | null = null): Promise<void> {
  if (!commentData.id || commentData.author === '[deleted]') return;
  
  // Check if comment exists
  const { data: existingComment } = await supabase
    .from('reddit_comments')
    .select('id')
    .eq('id', commentData.id)
    .single();
  
  const embedding = await generateEmbedding(commentData.body || '');
  
  if (existingComment) {
    // Update existing comment
    await supabase
      .from('reddit_comments')
      .update({
        score: commentData.score,
        embedding: embedding,
        original_json: commentData
      })
      .eq('id', commentData.id);
  } else {
    // Create new comment
    // Need to get path from parent if it exists
    let path: string[] = [];
    if (parentId) {
      const { data: parentComment } = await supabase
        .from('reddit_comments')
        .select('path, depth')
        .eq('id', parentId)
        .single();
      
      if (parentComment) {
        path = [...parentComment.path, commentData.id];
      } else {
        path = [commentData.id];
      }
    } else {
      path = [commentData.id];
    }
    
    // Find or create author
    await supabase.from('reddit_users').upsert({
      id: commentData.author,
      username: commentData.author
    }, { onConflict: 'id' });
    
    await supabase.from('reddit_comments').insert({
      id: commentData.id,
      post_id: postId,
      parent_id: parentId,
      author_id: commentData.author,
      content: commentData.body || '',
      created_at: new Date(commentData.created_utc * 1000).toISOString(),
      score: commentData.score,
      depth: parentId ? (path.length - 1) : 0,
      path: path,
      is_stickied: commentData.stickied,
      embedding: embedding,
      original_json: commentData
    });
  }
  
  // Process replies recursively
  if (commentData.replies && commentData.replies.data && commentData.replies.data.children) {
    for (const reply of commentData.replies.data.children) {
      if (reply.kind === 't1') {
        await updateCommentAndReplies(reply.data, postId, commentData.id);
      }
    }
  }
}

// Schedule updates to run regularly
async function scheduleUpdates(): Promise<void> {
  try {
    console.log('Starting scheduled update...');
    await updateOldPosts();
    console.log('Update completed successfully');
  } catch (error) {
    console.error('Error during scheduled update:', error);
  }
}

// Run update process once
updateOldPosts().catch(console.error);

// To run this script on a schedule, you can:
// 1. Use a cron job (e.g., with node-cron)
// 2. Deploy as a serverless function with a schedule trigger
// 3. Use a task scheduler like AWS Scheduler or Google Cloud Scheduler
```

2. **Set up a cron job for regular updates** (using node-cron in a simple server)

```typescript
// scripts/scheduler.ts
import cron from 'node-cron';
import { execSync } from 'child_process';
import * as dotenv from 'dotenv';

dotenv.config();

// Schedule updates to run every day at 3 AM
cron.schedule('0 3 * * *', () => {
  console.log('Running scheduled Reddit data update...');
  try {
    execSync('npx ts-node scripts/update-reddit-data.ts', { stdio: 'inherit' });
    console.log('Update completed successfully');
  } catch (error) {
    console.error('Error during scheduled update:', error);
  }
});

console.log('Update scheduler started');

// Keep the process running
process.stdin.resume();
```

## Phase 6: Frontend Integration

1. **Set up Supabase client**
   ```typescript
   // lib/supabase.ts
   import { createClient } from '@supabase/supabase-js';

   export const supabase = createClient(
     process.env.NEXT_PUBLIC_SUPABASE_URL!,
     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
   );
   ```

2. **Create API for semantic search**
   ```typescript
   // app/api/search/route.ts
   import { NextRequest } from 'next/server';
   import { supabase } from '@/lib/supabase';
   import { OpenAI } from 'openai';

   const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

   export async function POST(request: NextRequest) {
     try {
       // Get search parameters from request
       const { query, similarityThreshold = 0.7, maxResults = 10, 
               subreddit = null, minScore = null, includeNsfw = false } = await request.json();
       
       if (!query) {
         return Response.json({ error: 'Search query is required' }, { status: 400 });
       }
       
       // Generate embedding for the search query
       const embedding = await generateEmbedding(query);
       if (!embedding) {
         return Response.json({ error: 'Failed to generate embedding' }, { status: 500 });
       }
       
       // Search posts
       const { data: posts, error: postsError } = await supabase.rpc('search_posts_by_embedding', {
         query_embedding: embedding,
         similarity_threshold: similarityThreshold,
         max_results: maxResults,
         filter_subreddit: subreddit,
         min_score: minScore,
         include_nsfw: includeNsfw
       });
       
       if (postsError) {
         console.error('Error searching posts:', postsError);
         return Response.json({ error: 'Failed to search posts' }, { status: 500 });
       }
       
       // Search comments
       const { data: comments, error: commentsError } = await supabase.rpc('search_comments_by_embedding', {
         query_embedding: embedding,
         similarity_threshold: similarityThreshold,
         max_results: maxResults,
         post_id: null,
         min_score: minScore
       });
       
       if (commentsError) {
         console.error('Error searching comments:', commentsError);
         return Response.json({ error: 'Failed to search comments' }, { status: 500 });
       }
       
       // Return the search results
       return Response.json({
         posts,
         comments
       });
     } catch (error) {
       console.error('Search API error:', error);
       return Response.json({ error: 'An unexpected error occurred' }, { status: 500 });
     }
   }

   // Helper function to generate embedding
   async function generateEmbedding(text: string): Promise<number[] | null> {
     try {
       // Truncate text to avoid token limits
       const truncatedText = text.slice(0, 8000);
       
       const response = await openai.embeddings.create({
         model: "text-embedding-3-small",
         input: truncatedText,
       });
       
       return response.data[0].embedding;
     } catch (error) {
       console.error('Error generating embedding:', error);
       return null;
     }
   }
   ```

3. **Create API for retrieving post with comments**
   ```typescript
   // app/api/posts/[id]/route.ts
   import { NextRequest } from 'next/server';
   import { supabase } from '@/lib/supabase';

   export async function GET(
     request: NextRequest,
     { params }: { params: { id: string } }
   ) {
     try {
       const postId = params.id;
       
       // Get page number from query params
       const searchParams = request.nextUrl.searchParams;
       const pageSize = parseInt(searchParams.get('pageSize') || '50', 10);
       const pageNumber = parseInt(searchParams.get('page') || '1', 10);
       
       // Fetch post with comments using the Supabase function
       const { data, error } = await supabase.rpc('get_post_with_comments', {
         post_id_param: postId,
         page_size: pageSize,
         page_number: pageNumber
       });
       
       if (error) {
         console.error('Error fetching post:', error);
         return Response.json({ error: 'Failed to fetch post' }, { status: 500 });
       }
       
       return Response.json(data);
     } catch (error) {
       console.error('Post API error:', error);
       return Response.json({ error: 'An unexpected error occurred' }, { status: 500 });
     }
   }
   ```

4. **Create API for subreddit posts**
   ```typescript
   // app/api/subreddits/[subreddit]/posts/route.ts
   import { NextRequest } from 'next/server';
   import { supabase } from '@/lib/supabase';

   export async function GET(
     request: NextRequest,
     { params }: { params: { subreddit: string } }
   ) {
     try {
       const subreddit = params.subreddit;
       
       // Get query parameters
       const searchParams = request.nextUrl.searchParams;
       const pageSize = parseInt(searchParams.get('pageSize') || '25', 10);
       const pageNumber = parseInt(searchParams.get('page') || '1', 10);
       const sortBy = searchParams.get('sortBy') || 'score';
       const sortDirection = searchParams.get('sortDirection') || 'desc';
       const minScore = searchParams.get('minScore') ? 
         parseInt(searchParams.get('minScore')!, 10) : null;
       
       // Fetch posts using the Supabase function
       const { data, error } = await supabase.rpc('get_subreddit_posts', {
         subreddit_param: subreddit,
         page_size: pageSize,
         page_number: pageNumber,
         sort_by: sortBy,
         sort_direction: sortDirection,
         min_score: minScore
       });
       
       if (error) {
         console.error('Error fetching subreddit posts:', error);
         return Response.json({ error: 'Failed to fetch posts' }, { status: 500 });
       }
       
       return Response.json(data);
     } catch (error) {
       console.error('Subreddit posts API error:', error);
       return Response.json({ error: 'An unexpected error occurred' }, { status: 500 });
     }
   }
   ```

5. **Create API for text search**
   ```typescript
   // app/api/text-search/route.ts
   import { NextRequest } from 'next/server';
   import { supabase } from '@/lib/supabase';

   export async function GET(request: NextRequest) {
     try {
       // Get search parameters
       const searchParams = request.nextUrl.searchParams;
       const query = searchParams.get('q');
       const subreddit = searchParams.get('subreddit') || null;
       const minScore = searchParams.get('minScore') ? 
         parseInt(searchParams.get('minScore')!, 10) : null;
       const pageSize = parseInt(searchParams.get('pageSize') || '25', 10);
       const pageNumber = parseInt(searchParams.get('page') || '1', 10);
       
       if (!query) {
         return Response.json({ error: 'Search query is required' }, { status: 400 });
       }
       
       // Format query for ts_query (e.g., convert 'hello world' to 'hello & world')
       const formattedQuery = query
         .replace(/[^\w\s]/g, '') // Remove special characters
         .split(/\s+/)
         .filter(term => term.length > 0)
         .join(' & ');
       
       if (!formattedQuery) {
         return Response.json({ error: 'Invalid search query' }, { status: 400 });
       }
       
       // Perform text search
       const { data, error } = await supabase.rpc('text_search_posts', {
         search_query: formattedQuery,
         filter_subreddit: subreddit,
         min_score: minScore,
         page_size: pageSize,
         page_number: pageNumber
       });
       
       if (error) {
         console.error('Error in text search:', error);
         return Response.json({ error: 'Failed to perform search' }, { status: 500 });
       }
       
       return Response.json(data);
     } catch (error) {
       console.error('Text search API error:', error);
       return Response.json({ error: 'An unexpected error occurred' }, { status: 500 });
     }
   }
   ```

## Implementation Steps

1. **Set up Supabase project**
   - Create a new project in the Supabase dashboard
   - Enable the vector extension using SQL editor

2. **Create database schema**
   - Run the SQL commands to create tables, functions, and indexes

3. **Set up data import**
   - Configure environment variables for Reddit and OpenAI API access
   - Run the import script to fetch data from Reddit and generate embeddings

4. **Test vector search**
   - Verify that embeddings are correctly stored
   - Try different search queries with various thresholds

5. **Create API routes**
   - Implement the endpoints for searching and retrieving data
   - Test endpoints with sample requests

6. **Set up regular updates**
   - Deploy the update script with a scheduler
   - Test that posts and comments are updated correctly

7. **Configure vector performance**
   - Adjust IVFFLAT index parameters based on your dataset size
     ```sql
     -- For small datasets (under 10k records)
     CREATE INDEX idx_reddit_posts_embedding ON reddit_posts USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

     -- For medium datasets (10k-100k records)
     CREATE INDEX idx_reddit_posts_embedding ON reddit_posts USING ivfflat (embedding vector_cosine_ops) WITH (lists = 500);

     -- For large datasets (over 100k records)
     CREATE INDEX idx_reddit_posts_embedding ON reddit_posts USING ivfflat (embedding vector_cosine_ops) WITH (lists = 1000);
     ```
   - Periodically reindex the vector columns as your dataset grows 