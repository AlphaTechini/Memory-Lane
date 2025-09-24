<script>
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { checkAuthStatus, getAuthToken, apiCall } from '$lib/auth.js';
  
  let currentPath = $state('');
  let isAuthenticated = $state(false);
  let userRole = $state(null);
  
  $effect(() => {
    currentPath = $page.url.pathname;
    isAuthenticated = checkAuthStatus();
    loadUserRole();
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
    <div class="flex items-center gap-8">
      <div class="flex items-center gap-4">
        {#if typeof window !== 'undefined' && window.history.length > 1}
          <button
            onclick={() => window.history.back()}
            class="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors mr-2"
            title="Go back"
            aria-label="Go back"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-700 dark:text-gray-200">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
        {/if}

        <button
          onclick={() => goto('/dashboard')}
          class="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors group mr-2"
          title="Dashboard Home"
          aria-label="Dashboard Home"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="20" 
            height="20" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            stroke-width="2" 
            stroke-linecap="round" 
            stroke-linejoin="round"
            class="text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors"
          >
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9,22 9,12 15,12 15,22"/>
          </svg>
        </button>
        <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100">Memory Lane</h1>
      </div>
      
      <div class="flex items-center gap-4">
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
    
    <div class="flex items-center gap-4">
      {#if isAuthenticated}
        <button
          onclick={logout}
          class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 transition-colors"
        >
          Logout
        </button>
      {:else}
        <div class="flex items-center gap-2">
          <button
            onclick={() => goto('/login')}
            class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            Log In
          </button>
          <button
            onclick={() => goto('/signup')}
            class="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
          >
            Sign Up
          </button>
        </div>
      {/if}
    </div>
  </div>
</nav>
