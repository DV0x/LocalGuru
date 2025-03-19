#!/bin/bash

# Clean Database Script using psql
# This script will execute the clean-database.sql file against the Supabase database using psql

# Set variables
SQL_FILE="scripts/clean-database.sql"

# Connection details (explicitly provided)
DB_HOST="aws-0-ap-southeast-1.pooler.supabase.com"
DB_PORT="5432"
DB_NAME="postgres"
DB_USER="postgres.ghjbtvyalvigvmuodaas"
DB_PASSWORD="ch@924880194792"

# Check if psql is installed
if ! command -v psql &> /dev/null; then
  echo "Error: psql is not installed. Please install PostgreSQL client first."
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

echo "Executing clean-database SQL using psql..."

# Execute the SQL file using psql
PGPASSWORD="$DB_PASSWORD" psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -d "$DB_NAME" \
  -U "$DB_USER" \
  -f "$SQL_FILE"

# Check if the command was successful
if [ $? -eq 0 ]; then
  echo "Database cleaned successfully."
else
  echo "Error: Failed to clean database."
  exit 1
fi

echo "Done." 