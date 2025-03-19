-- Create a function to get queue statistics for monitoring
CREATE OR REPLACE FUNCTION public.get_embedding_queue_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result json;
BEGIN
  -- Calculate various queue metrics
  WITH 
    queue_stats AS (
      SELECT
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) AS processing_count,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_count,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_count,
        AVG(CASE 
          WHEN status = 'completed' AND processed_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (processed_at - started_at)) * 1000
          ELSE NULL 
        END) AS avg_processing_time_ms,
        MAX(CASE 
          WHEN status = 'pending' 
          THEN EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600
          ELSE 0 
        END) AS oldest_pending_job_age_hours
      FROM util.embedding_queue
    ),
    -- Get subreddit distribution for pending jobs
    subreddit_counts AS (
      SELECT
        subreddit,
        COUNT(*) AS job_count
      FROM util.embedding_queue
      WHERE status = 'pending' AND subreddit IS NOT NULL
      GROUP BY subreddit
      ORDER BY COUNT(*) DESC
      LIMIT 20
    )
  SELECT 
    json_build_object(
      'pending_count', COALESCE((SELECT pending_count FROM queue_stats), 0),
      'processing_count', COALESCE((SELECT processing_count FROM queue_stats), 0),
      'completed_count', COALESCE((SELECT completed_count FROM queue_stats), 0),
      'failed_count', COALESCE((SELECT failed_count FROM queue_stats), 0),
      'avg_processing_time_ms', COALESCE((SELECT avg_processing_time_ms FROM queue_stats), 0),
      'oldest_pending_job_age_hours', COALESCE((SELECT oldest_pending_job_age_hours FROM queue_stats), 0),
      'subreddit_counts', (
        SELECT json_agg(json_build_object('subreddit', subreddit, 'count', job_count))
        FROM subreddit_counts
      )
    ) INTO result;
    
  RETURN result;
END;
$$;

-- View for embedding metrics summary
CREATE OR REPLACE VIEW public.embedding_metrics_summary AS 
WITH 
  hourly_metrics AS (
    SELECT
      date_trunc('hour', timestamp) AS hour,
      job_type,
      COUNT(*) AS job_count,
      SUM(CASE WHEN is_successful THEN 1 ELSE 0 END) AS success_count,
      AVG(chunk_count) AS avg_chunks,
      AVG(processing_time_ms) AS avg_processing_time
    FROM public.embedding_metrics
    WHERE timestamp > NOW() - interval '24 hours'
    GROUP BY date_trunc('hour', timestamp), job_type
  ),
  subreddit_metrics AS (
    SELECT
      subreddit,
      COUNT(*) AS job_count,
      SUM(CASE WHEN is_successful THEN 1 ELSE 0 END) AS success_count,
      AVG(chunk_count) AS avg_chunks,
      AVG(processing_time_ms) AS avg_processing_time
    FROM public.embedding_metrics
    WHERE timestamp > NOW() - interval '24 hours' AND subreddit IS NOT NULL
    GROUP BY subreddit
  )
SELECT
  'hourly_summary' AS metric_type,
  json_agg(
    json_build_object(
      'hour', hour,
      'job_type', job_type,
      'job_count', job_count,
      'success_count', success_count,
      'avg_chunks', avg_chunks,
      'avg_processing_time', avg_processing_time
    )
  ) AS data
FROM hourly_metrics

UNION ALL

SELECT
  'subreddit_summary' AS metric_type,
  json_agg(
    json_build_object(
      'subreddit', subreddit,
      'job_count', job_count,
      'success_count', success_count,
      'success_rate', (success_count::float / job_count::float) * 100,
      'avg_chunks', avg_chunks,
      'avg_processing_time', avg_processing_time
    )
  ) AS data
FROM subreddit_metrics;

-- Grant appropriate permissions on the view
GRANT SELECT ON public.embedding_metrics_summary TO authenticated;