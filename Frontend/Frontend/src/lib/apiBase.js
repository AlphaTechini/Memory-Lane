// Centralized API base URL resolver
// Order of precedence:
// 1. Vite env variable (public) e.g., VITE_API_BASE_URL
// 2. Window global injected at deploy time (window.__API_BASE__)
// 3. Relative '/api' (useful when reverse proxying /api -> backend)
// 4. Fallback to http://localhost:4000 for local dev

export function getApiBase() {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const viaVite = import.meta.env.VITE_API_BASE_URL;
    if (viaVite) return viaVite.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.__API_BASE__) {
    return String(window.__API_BASE__).replace(/\/$/, '');
  }
  // If frontend is hosted behind a reverse proxy mapping /api → backend
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    // Optionally use relative path when a flag is present
    if (import.meta?.env?.VITE_USE_RELATIVE_API === 'true') return '/api';
  }
  return 'http://localhost:4000';
}

export async function apiFetch(path, options = {}) {
  const base = getApiBase();
  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? path : '/' + path}`;
  return fetch(url, options);
}

export default getApiBase;