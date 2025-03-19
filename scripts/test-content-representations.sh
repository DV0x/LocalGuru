#!/bin/bash

# Content Representations Testing Script for Localguru
# Tests specifically the content representation and similarity features

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

echo -e "${BLUE}=== Content Representations Testing Script ===${NC}"
echo "This script tests the content representation and similarity features"

# Function to test storing content representations
test_store_representation() {
  local content_id=$1
  local content_type=$2
  local rep_type=$3
  
  echo -e "\n${YELLOW}Testing store_content_representation for ${content_type} ${content_id}, type: ${rep_type}${NC}"
  
  # Generate a test embedding (random values)
  local embedding="["
  for i in {1..1536}; do
    embedding+="$(echo "scale=9; $RANDOM/32767" | bc -l)"
    if [ $i -lt 1536 ]; then
      embedding+=","
    fi
  done
  embedding+="]"
  
  # Create test metadata
  local metadata="{\"test\":true,\"timestamp\":\"$(date +%s)\",\"type\":\"${rep_type}\"}"
  
  # Call the function
  result=$(curl -s -X POST "${SUPABASE_URL}/rest/v1/rpc/store_content_representation" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -H "Content-Type: application/json" \
    -d "{
      \"p_content_id\": \"${content_id}\",
      \"p_content_type\": \"${content_type}\",
      \"p_representation_type\": \"${rep_type}\",
      \"p_embedding_vector\": ${embedding},
      \"p_metadata\": ${metadata}
    }")
  
  if [ -z "$result" ]; then
    echo -e "${RED}Error: Empty response${NC}"
  elif [[ "$result" == *"error"* ]]; then
    echo -e "${RED}Error in response:${NC}"
    echo "$result" | jq .
  else
    echo -e "${GREEN}Successfully stored ${rep_type} representation with ID: ${result}${NC}"
  fi
}

# Function to test getting content representations
test_get_representations() {
  local content_id=$1
  local content_type=$2
  
  echo -e "\n${YELLOW}Testing get_all_content_representations for ${content_type} ${content_id}${NC}"
  
  # Call the function
  result=$(curl -s -X POST "${SUPABASE_URL}/rest/v1/rpc/get_all_content_representations" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -H "Content-Type: application/json" \
    -d "{
      \"p_content_id\": \"${content_id}\",
      \"p_content_type\": \"${content_type}\"
    }")
  
  if [[ "$result" == *"error"* ]]; then
    echo -e "${RED}Error in response:${NC}"
    echo "$result" | jq .
  else
    echo -e "${GREEN}Retrieved representations:${NC}"
    echo "$result" | jq 'map({id, representation_type, metadata, created_at})'
  fi
}

# Function to test content similarity
test_content_similarity() {
  local content_id_1=$1
  local content_type_1=$2
  local content_id_2=$3
  local content_type_2=$4
  local rep_type=$5
  
  echo -e "\n${YELLOW}Testing calculate_content_similarity${NC}"
  echo -e "Between ${content_type_1} ${content_id_1} and ${content_type_2} ${content_id_2}, type: ${rep_type}"
  
  # Call the function
  result=$(curl -s -X POST "${SUPABASE_URL}/rest/v1/rpc/calculate_content_similarity" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -H "Content-Type: application/json" \
    -d "{
      \"p_content_id_1\": \"${content_id_1}\",
      \"p_content_type_1\": \"${content_type_1}\",
      \"p_content_id_2\": \"${content_id_2}\",
      \"p_content_type_2\": \"${content_type_2}\",
      \"p_representation_type\": \"${rep_type}\"
    }")
  
  if [[ "$result" == *"error"* ]]; then
    echo -e "${RED}Error in response:${NC}"
    echo "$result" | jq .
  else
    echo -e "${GREEN}Similarity score: ${result}${NC}"
  fi
}

# Get recent posts to test with
echo -e "\n${BLUE}Finding recent posts to test with...${NC}"

posts=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/reddit_posts?select=id,title&order=created_at.desc&limit=2" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}")

if [ -z "$posts" ] || [ "$posts" == "[]" ]; then
  echo -e "${RED}No posts found for testing. Please import some data first.${NC}"
  exit 1
fi

# Extract post IDs
post_ids=( $(echo "$posts" | jq -r '.[].id') )

echo -e "${GREEN}Found posts to test with:${NC}"
echo "$posts" | jq .

# Step 1: Test storing representations for the first post
echo -e "\n${YELLOW}Step 1: Testing storing representations${NC}"

# Store representations for the first post
test_store_representation "${post_ids[0]}" "post" "test_basic"
test_store_representation "${post_ids[0]}" "post" "test_enhanced"
test_store_representation "${post_ids[0]}" "post" "test_title"

# Step 2: Test retrieving representations
echo -e "\n${YELLOW}Step 2: Testing retrieving representations${NC}"

test_get_representations "${post_ids[0]}" "post"

# Step 3: Test similarity calculation if we have two posts
if [ ${#post_ids[@]} -ge 2 ]; then
  echo -e "\n${YELLOW}Step 3: Testing similarity calculation${NC}"
  
  # Store a representation for the second post
  test_store_representation "${post_ids[1]}" "post" "test_basic"
  
  # Test similarity
  test_content_similarity "${post_ids[0]}" "post" "${post_ids[1]}" "post" "test_basic"
  
  # Test different representation types
  test_content_similarity "${post_ids[0]}" "post" "${post_ids[1]}" "post" "basic"
else
  echo -e "\n${YELLOW}Skipping similarity test - need at least two posts${NC}"
fi

echo -e "\n${BLUE}=== Testing Summary ===${NC}"
echo -e "${GREEN}Content representations testing completed!${NC}"
echo "Tested storing different representation types"
echo "Tested retrieving representations"
if [ ${#post_ids[@]} -ge 2 ]; then
  echo "Tested similarity calculation between posts"
fi 