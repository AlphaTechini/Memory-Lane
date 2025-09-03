<!-- src/routes/+layout.svelte -->
<script>
  import '../app.css';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { theme } from '$lib/stores/theme.js';

  let { children } = $props();

  $effect(() => {
    if (!browser) return;
    document.documentElement.classList.toggle('dark', $theme === 'dark');
  });

  // Check if we're on a standalone page (chatbot, gallery, create-replica) or dashboard
  let isStandalonePage = $derived(
    $page.route.id === '/' || 
    $page.route.id === '/gallery' || 
    $page.route.id === '/create-replica' ||
    $page.route.id === '/dashboard'
  );
</script>

<svelte:head>
  <title>Sensay AI - AI Replica Platform</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
  {#if !isStandalonePage}
    <!-- Only show this nav for non-standalone pages -->
    <nav class="p-4 bg-white dark:bg-gray-800 border-b dark:border-gray-700 flex gap-4 items-center">
      <a href="/dashboard" class="font-medium hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Dashboard</a>
      <a href="/" class="font-medium hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Chatbot</a>
      <a href="/gallery" class="font-medium hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Gallery</a>
      <a href="/create-replica" class="font-medium hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Create Replicas</a>
      <div class="ml-auto"><slot name="theme"/></div>
    </nav>
  {/if}

  <main class={isStandalonePage ? 'h-screen' : 'p-4'}>
    {@render children()}
  </main>
</div>