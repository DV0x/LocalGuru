-- Wrapper for comment content embedding
CREATE OR REPLACE FUNCTION public.get_comment_content_for_embedding(post_record jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  content_json json;
  content_id text;
  embedding_result jsonb;
BEGIN
  -- Convert input parameter to proper type if needed
  content_json := post_record::json;
  
  -- Get comment ID from the record
  content_id := (post_record->>'id')::text;
  
  -- First get the content using the existing function
  content_json := public.get_comment_content(content_json);
  
  -- Return the content with structure expected by the caller
  embedding_result := jsonb_build_object(
    'content', content_json,
    'id', content_id,
    'type', 'comment'
  );
  
  RETURN embedding_result;
END;
$$;

-- Wrapper for post content embedding
CREATE OR REPLACE FUNCTION public.get_post_content_for_embedding(post_record jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  content_json json;
  content_id text;
  embedding_result jsonb;
BEGIN
  -- Convert input parameter to proper type if needed
  content_json := post_record::json;
  
  -- Get post ID from the record
  content_id := (post_record->>'id')::text;
  
  -- First get the content using the existing function
  content_json := public.get_post_content(content_json);
  
  -- Return the content with structure expected by the caller
  embedding_result := jsonb_build_object(
    'content', content_json,
    'id', content_id,
    'type', 'post'
  );
  
  RETURN embedding_result;
END;
$$;
