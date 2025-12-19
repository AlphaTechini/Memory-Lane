import { json } from '@sveltejs/kit';
import { VITE_API_BASE_URL } from '$env/static/private';
import { dev } from '$app/environment';

const API_BASE_URL = VITE_API_BASE_URL || 'https://memory-lane-d5l0.onrender.com';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, cookies }) {
  try {
    const body = await request.json();
    
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    
    const data = await response.json();
    
    if (response.ok && data.success && data.token) {
      // Set HTTP-only cookie - secure only in production (localhost is HTTP)
      cookies.set('authToken', data.token, {
        path: '/',
        httpOnly: true,
        secure: !dev,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7 // 7 days
      });
    }
    
    return json(data, { status: response.status });
  } catch (error) {
    console.error('Login error:', error);
    return json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
