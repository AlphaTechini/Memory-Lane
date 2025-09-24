<script>
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  
  let { 
    showBack = true, 
    showHome = true, 
    customBackAction = null,
    title = null,
    subtitle = null 
  } = $props();
  
  function goBack() {
    if (customBackAction) {
      customBackAction();
    } else {
      // Use browser history if available, otherwise navigate to dashboard
      if (window.history.length > 1) {
        window.history.back();
      } else {
        goto('/dashboard');
      }
    }
  }
  
  function goHome() {
    goto('/dashboard');
  }
</script>

<div class="flex items-center justify-between bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 mb-6">
  <div class="flex items-center gap-4">
    {#if showBack}
      <button
        onclick={goBack}
        class="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors group"
        title="Go back"
        aria-label="Go back"
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
          class="text-gray-600 dark:text-gray-300 group-hover:text-gray-800 dark:group-hover:text-gray-100 transition-colors"
        >
          <path d="m15 18-6-6 6-6"/>
        </svg>
      </button>
    {/if}
    
    {#if title}
      <div class="flex flex-col">
        <h1 class="text-lg font-semibold text-gray-900 dark:text-white">
          {title}
        </h1>
        {#if subtitle}
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {subtitle}
          </p>
        {/if}
      </div>
    {/if}
  </div>
  
  {#if showHome}
    <button
      onclick={goHome}
      class="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors group"
      title="Go to dashboard"
      aria-label="Go to dashboard"
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
  {/if}
</div>