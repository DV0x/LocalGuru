-- Update content view to remove embedding column
-- First drop the existing view
DROP VIEW IF EXISTS public.content;

-- Then recreate it without the embedding column
CREATE VIEW public.content AS
SELECT 
    p.id,
    p.title,
    p.content,
    p.url,
    p.subreddit,
    u.username AS author,
    'post'::text AS content_type,
    p.created_at
FROM 
    reddit_posts p
    LEFT JOIN reddit_users u ON p.author_id = u.id
UNION ALL
SELECT 
    c.id,
    p.title,
    c.content,
    p.url,
    p.subreddit,
    u.username AS author,
    'comment'::text AS content_type,
    c.created_at
FROM 
    reddit_comments c
    JOIN reddit_posts p ON c.post_id = p.id
    LEFT JOIN reddit_users u ON c.author_id = u.id; 