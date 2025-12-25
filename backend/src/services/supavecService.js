import axios from 'axios';
import { supavecConfig } from '../config/supavec.js';
import logger from '../utils/logger.js';
import FormData from 'form-data';
import { mapSupavecError } from '../utils/errorHandler.js';
import { logApiRequest, logApiResponse } from '../utils/apiLogger.js';

// Helper to build full URL for each endpoint
const getFullUrl = (endpoint) => `${supavecConfig.baseUrl}${endpoint}`;

/**
 * Upload a file to Supavec following the official API documentation.
 * @param {Buffer} fileBuffer - The file content as a buffer.
 * @param {string} filename - The name of the file.
 * @param {number} [chunk_size] - Optional chunk size in tokens.
 * @param {number} [chunk_overlap] - Optional chunk overlap in tokens.
 * @returns {Promise<object>} The response from the API.
 */
export const uploadFile = async (fileBuffer, filename, chunk_size, chunk_overlap) => {
  if (!supavecConfig.isProperlyConfigured()) {
    logger.warn('Supavec API not configured, skipping file upload.');
    return { success: false, message: 'Supavec API not configured.' };
  }

  const context = logApiRequest('SUPAVEC', 'uploadFile', { filename, chunk_size, chunk_overlap });

  try {
    const form = new FormData();
    form.append('file', fileBuffer, filename);

    // Build query parameters
    const params = new URLSearchParams();
    if (chunk_size) params.append('chunk_size', chunk_size.toString());
    if (chunk_overlap) params.append('chunk_overlap', chunk_overlap.toString());

    const url = getFullUrl(`/upload_file${params.toString() ? '?' + params.toString() : ''}`);

    const response = await axios.post(url, form, {
      headers: {
        'authorization': supavecConfig.apiKey,
        ...form.getHeaders(),
      },
      timeout: 30000
    });

    logApiResponse(context, true, response.data);
    return response.data;
  } catch (error) {
    const standardizedError = mapSupavecError(error);
    logger.error('Error uploading file to Supavec:', standardizedError.originalError);
    logApiResponse(context, false, null, error);
    throw standardizedError;
  }
};

/**
 * Upload text to Supavec following the official API documentation.
 * @param {string} contents - The text content to upload (raw text, min 5 chars).
 * @param {string} [name] - Optional name for the content.
 * @param {number} [chunk_size] - Optional chunk size in tokens.
 * @param {number} [chunk_overlap] - Optional chunk overlap in tokens.
 * @param {Array} [segments] - Optional pre-chunked segments (alternative to contents).
 * @returns {Promise<object>} The response from the API.
 */
export const uploadText = async (contents, name, chunk_size = 1000, chunk_overlap = 100, segments = null) => {
  if (!supavecConfig.isProperlyConfigured()) {
    logger.warn('Supavec API not configured, skipping text upload.');
    return { success: false, message: 'Supavec API not configured.' };
  }

  const context = logApiRequest('SUPAVEC', 'uploadText', { name, hasContents: Boolean(contents), hasSegments: Boolean(segments) });

  try {
    const requestBody = {
      name: name || 'Untitled Document'
    };

    // Use either contents (raw text) OR segments (pre-chunked), but not both
    if (segments && segments.length > 0) {
      requestBody.segments = segments;
    } else {
      requestBody.contents = contents;
      requestBody.chunk_size = chunk_size;
      requestBody.chunk_overlap = chunk_overlap;
    }

    const response = await axios.post(getFullUrl('/upload_text'), requestBody, { 
      headers: {
        'Content-Type': 'application/json',
        'authorization': supavecConfig.apiKey
      },
      timeout: 30000
    });

    logApiResponse(context, true, response.data);
    return response.data;
  } catch (error) {
    const standardizedError = mapSupavecError(error);
    logger.error('Error uploading text to Supavec:', standardizedError.originalError);
    logApiResponse(context, false, null, error);
    throw standardizedError;
  }
};

