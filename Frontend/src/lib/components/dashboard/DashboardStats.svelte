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
        class="bg-gradient-to-br from-blue-950 to-blue-800 p-8 rounded-xl shadow-lg border border-blue-800/50 flex flex-col justify-between h-48 relative overflow-hidden text-white transition-transform hover:-translate-y-1 hover:shadow-xl duration-300"
    >
        <div class="absolute -right-4 -top-4 opacity-10">
            <span class="material-symbols-outlined text-9xl">forum</span>
        </div>
        <div class="flex justify-between items-start z-10">
            <span
                class="text-blue-100 font-bold uppercase tracking-wider text-sm"
                >Weekly Activity</span
            >
            <span
                class="bg-green-500/20 text-green-300 backdrop-blur-sm border border-green-500/30 px-2 py-1 rounded-md text-xs font-bold"
                >+12%</span
            >
        </div>
        <div class="z-10">
            <h3 class="text-5xl font-serif font-bold text-white mb-2">
                {conversations}
            </h3>
            <p class="text-blue-200 font-semibold">Conversations generated</p>
        </div>
    </div>

    <!-- Stat 2 -->
    <div
        class="bg-gradient-to-br from-indigo-950 to-indigo-800 p-8 rounded-xl shadow-lg border border-indigo-800/50 flex flex-col justify-between h-48 relative overflow-hidden text-white transition-transform hover:-translate-y-1 hover:shadow-xl duration-300"
    >
        <div class="absolute -right-4 -top-4 opacity-10">
            <span class="material-symbols-outlined text-9xl">memory</span>
        </div>
        <div class="flex justify-between items-start z-10">
            <span
                class="text-indigo-100 font-bold uppercase tracking-wider text-sm"
                >Memory Ingestion</span
            >
            <span
                class="bg-blue-500/20 text-blue-300 backdrop-blur-sm border border-blue-500/30 px-2 py-1 rounded-md text-xs font-bold"
                >New</span
            >
        </div>
        <div class="z-10">
            <h3 class="text-5xl font-serif font-bold text-white mb-2">
                {newMemories}
            </h3>
            <p class="text-indigo-200 font-semibold">New Memories Uploaded</p>
        </div>
    </div>

    <!-- Stat 3 -->
    <div
        class="bg-gradient-to-br from-slate-900 to-slate-800 p-8 rounded-xl shadow-lg border border-slate-700/50 flex flex-col justify-between h-48 relative overflow-hidden text-white transition-transform hover:-translate-y-1 hover:shadow-xl duration-300"
    >
        <div class="absolute -right-4 -top-4 opacity-10">
            <span class="material-symbols-outlined text-9xl">group</span>
        </div>
        <div class="flex justify-between items-start z-10">
            <span
                class="text-slate-300 font-bold uppercase tracking-wider text-sm"
                >Patient Status</span
            >
        </div>
        <div class="z-10">
            <h3 class="text-5xl font-serif font-bold text-white mb-2">
                {activeReplicas}
            </h3>
            <p class="text-slate-300 font-semibold">Active Replicas</p>
        </div>
    </div>

    <!-- Stat 4 -->
    <div
        class="bg-gradient-to-br from-cyan-950 to-cyan-800 p-8 rounded-xl shadow-lg border border-cyan-800/50 flex flex-col justify-between h-48 relative overflow-hidden text-white transition-transform hover:-translate-y-1 hover:shadow-xl duration-300"
    >
        <div class="absolute -right-4 -top-4 opacity-10">
            <span class="material-symbols-outlined text-9xl">auto_awesome</span>
        </div>
        <div class="z-10 flex-col flex justify-between h-full">
            <div>
                <span
                    class="text-cyan-100 font-bold uppercase tracking-wider text-sm"
                    >System Health</span
                >
            </div>
            <div>
                <h3 class="text-3xl font-serif font-bold text-white mb-2">
                    Operational
                </h3>
                <p class="text-cyan-200 font-bold text-sm">
                    Last sync: {lastSync}
                </p>
            </div>
        </div>
    </div>
</section>
