<script>
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';

  let name = '';
  let email = '';
  let body = '';
  let error = '';
  let success = '';
  let loading = false;

  // Simple XSS prevention: strip tags and limit length
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
    } catch (e) {
      error = 'Network error.';
    }
    loading = false;
  }
</script>

<div class="max-w-md mx-auto mt-10 p-6 bg-white rounded shadow">
  <h2 class="text-2xl font-bold mb-4">Feedback</h2>
  <form on:submit|preventDefault={submitFeedback}>
    <label class="block mb-2">Name
      <input class="w-full border p-2 rounded mb-4" bind:value={name} required />
    </label>
    <label class="block mb-2">Email
      <input class="w-full border p-2 rounded mb-4" type="email" bind:value={email} required />
    </label>
    <label class="block mb-2">Feedback
      <textarea class="w-full border p-2 rounded mb-4" rows="5" bind:value={body} required></textarea>
    </label>
    {#if error}
      <div class="text-red-600 mb-2">{error}</div>
    {/if}
    {#if success}
      <div class="text-green-600 mb-2">{success}</div>
    {/if}
    <button class="bg-blue-600 text-white px-4 py-2 rounded" type="submit" disabled={loading}>
      {loading ? 'Sending...' : 'Send Feedback'}
    </button>
  </form>
</div>
