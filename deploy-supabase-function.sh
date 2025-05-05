#!/bin/bash

# Color codes for better output visibility
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Supabase connection details
SUPABASE_URL="https://ghjbtvyalvigvmuodaas.supabase.co"
SUPABASE_PROJECT_ID="ghjbtvyalvigvmuodaas"
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoamJ0dnlhbHZpZ3ZtdW9kYWFzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDc0NDEwNiwiZXhwIjoyMDU2MzIwMTA2fQ.wn5hTplkrRS4YaFNJX2enXcxxlwX_Z52BbcSU1R2W5E"

echo -e "${BLUE}Deploying enhanced multi-strategy search function to Supabase...${NC}"
echo -e "${YELLOW}Using Supabase URL: ${SUPABASE_URL}${NC}"

# Check if the function file exists
if [ ! -f "enhanced_intent_multi_strategy_search.sql" ]; then
    echo -e "${RED}Error: enhanced_intent_multi_strategy_search.sql file not found!${NC}"
    exit 1
fi

# Method 1: Try using direct API call with curl
echo -e "${BLUE}Method 1: Deploying via Supabase Management API...${NC}"

# Read the SQL file content
SQL_CONTENT=$(cat enhanced_intent_multi_strategy_search.sql)

# Format the SQL for API request
SQL_JSON=$(echo "$SQL_CONTENT" | jq -sR .)

# Construct the request body
REQUEST_BODY="{\"query\": $SQL_JSON}"

# Make the API request
echo -e "${YELLOW}Sending request to Supabase SQL endpoint...${NC}"
RESPONSE=$(curl -s \
  -X POST "${SUPABASE_URL}/rest/v1/sql" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "$REQUEST_BODY")

# Check if the API call succeeded
if echo "$RESPONSE" | grep -q "error"; then
    echo -e "${RED}API deployment failed:${NC}"
    echo "$RESPONSE"
    
    # Method 2: Try using Supabase CLI if installed
    if command -v supabase &> /dev/null; then
        echo -e "${BLUE}Method 2: Trying deployment with Supabase CLI...${NC}"
        
        # Set required environment variables
        export SUPABASE_ACCESS_TOKEN="$SERVICE_ROLE_KEY"
        
        # Execute SQL directly with CLI
        SQL_RESULT=$(cat enhanced_intent_multi_strategy_search.sql | supabase db query 2>&1)
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}Successfully deployed function with Supabase CLI!${NC}"
        else
            echo -e "${RED}CLI deployment failed:${NC}"
            echo "$SQL_RESULT"
            
            # Method 3: Suggest manual deployment via the Dashboard
            echo -e "${YELLOW}Method 3: Consider deploying the function manually via the Supabase Dashboard SQL Editor.${NC}"
            echo -e "${YELLOW}1. Go to ${SUPABASE_URL}${NC}"
            echo -e "${YELLOW}2. Navigate to SQL Editor${NC}"
            echo -e "${YELLOW}3. Paste the contents of enhanced_intent_multi_strategy_search.sql${NC}"
            echo -e "${YELLOW}4. Execute the SQL query${NC}"
        fi
    else
        echo -e "${YELLOW}Supabase CLI not found. Consider deploying manually.${NC}"
    fi
else
    echo -e "${GREEN}Function deployed successfully via API!${NC}"
fi

echo -e "${GREEN}Deployment attempt completed!${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Run the test script with lower threshold: ${GREEN}./run-localguru-test-lower-threshold.sh${NC}" 