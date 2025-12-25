/**
 * Replica Abstraction Service
 * 
 * Provides a unified interface for replica operations that can route to either
 * Sensay or Supavec APIs based on configuration. This abstraction layer enables
 * gradual migration while maintaining backward compatibility.
 */

import { migrationConfig } from '../config/migration.js';
import logger from '../utils/logger.js';
import { transformError, createErrorResponse, logError } from '../utils/errorHandler.js';
import { logApiRequest, logApiResponse, logFallback } from '../utils/apiLogger.js';
import { withRetry, withFallback, recordSuccess, recordFailure } from '../utils/fallbackStrategy.js';

// Lazy imports to avoid circular dependencies
let sensayService = null;
let supavecService = null;

const getSensayService = async () => {
  if (!sensayService) {
    sensayService = await import('./sensayService.js');
  }
  return sensayService;
};

const getSupavecService = async () => {
  if (!supavecService) {
    supavecService = await import('./supavecService.js');
  }
  return supavecService;
};

/**
 * Determine which API to use for a given operation
 * @param {string} operation - The operation type (CREATE_REPLICA, CHAT, etc.)
 * @param {object} [replicaData] - Optional replica data to check for API source
 * @returns {string} 'SUPAVEC' or 'SENSAY'
 */
const determineApiToUse = (operation, replicaData = null) => {
  // If replica data has an explicit API source, use that
  if (replicaData && replicaData.apiSource) {
    return replicaData.apiSource;
  }
  
  // Otherwise, use configuration to determine
  return migrationConfig.shouldUseSupavec(operation) ? 'SUPAVEC' : 'SENSAY';
};

/**
 * Create a new replica using the appropriate API
 * @param {object} replicaData - Replica configuration data
 * @param {string} replicaData.name - Replica name
 * @param {string} replicaData.description - Replica description
 * @param {string} replicaData.greeting - Initial greeting message
 * @param {array} [replicaData.textContent] - Array of text training content
 * @param {array} [replicaData.files] - Array of file training content
 * @param {string} userId - User ID creating the replica
 * @param {string} [userEmail] - User email (for namespace mapping)
 * @returns {Promise<object>} Created replica information
 */
export const createReplica = async (replicaData, userId, userEmail = null) => {
  const apiToUse = determineApiToUse('CREATE_REPLICA');
  const context = logApiRequest(apiToUse, 'createReplica', { userId, replicaName: replicaData.name });
  
  const primaryFn = async () => {
    if (apiToUse === 'SUPAVEC') {
      const supavec = await getSupavecService();
      const namespace = migrationConfig.getNamespaceForUser(userId, userEmail);
      
      const result = await supavec.createReplicaFromTrainingData(replicaData, namespace);
      recordSuccess('SUPAVEC');
      
      return {
        success: true,
        apiSource: 'SUPAVEC',
        replicaId: result.replicaId,
        namespace,
        knowledgeBaseIds: result.knowledgeBaseIds || [],
        uploadedFiles: result.uploadedFiles || [],
        createdAt: result.createdAt || new Date().toISOString()
      };
    } else {
      const sensay = await getSensayService();
      
      const sensayReplicaData = {
        name: replicaData.name,
        shortDescription: replicaData.description || replicaData.shortDescription,
        greeting: replicaData.greeting,
        slug: replicaData.slug || replicaData.name.toLowerCase().replace(/\s+/g, '-'),
        ownerID: userId,
        llm: replicaData.llm || { model: 'gpt-4o' }
      };
      
      const replica = await sensay.createReplica(sensayReplicaData);
      recordSuccess('SENSAY');
      
      return {
        success: true,
        apiSource: 'SENSAY',
        replicaId: replica.id || replica.uuid,
        sensayReplicaId: replica.id || replica.uuid,
        replica,
        createdAt: new Date().toISOString()
      };
    }
  };
  
  const fallbackFn = async () => {
    const sensay = await getSensayService();
    
    const sensayReplicaData = {
      name: replicaData.name,
      shortDescription: replicaData.description || replicaData.shortDescription,
      greeting: replicaData.greeting,
      slug: replicaData.slug || replicaData.name.toLowerCase().replace(/\s+/g, '-'),
      ownerID: userId,
      llm: replicaData.llm || { model: 'gpt-4o' }
    };
    
    const replica = await sensay.createReplica(sensayReplicaData);
    recordSuccess('SENSAY');
    
    return {
      success: true,
      apiSource: 'SENSAY',
      replicaId: replica.id || replica.uuid,
      sensayReplicaId: replica.id || replica.uuid,
      replica,
      createdAt: new Date().toISOString()
    };
  };
  
  try {
    let result;
    
    if (apiToUse === 'SUPAVEC' && migrationConfig.canFallbackToSensay()) {
      // Use retry with fallback
      result = await withFallback(
        () => withRetry(primaryFn, { apiSource: apiToUse, operation: 'createReplica' }),
        () => withRetry(fallbackFn, { apiSource: 'SENSAY', operation: 'createReplica' }),
        { primaryApi: 'SUPAVEC', fallbackApi: 'SENSAY', operation: 'createReplica' }
      );
    } else {
      // Use retry only
      result = await withRetry(primaryFn, { apiSource: apiToUse, operation: 'createReplica' });
    }
    
    logApiResponse(context, true, result);
    return result;
  } catch (error) {
    recordFailure(apiToUse);
    const standardizedError = transformError(error, apiToUse);
    logError(standardizedError, 'createReplica', { userId, replicaName: replicaData.name });
    logApiResponse(context, false, null, error);
    throw standardizedError;
  }
};

