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
  localStorage.removeItem('userData');
  goto('/login');
}

/**
 * Make an authenticated API call
 */
export async function apiCall(endpoint, options = {}) {
  const token = getAuthToken();
  
  // Don't set Content-Type for FormData - let browser handle it
  const isFormData = options.body instanceof FormData;
  
  const config = {
    ...options,
    headers: {
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...(!isFormData && { 'Content-Type': 'application/json' }),
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
  
  // Try to get cached user data first
  try {
    const cachedUser = localStorage.getItem('userData');
    if (cachedUser) {
      const user = JSON.parse(cachedUser);
      // Return cached data immediately - only verify token if there's an actual error
      return user;
    }
  } catch {
    localStorage.removeItem('userData');
  }
  
  // Only make API call if no cached data exists
  try {
    const response = await apiCall('/auth/me');
    
    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        // Cache the user data - note: /auth/me returns user directly, not data.user
        localStorage.setItem('userData', JSON.stringify(data.user));
        return data.user;
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Protect a route - redirect to login if not authenticated
 * @param {boolean} requireVerification - Whether to require email verification (default: true)
 */
export async function protectRoute(requireVerification = true) {
  if (!browser) return false;
  
  const user = await verifyAuth();
  
  if (!user) {
    goto('/login');
    return false;
  }
  
  if (requireVerification && !user.isVerified) {
    localStorage.setItem('userEmail', user.email);
    goto('/verify-otp');
    return false;
  }
  
  return true;
}

/**
 * Soft protection - redirects to login if not authenticated
 * Can optionally store a redirect URL to come back to after login
 */
export function requireAuthForAction(redirectAfterLogin = null) {
  if (!browser) return false;
  
  if (!isAuthenticated()) {
    // Store where to redirect after login (optional)
    if (redirectAfterLogin) {
      localStorage.setItem('redirectAfterLogin', redirectAfterLogin);
    }
    goto('/login');
    return false;
  }
  return true;
}

/**
 * Check if user is authenticated without redirecting
 */
export function checkAuthStatus() {
  return isAuthenticated();
}
