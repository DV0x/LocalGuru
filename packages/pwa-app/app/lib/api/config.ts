// API configuration settings

// Define base URLs for different environments
const API_ENDPOINTS = {
  // Use local web-app server for development
  development: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000/api',
  // Use production URL when deployed
  production: process.env.NEXT_PUBLIC_API_BASE_URL || 'https://localguru.ai/api',
  // Use local web-app for testing
  test: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000/api',
};

// Get current environment
const environment = process.env.NODE_ENV || 'development';

// Base API URL for the current environment
export const API_BASE_URL = API_ENDPOINTS[environment as keyof typeof API_ENDPOINTS];

// Specific API endpoints
export const API_ROUTES = {
  streamingSearch: `${API_BASE_URL}/streaming-search`,
  search: `${API_BASE_URL}/search`,
  feedback: `${API_BASE_URL}/feedback`,
}; 