<script>
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';

  let email = $state('');
  let otpCode = $state('');
  let loading = $state(false);
  let error = $state('');
  let success = $state('');
  let resendLoading = $state(false);
  let resendCooldown = $state(0);

  // Get email from localStorage
  $effect(() => {
    if (browser) {
      const storedEmail = localStorage.getItem('userEmail');
      if (storedEmail) {
        email = storedEmail;
      } else {
        goto('/signup');
      }
    }
  });

  // Cooldown timer
  $effect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        resendCooldown -= 1;
      }, 1000);
      return () => clearTimeout(timer);
    }
  });

  async function handleVerifyOTP(event) {
    event.preventDefault();
    
    if (!otpCode || otpCode.length !== 6) {
      error = 'Please enter a valid 6-digit code';
      return;
    }

    loading = true;
    error = '';

    try {
      const payloadEmail = (email || '').trim().toLowerCase();

      // Use SvelteKit API route for cookie-based auth
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ 
          email: payloadEmail,
          otpCode 
        })
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success) {
        success = 'Email verified successfully! Redirecting...';
        
        // Store user data for immediate availability (token is in httpOnly cookie)
        if (data.user) {
          localStorage.setItem('userData', JSON.stringify(data.user));
        }
        
        localStorage.removeItem('userEmail');
        
        setTimeout(() => {
          const redirectTo = localStorage.getItem('redirectAfterLogin');
          if (redirectTo) {
            localStorage.removeItem('redirectAfterLogin');
            goto(redirectTo);
          } else {
            goto('/dashboard');
          }
        }, 1500);
      } else {
        console.error('[verify-otp] failed', response.status, data);
        const details = Array.isArray(data?.errors) ? ` — ${data.errors.join(', ')}` : '';
        error = (data?.message || 'Verification failed') + details;
      }
    } catch (err) {
      console.error('OTP verification failed:', err);
      error = 'Network error. Please try again.';
    } finally {
      loading = false;
    }
  }

  async function handleResendOTP() {
    if (resendCooldown > 0) return;

    resendLoading = true;
    error = '';

    try {
      // Use SvelteKit API route
      const response = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        success = 'New verification code sent to your email';
        resendCooldown = 60;
        
        setTimeout(() => {
          success = '';
        }, 3000);
      } else {
        error = data.message || 'Failed to resend code';
      }
    } catch (err) {
      console.error('OTP resend failed:', err);
      error = 'Network error. Please try again.';
    } finally {
      resendLoading = false;
    }
  }

  function handleOTPInput(event) {
    const value = event.target.value.replace(/\D/g, '');
    if (value.length <= 6) {
      otpCode = value;
    }
  }

  function goToSignup() {
    localStorage.removeItem('userEmail');
    goto('/signup');
  }
</script>

<svelte:head>
  <title>Verify Email - Memory Lane</title>
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
        <div class="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-blue-600 dark:text-blue-400">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
        </div>
        <h2 class="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Verify Your Email</h2>
        <p class="text-gray-600 dark:text-gray-400">
          We've sent a 6-digit verification code to
        </p>
        <p class="text-gray-900 dark:text-gray-100 font-medium">{email}</p>
      </div>

      <!-- Verification Form -->
      <div class="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700">
        <form onsubmit={handleVerifyOTP} class="p-6 space-y-6">
          <!-- OTP Input -->
          <div>
            <label for="otpCode" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Verification Code
            </label>
            <input
              type="text"
              id="otpCode"
              value={otpCode}
              oninput={handleOTPInput}
              required
              maxlength="6"
              class="w-full px-3 py-3 text-center text-2xl font-mono tracking-widest border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="000000"
            />
            <p class="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center">
              Enter the 6-digit code from your email
            </p>
          </div>

          <!-- Success Message -->
          {#if success}
            <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-3">
              <p class="text-green-600 dark:text-green-400 text-sm text-center">{success}</p>
            </div>
          {/if}

          <!-- Error Message -->
          {#if error}
            <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
              <p class="text-red-600 dark:text-red-400 text-sm text-center">{error}</p>
            </div>
          {/if}

          <!-- Submit Button -->
          <button
            type="submit"
            disabled={loading || otpCode.length !== 6}
            class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
          >
            {#if loading}
              <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Verifying...
            {:else}
              Verify Email
            {/if}
          </button>
        </form>

        <!-- Footer Options -->
        <div class="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 rounded-b-lg">
          <div class="text-center space-y-3">
            <!-- Resend Code -->
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Didn't receive the code?
              </p>
              <button
                type="button"
                onclick={handleResendOTP}
                disabled={resendLoading || resendCooldown > 0}
                class="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                {#if resendLoading}
                  Sending...
                {:else if resendCooldown > 0}
                  Resend code in {resendCooldown}s
                {:else}
                  Resend verification code
                {/if}
              </button>
            </div>

            <!-- Change Email -->
            <div>
              <button
                type="button"
                onclick={goToSignup}
                class="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Wrong email? Go back to signup
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</div>
