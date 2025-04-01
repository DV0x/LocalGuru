#!/bin/bash
# Script to apply database schema updates

# Load environment variables
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Check if SUPABASE_DB_URL is provided
if [ -z "$SUPABASE_DB_URL" ]; then
  echo "Error: SUPABASE_DB_URL environment variable is not set"
  echo "Format: postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"
  exit 1
fi

echo "Applying database schema updates..."
psql "$SUPABASE_DB_URL" -f scripts/db-schema-updates.sql

if [ $? -eq 0 ]; then
  echo "Database schema updated successfully"
  exit 0
else
  echo "Failed to update database schema"
  exit 1
fi 