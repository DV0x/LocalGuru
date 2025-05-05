require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

function generateGuide() {
  // Prepare guide content
  const projectRef = process.env.SUPABASE_PROJECT || 'ghjbtvyalvigvmuodaas';
  const projectUrl = `https://${projectRef}.supabase.co`;
  
  const guideContent = `# LocalGuru API Key Refresh Guide

## Issue Identified
After directory rename, the application is unable to connect to Supabase because the API keys no longer match the project reference.

## Steps to Refresh API Keys

1. **Access your Supabase Dashboard**
   - Go to: https://app.supabase.com/
   - Sign in with your account

2. **Select your project**
   - Project Reference: ${projectRef}
   - Project URL: ${projectUrl}

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
     - NEXT_PUBLIC_SUPABASE_URL=${projectUrl}
     - NEXT_PUBLIC_SUPABASE_ANON_KEY=(new anon key)
     - SUPABASE_URL=${projectUrl}
     - SUPABASE_SERVICE_ROLE_KEY=(new service role key)
     - SUPABASE_ANON_KEY=(new anon key)

5. **Restart your application**
   - After updating all files, run:
     \`\`\`
     npm run dev
     \`\`\`

6. **Test the connection**
   - Run the test script:
     \`\`\`
     node test-connection.js
     \`\`\`

## Additional Troubleshooting
- Make sure your IP address is allowed in the Supabase Database settings
- Ensure that the Postgres password in your connection string is properly URL-encoded
- Check that your Supabase project is active and not in a paused state

`;

  // Write guide to file
  fs.writeFileSync('API_KEY_REFRESH_GUIDE.md', guideContent, 'utf8');
  console.log('API key refresh guide created: API_KEY_REFRESH_GUIDE.md');
  
  // Print key information
  console.log('\nCurrent Environment Information:');
  console.log('Project Reference:', projectRef);
  console.log('Project URL:', projectUrl);
  console.log('DB URL:', process.env.SUPABASE_DB_URL ? 'Configured' : 'Missing');
  console.log('Service Role Key:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Present (but may need refresh)' : 'Missing');
  console.log('Anon Key:', process.env.SUPABASE_ANON_KEY ? 'Present (but may need refresh)' : 'Missing');
  
  // Return key information for IP address check
  return projectRef;
}

// Check IP address access
async function checkIpAccess(projectRef) {
  try {
    console.log('\nChecking your current IP address:');
    const ipResponse = await fetch('https://api.ipify.org?format=json');
    const ipData = await ipResponse.json();
    console.log('Your current public IP address:', ipData.ip);
    
    console.log('\nTo ensure your IP has database access, go to:');
    console.log(`https://app.supabase.com/project/${projectRef}/settings/database`);
    console.log('Navigate to "Connection Pooling" and add your IP to the allowed list');
  } catch (error) {
    console.log('Unable to determine your IP address. Please check manually.');
  }
}

// Run the guide generator
const projectRef = generateGuide();
checkIpAccess(projectRef);