-- Drop existing functions
DROP FUNCTION IF EXISTS public.post_embedding_input(public.reddit_posts);
DROP FUNCTION IF EXISTS public.comment_embedding_input(public.reddit_comments);

-- Create new functions that can work with just the record ID
CREATE OR REPLACE FUNCTION public.post_embedding_input(post_record json)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  post_data public.reddit_posts;
BEGIN
  -- Get the full post data using the ID
  SELECT * INTO post_data
  FROM public.reddit_posts
  WHERE id = (post_record->>'id');
  
  -- Concatenate title and content for a more comprehensive embedding
  RETURN post_data.title || ' ' || COALESCE(post_data.content, '');
END;
$$;

CREATE OR REPLACE FUNCTION public.comment_embedding_input(post_record json)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  comment_data public.reddit_comments;
BEGIN
  -- Get the full comment data using the ID
  SELECT * INTO comment_data
  FROM public.reddit_comments
  WHERE id = (post_record->>'id');
  
  RETURN comment_data.content;
END;
$$; 