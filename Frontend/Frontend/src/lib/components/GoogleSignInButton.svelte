<script>
  import { goto } from '$app/navigation';
  import { initFirebaseClient } from '$lib/firebase';
  import { onMount } from 'svelte';
  import { apiUrl } from '$lib/utils/api.js';

  let { mode = 'signin', disabled = false } = $props();
  let loading = $state(false);
  let error = $state(null);
  let firebaseAuth = $state(null);
  let initializationError = $state(null);

  // Toast state
  let showToast = $state(false);
  let toastTimer;

  // Button press state
  let isPressed = $state(false);

  onMount(async () => {
    try {
      console.log('Attempting to initialize Firebase client...');
      console.log('Firebase config check:', {
        hasApiKey: !!import.meta.env.VITE_FIREBASE_API_KEY,
        hasAuthDomain: !!import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        hasProjectId: !!import.meta.env.VITE_FIREBASE_PROJECT_ID,
        apiKeyPrefix: import.meta.env.VITE_FIREBASE_API_KEY?.substring(0, 10)
      });

      const { auth, GoogleAuthProvider, signInWithPopup } = await initFirebaseClient();
      firebaseAuth = { auth, GoogleAuthProvider, signInWithPopup };
      console.log('Firebase initialized successfully');
    } catch (err) {
      const errorMsg = err?.message || err?.toString() || 'Unknown error';
      console.error('Firebase client initialization failed:', errorMsg, err);
      initializationError = errorMsg;
      firebaseAuth = null;
    }
  });

  async function handleGoogleSignIn() {
    console.log('handleGoogleSignIn called', { 
      loading, 
      disabled, 
      firebaseAuth: !!firebaseAuth,
      initializationError 
    });
    
    if (loading || disabled) {
      console.log('Button disabled or loading, ignoring click');
      return;
    }

    // Visual feedback
    isPressed = true;

    error = null;
    loading = true;

    try {
      if (!firebaseAuth) {
        const errorDetail = initializationError || "Firebase is not configured. Please check your environment variables.";
        throw new Error(errorDetail);
      }

      console.log('Starting Google sign-in popup...');
      const { auth, GoogleAuthProvider, signInWithPopup } = firebaseAuth;
      const provider = new GoogleAuthProvider();
      
      // Add scopes for email and profile
      provider.addScope('email');
      provider.addScope('profile');
      
      const result = await signInWithPopup(auth, provider);
      
      console.log('Google sign-in popup successful, user:', result.user.email);
      console.log('Getting ID token...');
      
      const idToken = await result.user.getIdToken();
      console.log('ID token obtained (length:', idToken.length, ')');
      console.log('Sending to backend...');

      // Send to backend
      const backendUrl = apiUrl('/auth/google');
      console.log('Backend URL:', backendUrl);
      
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ idToken }),
      });

      console.log('Backend response status:', response.status);
      
      let data;
      try {
        data = await response.json();
        console.log('Backend response data:', data);
      } catch (parseErr) {
        console.error('Failed to parse backend response:', parseErr);
        throw new Error('Invalid response from server');
      }

      if (response.ok && data.success) {
        console.log('Login successful, storing token and redirecting...');
        
        // Store the token FIRST
        localStorage.setItem('authToken', data.token);
        console.log('Token stored');
        
        // Then store user data
        if (data.user) {
          localStorage.setItem('userData', JSON.stringify(data.user));
          console.log('User data stored');
        }

        // Small delay for visual feedback before redirect
        setTimeout(() => {
          // Check for redirect
          const redirectTo = localStorage.getItem('redirectAfterLogin');
          if (redirectTo) {
            localStorage.removeItem('redirectAfterLogin');
            goto(redirectTo);
          } else {
            goto('/dashboard');
          }
        }, 300);
      } else {
        console.error('Backend returned error:', data);
        throw new Error(data.message || "Google sign-in failed on the server");
      }
    } catch (err) {
      console.error("Google Sign-In error:", err);
      const errorMessage = err?.message || err?.toString() || "Sign-in failed. Please try again.";
      error = errorMessage;
      
      // Release button press state on error
      isPressed = false;

      showToast = true;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => showToast = false, 5000);
    } finally {
      loading = false;
    }
  }

  function handleTouchStart(e) {
    // Prevent double-tap zoom on mobile
    e.preventDefault();
    if (!loading && !disabled) {
      isPressed = true;
    }
  }

  function handleTouchEnd(e) {
    // Prevent ghost clicks
    e.preventDefault();
    if (!loading && !disabled && isPressed) {
      // Spring back animation
      setTimeout(() => {
        isPressed = false;
      }, 150);
      handleGoogleSignIn();
    }
  }

  function handleMouseDown() {
    if (!loading && !disabled) {
      isPressed = true;
    }
  }

  function handleMouseUp() {
    if (!loading && !disabled) {
      setTimeout(() => {
        isPressed = false;
      }, 150);
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
    on:touchstart={handleTouchStart}
    on:touchend={handleTouchEnd}
    on:mousedown={handleMouseDown}
    on:mouseup={handleMouseUp}
    disabled={loading || disabled || !firebaseAuth}
    class="google-signin-button w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg shadow-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:shadow-inner touch-manipulation"
    class:pressed={isPressed && !loading}
    class:loading={loading}
    style="user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent;"
  >
    {#if loading}
      <svg class="animate-spin h-5 w-5 text-gray-600 dark:text-gray-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span>Signing in...</span>
    {:else if !firebaseAuth}
      <!-- Google Icon (grayed out) -->
      <svg width="20" height="20" viewBox="0 0 533.5 544.3" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="flex-shrink-0 opacity-50">
        <path d="M533.5 278.4c0-18.3-1.6-36-4.7-53.1H272v100.5h146.9c-6.3 34.1-25.1 62.9-53.4 82.1v68.1h86.3c51.5-47.5 81.7-117.6 81.7-197.6z" fill="#4285f4"/>
        <path d="M272 544.3c72.9 0 134.1-24.1 178.8-65.4l-86.3-68.1c-23.9 16-54.5 25.5-92.5 25.5-70.9 0-131-47.8-152.4-112.2H30.9v70.6C75.1 488.6 168 544.3 272 544.3z" fill="#34a853"/>
        <path d="M119.6 328.1c-10.8-32.4-10.8-67.4 0-99.8V157.7H30.9c-39.6 79.5-39.6 173.8 0 253.3l88.7-82.9z" fill="#fbbc04"/>
        <path d="M272 107.7c39.6 0 75.3 13.6 103.4 40.5l77.5-77.5C412.1 23.1 344.9 0 272 0 168 0 75.1 55.7 30.9 157.7l88.7 70.6C141 155.5 201.1 107.7 272 107.7z" fill="#ea4335"/>
      </svg>
      <span class="text-sm">Google sign-in unavailable</span>
    {:else}
      <!-- Google Icon -->
      <svg width="20" height="20" viewBox="0 0 533.5 544.3" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="flex-shrink-0">
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
      on:touchend={dismissToast}
      class="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-red-600 text-white text-sm px-4 py-3 rounded-lg shadow-lg cursor-pointer z-50 max-w-xs w-full text-center"
      style="touch-action: manipulation;"
    >
      {error}
    </div>
  {/if}
  
  {#if initializationError && !firebaseAuth}
    <p class="text-xs text-red-600 dark:text-red-400 text-center mt-2">
      Firebase configuration missing. Please check your .env file.
    </p>
  {/if}
</div>

<style>
  .google-signin-button {
    position: relative;
    transform: translateY(0);
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  }

  .google-signin-button:hover:not(:disabled):not(.loading) {
    background-color: rgb(249 250 251);
    border-color: rgb(209 213 219);
    box-shadow: 0 6px 8px -1px rgb(0 0 0 / 0.15), 0 3px 5px -2px rgb(0 0 0 / 0.1);
  }

  :global(.dark) .google-signin-button:hover:not(:disabled):not(.loading) {
    background-color: rgb(55 65 81);
    border-color: rgb(75 85 99);
  }

  .google-signin-button.pressed:not(.loading) {
    transform: translateY(2px);
    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  }

  .google-signin-button:active:not(:disabled):not(.loading) {
    transform: translateY(2px);
    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  }

  .google-signin-button:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
</style>
