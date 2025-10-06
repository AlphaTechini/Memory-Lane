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
  <meta name="description" content="AI replicas that support memory recovery and assist patients with dementia, amnesia, and other memory illnesses. Caretakers, neurologists, and memory specialists can use the platform to manage patients and track progress." />
  <meta name="keywords" content="AI memory support, dementia, amnesia, dementia AI, amnesia AI, memory illness, healthcare AI, neurologists, neuropsychologists, patient memory management, caretakers, memory recovery, replicas, cognitive health" />

</svelte:head>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">

  <div class="fixed top-0 left-0 w-full z-50">
    <div class="bg-yellow-300 text-black text-center px-4 py-3 shadow-lg">
      <p class="font-medium">
        <s class="opacity-75">
            🚧 The platform is undergoing an upgrade. As such, some features may not work properly.<br />
            Please check in again after 24 hours. Sorry for any inconveniences caused.
        </s>
      </p>
      <p class="font-bold text-lg text-red-700 mt-2">
          🎉 Great news! The system upgrade is **almost complete**. You may see new features stabilize over the next few hours. Thank you for your patience!
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
