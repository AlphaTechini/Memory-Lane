<script>
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { checkAuthStatus, apiCall } from '$lib/auth.js';
  import ThemeToggle from './ThemeToggle.svelte';
  
  let currentPath = $state('');
  let isAuthenticated = $state(false);
  let userRole = $state(null);
  let showMobileMenu = $state(false);
  
  $effect(() => {
    currentPath = $page.url.pathname;
    isAuthenticated = checkAuthStatus();
    loadUserRole();
    showMobileMenu = false; // Close mobile menu on navigation
  });
  
  async function loadUserRole() {
    if (!isAuthenticated) {
      userRole = null;
      return;
    }
    
    try {
      const response = await apiCall('/api/auth/me', { method: 'GET' });
      if (response.ok) {
        const userData = await response.json();
        userRole = userData.user?.role || 'caretaker';
      }
    } catch (error) {
      console.error('Failed to load user role:', error);
      userRole = 'caretaker'; // Default to caretaker
    }
  }

  function logout() {
    localStorage.removeItem('authToken');
    goto('/login');
  }
</script>

<nav class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
  <div class="max-w-6xl mx-auto flex items-center justify-between">
    <div class="flex items-center gap-4 lg:gap-8">
      <div class="flex items-center gap-2 lg:gap-4">
        {#if typeof window !== 'undefined' && window.history.length > 1 && currentPath !== '/dashboard'}
          <button
            onclick={() => window.history.back()}
            class="flex items-center justify-center w-8 h-8 lg:w-10 lg:h-10 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors mr-1 lg:mr-2"
            title="Go back"
            aria-label="Go back"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lg:w-5 lg:h-5 text-gray-700 dark:text-gray-200">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
        {/if}

        <h1 class="text-lg lg:text-xl font-bold text-gray-900 dark:text-gray-100">Memory Lane</h1>
      </div>
      
      <div class="hidden md:flex items-center gap-2 lg:gap-4">
        <button
          onclick={() => goto('/dashboard')}
          class="px-3 py-2 text-sm font-medium rounded-md transition-colors
            {currentPath === '/dashboard'
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
              : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'}"
        >
          Dashboard
        </button>
        
        <button
          onclick={() => goto('/chat-replicas')}
          class="px-3 py-2 text-sm font-medium rounded-md transition-colors
            {currentPath === '/chat-replicas' || currentPath === '/' 
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
              : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'}"
        >
          Chat
        </button>
        
        {#if userRole !== 'patient'}
          <button
            onclick={() => goto('/create-replicas')}
            class="px-3 py-2 text-sm font-medium rounded-md transition-colors relative
              {currentPath.startsWith('/create-replicas') 
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
                : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'}"
          >
            Create Replica
            {#if !isAuthenticated}
              <span class="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full"></span>
            {/if}
          </button>
          
          <button
            onclick={() => goto('/manage-patients')}
            class="px-3 py-2 text-sm font-medium rounded-md transition-colors relative
              {currentPath.startsWith('/manage-patients') 
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
                : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'}"
          >
            Manage Patients
            {#if !isAuthenticated}
              <span class="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full"></span>
            {/if}
          </button>
        {/if}
        
        
        <button
          onclick={() => goto('/gallery')}
          class="px-3 py-2 text-sm font-medium rounded-md transition-colors relative
            {currentPath.startsWith('/gallery') 
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
              : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'}"
        >
          Gallery
          {#if !isAuthenticated}
            <span class="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full"></span>
          {/if}
        </button>
      </div>
    </div>
    
    <div class="flex items-center gap-2 lg:gap-4">
      <!-- Theme Toggle -->
      <ThemeToggle />
      
      <!-- Mobile menu button -->
      <button
        onclick={() => showMobileMenu = !showMobileMenu}
        class="md:hidden flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        aria-label="Toggle menu"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-700 dark:text-gray-200">
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
      </button>
      
      {#if isAuthenticated}
        <button
          onclick={logout}
          class="hidden md:block px-3 lg:px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 transition-colors"
        >
          Logout
        </button>
      {:else}
        <div class="hidden md:flex items-center gap-2">
          <button
            onclick={() => goto('/login')}
            class="px-3 lg:px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            Log In
          </button>
          <button
            onclick={() => goto('/signup')}
            class="px-3 lg:px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
          >
            Sign Up
          </button>
        </div>
      {/if}
    </div>
  </div>
  
  <!-- Mobile menu -->
  {#if showMobileMenu}
    <div class="md:hidden bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-3">
      <div class="flex flex-col gap-2">
        <button
          onclick={() => { goto('/dashboard'); showMobileMenu = false; }}
          class="w-full text-left px-3 py-2 text-sm font-medium rounded-md transition-colors
            {currentPath === '/dashboard'
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
              : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'}"
        >
          Dashboard
        </button>
        
        <button
          onclick={() => { goto('/chat-replicas'); showMobileMenu = false; }}
          class="w-full text-left px-3 py-2 text-sm font-medium rounded-md transition-colors
            {currentPath === '/chat-replicas' || currentPath === '/' 
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
              : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'}"
        >
          Chat
        </button>
        
        {#if userRole !== 'patient'}
          <button
            onclick={() => { goto('/create-replicas'); showMobileMenu = false; }}
            class="w-full text-left px-3 py-2 text-sm font-medium rounded-md transition-colors
              {currentPath.startsWith('/create-replicas') 
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
                : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'}"
          >
            Create Replica
          </button>
          
          <button
            onclick={() => { goto('/manage-patients'); showMobileMenu = false; }}
            class="w-full text-left px-3 py-2 text-sm font-medium rounded-md transition-colors
              {currentPath.startsWith('/manage-patients') 
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
                : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'}"
          >
            Manage Patients
          </button>
        {/if}
        
        <button
          onclick={() => { goto('/gallery'); showMobileMenu = false; }}
          class="w-full text-left px-3 py-2 text-sm font-medium rounded-md transition-colors
            {currentPath.startsWith('/gallery') 
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
              : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'}"
        >
          Gallery
        </button>
        
        <hr class="my-2 border-gray-200 dark:border-gray-700">
        
        {#if isAuthenticated}
          <button
            onclick={() => { logout(); showMobileMenu = false; }}
            class="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
          >
            Logout
          </button>
        {:else}
          <button
            onclick={() => { goto('/login'); showMobileMenu = false; }}
            class="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 rounded-md transition-colors"
          >
            Log In
          </button>
          <button
            onclick={() => { goto('/signup'); showMobileMenu = false; }}
            class="w-full text-left px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Sign Up
          </button>
        {/if}
      </div>
    </div>
  {/if}
</nav>
