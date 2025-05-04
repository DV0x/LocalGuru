# LocalGuru API Key Refresh Guide

## Issue Identified
After directory rename, the application is unable to connect to Supabase because the API keys no longer match the project reference.

## Steps to Refresh API Keys

1. **Access your Supabase Dashboard**
   - Go to: https://app.supabase.com/
   - Sign in with your account

2. **Select your project**
   - Project Reference: ghjbtvyalvigvmuodaas
   - Project URL: https://ghjbtvyalvigvmuodaas.supabase.co

3. **Get fresh API keys**
   - Navigate to: Project Settings > API
   - Copy the following keys:
     - Project URL
     - anon/public key (for client-side operations)
     - service_role key (for server-side operations)

4. **Update your environment files**
   - Open these files and update the API keys:
     - .env
     - .env.local
     - embedding-processor/.env
     - queue-processor/.env

   - The specific variables to update are:
     - NEXT_PUBLIC_SUPABASE_URL=https://ghjbtvyalvigvmuodaas.supabase.co
     - NEXT_PUBLIC_SUPABASE_ANON_KEY=(new anon key)
     - SUPABASE_URL=https://ghjbtvyalvigvmuodaas.supabase.co
     - SUPABASE_SERVICE_ROLE_KEY=(new service role key)
     - SUPABASE_ANON_KEY=(new anon key)

5. **Restart your application**
   - After updating all files, run:
     ```
     npm run dev
     ```

6. **Test the connection**
   - Run the test script:
     ```
     node test-connection.js
     ```

## Additional Troubleshooting
- Make sure your IP address is allowed in the Supabase Database settings
- Ensure that the Postgres password in your connection string is properly URL-encoded
- Check that your Supabase project is active and not in a paused state

