-- Fix search path in vector update functions to include public schema where vector type is defined
CREATE OR REPLACE FUNCTION public.update_post_vector(
  post_id text,
  vector_data float[]
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public  -- Include public schema to access vector type
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

-- Fix search path in comment vector update function
CREATE OR REPLACE FUNCTION public.update_comment_vector(
  comment_id text,
  vector_data float[]
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public  -- Include public schema to access vector type
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