-- Migration: Grant util schema permissions
-- Description: Grants necessary permissions for the service role to access the util schema and embedding queue

-- Grant usage permission on the util schema
GRANT USAGE ON SCHEMA util TO service_role;
GRANT USAGE ON SCHEMA util TO authenticated;
GRANT USAGE ON SCHEMA util TO anon;

-- Grant access to the embedding_queue table
GRANT SELECT, INSERT, UPDATE ON util.embedding_queue TO service_role;

-- Grant access to sequence if it exists
GRANT USAGE, SELECT ON SEQUENCE util.embedding_queue_id_seq TO service_role;

-- Comment explaining the migration
COMMENT ON SCHEMA util IS 'Utility schema for system functions and embedding operations'; 