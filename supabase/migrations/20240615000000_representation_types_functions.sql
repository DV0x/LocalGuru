-- Migration to add support for multiple representation types
-- This implements functions to handle different representation types 
-- (full, title, body, context_enhanced)

-- Create a function to determine representation types for content
create or replace function public.get_representation_types(
  content_type text
)
returns text[]
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if content_type = 'post' then
    -- Posts support all representation types
    return array['full', 'title', 'context_enhanced'];
  elsif content_type = 'comment' then  
    -- Comments support basic and context-enhanced
    return array['full', 'context_enhanced'];
  else
    -- Default for unknown content types
    return array['full'];
  end if;
end;
$$;

-- Create a function to check if a representation exists and needs updating
create or replace function public.check_representation_status(
  p_content_id text,
  p_content_type text,
  p_representation_type text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  result jsonb;
  representation_exists boolean;
  content_age interval;
  created_at timestamptz;
begin
  -- Check if representation exists
  select exists(
    select 1 
    from public.content_representations
    where parent_id = p_content_id
    and content_type = p_content_type
    and representation_type = p_representation_type
  ) into representation_exists;
  
  -- Get content age
  if p_content_type = 'post' then
    select coalesce(now() - created_at, interval '0')
    from public.reddit_posts
    where id = p_content_id
    into content_age;
    
    select created_at
    from public.reddit_posts
    where id = p_content_id
    into created_at;
  else
    select coalesce(now() - created_at, interval '0')
    from public.reddit_comments
    where id = p_content_id
    into content_age;
    
    select created_at
    from public.reddit_comments
    where id = p_content_id
    into created_at;
  end if;
  
  -- Build result
  result := jsonb_build_object(
    'exists', representation_exists,
    'content_type', p_content_type,
    'representation_type', p_representation_type,
    'content_age_days', extract(day from content_age),
    'created_at', created_at
  );
  
  return result;
end;
$$;

-- Make the refresh_content_representations function handle representation types
create or replace function public.refresh_content_representations(
  refresh_type text default 'all'::text,
  batch_size integer default 100,
  filter_subreddit text default null,
  min_age_hours integer default null,
  max_age_hours integer default null,
  representation_types text[] default null
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
  rep_types text[];
  execution_time numeric;
  min_created_at timestamptz;
  max_created_at timestamptz;
begin
  -- Set time filters if provided
  if max_age_hours is not null then
    min_created_at := now() - (max_age_hours || ' hours')::interval;
  end if;
  
  if min_age_hours is not null then
    max_created_at := now() - (min_age_hours || ' hours')::interval;
  end if;
  
  -- Set representation types
  if representation_types is null or array_length(representation_types, 1) = 0 then
    -- Default to all representation types
    rep_types := array['context_enhanced'];
  else
    rep_types := representation_types;
  end if;
  
  -- Process posts if requested
  if refresh_type = 'posts' or refresh_type = 'all' then
    insert into util.embedding_queue (record_id, schema_name, table_name, content_function, embedding_column, status, priority, subreddit)
    select 
      rp.id, 
      'public', 
      'reddit_posts', 
      'extract_content_for_embedding', 
      'embedding', 
      'pending', 
      5, 
      rp.subreddit
    from public.reddit_posts rp
    where (filter_subreddit is null or rp.subreddit = filter_subreddit)
      and (min_created_at is null or rp.created_at >= min_created_at)
      and (max_created_at is null or rp.created_at <= max_created_at)
      and not exists (
        select 1 
        from public.content_representations cr 
        where cr.parent_id = rp.id 
        and cr.content_type = 'post' 
        and cr.representation_type = any(rep_types)
      )
    limit batch_size;
    
    get diagnostics posts_count = row_count;
    queued_count := queued_count + posts_count;
  end if;
  
  -- Process comments if requested
  if refresh_type = 'comments' or refresh_type = 'all' then
    -- First, try to find comments with specific subreddit if filtered
    if filter_subreddit is not null then
      insert into util.embedding_queue (record_id, schema_name, table_name, content_function, embedding_column, status, priority)
      select 
        rc.id, 
        'public', 
        'reddit_comments', 
        'extract_content_for_embedding', 
        'embedding', 
        'pending', 
        5
      from public.reddit_comments rc
      join public.reddit_posts rp on rc.post_id = rp.id
      where rp.subreddit = filter_subreddit
        and (min_created_at is null or rc.created_at >= min_created_at)
        and (max_created_at is null or rc.created_at <= max_created_at)
        and not exists (
          select 1 
          from public.content_representations cr 
          where cr.parent_id = rc.id 
          and cr.content_type = 'comment' 
          and cr.representation_type = any(rep_types)
        )
      limit batch_size;
    else
      -- Process comments without subreddit filter
      insert into util.embedding_queue (record_id, schema_name, table_name, content_function, embedding_column, status, priority)
      select 
        rc.id, 
        'public', 
        'reddit_comments', 
        'extract_content_for_embedding', 
        'embedding', 
        'pending', 
        5
      from public.reddit_comments rc
      where (min_created_at is null or rc.created_at >= min_created_at)
        and (max_created_at is null or rc.created_at <= max_created_at)
        and not exists (
          select 1 
          from public.content_representations cr 
          where cr.parent_id = rc.id 
          and cr.content_type = 'comment' 
          and cr.representation_type = any(rep_types)
        )
      limit batch_size;
    end if;
    
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
    'representation_types', rep_types,
    'execution_time_ms', execution_time
  );
end;
$$;

-- Add a custom function to check representation coverage
create or replace function public.get_representation_coverage()
returns json
language plpgsql
security invoker
set search_path = ''
as $$
declare
  result json;
  post_stats jsonb;
  comment_stats jsonb;
begin
  -- Calculate post coverage
  select jsonb_build_object(
    'total_posts', (select count(*) from public.reddit_posts),
    'representation_counts', (
      select jsonb_object_agg(representation_type, count)
      from (
        select 
          representation_type, 
          count(*)
        from public.content_representations
        where content_type = 'post'
        group by representation_type
      ) rep_counts
    ),
    'missing_context_enhanced', (
      select count(*)
      from public.reddit_posts p
      where not exists (
        select 1 
        from public.content_representations r
        where r.parent_id = p.id
        and r.content_type = 'post'
        and r.representation_type = 'context_enhanced'
      )
    )
  ) into post_stats;
  
  -- Calculate comment coverage
  select jsonb_build_object(
    'total_comments', (select count(*) from public.reddit_comments),
    'representation_counts', (
      select jsonb_object_agg(representation_type, count)
      from (
        select 
          representation_type, 
          count(*)
        from public.content_representations
        where content_type = 'comment'
        group by representation_type
      ) rep_counts
    ),
    'missing_context_enhanced', (
      select count(*)
      from public.reddit_comments c
      where not exists (
        select 1 
        from public.content_representations r
        where r.parent_id = c.id
        and r.content_type = 'comment'
        and r.representation_type = 'context_enhanced'
      )
    )
  ) into comment_stats;
  
  -- Build result
  result := json_build_object(
    'timestamp', now(),
    'post_stats', post_stats,
    'comment_stats', comment_stats
  );
  
  return result;
end;
$$;

-- Update the status function to include representation type information
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
  representation_stats json;
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
  
  -- Get representation type statistics
  select json_build_object(
    'post_representations', (
      select json_object_agg(representation_type, count)
      from (
        select representation_type, count(*)
        from public.content_representations
        where content_type = 'post'
        group by representation_type
      ) as post_reps
    ),
    'comment_representations', (
      select json_object_agg(representation_type, count)
      from (
        select representation_type, count(*)
        from public.content_representations
        where content_type = 'comment'
        group by representation_type
      ) as comment_reps
    )
  ) into representation_stats;
  
  -- Return combined statistics
  return json_build_object(
    'post_stats', post_stats,
    'comment_stats', comment_stats,
    'queue_stats', queue_stats,
    'representation_stats', representation_stats,
    'timestamp', now()
  );
end;
$$;

-- Grant execute permissions
grant execute on function public.get_representation_types(text) to service_role;
grant execute on function public.check_representation_status(text, text, text) to service_role;
grant execute on function public.refresh_content_representations(text, integer, text, integer, integer, text[]) to service_role;
grant execute on function public.get_representation_coverage() to service_role;
grant execute on function public.get_content_representation_status() to service_role; 