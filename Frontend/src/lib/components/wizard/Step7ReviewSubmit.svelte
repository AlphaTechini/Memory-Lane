<script>
  import { onMount } from "svelte";
  import { wizardStore } from "$lib/stores/wizardStore.js";
  import {
    REQUIRED_QUESTIONS,
    OPTIONAL_SEGMENTS,
    getRequiredQuestionsByTemplate,
  } from "$lib/questionBank.js";
  import { goto } from "$app/navigation";
  import { apiCall } from "$lib/auth.js";
  import { apiUrl } from "$lib/utils/api.js";
  import { getApiBase } from "$lib/apiBase.js";
  const API_BASE_URL = getApiBase();

  let state = $state({
    basics: {},
    requiredAnswers: {},
    optionalAnswers: {},
    selectedSegments: [],
  });
  let isSubmitting = $state(false);
  let submitError = $state(null);
  const defaultProgressSteps = () => [
    { key: "create", label: "Creating replica", status: "pending" },
    { key: "train", label: "Training replica", status: "idle" },
    { key: "fetch", label: "Fetching replica details", status: "idle" },
    { key: "finalize", label: "Finalizing", status: "idle" },
  ];
  let showProgress = $state(false);
  let progressSteps = $state(defaultProgressSteps());
  let progressMessage = $state("");
  let lastFailedStep = $state(null);
  let expandedAnswers = $state([]);
  let progressInterval = null;

  // Subscribe to wizard store
  let unsubscribe;
  onMount(() => {
    unsubscribe = wizardStore.subscribe((value) => {
      state = value;
      const progress = value?.submissionProgress;
      if (progress) {
        showProgress = progress.showProgress ?? false;
        progressSteps = progress.steps?.length
          ? progress.steps
          : defaultProgressSteps();
        progressMessage = progress.message ?? "";
        submitError = progress.submitError ?? null;
        lastFailedStep = progress.lastFailedStep ?? null;
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  });

  // Calculate submission readiness
  // Dynamic required questions based on template
  let requiredQuestions = $derived(
    state?.template
      ? getRequiredQuestionsByTemplate(state.template)
      : REQUIRED_QUESTIONS,
  );

  let canSubmit = $derived(() => {
    if (!state) return false;
    const hasBasics =
      state.basics?.name?.trim() &&
      state.basics?.description?.trim() &&
      state.basics?.consent;
    if (state.creationPath === "upload") {
      return hasBasics && state.uploadedFileInfo;
    }
    const hasRequiredAnswers =
      Object.keys(state.requiredAnswers || {}).length >=
      requiredQuestions.length;
    const hasOptionalAnswers =
      Object.keys(state.optionalAnswers || {}).length >= 40; // keep threshold
    return hasBasics && hasRequiredAnswers && hasOptionalAnswers;
  });

  let submissionStats = $derived(() => {
    const requiredCount = Object.keys(state?.requiredAnswers || {}).length;
    const optionalCount = Object.keys(state?.optionalAnswers || {}).length;
    return {
      requiredAnswers: requiredCount,
      requiredTotal: requiredQuestions.length,
      optionalAnswers: optionalCount,
      totalAnswers: requiredCount + optionalCount,
      coverageScore: wizardStore.calculateCoverageScore(),
    };
  });

  function getSegmentName(segmentKey) {
    return OPTIONAL_SEGMENTS[segmentKey]?.name || segmentKey;
  }

  function toggleAnswerExpansion(questionId) {
    if (expandedAnswers.includes(questionId)) {
      expandedAnswers = expandedAnswers.filter((id) => id !== questionId);
    } else {
      expandedAnswers = [...expandedAnswers, questionId];
    }
  }

  function truncateText(text, maxLength = 150) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  }

  function editSection(section) {
    wizardStore.setCurrentStep(section);
  }

  function persistProgress(extra = {}) {
    wizardStore.updateSubmissionProgress((prev) => ({
      ...prev,
      steps: progressSteps,
      message: progressMessage,
      showProgress,
      submitError,
      lastFailedStep,
      ...extra,
    }));
  }

  function resetProgressState() {
    progressSteps = defaultProgressSteps();
    progressMessage = "";
    submitError = null;
    lastFailedStep = null;
    persistProgress({
      steps: progressSteps,
      message: progressMessage,
      submitError: null,
      lastFailedStep: null,
      baselineReplicaIds: [],
      recoveredReplica: null,
    });
  }

  function updateProgress(key, updates) {
    progressSteps = progressSteps.map((step) =>
      step.key === key ? { ...step, ...updates } : step,
    );
    persistProgress();
  }

  function setProgressMessage(message) {
    progressMessage = message;
    persistProgress();
  }

  function markFailure(stepKey) {
    const keys = progressSteps.map((step) => step.key);
    const targetIndex = keys.indexOf(stepKey);
    progressSteps = progressSteps.map((step, idx) => {
      if (targetIndex === -1) {
        if (idx === 0) {
          return { ...step, status: idx === 0 ? "error" : "idle" };
        }
        return { ...step, status: "idle" };
      }
      if (idx < targetIndex) {
        return { ...step, status: "done" };
      }
      if (idx === targetIndex) {
        return { ...step, status: "error" };
      }
      return { ...step, status: "idle" };
    });
    persistProgress();
  }

  function prepareResumeSteps(stepKey) {
    const keys = progressSteps.map((step) => step.key);
    const targetIndex = keys.indexOf(stepKey);
    progressSteps = progressSteps.map((step, idx) => {
      if (targetIndex === -1) {
        return idx === 0
          ? { ...step, status: "working" }
          : { ...step, status: "idle" };
      }
      if (idx < targetIndex) {
        return { ...step, status: "done" };
      }
      if (idx === targetIndex) {
        return { ...step, status: "working" };
      }
      return { ...step, status: "idle" };
    });
    persistProgress();
  }

  async function fetchReplicaSnapshot() {
    try {
      const response = await apiCall("/api/user/replicas");
      if (!response.ok) return [];
      const data = await response.json();
      if (Array.isArray(data?.replicas)) {
        return data.replicas;
      }
      return [];
    } catch (error) {
      console.warn("Failed to fetch replica snapshot:", error);
      return [];
    }
  }

  function normalizeReplica(replica) {
    if (!replica) return null;
    // Accept many possible id fields returned by different environments
    const id =
      replica.replicaId ||
      replica.id ||
      replica.uuid ||
      replica._id ||
      replica._key ||
      (replica.data &&
        (replica.data.id || replica.data.uuid || replica.data.replicaId)) ||
      (replica.replica &&
        (replica.replica.id ||
          replica.replica.uuid ||
          replica.replica.replicaId));
    if (!id) return null;
    return {
      ...replica,
      id,
      name: replica.name || replica.title || "Replica",
    };
  }

  async function attemptRecoveryAfterFailure(baselineIdsSet) {
    if (!baselineIdsSet || baselineIdsSet.size === 0) {
      return null;
    }
    const snapshot = await fetchReplicaSnapshot();
    for (const replica of snapshot) {
      const normalized = normalizeReplica(replica);
      if (normalized && !baselineIdsSet.has(normalized.id)) {
        return normalized;
      }
    }
    return null;
  }

  async function handleSuccessfulReplica(replica, trainingCount = 0) {
    if (!replica) return;

    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }

    updateProgress("create", { status: "done" });
    updateProgress("train", { status: "done" });
    if (trainingCount > 0) {
      setProgressMessage(
        `Training completed: ${trainingCount} knowledge entries created`,
      );
    } else {
      setProgressMessage("Training completed with basic knowledge");
    }

    updateProgress("fetch", { status: "working" });
    setProgressMessage("Fetching replica details...");

    let hydratedReplica = replica;
    if (replica.id) {
      try {
        const polled = await pollReplica(replica.id, 6, 1500);
        if (polled && polled.id) {
          hydratedReplica = { ...replica, ...polled, id: replica.id };
        }
      } catch (pollErr) {
        console.warn("Replica polling failed, using initial data:", pollErr);
      }
    }

    updateProgress("fetch", { status: "done" });
    updateProgress("finalize", { status: "working" });
    setProgressMessage("Finalizing and preparing chat...");

    if (hydratedReplica?.id) {
      try {
        sessionStorage.setItem("newReplica", JSON.stringify(hydratedReplica));
      } catch (storageError) {
        console.warn(
          "Could not persist new replica info to sessionStorage:",
          storageError,
        );
      }
      wizardStore.setReplicaId(hydratedReplica.id);
    }

    updateProgress("finalize", { status: "done" });
    setProgressMessage(
      `✅ Replica "${hydratedReplica?.name || replica.name || "Replica"}" successfully created! Redirecting to chat...`,
    );

    lastFailedStep = null;
    submitError = null;
    persistProgress({
      showProgress: true,
      lastFailedStep: null,
      submitError: null,
      baselineReplicaIds: [],
      recoveredReplica: hydratedReplica,
    });

    setTimeout(() => {
      showProgress = false;
      persistProgress({ showProgress: false });
      wizardStore.clearSubmissionProgress();
      wizardStore.reset();
      if (hydratedReplica?.id) {
        goto(
          `/chat-replicas?created=true&replicaId=${encodeURIComponent(hydratedReplica.id)}`,
        );
      } else {
        goto("/chat-replicas?created=true");
      }
    }, 1500);
  }

  function resumeSubmission() {
    const resumeKey =
      state?.submissionProgress?.lastFailedStep || lastFailedStep || "create";
    showProgress = true;
    submitError = null;
    persistProgress({ showProgress: true, submitError: null });
    submitReplica({ resume: true, resumeFrom: resumeKey });
  }

  function dismissProgress() {
    showProgress = false;
    persistProgress({ showProgress: false });
  }

  async function safeJson(response) {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      return { _raw: text };
    }
  }

  async function dataUrlToBlob(dataUrl) {
    const res = await fetch(dataUrl);
    return await res.blob();
  }

  async function pollReplica(id, attempts = 6, delayMs = 1500) {
    for (let i = 0; i < attempts; i++) {
      try {
        const resp = await fetch("/api/replicas", {
          method: "GET",
          credentials: "include",
        });
        if (resp.ok) {
          const data = await safeJson(resp);
          if (data?.replica) return data.replica;
        }
      } catch (error) {
        console.error("Failed to poll replica details:", error);
      }
      await new Promise((r) => setTimeout(r, delayMs));
    }
    return null;
  }

  async function submitReplica(options = {}) {
    const { resume = false, resumeFrom } = options;
    if (!canSubmit || isSubmitting) return;

    isSubmitting = true;
    submitError = null;
    showProgress = true;

    if (!progressSteps.length) {
      progressSteps = defaultProgressSteps();
    }

    const targetStep = resume
      ? resumeFrom || lastFailedStep || "create"
      : "create";

    if (!resume) {
      resetProgressState();
    }

    prepareResumeSteps(targetStep);
    setProgressMessage(
      resume ? "Resuming replica creation..." : "Initializing...",
    );
    lastFailedStep = null;

    const progressState = state?.submissionProgress || {};
    let baselineIdsSet;

    if (
      resume &&
      Array.isArray(progressState.baselineReplicaIds) &&
      progressState.baselineReplicaIds.length
    ) {
      baselineIdsSet = new Set(progressState.baselineReplicaIds);
    } else {
      const baselineSnapshot = await fetchReplicaSnapshot();
      baselineIdsSet = new Set(
        baselineSnapshot
          .map((rep) => normalizeReplica(rep)?.id)
          .filter(Boolean),
      );
      persistProgress({ baselineReplicaIds: Array.from(baselineIdsSet) });
    }

    persistProgress({
      showProgress: true,
      submitError: null,
      lastFailedStep: null,
    });

    try {
      const submissionData = {
        name: state.basics.name,
        description: state.basics.description,
        greeting: state.basics.greeting || "",
        preferredQuestion: state.basics.preferredQuestion || "",
        template: state.template || null,
        relationship: state.relationship || null,
        requiredAnswers: state.requiredAnswers,
        optionalAnswers: state.optionalAnswers,
        selectedSegments: state.selectedSegments,
        profileImage: state.profileImage?.cloudinaryUrl || null,
        coverageScore: wizardStore.calculateCoverageScore(),
      };

      setProgressMessage("Creating replica in Sensay API...");

      progressInterval = setInterval(() => {
        const currentStep = progressSteps.find((s) => s.status === "working");
        if (currentStep?.key === "create") {
          updateProgress("create", { status: "done" });
          updateProgress("train", { status: "working" });
          setProgressMessage("Training your replica with provided answers...");
        } else if (currentStep?.key === "train") {
          setProgressMessage(
            "Processing knowledge entries (this may take up to 2 minutes)...",
          );
        }
      }, 3000);

      const response = await fetch("/api/replicas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(submissionData),
      });

      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }

      const result = await safeJson(response);
      if (!response.ok || !result?.success || !result?.replica) {
        throw new Error(result?.error || "Failed to create replica");
      }

      const normalizedReplica = normalizeReplica(result.replica);
      if (!normalizedReplica) {
        // Be tolerant: construct a provisional/pending id so the UX can continue.
        // This can happen when the backend returns an unexpected shape; the UI will
        // still persist the replica info to sessionStorage and redirect to chat.
        const provisionalId =
          result?.replica?.id ||
          result?.replica?.replicaId ||
          result?.replica?.uuid ||
          result?.id ||
          `pending_${Date.now()}`;

        const provisional = {
          ...(result.replica || {}),
          id: provisionalId,
          pending: true,
          name:
            (result.replica && (result.replica.name || result.replica.title)) ||
            "Replica",
        };

        if (state.creationPath === "upload" && state.uploadedFileInfo) {
          await processFileUpload(provisionalId);
        }

        await handleSuccessfulReplica(
          provisional,
          result?.replica?.trainingCount ?? 0,
        );
        return;
      }

      if (state.creationPath === "upload" && state.uploadedFileInfo) {
        await processFileUpload(normalizedReplica.id);
      }

      await handleSuccessfulReplica(
        normalizedReplica,
        result?.replica?.trainingCount ?? 0,
      );
      return;
    } catch (error) {
      console.error("Submission error:", error);
      const message = error?.message || "Unknown error";
      submitError = message;
      setProgressMessage("Error: " + message);

      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }

      baselineIdsSet = baselineIdsSet || new Set();
      const recoveredReplica =
        await attemptRecoveryAfterFailure(baselineIdsSet);
      if (recoveredReplica) {
        await handleSuccessfulReplica(
          recoveredReplica,
          recoveredReplica?.trainingCount || 0,
        );
        return;
      }

      const current = progressSteps.find((s) => s.status === "working");
      const failureKey =
        current?.key || resumeFrom || lastFailedStep || "create";
      lastFailedStep = failureKey;
      markFailure(failureKey);
      persistProgress({
        submitError,
        lastFailedStep,
        showProgress: true,
        baselineReplicaIds: Array.from(baselineIdsSet || []),
      });
    } finally {
      isSubmitting = false;
    }
  }

  async function processFileUpload(replicaId) {
    updateProgress("train", { status: "working" });
    setProgressMessage("Extracting text and injecting memory from document...");
    try {
      const blob = await dataUrlToBlob(state.uploadedFileInfo.dataUrl);
      const formData = new FormData();
      formData.append("file", blob, state.uploadedFileInfo.name);

      const trainResponse = await fetch(
        `/api/replicas/${replicaId}/train/file`,
        {
          method: "POST",
          body: formData,
          credentials: "include",
        },
      );
      const trainResult = await safeJson(trainResponse);
      if (!trainResponse.ok || !trainResult.success) {
        console.warn("FileUpload training failed:", trainResult.error);
      }
    } catch (e) {
      console.error("File training error", e);
    }
  }

  function getRequiredQuestionText(questionId) {
    return (
      REQUIRED_QUESTIONS.find((q) => q.id === questionId)?.text ||
      "Unknown question"
    );
  }
