import { supabaseAdmin } from '../supabase/client';
import { generateEmbedding } from '../openai/client';
import { RedditPost } from '../types';

/**
 * Perform a semantic search for travel-related content
 * @param query The user's query
 * @param limit Maximum number of results to return
 * @returns Array of relevant Reddit posts
 */
export async function semanticSearch(query: string, limit: number = 5): Promise<RedditPost[]> {
  try {
    // Generate embedding for the query
    const embedding = await generateEmbedding(query);
    
    // Perform vector similarity search in Supabase
    const { data: posts, error } = await supabaseAdmin.rpc('match_reddit_posts', {
      query_embedding: embedding,
      match_threshold: 0.5,
      match_count: limit
    });
    
    if (error) {
      console.error('Error performing semantic search:', error);
      throw new Error('Failed to perform semantic search');
    }
    
    return posts as RedditPost[];
  } catch (error) {
    console.error('Error in semantic search:', error);
    throw new Error('Failed to perform semantic search');
  }
}

/**
 * Store a Reddit post with its embedding in the database
 * @param post The Reddit post to store
 */
export async function storePostWithEmbedding(post: RedditPost): Promise<void> {
  try {
    // Generate embedding for the post content
    const content = `${post.title} ${post.selftext}`;
    const embedding = await generateEmbedding(content);
    
    // Store the post and its embedding in Supabase
    const { error } = await supabaseAdmin
      .from('reddit_posts')
      .upsert({
        id: post.id,
        title: post.title,
        content: post.selftext,
        url: post.url,
        permalink: post.permalink,
        author: post.author,
        created_at: new Date(post.created_utc * 1000).toISOString(),
        subreddit: post.subreddit,
        score: post.score,
        num_comments: post.num_comments,
        embedding
      });
    
    if (error) {
      console.error('Error storing post with embedding:', error);
      throw new Error('Failed to store post with embedding');
    }
  } catch (error) {
    console.error('Error in storePostWithEmbedding:', error);
    throw new Error('Failed to store post with embedding');
  }
}

/**
 * Log a user query for analytics
 * @param query The user's query
 * @param results Number of results returned
 */
export async function logQuery(query: string, results: number): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from('query_logs')
      .insert({
        query,
        results_count: results,
        timestamp: new Date().toISOString()
      });
    
    if (error) {
      console.error('Error logging query:', error);
      // Don't throw here, just log the error
    }
  } catch (error) {
    console.error('Error in logQuery:', error);
    // Don't throw here, just log the error
  }
} 