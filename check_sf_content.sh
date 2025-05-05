#!/bin/bash

# Script to directly check for San Francisco content in the database
echo "Checking for San Francisco content in the database..."

# Database connection with URL-encoded password
DB_URL="postgresql://postgres.ghjbtvyalvigvmuodaas:ch%40924880194792@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"

# Create a simple SQL query
SQL_FILE="check_sf_content.sql"

cat > "$SQL_FILE" << EOF
-- First check: Count posts mentioning San Francisco or SF
SELECT COUNT(*) AS sf_post_count
FROM reddit.posts
WHERE 
  title ILIKE '%San Francisco%' OR 
  title ILIKE '%SF%' OR
  selftext ILIKE '%San Francisco%' OR
  selftext ILIKE '%SF%';

-- Second check: Get a sample of posts
SELECT 
  id,
  subreddit,
  title,
  SUBSTRING(selftext, 1, 100) AS excerpt,
  created_utc
FROM reddit.posts
WHERE 
  title ILIKE '%San Francisco%' OR 
  title ILIKE '%SF%' OR
  selftext ILIKE '%San Francisco%' OR
  selftext ILIKE '%SF%'
ORDER BY created_utc DESC
LIMIT 5;

-- Third check: Check if search_opt.multi_strategy_search function exists
SELECT 
  routine_name 
FROM information_schema.routines 
WHERE 
  routine_type = 'FUNCTION' AND 
  routine_schema = 'search_opt' AND
  routine_name = 'multi_strategy_search';

-- Fourth check: See if there are any posts with location boost for San Francisco
WITH query_embedding AS (
  SELECT '[0,0,0]'::vector AS embedding
)
SELECT 
  COUNT(*) AS boosted_posts_count
FROM search_opt.multi_strategy_search(
  query_embedding => (SELECT embedding FROM query_embedding),
  intent => 'recommendation',
  topics => ARRAY['travel'],
  locations => ARRAY['San Francisco'],
  query => 'San Francisco',
  limit_param => 10
) p
WHERE p.location_boost > 0;
EOF

# Execute the query and capture output
echo "Running database checks..."
OUTPUT=$(psql "$DB_URL" -f "$SQL_FILE" 2>&1)
PSQL_EXIT_CODE=$?

# Display results
if [ $PSQL_EXIT_CODE -ne 0 ]; then
  echo "Database connection error:"
  echo "$OUTPUT"
else
  echo "Database check results:"
  echo "$OUTPUT"
fi

# Clean up
rm -f "$SQL_FILE"
echo "Check completed!" 