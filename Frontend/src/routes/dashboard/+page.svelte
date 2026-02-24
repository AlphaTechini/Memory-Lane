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

  let isAuth = $state(false);
  let user = $state(null);
  let userRole = $state(null);
  let authChecked = $state(false);

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
          <p class="text-gray-500 dark:text-gray-400 text-lg">
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
            <span class="font-medium text-lg">Create AI Replica</span>
          </button>
        {/if}
      </header>

      {#if userRole === "caretaker"}
        <!-- Stats Row -->
        <DashboardStats />

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
            View All <span class="material-icons-round ml-1 text-lg"
              >arrow_forward</span
            >
          </a>
        </div>

        <!-- Patients Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 pb-12">
          <PatientCard
            name="Margaret Evans"
            id="#8821-MA"
            status="Active"
            lastInteraction="2 hours ago"
            memoryBank="84% Complete"
            imageSrc="/images/dashboard/patient-1.jpg"
          />
          <PatientCard
            name="Arthur Clarke"
            id="#9932-AC"
            status="Syncing"
            lastInteraction="1 day ago"
            memoryBank="Processing..."
            imageSrc="/images/dashboard/patient-2.jpg"
          />
          <PatientCard
            name="Eleanor Rigby"
            id="#4412-ER"
            status="Active"
            lastInteraction="15 mins ago"
            memoryBank="98% Complete"
            imageSrc="/images/dashboard/patient-3.jpg"
          />

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
        <!-- Patient Simple View -->
        <div
          class="bg-surface-light dark:bg-surface-dark p-8 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700"
        >
          <h2
            class="text-2xl font-serif font-bold text-primary dark:text-white mb-6"
          >
            Your Memories
          </h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <button
              onclick={() => goto("/gallery")}
              class="p-8 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-primary dark:hover:border-secondary text-left transition-colors"
            >
              <span
                class="material-icons-round text-4xl text-primary mb-4 block"
                >photo_library</span
              >
              <h3 class="text-xl font-bold dark:text-white mb-2">
                View Gallery
              </h3>
              <p class="text-gray-500 dark:text-gray-400">
                Browse your uploaded photos and memories.
              </p>
            </button>
            <button
              onclick={() => goto("/chat-replicas")}
              class="p-8 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-primary dark:hover:border-secondary text-left transition-colors"
            >
              <span
                class="material-icons-round text-4xl text-primary mb-4 block"
                >chat</span
              >
              <h3 class="text-xl font-bold dark:text-white mb-2">
                Chat with Anna
              </h3>
              <p class="text-gray-500 dark:text-gray-400">
                Start a conversation to remember old times.
              </p>
            </button>
          </div>
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
