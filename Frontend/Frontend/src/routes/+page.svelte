<!-- Onboarding: choose Caretaker or Patient -->
<script>
  import { goto } from '$app/navigation';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';

  const API_BASE_URL = 'http://localhost:4000';

  let showPatientCard = false;
  let patientEmail = '';
  let loading = false;
  let message = '';
  let error = '';

  function signInAsCaretaker() {
    // Use existing login flow
    goto('/login');
  }

  function signInAsPatientCard() {
    showPatientCard = true;
    message = '';
    error = '';
  }

  // Generate a temporary password for patient signup (server requires password)
  function generateTempPassword() {
    // Simple random string - short lived since patient will verify via OTP
    return Math.random().toString(36).slice(-10) + 'A1!';
  }

  async function submitPatientEmail(event) {
    event.preventDefault();
    error = '';
    message = '';

    if (!patientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patientEmail)) {
      error = 'Please enter a valid email address';
      return;
    }

    loading = true;
    try {
      const tempPassword = generateTempPassword();
      const resp = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: patientEmail, password: tempPassword, role: 'patient' })
      });

      const data = await resp.json();
      if (resp.ok && data.success) {
        // Save email for OTP verification step and redirect
        localStorage.setItem('userEmail', patientEmail);
        message = 'A verification code was sent to the email. Redirecting to verification...';
        setTimeout(() => goto('/verify-otp'), 900);
      } else {
        // If user already exists, treat this as a request to send OTP and continue
        if (data.message && data.message.includes('already exists')) {
          // Call resend-otp to send a fresh verification code (or login OTP)
          try {
            const resendResp = await fetch(`${API_BASE_URL}/auth/resend-otp`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: patientEmail })
            });
            const resendData = await resendResp.json();
            if (resendResp.ok && resendData.success) {
              localStorage.setItem('userEmail', patientEmail);
              message = 'Welcome back! A verification code was sent to your email. Redirecting to verification...';
              setTimeout(() => goto('/verify-otp'), 700);
            } else {
              error = resendData.message || 'Failed to send verification code. Please try again.';
            }
          } catch (e) {
            console.error('Failed to resend verification code on caretaker login:', e);
            error = 'Network error when requesting verification code. Please try again.';
          }
        } else {
          // Handle the specific patient account already exists message from backend
          if (data.accountType === 'patient') {
            error = 'You already have a patient account. A verification code has been sent to your email to sign in.';
            // Try to send OTP anyway for convenience
            try {
              const resendResp = await fetch(`${API_BASE_URL}/auth/resend-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: patientEmail })
              });
              const resendData = await resendResp.json();
              if (resendResp.ok && resendData.success) {
                localStorage.setItem('userEmail', patientEmail);
                message = 'A verification code was sent to your email. Redirecting to verification...';
                setTimeout(() => goto('/verify-otp'), 700);
                return;
              }
            } catch (e) {
              console.error('Resending verification code for patient failed:', e);
            }
          } else {
            error = data.message || 'Unable to sign in at this time. Please contact your caretaker for assistance.';
          }
        }
      }
    } catch (err) {
      console.error('Caretaker login request failed:', err);
      error = 'Network error. Please try again.';
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Welcome - Memory Lane</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
  <div class="w-full max-w-2xl p-6">
    <nav class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Memory Lane</h1>
      <ThemeToggle />
    </nav>

    <!-- Platform Description -->
    <div class="text-center mb-8">
      <h2 class="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">Preserving Memories, Connecting Hearts</h2>
      <p class="text-lg text-gray-700 dark:text-gray-300 mb-4 max-w-4xl mx-auto">
        Memory Lane helps families stay connected when memory challenges make communication difficult. Our AI-powered platform creates digital replicas that preserve precious memories, personalities, and conversations.
      </p>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto text-sm">
        <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <div class="font-semibold text-blue-800 dark:text-blue-300 mb-2">For Memory Care</div>
          <p class="text-blue-700 dark:text-blue-400">Helps patients with dementia, Alzheimer's, and other memory conditions maintain meaningful connections with their digital replicas.</p>
        </div>
        <div class="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
          <div class="font-semibold text-green-800 dark:text-green-300 mb-2">Preserve Personalities</div>
          <p class="text-green-700 dark:text-green-400">Capture the unique voice, memories, and personality traits of loved ones before they're lost to time.</p>
        </div>
        <div class="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
          <div class="font-semibold text-purple-800 dark:text-purple-300 mb-2">Stay Connected</div>
          <p class="text-purple-700 dark:text-purple-400">Enable patients to interact with familiar personalities when direct communication becomes challenging.</p>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex flex-col">
        <h2 class="text-lg font-semibold mb-4">Sign in as Caretaker</h2>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">Use your existing account to sign in and manage patient replicas.</p>
        <div class="mt-auto">
          <button onclick={signInAsCaretaker} class="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700">Sign in as Caretaker</button>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex flex-col">
        <h2 class="text-lg font-semibold mb-4">Sign in as Patient</h2>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">Patients sign in with email only. We'll send a verification code to their email.</p>

        {#if !showPatientCard}
          <button onclick={signInAsPatientCard} class="w-full py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700">Sign in as Patient</button>
        {:else}
          <form onsubmit={submitPatientEmail} class="space-y-4">
            <div>
              <label for="patientEmailInput" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Patient Email</label>
              <input id="patientEmailInput" type="email" bind:value={patientEmail} required class="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" placeholder="patient@example.com" />
            </div>

            {#if error}
              <div class="text-sm text-red-600">{error}</div>
            {/if}
            {#if message}
              <div class="text-sm text-green-600">{message}</div>
            {/if}

            <div class="flex gap-2">
              <button type="submit" class="flex-1 py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700" disabled={loading}>{loading ? 'Sending...' : 'Continue'}</button>
              <button type="button" class="py-2 px-4 bg-gray-200 dark:bg-gray-700 rounded-md" onclick={() => showPatientCard = false}>Cancel</button>
            </div>
          </form>
        {/if}
      </div>
    </div>
  </div>
</div>