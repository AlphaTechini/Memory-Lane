import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const key = 'color-theme';

/**
 * Initializes the theme store.
 * On the client, it reads the theme from the DOM (set by the FOUC script in app.html).
 * On the server, it defaults to 'light' since the theme is unknown.
 */
function getInitialTheme() {
    if (!browser) return 'light';
    // app.html sets document.documentElement.classList for FOUC prevention
    return document.documentElement.classList.contains('dark') ? 'dark' : (localStorage.getItem(key) || 'light');
}

export const theme = writable(getInitialTheme());

/**
 * Subscribes to theme changes to persist them to localStorage and update the DOM.
 */
theme.subscribe((value) => {
    if (!browser) return;
    localStorage.setItem(key, value);
    if (value === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
});
