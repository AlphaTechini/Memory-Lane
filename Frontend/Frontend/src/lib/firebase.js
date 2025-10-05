// Frontend safe firebase init - only runs in the browser (avoids SSR errors)
import { browser } from '$app/environment';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

let app = null;
let auth = null;

if (browser) {
  try {
    // Lazily import firebase modules in the browser to avoid SSR initialization
    // (avoid calling getAuth() during SSR which can throw if env vars are missing)
    // Note: static imports are fine but this keeps runtime init strictly client-side.
    // Use dynamic imports to ensure bundlers still include firebase for the client.
    (async () => {
      const { initializeApp } = await import('firebase/app');
      const { getAuth } = await import('firebase/auth');
      try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        // optional: console.info('client firebase initialized');
      } catch (initErr) {
        console.warn('Firebase client initialization failed:', initErr?.message || initErr);
        app = null;
        auth = null;
      }
    })();
  } catch (err) {
    console.warn('Failed to load firebase client libraries:', err);
  }
}

export { app, auth };
export default { app, auth };
