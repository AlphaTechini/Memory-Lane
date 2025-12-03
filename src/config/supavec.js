/**
 * Supavec API configuration
 */

const apiKey = process.env.SUPAVEC_API_KEY;

if (!apiKey) {
  console.warn('⚠️ SUPAVEC_API_KEY not properly configured. Supavec features will be limited.');
} else {
  if (process.env.NODE_ENV !== 'production') {
    console.log('🔐 SUPAVEC_API_KEY loaded.');
  }
}

/**
 * Configuration object for the Supavec API
 */
export const supavecConfig = {
  apiKey,
  isConfigured: Boolean(apiKey),
  isProperlyConfigured: () => Boolean(apiKey),
  baseUrl: "https://api.supavec.com",
  headers: {
    base: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  },
};