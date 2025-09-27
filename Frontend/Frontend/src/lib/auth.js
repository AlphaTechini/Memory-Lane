import { browser } from '$app/environment';
import { goto } from '$app/navigation';

import { apiUrl } from './utils/api.js';

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
  // Require a token to be present for API-authenticated actions. Cached UI data is handled in verifyAuth().
  if (!browser) return false;
  const token = getAuthToken();
  return !!token;
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
  // Don't set Content-Type for DELETE requests with no body
  const isDeleteWithoutBody = options.method === 'DELETE' && !options.body;
  
  const config = {
    ...options,
    headers: {
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...(!isFormData && !isDeleteWithoutBody && { 'Content-Type': 'application/json' }),
      ...options.headers
    }
  };

  try {
    const response = await fetch(apiUrl(endpoint), config);
    
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
  if (!browser) return null;

  // If we have cached user data, return it immediately so the UI can render quickly.
  // If an auth token also exists, kick off a background verification to refresh the cache.
  try {
    const cachedUser = localStorage.getItem('userData');
    if (cachedUser) {
      const user = JSON.parse(cachedUser);

      // Background verification if token exists
      const token = getAuthToken();
      if (token) {
        // Fire-and-forget: verify token and refresh user cache if needed
        (async () => {
          try {
            const resp = await apiCall('/api/auth/me');
            if (resp.ok) {
              const data = await resp.json();
              if (data.success) {
                localStorage.setItem('userData', JSON.stringify(data.user));
              }
            }
          } catch {
            // If verification fails (401), apiCall will handle logout.
          }
        })();
      }

      return user;
    }
  } catch {
    localStorage.removeItem('userData');
  }

  // No cached user: only verify via API if a token is present
  const token = getAuthToken();
  if (!token) return null;

  try {
    const response = await apiCall('/api/auth/me');
    if (response.ok) {
      const data = await response.json();
      if (data.success) {
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

/**
 * Get the current user's role
 */
export function getUserRole() {
  if (!browser) return null;
  
  try {
    const userData = localStorage.getItem('userData');
    if (userData) {
      const user = JSON.parse(userData);
      return user.role || 'caretaker';
    }
  } catch {
    // Ignore parsing errors
  }
  
  return null;
}
