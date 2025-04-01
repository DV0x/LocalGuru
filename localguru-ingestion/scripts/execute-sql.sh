#!/bin/bash

# Load environment variables
if [ -f ../.env ]; then
  export $(grep -v '^#' ../.env | xargs)
fi

# Check if service key is available
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "Error: SUPABASE_SERVICE_ROLE_KEY environment variable is not set"
  exit 1
fi

# Check if URL is available
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
  echo "Error: NEXT_PUBLIC_SUPABASE_URL environment variable is not set"
  exit 1
fi

SQL_CONTENT=$(cat db-schema-updates.sql | tr '\n' ' ' | sed 's/"/\\"/g')

echo "Executing SQL..."
curl -s -X POST \
  "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/sql" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"${SQL_CONTENT}\"}"

if [ $? -eq 0 ]; then
  echo "SQL execution completed."
  exit 0
else
  echo "Failed to execute SQL."
  exit 1
fi 