/**
 * Groq LLM Service
 * 
 * Provides LLM orchestration via the Groq API with tool calling support.
 * Uses the OpenAI-compatible chat completions endpoint.
 * 
 * When GROQ_API_KEY is set, the model can call tools to:
 * - get_identity: Deterministic identity lookup from the RAG engine
 * - search_memory: Search long-term memory for relevant context
 * - store_memory: Store an approved memory chunk
 * 
 * The tool call loop runs autonomously:
 *   1. Send messages + tool definitions to Groq
 *   2. If the model returns tool_calls, execute them against the RAG engine
 *   3. Feed tool results back as tool messages
 *   4. Repeat until the model produces a final text response (max 5 iterations)
 */

import axios from 'axios';
import logger from '../utils/logger.js';
import { getIdentity, searchMemory, storeMemory } from './ragClient.js';

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';
const GROQ_BASE_URL = process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1';
const MAX_TOOL_ITERATIONS = 5;
const GROQ_TIMEOUT = parseInt(process.env.GROQ_TIMEOUT || '30000', 10);

/**
 * MCP-style tool definitions for the Groq model.
 */
export const toolDefinitions = [
    {
        type: 'function',
        function: {
            name: 'get_identity',
            description: 'Fetch structured identity data for the user. Use for deterministic facts like name, children, birthdate, favourite_colour.',
            parameters: {
                type: 'object',
                properties: {
                    key: { type: 'string', description: 'Identity key to look up, e.g. "children", "birthdate", "name"' },
                },
                required: ['key'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'search_memory',
            description: 'Search long-term memory for relevant past events, conversations, or information about the user.',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'Natural language search query describing what to look for' },
                    top_k: { type: 'integer', description: 'Number of results to return (default: 3)' },
                    replica_id: { type: 'string', description: 'Optional replica ID for scoping the search' },
                },
                required: ['query'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'store_memory',
            description: 'Store an important piece of user information into long-term memory. Use when the user shares something worth remembering.',
            parameters: {
                type: 'object',
                properties: {
                    content: { type: 'string', description: 'The memory content to store' },
                    importance: { type: 'number', description: 'Importance score between 0.0 and 1.0 (higher = more important)' },
                    source: { type: 'string', enum: ['conversation', 'file', 'manual'], description: 'Source of the memory' },
                    replica_id: { type: 'string', description: 'Optional replica ID for scoping the memory storage' },
                },
                required: ['content'],
            },
        },
    },
];

// Shared axios instance for Groq API
const groqClient = GROQ_API_KEY ? axios.create({
    baseURL: GROQ_BASE_URL,
    timeout: GROQ_TIMEOUT,
    headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
    },
}) : null;

/**
 * Check if Groq is configured and ready to use.
 */
export const isConfigured = () => Boolean(GROQ_API_KEY);

/**
 * Execute a single tool call returned by the Groq model.
 * @param {string} userId - User ID for context
 * @param {string} toolName - Name of the tool to execute
 * @param {object} args - Tool arguments
 * @param {string} [replicaId=''] - Replica ID for scoping
 * @returns {Promise<object>} Tool execution result
 */
export const executeTool = async (userId, toolName, args, replicaId = '') => {
    const start = Date.now();
    let result;

    try {
        switch (toolName) {
            case 'get_identity':
                result = await getIdentity(userId, args.key);
                break;
            case 'search_memory':
                result = await searchMemory(userId, args.query, args.top_k || 3, replicaId);
                break;
            case 'store_memory':
                result = await storeMemory(userId, args.content, args.importance || 0.5, args.source || 'conversation', '', replicaId);
                break;
            default:
                result = { success: false, error: `Unknown tool: ${toolName}` };
        }
    } catch (err) {
        result = { success: false, error: err.message };
    }

    logger.info(`Tool ${toolName} executed in ${Date.now() - start}ms`, { userId, toolName, success: result?.success });
    return result;
};

/**
 * Execute all tool calls from a model response in parallel.
 * @param {string} userId - User ID for context
 * @param {Array} toolCalls - Array of tool call objects from the model
 * @param {string} [replicaId=''] - Replica ID for scoping
 * @returns {Promise<Array>} Array of tool message objects to send back
 */
const executeToolCalls = async (userId, toolCalls, replicaId = '') => {
    const results = await Promise.all(
        toolCalls.map(async (tc) => {
            let args;
            try {
                args = typeof tc.function.arguments === 'string'
                    ? JSON.parse(tc.function.arguments)
                    : tc.function.arguments;
            } catch (e) {
                args = {};
                logger.warn(`Failed to parse tool arguments for ${tc.function.name}:`, e.message);
            }

            const result = await executeTool(userId, tc.function.name, args, replicaId);

            return {
                role: 'tool',
                tool_call_id: tc.id,
                content: JSON.stringify(result),
            };
        })
    );

    return results;
};

