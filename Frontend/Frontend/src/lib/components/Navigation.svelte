<script>
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  
  let currentPath = $state('');
  
  $effect(() => {
    currentPath = $page.url.pathname;
  });

  function logout() {
    localStorage.removeItem('authToken');
    goto('/login');
  }
</script>

<nav class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
  <div class="max-w-6xl mx-auto flex items-center justify-between">
    <div class="flex items-center gap-8">
      <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100">Sensay AI</h1>
      
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
          class="px-3 py-2 text-sm font-medium rounded-md transition-colors
            {currentPath.startsWith('/create-replicas') 
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
              : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'}"
        >
          Create Replica
        </button>
        
        <button
          onclick={() => goto('/gallery')}
          class="px-3 py-2 text-sm font-medium rounded-md transition-colors
            {currentPath.startsWith('/gallery') 
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
              : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'}"
        >
          Gallery
        </button>
      </div>
    </div>
    
    <div class="flex items-center gap-4">
      <button
        onclick={logout}
        class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 transition-colors"
      >
        Logout
      </button>
    </div>
  </div>
</nav>
