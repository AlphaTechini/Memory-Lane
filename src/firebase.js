// src/firebase.js
// url=https://github.com/AlphaTechini/Built-with-Sensay-API/blob/main/src/firebase.js
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
  // Do NOT re-throw — fail gracefully so the server and non-Firebase routes can continue.
  console.error('Failed to initialize firebase-admin. Google sign-in will be disabled.', err);
}

/**
 * Export a safe wrapper that matches the existing usage pattern:
 * existing code calls firebaseAdmin.auth().verifyIdToken(...)
 * If initialization failed, auth().verifyIdToken will throw a controlled error
 * which the caller can catch and return a non-crashing response.
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
  // Optional: expose the raw admin instance if initialized
  _admin: adminInstance
};
