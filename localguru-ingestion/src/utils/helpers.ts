export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffFactor: number;
    shouldRetry?: (error: Error) => boolean;
  }
): Promise<T> {
  const { maxAttempts, initialDelayMs, maxDelayMs, backoffFactor, shouldRetry } = options;
  
  let lastError: Error = new Error('Unknown error occurred');
  let currentDelay = initialDelayMs;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      lastError = error;
      
      if (shouldRetry && !shouldRetry(error)) {
        throw error;
      }
      
      if (attempt === maxAttempts) {
        throw error;
      }
      
      await delay(currentDelay);
      currentDelay = Math.min(currentDelay * backoffFactor, maxDelayMs);
    }
  }
  
  throw lastError;
}

export function processArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  
  process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      args[key] = value || 'true';
    }
  });
  
  return args;
} 