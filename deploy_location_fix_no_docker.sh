#!/bin/bash

# Script to deploy the updated query analysis function with location fix (without requiring Docker)
echo "Starting deployment of query analysis function with location fix..."

# Set up variables
SUPABASE_PROJECT_ID=$(grep "project_id" ./supabase/.temp/project-ref 2>/dev/null)
if [ -z "$SUPABASE_PROJECT_ID" ]; then
  echo "Error: Could not find Supabase project ID."
  echo "Please enter your Supabase project ID:"
  read SUPABASE_PROJECT_ID
fi

TIMESTAMP=$(date +"%Y%m%d%H%M%S")
BACKUP_DIR="./backups/${TIMESTAMP}"

echo "Creating backup directory..."
mkdir -p "${BACKUP_DIR}/functions/query-analysis"

# Back up the current function
echo "Backing up current query analysis function..."
cp "./supabase/functions/query-analysis/index.ts" "${BACKUP_DIR}/functions/query-analysis/"
cp "./supabase/functions/query-analysis/enhanced-intent-detection.ts" "${BACKUP_DIR}/functions/query-analysis/" 2>/dev/null

echo "Deploying updated query analysis function..."
# Deploy using direct API call without requiring Docker
supabase functions deploy query-analysis --project-ref "${SUPABASE_PROJECT_ID}" --no-verify-jwt --legacy-bundle

if [ $? -eq 0 ]; then
    echo "✅ Successfully deployed query analysis function with location fix!"
    echo "The function now properly transfers locations from entities to the locations array and normalizes location names."
    echo "Backup saved to: ${BACKUP_DIR}"

    echo "To test the updated function, run: ./test_location_fix_deployed.sh"
else
    echo "❌ Failed to deploy the updated function."
    echo "Check for errors in the console output above."
fi

echo "Deployment process completed." 