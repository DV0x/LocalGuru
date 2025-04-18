// src/index.ts
import { processQueue } from './processors/queue-processor';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Main function to run the queue processor
 */
async function main() {
  try {
    console.log('Starting embedding queue processor...');
    
    // Process a batch of items
    const result = await processQueue();
    
    console.log(`Processed ${result.processed} items from the queue`);
    console.log('Queue statistics:', result.queueStats);
    
    if (result.results && result.results.length > 0) {
      const successCount = result.results.filter(r => r.success).length;
      const failCount = result.results.length - successCount;
      console.log(`Success: ${successCount}, Failed: ${failCount}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error in main process:', error);
    process.exit(1);
  }
}

// Run the main function
main(); 