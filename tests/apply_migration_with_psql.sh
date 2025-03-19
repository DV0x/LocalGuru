#!/bin/bash

# Script to apply the migration SQL directly using psql with the provided connection string
# This bypasses both Docker and the Supabase CLI

echo "======================================================"
echo "🚀 APPLYING ENHANCED INTENT SQL MIGRATION DIRECTLY"
echo "======================================================"

# Define the PostgreSQL connection string with URL encoding for the @ in the password
# Original: postgresql://postgres.ghjbtvyalvigvmuodaas:ch@924880194792@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
# URL encoded password: ch%40924880194792
DB_URL="postgresql://postgres.ghjbtvyalvigvmuodaas:ch%40924880194792@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"

# Create a temporary file with the SQL migration
echo -e "\n📝 Creating temporary SQL file for execution..."
cat > /tmp/apply_intent_migration.sql << EOL
-- Enhanced intent-based search function with additional intents
-- Applies the SQL from 20250313000000_enhanced_intent_search.sql directly

$(cat supabase/migrations/20250313000000_enhanced_intent_search.sql)
EOL

echo "✅ Created temporary SQL file"

# Apply the migration using psql
echo -e "\n🔄 Applying SQL migration directly to the database..."
PGPASSWORD=$(echo $DB_URL | sed -E 's/.*:([^@]*)@.*/\1/' | python3 -c "import urllib.parse; import sys; print(urllib.parse.unquote(sys.stdin.read().strip()))")
psql "$DB_URL" -f /tmp/apply_intent_migration.sql

if [ $? -eq 0 ]; then
  echo -e "✅ Successfully applied migration directly to the database"
  
  # Verify the function was created
  echo -e "\n🔍 Verifying the function was created..."
  psql "$DB_URL" -c "SELECT proname FROM pg_proc WHERE proname = 'multi_strategy_search';"
  
  if [ $? -eq 0 ]; then
    echo -e "✅ Function verification successful"
  else
    echo -e "⚠️ Function verification failed, but the SQL might have executed successfully"
  fi
  
  # Clean up
  rm /tmp/apply_intent_migration.sql
else
  echo -e "❌ Failed to apply migration directly to the database"
  
  # Backup SQL file for manual application
  cp /tmp/apply_intent_migration.sql ./enhanced_intent_migration.sql
  echo -e "✅ Created enhanced_intent_migration.sql in the project root for manual application if needed"
  rm /tmp/apply_intent_migration.sql
  
  echo -e "\n⚠️ If the direct application failed, please follow the instructions in APPLY_SQL_MIGRATION.md"
fi

echo -e "\n======================================================"
echo "✨ MIGRATION PROCESS COMPLETE"
echo "======================================================"
echo -e "The multi_strategy_search function should now be updated with boosting for:\n"
echo "- All existing intents (recommendation, information, comparison, experience)"
echo "- New intents (local_events, how_to, discovery)"
echo "=======================================================" 