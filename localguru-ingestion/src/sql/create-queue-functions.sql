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
    WHERE content_type = item_type AND content_id = item_id
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
BEGIN
  INSERT INTO util.embedding_queue (
    content_type, 
    content_id, 
    priority, 
    status,
    created_at,
    updated_at
  )
  VALUES (
    item_type,
    item_id,
    item_priority,
    'pending',
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
BEGIN
  UPDATE util.embedding_queue
  SET 
    priority = new_priority,
    updated_at = now()
  WHERE content_type = item_type AND content_id = item_id
  RETURNING * INTO updated_item;
  
  RETURN updated_item;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_pending_queue_items TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.check_queue_item_exists TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.add_to_embedding_queue TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.update_queue_item_priority TO service_role, authenticated; 