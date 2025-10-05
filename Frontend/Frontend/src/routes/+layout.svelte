<!-- src/routes/+layout.svelte -->
<script>
  import '../app.css';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { theme } from '$lib/stores/theme.js';
  import Navigation from '$lib/components/Navigation.svelte';
  import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';

  let { children } = $props();

  // Initialize Vercel Speed Insights
  injectSpeedInsights();

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

  <!-- 🔔 Global Notification Banner -->
  <div class="fixed top-0 left-0 w-full z-50">
    <div class="bg-yellow-300 text-black text-center px-4 py-3 shadow-lg">
      <p class="font-medium">
        🚧 The platform is undergoing an upgrade. As such, some features may not work properly.<br />
        Please check in again after 24 hours. Sorry for any inconveniences caused.
      </p>
    </div>
  </div>

  {#if !isAuthPage}
    <Navigation />
  {/if}
  
  <main class={isAuthPage ? '' : 'pt-0'}>
    {@render children()}
  </main>
</div>
