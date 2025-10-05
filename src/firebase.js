// src/firebase.js - safe firebase-admin wrapper (server)
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

let adminInstance = null;
let initialized = false;

try {
  const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
  if (fs.existsSync(serviceAccountPath)) {
    const raw = fs.readFileSync(serviceAccountPath, 'utf8');
    const serviceAccount = JSON.parse(raw);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    adminInstance = admin;
    initialized = true;
    console.log('firebase-admin initialized');
  } else {
    console.warn('serviceAccountKey.json not found; firebase-admin is not initialized. Google sign-in will be disabled.');
  }
} catch (err) {
  // Fail gracefully: do NOT re-throw. Log and continue so non-Firebase routes keep working.
  console.error('Failed to initialize firebase-admin. Google sign-in will be disabled.', err?.message || err);
}

/**
 * Export a safe wrapper that provides auth().verifyIdToken.
 * If firebase-admin was not initialized, the returned verifyIdToken throws a clear error
 * which the caller can handle and return a 4xx/5xx as appropriate without crashing the server.
 */
export default {
  auth() {
    if (!initialized) {
      return {
        verifyIdToken: async () => {
          throw new Error('Firebase Admin not initialized');
        }
      };
    }
    return adminInstance.auth();
  },
  _admin: adminInstance
};
