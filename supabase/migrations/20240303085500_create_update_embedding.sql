-- Function to update an embedding in a table
CREATE OR REPLACE FUNCTION public.update_embedding(
  p_schema_name text,
  p_table_name text,
  p_record_id text,
  p_embedding_column text,
  p_embedding float[]
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  success boolean := false;
  sql_statement text;
BEGIN
  -- Construct the SQL statement
  sql_statement := format(
    'UPDATE %I.%I SET %I = $1::vector WHERE id = $2',
    p_schema_name,
    p_table_name,
    p_embedding_column
  );
  
  -- Execute the update
  BEGIN
    EXECUTE sql_statement USING p_embedding, p_record_id;
    
    -- Check if the update was successful
    IF FOUND THEN
      success := true;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error updating embedding: %', SQLERRM;
    success := false;
  END;
  
  RETURN success;
END;
$$; 