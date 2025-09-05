<script>
  import { onMount } from 'svelte';
  import { wizardStore } from '$lib/stores/wizardStore.js';
  import { getQuestionsBySegments, OPTIONAL_SEGMENTS } from '$lib/questionBank.js';

  let state = $state({
    selectedSegments: [],
    optionalAnswers: {}
  });
  let currentQuestionIndex = $state(0);
  let filterBySegment = $state('all');
  
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

  // Get questions for selected segments
  let questions = $derived(getQuestionsBySegments(state?.selectedSegments || []));
  
  // Filter questions
  let filteredQuestions = $derived(filterBySegment === 'all' 
    ? questions 
    : questions.filter(q => q.segment === filterBySegment));

  let currentQuestion = $derived(filteredQuestions[currentQuestionIndex]);

  function updateAnswer(questionId, value) {
    wizardStore.updateOptionalAnswer(questionId, value);
  }

  function getAnswerLength(questionId) {
    return state?.optionalAnswers?.[questionId]?.length || 0;
  }

  function isQuestionAnswered(questionId) {
    const answer = state?.optionalAnswers?.[questionId] || '';
    const question = questions.find(q => q.id === questionId);
    return answer.trim().length >= (question?.minLength || 40);
  }

  function getCompletionStats() {
    const total = questions.length;
    const answered = questions.filter(q => isQuestionAnswered(q.id)).length;
    return { answered, total, remaining: Math.max(0, 0 - answered) }; // No minimum required
  }

  function goToQuestion(index) {
    if (index >= 0 && index < filteredQuestions.length) {
      currentQuestionIndex = index;
    }
  }

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

  function getSegmentName(segmentKey) {
    return OPTIONAL_SEGMENTS[segmentKey]?.name || segmentKey;
  }

  function getSegmentQuestions(segmentKey) {
    return questions.filter(q => q.segment === segmentKey);
  }

  function getSegmentStats(segmentKey) {
    const segmentQuestions = getSegmentQuestions(segmentKey);
    const answered = segmentQuestions.filter(q => isQuestionAnswered(q.id)).length;
    return { answered, total: segmentQuestions.length };
  }
</script>

