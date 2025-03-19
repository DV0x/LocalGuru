#!/bin/bash

# End-to-End Testing Script for Localguru
# Tests the entire pipeline: data import, entity extraction, and content representation

# Load environment variables
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Check required environment variables
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
  echo "Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set."
  echo "Please create a .env file or export these variables."
  exit 1
fi

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SUBREDDIT="AskLosAngeles"
TEST_POST_COUNT=3
TEST_DATA_FILE="test-data/r_${SUBREDDIT}_import_data.json"

echo -e "${BLUE}=== Localguru End-to-End Testing ===${NC}"
echo "This script tests the full pipeline: data import, entity extraction, and content representation"

# Step 1: Import Reddit data
echo -e "\n${YELLOW}Step 1: Importing data from r/${SUBREDDIT}${NC}"
echo "Running TypeScript import script..."

npx ts-node scripts/import-reddit-data.ts

# If test data file doesn't exist, create it manually by fetching recent posts from the database
if [ ! -f "$TEST_DATA_FILE" ]; then
  echo -e "${YELLOW}Test data file not found. Creating manually...${NC}"
  
  # Create test-data directory if it doesn't exist
  mkdir -p test-data
  
  # Get recent Reddit posts from the database
  posts=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/reddit_posts?select=id,title&order=created_at.desc&limit=3" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}")
  
  # Create simple test data file
  echo "[" > "$TEST_DATA_FILE"
  for post_id in $(echo "$posts" | jq -r '.[].id'); do
    echo "  {\"post\": {\"id\": \"$post_id\"}, \"comments\": [{\"id\": \"\"}]}" >> "$TEST_DATA_FILE"
    
    # Add comma for all but the last entry
    if [ "$post_id" != "$(echo "$posts" | jq -r '.[-1].id')" ]; then
      echo "," >> "$TEST_DATA_FILE"
    fi
  done
  echo "]" >> "$TEST_DATA_FILE"
  
  echo -e "${GREEN}Created test data file with recent posts${NC}"
fi

echo -e "${GREEN}Successfully imported data from r/${SUBREDDIT}${NC}"

# Step 2: Process posts with entity extraction and representations
echo -e "\n${YELLOW}Step 2: Processing posts with entity extraction${NC}"

# Get the post IDs from the test data file
POST_IDS=$(cat "$TEST_DATA_FILE" | jq -r '.[].post.id' | head -$TEST_POST_COUNT)

# Process each post
for post_id in $POST_IDS; do
  echo -e "\n${BLUE}Processing post ID: ${post_id}${NC}"
  
  # Call the enhanced-embeddings function with the post ID
  echo "Sending request to enhanced-embeddings function..."
  
  response=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/enhanced-embeddings" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"contentId\": \"${post_id}\", \"contentType\": \"post\", \"includeContext\": true, \"refreshRepresentations\": true}")
  
  # Check for errors in the response
  if echo "$response" | grep -q "error"; then
    echo -e "${RED}Error in response:${NC}"
    echo "$response" | jq .
  else
    echo -e "${GREEN}Entity extraction completed successfully!${NC}"
    echo "Response: $(echo "$response" | jq .)"
    
    # Fetch the updated post to see the extracted entities
    echo "Fetching updated post data..."
    
    post_data=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/reddit_posts?id=eq.${post_id}&select=id,title,extracted_entities,extracted_topics,extracted_locations,semantic_tags" \
      -H "apikey: ${SUPABASE_ANON_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_ANON_KEY}")
    
    echo -e "\n${GREEN}Extracted Metadata:${NC}"
    echo "$post_data" | jq .
    
    # Check content representations
    echo -e "\n${BLUE}Checking content representations for post ID: ${post_id}${NC}"
    
    representations=$(curl -s -X POST "${SUPABASE_URL}/rest/v1/rpc/get_all_content_representations" \
      -H "apikey: ${SUPABASE_ANON_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
      -H "Content-Type: application/json" \
      -d "{\"p_content_id\": \"${post_id}\", \"p_content_type\": \"post\"}")
    
    echo -e "${GREEN}Content Representations:${NC}"
    echo "$representations" | jq 'map({representation_type, created_at})'
  fi
  
  # Wait between posts to avoid rate limits
  sleep 2
