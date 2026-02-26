<script>
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import ThemeToggle from "$lib/components/ThemeToggle.svelte";
  import GoogleSignInButton from "$lib/components/GoogleSignInButton.svelte";

  let email = $state("");
  let password = $state("");
  let confirmPassword = $state("");
  let firstName = $state("");
  let lastName = $state("");
  let loading = $state(false);
  let error = $state("");
  let showPassword = $state(false);
  let showConfirmPassword = $state(false);
  let showLoginSuggestion = $state(false);
  let userType = $state("caretaker");

  const isCaretaker = $derived(userType === "caretaker");
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const namePattern = /^[A-Za-z\s'-]+$/;
  const emailValid = $derived(emailPattern.test(email));
  const firstNameValid = $derived(!!firstName && namePattern.test(firstName));
  const lastNameValid = $derived(!lastName || namePattern.test(lastName));
  const passwordValid = $derived(password.length >= 6);
  const passwordsMatch = $derived(password === confirmPassword);
  const formValid = $derived(
    emailValid &&
      password &&
      confirmPassword &&
      firstNameValid &&
      lastNameValid &&
      passwordValid &&
      passwordsMatch,
  );

  $effect(() => {
    if (browser) {
      const userData = localStorage.getItem("userData");
      if (userData && userData !== "null") {
        goto("/dashboard");
      }
    }
  });

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");
    if (mode === "patient") userType = "patient";
    else if (mode === "caretaker") userType = "caretaker";
  });

  async function handleSignup(event) {
    event.preventDefault();

    if (userType === "patient") {
      goToPatientLogin();
      return;
    }

    if (!formValid) {
      if (!emailValid) error = "Please enter a valid email address";
      else if (!firstNameValid)
        error =
          "First name can only contain letters, spaces, apostrophes and hyphens";
      else if (!lastNameValid)
        error =
          "Last name can only contain letters, spaces, apostrophes and hyphens";
      else if (!passwordValid) error = "Password must be at least 6 characters";
      else if (!passwordsMatch) error = "Passwords do not match";
      else error = "Please correct the highlighted errors";
      return;
    }

    loading = true;
    error = "";

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim(),
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          role: "caretaker",
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        localStorage.setItem("userEmail", email.trim());
        goto("/verify-otp");
      } else {
        if (data.suggestedAction === "login") {
          error = data.message || "Account already exists";
          showLoginSuggestion = true;
        } else {
          error = data.message || "Signup failed";
          showLoginSuggestion = false;
        }
      }
    } catch (err) {
      console.error("Signup request failed:", err);
      error = "Network error. Please try again.";
    } finally {
      loading = false;
    }
  }

  function togglePasswordVisibility() {
    showPassword = !showPassword;
  }

  function toggleConfirmPasswordVisibility() {
    showConfirmPassword = !showConfirmPassword;
  }

  function goToPatientLogin() {
    goto("/login?mode=patient");
  }
</script>

<svelte:head>
  <title>Sign Up - Memory Lane</title>
  <meta
    name="description"
    content="Sign up to create AI replicas that aid in dementia and amnesia recovery."
  />
</svelte:head>

