#!/bin/bash

# Use psql to directly test the database functions
# This approach doesn't use JWT authentication at all

# Get database connection string from .env.local
if [ -f ".env.local" ]; then
  echo "Found .env.local file"
  
  # Create SQL scripts for testing
  echo "Creating test SQL scripts..."
  
  # Create a script to run with psql
  cat > /tmp/test_functions.sql <<EOF
-- Check if the function exists
SELECT 
  proname AS function_name, 
  proargnames AS arg_names, 
  pg_get_function_arguments(oid) AS args
FROM pg_proc 
WHERE proname = 'refresh_content_representations';

-- Check if the embedding_queue table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'util' AND table_name = 'embedding_queue'
);

-- Check permissions
SELECT 
  grantor, grantee, privilege_type 
FROM information_schema.table_privileges 
WHERE table_schema = 'util' AND table_name = 'embedding_queue';

-- Check schemas
SELECT nspname AS schema_name 
FROM pg_catalog.pg_namespace 
ORDER BY schema_name;
EOF
    
  echo "Script generated for testing. To test the function directly with psql:"
  echo "1. Use the Supabase dashboard to run SQL queries"
  echo "2. Copy and paste the following query:"
  echo "-----------------------------------------"
  cat /tmp/test_functions.sql
  echo "-----------------------------------------"
  echo "3. Execute the query in the SQL Editor"
  
  # Instructions for reprocessing content
  echo ""
  echo "To reprocess content manually:"
  echo "1. Run this query in the SQL Editor to reprocess posts:"
  echo "   SELECT * FROM refresh_content_representations('posts', 10);"
  echo ""
  echo "2. To check the status:"
  echo "   SELECT * FROM get_content_representation_status();"
  echo ""
  echo "3. For batch reprocessing, repeat the first command with different parameters:"
  echo "   - To process comments: SELECT * FROM refresh_content_representations('comments', 10);"
  echo "   - To filter by subreddit: SELECT * FROM refresh_content_representations('posts', 10, NULL, 'travel');"
  echo ""
  echo "Note: You might need to adjust the function parameters based on the actual function signature."
else
  echo ".env.local file not found"
fi 