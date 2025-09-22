<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { checkAuthStatus } from '$lib/auth.js';
  import { OPTIONAL_SEGMENTS, getAllOptionalQuestions } from '$lib/questionBank.js';

  const API_BASE_URL = 'http://localhost:4000';

  let isAuthenticated = false;
  let replicas = [];
  let selectedReplica = null;
  let questions = [];
  let selectedSegments = [];
  let answers = {};
  let currentQuestionIndex = 0;
  let isLoading = false;
  let error = '';
  let successMessage = '';
  let selectedFilter = 'all';

  onMount(async () => {
    isAuthenticated = checkAuthStatus();
    if (!isAuthenticated) {
      goto('/login');
      return;
    }

    await loadUserReplicas();
    if (replicas.length === 0) {
      try {
        console.debug('train-models reconcile - token present:', !!localStorage.getItem('authToken'));
        const rec = await fetch(`${API_BASE_URL}/api/replicas/reconcile`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        });
        if (rec.ok) {
          const diff = await rec.json();
          if (diff.added?.length || diff.updated?.length) {
            await loadUserReplicas();
          }
        }
      } catch (e) {
        console.warn('Reconcile failed on train page', e);
      }
    }
    questions = getAllOptionalQuestions();
  });

  async function loadUserReplicas() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/user/replicas`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load replicas');
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
        console.warn('Failed to load saved training answers');
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
    const answer = answers[questionId] || '';
    const question = questions.find(q => q.id === questionId);
    return answer.trim().length >= (question?.minLength || 40);
  }

  function getCompletionStats() {
  const completed = questions.filter(q => isQuestionAnswered(q.id)).length;
  const started = Object.entries(answers).filter(([id, val]) => (val || '').trim().length > 0).length;
  return { completed, started, answered: completed, total: questions.length };
  }

  $: filteredQuestions = selectedFilter === 'all' 
    ? questions.filter(q => selectedSegments.includes(q.segment))
    : questions.filter(q => q.segment === selectedFilter && selectedSegments.includes(q.segment));

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

  async function submitTraining() {
    if (!selectedReplica) return;

    isLoading = true;
    error = '';
    successMessage = '';

    try {
      // Prepare training data from answered questions
      const trainingData = [];
      
      Object.entries(answers).forEach(([questionId, answer]) => {
        if (answer?.trim()) {
          const question = questions.find(q => q.id === questionId);
          if (question) {
            trainingData.push({
              replicaId: selectedReplica.replicaId,
              title: `Training: ${question.text}`,
              rawText: answer
            });
          }
        }
      });

      if (trainingData.length === 0) {
        error = 'Please answer at least one question before submitting.';
        return;
      }

      // Submit each training entry
      let successCount = 0;
      for (const training of trainingData) {
        try {
          const response = await fetch(`${API_BASE_URL}/api/replicas/train`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify(training)
          });

          if (response.ok) {
            successCount++;
          }
        } catch (err) {
          console.warn('Failed to submit training entry:', training.title);
        }
      }

      if (successCount > 0) {
        successMessage = `Successfully submitted ${successCount} training entries to your replica!`;
        // Clear saved answers
        const savedKey = `train-${selectedReplica.replicaId}`;
        localStorage.removeItem(savedKey);
        answers = {};
      } else {
        error = 'Failed to submit training data. Please try again.';
      }

    } catch (err) {
      error = err.message;
    } finally {
      isLoading = false;
    }
  }

  function selectReplica(replica) {
    selectedReplica = replica;
    selectedSegments = replica.selectedSegments && replica.selectedSegments.length
      ? replica.selectedSegments
      : Object.keys(OPTIONAL_SEGMENTS); // fallback so questions appear
    answers = {};
    currentQuestionIndex = 0;
    loadSavedAnswers();
  }
</script>

<svelte:head>
  <title>Train Models - Memory Lane</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
  <div class="max-w-4xl mx-auto px-4">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        Train Your Replicas
      </h1>
      <p class="text-gray-600 dark:text-gray-400">
        Continue training your AI replicas with additional questions to make them more personalized.
      </p>
    </div>

    <!-- Error/Success Messages -->
    {#if error}
      <div class="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p class="text-red-700 dark:text-red-300">{error}</p>
      </div>
    {/if}

    {#if successMessage}
      <div class="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
        <p class="text-green-700 dark:text-green-300">{successMessage}</p>
      </div>
    {/if}

    <!-- Replica Selection -->
    {#if replicas.length > 0}
      <div class="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Select Replica to Train</h2>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {#each replicas as replica (replica.replicaId)}
            <button
              onclick={() => replica.status !== 'REMOVED_REMOTE' && selectReplica(replica)}
              class="relative text-left p-4 rounded-lg border transition-colors {selectedReplica?.replicaId === replica.replicaId 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'} {replica.status === 'REMOVED_REMOTE' ? 'opacity-60 cursor-not-allowed' : ''}"
            >
              <h3 class="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                {replica.name}
                {#if replica.status}
                  <span class="text-[10px] px-2 py-0.5 rounded uppercase tracking-wide font-semibold {replica.status === 'CREATED' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : ''} {replica.status === 'PENDING_CREATE' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' : ''} {replica.status === 'REMOVED_REMOTE' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : ''} {replica.status === 'ERROR' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : ''}">
                    {replica.status.replace('_',' ')}
                  </span>
                {/if}
              </h3>
              <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">{replica.description}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {replica.selectedSegments?.length || 0} categories selected
              </p>
              {#if replica.status === 'REMOVED_REMOTE'}
                <div class="absolute inset-0 bg-white/60 dark:bg-gray-800/60 flex items-center justify-center text-xs font-semibold text-red-600 dark:text-red-400 rounded-lg">
                  Removed at remote
                </div>
              {/if}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    {#if selectedReplica && filteredQuestions.length > 0}
      <!-- Progress Overview -->
      {#key selectedReplica?.replicaId}
      <div class="mb-6 grid gap-4 sm:grid-cols-4">
        <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">{getCompletionStats().started}</div>
          <div class="text-sm text-blue-700 dark:text-blue-300">Started</div>
        </div>
        <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div class="text-2xl font-bold text-green-600 dark:text-green-400">{getCompletionStats().completed}</div>
          <div class="text-sm text-green-700 dark:text-green-300">Completed (>= min)</div>
        </div>
        <div class="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
          <div class="text-2xl font-bold text-gray-600 dark:text-gray-400">{filteredQuestions.length}</div>
          <div class="text-sm text-gray-700 dark:text-gray-300">Total Shown</div>
        </div>
        <div class="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
          <div class="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            {filteredQuestions.length > 0 ? Math.round((getCompletionStats().completed / filteredQuestions.length) * 100) : 0}%
          </div>
          <div class="text-sm text-indigo-700 dark:text-indigo-300">Completion %</div>
        </div>
      </div>
      {/key}

      <!-- Category Filter -->
      <div class="mb-6">
        <label for="categoryFilter" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Filter by category:</label>
        <select 
          id="categoryFilter"
          bind:value={selectedFilter}
          class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        >
          <option value="all">All Categories ({filteredQuestions.length})</option>
          {#each selectedSegments as segment}
            <option value={segment}>
              {OPTIONAL_SEGMENTS[segment]?.name || segment} ({questions.filter(q => q.segment === segment).length})
            </option>
          {/each}
        </select>
      </div>

      {#if currentQuestion}
        <!-- Current Question -->
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
          <div class="p-6">
            <div class="mb-4">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">
                  {OPTIONAL_SEGMENTS[currentQuestion.segment]?.name || currentQuestion.segment}
                </span>
                <span class="text-sm text-gray-500 dark:text-gray-400">
                  Question {currentQuestionIndex + 1} of {filteredQuestions.length}
                </span>
              </div>
              <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">
                {currentQuestion.text}
              </h3>
            </div>
            
            <div class="mb-4">
              <textarea
                value={answers[currentQuestion.id] || ''}
                oninput={(e) => updateAnswer(currentQuestion.id, e.target.value)}
                rows="6"
                class="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors
                  {answers[currentQuestion.id]?.length > 0 && !isQuestionAnswered(currentQuestion.id) ? 'border-orange-400 dark:border-orange-500 focus:ring-orange-500' : ''}
                  {isQuestionAnswered(currentQuestion.id) ? 'border-green-500 dark:border-green-500 focus:ring-green-500' : ''}
                  {(!answers[currentQuestion.id] || answers[currentQuestion.id].length === 0) ? 'border-gray-300 dark:border-gray-600 focus:ring-blue-500' : ''}"
                placeholder="Share your thoughts... (minimum {currentQuestion.minLength} characters)"
              ></textarea>
              
              <div class="mt-3 flex justify-between items-center">
                <div class="text-sm">
                  <span class="text-gray-500 dark:text-gray-400">{getAnswerLength(currentQuestion.id)} chars</span>
                  {#if answers[currentQuestion.id]?.length > 0 && !isQuestionAnswered(currentQuestion.id)}
                    <span class="ml-2 text-orange-600 dark:text-orange-400 font-medium">Need {Math.max(0, currentQuestion.minLength - getAnswerLength(currentQuestion.id))} more</span>
                  {/if}
                  {#if isQuestionAnswered(currentQuestion.id)}
                    <span class="ml-2 text-green-600 dark:text-green-400 font-medium">Meets minimum</span>
                  {/if}
                </div>
                <div class="flex items-center gap-2 text-xs">
                  {#if answers[currentQuestion.id]?.length > 0 && !isQuestionAnswered(currentQuestion.id)}
                    <span class="text-orange-500 dark:text-orange-400">Incomplete</span>
                  {/if}
                  {#if isQuestionAnswered(currentQuestion.id)}
                    <span class="text-green-600 dark:text-green-400">✓ Complete</span>
                  {/if}
                </div>
              </div>
            </div>

            <!-- Navigation -->
            <div class="flex justify-between items-center">
              <button
                onclick={previousQuestion}
                disabled={currentQuestionIndex === 0}
                class="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>

              <button
                onclick={skipQuestion}
                class="px-4 py-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
              >
                Skip
              </button>

              <div class="flex flex-col items-end gap-1">
                <button
                  onclick={nextQuestion}
                  disabled={currentQuestionIndex === filteredQuestions.length - 1 || !isQuestionAnswered(currentQuestion.id)}
                  class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-disabled={currentQuestionIndex === filteredQuestions.length - 1 || !isQuestionAnswered(currentQuestion.id)}
                >Next</button>
                {#if answers[currentQuestion.id]?.length && !isQuestionAnswered(currentQuestion.id)}
                  <span class="text-[11px] text-orange-500 dark:text-orange-400">Need {Math.max(0, currentQuestion.minLength - getAnswerLength(currentQuestion.id))} more chars</span>
                {/if}
              </div>
            </div>
          </div>
        </div>
      {/if}

      <!-- Submit Training -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Submit Training Data</h3>
        <p class="text-gray-600 dark:text-gray-400 mb-4">
          Started: <span class="font-semibold">{getCompletionStats().started}</span> • Completed: <span class="font-semibold">{getCompletionStats().completed}</span> / {filteredQuestions.length}
        </p>
        <div class="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded mb-6 overflow-hidden">
          <div class="h-full bg-green-500 transition-all" style="width: {filteredQuestions.length ? (getCompletionStats().completed / filteredQuestions.length) * 100 : 0}%"></div>
        </div>
        
        <div class="flex gap-4">
          <button
            onclick={submitTraining}
            disabled={isLoading || getCompletionStats().completed === 0}
            class="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {#if isLoading}
              <svg class="animate-spin w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
              Training...
            {:else}
              Submit Training Data
            {/if}
          </button>

          <a
            href="/dashboard"
            class="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Back to Dashboard
          </a>
        </div>
      </div>

    {:else if selectedReplica}
      <!-- No questions available -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 text-center">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No Training Questions Available</h3>
        <p class="text-gray-600 dark:text-gray-400 mb-4">
          This replica doesn't have any optional question categories selected for training.
        </p>
        <a
          href="/dashboard"
          class="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Back to Dashboard
        </a>
      </div>

    {:else}
      <!-- No replicas -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 text-center">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No Replicas Found</h3>
        <p class="text-gray-600 dark:text-gray-400 mb-4">
          You need to create a replica first before you can train it.
        </p>
        <a
          href="/create-replicas"
          class="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Create Your First Replica
        </a>
      </div>
    {/if}
  </div>
</div>
