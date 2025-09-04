<!-- src/routes/dashboard/+page.svelte -->
<script>
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { protectRoute, logout } from '$lib/auth.js';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';

  // Protect this route
  $effect(() => {
    if (browser) {
      protectRoute();
    }
  });

  const navigationItems = [
    {
      id: 'chatbot',
      title: 'Chatbot',
      description: 'Start conversations with AI assistants and manage your chat history',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
      </svg>`,
      route: '/',
      color: 'bg-blue-500 hover:bg-blue-600',
      textColor: 'text-blue-600'
    },
    {
      id: 'gallery',
      title: 'Gallery',
      description: 'View and manage your photo collection and create memory albums',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
        <circle cx="9" cy="9" r="2"/>
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
      </svg>`,
      route: '/gallery',
      color: 'bg-green-500 hover:bg-green-600',
      textColor: 'text-green-600'
    },
    {
      id: 'create-replica',
      title: 'Create Replica',
      description: 'Build AI replicas by providing training data and configuration',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>`,
      route: '/create-replica',
      color: 'bg-purple-500 hover:bg-purple-600',
      textColor: 'text-purple-600'
    }
  ];

  function navigateTo(route) {
    goto(route);
  }
</script>

<svelte:head>
  <title>Dashboard - Sensay AI</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
  <!-- Header -->
  <header class="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
    <div class="max-w-6xl mx-auto px-4 py-4">
      <div class="flex justify-between items-center">
        <div class="flex items-center space-x-4">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div>
              <h1 class="text-xl font-bold text-gray-900 dark:text-white">Sensay AI</h1>
              <p class="text-sm text-gray-600 dark:text-gray-400">AI Replica Platform</p>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <ThemeToggle />
          <button
            onclick={logout}
            class="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  </header>

  <!-- Main Content -->
  <main class="max-w-6xl mx-auto px-4 py-12">
    <!-- Welcome Section -->
    <div class="text-center mb-12">
      <h2 class="text-4xl font-bold text-gray-900 dark:text-white mb-4">
        Welcome to Sensay AI
      </h2>
      <p class="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
        Create, train, and interact with AI replicas. Manage your conversations, organize your memories, and build personalized AI assistants.
      </p>
    </div>

    <!-- Navigation Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {#each navigationItems as item (item.id)}
        <button
          onclick={() => navigateTo(item.route)}
          class="group relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-200 dark:border-gray-700 hover:border-transparent focus:outline-none focus:ring-4 focus:ring-blue-500/20"
        >
          <!-- Gradient overlay -->
          <div class="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-gray-50 dark:to-gray-700/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          
          <!-- Content -->
          <div class="relative p-8">
            <!-- Icon -->
            <div class="w-16 h-16 mx-auto mb-6 {item.textColor} group-hover:scale-110 transition-transform duration-300">
              {@html item.icon}
            </div>
            
            <!-- Title -->
            <h3 class="text-2xl font-bold text-gray-900 dark:text-white mb-4 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-purple-600 group-hover:bg-clip-text transition-all duration-300">
              {item.title}
            </h3>
            
            <!-- Description -->
            <p class="text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
              {item.description}
            </p>
            
            <!-- Action Button -->
            <div class="inline-flex items-center justify-center px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg group-hover:bg-gradient-to-r group-hover:from-blue-500 group-hover:to-purple-600 group-hover:text-white transition-all duration-300">
              <span class="font-medium mr-2">Open {item.title}</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="group-hover:translate-x-1 transition-transform duration-300">
                <path d="M5 12h14"/>
                <path d="M12 5l7 7-7 7"/>
              </svg>
            </div>
          </div>
        </button>
      {/each}
    </div>

    <!-- Features Section -->
    <div class="mt-20">
      <h3 class="text-2xl font-bold text-center text-gray-900 dark:text-white mb-12">
        Platform Features
      </h3>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div class="text-center p-6">
          <div class="w-12 h-12 mx-auto mb-4 text-blue-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <h4 class="font-semibold text-gray-900 dark:text-white mb-2">AI-Powered</h4>
          <p class="text-gray-600 dark:text-gray-400">Advanced artificial intelligence that learns and adapts to your needs</p>
        </div>
        
        <div class="text-center p-6">
          <div class="w-12 h-12 mx-auto mb-4 text-green-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <h4 class="font-semibold text-gray-900 dark:text-white mb-2">Secure & Private</h4>
          <p class="text-gray-600 dark:text-gray-400">Your data is protected with enterprise-grade security measures</p>
        </div>
        
        <div class="text-center p-6">
          <div class="w-12 h-12 mx-auto mb-4 text-purple-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <h4 class="font-semibold text-gray-900 dark:text-white mb-2">Personalized</h4>
          <p class="text-gray-600 dark:text-gray-400">Create custom AI replicas tailored to your specific requirements</p>
        </div>
      </div>
    </div>
  </main>
</div>