<script>
  import "../app.css";
  import { browser } from "$app/environment";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { theme } from "$lib/stores/theme.js";
  import Navigation from "$lib/components/Navigation.svelte";
  import { injectSpeedInsights } from "@vercel/speed-insights/sveltekit";
  import { dev } from "$app/environment";
  import { injectAnalytics } from "@vercel/analytics/sveltekit";

  injectAnalytics({ mode: dev ? "development" : "production" });

  let { children } = $props();

  const BANNER_VERSION = "v4";
  let showBanner = $state(true);

  injectSpeedInsights();

  $effect(() => {
    if (!browser) return;
    document.documentElement.classList.toggle("dark", $theme === "dark");
    const dismissed = localStorage.getItem("bannerDismissed");
    if (dismissed === BANNER_VERSION) {
      showBanner = false;
    }
  });

  const dismissBanner = () => {
    showBanner = false;
    if (browser) {
      localStorage.setItem("bannerDismissed", BANNER_VERSION);
    }
  };

  let isAuthPage = $derived(
    $page.route.id?.includes("/login") ||
      $page.route.id?.includes("/signup") ||
      $page.route.id?.includes("/verify-otp"),
  );

  let isHomepage = $derived($page.route.id === "/");
  let isDashboard = $derived($page.route.id === "/dashboard");
</script>

<svelte:head>
  <title>Memory Lane - AI Memory Support</title>
  <meta
    name="description"
    content="AI replicas that support memory recovery and assist patients with dementia, amnesia, and other memory illnesses. Caretakers, neurologists, and memory specialists can use the platform to manage patients and track progress."
  />
  <meta
    name="keywords"
    content="AI memory support, dementia, amnesia, dementia AI, amnesia AI, memory illness, healthcare AI, neurologists, neuropsychologists, patient memory management, caretakers, memory recovery, replicas, cognitive health"
  />
  <!-- Accessible viewport -->
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0, maximum-scale=5.0"
  />
</svelte:head>

<div
  class="min-h-screen bg-cream-50 dark:bg-charcoal-900 text-charcoal-800 dark:text-cream-100 font-accessible transition-colors duration-200"
>
  {#if showBanner && !isHomepage}
    <div class="fixed top-0 left-0 w-full z-50">
      <div
        class="bg-teal-500 text-white text-center px-6 py-4 shadow-lg relative"
        role="alert"
      >
        <p class="text-accessible-lg font-semibold mb-2">
          Welcome to Memory Lane
        </p>
        <p class="text-accessible-base">
          If you are interested in supporting us, please
          <a
            href="/feedback"
            class="font-bold underline hover:text-cream-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-teal-500 rounded"
          >
            contact us via feedback
          </a>.
        </p>

        <button
          onclick={dismissBanner}
          class="absolute top-1/2 right-4 transform -translate-y-1/2 p-2 rounded-full hover:bg-teal-600 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Close notification banner"
        >
          <svg
            class="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  {/if}

  {#if !isAuthPage && !isHomepage && !isDashboard}
    <Navigation />
  {/if}

  <main
    id="main-content"
    class={isAuthPage || isHomepage || isDashboard
      ? ""
      : showBanner
        ? "pt-24"
        : "pt-0"}
  >
    {@render children()}
  </main>

  <!-- Home Anchor Button - Always visible except on dashboard, auth pages, and homepage -->
  {#if !isAuthPage && !isDashboard && !isHomepage}
    <button
      onclick={() => goto("/dashboard")}
      class="home-anchor-btn"
      aria-label="Go to Home"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
      <span>Home</span>
    </button>
  {/if}
</div>
