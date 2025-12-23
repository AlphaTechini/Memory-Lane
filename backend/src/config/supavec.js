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
  baseUrl: process.env.SUPAVEC_BASE_URL || "https://api.supavec.com",
  timeout: parseInt(process.env.SUPAVEC_TIMEOUT || '30000', 10),
};