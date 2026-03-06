<script>
    import { goto } from "$app/navigation";

    export let replicaId;
    export let name;
    export let profileImageUrl = null;
    export let status = "ACTIVE"; // "ACTIVE" | "SYNCING" | ...
    export let lastInteraction = "Just now";
    export let memoryBankStatus = "Processing...";

    function getStatusClasses(s) {
        if (s.toUpperCase() === "SYNCING") {
            return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
        }
        // Default to ACTIVE
        return "bg-[#E8F3E8] text-[#4A6B4A] dark:bg-green-900/30 dark:text-green-300";
    }
</script>

<article
    class="bg-surface-light dark:bg-surface-dark rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex flex-col transition-transform hover:-translate-y-1 hover:shadow-md duration-300"
>
    <div class="flex justify-between items-start mb-6">
        <div class="flex items-center space-x-4">
            {#if profileImageUrl}
                <img
                    alt={name}
                    class="w-16 h-16 rounded-full object-cover border-2 border-white dark:border-gray-600 shadow-sm"
                    src={profileImageUrl}
                />
            {:else}
                <div
                    class="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white text-2xl font-bold border-2 border-white dark:border-gray-600 shadow-sm"
                >
                    {name ? name.charAt(0).toUpperCase() : "?"}
                </div>
            {/if}
            <div>
                <h3
                    class="text-xl font-serif font-bold text-black dark:text-white"
                >
                    {name}
                </h3>
                <p class="text-sm font-sans text-black dark:text-gray-400">
                    ID: #{replicaId || "NEW"}
                </p>
            </div>
        </div>
        <span
            class="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide font-display {getStatusClasses(
                status,
            )}"
        >
            {status}
        </span>
    </div>
    <div class="mb-6 flex-1 font-sans">
        <div
            class="flex items-center text-sm text-black dark:text-gray-400 mb-2"
        >
            <span
                class="material-symbols-outlined text-base mr-2 text-secondary"
                >history</span
            >
            Last interaction: {lastInteraction}
        </div>
        <div class="flex items-center text-sm text-black dark:text-gray-400">
            <span
                class="material-symbols-outlined text-base mr-2 text-secondary"
                >photo_library</span
            >
            Memory Bank: {memoryBankStatus}
        </div>
    </div>
    <div
        class="flex space-x-3 pt-4 border-t border-gray-100 dark:border-gray-700 font-display"
    >
        <button
            onclick={() => goto(`/gallery?replicaId=${replicaId}`)}
            class="flex-1 py-2 px-4 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-black dark:text-white font-medium text-sm transition-colors text-center border border-gray-200 dark:border-gray-600"
        >
            View Gallery
        </button>
        <button
            onclick={() => goto(`/create-replicas?id=${replicaId}`)}
            class="flex-1 py-2 px-4 rounded-lg bg-primary hover:bg-primary-hover text-white font-medium text-sm transition-colors text-center shadow-md"
        >
            Manage AI
        </button>
    </div>
</article>
