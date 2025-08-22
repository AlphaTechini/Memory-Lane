import { writable } from 'svelte/store';
import { v4 as uuidv4 } from 'uuid';
import { browser } from '$app/environment';

// --- Helper for localStorage persistence ---

const createPersistentStore = (key, startValue) => {
  let initial = startValue;
  if (browser) {
    const storedValue = localStorage.getItem(key);
    if (storedValue) {
      try {
        initial = JSON.parse(storedValue);
      } catch (e) {
        console.error(`Failed to parse localStorage value for key "${key}"`, e);
        localStorage.removeItem(key);
      }
    }
  }

  const store = writable(initial);

  if (browser) {
    store.subscribe((value) => {
      localStorage.setItem(key, JSON.stringify(value));
    });
  }

  return store;
};

// --- Svelte Stores ---

export const conversations = createPersistentStore('conversations', {});

export const messages = createPersistentStore('messages', {});

export const activeConversationId = createPersistentStore('activeConversationId', null);

export const webSearchActive = createPersistentStore('webSearchActive', false);

// --- Helper Functions ---

/**
 * Creates a new conversation.
 * @param {string} [initialTitle='New Chat'] - The initial title for the conversation.
 * @returns {string} The ID of the newly created conversation.
 */
export function createConversation(initialTitle = 'New Chat') {
  const newId = uuidv4();
  const newConversation = {
    id: newId,
    title: initialTitle,
    lastUpdated: Date.now(),
    messageIds: []
  };

  conversations.update((convos) => {
    convos[newId] = newConversation;
    return convos;
  });

  return newId;
}

/**
 * Adds a message to a specific conversation.
 * @param {string} conversationId - The ID of the conversation to add the message to.
 * @param {{sender: 'user' | 'bot', text: string, meta?: any}} msg - The message object.
 * @returns {string} The ID of the newly created message.
 */
export function addMessage(conversationId, { sender, text, meta }) {
  if (!conversationId) return;

  const newMsgId = uuidv4();
  const newMessage = {
    id: newMsgId,
    sender,
    text,
    ts: Date.now(),
    meta
  };

  messages.update((msgs) => {
    msgs[newMsgId] = newMessage;
    return msgs;
  });

  conversations.update((convos) => {
    if (convos[conversationId]) {
      convos[conversationId].messageIds.push(newMsgId);
      convos[conversationId].lastUpdated = Date.now();
    }
    return convos;
  });

  return newMsgId;
}

/**
 * Sets the currently active conversation.
 * @param {string | null} conversationId - The ID of the conversation to set as active.
 */
export function setActiveConversation(conversationId) {
  activeConversationId.set(conversationId);
}

/**
 * Toggles the web search functionality.
 */
export function toggleWebSearch() {
  webSearchActive.update((active) => !active);
}
