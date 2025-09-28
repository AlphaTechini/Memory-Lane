<script>
  import { onMount } from 'svelte';
  import { wizardStore } from '$lib/stores/wizardStore.js';
  import { REQUIRED_QUESTIONS, OPTIONAL_SEGMENTS, getRequiredQuestionsByTemplate } from '$lib/questionBank.js';
  import { goto } from '$app/navigation';
  import { apiCall } from '$lib/auth.js';
  import { apiUrl } from '$lib/utils/api.js';
    import { getApiBase } from '$lib/apiBase.js';
    const API_BASE_URL = getApiBase();

  let state = $state({
    basics: {},
    requiredAnswers: {},
    optionalAnswers: {},
    selectedSegments: []
  });
  let isSubmitting = $state(false);
  let submitError = $state(null);
  const defaultProgressSteps = () => ([
    { key: 'create', label: 'Creating replica', status: 'pending' },
    { key: 'train', label: 'Training replica', status: 'idle' },
    { key: 'fetch', label: 'Fetching replica details', status: 'idle' },
    { key: 'finalize', label: 'Finalizing', status: 'idle' }
  ]);
  let showProgress = $state(false);
  let progressSteps = $state(defaultProgressSteps());
  let progressMessage = $state('');
  let lastFailedStep = $state(null);
  let expandedAnswers = $state([]);
  let progressInterval = null;
  
  // Subscribe to wizard store
  let unsubscribe;
  onMount(() => {
    unsubscribe = wizardStore.subscribe(value => {
      state = value;
      const progress = value?.submissionProgress;
      if (progress) {
        showProgress = progress.showProgress ?? false;
        progressSteps = progress.steps?.length ? progress.steps : defaultProgressSteps();
        progressMessage = progress.message ?? '';
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
  let requiredQuestions = $derived(state?.template ? getRequiredQuestionsByTemplate(state.template) : REQUIRED_QUESTIONS);

  let canSubmit = $derived(() => {
    if (!state) return false;
    const hasBasics = state.basics?.name?.trim() && state.basics?.description?.trim() && state.basics?.consent;
    const hasRequiredAnswers = Object.keys(state.requiredAnswers || {}).length >= requiredQuestions.length;
    const hasOptionalAnswers = Object.keys(state.optionalAnswers || {}).length >= 40; // keep threshold
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
      coverageScore: wizardStore.calculateCoverageScore()
    };
  });

  function getSegmentName(segmentKey) {
    return OPTIONAL_SEGMENTS[segmentKey]?.name || segmentKey;
  }

  function toggleAnswerExpansion(questionId) {
    if (expandedAnswers.includes(questionId)) {
      expandedAnswers = expandedAnswers.filter(id => id !== questionId);
    } else {
      expandedAnswers = [...expandedAnswers, questionId];
    }
  }

  function truncateText(text, maxLength = 150) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  function editSection(section) {
    wizardStore.setCurrentStep(section);
  }

  function persistProgress(extra = {}) {
    wizardStore.updateSubmissionProgress(prev => ({
      ...prev,
      steps: progressSteps,
      message: progressMessage,
      showProgress,
      submitError,
      lastFailedStep,
      ...extra
    }));
  }

  function resetProgressState() {
    progressSteps = defaultProgressSteps();
    progressMessage = '';
    submitError = null;
    lastFailedStep = null;
    persistProgress({
      steps: progressSteps,
      message: progressMessage,
      submitError: null,
      lastFailedStep: null,
      baselineReplicaIds: [],
      recoveredReplica: null
    });
  }

  function updateProgress(key, updates) {
    progressSteps = progressSteps.map(step => step.key === key ? { ...step, ...updates } : step);
    persistProgress();
  }

  function setProgressMessage(message) {
    progressMessage = message;
    persistProgress();
  }

  function markFailure(stepKey) {
    const keys = progressSteps.map(step => step.key);
    const targetIndex = keys.indexOf(stepKey);
    progressSteps = progressSteps.map((step, idx) => {
      if (targetIndex === -1) {
        if (idx === 0) {
          return { ...step, status: idx === 0 ? 'error' : 'idle' };
        }
        return { ...step, status: 'idle' };
      }
      if (idx < targetIndex) {
        return { ...step, status: 'done' };
      }
      if (idx === targetIndex) {
        return { ...step, status: 'error' };
      }
      return { ...step, status: 'idle' };
    });
    persistProgress();
  }

  function prepareResumeSteps(stepKey) {
    const keys = progressSteps.map(step => step.key);
    const targetIndex = keys.indexOf(stepKey);
    progressSteps = progressSteps.map((step, idx) => {
      if (targetIndex === -1) {
        return idx === 0
          ? { ...step, status: 'working' }
          : { ...step, status: 'idle' };
      }
      if (idx < targetIndex) {
        return { ...step, status: 'done' };
      }
      if (idx === targetIndex) {
        return { ...step, status: 'working' };
      }
      return { ...step, status: 'idle' };
    });
    persistProgress();
  }

  async function fetchReplicaSnapshot() {
    try {
      const response = await apiCall('/api/user/replicas');
      if (!response.ok) return [];
      const data = await response.json();
      if (Array.isArray(data?.replicas)) {
        return data.replicas;
      }
      return [];
    } catch (error) {
      console.warn('Failed to fetch replica snapshot:', error);
      return [];
    }
  }

  function normalizeReplica(replica) {
    if (!replica) return null;
    const id = replica.replicaId || replica.id || replica.uuid;
    if (!id) return null;
    return {
      ...replica,
      id,
      name: replica.name || replica.title || 'Replica'
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

    updateProgress('create', { status: 'done' });
    updateProgress('train', { status: 'done' });
    if (trainingCount > 0) {
      setProgressMessage(`Training completed: ${trainingCount} knowledge entries created`);
    } else {
      setProgressMessage('Training completed with basic knowledge');
    }

    updateProgress('fetch', { status: 'working' });
    setProgressMessage('Fetching replica details...');

    let hydratedReplica = replica;
    if (replica.id) {
      try {
        const polled = await pollReplica(replica.id, 6, 1500);
        if (polled && polled.id) {
          hydratedReplica = { ...replica, ...polled, id: replica.id };
        }
      } catch (pollErr) {
        console.warn('Replica polling failed, using initial data:', pollErr);
      }
    }

    updateProgress('fetch', { status: 'done' });
    updateProgress('finalize', { status: 'working' });
    setProgressMessage('Finalizing and preparing chat...');

    if (hydratedReplica?.id) {
      try {
        sessionStorage.setItem('newReplica', JSON.stringify(hydratedReplica));
      } catch (storageError) {
        console.warn('Could not persist new replica info to sessionStorage:', storageError);
      }
      wizardStore.setReplicaId(hydratedReplica.id);
    }

    updateProgress('finalize', { status: 'done' });
    setProgressMessage(`✅ Replica "${hydratedReplica?.name || replica.name || 'Replica'}" successfully created! Redirecting to chat...`);

    lastFailedStep = null;
    submitError = null;
    persistProgress({
      showProgress: true,
      lastFailedStep: null,
      submitError: null,
      baselineReplicaIds: [],
      recoveredReplica: hydratedReplica
    });

    setTimeout(() => {
      showProgress = false;
      persistProgress({ showProgress: false });
      wizardStore.clearSubmissionProgress();
      wizardStore.reset();
      if (hydratedReplica?.id) {
        goto(`/chat-replicas?created=true&replicaId=${encodeURIComponent(hydratedReplica.id)}`);
      } else {
        goto('/chat-replicas?created=true');
      }
    }, 1500);
  }

  function resumeSubmission() {
    const resumeKey = state?.submissionProgress?.lastFailedStep || lastFailedStep || 'create';
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
    try { return JSON.parse(text); } catch { return { _raw: text }; }
  }

  async function pollReplica(id, attempts = 6, delayMs = 1500) {
    for (let i=0;i<attempts;i++) {
      try {
        const resp = await fetch(`${API_BASE_URL}/api/replicas/${id}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        });
        if (resp.ok) {
          const data = await safeJson(resp);
            if (data?.replica) return data.replica;
        }
      } catch (error) {
        console.error('Failed to poll replica details:', error);
      }
      await new Promise(r => setTimeout(r, delayMs));
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

    const targetStep = resume ? (resumeFrom || lastFailedStep || 'create') : 'create';

    if (!resume) {
      resetProgressState();
    }

    prepareResumeSteps(targetStep);
    setProgressMessage(resume ? 'Resuming replica creation...' : 'Initializing...');
    lastFailedStep = null;

    const progressState = state?.submissionProgress || {};
    let baselineIdsSet;

    if (resume && Array.isArray(progressState.baselineReplicaIds) && progressState.baselineReplicaIds.length) {
      baselineIdsSet = new Set(progressState.baselineReplicaIds);
    } else {
      const baselineSnapshot = await fetchReplicaSnapshot();
      baselineIdsSet = new Set(
        baselineSnapshot
          .map(rep => normalizeReplica(rep)?.id)
          .filter(Boolean)
      );
      persistProgress({ baselineReplicaIds: Array.from(baselineIdsSet) });
    }

    persistProgress({ showProgress: true, submitError: null, lastFailedStep: null });

    try {
      const submissionData = {
        name: state.basics.name,
        description: state.basics.description,
        greeting: state.basics.greeting || '',
        preferredQuestion: state.basics.preferredQuestion || '',
        template: state.template || null,
        relationship: state.relationship || null,
        requiredAnswers: state.requiredAnswers,
        optionalAnswers: state.optionalAnswers,
        selectedSegments: state.selectedSegments,
        profileImage: state.profileImage?.cloudinaryUrl || null,
        coverageScore: wizardStore.calculateCoverageScore()
      };

      setProgressMessage('Creating replica in Sensay API...');

      progressInterval = setInterval(() => {
        const currentStep = progressSteps.find(s => s.status === 'working');
        if (currentStep?.key === 'create') {
          updateProgress('create', { status: 'done' });
          updateProgress('train', { status: 'working' });
          setProgressMessage('Training your replica with provided answers...');
        } else if (currentStep?.key === 'train') {
          setProgressMessage('Processing knowledge entries (this may take up to 2 minutes)...');
        }
      }, 3000);

      const response = await fetch(`${API_BASE_URL}/api/replicas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify(submissionData)
      });

      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }

      const result = await safeJson(response);
      if (!response.ok || !result?.success || !result?.replica) {
        throw new Error(result?.error || 'Failed to create replica');
      }

      const normalizedReplica = normalizeReplica(result.replica);
      if (!normalizedReplica) {
        throw new Error('Replica created but response was missing an id');
      }

      await handleSuccessfulReplica(normalizedReplica, result?.replica?.trainingCount ?? 0);
      return;
    } catch (error) {
      console.error('Submission error:', error);
      const message = error?.message || 'Unknown error';
      submitError = message;
      setProgressMessage('Error: ' + message);

      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }

  baselineIdsSet = baselineIdsSet || new Set();
  const recoveredReplica = await attemptRecoveryAfterFailure(baselineIdsSet);
      if (recoveredReplica) {
        await handleSuccessfulReplica(recoveredReplica, recoveredReplica?.trainingCount || 0);
        return;
      }

      const current = progressSteps.find(s => s.status === 'working');
      const failureKey = current?.key || resumeFrom || lastFailedStep || 'create';
      lastFailedStep = failureKey;
      markFailure(failureKey);
      persistProgress({
        submitError,
        lastFailedStep,
        showProgress: true,
        baselineReplicaIds: Array.from(baselineIdsSet || [])
      });
    } finally {
      isSubmitting = false;
    }
  }

  function getRequiredQuestionText(questionId) {
    return REQUIRED_QUESTIONS.find(q => q.id === questionId)?.text || 'Unknown question';
  }
</script>

<div class="p-6">
  <div class="mb-6">
    <h2 class="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Review & Submit</h2>
    <p class="text-gray-600 dark:text-gray-400">
      Review your replica information before submitting. You can edit any section by clicking the "Edit" button.
    </p>
  </div>

  <!-- Submission Summary -->
  <div class="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
      <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">{submissionStats.totalAnswers}</div>
      <div class="text-sm text-blue-700 dark:text-blue-300">Total Answers</div>
    </div>
    <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
      <div class="text-2xl font-bold text-green-600 dark:text-green-400">{submissionStats.requiredAnswers}</div>
      <div class="text-sm text-green-700 dark:text-green-300">Required Answered</div>
    </div>
    <div class="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
      <div class="text-2xl font-bold text-purple-600 dark:text-purple-400">{submissionStats.optionalAnswers}</div>
      <div class="text-sm text-purple-700 dark:text-purple-300">Optional Answered</div>
    </div>
    <div class="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
      <div class="text-2xl font-bold text-orange-600 dark:text-orange-400">{submissionStats.coverageScore}%</div>
      <div class="text-sm text-orange-700 dark:text-orange-300">Coverage Score</div>
    </div>
  </div>

  <div class="space-y-6">
    <!-- Basic Information -->
    <div class="border border-gray-200 dark:border-gray-600 rounded-lg">
      <div class="p-4 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center">
        <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">Basic Information</h3>
        <button
          onclick={() => editSection(1)}
          class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 text-sm font-medium"
        >
          Edit
        </button>
      </div>
      <div class="p-4 space-y-4">
        <div>
          <span class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</span>
          <p class="text-gray-900 dark:text-gray-100">{state?.basics?.name || 'Not provided'}</p>
        </div>
        <div>
          <span class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</span>
          <p class="text-gray-900 dark:text-gray-100">{state?.basics?.description || 'Not provided'}</p>
        </div>
        <div>
          <span class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Custom Greeting</span>
          <p class="text-gray-900 dark:text-gray-100">{state?.basics?.greeting || 'Not provided (will use default)'}</p>
        </div>
        <div>
          <span class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Preferred Question</span>
          <p class="text-gray-900 dark:text-gray-100">{state?.basics?.preferredQuestion || 'Not provided (will use default)'}</p>
        </div>
        <div>
          <span class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Consent</span>
          <p class="text-gray-900 dark:text-gray-100">
            {state?.basics?.consent ? '✓ Provided' : '✗ Not provided'}
          </p>
        </div>
      </div>
    </div>

    <!-- Profile Image -->
    <div class="border border-gray-200 dark:border-gray-600 rounded-lg">
      <div class="p-4 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center">
        <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">Profile Image</h3>
        <button
          onclick={() => editSection(5)}
          class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 text-sm font-medium"
        >
          Edit
        </button>
      </div>
      <div class="p-4">
        {#if state?.profileImage?.previewUrl}
          <div class="flex items-center gap-4">
            <div class="w-16 h-16 rounded-full overflow-hidden border-2 border-gray-200 dark:border-gray-600">
              <img 
                src={state.profileImage.previewUrl} 
                alt="Profile"
                class="w-full h-full object-cover"
              />
            </div>
            <div>
              <p class="text-gray-900 dark:text-gray-100 font-medium">Profile image uploaded</p>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                {state.profileImage.isUploaded ? 'Successfully uploaded' : 'Upload in progress...'}
              </p>
            </div>
          </div>
        {:else}
          <p class="text-gray-600 dark:text-gray-400">No profile image uploaded (optional)</p>
        {/if}
      </div>
    </div>

    <!-- Required Questions -->
    <div class="border border-gray-200 dark:border-gray-600 rounded-lg">
      <div class="p-4 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center">
        <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">
          Required Questions ({submissionStats.requiredAnswers}/{submissionStats.requiredTotal})
        </h3>
        <button
          onclick={() => editSection(2)}
          class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 text-sm font-medium"
        >
          Edit
        </button>
      </div>
      <div class="p-4">
        {#if Object.keys(state?.requiredAnswers || {}).length > 0}
          <div class="space-y-3">
            {#each Object.entries(state.requiredAnswers) as [questionId, answer] (questionId)}
              <div class="border border-gray-100 dark:border-gray-700 rounded-lg p-3">
                <div class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {getRequiredQuestionText(questionId)}
                </div>
                <div class="text-gray-900 dark:text-gray-100">
                  {#if expandedAnswers.includes(questionId)}
                    <p>{answer}</p>
                    <button
                      onclick={() => toggleAnswerExpansion(questionId)}
                      class="text-blue-600 dark:text-blue-400 text-sm mt-1"
                    >
                      Show less
                    </button>
                  {:else}
                    <p>{truncateText(answer)}</p>
                    {#if answer.length > 150}
                      <button
                        onclick={() => toggleAnswerExpansion(questionId)}
                        class="text-blue-600 dark:text-blue-400 text-sm mt-1"
                      >
                        Show more
                      </button>
                    {/if}
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <p class="text-gray-600 dark:text-gray-400">No required questions answered yet</p>
        {/if}
      </div>
    </div>

    <!-- Selected Categories -->
    <div class="border border-gray-200 dark:border-gray-600 rounded-lg">
      <div class="p-4 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center">
        <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">
          Selected Categories ({(state?.selectedSegments || []).length})
        </h3>
        <button
          onclick={() => editSection(3)}
          class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 text-sm font-medium"
        >
          Edit
        </button>
      </div>
      <div class="p-4">
        {#if (state?.selectedSegments || []).length > 0}
          <div class="flex flex-wrap gap-2">
            {#each state.selectedSegments as segmentKey (segmentKey)}
              <span class="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm">
                {getSegmentName(segmentKey)}
              </span>
            {/each}
          </div>
        {:else}
          <p class="text-gray-600 dark:text-gray-400">No categories selected</p>
        {/if}
      </div>
    </div>

    <!-- Optional Questions Summary -->
    <div class="border border-gray-200 dark:border-gray-600 rounded-lg">
      <div class="p-4 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center">
        <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">
          Optional Questions ({submissionStats.optionalAnswers} answered)
        </h3>
        <button
          onclick={() => editSection(4)}
          class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 text-sm font-medium"
        >
          Edit
        </button>
      </div>
      <div class="p-4">
        {#if Object.keys(state?.optionalAnswers || {}).length > 0}
          <div class="text-sm text-gray-600 dark:text-gray-400 mb-3">
            You've answered {submissionStats.optionalAnswers} optional questions across your selected categories.
          </div>
          
          <!-- Category breakdown -->
          <div class="space-y-2">
            {#each (state?.selectedSegments || []) as segmentKey (segmentKey)}
              <div class="flex justify-between items-center text-sm">
                <span class="text-gray-700 dark:text-gray-300">{getSegmentName(segmentKey)}</span>
                <span class="text-gray-600 dark:text-gray-400">{Object.entries(state?.optionalAnswers || {}).filter(([qId]) => qId.startsWith(segmentKey)).length} answers</span>
              </div>
            {/each}
          </div>
        {:else}
          <p class="text-gray-600 dark:text-gray-400">No optional questions answered yet</p>
        {/if}
      </div>
    </div>
  </div>

  <!-- Submit Section -->
  <div class="mt-8 border-t border-gray-200 dark:border-gray-600 pt-6">
    {#if !canSubmit}
      <div class="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <div class="flex items-start gap-3">
          <svg class="flex-shrink-0 w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
          </svg>
          <div>
            <h3 class="font-medium text-yellow-800 dark:text-yellow-200">Requirements not met</h3>
            <div class="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
              <p>Please complete the following to submit your replica:</p>
              <ul class="list-disc list-inside mt-2 space-y-1">
                {#if !state?.basics?.name?.trim() || !state?.basics?.description?.trim() || !state?.basics?.consent}
                  <li>Complete basic information with consent</li>
                {/if}
                {#if submissionStats.requiredAnswers < submissionStats.requiredTotal}
                  <li>Answer all required questions ({submissionStats.requiredAnswers}/{submissionStats.requiredTotal} completed)</li>
                {/if}
                {#if submissionStats.optionalAnswers < 40}
                  <li>Answer at least 40 optional questions ({submissionStats.optionalAnswers}/40 completed)</li>
                {/if}
              </ul>
            </div>
          </div>
        </div>
      </div>
    {/if}

    {#if submitError}
      <div class="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <div class="flex items-start gap-3">
          <svg class="flex-shrink-0 w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div>
            <h3 class="font-medium text-red-800 dark:text-red-200">Submission Failed</h3>
            <p class="text-sm text-red-700 dark:text-red-300 mt-1">{submitError}</p>
          </div>
        </div>
      </div>
    {/if}

    <div class="flex justify-center">
      <button
        onclick={() => submitReplica()}
        disabled={!canSubmit || isSubmitting}
        class="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
      >
        {#if isSubmitting}
          <svg class="animate-spin w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
          </svg>
          Creating Replica...
        {:else}
          Create My Replica
        {/if}
      </button>
    </div>

    <div class="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
      <p>By submitting, you agree to our terms of service and privacy policy.</p>
      <p>Your replica will be processed and available in your dashboard shortly.</p>
      <p class="mt-2 text-blue-600 dark:text-blue-400">💡 After creation, you can continue training your replica with additional questions from the "Train Models" page.</p>
    </div>
  </div>
</div>

{#if showProgress}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
    <div class="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 relative">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
        <span>Replica Creation Progress</span>
        {#if progressSteps.every(s=>s.status==='done')}
          <span class="text-green-600 text-xl">🎉</span>
        {/if}
      </h3>
      <div class="space-y-3">
        {#each progressSteps as step (step.key)}
          <div class="flex items-start gap-3">
            <div class="mt-0.5">
              {#if step.status === 'done'}
                <span class="w-5 h-5 inline-flex items-center justify-center rounded-full bg-green-100 text-green-600 text-xs">✓</span>
              {:else if step.status === 'working'}
                <svg class="w-5 h-5 animate-spin text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              {:else if step.status === 'error'}
                <span class="w-5 h-5 inline-flex items-center justify-center rounded-full bg-red-100 text-red-600 text-xs">!</span>
              {:else}
                <span class="w-5 h-5 inline-flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 text-xs">•</span>
              {/if}
            </div>
            <div class="flex-1">
              <p class="text-sm font-medium text-gray-800 dark:text-gray-200">{step.label}</p>
              {#if step.key === 'train'}
                <p class="text-xs text-gray-500 dark:text-gray-400">Training your replica with the answers you've provided...</p>
              {:else if step.key === 'fetch'}
                <p class="text-xs text-gray-500 dark:text-gray-400">Ensuring replica is ready for chat...</p>
              {/if}
            </div>
          </div>
        {/each}
      </div>
      <div class="mt-4 text-sm text-gray-600 dark:text-gray-400 min-h-[20px]">{progressMessage}</div>
      {#if submitError}
        <div class="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded text-sm text-red-700 dark:text-red-300">
          {submitError}
        </div>
      {/if}
      <div class="mt-6 flex justify-end gap-2">
        {#if submitError}
          <button
            class="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
            onclick={resumeSubmission}
          >
            Retry
          </button>
          <button
            class="px-4 py-2 text-sm rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
            onclick={dismissProgress}
          >
            Close
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}
