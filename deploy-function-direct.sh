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

# Set the service role key as environment variable (required by CLI)
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
export SUPABASE_ACCESS_TOKEN="$SERVICE_ROLE_KEY"
export SUPABASE_DB_PASSWORD="HGS*xKdlHCKZ1Vl"

# Link to the existing project (if not already linked)
echo -e "${YELLOW}Linking to Supabase project ${SUPABASE_PROJECT_ID}...${NC}"

# Check if project is already linked
if ! supabase projects list | grep -q "$SUPABASE_PROJECT_ID"; then
    echo -e "${BLUE}Project not linked yet, linking now...${NC}"
    # Try to link without password prompt first
    if ! supabase link --project-ref "$SUPABASE_PROJECT_ID"; then
        echo -e "${YELLOW}Trying link with password...${NC}"
        echo "$SERVICE_ROLE_KEY" | supabase link --project-ref "$SUPABASE_PROJECT_ID" --password-stdin
    fi
else
    echo -e "${GREEN}Project already linked.${NC}"
fi

# Execute the SQL directly
echo -e "${BLUE}Executing SQL directly using supabase db query...${NC}"
cat enhanced_intent_multi_strategy_search.sql | supabase db query

# Alternative direct approach with psql (if above doesn't work)
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}CLI db query failed, trying direct psql approach...${NC}"
    
    # Try to get database connection info from Supabase CLI
    echo -e "${BLUE}Retrieving database connection info...${NC}"
    DB_INFO=$(supabase db connect --db-url)
    
    if [ -n "$DB_INFO" ]; then
        echo -e "${GREEN}Successfully retrieved database URL: ${DB_INFO:0:30}...${NC}"
        cat enhanced_intent_multi_strategy_search.sql | PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$DB_INFO"
    else
        echo -e "${RED}Failed to get database connection info.${NC}"
        echo -e "${YELLOW}Trying with known connection parameters...${NC}"
        
        cat enhanced_intent_multi_strategy_search.sql | PGPASSWORD="HGS*xKdlHCKZ1Vl" psql "postgres://postgres:HGS*xKdlHCKZ1Vl@db.ghjbtvyalvigvmuodaas.supabase.co:5432/postgres"
    fi
fi

echo -e "${GREEN}Deployment attempt completed!${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Run the test script with lower threshold: ${GREEN}./run-localguru-test-lower-threshold.sh${NC}"
echo -e "2. If deployment failed, consider using the Supabase dashboard SQL Editor to deploy the function." 