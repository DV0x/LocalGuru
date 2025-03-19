// Fix for location transfer in query analysis
// This script updates the query analysis function to ensure locations from entities are included in the top-level locations array

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0";

// Create Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Function to normalize locations
function normalizeLocation(location) {
  // Map of common abbreviations to full names
  const locationMap = {
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

serve(async (req) => {
  try {
    // Handle CORS preflight request
    if (req.method === "OPTIONS") {
      return new Response("ok", {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        },
      });
    }

    // Parse the request body
    const { query } = await req.json();

    // Call the OpenAI API or your existing query analysis function
    // This is a placeholder for your existing analysis logic
    const { data: analysisResult, error } = await supabase.functions.invoke("query-analysis-original", {
      body: JSON.stringify({ query }),
    });

    if (error) throw error;

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

    return new Response(JSON.stringify(analysisResult), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
}); 