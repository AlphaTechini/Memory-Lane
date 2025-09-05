<script>
  import { onMount } from 'svelte';
  import { wizardStore } from '$lib/stores/wizardStore.js';
  import { REQUIRED_QUESTIONS } from '$lib/questionBank.js';

  let state = $state({
    requiredAnswers: {}
  });
  let expandedQuestion = $state(null);
  
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

  function updateAnswer(questionId, value) {
    wizardStore.updateRequiredAnswer(questionId, value);
  }

  function getAnswerLength(questionId) {
    return state?.requiredAnswers?.[questionId]?.length || 0;
  }

  function getValidationMessage(question) {
    const answer = state?.requiredAnswers?.[question.id] || '';
    const length = answer.trim().length;
    
    if (length === 0) return `Please provide an answer`;
    if (length < question.minLength) return `Need ${question.minLength - length} more characters`;
    return '';
  }

  function isQuestionValid(question) {
    const answer = state?.requiredAnswers?.[question.id] || '';
    return answer.trim().length >= question.minLength;
  }

  function toggleExpanded(questionId) {
    expandedQuestion = expandedQuestion === questionId ? null : questionId;
  }

  function getCompletionStats() {
    const total = REQUIRED_QUESTIONS.length;
    const completed = REQUIRED_QUESTIONS.filter(q => isQuestionValid(q)).length;
    return { completed, total };
  }
</script>

<div class="p-6">
  <div class="mb-6">
    <div class="flex items-center justify-between mb-2">
      <h2 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">Required Questions</h2>
      <div class="text-sm text-gray-600 dark:text-gray-400">
        {getCompletionStats().completed} of {getCompletionStats().total} completed
      </div>
    </div>
    <p class="text-gray-600 dark:text-gray-400">
      These deep, existential questions help capture your core personality and worldview. 
      Each answer should be at least 200 characters to provide meaningful insights.
    </p>
  </div>

  <!-- Progress Bar -->
  <div class="mb-8">
    <div class="flex justify-between text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
      <span>Progress</span>
      <span>{Math.round((getCompletionStats().completed / getCompletionStats().total) * 100)}%</span>
    </div>
    <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
      <div 
        class="bg-blue-600 h-2 rounded-full transition-all duration-300"
        style="width: {(getCompletionStats().completed / getCompletionStats().total) * 100}%"
      ></div>
    </div>
  </div>

  <!-- Questions -->
  <div class="space-y-6">
    {#each REQUIRED_QUESTIONS as question, index (question.id)}
      <div class="border border-gray-200 dark:border-gray-600 rounded-lg 
        {isQuestionValid(question) ? 'border-green-300 dark:border-green-600' : ''}">
        
        <!-- Question Header -->
        <button
          onclick={() => toggleExpanded(question.id)}
          class="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div class="flex items-center gap-3 mb-2">
                <span class="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-sm font-medium">
                  {index + 1}
                </span>
                <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Question {index + 1}
                </h3>
                {#if isQuestionValid(question)}
                  <svg class="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                {/if}
              </div>
              <p class="text-gray-700 dark:text-gray-300 text-sm">{question.text}</p>
            </div>
            <svg 
              class="w-5 h-5 text-gray-400 transform transition-transform {expandedQuestion === question.id ? 'rotate-180' : ''}"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </div>
        </button>

        <!-- Answer Area -->
        {#if expandedQuestion === question.id}
          <div class="border-t border-gray-200 dark:border-gray-600 p-4">
            <div class="space-y-3">
              <textarea
                value={state?.requiredAnswers?.[question.id] || ''}
                oninput={(e) => updateAnswer(question.id, e.target.value)}
                rows="6"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="Share your thoughts deeply and authentically..."
              ></textarea>
              
              <div class="flex justify-between items-center text-sm">
                <div class="text-gray-500 dark:text-gray-400">
                  {getAnswerLength(question.id)} characters
                  {#if !isQuestionValid(question)}
                    <span class="text-red-500 dark:text-red-400">
                      • {getValidationMessage(question)}
                    </span>
                  {/if}
                </div>
                {#if isQuestionValid(question)}
                  <span class="text-green-600 dark:text-green-400 font-medium">
                    ✓ Complete
                  </span>
                {/if}
              </div>
            </div>
          </div>
        {:else}
          <!-- Collapsed Preview -->
          {#if state?.requiredAnswers?.[question.id]}
            <div class="border-t border-gray-200 dark:border-gray-600 p-4 bg-gray-50 dark:bg-gray-700">
              <p class="text-sm text-gray-600 dark:text-gray-400 italic">
                {state.requiredAnswers[question.id].substring(0, 100)}...
              </p>
            </div>
          {/if}
        {/if}
      </div>
    {/each}
  </div>

  <!-- Summary -->
  <div class="mt-8 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
    <div class="flex items-center justify-between">
      <div>
        <h3 class="font-medium text-gray-900 dark:text-gray-100">
          Required Questions Progress
        </h3>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {getCompletionStats().completed} of {getCompletionStats().total} questions completed
        </p>
      </div>
      {#if getCompletionStats().completed === getCompletionStats().total}
        <div class="text-green-600 dark:text-green-400">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
        </div>
      {/if}
    </div>
  </div>
</div>
