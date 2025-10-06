<!-- src/routes/dashboard/+page.svelte -->
<script>
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import {
    isAuthenticated,
    verifyAuth,
    logout,
    requireAuthForAction,
    apiCall,
    getUserRole
  } from '$lib/auth.js';

  let isAuth = $state(false);
  let user = $state(null);
  let userRole = $state(null);
  let authChecked = $state(false);

  // Load authentication once on page mount
  $effect(() => {
    if (browser && !authChecked) {
      (async () => {
        isAuth = isAuthenticated();
        if (isAuth) {
          user = await verifyAuth();
          if (user) {
            userRole = user.role ?? getUserRole();

            // If still empty, fetch from API
            if (!userRole) {
              try {
                const response = await apiCall('/api/auth/me', { method: 'GET' });
                if (response.ok) {
                  const data = await response.json();
                  const resolved = data.user || data.patient || data;
                  localStorage.setItem('userData', JSON.stringify(resolved));
                  userRole = resolved?.role || 'caretaker';
                }
              } catch {
                userRole = 'caretaker'; // fallback
              }
            }
          } else {
            isAuth = false;
            userRole = null;
          }
        }
        authChecked = true;
      })();
    }
  });

  const navigationItems = [
    {
      id: 'chatbot',
      title: 'Chat with Replicas',
      description: 'Talk with AI replicas or the Memory Lane AI.',
      route: '/chat-replicas',
      requiresAuth: false
    },
    {
      id: 'gallery',
      title: 'Gallery',
      description: 'View and manage your photos & albums.',
      route: '/gallery',
      requiresAuth: true
    },
    {
      id: 'create-replica',
      title: 'Create Replica',
      description: 'Build AI replicas with your own data.',
      route: '/create-replicas',
      requiresAuth: true,
      caretakerOnly: true
    },
    {
      id: 'manage-patients',
      title: 'Manage Patients',
      description: 'Add patients and grant access.',
      route: '/manage-patients',
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
  <meta name="description" content="Dashboard for managing AI replicas and memory support." />
</svelte:head>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
  <!-- Header -->
  <header class="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
    <div class="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
      <div class="flex items-center space-x-3">
        <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" stroke="white" fill="none" stroke-width="2" viewBox="0 0 24 24">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 12l10 5 10-5"/>
            <path d="M2 17l10 5 10-5"/>
          </svg>
        </div>
        <div>
          <h1 class="text-xl font-bold text-gray-900 dark:text-white">Memory Lane</h1>
          <p class="text-sm text-gray-600 dark:text-gray-400">AI Replica Platform</p>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <ThemeToggle />
        {#if authChecked}
          {#if isAuth && user}
            <div class="flex items-center gap-3">
              <span class="text-sm text-gray-600 dark:text-gray-400">
                Welcome, {user.firstName || user.email}!
              </span>
              <button onclick={logout}
                class="text-sm px-3 py-1 rounded-md bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-700 dark:text-red-300">
                Logout
              </button>
            </div>
          {:else}
            <div class="flex gap-2">
              <a href="/login" class="btn-secondary">Login</a>
              <a href="/signup" class="btn-primary">Sign Up</a>
            </div>
          {/if}
        {:else}
          <span class="text-sm text-gray-500 dark:text-gray-400">Loading...</span>
        {/if}
      </div>
    </div>
  </header>

  <!-- Main -->
  <main class="max-w-6xl mx-auto px-4 py-12">
    <div class="text-center mb-12">
      <h2 class="text-4xl font-bold text-gray-900 dark:text-white mb-4">
        {isAuth ? 'Welcome back to Memory Lane' : 'Welcome to Memory Lane'}
      </h2>
      <p class="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
        {isAuth
          ? 'Create, train, and interact with AI replicas. Organize your memories and assistants.'
          : 'Explore AI replicas and chat with Memory Lane AI. Sign up to create your own assistants.'}
      </p>
    </div>

    {#if authChecked}
      <div class="grid gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {#each navigationItems.filter(item => {
          if (!item.caretakerOnly) return true;
          return isAuth && userRole === 'caretaker';
        }) as item}
          <button onclick={() => navigateTo(item.route, item.requiresAuth)}
            class="group relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl p-6 transition">
            <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-3">
              {item.title}
            </h3>
            <p class="text-gray-600 dark:text-gray-400 mb-4">{item.description}</p>
            <span class="text-sm text-blue-600 dark:text-blue-400 font-medium group-hover:underline">
              {item.requiresAuth && !isAuth ? 'Login to Access' : 'Open →'}
            </span>
          </button>
        {/each}
      </div>
    {:else}
      <div class="text-center py-12">
        <div class="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p class="text-gray-600 dark:text-gray-400">Loading dashboard...</p>
      </div>
    {/if}
  </main>
</div>