<div class="p-6">
  <div class="mb-6">
    <div class="flex items-center justify-between mb-2">
      <h2 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">Optional Questions</h2>
      <div class="text-sm text-gray-600 dark:text-gray-400">
        {getCompletionStats().answered} answered • {getCompletionStats().remaining} needed
      </div>
    </div>
    <p class="text-gray-600 dark:text-gray-400">
      Answer questions from your selected categories. These are optional - you can skip this step and continue training your replica later.
    </p>
  </div>

  <!-- Progress Overview -->
  <div class="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
      <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">{getCompletionStats().answered}</div>
      <div class="text-sm text-blue-700 dark:text-blue-300">Questions Answered</div>
    </div>
    <div class="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
      <div class="text-2xl font-bold text-gray-600 dark:text-gray-400">{questions.length}</div>
      <div class="text-sm text-gray-700 dark:text-gray-300">Total Available</div>
    </div>
    <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
      <div class="text-2xl font-bold text-green-600 dark:text-green-400">
        {getCompletionStats().answered > 0 ? Math.round((getCompletionStats().answered / questions.length) * 100) : 0}%
      </div>
      <div class="text-sm text-green-700 dark:text-green-300">Progress Made</div>
    </div>
  </div>

  <!-- Filter and Navigation -->
  <div class="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
    <div class="flex items-center gap-4">
      <label for="filter" class="text-sm font-medium text-gray-700 dark:text-gray-300">
        Filter by category:
      </label>
      <select
        id="filter"
        bind:value={filterBySegment}
        onchange={() => currentQuestionIndex = 0}
        class="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
      >
        <option value="all">All Categories ({questions.length})</option>
        {#each (state?.selectedSegments || []) as segmentKey (segmentKey)}
          <option value={segmentKey}>
            {getSegmentName(segmentKey)} ({getSegmentQuestions(segmentKey).length})
          </option>
        {/each}
      </select>
    </div>
    
    {#if filteredQuestions.length > 0}
      <div class="text-sm text-gray-600 dark:text-gray-400">
        Question {currentQuestionIndex + 1} of {filteredQuestions.length}
      </div>
    {/if}
  </div>

  {#if filteredQuestions.length > 0 && currentQuestion}
    <!-- Current Question -->
    <div class="mb-6 border border-gray-200 dark:border-gray-600 rounded-lg">
      <div class="p-4 border-b border-gray-200 dark:border-gray-600">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-3">
            <span class="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded-full">
              {getSegmentName(currentQuestion.segment)}
            </span>
            {#if isQuestionAnswered(currentQuestion.id)}
              <span class="text-green-600 dark:text-green-400 text-sm font-medium">✓ Answered</span>
            {/if}
          </div>
          <div class="text-sm text-gray-500 dark:text-gray-400">
            {currentQuestionIndex + 1} / {filteredQuestions.length}
          </div>
        </div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">
          {currentQuestion.text}
        </h3>
      </div>
      
      <div class="p-4">
        <textarea
          value={state?.optionalAnswers?.[currentQuestion.id] || ''}
          oninput={(e) => updateAnswer(currentQuestion.id, e.target.value)}
          rows="5"
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          placeholder="Share your thoughts... (minimum {currentQuestion.minLength} characters)"
        ></textarea>
        
        <div class="mt-3 flex justify-between items-center">
          <div class="text-sm text-gray-500 dark:text-gray-400">
            {getAnswerLength(currentQuestion.id)} characters
            {#if !isQuestionAnswered(currentQuestion.id) && getAnswerLength(currentQuestion.id) > 0}
              <span class="text-orange-500 dark:text-orange-400">
                • Need {currentQuestion.minLength - getAnswerLength(currentQuestion.id)} more
              </span>
            {/if}
          </div>
          {#if isQuestionAnswered(currentQuestion.id)}
            <span class="text-green-600 dark:text-green-400 text-sm font-medium">
              ✓ Complete
            </span>
          {/if}
        </div>
      </div>
    </div>

    <!-- Navigation -->
    <div class="mb-6 flex justify-between items-center">
      <button
        onclick={previousQuestion}
        disabled={currentQuestionIndex === 0}
        class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Previous
      </button>
      
      <div class="flex gap-2">
        <button
          onclick={skipQuestion}
          class="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
        >
          Skip
        </button>
        <button
          onclick={nextQuestion}
          disabled={currentQuestionIndex === filteredQuestions.length - 1}
          class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  {:else}
    <div class="text-center py-8">
      <p class="text-gray-500 dark:text-gray-400">No questions available for the selected filter.</p>
    </div>
  {/if}

  <!-- Segment Progress -->
  <div class="mt-8">
    <h3 class="font-medium text-gray-900 dark:text-gray-100 mb-4">Progress by Category</h3>
    <div class="space-y-3">
      {#each (state?.selectedSegments || []) as segmentKey}
        {@const stats = getSegmentStats(segmentKey)}
        <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div>
            <div class="font-medium text-gray-900 dark:text-gray-100">
              {getSegmentName(segmentKey)}
            </div>
            <div class="text-sm text-gray-600 dark:text-gray-400">
              {stats.answered} of {stats.total} answered
            </div>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-20 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
              <div 
                class="bg-blue-600 h-2 rounded-full"
                style="width: {stats.total > 0 ? (stats.answered / stats.total) * 100 : 0}%"
              ></div>
            </div>
            <button
              onclick={() => { filterBySegment = segmentKey; currentQuestionIndex = 0; }}
              class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 text-sm"
            >
              View
            </button>
          </div>
        </div>
      {/each}
    </div>
  </div>

  <!-- Informational Messages -->
  {#if getCompletionStats().answered === 0}
    <div class="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
      <div class="flex items-start gap-3">
        <svg class="flex-shrink-0 w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <div>
          <h3 class="font-medium text-blue-800 dark:text-blue-200">
            Optional Training Questions
          </h3>
          <p class="text-sm text-blue-700 dark:text-blue-300 mt-1">
            You can skip these questions and create your replica now. You can always continue training your replica later from the dashboard.
          </p>
        </div>
      </div>
    </div>
  {:else if getCompletionStats().answered > 0}
    <div class="mt-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
      <div class="flex items-start gap-3">
        <svg class="flex-shrink-0 w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <div>
          <h3 class="font-medium text-green-800 dark:text-green-200">
            Great progress!
          </h3>
          <p class="text-sm text-green-700 dark:text-green-300 mt-1">
            You've answered {getCompletionStats().answered} questions. This will help make your replica more personalized. You can continue adding more training data after creating your replica.
          </p>
        </div>
      </div>
    </div>
  {/if}
</div>
