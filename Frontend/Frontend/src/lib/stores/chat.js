import { writable } from 'svelte/store';
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

export const conversations = persistentWritable('chat_conversations', {});
export const messages = persistentWritable('chat_messages', {});
export const activeConversationId = writable(null);
export const webSearchActive = writable(false);
export const theme = persistentWritable('color-theme', 'light');

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
