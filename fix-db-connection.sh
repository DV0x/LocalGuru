#!/bin/bash
# Script to fix database connection issues after project directory rename

echo "LocalGuru Database Connection Fix Script"
echo "========================================"
echo

# Check if we can connect to the database using the connection string
test_direct_db_connection() {
  echo "Testing direct database connection..."
  if command -v psql &> /dev/null; then
    # Get the connection string from .env
    if [ -f .env ]; then
      DB_URL=$(grep 'DATABASE_URL\|SUPABASE_DB_URL' .env | head -1 | cut -d '=' -f2-)
      if [ -n "$DB_URL" ]; then
        echo "Attempting to connect to database with connection string from .env..."
        PGCONNECT_TIMEOUT=5 psql "$DB_URL" -c "SELECT 1 as connection_test;" 2>/dev/null
        if [ $? -eq 0 ]; then
          echo "✅ Database connection successful!"
        else
          echo "❌ Database connection failed."
          echo "The connection string may be invalid or your IP may not be allowed."
        fi
      else
        echo "❌ No database connection string found in .env"
      fi
    else
      echo "❌ .env file not found"
    fi
  else
    echo "❌ psql command not found. Please install PostgreSQL client tools."
  fi
}

# Function to help update Supabase API keys
update_api_keys() {
  echo
  echo "To update your Supabase API keys, you need to:"
  echo "1. Log into your Supabase dashboard at https://app.supabase.io"
  echo "2. Select your project"
  echo "3. Go to Project Settings > API"
  echo "4. Copy the Project URL, anon/public key, and service_role key"
  echo
  echo "Then update your .env and .env.local files with:"
  echo "NEXT_PUBLIC_SUPABASE_URL=<your-project-url>"
  echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>"
  echo "SUPABASE_URL=<your-project-url>"
  echo "SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>"
  echo
}

# Function to check IP restrictions
check_ip_restrictions() {
  echo
  echo "If you're unable to connect to the database, your IP address may be restricted."
  echo "To add your IP address to the allowlist:"
  echo "1. Go to the Supabase dashboard"
  echo "2. Navigate to Project Settings > Database > Network Restrictions"
  echo "3. Add your current IP address to the allowed list"
  echo
  echo "Your current public IP address is:"
  curl -s https://api.ipify.org
  echo
}

# Main sequence
echo "Step 1: Verify database connection"
test_direct_db_connection

echo
echo "Step 2: API key information"
update_api_keys

echo "Step 3: Check IP restrictions"
check_ip_restrictions

echo
echo "=========================================="
echo "If you're still having issues, please:"
echo "1. Verify that your .env file has the correct project ID in the URLs"
echo "2. Make sure your service role key is up to date"
echo "3. Check that the @ symbol in your password is properly URL encoded as %40"
echo "4. Restart your development server after making changes"
echo "==========================================" 