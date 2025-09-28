import { redirect } from '@sveltejs/kit';

/**
 * Redirect the root path to /signup so the signup page becomes the default landing page.
 */
export function load() {
  throw redirect(307, '/signup');
}
