/**
 * A service for managing chat history in-memory.
 * This allows maintaining conversation context for different users.
 */

// In-memory store for chat histories, keyed by userId.
// The history is an array of message objects, which is a common format for chat context.
// Example structure:
// {
//   'user123': [
//     { role: 'user', content: 'Hello!' },
//     { role: 'bot', content: 'Hi there! How can I help?' }
//   ]
// }
const chatHistories = {};

/**
 * Retrieves the chat history for a specific user.
 *
 * @param {string} userId The unique identifier for the user.
 * @returns {Array<object>} The chat history for the user, or an empty array if none exists.
 */
export const getHistory = (userId) => {
  if (!userId) {
    console.error('getHistory called without a userId.');
    return [];
  }
  return chatHistories[userId] || [];
};

/**
 * Saves a new user message and bot response to the user's chat history.
 *
 * @param {string} userId The unique identifier for the user.
 * @param {string} userMessage The message sent by the user.
 * @param {object} botResponse The response object from the bot/API.
 */
export const saveHistory = (userId, userMessage, botResponse) => {
  if (!userId) {
    console.error('saveHistory called without a userId.');
    return;
  }

  // Initialize history for a new user
  if (!chatHistories[userId]) {
    chatHistories[userId] = [];
  }

  // Add the user's message to the history
  chatHistories[userId].push({ role: 'user', content: userMessage });

  // Add the bot's response to the history.
  // We assume botResponse is the object we want to store.
  chatHistories[userId].push({ role: 'bot', content: botResponse });
};
