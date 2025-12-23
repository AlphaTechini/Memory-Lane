
import axios from 'axios';
import { supavecConfig } from '../config/supavec.js';
import logger from '../utils/logger.js';
import FormData from 'form-data';
import { transformError, mapSupavecError } from '../utils/errorHandler.js';
import { logApiRequest, logApiResponse } from '../utils/apiLogger.js';

const supavecApi = axios.create({
  baseURL: supavecConfig.baseUrl,
  timeout: 30000,
});

/**
 * Upload a file to Supavec following the official API documentation.
 * @param {Buffer} fileBuffer - The file content as a buffer.
 * @param {string} filename - The name of the file.
 * @param {object} [metadata] - Optional metadata for the file.
 * @param {string} [namespace] - Optional namespace for the file.
 * @returns {Promise<object>} The response from the API.
 */
export const uploadFile = async (fileBuffer, filename, metadata, namespace) => {
  if (!supavecConfig.isProperlyConfigured()) {
    logger.warn('Supavec API not configured, skipping file upload.');
    return { success: false, message: 'Supavec API not configured.' };
  }

  const context = logApiRequest('SUPAVEC', 'uploadFile', { filename, namespace });

  try {
    const form = new FormData();
    form.append('file', fileBuffer, filename);
    if (metadata) {
      form.append('metadata', JSON.stringify(metadata));
    }
    if (namespace) {
      form.append('namespace', namespace);
    }

    const response = await supavecApi.post('/files/upload_file', form, {
      headers: {
        'Authorization': `Bearer ${supavecConfig.apiKey}`,
        ...form.getHeaders(),
      },
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
 * @param {string} text - The text content to upload.
 * @param {string} [title] - Optional title for the text.
 * @param {string} [namespace] - Optional namespace for the text.
 * @returns {Promise<object>} The response from the API.
 */
export const uploadText = async (text, title, namespace) => {
  if (!supavecConfig.isProperlyConfigured()) {
    logger.warn('Supavec API not configured, skipping text upload.');
    return { success: false, message: 'Supavec API not configured.' };
  }

  const context = logApiRequest('SUPAVEC', 'uploadText', { title, namespace });

  try {
    const response = await supavecApi.post('/files/upload_text', {
      text,
      title,
      namespace,
    }, { 
      headers: {
        'Authorization': `Bearer ${supavecConfig.apiKey}`,
        'Content-Type': 'application/json'
      }
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
 * @param {string} [namespace] - Optional namespace to filter by.
 * @param {number} [limit] - Optional limit for pagination.
 * @param {string} [cursor] - Optional cursor for pagination.
 * @returns {Promise<object>} The list of files.
 */
export const listFiles = async (namespace, limit, cursor) => {
  if (!supavecConfig.isProperlyConfigured()) {
    logger.warn('Supavec API not configured, skipping file list.');
    return { success: false, message: 'Supavec API not configured.' };
  }

  const context = logApiRequest('SUPAVEC', 'listFiles', { namespace, limit });

  try {
    const response = await supavecApi.get('/files/user_files', {
      headers: {
        'Authorization': `Bearer ${supavecConfig.apiKey}`,
        'Content-Type': 'application/json'
      },
      params: { namespace, limit, cursor },
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
 * @param {string} text - The new text content.
 * @param {string} [namespace] - Optional namespace for the file.
 * @returns {Promise<object>} The response from the API.
 */
export const overwriteText = async (file_id, text, namespace) => {
  if (!supavecConfig.isProperlyConfigured()) {
    logger.warn('Supavec API not configured, skipping text overwrite.');
    return { success: false, message: 'Supavec API not configured.' };
  }

  const context = logApiRequest('SUPAVEC', 'overwriteText', { file_id, namespace });

  try {
    const response = await supavecApi.post('/files/overwrite_text', {
      file_id,
      text,
      namespace,
    }, { 
      headers: {
        'Authorization': `Bearer ${supavecConfig.apiKey}`,
        'Content-Type': 'application/json'
      }
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
 * @param {string} [namespace] - Optional namespace for the file.
 * @returns {Promise<object>} The response from the API.
 */
export const resyncFile = async (file_id, namespace) => {
  if (!supavecConfig.isProperlyConfigured()) {
    logger.warn('Supavec API not configured, skipping file resync.');
    return { success: false, message: 'Supavec API not configured.' };
  }

  const context = logApiRequest('SUPAVEC', 'resyncFile', { file_id, namespace });

  try {
    const response = await supavecApi.post('/files/resync_file', {
      file_id,
      namespace,
    }, { 
      headers: {
        'Authorization': `Bearer ${supavecConfig.apiKey}`,
        'Content-Type': 'application/json'
      }
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
 * Send a chat message to Supavec following the official API documentation.
 * @param {Array<object>} messages - The conversation history.
 * @param {Array<string>} [kb_ids] - Optional knowledge base IDs to use for context.
 * @param {string} [model] - Optional model to use.
 * @param {number} [max_tokens] - Optional max tokens for the response.
 * @param {boolean} [stream] - Optional flag to stream the response.
 * @returns {Promise<object>} The chat response.
 */
export const sendChatMessage = async (messages, kb_ids, model, max_tokens, stream) => {
  if (!supavecConfig.isProperlyConfigured()) {
    logger.warn('Supavec API not configured, skipping chat message.');
    return { success: false, message: 'Supavec API not configured.' };
  }

  const context = logApiRequest('SUPAVEC', 'sendChatMessage', { messageCount: messages?.length, kb_ids });

  try {
    const response = await supavecApi.post('/chat/chat', {
      messages,
      kb_ids,
      model,
      max_tokens,
      stream,
    }, { 
      headers: {
        'Authorization': `Bearer ${supavecConfig.apiKey}`,
        'Content-Type': 'application/json'
      }
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

/**
 * Search the knowledge base following the official API documentation.
 * @param {string} query - The search query.
 * @param {number} [top_k] - The number of top hits to return.
 * @param {string} [namespace] - The namespace to search within.
 * @param {object} [filters] - Optional filters.
 * @returns {Promise<object>} The search results.
 */
export const searchKnowledgeBase = async (query, top_k, namespace, filters) => {
  if (!supavecConfig.isProperlyConfigured()) {
    logger.warn('Supavec API not configured, skipping knowledge base search.');
    return { success: false, message: 'Supavec API not configured.' };
  }

  const context = logApiRequest('SUPAVEC', 'searchKnowledgeBase', { query, top_k, namespace });

  try {
    const response = await supavecApi.post('/retrieval/search', {
      query,
      top_k,
      namespace,
      filters,
    }, { 
      headers: {
        'Authorization': `Bearer ${supavecConfig.apiKey}`,
        'Content-Type': 'application/json'
      }
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

// ===== REPLICA-SPECIFIC FUNCTIONS =====

/**
 * Create a replica from training data by uploading content and organizing it as a knowledge base.
 * @param {object} trainingData - The training data object containing text, files, and metadata.
 * @param {string} namespace - The namespace (user ID) for the replica.
 * @returns {Promise<object>} The created replica information.
 */
export const createReplicaFromTrainingData = async (trainingData, namespace) => {
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
          textItem.title || 'Training Text',
          namespace
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
          file.filename,
          file.metadata,
          namespace
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
      namespace,
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
 * @param {string} namespace - The namespace to search within.
 * @returns {Promise<object>} The replica information.
 */
export const getReplicaById = async (replicaId, namespace) => {
  if (!supavecConfig.isProperlyConfigured()) {
    logger.warn('Supavec API not configured, skipping replica retrieval.');
    return { success: false, message: 'Supavec API not configured.' };
  }

  try {
    // List files to find the specific replica
    const filesResponse = await listFiles(namespace);
    
    if (!filesResponse.success || !filesResponse.files) {
      return { success: false, message: 'Failed to retrieve files list.' };
    }

    const replicaFile = filesResponse.files.find(file => file.file_id === replicaId);
    
    if (!replicaFile) {
      return { success: false, message: 'Replica not found.' };
    }

    return {
      success: true,
      replica: {
        id: replicaFile.file_id,
        filename: replicaFile.filename,
        namespace: replicaFile.namespace,
        createdAt: replicaFile.created_at,
        metadata: replicaFile.metadata || {}
      }
    };
  } catch (error) {
    logger.error('Error retrieving replica by ID:', error.message);
    throw error;
  }
};

/**
 * Update replica metadata.
 * @param {string} replicaId - The replica file ID.
 * @param {object} metadata - The metadata to update.
 * @param {string} namespace - The namespace for the replica.
 * @returns {Promise<object>} The update result.
 */
export const updateReplicaMetadata = async (replicaId, metadata, namespace) => {
  if (!supavecConfig.isProperlyConfigured()) {
    logger.warn('Supavec API not configured, skipping metadata update.');
    return { success: false, message: 'Supavec API not configured.' };
  }

  try {
    // Note: Supavec API may not have direct metadata update endpoint
    // This is a placeholder implementation that would need to be adjusted
    // based on actual Supavec API capabilities
    
    logger.info(`Updating metadata for replica ${replicaId} in namespace ${namespace}`, metadata);
    
    // For now, return success as metadata updates might be handled differently
    return {
      success: true,
      replicaId,
      namespace,
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
 * @param {Array<object>} messages - The conversation history.
 * @param {Array<string>} replicaIds - The replica/knowledge base IDs to use for context.
 * @param {object} [options] - Additional options for the chat.
 * @param {string} [options.model] - The model to use.
 * @param {number} [options.maxTokens] - Maximum tokens for response.
 * @param {boolean} [options.stream] - Whether to stream the response.
 * @param {string} [options.namespace] - The namespace for the chat.
 * @returns {Promise<object>} The chat response.
 */
export const sendContextualChatMessage = async (messages, replicaIds, options = {}) => {
  if (!supavecConfig.isProperlyConfigured()) {
    logger.warn('Supavec API not configured, skipping contextual chat.');
    return { success: false, message: 'Supavec API not configured.' };
  }

  try {
    const chatResponse = await sendChatMessage(
      messages,
      replicaIds,
      options.model,
      options.maxTokens,
      options.stream
    );

    return {
      success: true,
      response: chatResponse,
      replicaIds,
      namespace: options.namespace,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error sending contextual chat message:', error.message);
    throw error;
  }
};

/**
 * Stream chat response with enhanced error handling.
 * @param {Array<object>} messages - The conversation history.
 * @param {Array<string>} replicaIds - The replica/knowledge base IDs to use for context.
 * @param {object} [options] - Additional options for streaming.
 * @returns {Promise<object>} The streaming response setup.
 */
export const streamChatResponse = async (messages, replicaIds, options = {}) => {
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

    const response = await sendContextualChatMessage(messages, replicaIds, streamingOptions);
    
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
    return await sendContextualChatMessage(messages, replicaIds, fallbackOptions);
  }
};

// ===== NAMESPACE MANAGEMENT UTILITIES =====

/**
 * Delete a file from Supavec (legacy function for backward compatibility).
 * Note: Supavec API doesn't have a direct delete endpoint in the current docs.
 * This function is kept for backward compatibility but may not work.
 * @param {string} file_id - The ID of the file to delete.
 * @param {string} [namespace] - Optional namespace for the file.
 * @returns {Promise<object>} The response from the API.
 */
export const deleteFile = async (file_id, namespace) => {
  if (!supavecConfig.isProperlyConfigured()) {
    logger.warn('Supavec API not configured, skipping file deletion.');
    return { success: false, message: 'Supavec API not configured.' };
  }

  const context = logApiRequest('SUPAVEC', 'deleteFile', { file_id, namespace });

  try {
    // Note: This endpoint may not exist in the current Supavec API
    // Keeping for backward compatibility
    const response = await supavecApi.delete('/files/delete_file', {
      headers: {
        'Authorization': `Bearer ${supavecConfig.apiKey}`,
        'Content-Type': 'application/json'
      },
      params: { file_id, namespace },
    });

    logApiResponse(context, true, response.data);
    return response.data;
  } catch (error) {
    const standardizedError = mapSupavecError(error);
    logger.error('Error deleting file from Supavec:', standardizedError.originalError);
    logApiResponse(context, false, null, error);
    
    // Return a more helpful error message
    return { 
      success: false, 
      message: 'File deletion may not be supported by current Supavec API version',
      error: standardizedError.message 
    };
  }
};

/**
 * Validate namespace access for a user.
 * @param {string} namespace - The namespace to validate.
 * @param {string} userId - The user ID requesting access.
 * @param {string} [userRole] - The user's role (caretaker, patient, admin).
 * @returns {Promise<object>} Validation result.
 */
export const validateNamespaceAccess = async (namespace, userId, userRole = 'caretaker') => {
  if (!supavecConfig.isProperlyConfigured()) {
    logger.warn('Supavec API not configured, skipping namespace validation.');
    return { success: false, message: 'Supavec API not configured.' };
  }

  try {
    // For caretakers, they can only access their own namespace (their user ID)
    if (userRole === 'caretaker') {
      const hasAccess = namespace === userId;
      return {
        success: true,
        hasAccess,
        namespace,
        userId,
        userRole,
        reason: hasAccess ? 'Owner access' : 'Namespace does not match user ID'
      };
    }
    
    // For patients, they need explicit permission (handled by whitelist in local DB)
    // This function validates the namespace exists and is accessible
    if (userRole === 'patient') {
      try {
        const filesResponse = await listFiles(namespace, 1); // Just check if namespace exists
        const namespaceExists = filesResponse.success && filesResponse.files !== undefined;
        
        return {
          success: true,
          hasAccess: namespaceExists,
          namespace,
          userId,
          userRole,
          reason: namespaceExists ? 'Namespace exists - check local whitelist' : 'Namespace not found'
        };
      } catch (error) {
        return {
          success: true,
          hasAccess: false,
          namespace,
          userId,
          userRole,
          reason: 'Error accessing namespace'
        };
      }
    }
    
    // For admin users, allow access to any namespace
    if (userRole === 'admin') {
      return {
        success: true,
        hasAccess: true,
        namespace,
        userId,
        userRole,
        reason: 'Admin access'
      };
    }
    
    // Unknown role
    return {
      success: true,
      hasAccess: false,
      namespace,
      userId,
      userRole,
      reason: 'Unknown user role'
    };
  } catch (error) {
    logger.error('Error validating namespace access:', error.message);
    return {
      success: false,
      hasAccess: false,
      namespace,
      userId,
      userRole,
      error: error.message
    };
  }
};

/**
 * List files in a namespace with filtering capabilities.
 * @param {string} namespace - The namespace to list files from.
 * @param {object} [filters] - Optional filters for the file list.
 * @param {string} [filters.fileType] - Filter by file type (text, file, etc.).
 * @param {string} [filters.searchTerm] - Search term to filter filenames.
 * @param {Date} [filters.createdAfter] - Filter files created after this date.
 * @param {Date} [filters.createdBefore] - Filter files created before this date.
 * @param {number} [filters.limit] - Limit number of results.
 * @param {string} [filters.cursor] - Pagination cursor.
 * @returns {Promise<object>} Filtered file list.
 */
export const listNamespaceFiles = async (namespace, filters = {}) => {
  if (!supavecConfig.isProperlyConfigured()) {
    logger.warn('Supavec API not configured, skipping namespace file listing.');
    return { success: false, message: 'Supavec API not configured.' };
  }

  try {
    // Get all files from the namespace
    const filesResponse = await listFiles(namespace, filters.limit, filters.cursor);
    
    if (!filesResponse.success || !filesResponse.files) {
      return filesResponse;
    }
    
    let filteredFiles = filesResponse.files;
    
    // Apply filters
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      filteredFiles = filteredFiles.filter(file => 
        (file.filename && file.filename.toLowerCase().includes(searchLower)) ||
        (file.title && file.title.toLowerCase().includes(searchLower))
      );
    }
    
    if (filters.fileType) {
      filteredFiles = filteredFiles.filter(file => {
        // This would need to be adjusted based on how Supavec marks file types
        return file.type === filters.fileType || 
               (file.metadata && file.metadata.type === filters.fileType);
      });
    }
    
    if (filters.createdAfter) {
      filteredFiles = filteredFiles.filter(file => {
        if (!file.created_at) return false;
        const fileDate = new Date(file.created_at);
        return fileDate >= filters.createdAfter;
      });
    }
    
    if (filters.createdBefore) {
      filteredFiles = filteredFiles.filter(file => {
        if (!file.created_at) return false;
        const fileDate = new Date(file.created_at);
        return fileDate <= filters.createdBefore;
      });
    }
    
    return {
      success: true,
      files: filteredFiles,
      namespace,
      totalCount: filteredFiles.length,
      filters: filters,
      hasMore: filesResponse.hasMore || false,
      cursor: filesResponse.cursor
    };
  } catch (error) {
    logger.error('Error listing namespace files:', error.message);
    throw error;
  }
};

/**
 * Get namespace for a user based on configuration strategy.
 * @param {string} userId - The user ID.
 * @param {string} [userEmail] - The user email (if using email strategy).
 * @param {object} [options] - Additional options.
 * @returns {string} The namespace for the user.
 */
export const getUserNamespace = async (userId, userEmail, options = {}) => {
  try {
    // Dynamic import to avoid circular dependencies
    const { migrationConfig } = await import('../config/migration.js');
    return migrationConfig.getNamespaceForUser(userId, userEmail);
  } catch (error) {
    logger.error('Error getting user namespace:', error.message);
    // Fallback to USER_ID strategy
    return userId;
  }
};

/**
 * Map namespace back to user ID (reverse mapping).
 * @param {string} namespace - The namespace to map.
 * @param {string} [strategy] - The namespace strategy used.
 * @returns {object} Mapping result with user information.
 */
export const mapNamespaceToUser = (namespace, strategy = 'USER_ID') => {
  try {
    switch (strategy) {
      case 'USER_ID':
        // Direct mapping - namespace is the user ID
        return {
          success: true,
          userId: namespace,
          namespace,
          strategy
        };
        
      case 'EMAIL':
        // For email strategy, we'd need to look up the user by email
        // This would require database access, so return info for lookup
        return {
          success: true,
          userEmail: namespace,
          namespace,
          strategy,
          requiresLookup: true
        };
        
      case 'CUSTOM':
        // Custom strategy would need additional logic
        return {
          success: false,
          namespace,
          strategy,
          message: 'Custom namespace strategy requires additional implementation'
        };
        
      default:
        return {
          success: false,
          namespace,
          strategy,
          message: 'Unknown namespace strategy'
        };
    }
  } catch (error) {
    logger.error('Error mapping namespace to user:', error.message);
    return {
      success: false,
      namespace,
      strategy,
      error: error.message
    };
  }
};

/**
 * Validate that a user can access a specific replica in a namespace.
 * @param {string} replicaId - The replica file ID.
 * @param {string} namespace - The namespace containing the replica.
 * @param {string} userId - The user requesting access.
 * @param {string} [userRole] - The user's role.
 * @returns {Promise<object>} Access validation result.
 */
export const validateReplicaAccess = async (replicaId, namespace, userId, userRole = 'caretaker') => {
  if (!supavecConfig.isProperlyConfigured()) {
    logger.warn('Supavec API not configured, skipping replica access validation.');
    return { success: false, message: 'Supavec API not configured.' };
  }

  try {
    // First validate namespace access
    const namespaceAccess = await validateNamespaceAccess(namespace, userId, userRole);
    
    if (!namespaceAccess.success || !namespaceAccess.hasAccess) {
      return {
        success: true,
        hasAccess: false,
        replicaId,
        namespace,
        userId,
        userRole,
        reason: 'No namespace access: ' + namespaceAccess.reason
      };
    }
    
    // Then check if the replica exists in the namespace
    const replicaInfo = await getReplicaById(replicaId, namespace);
    
    if (!replicaInfo.success) {
      return {
        success: true,
        hasAccess: false,
        replicaId,
        namespace,
        userId,
        userRole,
        reason: 'Replica not found in namespace'
      };
    }
    
    return {
      success: true,
      hasAccess: true,
      replicaId,
      namespace,
      userId,
      userRole,
      reason: 'Access granted',
      replicaInfo: replicaInfo.replica
    };
  } catch (error) {
    logger.error('Error validating replica access:', error.message);
    return {
      success: false,
      hasAccess: false,
      replicaId,
      namespace,
      userId,
      userRole,
      error: error.message
    };
  }
};

// ===== HEALTH CHECK FUNCTIONS =====

/**
 * Test Supavec API connectivity and basic functionality.
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
    // Create a test axios instance with shorter timeout for health checks
    const healthApi = axios.create({
      baseURL: supavecConfig.baseUrl,
      timeout: timeout,
      headers: {
        'Authorization': `Bearer ${supavecConfig.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    // Try to list files with a very small limit to test connectivity
    const response = await healthApi.get('/files/user_files', {
      params: { limit: 1 }
    });

    const responseTime = Date.now() - startTime;
    
    return {
      status: 'healthy',
      configured: true,
      connected: true,
      responseTime,
      apiVersion: response.headers['x-api-version'] || 'unknown',
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

/**
 * Get detailed Supavec service status including configuration and performance metrics.
 * @returns {Promise<object>} Detailed status information.
 */
export const getServiceStatus = async () => {
  const startTime = Date.now();
  
  try {
    const healthResult = await healthCheck(5000);
    
    return {
      service: 'supavec',
      ...healthResult,
      configuration: {
        baseUrl: supavecConfig.baseUrl,
        configured: supavecConfig.isProperlyConfigured(),
        hasApiKey: Boolean(supavecConfig.apiKey),
        timeout: 30000 // Default timeout from service
      },
      capabilities: {
        fileUpload: true,
        textUpload: true,
        chat: true,
        search: true,
        namespaces: true,
        streaming: true
      },
      totalCheckTime: Date.now() - startTime
    };
  } catch (error) {
    return {
      service: 'supavec',
      status: 'error',
      configured: supavecConfig.isProperlyConfigured(),
      error: error.message,
      timestamp: new Date().toISOString(),
      totalCheckTime: Date.now() - startTime
    };
  }
};
