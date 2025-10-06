<script>
  // Original imports kept for context, though sign-in logic is now blocked.
  import { goto } from '$app/navigation';
  import { apiUrl } from '$lib/utils/api.js';
  import { initFirebaseClient } from '$lib/firebase';

  let { mode = 'signin', disabled = false } = $props();
  let loading = $state(false);
  let error = $state(null);
  
  // 🆕 New state variable to control the message visibility on click
  let messageVisible = $state(false);

  // 🆕 Modified handler to show the message instead of signing in
  async function handleGoogleSignIn() {
    // Prevent the original sign-in logic from running
    if (disabled || loading) return; 

    // 1. Show the message
    messageVisible = true;
    
    // 2. Clear the message after a short delay (e.g., 3 seconds)
    setTimeout(() => {
      messageVisible = false;
    }, 3000); 
    
    // The original sign-in logic is blocked, but if it were to run, 
    // it would be below this. We leave the function body minimal 
    // to just handle the message display.
  }
</script>

<div class="space-y-2">
  <button
    on:click={handleGoogleSignIn}
    disabled={loading || disabled}
    class="w-full flex items-center justify-center gap-3 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {#if loading}
      <svg class="animate-spin h-5 w-5 text-gray-600 dark:text-gray-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span class="text-gray-700 dark:text-gray-300">Signing in...</span>
    {:else}
      <svg width="20" height="20" viewBox="0 0 533.5 544.3" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M533.5 278.4c0-18.3-1.6-36-4.7-53.1H272v100.5h146.9c-6.3 34.1-25.1 62.9-53.4 82.1v68.1h86.3c51.5-47.5 81.7-117.6 81.7-197.6z" fill="#4285f4"/>
        <path d="M272 544.3c72.9 0 134.1-24.1 178.8-65.4l-86.3-68.1c-23.9 16-54.5 25.5-92.5 25.5-70.9 0-131-47.8-152.4-112.2H30.9v70.6C75.1 488.6 168 544.3 272 544.3z" fill="#34a853"/>
        <path d="M119.6 328.1c-10.8-32.4-10.8-67.4 0-99.8V157.7H30.9c-39.6 79.5-39.6 173.8 0 253.3l88.7-82.9z" fill="#fbbc04"/>
        <path d="M272 107.7c39.6 0 75.3 13.6 103.4 40.5l77.5-77.5C412.1 23.1 344.9 0 272 0 168 0 75.1 55.7 30.9 157.7l88.7 70.6C141 155.5 201.1 107.7 272 107.7z" fill="#ea4335"/>
      </svg>
      <span class="text-gray-700 dark:text-gray-300">Sign in with Google</span>
    {/if}
  </button>

  <div class="relative">
    <div 
      class="absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1 text-sm text-white bg-blue-600 rounded-lg whitespace-nowrap transition-opacity duration-300 pointer-events-none 
      ${messageVisible ? 'opacity-100' : 'opacity-0'}"
    >
      Feature not available yet
      <div class="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-4 border-t-blue-600"></div>
    </div>
  </div>


  {#if error}
    <p class="text-sm text-red-600 dark:text-red-400">{error}</p>
  {/if}
</div>
