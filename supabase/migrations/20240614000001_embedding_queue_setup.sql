-- Create schema if not exists
CREATE SCHEMA IF NOT EXISTS util;

-- Create embedding_queue table
CREATE TABLE IF NOT EXISTS util.embedding_queue (
    id SERIAL PRIMARY KEY,
    record_id TEXT NOT NULL,
    schema_name TEXT NOT NULL,
    table_name TEXT NOT NULL,
    content_function TEXT NOT NULL,
    embedding_column TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    processed_at TIMESTAMPTZ,
    priority SMALLINT DEFAULT 5, -- 1-10, higher is more important
    subreddit TEXT,
    estimated_tokens INTEGER
);

-- Create index for faster queue processing
CREATE INDEX IF NOT EXISTS embedding_queue_status_priority_idx 
ON util.embedding_queue(status, priority DESC, created_at);

-- Create index for finding items by record
CREATE INDEX IF NOT EXISTS embedding_queue_record_idx 
ON util.embedding_queue(record_id, schema_name, table_name);

-- Refresh content_representations function already exists, as confirmed by our test
-- It just needs the embedding_queue table to work properly

-- Grant permissions
GRANT USAGE ON SCHEMA util TO service_role;
GRANT ALL ON util.embedding_queue TO service_role;
GRANT USAGE ON SEQUENCE util.embedding_queue_id_seq TO service_role; 