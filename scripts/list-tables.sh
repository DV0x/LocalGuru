#!/bin/bash

# Script to list all tables in the Supabase database

# Connection details
DB_HOST="aws-0-ap-southeast-1.pooler.supabase.com"
DB_PORT="5432"
DB_NAME="postgres"
DB_USER="postgres.ghjbtvyalvigvmuodaas"
DB_PASSWORD="ch@924880194792"

echo "Listing all tables in the database..."

# Execute query to list all tables
PGPASSWORD="$DB_PASSWORD" psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -d "$DB_NAME" \
  -U "$DB_USER" \
  -c "
SELECT 
  schemaname, 
  tablename, 
  tableowner 
FROM pg_tables 
WHERE 
  schemaname NOT IN ('pg_catalog', 'information_schema') 
ORDER BY 
  schemaname, 
  tablename;"

echo "Done." 