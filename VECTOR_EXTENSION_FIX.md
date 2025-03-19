# Fixing the pgvector Extension Issue

## Problem Diagnosis

We've identified an issue with the semantic search functionality that's causing the following error:

```
operator does not exist: public.vector <=> public.vector
```

This error occurs because:

1. The pgvector extension is installed in the `extensions` schema (as specified in `20230301000000_enable_extensions.sql`)
2. The SQL functions are trying to use the vector operator from the `public` schema

## Solution

We've prepared a SQL script (`fix-vector-operator.sql`) with two possible solutions:

### Option 1: Create a Public Schema Wrapper

This creates a wrapper for the vector operator in the public schema that references the one in the extensions schema. This is a clean solution that doesn't require changing all your functions.

```sql
DO $$
BEGIN
    -- Check if the vector extension exists in extensions schema
    IF EXISTS (
        SELECT 1
        FROM pg_extension
        WHERE extname = 'vector'
    ) THEN
        -- Create cast operators in public schema that reference the extensions schema
        EXECUTE 'CREATE OPERATOR public.<=> (
            LEFTARG = public.vector,
            RIGHTARG = public.vector,
            PROCEDURE = extensions.vector_cosine_distance,
            COMMUTATOR = <=>
        )';
        
        RAISE NOTICE 'Successfully created public schema wrapper for vector operator';
    ELSE
        RAISE EXCEPTION 'Vector extension not found. Please install it first.';
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Error creating public schema wrapper: %', SQLERRM;
END;
$$;
```

### Option 2: Update Functions to Use extensions.vector

We've included updated versions of the `parallel_search` and `search_posts_by_embedding` functions that explicitly use `extensions.vector` instead of relying on the public schema.

## How to Apply the Fix

1. Connect to your Supabase Database using the SQL Editor in the dashboard
2. Run the `fix-vector-operator.sql` script 
3. Test if the search functionality is working with one of our test scripts

If Option 1 doesn't work, you might need to apply Option 2 and update all functions that use the vector type.

## Alternative Approaches

If neither option works, there are a few other alternatives:

1. Install pgvector directly in the public schema
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;  -- This will install in the current schema
   ```

2. Add the extensions schema to the search path in the functions
   ```sql
   CREATE OR REPLACE FUNCTION public.parallel_search(...)
   LANGUAGE plpgsql
   SECURITY INVOKER
   SET search_path = 'extensions, public'
   AS $$
   ...
   $$;
   ```

3. Make sure the columns in your tables are actually defined as `extensions.vector` and not `public.vector`

## Testing

After applying the fix, you can test if it worked using our `quick-test.sh` script:

```bash
./quick-test.sh
```

This will attempt to search for "best places to eat in Tokyo" using the search API endpoint with text search enabled. 