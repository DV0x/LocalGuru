-- Helper function to convert JSONB to text
CREATE OR REPLACE FUNCTION jsonb_to_text(data JSONB)
RETURNS TEXT AS $$
DECLARE
  result TEXT := '';
BEGIN
  -- Simple flattening of JSON structure to text
  -- In a real implementation, you'd want a more sophisticated conversion
  IF data IS NULL THEN
    RETURN '';
  END IF;
  
  -- Try to extract array values for entities
  IF jsonb_typeof(data) = 'object' THEN
    FOR key IN SELECT * FROM jsonb_object_keys(data)
    LOOP
      IF jsonb_typeof(data->key) = 'array' THEN
        result := result || ' ' || array_to_string(ARRAY(SELECT jsonb_array_elements_text(data->key)), ' ');
      ELSE
        result := result || ' ' || key || ' ' || data->>key;
      END IF;
    END LOOP;
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to update post search_vector
CREATE OR REPLACE FUNCTION update_post_search_vector(post_id TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE reddit_posts
  SET search_vector = 
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'B') ||
    setweight(to_tsvector('english', 
      coalesce(array_to_string(extracted_topics, ' '), '')), 'A') ||
    setweight(to_tsvector('english', 
      coalesce(array_to_string(semantic_tags, ' '), '')), 'A') ||
    setweight(to_tsvector('english', 
      coalesce(array_to_string(extracted_locations, ' '), '')), 'B') ||
    setweight(to_tsvector('english', 
      coalesce(jsonb_to_text(extracted_entities), '')), 'C')
  WHERE id = post_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update comment search_vector
CREATE OR REPLACE FUNCTION update_comment_search_vector(comment_id TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE reddit_comments
  SET search_vector = 
    setweight(to_tsvector('english', coalesce(content, '')), 'A') ||
    setweight(to_tsvector('english', 
      coalesce(array_to_string(extracted_topics, ' '), '')), 'A') ||
    setweight(to_tsvector('english', 
      coalesce(jsonb_to_text(thread_context), '')), 'B') ||
    setweight(to_tsvector('english', 
      coalesce(jsonb_to_text(extracted_entities), '')), 'C')
  WHERE id = comment_id;
END;
$$ LANGUAGE plpgsql; 