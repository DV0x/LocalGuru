-- Enable extensions for vector operations and text search
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add a comment to document the purpose of these extensions
COMMENT ON EXTENSION vector IS 'Vector data type and vector similarity operators for semantic search';
COMMENT ON EXTENSION pg_trgm IS 'Text similarity measurement and indexing using trigrams'; 