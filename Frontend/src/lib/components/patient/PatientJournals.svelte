<script>
    import { goto } from "$app/navigation";

    let { userName = "Margaret" } = $props();

    const journals = [
        {
            id: 1,
            date: "Monday, October 12, 2023",
            imageUrl: "/images/patient-portal/journal-1.jpg",
            imageAlt: "Beautiful sunny beach at sunset with golden waves",
            summary:
                "Today I visited the old park where we used to play. The autumn leaves were turning gold and red, reminding me of our many walks together. The air was crisp and smelled like pine...",
        },
        {
            id: 2,
            date: "Saturday, October 10, 2023",
            imageUrl: "/images/patient-portal/journal-2.jpg",
            imageAlt: "Steaming cup of coffee and breakfast on a rustic table",
            summary:
                "We had Sunday brunch with the whole family today. Sarah brought her newborn son, and seeing him smile brought back so many memories of when the kids were young. We laughed until our sides hurt...",
        },
        {
            id: 3,
            date: "Wednesday, October 7, 2023",
            imageUrl: "/images/patient-portal/journal-3.jpg",
            imageAlt: "Misty mountain landscape with pine trees",
            summary:
                "Woke up feeling very peaceful this morning. I spent some time in the garden looking at the blue jays. It was a quiet day, but sometimes the quietest days are the most meaningful...",
        },
    ];
</script>

<div class="flex flex-col max-w-[800px] w-full mx-auto px-4 md:px-0">
    <!-- Page Header & Back Button -->
    <div class="flex flex-col gap-6 mb-8 mt-8">
        <div>
            <button
                onclick={() => goto("/dashboard")}
                class="flex items-center justify-center rounded-xl h-14 px-6 bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 min-w-[120px] max-w-fit gap-3 text-lg font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
            >
                <span class="material-symbols-outlined">arrow_back</span>
                <span>Back</span>
            </button>
        </div>
        <div class="flex flex-col gap-2">
            <h1
                class="font-serif text-slate-900 dark:text-white text-5xl md:text-6xl font-bold leading-tight tracking-tight"
            >
                Your Journal
            </h1>
            <p class="text-slate-600 dark:text-slate-400 text-xl font-normal">
                Revisit your favorite moments and daily reflections.
            </p>
        </div>
    </div>

    <!-- Journal Entry Cards -->
    <div class="flex flex-col gap-8 mb-12">
        {#each journals as journal}
            <div
                class="group flex flex-col items-stretch justify-start rounded-xl overflow-hidden shadow-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-transform hover:scale-[1.01]"
            >
                <div
                    class="w-full bg-center bg-no-repeat aspect-[21/9] bg-cover bg-slate-200 dark:bg-slate-800"
                    aria-label={journal.imageAlt}
                    style="background-image: url('{journal.imageUrl}');"
                ></div>
                <div class="flex w-full flex-col p-8 gap-4">
                    <div class="flex flex-col gap-1">
                        <span
                            class="text-primary dark:text-blue-400 font-bold text-sm uppercase tracking-widest"
                            >Entry from</span
                        >
                        <p
                            class="font-serif text-slate-900 dark:text-white text-3xl font-bold leading-tight"
                        >
                            {journal.date}
                        </p>
                    </div>
                    <p
                        class="text-slate-700 dark:text-slate-300 text-xl leading-relaxed font-serif"
                    >
                        {journal.summary}
                    </p>
                    <div
                        class="pt-4 border-t border-slate-100 dark:border-slate-800"
                    >
                        <button
                            class="flex w-full md:w-auto min-w-[160px] cursor-pointer items-center justify-center rounded-xl h-14 px-8 bg-primary dark:bg-blue-600 text-white text-lg font-bold hover:bg-primary-hover dark:hover:bg-blue-700 transition-colors"
                        >
                            <span>Read Full Entry</span>
                        </button>
                    </div>
                </div>
            </div>
        {/each}
    </div>

    <!-- Load More Button -->
    <div class="flex justify-center pb-16">
        <button
            class="flex items-center gap-3 text-primary dark:text-blue-400 font-bold text-xl hover:underline p-4 rounded-xl hover:bg-primary/5 transition-colors"
        >
            <span class="material-symbols-outlined">expand_more</span>
            See Older Entries
        </button>
    </div>
</div>
