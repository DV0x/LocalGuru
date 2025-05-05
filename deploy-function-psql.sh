#!/bin/bash

# Color codes for better output visibility
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Supabase connection details
SUPABASE_HOST="db.ghjbtvyalvigvmuodaas.supabase.co"
SUPABASE_DB="postgres"
SUPABASE_USER="postgres"
SUPABASE_PASSWORD="HGS*xKdlHCKZ1Vl"

echo -e "${BLUE}Deploying enhanced multi-strategy search function to Supabase using direct PSQL...${NC}"

# Check if the function file exists
if [ ! -f "enhanced_intent_multi_strategy_search.sql" ]; then
    echo -e "${RED}Error: enhanced_intent_multi_strategy_search.sql file not found!${NC}"
    exit 1
fi

# Check if psql is installed
if ! command -v psql &> /dev/null; then
    echo -e "${RED}Error: psql is not installed. Please install PostgreSQL client tools to continue.${NC}"
    exit 1
fi

# Display connection details (partially masked)
echo -e "${YELLOW}Connection details:${NC}"
echo -e "Host: ${SUPABASE_HOST}"
echo -e "Database: ${SUPABASE_DB}"
echo -e "User: ${SUPABASE_USER}"
echo -e "Password: ${SUPABASE_PASSWORD:0:3}*****"

# Attempt to connect and deploy the function
echo -e "${BLUE}Attempting to deploy function via PSQL...${NC}"

# Set PGSSLMODE for secure connection
export PGSSLMODE=require

# Execute the SQL file
cat enhanced_intent_multi_strategy_search.sql | PGPASSWORD="${SUPABASE_PASSWORD}" psql -h "${SUPABASE_HOST}" -d "${SUPABASE_DB}" -U "${SUPABASE_USER}" -p 5432

# Check if the command succeeded
if [ $? -eq 0 ]; then
    echo -e "${GREEN}Function deployed successfully!${NC}"
else
    echo -e "${RED}Failed to deploy function.${NC}"
    
    # Try alternate connection string format
    echo -e "${YELLOW}Trying alternate connection method...${NC}"
    
    CONNECTION_STRING="postgres://${SUPABASE_USER}:${SUPABASE_PASSWORD}@${SUPABASE_HOST}:5432/${SUPABASE_DB}"
    cat enhanced_intent_multi_strategy_search.sql | PGPASSWORD="${SUPABASE_PASSWORD}" psql "${CONNECTION_STRING}"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Function deployed successfully with alternate method!${NC}"
    else
        echo -e "${RED}All deployment methods failed.${NC}"
    fi
fi

echo -e "${GREEN}Deployment attempt completed!${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Run the test script with lower threshold: ${GREEN}./run-localguru-test-lower-threshold.sh${NC}" 