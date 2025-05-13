import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.39.3';
// Update OpenAI import to match working example
import OpenAI from 'npm:openai@4.28.0';
// Import our social connection intent enhancement and the QueryIntent type
import { enhanceIntentDetection, QueryIntent } from './enhanced-intent-detection.ts';

// Add debug logging for environment variables
console.log("DEBUG: Query Analysis Environment check");
console.log("SUPABASE_URL present:", !!Deno.env.get('SUPABASE_URL'));
console.log("SUPABASE_SERVICE_ROLE_KEY present:", !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
console.log("OPENAI_API_KEY present:", !!Deno.env.get('OPENAI_API_KEY'));
console.log("CUSTOM_SUPABASE_URL present:", !!Deno.env.get('CUSTOM_SUPABASE_URL'));

// Types for query analysis
// Use the QueryIntent type imported from enhanced-intent-detection.ts
// export type QueryIntent = 'recommendation' | 'information' | 'comparison' | 'experience' | 'local_events' | 'how_to' | 'discovery' | 'general';

interface QueryAnalysisResult {
  entities: Record<string, string[]>;
  topics: string[];
  locations: string[];
  intent: QueryIntent;
}

console.info('Query Analysis function started');

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { query, userId, defaultLocation } = await req.json();
    
    if (!query || typeof query !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Query parameter is required and must be a string' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Log the request for debugging
    console.log(`Query: "${query}"${defaultLocation ? `, Default: ${defaultLocation}` : ''}`);

    // Create Supabase client
    const supabaseUrl = Deno.env.get('CUSTOM_SUPABASE_URL') ?? Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // Create OpenAI client with proper error handling
    let openai;
    try {
      openai = new OpenAI({
        apiKey: Deno.env.get('OPENAI_API_KEY') ?? '',
      });
    } catch (error) {
      console.error('Error initializing OpenAI client:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Error initializing OpenAI client', 
          details: error instanceof Error ? error.message : String(error) 
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Analyze query
    const rawQueryAnalysis = await analyzeQuery(query, openai);
    
    // Enhance the analysis with additional processing
    const queryAnalysis = enhanceQueryAnalysis(rawQueryAnalysis, query);
    
    // Handle the default location integration
    if (defaultLocation) {
      handleDefaultLocation(queryAnalysis, defaultLocation);
    }
    
    // Store the analysis in the database
    const { data: analysisId, error: storeError } = await supabaseClient.rpc(
      'query_analysis',
      {
        p_query: query,
        p_entities: queryAnalysis.entities,
        p_topics: queryAnalysis.topics,
        p_locations: queryAnalysis.locations,
        p_intent: queryAnalysis.intent,
        p_enhanced_queries: [],  // Passing empty array since we're not generating enhanced queries
        p_user_id: userId || null
      }
    );

    if (storeError) {
      console.error('Error storing query analysis:', storeError);
    }

    // Return the query analysis
    return new Response(
      JSON.stringify({
        id: analysisId,
        ...queryAnalysis,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error: unknown) {
    console.error('Error processing query analysis:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Error processing query analysis', 
        details: error instanceof Error ? error.message : String(error) 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

/**
 * Analyzes a search query to extract entities, topics, locations, and intent
 */
async function analyzeQuery(
  query: string,
  openai: OpenAI
): Promise<QueryAnalysisResult> {
  const prompt = `
Analyze the following search query and extract structured information about it:
"${query}"

Provide your analysis in the following JSON format:
{
  "entities": {
    "product": ["product names mentioned"],
    "brand": ["brand names mentioned"],
    "feature": ["features mentioned"],
    "price_range": ["price ranges mentioned"],
    "attribute": ["any other attributes mentioned"]
  },
  "topics": ["list of general topics this query relates to"],
  "locations": ["any locations mentioned in the query"],
  "intent": "one of: recommendation, information, comparison, experience, local_events, how_to, discovery, general"
}

For "entities", only include categories that are actually present in the query.
For "intent":
- recommendation: user wants suggestions or recommendations
- information: user wants factual information
- comparison: user wants to compare options
- experience: user is asking about personal experiences
- local_events: user is searching for local events or activities in an area
- how_to: user is asking for instructions or guidance on completing a task
- discovery: user is exploring or wanting to discover new options/places
- general: general queries that don't fit the other categories

Pay special attention to dietary preferences (vegan, vegetarian, gluten-free, etc.) and include them in topics.

Provide only the JSON, with no additional text.
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    response_format: { type: 'json_object' }
  });

  try {
    const content = response.choices[0]?.message?.content || '{}';
    const result = JSON.parse(content);
    
    // Ensure we have the required fields with default values if missing
    return {
      entities: result.entities || {},
      topics: result.topics || [],
      locations: result.locations || [],
      intent: (result.intent as QueryIntent) || 'general',
    };
  } catch (error) {
    console.error('Error parsing OpenAI response:', error);
    // Return default values if parsing fails
    return {
      entities: {},
      topics: [],
      locations: [],
      intent: 'general',
    };
  }
}

/**
 * Enhances query analysis results by detecting important attributes that
 * might have been missed by the initial analysis.
 */
function enhanceQueryAnalysis(analysisResult: QueryAnalysisResult, query: string): QueryAnalysisResult {
  // Create a deep copy to avoid modifying the original
  const enhancedAnalysis = JSON.parse(JSON.stringify(analysisResult)) as QueryAnalysisResult;
  
  // Detect and add dietary preferences
  enhanceDietaryPreferences(enhancedAnalysis, query);
  
  // Detect and add price sensitivity
  enhancePriceSensitivity(enhancedAnalysis, query);
  
  // Detect and add time relevance
  enhanceTimeRelevance(enhancedAnalysis, query);
  
  // Transfer locations from entities to the locations array
  transferLocationsFromEntities(enhancedAnalysis);
  
  // Apply social connection intent enhancement
  const socialConnectionEnhanced = enhanceIntentDetection(query, enhancedAnalysis);
  
  return socialConnectionEnhanced;
}

/**
 * Enhances analysis with dietary preference detection
 */
function enhanceDietaryPreferences(analysis: QueryAnalysisResult, query: string): void {
  const lowerQuery = query.toLowerCase();
  
  // Comprehensive list of dietary terms
  const dietaryTerms = [
    {term: 'vegan', variations: ['vegan', 'plant-based', 'no animal products']},
    {term: 'vegetarian', variations: ['vegetarian', 'no meat']},
    {term: 'gluten-free', variations: ['gluten-free', 'gluten free', 'no gluten', 'celiac']},
    {term: 'dairy-free', variations: ['dairy-free', 'dairy free', 'no dairy', 'lactose-free', 'lactose intolerant']},
    {term: 'keto', variations: ['keto', 'ketogenic', 'low-carb']},
    {term: 'paleo', variations: ['paleo', 'paleolithic']},
    {term: 'pescatarian', variations: ['pescatarian', 'fish but no meat']}
  ];
  
  dietaryTerms.forEach(({ term, variations }) => {
    // Check for direct mentions of the term or variations
    const hasTerm = variations.some(variation => lowerQuery.includes(variation));
    
    // Check for "I am a..." pattern (and variations)
    const identityPatterns = [
      new RegExp(`I(?:'m| am)(?: an?)? ${term}`, 'i'),
      new RegExp(`I(?:'m| am)(?: a)? ${term}`, 'i'),
      new RegExp(`(?:as|being)(?: a| an)? ${term}`, 'i'),
    ];
    
    const hasIdentityPattern = identityPatterns.some(pattern => pattern.test(query));
    
    // Add the term as a topic if detected and not already present
    if ((hasTerm || hasIdentityPattern) && !analysis.topics.includes(term)) {
      analysis.topics.push(term);
      console.log(`Enhanced analysis: Added dietary term "${term}"`);
    }
  });
}

/**
 * Enhances analysis with price sensitivity detection
 */
function enhancePriceSensitivity(analysis: QueryAnalysisResult, query: string): void {
  const lowerQuery = query.toLowerCase();
  
  // Detect budget-related terms
  const budgetTerms = [
    {term: 'budget-friendly', variations: ['cheap', 'affordable', 'inexpensive', 'budget', 'low cost', 'low-cost']},
    {term: 'mid-range', variations: ['moderate', 'mid-range', 'mid range', 'reasonable']},
    {term: 'luxury', variations: ['expensive', 'high-end', 'fancy', 'luxury', 'upscale']}
  ];
  
  budgetTerms.forEach(({ term, variations }) => {
    if (variations.some(variation => lowerQuery.includes(variation)) && !analysis.topics.includes(term)) {
      analysis.topics.push(term);
      console.log(`Enhanced analysis: Added price term "${term}"`);
    }
  });
}

/**
 * Enhances analysis with time relevance detection
 */
function enhanceTimeRelevance(analysis: QueryAnalysisResult, query: string): void {
  const lowerQuery = query.toLowerCase();
  
  // Detect time-related terms
  const timeTerms = [
    {term: 'breakfast', variations: ['breakfast', 'morning meal', 'brunch']},
    {term: 'lunch', variations: ['lunch', 'midday', 'noon']},
    {term: 'dinner', variations: ['dinner', 'evening meal', 'supper']},
    {term: 'late-night', variations: ['late night', 'late-night', 'after hours']}
  ];
  
  timeTerms.forEach(({ term, variations }) => {
    if (variations.some(variation => lowerQuery.includes(variation)) && !analysis.topics.includes(term)) {
      analysis.topics.push(term);
      console.log(`Enhanced analysis: Added time term "${term}"`);
    }
  });
}

/**
 * Transfers locations from entities.location to the top-level locations array
 * and normalizes location names (e.g., expands abbreviations)
 */
function transferLocationsFromEntities(analysis: QueryAnalysisResult): void {
  // Ensure locations array exists
  if (!analysis.locations) {
    analysis.locations = [];
  }
  
  // Check if there are location entities
  if (analysis.entities && analysis.entities.location && analysis.entities.location.length > 0) {
    // Transfer each location from entities to the locations array
    for (const location of analysis.entities.location) {
      const normalizedLocation = normalizeLocation(location);
      
      // Only add if not already in the array
      if (!analysis.locations.includes(normalizedLocation)) {
        analysis.locations.push(normalizedLocation);
        console.log(`Enhanced analysis: Transferred location "${location}" as "${normalizedLocation}"`);
      }
    }
  }
  
  // Also normalize any locations already in the top-level locations array
  const normalizedLocations: string[] = [];
  for (let i = 0; i < analysis.locations.length; i++) {
    const normalizedLocation = normalizeLocation(analysis.locations[i]);
    
    // Replace with normalized version if different
    if (normalizedLocation !== analysis.locations[i]) {
      console.log(`Enhanced analysis: Normalized location "${analysis.locations[i]}" to "${normalizedLocation}"`);
      normalizedLocations.push(normalizedLocation);
    } else {
      normalizedLocations.push(analysis.locations[i]);
    }
  }
  
  // Replace the locations array with the normalized one
  analysis.locations = normalizedLocations;
}

/**
 * Normalizes location names by expanding common abbreviations
 */
function normalizeLocation(location: string): string {
  // Map of common abbreviations to full names
  const locationMap: Record<string, string> = {
    "sf": "San Francisco",
    "nyc": "New York City",
    "la": "Los Angeles",
    "chi": "Chicago",
    "philly": "Philadelphia",
    "dc": "Washington DC",
    "atl": "Atlanta",
    "bos": "Boston",
    "sd": "San Diego",
    "pdx": "Portland",
    "sea": "Seattle",
    // Add more mappings as needed
  };

  // Return the mapped value if exists, otherwise return the original
  return locationMap[location.toLowerCase()] || location;
}

/**
 * Handles the integration of the default location with query locations
 * Uses the internal QueryAnalysisResult type for compatibility
 */
function handleDefaultLocation(analysis: {
  entities: Record<string, string[]>;
  topics: string[];
  locations: string[];
  intent: QueryIntent;
}, defaultLocation: string): void {
  // If no locations found in query, use the default location
  if (analysis.locations.length === 0) {
    console.log(`No locations in query, using default: ${defaultLocation}`);
    analysis.locations = [defaultLocation];
    return;
  }
  
  // Normalize locations for comparison
  const normalizedDefault = normalizeLocation(defaultLocation);
  const queryLocationsNormalized = analysis.locations.map(loc => normalizeLocation(loc));
  
  // Check if default location is already in the locations list or is a parent location
  const isRedundant = queryLocationsNormalized.some(loc => 
    loc === normalizedDefault ||
    normalizedDefault.includes(loc) ||
    loc.includes(normalizedDefault)
  );
  
  if (!isRedundant) {
    // Add default location as a secondary location for context
    analysis.locations.push(defaultLocation);
    console.log(`Added location context: ${defaultLocation}`);
  } else {
    console.log(`Default location redundant with: ${analysis.locations.join(', ')}`);
  }
} 