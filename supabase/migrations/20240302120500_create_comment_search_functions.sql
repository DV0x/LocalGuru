-- Migration: Create comment search by embedding function
-- Description: Creates a function to search comments by vector similarity

-- Function to search comments by embedding similarity
create or replace function public.search_comments_by_embedding(
  query_embedding vector(1536),
  similarity_threshold float default 0.7,
  max_results integer default 10,
  filter_post_id text default null,
  min_score integer default null
)
returns table (
  id text,
  post_id text,
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
    c.id,
    c.post_id,
    c.content,
    c.author_id,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.reddit_comments c
  where 1 - (c.embedding <=> query_embedding) > similarity_threshold
    and (filter_post_id is null or c.post_id = filter_post_id)
    and (min_score is null or c.score >= min_score)
  order by similarity desc
  limit max_results;
end;
$$;

-- Add function comment
comment on function public.search_comments_by_embedding(vector(1536), float, integer, text, integer) is 
'Searches for Reddit comments by vector embedding similarity with configurable parameters for filtering results'; 