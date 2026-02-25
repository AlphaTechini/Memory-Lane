<script>
    import { browser } from "$app/environment";
    import { goto } from "$app/navigation";
    import { isAuthenticated, verifyAuth } from "$lib/auth.js";

    import PatientHeader from "$lib/components/patient/PatientHeader.svelte";
    import PatientJournals from "$lib/components/patient/PatientJournals.svelte";

    let isAuth = $state(false);
    let authChecked = $state(false);
    let userName = $state("Margaret");

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
    <title>Memory Lane - Read Journals</title>
</svelte:head>

<div
    class="min-h-screen bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100"
>
    {#if isAuth}
        <!-- Patient Header -->
        <PatientHeader {userName} />

        <!-- Main content area -->
        <main class="w-full">
            <PatientJournals {userName} />
        </main>
    {:else}
        <div class="flex items-center justify-center min-h-[50vh]">
            <div class="animate-pulse flex flex-col items-center">
                <div
                    class="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"
                ></div>
            </div>
        </div>
    {/if}
</div>
