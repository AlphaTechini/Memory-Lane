<script>
  import '../app.css';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { theme } from '$lib/stores/theme.js';
  import Navigation from '$lib/components/Navigation.svelte';
  import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';

  let { children } = $props();

  // Component state for banner visibility
  let showBanner = $state(true);
  let showNotificationIcon = $state(false);

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

  const dismissBanner = () => {
    showBanner = false;
    showNotificationIcon = true;
  };

  const showBannerFromIcon = () => {
    showBanner = true;
    showNotificationIcon = false;
  };
</script>

<svelte:head>
  <title>Sensay AI - AI Replica Platform</title>
  <meta name="description" content="AI replicas that support memory recovery and assist patients with dementia, amnesia, and other memory illnesses. Caretakers, neurologists, and memory specialists can use the platform to manage patients and track progress." />
  <meta name="keywords" content="AI memory support, dementia, amnesia, dementia AI, amnesia AI, memory illness, healthcare AI, neurologists, neuropsychologists, patient memory management, caretakers, memory recovery, replicas, cognitive health" />

</svelte:head>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">

  {#if showBanner}
    <div class="fixed top-0 left-0 w-full z-50">
      <div class="bg-yellow-300 text-black text-center px-4 py-3 shadow-lg relative">
        <p class="font-medium">
          <s class="opacity-75 italic">
              🚧 The platform is undergoing an upgrade. As such, some features may not work properly.<br />
              Please check in again after 24 hours. Sorry for any inconveniences caused.
          </s>
        </p>
        <p class="font-semibold text-base mt-2">
            🎉 Great news! The system upgrade is *almost complete*. You may see new features stabilize over the next few hours. Thank you for your patience!
        </p>

        <button
          onclick={dismissBanner}
          class="absolute top-1/2 right-3 transform -translate-y-1/2 p-1 rounded-full hover:bg-yellow-400 transition-colors"
          aria-label="Close notification banner"
        >
          <svg class="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  {/if}

  {#if showNotificationIcon}
    <div class="fixed top-4 right-4 z-50">
      <button
        onclick={showBannerFromIcon}
        class="bg-yellow-300 p-3 rounded-full shadow-xl hover:bg-yellow-400 transition-colors"
        aria-label="Show notification updates"
      >
        <svg class="w-6 h-6 text-black" fill="currentColor" viewBox="0 0 24 24">
          <path d="M10 2a2 2 0 012 2v1a7 7 0 017 7v7a2 2 0 01-2 2h-14a2 2 0 01-2-2v-7a7 7 0 017-7V4a2 2 0 012-2zm-2 19a4 4 0 008 0H8z" />
        </svg>
        <span class="absolute top-0 right-0 block h-3 w-3 rounded-full ring-2 ring-gray-900 bg-red-500"></span>
      </button>
    </div>
  {/if}

  {#if !isAuthPage}
    <Navigation />
  {/if}
  
  <main class={isAuthPage ? '' : (showBanner ? 'pt-20' : 'pt-0')}>
    {@render children()}
  </main>
</div>
