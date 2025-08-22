import axios from 'axios';
import { sensayConfig } from '../config/sensay.js';

/**
 * A service module for interacting with the Sensay API.
 * This module centralizes the logic for making API calls to Sensay,
 * including configuration and error handling.
 */

// Create an Axios instance for the Sensay API.
// This is a best practice for centralizing API configuration like base URL and headers.
const sensayApi = axios.create({
  baseURL: sensayConfig.baseUrl,
  headers: {
    'Authorization': `Bearer ${sensayConfig.apiKey}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

/**
 * Sends a message to the Sensay API's chat endpoint.
 *
 * @param {string} message The message to send to the chat.
 * @param {Array} [context=[]] The conversation context, an array of previous messages.
 * @returns {Promise<object>} A promise that resolves to the JSON response from the API.
 * @throws {Error} Throws an error if the API call fails. The error may contain a `response` property with details from the API.
 */
export const sendMessageToSensay = async (message, context = []) => {
  try {
    const response = await sensayApi.post('/chat', {
      message,
      context,
    });
    return response.data;
  } catch (error) {
    console.error('Error calling Sensay API:', error.message);

    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error(`API Error: Status ${error.response.status}`, error.response.data);
      const apiError = new Error(`Sensay API responded with status ${error.response.status}`);
      // Attach the full response to the error for further inspection by the caller
      apiError.response = error.response;
      throw apiError;
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received from Sensay API for request:', error.request);
      throw new Error('Could not connect to Sensay API. Please check your network connection.');
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error setting up request to Sensay API:', error.message);
      throw new Error('An unexpected error occurred while setting up the request.');
    }
  }
};
