-- Queue content for reprocessing with 512-dim HNSW embeddings
-- This should be run after applying the 20240403_hnsw_vector_indexes.sql migration

-- First clean up the queue to ensure we have a fresh start
DELETE FROM util.embedding_queue WHERE status <> 'completed';

-- Queue all posts for reprocessing
INSERT INTO util.embedding_queue (record_id, schema_name, table_name, content_function, embedding_column, status, priority, subreddit)
SELECT 
  id, 
  'public', 
  'reddit_posts', 
  'extract_content_for_embedding', 
  'embedding', 
  'pending', 
  5, 
  subreddit
FROM 
  public.reddit_posts;
  
-- Queue all comments for reprocessing
INSERT INTO util.embedding_queue (record_id, schema_name, table_name, content_function, embedding_column, status, priority)
SELECT 
  id, 
  'public', 
  'reddit_comments', 
  'extract_content_for_embedding', 
  'embedding', 
  'pending', 
  3
FROM 
  public.reddit_comments;
  
SELECT 'Content queued for reprocessing. Total items: ' || 
  (SELECT COUNT(*) FROM util.embedding_queue WHERE status = 'pending') 
  AS queue_message; 