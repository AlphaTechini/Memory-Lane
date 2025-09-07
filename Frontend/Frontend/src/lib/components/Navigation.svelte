<script>
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { checkAuthStatus } from '$lib/auth.js';
  
  let currentPath = $state('');
  let isAuthenticated = $state(false);
  
  $effect(() => {
    currentPath = $page.url.pathname;
    isAuthenticated = checkAuthStatus();
  });

  function logout() {
    localStorage.removeItem('authToken');
    goto('/login');
  }
</script>

<nav class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
  <div class="max-w-6xl mx-auto flex items-center justify-between">
    <div class="flex items-center gap-8">
      <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100">Memory Lane</h1>
      
      <div class="flex items-center gap-4">
        <button
          onclick={() => goto('/chat-replicas')}
          class="px-3 py-2 text-sm font-medium rounded-md transition-colors
            {currentPath === '/chat-replicas' || currentPath === '/' 
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
              : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'}"
        >
          Chat
        </button>
        
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
