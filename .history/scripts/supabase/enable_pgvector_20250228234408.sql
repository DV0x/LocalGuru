-- Script to enable the pgvector extension in Supabase
-- This must be executed by a superuser or someone with the appropriate permissions

-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create a function to check if pgvector is enabled
CREATE OR REPLACE FUNCTION is_pgvector_enabled()
RETURNS BOOLEAN AS $$
DECLARE
  extension_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM pg_extension WHERE extname = 'vector'
  ) INTO extension_exists;
  
  RETURN extension_exists;
END;
$$ LANGUAGE plpgsql; 