#!/bin/bash

# Verification script for enhanced intent search function
# Tests the deployed function with a proper embedding vector

echo "======================================================"
echo "🧪 VERIFYING ENHANCED INTENT SEARCH FUNCTION"
echo "======================================================"

# Set variables
SUPABASE_URL="https://ghjbtvyalvigvmuodaas.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJiZGtvZXZpdmZqbWp1aXBmdHNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTAxNzY5MzAsImV4cCI6MjAyNTc1MjkzMH0.q5GKVODDsUe-9uXhMfvYwB6TmWvdYc1l8O6i_STwAkA"
DB_URL="postgresql://postgres.ghjbtvyalvigvmuodaas:ch%40924880194792@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"
OUTPUT_FILE="deployment_verification.txt"

# Clear any existing output file
> $OUTPUT_FILE

# Simpler approach with arrays of intents and queries
INTENTS=("recommendation" "information" "comparison" "experience" "local_events" "how_to" "discovery")
QUERIES=(
  "I want to eat nice vegan food in sf"
  "What is the weather like in Seattle today?"
  "iPhone vs Samsung Galaxy, which is better?"
  "What was your experience visiting the Grand Canyon?"
  "Are there any concerts in Boston this weekend?"
  "How to make vegan chocolate chip cookies?"
  "Interesting hidden gems in Portland"
)

echo "🔍 Testing each intent type with appropriate queries..."

# Test each intent with its corresponding query
for i in "${!INTENTS[@]}"; do
  intent="${INTENTS[$i]}"
  query="${QUERIES[$i]}"
  
  echo -e "\n📊 Testing intent: \033[33m${intent}\033[0m"
  echo -e "Query: \"${query}\""
  
  # First get the embedding
  echo "Generating embedding..."
  EMBEDDING_ENDPOINT="${SUPABASE_URL}/functions/v1/query-embeddings"
  EMBEDDING_RESULT=$(curl -s -X POST \
    "${EMBEDDING_ENDPOINT}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"query\": \"${query}\"}")
  
  # Extract embedding
  EMBEDDING=$(echo $EMBEDDING_RESULT | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin).get('embedding', [])))" 2>/dev/null || echo "[]")
  
  # Create a test SQL query
  cat > /tmp/test_${intent}.sql << EOL
-- Test query for ${intent} intent
WITH 
query_embedding AS (
  SELECT 
    '${EMBEDDING}'::vector(1536) AS embedding
)
SELECT 
  id, 
  title, 
  similarity, 
  match_type 
FROM 
  public.multi_strategy_search(
    '${query}',
    (SELECT embedding FROM query_embedding),
    '${intent}',
    ARRAY[]::text[],
    ARRAY[]::text[],
    3,
    0.1
  ) 
LIMIT 3;
EOL

  # Execute the test query
  echo "Running test..."
  echo -e "\n=== RESULTS FOR INTENT: ${intent} ===" >> $OUTPUT_FILE
  echo -e "Query: \"${query}\"" >> $OUTPUT_FILE
  psql "$DB_URL" -f /tmp/test_${intent}.sql >> $OUTPUT_FILE
  
  # Check if we got any results
  if grep -q "rows)" $OUTPUT_FILE; then
    echo -e "✅ Found results for ${intent} intent. See ${OUTPUT_FILE} for details."
  else
    echo -e "❓ No results found for ${intent} intent. Check ${OUTPUT_FILE} for details."
  fi
done

echo -e "\n======================================================"
echo "✨ VERIFICATION COMPLETE"
echo "======================================================"
echo "All intent types have been tested against the deployed function."
echo "Results are saved in ${OUTPUT_FILE}"
echo "======================================================="

# Display a summary of the verification
echo -e "\n📝 Summary of test results:"
echo -e "========================="
for intent in "${INTENTS[@]}"; do
  if grep -A 20 "=== RESULTS FOR INTENT: ${intent} ===" $OUTPUT_FILE | grep -q "(.*row"; then
    RESULT_COUNT=$(grep -A 20 "=== RESULTS FOR INTENT: ${intent} ===" $OUTPUT_FILE | grep -o "([0-9]* row" | grep -o "[0-9]*")
    echo -e "✅ ${intent}: ${RESULT_COUNT} results found"
  else
    echo -e "❌ ${intent}: No results"
  fi
done

# Show the complete output file
echo -e "\n📋 Complete verification results:"
echo -e "==============================="
cat $OUTPUT_FILE 