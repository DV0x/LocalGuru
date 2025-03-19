#!/bin/bash

# Automated script to reprocess all content in batches
# Uses direct PostgreSQL connection

# Fixed connection details with URL-encoded password
DB_CONN="postgresql://postgres.ghjbtvyalvigvmuodaas:ch%40924880194792@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"

# Configuration
BATCH_SIZE=10        # Number of items per batch
TOTAL_BATCHES=10     # Total number of batches to process
PAUSE_SECONDS=5      # Seconds to wait between batches
TYPES=("posts" "comments")  # Content types to process

# Check if psql is installed
if ! command -v psql &> /dev/null; then
    echo "Error: psql is not installed. Please install PostgreSQL client tools."
    exit 1
fi

echo "Starting automated content reprocessing..."

# Function to run a query and display results
run_query() {
    echo ""
    echo "==== Running query: $1 ===="
    echo "$2" | psql "$DB_CONN" -t
    return $?
}

# Process each content type
for content_type in "${TYPES[@]}"; do
    echo ""
    echo "==============================================="
    echo "Processing content type: $content_type"
    echo "==============================================="

    # Get initial status
    STATUS_QUERY="SELECT * FROM get_content_representation_status();"
    run_query "Initial Status" "$STATUS_QUERY"
    
    # Process in batches
    for ((i=1; i<=TOTAL_BATCHES; i++)); do
        echo ""
        echo "Processing batch $i of $TOTAL_BATCHES for $content_type..."
        
        # Queue items for reprocessing
        REPROCESS_QUERY="SELECT * FROM refresh_content_representations('$content_type', $BATCH_SIZE);"
        run_query "Reprocess Batch" "$REPROCESS_QUERY"
        
        echo "Waiting $PAUSE_SECONDS seconds before next batch..."
        sleep $PAUSE_SECONDS
    done
    
    # Get final status for this content type
    echo ""
    echo "Completed processing for $content_type"
    run_query "Updated Status" "$STATUS_QUERY"
done

echo ""
echo "==============================================="
echo "All reprocessing jobs have been queued!"
echo "==============================================="
echo ""
echo "To monitor progress, run: ./scripts/direct-psql-connection.sh monitor"
echo ""
echo "Script completed." 