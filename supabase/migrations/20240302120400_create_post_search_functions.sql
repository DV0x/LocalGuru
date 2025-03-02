-- Migration: Create post search by embedding function
-- Description: Creates a function to search posts by vector similarity

-- Function to search posts by embedding similarity
create or replace function public.search_posts_by_embedding(
  query_embedding vector(1536),
  similarity_threshold float default 0.7,
  max_results integer default 10,
  filter_subreddit text default null,
  min_score integer default null,
  include_nsfw boolean default false
)
returns table (
  id text,
  subreddit text,
  title text,
  content text,
  author_id text,
  similarity float
)
language plpgsql
security invoker
set search_path = ''
stable
as $$
begin
  return query
  select
    p.id,
    p.subreddit,
    p.title,
    p.content,
    p.author_id,
    1 - (p.embedding <=> query_embedding) as similarity
  from public.reddit_posts p
  where 1 - (p.embedding <=> query_embedding) > similarity_threshold
    and (filter_subreddit is null or p.subreddit = filter_subreddit)
    and (min_score is null or p.score >= min_score)
    and (include_nsfw or not p.is_nsfw)
  order by similarity desc
  limit max_results;
end;
$$;

-- Add function comment
comment on function public.search_posts_by_embedding(vector(1536), float, integer, text, integer, boolean) is 
'Searches for Reddit posts by vector embedding similarity with configurable parameters for filtering results'; 