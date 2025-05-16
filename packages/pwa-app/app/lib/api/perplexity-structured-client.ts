import { SearchResult } from '../types/search';
import { LocationData } from './location-client';

// Define the structured response format we expect from Perplexity
export interface PerplexityStructuredResponse {
  summary: string;
  locations: PerplexityLocationData[];
  sources: PerplexitySource[];
}

export interface PerplexityLocationData {
  name: string;
  address: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  category?: string;
  price_range?: string;
  hours?: string;
  description: string;
  highlights?: string[];
  source?: string;
}

export interface PerplexitySource {
  title: string;
  url: string;
}

export class PerplexityStructuredClient {
  private apiKey: string;
  private abortController: AbortController | null = null;

  constructor(apiKey?: string) {
    // Try to get the API key from props first, then environment variables
    const keyFromEnv = process.env.NEXT_PUBLIC_PERPLEXITY_API_KEY || process.env.PERPLEXITY_API_KEY;
    this.apiKey = apiKey || keyFromEnv || '';
    
    if (!this.apiKey) {
      console.warn('No Perplexity API key provided. Using demo mode.');
    } else {
      console.log('Perplexity structured client initialized with API key');
    }
  }

  // Define our JSON schema for structured output
  private getLocationSchema() {
    return {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description: "Brief overview of the answer to the user's query"
        },
        locations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "Full name of the business or location"
              },
              address: {
                type: "string",
                description: "Complete address including street, city, and zip"
              },
              coordinates: {
                type: "object",
                properties: {
                  latitude: {type: "number"},
                  longitude: {type: "number"}
                },
                description: "Geographic coordinates if available"
              },
              category: {
                type: "string", 
                description: "Type of place (restaurant, bar, park, etc.)"
              },
              price_range: {
                type: "string",
                description: "$, $$, $$$, or $$$$ indicating cost level"
              },
              hours: {
                type: "string",
                description: "Operating hours in a human-readable format"
              },
              description: {
                type: "string",
                description: "Detailed information about what makes this place special"
              },
              highlights: {
                type: "array",
                items: {type: "string"},
                description: "Key features or reasons to visit this location"
              },
              source: {
                type: "string",
                description: "Main source where this information was found"
              }
            },
            required: ["name", "address", "description"]
          },
          description: "List of recommended locations (aim for 8-10 locations)",
          minItems: 8
        },
        sources: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: {type: "string"},
              url: {type: "string"}
            }
          },
          description: "Citation sources for the information provided"
        }
      }
    };
  }

  /**
   * Search using Perplexity API with structured JSON output
   */
  async searchWithStructuredOutput(query: string, options: any = {}): Promise<PerplexityStructuredResponse> {
    try {
      // Extract location from options
      const location = options.location || 'San Francisco';
      
      // Add detailed logging for debugging
      console.log('Perplexity API options received:', JSON.stringify(options));
      console.log(`Location value being used for search: "${location}"`);
      
      console.log(`Making structured search request to Perplexity API for: "${query}" in ${location}`);
      
      // Create system prompt with location context and request for more results
      const systemPrompt = `You are LocalGuru, a local recommendations expert who specializes in providing detailed information about ${location}. 
        You have extensive knowledge about various cities and regions around the world.
        For this query about ${location}, provide detailed local recommendations with specific business names, addresses, and descriptions.
        Include as much detail as possible about each location, including opening hours, price range, and what makes it special.
        Always include at least 8-10 relevant locations whenever possible, even if some have less detailed information.
        If exact information like prices or hours isn't available, provide your best estimate based on similar establishments.
        For addresses, provide full street addresses whenever possible.
        Focus on authentic local knowledge and provide accurate information.
        Use the latest available information for the specific location requested.
        If you don't have enough information about the requested location, provide the best information available but don't make up fictional places.`;
      
      // Define trusted domains for better search results - expand this list for different regions
      const searchDomainFilter = [
        "reddit.com",
        "yelp.com", 
        "tripadvisor.com"
        // API limit: Only 3 domains maximum are allowed for search_domain_filter
      ];
      
      // Create a location specific search query to help the API find relevant results
      const augmentedQuery = `${query} in ${location}`;
      
      // Prepare request for Perplexity API with structured output format
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "sonar-pro",
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            {
              role: "user",
              content: augmentedQuery // Use the location-augmented query
            }
          ],
          temperature: 0.2,
          top_p: 0.9,
          return_citations: true,
          search_domain_filter: searchDomainFilter,
          search_recency_filter: "month",
          stream: false, // We can't use streaming with JSON Schema
          response_format: {
            type: "json_schema",
            json_schema: {
              schema: this.getLocationSchema()
            }
          }
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Perplexity structured search request failed:', response.status, errorText);
        throw new Error(`Perplexity search failed: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      
      // Extract the structured content from the response
      if (data.choices && data.choices.length > 0 && data.choices[0].message?.content) {
        try {
          // Parse the JSON structure from the content
          const structuredContent = JSON.parse(data.choices[0].message.content);
          console.log('Received structured content:', structuredContent);
          return structuredContent;
        } catch (parseError) {
          console.error('Error parsing structured content:', parseError);
          throw new Error('Failed to parse structured response from Perplexity');
        }
      } else {
        console.error('Invalid response format from Perplexity:', data);
        throw new Error('Invalid response format from Perplexity');
      }
      
    } catch (error) {
      console.error('Error in Perplexity structured search:', error);
      throw error;
    }
  }
  
  /**
   * Convert Perplexity location data to our app's LocationData format for map integration
   */
  convertToLocationData(structuredResponse: PerplexityStructuredResponse): LocationData[] {
    return structuredResponse.locations.map((location, index) => {
      // If coordinates are provided, use them directly
      const hasCoordinates = location.coordinates?.latitude && location.coordinates?.longitude;
      
      return {
        id: `perplexity-${index}`,
        name: location.name,
        longitude: hasCoordinates ? location.coordinates!.longitude : 0, // Will need geocoding if not provided
        latitude: hasCoordinates ? location.coordinates!.latitude : 0,
        address: location.address,
        confidence: 0.9, // High confidence for structured data
        source_text: location.description,
        created_at: new Date().toISOString()
      };
    });
  }

  stopSearch() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
} 