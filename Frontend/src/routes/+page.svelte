<script>
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { browser } from "$app/environment";

  import Header from "$lib/components/landing/Header.svelte";
  import Hero from "$lib/components/landing/Hero.svelte";
  import TrustedBanner from "$lib/components/landing/TrustedBanner.svelte";
  import Features from "$lib/components/landing/Features.svelte";
  import Security from "$lib/components/landing/Security.svelte";
  import FinalCTA from "$lib/components/landing/FinalCTA.svelte";
  import Footer from "$lib/components/landing/Footer.svelte";

  // Check if already logged in
  $effect(() => {
    if (browser) {
      const token = localStorage.getItem("authToken");
      if (token) {
        goto("/dashboard");
      }
    }
  });
</script>

<svelte:head>
  <title>Memory Lane - AI-Powered Memory Recovery Platform</title>
  <meta
    name="description"
    content="A caregiver-curated platform that transforms family photos and stories into personalized AI replicas, helping patients with dementia, amnesia, or memory loss reconnect with their past."
  />
  <meta
    name="keywords"
    content="memory recovery, dementia support, amnesia recovery, memory assistant, healthcare AI, AI replicas, cognitive therapy, caretakers, neurologists"
  />
</svelte:head>

<div
  class="min-h-screen bg-background-light dark:bg-background-dark font-sans selection:bg-primary/20 selection:text-primary"
>
  <Header />
  <main>
    <Hero />
    <TrustedBanner />
    <Features />
    <Security />
    <FinalCTA />
  </main>
  <Footer />
</div>
