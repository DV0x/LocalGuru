-- Function to create a vector from a float array and update a post
CREATE OR REPLACE FUNCTION public.update_post_vector(
  post_id text,
  vector_data float[]
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER  -- Use definer for higher permissions
SET search_path = ''
AS $$
DECLARE
  vector_text text;
  query text;
  updated_rows int;
BEGIN
  -- Convert the float array to a bracketed string format that pgvector can parse
  -- e.g. [0.1, 0.2, 0.3]
  vector_text := '[' || array_to_string(vector_data, ',') || ']';
  
  -- Use dynamic SQL with direct casting to the vector type
  query := 'UPDATE public.reddit_posts SET embedding = $1::vector WHERE id = $2';
  
  EXECUTE query USING vector_text, post_id;
  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  
  RETURN updated_rows > 0;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error updating post vector: % (%)', SQLERRM, SQLSTATE;
  RETURN false;
END;
$$;

-- Function to create a vector from a float array and update a comment
CREATE OR REPLACE FUNCTION public.update_comment_vector(
  comment_id text,
  vector_data float[]
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER  -- Use definer for higher permissions
SET search_path = ''
AS $$
DECLARE
  vector_text text;
  query text;
  updated_rows int;
BEGIN
  -- Convert the float array to a bracketed string format that pgvector can parse
  -- e.g. [0.1, 0.2, 0.3]
  vector_text := '[' || array_to_string(vector_data, ',') || ']';
  
  -- Use dynamic SQL with direct casting to the vector type
  query := 'UPDATE public.reddit_comments SET embedding = $1::vector WHERE id = $2';
  
  EXECUTE query USING vector_text, comment_id;
  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  
  RETURN updated_rows > 0;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error updating comment vector: % (%)', SQLERRM, SQLSTATE;
  RETURN false;
END;
$$; 