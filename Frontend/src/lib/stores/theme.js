import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const key = 'color-theme';

/**
 * Warm Clarity Theme Store
 * Defaults to light mode for better accessibility with dementia/amnesia patients.
 * Dark mode is still available but light (cream) is the recommended default.
 */
function getInitialTheme() {
    if (!browser) return 'light';
    
    // Check if user has explicitly set a preference
    const stored = localStorage.getItem(key);
    if (stored) {
        return stored;
    }
    
    // Default to light mode for accessibility
    // (Warm cream backgrounds are easier on older eyes)
    return 'light';
}

export const theme = writable(getInitialTheme());

/**
 * Subscribes to theme changes to persist them to localStorage and update the DOM.
 */
theme.subscribe((value) => {
    if (!browser) return;
    localStorage.setItem(key, value);
    if (value === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
});

/**
 * Toggle between light and dark themes
 */
export function toggleTheme() {
    theme.update(current => current === 'dark' ? 'light' : 'dark');
}
