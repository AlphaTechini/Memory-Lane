<!-- Frontend/Frontend/src/lib/components/GoogleSignInButton.svelte -->
<script>
  import { auth } from '$lib/firebase';
  import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
  import { goto } from '$app/navigation';
  import { apiUrl } from '$lib/utils/api.js';

  let { mode = 'signin', disabled = false } = $props();
  let loading = $state(false);
  let error = $state(null);

  async function handleGoogleSignIn() {
    loading = true;
    error = null;
    
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account'
    });

    try {
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();
      
      const response = await fetch(apiUrl('/auth/google'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      });
      
      const data = await response.json();
      
      if (data.success) {
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
        error = data.message || 'Google sign-in failed';
      }
    } catch (err) {
      console.error('Google sign-in error:', err);
      error = err.message || 'Failed to sign in with Google';
    } finally {
      loading = false;
    }
  }
</script>

<div class="space-y-2">
  <button
    onclick={handleGoogleSignIn}
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
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M19.6 10.227c0-.709-.064-1.39-.182-2.045H10v3.868h5.382a4.6 4.6 0 01-1.996 3.018v2.51h3.232c1.891-1.742 2.982-4.305 2.982-7.35z" fill="#4285F4"/>
        <path d="M10 20c2.7 0 4.964-.895 6.618-2.423l-3.232-2.509c-.895.6-2.04.955-3.386.955-2.605 0-4.81-1.76-5.595-4.123H1.064v2.59A9.996 9.996 0 0010 20z" fill="#34A853"/>
        <path d="M4.405 11.9c-.2-.6-.314-1.24-.314-1.9 0-.66.114-1.3.314-1.9V5.51H1.064A9.996 9.996 0 000 10c0 1.614.386 3.14 1.064 4.49l3.34-2.59z" fill="#FBBC05"/>
        <path d="M10 3.977c1.468 0 2.786.505 3.823 1.496l2.868-2.868C14.959.99 12.695 0 10 0 6.09 0 2.71 2.24 1.064 5.51l3.34 2.59C5.19 5.736 7.395 3.977 10 3.977z" fill="#EA4335"/>
      </svg>
      <span class="text-gray-700 dark:text-gray-300 font-medium">
        {mode === 'signup' ? 'Sign up with Google' : 'Sign in with Google'}
      </span>
    {/if}
  </button>
  
  {#if error}
    <p class="text-sm text-red-600 dark:text-red-400">{error}</p>
  {/if}
</div>