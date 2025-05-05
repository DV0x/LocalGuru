#!/bin/bash

# Color codes for better output visibility
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Supabase project details
SUPABASE_PROJECT_ID="ghjbtvyalvigvmuodaas"
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoamJ0dnlhbHZpZ3ZtdW9kYWFzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDc0NDEwNiwiZXhwIjoyMDU2MzIwMTA2fQ.wn5hTplkrRS4YaFNJX2enXcxxlwX_Z52BbcSU1R2W5E"

echo -e "${BLUE}Deploying enhanced multi-strategy search function to Supabase using CLI...${NC}"

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}Error: Supabase CLI is not installed. Please install it to continue.${NC}"
    exit 1
fi

# Check if the function file exists
if [ ! -f "enhanced_intent_multi_strategy_search.sql" ]; then
    echo -e "${RED}Error: enhanced_intent_multi_strategy_search.sql file not found!${NC}"
    exit 1
fi

# Display supabase CLI version
echo -e "${BLUE}Supabase CLI version:${NC}"
supabase --version

# Set the service role key as environment variable
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"

# Temporary directory for CLI operation
TEMP_DIR=$(mktemp -d)
echo -e "${BLUE}Created temporary directory: ${TEMP_DIR}${NC}"

# Create a temporary supabase directory structure for the SQL function
mkdir -p "${TEMP_DIR}/supabase/migrations"
cp enhanced_intent_multi_strategy_search.sql "${TEMP_DIR}/supabase/migrations/20240805000000_enhanced_multi_strategy_search.sql"

# Navigate to the temporary directory
cd "${TEMP_DIR}"

# Initialize supabase project if needed
echo -e "${BLUE}Initializing Supabase project...${NC}"
supabase init

# Switch to the temporary directory
echo -e "${BLUE}Setting up Supabase project...${NC}"

# Link to the existing project
echo -e "${YELLOW}Linking to Supabase project ${SUPABASE_PROJECT_ID}...${NC}"
supabase link --project-ref "$SUPABASE_PROJECT_ID" --password-stdin <<< "$SERVICE_ROLE_KEY"

# Deploy the function using db push
echo -e "${BLUE}Deploying function via migrations...${NC}"
supabase db push

# Alternative: Execute the SQL directly
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}Migration push failed, trying direct SQL execution...${NC}"
    SQL_CONTENT=$(cat enhanced_intent_multi_strategy_search.sql)
    echo -e "${BLUE}Executing SQL directly...${NC}"
    echo "$SQL_CONTENT" | supabase db query
fi

# Return to original directory
cd - > /dev/null

# Clean up
echo -e "${BLUE}Cleaning up temporary files...${NC}"
rm -rf "${TEMP_DIR}"

echo -e "${GREEN}Deployment attempt completed!${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Run the test script with lower threshold: ${GREEN}./run-localguru-test-lower-threshold.sh${NC}" 