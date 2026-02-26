<script>
  import { onMount } from "svelte";
  import { wizardStore } from "$lib/stores/wizardStore.js";
  import {
    REQUIRED_QUESTIONS,
    getRequiredQuestionsByTemplate,
  } from "$lib/questionBank.js";

  let state = $state({
    requiredAnswers: {},
  });
  let expandedQuestion = $state(null);

  // Get template-specific questions using $derived
  let questions = $derived(
    state.template
      ? getRequiredQuestionsByTemplate(state.template)
      : REQUIRED_QUESTIONS,
  );

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

  function updateAnswer(questionId, value) {
    wizardStore.updateRequiredAnswer(questionId, value);
  }

  function getAnswerLength(questionId) {
    return state?.requiredAnswers?.[questionId]?.length || 0;
  }

  function getValidationMessage(question) {
    const answer = state?.requiredAnswers?.[question.id] || "";
    const length = answer.trim().length;

    if (length === 0) return `Please provide an answer`;
    if (length < question.minLength)
      return `Need ${question.minLength - length} more characters`;
    return "";
  }

  function isQuestionValid(question) {
    const answer = state?.requiredAnswers?.[question.id] || "";
    return answer.trim().length >= question.minLength;
  }

  function toggleExpanded(questionId) {
    expandedQuestion = expandedQuestion === questionId ? null : questionId;
  }

  function getCompletionStats() {
    const total = questions.length;
    const completed = questions.filter((q) => isQuestionValid(q)).length;
    return { completed, total };
  }
</script>

