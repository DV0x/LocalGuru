-- Migration: Create comment tree management function
-- Description: Creates a function to retrieve hierarchical comment trees from the database

-- Function to get a comment tree for a specific post
create or replace function public.get_comment_tree(post_id_param text)
returns table (
  id text,
  post_id text,
  parent_id text,
  author_id text,
  content text,
  created_at timestamp with time zone,
  score integer,
  depth integer,
  path text[],
  is_stickied boolean
)
language sql
security invoker
set search_path = ''
stable
as $$
  select 
    id, 
    post_id, 
    parent_id, 
    author_id, 
    content, 
    created_at, 
    score, 
    depth, 
    path, 
    is_stickied
  from 
    public.reddit_comments
  where 
    post_id = post_id_param
  order by 
    path;
$$;

-- Add function comment
comment on function public.get_comment_tree(text) is 'Retrieves a hierarchical comment tree for a given post ID, ordered by path for proper nesting'; 