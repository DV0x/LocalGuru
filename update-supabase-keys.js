const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Path to the .env files
const envFilePath = path.resolve(process.cwd(), '.env');
const envLocalFilePath = path.resolve(process.cwd(), '.env.local');

// Function to update API keys in a file
function updateApiKeys(filePath, apiUrl, serviceRoleKey, anonKey) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`File ${filePath} does not exist. Skipping.`);
      return;
    }

    // Read the file content
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Update the URLs
    if (apiUrl) {
      if (content.includes('SUPABASE_URL=')) {
        content = content.replace(/SUPABASE_URL=.*(\r?\n|$)/g, `SUPABASE_URL=${apiUrl}$1`);
      } else {
        content += `\nSUPABASE_URL=${apiUrl}\n`;
      }
      
      if (content.includes('NEXT_PUBLIC_SUPABASE_URL=')) {
        content = content.replace(/NEXT_PUBLIC_SUPABASE_URL=.*(\r?\n|$)/g, `NEXT_PUBLIC_SUPABASE_URL=${apiUrl}$1`);
      } else {
        content += `NEXT_PUBLIC_SUPABASE_URL=${apiUrl}\n`;
      }
    }
    
    // Update the service role key
    if (serviceRoleKey) {
      if (content.includes('SUPABASE_SERVICE_ROLE_KEY=')) {
        content = content.replace(/SUPABASE_SERVICE_ROLE_KEY=.*(\r?\n|$)/g, `SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}$1`);
      } else {
        content += `SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}\n`;
      }
    }
    
    // Update the anon key
    if (anonKey) {
      if (content.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) {
        content = content.replace(/NEXT_PUBLIC_SUPABASE_ANON_KEY=.*(\r?\n|$)/g, `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey}$1`);
      } else {
        content += `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey}\n`;
      }
    }
    
    // Write the updated content back to the file
    fs.writeFileSync(filePath, content);
    console.log(`✅ Updated ${filePath} with new API keys`);
  } catch (error) {
    console.error(`❌ Error updating ${filePath}:`, error.message);
  }
}

// Function to get user input
function promptUser() {
  console.log('Supabase API Key Update Utility');
  console.log('==============================');
  console.log('\nThis utility will update your Supabase API keys in .env and .env.local files.');
  console.log('You need to provide fresh API keys from your Supabase dashboard.');
  console.log('\nLeave blank and press ENTER if you don\'t want to update a particular value.');
  
  // Get the project URL
  rl.question('\nEnter your Supabase project URL (e.g. https://yourproject.supabase.co): ', (apiUrl) => {
    // Get the service role key
    rl.question('Enter your service role key (JWT format starting with "eyJ"): ', (serviceRoleKey) => {
      // Get the anon key
      rl.question('Enter your anon/public key (JWT format starting with "eyJ"): ', (anonKey) => {
        // Confirm the changes
        console.log('\nYou provided:');
        console.log('- API URL:', apiUrl || '(unchanged)');
        console.log('- Service Role Key:', serviceRoleKey ? serviceRoleKey.substring(0, 10) + '...' : '(unchanged)');
        console.log('- Anon Key:', anonKey ? anonKey.substring(0, 10) + '...' : '(unchanged)');
        
        rl.question('\nUpdate environment files with these values? (y/n): ', (answer) => {
          if (answer.toLowerCase() === 'y') {
            // Update both .env and .env.local files
            updateApiKeys(envFilePath, apiUrl, serviceRoleKey, anonKey);
            updateApiKeys(envLocalFilePath, apiUrl, serviceRoleKey, anonKey);
            console.log('\n✅ API keys updated successfully!');
            console.log('Don\'t forget to restart your development server for changes to take effect.');
          } else {
            console.log('\nUpdate cancelled. No changes were made.');
          }
          rl.close();
        });
      });
    });
  });
}

// Start the utility
promptUser(); 