<div class="min-h-screen bg-background-light dark:bg-background-dark">
  <!-- Navigation -->
  <nav
    class="bg-surface-light dark:bg-surface-dark border-b-2 border-gray-200 dark:border-gray-800"
  >
    <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
      <a href="/dashboard" class="flex items-center gap-3">
        <img src="/logo.png" alt="" class="h-10 w-auto" aria-hidden="true" />
        <span
          class="text-accessible-xl font-bold text-text-light dark:text-text-dark"
          >Memory Lane</span
        >
      </a>
      <ThemeToggle />
    </div>
  </nav>

  <!-- Main Content -->
  <main
    class="flex items-center justify-center min-h-[calc(100vh-80px)] px-4 py-12"
  >
    <div class="w-full max-w-lg">
      <!-- Header -->
      <div class="text-center mb-8">
        <img
          src="/logo.png"
          alt="Memory Lane logo"
          class="mx-auto mb-6 h-16 w-auto"
        />
        <h1
          class="text-accessible-3xl font-bold text-text-light dark:text-text-dark mb-4"
        >
          Create Account
        </h1>
        <p
          class="text-accessible-base text-text-light/80 dark:text-text-dark/80"
        >
          Join Memory Lane and start building your digital replica
        </p>
      </div>

      <!-- User Type Selector -->
      <div class="mb-8">
        <fieldset>
          <legend class="sr-only">Select your account type</legend>
          <div class="flex gap-3">
            <button
              type="button"
              onclick={() => (userType = "caretaker")}
              class="flex-1 btn-tactile {userType === 'caretaker'
                ? 'btn-tactile-primary'
                : 'btn-tactile-secondary'}"
              aria-pressed={userType === "caretaker"}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span>Caretaker</span>
            </button>
            <button
              type="button"
              onclick={() => (userType = "patient")}
              class="flex-1 btn-tactile {userType === 'patient'
                ? 'btn-tactile-primary'
                : 'btn-tactile-secondary'}"
              aria-pressed={userType === "patient"}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span>Patient</span>
            </button>
          </div>
        </fieldset>
      </div>

      <!-- Signup Form Card -->
      <div class="card-accessible">
        {#if isCaretaker}
          <!-- Google Sign-In -->
          <div class="mb-6">
            <GoogleSignInButton mode="signup" />
          </div>

          <!-- Divider -->
          <div class="relative mb-6">
            <div class="absolute inset-0 flex items-center">
              <div
                class="w-full border-t border-gray-200 dark:border-gray-800"
              ></div>
            </div>
            <div class="relative flex justify-center">
              <span
                class="px-4 bg-surface-light dark:bg-surface-dark text-accessible-base text-text-light/80 dark:text-text-dark/80"
              >
                Or sign up with email
              </span>
            </div>
          </div>

          <form onsubmit={handleSignup} class="space-y-5">
            <!-- Name Fields -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label
                  for="firstName"
                  class="block text-accessible-base font-semibold text-text-light dark:text-text-dark mb-2"
                >
                  First Name *
                </label>
                <input
                  type="text"
                  id="firstName"
                  bind:value={firstName}
                  required
                  autocomplete="given-name"
                  class="input-accessible"
                  placeholder="First name"
                />
              </div>
              <div>
                <label
                  for="lastName"
                  class="block text-accessible-base font-semibold text-text-light dark:text-text-dark mb-2"
                >
                  Last Name
                </label>
                <input
                  type="text"
                  id="lastName"
                  bind:value={lastName}
                  autocomplete="family-name"
                  class="input-accessible"
                  placeholder="Last name"
                />
                {#if lastName && !lastNameValid}
                  <p
                    class="mt-1 text-accessible-sm text-red-600 dark:text-red-400"
                  >
                    Only letters allowed
                  </p>
                {/if}
              </div>
            </div>

            <!-- Email Field -->
            <div>
              <label
                for="email"
                class="block text-accessible-base font-semibold text-text-light dark:text-text-dark mb-2"
              >
                Email Address *
              </label>
              <input
                type="email"
                id="email"
                bind:value={email}
                required
                autocomplete="email"
                class="input-accessible"
                placeholder="Enter your email"
              />
              {#if email && !emailValid}
                <p
                  class="mt-1 text-accessible-sm text-red-600 dark:text-red-400"
                >
                  Invalid email format
                </p>
              {/if}
            </div>

            <!-- Password Field -->
            <div>
              <label
                for="password"
                class="block text-accessible-base font-semibold text-text-light dark:text-text-dark mb-2"
              >
                Password *
              </label>
              <div class="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  bind:value={password}
                  required
                  autocomplete="new-password"
                  class="input-accessible pr-14"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onclick={togglePasswordVisibility}
                  class="absolute inset-y-0 right-0 pr-4 flex items-center min-w-[48px] justify-center text-text-light/60 dark:text-text-dark/60 hover:text-text-light dark:hover:text-text-dark"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {#if showPassword}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      aria-hidden="true"
                    >
                      <path
                        d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
                      />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  {:else}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      aria-hidden="true"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  {/if}
                </button>
              </div>
              {#if password && !passwordValid}
                <p
                  class="mt-1 text-accessible-sm text-red-600 dark:text-red-400"
                >
                  Password must be at least 6 characters
                </p>
              {/if}
            </div>

            <!-- Confirm Password Field -->
            <div>
              <label
                for="confirmPassword"
                class="block text-accessible-base font-semibold text-text-light dark:text-text-dark mb-2"
              >
                Confirm Password *
              </label>
              <div class="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  id="confirmPassword"
                  bind:value={confirmPassword}
                  required
                  autocomplete="new-password"
                  class="input-accessible pr-14"
                  placeholder="Confirm your password"
                />
                <button
                  type="button"
                  onclick={toggleConfirmPasswordVisibility}
                  class="absolute inset-y-0 right-0 pr-4 flex items-center min-w-[48px] justify-center text-text-light/60 dark:text-text-dark/60 hover:text-text-light dark:hover:text-text-dark"
                  aria-label={showConfirmPassword
                    ? "Hide password"
                    : "Show password"}
                >
                  {#if showConfirmPassword}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      aria-hidden="true"
                    >
                      <path
                        d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
                      />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  {:else}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      aria-hidden="true"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  {/if}
                </button>
              </div>
              {#if confirmPassword && !passwordsMatch}
                <p
                  class="mt-1 text-accessible-sm text-red-600 dark:text-red-400"
                >
                  Passwords do not match
                </p>
              {/if}
            </div>

            <!-- Error Message -->
            {#if error}
              <div
                class="bg-red-500/10 border border-red-500/30 rounded-tactile p-4"
                role="alert"
              >
                <p
                  class="text-accessible-base text-red-600 dark:text-red-400 font-medium"
                >
                  {error}
                </p>
                {#if showLoginSuggestion}
                  <div class="mt-3">
                    <button
                      type="button"
                      onclick={() => goto("/login")}
                      class="btn-tactile btn-tactile-primary"
                    >
                      Go to Login Page
                    </button>
                  </div>
                {/if}
              </div>
            {/if}

            <!-- Submit Button -->
            <button
              type="submit"
              disabled={loading || !formValid}
              class="btn-tactile btn-tactile-primary w-full"
            >
              {#if loading}
                <svg
                  class="animate-spin w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
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
                <span>Creating account...</span>
              {:else}
                <span>Create Account</span>
              {/if}
            </button>
          </form>
        {:else}
          <!-- Patient info -->
          <div class="space-y-4">
            <div
              class="bg-primary/10 border border-primary/30 rounded-tactile p-4"
            >
              <p
                class="text-accessible-base font-semibold text-primary dark:text-secondary"
              >
                Are you a patient?
              </p>
              <p
                class="mt-2 text-accessible-base text-text-light/80 dark:text-text-dark/80"
              >
                Use the sign in flow instead. We'll verify that your caretaker
                has already added you to Memory Lane.
              </p>
            </div>
            <button
              type="button"
              onclick={goToPatientLogin}
              class="btn-tactile btn-tactile-primary w-full"
            >
              Go to Patient Sign In
            </button>
          </div>
        {/if}

        <!-- Footer Links -->
        <div class="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800">
          <div class="text-center space-y-4">
            <p
              class="text-accessible-base text-text-light/80 dark:text-text-dark/80"
            >
              Already have an account?
              <a
                href="/login"
                class="font-semibold text-primary dark:text-secondary hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
              >
                Sign in
              </a>
            </p>

            <div class="pt-4">
              <p
                class="text-accessible-sm text-text-light/60 dark:text-text-dark/60 mb-3"
              >
                Want to explore first?
              </p>
              <button
                onclick={() => goto("/dashboard")}
                class="btn-tactile btn-tactile-secondary"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  aria-hidden="true"
                >
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                </svg>
                <span>Explore without signup</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</div>
