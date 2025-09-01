import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const key = 'color-theme';

/**
 * Initializes the theme store.
 * On the client, it reads the theme from the DOM (set by the FOUC script in app.html).
 * On the server, it defaults to 'light' since the theme is unknown.
 */
function getInitialTheme() {
	if (!browser) {
		return 'light';
	}
	return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export const theme = writable(getInitialTheme());

/**
 * Subscribes to theme changes to persist them to localStorage and update the DOM.
 */
theme.subscribe((value) => {
	if (!browser) {
		return;
	}
	// 1. Update localStorage for persistence
	localStorage.setItem(key, value);
	// 2. Update the <html> class for TailwindCSS
	document.documentElement.classList.toggle('dark', value === 'dark');
});
