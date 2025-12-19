import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { apiUrl } from './utils/api.js';

/**
 * Get the authentication token (deprecated - now using httpOnly cookies)
 * Kept for backward compatibility with existing code
 */
export function getAuthToken() {
  // Token is now stored in httpOnly cookie, not accessible from JS
  // Return null - auth is handled server-side
  return null;
}

/**
 * Check if user is authenticated (client-side check via cached data)
 */
export function isAuthenticated() {
  if (!browser) return false;
  const userData = localStorage.getItem('userData');
  return userData && userData !== 'null';
}

/**
 * Clear authentication data and redirect to login
 */
export async function logout() {
  if (!browser) return;
  
  try {
    // Call server to clear cookie
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (e) {
    console.error('Logout error:', e);
  }
  
  localStorage.removeItem('userEmail');
  localStorage.removeItem('userData');
  goto('/login');
}

/**
 * Make an authenticated API call to the backend
 * Uses SvelteKit server routes which have access to the httpOnly cookie
 */
export async function apiCall(endpoint, options = {}) {
  const isFormData = options.body instanceof FormData;
  const isDeleteWithoutBody = options.method === 'DELETE' && !options.body;
  
  const config = {
    ...options,
    credentials: 'include', // Include cookies
    headers: {
      ...(!isFormData && !isDeleteWithoutBody && { 'Content-Type': 'application/json' }),
      ...options.headers
    }
  };

  try {
    // For internal API routes, use relative path
    const url = endpoint.startsWith('/api/') ? endpoint : apiUrl(endpoint);
    const response = await fetch(url, config);
    
    if (response.status === 401) {
      localStorage.removeItem('userData');
      goto('/login');
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
 * Verify auth and get user data
 */
export async function verifyAuth() {
  if (!browser) return null;

  // Check cached user data first
  try {
    const cachedUserRaw = localStorage.getItem('userData');
    if (cachedUserRaw && cachedUserRaw !== 'null') {
      const user = JSON.parse(cachedUserRaw);
      
      // Background refresh
      (async () => {
        try {
          const resp = await fetch('/api/auth/me', { credentials: 'include' });
          if (resp.ok) {
            const data = await resp.json();
            if (data.success && data.user) {
              localStorage.setItem('userData', JSON.stringify(data.user));
            }
          } else if (resp.status === 401) {
            localStorage.removeItem('userData');
          }
        } catch {
          // Ignore background errors
        }
      })();
      
      return user;
    }
  } catch {
    localStorage.removeItem('userData');
  }

  // No cached user, verify via API
  try {
    const response = await fetch('/api/auth/me', { credentials: 'include' });
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.user) {
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
 * Require auth for an action
 */
export function requireAuthForAction(redirectAfterLogin = null) {
  if (!browser) return false;
  
  if (!isAuthenticated()) {
    if (redirectAfterLogin) {
      localStorage.setItem('redirectAfterLogin', redirectAfterLogin);
    }
    goto('/login');
    return false;
  }
  return true;
}

/**
 * Check auth status without redirecting
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
    const userDataRaw = localStorage.getItem('userData');
    if (userDataRaw && userDataRaw !== 'null') {
      const user = JSON.parse(userDataRaw);
      return user?.role || 'caretaker';
    }
  } catch {
    // Ignore parsing errors
  }
  return null;
}

/**
 * Get cached user data
 */
export function getCachedUser() {
  if (!browser) return null;
  
  try {
    const userDataRaw = localStorage.getItem('userData');
    if (userDataRaw && userDataRaw !== 'null') {
      return JSON.parse(userDataRaw);
    }
  } catch {
    // Ignore parsing errors
  }
  return null;
}