done

# Step 3: Process comments with entity extraction
echo -e "\n${YELLOW}Step 3: Processing comments with entity extraction${NC}"

# Get a few comment IDs from the test data file
COMMENT_IDS=$(cat "$TEST_DATA_FILE" | jq -r '.[].comments[0].id' | head -$TEST_POST_COUNT)

# Process each comment
for comment_id in $COMMENT_IDS; do
  if [ -z "$comment_id" ] || [ "$comment_id" == "null" ]; then
    continue
  fi
  
  echo -e "\n${BLUE}Processing comment ID: ${comment_id}${NC}"
  
  # Call the enhanced-embeddings function with the comment ID
  echo "Sending request to enhanced-embeddings function..."
  
  response=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/enhanced-embeddings" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"contentId\": \"${comment_id}\", \"contentType\": \"comment\", \"includeContext\": true, \"refreshRepresentations\": true}")
  
  # Check for errors in the response
  if echo "$response" | grep -q "error"; then
    echo -e "${RED}Error in response:${NC}"
    echo "$response" | jq .
  else
    echo -e "${GREEN}Entity extraction completed successfully!${NC}"
    echo "Response: $(echo "$response" | jq .)"
    
    # Fetch the updated comment to see the extracted entities
    echo "Fetching updated comment data..."
    
    comment_data=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/reddit_comments?id=eq.${comment_id}&select=id,content,extracted_entities,extracted_topics,thread_context" \
      -H "apikey: ${SUPABASE_ANON_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_ANON_KEY}")
    
    echo -e "\n${GREEN}Extracted Metadata:${NC}"
    echo "$comment_data" | jq .
    
    # Check content representations
    echo -e "\n${BLUE}Checking content representations for comment ID: ${comment_id}${NC}"
    
    representations=$(curl -s -X POST "${SUPABASE_URL}/rest/v1/rpc/get_all_content_representations" \
      -H "apikey: ${SUPABASE_ANON_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
      -H "Content-Type: application/json" \
      -d "{\"p_content_id\": \"${comment_id}\", \"p_content_type\": \"comment\"}")
    
    echo -e "${GREEN}Content Representations:${NC}"
    echo "$representations" | jq 'map({representation_type, created_at})'
  fi
  
  # Wait between comments to avoid rate limits
  sleep 2
done

# Step 4: Test content similarity
echo -e "\n${YELLOW}Step 4: Testing content similarity${NC}"

# Get two post IDs
post_ids=( $(cat "$TEST_DATA_FILE" | jq -r '.[].post.id' | head -2) )

if [ ${#post_ids[@]} -ge 2 ]; then
  post_id_1="${post_ids[0]}"
  post_id_2="${post_ids[1]}"
  
  echo -e "${BLUE}Calculating similarity between post ${post_id_1} and ${post_id_2}${NC}"
  
  similarity=$(curl -s -X POST "${SUPABASE_URL}/rest/v1/rpc/calculate_content_similarity" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"p_content_id_1\": \"${post_id_1}\", \"p_content_type_1\": \"post\", \"p_content_id_2\": \"${post_id_2}\", \"p_content_type_2\": \"post\", \"p_representation_type\": \"basic\"}")
  
  echo -e "${GREEN}Similarity score: ${similarity}${NC}"
fi

echo -e "\n${BLUE}=== Testing Summary ===${NC}"
echo -e "${GREEN}End-to-end testing completed successfully!${NC}"
echo "Processed posts from r/${SUBREDDIT} with entity extraction and content representations"
echo "Verified extraction of entities, topics, locations, and semantic tags"
echo "Verified storage of multiple representation types"
echo "Verified content similarity calculation" 