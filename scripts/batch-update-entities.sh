#!/bin/bash

# Batch Entity Extraction Processing Script
# This script processes posts and comments without entity metadata in batch mode

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

# Configuration
BATCH_SIZE=10
DELAY_BETWEEN_ITEMS=2 # seconds
DELAY_BETWEEN_BATCHES=10 # seconds
MAX_POSTS=50
MAX_COMMENTS=50

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Batch Entity Extraction Processing ===${NC}"
echo "This script processes posts and comments without entity metadata."

# Process post in batches
process_posts() {
  local limit=$1
  local processed=0
  local batch=1
  
  echo -e "\n${YELLOW}Processing posts without entity metadata (max: $limit)...${NC}"
  
  while [ $processed -lt $limit ]; do
    local batch_size=$BATCH_SIZE
    if [ $(($processed + $batch_size)) -gt $limit ]; then
      batch_size=$(($limit - $processed))
    fi
    
    echo -e "\n${BLUE}Fetching batch $batch (size: $batch_size)...${NC}"
    
    # Get posts without metadata
    posts=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/reddit_posts?select=id,title,subreddit&or=(extracted_entities.is.null,extracted_topics.is.null,semantic_tags.is.null)&limit=$batch_size" \
      -H "apikey: ${SUPABASE_ANON_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_ANON_KEY}")
    
    post_count=$(echo "$posts" | jq length)
    
    if [ $post_count -eq 0 ]; then
      echo "No more posts found without entity metadata."
      break
    fi
    
    echo -e "${GREEN}Processing batch $batch with $post_count posts...${NC}"
    
    # Process each post
    for post_id in $(echo "$posts" | jq -r '.[].id'); do
      post_title=$(echo "$posts" | jq -r ".[] | select(.id == \"$post_id\") | .title")
      
      echo -e "\n${YELLOW}[$((processed + 1))/$limit] Processing post: ${post_id}${NC}"
      echo -e "Title: ${post_title}"
      
      # Call the enhanced-embeddings function
      response=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/enhanced-embeddings" \
        -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
        -H "Content-Type: application/json" \
        -d "{\"contentId\": \"${post_id}\", \"contentType\": \"post\", \"includeContext\": true}")
      
      # Check response
      if echo "$response" | grep -q "error"; then
        echo -e "${RED}Error processing post:${NC}"
        echo "$response" | jq .
      else
        echo -e "${GREEN}Successfully processed post${NC}"
      fi
      
      processed=$((processed + 1))
      
      # Check if we've reached the limit
      if [ $processed -ge $limit ]; then
        break
      fi
      
      # Add delay between items
      echo "Waiting $DELAY_BETWEEN_ITEMS seconds before next item..."
      sleep $DELAY_BETWEEN_ITEMS
    done
    
    batch=$((batch + 1))
    
    # Add delay between batches if we're not done
    if [ $processed -lt $limit ]; then
      echo -e "\n${BLUE}Completed batch. Waiting $DELAY_BETWEEN_BATCHES seconds before next batch...${NC}"
      sleep $DELAY_BETWEEN_BATCHES
    fi
  done
  
  echo -e "\n${GREEN}Completed processing $processed posts${NC}"
}

