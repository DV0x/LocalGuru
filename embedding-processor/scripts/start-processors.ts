// scripts/start-processors.ts
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as os from 'os';

// Rate Limit Configuration for Tier 1
// Adjust these values based on your tier and model usage
const TIER_CONFIG = {
  // Default to Tier 1 limits
  GPT_3_5_TURBO: {
    RPM: 3500,           // Requests per minute
    TPM: 90000,          // Tokens per minute
    AVG_TOKENS_PER_REQ: 1500,  // Average tokens per request (prompt + completion)
    SAFETY_MARGIN: 0.85  // Use 85% of the limit to be safe
  }
};

// Configuration with smart defaults and environment variable overrides
const CONFIG = {
  // Processor settings
  PROCESSOR_COUNT: Number(process.env.PROCESSOR_COUNT) || Math.min(os.cpus().length - 1, 4),
  BATCH_SIZE: Number(process.env.BATCH_SIZE) || 5,
  
  // Rate limiting settings
  MIN_DELAY_BETWEEN_BATCHES_MS: Number(process.env.MIN_DELAY_BETWEEN_BATCHES_MS) || 500,
  DYNAMIC_DELAY: process.env.DYNAMIC_DELAY !== 'false',
  
  // Runtime settings
  MAX_RUNTIME_HOURS: Number(process.env.MAX_RUNTIME_HOURS) || 24,
  
  // Stagger start to avoid initial burst
  STAGGER_START_MS: Number(process.env.STAGGER_START_MS) || 2000,
  
  // Rate limit recovery
  RATE_LIMIT_RECOVERY_WAIT_MS: Number(process.env.RATE_LIMIT_RECOVERY_WAIT_MS) || 70000, // Wait slightly over 1 minute (70 seconds)
  MAX_RATE_LIMIT_RETRIES: Number(process.env.MAX_RATE_LIMIT_RETRIES) || 5 // Maximum number of auto-restarts after rate limits
};

// Calculate optimal delay based on rate limits, processor count and batch size
function calculateOptimalDelay() {
  const limits = TIER_CONFIG.GPT_3_5_TURBO;
  
  // Calculate based on requests per minute
  const requestsPerProcessor = CONFIG.BATCH_SIZE;
  const totalRequestsPerRun = requestsPerProcessor * CONFIG.PROCESSOR_COUNT;
  const maxRequestsPerMinute = limits.RPM * limits.SAFETY_MARGIN;
  const requestBasedDelay = (totalRequestsPerRun * 60000) / maxRequestsPerMinute;
  
  // Calculate based on tokens per minute
  const tokensPerProcessor = CONFIG.BATCH_SIZE * limits.AVG_TOKENS_PER_REQ;
  const totalTokensPerRun = tokensPerProcessor * CONFIG.PROCESSOR_COUNT;
  const maxTokensPerMinute = limits.TPM * limits.SAFETY_MARGIN;
  const tokenBasedDelay = (totalTokensPerRun * 60000) / maxTokensPerMinute;
  
  // Take the more restrictive delay
  const calculatedDelay = Math.max(requestBasedDelay, tokenBasedDelay);
  
  // Never go below minimum delay
  return Math.max(CONFIG.MIN_DELAY_BETWEEN_BATCHES_MS, calculatedDelay);
}

// Calculate optimal settings
const OPTIMAL_DELAY_MS = calculateOptimalDelay();
const ESTIMATED_ITEMS_PER_MINUTE = Math.floor(60000 / OPTIMAL_DELAY_MS * CONFIG.BATCH_SIZE * CONFIG.PROCESSOR_COUNT);

// Log configuration
console.log(`=== RATE-LIMITED PARALLEL PROCESSOR ===`);
console.log(`Starting ${CONFIG.PROCESSOR_COUNT} processors with batch size ${CONFIG.BATCH_SIZE}`);
console.log(`Delay between batches: ${OPTIMAL_DELAY_MS}ms`);
console.log(`Estimated throughput: ~${ESTIMATED_ITEMS_PER_MINUTE} items/minute`);
console.log(`Max runtime: ${CONFIG.MAX_RUNTIME_HOURS} hours`);
console.log(`Rate limits (Tier 1): ${TIER_CONFIG.GPT_3_5_TURBO.RPM} RPM, ${TIER_CONFIG.GPT_3_5_TURBO.TPM} TPM`);
console.log(`AUTO-RESTART: Will wait ${CONFIG.RATE_LIMIT_RECOVERY_WAIT_MS/1000} seconds on rate limit errors and restart automatically (max ${CONFIG.MAX_RATE_LIMIT_RETRIES} times)`);

