import { VITE_API_BASE_URL } from '$env/static/private';

const API_BASE_URL = VITE_API_BASE_URL || 'https://memory-lane-d5l0.onrender.com';

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
  // Store API base URL in locals for use in server routes
  event.locals.apiBaseUrl = API_BASE_URL;
  
  // Get auth token from cookie
  const token = event.cookies.get('authToken');
  
  // Set user in locals if token exists
  if (token) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.user) {
          event.locals.user = data.user;
          event.locals.token = token;
        }
      } else if (response.status === 401) {
        event.cookies.delete('authToken', { path: '/' });
      }
    } catch (error) {
      console.error('Auth verification error:', error);
    }
  }
  
  return resolve(event);
}
