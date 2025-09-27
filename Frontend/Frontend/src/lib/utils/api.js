// API configuration utility
import { dev } from '$app/environment';

// Get API base URL from environment or default to production URL
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
  (dev ? 'http://localhost:4000' : 'https://win-api-sensay.cyberpunk.work');

// Helper function for making API calls
export function apiUrl(endpoint) {
  // Remove leading slash if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_BASE_URL}/${cleanEndpoint}`;
}