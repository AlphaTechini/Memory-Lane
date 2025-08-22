/**
 * This file loads and exports the configuration for the Sensay API.
 * It retrieves the API key from environment variables for security.
 */

// For a Node.js environment, you would typically use a package like `dotenv`
// to load variables from a .env file into `process.env`.
// For frontend frameworks like Vite, you would use `import.meta.env.VITE_SENSAY_API_KEY`.
const apiKey = process.env.SENSAY_API_KEY;

// It's a critical best practice to ensure the API key is available.
// This will stop the application from starting if the key is missing.
if (!apiKey) {
  throw new Error("Missing environment variable: SENSAY_API_KEY");
}

/**
 * Configuration object for the Sensay API.
 */
export const sensayConfig = {
  apiKey: apiKey,
  baseUrl: "https://api.sensay.com/v1", // Replace with the actual API base URL
};

