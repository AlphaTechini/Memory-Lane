<script>
    import { theme } from "$lib/stores/theme.js";
    import { logout } from "$lib/auth.js";

    let { userRole = "caretaker", userInitial = "C" } = $props();

    function toggleTheme() {
        theme.update((t) => (t === "dark" ? "light" : "dark"));
    }

    async function handleLogout() {
        await logout();
    }
</script>

<aside
    class="w-72 bg-primary dark:bg-black text-[#F5F5F2] flex flex-col fixed h-full z-20 transition-all duration-300 shadow-xl"
>
    <div class="p-8 flex items-center space-x-3">
        <span class="material-symbols-outlined text-3xl text-secondary"
            >psychology</span
        >
        <span class="text-2xl font-serif font-bold tracking-wide"
            >Memory Lane</span
        >
    </div>

    <nav class="flex-1 px-4 space-y-2 mt-4">
        <a
            class="flex items-center space-x-4 px-6 py-4 bg-white/10 rounded-xl text-white transition-colors duration-200"
            href="/dashboard"
        >
            <span class="material-symbols-outlined text-2xl">dashboard</span>
            <span class="text-lg font-medium">Dashboard</span>
        </a>
        {#if userRole === "caretaker"}
            <a
                class="flex items-center space-x-4 px-6 py-4 hover:bg-white/5 rounded-xl text-gray-300 hover:text-white transition-colors duration-200"
                href="/manage-patients"
            >
                <span class="material-symbols-outlined text-2xl">people</span>
                <span class="text-lg font-medium">Patients</span>
            </a>
            <a
                class="flex items-center space-x-4 px-6 py-4 hover:bg-white/5 rounded-xl text-gray-300 hover:text-white transition-colors duration-200"
                href="/create-replicas"
            >
                <span class="material-symbols-outlined text-2xl">smart_toy</span
                >
                <span class="text-lg font-medium">AI Replicas</span>
            </a>
        {/if}
        <a
            class="flex items-center space-x-4 px-6 py-4 hover:bg-white/5 rounded-xl text-gray-300 hover:text-white transition-colors duration-200"
            href="/gallery"
        >
            <span class="material-symbols-outlined text-2xl">collections</span>
            <span class="text-lg font-medium">Memory Galleries</span>
        </a>
        <a
            class="flex items-center space-x-4 px-6 py-4 hover:bg-white/5 rounded-xl text-gray-300 hover:text-white transition-colors duration-200"
            href="/chat-replicas"
        >
            <span class="material-symbols-outlined text-2xl">chat</span>
            <span class="text-lg font-medium">Chat</span>
        </a>
    </nav>

    <div class="p-6 border-t border-white/10">
        <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
                <div
                    class="w-10 h-10 rounded-full border-2 border-secondary overflow-hidden bg-primary flex items-center justify-center text-white font-bold"
                >
                    {#if userRole === "caretaker"}
                        <img
                            alt="User Profile"
                            class="w-full h-full object-cover"
                            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBUZIYHiGmI9glXR_7_moAtqKs_aHxHKpGtqJDvasv1BtNtfAbYn6dypPSK9C0-N86R41QFPw9ejb3o0Q7qfYD32e1rZjDxxrEjRenRdxVeO4tJj_EBHBCcbJ8lkGWU4tMnylj82RfSX10GcL1XunooC_G5O9D8ccggLXU90cKbSgmMUnIpz2c1LQ-Ou3fR_Pj18vH0TtBygeuZs2dwEsOxkczDJW8UEF-7Amrgt03PBzf1eTDThIdV4G1ckU8WUBp01vw4uoJAGA"
                        />
                    {:else}
                        {userInitial}
                    {/if}
                </div>
                <div>
                    {#if userRole === "caretaker"}
                        <p class="text-sm font-semibold capitalize">
                            Dr. Eleanor Smith
                        </p>
                        <p class="text-xs text-gray-400">Chief Caretaker</p>
                    {:else}
                        <p class="text-sm font-semibold capitalize">
                            {userRole}
                        </p>
                        <p class="text-xs text-gray-400">Memory Lane</p>
                    {/if}
                </div>
            </div>
            <button
                onclick={handleLogout}
                class="text-gray-400 hover:text-white transition-colors"
                title="Log Out"
            >
                <span class="material-symbols-outlined text-xl">logout</span>
            </button>
        </div>
        <button
            class="mt-4 w-full flex items-center justify-center space-x-2 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition text-sm text-white"
            onclick={toggleTheme}
        >
            <span class="material-symbols-outlined text-sm">
                {$theme === "dark" ? "light_mode" : "dark_mode"}
            </span>
            <span>Toggle Theme</span>
        </button>
    </div>
</aside>
