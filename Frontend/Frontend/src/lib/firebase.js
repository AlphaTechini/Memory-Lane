// Frontend: safe firebase client initializer - does NOT run during SSR.
// Exports an async init function that callers can use in the browser.
import { browser } from '$app/environment';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

let initPromise = null;

/**
 * Initialize Firebase client libraries only in the browser on demand.
 * Returns an object { app, auth, GoogleAuthProvider, signInWithPopup, getIdToken }
 * Throws an error if called on the server or if required env vars are missing.
 */
export async function initFirebaseClient() {
  if (!browser) {
    throw new Error('initFirebaseClient must be called in the browser');
  }

  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const firebaseAppModule = await import('firebase/app');
      const firebaseAuthModule = await import('firebase/auth');

      const { initializeApp, getApps } = firebaseAppModule;
      const { getAuth, GoogleAuthProvider, signInWithPopup } = firebaseAuthModule;

      // Minimal config validation
      if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.authDomain) {
        throw new Error('Missing Firebase client configuration (VITE_FIREBASE_*).');
      }

      let appInstance;
      const apps = getApps();
      if (!apps || apps.length === 0) {
        appInstance = initializeApp(firebaseConfig);
      } else {
        appInstance = apps[0];
      }

      const auth = getAuth(appInstance);
      return {
        app: appInstance,
        auth,
        GoogleAuthProvider,
        signInWithPopup
      };
    } catch (err) {
      // Reset initPromise on error so subsequent attempts can retry
      initPromise = null;
      throw err;
    }
  })();

  return initPromise;
}

export default { initFirebaseClient };