/**
 * List files in Supavec following the official API documentation.
 * @param {object} [pagination] - Optional pagination parameters.
 * @param {number} [pagination.limit] - Number of files to fetch (default: 10).
 * @param {number} [pagination.offset] - Offset of files to fetch (default: 0).
 * @param {string} [order_dir] - Order direction: 'desc' or 'asc'.
 * @returns {Promise<object>} The list of files.
 */
export const listFiles = async (pagination = {}, order_dir = 'desc') => {
  if (!supavecConfig.isProperlyConfigured()) {
    logger.warn('Supavec API not configured, skipping file list.');
    return { success: false, message: 'Supavec API not configured.' };
  }

  const context = logApiRequest('SUPAVEC', 'listFiles', { pagination, order_dir });

  try {
    const requestBody = {};
    
    if (pagination && (pagination.limit !== undefined || pagination.offset !== undefined)) {
      requestBody.pagination = {
        limit: pagination.limit || 10,
        offset: pagination.offset || 0
      };
    }
    
    if (order_dir) {
      requestBody.order_dir = order_dir;
    }

    const response = await axios.post(getFullUrl('/user_files'), requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'authorization': supavecConfig.apiKey
      },
      timeout: 30000
    });

    logApiResponse(context, true, response.data);
    return response.data;
  } catch (error) {
    const standardizedError = mapSupavecError(error);
    logger.error('Error listing files from Supavec:', standardizedError.originalError);
    logApiResponse(context, false, null, error);
    throw standardizedError;
  }
};

/**
 * Overwrite text content in Supavec following the official API documentation.
 * @param {string} file_id - The ID of the file to overwrite.
 * @param {string} contents - The new text content (min 5 chars).
 * @param {string} [name] - Optional name for the content.
 * @param {number} [chunk_size] - Optional chunk size in tokens.
 * @param {number} [chunk_overlap] - Optional chunk overlap in tokens.
 * @returns {Promise<object>} The response from the API.
 */
export const overwriteText = async (file_id, contents, name, chunk_size, chunk_overlap) => {
  if (!supavecConfig.isProperlyConfigured()) {
    logger.warn('Supavec API not configured, skipping text overwrite.');
    return { success: false, message: 'Supavec API not configured.' };
  }

  const context = logApiRequest('SUPAVEC', 'overwriteText', { file_id, hasContents: Boolean(contents) });

  try {
    const requestBody = {
      file_id,
      contents
    };

    if (name) requestBody.name = name;
    if (chunk_size) requestBody.chunk_size = chunk_size;
    if (chunk_overlap) requestBody.chunk_overlap = chunk_overlap;

    const response = await axios.post(getFullUrl('/overwrite_text'), requestBody, { 
      headers: {
        'Content-Type': 'application/json',
        'authorization': supavecConfig.apiKey
      },
      timeout: 30000
    });

    logApiResponse(context, true, response.data);
    return response.data;
  } catch (error) {
    const standardizedError = mapSupavecError(error);
    logger.error('Error overwriting text in Supavec:', standardizedError.originalError);
    logApiResponse(context, false, null, error);
    throw standardizedError;
  }
};

/**
 * Resync a file in Supavec following the official API documentation.
 * @param {string} file_id - The ID of the file to resync.
 * @param {number} [chunk_size] - Optional chunk size in tokens.
 * @param {number} [chunk_overlap] - Optional chunk overlap in tokens.
 * @returns {Promise<object>} The response from the API.
 */
