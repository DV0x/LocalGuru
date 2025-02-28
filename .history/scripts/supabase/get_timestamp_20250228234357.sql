-- Creates a simple function to test the Supabase connection
-- Returns the current timestamp from the database

CREATE OR REPLACE FUNCTION get_timestamp()
RETURNS TEXT AS $$
BEGIN
  RETURN now()::text;
END;
$$ LANGUAGE plpgsql; 