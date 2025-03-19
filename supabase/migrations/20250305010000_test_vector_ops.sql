-- Test vector extension functionality

-- Check if vector extension is available
DO $$
DECLARE
  ext_schema text;
BEGIN
  -- Get the schema where vector is installed
  SELECT n.nspname INTO ext_schema
  FROM pg_extension e
  JOIN pg_namespace n ON e.extnamespace = n.oid
  WHERE e.extname = 'vector';
  
  IF ext_schema IS NULL THEN
    RAISE NOTICE 'Vector extension not found';
  ELSE
    RAISE NOTICE 'Vector extension found in schema: %', ext_schema;
  END IF;
END;
$$;

-- Create a simple test function for vector operations
CREATE OR REPLACE FUNCTION public.test_vector_ops()
RETURNS TABLE (
  test_name text,
  result text
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = 'public, extensions'
AS $$
DECLARE
  v1 vector;
  v2 vector;
  dist float;
BEGIN
  -- Test 1: Vector casting
  BEGIN
    v1 := '[1,2,3]'::vector;
    test_name := 'Vector casting';
    result := 'SUCCESS';
    RETURN NEXT;
  EXCEPTION WHEN OTHERS THEN
    test_name := 'Vector casting';
    result := 'FAILED: ' || SQLERRM;
    RETURN NEXT;
  END;
  
  -- Test 2: Vector cosine distance
  BEGIN
    v1 := '[1,2,3]'::vector;
    v2 := '[4,5,6]'::vector;
    dist := v1 <=> v2;
    test_name := 'Vector cosine distance';
    result := 'SUCCESS: ' || dist::text;
    RETURN NEXT;
  EXCEPTION WHEN OTHERS THEN
    test_name := 'Vector cosine distance';
    result := 'FAILED: ' || SQLERRM;
    RETURN NEXT;
  END;
  
  -- Test 3: Fully qualified vector cosine distance
  BEGIN
    v1 := '[1,2,3]'::vector;
    v2 := '[4,5,6]'::vector;
    -- Try with explicit schema qualification
    EXECUTE 'SELECT vector_cosine_distance(, )' INTO dist USING v1, v2;
    test_name := 'Explicit vector_cosine_distance';
    result := 'SUCCESS: ' || dist::text;
    RETURN NEXT;
  EXCEPTION WHEN OTHERS THEN
    test_name := 'Explicit vector_cosine_distance';
    result := 'FAILED: ' || SQLERRM;
    RETURN NEXT;
  END;
END;
$$;
