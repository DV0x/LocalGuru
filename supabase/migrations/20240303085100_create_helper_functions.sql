-- Create helper functions for the embedding queue

-- Function to get pending embedding jobs
CREATE OR REPLACE FUNCTION public.get_pending_embedding_jobs(limit_count int DEFAULT 10)
RETURNS SETOF util.embedding_queue
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT *
  FROM util.embedding_queue
  WHERE status = 'pending'
  ORDER BY created_at ASC
  LIMIT limit_count;
$$;

-- Function to mark a job as processing
CREATE OR REPLACE FUNCTION public.mark_job_processing(job_id int)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE util.embedding_queue
  SET 
    status = 'processing',
    attempts = attempts + 1
  WHERE id = job_id;
$$;

-- Function to mark a job as completed
CREATE OR REPLACE FUNCTION public.mark_job_completed(job_id int)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE util.embedding_queue
  SET 
    status = 'completed',
    processed_at = now()
  WHERE id = job_id;
$$;

-- Function to mark a job as failed
CREATE OR REPLACE FUNCTION public.mark_job_failed(job_id int, error_message text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE util.embedding_queue
  SET 
    status = 'failed',
    last_error = error_message,
    processed_at = now()
  WHERE id = job_id;
$$; 