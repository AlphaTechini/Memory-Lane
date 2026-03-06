<script>
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import {
    isAuthenticated,
    verifyAuth,
    logout,
    requireAuthForAction,
    apiCall,
    getUserRole,
  } from "$lib/auth.js";

  import Sidebar from "$lib/components/dashboard/Sidebar.svelte";
  import DashboardStatsCard from "$lib/components/dashboard/DashboardStatsCard.svelte";
  import PatientOverviewCard from "$lib/components/dashboard/PatientOverviewCard.svelte";

  let isAuth = $state(false);
  let user = $state(null);
  let userRole = $state(null);
  let authChecked = $state(false);
  let userName = "Margaret";
  let recentPatients = $state([]);
  let loadingPatients = $state(true);

  // Stats
  let totalConversations = $state(0);
  let newMemories = $state(0);

  $effect(() => {
    if (browser && !authChecked) {
      const checkAuth = async () => {
        isAuth = isAuthenticated();
        if (isAuth) {
          user = await verifyAuth();
          if (!user) {
            isAuth = false;
          } else {
            if (user && user.role) {
              userRole = user.role;
            } else {
              try {
                const cached = getUserRole();
                if (cached) {
                  userRole = cached;
                } else {
                  try {
                    const response = await apiCall("/api/auth/me", {
                      method: "GET",
                    });
                    if (response.ok) {
                      const data = await response.json();
                      const resolved = data.user || data.patient || data;
                      try {
                        localStorage.setItem(
                          "userData",
                          JSON.stringify(resolved),
                        );
                      } catch (e) {}
                      userRole = resolved?.role || "caretaker";
                    }
                  } catch (error) {
                    console.error("Failed to load user role:", error);
                    userRole = "caretaker";
                  }
                }
              } catch (err) {
                console.error("Failed to read cached role:", err);
                userRole = "caretaker";
              }
            }
            if (userRole === "caretaker") {
              fetchPatients();
            }
          }
        } else {
          userRole = null;
          goto("/login"); // Redirect to login if unauthenticated on dashboard
        }
        authChecked = true;
      };
      checkAuth();
    }
  });

  async function fetchPatients() {
    loadingPatients = true;
    try {
      const response = await apiCall("/api/user/replicas", { method: "GET" });
      if (response.ok) {
        const data = await response.json();
        // Assuming we want the latest 3 patients
        recentPatients = (data.replicas || []).slice(0, 3);

        // Mock stats based on real data length for demonstration
        totalConversations = recentPatients.length * 42;
        newMemories = recentPatients.length * 5;
      }
    } catch (e) {
      console.error("Failed to fetch patients", e);
    } finally {
      loadingPatients = false;
    }
  }
</script>

<svelte:head>
  <title>Dashboard - Memory Lane Caretaker</title>
  <!-- Material Symbols for Dashboard Icons -->
  <link
    href="https://fonts.googleapis.com/icon?family=Material+Icons+Round"
    rel="stylesheet"
  />
</svelte:head>

