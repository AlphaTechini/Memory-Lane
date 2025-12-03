/**
 * Firestore Sync Service
 * 
 * Provides secure data synchronization between local Postgres database and Firestore
 * for future client SDK integration. This service enables real-time updates and
 * direct browser-to-database connections while maintaining security.
 */

import firebase from '../firebase.js';
import logger from '../utils/logger.js';
import databaseConfig from '../config/database.js';
import ConversationModel from '../models/Conversation.js';
import User from '../models/User.js';
import Patient from '../models/Patient.js';

/**
 * Get Firestore instance
 * @returns {object} Firestore instance
 * @throws {Error} If Firebase is not initialized
 */
const getFirestore = () => {
  if (!firebase._admin) {
    throw new Error('Firebase Admin not initialized. Cannot access Firestore.');
  }
  return firebase._admin.firestore();
};

/**
 * Validate user has access to a Firestore resource
 * @param {string} userId - User ID requesting access
 * @param {string} resourceId - Resource ID (replica or conversation)
 * @param {string} resourceType - Type of resource ('replica' or 'conversation')
 * @returns {Promise<object>} Validation result
 */
export const validateFirestoreAccess = async (userId, resourceId, resourceType = 'replica') => {
  try {
    logger.info('Validating Firestore access', { userId, resourceId, resourceType });
    
    // Verify user exists in database
    const user = await User.findById(userId);
    
    if (!user) {
      return {
        success: false,
        hasAccess: false,
        reason: 'User not found',
        userId,
        resourceId,
        resourceType
      };
    }
    
    // Validate access based on resource type
    if (resourceType === 'replica') {
      // Check if user owns the replica
      const replicas = user.replicas || [];
      const ownsReplica = Array.isArray(replicas) && 
        replicas.some(r => r.fileId === resourceId || r.id === resourceId);
      
      if (ownsReplica) {
        return {
          success: true,
          hasAccess: true,
          accessType: 'owner',
          userId,
          resourceId,
          resourceType
        };
      }
      
      // Check if user is a patient with access to this replica
      if (user.role === 'patient') {
        const patientRecord = await Patient.findOne({
          userId: userId,
          isActive: true,
          allowedReplicas: resourceId
        });
        
        if (patientRecord) {
          return {
            success: true,
            hasAccess: true,
            accessType: 'patient',
            userId,
            resourceId,
            resourceType,
            caretakerId: patientRecord.caretakerId
          };
        }
      }
      
      return {
        success: false,
        hasAccess: false,
        reason: 'User does not have access to this replica',
        userId,
        resourceId,
        resourceType
      };
    }
    
    if (resourceType === 'conversation') {
      // Check if user owns the conversation
      const conversation = await ConversationModel.findOne({ id: resourceId });
      
      if (!conversation) {
        return {
          success: false,
          hasAccess: false,
          reason: 'Conversation not found',
          userId,
          resourceId,
          resourceType
        };
      }
      
      if (conversation.userId === userId) {
        return {
          success: true,
          hasAccess: true,
          accessType: 'owner',
          userId,
          resourceId,
          resourceType
        };
      }
      
      return {
        success: false,
        hasAccess: false,
        reason: 'User does not own this conversation',
        userId,
        resourceId,
        resourceType
      };
    }
    
    return {
      success: false,
      hasAccess: false,
      reason: 'Invalid resource type',
      userId,
      resourceId,
      resourceType
    };
  } catch (error) {
    logger.error('Error validating Firestore access:', error);
    return {
      success: false,
      hasAccess: false,
      reason: error.message,
      userId,
      resourceId,
      resourceType
    };
  }
};

/**
 * Sync a replica to Firestore
 * @param {string} replicaId - Replica ID (fileId)
 * @param {string} userId - User ID who owns the replica
 * @param {object} [options] - Sync options
 * @param {boolean} [options.forceUpdate] - Force update even if already synced
 * @returns {Promise<object>} Sync result
 */
