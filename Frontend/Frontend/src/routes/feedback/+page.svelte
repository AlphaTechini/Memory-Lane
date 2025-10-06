<script>
  import { writable } from 'svelte/store';

  let name = '';
  let email = '';
  let body = '';
  let error = '';
  let success = '';
  let loading = false;

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
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, body: sanitizedBody })
      });
      if (res.ok) {
        success = 'Thank you for your feedback!';
        name = email = body = '';
      } else {
        error = 'Failed to send feedback.';
      }
    } catch {
      error = 'Network error.';
    }
    loading = false;
  }
</script>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
  <main class="max-w-2xl mx-auto px-4 py-12">
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-8">
      <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-6">Feedback</h2>

      <form on:submit|preventDefault={submitFeedback} class="space-y-5">
        <div>
          <label class="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
          <input class="w-full border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white rounded-lg px-3 py-2"
            bind:value={name} required />
        </div>

        <div>
          <label class="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
          <input type="email"
            class="w-full border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white rounded-lg px-3 py-2"
            bind:value={email} required />
        </div>

        <div>
          <label class="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Feedback</label>
          <textarea rows="5"
            class="w-full border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white rounded-lg px-3 py-2"
            bind:value={body} required></textarea>
        </div>

        {#if error}
          <div class="text-red-600 dark:text-red-400">{error}</div>
        {/if}
        {#if success}
          <div class="text-green-600 dark:text-green-400">{success}</div>
        {/if}

        <button
          class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition disabled:opacity-50"
          type="submit" disabled={loading}>
          {loading ? 'Sending...' : 'Send Feedback'}
        </button>
      </form>
    </div>
  </main>
</div>
