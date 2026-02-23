/**
 * RAG Engine Client
 * 
 * HTTP client for communicating with the Go RAG microservice.
 * All memory, identity, and session operations route through here.
 */

import axios from 'axios';
import logger from '../utils/logger.js';

const RAG_ENGINE_URL = process.env.RAG_ENGINE_URL || 'http://localhost:8081';
const TIMEOUT = parseInt(process.env.RAG_ENGINE_TIMEOUT || '15000', 10);
const MAX_RETRIES = 2;

const client = axios.create({
    baseURL: RAG_ENGINE_URL,
    timeout: TIMEOUT,
    headers: { 'Content-Type': 'application/json' },
});

/**
 * Retry wrapper for RAG engine requests.
 */
async function withRetry(fn, retries = MAX_RETRIES) {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            if (attempt < retries) {
                const delay = 200 * Math.pow(2, attempt);
                logger.warn(`RAG Engine request failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }
    throw lastError;
}

/**
 * Get a structured identity fact for a user.
 * @param {string} userId - User ID
 * @param {string} key - Identity key (e.g. "children", "birthdate")
 * @returns {Promise<object>} Identity response
 */
export const getIdentity = async (userId, key) => {
    try {
        const { data } = await withRetry(() =>
            client.post('/identity/get', { user_id: userId, key })
        );
        return data;
    } catch (err) {
        logger.error('RAG getIdentity failed:', err.message);
        return { success: false, error: err.message };
    }
};

/**
 * Search long-term memory for relevant chunks, scoped to a replica.
 * @param {string} userId - User ID
 * @param {string} query - Search query
 * @param {number} [topK=3] - Number of results
 * @param {string} [replicaId=''] - Replica ID to scope search
 * @returns {Promise<object>} Search response with scored chunks
 */
export const searchMemory = async (userId, query, topK = 3, replicaId = '') => {
    try {
        const { data } = await withRetry(() =>
            client.post('/memory/search', {
                user_id: userId,
                replica_id: replicaId,
                query,
                top_k: topK,
            })
        );
        return data;
    } catch (err) {
        logger.error('RAG searchMemory failed:', err.message);
        return { success: false, results: [], error: err.message };
    }
};

/**
 * Store a memory chunk, scoped to a replica.
 * @param {string} userId - User ID
 * @param {string} content - Memory content
 * @param {number} importance - Importance score (0-1)
 * @param {string} source - Source type ("conversation", "file", "manual")
 * @param {string} [sessionId] - Session ID
 * @param {string} [replicaId=''] - Replica ID to scope storage
 * @returns {Promise<object>} Store response with chunk_id
 */
export const storeMemory = async (userId, content, importance = 0.5, source = 'conversation', sessionId = '', replicaId = '') => {
    try {
        const { data } = await withRetry(() =>
            client.post('/memory/store', {
                user_id: userId,
                replica_id: replicaId,
                content,
                importance,
                source,
                session_id: sessionId,
            })
        );
        return data;
    } catch (err) {
        logger.error('RAG storeMemory failed:', err.message);
        return { success: false, error: err.message };
    }
};

/**
 * Process a conversation session to extract memories and identity updates.
 * Results go into the review queue for caretaker approval.
 * @param {string} userId - User ID
 * @param {Array<{role: string, content: string}>} messages - Transcript
 * @returns {Promise<object>} Process response with session_id
 */
export const processSession = async (userId, messages) => {
    try {
        const { data } = await withRetry(() =>
            client.post('/session/process', { user_id: userId, messages })
        );
        return data;
    } catch (err) {
        logger.error('RAG processSession failed:', err.message);
        return { success: false, error: err.message };
    }
};

/**
 * Health check for the RAG engine.
 * @returns {Promise<object>} Health status
 */
export const healthCheck = async () => {
    try {
        const { data } = await client.get('/health');
        return { ...data, reachable: true };
    } catch (err) {
        return {
            status: 'unreachable',
            reachable: false,
            error: err.message,
        };
    }
};

export default { getIdentity, searchMemory, storeMemory, processSession, healthCheck };
