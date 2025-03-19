#!/bin/bash

# Script to deploy the updated query analysis function with location fix
echo "Starting deployment of query analysis function with location fix..."

# Set up variables
SUPABASE_PROJECT_ID=$(grep "project_id" ./supabase/.temp/project-ref 2>/dev/null)
TIMESTAMP=$(date +"%Y%m%d%H%M%S")
BACKUP_DIR="./backups/${TIMESTAMP}"

echo "Creating backup directory..."
mkdir -p "${BACKUP_DIR}/functions/query-analysis"

# Back up the current function
echo "Backing up current query analysis function..."
cp "./supabase/functions/query-analysis/index.ts" "${BACKUP_DIR}/functions/query-analysis/"
cp "./supabase/functions/query-analysis/enhanced-intent-detection.ts" "${BACKUP_DIR}/functions/query-analysis/" 2>/dev/null

echo "Deploying updated query analysis function..."
# Deploy the updated function using Supabase CLI
supabase functions deploy query-analysis --project-ref "${SUPABASE_PROJECT_ID}" --no-verify-jwt

if [ $? -eq 0 ]; then
    echo "✅ Successfully deployed query analysis function with location fix!"
    echo "The function now properly transfers locations from entities to the locations array and normalizes location names."
    echo "Backup saved to: ${BACKUP_DIR}"

    echo "To test the updated function, use:"
    echo "curl -X POST 'https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/query-analysis' \\"
    echo "  -H 'Content-Type: application/json' \\"
    echo "  -H 'Authorization: Bearer YOUR_ANON_KEY' \\"
    echo "  -d '{\"query\":\"What can I do in a park in sf?\"}'"
else
    echo "❌ Failed to deploy the updated function."
    echo "Check for errors in the console output above."
fi

echo "Deployment process completed." 