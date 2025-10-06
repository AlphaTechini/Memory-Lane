<script>
  import '../app.css';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { theme } from '$lib/stores/theme.js';
  import Navigation from '$lib/components/Navigation.svelte';
  import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';

  let { children } = $props();

  // Banner version key (increment if you release a new update)
  const BANNER_VERSION = "v2";

  let showBanner = $state(true);

  // Initialize Vercel Speed Insights
  injectSpeedInsights();

  $effect(() => {
    if (!browser) return;

    // Theme handling
    document.documentElement.classList.toggle('dark', $theme === 'dark');

    // Check if banner was dismissed before
    const dismissed = localStorage.getItem("bannerDismissed");
    if (dismissed === BANNER_VERSION) {
      showBanner = false;
    }
  });

  // Dismiss function with localStorage
  const dismissBanner = () => {
    showBanner = false;
    if (browser) {
      localStorage.setItem("bannerDismissed", BANNER_VERSION);
    }
  };

  // Check if we’re on login/signup pages
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

  {#if showBanner}
    <div class="fixed top-0 left-0 w-full z-50">
      <div class="bg-yellow-300 text-black text-center px-6 py-4 shadow-lg relative">
        <p class="font-bold text-lg mb-2">🚀 Welcome to Version 2 of Memory Lane!</p>
        <p class="mb-3">Sorry for any inconveniences caused before. Here’s what’s new:</p>

        <ul class="text-left inline-block mx-auto space-y-2 mb-3">
          <li>1️⃣ Descriptive Homepage – Users are no longer confused about what the app does.</li>
          <li>2️⃣ Feedback Section – Head over to the <a href="/feedback" class="underline text-blue-700 hover:text-blue-900">Feedback page</a> and suggest changes you’d like to see.</li>
          <li>3️⃣ About Section (incomplete).</li>
          <li>4️⃣ Google Auth preparation.</li>
        </ul>

        <p class="mt-4 font-semibold">🔮 Upcoming:</p>
        <p>Google Auth – Sign up / Sign in with Google.</p>

        <!-- Always visible close button -->
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

  {#if !isAuthPage}
    <Navigation />
  {/if}
  
  <main class={isAuthPage ? '' : (showBanner ? 'pt-40' : 'pt-0')}>
    {@render children()}
  </main>
</div>
