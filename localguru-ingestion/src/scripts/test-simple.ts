// Simple test script
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log("Simple test script executed successfully!");
console.log("Environment test:", process.env.SUPABASE_URL ? "SUPABASE_URL exists" : "SUPABASE_URL missing");

// Exit successfully
process.exit(0); 