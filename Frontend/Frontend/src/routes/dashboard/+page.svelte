<!-- src/routes/dashboard/+page.svelte -->
<script>
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';

  import { isAuthenticated, verifyAuth, logout, requireAuthForAction, apiCall, getUserRole } from '$lib/auth.js';

  let isAuth = $state(false);
  let user = $state(null);
  let userRole = $state(null);
  let authChecked = $state(false);

  // Check authentication status only once when page loads
  $effect(() => {
    if (browser && !authChecked) {
      const checkAuth = async () => {
        isAuth = isAuthenticated();
        if (isAuth) {
          user = await verifyAuth();
          if (!user) {
            // Token is invalid, clear it
            isAuth = false;
          } else {
            // Load user role - first try from cached user data
            if (user && user.role) {
              userRole = user.role;
              console.log('Dashboard: userRole from cached user:', userRole);
            } else {
              // Try cached role first (fast, resilient to temporary API errors)
              try {
                const cached = getUserRole();
                if (cached) {
                  userRole = cached;
                  console.log('Dashboard: userRole from cache fallback:', userRole);
                } else {
                  // Fallback to API call when cache is empty
                  try {
                    const response = await apiCall('/api/auth/me', { method: 'GET' });
                    if (response.ok) {
                      const data = await response.json();
                      const resolved = data.user || data.patient || data;
                      // persist normalized userData shape for other components
                      try { localStorage.setItem('userData', JSON.stringify(resolved)); } catch (e) {}
                      userRole = resolved?.role || 'caretaker';
                      console.log('Dashboard: userRole from API:', userRole);
                    }
                  } catch (error) {
                    console.error('Failed to load user role:', error);
                    userRole = 'caretaker'; // Default to caretaker
                  }
                }
              } catch (err) {
                console.error('Failed to read cached role:', err);
                userRole = 'caretaker';
              }
            }
          }
        } else {
          // Not authenticated
          userRole = null;
        }
        authChecked = true;
      };
      checkAuth();
    }
  });

  // Helper: mask email for debug display (e.g. j*****@domain.com)
  function maskEmailForDisplay(email) {
    if (!email || typeof email !== 'string') return 'null';
    const parts = email.split('@');
    if (parts.length !== 2) return email;
    const local = parts[0];
    const domain = parts[1];
    if (!local) return email;
    const first = local.charAt(0);
    // show up to first+last letter if short local part
    const last = local.length > 1 ? local.charAt(local.length - 1) : '';
    const maskedMiddle = local.length > 2 ? '*'.repeat(Math.max(3, local.length - 2)) : '*';
    return `${first}${maskedMiddle}${last}@${domain}`;
  }

  const navigationItems = [
    {
      id: 'chatbot',
      title: 'Chat with Replicas',
      description: 'Start conversations with AI replicas or chat with the generic Memory Lane AI',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
      </svg>`,
      route: '/chat-replicas',
      color: 'bg-blue-500 hover:bg-blue-600',
      textColor: 'text-blue-600',
      requiresAuth: false
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
      textColor: 'text-green-600',
      requiresAuth: true
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
      route: '/create-replicas',
      color: 'bg-purple-500 hover:bg-purple-600',
      textColor: 'text-purple-600',
      requiresAuth: true,
      caretakerOnly: true
    },
    {
      id: 'manage-patients',
      title: 'Manage Patients',
      description: 'Add patient email addresses and grant access to specific replicas',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <line x1="17" x2="22" y1="8" y2="13"/>
        <line x1="22" x2="17" y1="8" y2="13"/>
      </svg>`,
      route: '/manage-patients',
      color: 'bg-orange-500 hover:bg-orange-600',
      textColor: 'text-orange-600',
      requiresAuth: true,
      caretakerOnly: true
    }
  ];

  function navigateTo(route, requiresAuth) {
    if (requiresAuth && !isAuth) {
      requireAuthForAction(route);
    } else {
      goto(route);
    }
  }
</script>

