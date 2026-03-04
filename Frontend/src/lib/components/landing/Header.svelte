<script>
    // Props can be added later if dynamic routing is needed
    // export let isLoggedIn = false;
</script>

<header
    class="flex items-center justify-between whitespace-nowrap border-b border-blue-900/50 bg-[#0F2C59] backdrop-blur-sm sticky top-0 z-50 px-6 py-4 md:px-10 lg:px-40"
>
    <div class="flex items-center gap-4">
        <div class="size-8 text-white">
            <span class="material-symbols-outlined text-4xl">psychology</span>
        </div>
        <h2 class="text-white text-2xl font-bold leading-tight tracking-tight">
            Memory Lane
        </h2>
    </div>
    <nav class="hidden md:flex items-center gap-8">
        <a
            class="text-blue-100 hover:text-white text-sm font-medium transition-colors font-display"
            href="#how-it-works">How it Works</a
        >
        <a
            class="text-blue-100 hover:text-white text-sm font-medium transition-colors font-display"
            href="#security">Security</a
        >
        <a
            class="text-blue-100 hover:text-white text-sm font-medium transition-colors font-display"
            href="#for-doctors">For Doctors</a
        >
    </nav>
    <div class="flex items-center gap-4">
        <a
            class="hidden sm:block text-blue-100 hover:text-white text-sm font-medium transition-colors font-display"
            href="/login">Log In</a
        >
        <a
            href="/signup"
            class="flex cursor-pointer items-center justify-center overflow-hidden rounded-full h-10 px-6 bg-white hover:bg-blue-50 transition-colors text-[#0F2C59] text-sm font-bold tracking-wide font-display shadow-lg"
        >
            <span class="truncate">Get Started</span>
        </a>
    </div>
</header>
