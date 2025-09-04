/**
 * Enhanced Sensay API configuration with proper headers and endpoints
 */

const organizationSecret = process.env.SENSAY_ORGANIZATION_SECRET || 'placeholder-secret';
const apiVersion = process.env.SENSAY_API_VERSION || 'v1';

if (!process.env.SENSAY_ORGANIZATION_SECRET) {
  console.warn("⚠️ SENSAY_ORGANIZATION_SECRET not set. Sensay features will be limited.");
}

/**
 * Configuration object for the Sensay API
 */
export const sensayConfig = {
  organizationSecret,
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