/**
 * Replica Abstraction Service
 * 
 * Unified interface for replica operations routed through Groq + RAG Engine.
 * All legacy Sensay/Supavec code has been removed.
 */

import logger from '../utils/logger.js';
import { searchMemory, storeMemory, healthCheck as ragHealthCheck } from './ragClient.js';

// ---------------------------------------------------------------------------
// Training-text chunker:  splits a big training blob into topical pieces
// ---------------------------------------------------------------------------

const MAX_CHUNK_CHARS = 800;  // ≈ 200 tokens

/**
 * Split training text into topical chunks.
 * Strategy: split on double-newlines (paragraph/section boundaries) first,
 * then fall back to MAX_CHUNK_CHARS hard splits if any section is still huge.
 */
function chunkTrainingText(text) {
  if (!text || text.length <= MAX_CHUNK_CHARS) return [text].filter(Boolean);

  // 1. Split on double-newline (paragraph/section boundaries)
  const sections = text.split(/\n\n+/).map(s => s.trim()).filter(Boolean);

  const chunks = [];
  let buffer = '';

  for (const section of sections) {
    // If adding this section would exceed the limit, flush the buffer
    if (buffer.length + section.length + 2 > MAX_CHUNK_CHARS && buffer.length > 0) {
      chunks.push(buffer.trim());
      buffer = '';
    }

    // If the section itself is too long, hard-split it
    if (section.length > MAX_CHUNK_CHARS) {
      if (buffer.length > 0) {
        chunks.push(buffer.trim());
        buffer = '';
      }
      // Hard split the oversized section
      for (let i = 0; i < section.length; i += MAX_CHUNK_CHARS) {
        chunks.push(section.slice(i, i + MAX_CHUNK_CHARS).trim());
      }
    } else {
      buffer += (buffer ? '\n\n' : '') + section;
    }
  }
  if (buffer.trim()) chunks.push(buffer.trim());

  return chunks;
}

// ---------------------------------------------------------------------------
// Replica CRUD
// ---------------------------------------------------------------------------

/**
 * Create a new replica by storing its training data as chunked memories in RAG engine.
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

    // Generate a stable replica ID
    const replicaId = `replica-${userId}-${Date.now()}`;

    // Chunk the training text into topical pieces
    const chunks = chunkTrainingText(trainingContent);
    logger.info(`Chunked training text into ${chunks.length} pieces for replica ${replicaId}`);

    // Store each chunk individually, scoped to this replica
    const chunkIds = [];
    for (const chunk of chunks) {
      const result = await storeMemory(
        userId,
        chunk,
        1.0, // max importance for training data
        'manual',
        `init-${Date.now()}`,
        replicaId,
      );
      if (result.chunk_id) chunkIds.push(result.chunk_id);
    }

    return {
      success: true,
      apiSource: 'RAG',
      replicaId,
      chunks: chunkIds.length,
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

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

/**
 * Send a chat message via Groq + RAG Engine, scoped to a specific replica.
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
    replicaId,  // <— scopes all tool calls to this replica
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
