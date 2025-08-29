import { writable, derived } from 'svelte/store';
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
 * Creates a Svelte store that persists its value in localStorage.
 * @template T
 * @param {string} key The key for localStorage.
 * @param {T} startValue The initial value of the store.
 * @returns {import('svelte/store').Writable<T>}
 */
function persistentWritable(key, startValue) {
	let initialValue = startValue;
	if (browser) {
		const storedValue = window.localStorage.getItem(key);
		if (storedValue) {
			try {
				initialValue = JSON.parse(storedValue);
			} catch (e) {
				console.error(`Failed to parse localStorage value for key "${key}"`, e);
				initialValue = startValue;
			}
		}
	}

	const store = writable(initialValue);

	if (browser) {
		store.subscribe((value) => {
			window.localStorage.setItem(key, JSON.stringify(value));
		});
	}

	return store;
}

// --- Base Stores ---
export const conversations = persistentWritable('chat_conversations', {});
export const messages = persistentWritable('chat_messages', {});
export const activeConversationId = writable(null);
export const webSearchActive = writable(false);
// Initialize theme based on what's actually in localStorage to match HTML script
function getInitialTheme() {
	if (!browser) return 'light';
	const stored = localStorage.getItem('color-theme');
	return stored === 'dark' ? 'dark' : 'light';
}

export const theme = persistentWritable('color-theme', getInitialTheme());

// --- Derived Stores (centralized) ---
// Create a sorted list of conversations for the sidebar.
export const conversationsList = derived(conversations, ($conversations) =>
	Object.values($conversations).sort((a, b) => b.lastUpdated - a.lastUpdated)
);

// Get the currently active conversation object.
export const activeConversation = derived(
	[conversations, activeConversationId],
	([$conversations, $activeConversationId]) =>
		$activeConversationId ? $conversations[$activeConversationId] : null
);

// Get the messages for the currently active conversation.
export const activeMessages = derived(
	[messages, activeConversation],
	([$messages, $activeConversation]) => {
		if (!$activeConversation) return [];
		return $activeConversation.messageIds.map(id => $messages[id]).filter(Boolean);
	}
);

// --- Action Functions ---
/**
 * Creates a new conversation and sets it as active.
 * @returns {string} The ID of the new conversation.
 */
export function createConversation() {
	const newId = crypto.randomUUID();
	const newConversation = {
		id: newId,
		title: 'New Conversation',
		messageIds: [],
		lastUpdated: Date.now()
	};
	conversations.update((convos) => {
		convos[newId] = newConversation;
		return convos;
	});
	return newId;
}

/**
 * Adds a message to a conversation.
 * @param {string | null} conversationId
 * @param {Message} message
 */
export function addMessage(conversationId, message) {
	if (!conversationId) return;

	const messageId = crypto.randomUUID();
	const newMessage = { id: messageId, ...message, timestamp: Date.now() };

	messages.update((msgs) => ({ ...msgs, [messageId]: newMessage }));
	conversations.update((convos) => {
		if (convos[conversationId]) {
			convos[conversationId].messageIds.push(messageId);
			convos[conversationId].lastUpdated = Date.now();
			
			// Auto-update conversation title based on first user message
			if (convos[conversationId].title === 'New Conversation' && message.sender === 'user') {
				convos[conversationId].title = message.text.slice(0, 50) + (message.text.length > 50 ? '...' : '');
			}
		}
		return convos;
	});
}

export function setActiveConversation(id) {
	activeConversationId.set(id);
}

/**
 * Clears all conversations and messages from the stores and localStorage.
 */
export function clearAllConversations() {
	conversations.set({});
	messages.set({});
	activeConversationId.set(null);
}