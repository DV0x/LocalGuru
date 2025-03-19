#!/bin/bash

# Script to update the content view to remove embedding column

# Connection details
DB_HOST="aws-0-ap-southeast-1.pooler.supabase.com"
DB_PORT="5432"
DB_NAME="postgres"
DB_USER="postgres.ghjbtvyalvigvmuodaas"
DB_PASSWORD="ch@924880194792"

# SQL file
SQL_FILE="scripts/update-content-view.sql"

echo "Updating content view to remove embedding column..."

# Execute the SQL file
PGPASSWORD="$DB_PASSWORD" psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -d "$DB_NAME" \
  -U "$DB_USER" \
  -f "$SQL_FILE"

# Check if the command was successful
if [ $? -eq 0 ]; then
  echo "Content view updated successfully."
  
  # Verify view definition
  echo "Verifying new view definition..."
  PGPASSWORD="$DB_PASSWORD" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -d "$DB_NAME" \
    -U "$DB_USER" \
    -c "SELECT pg_get_viewdef('public.content', true);"
else
  echo "Error: Failed to update content view."
  exit 1
fi

echo "Done." 