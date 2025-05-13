import { z } from 'zod';

/**
 * Validation schema for the streaming search API endpoint
 */
export const streamingSearchSchema = z.object({
  query: z.string().min(1, "Query is required and cannot be empty").max(500, "Query exceeds maximum length of 500 characters"),
  defaultLocation: z.string().optional(),
  maxResults: z.number().int().positive().max(100).optional().default(50),
  skipCache: z.boolean().optional().default(false),
  promptVersion: z.string().optional().default('localguru_v0'),
  vectorWeight: z.number().min(0).max(1).optional().default(0.7),
  textWeight: z.number().min(0).max(1).optional().default(0.3),
  efSearch: z.number().int().positive().optional().default(300)
}).refine(data => {
  // Ensure vectorWeight and textWeight sum to 1.0
  if (data.vectorWeight && data.textWeight) {
    const sum = data.vectorWeight + data.textWeight;
    return Math.abs(sum - 1.0) < 0.01; // Allow small floating point differences
  }
  return true;
}, {
  message: "vectorWeight and textWeight must sum to 1.0",
  path: ["vectorWeight", "textWeight"]
});

/**
 * Type for validated streaming search request
 */
export type StreamingSearchRequest = z.infer<typeof streamingSearchSchema>; 