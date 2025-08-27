<script>
    import '../app.css';
    import { browser } from '$app/environment';
    import { theme } from '$lib/stores/chat.js';

    // Reactively update the document root class to reflect the theme.
    // This ensures the theme stays in sync if it's changed during the session.
    $: if (browser) {
      document.documentElement.classList.toggle('dark', $theme === 'dark');
    }
</script>

<slot />
