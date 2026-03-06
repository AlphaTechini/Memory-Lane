<!-- src/routes/manage-patients/+page.svelte -->
<script>
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { verifyAuth, getAuthToken, apiCall, getUserRole } from "$lib/auth.js";
  import ThemeToggle from "$lib/components/ThemeToggle.svelte";
  import Sidebar from "$lib/components/dashboard/Sidebar.svelte";

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

<div
  class="bg-background-light dark:bg-background-dark text-slate-800 dark:text-slate-200 transition-colors duration-300 min-h-screen flex font-sans"
>
  <Sidebar {userRole} />

  <main
    class="ml-72 flex-1 p-8 lg:p-12 overflow-y-auto h-screen w-full relative"
  >
    <!-- Theme Toggle and Help -->
    <div class="absolute top-8 right-12 z-10 flex gap-4">
      <ThemeToggle />
      <button
        class="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm"
      >
        <span class="material-symbols-outlined text-[20px]">help_outline</span>
      </button>
    </div>

    {#if !authChecked}
      <div class="flex justify-center items-center h-64">
        <div
          class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"
        ></div>
      </div>
    {:else}
      <!-- Header -->
      <div class="mb-10 max-w-4xl">
        <h1
          class="text-4xl lg:text-5xl font-serif font-bold text-blue-900 dark:text-slate-100 mb-4 tracking-tight"
        >
          Manage Patient Access
        </h1>
        <p class="text-slate-500 dark:text-slate-400 text-lg">
          Invite patients and grant permissions to specific AI replicas with our
          secure, clinical-grade sharing system.
        </p>
      </div>

      <!-- Grant Access Card -->
      <div
        class="bg-white dark:bg-slate-900 rounded-[2rem] shadow-xl shadow-blue-900/5 border border-slate-100 dark:border-slate-800 p-8 lg:p-10 mb-12 relative overflow-hidden"
      >
        <div class="mb-8">
          <h2 class="text-xl font-bold text-blue-900 dark:text-slate-100 mb-2">
            Grant New Access
          </h2>
        </div>

        <!-- Email Input -->
        <div class="mb-10 max-w-2xl">
          <label
            for="patientEmail"
            class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3"
          >
            PATIENT EMAIL ADDRESS
          </label>
          <div class="relative">
            <div
              class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400"
            >
              <span class="material-symbols-outlined">mail</span>
            </div>
            <input
              id="patientEmail"
              type="email"
              bind:value={patientEmail}
              placeholder="patient@example.com"
              class="w-full pl-12 pr-4 py-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all font-medium placeholder:font-normal placeholder:text-slate-400"
              disabled={updating}
            />
          </div>
          <p class="mt-3 text-sm text-slate-500">
            An invitation will be sent to this email to join your care network.
          </p>
        </div>

        <!-- Replica Selection -->
        <div class="mb-10">
          <fieldset class="border border-transparent p-0">
            <legend
              class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4"
            >
              Select Replicas to Share
            </legend>

            {#if loading}
              <div class="flex justify-center py-8">
                <div
                  class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"
                ></div>
              </div>
            {:else if replicas.length === 0}
              <div class="text-center py-8 text-slate-500">
                <p>No replicas found. Create a replica first.</p>
                <button
                  onclick={() => goto("/create-replicas")}
                  class="mt-2 text-blue-600 hover:text-blue-700 font-medium"
                >
                  Create Replica
                </button>
              </div>
            {:else}
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4" role="list">
                {#each replicas as replica (replica.replicaId)}
                  <label
                    class="group flex flex-col p-5 border-2 rounded-2xl cursor-pointer transition-all {selectedReplicas.includes(
                      replica.replicaId,
                    )
                      ? 'border-blue-600 bg-blue-50/50 dark:border-blue-500 dark:bg-blue-900/20'
                      : 'border-slate-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-slate-700'}"
                    role="listitem"
                  >
                    <div class="flex items-start justify-between mb-4">
                      <div class="flex items-center space-x-3">
                        {#if replica.profileImageUrl}
                          <img
                            src={replica.profileImageUrl}
                            alt={replica.name}
                            class="w-10 h-10 rounded-full object-cover shadow-sm ring-2 ring-white dark:ring-slate-800"
                          />
                        {:else}
                          <div
                            class="w-10 h-10 bg-blue-100 dark:bg-slate-800 text-blue-800 dark:text-blue-300 rounded-full flex items-center justify-center font-bold ring-2 ring-white dark:ring-slate-800"
                          >
                            {replica.name.charAt(0)}
                          </div>
                        {/if}
                        <div>
                          <h3 class="font-bold text-blue-900 dark:text-white">
                            {replica.name}
                          </h3>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        aria-label={`Select replica ${replica.name}`}
                        checked={selectedReplicas.includes(replica.replicaId)}
                        onchange={() =>
                          toggleReplicaSelection(replica.replicaId)}
                        class="w-6 h-6 text-blue-600 border-slate-300 rounded focus:ring-blue-600 transition-colors"
                        disabled={updating}
                      />
                    </div>
                    <div
                      class="flex items-center gap-2 mt-auto pt-2 text-xs font-semibold text-slate-500 border-t border-slate-100 dark:border-slate-800/50"
                    >
                      <span
                        class="w-2 h-2 rounded-full {replica.status === 'active'
                          ? 'bg-blue-500'
                          : 'bg-slate-300'}"
                      ></span>
                      synced recently
                    </div>
                  </label>
                {/each}
              </div>
            {/if}
          </fieldset>
        </div>

        <!-- Action Buttons -->
        <div
          class="flex items-center justify-end gap-4 mt-8 pt-8 border-t border-slate-100 dark:border-slate-800"
        >
          <button
            onclick={resetForm}
            disabled={updating}
            class="px-8 py-3.5 rounded-full border border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Reset Changes
          </button>
          <button
            onclick={addPatientEmail}
            disabled={updating ||
              !patientEmail ||
              selectedReplicas.length === 0}
            class="px-8 py-3.5 bg-blue-900 text-white rounded-full font-bold hover:bg-blue-800 transition-all shadow-lg shadow-blue-900/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {#if updating}
              <div
                class="animate-spin rounded-full h-4 w-4 border-2 border-white/60 border-t-white"
              ></div>
            {/if}
            Grant Access & Update
            <span class="material-symbols-outlined text-[18px]">send</span>
          </button>
        </div>

        <!-- Status Display -->
        {#if updateStatus}
          <div
            class="mt-6 p-4 rounded-xl {updateStatus.includes('Successfully')
              ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300 border border-green-200 dark:border-green-800'
              : updateStatus.includes('Error')
                ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 border border-red-200 dark:border-red-800'
                : 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border border-blue-200 dark:border-blue-800'}"
          >
            <p class="text-sm font-medium flex items-center gap-2">
              <span class="material-symbols-outlined text-[18px]"
                >{updateStatus.includes("Successfully")
                  ? "check_circle"
                  : updateStatus.includes("Error")
                    ? "error"
                    : "info"}</span
              >
              {updateStatus}
            </p>
          </div>
        {/if}

        <!-- Update Results -->
        {#if updateResults.length > 0}
          <div class="mt-4 space-y-2">
            {#each updateResults as result, idx (`${result.replicaId}-${idx}`)}
              <div
                class="flex items-center justify-between p-3 rounded-xl {result.success
                  ? 'bg-green-50/50 dark:bg-green-900/10'
                  : 'bg-red-50/50 dark:bg-red-900/10'} border {result.success
                  ? 'border-green-100 dark:border-green-900/30'
                  : 'border-red-100 dark:border-red-900/30'}"
              >
                <span
                  class="text-sm font-medium {result.success
                    ? 'text-green-700 dark:text-green-300'
                    : 'text-red-700 dark:text-red-300'}"
                >
                  {#if replicas && replicas.length}
                    {#await Promise.resolve(replicas.find((r) => r.replicaId === result.replicaId)) then match}
                      {#if match}{match.name}{:else}Replica {result.replicaId}{/if}
                    {:catch}Replica {result.replicaId}{/await}
                  {:else}Replica {result.replicaId}{/if}
                </span>
                <span
                  class="text-xs {result.success
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

      <!-- Shared With Table -->
      <div class="mt-12">
        <h3
          class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-6 px-2"
        >
          CURRENTLY SHARED WITH
        </h3>
        <div
          class="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200/60 dark:border-slate-800 overflow-hidden shadow-sm"
        >
          <table class="w-full text-left text-sm">
            <thead
              class="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider"
            >
              <tr>
                <th class="px-8 py-5">Patient Details</th>
                <th class="px-8 py-5">Shared Replicas</th>
                <th class="px-8 py-5">Status</th>
                <th class="px-8 py-5 text-right w-24">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              <!-- Iterate over unique patient emails found in replicas -->
              {#if replicas.some((r) => r.whitelistEmails && r.whitelistEmails.length > 0)}
                {#each Array.from(new Set(replicas.flatMap((r) => r.whitelistEmails || []))) as email}
                  <tr
                    class="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors"
                  >
                    <td class="px-8 py-6">
                      <div class="flex items-center gap-4">
                        <div
                          class="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-500 text-sm"
                        >
                          {email.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div
                            class="font-bold text-blue-900 dark:text-white capitalize"
                          >
                            {email.split("@")[0]}
                          </div>
                          <div class="text-slate-500 text-xs mt-0.5">
                            {email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td class="px-8 py-6">
                      <div class="flex flex-wrap gap-2">
                        {#each replicas.filter( (r) => (r.whitelistEmails || []).includes(email), ) as sharedReplica}
                          <span
                            class="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold uppercase tracking-wide"
                          >
                            {sharedReplica.name}
                          </span>
                        {/each}
                      </div>
                    </td>
                    <td class="px-8 py-6">
                      <div
                        class="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400"
                      >
                        <span class="w-2.5 h-2.5 rounded-full bg-blue-500"
                        ></span> Active
                      </div>
                    </td>
                    <td class="px-8 py-6 text-right">
                      <button
                        class="text-slate-400 hover:text-red-500 transition-colors p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                      >
                        <span class="material-symbols-outlined text-[20px]"
                          >delete</span
                        >
                      </button>
                    </td>
                  </tr>
                {/each}
              {:else}
                <tr>
                  <td colspan="4" class="px-8 py-12 text-center text-slate-500">
                    No patients have access yet.
                  </td>
                </tr>
              {/if}
            </tbody>
          </table>
        </div>
      </div>
    {/if}
  </main>

  <!-- Floating Back to Dashboard Button -->
  <div class="fixed bottom-8 right-8 z-50">
    <button
      onclick={() => goto("/dashboard")}
      class="px-6 py-4 bg-blue-600/90 hover:bg-blue-600 backdrop-blur-md text-white rounded-full font-bold shadow-xl shadow-blue-900/20 flex items-center gap-2 transition-all hover:scale-105"
    >
      <span class="material-symbols-outlined text-[20px]">home</span>
      Back to Dashboard
    </button>
  </div>
</div>
