-- Create a view in the public schema that points to the util.embedding_queue table
CREATE OR REPLACE VIEW public.embedding_queue AS
SELECT * FROM util.embedding_queue;

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.embedding_queue TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.embedding_queue TO authenticated;
GRANT SELECT ON public.embedding_queue TO anon; 