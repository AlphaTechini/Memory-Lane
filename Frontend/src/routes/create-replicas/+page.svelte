<script>
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { wizardStore } from "$lib/stores/wizardStore.js";
  import { replicasStore } from "$lib/stores/replicasStore.js";
  import {
    requireAuthForAction,
    checkAuthStatus,
    apiCall,
    getUserRole,
    verifyAuth,
  } from "$lib/auth.js";
  import BackNavigation from "$lib/components/BackNavigation.svelte";

  import Step1Basics from "$lib/components/wizard/Step1Basics.svelte";
  import Step2RequiredQuestions from "$lib/components/wizard/Step2RequiredQuestions.svelte";
  import Step3ChooseSegments from "$lib/components/wizard/Step3ChooseSegments.svelte";
  import Step4OptionalQuestions from "$lib/components/wizard/Step4OptionalQuestions.svelte";
  import Step5ProfileImage from "$lib/components/wizard/Step5ProfileImage.svelte";
  import Step7ReviewSubmit from "$lib/components/wizard/Step7ReviewSubmit.svelte";

  // Check role on mount - redirect patients
  onMount(async () => {
    const user = await verifyAuth();
    const userRole = user?.role || getUserRole() || "caretaker";

    if (userRole === "patient") {
      console.log("Patients cannot create replicas, redirecting to dashboard");
      goto("/dashboard");
      return;
    }
  });

  let state = $state({
    currentStep: 0, // 0 = template selection before existing steps
    basics: {},
    requiredAnswers: {},
    optionalAnswers: {},
    selectedSegments: [],
    template: null,
    relationship: null,
  });

  // Template ordering constant (currently using inline array instead)
  const displayNames = {
    self: "Self",
    dad: "Dad",
    mom: "Mom",
    brother: "Brother",
    sister: "Sister",
    lover: "Lover",
    best_friend: "Best Friend",
    close_relation: "Close Relation",
  };

  // Template icons for better visual representation
  const templateIcons = {
    self: "👤",
    dad: "👨‍👔",
    mom: "👩‍💼",
    brother: "👦",
    sister: "👧",
    lover: "💕",
    best_friend: "👯",
    close_relation: "🤝",
  };

  // Template question bank (easily extendable) - Updated with larger text areas
  const templates = {
    self: [
      {
        id: "core_values",
        text: "List your core values and what principles guide your decisions.",
        type: "textarea",
        required: true,
      },
      {
        id: "strengths",
        text: "Describe your main strengths and what you excel at.",
        type: "textarea",
        required: true,
      },
      {
        id: "goals",
        text: "What are your current goals and aspirations?",
        type: "textarea",
        required: true,
      },
      {
        id: "hobbies",
        text: "What hobbies or interests bring you joy?",
        type: "text",
        required: false,
      },
      {
        id: "fun_fact",
        text: "Share a fun fact about yourself.",
        type: "text",
        required: false,
      },
    ],
    dad: [
      {
        id: "life_lessons",
        text: "What life lessons does Dad repeat often and what wisdom has shaped his worldview?",
        type: "textarea",
        required: true,
      },
      {
        id: "hobbies",
        text: "What are his main hobbies and how does he spend his free time?",
        type: "textarea",
        required: true,
      },
      {
        id: "values",
        text: "What core values does he live by and how do they show up in daily life?",
        type: "textarea",
        required: true,
      },
      {
        id: "weekend_activity",
        text: "What does a typical weekend look like for him?",
        type: "text",
        required: false,
      },
      {
        id: "famous_quote",
        text: "What phrase or saying does he always repeat?",
        type: "text",
        required: false,
      },
    ],
    mom: [
      {
        id: "comfort_food",
        text: "What is her signature comfort dish and what food memories are special to her?",
        type: "textarea",
        required: true,
      },
      {
        id: "sayings",
        text: "What common sayings, expressions, or advice does she share?",
        type: "textarea",
        required: true,
      },
      {
        id: "daily_habits",
        text: "Describe her daily habits, routines, and how she organizes family life.",
        type: "textarea",
        required: true,
      },
      {
        id: "favorite_music",
        text: "What type of music does she enjoy?",
        type: "text",
        required: false,
      },
      {
        id: "relax_method",
        text: "How does she unwind and relax?",
        type: "text",
        required: false,
      },
    ],
    brother: [
      {
        id: "favorite_games",
        text: "What games, sports, or activities does he love and why are they important to him?",
        type: "textarea",
        required: true,
      },
      {
        id: "annoyances",
        text: "What things annoy him and how does he react when frustrated?",
        type: "textarea",
        required: true,
      },
      {
        id: "motivations",
        text: "What motivates him most and drives his enthusiasm?",
        type: "textarea",
        required: true,
      },
      {
        id: "inside_joke",
        text: "Any inside jokes or funny memories you share?",
        type: "text",
        required: false,
      },
      {
        id: "style",
        text: "How would you describe his personal style or fashion?",
        type: "text",
        required: false,
      },
    ],
    sister: [
      {
        id: "humor_style",
        text: "What makes her laugh and how does her sense of humor work?",
        type: "textarea",
        required: true,
      },
      {
        id: "bonding_moment",
        text: "Describe a memorable bonding moment that captures your relationship.",
        type: "textarea",
        required: true,
      },
      {
        id: "crush_topics",
        text: "What does she like to talk about regarding relationships or crushes?",
        type: "textarea",
        required: true,
      },
      {
        id: "favorite_show",
        text: "What are her favorite shows or entertainment?",
        type: "text",
        required: false,
      },
      {
        id: "creative_outlet",
        text: "Does she have any creative hobbies or outlets?",
        type: "text",
        required: false,
      },
    ],
    lover: [
      {
        id: "love_language",
        text: "What is their primary love language and how do they express affection?",
        type: "select",
        required: true,
        options: [
          "Words of Affirmation",
          "Acts of Service",
          "Receiving Gifts",
          "Quality Time",
          "Physical Touch",
        ],
      },
      {
        id: "jealousy_triggers",
        text: "What situations or behaviors might trigger jealousy or insecurity?",
        type: "textarea",
        required: true,
      },
      {
        id: "cherished_memory",
        text: "Describe a cherished shared memory that defines your relationship.",
        type: "textarea",
        required: true,
      },
      {
        id: "future_plans",
        text: "What hopes or future plans do you share together?",
        type: "text",
        required: false,
      },
      {
        id: "pet_peeves",
        text: "What small habits or behaviors are pet peeves?",
        type: "text",
        required: false,
      },
    ],
    best_friend: [
      {
        id: "first_meeting",
        text: "How did you first meet and what drew you to become such close friends?",
        type: "textarea",
        required: true,
      },
      {
        id: "wildest_memory",
        text: "What is your wildest, funniest, or most adventurous memory together?",
        type: "textarea",
        required: true,
      },
      {
        id: "support_system",
        text: "How do you support each other through challenges and celebrations?",
        type: "textarea",
        required: true,
      },
      {
        id: "shared_hobby",
        text: "What hobbies or interests do you share?",
        type: "text",
        required: false,
      },
      {
        id: "nickname",
        text: "Do you have special nicknames for each other?",
        type: "text",
        required: false,
      },
    ],
    close_relation: [
      {
        id: "relationship_background",
        text: "Describe the relationship background and how you became close.",
        type: "textarea",
        required: true,
      },
      {
        id: "memories",
        text: "What important shared memories define your connection?",
        type: "textarea",
        required: true,
      },
      {
        id: "dreams",
        text: "What aspirations, dreams, or goals do they have?",
        type: "textarea",
        required: true,
      },
      {
        id: "habits",
        text: "What notable habits or quirks do they have?",
        type: "text",
        required: false,
      },
      {
        id: "personality",
        text: "What key personality traits define who they are?",
        type: "text",
        required: false,
      },
    ],
  };

  let templateAnswers = $state({});
  let customRelationship = $state("");

  function selectTemplate(key) {
    state.template = key;
    if (key === "close_relation") {
      state.relationship = "";
    } else {
      state.relationship = displayNames[key] || "";
    }
    templateAnswers = {};
  }

  function backToTemplates() {
    state.template = null;
    state.relationship = null;
    templateAnswers = {};
  }

  function allRequiredAnswered() {
    if (!state.template) return false;
    return templates[state.template]
      .filter((q) => q.required)
      .every((q) => (templateAnswers[q.id] || "").trim());
  }

  function submitTemplateForm() {
    if (!allRequiredAnswered()) return;
    const relationshipFinal =
      state.template === "close_relation"
        ? customRelationship || "Close Relation"
        : displayNames[state.template] || state.relationship;
    const payload = {
      template: state.template,
      relationship: relationshipFinal,
      answers: { ...templateAnswers },
    };
    replicasStore.addDraft(payload);

    // Update wizard store with template info and prefilled basics
    wizardStore.updateTemplate(state.template, relationshipFinal);
    wizardStore.updateBasics({
      name: relationshipFinal,
      description: `Template: ${displayNames[state.template] || "Relation"} replica`,
      consent: true,
    });
    wizardStore.setCurrentStep(1);
    state.currentStep = 1;
  }
  let isAuthenticated = $state(false);

  // Subscribe to wizard store
  let unsubscribe;
  onMount(async () => {
    isAuthenticated = checkAuthStatus();

    // Check if user is a patient - redirect if they are
    if (isAuthenticated) {
      try {
        const response = await apiCall("/api/auth/me", { method: "GET" });
        if (response.ok) {
          const userData = await response.json();
          if (userData.user && userData.user.role === "patient") {
            alert(
              "Patients cannot create replicas. You can only view and chat with replicas created by your caretaker.",
            );
            goto("/dashboard");
            return;
          }
        }
      } catch (error) {
        console.error("Failed to check user role:", error);
      }
    }

    // Don't override the wizard store with step 0 if it's already loaded from storage
    const currentWizardState = wizardStore.getState();
    if (!currentWizardState || currentWizardState.currentStep === undefined) {
      wizardStore.setCurrentStep(0);
    }

    if (isAuthenticated) {
      wizardStore.loadFromStorage && wizardStore.loadFromStorage();
    }

    // Subscribe to wizard store changes - but preserve local template state
    unsubscribe = wizardStore.subscribe((value) => {
      if (value.currentStep !== undefined) {
        state.currentStep = value.currentStep;
      }
      state.basics = value.basics || {};
      state.requiredAnswers = value.requiredAnswers || {};
      state.optionalAnswers = value.optionalAnswers || {};
      state.selectedSegments = value.selectedSegments || [];
      state.creationPath = value.creationPath || "questionnaire";
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  });

  const steps = [
    { number: 1, title: "Basic Info", component: Step1Basics },
    {
      number: 2,
      title: "Required Questions",
      component: Step2RequiredQuestions,
    },
    { number: 3, title: "Choose Categories", component: Step3ChooseSegments },
    {
      number: 4,
      title: "Optional Questions",
      component: Step4OptionalQuestions,
    },
    { number: 5, title: "Profile Image", component: Step5ProfileImage },
    { number: 6, title: "Review & Submit", component: Step7ReviewSubmit },
  ];

  function goToStep(stepNumber) {
    if (!requireAuthForAction("create and customize your replica")) return;
    wizardStore.setCurrentStep(stepNumber);
  }

  function nextStep() {
    if (!requireAuthForAction("proceed to the next step")) return;

    // Jump over questionnaire if upload path is selected
    if (state.currentStep === 1 && state.creationPath === "upload") {
      wizardStore.setCurrentStep(5);
      return;
    }

    // Allow advancing up to step 6 (inclusive)
    if (state.currentStep < 6) {
      wizardStore.setCurrentStep(state.currentStep + 1);
    }
  }

  function previousStep() {
    if (!requireAuthForAction("go back to the previous step")) return;
    if (state.currentStep > 0) {
      if (state.currentStep === 1) {
        // Go back to template selection
        wizardStore.setCurrentStep(0);
        state.currentStep = 0;
      } else {
        wizardStore.setCurrentStep(state.currentStep - 1);
      }
    }
  }

  function canProceedToStep(stepNumber) {
    if (stepNumber <= state.currentStep) return true;
    if (stepNumber <= 1) return true;

    const wizardState = wizardStore.getState?.() ?? state;
    const lastPrerequisiteStep = Math.min(stepNumber - 1, steps.length);

    for (let i = 1; i <= lastPrerequisiteStep; i += 1) {
      if (!wizardStore.isStepValid(i, wizardState)) {
        return false;
      }
    }

    return true;
  }

  function getStepStatus(stepNumber) {
    if (stepNumber < state.currentStep) return "completed";
    if (stepNumber === state.currentStep) return "current";
    if (canProceedToStep(stepNumber)) return "available";
    return "locked";
  }

  // Reactive helper to decide if the Next button should be enabled.
  // Enable if the current step is already valid (e.g. step 2: required questions complete)
  // or if the next step is allowed to be entered.
  let nextEnabled = $state(false);

  $effect(() => {
    // Track state changes - this creates proper reactivity
    const currentState = state;
    const currentStep = currentState.currentStep;

    try {
      // If current step is valid according to wizardStore, allow Next
      if (wizardStore.isStepValid?.(currentStep, currentState)) {
        nextEnabled = true;
        return;
      }
    } catch (e) {
      // ignore and fallback to canProceedToStep
    }

    // Fallback: check if we can proceed to next step
    nextEnabled = canProceedToStep(currentStep + 1);
  });
</script>

<svelte:head>
  <title>Create Replica - Memory Lane</title>
  <meta
    name="description"
    content="Create personalized AI replicas with unique memory and conversation styles to assist dementia and amnesia patients, support caretakers, and empower doctors specializing in memory care."
  />
  <meta
    name="keywords"
    content="create AI replicas, dementia care AI, amnesia memory support, custom AI companion, replica generator, memory illness assistant, neurologist memory therapy AI"
  />
</svelte:head>

<div
  class="relative flex min-h-screen flex-col bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display"
>
  <!-- Header / Navigation -->
  <header
    class="sticky top-0 z-50 w-full border-b border-slate-200/60 bg-white/80 backdrop-blur-md dark:bg-background-dark/80 dark:border-slate-800"
  >
    <div class="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <a
          href="/dashboard"
          class="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <div
            class="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center"
          >
            <span class="material-symbols-outlined text-primary text-2xl"
              >clinical_notes</span
            >
          </div>
          <h1
            class="font-bold tracking-tight text-navy-deep dark:text-slate-100 uppercase tracking-widest text-sm"
          >
            Bio-Digital Systems
          </h1>
        </a>
      </div>
      <div class="flex items-center gap-4">
        <button
          class="p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <span
            class="material-symbols-outlined text-slate-600 dark:text-slate-400"
            >help_outline</span
          >
        </button>
        <button
          class="p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <span
            class="material-symbols-outlined text-slate-600 dark:text-slate-400 text-2xl"
            >settings</span
          >
        </button>
      </div>
    </div>
  </header>

  <main class="flex-1 max-w-5xl mx-auto w-full px-6 py-12">
    {#if !isAuthenticated}
      <div
        class="mb-8 p-4 bg-primary/10 dark:bg-primary/20 border border-primary/20 dark:border-primary/30 rounded-lg"
      >
        <p class="text-sm text-primary dark:text-ivory-warm">
          🔍 You're in preview mode. <a
            href="/login"
            class="underline hover:text-navy-deep dark:hover:text-white font-semibold"
            >Log in</a
          > to create your personal AI replica.
        </p>
      </div>
    {/if}

    <!-- Progress Bar (Only show if past Step 0) -->
    {#if state.currentStep > 0}
      <div class="mb-12">
        <div class="flex justify-between items-center mb-4">
          {#each steps as step (step.number)}
            <div class="flex flex-col items-center flex-1">
              <button
                onclick={() =>
                  canProceedToStep(step.number) && goToStep(step.number)}
                class="w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-medium transition-colors mb-2 relative
                  {getStepStatus(step.number) === 'completed'
                  ? 'bg-primary border-primary text-white'
                  : getStepStatus(step.number) === 'current'
                    ? 'bg-navy-deep border-navy-deep text-white'
                    : getStepStatus(step.number) === 'available'
                      ? 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-primary hover:text-primary'
                      : 'border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'}"
                disabled={!canProceedToStep(step.number)}
              >
                {#if getStepStatus(step.number) === "completed"}
                  <span class="material-symbols-outlined text-[18px]"
                    >check</span
                  >
                {:else}
                  {step.number}
                {/if}
              </button>
              <span
                class="text-xs text-center mt-1 font-medium
                {getStepStatus(step.number) === 'current'
                  ? 'text-primary dark:text-white'
                  : 'text-slate-500 dark:text-slate-400'}"
              >
                {step.title}
              </span>
            </div>
            {#if step.number < steps.length}
              <div
                class="flex-1 h-0.5 mx-2 {step.number < state.currentStep
                  ? 'bg-primary'
                  : 'bg-slate-200 dark:bg-slate-700'}"
              ></div>
            {/if}
          {/each}
        </div>
      </div>
    {/if}

    <!-- Content Area -->
    {#if state.currentStep === 0 && !state.template}
      <!-- USER PROVIDED HERO SECTION -->
      <div class="mb-16">
        <div
          class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sage-soft border border-emerald-200 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-300 text-xs font-semibold uppercase tracking-wider mb-6"
        >
          <span class="material-symbols-outlined text-[14px]">verified</span>
          Secure Neural Mapping
        </div>
        <h2
          class="text-5xl md:text-6xl font-extrabold text-navy-deep dark:text-slate-100 mb-6 tracking-tight leading-tight"
        >
          Create Your <span class="text-primary">Digital Replica</span>
        </h2>
        <p
          class="text-xl text-slate-500 dark:text-slate-400 max-w-2xl font-light leading-relaxed"
        >
          Build a sophisticated AI architecture that synthesizes your cognitive
          patterns, emotional intelligence, and unique communication style.
        </p>
      </div>

      <!-- USER PROVIDED TEMPLATE GRID -->
      <div class="space-y-8">
        <div class="flex items-end justify-between">
          <div>
            <h3 class="text-2xl font-bold text-navy-deep dark:text-slate-100">
              Select Core Persona
            </h3>
            <p class="text-slate-500 text-sm mt-1">
              Choose a baseline template to begin the calibration process.
            </p>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {#each ["dad", "mom", "brother", "sister", "lover", "best_friend", "close_relation", "self"] as key}
            <div
              onclick={() => selectTemplate(key)}
              role="button"
              tabindex="0"
              onkeydown={(e) => e.key === "Enter" && selectTemplate(key)}
              class="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 cursor-pointer overflow-hidden text-left"
            >
              <div
                class="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors"
              ></div>
              <div class="relative">
                <div
                  class="w-16 h-16 rounded-2xl bg-ivory-warm dark:bg-slate-800 flex items-center justify-center text-4xl mb-6 shadow-sm ring-1 ring-slate-100 dark:ring-slate-700"
                >
                  {templateIcons[key] || "👤"}
                </div>
                <h4
                  class="text-xl font-bold text-navy-deep dark:text-white mb-2"
                >
                  {displayNames[key] || key}
                </h4>
                <p
                  class="text-slate-500 dark:text-slate-400 text-sm leading-relaxed"
                >
                  {templates[key].length} questions to map cognitive & emotional
                  traits.
                </p>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {:else if state.template && state.currentStep === 0}
      <!-- TEMPLATE QUESTIONNAIRE FLOW (Restyled to match new UI) -->
      <div
        class="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 mb-8"
      >
        <div
          class="flex items-center justify-between mb-8 pb-6 border-b border-slate-100 dark:border-slate-800"
        >
          <div>
            <div
              class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-3"
            >
              <span class="material-symbols-outlined text-[14px]">tune</span>
              Calibration Phase
            </div>
            <h2
              class="text-3xl font-extrabold text-navy-deep dark:text-slate-100 tracking-tight"
            >
              {displayNames[state.template] || "Template"} Mapping
            </h2>
          </div>
          <div class="flex gap-3">
            <button
              class="text-sm px-5 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-300 font-medium"
              onclick={backToTemplates}>Cancel</button
            >
            <button
              class="text-sm px-6 py-2.5 bg-primary text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-hover transition-colors font-bold shadow-md shadow-primary/20"
              disabled={!allRequiredAnswered()}
              onclick={submitTemplateForm}>Synthesize & Continue</button
            >
          </div>
        </div>

        {#if state.template === "close_relation"}
          <div class="mb-6">
            <label
              for="customRelation"
              class="block text-sm font-semibold text-navy-deep dark:text-slate-200 mb-2"
              >Relationship Designation</label
            >
            <input
              id="customRelation"
              class="w-full rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 text-sm px-4 py-3 focus:ring-2 focus:ring-primary focus:border-primary placeholder:text-slate-400"
              bind:value={customRelationship}
              placeholder="e.g., Colleague, Mentor, Aunt"
            />
          </div>
        {/if}

        <div class="space-y-6">
          {#each templates[state.template] as q (q.id)}
            <div
              class="p-6 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30"
            >
              <label
                for={`q_${q.id}`}
                class="block text-base font-semibold text-navy-deep dark:text-slate-200 mb-3"
              >
                {q.text}
                {#if q.required}<span class="text-primary ml-1">*</span>{/if}
              </label>

              {#if q.type === "textarea"}
                <textarea
                  id={`q_${q.id}`}
                  rows="4"
                  class="w-full rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-sm p-4 resize-y focus:ring-2 focus:ring-primary focus:border-primary transition-all shadow-sm"
                  bind:value={templateAnswers[q.id]}
                  placeholder="Provide detailed context..."
                ></textarea>
              {:else if q.type === "select"}
                <select
                  id={`q_${q.id}`}
                  class="w-full h-12 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-sm px-4 focus:ring-2 focus:ring-primary focus:border-primary transition-all shadow-sm"
                  bind:value={templateAnswers[q.id]}
                >
                  <option value="" disabled selected>Select parameter...</option
                  >
                  {#each q.options as opt}<option value={opt}>{opt}</option
                    >{/each}
                </select>
              {:else}
                <input
                  id={`q_${q.id}`}
                  type="text"
                  class="w-full h-12 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-sm px-4 focus:ring-2 focus:ring-primary focus:border-primary transition-all shadow-sm"
                  bind:value={templateAnswers[q.id]}
                  placeholder="Enter value..."
                />
              {/if}
              {#if q.required && !(templateAnswers[q.id] || "").trim()}
                <p
                  class="mt-2 text-xs font-medium text-red-500 flex items-center gap-1"
                >
                  <span class="material-symbols-outlined text-[14px]"
                    >error</span
                  > Input required
                </p>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {:else}
      <!-- EXISTING WIZARD FLOW (Steps 1-7) -->
      <div class="min-h-96">
        {#if state}
          {#each steps as step (step.number)}
            {#if step.number === state.currentStep}
              <div
                class="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 mb-8"
              >
                <step.component />
              </div>
            {/if}
          {/each}
        {/if}
      </div>

      <!-- Navigation Footer for steps > 0 -->
      <div
        class="flex justify-between items-center mt-8 p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800"
      >
        <button
          onclick={previousStep}
          disabled={state.currentStep <= 0}
          class="px-6 py-3 border border-slate-300 dark:border-slate-700 rounded-xl font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          Return to Previous
        </button>

        <div
          class="text-sm text-slate-500 dark:text-slate-400 font-semibold tracking-wide uppercase"
        >
          Phase {state?.currentStep} / {steps.length}
        </div>

        {#if state.currentStep < 6}
          <button
            onclick={nextStep}
            disabled={!nextEnabled}
            class="px-8 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-primary/20 flex items-center gap-2"
          >
            Advance Protocol
            <span class="material-symbols-outlined">arrow_forward</span>
          </button>
        {:else}
          <div></div>
        {/if}
      </div>
    {/if}

    <!-- USER PROVIDED ACTION FOOTER & METADATA -->
    {#if state.currentStep === 0 && !state.template}
      <div
        class="mt-16 p-8 bg-navy-deep rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl"
      >
        <div class="flex items-center gap-4 text-white">
          <div class="p-3 bg-white/10 rounded-xl backdrop-blur-sm">
            <span class="material-symbols-outlined text-ivory-warm"
              >neurology</span
            >
          </div>
          <div>
            <p class="font-bold text-lg">Next: Persona Customization</p>
            <p class="text-slate-300 text-sm">
              Fine-tune voice, vocabulary, and core memories.
            </p>
          </div>
        </div>
        <!-- In the original HTML this button probably progressed to step 1 blindly. We require selecting a template first. Let's make it jump to 'Self' to skip selection or just focus on grids -->
        <button
          onclick={() => selectTemplate("self")}
          class="w-full md:w-auto px-10 py-4 bg-primary text-white rounded-xl font-bold text-lg shadow-lg shadow-primary/20 hover:bg-primary-hover transition-all flex items-center justify-center gap-2"
        >
          Initialize Setup
          <span class="material-symbols-outlined">arrow_forward</span>
        </button>
      </div>
    {/if}

    <div
      class="mt-12 text-center text-slate-400 dark:text-slate-500 text-xs flex flex-wrap justify-center gap-x-8 gap-y-2 uppercase tracking-widest font-medium"
    >
      <div class="flex items-center gap-1">
        <span class="material-symbols-outlined text-[14px]">lock</span>
        E2E Encrypted
      </div>
      <div class="flex items-center gap-1">
        <span class="material-symbols-outlined text-[14px]">memory</span>
        Llama-3 Architecture
      </div>
      <div class="flex items-center gap-1">
        <span class="material-symbols-outlined text-[14px]">database</span>
        Private Node Deployment
      </div>
    </div>
  </main>

  <footer
    class="mt-auto py-12 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50"
  >
    <div
      class="max-w-5xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6"
    >
      <div class="flex items-center gap-2">
        <div
          class="w-6 h-6 bg-navy-deep rounded flex items-center justify-center"
        >
          <span class="material-symbols-outlined text-white text-[12px]"
            >analytics</span
          >
        </div>
        <span class="text-sm font-bold text-navy-deep dark:text-slate-100"
          >BDS v4.2.0</span
        >
      </div>
      <div
        class="flex gap-8 text-sm text-slate-500 dark:text-slate-400 font-medium"
      >
        <a class="hover:text-primary transition-colors" href="#"
          >Ethics Protocol</a
        >
        <a class="hover:text-primary transition-colors" href="#"
          >Privacy Charter</a
        >
        <a class="hover:text-primary transition-colors" href="#"
          >System Status</a
        >
      </div>
    </div>
  </footer>
</div>
