#!/bin/bash

# Force Clean Database Script
# This script will forcefully truncate all tables in the database

# Connection details
DB_HOST="aws-0-ap-southeast-1.pooler.supabase.com"
DB_PORT="5432"
DB_NAME="postgres"
DB_USER="postgres.ghjbtvyalvigvmuodaas"
DB_PASSWORD="ch@924880194792"

echo "WARNING: This script will forcefully delete ALL data from ALL tables in the database."
echo "This action cannot be undone."
echo ""
read -p "Are you sure you want to continue? (y/N): " confirm

if [[ $confirm != "y" && $confirm != "Y" ]]; then
  echo "Operation cancelled."
  exit 0
fi

echo "Forcefully cleaning all tables..."

# First, let's list all tables we'll be truncating
echo "Tables that will be cleaned:"
PGPASSWORD="$DB_PASSWORD" psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -d "$DB_NAME" \
  -U "$DB_USER" \
  -c "
SELECT 
  schemaname || '.' || tablename as full_table_name
FROM pg_tables 
WHERE 
  schemaname IN ('public', 'util', 'search_opt')
ORDER BY 
  schemaname, 
  tablename;"

# Execute the cleanup
# This will:
# 1. Temporarily disable RLS and triggers
# 2. Truncate all tables in the specified schemas
# 3. Re-enable triggers
PGPASSWORD="$DB_PASSWORD" psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -d "$DB_NAME" \
  -U "$DB_USER" \
  -c "
-- Start a transaction
BEGIN;

-- Disable triggers temporarily
SET session_replication_role = 'replica';

-- Truncate tables in proper order (with cascade)
-- First, search_opt schema tables
DO \$\$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'search_opt')
    LOOP
        EXECUTE 'TRUNCATE TABLE search_opt.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END \$\$;

-- Next, util schema tables
DO \$\$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'util')
    LOOP
        EXECUTE 'TRUNCATE TABLE util.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END \$\$;

-- Finally, public schema tables (specific order for foreign key dependencies)
TRUNCATE TABLE public.content_representations CASCADE;
TRUNCATE TABLE public.content_chunks CASCADE;
TRUNCATE TABLE public.embedding_metrics CASCADE;
TRUNCATE TABLE public.embedding_metrics_summary CASCADE;
TRUNCATE TABLE public.search_feedback CASCADE;
TRUNCATE TABLE public.embedding_cache CASCADE;
TRUNCATE TABLE public.reddit_comments CASCADE;
TRUNCATE TABLE public.reddit_posts CASCADE;
TRUNCATE TABLE public.reddit_users CASCADE;

-- Then other public tables that might exist
DO \$\$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename NOT IN (
            'content_representations', 'content_chunks', 'embedding_metrics', 
            'embedding_metrics_summary', 'search_feedback', 'embedding_cache',
            'reddit_comments', 'reddit_posts', 'reddit_users'
        )
    )
    LOOP
        BEGIN
            EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' CASCADE';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not truncate table %: %', r.tablename, SQLERRM;
        END;
    END LOOP;
END \$\$;

-- Re-enable triggers
SET session_replication_role = 'origin';

-- Commit the transaction
COMMIT;
"

# Check if the command was successful
if [ $? -eq 0 ]; then
  echo "Database forcefully cleaned successfully."
  
  # Verify tables are empty
  echo "Verifying tables are empty..."
  PGPASSWORD="$DB_PASSWORD" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -d "$DB_NAME" \
    -U "$DB_USER" \
    -c "
  SELECT 
    schemaname || '.' || tablename as table_name,
    (SELECT count(*) FROM ONLY pg_catalog.pg_namespace n JOIN pg_catalog.pg_class c ON n.oid = c.relnamespace 
     WHERE n.nspname = pg_tables.schemaname AND c.relname = pg_tables.tablename) as row_count
  FROM pg_tables 
  WHERE 
    schemaname IN ('public', 'util', 'search_opt')
  ORDER BY 
    schemaname, 
    tablename;"
else
  echo "Error: Failed to clean database."
  exit 1
fi

echo "Done." 