/**
 * List replicas for a user from the appropriate API
 * @param {string} userId - User ID
 * @param {string} [userEmail] - User email (for namespace mapping)
 * @param {object} [options] - Additional options
 * @param {string} [options.apiSource] - Force specific API ('SUPAVEC' or 'SENSAY')
 * @returns {Promise<array>} Array of replica objects
 */
export const listUserReplicas = async (userId, userEmail = null, options = {}) => {
  const apiToUse = options.apiSource || determineApiToUse('LIST_REPLICAS');
  
  logger.info(`Listing replicas using ${apiToUse} API`, { userId, mode: migrationConfig.mode });
  
  try {
    const replicas = [];
    
    // Get replicas from Supavec if enabled
    if (apiToUse === 'SUPAVEC' || migrationConfig.mode === 'DUAL') {
      try {
        const supavec = await getSupavecService();
        const namespace = migrationConfig.getNamespaceForUser(userId, userEmail);
        
        const filesResponse = await supavec.listFiles(namespace);
        
        if (filesResponse.success && filesResponse.files) {
          const supavecReplicas = filesResponse.files.map(file => ({
            id: file.file_id,
            fileId: file.file_id,
            name: file.filename || file.title || 'Unnamed Replica',
            namespace,
            apiSource: 'SUPAVEC',
            createdAt: file.created_at,
            metadata: file.metadata || {}
          }));
          
          replicas.push(...supavecReplicas);
        }
      } catch (supavecError) {
        logger.error('Error fetching Supavec replicas:', supavecError.message);
        if (apiToUse === 'SUPAVEC' && !migrationConfig.canFallbackToSensay()) {
          throw supavecError;
        }
      }
    }
    
    // Get replicas from Sensay if enabled
    if (apiToUse === 'SENSAY' || migrationConfig.mode === 'DUAL') {
      try {
        const sensay = await getSensayService();
        const sensayReplicas = await sensay.listReplicas(userId);
        
        const normalizedSensayReplicas = sensayReplicas.map(replica => ({
          id: replica.id || replica.uuid,
          sensayReplicaId: replica.id || replica.uuid,
          name: replica.name,
          description: replica.shortDescription || replica.description,
          apiSource: 'SENSAY',
          createdAt: replica.createdAt,
          ...replica
        }));
        
        replicas.push(...normalizedSensayReplicas);
      } catch (sensayError) {
        logger.error('Error fetching Sensay replicas:', sensayError.message);
        if (apiToUse === 'SENSAY') {
          throw sensayError;
        }
      }
    }
    
    return replicas;
  } catch (error) {
    logger.error('Error listing user replicas:', error.message);
    throw error;
  }
};

/**
 * Delete a replica from the appropriate API
 * @param {string} replicaId - Replica ID to delete
 * @param {string} userId - User ID
 * @param {object} [replicaData] - Optional replica data with API source info
 * @returns {Promise<object>} Deletion result
 */
export const deleteReplica = async (replicaId, userId, replicaData = null) => {
  const apiToUse = determineApiToUse('DELETE_REPLICA', replicaData);
  
  logger.info(`Deleting replica ${replicaId} using ${apiToUse} API`, { userId });
  
  try {
    if (apiToUse === 'SUPAVEC') {
      const supavec = await getSupavecService();
      const namespace = replicaData?.namespace || 
                       replicaData?.supavecNamespace || 
                       migrationConfig.getNamespaceForUser(userId);
      
      const result = await supavec.deleteFile(replicaId, namespace);
      
      return {
        success: true,
        apiSource: 'SUPAVEC',
        replicaId,
        namespace,
        deletedAt: new Date().toISOString()
      };
    } else {
      const sensay = await getSensayService();
      const result = await sensay.deleteReplica(replicaId);
      
      return {
        success: true,
        apiSource: 'SENSAY',
        replicaId,
        deletedAt: new Date().toISOString()
      };
    }
  } catch (error) {
    logger.error(`Error deleting replica with ${apiToUse}:`, error.message);
    throw error;
  }
};

