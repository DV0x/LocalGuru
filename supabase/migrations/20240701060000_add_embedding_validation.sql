-- Migration to add embedding validation functions
-- This helps diagnose and fix dimension issues with embeddings

-- Function to check vector dimensions
CREATE OR REPLACE FUNCTION public.get_vector_dimensions(v vector)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT array_length(v::float8[], 1);
$$;

-- Function to truncate vector to specific dimensions 
CREATE OR REPLACE FUNCTION public.truncate_vector(v vector, dims integer)
RETURNS vector
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (
    CASE 
      WHEN array_length(v::float8[], 1) <= dims THEN v
      ELSE (SELECT (array_agg(val ORDER BY idx))[1:dims]::vector(dims)
            FROM (
              SELECT idx, val
              FROM unnest(v::float8[]) WITH ORDINALITY AS t(val, idx)
              WHERE idx <= dims
            ) s)
    END
  );
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.get_vector_dimensions TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_vector_dimensions TO service_role;
GRANT EXECUTE ON FUNCTION public.truncate_vector TO authenticated;
GRANT EXECUTE ON FUNCTION public.truncate_vector TO service_role;

COMMENT ON FUNCTION public.get_vector_dimensions IS 'Returns the number of dimensions in a vector';
COMMENT ON FUNCTION public.truncate_vector IS 'Truncates a vector to the specified number of dimensions'; 