#!/bin/bash

# Clean Database Script
# This script will execute the clean-database.sql file against the Supabase database

# Get environment variables from .env file
source .env

# Set variables
SQL_FILE="scripts/clean-database.sql"

# Validate .env file has the required variables
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "Error: Missing required environment variables. Please check your .env file."
  exit 1
fi

echo "WARNING: This script will delete ALL data from the Localguru database."
echo "This includes all Reddit posts, comments, users, embeddings, and search data."
echo "This action cannot be undone."
echo ""
read -p "Are you sure you want to continue? (y/N): " confirm

if [[ $confirm != "y" && $confirm != "Y" ]]; then
  echo "Operation cancelled."
  exit 0
fi

# First, ensure the exec_sql function exists by calling the vector-check function
echo "Ensuring exec_sql function exists..."
curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -d '{
    "action": "create_exec_sql"
  }' \
  "$SUPABASE_URL/functions/v1/vector-check" > exec_sql_creation.json

# Check if the exec_sql function was created successfully
if grep -q "error" exec_sql_creation.json; then
  echo "Error: Failed to create exec_sql function."
  cat exec_sql_creation.json
  exit 1
fi

echo "Executing clean-database.sql..."

# Execute the SQL file using curl to Supabase REST API
curl -X POST "$SUPABASE_URL/rest/v1/rpc/exec_sql" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"sql_query\": \"$(cat $SQL_FILE | tr -d '\n' | sed 's/"/\\"/g')\"}" > clean-database-results.json

# Check if the command was successful
if [ $? -eq 0 ] && ! grep -q "error" clean-database-results.json; then
  echo "Database cleaned successfully."
  echo "Results saved to clean-database-results.json"
else
  echo "Error: Failed to clean database."
  cat clean-database-results.json
  exit 1
fi

echo "Done." 