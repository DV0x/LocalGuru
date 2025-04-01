-- Create a view in the public schema that points to the util.embedding_queue table
CREATE OR REPLACE VIEW public.embedding_queue AS
SELECT * FROM util.embedding_queue;

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.embedding_queue TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.embedding_queue TO authenticated;
GRANT SELECT ON public.embedding_queue TO anon;

-- Function to get pending queue items
CREATE OR REPLACE FUNCTION public.get_pending_queue_items(max_items integer DEFAULT 50)
RETURNS SETOF util.embedding_queue
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT * FROM util.embedding_queue
  WHERE status = 'pending'
  ORDER BY priority DESC, created_at ASC
  LIMIT max_items;
$$;

-- Function to check if an item exists in the queue
CREATE OR REPLACE FUNCTION public.check_queue_item_exists(
  item_type text,
  item_id text
)
RETURNS boolean
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM util.embedding_queue
    WHERE table_name = CASE 
      WHEN item_type = 'post' THEN 'reddit_posts'
      WHEN item_type = 'comment' THEN 'reddit_comments'
      ELSE item_type
    END
    AND record_id = item_id
    AND status NOT IN ('completed', 'failed')
  );
$$;

-- Function to insert a new queue item
CREATE OR REPLACE FUNCTION public.add_to_embedding_queue(
  item_type text,
  item_id text,
  item_priority integer DEFAULT 5
)
RETURNS util.embedding_queue
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_item util.embedding_queue;
  table_name text;
  content_function text;
BEGIN
  -- Determine table name and content function based on item type
  IF item_type = 'post' THEN
    table_name := 'reddit_posts';
    content_function := 'get_post_content';
  ELSIF item_type = 'comment' THEN
    table_name := 'reddit_comments';
    content_function := 'get_comment_content';
  ELSE
    table_name := item_type;
    content_function := 'get_generic_content';
  END IF;

  -- Insert new queue item
  INSERT INTO util.embedding_queue (
    record_id,
    schema_name,
    table_name,
    content_function,
    embedding_column,
    status,
    priority,
    attempts,
    created_at,
    updated_at
  )
  VALUES (
    item_id,
    'public',
    table_name,
    content_function,
    'embedding',
    'pending',
    item_priority,
    0,
    now(),
    now()
  )
  RETURNING * INTO new_item;
  
  RETURN new_item;
END;
$$;

-- Function to update an existing queue item's priority
CREATE OR REPLACE FUNCTION public.update_queue_item_priority(
  item_type text,
  item_id text,
  new_priority integer
)
RETURNS util.embedding_queue
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_item util.embedding_queue;
  table_name text;
BEGIN
  -- Determine table name based on item type
  IF item_type = 'post' THEN
    table_name := 'reddit_posts';
  ELSIF item_type = 'comment' THEN
    table_name := 'reddit_comments';
  ELSE
    table_name := item_type;
  END IF;

  -- Update queue item
  UPDATE util.embedding_queue
  SET 
    priority = new_priority,
    updated_at = now()
  WHERE table_name = table_name
    AND record_id = item_id
    AND status NOT IN ('completed', 'failed')
  RETURNING * INTO updated_item;
  
  RETURN updated_item;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_pending_queue_items TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.check_queue_item_exists TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.add_to_embedding_queue TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.update_queue_item_priority TO service_role, authenticated; 