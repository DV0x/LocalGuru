-- Set probes parameter for better vector search performance
-- First, set the global probes setting
SET ivfflat.probes = 10;

-- Then add a comment explaining what we're doing
COMMENT ON INDEX content_representations_embedding_idx IS 'Vector similarity index with 100 lists, configured for 10 probes via ivfflat.probes setting';

-- Rebuild the index to ensure optimal performance
REINDEX INDEX content_representations_embedding_idx;

-- Also run VACUUM ANALYZE to update statistics
VACUUM ANALYZE content_representations; 