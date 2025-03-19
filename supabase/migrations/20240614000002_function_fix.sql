-- Fix the refresh_content_representations function to use fully qualified table names

-- Drop existing functions first
drop function if exists public.refresh_content_representations(text, integer);
drop function if exists public.get_content_representation_status();

-- Implement get_content_representation_status function
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
  
  -- Get queue statistics
  select json_build_object(
    'pending_posts', coalesce((
      select count(*) 
      from util.embedding_queue 
      where status = 'pending' and content_type = 'post'
    ), 0),
    'pending_comments', coalesce((
      select count(*) 
      from util.embedding_queue 
      where status = 'pending' and content_type = 'comment'
    ), 0),
    'processing_posts', coalesce((
      select count(*) 
      from util.embedding_queue 
      where status = 'processing' and content_type = 'post'
    ), 0),
    'processing_comments', coalesce((
      select count(*) 
      from util.embedding_queue 
      where status = 'processing' and content_type = 'comment'
    ), 0)
  ) into queue_stats;
  
  -- Return combined statistics
  return json_build_object(
    'post_stats', post_stats,
    'comment_stats', comment_stats,
    'queue_stats', queue_stats
  );
end;
$$;

-- Implement the refresh_content_representations function
create or replace function public.refresh_content_representations(
  refresh_type text default 'all'::text,
  batch_size integer default 100
)
returns json
language plpgsql
security invoker
set search_path = ''
as $$
declare
  start_time timestamptz := clock_timestamp();
  posts_count integer := 0;
  comments_count integer := 0;
  queued_count integer := 0;
  execution_time numeric;
begin
  -- Process posts if requested
  if refresh_type = 'posts' or refresh_type = 'all' then
    insert into util.embedding_queue (record_id, schema_name, table_name, content_function, embedding_column, status, priority, subreddit)
    select 
      id, 
      'public', 
      'reddit_posts', 
      'extract_content_for_embedding', 
      'embedding', 
      'pending', 
      5, 
      subreddit
    from public.reddit_posts rp
    where not exists (
      select 1 
      from public.content_representations cr 
      where cr.parent_id = rp.id 
      and cr.content_type = 'post' 
      and cr.representation_type = 'context_enhanced'
    )
    limit batch_size;
    
    get diagnostics posts_count = row_count;
    queued_count := queued_count + posts_count;
  end if;
  
  -- Process comments if requested
  if refresh_type = 'comments' or refresh_type = 'all' then
    insert into util.embedding_queue (record_id, schema_name, table_name, content_function, embedding_column, status, priority)
    select 
      id, 
      'public', 
      'reddit_comments', 
      'extract_content_for_embedding', 
      'embedding', 
      'pending', 
      5
    from public.reddit_comments rc
    where not exists (
      select 1 
      from public.content_representations cr 
      where cr.parent_id = rc.id 
      and cr.content_type = 'comment' 
      and cr.representation_type = 'context_enhanced'
    )
    limit batch_size;
    
    get diagnostics comments_count = row_count;
    queued_count := queued_count + comments_count;
  end if;
  
  -- Calculate execution time
  execution_time := extract(epoch from (clock_timestamp() - start_time)) * 1000;
  
  -- Return results
  return json_build_object(
    'refresh_type', refresh_type,
    'batch_size', batch_size,
    'queued_count', queued_count,
    'posts_count', posts_count,
    'comments_count', comments_count,
    'execution_time_ms', execution_time
  );
end;
$$;

-- Grant execute permissions
grant execute on function public.refresh_content_representations(text, integer) to service_role;
grant execute on function public.get_content_representation_status() to service_role; 