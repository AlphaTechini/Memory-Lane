<script>
  import { onMount } from "svelte";
  import { wizardStore } from "$lib/stores/wizardStore.js";
  import {
    getQuestionsBySegments,
    OPTIONAL_SEGMENTS,
  } from "$lib/questionBank.js";

  let state = $state({
    selectedSegments: [],
    optionalAnswers: {},
  });
  let currentQuestionIndex = $state(0);
  let filterBySegment = $state("all");

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

  // Get questions for selected segments
  let questions = $derived(
    getQuestionsBySegments(state?.selectedSegments || []),
  );

  // Filter questions
  let filteredQuestions = $derived(
    filterBySegment === "all"
      ? questions
      : questions.filter((q) => q.segment === filterBySegment),
  );

  let currentQuestion = $derived(filteredQuestions[currentQuestionIndex]);

  function updateAnswer(questionId, value) {
    wizardStore.updateOptionalAnswer(questionId, value);
  }

  function getAnswerLength(questionId) {
    return state?.optionalAnswers?.[questionId]?.length || 0;
  }

  function isQuestionAnswered(questionId) {
    const answer = state?.optionalAnswers?.[questionId] || "";
    const question = questions.find((q) => q.id === questionId);
    return answer.trim().length >= (question?.minLength || 40);
  }

  function getCompletionStats() {
    const total = questions.length;
    const answered = questions.filter((q) => isQuestionAnswered(q.id)).length;
    return { answered, total, remaining: Math.max(0, 0 - answered) }; // No minimum required
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
    return questions.filter((q) => q.segment === segmentKey);
  }

  function getSegmentStats(segmentKey) {
    const segmentQuestions = getSegmentQuestions(segmentKey);
    const answered = segmentQuestions.filter((q) =>
      isQuestionAnswered(q.id),
    ).length;
    return { answered, total: segmentQuestions.length };
  }
</script>

