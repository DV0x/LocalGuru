#!/bin/bash

# Exit on error
set -e

# Display current directory for context
echo "Current directory: $(pwd)"

# Check that we're in the right directory
if [[ ! -d "scripts" && ! -d "../scripts" ]]; then
  echo "Error: Please run this script from the project root or scripts directory."
  exit 1
fi

# Navigate to project root if needed
if [[ -d "../scripts" ]]; then
  cd ..
fi

# Make sure .env file exists and has Reddit credentials
if [[ ! -f ".env" && ! -f ".env.local" ]]; then
  echo "Error: No .env or .env.local file found."
  echo "Please create one with the following variables:"
  echo "REDDIT_CLIENT_ID=your_client_id"
  echo "REDDIT_CLIENT_SECRET=your_client_secret"
  echo "REDDIT_USERNAME=your_username"
  echo "REDDIT_PASSWORD=your_password"
  echo "NEXT_PUBLIC_SUPABASE_URL=your_supabase_url"
  echo "SUPABASE_SERVICE_ROLE_KEY=your_service_role_key"
  exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install axios @supabase/supabase-js dotenv uuid
fi

# Check if TypeScript is installed
if ! command -v tsc &> /dev/null; then
  echo "TypeScript compiler not found, installing..."
  npm install -g typescript
fi

# Check for ts-node
if ! command -v ts-node &> /dev/null; then
  echo "ts-node not found, installing..."
  npm install -g ts-node
fi

echo "Running Reddit data fetcher for r/AskSF..."
echo "This will fetch 10 top posts with all comments..."

# Run the script
ts-node scripts/fetch-askSF-data.ts

echo "Script execution completed." 