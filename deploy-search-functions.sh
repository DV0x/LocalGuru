#!/bin/bash
# Script to deploy the Supabase Edge Functions used in the search functionality
# This script should be run after directory rename or environment changes

# Load environment variables
source .env.local

# Ensure required variables are set
if [ -z "$SUPABASE_PROJECT" ]; then
  echo "Error: SUPABASE_PROJECT is not set in .env.local"
  exit 1
fi

if [ -z "$OPENAI_API_KEY" ]; then
  echo "Error: OPENAI_API_KEY is not set in .env.local"
  exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "Error: SUPABASE_SERVICE_ROLE_KEY is not set in .env.local"
  exit 1
fi

# Display the current directory and information
echo "Current directory: $(pwd)"
echo "Deploying Edge Functions for project: $SUPABASE_PROJECT"
echo "Using OpenAI API key: ${OPENAI_API_KEY:0:10}..."
echo "Using Supabase URL: $SUPABASE_URL"

# Deploy query-analysis function with environment variables
echo -e "\n=== Deploying query-analysis function ==="
OPENAI_API_KEY="$OPENAI_API_KEY" \
SUPABASE_URL="$SUPABASE_URL" \
SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
CUSTOM_SUPABASE_URL="$SUPABASE_URL" \
supabase functions deploy query-analysis --project-ref "$SUPABASE_PROJECT" --no-verify-jwt

# Check if deployment was successful
if [ $? -ne 0 ]; then
  echo "❌ Failed to deploy query-analysis function"
else
  echo "✅ Successfully deployed query-analysis function"
fi

# Deploy query-embeddings function with environment variables
echo -e "\n=== Deploying query-embeddings function ==="
OPENAI_API_KEY="$OPENAI_API_KEY" \
SUPABASE_URL="$SUPABASE_URL" \
SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
CUSTOM_SUPABASE_URL="$SUPABASE_URL" \
supabase functions deploy query-embeddings --project-ref "$SUPABASE_PROJECT" --no-verify-jwt

# Check if deployment was successful
if [ $? -ne 0 ]; then
  echo "❌ Failed to deploy query-embeddings function"
else
  echo "✅ Successfully deployed query-embeddings function"
fi

echo -e "\n=== Deployment Complete ==="
echo "To test the functions, restart your application with: npm run dev"
echo "If you continue to have issues, check Supabase logs with:"
echo "supabase functions logs query-analysis --project-ref $SUPABASE_PROJECT"
echo "supabase functions logs query-embeddings --project-ref $SUPABASE_PROJECT"