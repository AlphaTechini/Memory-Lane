<script>
  import { onMount } from 'svelte';
  import { wizardStore, coverageScore } from '$lib/stores/wizardStore.js';
  import { REQUIRED_QUESTIONS, OPTIONAL_SEGMENTS } from '$lib/questionBank.js';
  import { goto } from '$app/navigation';

  const API_BASE_URL = 'http://localhost:4000';

  let state = $state({
    basics: {},
    requiredAnswers: {},
    optionalAnswers: {},
    selectedSegments: []
  });
  let isSubmitting = $state(false);
  let submitError = $state(null);
  let editingSection = $state(null);
  let expandedAnswers = $state(new Set());
  
  // Subscribe to wizard store
  let unsubscribe;
  onMount(() => {
    unsubscribe = wizardStore.subscribe(value => {
      state = value;
    });
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  });

  // Calculate submission readiness
  let canSubmit = $derived(() => {
    if (!state) return false;
    
    const hasBasics = state.basics?.name?.trim() && state.basics?.description?.trim() && state.basics?.consent;
    const hasRequiredAnswers = Object.keys(state.requiredAnswers || {}).length >= 10;
    const hasOptionalAnswers = Object.keys(state.optionalAnswers || {}).length >= 40;
    
    return hasBasics && hasRequiredAnswers && hasOptionalAnswers;
  });

  let submissionStats = $derived(() => {
    const requiredCount = Object.keys(state?.requiredAnswers || {}).length;
    const optionalCount = Object.keys(state?.optionalAnswers || {}).length;
    
    return {
      requiredAnswers: requiredCount,
      optionalAnswers: optionalCount,
      totalAnswers: requiredCount + optionalCount
    };
  });

  function getSegmentName(segmentKey) {
    return OPTIONAL_SEGMENTS[segmentKey]?.name || segmentKey;
  }

  function toggleAnswerExpansion(questionId) {
    if (expandedAnswers.has(questionId)) {
      expandedAnswers.delete(questionId);
    } else {
      expandedAnswers.add(questionId);
    }
    expandedAnswers = new Set(expandedAnswers);
  }

  function truncateText(text, maxLength = 150) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  function editSection(section) {
    editingSection = section;
    wizardStore.setCurrentStep(section);
  }

  async function submitReplica() {
    if (!canSubmit) return;
    
    isSubmitting = true;
    submitError = null;

    try {
      // Prepare submission data
      const submissionData = {
        name: state.basics.name,
        description: state.basics.description,
        requiredAnswers: state.requiredAnswers,
        optionalAnswers: state.optionalAnswers,
        selectedSegments: state.selectedSegments,
        profileImage: state.profileImage?.cloudinaryUrl || null,
        coverageScore: wizardStore.calculateCoverageScore()
      };

      // Submit to backend API
      const response = await fetch(`${API_BASE_URL}/api/replicas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify(submissionData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create replica');
      }

      const result = await response.json();
      
      // Clear wizard state
      wizardStore.reset();
      
      // Redirect to chat interface
      goto('/chat-replicas?created=true');
      
    } catch (error) {
      console.error('Submission error:', error);
      submitError = error.message;
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
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
          <p class="text-gray-900 dark:text-gray-100">{state?.basics?.name || 'Not provided'}</p>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
          <p class="text-gray-900 dark:text-gray-100">{state?.basics?.description || 'Not provided'}</p>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Consent</label>
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
          Required Questions ({submissionStats.requiredAnswers}/10)
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
                  {#if expandedAnswers.has(questionId)}
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
              {@const segmentAnswers = Object.entries(state?.optionalAnswers || {}).filter(([qId]) => 
                qId.startsWith(segmentKey)
              ).length}
              <div class="flex justify-between items-center text-sm">
                <span class="text-gray-700 dark:text-gray-300">{getSegmentName(segmentKey)}</span>
                <span class="text-gray-600 dark:text-gray-400">{segmentAnswers} answers</span>
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
                {#if submissionStats.requiredAnswers < 10}
                  <li>Answer all 10 required questions ({submissionStats.requiredAnswers}/10 completed)</li>
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
        onclick={submitReplica}
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
