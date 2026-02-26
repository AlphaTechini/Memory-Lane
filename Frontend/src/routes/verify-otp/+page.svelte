<script>
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import ThemeToggle from "$lib/components/ThemeToggle.svelte";

  let email = $state("");
  let otpCode = $state("");
  let loading = $state(false);
  let error = $state("");
  let success = $state("");
  let resendLoading = $state(false);
  let resendCooldown = $state(0);

  // Get email from localStorage
  $effect(() => {
    if (browser) {
      const storedEmail = localStorage.getItem("userEmail");
      if (storedEmail) {
        email = storedEmail;
      } else {
        goto("/signup");
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
      error = "Please enter a valid 6-digit code";
      return;
    }

    loading = true;
    error = "";

    try {
      const payloadEmail = (email || "").trim().toLowerCase();

      // Use SvelteKit API route for cookie-based auth
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email: payloadEmail,
          otpCode,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success) {
        success = "Email verified successfully! Redirecting...";

        // Store user data for immediate availability (token is in httpOnly cookie)
        if (data.user) {
          localStorage.setItem("userData", JSON.stringify(data.user));
        }

        localStorage.removeItem("userEmail");

        setTimeout(() => {
          const redirectTo = localStorage.getItem("redirectAfterLogin");
          if (redirectTo) {
            localStorage.removeItem("redirectAfterLogin");
            goto(redirectTo);
          } else {
            goto("/dashboard");
          }
        }, 1500);
      } else {
        console.error("[verify-otp] failed", response.status, data);
        const details = Array.isArray(data?.errors)
          ? ` — ${data.errors.join(", ")}`
          : "";
        error = (data?.message || "Verification failed") + details;
      }
    } catch (err) {
      console.error("OTP verification failed:", err);
      error = "Network error. Please try again.";
    } finally {
      loading = false;
    }
  }

  async function handleResendOTP() {
    if (resendCooldown > 0) return;

    resendLoading = true;
    error = "";

    try {
      // Use SvelteKit API route
      const response = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        success = "New verification code sent to your email";
        resendCooldown = 60;

        setTimeout(() => {
          success = "";
        }, 3000);
      } else {
        error = data.message || "Failed to resend code";
      }
    } catch (err) {
      console.error("OTP resend failed:", err);
      error = "Network error. Please try again.";
    } finally {
      resendLoading = false;
    }
  }

  function handleOTPInput(event) {
    const value = event.target.value.replace(/\D/g, "");
    if (value.length <= 6) {
      otpCode = value;
    }
  }

  function goToSignup() {
    localStorage.removeItem("userEmail");
    goto("/signup");
  }
</script>

<svelte:head>
  <title>Verify Email - Memory Lane</title>
</svelte:head>

<div
  class="min-h-screen bg-background-light dark:bg-background-dark transition-colors duration-200"
>
  <!-- Navigation -->
  <nav
    class="bg-surface-light dark:bg-surface-dark shadow-sm border-b border-gray-200 dark:border-gray-800"
  >
    <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <a href="/dashboard" class="flex items-center gap-3">
          <img src="/logo.png" alt="" class="h-10 w-auto" aria-hidden="true" />
          <span
            class="text-accessible-xl font-bold text-text-light dark:text-text-dark"
            >Memory Lane</span
          >
        </a>
      </div>
      <ThemeToggle />
    </div>
  </nav>

  <!-- Main Content -->
  <main
    class="flex items-center justify-center min-h-[calc(100vh-80px)] px-4 py-12"
  >
    <div class="w-full max-w-md">
      <!-- Header -->
      <div class="text-center mb-8">
        <div
          class="mx-auto w-16 h-16 bg-primary/10 dark:bg-primary/20 rounded-full flex items-center justify-center mb-4"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            class="text-primary dark:text-secondary"
          >
            <path
              d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
            />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </div>
        <h2
          class="text-accessible-3xl font-bold text-text-light dark:text-text-dark mb-2"
        >
          Verify Your Email
        </h2>
        <p class="text-text-light/80 dark:text-text-dark/80">
          We've sent a 6-digit verification code to
        </p>
        <p class="text-text-light dark:text-text-dark font-medium">{email}</p>
      </div>

      <!-- Verification Form -->
      <div class="card-accessible">
        <form onsubmit={handleVerifyOTP} class="space-y-6">
          <!-- OTP Input -->
          <div>
            <label
              for="otpCode"
              class="block text-accessible-base font-medium text-text-light dark:text-text-dark mb-2"
            >
              Verification Code
            </label>
            <input
              type="text"
              id="otpCode"
              value={otpCode}
              oninput={handleOTPInput}
              required
              maxlength="6"
              class="w-full px-3 py-3 text-center text-2xl font-mono tracking-widest border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary dark:bg-surface-dark dark:text-text-dark bg-surface-light text-text-light transition-colors"
              placeholder="000000"
            />
            <p
              class="mt-2 text-accessible-sm text-text-light/60 dark:text-text-dark/60 text-center"
            >
              Enter the 6-digit code from your email
            </p>
          </div>

          <!-- Success Message -->
          {#if success}
            <div
              class="bg-green-500/10 border border-green-500/30 rounded-md p-3"
            >
              <p
                class="text-green-600 dark:text-green-400 text-accessible-sm text-center"
              >
                {success}
              </p>
            </div>
          {/if}

          <!-- Error Message -->
          {#if error}
            <div class="bg-red-500/10 border border-red-500/30 rounded-md p-3">
              <p
                class="text-red-600 dark:text-red-400 text-accessible-sm text-center"
              >
                {error}
              </p>
            </div>
          {/if}

          <!-- Submit Button -->
          <button
            type="submit"
            disabled={loading || otpCode.length !== 6}
            class="btn-tactile btn-tactile-primary w-full flex justify-center"
          >
            {#if loading}
              <svg
                class="animate-spin -ml-1 mr-3 h-5 w-5 text-surface-light"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                ></circle>
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Verifying...
            {:else}
              Verify Email
            {/if}
          </button>
        </form>

        <!-- Footer Options -->
        <div class="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800">
          <div class="text-center space-y-3">
            <!-- Resend Code -->
            <div>
              <p
                class="text-accessible-sm text-text-light/80 dark:text-text-dark/80 mb-2"
              >
                Didn't receive the code?
              </p>
              <button
                type="button"
                onclick={handleResendOTP}
                disabled={resendLoading || resendCooldown > 0}
                class="text-accessible-sm font-medium text-primary hover:text-primary-hover dark:text-secondary dark:hover:text-secondary-hover disabled:text-text-light/40 disabled:dark:text-text-dark/40 disabled:cursor-not-allowed"
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
                class="text-accessible-sm text-text-light/60 hover:text-text-light/80 dark:text-text-dark/60 dark:hover:text-text-dark/80"
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
