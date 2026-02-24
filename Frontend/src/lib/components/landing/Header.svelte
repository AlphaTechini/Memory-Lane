<script>
    // Props can be added later if dynamic routing is needed
    // export let isLoggedIn = false;
</script>

<header
    class="flex items-center justify-between whitespace-nowrap border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm sticky top-0 z-50 px-6 py-4 md:px-10 lg:px-40"
>
    <div class="flex items-center gap-4">
        <div class="size-8 text-primary dark:text-blue-400">
            <span class="material-symbols-outlined text-4xl">psychology</span>
        </div>
        <h2
            class="text-primary dark:text-white text-2xl font-bold leading-tight tracking-tight"
        >
            Memory Lane
        </h2>
    </div>
    <nav class="hidden md:flex items-center gap-8">
        <a
            class="text-slate-700 dark:text-slate-300 hover:text-primary dark:hover:text-blue-300 text-sm font-medium transition-colors font-display"
            href="#how-it-works">How it Works</a
        >
        <a
            class="text-slate-700 dark:text-slate-300 hover:text-primary dark:hover:text-blue-300 text-sm font-medium transition-colors font-display"
            href="#security">Security</a
        >
        <a
            class="text-slate-700 dark:text-slate-300 hover:text-primary dark:hover:text-blue-300 text-sm font-medium transition-colors font-display"
            href="#for-doctors">For Doctors</a
        >
    </nav>
    <div class="flex items-center gap-4">
        <a
            class="hidden sm:block text-slate-700 dark:text-slate-300 hover:text-primary dark:hover:text-blue-300 text-sm font-medium transition-colors font-display"
            href="/login">Log In</a
        >
        <a
            href="/signup"
            class="flex cursor-pointer items-center justify-center overflow-hidden rounded-full h-10 px-6 bg-primary hover:bg-primary/90 transition-colors text-white text-sm font-bold tracking-wide font-display shadow-lg shadow-blue-900/10"
        >
            <span class="truncate">Get Started</span>
        </a>
    </div>
</header>
