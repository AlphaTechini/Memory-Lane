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
  import DashboardStats from "$lib/components/dashboard/DashboardStats.svelte";
  import PatientCard from "$lib/components/dashboard/PatientCard.svelte";

  import PatientHeader from "$lib/components/patient/PatientHeader.svelte";
  import PatientDashboard from "$lib/components/patient/PatientDashboard.svelte";

  let isAuth = $state(false);
  let user = $state(null);
  let userRole = $state(null);
  let authChecked = $state(false);
  let userName = "Margaret";

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
    class="bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark transition-colors duration-300 min-h-screen flex font-sans selection:bg-primary/20 selection:text-primary"
  >
    <!-- Sidebar -->
    <Sidebar {userRole} />

    <!-- Main Content -->
    <main class="ml-72 flex-1 p-8 lg:p-12 overflow-y-auto h-screen w-full">
      <header class="flex justify-between items-center mb-12">
        <div>
          <h1
            class="text-4xl font-serif font-bold text-primary dark:text-white mb-2"
          >
            Welcome back
          </h1>
          <p class="text-gray-800 dark:text-gray-200 text-lg font-medium">
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
              class="material-icons-round group-hover:rotate-90 transition-transform"
              >add</span
            >
            <span class="font-medium text-lg">Create New AI Replica</span>
          </button>
        {/if}
      </header>

      {#if userRole === "caretaker"}
        <!-- Stats Row -->
        <section
          class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12"
        >
          <div
            class="bg-surface-light dark:bg-surface-dark p-8 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between h-48"
          >
            <div class="flex justify-between items-start">
              <span
                class="text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider text-sm"
                >Weekly Activity</span
              >
              <span
                class="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-1 rounded-md text-xs font-bold"
                >+12%</span
              >
            </div>
            <div>
              <h3
                class="text-5xl font-serif font-bold text-primary dark:text-white mb-2"
              >
                124
              </h3>
              <p class="text-gray-600 dark:text-gray-300 font-medium">
                Conversations generated
              </p>
            </div>
          </div>
          <div
            class="bg-surface-light dark:bg-surface-dark p-8 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between h-48"
          >
            <div class="flex justify-between items-start">
              <span
                class="text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider text-sm"
                >Memory Ingestion</span
              >
              <span
                class="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-md text-xs font-bold"
                >New</span
              >
            </div>
            <div>
              <h3
                class="text-5xl font-serif font-bold text-primary dark:text-white mb-2"
              >
                15
              </h3>
              <p class="text-gray-600 dark:text-gray-300 font-medium">
                New Memories Uploaded
              </p>
            </div>
          </div>
          <div
            class="bg-surface-light dark:bg-surface-dark p-8 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between h-48"
          >
            <div class="flex justify-between items-start">
              <span
                class="text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider text-sm"
                >Patient Status</span
              >
            </div>
            <div>
              <h3
                class="text-5xl font-serif font-bold text-primary dark:text-white mb-2"
              >
                28
              </h3>
              <p class="text-gray-600 dark:text-gray-300 font-medium">
                Active Replicas
              </p>
            </div>
          </div>
          <div
            class="bg-primary dark:bg-gray-800 p-8 rounded-xl shadow-md text-white flex flex-col justify-between h-48 relative overflow-hidden"
          >
            <div class="absolute -right-4 -top-4 opacity-10">
              <span class="material-icons-round text-9xl">auto_awesome</span>
            </div>
            <div class="z-10">
              <span
                class="text-white/70 font-medium uppercase tracking-wider text-sm"
                >System Health</span
              >
            </div>
            <div class="z-10">
              <h3 class="text-3xl font-serif font-bold mb-2">
                All Systems Operational
              </h3>
              <p class="text-white/80 font-medium text-sm">
                Last sync: 2 mins ago
              </p>
            </div>
          </div>
        </section>

        <div class="flex items-center justify-between mb-8">
          <h2
            class="text-2xl font-serif font-bold text-primary dark:text-white"
          >
            Recent Patients
          </h2>
          <a
            class="text-primary dark:text-gray-300 hover:text-secondary font-medium flex items-center transition-colors"
            href="/manage-patients"
          >
            View All Patients <span class="material-icons-round ml-1 text-lg"
              >arrow_forward</span
            >
          </a>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 pb-12">
          <article
            class="bg-surface-light dark:bg-surface-dark rounded-xl shadow-md border border-gray-100 dark:border-gray-700 p-6 flex flex-col transition-transform hover:-translate-y-1 duration-300"
          >
            <div class="flex justify-between items-start mb-6">
              <div class="flex items-center space-x-4">
                <img
                  alt="Margaret Evans"
                  class="w-16 h-16 rounded-full object-cover border-2 border-white dark:border-gray-600 shadow-sm"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCyzk0eoPWqGn6hlsmm-K2ua1Iv5H6ps1Fo9FDJ4MizYFO8PpYx7WAjkvLyw3sClpgQRNoMXG6EmW6sOclvDiiHdE_0ZjW6ScXNrtIcNFzu8ja5mVjC6R2dnR0qAT1jS3-qaRd-MMXtTHSwliE_c71agoHbBe6NK4bvvLD5UB-NA26guxs_bCN049Y_DmWBpp6v71vjeitu0rXoxHcj41CTC5ZIozG7tvn8gdDVMQMiNYlI_WwsJoSWlUlOmhUTasi03ay3nSg4ow"
                />
                <div>
                  <h3
                    class="text-xl font-serif font-bold text-primary dark:text-white"
                  >
                    Margaret Evans
                  </h3>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    ID: #8821-MA
                  </p>
                </div>
              </div>
              <span
                class="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide bg-[#E8F3E8] text-[#4A6B4A] dark:bg-green-900/30 dark:text-green-300"
              >
                Active
              </span>
            </div>
            <div class="mb-6 flex-1">
              <div
                class="flex items-center text-sm text-gray-600 dark:text-gray-400 mb-2"
              >
                <span class="material-icons-round text-base mr-2 text-secondary"
                  >history</span
                >
                Last interaction: 2 hours ago
              </div>
              <div
                class="flex items-center text-sm text-gray-600 dark:text-gray-400"
              >
                <span class="material-icons-round text-base mr-2 text-secondary"
                  >photo_library</span
                >
                Memory Bank: 84% Complete
              </div>
            </div>
            <div
              class="flex space-x-3 pt-4 border-t border-gray-100 dark:border-gray-700"
            >
              <button
                class="flex-1 py-2 px-4 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-primary dark:text-white font-medium text-sm transition-colors text-center border border-gray-200 dark:border-gray-600"
              >
                View Gallery
              </button>
              <button
                class="flex-1 py-2 px-4 rounded-lg bg-primary hover:bg-primary-hover text-white font-medium text-sm transition-colors text-center shadow-md"
              >
                Manage AI
              </button>
            </div>
          </article>

          <article
            class="bg-surface-light dark:bg-surface-dark rounded-xl shadow-md border border-gray-100 dark:border-gray-700 p-6 flex flex-col transition-transform hover:-translate-y-1 duration-300"
          >
            <div class="flex justify-between items-start mb-6">
              <div class="flex items-center space-x-4">
                <img
                  alt="Arthur C. Clarke"
                  class="w-16 h-16 rounded-full object-cover border-2 border-white dark:border-gray-600 shadow-sm"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDgwQGDzNn0KgtVMTXDUZHdrVwGLzwFqwSF1ToHKLcHfti94Z5O5bUWlQmarzlSEcGhYWroAm00Az45AjCBvTLD2QV3RT61sXP3WxNH31MPPabsyQJeY46n08P9kcLYRoynG7PSXKdsgrGBnFMRGV-zEQ_cuM6mluyYte_R0si_c3veE8t6FjhYnVSdSVkNb1YfN4LFH4LF5JbWkUZ5aAZcLNmi6Luy2FiY_6hLaxv3W17qrgxJmtq0Rb-XW4Cqao4Kymi5m62gWg"
                />
                <div>
                  <h3
                    class="text-xl font-serif font-bold text-primary dark:text-white"
                  >
                    Arthur Clarke
                  </h3>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    ID: #9932-AC
                  </p>
                </div>
              </div>
              <span
                class="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
              >
                Syncing
              </span>
            </div>
            <div class="mb-6 flex-1">
              <div
                class="flex items-center text-sm text-gray-600 dark:text-gray-400 mb-2"
              >
                <span class="material-icons-round text-base mr-2 text-secondary"
                  >history</span
                >
                Last interaction: 1 day ago
              </div>
              <div
                class="flex items-center text-sm text-gray-600 dark:text-gray-400"
              >
                <span class="material-icons-round text-base mr-2 text-secondary"
                  >photo_library</span
                >
                Memory Bank: Processing...
              </div>
            </div>
            <div
              class="flex space-x-3 pt-4 border-t border-gray-100 dark:border-gray-700"
            >
              <button
                class="flex-1 py-2 px-4 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-primary dark:text-white font-medium text-sm transition-colors text-center border border-gray-200 dark:border-gray-600"
              >
                View Gallery
              </button>
              <button
                class="flex-1 py-2 px-4 rounded-lg bg-primary hover:bg-primary-hover text-white font-medium text-sm transition-colors text-center shadow-md"
              >
                Manage AI
              </button>
            </div>
          </article>

          <article
            class="bg-surface-light dark:bg-surface-dark rounded-xl shadow-md border border-gray-100 dark:border-gray-700 p-6 flex flex-col transition-transform hover:-translate-y-1 duration-300"
          >
            <div class="flex justify-between items-start mb-6">
              <div class="flex items-center space-x-4">
                <img
                  alt="Eleanor Rigby"
                  class="w-16 h-16 rounded-full object-cover border-2 border-white dark:border-gray-600 shadow-sm"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuD_jETmVOvVqcicy0OpTwXqyJmmlcGmAg9nEl9htxeNNJAeJJt1EXfTr9zmmBgzLEU_tXNZq9qtWJL37Bs7HanmntNnX9-YaoFFZlcUd2J-jQFXztg22TRNTRDmyNBH6wYUtygAfkqmm1dI4CWBZcYNyJgNnvQhhJdjU_hspv_tWpvfT2xuKFG3GPETH98bw8KIHklxSczLJRlrNT6461spt6oyjk9NA6W3TC-tcLahsGUK9QuxqdMK5Y5Nj71KpsVMe5TpTIQdJw"
                />
                <div>
                  <h3
                    class="text-xl font-serif font-bold text-primary dark:text-white"
                  >
                    Eleanor Rigby
                  </h3>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    ID: #4412-ER
                  </p>
                </div>
              </div>
              <span
                class="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide bg-[#E8F3E8] text-[#4A6B4A] dark:bg-green-900/30 dark:text-green-300"
              >
                Active
              </span>
            </div>
            <div class="mb-6 flex-1">
              <div
                class="flex items-center text-sm text-gray-600 dark:text-gray-400 mb-2"
              >
                <span class="material-icons-round text-base mr-2 text-secondary"
                  >history</span
                >
                Last interaction: 15 mins ago
              </div>
              <div
                class="flex items-center text-sm text-gray-600 dark:text-gray-400"
              >
                <span class="material-icons-round text-base mr-2 text-secondary"
                  >photo_library</span
                >
                Memory Bank: 98% Complete
              </div>
            </div>
            <div
              class="flex space-x-3 pt-4 border-t border-gray-100 dark:border-gray-700"
            >
              <button
                class="flex-1 py-2 px-4 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-primary dark:text-white font-medium text-sm transition-colors text-center border border-gray-200 dark:border-gray-600"
              >
                View Gallery
              </button>
              <button
                class="flex-1 py-2 px-4 rounded-lg bg-primary hover:bg-primary-hover text-white font-medium text-sm transition-colors text-center shadow-md"
              >
                Manage AI
              </button>
            </div>
          </article>

          <!-- Onboard Patient Card / Quick Action -->
          <article
            onclick={() => goto("/manage-patients")}
            class="bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 p-6 flex flex-col items-center justify-center transition-all hover:border-primary dark:hover:border-secondary cursor-pointer group h-full min-h-[250px]"
          >
            <div
              class="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors"
            >
              <span
                class="material-icons-round text-3xl text-gray-400 dark:text-gray-500 group-hover:text-primary dark:group-hover:text-secondary"
                >add</span
              >
            </div>
            <h3
              class="text-lg font-serif font-bold text-gray-500 dark:text-gray-400 group-hover:text-primary dark:group-hover:text-white text-center"
            >
              Onboard New Patient
            </h3>
            <p class="text-sm text-gray-400 text-center mt-2 max-w-[200px]">
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
