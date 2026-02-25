<script>
    import { browser } from "$app/environment";
    import { goto } from "$app/navigation";
    import { isAuthenticated, verifyAuth } from "$lib/auth.js";

    import PatientHeader from "$lib/components/patient/PatientHeader.svelte";
    import PatientChat from "$lib/components/patient/PatientChat.svelte";
    import PhotoGallery from "$lib/components/patient/PhotoGallery.svelte";

    let isAuth = $state(false);
    let authChecked = $state(false);
    let userName = $state("Margaret"); // Shared state context

    $effect(() => {
        if (browser && !authChecked) {
            verifyAuth().then((user) => {
                isAuth = isAuthenticated();
                authChecked = true;
                if (!isAuth) {
                    goto("/login");
                } else if (user && user.firstName) {
                    userName = user.firstName;
                }
            });
        }
    });
</script>

<svelte:head>
    <title>Memory Lane - Chat with Guide</title>
</svelte:head>

<!-- We apply min-h-screen to ensure the page fills the browser -->
<div
    class="min-h-screen bg-background-light dark:bg-slate-950 flex flex-col font-display text-slate-900 dark:text-slate-100"
>
    {#if isAuth}
        <!-- Navigation Header -->
        <PatientHeader {userName} />

        <main
            class="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12"
        >
            <!-- Split Screen layout for the portal -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 h-full">
                <!-- Left Column: Patient Chat (Anna Guide) -->
                <section class="h-full" aria-label="Chat Area">
                    <PatientChat {userName} />
                </section>

                <!-- Right Column: Patient Gallery -->
                <section
                    class="h-full pt-8 lg:pt-0"
                    aria-label="Photo Gallery View"
                >
                    <PhotoGallery />
                </section>
            </div>
        </main>
    {:else}
        <div class="flex items-center justify-center flex-1">
            <div class="animate-pulse flex flex-col items-center">
                <div
                    class="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"
                ></div>
                <p class="mt-4 text-primary font-medium">
                    Loading your portal...
                </p>
            </div>
        </div>
    {/if}
</div>
