<script>
    let {
        conversations = 0,
        newMemories = 0,
        activeReplicas = 0,
        lastSync = "n/a",
    } = $props();
</script>

<section class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
    <!-- Stat 1 -->
    <div
        class="bg-surface-light dark:bg-surface-dark p-8 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col justify-between h-48"
    >
        <div class="flex justify-between items-start">
            <span
                class="text-gray-700 dark:text-gray-300 font-bold uppercase tracking-wider text-sm"
                >Weekly Activity</span
            >
            <span
                class="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded-md text-xs font-bold"
                >+12%</span
            >
        </div>
        <div>
            <h3
                class="text-5xl font-serif font-bold text-primary dark:text-white mb-2"
            >
                {conversations}
            </h3>
            <p class="text-gray-800 dark:text-gray-200 font-semibold">
                Conversations generated
            </p>
        </div>
    </div>

    <!-- Stat 2 -->
    <div
        class="bg-surface-light dark:bg-surface-dark p-8 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col justify-between h-48"
    >
        <div class="flex justify-between items-start">
            <span
                class="text-gray-700 dark:text-gray-300 font-bold uppercase tracking-wider text-sm"
                >Memory Ingestion</span
            >
            <span
                class="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-md text-xs font-bold"
                >New</span
            >
        </div>
        <div>
            <h3
                class="text-5xl font-serif font-bold text-primary dark:text-white mb-2"
            >
                {newMemories}
            </h3>
            <p class="text-gray-800 dark:text-gray-200 font-semibold">
                New Memories Uploaded
            </p>
        </div>
    </div>

    <!-- Stat 3 -->
    <div
        class="bg-surface-light dark:bg-surface-dark p-8 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col justify-between h-48"
    >
        <div class="flex justify-between items-start">
            <span
                class="text-gray-700 dark:text-gray-300 font-bold uppercase tracking-wider text-sm"
                >Patient Status</span
            >
        </div>
        <div>
            <h3
                class="text-5xl font-serif font-bold text-primary dark:text-white mb-2"
            >
                {activeReplicas}
            </h3>
            <p class="text-gray-800 dark:text-gray-200 font-semibold">
                Active Replicas
            </p>
        </div>
    </div>

    <!-- Stat 4 -->
    <div
        class="bg-primary dark:bg-gray-800 p-8 rounded-xl shadow-md text-white flex flex-col justify-between h-48 relative overflow-hidden"
    >
        <div class="absolute -right-4 -top-4 opacity-10">
            <span class="material-symbols-outlined text-9xl">auto_awesome</span>
        </div>
        <div class="z-10">
            <span class="text-white font-bold uppercase tracking-wider text-sm"
                >System Health</span
            >
        </div>
        <div class="z-10">
            <h3 class="text-3xl font-serif font-bold mb-2">Operational</h3>
            <p class="text-white font-bold text-sm">
                Last sync: {lastSync}
            </p>
        </div>
    </div>
</section>
