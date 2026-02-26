<script>
    const photos = [
        {
            src: "/images/patient-portal/family-1.jpg",
            alt: "Granddaughter Sarah smiling outdoors",
            captionMain: "Granddaughter, Sarah",
            captionSub: "Age 24",
        },
        {
            src: "/images/patient-portal/family-2.jpg",
            alt: "Son Robert portrait",
            captionMain: "Your Son, Robert",
            captionSub: "Visited yesterday",
        },
        {
            src: "/images/patient-portal/family-3.jpg",
            alt: "Family dog Buster",
            captionMain: "Buster the Dog",
            captionSub: "He loves treats",
        },
        {
            src: "/images/patient-portal/family-4.jpg",
            alt: "Great-granddaughter Lily",
            captionMain: "Little Lily",
            captionSub: "Age 6",
        },
    ];
</script>

<div class="flex flex-col h-full bg-transparent">
    <div class="flex items-center gap-4 mb-6 px-2">
        <span
            class="material-symbols-outlined text-4xl text-primary dark:text-secondary"
            >photo_library</span
        >
        <h3
            class="text-3xl sm:text-4xl font-serif font-bold text-text-light dark:text-text-dark"
        >
            Your Family Album
        </h3>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 flex-1 auto-rows-max">
        {#each photos as photo}
            <article
                class="group relative bg-surface-light dark:bg-surface-dark rounded-[24px] overflow-hidden shadow-lg border border-cream-200 dark:border-charcoal-700 transition-transform hover:-translate-y-1 hover:shadow-xl cursor-pointer"
            >
                <div class="aspect-square w-full overflow-hidden">
                    <img
                        alt={photo.alt}
                        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        src={photo.src}
                    />
                </div>
                <div
                    class="p-6 text-center bg-surface-light/95 dark:bg-surface-dark/95 absolute bottom-0 w-full backdrop-blur-sm border-t border-cream-200 dark:border-charcoal-700"
                >
                    <p
                        class="text-accessible-lg sm:text-2xl font-bold text-text-light dark:text-text-dark"
                    >
                        {photo.captionMain}
                    </p>
                    <p
                        class="text-base sm:text-lg text-charcoal-600 dark:text-cream-400 mt-1"
                    >
                        {photo.captionSub}
                    </p>
                </div>
            </article>
        {/each}
    </div>
</div>
