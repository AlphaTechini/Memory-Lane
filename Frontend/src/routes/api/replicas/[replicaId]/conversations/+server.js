import { json } from '@sveltejs/kit';
import { VITE_API_BASE_URL } from '$env/static/private';

const API_BASE_URL = VITE_API_BASE_URL || 'https://memory-lane-d5l0.onrender.com';

/** @type {import('./$types').RequestHandler} */
export async function GET({ params, cookies }) {
  try {
    const authToken = cookies.get('authToken');
    
    if (!authToken) {
      return json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }

    const { replicaId } = params;
    const response = await fetch(`${API_BASE_URL}/api/replicas/${replicaId}/conversations`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    const data = await response.json();
    return json(data, { status: response.status });
  } catch (error) {
    console.error('Get replica conversations error:', error);
    return json({ success: false, message: 'Server error' }, { status: 500 });
  }
}