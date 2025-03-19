-- Migration: Enable extensions
-- Description: Enables required extensions for the project

-- Enable vector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector
WITH SCHEMA extensions;

-- For queueing and processing jobs
DROP EXTENSION IF EXISTS pgmq CASCADE;
CREATE EXTENSION IF NOT EXISTS pgmq
WITH SCHEMA public;

-- For async HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net
WITH SCHEMA extensions;

-- For scheduled processing and retries
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- For clearing embeddings during updates
CREATE EXTENSION IF NOT EXISTS hstore
WITH SCHEMA extensions;

-- For full text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add a comment to document the purpose of these extensions
COMMENT ON EXTENSION vector IS 'Vector data type and vector similarity operators for semantic search';
COMMENT ON EXTENSION pg_trgm IS 'Text similarity measurement and indexing using trigrams'; 