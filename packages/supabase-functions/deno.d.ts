// Type definitions for Deno APIs used in Supabase Edge Functions

declare namespace Deno {
  export function serve(handler: (request: Request) => Response | Promise<Response>): void;
  
  export const env: {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    toObject(): Record<string, string>;
  };
}

// Support npm: import specifiers
declare module 'npm:*';
declare module 'jsr:*';

// Add types for Node.js built-ins that might be used with the node: specifier
declare module 'node:*'; 