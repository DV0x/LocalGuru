#!/bin/bash

# Color codes for better output visibility
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Direct PostgreSQL connection details (from clean-database-psql.sh)
DB_HOST="aws-0-ap-southeast-1.pooler.supabase.com"
DB_PORT="5432"
DB_NAME="postgres"
DB_USER="postgres.ghjbtvyalvigvmuodaas"
DB_PASSWORD="ch@924880194792"

# SQL file path
SQL_FILE="enhanced_intent_multi_strategy_search.sql"

# Parse command line arguments
INTERACTIVE=true
for arg in "$@"; do
    case $arg in
        -y|--yes)
            INTERACTIVE=false
            shift
            ;;
        *)
            # Unknown option
            ;;
    esac
done

echo -e "${BLUE}Deploying enhanced multi-strategy search function via direct PostgreSQL connection...${NC}"

# Check if the function file exists
if [ ! -f "$SQL_FILE" ]; then
    echo -e "${RED}Error: $SQL_FILE file not found!${NC}"
    exit 1
fi

# Check if psql is installed
if ! command -v psql &> /dev/null; then
    echo -e "${RED}Error: psql is not installed. Please install PostgreSQL client tools to continue.${NC}"
    exit 1
fi

# Display connection details (partially masked)
echo -e "${YELLOW}Connection details:${NC}"
echo -e "Host: ${DB_HOST}"
echo -e "Database: ${DB_NAME}"
echo -e "User: ${DB_USER}"
echo -e "Password: ${DB_PASSWORD:0:2}*****"

# Confirm deployment if in interactive mode
if [ "$INTERACTIVE" = true ]; then
    echo -e "${YELLOW}This will deploy the enhanced multi-strategy search function to your Supabase database.${NC}"
    read -p "Are you sure you want to continue? (y/N): " confirm

    if [[ $confirm != "y" && $confirm != "Y" ]]; then
        echo -e "${YELLOW}Operation cancelled.${NC}"
        exit 0
    fi
else
    echo -e "${YELLOW}Running in non-interactive mode. Proceeding with deployment...${NC}"
fi

# Set PGSSLMODE for secure connection
export PGSSLMODE=require

# Execute the SQL file
echo -e "${BLUE}Executing SQL file...${NC}"
PGPASSWORD="$DB_PASSWORD" psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -d "$DB_NAME" \
  -U "$DB_USER" \
  -f "$SQL_FILE"

# Check if the command succeeded
if [ $? -eq 0 ]; then
    echo -e "${GREEN}Function deployed successfully!${NC}"
else
    echo -e "${RED}Failed to deploy function. Please check the error messages above.${NC}"
    exit 1
fi

echo -e "${GREEN}Deployment completed!${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Run the test script with lower threshold: ${GREEN}./run-localguru-test-fixed.sh${NC}"
echo -e "2. Or run the simplified test script: ${GREEN}./run-localguru-simple.sh${NC}" 