// Flag to track if rate limits have been hit
let rateLimitsHit = false;
let activeProcessors = 0;
let totalProcessed = 0;
let rateLimitRetries = 0;

// Create a shared worker pool (semaphore) to control concurrency
class ProcessorPool {
  private isShuttingDown = false;
  
  constructor(private maxProcessors: number) {
    console.log(`Pool initialized with ${maxProcessors} max concurrent processors`);
  }
  
  async startAll() {
    const startPromises = [];
    
    for (let i = 0; i < this.maxProcessors; i++) {
      // Stagger processor starts to avoid initial burst
      const startDelay = i * CONFIG.STAGGER_START_MS;
      startPromises.push(
        new Promise(resolve => setTimeout(() => {
          this.startProcessor(i).then(resolve);
        }, startDelay))
      );
    }
    
    await Promise.all(startPromises);
    console.log(`All processors completed`);
    
    // Check if we hit rate limits and should restart
    if (rateLimitsHit && rateLimitRetries < CONFIG.MAX_RATE_LIMIT_RETRIES) {
      rateLimitRetries++;
      console.log(`\n⏱️ RATE LIMITS HIT: Waiting ${CONFIG.RATE_LIMIT_RECOVERY_WAIT_MS/1000} seconds before restarting (attempt ${rateLimitRetries}/${CONFIG.MAX_RATE_LIMIT_RETRIES})...`);
      
      setTimeout(() => {
        console.log(`\n🔄 RESTARTING PROCESSORS after rate limit wait period...`);
        rateLimitsHit = false;
        activeProcessors = 0;
        this.isShuttingDown = false;
        this.startAll();
      }, CONFIG.RATE_LIMIT_RECOVERY_WAIT_MS);
    } else if (rateLimitsHit) {
      console.log(`\n⛔ MAX RETRIES REACHED: Hit rate limits ${rateLimitRetries} times. Please check your API usage and try again later.`);
    }
  }
  
  triggerShutdown() {
    if (!this.isShuttingDown) {
      this.isShuttingDown = true;
      console.log(`\n⛔ SHUTDOWN TRIGGERED: Gracefully stopping all processors...`);
    }
  }
  