</script>

<div class="p-6">
  <div class="mb-8 border-b border-cream-200 dark:border-charcoal-700 pb-6">
    <h2
      class="text-3xl font-bold text-text-light dark:text-text-dark mb-2 font-serif"
    >
      Review & Submit
    </h2>
    <p class="text-charcoal-600 dark:text-cream-400 leading-relaxed max-w-2xl">
      Review your replica information before submitting. You can edit any
      section by clicking the "Edit" button.
    </p>
  </div>

  <!-- Submission Summary -->
  <div class="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    {#if state?.creationPath === "upload"}
      <div
        class="col-span-full bg-success/10 border border-success/30 rounded-xl p-6 flex items-center justify-between shadow-sm"
      >
        <div>
          <h3
            class="text-xl font-bold text-success/90 dark:text-success flex items-center gap-2"
          >
            <span
              class="material-symbols-outlined rounded-full p-1 bg-success/20"
              >check</span
            >
            Document Upload Mode
          </h3>
          <p class="text-success/80 dark:text-success/90 mt-1">
            Your replica will be generated dynamically from: <strong
              >{state?.uploadedFileInfo?.name || "Uploaded Document"}</strong
            >
          </p>
        </div>
        <span class="material-symbols-outlined text-5xl text-success/50"
          >upload_file</span
        >
      </div>
    {:else}
      <div
        class="bg-primary/5 dark:bg-primary/10 border border-primary/20 dark:border-primary/30 rounded-xl p-5 shadow-sm"
      >
        <div class="text-3xl font-bold text-primary dark:text-secondary mb-1">
          {submissionStats.totalAnswers}
        </div>
        <div
          class="text-[14px] font-medium text-charcoal-600 dark:text-cream-400 uppercase tracking-wide"
        >
          Total Answers
        </div>
      </div>
      <div
        class="bg-success/5 border border-success/20 rounded-xl p-5 shadow-sm"
      >
        <div class="text-3xl font-bold text-success dark:text-success/90 mb-1">
          {submissionStats.requiredAnswers}
        </div>
        <div
          class="text-[14px] font-medium text-charcoal-600 dark:text-cream-400 uppercase tracking-wide"
        >
          Required Answered
        </div>
      </div>
      <div
        class="bg-primary/5 dark:bg-primary/10 border border-primary/20 dark:border-primary/30 rounded-xl p-5 shadow-sm"
      >
        <div class="text-3xl font-bold text-primary dark:text-secondary mb-1">
          {submissionStats.optionalAnswers}
        </div>
        <div
          class="text-[14px] font-medium text-charcoal-600 dark:text-cream-400 uppercase tracking-wide"
        >
          Optional Answered
        </div>
      </div>
      <div
        class="bg-warning/10 border border-warning/20 rounded-xl p-5 shadow-sm"
      >
        <div
          class="text-3xl font-bold text-warning/90 dark:text-warning mb-1 flex items-baseline"
        >
          {submissionStats.coverageScore}<span class="text-xl ml-0.5">%</span>
        </div>
        <div
          class="text-[14px] font-medium text-charcoal-600 dark:text-cream-400 uppercase tracking-wide"
        >
          Coverage Score
        </div>
      </div>
    {/if}
  </div>

  <div class="space-y-6">
    <!-- Basic Information -->
    <div
      class="border border-cream-200 dark:border-charcoal-700 rounded-xl overflow-hidden shadow-sm bg-surface-light dark:bg-surface-dark"
    >
      <div
        class="p-5 border-b border-cream-200 dark:border-charcoal-700 flex justify-between items-center bg-cream-50/50 dark:bg-charcoal-800/50"
      >
        <h3
          class="text-lg font-semibold text-text-light dark:text-text-dark font-serif flex items-center gap-2"
        >
          <span class="material-symbols-outlined text-primary">info</span> Basic
          Information
        </h3>
        <button
          onclick={() => editSection(1)}
          class="text-primary hover:text-primary-hover dark:text-secondary dark:hover:text-cream-200 text-sm font-medium flex items-center gap-1 transition-colors"
        >
          <span class="material-symbols-outlined text-[16px]">edit</span> Edit
        </button>
      </div>
      <div class="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <span
            class="block text-xs font-semibold text-charcoal-400 dark:text-gray-400 uppercase tracking-wider mb-1"
            >Name</span
          >
          <p
            class="text-text-light dark:text-text-dark font-medium text-[15px]"
          >
            {state?.basics?.name || "Not provided"}
          </p>
        </div>
        <div>
          <span
            class="block text-xs font-semibold text-charcoal-400 dark:text-gray-400 uppercase tracking-wider mb-1"
            >Description</span
          >
          <p class="text-text-light dark:text-text-dark text-[15px]">
            {state?.basics?.description || "Not provided"}
          </p>
        </div>
        <div>
          <span
            class="block text-xs font-semibold text-charcoal-400 dark:text-gray-400 uppercase tracking-wider mb-1"
            >Custom Greeting</span
          >
          <p class="text-charcoal-700 dark:text-cream-300 text-[15px]">
            {state?.basics?.greeting || "Not provided (will use default)"}
          </p>
        </div>
        <div>
          <span
            class="block text-xs font-semibold text-charcoal-400 dark:text-gray-400 uppercase tracking-wider mb-1"
            >Preferred Question</span
          >
          <p class="text-charcoal-700 dark:text-cream-300 text-[15px]">
            {state?.basics?.preferredQuestion ||
              "Not provided (will use default)"}
          </p>
        </div>
        <div>
          <span
            class="block text-xs font-semibold text-charcoal-400 dark:text-gray-400 uppercase tracking-wider mb-1"
            >Consent</span
          >
          <p
            class="text-text-light dark:text-text-dark font-medium flex items-center gap-1.5 text-[15px]"
          >
            {#if state?.basics?.consent}
              <span class="material-symbols-outlined text-success text-[18px]"
                >check_circle</span
              > Provided
            {:else}
              <span class="material-symbols-outlined text-error text-[18px]"
                >cancel</span
              > Not provided
            {/if}
          </p>
        </div>
      </div>
    </div>

    <!-- Profile Image -->
    <div
      class="border border-cream-200 dark:border-charcoal-700 rounded-xl overflow-hidden shadow-sm bg-surface-light dark:bg-surface-dark"
    >
      <div
        class="p-5 border-b border-cream-200 dark:border-charcoal-700 flex justify-between items-center bg-cream-50/50 dark:bg-charcoal-800/50"
      >
        <h3
          class="text-lg font-semibold text-text-light dark:text-text-dark font-serif flex items-center gap-2"
        >
          <span class="material-symbols-outlined text-primary">image</span> Profile
          Image
        </h3>
        <button
          onclick={() => editSection(5)}
          class="text-primary hover:text-primary-hover dark:text-secondary dark:hover:text-cream-200 text-sm font-medium flex items-center gap-1 transition-colors"
        >
          <span class="material-symbols-outlined text-[16px]">edit</span> Edit
        </button>
      </div>
      <div class="p-6">
        {#if state?.profileImage?.previewUrl}
          <div class="flex items-center gap-5">
            <div
              class="w-20 h-20 rounded-full overflow-hidden border-2 border-cream-300 dark:border-charcoal-600 shadow-sm"
            >
              <img
                src={state.profileImage.previewUrl}
                alt="Profile"
                class="w-full h-full object-cover"
              />
            </div>
            <div>
              <p
                class="text-text-light dark:text-text-dark font-semibold mb-1 text-[15px]"
              >
                Profile image uploaded
              </p>
              <p
                class="text-[14px] text-charcoal-600 dark:text-cream-400 flex items-center gap-1.5"
              >
                {#if state.profileImage.isUploaded}
                  <span
                    class="material-symbols-outlined text-success text-[16px]"
                    >check_circle</span
                  > Successfully uploaded
                {:else}
                  <span
                    class="material-symbols-outlined text-warning animate-spin text-[16px]"
                    >sync</span
                  > Upload in progress...
                {/if}
              </p>
            </div>
          </div>
        {:else}
          <p class="text-charcoal-600 dark:text-cream-400 text-[15px] italic">
            No profile image uploaded (optional)
          </p>
        {/if}
      </div>
    </div>

    <!-- Required Questions -->
    <div
      class="border border-cream-200 dark:border-charcoal-700 rounded-xl overflow-hidden shadow-sm bg-surface-light dark:bg-surface-dark"
    >
      <div
        class="p-5 border-b border-cream-200 dark:border-charcoal-700 flex justify-between items-center bg-cream-50/50 dark:bg-charcoal-800/50"
      >
        <h3
          class="text-lg font-semibold text-text-light dark:text-text-dark font-serif flex items-center gap-2"
        >
          <span class="material-symbols-outlined text-primary">history_edu</span
          >
          Required Questions ({submissionStats.requiredAnswers}/{submissionStats.requiredTotal})
        </h3>
        <button
          onclick={() => editSection(2)}
          class="text-primary hover:text-primary-hover dark:text-secondary dark:hover:text-cream-200 text-sm font-medium flex items-center gap-1 transition-colors"
        >
          <span class="material-symbols-outlined text-[16px]">edit</span> Edit
        </button>
      </div>
      <div class="p-6">
        {#if Object.keys(state?.requiredAnswers || {}).length > 0}
          <div class="space-y-4">
            {#each Object.entries(state.requiredAnswers) as [questionId, answer] (questionId)}
              <div
                class="border border-cream-200 dark:border-charcoal-600 rounded-xl p-4 bg-background-light dark:bg-charcoal-700/40"
              >
                <div
                  class="text-[14px] font-semibold text-charcoal-700 dark:text-cream-300 mb-2"
                >
                  {getRequiredQuestionText(questionId)}
                </div>
                <div
                  class="text-text-light dark:text-text-dark text-[15px] leading-relaxed"
                >
                  {#if expandedAnswers.includes(questionId)}
                    <p>{answer}</p>
                    <button
                      onclick={() => toggleAnswerExpansion(questionId)}
                      class="text-primary dark:text-secondary hover:underline text-[13px] font-medium mt-2 flex items-center gap-1"
                    >
                      Show less <span
                        class="material-symbols-outlined text-[14px]"
                        >expand_less</span
                      >
                    </button>
                  {:else}
                    <p>{truncateText(answer)}</p>
                    {#if answer.length > 150}
                      <button
                        onclick={() => toggleAnswerExpansion(questionId)}
                        class="text-primary dark:text-secondary hover:underline text-[13px] font-medium mt-2 flex items-center gap-1"
                      >
                        Show more <span
                          class="material-symbols-outlined text-[14px]"
                          >expand_more</span
                        >
                      </button>
                    {/if}
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <p class="text-charcoal-600 dark:text-cream-400 text-[15px] italic">
            No required questions answered yet
          </p>
        {/if}
      </div>
    </div>

    <!-- Selected Categories -->
    <div
      class="border border-cream-200 dark:border-charcoal-700 rounded-xl overflow-hidden shadow-sm bg-surface-light dark:bg-surface-dark"
    >
      <div
        class="p-5 border-b border-cream-200 dark:border-charcoal-700 flex justify-between items-center bg-cream-50/50 dark:bg-charcoal-800/50"
      >
        <h3
          class="text-lg font-semibold text-text-light dark:text-text-dark font-serif flex items-center gap-2"
        >
          <span class="material-symbols-outlined text-primary">category</span>
          Selected Categories ({(state?.selectedSegments || []).length})
        </h3>
        <button
          onclick={() => editSection(3)}
          class="text-primary hover:text-primary-hover dark:text-secondary dark:hover:text-cream-200 text-sm font-medium flex items-center gap-1 transition-colors"
        >
          <span class="material-symbols-outlined text-[16px]">edit</span> Edit
        </button>
      </div>
      <div class="p-6">
        {#if (state?.selectedSegments || []).length > 0}
          <div class="flex flex-wrap gap-2.5">
            {#each state.selectedSegments as segmentKey (segmentKey)}
              <span
                class="px-4 py-1.5 bg-primary/10 border border-primary/20 text-primary dark:text-secondary rounded-full text-[14px] font-medium shadow-sm"
              >
                {getSegmentName(segmentKey)}
              </span>
            {/each}
          </div>
        {:else}
          <p class="text-charcoal-600 dark:text-cream-400 text-[15px] italic">
            No categories selected
          </p>
        {/if}
      </div>
    </div>

    <!-- Optional Questions Summary -->
    <div
      class="border border-cream-200 dark:border-charcoal-700 rounded-xl overflow-hidden shadow-sm bg-surface-light dark:bg-surface-dark"
    >
      <div
        class="p-5 border-b border-cream-200 dark:border-charcoal-700 flex justify-between items-center bg-cream-50/50 dark:bg-charcoal-800/50"
      >
        <h3
          class="text-lg font-semibold text-text-light dark:text-text-dark font-serif flex items-center gap-2"
        >
          <span class="material-symbols-outlined text-primary"
            >auto_stories</span
          >
          Optional Questions ({submissionStats.optionalAnswers} answered)
        </h3>
        <button
          onclick={() => editSection(4)}
          class="text-primary hover:text-primary-hover dark:text-secondary dark:hover:text-cream-200 text-sm font-medium flex items-center gap-1 transition-colors"
        >
          <span class="material-symbols-outlined text-[16px]">edit</span> Edit
        </button>
      </div>
      <div class="p-6">
        {#if Object.keys(state?.optionalAnswers || {}).length > 0}
          <div
            class="text-[15px] text-charcoal-600 dark:text-cream-400 mb-5 leading-relaxed"
          >
            You've answered <strong class="text-primary dark:text-secondary"
              >{submissionStats.optionalAnswers}</strong
            > optional questions across your selected categories.
          </div>

          <!-- Category breakdown -->
          <div class="space-y-3">
            {#each state?.selectedSegments || [] as segmentKey (segmentKey)}
              <div
                class="flex justify-between items-center text-[15px] border-b border-cream-100 dark:border-charcoal-700 pb-2 last:border-0 last:pb-0"
              >
                <span class="font-medium text-charcoal-700 dark:text-cream-300"
                  >{getSegmentName(segmentKey)}</span
                >
                <span class="text-primary dark:text-secondary font-semibold"
                  >{Object.entries(state?.optionalAnswers || {}).filter(
                    ([qId]) => qId.startsWith(segmentKey),
                  ).length} answers</span
                >
              </div>
            {/each}
          </div>
        {:else}
          <p class="text-charcoal-600 dark:text-cream-400 text-[15px] italic">
            No optional questions answered yet
          </p>
        {/if}
      </div>
    </div>
  </div>

  <!-- Submit Section -->
  <div
    class="mt-8 border-t border-cream-200 dark:border-charcoal-700 pt-8 pb-10"
  >
    {#if !canSubmit}
      <div
        class="mb-6 p-5 bg-warning/10 border border-warning/20 rounded-xl shadow-sm"
      >
        <div class="flex items-start gap-4">
          <span class="material-symbols-outlined text-warning mt-0.5 text-2xl"
            >warning</span
          >
          <div>
            <h3 class="font-semibold text-warning text-lg">
              Requirements not met
            </h3>
            <div class="text-[15px] text-warning/90 mt-1.5 space-y-2">
              <p>Please complete the following to submit your replica:</p>
              <ul class="list-disc list-inside space-y-1">
                {#if !state?.basics?.name?.trim() || !state?.basics?.description?.trim() || !state?.basics?.consent}
                  <li>Complete basic information with consent</li>
                {/if}
                {#if submissionStats.requiredAnswers < submissionStats.requiredTotal}
                  <li>
                    Answer all required questions ({submissionStats.requiredAnswers}/{submissionStats.requiredTotal}
                    completed)
                  </li>
                {/if}
                {#if submissionStats.optionalAnswers < 40}
                  <li>
                    Answer at least 40 optional questions ({submissionStats.optionalAnswers}/40
                    completed)
                  </li>
                {/if}
              </ul>
            </div>
          </div>
        </div>
      </div>
    {/if}

    {#if submitError}
      <div
        class="mb-6 p-5 bg-error/10 border border-error/20 rounded-xl shadow-sm"
      >
        <div class="flex items-start gap-4">
          <span class="material-symbols-outlined text-error mt-0.5 text-2xl"
            >error</span
          >
          <div>
            <h3 class="font-semibold text-error text-lg">Submission Failed</h3>
            <p class="text-[15px] text-error/90 mt-1">
              {submitError}
            </p>
          </div>
        </div>
      </div>
    {/if}

    <div class="flex justify-center mt-6">
      <button
        onclick={() => submitReplica()}
        disabled={!canSubmit || isSubmitting}
        class="btn-tactile btn-tactile-primary px-10 py-3.5 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shadow-sm text-lg w-full md:w-auto justify-center"
      >
        {#if isSubmitting}
          <svg
            class="animate-spin w-5 h-5"
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
          Creating Replica...
        {:else}
          <span class="material-symbols-outlined text-[24px]">psychology</span> Create
          My Replica
        {/if}
      </button>
    </div>

    <div
      class="mt-6 text-center text-[14px] text-charcoal-500 dark:text-cream-400 max-w-lg mx-auto leading-relaxed"
    >
      <p>
        By submitting, you agree to our terms of service and privacy policy.
      </p>
      <p>
        Your replica will be processed and available in your dashboard shortly.
      </p>
      <p
        class="mt-3 text-primary dark:text-secondary font-medium flex items-center justify-center gap-1.5 bg-primary/5 dark:bg-primary/10 rounded-lg py-2 px-3 border border-primary/10 dark:border-primary/20"
      >
        <span class="material-symbols-outlined text-[20px]">lightbulb</span>
        After creation, you can train your replica with additional files.
      </p>
    </div>
  </div>
</div>

{#if showProgress}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-background-dark/80 backdrop-blur-sm px-4"
  >
    <div
      class="w-full max-w-md bg-surface-light dark:bg-surface-dark rounded-2xl shadow-xl border border-cream-200 dark:border-charcoal-700 p-8 relative"
    >
      <h3
        class="text-xl font-bold text-text-light dark:text-text-dark mb-6 flex items-center justify-between font-serif"
      >
        <span>Replica Creation Progress</span>
        {#if progressSteps.every((s) => s.status === "done")}
          <span class="text-success text-3xl animate-bounce">🎉</span>
        {/if}
      </h3>
      <div class="space-y-4">
        {#each progressSteps as step (step.key)}
          <div class="flex items-start gap-4">
            <div class="mt-0.5">
              {#if step.status === "done"}
                <span
                  class="w-6 h-6 inline-flex items-center justify-center rounded-full bg-success/20 text-success shadow-sm"
                  ><span class="material-symbols-outlined text-[16px]"
                    >check</span
                  ></span
                >
              {:else if step.status === "working"}
                <span
                  class="w-6 h-6 inline-flex items-center justify-center rounded-full bg-primary/20 text-primary shadow-sm"
                  ><span
                    class="material-symbols-outlined text-[16px] animate-spin"
                    >sync</span
                  ></span
                >
              {:else if step.status === "error"}
                <span
                  class="w-6 h-6 inline-flex items-center justify-center rounded-full bg-error/20 text-error shadow-sm"
                  ><span class="material-symbols-outlined text-[16px]"
                    >close</span
                  ></span
                >
              {:else}
                <span
                  class="w-6 h-6 inline-flex items-center justify-center rounded-full bg-cream-200 dark:bg-charcoal-700 text-charcoal-500 dark:text-cream-500 shadow-sm"
                  ><span class="w-2 h-2 rounded-full bg-current opacity-50"
                  ></span></span
                >
              {/if}
            </div>
            <div class="flex-1">
              <p
                class="text-[15px] font-medium text-text-light dark:text-text-dark leading-tight mt-0.5"
              >
                {step.label}
              </p>
              {#if step.key === "train"}
                <p
                  class="text-[13px] text-charcoal-500 dark:text-cream-400 mt-1"
                >
                  Training your replica with the answers you've provided...
                </p>
              {:else if step.key === "fetch"}
                <p
                  class="text-[13px] text-charcoal-500 dark:text-cream-400 mt-1"
                >
                  Ensuring replica is ready for chat...
                </p>
              {/if}
            </div>
          </div>
        {/each}
      </div>
      <div
        class="mt-6 text-[14px] text-charcoal-600 dark:text-cream-400 min-h-[20px] bg-cream-50/50 dark:bg-charcoal-700/50 p-4 rounded-lg font-medium border border-cream-100 dark:border-charcoal-600"
      >
        {progressMessage}
      </div>
      {#if submitError}
        <div
          class="mt-4 p-4 bg-error/10 border border-error/20 rounded-lg text-[14px] text-error font-medium"
        >
          {submitError}
        </div>
      {/if}
      <div class="mt-8 flex justify-end gap-3">
        {#if submitError}
          <button
            class="btn-tactile btn-tactile-primary px-5 py-2 text-white rounded-lg font-medium"
            onclick={resumeSubmission}
          >
            Retry
          </button>
          <button
            class="btn-tactile px-5 py-2 border border-cream-300 dark:border-charcoal-600 text-charcoal-700 dark:text-cream-300 rounded-lg font-medium hover:bg-cream-100 dark:hover:bg-charcoal-700"
            onclick={dismissProgress}
          >
            Close
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}
