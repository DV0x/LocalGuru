'use client';

import { useState, useEffect } from 'react';

/**
 * React hook for fetching and using CSRF tokens in the frontend
 * @returns An object containing the CSRF token and a function to fetch a new token
 */
export function useCsrfToken() {
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetches a CSRF token from the server
   */
  const fetchCsrfToken = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/csrf-token', {
        method: 'GET',
        credentials: 'include', // Important for including cookies
        headers: {
          'Cache-Control': 'no-cache',
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch CSRF token: ${response.status}`);
      }
      
      const data = await response.json();
      setCsrfToken(data.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch CSRF token');
      console.error('Error fetching CSRF token:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch a token on component mount
  useEffect(() => {
    fetchCsrfToken();
  }, []);

  /**
   * Returns a headers object with the CSRF token included
   */
  const getHeadersWithCsrf = (additionalHeaders: Record<string, string> = {}) => {
    return {
      'X-CSRF-Token': csrfToken || '',
      ...additionalHeaders,
    };
  };

  /**
   * Helper function to make a fetch request with the CSRF token included
   */
  const fetchWithCsrf = async (url: string, options: RequestInit = {}) => {
    if (!csrfToken) {
      await fetchCsrfToken();
    }
    
    const headers = {
      ...options.headers,
      'X-CSRF-Token': csrfToken || '',
    };
    
    return fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Include cookies
    });
  };

  return {
    csrfToken,
    loading,
    error,
    fetchCsrfToken,
    getHeadersWithCsrf,
    fetchWithCsrf,
  };
} 