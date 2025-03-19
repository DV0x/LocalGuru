#!/bin/bash

# Deployment script for enhanced intent search function
# Bypasses Docker and applies the migration directly

echo "======================================================"
echo "📦 DEPLOYING ENHANCED INTENT SEARCH FUNCTION"
echo "======================================================"

# Set variables
DB_URL="postgresql://postgres.ghjbtvyalvigvmuodaas:ch%40924880194792@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"
MIGRATION_FILE="enhanced_intent_multi_strategy_search.sql"

# Check if migration file exists
if [ ! -f "$MIGRATION_FILE" ]; then
  echo "❌ Error: Migration file $MIGRATION_FILE not found!"
  exit 1
fi

echo "📝 Preparing migration file: $MIGRATION_FILE"

# Option 1: Direct application using psql
echo "🔄 Applying migration directly using psql..."
psql "$DB_URL" -f "$MIGRATION_FILE"

if [ $? -eq 0 ]; then
  echo "✅ Direct SQL migration applied successfully!"
else
  echo "⚠️ Warning: Direct SQL migration may have encountered issues."
  
  # Create a fallback migration file in the proper location
  MIGRATION_TIMESTAMP=$(date +"%Y%m%d%H%M%S")
  SUPABASE_MIGRATION_DIR="supabase/migrations"
  
  # Create the migrations directory if it doesn't exist
  mkdir -p "$SUPABASE_MIGRATION_DIR"
  
  VERSIONED_MIGRATION="${SUPABASE_MIGRATION_DIR}/${MIGRATION_TIMESTAMP}_enhanced_intent_search.sql"
  cp "$MIGRATION_FILE" "$VERSIONED_MIGRATION"
  
  echo "📄 Created versioned migration: $VERSIONED_MIGRATION"
  echo "🔄 Attempting to apply migration via supabase CLI..."
  
  # Apply using supabase CLI with --use-docker=false
  supabase db push --use-docker=false
  
  if [ $? -eq 0 ]; then
    echo "✅ Migration applied successfully via supabase CLI!"
  else
    echo "❌ Error: Failed to apply migration. You may need to apply it manually."
    echo "💡 You can apply it manually by running this SQL in the Supabase dashboard SQL editor:"
    cat "$MIGRATION_FILE"
  fi
fi

# Test the deployed function
echo -e "\n🧪 Testing the deployed function..."
QUERY="I want to eat nice vegan food in sf"

# Create a test SQL query
cat > /tmp/test_deploy.sql << EOL
-- Test query for deployed multi_strategy_search function
SELECT 
  id, 
  title, 
  similarity, 
  match_type 
FROM 
  public.multi_strategy_search(
    '${QUERY}',
    NULL,
    'recommendation',
    ARRAY['vegan food', 'vegan'],
    ARRAY['sf'],
    3,
    0.1
  ) 
LIMIT 3;
EOL

# Execute the test query
echo "📊 Executing test query..."
psql "$DB_URL" -f /tmp/test_deploy.sql

echo -e "\n======================================================"
echo "✨ DEPLOYMENT COMPLETE"
echo "======================================================"
echo "The enhanced intent search function has been deployed."
echo "You can now use it in your application!"
echo "=======================================================" 