import { browser } from '$app/environment';

/**
 * @typedef {object} Message
 * @property {string} [id]
 * @property {'user' | 'bot'} sender
 * @property {string} text
 * @property {number} [timestamp]
 * @property {object} [meta]
 */

/**
 * Creates a reactive state that persists to localStorage (Svelte 5 style)
 * @template T
 * @param {string} key The key for localStorage
 * @param {T} initialValue The initial value
 * @returns {object} Object with getter/setter that syncs to localStorage
 */
function persistentState(key, initialValue) {
  // Get initial value from localStorage if available
  let storedValue = initialValue;
  if (browser) {
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        storedValue = JSON.parse(stored);
      }
    } catch (e) {
      console.error(`Failed to parse localStorage value for key "${key}"`, e);
    }
  }

  let value = $state(storedValue);

  // Watch for changes and update localStorage
  if (browser) {
    $effect(() => {
      localStorage.setItem(key, JSON.stringify(value));
    });
  }

  return {
    get value() { return value; },
    set value(newValue) { value = newValue; }
  };
}

// --- Core State ---
export const conversationsState = persistentState('chat_conversations', {});
export const messagesState = persistentState('chat_messages', {});
export const activeConversationIdState = (() => {
  let value = $state(null);
  return {
    get value() { return value; },
    set value(newValue) { value = newValue; }
  };
})();

export const webSearchActiveState = (() => {
  let value = $state(false);
  return {
    get value() { return value; },
    set value(newValue) { value = newValue; }
  };
})();

// Initialize theme properly
function getInitialTheme() {
  if (!browser) return 'light';
  const stored = localStorage.getItem('color-theme');
  return stored === 'dark' ? 'dark' : 'light';
}

export const themeState = persistentState('color-theme', getInitialTheme());

// Watch theme changes and apply to document
if (browser) {
  $effect(() => {
    if (themeState.value === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  });
}

// --- Derived Values (Svelte 5 style) ---
export const conversationsList = $derived(
  Object.values(conversationsState.value).sort((a, b) => b.lastUpdated - a.lastUpdated)
);

export const activeConversation = $derived(
  activeConversationIdState.value ? conversationsState.value[activeConversationIdState.value] : null
);

export const activeMessages = $derived(
  activeConversation 
    ? activeConversation.messageIds.map(id => messagesState.value[id]).filter(Boolean)
    : []
);

// --- Action Functions ---
/**
 * Creates a new conversation
 * @returns {string} The ID of the new conversation
 */
export function createConversation() {
  const newId = crypto.randomUUID();
  const newConversation = {
    id: newId,
    title: 'New Conversation',
    messageIds: [],
    lastUpdated: Date.now()
  };
  
  conversationsState.value = {
    ...conversationsState.value,
    [newId]: newConversation
  };
  
  return newId;
}

/**
 * Adds a message to a conversation
 * @param {string | null} conversationId
 * @param {Message} message
 */
export function addMessage(conversationId, message) {
  if (!conversationId) return;

  const messageId = crypto.randomUUID();
  const newMessage = { 
    id: messageId, 
    ...message, 
    timestamp: Date.now() 
  };

  // Add message
  messagesState.value = {
    ...messagesState.value,
    [messageId]: newMessage
  };

  // Update conversation
  const currentConversation = conversationsState.value[conversationId];
  if (currentConversation) {
    const updatedConversation = {
      ...currentConversation,
      messageIds: [...currentConversation.messageIds, messageId],
      lastUpdated: Date.now()
    };

    // Auto-update conversation title based on first user message
    if (currentConversation.title === 'New Conversation' && message.sender === 'user') {
      updatedConversation.title = message.text.slice(0, 50) + (message.text.length > 50 ? '...' : '');
    }

    conversationsState.value = {
      ...conversationsState.value,
      [conversationId]: updatedConversation
    };
  }
}

export function setActiveConversation(id) {
  activeConversationIdState.value = id;
}

/**
 * Clears all conversations and messages
 */
export function clearAllConversations() {
  conversationsState.value = {};
  messagesState.value = {};
  activeConversationIdState.value = null;
}

/**
 * Toggles the theme between light and dark
 */
export function toggleTheme() {
  themeState.value = themeState.value === 'dark' ? 'light' : 'dark';
}

/**
 * Toggles web search active state
 */
export function toggleWebSearch() {
  webSearchActiveState.value = !webSearchActiveState.value;
}