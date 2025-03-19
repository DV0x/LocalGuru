// Reprocess content to generate enhanced representations
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

interface ReprocessRequest {
  contentType: 'post' | 'comment' | 'all';
  limit?: number;
  subreddit?: string;
  priority?: number;
}

serve(async (req: Request) => {
  try {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      });
    }
    
    // Parse request
    const { contentType = 'all', limit = 100, subreddit, priority = 5 } = await req.json() as ReprocessRequest;
    
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    
    // Queue items for reprocessing
    let queued = 0;
    
    // Process posts if requested
    if (contentType === 'all' || contentType === 'post') {
      // Get posts that don't have multi-representation yet
      const { data: posts, error: postsError } = await supabaseClient
        .from('reddit_posts')
        .select('id')
        .not(
          'id', 
          'in', 
          supabaseClient
            .from('content_representations')
            .select('parent_id')
            .eq('content_type', 'post')
            .eq('representation_type', 'context_enhanced')
        )
        .limit(limit);
      
      if (postsError) {
        throw new Error(`Error fetching posts: ${postsError.message}`);
      }
      
      // Queue posts for reprocessing
      if (posts && posts.length > 0) {
        // Insert into embedding queue
        const { data: insertData, error: insertError } = await supabaseClient
          .from('embedding_queue')
          .insert(
            posts.map(post => ({
              content_id: post.id,
              content_type: 'post',
              status: 'pending',
              priority: priority,
              schema_name: 'public',
              table_name: 'reddit_posts',
              content_function: 'get_post_content',
              embedding_column: 'embedding'
            }))
          )
          .select();
        
        if (insertError) {
          throw new Error(`Error queuing posts: ${insertError.message}`);
        }
        
        queued += posts.length;
      }
    }
    
    // Process comments if requested
    if (contentType === 'all' || contentType === 'comment') {
      // Get comments that don't have multi-representation yet
      const { data: comments, error: commentsError } = await supabaseClient
        .from('reddit_comments')
        .select('id')
        .not(
          'id', 
          'in', 
          supabaseClient
            .from('content_representations')
            .select('parent_id')
            .eq('content_type', 'comment')
            .eq('representation_type', 'context_enhanced')
        )
        .limit(limit);
      
      if (commentsError) {
        throw new Error(`Error fetching comments: ${commentsError.message}`);
      }
      
      // Queue comments for reprocessing
      if (comments && comments.length > 0) {
        // Insert into embedding queue
        const { data: insertData, error: insertError } = await supabaseClient
          .from('embedding_queue')
          .insert(
            comments.map(comment => ({
              content_id: comment.id,
              content_type: 'comment',
              status: 'pending',
              priority: priority - 1, // Lower priority than posts
              schema_name: 'public',
              table_name: 'reddit_comments',
              content_function: 'get_comment_content',
              embedding_column: 'embedding'
            }))
          )
          .select();
        
        if (insertError) {
          throw new Error(`Error queuing comments: ${insertError.message}`);
        }
        
        queued += comments.length;
      }
    }
    
    // Return success
    return new Response(
      JSON.stringify({
        success: true,
        queued,
        message: `Queued ${queued} items for reprocessing with the enhanced embedding system`
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error in reprocess-content:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}); 