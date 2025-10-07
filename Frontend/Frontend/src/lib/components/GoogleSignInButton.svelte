<script>
  import { goto } from '$app/navigation';
  import { initFirebaseClient } from '$lib/firebase';
  import { onMount } from 'svelte';

  let { mode = 'signin', disabled = false } = $props();
  let loading = $state(false);
  let error = $state(null);
  let firebaseAuth = $state(null);

  // Toast state
  let showToast = $state(false);
  let toastTimer;

  // Button press state
  let pressed = false;

  onMount(async () => {
    try {
      const { auth, GoogleAuthProvider, signInWithPopup } = await initFirebaseClient();
      firebaseAuth = { auth, GoogleAuthProvider, signInWithPopup };
    } catch (err) {
      console.warn('Firebase client not available:', err);
      firebaseAuth = null;
    }
  });

  async function handleGoogleSignIn() {
    if (loading || disabled) return;

    // Trigger press-down animation
    pressed = true;
    setTimeout(() => pressed = false, 150); // short press duration

    error = null;
    loading = true;

    try {
      if (!firebaseAuth) throw new Error("Feature not available yet");

      const { auth, GoogleAuthProvider, signInWithPopup } = firebaseAuth;
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);

      const idToken = await result.user.getIdToken();

      const response = await fetch('/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        localStorage.setItem('authToken', data.token);
        if (data.user) localStorage.setItem('userData', JSON.stringify(data.user));

        const redirectTo = localStorage.getItem('redirectAfterLogin');
        if (redirectTo) {
          localStorage.removeItem('redirectAfterLogin');
          goto(redirectTo);
        } else {
          goto('/dashboard');
        }
      } else {
        throw new Error(data.message || "Google sign-in failed");
      }
    } catch (err) {
      console.error("Google Sign-In error:", err);
      error = err.message || "Feature not available yet";

      showToast = true;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => showToast = false, 3000);
      window.addEventListener("click", dismissToast, { once: true });
    } finally {
      loading = false;
    }
  }

  function dismissToast() {
    showToast = false;
    clearTimeout(toastTimer);
  }
</script>

<div class="space-y-2 relative">
  <button
    on:click={handleGoogleSignIn}
    disabled={loading || disabled}
    class="w-full flex items-center justify-center gap-3 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
    class:scale-95={pressed}
  >
    {#if loading}
      <span>Signing in...</span>
    {:else}
      <!-- Google Icon -->
      <svg width="20" height="20" viewBox="0 0 533.5 544.3" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M533.5 278.4c0-18.3-1.6-36-4.7-53.1H272v100.5h146.9c-6.3 34.1-25.1 62.9-53.4 82.1v68.1h86.3c51.5-47.5 81.7-117.6 81.7-197.6z" fill="#4285f4"/>
        <path d="M272 544.3c72.9 0 134.1-24.1 178.8-65.4l-86.3-68.1c-23.9 16-54.5 25.5-92.5 25.5-70.9 0-131-47.8-152.4-112.2H30.9v70.6C75.1 488.6 168 544.3 272 544.3z" fill="#34a853"/>
        <path d="M119.6 328.1c-10.8-32.4-10.8-67.4 0-99.8V157.7H30.9c-39.6 79.5-39.6 173.8 0 253.3l88.7-82.9z" fill="#fbbc04"/>
        <path d="M272 107.7c39.6 0 75.3 13.6 103.4 40.5l77.5-77.5C412.1 23.1 344.9 0 272 0 168 0 75.1 55.7 30.9 157.7l88.7 70.6C141 155.5 201.1 107.7 272 107.7z" fill="#ea4335"/>
      </svg>
      <span>{mode === 'signin' ? 'Sign in with Google' : 'Sign up with Google'}</span>
    {/if}
  </button>

  {#if showToast}
    <div
      on:click={dismissToast}
      class="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-sm px-4 py-2 rounded-lg shadow-lg cursor-pointer"
    >
      {error}
    </div>
  {/if}
</div>

<style>
  button {
    transition: transform 0.15s ease-in-out;
  }
</style>
