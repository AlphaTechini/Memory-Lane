<script>
    export let title = "";
    export let value = "";
    export let subtitle = "";
    export let highlightText = "";
    export let highlightColor = "green"; // 'green' | 'blue' | 'yellow'
    export let isSpecial = false; // true for "System Health" card

    const highlightColors = {
        green: "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300",
        blue: "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300",
        yellow: "bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300",
    };
</script>

{#if isSpecial}
    <div
        class="bg-primary dark:bg-gray-800 p-8 rounded-2xl shadow-md text-white flex flex-col justify-between h-52 relative overflow-hidden"
    >
        <div class="absolute -right-4 -top-4 opacity-10">
            <!-- Decorative background pattern replacing SVG -->
            <span class="material-symbols-outlined text-9xl">auto_awesome</span>
        </div>
        <div class="z-10">
            <span
                class="text-white/80 font-medium uppercase tracking-wider text-xs font-display"
                >{title}</span
            >
        </div>
        <div
            class="z-10 text-center flex flex-col items-center justify-center h-full pt-4"
        >
            <!-- Reduced font size to prevent overflow (text-xl to text-2xl), centered -->
            <h3
                class="text-xl lg:text-2xl font-serif font-bold mb-2 leading-tight px-1"
            >
                {value}
            </h3>
            <p class="text-white/90 font-medium text-xs font-sans">
                {subtitle}
            </p>
        </div>
    </div>
{:else}
    <div
        class="bg-surface-light dark:bg-surface-dark p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between h-52 transition-shadow hover:shadow-md"
    >
        <div class="flex justify-between items-start">
            <span
                class="text-black font-medium uppercase tracking-wider text-xs font-display"
                >{title}</span
            >
            {#if highlightText}
                <span
                    class="{highlightColors[
                        highlightColor
                    ]} px-2 py-1 rounded-md text-xs font-bold"
                    >{highlightText}</span
                >
            {/if}
        </div>
        <div>
            <h3
                class="text-4xl lg:text-5xl font-serif font-bold text-black mb-2"
            >
                {value}
            </h3>
            <p class="text-black font-medium font-sans">
                {subtitle}
            </p>
        </div>
    </div>
{/if}
