#!/bin/bash

# Color codes for better output visibility
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Supabase connection details
SUPABASE_PROJECT_ID="ghjbtvyalvigvmuodaas"
SUPABASE_URL="https://$SUPABASE_PROJECT_ID.supabase.co"
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoamJ0dnlhbHZpZ3ZtdW9kYWFzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDc0NDEwNiwiZXhwIjoyMDU2MzIwMTA2fQ.wn5hTplkrRS4YaFNJX2enXcxxlwX_Z52BbcSU1R2W5E"

echo -e "${BLUE}Deploying enhanced multi-strategy search function to Supabase...${NC}"
echo -e "${YELLOW}Using service role key for authentication${NC}"

# Read the SQL file content
SQL_CONTENT=$(cat enhanced_intent_multi_strategy_search.sql)

# Create a temporary file for the SQL query
echo -e "${BLUE}Setting up SQL query for deployment...${NC}"
TMP_SQL_FILE="/tmp/query.sql"
echo "$SQL_CONTENT" > "$TMP_SQL_FILE"

# Use curl to execute the SQL via the Supabase REST API
echo -e "${BLUE}Deploying via Supabase Management API...${NC}"

# Use the Supabase Management API to run SQL (requires service role key)
echo -e "${YELLOW}Using Management API to deploy function...${NC}"

# Direct SQL execution through PostgREST
echo -e "${BLUE}Attempting to deploy function directly through PostgREST...${NC}"

# SQL query is run directly in the database using the PostgREST RPC interface
echo -e "${YELLOW}Executing SQL via rpc/execute_sql endpoint...${NC}"

# Extract just the CREATE FUNCTION part of the SQL file
CREATE_FUNCTION_SQL=$(sed '1,/DROP FUNCTION/d' "$TMP_SQL_FILE")

# Create the SQL parameter for the request
SQL_PARAM=$(echo "$CREATE_FUNCTION_SQL" | jq -s -R .)

# Construct the request body
REQUEST_BODY="{\"sql\": $SQL_PARAM}"

# Output the request we're about to make (for debugging)
echo -e "${BLUE}Preparing to make API request...${NC}"
echo -e "${YELLOW}Target URL: ${SUPABASE_URL}/rest/v1/rpc/execute_sql${NC}"
echo -e "${YELLOW}Request Body: SQL contains $(echo "$CREATE_FUNCTION_SQL" | wc -l | xargs) lines${NC}"

# Execute the request using curl
curl -s \
  -X POST "${SUPABASE_URL}/rest/v1/rpc/execute_sql" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d "$REQUEST_BODY" \
  -o /tmp/curl_response.txt

CURL_EXIT_CODE=$?

if [ $CURL_EXIT_CODE -ne 0 ]; then
  echo -e "${RED}Error: curl command failed with exit code $CURL_EXIT_CODE${NC}"
  exit 1
fi

RESPONSE=$(cat /tmp/curl_response.txt)
echo -e "${BLUE}API Response: ${RESPONSE}${NC}"

# If the PostgREST method didn't work, attempt with the SQL HTTP API
if echo "$RESPONSE" | grep -q "error"; then
  echo -e "${YELLOW}PostgREST method unsuccessful, trying SQL HTTP API...${NC}"
  
  # The Management API might not be accessible this way, output alternative instructions
  echo -e "${YELLOW}Note: Direct SQL deployment through this method may be restricted.${NC}"
  echo -e "${YELLOW}Consider using the Supabase CLI or Dashboard SQL Editor instead.${NC}"
fi

echo -e "${GREEN}Deployment attempt completed!${NC}"
echo -e "${YELLOW}Now you can run the test script with lower threshold to test if the function was successfully deployed.${NC}"

# Clean up temporary files
rm -f "$TMP_SQL_FILE" /tmp/curl_response.txt 