import { API_ROUTES } from './config';

export class StreamingSearchClient {
  private baseUrl: string;
  private abortController: AbortController | null = null;

  constructor(baseUrl = API_ROUTES.streamingSearch) {
    this.baseUrl = baseUrl;
    console.log('Using streaming search endpoint:', this.baseUrl);
  }

  /**
   * Legacy EventSource-based search method
   * (Keeping for backward compatibility)
   */
  async search(query: string, options = {}): Promise<EventSource> {
    try {
      // Create URL with parameters
      const endpoint = `${this.baseUrl}`;
      
      // Create new abort controller for this request
      this.abortController = new AbortController();
      
      // Prepare params object
      const params: Record<string, string> = {
        ...options as Record<string, string>,
        query: query,
      };
      
      // Build the query string
      const queryString = Object.entries(params)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value || '')}`)
        .join('&');
      
      // Log connection attempt
      console.log(`Connecting to streaming endpoint: ${endpoint}?${queryString}`);
      
      // For EventSource in different port/origin scenario, we need special handling
      const eventSourceUrl = `${endpoint}?${queryString}`;
      
      // Important: For cross-origin EventSource
      // When running in different ports (3001 -> 3000), withCredentials
      // may actually cause CORS issues rather than solve them
      const eventSource = new EventSource(eventSourceUrl, {
        withCredentials: false // Try without credentials first
      });
      
      // Add event listeners for debugging
      eventSource.onopen = () => {
        console.log('EventSource connection opened successfully');
      };
      
      eventSource.onerror = (err) => {
        console.error('EventSource connection error:', err);
      };
      
      return eventSource;
    } catch (error) {
      console.error('Error creating EventSource:', error);
      throw error;
    }
  }

  /**
   * New fetch-based search method with POST
   * Better for handling CORS and streaming
   */
  async searchWithPost(query: string, options = {}, signal?: AbortSignal): Promise<ReadableStream<Uint8Array>> {
    try {
      // Ensure we use the API endpoint from config rather than hardcoded path
      // This helps avoid cross-domain issues and ensures consistent configuration
      const endpoint = this.baseUrl;
      
      // Prepare request data
      const requestData = {
        query,
        ...options,
      };
      
      console.log('Making POST request to streaming search endpoint:', endpoint);
      console.log('Search request data:', requestData);
      
      // Make POST request with streaming response
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
        signal,
        // Important for CORS
        credentials: 'omit', // Try 'omit' instead of 'include' for CORS
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Search request failed:', response.status, errorText);
        throw new Error(`Search request failed: ${response.status} ${errorText}`);
      }
      
      if (!response.body) {
        throw new Error('Response body is null');
      }
      
      console.log('Received streaming response, processing...');
      return response.body;
    } catch (error) {
      console.error('Error in searchWithPost:', error);
      throw error;
    }
  }

  stopSearch() {
    // Close any active EventSource connection
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
} 