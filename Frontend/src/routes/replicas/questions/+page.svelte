<script>
    import { goto } from "$app/navigation";
    import { page } from "$app/state";
    import ThemeToggle from "$lib/components/ThemeToggle.svelte";

    const templateId = page.url.searchParams.get("template") || "dad";
    const templateName =
        templateId.charAt(0).toUpperCase() + templateId.slice(1);

    let q1 = $state("");
    let q2 = $state("");
    let q3 = $state("");

    let progress = $derived(() => {
        let count = 0;
        if (q1.trim()) count++;
        if (q2.trim()) count++;
        if (q3.trim()) count++;
        return Math.round((count / 3) * 60) + 40; // Starts at 40% as per design
    });

    function handleBack() {
        goto("/replicas/templates");
    }

    function handleSave() {
        // Logic to save questions would go here
        console.log("Saving questions:", { q1, q2, q3 });
        goto("/dashboard"); // Or next step
    }
</script>

<svelte:head>
    <title>Personalizing {templateName}'s Replica - Memory Lane</title>
</svelte:head>

<div
    class="relative flex min-h-screen flex-col overflow-x-hidden bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 antialiased font-display"
>
    <!-- Top Navigation -->
    <header
        class="sticky top-0 z-50 w-full border-b border-primary/10 bg-background-light/80 backdrop-blur-md dark:bg-background-dark/80"
    >
        <div
            class="mx-auto flex max-w-4xl items-center justify-between px-6 py-4"
        >
            <div class="flex items-center gap-3">
                <div
                    class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white"
                >
                    <span class="material-symbols-outlined">memory</span>
                </div>
                <h2
                    class="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100"
                >
                    Personalizing {templateName}'s Replica
                </h2>
            </div>
            <div class="flex items-center gap-4">
                <ThemeToggle />
                <button
                    onclick={() => goto("/dashboard")}
                    class="group flex h-10 w-10 items-center justify-center rounded-full bg-slate-200/50 transition-colors hover:bg-slate-200 dark:bg-slate-800/50 dark:hover:bg-slate-800"
                >
                    <span
                        class="material-symbols-outlined text-slate-600 dark:text-slate-400"
                        >close</span
                    >
                </button>
            </div>
        </div>
    </header>

    <main class="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <!-- Progress Indicator -->
        <div class="mb-16">
            <div class="mb-3 flex items-end justify-between">
                <div>
                    <span
                        class="text-xs font-bold uppercase tracking-widest text-primary"
                        >Step 2 of 5</span
                    >
                    <h3
                        class="text-sm font-medium text-slate-500 dark:text-slate-400"
                    >
                        Profile Completion
                    </h3>
                </div>
                <p class="text-2xl font-bold text-primary">{progress()}%</p>
            </div>
            <div
                class="h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
            >
                <div
                    class="h-full rounded-full bg-primary transition-all duration-500"
                    style="width: {progress()}%;"
                ></div>
            </div>
        </div>

        <!-- Content Form -->
        <div class="space-y-20">
            <!-- Question 1 -->
            <section class="space-y-6">
                <div class="space-y-2">
                    <label
                        class="text-3xl font-bold leading-tight tracking-tight text-slate-900 dark:text-slate-100"
                    >
                        What life lessons does {templateName} repeat often?
                    </label>
                    <p class="text-lg text-slate-500 dark:text-slate-400">
                        Think of the phrases or wisdom he shares at the dinner
                        table.
                    </p>
                </div>
                <div class="group relative">
                    <textarea
                        bind:value={q1}
                        class="custom-scrollbar min-h-[180px] w-full resize-none rounded-xl border-2 border-slate-200 bg-white dark:bg-slate-900 p-6 text-xl leading-relaxed text-slate-900 dark:text-slate-100 outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/5 dark:border-slate-800 dark:focus:border-primary"
                        placeholder="e.g., Always be on time, work hard, and never forget where you came from..."
                    ></textarea>
                    <div
                        class="absolute bottom-4 right-4 text-xs font-medium text-slate-400"
                    >
                        Voice input available
                    </div>
                </div>
            </section>

            <!-- Question 2 -->
            <section class="space-y-6">
                <div class="space-y-2">
                    <label
                        class="text-3xl font-bold leading-tight tracking-tight text-slate-900 dark:text-slate-100"
                    >
                        What are {templateId === "dad" ||
                        templateId === "brother"
                            ? "his"
                            : "her"} main hobbies?
                    </label>
                    <p class="text-lg text-slate-500 dark:text-slate-400">
                        What makes {templateId === "dad" ||
                        templateId === "brother"
                            ? "him"
                            : "her"} lose track of time on a Saturday afternoon?
                    </p>
                </div>
                <div class="group relative">
                    <textarea
                        bind:value={q2}
                        class="custom-scrollbar min-h-[180px] w-full resize-none rounded-xl border-2 border-slate-200 bg-white dark:bg-slate-900 p-6 text-xl leading-relaxed text-slate-900 dark:text-slate-100 outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/5 dark:border-slate-800 dark:focus:border-primary"
                        placeholder="e.g., Restoring classic cars, fly fishing in the mountains, or tending to heirloom tomatoes..."
                    ></textarea>
                </div>
            </section>

            <!-- Question 3 -->
            <section class="space-y-6">
                <div class="space-y-2">
                    <label
                        class="text-3xl font-bold leading-tight tracking-tight text-slate-900 dark:text-slate-100"
                    >
                        Tell us a specific story that defines {templateId ===
                            "dad" || templateId === "brother"
                            ? "him"
                            : "her"}.
                    </label>
                    <p class="text-lg text-slate-500 dark:text-slate-400">
                        A moment that perfectly captures {templateId ===
                            "dad" || templateId === "brother"
                            ? "his"
                            : "her"} character.
                    </p>
                </div>
                <div class="group relative">
                    <textarea
                        bind:value={q3}
                        class="custom-scrollbar min-h-[180px] w-full resize-none rounded-xl border-2 border-slate-200 bg-white dark:bg-slate-900 p-6 text-xl leading-relaxed text-slate-900 dark:text-slate-100 outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/5 dark:border-slate-800 dark:focus:border-primary"
                        placeholder="Start writing the story here..."
                    ></textarea>
                </div>
            </section>
        </div>

        <!-- Footer Actions -->
        <div
            class="mt-24 flex flex-col items-center gap-6 border-t border-slate-200 pt-12 dark:border-slate-800 sm:flex-row sm:justify-between"
        >
            <button
                onclick={handleBack}
                class="flex items-center gap-2 px-8 py-4 text-lg font-semibold text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
                <span class="material-symbols-outlined">arrow_back</span>
                Back
            </button>
            <div class="flex flex-col gap-4 sm:flex-row">
                <button
                    onclick={() => goto("/dashboard")}
                    class="rounded-full bg-slate-200 px-10 py-4 text-lg font-bold text-slate-700 transition-all hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                    Skip for now
                </button>
                <button
                    onclick={handleSave}
                    class="group flex items-center justify-center gap-2 rounded-full bg-primary px-12 py-4 text-lg font-bold text-white shadow-xl shadow-primary/20 transition-all hover:scale-105 hover:bg-primary/90 active:scale-95"
                >
                    Save & Continue
                    <span
                        class="material-symbols-outlined transition-transform group-hover:translate-x-1"
                        >arrow_forward</span
                    >
                </button>
            </div>
        </div>
        <p class="mt-12 text-center text-sm text-slate-400 dark:text-slate-500">
            Your progress is automatically saved.
        </p>
    </main>

    <!-- Helpful Tip Floating Card -->
    <aside
        class="fixed bottom-8 left-8 hidden w-64 rounded-xl border border-primary/10 bg-white p-4 shadow-2xl dark:bg-slate-900 lg:block"
    >
        <div class="mb-2 flex items-center gap-2 text-primary">
            <span class="material-symbols-outlined text-sm">lightbulb</span>
            <span class="text-xs font-bold uppercase tracking-wider"
                >Design Tip</span
            >
        </div>
        <p class="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            Be as descriptive as possible. These details help create a more
            authentic replica of your {templateId}'s personality.
        </p>
    </aside>
</div>

<style>
    .custom-scrollbar::-webkit-scrollbar {
        width: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: #0f49bd20;
        border-radius: 10px;
    }
</style>
