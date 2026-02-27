<script>
    import { logout } from "$lib/auth.js";
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";

    let { userName = "Margaret" } = $props();

    async function handleLogout() {
        await logout();
    }

    // Determine if we show a back button or just the icon
    let isRootDashboard = $derived($page.route.id === "/dashboard");
</script>

<header
    class="flex items-center justify-between px-6 md:px-20 py-6 border-b border-primary/10 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md sticky top-0 z-50"
>
    <div class="flex items-center gap-4">
        {#if !isRootDashboard}
            <button
                onclick={() => goto("/dashboard")}
                class="bg-primary/10 hover:bg-primary/20 text-primary p-2 rounded-lg transition-colors flex items-center justify-center mr-2"
            >
                <span class="material-symbols-outlined text-3xl"
                    >arrow_back</span
                >
            </button>
        {/if}
        <div
            class="bg-primary text-white p-2 rounded-lg flex items-center justify-center"
        >
            <span
                class="material-symbols-outlined text-4xl"
                style="font-variation-settings: 'FILL' 1">history_edu</span
            >
        </div>
        <h2
            class="text-primary dark:text-white text-2xl md:text-3xl font-bold tracking-tight font-serif hidden sm:block"
        >
            Memory Lane
        </h2>
    </div>
    <div class="flex items-center gap-6">
        <button
            onclick={handleLogout}
            title="Log Out"
            class="flex items-center justify-center rounded-full h-12 w-12 md:h-14 md:w-14 bg-red-200 dark:bg-red-800 text-red-900 dark:text-red-100 hover:bg-red-300 transition-colors"
        >
            <span
                class="material-symbols-outlined text-2xl md:text-3xl font-bold"
                >logout</span
            >
        </button>
        <button
            class="flex items-center justify-center rounded-full h-12 w-12 md:h-14 md:w-14 bg-primary/20 text-primary dark:text-white hover:bg-primary/30 transition-colors"
        >
            <span
                class="material-symbols-outlined text-2xl md:text-3xl font-bold"
                >settings</span
            >
        </button>
        <div
            class="bg-center bg-no-repeat aspect-square bg-cover rounded-full h-12 w-12 md:h-14 md:w-14 border-4 border-white dark:border-gray-600 shadow-md bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden"
            aria-label="{userName}'s Profile Picture"
        >
            <span
                class="material-symbols-outlined text-gray-500 dark:text-gray-400 text-3xl"
                >person</span
            >
        </div>
    </div>
</header>
