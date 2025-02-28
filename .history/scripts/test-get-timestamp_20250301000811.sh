#!/bin/bash

# Load environment variables from .env.local
if [ -f ".env.local" ]; then
  export $(grep -v '^#' .env.local | xargs)
else
  echo ".env.local file not found"
  exit 1
fi

# Test connection with the service role key
echo "Testing with service role key:"
PGPASSWORD="$SUPABASE_SERVICE_ROLE_KEY" psql -h db.ghjbtvyalvigvmuodaas.supabase.co -U postgres -d postgres -c "SELECT public.get_timestamp();"

# Test connection with the anon key
echo -e "\nTesting with anon key:"
PGPASSWORD="$NEXT_PUBLIC_SUPABASE_ANON_KEY" psql -h db.ghjbtvyalvigvmuodaas.supabase.co -U anon -d postgres -c "SELECT public.get_timestamp();"

echo -e "\nDone!" 