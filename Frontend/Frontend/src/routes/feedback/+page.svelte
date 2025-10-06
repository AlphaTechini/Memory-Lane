<script>
  import { goto } from '$app/navigation';
  import { apiCall, checkAuthStatus, getAuthToken } from '$lib/auth.js';
  import { apiUrl } from '$lib/utils/api.js';
  import { onMount } from 'svelte';

  let name = '';
  let email = '';
  let body = '';
  let error = '';
  let success = '';
  let loading = false;
  let isAuthenticated = false;

  onMount(() => {
    isAuthenticated = checkAuthStatus();
  });

  function sanitize(input) {
    return input.replace(/<[^>]*>?/gm, '').slice(0, 2000);
  }

  async function submitFeedback() {
    error = '';
    success = '';
    loading = true;

    if (!name.trim() || !email.trim() || !body.trim()) {
      error = 'All fields are required.';
      loading = false;
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      error = 'Invalid email address.';
      loading = false;
      return;
    }

    const sanitizedBody = sanitize(body);
    if (sanitizedBody !== body) {
      error = 'Feedback contains invalid characters.';
      loading = false;
      return;
    }

    try {
      const token = getAuthToken();
      const response = await fetch(apiUrl('/api/feedback'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({ name, email, body: sanitizedBody })
      });

      if (response.ok) {
        success = 'Thank you for your feedback!';
        name = '';
        email = '';
        body = '';
      } else {
        const data = await response.json();
        error = data.error || 'Failed to send feedback.';
      }
    } catch (e) {
      console.error('Error submitting feedback:', e);
      error = 'Network error. Please try again.';
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Feedback - Memory Lane</title>
  <meta name="description" content="Share your feedback with us to help improve Memory Lane" />
</svelte:head>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
  <main class="max-w-2xl mx-auto px-4 py-12">
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-8">
      <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-6">Feedback</h2>
      <p class="text-gray-600 dark:text-gray-400 mb-8">
        We'd love to hear from you! Share your thoughts, suggestions, or report any issues.
      </p>

      <form on:submit|preventDefault={submitFeedback} class="space-y-5">
        <div>
          <label for="name" class="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
          <input 
            id="name"
            type="text"
            class="w-full border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            bind:value={name} 
            required 
            disabled={loading}
          />
        </div>

        <div>
          <label for="email" class="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
          <input 
            id="email"
            type="email"
            class="w-full border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            bind:value={email} 
            required 
            disabled={loading}
          />
        </div>

        <div>
          <label for="feedback" class="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Feedback</label>
          <textarea 
            id="feedback"
            rows="5"
            class="w-full border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none"
            bind:value={body} 
            required
            disabled={loading}
            placeholder="Tell us what's on your mind..."
          ></textarea>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {body.length} / 2000 characters
          </p>
        </div>

        {#if error}
          <div class="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
            <p class="text-red-600 dark:text-red-400 text-sm">{error}</p>
          </div>
        {/if}
        
        {#if success}
          <div class="p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
            <p class="text-green-600 dark:text-green-400 text-sm">{success}</p>
          </div>
        {/if}

        <button
          class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          type="submit" 
          disabled={loading}
        >
          {#if loading}
            <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Sending...
          {:else}
            Send Feedback
          {/if}
        </button>
      </form>
    </div>
  </main>
</div>