  async startProcessor(processorId: number): Promise<void> {
    const startTime: number = Date.now();
    const maxRuntimeMs: number = CONFIG.MAX_RUNTIME_HOURS * 60 * 60 * 1000;
    let processedCount: number = 0;
    let consecutiveEmptyBatches: number = 0;
    
    console.log(`[Processor ${processorId}] Starting queue processor`);
    activeProcessors++;
    
    try {
      while (Date.now() - startTime < maxRuntimeMs && !this.isShuttingDown && !rateLimitsHit) {
        try {
          // Run the process-queue command
          const process: ChildProcess = spawn('npm', ['run', 'process-queue', CONFIG.BATCH_SIZE.toString()], {
            cwd: path.resolve(__dirname, '..'),
            stdio: 'pipe'
          });
          
          let output: string = '';
          let errorOutput: string = '';
          
          process.stdout?.on('data', (data: Buffer) => {
            const text: string = data.toString();
            output += text;
            console.log(`[Processor ${processorId}] ${text.trim()}`);
            
            // Check for rate limit errors in stdout
            if (this.checkForRateLimitError(text)) {
              rateLimitsHit = true;
              process.kill();
            }
          });
          
          process.stderr?.on('data', (data: Buffer) => {
            const text: string = data.toString();
            errorOutput += text;
            console.error(`[Processor ${processorId}] Error: ${text.trim()}`);
            
            // Also check stderr for rate limit errors
            if (this.checkForRateLimitError(text)) {
              rateLimitsHit = true;
              process.kill();
            }
          });
          
          // Wait for the process to complete
          await new Promise<void>((resolve) => {
            process.on('close', (code: number | null) => {
              if (rateLimitsHit || this.isShuttingDown) {
                resolve();
                return;
              }
              
              if (code === 0) {
                // Extract the number of processed items
                const processedMatch = output.match(/Processed (\d+) items/);
                const itemsProcessed = processedMatch && processedMatch[1] ? parseInt(processedMatch[1], 10) : 0;
                
                processedCount += itemsProcessed;
                totalProcessed += itemsProcessed;
                
                console.log(`[Processor ${processorId}] Total: ${processedCount} | All processors: ${totalProcessed}`);
                
                // Check if we processed any items
                if (itemsProcessed === 0) {
                  consecutiveEmptyBatches++;
                  
                  // If we've had several empty batches, slow down to avoid wasting resources
                  if (consecutiveEmptyBatches >= 5) {
                    console.log(`[Processor ${processorId}] Multiple empty batches, increasing delay...`);
                    setTimeout(resolve, OPTIMAL_DELAY_MS * 3);
                    return;
                  }
                } else {
                  consecutiveEmptyBatches = 0;
                }
                
                // Use dynamic delay based on whether we got a full batch or not
                const dynamicDelay = CONFIG.DYNAMIC_DELAY
                  ? (itemsProcessed === CONFIG.BATCH_SIZE ? OPTIMAL_DELAY_MS : OPTIMAL_DELAY_MS * 1.5)
                  : OPTIMAL_DELAY_MS;
                  
                setTimeout(resolve, dynamicDelay);
                return;
              }
              
              // On error, use a longer delay
              console.error(`[Processor ${processorId}] Process exited with code ${code}`);
              setTimeout(resolve, OPTIMAL_DELAY_MS * 2);
            });
          });
          
          // If shutting down, break the loop
          if (rateLimitsHit || this.isShuttingDown) {
            break;
          }
          
        } catch (error) {
          console.error(`[Processor ${processorId}] Error running queue processor:`, error);
          // Wait longer on error
          await new Promise<void>(resolve => setTimeout(resolve, OPTIMAL_DELAY_MS * 3));
        }
      }
    } finally {
      activeProcessors--;
      
      if (rateLimitsHit) {
        console.log(`[Processor ${processorId}] Shutting down due to rate limits being hit.`);
        this.triggerShutdown();
      } else if (this.isShuttingDown) {
        console.log(`[Processor ${processorId}] Shutting down due to shutdown signal.`);
      } else {
        console.log(`[Processor ${processorId}] Max runtime reached (${CONFIG.MAX_RUNTIME_HOURS} hours). Shutting down.`);
      }
      
      console.log(`[Processor ${processorId}] Total items processed: ${processedCount}`);
    }
  }
  
  private checkForRateLimitError(text: string): boolean {
    return (
      text.includes('Rate limit reached') || 
      text.includes('RateLimitError') || 
      text.includes('429') ||
      text.includes('rate_limit_exceeded') ||
      // Add checks for connection errors
      text.includes('APIConnectionError') ||
      text.includes('Connection error') ||
      text.includes('ECONNRESET') ||
      text.includes('ETIMEDOUT') ||
      text.includes('socket hang up') ||
      text.includes('network error')
    );
  }
}

// Create pool and start processors
const pool = new ProcessorPool(CONFIG.PROCESSOR_COUNT);

// Start all processors
pool.startAll().catch(error => {
  console.error('Fatal error starting processors:', error);
  process.exit(1);
});

// Add signal handlers for clean shutdown
process.on('SIGINT', () => {
  console.log('\nSIGINT received. Shutting down processors...');
  pool.triggerShutdown();
});

process.on('SIGTERM', () => {
  console.log('\nSIGTERM received. Shutting down processors...');
  pool.triggerShutdown();
});

// Monitor for rate limits or shutdown
setInterval(() => {
  // Display stats every 30 seconds
  console.log(`=== STATUS: ${activeProcessors} active processors, ${totalProcessed} total items processed ===`);
}, 30000); 