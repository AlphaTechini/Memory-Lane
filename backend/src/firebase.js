// Server-side firebase-admin wrapper (safe).
// Reads serviceAccountKey.json if present, but does not throw on import-time failure.
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
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // Support env-var based service account (recommended for deployments)
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      adminInstance = admin;
      initialized = true;
      console.log('firebase-admin initialized from FIREBASE_SERVICE_ACCOUNT');
    } catch (e) {
      console.warn('Invalid FIREBASE_SERVICE_ACCOUNT JSON; firebase-admin not initialized', e.message);
    }
  } else {
    console.warn('serviceAccountKey.json not found and FIREBASE_SERVICE_ACCOUNT not set; firebase-admin not initialized.');
  }
} catch (err) {
  // Never rethrow here — make Firebase optional so other routes can operate.
  console.error('Failed to initialize firebase-admin (non-fatal):', err?.message || err);
}

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