<div class="p-6">
  <div class="mb-6">
    <div class="flex items-center justify-between mb-2">
      <h2
        class="text-3xl font-bold text-text-light dark:text-text-dark font-serif"
      >
        Required Questions
        {#if state.template && state.relationship}
          <span
            class="text-xl font-normal text-charcoal-500 dark:text-cream-400 font-sans ml-2"
          >
            for {state.relationship}
          </span>
        {/if}
      </h2>
      <div
        class="text-sm text-charcoal-600 dark:text-cream-400 font-medium bg-cream-100 dark:bg-charcoal-700 px-3 py-1 rounded-full"
      >
        {getCompletionStats().completed} of {getCompletionStats().total} completed
      </div>
    </div>
    <p class="text-charcoal-600 dark:text-cream-400 mt-4 leading-relaxed">
      {#if state.template}
        These questions are specifically designed to capture the essence and
        personality of your {state.relationship
          ? state.relationship.toLowerCase()
          : "replica"}. Each answer should be detailed and thoughtful to create
        an authentic digital representation.
      {:else}
        These deep, existential questions help capture your core personality and
        worldview. Each answer should be at least 150 characters to provide
        meaningful insights.
      {/if}
    </p>
  </div>

  <!-- Progress Bar -->
  <div
    class="mb-8 bg-surface-light dark:bg-surface-dark p-6 rounded-2xl border border-cream-200 dark:border-charcoal-700 shadow-sm"
  >
    <div
      class="flex justify-between text-sm font-medium text-text-light dark:text-text-dark mb-3"
    >
      <span>Progress</span>
      <span class="text-primary dark:text-secondary"
        >{Math.round(
          (getCompletionStats().completed / getCompletionStats().total) * 100,
        )}%</span
      >
    </div>
    <div
      class="w-full bg-cream-200 dark:bg-charcoal-600 rounded-full h-2.5 overflow-hidden"
    >
      <div
        class="bg-primary dark:bg-secondary h-2.5 rounded-full transition-all duration-500 ease-out"
        style="width: {(getCompletionStats().completed /
          getCompletionStats().total) *
          100}%"
      ></div>
    </div>
  </div>

  <!-- Questions -->
  <div class="space-y-6">
    {#each questions as question, index (question.id)}
      <div
        class="border border-cream-200 dark:border-charcoal-600 rounded-xl bg-white dark:bg-charcoal-800 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md
        {isQuestionValid(question)
          ? 'border-l-4 border-l-success dark:border-l-success'
          : 'border-l-4 border-l-primary/30'}"
      >
        <!-- Question Header -->
        <button
          onclick={() => toggleExpanded(question.id)}
          class="w-full p-5 text-left hover:bg-cream-50 dark:hover:bg-charcoal-700 transition-colors focus:outline-none focus:bg-cream-50 dark:focus:bg-charcoal-700"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1">
              <div class="flex items-center gap-3 mb-2">
                <span
                  class="flex-shrink-0 w-8 h-8 bg-primary/10 dark:bg-primary/20 text-primary dark:text-secondary rounded-full flex items-center justify-center text-sm font-bold"
                >
                  {index + 1}
                </span>
                <h3
                  class="text-base font-semibold text-text-light dark:text-text-dark font-serif"
                >
                  Question {index + 1}
                </h3>
                {#if isQuestionValid(question)}
                  <span
                    class="material-symbols-outlined text-success text-[20px]"
                    >check_circle</span
                  >
                {/if}
              </div>
              <p
                class="text-charcoal-700 dark:text-cream-300 text-[15px] leading-relaxed pl-11"
              >
                {question.text}
              </p>
            </div>
            <span
              class="material-symbols-outlined text-charcoal-400 transform transition-transform duration-300 {expandedQuestion ===
              question.id
                ? 'rotate-180'
                : ''}"
            >
              expand_more
            </span>
          </div>
        </button>

        <!-- Answer Area -->
        {#if expandedQuestion === question.id}
          <div
            class="border-t border-cream-200 dark:border-charcoal-600 p-5 bg-background-light dark:bg-charcoal-800/50"
          >
            <div class="space-y-4 pl-11">
              <textarea
                value={state?.requiredAnswers?.[question.id] || ""}
                oninput={(e) => updateAnswer(question.id, e.target.value)}
                rows="8"
                class="w-full min-h-[160px] px-4 py-3 border border-cream-300 dark:border-charcoal-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-white dark:bg-surface-dark text-text-light dark:text-text-dark resize-y transition-colors leading-relaxed"
                placeholder="Share your thoughts deeply and authentically... Take your time to provide a detailed, meaningful response."
              ></textarea>

              <div
                class="flex justify-between items-center text-sm bg-cream-50 dark:bg-charcoal-700/50 p-3 rounded-lg border border-cream-200 dark:border-charcoal-600"
              >
                <div class="text-charcoal-600 dark:text-cream-400 font-medium">
                  {getAnswerLength(question.id)} characters
                  {#if !isQuestionValid(question)}
                    <span class="text-error dark:text-red-400 ml-2">
                      • {getValidationMessage(question)}
                    </span>
                  {/if}
                </div>
                {#if isQuestionValid(question)}
                  <div
                    class="flex items-center gap-1.5 text-success font-medium"
                  >
                    <span class="material-symbols-outlined text-[18px]"
                      >check_circle</span
                    >
                    Complete
                  </div>
                {/if}
              </div>
            </div>
          </div>
        {:else}
          <!-- Collapsed Preview -->
          {#if state?.requiredAnswers?.[question.id]}
            <div
              class="border-t border-cream-200 dark:border-charcoal-600 p-4 pl-16 bg-cream-50 dark:bg-charcoal-700/30"
            >
              <p
                class="text-[15px] text-charcoal-600 dark:text-cream-400 italic line-clamp-2 leading-relaxed"
              >
                "{state.requiredAnswers[question.id]}"
              </p>
            </div>
          {/if}
        {/if}
      </div>
    {/each}
  </div>

  <!-- Summary -->
  <div
    class="mt-8 p-6 bg-surface-light dark:bg-surface-dark rounded-xl border border-cream-200 dark:border-charcoal-700 shadow-sm"
  >
    <div class="flex items-center justify-between">
      <div>
        <h3
          class="font-semibold text-text-light dark:text-text-dark text-lg font-serif"
        >
          Required Questions Progress
        </h3>
        <p class="text-charcoal-600 dark:text-cream-400 mt-1">
          {getCompletionStats().completed} of {getCompletionStats().total} questions
          completed
        </p>
      </div>
      {#if getCompletionStats().completed === getCompletionStats().total}
        <div
          class="flex items-center justify-center w-12 h-12 bg-success/10 text-success rounded-full"
        >
          <span class="material-symbols-outlined text-[28px]">task_alt</span>
        </div>
      {/if}
    </div>
  </div>
</div>
