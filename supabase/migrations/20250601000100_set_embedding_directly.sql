-- Function to set embedding directly in a table
-- Used for backward compatibility with the existing embedding column

CREATE OR REPLACE FUNCTION set_embedding_directly(
  p_table TEXT,
  p_id TEXT,
  p_column TEXT,
  p_embedding VECTOR(1536)
) RETURNS VOID AS $$
DECLARE
  query TEXT;
BEGIN
  -- Only run update if embedding is not null
  IF p_embedding IS NOT NULL THEN
    query := format(
      'UPDATE %I SET %I = $1 WHERE id = $2',
      p_table,
      p_column
    );
    
    EXECUTE query USING p_embedding, p_id;
  END IF;
END;
$$ LANGUAGE plpgsql; 