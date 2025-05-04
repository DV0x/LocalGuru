#!/bin/bash

# Script to run the AskSF Last Month data fetcher

echo "Starting AskSF Last Month data fetch..."
echo "==============================================="

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Build TypeScript files
echo "Building TypeScript..."
npx tsc

# Run the script
echo "Running fetcher script..."
node dist/scripts/asksf-last-month.js

echo "==============================================="
echo "Fetch process completed!" 