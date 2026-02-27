<script>
    import { goto } from "$app/navigation";

    let {
        userName = "User",
        reminder = "You have no more events scheduled for today. Rest well!",
    } = $props();

    // Getting the current date for the reminder
    const dateOptions = { weekday: "long", month: "long", day: "numeric" };
    let today = new Date().toLocaleDateString("en-US", dateOptions);
</script>

<div class="max-w-5xl mx-auto w-full px-6 py-10">
    <!-- Greeting -->
    <div class="mb-12 text-center md:text-left">
        <h1
            class="text-slate-900 dark:text-white text-5xl md:text-6xl font-bold font-serif mb-4"
        >
            Hello, {userName}.
        </h1>
        <div
            class="flex items-center justify-center md:justify-start gap-3 text-primary dark:text-secondary font-bold text-xl md:text-2xl"
        >
            <span class="material-symbols-outlined text-3xl">wb_sunny</span>
            <p>It's a beautiful {today.split(",")[0]} morning.</p>
        </div>
    </div>

    <!-- Dashboard Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
        <!-- Tile: Write a Journal (Placeholder) -->
        <button
            class="group flex flex-col items-center justify-center p-10 bg-white dark:bg-slate-800 rounded-xl shadow-lg border-2 border-transparent focus:border-primary hover:border-primary transition-all text-left"
        >
            <div
                class="h-24 w-24 bg-primary/20 text-primary dark:text-white rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"
            >
                <span
                    class="material-symbols-outlined text-6xl"
                    style="font-variation-settings: 'FILL' 1">edit_note</span
                >
            </div>
            <div class="text-center">
                <h3
                    class="text-slate-950 dark:text-white text-3xl font-bold font-serif mb-2"
                >
                    Write a Journal
                </h3>
                <p class="text-slate-800 dark:text-slate-200 text-xl font-bold">
                    Record your special day
                </p>
            </div>
        </button>

        <!-- Tile: Read My Journals -->
        <button
            onclick={() => goto("/journals")}
            class="group flex flex-col items-center justify-center p-10 bg-white dark:bg-slate-800 rounded-xl shadow-lg border-2 border-transparent focus:border-secondary hover:border-secondary transition-all text-left"
        >
            <div
                class="h-24 w-24 bg-secondary/20 text-secondary dark:text-secondary-light rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"
            >
                <span
                    class="material-symbols-outlined text-6xl"
                    style="font-variation-settings: 'FILL' 1">auto_stories</span
                >
            </div>
            <div class="text-center">
                <h3
                    class="text-slate-950 dark:text-white text-3xl font-bold font-serif mb-2"
                >
                    Read My Journals
                </h3>
                <p class="text-slate-800 dark:text-slate-200 text-xl font-bold">
                    Revisit your memories
                </p>
            </div>
        </button>

        <!-- Tile: View Photos -->
        <button
            onclick={() => goto("/gallery")}
            class="group flex flex-col items-center justify-center p-10 bg-white dark:bg-slate-800 rounded-xl shadow-lg border-2 border-transparent focus:border-primary hover:border-primary transition-all text-left"
        >
            <div
                class="h-24 w-24 bg-primary/20 text-primary dark:text-white rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"
            >
                <span
                    class="material-symbols-outlined text-6xl"
                    style="font-variation-settings: 'FILL' 1"
                    >photo_library</span
                >
            </div>
            <div class="text-center">
                <h3
                    class="text-slate-950 dark:text-white text-3xl font-bold font-serif mb-2"
                >
                    View Photos
                </h3>
                <p class="text-slate-800 dark:text-slate-200 text-xl font-bold">
                    See your favorite pictures
                </p>
            </div>
        </button>

        <!-- Tile: Chat with My Guide -->
        <button
            onclick={() => goto("/portal")}
            class="group flex flex-col items-center justify-center p-10 bg-white dark:bg-slate-800 rounded-xl shadow-lg border-2 border-transparent focus:border-secondary hover:border-secondary transition-all text-left"
        >
            <div
                class="h-24 w-24 bg-secondary/20 text-secondary dark:text-secondary-light rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"
            >
                <span
                    class="material-symbols-outlined text-6xl"
                    style="font-variation-settings: 'FILL' 1">forum</span
                >
            </div>
            <div class="text-center">
                <h3
                    class="text-slate-950 dark:text-white text-3xl font-bold font-serif mb-2"
                >
                    Chat with My Guide
                </h3>
                <p class="text-slate-800 dark:text-slate-200 text-xl font-bold">
                    Talk to your friendly assistant
                </p>
            </div>
        </button>
    </div>

    <!-- Reminder Section -->
    <div
        class="mt-16 p-10 bg-primary/10 dark:bg-primary/20 rounded-xl border-l-8 border-primary shadow-md"
    >
        <h2
            class="text-primary dark:text-white text-3xl font-bold font-serif mb-4"
        >
            Daily Reminder
        </h2>
        <div class="flex items-start gap-4">
            <span
                class="material-symbols-outlined text-4xl text-primary dark:text-white mt-1"
                >lightbulb</span
            >
            <p
                class="text-slate-900 dark:text-slate-100 text-2xl font-semibold leading-relaxed"
            >
                Today is {today}. {reminder}
            </p>
        </div>
    </div>
</div>

<!-- Footer -->
<footer
    class="mt-auto py-10 px-6 text-center text-slate-700 dark:text-slate-300 text-lg font-bold"
>
    <p>Always here to help you remember. © 2024 Memory Lane</p>
</footer>
