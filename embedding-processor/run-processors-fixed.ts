import { spawn } from 'child_process';
import * as path from 'path';

// Set the correct connection string directly (without relying on dotenv)
process.env.DATABASE_URL = "postgresql://postgres.ghjbtvyalvigvmuodaas:ch%40924880194792@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres";

console.log('Starting processors with correctly encoded DATABASE_URL...');

// Spawn the original start-processors.ts script with the fixed environment
const startProcessors = spawn('npx', ['ts-node', 'scripts/start-processors.ts'], {
  env: process.env,
  stdio: 'inherit',
  cwd: process.cwd()
});

// Handle the process events
startProcessors.on('close', (code) => {
  console.log(`Processors exited with code ${code}`);
});

startProcessors.on('error', (err) => {
  console.error('Failed to start processors:', err);
}); 