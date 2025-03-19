#!/bin/bash

# Script to check database schema and function definition
echo "Checking database schema and function definition..."

# Database connection with URL-encoded password
DB_URL="postgresql://postgres.ghjbtvyalvigvmuodaas:ch%40924880194792@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"

# Create a SQL query to check schema
SQL_FILE="check_db_schema.sql"

cat > "$SQL_FILE" << EOF
-- Check available schemas
SELECT schema_name 
FROM information_schema.schemata
ORDER BY schema_name;

-- Check tables in public schema
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check tables in search_opt schema
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'search_opt'
ORDER BY table_name;

-- Check function definition for multi_strategy_search
SELECT 
  routine_name,
  parameter_name,
  data_type,
  parameter_default
FROM information_schema.parameters
WHERE specific_schema = 'search_opt'
AND specific_name LIKE 'multi_strategy_search%'
ORDER BY ordinal_position;

-- Check for any content table that might contain posts
SELECT 
  table_schema, 
  table_name 
FROM information_schema.tables 
WHERE table_name LIKE '%post%' OR table_name LIKE '%content%'
ORDER BY table_schema, table_name;
EOF

# Execute the query and capture output
echo "Running database schema checks..."
OUTPUT=$(psql "$DB_URL" -f "$SQL_FILE" 2>&1)
PSQL_EXIT_CODE=$?

# Display results
if [ $PSQL_EXIT_CODE -ne 0 ]; then
  echo "Database connection error:"
  echo "$OUTPUT"
else
  echo "Database schema check results:"
  echo "$OUTPUT"
fi

# Clean up
rm -f "$SQL_FILE"
echo "Schema check completed!" 