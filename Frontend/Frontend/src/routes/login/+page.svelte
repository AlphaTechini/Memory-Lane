<script>
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';

  const API_BASE_URL = 'http://localhost:4000';

  let email = $state('');
  let password = $state('');
  let loading = $state(false);
  let error = $state('');
  let showPassword = $state(false);

  // Check if already logged in
  $effect(() => {
    if (browser) {
      const token = localStorage.getItem('authToken');
      if (token) {
        goto('/dashboard');
      }
    }
  });

  async function handleLogin(event) {
    event.preventDefault();
    
    if (!email || !password) {
      error = 'Please fill in all fields';
      return;
    }

    loading = true;
    error = '';

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Store token and user data
        localStorage.setItem('authToken', data.token);
        if (data.user) {
          localStorage.setItem('userData', JSON.stringify(data.user));
        }
        
        // Check if user is verified
        if (data.user.isVerified) {
          // Check for redirect after login
          const redirectTo = localStorage.getItem('redirectAfterLogin');
          if (redirectTo) {
            localStorage.removeItem('redirectAfterLogin');
            goto(redirectTo);
          } else {
            goto('/dashboard');
          }
        } else {
          // Redirect to OTP verification
          localStorage.setItem('userEmail', email);
          goto('/verify-otp');
        }
      } else {
        error = data.message || 'Login failed';
      }
    } catch (err) {
      error = 'Network error. Please try again.';
    } finally {
      loading = false;
    }
  }

  function togglePasswordVisibility() {
    showPassword = !showPassword;
  }
</script>

<svelte:head>
  <title>Login - Memory Lane</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
  <!-- Navigation -->
  <nav class="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
    <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100">Memory Lane</h1>
      </div>
      <ThemeToggle />
    </div>
  </nav>

  <!-- Main Content -->
  <main class="flex items-center justify-center min-h-[calc(100vh-80px)] px-4 py-12">
    <div class="w-full max-w-md">
      <!-- Header -->
      <div class="text-center mb-8">
        <h2 class="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Welcome Back</h2>
        <p class="text-gray-600 dark:text-gray-400">Sign in to your Memory Lane account</p>
      </div>

      <!-- Login Form -->
      <div class="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700">
        <form onsubmit={handleLogin} class="p-6 space-y-6">
          <!-- Email Field -->
          <div>
            <label for="email" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              bind:value={email}
              required
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="Enter your email"
            />
          </div>

          <!-- Password Field -->
          <div>
            <label for="password" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Password
            </label>
            <div class="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                bind:value={password}
                required
                class="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="Enter your password"
              />
              <button
                type="button"
                onclick={togglePasswordVisibility}
                class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {#if showPassword}
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                {:else}
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                {/if}
              </button>
            </div>
          </div>

          <!-- Error Message -->
          {#if error}
            <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
              <p class="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </div>
          {/if}

          <!-- Submit Button -->
          <button
            type="submit"
            disabled={loading}
            class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
          >
            {#if loading}
              <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Signing in...
            {:else}
              Sign In
            {/if}
          </button>
        </form>

        <!-- Footer Links -->
        <div class="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 rounded-b-lg">
          <div class="text-center space-y-3">
            <p class="text-sm text-gray-600 dark:text-gray-400">
              Don't have an account?
              <a href="/signup" class="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
                Sign up
              </a>
            </p>
            
            <!-- Explore Without Signup -->
            <div class="border-t border-gray-200 dark:border-gray-600 pt-3">
              <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Want to explore first?
              </p>
              <button
                onclick={() => goto('/dashboard')}
                class="inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-1">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                </svg>
                Explore without signup
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</div>
