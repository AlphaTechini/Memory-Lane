import { json } from '@sveltejs/kit';
import { VITE_API_BASE_URL } from '$env/static/private';

const API_BASE_URL = VITE_API_BASE_URL || 'https://memory-lane-d5l0.onrender.com';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, cookies }) {
  try {
    const authToken = cookies.get('authToken');
    
    if (!authToken) {
      return json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }

    // Get the form data from the request
    const formData = await request.formData();
    
    const response = await fetch(`${API_BASE_URL}/replica/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`
        // Don't set Content-Type for FormData - let the browser set it with boundary
      },
      body: formData
    });
    
    const data = await response.json();
    return json(data, { status: response.status });
  } catch (error) {
    console.error('Upload replica image error:', error);
    return json({ success: false, message: 'Server error' }, { status: 500 });
  }
}