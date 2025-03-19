CREATE OR REPLACE FUNCTION public.post_embedding_input(post_record public.reddit_posts)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  -- Concatenate title and content for a more comprehensive embedding
  RETURN post_record.title || ' ' || COALESCE(post_record.content, '');
END;
$$;

-- Drop and recreate the comment function to match the expected parameter name
DROP FUNCTION IF EXISTS public.comment_embedding_input(public.reddit_comments);

CREATE OR REPLACE FUNCTION public.comment_embedding_input(post_record public.reddit_comments)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RETURN post_record.content;
END;
$$; 