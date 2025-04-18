-- Rebuild the content_representations_embedding_idx index with better parameters
DROP INDEX IF EXISTS content_representations_embedding_idx;

-- Recreate with proper parameters
CREATE INDEX content_representations_embedding_idx 
ON public.content_representations USING ivfflat (embedding vector_cosine_ops) 
WITH (lists='100');

-- Create separate indexes for each embedding type to improve performance
CREATE INDEX IF NOT EXISTS cr_basic_embedding_idx
ON public.content_representations USING ivfflat (embedding vector_cosine_ops) 
WHERE representation_type = 'basic'
WITH (lists='100');

CREATE INDEX IF NOT EXISTS cr_title_embedding_idx
ON public.content_representations USING ivfflat (embedding vector_cosine_ops) 
WHERE representation_type = 'title'
WITH (lists='100');

CREATE INDEX IF NOT EXISTS cr_context_enhanced_embedding_idx
ON public.content_representations USING ivfflat (embedding vector_cosine_ops) 
WHERE representation_type = 'context_enhanced'
WITH (lists='100');

-- Ensure proper stats are maintained
ANALYZE content_representations; 