# Process comments in batches
process_comments() {
  local limit=$1
  local processed=0
  local batch=1
  
  echo -e "\n${YELLOW}Processing comments without entity metadata (max: $limit)...${NC}"
  
  while [ $processed -lt $limit ]; do
    local batch_size=$BATCH_SIZE
    if [ $(($processed + $batch_size)) -gt $limit ]; then
      batch_size=$(($limit - $processed))
    fi
    
    echo -e "\n${BLUE}Fetching batch $batch (size: $batch_size)...${NC}"
    
    # Get comments without metadata
    comments=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/reddit_comments?select=id,content,post_id&or=(extracted_entities.is.null,extracted_topics.is.null)&limit=$batch_size" \
      -H "apikey: ${SUPABASE_ANON_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_ANON_KEY}")
    
    comment_count=$(echo "$comments" | jq length)
    
    if [ $comment_count -eq 0 ]; then
      echo "No more comments found without entity metadata."
      break
    fi
    
    echo -e "${GREEN}Processing batch $batch with $comment_count comments...${NC}"
    
    # Process each comment
    for comment_id in $(echo "$comments" | jq -r '.[].id'); do
      post_id=$(echo "$comments" | jq -r ".[] | select(.id == \"$comment_id\") | .post_id")
      
      echo -e "\n${YELLOW}[$((processed + 1))/$limit] Processing comment: ${comment_id}${NC}"
      echo -e "From post: ${post_id}"
      
      # Call the enhanced-embeddings function
      response=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/enhanced-embeddings" \
        -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
        -H "Content-Type: application/json" \
        -d "{\"contentId\": \"${comment_id}\", \"contentType\": \"comment\", \"includeContext\": true}")
      
      # Check response
      if echo "$response" | grep -q "error"; then
        echo -e "${RED}Error processing comment:${NC}"
        echo "$response" | jq .
      else
        echo -e "${GREEN}Successfully processed comment${NC}"
      fi
      
      processed=$((processed + 1))
      
      # Check if we've reached the limit
      if [ $processed -ge $limit ]; then
        break
      fi
      
      # Add delay between items
      echo "Waiting $DELAY_BETWEEN_ITEMS seconds before next item..."
      sleep $DELAY_BETWEEN_ITEMS
    done
    
    batch=$((batch + 1))
    
    # Add delay between batches if we're not done
    if [ $processed -lt $limit ]; then
      echo -e "\n${BLUE}Completed batch. Waiting $DELAY_BETWEEN_BATCHES seconds before next batch...${NC}"
      sleep $DELAY_BETWEEN_BATCHES
    fi
  done
  
  echo -e "\n${GREEN}Completed processing $processed comments${NC}"
}

# Parse command line arguments
PROCESS_POSTS=true
PROCESS_COMMENTS=true
POST_LIMIT=$MAX_POSTS
COMMENT_LIMIT=$MAX_COMMENTS

# Usage information
usage() {
  echo "Usage: $0 [options]"
  echo "Options:"
  echo "  --posts-only         Process only posts, not comments"
  echo "  --comments-only      Process only comments, not posts"
  echo "  --post-limit N       Process at most N posts (default: $MAX_POSTS)"
  echo "  --comment-limit N    Process at most N comments (default: $MAX_COMMENTS)"
  echo "  --help               Show this help message"
  exit 1
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --posts-only)
      PROCESS_POSTS=true
      PROCESS_COMMENTS=false
      shift
      ;;
    --comments-only)
      PROCESS_POSTS=false
      PROCESS_COMMENTS=true
      shift
      ;;
    --post-limit)
      POST_LIMIT="$2"
      shift 2
      ;;
    --comment-limit)
      COMMENT_LIMIT="$2"
      shift 2
      ;;
    --help)
      usage
      ;;
    *)
      echo "Unknown option: $1"
      usage
      ;;
  esac
done

# Main execution
echo -e "${BLUE}Starting batch processing...${NC}"
echo "Post limit: $POST_LIMIT"
echo "Comment limit: $COMMENT_LIMIT"
echo -e "Posts processing: $(if $PROCESS_POSTS; then echo "${GREEN}enabled${NC}"; else echo "${RED}disabled${NC}"; fi)"
echo -e "Comments processing: $(if $PROCESS_COMMENTS; then echo "${GREEN}enabled${NC}"; else echo "${RED}disabled${NC}"; fi)"

start_time=$(date +%s)

# Process posts if enabled
if $PROCESS_POSTS; then
  process_posts "$POST_LIMIT"
fi

# Process comments if enabled
if $PROCESS_COMMENTS; then
  process_comments "$COMMENT_LIMIT"
fi

end_time=$(date +%s)
duration=$((end_time - start_time))

echo -e "\n${BLUE}=== Processing Summary ===${NC}"
echo "Total execution time: $duration seconds"
echo "Processed up to $POST_LIMIT posts and $COMMENT_LIMIT comments"
echo -e "${GREEN}Batch processing completed successfully!${NC}" 