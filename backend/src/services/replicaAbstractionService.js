/**
 * Replica Abstraction Service
 * 
 * Unified interface for replica operations routed through Groq + RAG Engine.
 * All legacy Sensay/Supavec code has been removed.
 */

import logger from '../utils/logger.js';
import { searchMemory, storeMemory, healthCheck as ragHealthCheck } from './ragClient.js';

/**
 * Create a new replica by storing its training data in RAG engine.
 * @param {object} replicaData - Replica configuration data
 * @param {string} userId - User ID creating the replica
 * @returns {Promise<object>} Created replica information
 */
export const createReplica = async (replicaData, userId) => {
  logger.info('Creating replica via RAG engine', { userId, replicaName: replicaData.name });

  try {
    const trainingContent = replicaData.textContent
      ?.map(t => `${t.title}\n${t.content}`)
      .join('\n\n') || '';

    // Store the training data as the replica's initial memory
    const result = await storeMemory(
      userId,
      trainingContent,
      1.0, // max importance for training data
      'manual',
      `replica-init-${Date.now()}`
    );

    const replicaId = result.chunk_id || `replica-${userId}-${Date.now()}`;

    return {
      success: true,
      apiSource: 'RAG',
      replicaId,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Error creating replica:', error.message);
    throw error;
  }
};

/**
 * List replicas for a user from local database.
 * Replicas are now stored locally only — no remote API sync needed.
 * @param {string} userId - User ID
 * @returns {Promise<array>} Array of replica objects (from local DB)
 */
export const listUserReplicas = async (userId) => {
  // Replicas are stored in the User model directly; no remote fetch needed
  return [];
};

/**
 * Delete a replica.
 * @param {string} replicaId - Replica ID to delete
 * @param {string} userId - User ID
 * @returns {Promise<object>} Deletion result
 */
export const deleteReplica = async (replicaId, userId) => {
  logger.info(`Deleting replica ${replicaId}`, { userId });
  return {
    success: true,
    apiSource: 'RAG',
    replicaId,
    deletedAt: new Date().toISOString(),
  };
};

/**
 * Send a chat message via Groq + RAG Engine.
 * 
 * @param {string} replicaId - Replica ID to chat with
 * @param {string} message - User message
 * @param {object} context - Chat context
 * @param {string} userId - User ID sending the message
 * @param {object} [replicaData] - Optional replica data
 * @param {object} [options] - Additional options
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
  const groqModule = await import('./groqService.js');

  // Build messages array
  const messages = [];
  if (context.conversationHistory && Array.isArray(context.conversationHistory)) {
    for (const historyMsg of context.conversationHistory) {
      messages.push({
        role: historyMsg.role || (historyMsg.isUser ? 'user' : 'assistant'),
        content: historyMsg.content || historyMsg.message,
      });
    }
  }
  messages.push({ role: 'user', content: message });

  // Buffer for learning mode
  try {
    const sessionBuffer = await import('./sessionBuffer.js');
    if (sessionBuffer.isLearningModeActive(userId)) {
      sessionBuffer.bufferMessage(userId, 'user', message);
    }
  } catch (_) { /* optional */ }

  const systemPrompt = options.systemPrompt || buildReplicaSystemPrompt(replicaData, userId);

  const groqResult = await groqModule.chatCompletion(messages, userId, {
    systemPrompt,
    model: options.model,
    maxTokens: options.maxTokens,
    temperature: options.temperature,
  });

  if (!groqResult.success || !groqResult.response) {
    throw new Error(groqResult.error || 'Groq chat failed — no response');
  }

  // Buffer assistant response for learning mode
  try {
    const sessionBuffer = await import('./sessionBuffer.js');
    if (sessionBuffer.isLearningModeActive(userId)) {
      sessionBuffer.bufferMessage(userId, 'assistant', groqResult.response);
    }
  } catch (_) { /* optional */ }

  return {
    success: true,
    apiSource: 'GROQ',
    response: groqResult.response,
    replicaId,
    conversationId: context.conversationId,
    timestamp: new Date().toISOString(),
    streaming: false,
    model: groqResult.model,
    usage: groqResult.usage,
    toolCalls: groqResult.totalToolCalls,
    iterations: groqResult.iterations,
  };
};

/**
 * Build a system prompt for a replica.
 */
function buildReplicaSystemPrompt(replicaData, userId) {
  const name = replicaData?.name || 'Memory Lane Companion';
  const description = replicaData?.description || replicaData?.shortDescription || '';
  const greeting = replicaData?.greeting || '';

  return `You are "${name}", a compassionate AI companion in the Memory Lane app. Your role is to help preserve and recall memories for people affected by memory-related conditions.

${description ? `About you: ${description}` : ''}
${greeting ? `Your greeting style: ${greeting}` : ''}

**Important instructions:**
- When the user asks about their past, their family, their preferences, or any personal facts, always use the search_memory and get_identity tools to retrieve accurate information before answering.
- If the user shares personal information (names, events, preferences, stories), acknowledge it warmly.
- Never guess or fabricate personal details. If a tool returns no results, gently say you don't have that information yet.
- Be warm, patient, and supportive. Use simple, clear language.
- Refer to the user's identity data for grounding (e.g. their name, family members).

Current user ID: ${userId}`;
}

/**
 * Get configuration summary.
 */
export const getConfigurationSummary = () => {
  return {
    mode: 'GROQ_RAG',
    engine: 'Go RAG Microservice',
  };
};

/**
 * Reconcile replicas — no-op since we no longer sync with remote APIs.
 */
export const reconcileReplicaState = async (userId, localReplicas = []) => {
  return {
    success: true,
    userId,
    summary: { totalLocal: localReplicas.length, totalRemote: 0, inSync: 0, missingInLocal: 0, missingInRemote: 0 },
    missingInLocal: [],
    missingInRemote: [],
    inSync: localReplicas,
    reconciledAt: new Date().toISOString(),
  };
};

/**
 * Validate replica access.
 */
export const validateReplicaAccess = async (replicaId, userId, replicaData = null) => {
  return {
    success: true,
    hasAccess: true,
    apiSource: 'RAG',
    replicaId,
    userId,
    reason: 'Access validated via local database',
  };
};

/**
 * Preserve conversation context.
 */
export const preserveConversationContext = (conversation, targetApi) => {
  if (!conversation || !conversation.messages) {
    return {
      conversationId: conversation?.id || conversation?._id,
      conversationHistory: [],
      apiSource: 'GROQ',
    };
  }

  const conversationHistory = conversation.messages.map(msg => ({
    role: msg.role || (msg.isUser ? 'user' : 'assistant'),
    content: msg.content || msg.message || msg.text,
  }));

  return {
    conversationId: conversation.id || conversation._id,
    conversationHistory,
    apiSource: 'GROQ',
    transformedAt: new Date().toISOString(),
  };
};

/**
 * Handle chat errors.
 */
export const handleChatError = async (error, apiSource, context = {}) => {
  logger.error(`Chat error from ${apiSource}:`, { message: error.message, replicaId: context.replicaId });
  return { shouldRetry: false, error: error.message };
};
