<script>
    import { goto } from "$app/navigation";
    import ThemeToggle from "$lib/components/ThemeToggle.svelte";

    const templates = [
        {
            id: "dad",
            name: "Dad",
            emoji: "👨‍💼",
            description:
                "Protective, wise, and supportive. Emphasizes guidance and stability.",
            bg: "bg-ivory-warm",
        },
        {
            id: "mom",
            name: "Mom",
            emoji: "👩‍⚕️",
            description:
                "Nurturing, warm, and guiding. Focused on emotional intelligence and care.",
            bg: "bg-ivory-warm",
        },
        {
            id: "brother",
            name: "Brother",
            emoji: "🙋‍♂️",
            description:
                "Loyal, fun, and honest. Features a direct and energetic communication style.",
            bg: "bg-ivory-warm",
        },
        {
            id: "sister",
            name: "Sister",
            emoji: "🙋‍♀️",
            description:
                "Empathetic, close, and kind. Prioritizes deep connection and shared history.",
            bg: "bg-ivory-warm",
        },
        {
            id: "lover",
            name: "Lover",
            emoji: "❤️",
            description:
                "Deeply connected and romantic. Highly attuned to nuance and intimacy.",
            bg: "bg-ivory-warm",
        },
        {
            id: "friend",
            name: "Best Friend",
            emoji: "🤝",
            description:
                "Always there, understands you best. Balanced, reliable, and authentic.",
            bg: "bg-ivory-warm",
        },
    ];

    let selectedTemplate = $state(null);

    function selectTemplate(id) {
        selectedTemplate = id;
    }

    function handleInitialize() {
        if (selectedTemplate) {
            goto(`/replicas/questions?template=${selectedTemplate}`);
        }
    }
</script>

<svelte:head>
    <title>Choose Replica Template - Memory Lane</title>
</svelte:head>

<div
    class="relative flex min-h-screen flex-col bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display"