export const resyncFile = async (file_id, chunk_size, chunk_overlap) => {
  if (!supavecConfig.isProperlyConfigured()) {
    logger.warn('Supavec API not configured, skipping file resync.');
    return { success: false, message: 'Supavec API not configured.' };
  }

  const context = logApiRequest('SUPAVEC', 'resyncFile', { file_id, chunk_size, chunk_overlap });

  try {
    const requestBody = { file_id };
    
    if (chunk_size) requestBody.chunk_size = chunk_size;
    if (chunk_overlap) requestBody.chunk_overlap = chunk_overlap;

    const response = await axios.post(getFullUrl('/resync_file'), requestBody, { 
      headers: {
        'Content-Type': 'application/json',
        'authorization': supavecConfig.apiKey
      },
      timeout: 30000
    });

    logApiResponse(context, true, response.data);
    return response.data;
  } catch (error) {
    const standardizedError = mapSupavecError(error);
    logger.error('Error resyncing file in Supavec:', standardizedError.originalError);
    logApiResponse(context, false, null, error);
    throw standardizedError;
  }
};

/**
 * Delete a file from Supavec following the official API documentation.
 * @param {string} file_id - The ID of the file to delete.
 * @returns {Promise<object>} The response from the API.
 */
export const deleteFile = async (file_id) => {
  if (!supavecConfig.isProperlyConfigured()) {
    logger.warn('Supavec API not configured, skipping file deletion.');
    return { success: false, message: 'Supavec API not configured.' };
  }

  const context = logApiRequest('SUPAVEC', 'deleteFile', { file_id });

  try {
    const response = await axios.post(getFullUrl('/delete_file'), {
      file_id
    }, { 
      headers: {
        'Content-Type': 'application/json',
        'authorization': supavecConfig.apiKey
      },
      timeout: 30000
    });

    logApiResponse(context, true, response.data);
    return response.data;
  } catch (error) {
    const standardizedError = mapSupavecError(error);
    logger.error('Error deleting file from Supavec:', standardizedError.originalError);
    logApiResponse(context, false, null, error);
    throw standardizedError;
  }
};

/**
 * Search for embeddings relevant to a query following the official API documentation.
 * @param {string} query - Query for which to get related chunks and embeddings.
 * @param {Array<string>} file_ids - Array of file UUIDs to search in (required).
 * @param {number} [k] - Number of related chunks to return (default: 3).
 * @param {boolean} [include_embeddings] - Whether to include embeddings in response (default: false).
 * @returns {Promise<object>} The search results.
 */
export const searchKnowledgeBase = async (query, file_ids, k = 3, include_embeddings = false) => {
  if (!supavecConfig.isProperlyConfigured()) {
    logger.warn('Supavec API not configured, skipping knowledge base search.');
    return { success: false, message: 'Supavec API not configured.' };
  }

  const context = logApiRequest('SUPAVEC', 'searchKnowledgeBase', { query, file_ids, k });

  try {
    const requestBody = {
      query,
      file_ids,
      k,
      include_embeddings
    };

    const response = await axios.post(getFullUrl('/search'), requestBody, { 
      headers: {
        'Content-Type': 'application/json',
        'authorization': supavecConfig.apiKey
      },
      timeout: 30000
    });

    logApiResponse(context, true, response.data);
    return response.data;
  } catch (error) {
    const standardizedError = mapSupavecError(error);
    logger.error('Error searching knowledge base in Supavec:', standardizedError.originalError);
    logApiResponse(context, false, null, error);
    throw standardizedError;
  }
};

/**
 * Send a chat message to Supavec following the official API documentation.
 * @param {string} query - Query for which to get related chunks and embeddings.
 * @param {Array<string>} file_ids - Array of file UUIDs to search in (required).
 * @param {number} [k] - Number of related chunks to return (default: 3).
 * @param {boolean} [stream] - Whether to stream the response (default: false).
 * @returns {Promise<object>} The chat response.
 */
