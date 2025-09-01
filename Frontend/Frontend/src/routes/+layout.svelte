<script>
    import '../app.css';
    import { browser } from '$app/environment';
    import { theme } from '$lib/stores/theme.js';

    let { children } = $props();

    // Reactively update the document root class to reflect the theme.
    // The theme store itself handles persisting the value to localStorage.
    $effect(() => {
      if (!browser) return;
      
      if ($theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    });
</script>

<svelte:head>
    <title>Senai Chat Interface</title>
</svelte:head>

<div class="app-shell">
    {@render children()}
</div>