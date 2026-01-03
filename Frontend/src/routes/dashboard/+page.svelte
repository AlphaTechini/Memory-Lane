<!-- src/routes/dashboard/+page.svelte -->
<script>
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';

  import { isAuthenticated, verifyAuth, logout, requireAuthForAction, apiCall, getUserRole } from '$lib/auth.js';

  let isAuth = $state(false);
  let user = $state(null);
  let userRole = $state(null);
  let authChecked = $state(false);

  $effect(() => {
    if (browser && !authChecked) {
      const checkAuth = async () => {
        isAuth = isAuthenticated();
        if (isAuth) {
          user = await verifyAuth();
          if (!user) {
            isAuth = false;
          } else {
            if (user && user.role) {
              userRole = user.role;
            } else {
              try {
                const cached = getUserRole();
                if (cached) {
                  userRole = cached;
                } else {
                  try {
                    const response = await apiCall('/api/auth/me', { method: 'GET' });
                    if (response.ok) {
                      const data = await response.json();
                      const resolved = data.user || data.patient || data;
                      try { localStorage.setItem('userData', JSON.stringify(resolved)); } catch (e) {}
                      userRole = resolved?.role || 'caretaker';
                    }
                  } catch (error) {
                    console.error('Failed to load user role:', error);
                    userRole = 'caretaker';
                  }
                }
              } catch (err) {
                console.error('Failed to read cached role:', err);
                userRole = 'caretaker';
              }
            }
          }
        } else {
          userRole = null;
        }
        authChecked = true;
      };
      checkAuth();
    }
  });

  const navigationItems = [
    {
      id: 'chatbot',
      title: 'Chat',
      description: 'Start conversations with AI replicas or chat with Memory Lane AI',
      route: '/chat-replicas',
      iconColor: 'text-teal-600',
      requiresAuth: false
    },
    {
      id: 'gallery',
      title: 'Photos',
      description: 'View and manage your photo collection and create memory albums',
      route: '/gallery',
      iconColor: 'text-teal-600',
      requiresAuth: true
    },
    {
      id: 'create-replica',
      title: 'Create Replica',
      description: 'Build AI replicas by providing training data and configuration',
      route: '/create-replicas',
      iconColor: 'text-teal-600',
      requiresAuth: true,
      caretakerOnly: true
    },
    {
      id: 'manage-patients',
      title: 'Manage Patients',
      description: 'Add patient email addresses and grant access to specific replicas',
      route: '/manage-patients',
      iconColor: 'text-teal-600',
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
  <title>Home - Memory Lane</title>
  <meta name="description" content="Dashboard for managing AI replicas: track memory recovery, assist dementia patients, help amnesia recovery, and support caretakers and neurologists with memory-focused care." />
</svelte:head>

<div class="min-h-screen bg-cream-50 dark:bg-charcoal-900">
  <!-- Main Content -->
  <main class="max-w-5xl mx-auto px-4 py-8 md:py-12">
    <!-- Welcome Section -->
    <div class="text-center mb-12">
      <h1 class="text-accessible-3xl font-bold text-charcoal-800 dark:text-cream-100 mb-4">
        {#if isAuth}
          Welcome back to Memory Lane
        {:else}
          Welcome to Memory Lane
        {/if}
      </h1>
      <p class="text-accessible-lg text-charcoal-600 dark:text-cream-300 max-w-2xl mx-auto">
        {#if isAuth}
          Create, train, and interact with AI replicas. Manage your conversations, organize your memories, and build personalized AI assistants.
        {:else}
          Explore AI replicas and chat with Memory Lane AI. Sign up to create your own personalized AI assistants and manage your memories.
        {/if}
      </p>
      {#if !isAuth}
        <div class="mt-8 flex flex-col sm:flex-row justify-center gap-4">
          <a href="/login" class="btn-tactile btn-tactile-secondary">
            Log In
          </a>
          <a href="/signup" class="btn-tactile btn-tactile-primary">
            Create Free Account
          </a>
        </div>
      {/if}
    </div>

    <!-- Navigation Cards - Large, tactile buttons -->
    {#if authChecked}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {#each navigationItems.filter(item => {
          if (!item.caretakerOnly) return true;
          return isAuth && userRole === 'caretaker';
        }) as item (item.id)}
          <button
            onclick={() => navigateTo(item.route, item.requiresAuth)}
            class="card-accessible card-accessible-interactive text-left p-6 flex flex-col gap-4 min-h-[180px] {item.requiresAuth && !isAuth ? 'opacity-80' : ''}"
          >
            <!-- Icon -->
            <div class="w-16 h-16 flex items-center justify-center rounded-tactile bg-teal-500/10 {item.iconColor}">
              {#if item.id === 'chatbot'}
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                </svg>
              {:else if item.id === 'gallery'}
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                  <circle cx="9" cy="9" r="2"/>
                  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                </svg>
              {:else if item.id === 'create-replica'}
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="16"/>
                  <line x1="8" y1="12" x2="16" y2="12"/>
                </svg>
              {:else if item.id === 'manage-patients'}
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              {/if}
            </div>
            
            <!-- Title -->
            <h2 class="text-accessible-xl font-bold text-charcoal-800 dark:text-cream-100">
              {item.title}
            </h2>
            
            <!-- Description -->
            <p class="text-accessible-base text-charcoal-600 dark:text-cream-300 flex-1">
              {item.description}
            </p>
            
            <!-- Auth badge if needed -->
            {#if item.requiresAuth && !isAuth}
              <div class="flex items-center gap-2 text-coral-600 dark:text-coral-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <span class="text-accessible-sm font-medium">Login required</span>
              </div>
            {/if}
          </button>
        {/each}
      </div>
    {:else}
      <!-- Loading state -->
      <div class="text-center py-12">
        <div class="animate-spin w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p class="text-accessible-base text-charcoal-600 dark:text-cream-300">Loading...</p>
      </div>
    {/if}

    <!-- Features Section -->
    <div class="mt-16">
      <h2 class="text-accessible-2xl font-bold text-center text-charcoal-800 dark:text-cream-100 mb-10">
        Platform Features
      </h2>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div class="text-center card-accessible p-6">
          <div class="w-14 h-14 mx-auto mb-4 flex items-center justify-center rounded-full bg-teal-500/10 text-teal-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <h3 class="text-accessible-lg font-semibold text-charcoal-800 dark:text-cream-100 mb-2">AI-Powered</h3>
          <p class="text-accessible-base text-charcoal-600 dark:text-cream-300">Advanced artificial intelligence that learns and adapts to your needs</p>
        </div>
        
        <div class="text-center card-accessible p-6">
          <div class="w-14 h-14 mx-auto mb-4 flex items-center justify-center rounded-full bg-teal-500/10 text-teal-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <h3 class="text-accessible-lg font-semibold text-charcoal-800 dark:text-cream-100 mb-2">Secure & Private</h3>
          <p class="text-accessible-base text-charcoal-600 dark:text-cream-300">Your data is protected with enterprise-grade security measures</p>
        </div>
        
        <div class="text-center card-accessible p-6">
          <div class="w-14 h-14 mx-auto mb-4 flex items-center justify-center rounded-full bg-teal-500/10 text-teal-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <h3 class="text-accessible-lg font-semibold text-charcoal-800 dark:text-cream-100 mb-2">Personalized</h3>
          <p class="text-accessible-base text-charcoal-600 dark:text-cream-300">Create custom AI replicas tailored to your specific requirements</p>
        </div>
      </div>
    </div>
  </main>
</div>
