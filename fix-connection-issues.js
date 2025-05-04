const fs = require('fs');
const path = require('path');
const readline = require('readline');
require('dotenv').config();

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Path to the .env files
const envFilePath = path.resolve(process.cwd(), '.env');
const envLocalFilePath = path.resolve(process.cwd(), '.env.local');

// Current values
console.log('LocalGuru Connection Fix Tool');
console.log('============================');
console.log('\nCurrent Configuration:');
console.log(`SUPABASE_URL: ${process.env.SUPABASE_URL || 'Not set'}`);
console.log(`NEXT_PUBLIC_SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL || 'Not set'}`);
console.log(`SUPABASE_SERVICE_ROLE_KEY length: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? process.env.SUPABASE_SERVICE_ROLE_KEY.length : 'Not set'}`);
console.log(`NEXT_PUBLIC_SUPABASE_ANON_KEY length: ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length : 'Not set'}`);
console.log(`DATABASE_URL starts with: ${process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 30) + '...' : 'Not set'}`);
console.log(`SUPABASE_DB_URL starts with: ${process.env.SUPABASE_DB_URL ? process.env.SUPABASE_DB_URL.substring(0, 30) + '...' : 'Not set'}`);

// Function to update a file with all possible connection variables
function updateConnectionVariables(filePath, options) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`File ${filePath} does not exist. Skipping.`);
      return;
    }

    // Read the file content
    let content = fs.readFileSync(filePath, 'utf8');
    let updates = 0;
    
    // Update Supabase URLs
    if (options.apiUrl) {
      if (content.includes('SUPABASE_URL=')) {
        content = content.replace(/SUPABASE_URL=.*(\r?\n|$)/g, `SUPABASE_URL=${options.apiUrl}$1`);
        updates++;
      } else {
        content += `\nSUPABASE_URL=${options.apiUrl}\n`;
        updates++;
      }
      
      if (content.includes('NEXT_PUBLIC_SUPABASE_URL=')) {
        content = content.replace(/NEXT_PUBLIC_SUPABASE_URL=.*(\r?\n|$)/g, `NEXT_PUBLIC_SUPABASE_URL=${options.apiUrl}$1`);
        updates++;
      } else {
        content += `NEXT_PUBLIC_SUPABASE_URL=${options.apiUrl}\n`;
        updates++;
      }
    }
    
    // Update Supabase API keys
    if (options.serviceRoleKey) {
      if (content.includes('SUPABASE_SERVICE_ROLE_KEY=')) {
        content = content.replace(/SUPABASE_SERVICE_ROLE_KEY=.*(\r?\n|$)/g, `SUPABASE_SERVICE_ROLE_KEY=${options.serviceRoleKey}$1`);
        updates++;
      } else {
        content += `SUPABASE_SERVICE_ROLE_KEY=${options.serviceRoleKey}\n`;
        updates++;
      }
    }
    
    if (options.anonKey) {
      if (content.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) {
        content = content.replace(/NEXT_PUBLIC_SUPABASE_ANON_KEY=.*(\r?\n|$)/g, `NEXT_PUBLIC_SUPABASE_ANON_KEY=${options.anonKey}$1`);
        updates++;
      } else {
        content += `NEXT_PUBLIC_SUPABASE_ANON_KEY=${options.anonKey}\n`;
        updates++;
      }
    }
    
    // Update database connection strings
    if (options.dbUrl) {
      if (content.includes('DATABASE_URL=')) {
        content = content.replace(/DATABASE_URL=.*(\r?\n|$)/g, `DATABASE_URL=${options.dbUrl}$1`);
        updates++;
      } else {
        content += `\nDATABASE_URL=${options.dbUrl}\n`;
        updates++;
      }
      
      if (content.includes('SUPABASE_DB_URL=')) {
        content = content.replace(/SUPABASE_DB_URL=.*(\r?\n|$)/g, `SUPABASE_DB_URL=${options.dbUrl}$1`);
        updates++;
      } else {
        content += `SUPABASE_DB_URL=${options.dbUrl}\n`;
        updates++;
      }
    }
    
    // Write the updated content back to the file
    fs.writeFileSync(filePath, content);
    console.log(`✅ Updated ${filePath} with ${updates} changes`);
  } catch (error) {
    console.error(`❌ Error updating ${filePath}:`, error.message);
  }
}

// Function to fix connection string
function fixConnectionString(connectionString) {
  try {
    // Extract connection parts
    const match = connectionString.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
    
    if (!match) {
      console.log('Could not parse connection string format');
      return connectionString;
    }
    
    const [, username, password, host, port, database] = match;
    
    // Properly encode the password
    const encodedPassword = encodeURIComponent(password);
    
    // Rebuild the connection string
    const fixedString = `postgresql://${username}:${encodedPassword}@${host}:${port}/${database}`;
    
    console.log('Fixed connection string (passwords encoded properly)');
    return fixedString;
  } catch (error) {
    console.error('Error fixing connection string:', error.message);
    return connectionString;
  }
}

