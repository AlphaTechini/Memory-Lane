<script>
    import { goto } from "$app/navigation";

    let {
        name = "Unknown",
        id = "#0000",
        status = "Active",
        lastInteraction = "Unknown",
        memoryBank = "Processing...",
        imageSrc = "/images/dashboard/patient-1.jpg",
    } = $props();

    const statusColors = {
        Active: {
            bg: "bg-[#E8F3E8] dark:bg-green-900/30",
            text: "text-[#4A6B4A] dark:text-green-300",
        },
        Syncing: {
            bg: "bg-yellow-100 dark:bg-yellow-900/30",
            text: "text-yellow-800 dark:text-yellow-300",
        },
    };

    let colors = $derived(statusColors[status] || statusColors["Active"]);

    function handleViewGallery() {
        goto("/gallery");
    }

    function handleManageAI() {
        goto("/create-replicas");
    }
</script>

<article
    class="bg-surface-light dark:bg-surface-dark rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6 flex flex-col justify-between transition-transform hover:-translate-y-1 duration-300 min-h-[250px] relative h-full"
>
    <div>
        <div
            class="flex flex-col sm:flex-row justify-between items-start mb-6 gap-4"
        >
            <div class="flex items-center space-x-4">
                <img
                    alt={name}
                    class="w-16 h-16 rounded-full object-cover border-2 border-white dark:border-gray-600 shadow-sm shrink-0"
                    src={imageSrc}
                />
                <div class="flex flex-col">
                    <h3
                        class="text-xl font-serif font-bold text-text-light dark:text-text-dark"
                    >
                        {name}
                    </h3>
                    <p
                        class="text-sm text-gray-600 dark:text-gray-400 font-medium"
                    >
                        ID: {id}
                    </p>
                </div>
            </div>
            <span
                class="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide self-start sm:self-auto {colors.bg} {colors.text}"
            >
                {status}
            </span>
        </div>

        <div class="mb-6">
            <div
                class="flex items-center text-sm text-gray-700 dark:text-gray-300 mb-2 font-medium break-words md:break-normal"
            >
                <span
                    class="material-symbols-outlined text-base mr-2 text-secondary shrink-0"
                    >history</span
                >
                <span
                    class="truncate"
                    title="Last interaction: {lastInteraction}"
                    >Last interaction: {lastInteraction}</span
                >
            </div>
            <div
                class="flex items-center text-sm text-gray-700 dark:text-gray-300 font-medium break-words md:break-normal"
            >
                <span
                    class="material-symbols-outlined text-base mr-2 text-secondary shrink-0"
                    >photo_library</span
                >
                <span class="truncate" title="Memory Bank: {memoryBank}"
                    >Memory Bank: {memoryBank}</span
                >
            </div>
        </div>
    </div>

    <div
        class="flex space-x-3 pt-4 border-t border-gray-100 dark:border-gray-700 mt-auto"
    >
        <button
            onclick={handleViewGallery}
            class="flex-1 py-2 px-3 sm:px-4 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-text-light dark:text-text-dark font-semibold text-sm transition-colors text-center border border-gray-200 dark:border-gray-600"
        >
            View Gallery
        </button>
        <button
            onclick={handleManageAI}
            class="flex-1 py-2 px-3 sm:px-4 rounded-lg bg-primary hover:bg-primary-hover text-white font-semibold text-sm transition-colors text-center shadow"
        >
            Manage AI
        </button>
    </div>
</article>
