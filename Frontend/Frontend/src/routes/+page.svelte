<!-- Main landing page - redirect to login first with option to explore -->
<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { checkAuthStatus } from '$lib/auth.js';

  let isAuthenticated = false;

  onMount(async () => {
    const authStatus = await checkAuthStatus();
    isAuthenticated = authStatus;
    
    // Redirect authenticated users to dashboard
    if (isAuthenticated) {
      goto('/dashboard');
    } else {
      // Non-authenticated users go to login page
      // They can choose to explore from there
      goto('/login');
    }
  });
</script>

<svelte:head>
  <title>Sensay AI - Welcome</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
  <div class="text-center">
    <div class="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
    <p class="text-gray-600 dark:text-gray-400">Loading Sensay AI...</p>
  </div>
</div>