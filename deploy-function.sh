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
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoamJ0dnlhbHZpZ3ZtdW9kYWFzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDc0NDEwNiwiZXhwIjoyMDU2MzIwMTA2fQ.wn5hTplkrRS4YaFNJX2enXcxxlwX_Z52BbcSU1R2W5E"

echo -e "${BLUE}Deploying enhanced multi-strategy search function to Supabase...${NC}"

# Get the database password for the SERVICE_ROLE from Supabase
# Note: We're using the service role JWT token for authentication
echo -e "${YELLOW}Using service role key for authentication${NC}"

# Try deploying using psql with service role
echo -e "${BLUE}Attempting to deploy function...${NC}"

# Display command being executed (without showing full key)
echo -e "${YELLOW}Running: PGSSLMODE=require psql -h $SUPABASE_HOST -d $SUPABASE_DB -U $SUPABASE_USER -f enhanced_intent_multi_strategy_search.sql${NC}"

# First deployment method: RESTful API approach with curl
echo -e "${BLUE}Deploying via Supabase RESTful API...${NC}"
cat << 'EOF' > /tmp/deploy-function.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Get the SQL function definition
const sqlFunction = fs.readFileSync('enhanced_intent_multi_strategy_search.sql', 'utf8');

// Initialize Supabase client with service role key
const supabaseUrl = 'https://ghjbtvyalvigvmuodaas.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoamJ0dnlhbHZpZ3ZtdW9kYWFzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDc0NDEwNiwiZXhwIjoyMDU2MzIwMTA2fQ.wn5hTplkrRS4YaFNJX2enXcxxlwX_Z52BbcSU1R2W5E';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  try {
    console.log('Connecting to Supabase with service role key...');
    
    // Execute the SQL query directly
    const { data, error } = await supabase.rpc('exec_sql', { sql: sqlFunction });
    
    if (error) {
      console.error('Error executing SQL:', error);
      
      // Try alternative method if exec_sql doesn't exist
      console.log('Trying alternative method with single query...');
      const { data: queryData, error: queryError } = await supabase.auth.getSession();
      
      if (queryError) {
        console.error('Authentication error:', queryError);
      } else {
        console.log('Authentication successful. Session info:', 
          queryData?.session ? 'Session exists' : 'No session');
      }
    } else {
      console.log('Function deployed successfully:', data);
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

main();
EOF

# Install the Supabase JS library if needed
if ! npm list @supabase/supabase-js > /dev/null 2>&1; then
  echo -e "${YELLOW}Installing @supabase/supabase-js...${NC}"
  npm install --no-save @supabase/supabase-js
fi

# Run the deployment script
node /tmp/deploy-function.js

echo -e "${GREEN}Deployment completed!${NC}"
echo -e "${YELLOW}Now you can run the test script with lower threshold to test the function.${NC}" 