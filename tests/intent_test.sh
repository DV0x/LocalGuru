#!/bin/bash

# Test script for enhanced intent types (fixed version)
# Tests the query-analysis function with various query types designed to trigger different intents

# Set variables
SUPABASE_URL="https://ghjbtvyalvigvmuodaas.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJiZGtvZXZpdmZqbWp1aXBmdHNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTAxNzY5MzAsImV4cCI6MjAyNTc1MjkzMH0.q5GKVODDsUe-9uXhMfvYwB6TmWvdYc1l8O6i_STwAkA"

QUERY_ANALYSIS_ENDPOINT="${SUPABASE_URL}/functions/v1/query-analysis"

# Function to analyze query and detect intent
analyze_query() {
  QUERY="$1"
  EXPECTED_INTENT="$2"
  
  echo -e "\033[1m\nTesting query:\033[0m \"$QUERY\""
  echo -e "Expected intent: \033[33m$EXPECTED_INTENT\033[0m"
  
  # Call query-analysis function
  RESPONSE=$(curl -s -X POST \
    "${QUERY_ANALYSIS_ENDPOINT}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"query\": \"$QUERY\"}")
  
  # Extract the intent from the response
  INTENT=$(echo $RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('intent', ''))" 2>/dev/null || echo "")
  
  if [ "$INTENT" == "$EXPECTED_INTENT" ]; then
    echo -e "✅ Detected intent: \033[32m$INTENT\033[0m (Correct)"
  else
    echo -e "❌ Detected intent: \033[31m$INTENT\033[0m (Expected: $EXPECTED_INTENT)"
  fi
  
  # Show topics (only if python is available)
  TOPICS=$(echo $RESPONSE | python3 -c "import sys, json; print(', '.join(json.load(sys.stdin).get('topics', [])))" 2>/dev/null || echo "")
  echo -e "📌 Topics: \033[36m$TOPICS\033[0m"
  
  # Show locations (only if python is available)
  LOCATIONS=$(echo $RESPONSE | python3 -c "import sys, json; print(', '.join(json.load(sys.stdin).get('locations', [])))" 2>/dev/null || echo "")
  if [ -n "$LOCATIONS" ]; then
    echo -e "📍 Locations: \033[36m$LOCATIONS\033[0m"
  fi
  
  echo "---------------------------------------------------------"
}

echo "==================================================="
echo "🧪 TESTING ENHANCED INTENT RECOGNITION"
echo "==================================================="

# Test standard intent types
analyze_query "What are the best restaurants in Chicago?" "recommendation"
analyze_query "What is the weather like in Seattle today?" "information"
analyze_query "iPhone vs Samsung Galaxy, which is better?" "comparison"
analyze_query "What was your experience visiting the Grand Canyon?" "experience"

# Test new intent types
analyze_query "Are there any concerts in Boston this weekend?" "local_events"
analyze_query "How to make vegan chocolate chip cookies?" "how_to"
analyze_query "Interesting hidden gems in Portland" "discovery"

echo "==================================================="
echo "✨ TEST COMPLETED"
echo "===================================================" 