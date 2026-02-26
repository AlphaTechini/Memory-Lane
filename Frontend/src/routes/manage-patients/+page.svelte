<!-- src/routes/manage-patients/+page.svelte -->
<script>
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { verifyAuth, getAuthToken, apiCall, getUserRole } from "$lib/auth.js";
  import ThemeToggle from "$lib/components/ThemeToggle.svelte";
  import BackNavigation from "$lib/components/BackNavigation.svelte";

  let isAuth = $state(false);
  let user = $state(null);
  let userRole = $state(null);
  let authChecked = $state(false);
  let replicas = $state([]);
  let loading = $state(false);
  let patientEmail = $state("");
  let selectedReplicas = $state([]);
  let updating = $state(false);
  let updateStatus = $state("");
  let updateResults = $state([]);

  // Check authentication status using cached user data for fast UI, but require a token for protected API calls
  $effect(() => {
    if (browser && !authChecked) {
      const checkAuth = async () => {
        // Get cached user immediately (verifyAuth returns cached user and background-verifies token)
        user = await verifyAuth();
        if (!user) {
          // No cached user and no valid token -> redirect to login
          goto("/login");
          return;
        }

        // Check user role - patients can't access this page
        userRole = user.role || getUserRole() || "caretaker";
        if (userRole === "patient") {
          console.log(
            "Patients cannot access manage-patients page, redirecting to dashboard",
          );
          goto("/dashboard");
          return;
        }

        // Determine if we have a token for protected API calls
        const token = getAuthToken();
        isAuth = !!token;

        // If token exists, fetch latest replicas; otherwise show cached replicas from userData if available
        if (isAuth) {
          await loadReplicas();
        } else {
          console.log(
            "Viewing cached user data only; login to load live replicas and perform actions",
          );
          // Attempt to populate replicas from cached userData
          try {
            const cached = localStorage.getItem("userData");
            if (cached) {
              const parsed = JSON.parse(cached);
              if (parsed.replicas && parsed.replicas.length) {
                replicas = parsed.replicas;
              }
            }
          } catch {
            // ignore
          }
        }

        authChecked = true;
      };
      checkAuth();
    }
  });

  async function loadReplicas() {
    try {
      loading = true;
      const token = getAuthToken();
      console.debug("manage-patients loadReplicas - token present:", !!token);
      // Use apiCall helper which sets API_BASE_URL and Authorization header
      const response = await apiCall("/api/user/replicas", { method: "GET" });

      if (response.ok) {
        const data = await response.json();
        replicas = data.replicas || [];
      } else {
        console.error("Failed to load replicas");
      }
    } catch (error) {
      console.error("Error loading replicas:", error);
    } finally {
      loading = false;
    }
  }

  function toggleReplicaSelection(replicaId) {
    if (selectedReplicas.includes(replicaId)) {
      selectedReplicas = selectedReplicas.filter((id) => id !== replicaId);
    } else {
      selectedReplicas = [...selectedReplicas, replicaId];
    }
  }

  async function addPatientEmail() {
    // Require token for this action
    if (!getAuthToken()) {
      updateStatus = "You must be logged in to update replicas. Please login.";
      return;
    }
    if (!patientEmail || !patientEmail.includes("@")) {
      updateStatus = "Please enter a valid email address";
      return;
    }

    if (selectedReplicas.length === 0) {
      updateStatus = "Please select at least one replica";
      return;
    }

    try {
      updating = true;
      updateStatus = "Adding patient email and updating replicas...";
      updateResults = [];

      const selectedReplicaIds = Array.from(selectedReplicas);

      // Use apiCall helper to include API_BASE_URL and Authorization header
      const response = await apiCall("/api/caretaker/add-patient-email", {
        method: "POST",
        body: JSON.stringify({
          patientEmail,
          replicaIds: selectedReplicaIds,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        updateResults = data.results || [];

        if (data.summary) {
          const { successful, total } = data.summary;
          if (successful === total) {
            updateStatus = `Successfully updated all ${total} replicas!`;
          } else {
            updateStatus = `Updated ${successful}/${total} replicas. Check results below.`;
          }
        } else {
          updateStatus = "Process completed. Check results below.";
        }
      } else {
        const error = await response.json();
        updateStatus = `Error: ${error.error || "Request failed"}`;
      }
    } catch (error) {
      updateStatus = `Error: ${error.message}`;
    } finally {
      updating = false;
    }
  }

  function resetForm() {
    patientEmail = "";
    selectedReplicas = new Set();
    updateStatus = "";
    updateResults = [];
  }
</script>

<svelte:head>
  <title>Manage Patients - Memory Lane AI</title>
</svelte:head>

<div class="min-h-screen bg-background-light dark:bg-background-dark">
  <BackNavigation
    title="Manage Patients"
    subtitle="Add patient email addresses and grant access to specific replicas"
  />

  <!-- Theme Toggle - positioned in top right -->
  <div class="fixed top-4 right-4 z-10">
    <ThemeToggle />
  </div>

  <main class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    {#if !authChecked}
      <div class="flex justify-center items-center h-64">
        <div
          class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"
        ></div>
      </div>
    {:else}
      <div class="card-accessible p-6">
        <div class="mb-6">
          <h2
            class="text-accessible-lg font-semibold text-text-light dark:text-text-dark mb-2"
          >
            Add Patient Email Access
          </h2>
          <p class="text-text-light/80 dark:text-text-dark/80">
            Enter a patient's email address and select which replicas they
            should be able to access.
          </p>
        </div>

        <!-- Email Input -->
        <div class="mb-6">
          <label
            for="patientEmail"
            class="block text-accessible-sm font-medium text-text-light dark:text-text-dark mb-2"
          >
            Patient Email Address
          </label>
          <input
            id="patientEmail"
            type="email"
            bind:value={patientEmail}
            placeholder="patient@example.com"
            class="input-accessible"
            disabled={updating}
          />
        </div>

        <!-- Replica Selection -->
        <div class="mb-6">
          <fieldset class="border border-transparent p-0">
            <legend
              class="block text-accessible-sm font-medium text-text-light dark:text-text-dark mb-3"
              >Select Replicas to Share</legend
            >

            {#if loading}
              <div class="flex justify-center py-8">
                <div
                  class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"
                ></div>
              </div>
            {:else if replicas.length === 0}
              <div
                class="text-center py-8 text-text-light/60 dark:text-text-dark/60"
              >
                <p>No replicas found. Create a replica first.</p>
                <button
                  onclick={() => goto("/create-replicas")}
                  class="mt-2 text-primary hover:text-primary-hover dark:text-secondary dark:hover:text-secondary-hover font-medium"
                >
                  Create Replica
                </button>
              </div>
            {:else}
              <div class="space-y-3" role="list">
                {#each replicas as replica (replica.replicaId)}
                  <label
                    class="flex items-center space-x-3 p-4 border border-gray-200 dark:border-gray-800 rounded-tactile hover:bg-surface-light/50 dark:hover:bg-surface-dark/50 cursor-pointer transition-colors"
                    role="listitem"
                  >
                    <input
                      type="checkbox"
                      aria-label={`Select replica ${replica.name}`}
                      checked={selectedReplicas.includes(replica.replicaId)}
                      onchange={() => toggleReplicaSelection(replica.replicaId)}
                      class="h-5 w-5 text-primary focus:ring-primary border-gray-300 rounded"
                      disabled={updating}
                    />
                    <div class="flex-1">
                      <div class="flex items-center space-x-4">
                        {#if replica.profileImageUrl}
                          <img
                            src={replica.profileImageUrl}
                            alt={replica.name}
                            class="w-12 h-12 rounded-full object-cover shadow-sm"
                          />
                        {:else}
                          <div
                            class="w-12 h-12 bg-primary dark:bg-secondary rounded-full flex items-center justify-center shadow-sm"
                          >
                            <span
                              class="text-white dark:text-charcoal-900 font-semibold text-lg"
                              >{replica.name.charAt(0)}</span
                            >
                          </div>
                        {/if}
                        <div>
                          <h3
                            class="font-medium text-text-light dark:text-text-dark"
                          >
                            {replica.name}
                          </h3>
                          <p
                            class="text-accessible-sm text-text-light/80 dark:text-text-dark/80"
                          >
                            {replica.description}
                          </p>
                          {#if replica.whitelistEmails && replica.whitelistEmails.length > 0}
                            <p
                              class="text-xs text-primary dark:text-secondary mt-1 font-medium"
                            >
                              Currently shared with {replica.whitelistEmails
                                .length} email(s)
                            </p>
                          {/if}
                        </div>
                      </div>
                    </div>
                  </label>
                {/each}
              </div>
            {/if}
          </fieldset>
        </div>

        <!-- Action Buttons -->
        <div class="flex space-x-4">
          <button
            onclick={addPatientEmail}
            disabled={updating ||
              !patientEmail ||
              selectedReplicas.length === 0}
            class="btn-tactile btn-tactile-primary flex items-center space-x-2"
          >
            {#if updating}
              <div
                class="animate-spin rounded-full h-4 w-4 border-b-2 border-surface-light"
              ></div>
            {/if}
            <span>Add Email and Update Replicas</span>
          </button>

          <button
            onclick={resetForm}
            disabled={updating}
            class="btn-tactile btn-tactile-secondary"
          >
            Reset
          </button>
        </div>

        <!-- Status Display -->
        {#if updateStatus}
          <div
            class="mt-6 p-4 rounded-tactile {updateStatus.includes(
              'Successfully',
            )
              ? 'bg-green-500/10 text-green-700 dark:text-green-300 border border-green-500/30'
              : updateStatus.includes('Error')
                ? 'bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/30'
                : 'bg-primary/10 text-primary dark:text-secondary border border-primary/30'}"
          >
            <p class="text-accessible-base font-medium">{updateStatus}</p>
          </div>
        {/if}

        <!-- Update Results -->
        {#if updateResults.length > 0}
          <div class="mt-6 space-y-3">
            <h3
              class="text-accessible-base font-medium text-text-light dark:text-text-dark"
            >
              Update Results:
            </h3>
            {#each updateResults as result, idx (`${result.replicaId}-${idx}`)}
              <div
                class="flex items-center justify-between p-3 rounded-md {result.success
                  ? 'bg-green-500/5 dark:bg-green-500/10'
                  : 'bg-red-500/5 dark:bg-red-500/10'} border {result.success
                  ? 'border-green-500/20'
                  : 'border-red-500/20'}"
              >
                <span
                  class="text-accessible-sm font-medium {result.success
                    ? 'text-green-700 dark:text-green-300'
                    : 'text-red-700 dark:text-red-300'}"
                >
                  {#if replicas && replicas.length}
                    {#await Promise.resolve(replicas.find((r) => r.replicaId === result.replicaId)) then match}
                      {#if match}
                        {match.name}
                      {:else}
                        Replica {result.replicaId}
                      {/if}
                    {:catch}
                      Replica {result.replicaId}
                    {/await}
                  {:else}
                    Replica {result.replicaId}
                  {/if}
                </span>
                <span
                  class="text-sm {result.success
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'}"
                >
                  {result.message}
                </span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </main>
</div>
