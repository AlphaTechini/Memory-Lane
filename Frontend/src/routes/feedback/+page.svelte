<script>
  import { apiUrl } from '$lib/utils/api.js';

  let name = $state('');
  let email = $state('');
  let body = $state('');
  let error = $state('');
  let success = $state('');
  let loading = $state(false);
  let form = $state();

  async function submitFeedback() {
    error = '';
    success = '';
    loading = true;

    try {
      const response = await fetch(apiUrl('/api/feedback'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, body })
      });

      const result = await response.json();

      if (response.ok) {
        success = result.message || 'Thank you for your feedback!';
        form?.reset();
        name = '';
        email = '';
        body = '';
      } else {
        error = result.error || 'Failed to send feedback.';
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

<div class="min-h-screen bg-cream-50 dark:bg-charcoal-900">
  <main class="max-w-2xl mx-auto px-4 py-12">
    <div class="card-accessible">
      <h1 class="text-accessible-2xl font-bold text-charcoal-800 dark:text-cream-100 mb-4">Feedback</h1>
      <p class="text-accessible-base text-charcoal-600 dark:text-cream-300 mb-8">
        We'd love to hear from you! Share your thoughts, suggestions, or report any issues.
      </p>

      <form onsubmit={submitFeedback} class="space-y-6" bind:this={form}>
        <div>
          <label for="name" class="block text-accessible-base font-semibold text-charcoal-800 dark:text-cream-100 mb-2">
            Name
          </label>
          <input 
            id="name"
            type="text"
            class="input-accessible"
            bind:value={name} 
            required 
            disabled={loading}
            placeholder="Your name"
          />
        </div>

        <div>
          <label for="email" class="block text-accessible-base font-semibold text-charcoal-800 dark:text-cream-100 mb-2">
            Email
          </label>
          <input 
            id="email"
            type="email"
            class="input-accessible"
            bind:value={email} 
            required 
            disabled={loading}
            placeholder="Your email address"
          />
        </div>

        <div>
          <label for="feedback" class="block text-accessible-base font-semibold text-charcoal-800 dark:text-cream-100 mb-2">
            Feedback
          </label>
          <textarea 
            id="feedback"
            rows="5"
            class="input-accessible resize-none"
            bind:value={body} 
            required
            disabled={loading}
            placeholder="Tell us what's on your mind..."
          ></textarea>
          <p class="text-accessible-sm text-charcoal-600 dark:text-cream-400 mt-2">
            {body.length} / 2000 characters
          </p>
        </div>

        {#if error}
          <div class="bg-coral-500/10 border-2 border-coral-500/30 rounded-tactile p-4" role="alert">
            <p class="text-accessible-base text-coral-600 dark:text-coral-400 font-medium">{error}</p>
          </div>
        {/if}
        
        {#if success}
          <div class="bg-teal-500/10 border-2 border-teal-500/30 rounded-tactile p-4" role="status">
            <p class="text-accessible-base text-teal-600 dark:text-teal-400 font-medium">{success}</p>
          </div>
        {/if}

        <button
          class="btn-tactile btn-tactile-primary w-full"
          type="submit" 
          disabled={loading}
        >
          {#if loading}
            <svg class="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Sending...</span>
          {:else}
            <span>Send Feedback</span>
          {/if}
        </button>
      </form>
    </div>
  </main>
</div>
