<script>
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import ThemeToggle from "$lib/components/ThemeToggle.svelte";
  import GoogleSignInButton from "$lib/components/GoogleSignInButton.svelte";

  let email = $state("");
  let password = $state("");
  let loading = $state(false);
  let error = $state("");
  let showPassword = $state(false);
  let userType = $state("caretaker");

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
    if (mode === "patient") {
      userType = "patient";
    } else if (mode === "caretaker") {
      userType = "caretaker";
    }
  });

  async function handleLogin(event) {
    event.preventDefault();

    if (!email || (userType === "caretaker" && !password)) {
      error =
        userType === "caretaker"
          ? "Please fill in all fields"
          : "Please enter your email address";
      return;
    }

    loading = true;
    error = "";

    try {
      const endpoint =
        userType === "patient" ? "/api/auth/patient-login" : "/api/auth/login";
      const requestBody =
        userType === "patient"
          ? { email: email.trim() }
          : { email: email.trim(), password };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        if (userType === "patient") {
          if (data.patient) {
            const normalized = { ...data.patient, role: "patient" };
            localStorage.setItem("userData", JSON.stringify(normalized));
          }
          const redirectTo = localStorage.getItem("redirectAfterLogin");
          if (redirectTo) {
            localStorage.removeItem("redirectAfterLogin");
            goto(redirectTo);
          } else {
            goto("/dashboard");
          }
        } else {
          if (data.user) {
            const normalized = {
              ...data.user,
              role: data.user.role || "caretaker",
            };
            localStorage.setItem("userData", JSON.stringify(normalized));
          }
          if (data.user && data.user.isVerified) {
            const redirectTo = localStorage.getItem("redirectAfterLogin");
            if (redirectTo) {
              localStorage.removeItem("redirectAfterLogin");
              goto(redirectTo);
            } else {
              goto("/dashboard");
            }
          } else {
            localStorage.setItem("userEmail", email.trim());
            goto("/verify-otp");
          }
        }
      } else {
        if (data.unverified && data.user) {
          localStorage.setItem("userEmail", email.trim());
          goto("/verify-otp");
        } else {
          error =
            data.message ||
            data.errors?.[0] ||
            (userType === "patient" ? "Patient login failed" : "Login failed");
        }
      }
    } catch (err) {
      console.error("Login request failed:", err);
      error = "Network error. Please check your connection and try again.";
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
  <meta
    name="description"
    content="Log in securely to access your AI memory replicas."
  />
</svelte:head>

<div
  class="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100"
>
  <!-- Shared Header -->
  <header
    class="flex items-center justify-between whitespace-nowrap border-b border-solid border-slate-200 dark:border-slate-800 px-6 md:px-10 py-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md sticky top-0 z-50"
  >
    <a href="/dashboard" class="flex items-center gap-3 group">
      <div
        class="flex items-center justify-center size-10 bg-primary rounded-lg text-white group-hover:bg-blue-700 transition-colors"
      >
        <span class="material-symbols-outlined">neurology</span>
      </div>
      <h2
        class="text-slate-900 dark:text-white text-xl font-bold leading-tight tracking-tight"
      >
        Memory Lane
      </h2>
    </a>
    <div class="flex gap-4 items-center">
      <ThemeToggle />
      <button
        onclick={() => goto("/dashboard")}
        class="hidden md:flex min-w-[84px] cursor-pointer items-center justify-center rounded-xl h-10 px-4 bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors"
      >
        <span class="truncate">Explore Dashboard</span>
      </button>
    </div>
  </header>

  {#if userType === "caretaker"}
    <!-- Caretaker Main -->
    <main class="flex-1 flex items-center justify-center p-4 md:p-8">
      <div
        class="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-0 overflow-hidden rounded-xl shadow-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
      >
        <!-- Left Side: Branding/Visual -->
        <div
          class="relative hidden lg:flex flex-col justify-between p-12 bg-primary overflow-hidden"
        >
          <div class="absolute inset-0 opacity-20" aria-hidden="true">
            <div
              class="absolute inset-0 bg-gradient-to-br from-primary via-blue-600 to-indigo-900"
            ></div>
            <div
              class="absolute inset-0"
              style="background-image: radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0); background-size: 32px 32px;"
            ></div>
          </div>
          <div class="relative z-10">
            <div
              class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold uppercase tracking-widest mb-6"
            >
              <span class="material-symbols-outlined text-sm">verified</span>
              Medical Grade Platform
            </div>
            <h1
              class="text-4xl xl:text-5xl font-extrabold text-white leading-tight mb-6"
            >
              Empowering Caretakers with Cognitive Insights.
            </h1>
            <p class="text-blue-100 text-lg max-w-md font-light">
              Access the comprehensive dashboard for patient monitoring, memory
              exercises, and therapeutic tracking.
            </p>
          </div>
          <div
            class="relative z-10 p-6 rounded-xl border border-white/20 bg-white/10 backdrop-blur-md"
          >
            <div class="flex items-center gap-4 mb-4">
              <div
                class="size-12 rounded-full bg-white/30 flex items-center justify-center"
              >
                <span class="material-symbols-outlined text-white"
                  >clinical_notes</span
                >
              </div>
              <div>
                <p class="text-white font-bold">New Analytics Available</p>
                <p class="text-blue-100 text-sm">
                  Weekly cognitive trend reports are ready.
                </p>
              </div>
            </div>
            <div class="w-full bg-white/20 h-2 rounded-full overflow-hidden">
              <div class="bg-white h-full w-3/4 rounded-full"></div>
            </div>
          </div>
        </div>

        <!-- Right Side: Login Form -->
        <div class="flex flex-col p-8 md:p-12 lg:p-16 justify-center">
          <div class="mb-10">
            <h2 class="text-3xl font-black text-slate-900 dark:text-white mb-2">
              Welcome Back
            </h2>
            <p class="text-slate-500 dark:text-slate-400">
              Please enter your caretaker credentials to continue
            </p>
          </div>

          <form class="space-y-5" onsubmit={handleLogin}>
            {#if error}
              <div
                class="bg-red-500/10 border border-red-500/30 rounded-xl p-4"
              >
                <p class="text-sm text-red-600 dark:text-red-400 font-medium">
                  {error}
                </p>
              </div>
            {/if}

            <div>
              <label
                for="email"
                class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2"
                >Work Email</label
              >
              <div class="relative">
                <span
                  class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  >mail</span
                >
                <input
                  id="email"
                  bind:value={email}
                  required
                  class="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                  placeholder="name@medical-center.com"
                  type="email"
                />
              </div>
            </div>

            <div>
              <div class="flex justify-between mb-2">
                <label
                  for="password"
                  class="text-sm font-semibold text-slate-700 dark:text-slate-300"
                  >Password</label
                >
              </div>
              <div class="relative">
                <span
                  class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  >lock</span
                >
                <input
                  id="password"
                  bind:value={password}
                  required
                  class="w-full pl-12 pr-12 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                  placeholder="••••••••"
                  type={showPassword ? "text" : "password"}
                />
                <button
                  onclick={togglePasswordVisibility}
                  class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
                  type="button"
                >
                  <span class="material-symbols-outlined"
                    >{showPassword ? "visibility_off" : "visibility"}</span
                  >
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              class="w-full bg-primary hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-2 disabled:opacity-75"
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
                <span>Signing In...</span>
              {:else}
                <span>Sign In to Dashboard</span>
                <span class="material-symbols-outlined text-lg"
                  >arrow_forward</span
                >
              {/if}
            </button>
          </form>

          <div class="relative my-8">
            <div class="absolute inset-0 flex items-center">
              <div
                class="w-full border-t border-slate-200 dark:border-slate-700"
              ></div>
            </div>
            <div class="relative flex justify-center text-sm">
              <span class="px-4 bg-white dark:bg-slate-900 text-slate-500"
                >Or continue with</span
              >
            </div>
          </div>

          <GoogleSignInButton mode="signin" />

          <div class="mt-10 text-center space-y-4">
            <p class="text-slate-600 dark:text-slate-400">
              Don't have a caretaker account?
              <a class="text-primary font-bold hover:underline" href="/signup"
                >Sign up now</a
              >
            </p>
            <div class="flex items-center justify-center gap-2">
              <span class="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700"
              ></span>
              <button
                onclick={() => (userType = "patient")}
                class="text-sm font-medium text-slate-500 hover:text-primary transition-colors"
                >I am a Patient</button
              >
              <span class="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700"
              ></span>
            </div>
          </div>
        </div>
      </div>
    </main>
  {:else}
    <!-- Patient Main -->
    <main
      class="flex-1 flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden"
    >
      <!-- decorative background nodes -->
      <div class="absolute inset-0 z-0 pointer-events-none">
        <div
          class="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl"
        ></div>
        <div
          class="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl"
        ></div>
      </div>

      <div
        class="w-full max-w-2xl bg-white dark:bg-slate-800 rounded-xl shadow-xl p-8 md:p-16 border-2 border-slate-200 dark:border-slate-700 relative z-10"
      >
        <header class="text-center mb-12">
          <div class="flex justify-center mb-6">
            <div class="bg-primary/10 p-4 rounded-full">
              <span
                class="material-symbols-outlined text-primary"
                style="font-size: 64px;">psychology</span
              >
            </div>
          </div>
          <h1
            class="text-5xl md:text-6xl font-black text-primary mb-4 tracking-tight"
          >
            Memory Lane
          </h1>
          <p
            class="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100"
          >
            Welcome Back
          </p>
        </header>

        <form onsubmit={handleLogin} class="space-y-10">
          {#if error}
            <div
              class="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center"
            >
              <p class="text-lg text-red-600 dark:text-red-400 font-medium">
                {error}
              </p>
            </div>
          {/if}
          <div class="space-y-4">
            <p
              class="text-xl md:text-2xl text-slate-600 dark:text-slate-300 text-center leading-relaxed"
            >
              Enter the email your caretaker used to add you
            </p>
          </div>
          <div class="space-y-8">
            <div class="flex flex-col gap-3">
              <label
                class="text-xl font-bold text-slate-900 dark:text-slate-100 px-2"
                for="patient-email"
              >
                Email Address
              </label>
              <input
                id="patient-email"
                bind:value={email}
                required
                class="w-full h-24 text-2xl md:text-3xl rounded-xl border-4 border-slate-300 dark:border-slate-600 focus:border-primary dark:focus:border-primary focus:ring-4 focus:ring-primary/20 bg-white dark:bg-slate-900 px-6 font-medium transition-all"
                placeholder="name@email.com"
                type="email"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              class="w-full h-24 bg-primary hover:bg-primary/90 text-white rounded-xl text-3xl md:text-4xl font-black shadow-lg shadow-primary/30 flex items-center justify-center gap-4 transition-transform active:scale-95 disabled:opacity-70"
            >
              {#if loading}
                <svg
                  class="animate-spin h-8 w-8 text-white"
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
                <span>Signing In...</span>
              {:else}
                <span>Sign In</span>
                <span class="material-symbols-outlined" style="font-size: 40px;"
                  >login</span
                >
              {/if}
            </button>
          </div>
          <div
            class="pt-8 border-t border-slate-200 dark:border-slate-700 text-center"
          >
            <p
              class="text-lg md:text-xl text-slate-500 dark:text-slate-400 mb-4"
            >
              Are you a caretaker instead?
            </p>
            <button
              type="button"
              onclick={() => (userType = "caretaker")}
              class="inline-flex items-center gap-2 text-primary text-xl md:text-2xl font-bold hover:underline decoration-2 underline-offset-8 transition-all"
            >
              <span class="material-symbols-outlined">shield_person</span>
              Sign in as Caretaker
            </button>
          </div>
        </form>
      </div>
    </main>
  {/if}

  <footer
    class="px-6 md:px-10 py-6 border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md relative z-20"
  >
    <div class="flex flex-col md:flex-row justify-between items-center gap-4">
      <p class="text-sm text-slate-500 dark:text-slate-400">
        © 2024 Memory Lane Systems. HIPAA Compliant & Secure.
      </p>
      <div class="flex gap-6">
        <a
          class="text-sm text-slate-500 hover:text-primary transition-colors"
          href="#">Privacy Policy</a
        >
        <a
          class="text-sm text-slate-500 hover:text-primary transition-colors"
          href="#">Terms of Service</a
        >
        <a
          class="text-sm text-slate-500 hover:text-primary transition-colors"
          href="#">Security Standards</a
        >
      </div>
    </div>
  </footer>
</div>
