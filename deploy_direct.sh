#!/bin/bash

# Direct deployment script for location fix
SUPABASE_PROJECT_ID="ghjbtvyalvigvmuodaas"
TIMESTAMP=$(date +"%Y%m%d%H%M%S")
BACKUP_DIR="./backups/${TIMESTAMP}"

echo "Creating backup directory..."
mkdir -p "${BACKUP_DIR}/functions/query-analysis"

# Back up the current function
echo "Backing up current query analysis function..."
cp "./supabase/functions/query-analysis/index.ts" "${BACKUP_DIR}/functions/query-analysis/" 2>/dev/null
cp "./supabase/functions/query-analysis/enhanced-intent-detection.ts" "${BACKUP_DIR}/functions/query-analysis/" 2>/dev/null

echo "Deploying updated query analysis function..."
# Deploy using direct API call without requiring Docker
supabase functions deploy query-analysis --project-ref "${SUPABASE_PROJECT_ID}" --no-verify-jwt --use-docker=false

if [ $? -eq 0 ]; then
    echo "✅ Successfully deployed query analysis function with location fix!"
else
    echo "❌ Failed to deploy the updated function."
fi 