/**
 * Send a chat completion request to Groq with full tool call loop.
 * 
 * Flow:
 *   1. Send messages + tools to Groq
 *   2. If model issues tool_calls → execute them against RAG engine
 *   3. Append tool results back as messages
 *   4. Repeat until model produces a text response (max MAX_TOOL_ITERATIONS)
 * 
 * @param {Array<{role: string, content: string}>} messages - Conversation messages
 * @param {string} userId - User ID for tool execution context
 * @param {object} [options] - Additional options
 * @param {string} [options.systemPrompt] - System prompt for the model
 * @param {number} [options.maxTokens] - Maximum output tokens
 * @param {string} [options.replicaId] - Replica ID for scoping tool calls
 * @returns {Promise<object>} Final response with text content
 */
export const chatCompletion = async (messages, userId, options = {}) => {
    if (!GROQ_API_KEY || !groqClient) {
        logger.warn('Groq not configured — returning stub response');
        return {
            success: false,
            configured: false,
            response: null,
            message: 'Groq API key not set. Add GROQ_API_KEY to .env to enable LLM orchestration.',
        };
    }

    const model = options.model || GROQ_MODEL;
    const maxTokens = options.maxTokens || 2048;
    const temperature = options.temperature ?? 0.7;
    const replicaId = options.replicaId || '';

    // Build the full messages array with an optional system prompt
    const fullMessages = [];
    if (options.systemPrompt) {
        fullMessages.push({ role: 'system', content: options.systemPrompt });
    }
    fullMessages.push(...messages);

    let conversationMessages = [...fullMessages];
    let iteration = 0;
    let totalToolCalls = 0;
    const startTime = Date.now();

    while (iteration < MAX_TOOL_ITERATIONS) {
        iteration++;

        try {
            const payload = {
                model,
                messages: conversationMessages,
                tools: toolDefinitions,
                tool_choice: 'auto',
                max_tokens: maxTokens,
                temperature,
            };

            logger.debug(`Groq iteration ${iteration}`, { model, messageCount: conversationMessages.length, userId });

            const { data } = await groqClient.post('/chat/completions', payload);

            const choice = data.choices?.[0];
            if (!choice) {
                throw new Error('No choices returned from Groq');
            }

            const assistantMessage = choice.message;

            // Case 1: Model produced a text response (no tool calls) → done
            if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
                const elapsed = Date.now() - startTime;
                logger.info(`Groq completed in ${iteration} iteration(s), ${totalToolCalls} tool call(s), ${elapsed}ms`, {
                    userId, model, iterations: iteration, toolCalls: totalToolCalls,
                });

                return {
                    success: true,
                    configured: true,
                    response: assistantMessage.content || '',
                    model,
                    usage: data.usage,
                    iterations: iteration,
                    totalToolCalls,
                    elapsedMs: elapsed,
                };
            }

            // Case 2: Model issued tool calls → execute and loop
            totalToolCalls += assistantMessage.tool_calls.length;
            logger.info(`Groq issued ${assistantMessage.tool_calls.length} tool call(s) in iteration ${iteration}`, {
                tools: assistantMessage.tool_calls.map(tc => tc.function.name),
                userId,
            });

            // Append the assistant's message (with tool_calls) to conversation
            conversationMessages.push(assistantMessage);

            // Execute tools and append results
            const toolResults = await executeToolCalls(userId, assistantMessage.tool_calls, replicaId);
            conversationMessages.push(...toolResults);

        } catch (err) {
            const elapsed = Date.now() - startTime;

            // Extract useful error info from Groq API errors
            const status = err.response?.status;
            const apiError = err.response?.data?.error?.message || err.message;

            logger.error(`Groq API error on iteration ${iteration}:`, {
                status, error: apiError, userId, model, elapsedMs: elapsed,
            });

            return {
                success: false,
                configured: true,
                response: null,
                error: apiError,
                status,
                iterations: iteration,
                totalToolCalls,
                elapsedMs: elapsed,
            };
        }
    }

    // Exhausted iterations (shouldn't normally happen)
    logger.warn(`Groq exhausted ${MAX_TOOL_ITERATIONS} iterations without final response`, { userId, totalToolCalls });
    return {
        success: false,
        configured: true,
        response: null,
        error: `Exhausted ${MAX_TOOL_ITERATIONS} tool-call iterations without a final response`,
        iterations: iteration,
        totalToolCalls,
        elapsedMs: Date.now() - startTime,
    };
};

/**
 * Get the current Groq configuration summary.
 */
export const getConfigSummary = () => ({
    configured: isConfigured(),
    model: GROQ_MODEL,
    baseUrl: GROQ_BASE_URL,
    maxToolIterations: MAX_TOOL_ITERATIONS,
    toolCount: toolDefinitions.length,
    toolNames: toolDefinitions.map(t => t.function.name),
});

export default {
    toolDefinitions,
    isConfigured,
    executeTool,
    chatCompletion,
    getConfigSummary,
};
