-- Function to reset orphaned jobs
CREATE OR REPLACE FUNCTION util.reset_orphaned_embedding_jobs(older_than_minutes integer DEFAULT 10)
RETURNS SETOF uuid AS $$
DECLARE
    v_id uuid;
    v_cutoff_time timestamptz;
BEGIN
    -- Calculate the cutoff time
    v_cutoff_time := NOW() - (older_than_minutes * interval '1 minute');
    
    -- Loop through orphaned jobs
    FOR v_id IN
        SELECT id
        FROM util.embedding_queue
        WHERE status = 'processing'
        AND updated_at < v_cutoff_time
    LOOP
        -- Reset the job to pending status
        UPDATE util.embedding_queue
        SET status = 'pending',
            attempts = 0,
            updated_at = NOW()
        WHERE id = v_id;
        
        -- Return the ID of the reset job
        RETURN NEXT v_id;
    END LOOP;
    
    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION util.reset_orphaned_embedding_jobs(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION util.reset_orphaned_embedding_jobs(integer) TO service_role; 