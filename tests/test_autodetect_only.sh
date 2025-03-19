#!/bin/bash

# Script to test the multi-strategy search with a workspace query - only using autodetected intent

echo "======================================================"
echo "🧪 TESTING WORKSPACE QUERY WITH AUTO-DETECTED INTENT ONLY"
echo "======================================================"

# Set variables
DB_URL="postgresql://postgres.ghjbtvyalvigvmuodaas:ch%40924880194792@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"
SUPABASE_URL="https://ghjbtvyalvigvmuodaas.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoamJ0dnlhbHZpZ3ZtdW9kYWFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTY4NzY3NzYsImV4cCI6MjAxMjQ1Mjc3Nn0.qmZ_hCbPS0aRt-1YtH9A_6Zt1GvGm_kfGVwczXRCXSQ"
OUTPUT_FILE="autodetect_results.txt"
QUERY="where can i sit and work in sf?"
THRESHOLD="0.1" # Similarity threshold

# Clear previous results
> "$OUTPUT_FILE"

echo "Query: \"$QUERY\""
echo

# Step 1: Analyze query for intent using our enhanced system
echo "🔍 Step 1: Analyzing query for intent..."
curl -s -X POST "$SUPABASE_URL/functions/v1/query-analysis" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoamJ0dnlhbHZpZ3ZtdW9kYWFzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDc0NDEwNiwiZXhwIjoyMDU2MzIwMTA2fQ.wn5hTplkrRS4YaFNJX2enXcxxlwX_Z52BbcSU1R2W5E" \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"$QUERY\"}" > autodetect_analysis.json

# Extract intent, topics, and locations
INTENT=$(jq -r '.intent' autodetect_analysis.json)
TOPICS=$(jq -r '.topics[]' autodetect_analysis.json 2>/dev/null || echo "")
LOCATIONS=$(jq -r '.locations[]' autodetect_analysis.json 2>/dev/null || echo "")

# Format topics and locations for SQL
if [ -z "$TOPICS" ]; then
  TOPICS_SQL="ARRAY[]::text[]"
else
  # Create properly formatted SQL array with single quotes
  TOPICS_SQL="ARRAY["
  first=true
  while IFS= read -r topic; do
    if [ "$first" = true ]; then
      first=false
    else
      TOPICS_SQL+=", "
    fi
    # Escape single quotes in the topic
    escaped_topic=$(echo "$topic" | sed "s/'/''/g")
    TOPICS_SQL+="'$escaped_topic'"
  done <<< "$TOPICS"
  TOPICS_SQL+="]::text[]"
fi

if [ -z "$LOCATIONS" ]; then
  LOCATIONS_SQL="ARRAY[]::text[]"
else
  # Create properly formatted SQL array with single quotes
  LOCATIONS_SQL="ARRAY["
  first=true
  while IFS= read -r location; do
    if [ "$first" = true ]; then
      first=false
    else
      LOCATIONS_SQL+=", "
    fi
    # Escape single quotes in the location
    escaped_location=$(echo "$location" | sed "s/'/''/g")
    LOCATIONS_SQL+="'$escaped_location'"
  done <<< "$LOCATIONS"
  LOCATIONS_SQL+="]::text[]"
fi

echo "Raw analysis JSON:"
cat autodetect_analysis.json
echo
echo "Detected intent: $INTENT"
echo "Topics: $TOPICS"
echo "Locations: $LOCATIONS"
echo

# Step 2: Generate embedding for the query
echo "🔄 Step 2: Generating embedding for the query..."
curl -s -X POST "$SUPABASE_URL/functions/v1/query-embeddings" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"$QUERY\"}" > autodetect_embedding.json

# Extract embedding
EMBEDDING=$(jq -r '.embedding' autodetect_embedding.json)
EMBEDDING_TRUNCATED=$(echo $EMBEDDING | cut -c 1-100)
echo "Embedding generated (truncated for display)..."
echo "$EMBEDDING_TRUNCATED..."
echo

# Step 3: Test search with detected intent
echo "🔍 Step 3: Testing search with detected intent: $INTENT..."
cat > /tmp/test_autodetected_intent.sql << EOF
SELECT id, title, content_snippet, similarity, match_type
FROM public.multi_strategy_search(
  '$QUERY',
  '$EMBEDDING'::vector,
  '$INTENT',
  $TOPICS_SQL,
  $LOCATIONS_SQL,
  10,
  $THRESHOLD::float
);
EOF

psql "$DB_URL" -f /tmp/test_autodetected_intent.sql > /tmp/autodetected_intent_results.txt

# Add results to output file
echo -e "\n=== RESULTS WITH AUTO-DETECTED INTENT: $INTENT ===" >> "$OUTPUT_FILE"
cat /tmp/autodetected_intent_results.txt >> "$OUTPUT_FILE"

# Count results
RESULT_COUNT=$(grep -v "^-" /tmp/autodetected_intent_results.txt | grep -v "rows)" | grep "|" | wc -l)
if [ "$RESULT_COUNT" -gt 2 ]; then
  RESULT_COUNT=$((RESULT_COUNT - 2))
elif [ "$RESULT_COUNT" -le 0 ]; then
  RESULT_COUNT=0
fi

# Print summary
echo -e "\n📋 Summary:"
echo "Query intent detected as: $INTENT"
echo "Number of results: $RESULT_COUNT"
echo "Full results saved to: $OUTPUT_FILE"
echo
echo "======================================================"
echo "✨ TESTING COMPLETE"
echo "======================================================" 