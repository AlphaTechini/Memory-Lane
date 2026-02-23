/**
 * Session Buffer Service
 * 
 * Manages in-memory conversation transcript buffers for learning mode.
 * When learning mode is active, conversation messages are buffered.
 * When a session ends, the buffer is sent to the Go RAG engine for processing.
 */

import logger from '../utils/logger.js';
import { processSession } from './ragClient.js';

// In-memory session buffers: Map<userId, { active: boolean, messages: [] }>
const sessions = new Map();

/**
 * Enable learning mode for a user.
 * @param {string} userId
 */
export const enableLearningMode = (userId) => {
    if (!sessions.has(userId)) {
        sessions.set(userId, { active: true, messages: [] });
        logger.info(`Learning mode enabled for user ${userId}`);
    } else {
        const session = sessions.get(userId);
        session.active = true;
        logger.info(`Learning mode re-enabled for user ${userId} (${session.messages.length} buffered messages)`);
    }
};

/**
 * Disable learning mode for a user.
 * @param {string} userId
 */
export const disableLearningMode = (userId) => {
    const session = sessions.get(userId);
    if (session) {
        session.active = false;
        logger.info(`Learning mode disabled for user ${userId}`);
    }
};

/**
 * Check if learning mode is active for a user.
 * @param {string} userId
 * @returns {boolean}
 */
export const isLearningModeActive = (userId) => {
    const session = sessions.get(userId);
    return session?.active || false;
};

/**
 * Buffer a message during an active learning session.
 * @param {string} userId
 * @param {string} role - "user" or "assistant"
 * @param {string} content - Message content
 */
export const bufferMessage = (userId, role, content) => {
    const session = sessions.get(userId);
    if (!session || !session.active) return;

    session.messages.push({ role, content });
    logger.debug(`Buffered ${role} message for user ${userId} (total: ${session.messages.length})`);
};

/**
 * End the current learning session and send the transcript for processing.
 * The Go RAG engine will extract identity updates and memory proposals,
 * then store them in the review queue for caretaker approval.
 * 
 * @param {string} userId
 * @returns {Promise<object>} Processing result
 */
export const endSession = async (userId) => {
    const session = sessions.get(userId);
    if (!session) {
        return { success: false, message: 'No active session' };
    }

    const messages = [...session.messages];

    // Clear the buffer
    sessions.delete(userId);

    if (messages.length === 0) {
        return { success: true, message: 'Session ended with no messages to process' };
    }

    logger.info(`Ending learning session for user ${userId} — processing ${messages.length} messages`);

    try {
        const result = await processSession(userId, messages);
        return {
            success: true,
            sessionId: result.session_id,
            messagesProcessed: messages.length,
            message: 'Session transcript sent for review',
        };
    } catch (err) {
        logger.error(`Failed to process session for user ${userId}:`, err.message);
        return { success: false, error: err.message };
    }
};

/**
 * Get session status for a user.
 * @param {string} userId
 * @returns {object} Session status
 */
export const getSessionStatus = (userId) => {
    const session = sessions.get(userId);
    if (!session) {
        return { active: false, messageCount: 0 };
    }
    return {
        active: session.active,
        messageCount: session.messages.length,
    };
};

export default {
    enableLearningMode,
    disableLearningMode,
    isLearningModeActive,
    bufferMessage,
    endSession,
    getSessionStatus,
};