// Function to get user input
function promptUser() {
  console.log('\nThis utility will fix both your Supabase API keys and database connection issues.');
  console.log('You will need to get fresh API keys from your Supabase dashboard.');
  
  rl.question('\nDo you want to update your Supabase API keys? (y/n): ', (updateKeys) => {
    if (updateKeys.toLowerCase() === 'y') {
      // Get the project URL
      rl.question('\nEnter your Supabase project URL (e.g. https://yourproject.supabase.co): ', (apiUrl) => {
        // Get the service role key
        rl.question('Enter your service role key (JWT format starting with "eyJ"): ', (serviceRoleKey) => {
          // Get the anon key
          rl.question('Enter your anon/public key: ', (anonKey) => {
            // Now get the database connection string
            rl.question('\nDo you want to update your database connection string? (y/n): ', (updateDbUrl) => {
              if (updateDbUrl.toLowerCase() === 'y') {
                const defaultDbUrl = process.env.DATABASE_URL || '';
                rl.question(`Enter your PostgreSQL connection string\n[current: ${defaultDbUrl ? defaultDbUrl.substring(0, 30) + '...' : 'none'}]: `, (dbUrl) => {
                  // Prepare the options
                  const options = {
                    apiUrl: apiUrl || undefined,
                    serviceRoleKey: serviceRoleKey || undefined,
                    anonKey: anonKey || undefined,
                    dbUrl: dbUrl ? fixConnectionString(dbUrl) : undefined
                  };
                  
                  // Update both files
                  updateConnectionVariables(envFilePath, options);
                  updateConnectionVariables(envLocalFilePath, options);
                  
                  console.log('\n✅ All connection settings have been updated!');
                  console.log('Please restart your application for changes to take effect.');
                  rl.close();
                });
              } else {
                // Prepare options without database URL
                const options = {
                  apiUrl: apiUrl || undefined,
                  serviceRoleKey: serviceRoleKey || undefined,
                  anonKey: anonKey || undefined
                };
                
                // Update both files
                updateConnectionVariables(envFilePath, options);
                updateConnectionVariables(envLocalFilePath, options);
                
                console.log('\n✅ API keys have been updated!');
                console.log('Please restart your application for changes to take effect.');
                rl.close();
              }
            });
          });
        });
      });
    } else {
      // Only fix database connection string
      rl.question('\nDo you want to update your database connection string? (y/n): ', (updateDbUrl) => {
        if (updateDbUrl.toLowerCase() === 'y') {
          const defaultDbUrl = process.env.DATABASE_URL || '';
          rl.question(`Enter your PostgreSQL connection string\n[current: ${defaultDbUrl ? defaultDbUrl.substring(0, 30) + '...' : 'none'}]: `, (dbUrl) => {
            const options = {
              dbUrl: dbUrl ? fixConnectionString(dbUrl) : undefined
            };
            
            updateConnectionVariables(envFilePath, options);
            updateConnectionVariables(envLocalFilePath, options);
            
            console.log('\n✅ Database connection string has been updated!');
            console.log('Please restart your application for changes to take effect.');
            rl.close();
          });
        } else {
          console.log('\nNo changes have been made.');
          rl.close();
        }
      });
    }
  });
}

// Special fix for default connection string
function fixExistingConnectionString() {
  // Check if we have a connection string to fix
  const currentDbUrl = process.env.DATABASE_URL;
  if (currentDbUrl && currentDbUrl.includes('ch@924880194792')) {
    console.log('\n⚠️ Detected an unencoded @ symbol in your database password!');
    console.log('This is likely causing your connection issues.');
    
    rl.question('Would you like to automatically fix this issue? (y/n): ', (answer) => {
      if (answer.toLowerCase() === 'y') {
        const fixedUrl = fixConnectionString(currentDbUrl);
        const options = { dbUrl: fixedUrl };
        
        updateConnectionVariables(envFilePath, options);
        updateConnectionVariables(envLocalFilePath, options);
        
        console.log('\n✅ Fixed database connection string!');
        console.log('The @ symbol in the password is now properly URL encoded as %40');
        
        // Continue with the main flow
        promptUser();
      } else {
        // Continue with the main flow
        promptUser();
      }
    });
  } else {
    // No issue detected, continue with the main flow
    promptUser();
  }
}

// Start by fixing the existing connection string if necessary
fixExistingConnectionString(); 