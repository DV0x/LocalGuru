-- Fix the get_content_representation_status function to match the actual table structure

-- Drop existing function first
drop function if exists public.get_content_representation_status();

-- Recreate the get_content_representation_status function with correct column references
create or replace function public.get_content_representation_status()
returns json
language plpgsql
security invoker
set search_path = ''
as $$
declare
  post_stats json;
  comment_stats json;
  queue_stats json;
begin
  -- Get post statistics
  select json_build_object(
    'total_posts', coalesce((select count(*) from public.reddit_posts), 0),
    'posts_with_context_rep', coalesce((
      select count(distinct parent_id) 
      from public.content_representations 
      where content_type = 'post' and representation_type = 'context_enhanced'
    ), 0)
  ) into post_stats;
  
  -- Get comment statistics
  select json_build_object(
    'total_comments', coalesce((select count(*) from public.reddit_comments), 0),
    'comments_with_context_rep', coalesce((
      select count(distinct parent_id) 
      from public.content_representations 
      where content_type = 'comment' and representation_type = 'context_enhanced'
    ), 0)
  ) into comment_stats;
  
  -- Get queue statistics - note table_name instead of content_type
  select json_build_object(
    'pending_posts', coalesce((
      select count(*) 
      from util.embedding_queue 
      where status = 'pending' and table_name = 'reddit_posts'
    ), 0),
    'pending_comments', coalesce((
      select count(*) 
      from util.embedding_queue 
      where status = 'pending' and table_name = 'reddit_comments'
    ), 0),
    'processing_posts', coalesce((
      select count(*) 
      from util.embedding_queue 
      where status = 'processing' and table_name = 'reddit_posts'
    ), 0),
    'processing_comments', coalesce((
      select count(*) 
      from util.embedding_queue 
      where status = 'processing' and table_name = 'reddit_comments'
    ), 0)
  ) into queue_stats;
  
  -- Return combined statistics
  return json_build_object(
    'post_stats', post_stats,
    'comment_stats', comment_stats,
    'queue_stats', queue_stats,
    'timestamp', now()
  );
end;
$$;

-- Grant execute permissions
grant execute on function public.get_content_representation_status() to service_role; 