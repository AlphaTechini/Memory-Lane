<script>
  import '../app.css';
  import { browser } from '$app/environment';
  import { theme } from '$lib/stores/theme.js';

  let { children } = $props();

  $effect(() => {
    if (!browser) return;
    document.documentElement.classList.toggle('dark', $theme === 'dark');
  });
</script>

<svelte:head>
  <title>Senai Chat Interface</title>
</svelte:head>

<div class="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
  <nav class="p-4 bg-white dark:bg-gray-800 border-b dark:border-gray-700 flex gap-4 items-center">
    <a href="/" class="font-medium">Chatbot</a>
    <a href="/gallery" class="font-medium">Gallery</a>
    <a href="/create-replicas" class="font-medium">Create Replicas</a>
    <div class="ml-auto"><slot name="theme"/><slot/></div>
  </nav>

  <main class="p-4">
    {@render children()}
  </main>
</div>