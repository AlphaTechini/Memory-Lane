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

<div
  class="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 antialiased"
>
  <!-- Shared Header -->
  <header
    class="flex items-center justify-between whitespace-nowrap border-b border-solid border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-6 md:px-10 py-4 sticky top-0 z-50"
  >
    <a href="/dashboard" class="flex items-center gap-3 group">
      <div
        class="text-primary flex items-center justify-center size-10 rounded-lg group-hover:bg-primary/10 transition-colors"
      >
        <span class="material-symbols-outlined text-3xl">psychology</span>
      </div>
      <h2 class="text-xl font-bold leading-tight tracking-tight">
        Memory Lane
      </h2>
    </a>
    <div class="flex items-center gap-4">
      <ThemeToggle />
      <span class="hidden sm:inline text-sm text-slate-500"
        >Already have an account?</span
      >
      <button
        onclick={() => goto("/login")}
        class="flex min-w-[84px] cursor-pointer items-center justify-center rounded-xl h-10 px-5 border border-primary text-primary hover:bg-primary/5 transition-all text-sm font-bold"
      >
        Log In
      </button>
    </div>
  </header>

  {#if userType === "caretaker"}
    <!-- Caretaker Main -->
    <main class="flex-1 flex items-center justify-center p-4 md:p-8">
      <div
        class="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-2 gap-0 overflow-hidden bg-white dark:bg-slate-900 rounded-xl shadow-2xl shadow-primary/10 border border-slate-200 dark:border-slate-800"
      >
        <!-- Left Side: Visual/Branding -->
        <div
          class="hidden lg:flex flex-col justify-between p-12 bg-primary text-white relative overflow-hidden"
        >
          <div class="relative z-10">
            <h1 class="text-4xl font-extrabold mb-6">
              Empower through premium care.
            </h1>
            <p
              class="text-lg text-primary-100/90 font-light leading-relaxed mb-8"
            >
              Join a network of professional caretakers dedicated to providing
              dignity and specialized support for memory care patients.
            </p>
            <ul class="space-y-4">
              <li class="flex items-center gap-3">
                <span
                  class="material-symbols-outlined text-white bg-white/20 p-1 rounded-full text-sm"
                  >check</span
                >
                <span>Access specialized training resources</span>
              </li>
              <li class="flex items-center gap-3">
                <span
                  class="material-symbols-outlined text-white bg-white/20 p-1 rounded-full text-sm"
                  >check</span
                >
                <span>Connect with families in need</span>
              </li>
              <li class="flex items-center gap-3">
                <span
                  class="material-symbols-outlined text-white bg-white/20 p-1 rounded-full text-sm"
                  >check</span
                >
                <span>Manage your schedule and bookings</span>
              </li>
            </ul>
          </div>
          <div class="relative z-10 mt-auto">
            <div
              class="flex items-center gap-4 p-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20"
            >
              <img
                alt="Professional caregiver"
                class="w-12 h-12 rounded-full object-cover"
                data-alt="Portrait of a smiling professional healthcare provider"
                src="/images/stitch/healthcare-provider.jpg"
              />
              <div>
                <p class="text-sm font-medium italic">
                  "The best platform for memory care professionals."
                </p>
                <p class="text-xs text-white/70">
                  — Sarah J., Senior Caretaker
                </p>
              </div>
            </div>
          </div>
          <div
            class="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-white/5 rounded-full blur-3xl"
          ></div>
          <div
            class="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-white/5 rounded-full blur-3xl"
          ></div>
        </div>

        <!-- Right Side: Form -->
        <div class="p-8 md:p-12">
          <div class="max-w-md mx-auto">
            <div class="mb-10">
              <h2
                class="text-2xl font-bold text-slate-900 dark:text-white mb-2"
              >
                Create Caretaker Account
              </h2>
              <p class="text-slate-500 dark:text-slate-400">
                Start your journey with Memory Lane today.
              </p>
            </div>

            <form onsubmit={handleSignup} class="space-y-5">
              {#if error}
                <div
                  class="bg-red-500/10 border border-red-500/30 rounded-xl p-4"
                >
                  <p class="text-sm text-red-600 dark:text-red-400 font-medium">
                    {error}
                  </p>
                  {#if showLoginSuggestion}
                    <div class="mt-3">
                      <button
                        type="button"
                        onclick={() => goto("/login")}
                        class="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-lg transition-colors"
                      >
                        Go to Login Page
                      </button>
                    </div>
                  {/if}
                </div>
              {/if}

              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-2">
                  <label
                    for="firstName"
                    class="text-sm font-semibold text-slate-700 dark:text-slate-300"
                    >First Name</label
                  >
                  <input
                    id="firstName"
                    bind:value={firstName}
                    required
                    autocomplete="given-name"
                    class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                    placeholder="Jane"
                    type="text"
                  />
                </div>
                <div class="space-y-2">
                  <label
                    for="lastName"
                    class="text-sm font-semibold text-slate-700 dark:text-slate-300"
                    >Last Name</label
                  >
                  <input
                    id="lastName"
                    bind:value={lastName}
                    autocomplete="family-name"
                    class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                    placeholder="Doe"
                    type="text"
                  />
                  {#if lastName && !lastNameValid}
                    <p class="mt-1 text-xs text-red-600 dark:text-red-400">
                      Only letters allowed
                    </p>
                  {/if}
                </div>
              </div>

              <div class="space-y-2">
                <label
                  for="email"
                  class="text-sm font-semibold text-slate-700 dark:text-slate-300"
                  >Email Address</label
                >
                <input
                  id="email"
                  bind:value={email}
                  required
                  autocomplete="email"
                  class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                  placeholder="jane.doe@example.com"
                  type="email"
                />
                {#if email && !emailValid}
                  <p class="mt-1 text-xs text-red-600 dark:text-red-400">
                    Invalid email format
                  </p>
                {/if}
              </div>

              <div class="space-y-2">
                <label
                  for="password"
                  class="text-sm font-semibold text-slate-700 dark:text-slate-300"
                  >Password</label
                >
                <div class="relative group">
                  <input
                    id="password"
                    bind:value={password}
                    required
                    autocomplete="new-password"
                    class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none pr-12"
                    placeholder="••••••••"
                    type={showPassword ? "text" : "password"}
                  />
                  <button
                    type="button"
                    onclick={togglePasswordVisibility}
                    class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
                  >
                    <span class="material-symbols-outlined text-[20px]"
                      >{showPassword ? "visibility_off" : "visibility"}</span
                    >
                  </button>
                </div>
                {#if password && !passwordValid}
                  <p class="mt-1 text-xs text-red-600 dark:text-red-400">
                    Password must be at least 6 characters
                  </p>
                {/if}
              </div>

              <div class="space-y-2">
                <label
                  for="confirmPassword"
                  class="text-sm font-semibold text-slate-700 dark:text-slate-300"
                  >Confirm Password</label
                >
                <div class="relative group">
                  <input
                    id="confirmPassword"
                    bind:value={confirmPassword}
                    required
                    autocomplete="new-password"
                    class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none pr-12"
                    placeholder="••••••••"
                    type={showConfirmPassword ? "text" : "password"}
                  />
                  <button
                    type="button"
                    onclick={toggleConfirmPasswordVisibility}
                    class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
                  >
                    <span class="material-symbols-outlined text-[20px]"
                      >{showConfirmPassword
                        ? "visibility_off"
                        : "visibility"}</span
                    >
                  </button>
                </div>
                {#if confirmPassword && !passwordsMatch}
                  <p class="mt-1 text-xs text-red-600 dark:text-red-400">
                    Passwords do not match
                  </p>
                {/if}
              </div>

              <div class="flex items-center gap-2 pt-2">
                <input
                  id="terms"
                  required
                  type="checkbox"
                  class="rounded text-primary focus:ring-primary h-4 w-4 border-slate-300"
                />
                <label
                  class="text-xs text-slate-500 dark:text-slate-400"
                  for="terms"
                >
                  I agree to the <a
                    class="text-primary hover:underline"
                    href="#">Terms of Service</a
                  >
                  and
                  <a class="text-primary hover:underline" href="#"
                    >Privacy Policy</a
                  >
                </label>
              </div>

              <button
                type="submit"
                disabled={loading || !formValid}
                class="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-all transform active:scale-[0.98] disabled:opacity-75 disabled:active:scale-100 flex items-center justify-center gap-2"
              >
                {#if loading}
                  <svg
                    class="animate-spin h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    ><circle
                      class="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      stroke-width="4"
                    ></circle><path
                      class="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path></svg
                  >
                  <span>Creating account...</span>
                {:else}
                  <span>Create Account</span>
                {/if}
              </button>

              <div class="relative py-4">
                <div class="absolute inset-0 flex items-center">
                  <div
                    class="w-full border-t border-slate-200 dark:border-slate-700"
                  ></div>
                </div>
                <div class="relative flex justify-center text-xs uppercase">
                  <span class="bg-white dark:bg-slate-900 px-2 text-slate-400"
                    >Or continue with</span
                  >
                </div>
              </div>

              <GoogleSignInButton mode="signup" />

              <div class="mt-8 text-center">
                <button
                  type="button"
                  onclick={() => (userType = "patient")}
                  class="text-sm font-medium text-slate-500 hover:text-primary transition-colors"
                  >Signing up a Patient? Click here</button
                >
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  {:else}
    <!-- Patient Role Redirection Main -->
    <main
      class="flex flex-1 items-center justify-center px-6 py-12 md:px-20 lg:px-40"
    >
      <div
        class="layout-content-container flex flex-col max-w-[560px] w-full gap-8"
      >
        <div
          class="relative w-full aspect-video rounded-xl overflow-hidden shadow-sm"
        >
          <div
            class="absolute inset-0 bg-gradient-to-tr from-primary/10 to-transparent"
          ></div>
          <img
            alt="Caring hands holding each other gently"
            class="w-full h-full object-cover"
            src="/images/stitch/caring-hands.jpg"
          />
        </div>
        <div class="flex flex-col gap-4 text-center">
          <h1
            class="text-slate-900 dark:text-slate-100 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl"
          >
            Are you a patient?
          </h1>
          <p
            class="text-slate-600 dark:text-slate-400 text-lg leading-relaxed max-w-md mx-auto"
          >
            Use the sign in flow instead. We'll verify that your caretaker has
            already added you to Memory Lane.
          </p>
        </div>
        <div class="flex flex-col gap-4 w-full">
          <button
            type="button"
            onclick={goToPatientLogin}
            class="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl h-16 px-8 bg-primary text-white text-lg font-bold shadow-lg shadow-primary/25 transition-transform active:scale-[0.98]"
          >
            <span class="truncate">Go to Patient Sign In</span>
            <span class="material-symbols-outlined ml-2">login</span>
          </button>
          <button
            type="button"
            onclick={() => (userType = "caretaker")}
            class="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl h-12 px-6 bg-transparent text-slate-600 dark:text-slate-400 text-base font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <span class="truncate">Not a patient? Go back</span>
          </button>
        </div>
        <div class="flex flex-col items-center gap-6 mt-8">
          <div class="h-px w-full bg-slate-200 dark:bg-slate-800"></div>
          <div
            class="flex items-center gap-2 text-slate-500 dark:text-slate-500 text-sm"
          >
            <span class="material-symbols-outlined text-sm">shield_person</span>
            <p>Secure verification for your peace of mind</p>
          </div>
        </div>
      </div>
    </main>
  {/if}

  <footer
    class="px-6 py-8 text-center text-slate-400 dark:text-slate-600 text-sm border-t border-slate-200 dark:border-slate-800"
  >
    <p>© 2024 Memory Lane Memory Care. All rights reserved.</p>
  </footer>
</div>