export const syncReplicaToFirestore = async (replicaId, userId, options = {}) => {
  try {
    logger.info('Syncing replica to Firestore', { replicaId, userId });
    
    // Validate access
    const accessValidation = await validateFirestoreAccess(userId, replicaId, 'replica');
    if (!accessValidation.hasAccess) {
      throw new Error(`Access denied: ${accessValidation.reason}`);
    }
    
    // Get user data from database
    const user = await User.findById(userId);
    
    if (!user) {
      throw new Error('User not found');
    }
    
    // Find replica in user's replicas
    const replicas = user.replicas || [];
    const replica = Array.isArray(replicas) 
      ? replicas.find(r => r.fileId === replicaId || r.id === replicaId)
      : null;
    
    if (!replica) {
      throw new Error('Replica not found in user data');
    }
    
    // Transform to Firestore format
    const firestoreData = transformReplicaToFirestoreFormat(replica, userId);
    
    // Get Firestore instance
    const firestore = getFirestore();
    
    // Create document reference
    const docRef = firestore
      .collection('users')
      .doc(userId)
      .collection('replicas')
      .doc(replicaId);
    
    // Check if document exists
    const docSnapshot = await docRef.get();
    
    if (docSnapshot.exists && !options.forceUpdate) {
      logger.info('Replica already synced to Firestore', { replicaId, userId });
      return {
        success: true,
        synced: true,
        alreadyExists: true,
        replicaId,
        userId,
        firestorePath: `users/${userId}/replicas/${replicaId}`,
        syncedAt: new Date().toISOString()
      };
    }
    
    // Write to Firestore
    await docRef.set(firestoreData, { merge: true });
    
    logger.info('Replica synced to Firestore successfully', { replicaId, userId });
    
    return {
      success: true,
      synced: true,
      replicaId,
      userId,
      firestorePath: `users/${userId}/replicas/${replicaId}`,
      data: firestoreData,
      syncedAt: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error syncing replica to Firestore:', error);
    return {
      success: false,
      synced: false,
      replicaId,
      userId,
      error: error.message,
      syncedAt: new Date().toISOString()
    };
  }
};

/**
 * Sync a conversation to Firestore
 * @param {string} conversationId - Conversation ID
 * @param {string} userId - User ID who owns the conversation
 * @param {object} [options] - Sync options
 * @param {boolean} [options.forceUpdate] - Force update even if already synced
 * @param {boolean} [options.syncMessages] - Include full message history (default: true)
 * @returns {Promise<object>} Sync result
 */
export const syncConversationToFirestore = async (conversationId, userId, options = {}) => {
  try {
    logger.info('Syncing conversation to Firestore', { conversationId, userId });
    
    // Validate access
    const accessValidation = await validateFirestoreAccess(userId, conversationId, 'conversation');
    if (!accessValidation.hasAccess) {
      throw new Error(`Access denied: ${accessValidation.reason}`);
    }
    
    // Get conversation from database
    const conversation = await ConversationModel.findOne({ id: conversationId });
    
    if (!conversation) {
      throw new Error('Conversation not found');
    }
    
    // Verify ownership
    if (conversation.userId !== userId) {
      throw new Error('User does not own this conversation');
    }
    
    // Transform to Firestore format
    const syncMessages = options.syncMessages !== false;
    const firestoreData = transformConversationToFirestoreFormat(conversation, syncMessages);
    
    // Get Firestore instance
    const firestore = getFirestore();
    
    // Create document reference
    const docRef = firestore
      .collection('users')
      .doc(userId)
      .collection('conversations')
      .doc(conversationId);
    
    // Check if document exists
    const docSnapshot = await docRef.get();
    
    if (docSnapshot.exists && !options.forceUpdate) {
      logger.info('Conversation already synced to Firestore', { conversationId, userId });
      return {
        success: true,
        synced: true,
        alreadyExists: true,
        conversationId,
        userId,
        firestorePath: `users/${userId}/conversations/${conversationId}`,
        syncedAt: new Date().toISOString()
      };
    }
    
    // Write to Firestore
    await docRef.set(firestoreData, { merge: true });
    
    logger.info('Conversation synced to Firestore successfully', { conversationId, userId });
    
    return {
      success: true,
      synced: true,
      conversationId,
      userId,
      firestorePath: `users/${userId}/conversations/${conversationId}`,
      messageCount: conversation.messages?.length || 0,
      syncedAt: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error syncing conversation to Firestore:', error);
    return {
      success: false,
      synced: false,
      conversationId,
      userId,
      error: error.message,
      syncedAt: new Date().toISOString()
    };
  }
};

/**
 * Sync all user replicas to Firestore
 * @param {string} userId - User ID
 * @param {object} [options] - Sync options
 * @returns {Promise<object>} Bulk sync result
 */
export const syncAllUserReplicasToFirestore = async (userId, options = {}) => {
  try {
    logger.info('Syncing all user replicas to Firestore', { userId });
    
    // Get user data
    const user = await User.findById(userId);
    
    if (!user) {
      throw new Error('User not found');
    }
    
    const replicas = user.replicas || [];
    
    if (!Array.isArray(replicas) || replicas.length === 0) {
      return {
        success: true,
        userId,
        totalReplicas: 0,
        synced: 0,
        failed: 0,
        results: [],
        syncedAt: new Date().toISOString()
      };
    }
    
    // Sync each replica
    const results = [];
    let syncedCount = 0;
    let failedCount = 0;
    
    for (const replica of replicas) {
      const replicaId = replica.fileId || replica.id;
      if (!replicaId) continue;
      
      try {
        const result = await syncReplicaToFirestore(replicaId, userId, options);
        results.push(result);
        
        if (result.success) {
          syncedCount++;
        } else {
          failedCount++;
        }
      } catch (error) {
        logger.error(`Failed to sync replica ${replicaId}:`, error);
        results.push({
          success: false,
          replicaId,
          error: error.message
        });
        failedCount++;
      }
    }
    
    return {
      success: true,
      userId,
      totalReplicas: replicas.length,
      synced: syncedCount,
      failed: failedCount,
      results,
      syncedAt: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error syncing all user replicas:', error);
    throw error;
  }
};

/**
 * Sync all user conversations to Firestore
 * @param {string} userId - User ID
 * @param {object} [options] - Sync options
 * @returns {Promise<object>} Bulk sync result
 */
export const syncAllUserConversationsToFirestore = async (userId, options = {}) => {
  try {
    logger.info('Syncing all user conversations to Firestore', { userId });
    
    // Get all user conversations
    const conversations = await ConversationModel.find({ userId, isActive: true });
    
    if (!conversations || conversations.length === 0) {
      return {
        success: true,
        userId,
        totalConversations: 0,
        synced: 0,
        failed: 0,
        results: [],
        syncedAt: new Date().toISOString()
      };
    }
    
    // Sync each conversation
    const results = [];
    let syncedCount = 0;
    let failedCount = 0;
    
    for (const conversation of conversations) {
      const conversationId = conversation.id || conversation._id;
      
      try {
        const result = await syncConversationToFirestore(conversationId, userId, options);
        results.push(result);
        
        if (result.success) {
          syncedCount++;
        } else {
          failedCount++;
        }
      } catch (error) {
        logger.error(`Failed to sync conversation ${conversationId}:`, error);
        results.push({
          success: false,
          conversationId,
          error: error.message
        });
        failedCount++;
      }
    }
    
    return {
      success: true,
      userId,
      totalConversations: conversations.length,
      synced: syncedCount,
      failed: failedCount,
      results,
      syncedAt: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error syncing all user conversations:', error);
    throw error;
  }
};

/**
 * Transform replica data to Firestore format
 * @param {object} replica - Replica data from local database
 * @param {string} userId - User ID
 * @returns {object} Firestore-formatted replica data
 */
const transformReplicaToFirestoreFormat = (replica, userId) => {
  return {
    id: replica.fileId || replica.id,
    fileId: replica.fileId || replica.id,
    name: replica.name || 'Unnamed Replica',
    description: replica.description || '',
    namespace: replica.namespace || userId,
    apiSource: replica.apiSource || 'SUPAVEC',
    createdAt: replica.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: {
      greeting: replica.greeting || null,
      selectedSegments: replica.selectedSegments || [],
      whitelistEmails: replica.whitelistEmails || [],
      ...replica.metadata
    },
    // Security fields
    ownerId: userId,
    accessControl: {
      owner: userId,
      sharedWith: replica.whitelistEmails || []
    }
  };
};

/**
 * Transform conversation data to Firestore format
 * @param {object} conversation - Conversation data from local database
 * @param {boolean} includeMessages - Whether to include full message history
 * @returns {object} Firestore-formatted conversation data
 */
const transformConversationToFirestoreFormat = (conversation, includeMessages = true) => {
  const conversationObj = conversation.toObject ? conversation.toObject() : conversation;
  
  const firestoreData = {
    id: conversationObj.id || conversationObj._id,
    userId: conversationObj.userId,
    replicaId: conversationObj.replicaId,
    title: conversationObj.title || 'Untitled Conversation',
    isActive: conversationObj.isActive !== false,
    apiSource: conversationObj.apiSource || 'SUPAVEC',
    messageCount: conversationObj.messages?.length || 0,
    lastMessageAt: conversationObj.lastMessageAt || null,
    createdAt: conversationObj.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  // Include messages if requested
  if (includeMessages && conversationObj.messages) {
    firestoreData.messages = conversationObj.messages.map(msg => ({
      id: msg.id || msg._id || Date.now().toString(),
      text: msg.text || msg.content || '',
      sender: msg.sender || (msg.role === 'user' ? 'user' : 'assistant'),
      role: msg.role || msg.sender,
      timestamp: msg.timestamp || new Date().toISOString()
    }));
  }
  
  return firestoreData;
};

// ===== DATA TRANSFORMATION UTILITIES =====

/**
 * Transform local database format to Firestore document format
 * @param {object} data - Data from local database
 * @param {string} dataType - Type of data ('replica', 'conversation', 'user')
 * @param {object} [options] - Transformation options
 * @returns {object} Firestore-formatted document
 */
export const transformLocalToFirestoreFormat = (data, dataType, options = {}) => {
  try {
    switch (dataType) {
      case 'replica':
        return transformReplicaToFirestoreFormat(data, options.userId);
      
      case 'conversation':
        return transformConversationToFirestoreFormat(data, options.includeMessages !== false);
      
      case 'user':
        return transformUserToFirestoreFormat(data);
      
      case 'patient':
        return transformPatientToFirestoreFormat(data);
      
      default:
        throw new Error(`Unknown data type: ${dataType}`);
    }
  } catch (error) {
    logger.error('Error transforming local to Firestore format:', error);
    throw error;
  }
};

/**
 * Transform Firestore document format to local database format
 * @param {object} firestoreDoc - Firestore document data
 * @param {string} dataType - Type of data ('replica', 'conversation', 'user')
 * @returns {object} Local database-formatted data
 */
export const transformFirestoreToLocalFormat = (firestoreDoc, dataType) => {
  try {
    switch (dataType) {
      case 'replica':
        return transformFirestoreToReplicaFormat(firestoreDoc);
      
      case 'conversation':
        return transformFirestoreToConversationFormat(firestoreDoc);
      
      case 'user':
        return transformFirestoreToUserFormat(firestoreDoc);
      
      case 'patient':
        return transformFirestoreToPatientFormat(firestoreDoc);
      
      default:
        throw new Error(`Unknown data type: ${dataType}`);
    }
  } catch (error) {
    logger.error('Error transforming Firestore to local format:', error);
    throw error;
  }
};

/**
 * Transform user data to Firestore format
 * @param {object} user - User data from local database
 * @returns {object} Firestore-formatted user data
 */
const transformUserToFirestoreFormat = (user) => {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName || null,
    lastName: user.lastName || null,
    role: user.role || 'caretaker',
    isVerified: user.isVerified || false,
    replicaCount: Array.isArray(user.replicas) ? user.replicas.length : 0,
    lastLogin: user.lastLogin || null,
    createdAt: user.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    // Don't sync sensitive data to Firestore
    // password, tokens, etc. are excluded
  };
};

/**
 * Transform patient data to Firestore format
 * @param {object} patient - Patient data from local database
 * @returns {object} Firestore-formatted patient data
 */
const transformPatientToFirestoreFormat = (patient) => {
  return {
    id: patient.id,
    email: patient.email,
    firstName: patient.firstName || null,
    lastName: patient.lastName || null,
    caretakerId: patient.caretakerId,
    caretakerEmail: patient.caretakerEmail || null,
    allowedReplicas: patient.allowedReplicas || [],
    isActive: patient.isActive !== false,
    lastLogin: patient.lastLogin || null,
    createdAt: patient.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
};

/**
 * Transform Firestore document to replica format
 * @param {object} firestoreDoc - Firestore document
 * @returns {object} Local replica format
 */
const transformFirestoreToReplicaFormat = (firestoreDoc) => {
  return {
    fileId: firestoreDoc.fileId || firestoreDoc.id,
    id: firestoreDoc.id,
    name: firestoreDoc.name,
    description: firestoreDoc.description || '',
    namespace: firestoreDoc.namespace,
    apiSource: firestoreDoc.apiSource || 'SUPAVEC',
    createdAt: firestoreDoc.createdAt,
    greeting: firestoreDoc.metadata?.greeting || null,
    selectedSegments: firestoreDoc.metadata?.selectedSegments || [],
    whitelistEmails: firestoreDoc.metadata?.whitelistEmails || [],
    metadata: firestoreDoc.metadata || {}
  };
};

/**
 * Transform Firestore document to conversation format
 * @param {object} firestoreDoc - Firestore document
 * @returns {object} Local conversation format
 */
const transformFirestoreToConversationFormat = (firestoreDoc) => {
  const conversation = {
    id: firestoreDoc.id,
    userId: firestoreDoc.userId,
    replicaId: firestoreDoc.replicaId,
    title: firestoreDoc.title || 'Untitled Conversation',
    isActive: firestoreDoc.isActive !== false,
    apiSource: firestoreDoc.apiSource || 'SUPAVEC',
    lastMessageAt: firestoreDoc.lastMessageAt || null,
    createdAt: firestoreDoc.createdAt,
    messages: []
  };
  
  // Transform messages if present
  if (firestoreDoc.messages && Array.isArray(firestoreDoc.messages)) {
    conversation.messages = firestoreDoc.messages.map(msg => ({
      id: msg.id,
      text: msg.text,
      sender: msg.sender,
      role: msg.role,
      timestamp: msg.timestamp
    }));
  }
  
  return conversation;
};

/**
 * Transform Firestore document to user format
 * @param {object} firestoreDoc - Firestore document
 * @returns {object} Local user format
 */
const transformFirestoreToUserFormat = (firestoreDoc) => {
  return {
    id: firestoreDoc.id,
    email: firestoreDoc.email,
    firstName: firestoreDoc.firstName || null,
    lastName: firestoreDoc.lastName || null,
    role: firestoreDoc.role || 'caretaker',
    isVerified: firestoreDoc.isVerified || false,
    lastLogin: firestoreDoc.lastLogin || null,
    createdAt: firestoreDoc.createdAt
  };
};

/**
 * Transform Firestore document to patient format
 * @param {object} firestoreDoc - Firestore document
 * @returns {object} Local patient format
 */
const transformFirestoreToPatientFormat = (firestoreDoc) => {
  return {
    id: firestoreDoc.id,
    email: firestoreDoc.email,
    firstName: firestoreDoc.firstName || null,
    lastName: firestoreDoc.lastName || null,
    caretakerId: firestoreDoc.caretakerId,
    caretakerEmail: firestoreDoc.caretakerEmail || null,
    allowedReplicas: firestoreDoc.allowedReplicas || [],
    isActive: firestoreDoc.isActive !== false,
    lastLogin: firestoreDoc.lastLogin || null,
    createdAt: firestoreDoc.createdAt
  };
};

/**
 * Validate Firestore document structure
 * @param {object} document - Firestore document to validate
 * @param {string} dataType - Expected data type
 * @returns {object} Validation result
 */
export const validateFirestoreDocument = (document, dataType) => {
  const errors = [];
  
  try {
    // Common validations
    if (!document.id) {
      errors.push('Missing required field: id');
    }
    
    if (!document.createdAt) {
      errors.push('Missing required field: createdAt');
    }
    
    // Type-specific validations
    switch (dataType) {
      case 'replica':
        if (!document.fileId) errors.push('Missing required field: fileId');
        if (!document.name) errors.push('Missing required field: name');
        if (!document.ownerId) errors.push('Missing required field: ownerId');
        if (!document.namespace) errors.push('Missing required field: namespace');
        break;
      
      case 'conversation':
        if (!document.userId) errors.push('Missing required field: userId');
        if (!document.replicaId) errors.push('Missing required field: replicaId');
        if (document.messages && !Array.isArray(document.messages)) {
          errors.push('Field messages must be an array');
        }
        break;
      
      case 'user':
        if (!document.email) errors.push('Missing required field: email');
        if (!document.role) errors.push('Missing required field: role');
        break;
      
      case 'patient':
        if (!document.email) errors.push('Missing required field: email');
        if (!document.caretakerId) errors.push('Missing required field: caretakerId');
        if (!Array.isArray(document.allowedReplicas)) {
          errors.push('Field allowedReplicas must be an array');
        }
        break;
      
      default:
        errors.push(`Unknown data type: ${dataType}`);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      dataType
    };
  } catch (error) {
    return {
      valid: false,
      errors: [error.message],
      dataType
    };
  }
};

/**
 * Batch transform multiple documents
 * @param {array} documents - Array of documents to transform
 * @param {string} dataType - Type of data
 * @param {string} direction - 'toFirestore' or 'toLocal'
 * @param {object} [options] - Transformation options
 * @returns {array} Array of transformed documents
 */
export const batchTransform = (documents, dataType, direction, options = {}) => {
  try {
    if (!Array.isArray(documents)) {
      throw new Error('Documents must be an array');
    }
    
    const transformFn = direction === 'toFirestore' 
      ? transformLocalToFirestoreFormat 
      : transformFirestoreToLocalFormat;
    
    return documents.map(doc => {
      try {
        return transformFn(doc, dataType, options);
      } catch (error) {
        logger.error(`Error transforming document:`, error);
        return null;
      }
    }).filter(doc => doc !== null);
  } catch (error) {
    logger.error('Error in batch transform:', error);
    throw error;
  }
};

export default {
  validateFirestoreAccess,
  syncReplicaToFirestore,
  syncConversationToFirestore,
  syncAllUserReplicasToFirestore,
  syncAllUserConversationsToFirestore,
  transformLocalToFirestoreFormat,
  transformFirestoreToLocalFormat,
  validateFirestoreDocument,
  batchTransform
};
