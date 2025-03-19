-- Migration: Create Reddit import functions
-- Description: Creates functions to insert Reddit data without triggering embedding generation

-- Function to insert a Reddit post without triggering embedding generation
CREATE OR REPLACE FUNCTION public.insert_reddit_post_without_trigger(
  post_id TEXT,
  post_subreddit TEXT,
  post_title TEXT,
  post_content TEXT,
  post_url TEXT,
  post_permalink TEXT,
  post_author_id TEXT,
  post_created_at TIMESTAMPTZ,
  post_score INTEGER,
  post_upvote_ratio DECIMAL(5,4),
  post_is_nsfw BOOLEAN,
  post_is_spoiler BOOLEAN,
  post_flair TEXT,
  post_is_self_post BOOLEAN,
  post_original_json JSONB
) RETURNS VOID AS $$
BEGIN
  -- Temporarily disable triggers
  ALTER TABLE reddit_posts DISABLE TRIGGER ALL;
  
  -- Insert the post
  INSERT INTO reddit_posts (
    id, 
    subreddit, 
    title, 
    content, 
    url, 
    permalink, 
    author_id, 
    created_at, 
    score, 
    upvote_ratio, 
    is_nsfw, 
    is_spoiler, 
    flair, 
    is_self_post,
    original_json
  ) VALUES (
    post_id,
    post_subreddit,
    post_title,
    post_content,
    post_url,
    post_permalink,
    post_author_id,
    post_created_at,
    post_score,
    post_upvote_ratio,
    post_is_nsfw,
    post_is_spoiler,
    post_flair,
    post_is_self_post,
    post_original_json
  )
  ON CONFLICT (id) DO UPDATE SET
    subreddit = EXCLUDED.subreddit,
    title = EXCLUDED.title,
    content = EXCLUDED.content,
    url = EXCLUDED.url,
    permalink = EXCLUDED.permalink,
    author_id = EXCLUDED.author_id,
    created_at = EXCLUDED.created_at,
    score = EXCLUDED.score,
    upvote_ratio = EXCLUDED.upvote_ratio,
    is_nsfw = EXCLUDED.is_nsfw,
    is_spoiler = EXCLUDED.is_spoiler,
    flair = EXCLUDED.flair,
    is_self_post = EXCLUDED.is_self_post,
    original_json = EXCLUDED.original_json;
    
  -- Re-enable triggers
  ALTER TABLE reddit_posts ENABLE TRIGGER ALL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to insert a Reddit comment without triggering embedding generation
CREATE OR REPLACE FUNCTION public.insert_reddit_comment_without_trigger(
  comment_id TEXT,
  comment_post_id TEXT,
  comment_parent_id TEXT,
  comment_author_id TEXT,
  comment_content TEXT,
  comment_created_at TIMESTAMPTZ,
  comment_score INTEGER,
  comment_depth INTEGER,
  comment_path TEXT[],
  comment_is_stickied BOOLEAN,
  comment_original_json JSONB
) RETURNS VOID AS $$
BEGIN
  -- Temporarily disable triggers
  ALTER TABLE reddit_comments DISABLE TRIGGER ALL;
  
  -- Insert the comment
  INSERT INTO reddit_comments (
    id,
    post_id,
    parent_id,
    author_id,
    content,
    created_at,
    score,
    depth,
    path,
    is_stickied,
    original_json
  ) VALUES (
    comment_id,
    comment_post_id,
    comment_parent_id,
    comment_author_id,
    comment_content,
    comment_created_at,
    comment_score,
    comment_depth,
    comment_path,
    comment_is_stickied,
    comment_original_json
  )
  ON CONFLICT (id) DO UPDATE SET
    post_id = EXCLUDED.post_id,
    parent_id = EXCLUDED.parent_id,
    author_id = EXCLUDED.author_id,
    content = EXCLUDED.content,
    created_at = EXCLUDED.created_at,
    score = EXCLUDED.score,
    depth = EXCLUDED.depth,
    path = EXCLUDED.path,
    is_stickied = EXCLUDED.is_stickied,
    original_json = EXCLUDED.original_json;
    
  -- Re-enable triggers
  ALTER TABLE reddit_comments ENABLE TRIGGER ALL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add appropriate grants
GRANT EXECUTE ON FUNCTION public.insert_reddit_post_without_trigger TO service_role;
GRANT EXECUTE ON FUNCTION public.insert_reddit_comment_without_trigger TO service_role; 