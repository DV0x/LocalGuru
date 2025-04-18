-- Monitor processing progress for reddit_posts and reddit_comments
WITH post_stats AS (
  SELECT 
    'posts' as content_type,
    COUNT(*) as total_records,
    COUNT(search_vector) as processed_records,
    ROUND(COUNT(search_vector)::numeric / COUNT(*)::numeric * 100, 2) as percent_complete
  FROM reddit_posts
),
comment_stats AS (
  SELECT 
    'comments' as content_type,
    COUNT(*) as total_records,
    COUNT(search_vector) as processed_records,
    ROUND(COUNT(search_vector)::numeric / COUNT(*)::numeric * 100, 2) as percent_complete
  FROM reddit_comments
),
queue_stats AS (
  SELECT
    status,
    COUNT(*) as count
  FROM
    util.embedding_queue
  GROUP BY
    status
)
SELECT * FROM post_stats
UNION ALL
SELECT * FROM comment_stats
UNION ALL
SELECT 
  'queue_' || status as content_type,
  count as total_records,
  0 as processed_records,
  0 as percent_complete
FROM 
  queue_stats; 