/**
 * Update replica metadata (including whitelist emails)
 * @param {string} replicaId - Replica ID to update
 * @param {object} updateData - Metadata to update
 * @param {string} userId - User ID
 * @param {object} [replicaData] - Optional replica data with API source info
 * @returns {Promise<object>} Update result
 */
export const updateReplicaMetadata = async (replicaId, updateData, userId, replicaData = null) => {
  const apiToUse = determineApiToUse('UPDATE_REPLICA', replicaData);
  
  logger.info(`Updating replica ${replicaId} metadata using ${apiToUse} API`, { userId });
  
  try {
    if (apiToUse === 'SUPAVEC') {
      const supavec = await getSupavecService();
      const namespace = replicaData?.namespace || 
                       replicaData?.supavecNamespace || 
                       migrationConfig.getNamespaceForUser(userId);
      
      // For Supavec, we need to update the replica metadata
      // Note: Supavec may not support all Sensay metadata fields
      const supavecUpdateData = {
        name: updateData.name,
        description: updateData.shortDescription || updateData.description,
        // Store whitelist emails in metadata for later retrieval
        metadata: {
          whitelistEmails: updateData.whitelistEmails || [],
          private: updateData.private || false,
          greeting: updateData.greeting,
          ...updateData.metadata
        }
      };
      
      const result = await supavec.updateReplicaMetadata(replicaId, supavecUpdateData, namespace);
      
      return {
        success: true,
        apiSource: 'SUPAVEC',
        replicaId,
        namespace,
        updatedAt: new Date().toISOString(),
        ...result
      };
    } else {
      const sensay = await getSensayService();
      const result = await sensay.updateReplica(replicaId, updateData);
      
      return {
        success: true,
        apiSource: 'SENSAY',
        replicaId,
        updatedAt: new Date().toISOString(),
        ...result
      };
    }
  } catch (error) {
    logger.error(`Error updating replica metadata with ${apiToUse}:`, error.message);
    throw error;
  }
};

/**
 * Validate user access to a replica
 * @param {string} replicaId - Replica ID
 * @param {string} userId - User ID requesting access
 * @param {object} [replicaData] - Optional replica data with API source info
 * @param {string} [replicaData.userRole] - User role (caretaker/patient)
 * @param {string} [replicaData.patientEmail] - Patient email for whitelist validation
 * @param {string} [replicaData.namespace] - Supavec namespace to check
 * @returns {Promise<object>} Access validation result
 */
