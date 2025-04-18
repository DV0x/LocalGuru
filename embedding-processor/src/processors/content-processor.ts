import { supabase } from '../services/supabase';
import { createEmbedding, storeContentRepresentation } from '../services/embedding-service';
import { extractEntities } from '../services/entity-extraction';
import { buildThreadContext, getThreadSummary, createThreadEnhancedInput } from '../services/thread-context';
import { ThreadContext, ParentComment, Comment, Post } from '../services/types';

/**
 * Process a single content item (post or comment)
 */
export async function processContentItem(
  contentId: string,
  contentType: 'post' | 'comment'
): Promise<void> {
  console.log(`Processing ${contentType} ${contentId}...`);
  
  let content: any;
  let threadContext: ThreadContext = {
    postId: '',
    postTitle: '',
    subreddit: ''
  };
  let contentText = '';
  
  // Get content data
  if (contentType === 'post') {
    // Fetch post data
    const { data: post, error } = await supabase
      .from('reddit_posts')
      .select('id, title, content, subreddit')
      .eq('id', contentId)
      .single();
    
    if (error || !post) {
      throw new Error(`Post not found: ${error?.message}`);
    }
    
    content = post;
    contentText = `${post.title}\n\n${post.content || ''}`;
    
    // For posts, build a simpler context
    threadContext = {
      postId: post.id,
      postTitle: post.title,
      postContent: post.content, // Include post content in context
      subreddit: post.subreddit
    };
    
  } else if (contentType === 'comment') {
    // Fetch comment with post data including post content
    const { data, error } = await supabase
      .from('reddit_comments')
      .select(`id, content, post_id, parent_id, path, 
              post:post_id (id, title, content, subreddit)`) // Include post content
      .eq('id', contentId)
      .single();
    
    if (error || !data) {
      throw new Error(`Comment not found: ${error?.message}`);
    }
    
    // Use any to handle the Supabase-specific nested object structure
    const comment = data as any;
    content = comment;
    contentText = comment.content || '';
    
    // Get parent comments if available
    if (comment.path && comment.path.length > 0) {
      const { data: parents } = await supabase
        .from('reddit_comments')
        .select('id, content')
        .in('id', comment.path)
        .order('id');
      
      if (parents) {
        // Build thread context with post content
        threadContext = buildThreadContext(
          comment.id,
          {
            id: comment.post_id,
            title: comment.post.title || '',
            content: comment.post.content || '', // Include post content
            subreddit: comment.post.subreddit || ''
          },
          parents as ParentComment[]
        );
        
        // Generate thread summary
        threadContext.summary = await getThreadSummary(threadContext);
      } else {
        threadContext = {
          postId: comment.post_id,
          postTitle: comment.post.title || '',
          postContent: comment.post.content || '', // Include post content
          subreddit: comment.post.subreddit || '',
          path: comment.path
        };
      }
    } else {
      threadContext = {
        postId: comment.post_id,
        postTitle: comment.post.title || '',
        postContent: comment.post.content || '', // Include post content
        subreddit: comment.post.subreddit || ''
      };
    }
  } else {
    throw new Error(`Invalid content type: ${contentType}`);
  }
  
  // Extract entities with GPT-4 Turbo
  console.log(`Extracting entities for ${contentType} ${contentId}...`);
  const extractedEntities = await extractEntities(
    contentText, 
    contentType, 
    contentType === 'post' 
      ? { subreddit: threadContext.subreddit, title: threadContext.postTitle } 
      : { subreddit: threadContext.subreddit, postTitle: threadContext.postTitle }
  );
  
  // Common metadata for all embeddings
  const entityMetadata = {
    topics: extractedEntities.topics,
    entities: extractedEntities.entities,
    locations: extractedEntities.locations,
    semanticTags: extractedEntities.semanticTags
  };
  
  // Generate and store embeddings
  console.log(`Generating embeddings for ${contentType} ${contentId}...`);
  
  // 1. For posts, create title embedding
  if (contentType === 'post' && content.title) {
    console.log(`Generating title embedding for post ${contentId}...`);
    const titleEmbedding = await createEmbedding(content.title);
    await storeContentRepresentation(
      contentId,
      contentType,
      'title',
      titleEmbedding,
      {
        type: 'title',
        length: content.title.length,
        tokenEstimate: Math.ceil(content.title.length / 4),
        ...entityMetadata
      }
    );
  }
  
  // 2. Create context-enhanced embedding
  console.log(`Generating context-enhanced embedding for ${contentType} ${contentId}...`);
  let enhancedContent = '';
  
  if (contentType === 'post') {
    enhancedContent = `Subreddit: r/${threadContext.subreddit || 'unknown'}
Title: ${content.title || ''}
Topics: ${extractedEntities.topics.join(', ')}
${extractedEntities.locations.length > 0 ? `Locations: ${extractedEntities.locations.join(', ')}` : ''}
${extractedEntities.semanticTags.length > 0 ? `Tags: ${extractedEntities.semanticTags.join(', ')}` : ''}
Content: ${content.content || ''}`;
  } else {
    enhancedContent = createThreadEnhancedInput(
      content.content || '',
      threadContext,
      {
        topics: extractedEntities.topics,
        locations: extractedEntities.locations,
        semanticTags: extractedEntities.semanticTags
      }
    );
  }
  
  const contextEmbedding = await createEmbedding(enhancedContent);
  await storeContentRepresentation(
    contentId,
    contentType,
    'context_enhanced',
    contextEmbedding,
    {
      type: 'context_enhanced',
      length: enhancedContent.length,
      tokenEstimate: Math.ceil(enhancedContent.length / 4),
      thread_context: threadContext,
      ...entityMetadata
    }
  );
  
  // 3. Update original content table with metadata
  console.log(`Updating metadata for ${contentType} ${contentId}...`);
  
  if (contentType === 'post') {
    // First update the metadata fields
    await supabase
      .from('reddit_posts')
      .update({
        extracted_entities: extractedEntities.entities,
        extracted_topics: extractedEntities.topics,
        extracted_locations: extractedEntities.locations,
        semantic_tags: extractedEntities.semanticTags
      })
      .eq('id', contentId);
      
    // Then update the search_vector column using SQL
    console.log(`Updating search vector for post ${contentId}...`);
    try {
      await supabase.rpc('update_post_search_vector', { post_id: contentId });
    } catch (error) {
      console.warn(`Warning: Could not update search vector for post ${contentId}:`, error);
      // Continue processing even if search vector update fails
    }
  } else {
    // First update the metadata fields
    const threadContextJSON = {
      postTitle: threadContext.postTitle,
      postContent: threadContext.postContent ? 
        (threadContext.postContent.length > 1000 ? 
          threadContext.postContent.substring(0, 1000) + '...' : 
          threadContext.postContent) : 
        undefined,
      subreddit: threadContext.subreddit,
      parentId: threadContext.parentId,
      path: threadContext.path,
      depth: threadContext.depth,
      summary: threadContext.summary
    };
    
    await supabase
      .from('reddit_comments')
      .update({
        extracted_entities: extractedEntities.entities,
        extracted_topics: extractedEntities.topics,
        thread_context: threadContextJSON,
      })
      .eq('id', contentId);
      
    // Then update the search_vector column using SQL
    console.log(`Updating search vector for comment ${contentId}...`);
    try {
      await supabase.rpc('update_comment_search_vector', { comment_id: contentId });
    } catch (error) {
      console.warn(`Warning: Could not update search vector for comment ${contentId}:`, error);
      // Continue processing even if search vector update fails
    }
  }
  
  console.log(`Successfully processed ${contentType} ${contentId}`);
} 