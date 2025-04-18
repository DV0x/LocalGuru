import { supabase } from './services/supabase';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Create required database functions
 */
async function createDatabaseFunctions() {
  try {
    console.log('Creating database functions...');
    
    // Read the SQL file
    const sqlFilePath = path.join(__dirname, 'sql', 'search_vector_functions.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    // Split the SQL file into individual statements
    const statements = sqlContent.split(';').filter(stmt => stmt.trim().length > 0);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim() + ';';
      console.log(`Executing statement ${i + 1} of ${statements.length}...`);
      
      // Execute the SQL statement
      const { error } = await supabase.rpc('execute_sql', { sql: statement });
      
      if (error) {
        console.error(`Error executing SQL statement ${i + 1}:`, error);
      } else {
        console.log(`Successfully executed statement ${i + 1}`);
      }
    }
    
    console.log('Database functions created successfully');
  } catch (error) {
    console.error('Error creating database functions:', error);
  }
}

// Run the function
createDatabaseFunctions().then(() => {
  console.log('Done');
  process.exit(0);
}).catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 