export const validateReplicaAccess = async (replicaId, userId, replicaData = null) => {
  const apiToUse = determineApiToUse('VALIDATE_ACCESS', replicaData);
  
  logger.info(`Validating replica access using ${apiToUse} API`, { replicaId, userId, userRole: replicaData?.userRole });
  
  try {
    if (apiToUse === 'SUPAVEC') {
      const supavec = await getSupavecService();
      const namespace = replicaData?.namespace || 
                       replicaData?.supavecNamespace || 
                       migrationConfig.getNamespaceForUser(userId);
      
      const userRole = replicaData?.userRole || 'caretaker';
      
      // Simple validation - check if replica exists by trying to get it
      try {
        const replicaInfo = await supavec.getReplicaById(replicaId);
        
        if (!replicaInfo.success) {
          return {
            success: true,
            hasAccess: false,
            replicaId,
            namespace,
            userId,
            userRole,
            reason: 'Replica not found',
            apiSource: 'SUPAVEC'
          };
        }
        
        // For caretakers, they can access their own replicas
        if (userRole === 'caretaker') {
          return {
            success: true,
            hasAccess: true,
            replicaId,
            namespace,
            userId,
            userRole,
            reason: 'Owner access',
            apiSource: 'SUPAVEC'
          };
        }
        
        // For patients, check if they have access via whitelist (handled by local DB)
        if (userRole === 'patient') {
          return {
            success: true,
            hasAccess: true, // Will be validated by local DB whitelist
            replicaId,
            namespace,
            userId,
            userRole,
            reason: 'Patient access - check local whitelist',
            apiSource: 'SUPAVEC'
          };
        }
        
        return {
          success: true,
          hasAccess: false,
          replicaId,
          namespace,
          userId,
          userRole,
          reason: 'Unknown user role',
          apiSource: 'SUPAVEC'
        };
      } catch (error) {
        return {
          success: true,
          hasAccess: false,
          replicaId,
          namespace,
          userId,
          userRole: userRole,
          reason: 'Error accessing replica: ' + error.message,
          apiSource: 'SUPAVEC'
        };
      }

      // For patient access, also validate email whitelist
      if (userRole === 'patient' && replicaData?.patientEmail) {
        try {
          // Get replica metadata to check whitelist
          const User = (await import('../models/User.js')).default;
          const caretaker = await User.findById(userId);
          
          if (!caretaker) {
            return {
              success: false,
              hasAccess: false,
              apiSource: 'SUPAVEC',
              replicaId,
              userId,
              error: 'Caretaker not found'
            };
          }

          // Find the replica in caretaker's local data to check whitelist
          const replica = caretaker.replicas?.find(r => 
            r.replicaId === replicaId || r.fileId === replicaId
          );
          
          if (replica && replica.whitelistEmails) {
            const normalizedEmail = replicaData.patientEmail.toLowerCase().trim();
            const isWhitelisted = replica.whitelistEmails.includes(normalizedEmail);
            
            if (!isWhitelisted) {
              return {
                success: false,
                hasAccess: false,
                apiSource: 'SUPAVEC',
                replicaId,
                userId,
                error: 'Patient email not whitelisted for this replica'
              };
            }
          }
        } catch (whitelistError) {
          logger.error('Error checking email whitelist:', whitelistError.message);
          return {
            success: false,
            hasAccess: false,
            apiSource: 'SUPAVEC',
            replicaId,
            userId,
            error: 'Failed to validate email whitelist'
          };
        }
      }
      
      return {
        ...validation,
        apiSource: 'SUPAVEC'
      };
    } else {
      // For Sensay, we rely on local database access control
      // This is a simplified validation
      return {
        success: true,
        hasAccess: true,
        apiSource: 'SENSAY',
        replicaId,
        userId,
        reason: 'Sensay access validated via local database'
      };
    }
  } catch (error) {
    logger.error('Error validating replica access:', error.message);
    return {
      success: false,
      hasAccess: false,
      apiSource: apiToUse,
      replicaId,
      userId,
      error: error.message
    };
  }
};

/**
 * Reconcile replica state between local database and remote API
 * @param {string} userId - User ID
 * @param {array} localReplicas - Replicas from local database
 * @returns {Promise<object>} Reconciliation result
 */
