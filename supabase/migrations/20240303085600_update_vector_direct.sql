-- Direct function to update reddit_posts embeddings
CREATE OR REPLACE FUNCTION public.update_post_embedding(
  post_id text,
  embedding_data float[]
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  success boolean := false;
BEGIN
  -- Direct update with no dynamic SQL to simplify
  UPDATE public.reddit_posts 
  SET embedding = embedding_data::vector
  WHERE id = post_id;
  
  GET DIAGNOSTICS success = ROW_COUNT;
  
  RETURN success > 0;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error updating post embedding: %', SQLERRM;
  RETURN false;
END;
$$;

-- Direct function to update reddit_comments embeddings
CREATE OR REPLACE FUNCTION public.update_comment_embedding(
  comment_id text,
  embedding_data float[]
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  success boolean := false;
BEGIN
  -- Direct update with no dynamic SQL to simplify
  UPDATE public.reddit_comments 
  SET embedding = embedding_data::vector
  WHERE id = comment_id;
  
  GET DIAGNOSTICS success = ROW_COUNT;
  
  RETURN success > 0;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error updating comment embedding: %', SQLERRM;
  RETURN false;
END;
$$; 