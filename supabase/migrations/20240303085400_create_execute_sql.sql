-- Function to execute SQL with parameters
CREATE OR REPLACE FUNCTION public.execute_sql(sql_query text, params jsonb DEFAULT '[]'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  i int;
  dynamic_sql text;
BEGIN
  -- Start with the base SQL query
  dynamic_sql := sql_query;
  
  -- If params is an array, modify the query to use the parameters
  IF jsonb_typeof(params) = 'array' THEN
    -- Loop through parameters and replace placeholders
    FOR i IN 0..jsonb_array_length(params) - 1 LOOP
      -- Replace $1, $2, etc. with the actual values
      dynamic_sql := regexp_replace(
        dynamic_sql, 
        '\$' || (i+1)::text, 
        quote_literal(params->i), 
        'g'
      );
    END LOOP;
  END IF;
  
  -- Execute the dynamically constructed SQL
  EXECUTE dynamic_sql;
END;
$$; 