<script>
  import { goto } from '$app/navigation';
  import { apiUrl } from '$lib/utils/api.js';
  import { initFirebaseClient } from '$lib/firebase';
  import { onMount } from 'svelte';

  let { mode = 'signin', disabled = false } = $props();
  let loading = $state(false);
  let error = $state(null);
  let firebaseAuth = $state(null);
  let showToast = $state(false);
  let toastTimer;

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
    error = null;
    loading = true;

    try {
      if (!firebaseAuth) {
        throw new Error("Feature not available yet");
      }

      const { auth, GoogleAuthProvider, signInWithPopup } = firebaseAuth;
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);

      const idToken = await result.user.getIdToken();
      const response = await fetch(apiUrl('/auth/google'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        localStorage.setItem('authToken', data.token);
        if (data.user) {
          localStorage.setItem('userData', JSON.stringify(data.user));
        }

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

      // ✅ show toast
      showToast = true;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        showToast = false;
      }, 3000);

      // ✅ dismiss on any click/tap
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
    class="w-full flex items-center justify-center gap-3 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {#if loading}
      <span>Signing in...</span>
    {:else}
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
