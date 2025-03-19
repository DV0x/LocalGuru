#!/bin/bash

# All Methods Clean Script
# This script tries multiple methods to clean the database

# Connection details
DB_HOST="aws-0-ap-southeast-1.pooler.supabase.com"
DB_PORT="5432"
DB_NAME="postgres"
DB_USER="postgres.ghjbtvyalvigvmuodaas"
DB_PASSWORD="ch@924880194792"
SUPABASE_REF="ghjbtvyalvigvmuodaas"

echo "WARNING: This script will delete ALL data from the database."
echo "This action cannot be undone."
echo ""
read -p "Are you sure you want to continue? (y/N): " confirm

if [[ $confirm != "y" && $confirm != "Y" ]]; then
  echo "Operation cancelled."
  exit 0
fi

echo "Trying to clean database using multiple methods..."

# SQL to execute
SQL_QUERY="
-- Start a transaction
BEGIN;

-- Disable triggers temporarily
SET session_replication_role = 'replica';

-- Truncate tables in proper order with CASCADE option
TRUNCATE TABLE util.embedding_queue CASCADE;
TRUNCATE TABLE search_opt.query_analysis CASCADE;
TRUNCATE TABLE public.content_representations CASCADE;
TRUNCATE TABLE public.content_chunks CASCADE;
TRUNCATE TABLE public.embedding_metrics CASCADE;
TRUNCATE TABLE public.embedding_cache CASCADE;
TRUNCATE TABLE public.search_feedback CASCADE;
TRUNCATE TABLE public.reddit_comments CASCADE;
TRUNCATE TABLE public.reddit_posts CASCADE;
TRUNCATE TABLE public.reddit_users CASCADE;

-- Re-enable triggers
SET session_replication_role = 'origin';

-- Commit the transaction
COMMIT;
"

# Method 1: Using PSQL directly
echo "Method 1: Trying psql direct connection..."
echo "$SQL_QUERY" > /tmp/clean_db.sql
PGPASSWORD="$DB_PASSWORD" psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -d "$DB_NAME" \
  -U "$DB_USER" \
  -f /tmp/clean_db.sql

if [ $? -eq 0 ]; then
  echo "Success using psql direct connection!"
else
  echo "Failed using psql direct connection."
  
  # Method 2: Try using supabase CLI if installed
  if command -v supabase &> /dev/null; then
    echo "Method 2: Trying Supabase CLI..."
    
    # Try to link project if not already linked
    supabase link --project-ref "$SUPABASE_REF" || true
    
    # Execute SQL
    echo "$SQL_QUERY" > /tmp/clean_db.sql
    supabase db execute --file /tmp/clean_db.sql
    
    if [ $? -eq 0 ]; then
      echo "Success using Supabase CLI!"
    else
      echo "Failed using Supabase CLI."
      
      # Method 3: Try individual table drops with explicit error handling
      echo "Method 3: Trying individual table truncates with error handling..."
      
      function try_truncate {
        local table=$1
        echo "  Truncating $table..."
        PGPASSWORD="$DB_PASSWORD" psql \
          -h "$DB_HOST" \
          -p "$DB_PORT" \
          -d "$DB_NAME" \
          -U "$DB_USER" \
          -c "TRUNCATE TABLE $table CASCADE;" || echo "  Failed to truncate $table"
      }
      
      try_truncate "util.embedding_queue"
      try_truncate "search_opt.query_analysis"
      try_truncate "public.content_representations"
      try_truncate "public.content_chunks"
      try_truncate "public.embedding_metrics"
      try_truncate "public.embedding_cache"
      try_truncate "public.search_feedback"
      try_truncate "public.reddit_comments"
      try_truncate "public.reddit_posts"
      try_truncate "public.reddit_users"
    fi
  else
    echo "Supabase CLI not installed. Skipping Method 2."
    
    # Method 3: Try individual table drops with explicit error handling
    echo "Method 3: Trying individual table truncates with error handling..."
    
    function try_truncate {
      local table=$1
      echo "  Truncating $table..."
      PGPASSWORD="$DB_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -d "$DB_NAME" \
        -U "$DB_USER" \
        -c "TRUNCATE TABLE $table CASCADE;" || echo "  Failed to truncate $table"
    }
    
    try_truncate "util.embedding_queue"
    try_truncate "search_opt.query_analysis"
    try_truncate "public.content_representations"
    try_truncate "public.content_chunks"
    try_truncate "public.embedding_metrics"
    try_truncate "public.embedding_cache"
    try_truncate "public.search_feedback"
    try_truncate "public.reddit_comments"
    try_truncate "public.reddit_posts"
    try_truncate "public.reddit_users"
  fi
fi

# Cleanup
rm -f /tmp/clean_db.sql

# Verify if tables are now empty
echo "Verifying if tables are empty..."
PGPASSWORD="$DB_PASSWORD" psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -d "$DB_NAME" \
  -U "$DB_USER" \
  -c "
SELECT 
  'reddit_users' as table_name, COUNT(*) as row_count FROM public.reddit_users
UNION ALL
SELECT 
  'reddit_posts' as table_name, COUNT(*) as row_count FROM public.reddit_posts
UNION ALL
SELECT 
  'reddit_comments' as table_name, COUNT(*) as row_count FROM public.reddit_comments
UNION ALL
SELECT 
  'content_representations' as table_name, COUNT(*) as row_count FROM public.content_representations
UNION ALL
SELECT 
  'content_chunks' as table_name, COUNT(*) as row_count FROM public.content_chunks
UNION ALL
SELECT 
  'embedding_queue' as table_name, COUNT(*) as row_count FROM util.embedding_queue
UNION ALL
SELECT 
  'query_analysis' as table_name, COUNT(*) as row_count FROM search_opt.query_analysis;
"

echo "Done." 