{#if authChecked && isAuth}
  <div
    class="bg-[#F5F5F2] dark:bg-background-dark text-black dark:text-text-dark transition-colors duration-300 min-h-screen flex font-sans selection:bg-primary/20 selection:text-primary"
  >
    <!-- Sidebar -->
    <Sidebar {userRole} />

    <!-- Main Content -->
    <main class="ml-72 flex-1 p-8 lg:p-12 overflow-y-auto h-screen w-full">
      <header class="flex justify-between items-center mb-12">
        <div>
          <h1
            class="text-4xl lg:text-5xl font-serif font-bold text-black dark:text-white mb-2"
          >
            Welcome back{#if user}, {user.firstName ||
                user.name ||
                "Dr. Smith"}{/if}
          </h1>
          <p
            class="text-black dark:text-gray-200 lg:text-xl font-medium font-sans"
          >
            {#if userRole === "caretaker"}
              Here's what's happening with your patients today.
            {:else}
              Welcome to the Memory Lane Patient Portal.
            {/if}
          </p>
        </div>
        {#if userRole === "caretaker"}
          <button
            onclick={() => goto("/create-replicas")}
            class="bg-primary hover:bg-primary-hover text-white px-6 py-4 rounded-xl flex items-center space-x-2 shadow-lg hover:shadow-xl transition-all duration-300 group"
          >
            <span
              class="material-symbols-outlined text-xl font-bold group-hover:rotate-90 transition-transform"
              >add</span
            >
            <span class="font-medium text-lg font-display"
              >Create New AI Replica</span
            >
          </button>
        {/if}
      </header>

      {#if userRole === "caretaker"}
        <!-- Stats Row -->
        <section
          class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12"
        >
          <DashboardStatsCard
            title="Weekly Activity"
            value={totalConversations || "124"}
            subtitle="Conversations generated"
            highlightText="+12%"
            highlightColor="green"
          />
          <DashboardStatsCard
            title="Memory Ingestion"
            value={newMemories || "15"}
            subtitle="New Memories Uploaded"
            highlightText="New"
            highlightColor="blue"
          />
          <DashboardStatsCard
            title="Patient Status"
            value={recentPatients.length || "28"}
            subtitle="Active Replicas"
          />
          <DashboardStatsCard
            title="System Health"
            value="All Systems Operational"
            subtitle="Last sync: Just now"
            isSpecial={true}
          />
        </section>

        <div class="flex items-center justify-between mb-8">
          <h2 class="text-3xl font-serif font-bold text-black dark:text-white">
            Recent Patients
          </h2>
          <a
            class="text-black dark:text-gray-300 hover:text-secondary font-medium font-display flex items-center transition-colors text-lg"
            href="/manage-patients"
          >
            View All Patients <span
              class="material-symbols-outlined ml-1 text-xl">arrow_forward</span
            >
          </a>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 pb-12">
          {#if loadingPatients}
            <div class="col-span-full flex justify-center py-12">
              <div
                class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"
              ></div>
            </div>
          {:else if recentPatients.length === 0}
            <div
              class="col-span-full text-center py-12 bg-surface-light rounded-2xl border border-gray-100 dark:border-gray-700"
            >
              <p class="text-xl font-serif text-black mb-4">
                No patients found
              </p>
              <button
                onclick={() => goto("/create-replicas")}
                class="text-black font-medium hover:underline"
                >Create an AI Replica to get started</button
              >
            </div>
          {:else}
            {#each recentPatients as patient}
              <PatientOverviewCard
                name={patient.name}
                replicaId={patient.replicaId || patient._id || patient.id}
                profileImageUrl={patient.profileImageUrl}
                status="ACTIVE"
              />
            {/each}
          {/if}

          <!-- Onboard Patient Card / Quick Action -->
          <article
            onclick={() => goto("/manage-patients")}
            class="bg-gray-50 dark:bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 p-6 flex flex-col items-center justify-center transition-all hover:border-primary dark:hover:border-secondary cursor-pointer group h-full min-h-[250px]"
          >
            <div
              class="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors"
            >
              <span
                class="material-symbols-outlined text-3xl text-gray-400 dark:text-gray-500 group-hover:text-primary dark:group-hover:text-secondary"
                >add</span
              >
            </div>
            <h3
              class="text-xl font-serif font-bold text-black dark:text-gray-400 group-hover:text-black dark:group-hover:text-white text-center"
            >
              Onboard New Patient
            </h3>
            <p
              class="text-sm font-sans text-black text-center mt-2 max-w-[200px]"
            >
              Begin the memory preservation process for a new client.
            </p>
          </article>
        </div>
      {:else}
        <!-- Patient View -->
        <div
          class="-mx-8 -my-8 lg:-mx-12 lg:-my-12 flex flex-col min-h-screen pb-12"
        >
          <PatientHeader {userName} />
          <PatientDashboard {userName} />
        </div>
      {/if}
    </main>
  </div>
{:else}
  <!-- Loading state -->
  <div
    class="text-center py-12 min-h-screen flex items-center justify-center bg-cream-50 dark:bg-charcoal-900"
  >
    <div>
      <div
        class="animate-spin w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full mx-auto mb-4"
      ></div>
      <p class="text-accessible-base text-charcoal-600 dark:text-cream-300">
        Loading...
      </p>
    </div>
  </div>
{/if}
