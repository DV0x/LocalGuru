// Type declarations for Deno modules
declare module 'https://deno.land/std@0.168.0/http/server.ts' {
  export function serve(handler: (request: Request) => Response | Promise<Response>): void;
}

declare module 'https://esm.sh/@supabase/supabase-js@2' {
  export function createClient(supabaseUrl: string, supabaseKey: string): any;
}

declare module 'https://esm.sh/openai@4' {
  export class OpenAI {
    constructor(options: { apiKey: string });
    chat: {
      completions: {
        create(options: any): Promise<any>;
      };
    };
  }
} 