-- Create a database function to calculate search statistics
CREATE OR REPLACE FUNCTION get_search_statistics(hours_ago integer)
RETURNS TABLE (
  total_count bigint,
  avg_duration double precision,
  max_duration double precision,
  min_duration double precision,
  timeout_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) as total_count,
    AVG(duration_ms) as avg_duration,
    MAX(duration_ms) as max_duration,
    MIN(duration_ms) as min_duration,
    COUNT(CASE WHEN timed_out THEN 1 END) as timeout_count
  FROM
    search_performance_logs
  WHERE
    created_at >= NOW() - (hours_ago * INTERVAL '1 hour');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to get statistics by day
CREATE OR REPLACE FUNCTION get_search_statistics_by_day(days_to_include integer)
RETURNS TABLE (
  day date,
  count bigint,
  avg_duration double precision,
  error_count bigint,
  timeout_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE_TRUNC('day', created_at)::date as day,
    COUNT(*) as count,
    AVG(duration_ms) as avg_duration,
    COUNT(CASE WHEN error_message IS NOT NULL THEN 1 END) as error_count,
    COUNT(CASE WHEN timed_out THEN 1 END) as timeout_count
  FROM
    search_performance_logs
  WHERE
    created_at >= NOW() - (days_to_include * INTERVAL '1 day')
  GROUP BY
    DATE_TRUNC('day', created_at)
  ORDER BY
    day DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add an error_message column to search_performance_logs if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'search_performance_logs'
    AND column_name = 'error_message'
  ) THEN
    ALTER TABLE search_performance_logs ADD COLUMN error_message text;
  END IF;
END $$;

-- Add a source column to search_performance_logs if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'search_performance_logs'
    AND column_name = 'source'
  ) THEN
    ALTER TABLE search_performance_logs ADD COLUMN source text;
  END IF;
END $$;

-- Create an index on the created_at column for better performance
CREATE INDEX IF NOT EXISTS idx_search_performance_logs_created_at
ON search_performance_logs (created_at);

-- Create an index on the source column
CREATE INDEX IF NOT EXISTS idx_search_performance_logs_source
ON search_performance_logs (source);

-- Create an index for error_message IS NOT NULL queries
CREATE INDEX IF NOT EXISTS idx_search_performance_logs_error_message_not_null
ON search_performance_logs (error_message)
WHERE error_message IS NOT NULL;

-- Grant required permissions
GRANT EXECUTE ON FUNCTION get_search_statistics(integer) TO service_role;
GRANT EXECUTE ON FUNCTION get_search_statistics(integer) TO anon;
GRANT EXECUTE ON FUNCTION get_search_statistics(integer) TO authenticated;

-- Grant permissions for the day statistics function
GRANT EXECUTE ON FUNCTION get_search_statistics_by_day(integer) TO service_role;
GRANT EXECUTE ON FUNCTION get_search_statistics_by_day(integer) TO anon;
GRANT EXECUTE ON FUNCTION get_search_statistics_by_day(integer) TO authenticated; 