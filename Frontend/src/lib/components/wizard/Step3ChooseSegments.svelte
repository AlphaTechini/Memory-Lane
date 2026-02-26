<script>
  import { onMount } from "svelte";
  import { wizardStore } from "$lib/stores/wizardStore.js";
  import { OPTIONAL_SEGMENTS } from "$lib/questionBank.js";

  let state = $state({
    selectedSegments: [],
  });

  // Subscribe to wizard store
  let unsubscribe;
  onMount(() => {
    unsubscribe = wizardStore.subscribe((value) => {
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
      newSegments = currentSegments.filter((s) => s !== segmentKey);
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
      <h2
        class="text-3xl font-bold text-text-light dark:text-text-dark font-serif"
      >
        Choose Question Categories
      </h2>
      <div
        class="text-sm text-charcoal-600 dark:text-cream-400 font-medium bg-cream-100 dark:bg-charcoal-700 px-3 py-1 rounded-full"
      >
        {getTotalQuestions()} questions selected
      </div>
    </div>
    <p class="text-charcoal-600 dark:text-cream-400 mt-4 leading-relaxed">
      Select the categories you'd like to answer questions about. You'll need to
      answer at least 40 questions total.
    </p>
  </div>

  <!-- Quick Actions -->
  <div class="mb-6 flex gap-3">
    <button
      onclick={selectAllSegments}
      class="btn-tactile btn-tactile-primary px-4 py-2 text-sm text-white rounded-md transition-colors font-medium"
    >
      Select All
    </button>
    <button
      onclick={clearAllSegments}
      class="btn-tactile px-4 py-2 text-sm border border-cream-300 dark:border-charcoal-600 text-charcoal-700 dark:text-cream-300 rounded-md hover:bg-cream-100 dark:bg-surface-dark dark:hover:bg-charcoal-700 transition-colors font-medium"
    >
      Clear All
    </button>
  </div>

  <!-- Segment Cards -->
  <div class="grid gap-6 md:grid-cols-2">
    {#each Object.entries(OPTIONAL_SEGMENTS) as [segmentKey, segment] (segmentKey)}
      <div
        class="border rounded-xl transition-all duration-200 cursor-pointer shadow-sm
        {isSegmentSelected(segmentKey)
          ? 'border-primary bg-primary/5 dark:bg-primary/10 ring-1 ring-primary'
          : 'border-cream-300 dark:border-charcoal-600 bg-white dark:bg-surface-dark hover:border-primary/50 dark:hover:border-primary/50'}"
        onclick={() => toggleSegment(segmentKey)}
      >
        <div class="p-5">
          <div class="flex items-start justify-between mb-3">
            <div class="flex items-center gap-3">
              <input
                type="checkbox"
                checked={isSegmentSelected(segmentKey)}
                onchange={() => toggleSegment(segmentKey)}
                class="w-5 h-5 text-primary border-cream-300 dark:border-charcoal-500 rounded focus:ring-primary dark:bg-charcoal-700"
              />
              <div>
                <h3
                  class="font-semibold text-text-light dark:text-text-dark text-[15px]"
                >
                  {segment.name}
                </h3>
                <p
                  class="text-[13px] text-charcoal-500 dark:text-cream-400 mt-0.5"
                >
                  {getQuestionCount(segmentKey)} questions
                </p>
              </div>
            </div>
            {#if isSegmentSelected(segmentKey)}
              <span
                class="material-symbols-outlined text-primary dark:text-secondary"
                >check_circle</span
              >
            {/if}
          </div>

          <p
            class="text-[14px] text-charcoal-700 dark:text-cream-300 mb-4 leading-relaxed"
          >
            {segment.description}
          </p>

          <!-- Sample Questions Preview -->
          <div
            class="text-[13px] text-charcoal-500 dark:text-cream-400 bg-cream-50 dark:bg-charcoal-700/30 p-3 rounded-lg border border-cream-200 dark:border-charcoal-600/50"
          >
            <div class="font-medium mb-2 text-charcoal-700 dark:text-cream-300">
              Sample questions:
            </div>
            <ul class="space-y-1.5">
              {#each segment.questions.slice(0, 2) as question (question.id)}
                <li class="line-clamp-1 flex gap-2">
                  <span class="text-charcoal-400 dark:text-charcoal-500">•</span
                  >
                  {question.text}
                </li>
              {/each}
              {#if segment.questions.length > 2}
                <li
                  class="italic text-charcoal-400 dark:text-charcoal-500 pl-3"
                >
                  ... and {segment.questions.length - 2} more
                </li>
              {/if}
            </ul>
          </div>
        </div>
      </div>
    {/each}
  </div>

  <!-- Selection Summary -->
  <div
    class="mt-8 p-5 rounded-xl border
    {getTotalQuestions() >= 40
      ? 'bg-success/10 border-success/30'
      : 'bg-warning/10 border-warning/30'}"
  >
    <div class="flex items-start gap-4">
      <span
        class="material-symbols-outlined text-[28px] {getTotalQuestions() >= 40
          ? 'text-success'
          : 'text-warning'}"
      >
        {getTotalQuestions() >= 40 ? "check_circle" : "info"}
      </span>
      <div>
        <h3
          class="font-semibold text-[17px] {getTotalQuestions() >= 40
            ? 'text-success hover:brightness-95'
            : 'text-warning hover:brightness-95'}"
        >
          {getTotalQuestions() >= 40
            ? "Great Selection!"
            : "Need More Questions"}
        </h3>
        <p
          class="text-[14px] {getTotalQuestions() >= 40
            ? 'text-success/80'
            : 'text-warning/80'} mt-1.5 leading-relaxed"
        >
          {#if getTotalQuestions() >= 40}
            You've selected {getTotalQuestions()} questions across {(
              state?.selectedSegments || []
            ).length} categories. This will provide excellent coverage for your replica.
          {:else}
            You need at least 40 questions to proceed. Currently selected: {getTotalQuestions()}
            questions.
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
    <div class="mt-8 border-t border-cream-200 dark:border-charcoal-700 pt-6">
      <h3
        class="font-semibold text-text-light dark:text-text-dark mb-4 font-serif text-lg"
      >
        Selected Categories:
      </h3>
      <div class="flex flex-wrap gap-2.5">
        {#each state?.selectedSegments || [] as segmentKey (segmentKey)}
          <span
            class="inline-flex items-center gap-2 px-3.5 py-1.5 bg-primary/10 dark:bg-primary/20 text-primary dark:text-secondary text-sm font-medium rounded-full border border-primary/20 dark:border-primary/30"
          >
            {OPTIONAL_SEGMENTS[segmentKey].name}
            <span class="opacity-75">
              ({getQuestionCount(segmentKey)})
            </span>
            <button
              onclick={() => toggleSegment(segmentKey)}
              class="hover:text-primary-hover dark:hover:text-primary ml-1"
            >
              <span class="material-symbols-outlined text-[16px] mt-0.5"
                >close</span
              >
            </button>
          </span>
        {/each}
      </div>
    </div>
  {/if}
</div>