export const sendChatMessage = async (query, file_ids, k = 3, stream = false) => {
  if (!supavecConfig.isProperlyConfigured()) {
    logger.warn('Supavec API not configured, skipping chat message.');
    return { success: false, message: 'Supavec API not configured.' };
  }

  const context = logApiRequest('SUPAVEC', 'sendChatMessage', { query, file_ids, k, stream });

  try {
    const requestBody = {
      query,
      file_ids,
      k,
      stream
    };

    const response = await axios.post(getFullUrl('/chat'), requestBody, { 
      headers: {
        'Content-Type': 'application/json',
        'authorization': supavecConfig.apiKey
      },
      timeout: 30000
    });

    logApiResponse(context, true, response.data);
    return response.data;
  } catch (error) {
    const standardizedError = mapSupavecError(error);
    logger.error('Error sending chat message to Supavec:', standardizedError.originalError);
    logApiResponse(context, false, null, error);
    throw standardizedError;
  }
};

// ===== HELPER FUNCTIONS FOR BACKWARD COMPATIBILITY =====

/**
 * Create a replica from training data by uploading content.
 * @param {object} trainingData - The training data object containing text, files, and metadata.
 * @param {string} userId - The user ID for the replica.
 * @returns {Promise<object>} The created replica information.
 */
