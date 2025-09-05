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
    return answer.trim().length >= 120;
  }

  function getCompletionStats() {
    const total = questions.length;
    const answered = questions.filter(q => isQuestionAnswered(q.id)).length;
    return { answered, total, remaining: Math.max(0, 40 - answered) };
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
      Answer questions from your selected categories. You need at least 40 total answers to proceed.
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
        {Math.max(0, Math.round((getCompletionStats().answered / 40) * 100))}%
      </div>
      <div class="text-sm text-green-700 dark:text-green-300">Progress to Goal</div>
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
          placeholder="Share your thoughts... (minimum 120 characters)"
        ></textarea>
        
        <div class="mt-3 flex justify-between items-center">
          <div class="text-sm text-gray-500 dark:text-gray-400">
            {getAnswerLength(currentQuestion.id)} characters
            {#if !isQuestionAnswered(currentQuestion.id) && getAnswerLength(currentQuestion.id) > 0}
              <span class="text-orange-500 dark:text-orange-400">
                • Need {120 - getAnswerLength(currentQuestion.id)} more
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
      {#each (state?.selectedSegments || []) as segmentKey (segmentKey)}
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

  <!-- Minimum Requirements Notice -->
  {#if getCompletionStats().answered < 40}
    <div class="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
      <div class="flex items-start gap-3">
        <svg class="flex-shrink-0 w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
        </svg>
        <div>
          <h3 class="font-medium text-yellow-800 dark:text-yellow-200">
            More answers needed
          </h3>
          <p class="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
            You need to answer at least 40 questions to proceed to the next step. 
            You currently have {getCompletionStats().answered} complete answers.
          </p>
        </div>
      </div>
    </div>
  {/if}
</div>
