import { sendMessageToSensay } from '../services/sensayService.js';
import { getHistory, saveHistory } from '../services/historyService.js';

/**
 * Controller for handling chat interactions.
 * This module orchestrates the flow of a user message: fetching history,
 * calling the AI service, and saving the conversation turn.
 */

/**
 * Processes a user's message by fetching their conversation history,
 * sending the context and new message to the Sensay API, and then
 * saving the new exchange to the history.
 *
 * @param {string} userId The unique identifier for the user.
 * @param {string} message The text of the user's message.
 * @returns {Promise<object>} A promise that resolves to the bot's response object.
 * @throws {Error} Propagates errors from the Sensay API service.
 */
export const handleUserMessage = async (userId, message) => {
  try {
    // 1. Fetches the user’s chat history to provide context.
    const history = getHistory(userId);

    // 2. Sends the new message and the conversation history to Sensay.
    const botResponse = await sendMessageToSensay(message, history);

    // 3. Saves the new user message and the bot's response to the history.
    // This ensures the context is updated for the next interaction.
    saveHistory(userId, message, botResponse);

    // 4. Returns the bot’s response to the caller.
    return botResponse;
  } catch (error) {
    // The error is already logged in detail by sensayService.
    // We can add context here and re-throw for the caller to handle.
    console.error(`Error in handleUserMessage for user ${userId}:`, error.message);
    throw error;
  }
};

