<script>
  import { onMount } from 'svelte';
  import { wizardStore } from '$lib/stores/wizardStore.js';
  import { OPTIONAL_SEGMENTS } from '$lib/questionBank.js';

  let state = $state({
    selectedSegments: []
  });
  
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

  function toggleSegment(segmentKey) {
    const currentSegments = state?.selectedSegments || [];
    let newSegments;
    
    if (currentSegments.includes(segmentKey)) {
      newSegments = currentSegments.filter(s => s !== segmentKey);
    } else {
      newSegments = [...currentSegments, segmentKey];
    }
    
    wizardStore.updateSelectedSegments(newSegments);
  }

  function isSegmentSelected(segmentKey) {
    return state?.selectedSegments?.includes(segmentKey) || false;
  }

  function getQuestionCount(segmentKey) {
    return OPTIONAL_SEGMENTS[segmentKey]?.questions?.length || 0;
  }

  function getTotalQuestions() {
    const selectedSegments = state?.selectedSegments || [];
    return selectedSegments.reduce((total, segmentKey) => {
      return total + getQuestionCount(segmentKey);
    }, 0);
  }

  function selectAllSegments() {
    const allSegmentKeys = Object.keys(OPTIONAL_SEGMENTS);
    wizardStore.updateSelectedSegments(allSegmentKeys);
  }

  function clearAllSegments() {
    wizardStore.updateSelectedSegments([]);
  }
</script>

<div class="p-6">
  <div class="mb-6">
    <div class="flex items-center justify-between mb-2">
      <h2 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">Choose Question Categories</h2>
      <div class="text-sm text-gray-600 dark:text-gray-400">
        {getTotalQuestions()} questions selected
      </div>
    </div>
    <p class="text-gray-600 dark:text-gray-400">
      Select the categories you'd like to answer questions about. You'll need to answer at least 40 questions total.
    </p>
  </div>

  <!-- Quick Actions -->
  <div class="mb-6 flex gap-3">
    <button
      onclick={selectAllSegments}
      class="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
    >
      Select All
    </button>
    <button
      onclick={clearAllSegments}
      class="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
    >
      Clear All
    </button>
  </div>

  <!-- Segment Cards -->
  <div class="grid gap-6 md:grid-cols-2">
    {#each Object.entries(OPTIONAL_SEGMENTS) as [segmentKey, segment] (segmentKey)}
      <div 
        class="border rounded-lg transition-all duration-200 cursor-pointer
        {isSegmentSelected(segmentKey) 
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'}"
        onclick={() => toggleSegment(segmentKey)}
      >
        <div class="p-4">
          <div class="flex items-start justify-between mb-3">
            <div class="flex items-center gap-3">
              <input
                type="checkbox"
                checked={isSegmentSelected(segmentKey)}
                onchange={() => toggleSegment(segmentKey)}
                class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div>
                <h3 class="font-medium text-gray-900 dark:text-gray-100">
                  {segment.name}
                </h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {getQuestionCount(segmentKey)} questions
                </p>
              </div>
            </div>
            {#if isSegmentSelected(segmentKey)}
              <svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
            {/if}
          </div>
          
          <p class="text-sm text-gray-700 dark:text-gray-300 mb-3">
            {segment.description}
          </p>

          <!-- Sample Questions Preview -->
          <div class="text-xs text-gray-500 dark:text-gray-400">
            <div class="font-medium mb-1">Sample questions:</div>
            <ul class="space-y-1">
              {#each segment.questions.slice(0, 2) as question (question.id)}
                <li class="line-clamp-1">• {question.text}</li>
              {/each}
              {#if segment.questions.length > 2}
                <li class="italic">... and {segment.questions.length - 2} more</li>
              {/if}
            </ul>
          </div>
        </div>
      </div>
    {/each}
  </div>

  <!-- Selection Summary -->
  <div class="mt-8 p-4 rounded-lg 
    {getTotalQuestions() >= 40 
      ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
      : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'}">
    <div class="flex items-start gap-3">
      <svg class="flex-shrink-0 w-5 h-5 mt-0.5 {getTotalQuestions() >= 40 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}" 
           fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {#if getTotalQuestions() >= 40}
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        {:else}
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
        {/if}
      </svg>
      <div>
        <h3 class="font-medium {getTotalQuestions() >= 40 ? 'text-green-800 dark:text-green-200' : 'text-yellow-800 dark:text-yellow-200'}">
          {getTotalQuestions() >= 40 ? 'Great Selection!' : 'Need More Questions'}
        </h3>
        <p class="text-sm {getTotalQuestions() >= 40 ? 'text-green-700 dark:text-green-300' : 'text-yellow-700 dark:text-yellow-300'} mt-1">
          {#if getTotalQuestions() >= 40}
            You've selected {getTotalQuestions()} questions across {(state?.selectedSegments || []).length} categories. 
            This will provide excellent coverage for your replica.
          {:else}
            You need at least 40 questions to proceed. Currently selected: {getTotalQuestions()} questions.
            {#if getTotalQuestions() < 40}
              Please select {40 - getTotalQuestions()} more questions.
            {/if}
          {/if}
        </p>
      </div>
    </div>
  </div>

  <!-- Selected Categories Preview -->
  {#if (state?.selectedSegments || []).length > 0}
    <div class="mt-6">
      <h3 class="font-medium text-gray-900 dark:text-gray-100 mb-3">Selected Categories:</h3>
      <div class="flex flex-wrap gap-2">
        {#each (state?.selectedSegments || []) as segmentKey (segmentKey)}
          <span class="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-sm rounded-full">
            {OPTIONAL_SEGMENTS[segmentKey].name}
            <span class="text-blue-600 dark:text-blue-400">
              ({getQuestionCount(segmentKey)})
            </span>
            <button
              onclick={() => toggleSegment(segmentKey)}
              class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
            >
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </span>
        {/each}
      </div>
    </div>
  {/if}
</div>
