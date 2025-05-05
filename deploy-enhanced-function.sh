#!/bin/bash

# Color codes for better output visibility
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Supabase connection details
SUPABASE_URL="https://ghjbtvyalvigvmuodaas.supabase.co"
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoamJ0dnlhbHZpZ3ZtdW9kYWFzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDc0NDEwNiwiZXhwIjoyMDU2MzIwMTA2fQ.wn5hTplkrRS4YaFNJX2enXcxxlwX_Z52BbcSU1R2W5E"

echo -e "${BLUE}Deploying enhanced multi-strategy search function to Supabase...${NC}"
echo -e "${YELLOW}Using service role key for authentication${NC}"

# Check if the function file exists
if [ ! -f "enhanced_intent_multi_strategy_search.sql" ]; then
    echo -e "${RED}Error: enhanced_intent_multi_strategy_search.sql file not found!${NC}"
    exit 1
fi

# Set up deployment via Node.js script using Supabase client
echo -e "${BLUE}Setting up deployment script...${NC}"
cat << EOF > /tmp/deploy-function.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Get the SQL function definition
const sqlFunction = fs.readFileSync('enhanced_intent_multi_strategy_search.sql', 'utf8');

// Initialize Supabase client with service role key
const supabaseUrl = '${SUPABASE_URL}';
const supabaseKey = '${SERVICE_ROLE_KEY}';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  try {
    console.log('Connecting to Supabase with service role key...');
    
    // Attempt to execute SQL directly using the SQL executor
    // Method 1: Try with exec_sql function
    console.log('Attempting to deploy with exec_sql...');
    try {
      const { data, error } = await supabase.rpc('exec_sql', { sql: sqlFunction });
      
      if (error) {
        console.error('Error with exec_sql:', error.message);
        throw error;
      } else {
        console.log('Successfully deployed function with exec_sql');
        return;
      }
    } catch (err) {
      console.log('exec_sql method failed, trying alternative methods...');
    }
    
    // Method 2: Try with execute_sql function
    console.log('Attempting to deploy with execute_sql...');
    try {
      const { data, error } = await supabase.rpc('execute_sql', { sql: sqlFunction });
      
      if (error) {
        console.error('Error with execute_sql:', error.message);
        throw error;
      } else {
        console.log('Successfully deployed function with execute_sql');
        return;
      }
    } catch (err) {
      console.log('execute_sql method failed, trying alternative methods...');
    }
    
    // Method 3: Try with supabase SQL endpoint
    console.log('Attempting to deploy with SQL API...');
    try {
      // This is using the low-level API directly
      const response = await fetch(\`\${supabaseUrl}/rest/v1/sql\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': \`Bearer \${supabaseKey}\`
        },
        body: JSON.stringify({ query: sqlFunction })
      });
      
      if (!response.ok) {
        const error = await response.text();
        console.error('Error with SQL API:', error);
        throw new Error(error);
      } else {
        const result = await response.json();
        console.log('Successfully deployed function with SQL API');
        return;
      }
    } catch (err) {
      console.log('SQL API method failed:', err.message);
    }
    
    // If we got here, all methods failed
    console.error('All deployment methods failed. You may need to deploy this function manually via the Supabase dashboard SQL editor.');
    
  } catch (err) {
    console.error('Unexpected error:', err.message);
  }
}

main();
EOF

# Check for Node.js and npm
echo -e "${BLUE}Checking for required dependencies...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js is not installed. Please install Node.js to run this deployment script.${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}npm is not installed. Please install npm to run this deployment script.${NC}"
    exit 1
fi

# Install the required packages if needed
echo -e "${BLUE}Installing required dependencies...${NC}"
npm install --no-save @supabase/supabase-js

# Execute the deployment script
echo -e "${BLUE}Running deployment script...${NC}"
node /tmp/deploy-function.js

echo -e "${GREEN}Deployment attempt completed!${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Run the test script with lower threshold: ${GREEN}./run-localguru-test-lower-threshold.sh${NC}"
echo -e "2. If deployment failed, consider using the Supabase dashboard SQL editor to deploy the function."

# Clean up
rm -f /tmp/deploy-function.js 