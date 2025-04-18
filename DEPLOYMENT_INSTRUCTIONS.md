# Deployment Instructions: Fix for Hybrid Search 512-Dimension Embeddings

This document contains instructions for deploying the fix for the hybrid search function, ensuring it receives 512-dimensional embeddings as required.

## 1. Update Database with Validation Functions

First, deploy the new database migration that adds embedding validation functions:

```bash
cd supabase
supabase db push
```

This will add two helpful functions:
- `get_vector_dimensions`: Checks the number of dimensions in a vector
- `truncate_vector`: Truncates a vector to the specified number of dimensions

## 2. Deploy the Updated Edge Function

The `query-embeddings` function has been modified to always generate 512-dimensional embeddings regardless of what's passed in the request.

To deploy this function:

```bash
cd supabase
supabase functions deploy query-embeddings --no-docker
```

This will deploy without requiring Docker Desktop to be running.

## 3. Test the Changes

Once deployed, use the debug functions we created to verify the embeddings are correct:

```sql
-- Run this in the SQL Editor to check embedding dimensions
SELECT public.get_vector_dimensions(embedding) 
FROM public.content_representations 
LIMIT 1;

-- Use this to test the search functionality with logging
SELECT * FROM hybrid_search_debug(
  'test query', 
  -- the embedding will come from your application
  your_embedding_here,
  'general',
  ARRAY[]::text[], 
  ARRAY[]::text[]
);
```

## 4. Restart Application Services (if needed)

If you're running any server-side applications that use the hybrid search, you may need to restart them to clear any cached connections or data.

## 5. Monitoring

After deployment, monitor your logs for any errors related to embeddings or vector operations. The changes should resolve the dimension mismatch issues, but it's good to verify through monitoring.

## Future Considerations

If you encounter any issues with the OpenAI embeddings API or need to modify the dimension size later, you'll need to update:

1. The `query-embeddings` Edge Function
2. The database functions that expect 512-dimensional vectors
3. Any indexes built on these vectors

The current implementation enforces 512 dimensions for compatibility with existing database functions and indexes. 