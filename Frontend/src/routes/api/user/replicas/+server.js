import { json } from '@sveltejs/kit';
import { VITE_API_BASE_URL } from '$env/static/private';

const API_BASE_URL = VITE_API_BASE_URL || 'https://memory-lane-d5l0.onrender.com';

/** @type {import('./$types').RequestHandler} */
export async function GET({ cookies }) {
  try {
    const authToken = cookies.get('authToken');
    
    if (!authToken) {
      return json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }

    const response = await fetch(`${API_BASE_URL}/api/user/replicas`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    return json(data, { status: response.status });
  } catch (error) {
    console.error('Get user replicas error:', error);
    return json({ success: false, message: 'Server error' }, { status: 500 });
  }
}