export const reconcileReplicaState = async (userId, localReplicas = []) => {
  logger.info('Reconciling replica state', { userId, localCount: localReplicas.length });
  
  try {
    // Get replicas from remote APIs
    const remoteReplicas = await listUserReplicas(userId);
    
    // Create maps for comparison
    const localMap = new Map(localReplicas.map(r => [r.fileId || r.sensayReplicaId, r]));
    const remoteMap = new Map(remoteReplicas.map(r => [r.id, r]));
    
    // Find differences
    const missingInLocal = remoteReplicas.filter(r => !localMap.has(r.id));
    const missingInRemote = localReplicas.filter(r => {
      const remoteId = r.fileId || r.sensayReplicaId;
      return remoteId && !remoteMap.has(remoteId);
    });
    const inSync = localReplicas.filter(r => {
      const remoteId = r.fileId || r.sensayReplicaId;
      return remoteId && remoteMap.has(remoteId);
    });
    
    return {
      success: true,
      userId,
      summary: {
        totalLocal: localReplicas.length,
        totalRemote: remoteReplicas.length,
        inSync: inSync.length,
        missingInLocal: missingInLocal.length,
        missingInRemote: missingInRemote.length
      },
      missingInLocal,
      missingInRemote,
      inSync,
      reconciledAt: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error reconciling replica state:', error.message);
    throw error;
  }
};

/**
 * Get configuration summary for debugging
 * @returns {object} Configuration summary
 */
export const getConfigurationSummary = () => {
  return {
    mode: migrationConfig.mode,
    useSupavecForNewReplicas: migrationConfig.useSupavecForNewReplicas,
    useSupavecForChat: migrationConfig.useSupavecForChat,
    enableSensayFallback: migrationConfig.enableSensayFallback,
    namespaceStrategy: migrationConfig.namespaceStrategy,
    apis: {
      supavec: {
        configured: migrationConfig.supavec.isConfigured(),
        enabled: migrationConfig.supavec.enabled
      },
      sensay: {
        configured: migrationConfig.sensay.isConfigured(),
        enabled: migrationConfig.sensay.enabled
      }
    }
  };
};

// ===== CHAT ABSTRACTION WITH FALLBACK =====

/**
 * Send a chat message using the appropriate API with fallback support
 * @param {string} replicaId - Replica ID to chat with
 * @param {string} message - User message
 * @param {object} context - Chat context
 * @param {array} [context.conversationHistory] - Previous messages in conversation
 * @param {string} [context.conversationId] - Conversation ID for tracking
 * @param {string} userId - User ID sending the message
 * @param {object} [replicaData] - Optional replica data with API source info
 * @param {object} [options] - Additional options
 * @param {boolean} [options.streaming] - Enable streaming response
 * @param {string} [options.model] - Model to use
 * @param {number} [options.maxTokens] - Maximum tokens for response
 * @returns {Promise<object>} Chat response
 */
export const sendChatMessage = async (
  replicaId,
  message,
  context = {},
  userId,
  replicaData = null,
  options = {}
) => {
  const apiToUse = determineApiToUse('CHAT', replicaData);
  const logContext = logApiRequest(apiToUse, 'sendChatMessage', { replicaId, userId, messageLength: message.length });
  
  const primaryFn = async () => {
    if (apiToUse === 'SUPAVEC') {
      const supavec = await getSupavecService();
      
      const messages = [];
      
      if (context.conversationHistory && Array.isArray(context.conversationHistory)) {
        for (const historyMsg of context.conversationHistory) {
          messages.push({
            role: historyMsg.role || (historyMsg.isUser ? 'user' : 'assistant'),
            content: historyMsg.content || historyMsg.message
          });
        }
      }
      
      messages.push({
        role: 'user',
        content: message
      });
      
      const kb_ids = [replicaId];
      
      const chatOptions = {
        model: options.model,
        maxTokens: options.maxTokens,
        stream: options.streaming || false,
        namespace: replicaData?.namespace || replicaData?.supavecNamespace
      };
      
      let response;
      if (options.streaming) {
        response = await supavec.streamChatResponse(messages, kb_ids, chatOptions);
      } else {
        response = await supavec.sendContextualChatMessage(messages, kb_ids, chatOptions);
      }
      
      recordSuccess('SUPAVEC');
      
      return {
        success: true,
        apiSource: 'SUPAVEC',
        response: response.response || response,
        replicaId,
        conversationId: context.conversationId,
        timestamp: new Date().toISOString(),
        streaming: options.streaming || false
      };
    } else {
      const sensay = await getSensayService();
      
      const conversationHistory = [];
      if (context.conversationHistory && Array.isArray(context.conversationHistory)) {
        conversationHistory.push(...context.conversationHistory);
      }
      
      const response = await sensay.sendChatMessage(
        replicaId,
        message,
        userId,
        conversationHistory,
        options.streaming || false
      );
      
      recordSuccess('SENSAY');
      
      return {
        success: true,
        apiSource: 'SENSAY',
        response,
        replicaId,
        conversationId: context.conversationId,
        timestamp: new Date().toISOString(),
        streaming: options.streaming || false
      };
    }
  };
  
  const fallbackFn = async () => {
    const sensay = await getSensayService();
    
    const conversationHistory = [];
    if (context.conversationHistory && Array.isArray(context.conversationHistory)) {
      conversationHistory.push(...context.conversationHistory);
    }
    
    const response = await sensay.sendChatMessage(
      replicaId,
      message,
      userId,
      conversationHistory,
      options.streaming || false
    );
    
    recordSuccess('SENSAY');
    
    return {
      success: true,
      apiSource: 'SENSAY',
      response,
      replicaId,
      conversationId: context.conversationId,
      timestamp: new Date().toISOString(),
      streaming: options.streaming || false
    };
  };
  
  try {
    let result;
    
    if (apiToUse === 'SUPAVEC' && migrationConfig.canFallbackToSensay()) {
      result = await withFallback(
        () => withRetry(primaryFn, { apiSource: apiToUse, operation: 'sendChatMessage', maxAttempts: 2 }),
        () => withRetry(fallbackFn, { apiSource: 'SENSAY', operation: 'sendChatMessage', maxAttempts: 2 }),
        { primaryApi: 'SUPAVEC', fallbackApi: 'SENSAY', operation: 'sendChatMessage' }
      );
    } else {
      result = await withRetry(primaryFn, { apiSource: apiToUse, operation: 'sendChatMessage', maxAttempts: 2 });
    }
    
    logApiResponse(logContext, true, result);
    return result;
  } catch (error) {
    recordFailure(apiToUse);
    const standardizedError = transformError(error, apiToUse);
    logError(standardizedError, 'sendChatMessage', { replicaId, userId });
    logApiResponse(logContext, false, null, error);
    throw standardizedError;
  }
};

/**
 * Preserve conversation context across API transitions
 * @param {object} conversation - Conversation object from database
 * @param {string} targetApi - Target API ('SUPAVEC' or 'SENSAY')
 * @returns {object} Transformed conversation context
 */
export const preserveConversationContext = (conversation, targetApi) => {
  if (!conversation || !conversation.messages) {
    return {
      conversationId: conversation?.id || conversation?._id,
      conversationHistory: [],
      apiSource: targetApi
    };
  }
  
  // Transform messages to target API format
  const conversationHistory = conversation.messages.map(msg => {
    if (targetApi === 'SUPAVEC') {
      return {
        role: msg.role || (msg.isUser ? 'user' : 'assistant'),
        content: msg.content || msg.message || msg.text
      };
    } else {
      // Sensay format
      return {
        content: msg.content || msg.message || msg.text,
        isUser: msg.role === 'user' || msg.isUser,
        timestamp: msg.timestamp || msg.createdAt
      };
    }
  });
  
  return {
    conversationId: conversation.id || conversation._id,
    conversationHistory,
    apiSource: targetApi,
    originalApiSource: conversation.apiSource,
    transformedAt: new Date().toISOString()
  };
};

/**
 * Handle chat errors with appropriate fallback and retry logic
 * @param {Error} error - The error that occurred
 * @param {string} apiSource - The API that failed
 * @param {object} context - Context for retry
 * @returns {Promise<object>} Error handling result
 */
export const handleChatError = async (error, apiSource, context = {}) => {
  logger.error(`Chat error from ${apiSource}:`, {
    message: error.message,
    status: error.response?.status,
    replicaId: context.replicaId
  });
  
  // Determine if error is retryable
  const retryableStatuses = [408, 429, 500, 502, 503, 504];
  const isRetryable = error.response?.status && retryableStatuses.includes(error.response.status);
  
  // Determine if fallback is available
  const canFallback = apiSource === 'SUPAVEC' && migrationConfig.canFallbackToSensay();
  
  return {
    error: error.message,
    apiSource,
    isRetryable,
    canFallback,
    shouldFallback: canFallback && !isRetryable,
    status: error.response?.status,
    timestamp: new Date().toISOString()
  };
};

// ===== TRAINING CONTENT ABSTRACTION =====

/**
 * Upload training content (text or files) to the appropriate API
 * @param {string} replicaId - Replica ID to train
 * @param {object} content - Training content
 * @param {string} [content.type] - Content type ('text', 'file', 'url')
 * @param {string} [content.text] - Text content
 * @param {string} [content.title] - Content title
 * @param {Buffer} [content.fileBuffer] - File buffer for file uploads
 * @param {string} [content.filename] - Filename for file uploads
 * @param {string} [content.contentType] - MIME type for file uploads
 * @param {string} [content.url] - URL for URL-based training
 * @param {object} [content.metadata] - Additional metadata
 * @param {string} userId - User ID
 * @param {object} [replicaData] - Optional replica data with API source info
 * @returns {Promise<object>} Upload result
 */
export const uploadTrainingContent = async (
  replicaId,
  content,
  userId,
  replicaData = null
) => {
  const apiToUse = determineApiToUse('UPLOAD_TRAINING', replicaData);
  
  logger.info(`Uploading training content using ${apiToUse} API`, {
    replicaId,
    userId,
    contentType: content.type,
    hasText: !!content.text,
    hasFile: !!content.fileBuffer
  });
  
  try {
    if (apiToUse === 'SUPAVEC') {
      const supavec = await getSupavecService();
      const namespace = replicaData?.namespace || 
                       replicaData?.supavecNamespace || 
                       migrationConfig.getNamespaceForUser(userId);
      
      let result;
      
      if (content.type === 'text' || content.text) {
        // Upload text content
        result = await supavec.uploadText(
          content.text,
          content.title || 'Training Content',
          namespace
        );
      } else if (content.type === 'file' || content.fileBuffer) {
        // Upload file content
        result = await supavec.uploadFile(
          content.fileBuffer,
          content.filename,
          content.metadata || {},
          namespace
        );
      } else if (content.type === 'url' || content.url) {
        // For URL-based training, we might need to fetch and upload as text
        // This is a simplified implementation
        logger.warn('URL-based training not fully implemented for Supavec');
        throw new Error('URL-based training not yet supported for Supavec');
      } else {
        throw new Error('Invalid content type. Must provide text, file, or url.');
      }
      
      return {
        success: true,
        apiSource: 'SUPAVEC',
        replicaId,
        namespace,
        uploadId: result.file_id,
        contentType: content.type,
        uploadedAt: new Date().toISOString()
      };
    } else {
      // Use Sensay API
      const sensay = await getSensayService();
      
      let result;
      
      if (content.type === 'text' || content.text) {
        // Create knowledge base entry with text
        const entryData = {
          title: content.title || 'Training Content',
          text: content.text
        };
        
        result = await sensay.createKnowledgeBaseEntry(replicaId, entryData);
      } else if (content.type === 'file' || content.fileBuffer) {
        // Upload file to Sensay
        const entryData = {
          title: content.title || content.filename,
          filename: content.filename
        };
        
        // Create KB entry first
        const kbEntry = await sensay.createKnowledgeBaseEntry(replicaId, entryData);
        
        // Get entry ID
        let entryId = kbEntry.id || kbEntry.uuid;
        if (!entryId && Array.isArray(kbEntry.results) && kbEntry.results[0]) {
          entryId = kbEntry.results[0].knowledgeBaseID || kbEntry.results[0].id;
        }
        
        // Upload file using signed URL
        const signedUrlResponse = await sensay.requestSignedUploadUrl(
          entryId,
          content.filename,
          content.contentType
        );
        
        await sensay.uploadFileToSignedUrl(
          signedUrlResponse.signedUrl,
          content.fileBuffer,
          content.contentType
        );
        
        result = { ...kbEntry, entryId };
      } else if (content.type === 'url' || content.url) {
        // Create knowledge base entry with URL
        const entryData = {
          title: content.title || 'URL Content',
          url: content.url,
          autoRefresh: content.autoRefresh || false
        };
        
        result = await sensay.createKnowledgeBaseEntry(replicaId, entryData);
      } else {
        throw new Error('Invalid content type. Must provide text, file, or url.');
      }
      
      // Extract entry ID
      let entryId = result.id || result.uuid;
      if (!entryId && Array.isArray(result.results) && result.results[0]) {
        entryId = result.results[0].knowledgeBaseID || result.results[0].id;
      }
      
      return {
        success: true,
        apiSource: 'SENSAY',
        replicaId,
        uploadId: entryId,
        contentType: content.type,
        result,
        uploadedAt: new Date().toISOString()
      };
    }
  } catch (error) {
    logger.error(`Error uploading training content with ${apiToUse}:`, error.message);
    
    // Try fallback to Sensay if enabled and primary API was Supavec
    if (apiToUse === 'SUPAVEC' && migrationConfig.canFallbackToSensay()) {
      logger.info('Attempting fallback to Sensay API for training upload');
      try {
        const sensay = await getSensayService();
        
        let result;
        
        if (content.type === 'text' || content.text) {
          const entryData = {
            title: content.title || 'Training Content',
            text: content.text
          };
          result = await sensay.createKnowledgeBaseEntry(replicaId, entryData);
        } else if (content.type === 'file' || content.fileBuffer) {
          const entryData = {
            title: content.title || content.filename,
            filename: content.filename
          };
          const kbEntry = await sensay.createKnowledgeBaseEntry(replicaId, entryData);
          
          let entryId = kbEntry.id || kbEntry.uuid;
          if (!entryId && Array.isArray(kbEntry.results) && kbEntry.results[0]) {
            entryId = kbEntry.results[0].knowledgeBaseID || kbEntry.results[0].id;
          }
          
          const signedUrlResponse = await sensay.requestSignedUploadUrl(
            entryId,
            content.filename,
            content.contentType
          );
          
          await sensay.uploadFileToSignedUrl(
            signedUrlResponse.signedUrl,
            content.fileBuffer,
            content.contentType
          );
          
          result = { ...kbEntry, entryId };
        } else if (content.type === 'url' || content.url) {
          const entryData = {
            title: content.title || 'URL Content',
            url: content.url,
            autoRefresh: content.autoRefresh || false
          };
          result = await sensay.createKnowledgeBaseEntry(replicaId, entryData);
        }
        
        let entryId = result.id || result.uuid;
        if (!entryId && Array.isArray(result.results) && result.results[0]) {
          entryId = result.results[0].knowledgeBaseID || result.results[0].id;
        }
        
        return {
          success: true,
          apiSource: 'SENSAY',
          replicaId,
          uploadId: entryId,
          contentType: content.type,
          result,
          fallbackUsed: true,
          uploadedAt: new Date().toISOString()
        };
      } catch (fallbackError) {
        logger.error('Fallback to Sensay also failed:', fallbackError.message);
        throw fallbackError;
      }
    }
    
    throw error;
  }
};

/**
 * Get training status for content
 * @param {string} replicaId - Replica ID
 * @param {string} uploadId - Upload/entry ID
 * @param {string} userId - User ID
 * @param {object} [replicaData] - Optional replica data with API source info
 * @returns {Promise<object>} Training status
 */
export const getTrainingStatus = async (
  replicaId,
  uploadId,
  userId,
  replicaData = null
) => {
  const apiToUse = determineApiToUse('GET_TRAINING_STATUS', replicaData);
  
  logger.info(`Getting training status using ${apiToUse} API`, {
    replicaId,
    uploadId,
    userId
  });
  
  try {
    if (apiToUse === 'SUPAVEC') {
      const supavec = await getSupavecService();
      const namespace = replicaData?.namespace || 
                       replicaData?.supavecNamespace || 
                       migrationConfig.getNamespaceForUser(userId);
      
      // Get file info from Supavec
      const replicaInfo = await supavec.getReplicaById(uploadId, namespace);
      
      if (!replicaInfo.success) {
        return {
          success: false,
          status: 'NOT_FOUND',
          apiSource: 'SUPAVEC',
          replicaId,
          uploadId
        };
      }
      
      // Supavec files are immediately available
      return {
        success: true,
        status: 'READY',
        apiSource: 'SUPAVEC',
        replicaId,
        uploadId,
        info: replicaInfo.replica
      };
    } else {
      // Use Sensay API
      const sensay = await getSensayService();
      
      const status = await sensay.getKnowledgeBaseEntryStatus(replicaId, uploadId);
      
      return {
        success: true,
        status: status.status || 'UNKNOWN',
        apiSource: 'SENSAY',
        replicaId,
        uploadId,
        info: status
      };
    }
  } catch (error) {
    logger.error(`Error getting training status with ${apiToUse}:`, error.message);
    
    return {
      success: false,
      status: 'ERROR',
      apiSource: apiToUse,
      replicaId,
      uploadId,
      error: error.message
    };
  }
};

/**
 * Poll training status until completion or timeout
 * @param {string} replicaId - Replica ID
 * @param {string} uploadId - Upload/entry ID
 * @param {string} userId - User ID
 * @param {object} [replicaData] - Optional replica data with API source info
 * @param {object} [options] - Polling options
 * @param {number} [options.maxAttempts] - Maximum polling attempts (default: 60)
 * @param {number} [options.intervalMs] - Polling interval in ms (default: 5000)
 * @returns {Promise<object>} Final training status
 */
export const pollTrainingStatus = async (
  replicaId,
  uploadId,
  userId,
  replicaData = null,
  options = {}
) => {
  const maxAttempts = options.maxAttempts || 60;
  const intervalMs = options.intervalMs || 5000;
  
  logger.info('Starting training status polling', {
    replicaId,
    uploadId,
    maxAttempts,
    intervalMs
  });
  
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    try {
      const status = await getTrainingStatus(replicaId, uploadId, userId, replicaData);
      
      logger.info(`Poll attempt ${attempts + 1}/${maxAttempts}: Status = ${status.status}`);
      
      // Check for terminal statuses
      const terminalStatuses = ['READY', 'VECTOR_CREATED', 'PROCESSED_TEXT', 'FAILED', 'ERROR', 'UNPROCESSABLE'];
      
      if (terminalStatuses.includes(status.status)) {
        logger.info(`Training reached terminal status: ${status.status}`);
        return status;
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, intervalMs));
      attempts++;
    } catch (error) {
      logger.error(`Poll attempt ${attempts + 1} failed:`, error.message);
      
      if (attempts >= maxAttempts - 1) {
        throw error;
      }
      
      await new Promise(resolve => setTimeout(resolve, intervalMs));
      attempts++;
    }
  }
  
  throw new Error(`Training status polling timed out after ${maxAttempts} attempts`);
};

/**
 * Track training across API sources
 * @param {string} replicaId - Replica ID
 * @param {string} uploadId - Upload/entry ID
 * @param {string} apiSource - API source ('SUPAVEC' or 'SENSAY')
 * @param {object} metadata - Additional tracking metadata
 * @returns {object} Tracking record
 */
export const trackTrainingUpload = (replicaId, uploadId, apiSource, metadata = {}) => {
  return {
    replicaId,
    uploadId,
    apiSource,
    status: 'PENDING',
    metadata,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
};
