require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

// Fix the database URL encoding
function fixDatabaseUrl() {
  // Original connection string with unencoded @ symbol
  const originalUrl = "postgresql://postgres.ghjbtvyalvigvmuodaas:ch@924880194792@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres";
  
  // Fix by properly encoding the @ in the password
  const fixedUrl = "postgresql://postgres.ghjbtvyalvigvmuodaas:ch%40924880194792@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres";
  
  // Update both environment files
  const envFiles = ['.env', '.env.local', 'embedding-processor/.env', 'queue-processor/.env'];
  
  for (const filePath of envFiles) {
    try {
      if (!fs.existsSync(filePath)) {
        console.log(`File ${filePath} not found, skipping.`);
        continue;
      }
      
      let content = fs.readFileSync(filePath, 'utf8');
      
      // Replace unencoded URL with encoded one
      if (content.includes(originalUrl)) {
        content = content.replace(originalUrl, fixedUrl);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ Fixed database URL in ${filePath}`);
      } else if (content.includes('SUPABASE_DB_URL=') || content.includes('DATABASE_URL=')) {
        // Ensure we have the properly encoded version
        content = content.replace(/(SUPABASE_DB_URL=).*(\r?\n|$)/g, `$1${fixedUrl}$2`);
        content = content.replace(/(DATABASE_URL=).*(\r?\n|$)/g, `$1${fixedUrl}$2`);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ Updated database URL in ${filePath}`);
      } else {
        console.log(`ℹ️ No database URL found in ${filePath}`);
      }
    } catch (error) {
      console.error(`Error updating ${filePath}:`, error.message);
    }
  }
}

// Main function
function main() {
  console.log('LocalGuru Database URL Fix Tool');
  console.log('=============================');
  
  console.log('\nFixing database connection strings...');
  fixDatabaseUrl();
  
  console.log('\n✅ Fix complete! Please run your application with: npm run dev');
  console.log('If issues persist, you may need to restart your terminal or check Supabase dashboard for fresh API keys.');
}

main();