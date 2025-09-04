<!-- src/routes/+layout.svelte -->
<script>
  import '../app.css';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { theme } from '$lib/stores/theme.js';
  import Navigation from '$lib/components/Navigation.svelte';

  let { children } = $props();

  $effect(() => {
    if (!browser) return;
    document.documentElement.classList.toggle('dark', $theme === 'dark');
  });

  // Check if we're on auth pages (login, signup, verify-otp)
  let isAuthPage = $derived(
    $page.route.id?.includes('/login') ||
    $page.route.id?.includes('/signup') ||
    $page.route.id?.includes('/verify-otp')
  );
</script>

<svelte:head>
  <title>Sensay AI - AI Replica Platform</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
  {#if !isAuthPage}
    <Navigation />
  {/if}
  
  <main class={isAuthPage ? '' : 'pt-0'}>
    {@render children()}
  </main>
</div>