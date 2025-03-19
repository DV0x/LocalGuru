#!/bin/bash

# Clean Database Script using Supabase CLI
# This script will execute the clean-database.sql file against the Supabase database

# Source environment variables to get Supabase reference
source .env

# Set variables
SQL_FILE="scripts/clean-database.sql"
SUPABASE_REF=$(echo $SUPABASE_URL | awk -F// '{print $2}' | awk -F. '{print $1}')

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
  echo "Error: Supabase CLI is not installed. Please install it first."
  echo "Instructions: https://supabase.com/docs/guides/cli"
  exit 1
fi

echo "WARNING: This script will delete ALL data from the Localguru database."
echo "This includes all Reddit posts, comments, users, embeddings, and search data."
echo "This action cannot be undone."
echo ""
read -p "Are you sure you want to continue? (y/N): " confirm

if [[ $confirm != "y" && $confirm != "Y" ]]; then
  echo "Operation cancelled."
  exit 0
fi

# Check if project is linked
LINKED_REF=$(supabase projects list | grep 'Current project' | awk '{print $3}')

if [ "$LINKED_REF" != "$SUPABASE_REF" ]; then
  echo "Linking Supabase project '$SUPABASE_REF'..."
  supabase link --project-ref "$SUPABASE_REF" --password "$SUPABASE_SERVICE_ROLE_KEY"
  
  if [ $? -ne 0 ]; then
    echo "Error: Failed to link Supabase project. Please run manually:"
    echo "supabase link --project-ref $SUPABASE_REF"
    exit 1
  fi
fi

# Create a temporary file with the clean database SQL
TEMP_SQL=$(mktemp)
cat "$SQL_FILE" > "$TEMP_SQL"

echo "Executing clean-database SQL..."

# Execute the SQL file using Supabase CLI
supabase db execute --file "$TEMP_SQL"

# Check if the command was successful
if [ $? -eq 0 ]; then
  echo "Database cleaned successfully."
else
  echo "Error: Failed to clean database."
  exit 1
fi

# Clean up temporary file
rm "$TEMP_SQL"

echo "Done." 