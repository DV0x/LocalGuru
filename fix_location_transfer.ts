// Fix for location transfer in query analysis
// This script updates the query analysis function to ensure locations from entities are included in the top-level locations array

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Define types for the query analysis result
interface Entities {
  product?: string[];
  brand?: string[];
  feature?: string[];
  price_range?: string[];
  attribute?: string[];
  location?: string[];
  [key: string]: string[] | undefined;
}

interface AnalysisResult {
  id: string | null;
  entities: Entities;
  topics: string[];
  locations: string[];
  intent: string;
  [key: string]: any;
}

// Create Supabase client
const supabaseUrl: string = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey: string = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey);

// Function to normalize locations
function normalizeLocation(location: string): string {
  // Map of common abbreviations to full names
  const locationMap: Record<string, string> = {
    "sf": "San Francisco",
    "nyc": "New York City",
    "la": "Los Angeles",
    "chi": "Chicago",
    "philly": "Philadelphia",
    // Add more mappings as needed
  };

  // Return the mapped value if exists, otherwise return the original
  return locationMap[location.toLowerCase()] || location;
}

export async function fixLocationTransfer(query: string): Promise<AnalysisResult> {
  try {
    // Call the OpenAI API or your existing query analysis function
    // This is a placeholder for your existing analysis logic
    const { data: analysisResult, error } = await supabase.functions.invoke<AnalysisResult>("query-analysis-original", {
      body: { query },
    });

    if (error) throw error;

    if (!analysisResult) {
      throw new Error('No analysis result returned');
    }

    // Fix the location transfer issue
    if (analysisResult && analysisResult.entities && analysisResult.entities.location) {
      // Ensure locations array exists
      if (!analysisResult.locations) {
        analysisResult.locations = [];
      }

      // Transfer location entities to the locations array
      for (const location of analysisResult.entities.location) {
        const normalizedLocation = normalizeLocation(location);
        
        // Only add if not already in the array
        if (!analysisResult.locations.includes(normalizedLocation)) {
          analysisResult.locations.push(normalizedLocation);
        }
      }
    }

    return analysisResult;
  } catch (error) {
    console.error('Error in fixLocationTransfer:', error);
    throw error;
  }
}

// Node.js specific conditional execution
if (typeof require !== 'undefined' && require.main === module) {
  const testQuery = process.argv[2] || "Where to eat in SF?";
  
  fixLocationTransfer(testQuery)
    .then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(error => console.error('Error:', error));
}

export default fixLocationTransfer; 