export const createReplicaFromTrainingData = async (trainingData, userId) => {
  if (!supavecConfig.isProperlyConfigured()) {
    logger.warn('Supavec API not configured, skipping replica creation.');
    return { success: false, message: 'Supavec API not configured.' };
  }

  try {
    const uploadedFiles = [];
    
    // Upload text content if provided
    if (trainingData.textContent && trainingData.textContent.length > 0) {
      for (const textItem of trainingData.textContent) {
        const textResult = await uploadText(
          textItem.content,
          textItem.title || 'Training Text'
        );
        if (textResult.file_id) {
          uploadedFiles.push({
            id: textResult.file_id,
            type: 'text',
            title: textItem.title
          });
        }
      }
    }

    // Upload file content if provided
    if (trainingData.files && trainingData.files.length > 0) {
      for (const file of trainingData.files) {
        const fileResult = await uploadFile(
          file.buffer,
          file.filename
        );
        if (fileResult.file_id) {
          uploadedFiles.push({
            id: fileResult.file_id,
            type: 'file',
            filename: file.filename
          });
        }
      }
    }

    // Return replica information
    return {
      success: true,
      replicaId: uploadedFiles.length > 0 ? uploadedFiles[0].id : null,
      userId,
      uploadedFiles,
      knowledgeBaseIds: uploadedFiles.map(f => f.id),
      createdAt: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error creating replica from training data:', error.message);
    throw error;
  }
};

/**
 * Get replica information by ID.
 * @param {string} replicaId - The replica file ID.
 * @returns {Promise<object>} The replica information.
 */
export const getReplicaById = async (replicaId) => {
  if (!supavecConfig.isProperlyConfigured()) {
    logger.warn('Supavec API not configured, skipping replica retrieval.');
    return { success: false, message: 'Supavec API not configured.' };
  }

  try {
    // List files to find the specific replica
    const filesResponse = await listFiles();
    
    if (!filesResponse.success || !filesResponse.results) {
      return { success: false, message: 'Failed to retrieve files list.' };
    }

    const replicaFile = filesResponse.results.find(file => file.file_id === replicaId);
    
    if (!replicaFile) {
      return { success: false, message: 'Replica not found.' };
    }

    return {
      success: true,
      replica: {
        id: replicaFile.file_id,
        filename: replicaFile.file_name,
        createdAt: replicaFile.created_at,
        type: replicaFile.type
      }
    };
  } catch (error) {
    logger.error('Error retrieving replica by ID:', error.message);
    throw error;
  }
};

/**
 * Update replica metadata (placeholder - no direct API support).
 * @param {string} replicaId - The replica file ID.
 * @param {object} metadata - The metadata to update.
 * @param {string} userId - The user ID for the replica.
 * @returns {Promise<object>} The update result.
 */
export const updateReplicaMetadata = async (replicaId, metadata, userId) => {
  if (!supavecConfig.isProperlyConfigured()) {
    logger.warn('Supavec API not configured, skipping metadata update.');
    return { success: false, message: 'Supavec API not configured.' };
  }

  try {
    logger.info(`Updating metadata for replica ${replicaId} for user ${userId}`, metadata);
    
    // For now, return success as metadata updates might be handled differently
    return {
      success: true,
      replicaId,
      userId,
      updatedMetadata: metadata,
      updatedAt: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error updating replica metadata:', error.message);
    throw error;
  }
};

/**
 * Send a contextual chat message with enhanced options.
 * @param {string} query - The chat query.
 * @param {Array<string>} replicaIds - The replica/file IDs to use for context.
 * @param {object} [options] - Additional options for the chat.
 * @param {number} [options.k] - Number of chunks to retrieve.
 * @param {boolean} [options.stream] - Whether to stream the response.
 * @returns {Promise<object>} The chat response.
 */
export const sendContextualChatMessage = async (query, replicaIds, options = {}) => {
  if (!supavecConfig.isProperlyConfigured()) {
    logger.warn('Supavec API not configured, skipping contextual chat.');
    return { success: false, message: 'Supavec API not configured.' };
  }

  try {
    const chatResponse = await sendChatMessage(
      query,
      replicaIds,
      options.k || 3,
      options.stream || false
    );

    return {
      success: true,
      response: chatResponse,
      replicaIds,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error sending contextual chat message:', error.message);
    throw error;
  }
};

/**
 * Stream chat response with enhanced error handling.
 * @param {string} query - The chat query.
 * @param {Array<string>} replicaIds - The replica/file IDs to use for context.
 * @param {object} [options] - Additional options for streaming.
 * @returns {Promise<object>} The streaming response setup.
 */
export const streamChatResponse = async (query, replicaIds, options = {}) => {
  if (!supavecConfig.isProperlyConfigured()) {
    logger.warn('Supavec API not configured, skipping streaming chat.');
    return { success: false, message: 'Supavec API not configured.' };
  }

  try {
    // Enable streaming in the chat request
    const streamingOptions = {
      ...options,
      stream: true
    };

    const response = await sendContextualChatMessage(query, replicaIds, streamingOptions);
    
    return {
      success: true,
      streamingEnabled: true,
      response,
      replicaIds,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error setting up streaming chat response:', error.message);
    
    // Fallback to non-streaming if streaming fails
    logger.info('Falling back to non-streaming chat response');
    const fallbackOptions = { ...options, stream: false };
    return await sendContextualChatMessage(query, replicaIds, fallbackOptions);
  }
};

// ===== SIMPLE HEALTH CHECK USING DOCUMENTED ENDPOINT =====

/**
 * Test Supavec API connectivity using the user_files endpoint.
 * @param {number} [timeout] - Optional timeout for the health check.
 * @returns {Promise<object>} Health check result.
 */
export const healthCheck = async (timeout = 10000) => {
  const startTime = Date.now();
  
  if (!supavecConfig.isProperlyConfigured()) {
    return {
      status: 'unhealthy',
      configured: false,
      message: 'Supavec API not configured',
      responseTime: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };
  }

  try {
    // Try to list files with a very small limit to test connectivity
    await axios.post(getFullUrl('/user_files'), {
      pagination: { limit: 1, offset: 0 }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'authorization': supavecConfig.apiKey
      },
      timeout: timeout
    });

    const responseTime = Date.now() - startTime;
    
    return {
      status: 'healthy',
      configured: true,
      connected: true,
      responseTime,
      timestamp: new Date().toISOString(),
      baseUrl: supavecConfig.baseUrl
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    return {
      status: 'unhealthy',
      configured: true,
      connected: false,
      responseTime,
      error: error.message,
      errorCode: error.response?.status || 'NETWORK_ERROR',
      timestamp: new Date().toISOString(),
      baseUrl: supavecConfig.baseUrl
    };
  }
};