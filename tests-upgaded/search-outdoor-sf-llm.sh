#!/bin/bash

# Color codes for better output visibility
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 SEARCHING FOR OUTDOOR ACTIVITIES IN SF WITH FULL RESULTS 🔍${NC}"

# Supabase credentials
SUPABASE_URL="https://ghjbtvyalvigvmuodaas.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoamJ0dnlhbHZpZ3ZtdW9kYWFzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDc0NDEwNiwiZXhwIjoyMDU2MzIwMTA2fQ.wn5hTplkrRS4YaFNJX2enXcxxlwX_Z52BbcSU1R2W5E"

# Output file
OUTPUT_FILE="outdoor-sf-results.json"

# Query parameters
QUERY="Outdoor activities in sf other than bars"

echo -e "${YELLOW}Query: ${NC}$QUERY"

# Get embeddings
echo -e "\n${BLUE}Getting embeddings for: $QUERY${NC}"
EMBEDDINGS=$(curl -s -X POST "$SUPABASE_URL/functions/v1/query-embeddings" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"$QUERY\"}" | grep -o '"embedding":\[[^]]*\]' | sed 's/"embedding"://')

if [ -z "$EMBEDDINGS" ]; then
  echo "Failed to get embeddings. Exiting."
  exit 1
fi

echo -e "${GREEN}Successfully generated embeddings${NC}"

# Perform search
echo -e "\n${BLUE}Searching for results...${NC}"
RESULTS=$(curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/multi_strategy_search" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"p_query\": \"$QUERY\",
    \"p_query_embedding\": $EMBEDDINGS,
    \"p_query_intent\": \"recommendation\",
    \"p_query_topics\": [\"outdoor activities\", \"recreation\", \"parks\", \"hiking\"],
    \"p_query_locations\": [\"san francisco\", \"sf\"],
    \"p_max_results\": 30,
    \"p_match_threshold\": 0.3
  }")

# Check if we got results or an error
if [[ "$RESULTS" == *"error"* ]]; then
  echo "Error performing search: $RESULTS"
  exit 1
fi

# Transform the results into more LLM-friendly format
echo -e "\n${BLUE}Processing results for LLM consumption...${NC}"

# Create a transformed JSON object
cat > "$OUTPUT_FILE" << EOL
{
  "query": "$QUERY",
  "search_parameters": {
    "intent": "recommendation",
    "topics": ["outdoor activities", "recreation", "parks", "hiking"],
    "locations": ["san francisco", "sf"]
  },
  "results": $RESULTS
}
EOL

# Count the number of results
RESULT_COUNT=$(echo "$RESULTS" | grep -o -i "\"id\"" | wc -l)
echo -e "${GREEN}Search completed. Found $RESULT_COUNT results.${NC}"
echo -e "${GREEN}Full results saved to $OUTPUT_FILE in LLM-friendly format${NC}"
echo -e "${YELLOW}The file contains complete content that is not truncated${NC}"

# Display a summary in the terminal
echo -e "\n${BLUE}=== SEARCH RESULTS SUMMARY ===${NC}\n"

# Format the JSON for easier processing
FORMATTED_RESULTS=$(echo "$RESULTS" | sed 's/\[{/{/g; s/},{/}\n{/g; s/}]/}/g')

COUNT=0
echo "$FORMATTED_RESULTS" | while read -r line; do
  COUNT=$((COUNT + 1))
  
  # Extract fields (basic version)
  TITLE=$(echo "$line" | grep -o '"title":"[^"]*"' | head -1 | sed 's/"title":"//;s/"//')
  SUBREDDIT=$(echo "$line" | grep -o '"subreddit":"[^"]*"' | head -1 | sed 's/"subreddit":"//;s/"//')
  MATCH_TYPE=$(echo "$line" | grep -o '"match_type":"[^"]*"' | head -1 | sed 's/"match_type":"//;s/"//')
  SCORE=$(echo "$line" | grep -o '"similarity":[0-9.]*' | head -1 | sed 's/"similarity"://')
  
  # Display result summary
  echo -e "${YELLOW}Result #$COUNT: r/$SUBREDDIT - $TITLE${NC}"
  echo -e "Match score: $SCORE | Type: $MATCH_TYPE"
  echo -e "---------------------------------------------------"
  
  # Only show first 10 in summary
  if [ $COUNT -eq 10 ]; then
    break
  fi
done

echo -e "\n${GREEN}To view full results, check the file: $OUTPUT_FILE${NC}"
echo -e "${YELLOW}Use this file to pass to an LLM for summarization${NC}" 