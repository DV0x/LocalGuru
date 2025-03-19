#!/bin/bash

# Direct PostgreSQL connection test script
# Uses the connection string provided by the user

# Fixed connection details
# The connection string had special characters that need proper URL encoding
DB_CONN="postgresql://postgres.ghjbtvyalvigvmuodaas:ch%40924880194792@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"

# Check if psql is installed
if ! command -v psql &> /dev/null; then
    echo "Error: psql is not installed. Please install PostgreSQL client tools."
    exit 1
fi

echo "Testing direct PostgreSQL connection..."

# Function to run a query and display results
run_query() {
    echo ""
    echo "==== Running query: $1 ===="
    echo "$2" | psql "$DB_CONN" -t
    local result=$?
    if [ $result -ne 0 ]; then
        echo "Error executing query!"
    fi
    return $result
}

# Create diagnostic queries
CHECK_FUNCTION="
-- Check if the refresh_content_representations function exists
SELECT 
  proname AS function_name, 
  proargnames AS arg_names, 
  pg_get_function_arguments(oid) AS args
FROM pg_proc 
WHERE proname = 'refresh_content_representations';
"

CHECK_TABLE="
-- Check if the embedding_queue table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'util' AND table_name = 'embedding_queue'
);
"

CHECK_SCHEMAS="
-- List available schemas
SELECT nspname AS schema_name 
FROM pg_catalog.pg_namespace 
ORDER BY schema_name;
"

# Run queries
run_query "Check Function" "$CHECK_FUNCTION"
run_query "Check Table" "$CHECK_TABLE"
run_query "Check Schemas" "$CHECK_SCHEMAS"

# If tests are successful, proceed to more tests
echo ""
echo "==== Testing refresh_content_representations function ===="
echo "Would you like to queue 5 posts for reprocessing? (y/n)"
read -n 1 -r

if [[ $REPLY =~ ^[Yy]$ ]]; then
    REPROCESS_POSTS="
    -- Queue 5 posts for reprocessing
    SELECT * FROM refresh_content_representations('posts', 5);
    "
    run_query "Reprocess Posts" "$REPROCESS_POSTS"
    
    CHECK_STATUS="
    -- Check status
    SELECT * FROM get_content_representation_status();
    "
    run_query "Check Status" "$CHECK_STATUS"
    
    echo ""
    echo "Posts have been queued for reprocessing!"
    echo "To monitor progress, run: ./scripts/direct-psql-connection.sh monitor"
fi

# Check if we're in monitor mode
if [ "$1" = "monitor" ]; then
    echo ""
    echo "==== Monitoring reprocessing status ===="
    echo "Press Ctrl+C to stop monitoring"
    
    while true; do
        MONITOR_QUERY="
        -- Check current status
        SELECT * FROM get_content_representation_status();
        
        -- Check pending queue
        SELECT COUNT(*) AS pending_items FROM util.embedding_queue WHERE status = 'pending';
        
        -- Check processing queue
        SELECT COUNT(*) AS processing_items FROM util.embedding_queue WHERE status = 'processing';
        "
        run_query "Status Update" "$MONITOR_QUERY"
        echo ""
        echo "Waiting 10 seconds for next update..."
        sleep 10
    done
fi

echo ""
echo "Script completed. To monitor progress, run: ./scripts/direct-psql-connection.sh monitor" 