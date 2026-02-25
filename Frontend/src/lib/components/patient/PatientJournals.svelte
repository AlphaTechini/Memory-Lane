<script>
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";
    import { apiCall } from "$lib/auth";

    let { userName = "Margaret" } = $props();

    let journals = $state([]);
    let isLoading = $state(true);
    let isUploading = $state(false);
    let fileInput = $state(null);
    let uploadError = $state("");

    onMount(async () => {
        await loadJournals();
    });

    async function loadJournals() {
        isLoading = true;
        try {
            const response = await apiCall("/api/journals");
            const data = await response.json();
            if (data.success) {
                journals = data.journals;
            }
        } catch (error) {
            console.error("Failed to load journals:", error);
        } finally {
            isLoading = false;
        }
    }

    async function handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Reset file input
        event.target.value = "";

        // Validate file type
        const validTypes = [
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/msword",
            "text/plain",
        ];
        if (!validTypes.includes(file.type)) {
            uploadError = "Only PDF, DOCX, and TXT files are supported.";
            return;
        }

        uploadError = "";
        isUploading = true;

        const formData = new FormData();
        formData.append("file", file);
        formData.append("title", file.name);

        try {
            const response = await apiCall("/api/journals/upload", {
                method: "POST",
                body: formData,
            });
            const data = await response.json();

            if (data.success) {
                // Prepend new journal
                journals = [data.journal, ...journals];
            } else {
                uploadError = data.message || "Failed to upload journal.";
            }
        } catch (error) {
            console.error("Upload error:", error);
            uploadError = "Network error while uploading. Please try again.";
        } finally {
            isUploading = false;
        }
    }

    function triggerUpload() {
        if (fileInput) fileInput.click();
    }
</script>

<div class="flex flex-col max-w-[800px] w-full mx-auto px-4 md:px-0 relative">
    <!-- Page Header & Back Button -->
    <div
        class="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 mt-8"
    >
        <div class="flex flex-col gap-6">
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
                <p
                    class="text-slate-600 dark:text-slate-400 text-xl font-normal"
                >
                    Revisit your favorite moments and daily reflections.
                </p>
            </div>
        </div>

        <!-- Upload Button -->
        <div class="mt-4 md:mt-0 flex flex-col items-end">
            <input
                type="file"
                bind:this={fileInput}
                onchange={handleFileUpload}
                accept=".pdf,.docx,.txt"
                class="hidden"
            />
            <button
                onclick={triggerUpload}
                disabled={isUploading}
                class="flex items-center justify-center rounded-xl h-14 px-6 bg-primary dark:bg-blue-600 text-white min-w-[200px] gap-3 text-lg font-bold hover:bg-primary-hover dark:hover:bg-blue-700 transition-colors disabled:opacity-70"
            >
                {#if isUploading}
                    <div
                        class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"
                    ></div>
                    <span>Processing...</span>
                {:else}
                    <span class="material-symbols-outlined">add_circle</span>
                    <span>Upload Document</span>
                {/if}
            </button>
            {#if uploadError}
                <p class="text-red-500 text-sm mt-2 font-medium">
                    {uploadError}
                </p>
            {/if}
        </div>
    </div>

    {#if isLoading}
        <div class="flex items-center justify-center py-24">
            <div class="animate-pulse flex flex-col items-center">
                <div
                    class="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"
                ></div>
                <p class="mt-4 text-slate-500">Loading your memories...</p>
            </div>
        </div>
    {:else if journals.length === 0}
        <div
            class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center shadow-sm"
        >
            <span
                class="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-700 mb-4"
                >menu_book</span
            >
            <h3
                class="text-2xl font-serif font-bold text-slate-900 dark:text-white mb-2"
            >
                No Journals Yet
            </h3>
            <p class="text-slate-500 text-lg max-w-md mx-auto">
                Upload a document or write your first entry to start preserving
                memories.
            </p>
        </div>
    {:else}
        <!-- Journal Entry Cards -->
        <div class="flex flex-col gap-8 mb-12">
            {#each journals as journal, index}
                <div
                    class="group flex flex-col items-stretch justify-start rounded-xl overflow-hidden shadow-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-transform hover:scale-[1.01]"
                >
                    <div
                        class="w-full bg-center bg-no-repeat aspect-[21/9] bg-cover bg-slate-200 dark:bg-slate-800"
                        aria-label="Journal backdrop"
                        style="background-image: url('/images/patient-portal/journal-{(index %
                            3) +
                            1}.jpg');"
                    ></div>
                    <div class="flex w-full flex-col p-8 gap-4">
                        <div class="flex flex-col gap-1">
                            <span
                                class="text-primary dark:text-blue-400 font-bold text-sm uppercase tracking-widest flex items-center justify-between"
                            >
                                <span>Entry from</span>
                                <span
                                    class="text-slate-400 dark:text-slate-500 text-xs"
                                    >{new Date(
                                        journal.createdAt,
                                    ).toLocaleDateString()}</span
                                >
                            </span>
                            <p
                                class="font-serif text-slate-900 dark:text-white text-3xl font-bold leading-tight"
                            >
                                {journal.title}
                            </p>
                        </div>
                        <p
                            class="text-slate-700 dark:text-slate-300 text-xl leading-relaxed font-serif line-clamp-3"
                        >
                            {journal.extractedText}
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

        {#if journals.length > 5}
            <!-- Load More Button -->
            <div class="flex justify-center pb-16">
                <button
                    class="flex items-center gap-3 text-primary dark:text-blue-400 font-bold text-xl hover:underline p-4 rounded-xl hover:bg-primary/5 transition-colors"
                >
                    <span class="material-symbols-outlined">expand_more</span>
                    See Older Entries
                </button>
            </div>
        {/if}
    {/if}
</div>
