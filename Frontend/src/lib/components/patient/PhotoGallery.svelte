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
            class="material-symbols-outlined text-4xl text-primary dark:text-blue-400"
            >photo_library</span
        >
        <h3
            class="text-3xl sm:text-4xl font-serif font-bold text-slate-800 dark:text-white"
        >
            Your Family Album
        </h3>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 flex-1 auto-rows-max">
        {#each photos as photo}
            <article
                class="group relative bg-white dark:bg-slate-800 rounded-3xl overflow-hidden shadow-lg border border-slate-100 dark:border-slate-700 transition-transform hover:-translate-y-1 hover:shadow-xl cursor-pointer"
            >
                <div class="aspect-square w-full overflow-hidden">
                    <img
                        alt={photo.alt}
                        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        src={photo.src}
                    />
                </div>
                <div
                    class="p-6 text-center bg-white/95 dark:bg-slate-900/95 absolute bottom-0 w-full backdrop-blur-sm border-t border-slate-100 dark:border-slate-700"
                >
                    <p
                        class="font-serif text-xl sm:text-2xl font-bold text-slate-900 dark:text-white"
                    >
                        {photo.captionMain}
                    </p>
                    <p
                        class="text-base sm:text-lg text-slate-500 dark:text-slate-400 mt-1"
                    >
                        {photo.captionSub}
                    </p>
                </div>
            </article>
        {/each}
    </div>
</div>
