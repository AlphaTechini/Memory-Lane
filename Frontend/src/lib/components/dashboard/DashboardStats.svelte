<script>
    // Stats component for the dashboard header
</script>

<section class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
    <!-- Stat 1 -->
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

    <!-- Stat 2 -->
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

    <!-- Stat 3 -->
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

    <!-- Stat 4 -->
    <div
        class="bg-primary dark:bg-gray-800 p-8 rounded-xl shadow-md text-white flex flex-col justify-between h-48 relative overflow-hidden"
    >
        <div class="absolute -right-4 -top-4 opacity-10">
            <span class="material-symbols-outlined text-9xl">auto_awesome</span>
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
