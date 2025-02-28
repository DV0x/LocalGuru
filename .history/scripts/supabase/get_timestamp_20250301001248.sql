-- Creates a simple function to test the Supabase connection
-- Returns the current timestamp from the database

CREATE OR REPLACE FUNCTION public.get_timestamp()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN now()::text;
END;
$$;

-- Grant execution permission to the anonymous role
GRANT EXECUTE ON FUNCTION public.get_timestamp() TO anon; 