<div class="p-6">
  <div class="mb-6">
    <div class="flex items-center justify-between mb-2">
      <h2
        class="text-3xl font-bold text-text-light dark:text-text-dark font-serif"
      >
        Optional Questions
      </h2>
      <div
        class="text-sm text-charcoal-600 dark:text-cream-400 font-medium bg-cream-100 dark:bg-charcoal-700 px-3 py-1 rounded-full"
      >
        {getCompletionStats().answered} answered • {getCompletionStats()
          .remaining} needed
      </div>
    </div>
    <p class="text-charcoal-600 dark:text-cream-400 mt-4 leading-relaxed">
      Answer questions from your selected categories. These are optional - you
      can skip this step and continue training your replica later.
    </p>
  </div>

  <!-- Progress Overview -->
  <div class="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    <div
      class="bg-primary/5 dark:bg-primary/10 border border-primary/20 dark:border-primary/30 rounded-xl p-5 shadow-sm"
    >
      <div
        class="text-3xl font-bold text-primary dark:text-secondary font-serif"
      >
        {getCompletionStats().answered}
      </div>
      <div
        class="text-[14px] text-charcoal-600 dark:text-cream-400 mt-1 font-medium"
      >
        Questions Answered
      </div>
    </div>
    <div
      class="bg-surface-light dark:bg-surface-dark border border-cream-200 dark:border-charcoal-700 rounded-xl p-5 shadow-sm"
    >
      <div
        class="text-3xl font-bold text-charcoal-700 dark:text-cream-300 font-serif"
      >
        {questions.length}
      </div>
      <div
        class="text-[14px] text-charcoal-600 dark:text-cream-400 mt-1 font-medium"
      >
        Total Available
      </div>
    </div>
    <div
      class="bg-success/5 dark:bg-success/10 border border-success/20 dark:border-success/30 rounded-xl p-5 shadow-sm"
    >
      <div
        class="text-3xl font-bold text-success dark:text-success/90 font-serif"
      >
        {getCompletionStats().answered > 0
          ? Math.round((getCompletionStats().answered / questions.length) * 100)
          : 0}%
      </div>
      <div
        class="text-[14px] text-charcoal-600 dark:text-cream-400 mt-1 font-medium"
      >
        Progress Made
      </div>
    </div>
  </div>

  <!-- Filter and Navigation -->
  <div
    class="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between"
  >
    <div class="flex items-center gap-4">
      <label
        for="filter"
        class="text-sm font-medium text-text-light dark:text-text-dark"
      >
        Filter by category:
      </label>
      <select
        id="filter"
        bind:value={filterBySegment}
        onchange={() => (currentQuestionIndex = 0)}
        class="px-4 py-2 border border-cream-300 dark:border-charcoal-600 rounded-lg text-[14px] bg-white dark:bg-surface-dark text-text-light dark:text-text-dark focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
      >
        <option value="all">All Categories ({questions.length})</option>
        {#each state?.selectedSegments || [] as segmentKey (segmentKey)}
          <option value={segmentKey}>
            {getSegmentName(segmentKey)} ({getSegmentQuestions(segmentKey)
              .length})
          </option>
        {/each}
      </select>
    </div>

    {#if filteredQuestions.length > 0}
      <div
        class="text-[14px] text-charcoal-600 dark:text-cream-400 font-medium bg-cream-100 dark:bg-charcoal-700 px-3 py-1 rounded-full"
      >
        Question {currentQuestionIndex + 1} of {filteredQuestions.length}
      </div>
    {/if}
  </div>

  {#if filteredQuestions.length > 0 && currentQuestion}
    <!-- Current Question -->
    <div
      class="mb-6 border border-cream-200 dark:border-charcoal-600 rounded-xl bg-white dark:bg-charcoal-800 shadow-sm overflow-hidden"
    >
      <div
        class="p-5 border-b border-cream-200 dark:border-charcoal-600 bg-background-light dark:bg-charcoal-800/50"
      >
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <span
              class="px-3 py-1 bg-primary/10 dark:bg-primary/20 text-primary dark:text-secondary text-[12px] font-bold rounded-full border border-primary/20"
            >
              {getSegmentName(currentQuestion.segment)}
            </span>
            {#if isQuestionAnswered(currentQuestion.id)}
              <span
                class="text-success text-[13px] font-medium flex items-center gap-1"
              >
                <span class="material-symbols-outlined text-[16px]"
                  >check_circle</span
                > Answered
              </span>
            {/if}
          </div>
          <div
            class="text-[13px] font-medium text-charcoal-500 dark:text-cream-400"
          >
            {currentQuestionIndex + 1} / {filteredQuestions.length}
          </div>
        </div>
        <h3
          class="text-xl font-medium text-text-light dark:text-text-dark font-serif leading-snug"
        >
          {currentQuestion.text}
        </h3>
      </div>

      <div class="p-5">
        <textarea
          value={state?.optionalAnswers?.[currentQuestion.id] || ""}
          oninput={(e) => updateAnswer(currentQuestion.id, e.target.value)}
          rows="6"
          class="w-full px-4 py-3 border border-cream-300 dark:border-charcoal-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-white dark:bg-surface-dark text-text-light dark:text-text-dark resize-y transition-colors leading-relaxed"
          placeholder="Share your thoughts... (minimum {currentQuestion.minLength} characters)"
        ></textarea>

        <div class="mt-4 flex justify-between items-center text-[14px]">
          <div class="text-charcoal-500 dark:text-cream-400">
            <span class="font-medium text-text-light dark:text-text-dark"
              >{getAnswerLength(currentQuestion.id)}</span
            >
            characters
            {#if !isQuestionAnswered(currentQuestion.id) && getAnswerLength(currentQuestion.id) > 0}
              <span class="text-warning ml-2 font-medium">
                • Need {currentQuestion.minLength -
                  getAnswerLength(currentQuestion.id)} more
              </span>
            {/if}
          </div>
          {#if isQuestionAnswered(currentQuestion.id)}
            <span
              class="text-success font-medium flex items-center gap-1.5 bg-success/10 px-3 py-1 rounded-full"
            >
              <span class="material-symbols-outlined text-[18px]">task_alt</span
              > Complete
            </span>
          {/if}
        </div>
      </div>
    </div>

    <!-- Navigation -->
    <div
      class="mb-6 flex justify-between items-center bg-surface-light dark:bg-surface-dark p-4 rounded-xl border border-cream-200 dark:border-charcoal-700 shadow-sm"
    >
      <button
        onclick={previousQuestion}
        disabled={currentQuestionIndex === 0}
        class="btn-tactile px-5 py-2 border border-cream-300 dark:border-charcoal-600 rounded-md text-charcoal-700 dark:text-cream-300 hover:bg-cream-100 dark:hover:bg-charcoal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
      >
        Previous
      </button>

      <div class="flex gap-3 items-center">
        <button
          onclick={skipQuestion}
          class="group text-[14px] font-medium text-charcoal-500 dark:text-cream-400 hover:text-charcoal-800 dark:hover:text-cream-200 transition-colors flex items-center gap-1"
        >
          Skip <span
            class="material-symbols-outlined text-[18px] opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all"
            >double_arrow</span
          >
        </button>
        <button
          onclick={nextQuestion}
          disabled={currentQuestionIndex === filteredQuestions.length - 1}
          class="btn-tactile btn-tactile-primary px-5 py-2 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2"
        >
          Next <span class="material-symbols-outlined text-[18px]"
            >arrow_forward</span
          >
        </button>
      </div>
    </div>
  {:else}
    <div
      class="text-center py-12 bg-surface-light dark:bg-surface-dark rounded-xl border border-cream-200 dark:border-charcoal-700"
    >
      <span
        class="material-symbols-outlined text-4xl text-charcoal-300 dark:text-charcoal-600 mb-2"
        >inbox</span
      >
      <p class="text-charcoal-500 dark:text-cream-500 font-medium">
        No questions available for the selected filter.
      </p>
    </div>
  {/if}

  <!-- Segment Progress -->
  <div class="mt-8 border-t border-cream-200 dark:border-charcoal-700 pt-8">
    <h3
      class="font-semibold text-text-light dark:text-text-dark mb-5 font-serif text-xl"
    >
      Progress by Category
    </h3>
    <div class="space-y-4">
      {#each state?.selectedSegments || [] as segmentKey (segmentKey)}
        <div
          class="flex items-center justify-between p-4 bg-surface-light dark:bg-surface-dark rounded-xl border border-cream-200 dark:border-charcoal-700 shadow-sm transition-all hover:shadow-md"
        >
          <div class="flex-1 mr-6">
            <div
              class="font-semibold text-text-light dark:text-text-dark text-[15px] mb-1"
            >
              {getSegmentName(segmentKey)}
            </div>
            <div
              class="text-[13px] text-charcoal-500 dark:text-cream-400 font-medium bg-background-light dark:bg-charcoal-800/50 inline-block px-2 py-0.5 rounded-md border border-cream-200 dark:border-charcoal-600 mt-1"
            >
              {getSegmentStats(segmentKey).answered} of {getSegmentStats(
                segmentKey,
              ).total} answered
            </div>
          </div>
          <div class="flex items-center gap-4 w-48 shrink-0">
            <div
              class="w-full bg-cream-200 dark:bg-charcoal-600 rounded-full h-2.5 overflow-hidden"
            >
              <div
                class="bg-primary dark:bg-secondary h-2.5 rounded-full transition-all duration-500"
                style="width: {getSegmentStats(segmentKey).total > 0
                  ? (getSegmentStats(segmentKey).answered /
                      getSegmentStats(segmentKey).total) *
                    100
                  : 0}%"
              ></div>
            </div>
            <button
              onclick={() => {
                filterBySegment = segmentKey;
                currentQuestionIndex = 0;
              }}
              class="text-primary hover:text-primary-hover dark:text-secondary dark:hover:text-secondary/80 text-[14px] font-semibold whitespace-nowrap bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-md transition-colors"
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
    <div
      class="mt-8 bg-primary/5 dark:bg-primary/10 border border-primary/20 dark:border-primary/30 rounded-xl p-5"
    >
      <div class="flex items-start gap-4">
        <span
          class="material-symbols-outlined text-[24px] text-primary dark:text-secondary mt-0.5"
          >info</span
        >
        <div>
          <h3 class="font-semibold text-text-light dark:text-text-dark">
            Optional Training Questions
          </h3>
          <p
            class="text-[14px] text-charcoal-700 dark:text-cream-300 mt-1.5 leading-relaxed"
          >
            You can skip these questions and create your replica now. You can
            always continue training your replica later from the dashboard.
          </p>
        </div>
      </div>
    </div>
  {:else if getCompletionStats().answered > 0}
    <div class="mt-8 bg-success/10 border border-success/30 rounded-xl p-5">
      <div class="flex items-start gap-4">
        <span class="material-symbols-outlined text-[24px] text-success mt-0.5"
          >celebration</span
        >
        <div>
          <h3 class="font-semibold text-text-light dark:text-text-dark">
            Great progress!
          </h3>
          <p
            class="text-[14px] text-charcoal-700 dark:text-cream-300 mt-1.5 leading-relaxed"
          >
            You've answered <strong class="text-success"
              >{getCompletionStats().answered}</strong
            > questions. This will help make your replica more personalized. You
            can continue adding more training data after creating your replica.
          </p>
        </div>
      </div>
    </div>
  {/if}
</div>
