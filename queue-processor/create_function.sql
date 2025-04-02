-- Function to count embedding queue records by status
CREATE OR REPLACE FUNCTION util.get_embedding_queue_count_by_status(p_status text)
RETURNS integer AS $$
DECLARE
    v_count integer;
BEGIN
    -- Count records by status from embedding_queue
    SELECT COUNT(*)
    FROM util.embedding_queue
    WHERE status = p_status
    INTO v_count;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION util.get_embedding_queue_count_by_status(text) TO authenticated;
GRANT EXECUTE ON FUNCTION util.get_embedding_queue_count_by_status(text) TO service_role; 