>
    <!-- Header / Navigation -->
    <header
        class="sticky top-0 z-50 w-full border-b border-slate-200/60 bg-white/80 backdrop-blur-md dark:bg-background-dark/80 dark:border-slate-800"
    >
        <div
            class="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between"
        >
            <div class="flex items-center gap-3">
                <div
                    class="size-10 bg-primary/10 rounded-xl flex items-center justify-center"
                >
                    <span
                        class="material-symbols-outlined text-primary text-2xl"
                        >clinical_notes</span
                    >
                </div>
                <h1
                    class="text-xl font-bold tracking-tight text-navy-deep dark:text-slate-100 uppercase tracking-widest text-sm"
                >
                    Bio-Digital Systems
                </h1>
            </div>
            <div class="flex items-center gap-4">
                <ThemeToggle />
                <button
                    class="p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                    <span
                        class="material-symbols-outlined text-slate-600 dark:text-slate-400"
                        >help_outline</span
                    >
                </button>
                <button
                    class="p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                    <span
                        class="material-symbols-outlined text-slate-600 dark:text-slate-400 text-2xl"
                        >settings</span
                    >
                </button>
            </div>
        </div>
    </header>

    <main class="flex-1 max-w-5xl mx-auto w-full px-6 py-12">
        <!-- Hero Section -->
        <div class="mb-16">
            <div
                class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sage-soft border border-emerald-100 text-emerald-700 text-xs font-semibold uppercase tracking-wider mb-6"
            >
                <span class="material-symbols-outlined text-[14px]"
                    >verified</span
                >
                Secure Neural Mapping
            </div>
            <h2
                class="text-5xl md:text-6xl font-extrabold text-navy-deep dark:text-slate-100 mb-6 tracking-tight leading-tight"
            >
                Create Your <span class="text-primary">Digital Replica</span>
            </h2>
            <p
                class="text-xl text-slate-500 dark:text-slate-400 max-w-2xl font-light leading-relaxed"
            >
                Build a sophisticated AI architecture that synthesizes your
                cognitive patterns, emotional intelligence, and unique
                communication style.
            </p>
        </div>

        <!-- Template Grid -->
        <div class="space-y-8">
            <div class="flex items-end justify-between">
                <div>
                    <h3
                        class="text-2xl font-bold text-navy-deep dark:text-slate-100"
                    >
                        Select Core Persona
                    </h3>
                    <p class="text-slate-500 text-sm mt-1">
                        Choose a baseline template to begin the calibration
                        process.
                    </p>
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {#each templates as template}
                    <button
                        onclick={() => selectTemplate(template.id)}
                        class="group relative text-left bg-white dark:bg-slate-900 border transition-all duration-300 cursor-pointer overflow-hidden rounded-2xl p-8 {selectedTemplate ===
                        template.id
                            ? 'border-primary ring-2 ring-primary/20 shadow-xl'
                            : 'border-slate-200 dark:border-slate-800 hover:shadow-2xl hover:shadow-primary/5'}"
                    >
                        <div
                            class="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors"
                        ></div>
                        <div class="relative">
                            <div
                                class="size-16 rounded-2xl {template.bg} dark:bg-slate-800 flex items-center justify-center text-4xl mb-6 shadow-sm"
                            >
                                {template.emoji}
                            </div>
                            <h4
                                class="text-xl font-bold text-navy-deep dark:text-white mb-2"
                            >
                                {template.name}
                            </h4>
                            <p
                                class="text-slate-500 dark:text-slate-400 text-sm leading-relaxed"
                            >
                                {template.description}
                            </p>
                        </div>
                        {#if selectedTemplate === template.id}
                            <div class="absolute bottom-4 right-4 text-primary">
                                <span class="material-symbols-outlined"
                                    >check_circle</span
                                >
                            </div>
                        {/if}
                    </button>
                {/each}
            </div>
        </div>

        <!-- Action Footer -->
        <div
            class="mt-16 p-8 bg-navy-deep rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl"
        >
            <div class="flex items-center gap-4 text-white">
                <div class="p-3 bg-white/10 rounded-xl backdrop-blur-sm">
                    <span class="material-symbols-outlined text-ivory-warm"
                        >neurology</span
                    >
                </div>
                <div>
                    <p class="font-bold text-lg">Next: Persona Customization</p>
                    <p class="text-slate-300 text-sm">
                        Fine-tune voice, vocabulary, and core memories.
                    </p>
                </div>
            </div>
            <button
                onclick={handleInitialize}
                disabled={!selectedTemplate}
                class="w-full md:w-auto px-10 py-4 bg-primary text-white rounded-xl font-bold text-lg shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Initialize Setup
                <span class="material-symbols-outlined">arrow_forward</span>
            </button>
        </div>

        <!-- Metadata Info -->
        <div
            class="mt-12 text-center text-slate-400 dark:text-slate-500 text-xs flex flex-wrap justify-center gap-x-8 gap-y-2 uppercase tracking-widest font-medium"
        >
            <div class="flex items-center gap-1">
                <span class="material-symbols-outlined text-[14px]">lock</span>
                E2E Encrypted
            </div>
            <div class="flex items-center gap-1">
                <span class="material-symbols-outlined text-[14px]">memory</span
                >
                Llama-3 Architecture
            </div>
            <div class="flex items-center gap-1">
                <span class="material-symbols-outlined text-[14px]"
                    >database</span
                >
                Private Node Deployment
            </div>
        </div>
    </main>

    <footer
        class="py-12 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-background-dark"
    >
        <div
            class="max-w-5xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6"
        >
            <div class="flex items-center gap-2">
                <div
                    class="size-6 bg-navy-deep rounded flex items-center justify-center"
                >
                    <span class="material-symbols-outlined text-white text-xs"
                        >analytics</span
                    >
                </div>
                <span
                    class="text-sm font-bold text-navy-deep dark:text-slate-100"
                    >BDS v4.2.0</span
                >
            </div>
            <div class="flex gap-8 text-sm text-slate-500 dark:text-slate-400">
                <a class="hover:text-primary transition-colors" href="#"
                    >Ethics Protocol</a
                >
                <a class="hover:text-primary transition-colors" href="#"
                    >Privacy Charter</a
                >
                <a class="hover:text-primary transition-colors" href="#"
                    >System Status</a
                >
            </div>
        </div>
    </footer>
</div>

<style>
    :global(body) {
        font-family: "Lexend", sans-serif;
    }
    .bg-ivory-warm {
        background-color: #fdfaf1;
    }
    .bg-sage-soft {
        background-color: #e8f5e9;
    }
    .text-navy-deep {
        color: #1a237e;
    }
    .bg-navy-deep {
        background-color: #1a237e;
    }
    .text-ivory-warm {
        color: #fdfaf1;
    }
</style>
