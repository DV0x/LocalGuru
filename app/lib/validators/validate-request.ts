import { z } from 'zod';

/**
 * Validates request body against a Zod schema
 * @param body The request body to validate
 * @param schema The Zod schema to validate against
 * @returns Object with validation result and error message if validation failed
 */
export async function validateRequestBody<T>(
  body: unknown,
  schema: z.ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const result = schema.safeParse(body);
    
    if (!result.success) {
      // Format Zod error for client consumption
      const formatted = result.error.format();
      const errorMessages = formatZodError(formatted);
      return { success: false, error: errorMessages };
    }
    
    return { success: true, data: result.data };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Invalid request format'
    };
  }
}

/**
 * Formats a Zod error object into a readable string
 * @param error The formatted Zod error
 * @returns Formatted error message
 */
function formatZodError(error: Record<string, any>): string {
  const errors: string[] = [];
  
  // Extract error messages from the formatted error object
  Object.entries(error).forEach(([key, value]) => {
    if (key === '_errors') {
      if (Array.isArray(value) && value.length > 0) {
        errors.push(...value);
      }
    } else if (typeof value === 'object' && value !== null) {
      // Handle nested errors
      const nestedErrors = formatZodError(value);
      if (nestedErrors) {
        errors.push(`${key}: ${nestedErrors}`);
      }
    }
  });
  
  return errors.join(', ');
} 