// check-functions.ts
// Quick script to check available database functions
import * as dotenv from 'dotenv'
import pkg from 'pg';
const { Pool } = pkg;

// Load environment variables
dotenv.config();

// Initialize Postgres pool
const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL
});

async function checkFunctions() {
  try {
    console.log('🔍 Checking embedding functions...');
    
    // Get all content embedding functions
    const functionsResult = await pool.query(`
      SELECT 
        routine_name, 
        pg_get_function_arguments(p.oid) AS args
      FROM information_schema.routines r
      JOIN pg_proc p ON p.proname = r.routine_name
      WHERE routine_schema = 'public' 
        AND routine_type = 'FUNCTION'
        AND routine_name LIKE '%content%embedding%'
      ORDER BY routine_name;
    `);
    
    console.log('\n📊 Available content embedding functions:');
    if (functionsResult.rows.length === 0) {
      console.log('No content embedding functions found!');
    } else {
      functionsResult.rows.forEach(func => {
        console.log(`- ${func.routine_name}(${func.args})`);
      });
    }
    
    // Check the content_function column in the queue
    const queueResult = await pool.query(`
      SELECT 
        table_name,
        content_function, 
        COUNT(*) as count
      FROM util.embedding_queue
      WHERE status = 'failed'
      GROUP BY table_name, content_function
      ORDER BY count DESC;
    `);
    
    console.log('\n📊 Content functions used in failed queue items:');
    if (queueResult.rows.length === 0) {
      console.log('No failed queue items found!');
    } else {
      queueResult.rows.forEach(row => {
        console.log(`- ${row.content_function} (table: ${row.table_name}, count: ${row.count})`);
      });
    }
    
    // Check some example failed records
    const failedExamplesResult = await pool.query(`
      SELECT 
        id, 
        record_id, 
        table_name, 
        content_function,
        last_error
      FROM util.embedding_queue
      WHERE status = 'failed'
      ORDER BY processed_at DESC
      LIMIT 5;
    `);
    
    console.log('\n📊 Examples of failed queue items:');
    if (failedExamplesResult.rows.length === 0) {
      console.log('No failed queue items found!');
    } else {
      failedExamplesResult.rows.forEach(row => {
        console.log(`- ID: ${row.id}, Table: ${row.table_name}, Record: ${row.record_id}`);
        console.log(`  Function: ${row.content_function}`);
        console.log(`  Error: ${row.last_error || 'No error message'}`);
        console.log('---');
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the script
checkFunctions(); 