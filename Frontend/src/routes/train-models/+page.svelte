<script>
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { checkAuthStatus, apiCall } from "$lib/auth.js";
  import getApiBase from "$lib/apiBase.js";

  const API_BASE_URL = getApiBase();
  import {
    OPTIONAL_SEGMENTS,
    getAllOptionalQuestions,
  } from "$lib/questionBank.js";
  import { apiUrl } from "$lib/utils/api.js";

  let isAuthenticated = false;
  let replicas = [];
  let selectedReplica = null;
  let questions = [];
  let selectedSegments = [];
  let answers = {};
  let currentQuestionIndex = 0;
  let isLoading = false;
  let error = "";
  let successMessage = "";
  let selectedFilter = "all";

  onMount(async () => {
    isAuthenticated = checkAuthStatus();
    if (!isAuthenticated) {
      goto("/login");
      return;
    }

    // Check if user is a patient - redirect if they are
    try {
      const response = await apiCall("/api/auth/me", { method: "GET" });
      if (response.ok) {
        const userData = await response.json();
        if (userData.user && userData.user.role === "patient") {
          alert(
            "Patients cannot train replicas. You can only view and chat with replicas created by your caretaker.",
          );
          goto("/dashboard");
          return;
        }
      }
    } catch (error) {
      console.error("Failed to check user role:", error);
    }

    await loadUserReplicas();
    if (replicas.length === 0) {
      try {
        console.debug(
          "train-models reconcile - token present:",
          !!localStorage.getItem("authToken"),
        );
        const rec = await fetch("/api/replicas/reconcile", {
          method: "POST",
          credentials: "include",
        });
        if (rec.ok) {
          const diff = await rec.json();
          if (diff.added?.length || diff.updated?.length) {
            await loadUserReplicas();
          }
        }
      } catch (e) {
        console.warn("Reconcile failed on train page", e);
      }
    }
    questions = getAllOptionalQuestions();
  });

  async function loadUserReplicas() {
    try {
      const response = await fetch("/api/user/replicas", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to load replicas");
      }

      const data = await response.json();
      replicas = data.replicas || [];

      if (replicas.length > 0) {
        selectedReplica = replicas[0];
        selectedSegments = selectedReplica.selectedSegments || [];
        loadSavedAnswers();
      }
    } catch (err) {
      error = err.message;
    }
  }

  function loadSavedAnswers() {
    // Load any previously saved answers for this replica from localStorage
    const savedKey = `train-${selectedReplica.replicaId}`;
    const saved = localStorage.getItem(savedKey);
    if (saved) {
      try {
        answers = JSON.parse(saved);
      } catch (e) {
        console.warn("Failed to load saved training answers:", e);
      }
    }
  }

  function saveAnswersToStorage() {
    if (selectedReplica) {
      const savedKey = `train-${selectedReplica.replicaId}`;
      localStorage.setItem(savedKey, JSON.stringify(answers));
    }
  }

  function updateAnswer(questionId, value) {
    answers[questionId] = value;
    answers = answers; // Trigger reactivity
    saveAnswersToStorage();
  }

  function getAnswerLength(questionId) {
    return answers[questionId]?.length || 0;
  }

  function isQuestionAnswered(questionId) {
    const answer = answers[questionId] || "";
    const question = questions.find((q) => q.id === questionId);
    return answer.trim().length >= (question?.minLength || 40);
  }

  function getCompletionStats() {
    const completed = questions.filter((q) => isQuestionAnswered(q.id)).length;
    const started = Object.entries(answers).filter(
      ([, val]) => (val || "").trim().length > 0,
    ).length;
    return { completed, started, answered: completed, total: questions.length };
  }

  $: filteredQuestions =
    selectedFilter === "all"
      ? questions.filter((q) => selectedSegments.includes(q.segment))
      : questions.filter(
          (q) =>
            q.segment === selectedFilter &&
            selectedSegments.includes(q.segment),
        );

  $: currentQuestion = filteredQuestions[currentQuestionIndex];

  function nextQuestion() {
    if (currentQuestionIndex < filteredQuestions.length - 1) {
      currentQuestionIndex++;
    }
  }

  function previousQuestion() {
    if (currentQuestionIndex > 0) {
      currentQuestionIndex--;
    }
  }

  function skipQuestion() {
    nextQuestion();
  }

  // New Knowledge Base functionality
  let knowledgeBaseEntries = [];
  let showKnowledgeBase = false;
  let newKnowledgeBase = {
    title: "",
    text: "",
    url: "",
    filename: "",
    fileObj: null,
    autoRefresh: false,
    inputType: "text", // 'text', 'url', 'file'
  };

  async function loadKnowledgeBaseEntries() {
    if (!selectedReplica) return;

    try {
      const response = await fetch(
        `/api/replicas/${selectedReplica.replicaId}/kb`,
        {
          method: "GET",
          credentials: "include",
        },
      );

      if (response.ok) {
        const data = await response.json();
        knowledgeBaseEntries = data.entries || [];
      }
    } catch (err) {
      console.warn("Failed to load knowledge base entries:", err);
    }
  }

  async function createKnowledgeBaseEntry() {
    if (!selectedReplica) return;

    // Validate input based on type
    if (
      newKnowledgeBase.inputType === "text" &&
      !newKnowledgeBase.text.trim()
    ) {
      error = "Please enter training text";
      return;
    }
    if (newKnowledgeBase.inputType === "url" && !newKnowledgeBase.url.trim()) {
      error = "Please enter a valid URL";
      return;
    }
    if (newKnowledgeBase.inputType === "file" && !newKnowledgeBase.fileObj) {
      error = "Please select a file to upload";
      return;
    }

    isLoading = true;
    error = "";
    successMessage = "";

    // Handle File Upload separately
    if (newKnowledgeBase.inputType === "file") {
      try {
        const formData = new FormData();
        formData.append("file", newKnowledgeBase.fileObj);

        const response = await fetch(
          `/api/replicas/${selectedReplica.replicaId}/train/file`,
          {
            method: "POST",
            body: formData,
            credentials: "include",
          },
        );

        const data = await response.json();
        if (data.success) {
          successMessage =
            "File successfully processed and text injected into replica memory!";
          // Reset file form
          newKnowledgeBase = {
            ...newKnowledgeBase,
            fileObj: null,
            filename: "",
          };
        } else {
          error = data.error || "Failed to upload training file";
        }
      } catch (err) {
        error = "Upload error: " + err.message;
      } finally {
        isLoading = false;
      }
      return;
    }

    try {
      // Prepare request body with only relevant fields (API supports optional fields)
      const requestBody = {};

      if (newKnowledgeBase.title.trim())
        requestBody.title = newKnowledgeBase.title.trim();

      if (
        newKnowledgeBase.inputType === "text" &&
        newKnowledgeBase.text.trim()
      ) {
        requestBody.text = newKnowledgeBase.text.trim();
      }

      if (newKnowledgeBase.inputType === "url" && newKnowledgeBase.url.trim()) {
        requestBody.url = newKnowledgeBase.url.trim();
        if (newKnowledgeBase.autoRefresh) {
          requestBody.autoRefresh = newKnowledgeBase.autoRefresh;
        }
      }

      const response = await fetch(
        `/api/replicas/${selectedReplica.replicaId}/kb`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(requestBody),
        },
      );

      const data = await response.json();
      if (data.success && data.results && data.results.length > 0) {
        const result = data.results[0];
        let message = `Knowledge base entry created successfully! ID: ${result.knowledgeBaseID}`;

        // Show signed URL if it's a file upload
        if (result.signedURL) {
          message += `\n\nUpload your file to: ${result.signedURL}`;
        }

        successMessage = message;

        // Reset form
        newKnowledgeBase = {
          title: "",
          text: "",
          url: "",
          filename: "",
          autoRefresh: false,
          inputType: "text",
        };

        // Reload entries
        await loadKnowledgeBaseEntries();
      } else {
        error = data.error || "Failed to create knowledge base entry";
      }
    } catch (err) {
      console.error("Knowledge base creation error:", err);
      error = "An error occurred while creating the knowledge base entry";
    } finally {
      isLoading = false;
    }
  }

  async function deleteKnowledgeBaseEntry(entryId) {
    if (
      !confirm("Are you sure you want to delete this knowledge base entry?")
    ) {
      return;
    }

    try {
      const response = await fetch(
        `/api/replicas/${selectedReplica.replicaId}/kb/${entryId}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );

      const data = await response.json();
      if (data.success) {
        successMessage = "Knowledge base entry deleted successfully";
        await loadKnowledgeBaseEntries();
      } else {
        error = data.error || "Failed to delete entry";
      }
    } catch (err) {
      console.error("Delete error:", err);
      error = "An error occurred while deleting the entry";
    }
  }

  async function submitTraining() {
    if (!selectedReplica) return;

    isLoading = true;
    error = "";
    successMessage = "";

    try {
      // Prepare training data from answered questions using new KB API
      const trainingData = [];

      Object.entries(answers).forEach(([questionId, answer]) => {
        if (answer?.trim()) {
          const question = questions.find((q) => q.id === questionId);
          if (question) {
            trainingData.push({
              title: `Training: ${question.text}`,
              text: answer, // Use 'text' instead of 'rawText' for new API
            });
          }
        }
      });

      if (trainingData.length === 0) {
        error = "Please answer at least one question before submitting.";
        return;
      }

      // Submit each training entry using new KB API
      let successCount = 0;
      for (const training of trainingData) {
        try {
          const response = await fetch(
            `/api/replicas/${selectedReplica.replicaId}/kb`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              credentials: "include",
              body: JSON.stringify(training),
            },
          );

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.results && data.results.length > 0) {
              successCount++;
            }
          }
        } catch (err) {
          console.warn("Failed to submit training entry:", training.title, err);
        }
      }

      if (successCount > 0) {
        successMessage = `Successfully created ${successCount} knowledge base entries from your training answers!`;
        // Clear saved answers
        const savedKey = `train-${selectedReplica.replicaId}`;
        localStorage.removeItem(savedKey);
        answers = {};
        // Reload KB entries
        await loadKnowledgeBaseEntries();
      } else {
        error = "Failed to submit training data. Please try again.";
      }
    } catch (err) {
      console.warn("Error submitting training:", err);
      error = err.message || "An error occurred";
    } finally {
      isLoading = false;
    }
  }

  function selectReplica(replica) {
    selectedReplica = replica;
    selectedSegments =
      replica.selectedSegments && replica.selectedSegments.length
        ? replica.selectedSegments
        : Object.keys(OPTIONAL_SEGMENTS); // fallback so questions appear
    answers = {};
    currentQuestionIndex = 0;
    loadSavedAnswers();
    loadKnowledgeBaseEntries(); // Load KB entries for the selected replica
  }
</script>

<svelte:head>
  <title>Train Models - Memory Lane</title>
</svelte:head>

<div class="min-h-screen bg-background-light dark:bg-background-dark py-8">
  <div class="max-w-4xl mx-auto px-4">
    <!-- Header -->
    <div class="mb-8">
      <h1
        class="text-accessible-3xl font-bold text-text-light dark:text-text-dark mb-2"
      >
        Train Your Replicas
      </h1>
      <p class="text-text-light/80 dark:text-text-dark/80">
        Train your AI replicas with additional questions, text content,
        websites, or file uploads to make them more knowledgeable and
        personalized.
      </p>
    </div>

    <!-- Error/Success Messages -->
    {#if error}
      <div
        class="mb-6 bg-red-500/10 border border-red-500/30 rounded-tactile p-4"
      >
        <p class="text-red-700 dark:text-red-300 font-medium">{error}</p>
      </div>
    {/if}

    {#if successMessage}
      <div
        class="mb-6 bg-green-500/10 border border-green-500/30 rounded-tactile p-4"
      >
        <p class="text-green-700 dark:text-green-300 font-medium">
          {successMessage}
        </p>
      </div>
    {/if}

    <!-- Replica Selection -->
    {#if replicas.length > 0}
      <div class="mb-8 card-accessible p-6">
        <h2
          class="text-accessible-lg font-semibold text-text-light dark:text-text-dark mb-4"
        >
          Select Replica to Train
        </h2>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {#each replicas as replica (replica.replicaId)}
            <button
              onclick={() =>
                replica.status !== "REMOVED_REMOTE" && selectReplica(replica)}
              class="relative text-left p-4 rounded-tactile border transition-colors {selectedReplica?.replicaId ===
              replica.replicaId
                ? 'border-primary bg-primary/5 dark:bg-primary/10'
                : 'border-gray-200 dark:border-gray-800 hover:border-primary/50 dark:hover:border-secondary/50'} {replica.status ===
              'REMOVED_REMOTE'
                ? 'opacity-60 cursor-not-allowed'
                : ''}"
            >
              <h3
                class="font-medium text-text-light dark:text-text-dark flex items-center gap-2"
              >
                {replica.name}
                {#if replica.status}
                  <span
                    class="text-[10px] px-2 py-0.5 rounded uppercase tracking-wide font-semibold {replica.status ===
                    'CREATED'
                      ? 'bg-green-500/10 text-green-700 dark:text-green-300'
                      : ''} {replica.status === 'PENDING_CREATE'
                      ? 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300'
                      : ''} {replica.status === 'REMOVED_REMOTE'
                      ? 'bg-red-500/10 text-red-700 dark:text-red-300'
                      : ''} {replica.status === 'ERROR'
                      ? 'bg-red-500/10 text-red-700 dark:text-red-300'
                      : ''}"
                  >
                    {replica.status.replace("_", " ")}
                  </span>
                {/if}
              </h3>
              <p
                class="text-accessible-sm text-text-light/80 dark:text-text-dark/80 mt-1"
              >
                {replica.description}
              </p>
              <p class="text-xs text-text-light/60 dark:text-text-dark/60 mt-2">
                {replica.selectedSegments?.length || 0} categories selected
              </p>
              {#if replica.status === "REMOVED_REMOTE"}
                <div
                  class="absolute inset-0 bg-surface-light/60 dark:bg-surface-dark/60 flex items-center justify-center text-xs font-semibold text-red-600 dark:text-red-400 rounded-tactile"
                >
                  Removed at remote
                </div>
              {/if}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Knowledge Base Management -->
    {#if selectedReplica}
      <div class="mb-8 card-accessible p-6">
        <div class="flex justify-between items-center mb-4">
          <h2
            class="text-accessible-lg font-semibold text-text-light dark:text-text-dark"
          >
            Knowledge Base
          </h2>
          <button
            onclick={() => (showKnowledgeBase = !showKnowledgeBase)}
            class="text-accessible-sm text-primary dark:text-secondary hover:text-primary-hover dark:hover:text-secondary-hover font-medium"
          >
            {showKnowledgeBase ? "Hide" : "Show"} Knowledge Base
          </button>
        </div>

        {#if showKnowledgeBase}
          <!-- Add New Knowledge Base Entry -->
          <div
            class="mb-6 border border-gray-200 dark:border-gray-800 rounded-tactile p-4"
          >
            <h3
              class="text-accessible-base font-medium text-text-light dark:text-text-dark mb-4"
            >
              Add Knowledge Base Entry
            </h3>

            <!-- Input Type Selection -->
            <div class="mb-4">
              <label
                class="block text-accessible-sm font-medium text-text-light dark:text-text-dark mb-2"
                >Content Type</label
              >
              <div class="flex space-x-4">
                <label class="flex items-center">
                  <input
                    type="radio"
                    bind:group={newKnowledgeBase.inputType}
                    value="text"
                    class="mr-2 text-primary focus:ring-primary"
                  />
                  <span
                    class="text-accessible-sm text-text-light dark:text-text-dark"
                    >Text</span
                  >
                </label>
                <label class="flex items-center">
                  <input
                    type="radio"
                    bind:group={newKnowledgeBase.inputType}
                    value="url"
                    class="mr-2 text-primary focus:ring-primary"
                  />
                  <span
                    class="text-accessible-sm text-text-light dark:text-text-dark"
                    >URL/Website</span
                  >
                </label>
                <label class="flex items-center">
                  <input
                    type="radio"
                    bind:group={newKnowledgeBase.inputType}
                    value="file"
                    class="mr-2 text-primary focus:ring-primary"
                  />
                  <span
                    class="text-accessible-sm text-text-light dark:text-text-dark"
                    >File</span
                  >
                </label>
              </div>
            </div>

            <!-- Title (Optional) -->
            <div class="mb-4">
              <label
                for="kb-title"
                class="block text-accessible-sm font-medium text-text-light dark:text-text-dark mb-2"
              >
                Title (Optional)
              </label>
              <input
                id="kb-title"
                type="text"
                bind:value={newKnowledgeBase.title}
                class="input-accessible"
                placeholder="Enter a title for this knowledge base entry..."
              />
            </div>

            <!-- Dynamic Content Input -->
            {#if newKnowledgeBase.inputType === "text"}
              <div class="mb-4">
                <label
                  for="kb-text"
                  class="block text-accessible-sm font-medium text-text-light dark:text-text-dark mb-2"
                >
                  Training Text *
                </label>
                <textarea
                  id="kb-text"
                  bind:value={newKnowledgeBase.text}
                  rows="6"
                  class="input-accessible"
                  placeholder="Enter the text you want your replica to learn from..."
                ></textarea>
                <p
                  class="text-accessible-sm text-text-light/60 dark:text-text-dark/60 mt-2"
                >
                  Provide detailed information, examples, or knowledge that you
                  want your replica to learn from.
                </p>
              </div>
            {:else if newKnowledgeBase.inputType === "url"}
              <div class="mb-4">
                <label
                  for="kb-url"
                  class="block text-accessible-sm font-medium text-text-light dark:text-text-dark mb-2"
                >
                  Website URL *
                </label>
                <input
                  id="kb-url"
                  type="url"
                  bind:value={newKnowledgeBase.url}
                  class="input-accessible"
                  placeholder="https://example.com or https://www.youtube.com/watch?v=..."
                />
                <p
                  class="text-accessible-sm text-text-light/60 dark:text-text-dark/60 mt-2"
                >
                  Supports websites and YouTube videos. The content will be
                  automatically extracted.
                </p>
              </div>
              <div class="mb-4">
                <label class="flex items-center">
                  <input
                    type="checkbox"
                    bind:checked={newKnowledgeBase.autoRefresh}
                    class="mr-2 text-primary focus:ring-primary rounded"
                  />
                  <span
                    class="text-accessible-sm text-text-light dark:text-text-dark"
                    >Auto-refresh content from URL</span
                  >
                </label>
              </div>
            {:else if newKnowledgeBase.inputType === "file"}
              <div class="mb-4">
                <label
                  for="kb-file"
                  class="block text-accessible-sm font-medium text-text-light dark:text-text-dark mb-2"
                >
                  Training Document *
                </label>
                <input
                  id="kb-file"
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onchange={(e) => {
                    newKnowledgeBase.fileObj = e.target.files[0];
                    newKnowledgeBase.filename = e.target.files[0]?.name || "";
                  }}
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-800 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary dark:bg-surface-dark dark:text-text-dark file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-accessible-sm file:font-semibold file:bg-primary/10 file:text-primary dark:file:bg-secondary/10 dark:file:text-secondary hover:file:bg-primary/20 dark:hover:file:bg-secondary/20"
                />
                {#if newKnowledgeBase.filename}
                  <p
                    class="text-accessible-sm text-green-600 dark:text-green-400 mt-2 font-medium"
                  >
                    Selected: {newKnowledgeBase.filename}
                  </p>
                {/if}
                <p
                  class="text-accessible-sm text-text-light/60 dark:text-text-dark/60 mt-2"
                >
                  Supported: PDF, DOCX, TXT. Content will be instantly extracted
                  and ingested into the replica.
                </p>
              </div>
            {/if}

            <button
              onclick={createKnowledgeBaseEntry}
              disabled={isLoading}
              class="btn-tactile btn-tactile-primary w-full flex items-center justify-center"
            >
              {#if isLoading}
                <svg
                  class="animate-spin -ml-1 mr-3 h-5 w-5 text-surface-light"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                  ></circle>
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Creating...
              {:else}
                Create Knowledge Base Entry
              {/if}
            </button>
          </div>

          <!-- Existing Knowledge Base Entries -->
          {#if knowledgeBaseEntries.length > 0}
            <div class="mt-8">
              <h3
                class="text-accessible-base font-medium text-text-light dark:text-text-dark mb-4"
              >
                Knowledge Base Entries ({knowledgeBaseEntries.length})
              </h3>

              <div class="space-y-3">
                {#each knowledgeBaseEntries as entry}
                  <div
                    class="border border-gray-200 dark:border-gray-800 rounded-tactile p-4 bg-surface-light dark:bg-surface-dark"
                  >
                    <div class="flex justify-between items-start">
                      <div class="flex-1">
                        <h4
                          class="font-medium text-text-light dark:text-text-dark"
                        >
                          {entry.title ||
                            entry.generatedTitle ||
                            `Entry ${entry.id}`}
                        </h4>
                        <div class="flex flex-wrap gap-2 mt-2">
                          <span
                            class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary dark:bg-secondary/10 dark:text-secondary"
                          >
                            {entry.type || "text"}
                          </span>
                          <span
                            class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {entry.status ===
                            'READY'
                              ? 'bg-green-500/10 text-green-700 dark:text-green-300'
                              : 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300'}"
                          >
                            {entry.status || "PROCESSING"}
                          </span>
                          <span
                            class="text-xs text-text-light/60 dark:text-text-dark/60 mt-0.5"
                            >ID: {entry.id}</span
                          >
                        </div>
                        {#if entry.url}
                          <p
                            class="text-accessible-sm text-primary dark:text-secondary mt-3 truncate"
                          >
                            <span
                              class="font-medium text-text-light/80 dark:text-text-dark/80"
                              >URL:</span
                            >
                            <a
                              href={entry.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              class="hover:underline">{entry.url}</a
                            >
                          </p>
                        {/if}
                        {#if entry.summary}
                          <div
                            class="mt-3 bg-background-light dark:bg-background-dark p-3 rounded-md"
                          >
                            <p
                              class="text-accessible-sm text-text-light/80 dark:text-text-dark/80"
                            >
                              {entry.summary}
                            </p>
                          </div>
                        {/if}
                      </div>
                      <button
                        onclick={() => deleteKnowledgeBaseEntry(entry.id)}
                        class="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 p-2 ml-4 rounded-full hover:bg-red-500/10 transition-colors"
                        title="Delete entry"
                        aria-label="Delete entry"
                      >
                        <svg
                          class="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          ></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {:else}
            <div
              class="text-center py-8 text-text-light/60 dark:text-text-dark/60"
            >
              <p>No knowledge base entries found for this replica.</p>
              <p class="text-accessible-sm mt-2">
                Create your first entry above to get started.
              </p>
            </div>
          {/if}
        {/if}
      </div>
    {/if}

    {#if selectedReplica && filteredQuestions.length > 0}
      <!-- Progress Overview -->
      {#key selectedReplica?.replicaId}
        <div class="mb-6 grid gap-4 sm:grid-cols-4">
          <div
            class="bg-primary/5 dark:bg-primary/10 border border-primary/20 dark:border-primary/30 rounded-tactile p-4"
          >
            <div class="text-2xl font-bold text-primary dark:text-secondary">
              {getCompletionStats().started}
            </div>
            <div
              class="text-accessible-sm text-primary dark:text-secondary font-medium"
            >
              Started
            </div>
          </div>
          <div
            class="bg-green-500/10 border border-green-500/20 rounded-tactile p-4"
          >
            <div class="text-2xl font-bold text-green-600 dark:text-green-400">
              {getCompletionStats().completed}
            </div>
            <div
              class="text-accessible-sm text-green-700 dark:text-green-300 font-medium"
            >
              Completed (>= min)
            </div>
          </div>
          <div
            class="bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-800 rounded-tactile p-4"
          >
            <div
              class="text-2xl font-bold text-text-light/80 dark:text-text-dark/80"
            >
              {filteredQuestions.length}
            </div>
            <div
              class="text-accessible-sm text-text-light/80 dark:text-text-dark/80 font-medium"
            >
              Total Shown
            </div>
          </div>
          <div
            class="bg-purple-500/10 border border-purple-500/20 rounded-tactile p-4"
          >
            <div
              class="text-2xl font-bold text-purple-600 dark:text-purple-400"
            >
              {filteredQuestions.length > 0
                ? Math.round(
                    (getCompletionStats().completed /
                      filteredQuestions.length) *
                      100,
                  )
                : 0}%
            </div>
            <div
              class="text-accessible-sm text-purple-700 dark:text-purple-300 font-medium"
            >
              Completion %
            </div>
          </div>
        </div>
      {/key}

      <!-- Category Filter -->
      <div class="mb-6">
        <label
          for="categoryFilter"
          class="block text-accessible-sm font-medium text-text-light dark:text-text-dark mb-2"
          >Filter by category:</label
        >
        <select
          id="categoryFilter"
          bind:value={selectedFilter}
          class="input-accessible bg-surface-light dark:bg-surface-dark"
        >
          <option value="all"
            >All Categories ({filteredQuestions.length})</option
          >
          {#each selectedSegments as segment (segment)}
            <option value={segment}>
              {OPTIONAL_SEGMENTS[segment]?.name || segment} ({questions.filter(
                (q) => q.segment === segment,
              ).length})
            </option>
          {/each}
        </select>
      </div>

      {#if currentQuestion}
        <!-- Current Question -->
        <div class="card-accessible mb-6">
          <div class="p-6">
            <div class="mb-4">
              <div class="flex items-center justify-between mb-3">
                <span
                  class="text-accessible-sm font-medium text-primary dark:text-secondary bg-primary/10 dark:bg-secondary/10 px-3 py-1 rounded-full"
                >
                  {OPTIONAL_SEGMENTS[currentQuestion.segment]?.name ||
                    currentQuestion.segment}
                </span>
                <span
                  class="text-accessible-sm font-medium text-text-light/60 dark:text-text-dark/60 bg-surface-light dark:bg-surface-dark px-3 py-1 rounded-full border border-gray-200 dark:border-gray-800"
                >
                  Question {currentQuestionIndex + 1} of {filteredQuestions.length}
                </span>
              </div>
              <h3
                class="text-accessible-lg font-medium text-text-light dark:text-text-dark leading-relaxed"
              >
                {currentQuestion.text}
              </h3>
            </div>

            <div class="mb-6">
              <textarea
                value={answers[currentQuestion.id] || ""}
                oninput={(e) =>
                  updateAnswer(currentQuestion.id, e.target.value)}
                rows="6"
                class="w-full px-4 py-3 border rounded-tactile focus:outline-none focus:ring-2 bg-surface-light dark:bg-surface-dark text-text-light dark:text-text-dark transition-colors resize-y
                  {answers[currentQuestion.id]?.length > 0 &&
                !isQuestionAnswered(currentQuestion.id)
                  ? 'border-orange-400 dark:border-orange-500 focus:ring-orange-500'
                  : ''}
                  {isQuestionAnswered(currentQuestion.id)
                  ? 'border-green-500 dark:border-green-500 focus:ring-green-500'
                  : ''}
                  {!answers[currentQuestion.id] ||
                answers[currentQuestion.id].length === 0
                  ? 'border-gray-300 dark:border-gray-600 focus:ring-primary dark:focus:ring-secondary focus:border-primary dark:focus:border-secondary'
                  : ''}"
                placeholder="Share your thoughts... (minimum {currentQuestion.minLength} characters)"
              ></textarea>

              <div class="mt-3 flex justify-between items-center px-1">
                <div class="text-accessible-sm">
                  <span class="text-text-light/60 dark:text-text-dark/60"
                    >{getAnswerLength(currentQuestion.id)} chars</span
                  >
                  {#if answers[currentQuestion.id]?.length > 0 && !isQuestionAnswered(currentQuestion.id)}
                    <span
                      class="ml-3 text-orange-600 dark:text-orange-400 font-medium bg-orange-500/10 px-2 py-0.5 rounded"
                      >Need {Math.max(
                        0,
                        currentQuestion.minLength -
                          getAnswerLength(currentQuestion.id),
                      )} more</span
                    >
                  {/if}
                  {#if isQuestionAnswered(currentQuestion.id)}
                    <span
                      class="ml-3 text-green-600 dark:text-green-400 font-medium bg-green-500/10 px-2 py-0.5 rounded"
                      >Meets minimum</span
                    >
                  {/if}
                </div>
                <div
                  class="flex items-center gap-2 text-accessible-sm font-medium"
                >
                  {#if answers[currentQuestion.id]?.length > 0 && !isQuestionAnswered(currentQuestion.id)}
                    <span
                      class="text-orange-600 dark:text-orange-400 flex items-center gap-1"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        ><circle cx="12" cy="12" r="10"></circle><polyline
                          points="12 6 12 12 16 14"
                        ></polyline></svg
                      >
                      Incomplete
                    </span>
                  {/if}
                  {#if isQuestionAnswered(currentQuestion.id)}
                    <span
                      class="text-green-600 dark:text-green-400 flex items-center gap-1"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        ><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"
                        ></path><polyline points="22 4 12 14.01 9 11.01"
                        ></polyline></svg
                      >
                      Complete
                    </span>
                  {/if}
                </div>
              </div>
            </div>

            <!-- Navigation -->
            <div
              class="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-800"
            >
              <button
                onclick={previousQuestion}
                disabled={currentQuestionIndex === 0}
                class="btn-tactile btn-tactile-secondary"
              >
                Previous
              </button>

              <button
                onclick={skipQuestion}
                class="text-accessible-base font-medium text-text-light/60 hover:text-text-light dark:text-text-dark/60 dark:hover:text-text-dark transition-colors px-4 py-2"
              >
                Skip Question
              </button>

              <div class="flex flex-col items-end gap-1">
                <button
                  onclick={nextQuestion}
                  disabled={currentQuestionIndex ===
                    filteredQuestions.length - 1 ||
                    !isQuestionAnswered(currentQuestion.id)}
                  class="btn-tactile btn-tactile-primary"
                  aria-disabled={currentQuestionIndex ===
                    filteredQuestions.length - 1 ||
                    !isQuestionAnswered(currentQuestion.id)}
                  >Next Question</button
                >
                {#if answers[currentQuestion.id]?.length && !isQuestionAnswered(currentQuestion.id)}
                  <span
                    class="text-xs text-orange-600 dark:text-orange-400 font-medium"
                    >Need {Math.max(
                      0,
                      currentQuestion.minLength -
                        getAnswerLength(currentQuestion.id),
                    )} more chars</span
                  >
                {/if}
              </div>
            </div>
          </div>
        </div>
      {/if}

      <!-- Submit Training -->
      <div class="card-accessible p-6">
        <h3
          class="text-accessible-lg font-semibold text-text-light dark:text-text-dark mb-4"
        >
          Submit Training Data
        </h3>
        <p
          class="text-text-light/80 dark:text-text-dark/80 mb-6 bg-surface-light dark:bg-surface-dark p-3 rounded-md inline-block"
        >
          Started: <span class="font-bold text-primary dark:text-secondary"
            >{getCompletionStats().started}</span
          >
          <span class="mx-2">|</span>
          Completed:
          <span class="font-bold text-green-600 dark:text-green-400"
            >{getCompletionStats().completed}</span
          >
          / {filteredQuestions.length}
        </p>
        <div
          class="h-2 w-full bg-gray-200 dark:bg-gray-800 rounded-full mb-8 overflow-hidden border border-gray-300 dark:border-gray-700"
        >
          <div
            class="h-full bg-green-500 transition-all duration-500 ease-out"
            style="width: {filteredQuestions.length
              ? (getCompletionStats().completed / filteredQuestions.length) *
                100
              : 0}%"
          ></div>
        </div>

        <div class="flex flex-wrap gap-4">
          <button
            onclick={submitTraining}
            disabled={isLoading || getCompletionStats().completed === 0}
            class="btn-tactile bg-green-600 hover:bg-green-700 text-white border-b-4 border-green-800 disabled:bg-gray-400 disabled:border-gray-500 disabled:text-gray-200 flex items-center gap-2 px-6 py-3 shadow-[0_4px_0_0_rgba(21,128,61,1)] active:shadow-[0_0px_0_0_rgba(21,128,61,1)] disabled:shadow-[0_4px_0_0_rgba(107,114,128,1)] text-lg border-2 border-t-green-500 border-l-green-500"
          >
            {#if isLoading}
              <svg
                class="animate-spin w-5 h-5 opacity-80"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                ></path>
              </svg>
              Training...
            {:else}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="opacity-80"
                ><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline
                  points="22 4 12 14.01 9 11.01"
                ></polyline></svg
              >
              Submit Training Data
            {/if}
          </button>

          <a
            href="/dashboard"
            class="btn-tactile btn-tactile-secondary px-6 py-3"
          >
            Back to Dashboard
          </a>
        </div>
      </div>
    {:else if selectedReplica}
      <!-- No questions available -->
      <div
        class="card-accessible bg-surface-light dark:bg-surface-dark p-8 text-center"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="mx-auto mb-4 text-text-light/40 dark:text-text-dark/40"
          ><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
          ></path><polyline points="14 2 14 8 20 8"></polyline><line
            x1="16"
            y1="13"
            x2="8"
            y2="13"
          ></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline
            points="10 9 9 9 8 9"
          ></polyline></svg
        >
        <h3
          class="text-accessible-lg font-semibold text-text-light dark:text-text-dark mb-2"
        >
          No Training Questions Available
        </h3>
        <p
          class="text-text-light/80 dark:text-text-dark/80 max-w-md mx-auto mb-6"
        >
          This replica doesn't have any optional question categories selected
          for training.
        </p>
        <a
          href="/dashboard"
          class="btn-tactile btn-tactile-primary inline-flex"
        >
          Back to Dashboard
        </a>
      </div>
    {:else}
      <!-- No replicas -->
      <div
        class="card-accessible bg-surface-light dark:bg-surface-dark p-8 text-center"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="mx-auto mb-4 text-primary/50 dark:text-secondary/50"
          ><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle
            cx="12"
            cy="7"
            r="4"
          ></circle></svg
        >
        <h3
          class="text-accessible-lg font-semibold text-text-light dark:text-text-dark mb-2"
        >
          No Replicas Found
        </h3>
        <p
          class="text-text-light/80 dark:text-text-dark/80 max-w-md mx-auto mb-6"
        >
          You need to create a replica first before you can train it.
        </p>
        <a
          href="/create-replicas"
          class="btn-tactile btn-tactile-primary inline-flex"
        >
          Create Your First Replica
        </a>
      </div>
    {/if}
  </div>
</div>
