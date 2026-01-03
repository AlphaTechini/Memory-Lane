<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';

  let scrolled = $state(false);
  let mobileMenuOpen = $state(false);

  // Check if already logged in
  $effect(() => {
    if (browser) {
      const token = localStorage.getItem('authToken');
      if (token) {
        goto('/dashboard');
      }
    }
  });

  onMount(() => {
    const handleScroll = () => {
      scrolled = window.scrollY > 20;
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  });

  const features = [
    {
      icon: 'brain',
      title: "AI-Powered Memory Support",
      description: "Personalized conversational replicas trained on your memories and stories"
    },
    {
      icon: 'heart',
      title: "Compassionate Care",
      description: "Designed specifically for dementia, amnesia, and memory-related conditions"
    },
    {
      icon: 'users',
      title: "Caretaker-Curated",
      description: "Families control the content, ensuring safe and meaningful interactions"
    },
    {
      icon: 'shield',
      title: "Secure & Private",
      description: "Your memories are protected with enterprise-grade security"
    }
  ];

  const audiences = [
    {
      title: "Patients & Individuals",
      description: "Whether managing memory conditions or simply wanting to preserve precious moments, Memory Lane helps you reconnect with your past.",
      benefits: ["Revisit cherished memories", "Stimulate cognitive engagement", "Maintain connection to identity"]
    },
    {
      title: "Caretakers & Families",
      description: "Create a supportive environment for your loved ones with tools designed to make memory care easier and more meaningful.",
      benefits: ["Build personalized memory galleries", "Monitor engagement safely", "Reduce caregiver stress"]
    },
    {
      title: "Healthcare Professionals",
      description: "Neuropsychologists and memory specialists can leverage Memory Lane as a complementary tool in cognitive therapy and patient care.",
      benefits: ["Evidence-based approach", "Track patient progress", "Enhance treatment outcomes"]
    }
  ];
</script>

<svelte:head>
  <title>Memory Lane - AI-Powered Memory Recovery Platform</title>
  <meta name="description" content="A caregiver-curated platform that transforms family photos and stories into personalized AI replicas, helping patients with dementia, amnesia, or memory loss reconnect with their past." />
  <meta name="keywords" content="memory recovery, dementia support, amnesia recovery, memory assistant, healthcare AI, AI replicas, cognitive therapy, caretakers, neurologists" />
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-cream-50 via-teal-50/30 to-coral-50/20">
  <!-- Navigation -->
  <nav class="fixed top-0 w-full z-50 transition-all duration-300 {scrolled ? 'bg-cream-50/95 backdrop-blur-md shadow-md' : 'bg-transparent'}">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center h-16">
        <div class="flex items-center space-x-2">
          <img src="/logo.png" alt="" class="h-8 w-auto" />
          <span class="text-xl font-bold bg-gradient-to-r from-teal-600 to-teal-500 bg-clip-text text-transparent">
            Memory Lane
          </span>
        </div>
        
        <!-- Desktop Menu -->
        <div class="hidden md:flex items-center space-x-6">
          <a href="#features" class="text-charcoal-700 hover:text-teal-600 transition-colors font-medium">Features</a>
          <a href="#who-its-for" class="text-charcoal-700 hover:text-teal-600 transition-colors font-medium">Who It's For</a>
          <a href="/login" class="text-charcoal-700 hover:text-teal-600 transition-colors font-medium">Sign In</a>
          <a href="/signup" class="bg-gradient-to-r from-teal-500 to-teal-600 text-white px-6 py-2.5 rounded-xl hover:from-teal-600 hover:to-teal-700 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 font-semibold">
            Get Started
          </a>
        </div>

        <!-- Mobile Menu Button -->
        <button 
          onclick={() => mobileMenuOpen = !mobileMenuOpen}
          class="md:hidden p-2 rounded-lg hover:bg-teal-50"
          aria-label="Toggle menu"
        >
          {#if mobileMenuOpen}
            <svg class="w-6 h-6 text-charcoal-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          {:else}
            <svg class="w-6 h-6 text-charcoal-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          {/if}
        </button>
      </div>

      <!-- Mobile Menu -->
      {#if mobileMenuOpen}
        <div class="md:hidden py-4 space-y-3 bg-cream-50/95 backdrop-blur-md rounded-b-lg">
          <a href="#features" class="block px-4 py-2 text-charcoal-700 hover:bg-teal-50 rounded font-medium">Features</a>
          <a href="#who-its-for" class="block px-4 py-2 text-charcoal-700 hover:bg-teal-50 rounded font-medium">Who It's For</a>
          <a href="/login" class="block px-4 py-2 text-charcoal-700 hover:bg-teal-50 rounded font-medium">Sign In</a>
          <a href="/signup" class="block mx-4 text-center bg-gradient-to-r from-teal-500 to-teal-600 text-white px-6 py-2.5 rounded-xl hover:from-teal-600 hover:to-teal-700 transition-colors font-semibold">
            Get Started
          </a>
        </div>
      {/if}
    </div>
  </nav>

  <!-- Hero Section - Above the fold -->
  <section class="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
    <div class="max-w-7xl mx-auto">
      <div class="text-center max-w-4xl mx-auto">
        <div class="inline-flex items-center space-x-2 bg-teal-100 text-teal-700 px-4 py-2 rounded-full mb-6">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <span class="text-sm font-semibold">AI-Powered Memory Recovery Platform</span>
        </div>
        
        <h1 class="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-teal-600 via-teal-500 to-coral-500 bg-clip-text text-transparent leading-tight">
          Preserve Memories,<br />Restore Connections
        </h1>
        
        <p class="text-xl md:text-2xl text-charcoal-600 mb-8 leading-relaxed">
          A caregiver-curated platform that transforms family photos and stories into 
          <span class="font-semibold text-teal-600">personalized AI replicas</span>, 
          helping patients with dementia, amnesia, or memory loss reconnect with their past.
        </p>

        <p class="text-lg text-charcoal-500 mb-12">
          Because everyone deserves to remember. <span class="italic">Everyone forgets sometimes</span> — 
          we're here to help you hold on to what matters most.
        </p>

        <!-- CTA Buttons -->
        <div class="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
          <a 
            href="/signup" 
            class="group w-full sm:w-auto bg-gradient-to-r from-teal-500 to-teal-600 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:from-teal-600 hover:to-teal-700 hover:shadow-2xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 flex items-center justify-center shadow-lg"
          >
            Start Your Journey Today
            <svg class="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </a>
          
          <a 
            href="/login" 
            class="w-full sm:w-auto bg-white text-charcoal-700 px-8 py-4 rounded-xl text-lg font-semibold border-2 border-charcoal-200 hover:border-teal-500 hover:text-teal-600 transition-all duration-300 shadow-sm hover:shadow-md"
          >
            Already have an account? Sign In
          </a>
        </div>

        <p class="text-sm text-charcoal-400">
          No credit card required • Free to explore • HIPAA-compliant security
        </p>
      </div>
    </div>
  </section>

  <!-- Features Section -->
  <section id="features" class="py-20 px-4 sm:px-6 lg:px-8 bg-white/60 backdrop-blur-sm">
    <div class="max-w-7xl mx-auto">
      <div class="text-center mb-16">
        <h2 class="text-4xl md:text-5xl font-bold mb-4 text-charcoal-800">
          Powerful Features for Memory Care
        </h2>
        <p class="text-xl text-charcoal-600 max-w-2xl mx-auto">
          Designed with compassion and powered by cutting-edge AI technology
        </p>
      </div>

      <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
        {#each features as feature}
          <div class="bg-white p-6 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-cream-200">
            <div class="bg-gradient-to-br from-teal-100 to-teal-50 w-14 h-14 rounded-xl flex items-center justify-center mb-4">
              {#if feature.icon === 'brain'}
                <svg class="w-7 h-7 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              {:else if feature.icon === 'heart'}
                <svg class="w-7 h-7 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              {:else if feature.icon === 'users'}
                <svg class="w-7 h-7 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              {:else if feature.icon === 'shield'}
                <svg class="w-7 h-7 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              {/if}
            </div>
            <h3 class="text-xl font-bold mb-2 text-charcoal-800">{feature.title}</h3>
            <p class="text-charcoal-600">{feature.description}</p>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <!-- Who It's For Section -->
  <section id="who-its-for" class="py-20 px-4 sm:px-6 lg:px-8">
    <div class="max-w-7xl mx-auto">
      <div class="text-center mb-16">
        <h2 class="text-4xl md:text-5xl font-bold mb-4 text-charcoal-800">
          Who Memory Lane Serves
        </h2>
        <p class="text-xl text-charcoal-600 max-w-2xl mx-auto">
          Supporting patients, families, and healthcare professionals in the journey of memory care
        </p>
      </div>

      <div class="grid md:grid-cols-3 gap-8">
        {#each audiences as audience}
          <div class="bg-white p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 border border-cream-200">
            <h3 class="text-2xl font-bold mb-4 text-charcoal-800">{audience.title}</h3>
            <p class="text-charcoal-600 mb-6">{audience.description}</p>
            <ul class="space-y-3">
              {#each audience.benefits as benefit}
                <li class="flex items-start">
                  <div class="bg-teal-100 rounded-full p-1 mr-3 mt-1">
                    <div class="w-2 h-2 bg-teal-600 rounded-full"></div>
                  </div>
                  <span class="text-charcoal-700">{benefit}</span>
                </li>
              {/each}
            </ul>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <!-- Final CTA Section -->
  <section class="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-teal-500 to-teal-600">
    <div class="max-w-4xl mx-auto text-center">
      <h2 class="text-4xl md:text-5xl font-bold mb-6 text-white">
        Ready to Preserve What Matters Most?
      </h2>
      <p class="text-xl text-teal-100 mb-8">
        Join thousands of families and healthcare professionals using Memory Lane to support memory recovery and cognitive wellness.
      </p>
      
      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <a 
          href="/signup" 
          class="group bg-white text-teal-600 px-8 py-4 rounded-xl text-lg font-semibold hover:shadow-2xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center"
        >
          Create Your Free Account
          <svg class="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </a>
        
        <a 
          href="/login" 
          class="bg-transparent text-white px-8 py-4 rounded-xl text-lg font-semibold border-2 border-white hover:bg-white hover:text-teal-600 transition-all duration-300"
        >
          Sign In
        </a>
      </div>
    </div>
  </section>

  <!-- Footer -->
  <footer class="bg-charcoal-800 text-charcoal-300 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-7xl mx-auto text-center">
      <div class="flex items-center justify-center space-x-2 mb-4">
        <img src="/logo.png" alt="" class="h-6 w-auto opacity-80" />
        <span class="text-xl font-bold text-white">Memory Lane</span>
      </div>
      <p class="mb-4">Empowering memory care through AI and compassion</p>
      <p class="text-sm text-charcoal-400">© 2025 Memory Lane. HIPAA-compliant and secure.</p>
    </div>
  </footer>
</div>
