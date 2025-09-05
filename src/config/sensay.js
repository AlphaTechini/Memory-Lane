/**
 * Enhanced Sensay API configuration with proper headers and endpoints
 */

const rawOrgSecret = process.env.SENSAY_ORGANIZATION_SECRET;
const PLACEHOLDERS = new Set(['placeholder-secret', 'your-sensay-organization-secret', '']);
const allowPlaceholder = process.env.SENSAY_ALLOW_PLACEHOLDER === 'true';
let organizationSecret = rawOrgSecret && (!PLACEHOLDERS.has(rawOrgSecret) || allowPlaceholder) ? rawOrgSecret : null;
const apiVersion = process.env.SENSAY_API_VERSION || 'v1';

if (!organizationSecret) {
  console.warn('⚠️ SENSAY_ORGANIZATION_SECRET not properly configured (value is missing or placeholder). Sensay features will be limited.');
} else {
  if (PLACEHOLDERS.has(rawOrgSecret) && allowPlaceholder) {
    console.warn('⚠️ Using placeholder SENSAY_ORGANIZATION_SECRET because SENSAY_ALLOW_PLACEHOLDER=true. Do NOT use this in production.');
  } else if (process.env.NODE_ENV !== 'production') {
    console.log('🔐 SENSAY_ORGANIZATION_SECRET loaded (length:', organizationSecret.length, ')');
  }
}

/**
 * Configuration object for the Sensay API
 */
export const sensayConfig = {
  organizationSecret,
  isConfigured: Boolean(organizationSecret),
  apiVersion,
  baseUrl: "https://api.sensay.io", // Updated to actual Sensay API endpoint
  endpoints: {
    replicas: "/v1/replicas",
    knowledgeBase: "/v1/kb",
    chat: "/v1/replicas/{replicaId}/chat",
    upload: "/v1/uploads",
  },
  headers: {
    base: {
      'X-ORGANIZATION-SECRET': organizationSecret,
      'X-API-Version': apiVersion,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    withUser: (userId) => ({
      'X-ORGANIZATION-SECRET': organizationSecret,
      'X-API-Version': apiVersion,
      'X-USER-ID': userId,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }),
    streaming: (userId) => ({
      'X-ORGANIZATION-SECRET': organizationSecret,
      'X-API-Version': apiVersion,
      'X-USER-ID': userId,
      'Accept': 'text/event-stream',
      'Cache-Control': 'no-cache',
    }),
  },
};