<svelte:head>
  <title>Dashboard - Memory Lane</title>
  <meta name="description" content="Dashboard for managing AI replicas: track memory recovery, assist dementia patients, help amnesia recovery, and support caretakers and neurologists with memory-focused care." />
  <meta name="keywords" content="AI dashboard, memory management, dementia tracking, amnesia recovery dashboard, caretakers AI tool, neurologist patient support" />
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
              <h1 class="text-xl font-bold text-gray-900 dark:text-white">Memory Lane</h1>
              <p class="text-sm text-gray-600 dark:text-gray-400">AI Replica Platform</p>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <!-- ABOUT & FEEDBACK links added here (right-side, before auth controls) -->
          <ThemeToggle />
          <a href="/about" class="text-sm text-gray-700 dark:text-gray-300 hover:underline">About</a>
          <a href="/feedback" class="text-sm text-gray-700 dark:text-gray-300 hover:underline">Feedback</a>

          {#if authChecked}
            {#if isAuth && user}
              <div class="flex items-center gap-3">
                <span class="text-sm text-gray-600 dark:text-gray-400">
                  Welcome, {user.firstName || user.email}!
                </span>
                <button
                  onclick={logout}
                  class="text-sm bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-700 dark:text-red-300 px-3 py-1 rounded-md transition-colors"
                >
                  Logout
                </button>
              </div>
            {:else}
              <div class="flex items-center gap-2">
                <a
                  href="/login"
                  class="text-sm bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-md transition-colors"
                >
                  Login
                </a>
                <a
                  href="/signup"
                  class="text-sm bg-green-100 hover:bg-green-200 dark:bg-green-900 dark:hover:bg-green-800 text-green-700 dark:text-green-300 px-3 py-1 rounded-md transition-colors"
                >
                  Sign Up
                </a>
              </div>
            {/if}
          {:else}
            <div class="text-sm text-gray-500 dark:text-gray-400">Loading...</div>
          {/if}
        </div>
      </div>
    </div>
  </header>

  <!-- Main Content -->
  <main class="max-w-6xl mx-auto px-4 py-6 md:py-8 lg:py-12">
    <!-- Welcome Section -->
    <div class="text-center mb-12">
      <h2 class="text-4xl font-bold text-gray-900 dark:text-white mb-4">
  {#if isAuth}
          Welcome back to Memory Lane
        {:else}
          Welcome to Memory Lane
        {/if}
      </h2>
      <p class="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
  {#if isAuth}
          Create, train, and interact with AI replicas. Manage your conversations, organize your memories, and build personalized AI assistants.
        {:else}
          Explore AI replicas and chat with Memory Lane AI. Sign up to create your own personalized AI assistants and manage your memories.
        {/if}
      </p>
  {#if !isAuth}
        <div class="mt-6">
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Currently exploring in demo mode
          </p>
          <div class="flex justify-center gap-3">
            <a
              href="/login"
              class="px-4 py-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
            >
              Login to your account
            </a>
            <a
              href="/signup"
              class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Create free account
            </a>
          </div>
        </div>
      {/if}
    </div>

    <!-- Debug Info REMOVED -->

    <!-- Navigation Cards -->
    {#if authChecked}
      <div class="{userRole === 'patient' ? 'grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto justify-items-center' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8'}">
        {#each navigationItems.filter(item => {
          // Show item if not caretaker-only
          if (!item.caretakerOnly) return true;
          // Show caretaker-only items only for authenticated caretakers (not patients)
          return isAuth && userRole === 'caretaker';
        }) as item (item.id)}
        <button
          onclick={() => navigateTo(item.route, item.requiresAuth)}
          class="group relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-200 dark:border-gray-700 hover:border-transparent focus:outline-none focus:ring-4 focus:ring-blue-500/20 {item.requiresAuth && !isAuth ? 'opacity-75' : ''}"
        >
          <!-- Auth requirement badge -->
          {#if item.requiresAuth && !isAuth}
            <div class="absolute top-3 right-3 z-10">
              <div class="flex items-center px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded-md">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-yellow-600 dark:text-yellow-400 mr-1">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <span class="text-xs text-yellow-700 dark:text-yellow-300 font-medium">Login Required</span>
              </div>
            </div>
          {/if}

          <!-- Gradient overlay -->
          <div class="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-gray-50 dark:to-gray-700/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          
          <!-- Content -->
          <div class="relative p-8">
            <!-- Icon -->
            <div class="w-16 h-16 mx-auto mb-6 {item.textColor} group-hover:scale-110 transition-transform duration-300">
              <!-- Safe icon rendering - SVG icons are now inline components -->
              {#if item.id === 'chatbot'}
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                </svg>
              {:else if item.id === 'gallery'}
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                  <circle cx="9" cy="9" r="2"/>
                  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                </svg>
              {:else if item.id === 'create-replica'}
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              {:else if item.id === 'manage-patients'}
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <line x1="17" x2="22" y1="8" y2="13"/>
                  <line x1="22" x2="17" y1="8" y2="13"/>
                </svg>
              {/if}
            </div>
            
            <!-- Title -->
            <h3 class="text-2xl font-bold text-gray-900 dark:text-white mb-4 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-purple-600 group-hover:bg-clip-text transition-all duration-300">
              {item.title}
            </h3>
            
            <!-- Description -->
            <p class="text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
              {item.description}
              {#if item.requiresAuth && !isAuth}
                <span class="block mt-2 text-sm text-yellow-600 dark:text-yellow-400">
                  Sign up or login to access this feature
                </span>
              {/if}
            </p>
            
            <!-- Action Button -->
            <div class="inline-flex items-center justify-center px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg group-hover:bg-gradient-to-r group-hover:from-blue-500 group-hover:to-purple-600 group-hover:text-white transition-all duration-300">
              <span class="font-medium mr-2">
                {#if item.requiresAuth && !isAuth}
                  Login to Access
                {:else}
                  Open {item.title}
                {/if}
              </span>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="group-hover:translate-x-1 transition-transform duration-300">
                <path d="M5 12h14"/>
                <path d="M12 5l7 7-7 7"/>
              </svg>
            </div>
          </div>
        </button>
      {/each}
      </div>
    {:else}
      <!-- Loading state -->
      <div class="text-center py-12">
        <div class="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p class="text-gray-600 dark:text-gray-400">Loading dashboard...</p>
      </div>
    {/if}

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
