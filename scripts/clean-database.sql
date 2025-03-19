-- Clean Database Script for Localguru
-- This script will truncate all tables to start fresh

-- Start a transaction so we can roll back if something goes wrong
BEGIN;

-- Disable triggers temporarily to avoid trigger-based issues
SET session_replication_role = 'replica';

-- 1. First truncate queue, metrics and feedback tables (no dependencies)
TRUNCATE TABLE util.embedding_queue CASCADE;
TRUNCATE TABLE public.embedding_metrics CASCADE;
TRUNCATE TABLE public.embedding_metrics_summary CASCADE;
TRUNCATE TABLE public.search_feedback CASCADE;
TRUNCATE TABLE public.embedding_cache CASCADE;

-- 2. Truncate content representations and chunks
TRUNCATE TABLE public.content_representations CASCADE;
TRUNCATE TABLE public.content_chunks CASCADE;

-- 3. Truncate Reddit comments (depends on Reddit posts)
TRUNCATE TABLE public.reddit_comments CASCADE;

-- 4. Truncate Reddit posts (depends on Reddit users)
TRUNCATE TABLE public.reddit_posts CASCADE;

-- 5. Finally truncate Reddit users
TRUNCATE TABLE public.reddit_users CASCADE;

-- Re-enable triggers
SET session_replication_role = 'origin';

-- Commit the transaction
COMMIT;

-- Verify the tables are empty
SELECT 'reddit_posts', COUNT(*) FROM public.reddit_posts
UNION ALL
SELECT 'reddit_comments', COUNT(*) FROM public.reddit_comments
UNION ALL
SELECT 'reddit_users', COUNT(*) FROM public.reddit_users
UNION ALL
SELECT 'content_representations', COUNT(*) FROM public.content_representations
UNION ALL
SELECT 'content_chunks', COUNT(*) FROM public.content_chunks
UNION ALL
SELECT 'embedding_queue', COUNT(*) FROM util.embedding_queue
UNION ALL
SELECT 'embedding_metrics', COUNT(*) FROM public.embedding_metrics
UNION ALL
SELECT 'embedding_cache', COUNT(*) FROM public.embedding_cache
UNION ALL
SELECT 'search_feedback', COUNT(*) FROM public.search_feedback; 