import { browser } from '$app/environment';
import { goto } from '$app/navigation';

const API_BASE_URL = 'http://localhost:4000';

/**
 * Get the authentication token from localStorage
 */
export function getAuthToken() {
  if (!browser) return null;
  return localStorage.getItem('authToken');
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated() {
  return !!getAuthToken();
}

/**
 * Clear authentication data and redirect to login
 */
export function logout() {
  if (!browser) return;
  
  localStorage.removeItem('authToken');
  localStorage.removeItem('userEmail');
  goto('/login');
}

/**
 * Make an authenticated API call
 */
export async function apiCall(endpoint, options = {}) {
  const token = getAuthToken();
  
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers
    }
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    
    // Handle unauthorized responses
    if (response.status === 401) {
      logout();
      throw new Error('Unauthorized');
    }
    
    return response;
  } catch (error) {
    if (error.message === 'Unauthorized') {
      throw error;
    }
    throw new Error('Network error. Please try again.');
  }
}

/**
 * Verify token and get user data
 */
export async function verifyAuth() {
  if (!isAuthenticated()) {
    return null;
  }
  
  try {
    const response = await apiCall('/auth/verify');
    
    if (response.ok) {
      const data = await response.json();
      return data.success ? data.data.user : null;
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Protect a route - redirect to login if not authenticated
 */
export async function protectRoute() {
  if (!browser) return false;
  
  const user = await verifyAuth();
  
  if (!user) {
    goto('/login');
    return false;
  }
  
  if (!user.isVerified) {
    localStorage.setItem('userEmail', user.email);
    goto('/verify-otp');
    return false;
  }
  
  return true;
}
