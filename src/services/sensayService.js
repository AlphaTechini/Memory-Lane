import axios from 'axios';
import { sensayConfig } from '../config/sensay.js';

/**
 * Complete Sensay API service with replica creation, training, and chat functionality
 */

// Create base Axios instance
const sensayApi = axios.create({
  baseURL: sensayConfig.baseUrl,
  timeout: 30000, // 30 second timeout
});

/**
 * Creates a new replica in Sensay
 * @param {Object} replicaData - The replica configuration
 * @param {string} replicaData.name - The name of the replica
 * @param {string} replicaData.shortDescription - Brief description
 * @param {string} replicaData.greeting - Initial greeting message
 * @param {string} replicaData.ownerID - ID of the replica owner
 * @param {string} replicaData.slug - URL-friendly identifier
 * @param {Object} replicaData.llm - LLM configuration
 * @param {string} replicaData.llm.model - Model to use (e.g., 'gpt-4')
 * @returns {Promise<Object>} Created replica object
 */
export const createReplica = async (replicaData) => {
  try {
    // Validate required fields
    const requiredFields = ['name', 'shortDescription', 'greeting', 'ownerID', 'slug', 'llm'];
    for (const field of requiredFields) {
      if (!replicaData[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    if (!replicaData.llm.model) {
      throw new Error('Missing required field: llm.model');
    }

    const response = await sensayApi.post(sensayConfig.endpoints.replicas, replicaData, {
      headers: sensayConfig.headers.base,
    });

    return response.data;
  } catch (error) {
    console.error('Error creating replica:', error.message);
    throw handleSensayError(error, 'Failed to create replica');
  }
};

/**
 * Creates a new knowledge base entry for training
 * @param {string} replicaId - The replica ID to train
 * @param {Object} entryData - Knowledge base entry data
 * @param {string} entryData.title - Title of the entry
 * @param {string} [entryData.description] - Description of the entry
 * @param {Object} [entryData.metadata] - Additional metadata
 * @returns {Promise<Object>} Created KB entry object
 */
export const createKnowledgeBaseEntry = async (replicaId, entryData) => {
  try {
    const response = await sensayApi.post(
      `${sensayConfig.endpoints.knowledgeBase}`,
      {
        replicaId,
        ...entryData,
      },
      {
        headers: sensayConfig.headers.base,
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error creating KB entry:', error.message);
    throw handleSensayError(error, 'Failed to create knowledge base entry');
  }
};

/**
 * Updates a knowledge base entry with raw text content
 * @param {string} entryId - The KB entry ID
 * @param {string} rawText - The text content to add
 * @returns {Promise<Object>} Updated KB entry object
 */
export const updateKnowledgeBaseWithText = async (entryId, rawText) => {
  try {
    const response = await sensayApi.put(
      `${sensayConfig.endpoints.knowledgeBase}/${entryId}`,
      {
        rawText,
      },
      {
        headers: sensayConfig.headers.base,
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error updating KB entry with text:', error.message);
    throw handleSensayError(error, 'Failed to update knowledge base entry');
  }
};

/**
 * Requests a signed URL for file upload
 * @param {string} entryId - The KB entry ID
 * @param {string} filename - Name of the file to upload
 * @param {string} contentType - MIME type of the file
 * @returns {Promise<Object>} Signed URL response
 */
export const requestSignedUploadUrl = async (entryId, filename, contentType) => {
  try {
    const response = await sensayApi.post(
      `${sensayConfig.endpoints.upload}/signed-url`,
      {
        entryId,
        filename,
        contentType,
      },
      {
        headers: sensayConfig.headers.base,
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error requesting signed upload URL:', error.message);
    throw handleSensayError(error, 'Failed to request signed upload URL');
  }
};

/**
 * Uploads a file using the signed URL
 * @param {string} signedUrl - The signed URL from requestSignedUploadUrl
 * @param {Buffer} fileBuffer - The file content as buffer
 * @param {string} contentType - MIME type of the file
 * @returns {Promise<void>}
 */
export const uploadFileToSignedUrl = async (signedUrl, fileBuffer, contentType) => {
  try {
    await axios.put(signedUrl, fileBuffer, {
      headers: {
        'Content-Type': contentType,
      },
    });
  } catch (error) {
    console.error('Error uploading file:', error.message);
    throw new Error('Failed to upload file to signed URL');
  }
};

/**
 * Checks the status of a knowledge base entry
 * @param {string} entryId - The KB entry ID
 * @returns {Promise<Object>} KB entry status
 */
export const getKnowledgeBaseEntryStatus = async (entryId) => {
  try {
    const response = await sensayApi.get(
      `${sensayConfig.endpoints.knowledgeBase}/${entryId}`,
      {
        headers: sensayConfig.headers.base,
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error getting KB entry status:', error.message);
    throw handleSensayError(error, 'Failed to get knowledge base entry status');
  }
};

/**
 * Polls a knowledge base entry until it's ready or times out
 * @param {string} entryId - The KB entry ID
 * @param {number} maxAttempts - Maximum polling attempts (default: 60)
 * @param {number} intervalMs - Polling interval in milliseconds (default: 5000)
 * @returns {Promise<Object>} Final KB entry status
 */
export const pollKnowledgeBaseEntryStatus = async (entryId, maxAttempts = 60, intervalMs = 5000) => {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    try {
      const status = await getKnowledgeBaseEntryStatus(entryId);
      
      if (status.status === 'READY') {
        return status;
      }
      
      if (status.status === 'FAILED' || status.status === 'ERROR') {
        throw new Error(`Knowledge base entry processing failed: ${status.error || 'Unknown error'}`);
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, intervalMs));
      attempts++;
      
    } catch (error) {
      if (attempts >= maxAttempts - 1) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, intervalMs));
      attempts++;
    }
  }
  
  throw new Error('Knowledge base entry processing timed out');
};

/**
 * Sends a chat message to a replica
 * @param {string} replicaId - The replica ID
 * @param {string} message - The message to send
 * @param {string} userId - The user ID for authentication
 * @param {Array} [context=[]] - Conversation context
 * @param {boolean} [streaming=false] - Whether to use streaming response
 * @returns {Promise<Object>} Chat response
 */
export const sendChatMessage = async (replicaId, message, userId, context = [], streaming = false) => {
  try {
    const endpoint = sensayConfig.endpoints.chat.replace('{replicaId}', replicaId);
    const headers = streaming 
      ? sensayConfig.headers.streaming(userId)
      : sensayConfig.headers.withUser(userId);

    const response = await sensayApi.post(
      endpoint,
      {
        message,
        context,
        stream: streaming,
      },
      {
        headers,
        responseType: streaming ? 'stream' : 'json',
      }
    );

    if (streaming) {
      return response; // Return the stream directly
    }

    return response.data;
  } catch (error) {
    console.error('Error sending chat message:', error.message);
    throw handleSensayError(error, 'Failed to send chat message');
  }
};

/**
 * Complete training workflow: create entry, add content, poll for completion
 * @param {string} replicaId - The replica ID
 * @param {Object} trainingData - Training data
 * @param {string} trainingData.title - Title for the KB entry
 * @param {string} [trainingData.description] - Description
 * @param {string} [trainingData.rawText] - Raw text content (mutually exclusive with file)
 * @param {Object} [trainingData.file] - File data {buffer, filename, contentType}
 * @returns {Promise<Object>} Final training result
 */
export const trainReplica = async (replicaId, trainingData) => {
  try {
    // 1. Create KB entry
    console.log('Creating knowledge base entry...');
    const kbEntry = await createKnowledgeBaseEntry(replicaId, {
      title: trainingData.title,
      description: trainingData.description,
      metadata: trainingData.metadata,
    });

    const entryId = kbEntry.id || kbEntry.uuid;

    // 2. Add content (text or file)
    if (trainingData.rawText) {
      console.log('Adding raw text to KB entry...');
      await updateKnowledgeBaseWithText(entryId, trainingData.rawText);
    } else if (trainingData.file) {
      console.log('Uploading file to KB entry...');
      const signedUrlResponse = await requestSignedUploadUrl(
        entryId, 
        trainingData.file.filename, 
        trainingData.file.contentType
      );
      
      await uploadFileToSignedUrl(
        signedUrlResponse.signedUrl, 
        trainingData.file.buffer, 
        trainingData.file.contentType
      );
    } else {
      throw new Error('Either rawText or file must be provided for training');
    }

    // 3. Poll for completion
    console.log('Polling for training completion...');
    const finalStatus = await pollKnowledgeBaseEntryStatus(entryId);
    
    console.log('Training completed successfully');
    return finalStatus;

  } catch (error) {
    console.error('Error in training workflow:', error.message);
    throw error;
  }
};

/**
 * Enhanced error handler for Sensay API responses
 * @param {Error} error - The axios error
 * @param {string} message - Custom error message
 * @returns {Error} Formatted error
 */
const handleSensayError = (error, message) => {
  if (error.response) {
    // API responded with error status
    const status = error.response.status;
    const data = error.response.data;
    
    console.error(`Sensay API Error: Status ${status}`, data);
    
    // Handle specific Sensay error cases
    switch (status) {
      case 401:
        return new Error('Unauthorized: Check your organization secret and user ID');
      case 403:
        return new Error('Forbidden: Insufficient permissions');
      case 404:
        return new Error('Not found: Resource does not exist');
      case 429:
        return new Error('Rate limit exceeded: Please retry after some time');
      case 500:
        return new Error('Sensay server error: Please try again later');
      default:
        const apiError = new Error(`${message}: ${data?.message || data?.error || 'Unknown error'}`);
        apiError.status = status;
        apiError.response = error.response;
        return apiError;
    }
  } else if (error.request) {
    console.error('No response from Sensay API:', error.request);
    return new Error(`${message}: Network error - could not connect to Sensay API`);
  } else {
    console.error('Request setup error:', error.message);
    return new Error(`${message}: ${error.message}`);
  }
};