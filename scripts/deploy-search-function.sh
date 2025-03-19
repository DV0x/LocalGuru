#!/bin/bash

# Deploy the updated multi_strategy_search function that removes content truncation
# This script applies the SQL migration to the Supabase database

# Set colors for better visibility
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Deploying updated multi_strategy_search function to remove content truncation...${NC}"

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}Error: Supabase CLI is not installed. Please install it first.${NC}"
    echo "Visit https://supabase.com/docs/guides/cli for installation instructions."
    exit 1
fi

# Push the migration to the database
echo "Applying SQL migration..."
supabase db push --db-url "$DATABASE_URL" || {
    echo -e "${RED}Failed to apply the migration.${NC}"
    echo "Please check your database connection and permissions."
    exit 1
}

# Or alternatively, run the SQL file directly if supabase CLI is not available
# psql "$DATABASE_URL" -f supabase/migrations/20230801_remove_content_truncation.sql

echo -e "${GREEN}Successfully updated the multi_strategy_search function!${NC}"
echo "Content will now be returned without truncation in search results."
echo ""
echo "Please restart your application or clear the cache to see the changes." 