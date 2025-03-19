#!/bin/bash

# Test script for entity extraction functionality
# Tests the enhanced-embeddings edge function for entity extraction

# Load environment variables from .env file if it exists
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

echo -e "${BLUE}=== Entity Extraction Testing Script ===${NC}"
echo "This script tests entity extraction by calling the enhanced-embeddings function directly."

# Function to test extraction on a specific post
test_post_extraction() {
  local post_id=$1
  
  echo -e "\n${YELLOW}Testing entity extraction on post ID: ${post_id}${NC}"
  
  # Call the enhanced-embeddings function with the post ID
  echo "Sending request to enhanced-embeddings function..."
  
  response=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/enhanced-embeddings" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"contentId\": \"${post_id}\", \"contentType\": \"post\", \"includeContext\": true}")
  
  # Check for errors in the response
  if echo "$response" | grep -q "error"; then
    echo -e "${RED}Error in response:${NC}"
    echo "$response" | jq .
    return 1
  else
    echo -e "${GREEN}Entity extraction completed successfully!${NC}"
    
    # Fetch the updated post to see the extracted entities
    echo "Fetching updated post data..."
    
    post_data=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/reddit_posts?id=eq.${post_id}&select=id,title,extracted_entities,extracted_topics,extracted_locations,semantic_tags" \
      -H "apikey: ${SUPABASE_ANON_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_ANON_KEY}")
    
    echo -e "\n${GREEN}Extracted Metadata:${NC}"
    echo "$post_data" | jq .
    return 0
  fi
}

# Function to test extraction on a specific comment
test_comment_extraction() {
  local comment_id=$1
  
  echo -e "\n${YELLOW}Testing entity extraction on comment ID: ${comment_id}${NC}"
  
  # Call the enhanced-embeddings function with the comment ID
  echo "Sending request to enhanced-embeddings function..."
  
  response=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/enhanced-embeddings" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"contentId\": \"${comment_id}\", \"contentType\": \"comment\", \"includeContext\": true}")
  
  # Check for errors in the response
  if echo "$response" | grep -q "error"; then
    echo -e "${RED}Error in response:${NC}"
    echo "$response" | jq .
    return 1
  else
    echo -e "${GREEN}Entity extraction completed successfully!${NC}"
    
    # Fetch the updated comment to see the extracted entities
    echo "Fetching updated comment data..."
    
    comment_data=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/reddit_comments?id=eq.${comment_id}&select=id,content,extracted_entities,extracted_topics,thread_context" \
      -H "apikey: ${SUPABASE_ANON_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_ANON_KEY}")
    
    echo -e "\n${GREEN}Extracted Metadata:${NC}"
    echo "$comment_data" | jq .
    return 0
  fi
}

# Function to find posts without entity metadata
find_posts_without_metadata() {
  echo -e "\n${YELLOW}Finding posts without entity metadata...${NC}"
  
  posts=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/reddit_posts?select=id,title,subreddit&or=(extracted_entities.is.null,extracted_topics.is.null,semantic_tags.is.null)&limit=5" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}")
  
  if [ $(echo "$posts" | jq length) -eq 0 ]; then
    echo "No posts found without entity metadata."
    return 1
  else
    echo -e "${GREEN}Found $(echo "$posts" | jq length) posts without entity metadata:${NC}"
    echo "$posts" | jq .
    return 0
  fi
}

# Function to find comments without entity metadata
find_comments_without_metadata() {
  echo -e "\n${YELLOW}Finding comments without entity metadata...${NC}"
  
  comments=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/reddit_comments?select=id,content,post_id&or=(extracted_entities.is.null,extracted_topics.is.null)&limit=5" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}")
  
  if [ $(echo "$comments" | jq length) -eq 0 ]; then
    echo "No comments found without entity metadata."
    return 1
  else
    echo -e "${GREEN}Found $(echo "$comments" | jq length) comments without entity metadata:${NC}"
    echo "$comments" | jq .
    return 0
  fi
}

# Main menu
show_menu() {
  echo -e "\n${BLUE}=== Entity Extraction Test Menu ===${NC}"
  echo "1) Test extraction on specific post (by ID)"
  echo "2) Test extraction on specific comment (by ID)"
  echo "3) Find posts without entity metadata"
  echo "4) Find comments without entity metadata"
  echo "5) Run batch extraction (process 5 posts)"
  echo "q) Quit"
  echo -n "Select an option: "
}

# Batch extraction function
run_batch_extraction() {
  echo -e "\n${YELLOW}Running batch extraction on 5 posts without metadata...${NC}"
  
  posts=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/reddit_posts?select=id,title&or=(extracted_entities.is.null,extracted_topics.is.null,semantic_tags.is.null)&limit=5" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}")
  
  if [ $(echo "$posts" | jq length) -eq 0 ]; then
    echo "No posts found without entity metadata."
    return 1
  fi
  
  echo -e "${GREEN}Processing $(echo "$posts" | jq length) posts...${NC}"
  
  processed=0
  for post_id in $(echo "$posts" | jq -r '.[].id'); do
    echo -e "\n${YELLOW}Processing post ID: ${post_id} ($(($processed + 1)) of $(echo "$posts" | jq length))${NC}"
    
    response=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/enhanced-embeddings" \
      -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
      -H "Content-Type: application/json" \
      -d "{\"contentId\": \"${post_id}\", \"contentType\": \"post\", \"includeContext\": true}")
    
    if echo "$response" | grep -q "error"; then
      echo -e "${RED}Error processing post ${post_id}:${NC}"
      echo "$response" | jq .
    else
      echo -e "${GREEN}Successfully processed post ${post_id}${NC}"
    fi
    
    processed=$((processed + 1))
    
    # Wait 2 seconds between requests to avoid rate limits
    if [ $processed -lt $(echo "$posts" | jq length) ]; then
      echo "Waiting 2 seconds before next request..."
      sleep 2
    fi
  done
  
  echo -e "\n${GREEN}Batch processing complete!${NC}"
  return 0
}

# Main loop
while true; do
  show_menu
  read -r option
  
  case $option in
    1)
      echo -n "Enter post ID: "
      read -r post_id
      test_post_extraction "$post_id"
      ;;
    2)
      echo -n "Enter comment ID: "
      read -r comment_id
      test_comment_extraction "$comment_id"
      ;;
    3)
      find_posts_without_metadata
      ;;
    4)
      find_comments_without_metadata
      ;;
    5)
      run_batch_extraction
      ;;
    q|Q)
      echo "Exiting..."
      exit 0
      ;;
    *)
      echo -e "${RED}Invalid option. Please try again.${NC}"
      ;;
  esac
done 