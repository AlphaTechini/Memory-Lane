<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { wizardStore } from '$lib/stores/wizardStore.js';
  import { replicasStore } from '$lib/stores/replicasStore.js';
  import { requireAuthForAction, checkAuthStatus, apiCall } from '$lib/auth.js';
  import BackNavigation from '$lib/components/BackNavigation.svelte';
  
  import Step1Basics from '$lib/components/wizard/Step1Basics.svelte';
  import Step2RequiredQuestions from '$lib/components/wizard/Step2RequiredQuestions.svelte';
  import Step3ChooseSegments from '$lib/components/wizard/Step3ChooseSegments.svelte';
  import Step4OptionalQuestions from '$lib/components/wizard/Step4OptionalQuestions.svelte';
  import Step5ProfileImage from '$lib/components/wizard/Step5ProfileImage.svelte';
  import Step6ReviewSubmit from '$lib/components/wizard/Step6ReviewSubmit.svelte';

  let state = $state({
    currentStep: 0, // 0 = template selection before existing steps
    basics: {},
    requiredAnswers: {},
    optionalAnswers: {},
    selectedSegments: [],
    template: null,
    relationship: null
  });

  const fixedTemplates = ['self','dad','mom','brother','sister','lover','best_friend'];
  const displayNames = {
    self: 'Self', dad: 'Dad', mom: 'Mom', brother: 'Brother', sister: 'Sister', lover: 'Lover', best_friend: 'Best Friend', close_relation: 'Close Relation'
  };

  // Template icons for better visual representation
  const templateIcons = {
    self: '👤',
    dad: '👨‍👔',
    mom: '👩‍💼',
    brother: '👦',
    sister: '👧',
    lover: '💕',
    best_friend: '👯',
    close_relation: '🤝'
  };

  // Template question bank (easily extendable) - Updated with larger text areas
  const templates = {
    self: [
      { id:'core_values', text:'List your core values and what principles guide your decisions.', type:'textarea', required:true },
      { id:'strengths', text:'Describe your main strengths and what you excel at.', type:'textarea', required:true },
      { id:'goals', text:'What are your current goals and aspirations?', type:'textarea', required:true },
      { id:'hobbies', text:'What hobbies or interests bring you joy?', type:'text', required:false },
      { id:'fun_fact', text:'Share a fun fact about yourself.', type:'text', required:false }
    ],
    dad: [
      { id:'life_lessons', text:'What life lessons does Dad repeat often and what wisdom has shaped his worldview?', type:'textarea', required:true },
      { id:'hobbies', text:'What are his main hobbies and how does he spend his free time?', type:'textarea', required:true },
      { id:'values', text:'What core values does he live by and how do they show up in daily life?', type:'textarea', required:true },
      { id:'weekend_activity', text:'What does a typical weekend look like for him?', type:'text', required:false },
      { id:'famous_quote', text:'What phrase or saying does he always repeat?', type:'text', required:false }
    ],
    mom: [
      { id:'comfort_food', text:'What is her signature comfort dish and what food memories are special to her?', type:'textarea', required:true },
      { id:'sayings', text:'What common sayings, expressions, or advice does she share?', type:'textarea', required:true },
      { id:'daily_habits', text:'Describe her daily habits, routines, and how she organizes family life.', type:'textarea', required:true },
      { id:'favorite_music', text:'What type of music does she enjoy?', type:'text', required:false },
      { id:'relax_method', text:'How does she unwind and relax?', type:'text', required:false }
    ],
    brother: [
      { id:'favorite_games', text:'What games, sports, or activities does he love and why are they important to him?', type:'textarea', required:true },
      { id:'annoyances', text:'What things annoy him and how does he react when frustrated?', type:'textarea', required:true },
      { id:'motivations', text:'What motivates him most and drives his enthusiasm?', type:'textarea', required:true },
      { id:'inside_joke', text:'Any inside jokes or funny memories you share?', type:'text', required:false },
      { id:'style', text:'How would you describe his personal style or fashion?', type:'text', required:false }
    ],
    sister: [
      { id:'humor_style', text:'What makes her laugh and how does her sense of humor work?', type:'textarea', required:true },
      { id:'bonding_moment', text:'Describe a memorable bonding moment that captures your relationship.', type:'textarea', required:true },
      { id:'crush_topics', text:'What does she like to talk about regarding relationships or crushes?', type:'textarea', required:true },
      { id:'favorite_show', text:'What are her favorite shows or entertainment?', type:'text', required:false },
      { id:'creative_outlet', text:'Does she have any creative hobbies or outlets?', type:'text', required:false }
    ],
    lover: [
      { id:'love_language', text:'What is their primary love language and how do they express affection?', type:'select', required:true, options:['Words of Affirmation','Acts of Service','Receiving Gifts','Quality Time','Physical Touch'] },
      { id:'jealousy_triggers', text:'What situations or behaviors might trigger jealousy or insecurity?', type:'textarea', required:true },
      { id:'cherished_memory', text:'Describe a cherished shared memory that defines your relationship.', type:'textarea', required:true },
      { id:'future_plans', text:'What hopes or future plans do you share together?', type:'text', required:false },
      { id:'pet_peeves', text:'What small habits or behaviors are pet peeves?', type:'text', required:false }
    ],
    best_friend: [
      { id:'first_meeting', text:'How did you first meet and what drew you to become such close friends?', type:'textarea', required:true },
      { id:'wildest_memory', text:'What is your wildest, funniest, or most adventurous memory together?', type:'textarea', required:true },
      { id:'support_system', text:'How do you support each other through challenges and celebrations?', type:'textarea', required:true },
      { id:'shared_hobby', text:'What hobbies or interests do you share?', type:'text', required:false },
      { id:'nickname', text:'Do you have special nicknames for each other?', type:'text', required:false }
    ],
    close_relation: [
      { id:'relationship_background', text:'Describe the relationship background and how you became close.', type:'textarea', required:true },
      { id:'memories', text:'What important shared memories define your connection?', type:'textarea', required:true },
      { id:'dreams', text:'What aspirations, dreams, or goals do they have?', type:'textarea', required:true },
      { id:'habits', text:'What notable habits or quirks do they have?', type:'text', required:false },
      { id:'personality', text:'What key personality traits define who they are?', type:'text', required:false }
    ]
  };

  let templateAnswers = $state({});
  let customRelationship = $state('');

  function selectTemplate(key) {
    state.template = key;
    if (key === 'close_relation') {
      state.relationship = '';
    } else {
      state.relationship = displayNames[key] || '';
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
    return templates[state.template].filter(q=>q.required).every(q => (templateAnswers[q.id]||'').trim());
  }

  function submitTemplateForm() {
    if (!allRequiredAnswered()) return;
    const relationshipFinal = state.template === 'close_relation' ? (customRelationship || 'Close Relation') : (displayNames[state.template] || state.relationship);
    const payload = {
      template: state.template,
      relationship: relationshipFinal,
      answers: { ...templateAnswers }
    };
    replicasStore.addDraft(payload);
    
    // Update wizard store with template info and prefilled basics
    wizardStore.updateTemplate(state.template, relationshipFinal);
    wizardStore.updateBasics({ 
      name: relationshipFinal, 
      description: `Template: ${displayNames[state.template] || 'Relation'} replica`, 
      consent: true 
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
        const response = await apiCall('/api/auth/me', { method: 'GET' });
        if (response.ok) {
          const userData = await response.json();
          if (userData.user && userData.user.role === 'patient') {
            alert('Patients cannot create replicas. You can only view and chat with replicas created by your caretaker.');
            goto('/dashboard');
            return;
          }
        }
      } catch (error) {
        console.error('Failed to check user role:', error);
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
    unsubscribe = wizardStore.subscribe(value => {
      if (value.currentStep !== undefined) {
        state.currentStep = value.currentStep;
      }
      state.basics = value.basics || {};
      state.requiredAnswers = value.requiredAnswers || {};
      state.optionalAnswers = value.optionalAnswers || {};
      state.selectedSegments = value.selectedSegments || [];
    });
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  });

  const steps = [
    { number: 1, title: 'Basic Info', component: Step1Basics },
    { number: 2, title: 'Required Questions', component: Step2RequiredQuestions },
    { number: 3, title: 'Choose Categories', component: Step3ChooseSegments },
    { number: 4, title: 'Optional Questions', component: Step4OptionalQuestions },
    { number: 5, title: 'Profile Image', component: Step5ProfileImage },
    { number: 6, title: 'Review & Submit', component: Step6ReviewSubmit }
  ];

  function goToStep(stepNumber) {
    if (!requireAuthForAction('create and customize your replica')) return;
    wizardStore.setCurrentStep(stepNumber);
  }

  function nextStep() {
    if (!requireAuthForAction('proceed to the next step')) return;
  if (state.currentStep < 6) {
      wizardStore.setCurrentStep(state.currentStep + 1);
    }
  }

  function previousStep() {
    if (!requireAuthForAction('go back to the previous step')) return;
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

    switch (stepNumber) {
      case 2:
        return Boolean(state?.basics?.name?.trim() && state?.basics?.description?.trim() && state?.basics?.consent);
      case 3:
        return Object.keys(state?.requiredAnswers || {}).length >= 10;
      case 4:
        return (state?.selectedSegments || []).length > 0;
      case 5:
        return true; // Profile image optional
      case 6:
        return true; // Review step
      default:
        return false;
    }
  }

  function getStepStatus(stepNumber) {
    if (stepNumber < state.currentStep) return 'completed';
    if (stepNumber === state.currentStep) return 'current';
    if (canProceedToStep(stepNumber)) return 'available';
    return 'locked';
  }

</script>

<svelte:head>
  <title>Create Replica - Memory Lane</title>
    </svelte:head>

    <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
  <BackNavigation 
    title="Create Your Digital Replica" 
    subtitle="Build an AI that thinks and responds like you"
  />
  
  <div class="max-w-4xl mx-auto px-4 py-8">
      {#if !isAuthenticated}
        <div class="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p class="text-sm text-blue-700 dark:text-blue-300">
            🔍 You're in preview mode. <a href="/login" class="underline hover:text-blue-800 dark:hover:text-blue-200">Log in</a> to create your personal AI replica.
          </p>
        </div>
      {/if}
    </div>

    <!-- Progress Bar -->
    {#if state.currentStep > 0}
    <div class="mb-8" >
      <div class="flex justify-between items-center mb-4">
        {#each steps as step (step.number)}
          <div class="flex flex-col items-center flex-1">
            <button
              onclick={() => canProceedToStep(step.number) && goToStep(step.number)}
              class="w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-medium transition-colors mb-2 relative
                {getStepStatus(step.number) === 'completed' 
                  ? 'bg-green-600 border-green-600 text-white' 
                  : getStepStatus(step.number) === 'current'
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : getStepStatus(step.number) === 'available'
                  ? 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-blue-500 hover:text-blue-600'
                  : 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'}"
              disabled={!canProceedToStep(step.number)}
            >
              {#if !isAuthenticated}
                <!-- Lock overlay for non-authenticated users -->
                <div class="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
                  <svg class="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />
                  </svg>
                </div>
              {/if}
              
              {#if getStepStatus(step.number) === 'completed'}
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
              {:else}
                {step.number}
              {/if}
            </button>
            <span class="text-xs text-center
              {getStepStatus(step.number) === 'current' 
                ? 'text-blue-600 dark:text-blue-400 font-medium' 
                : 'text-gray-500 dark:text-gray-400'}">
              {step.title}
            </span>
          </div>
          {#if step.number < steps.length}
            <div class="flex-1 h-0.5 mx-2 
              {step.number < state.currentStep 
                ? 'bg-green-600' 
                : 'bg-gray-200 dark:bg-gray-700'}">
            </div>
          {/if}
        {/each}
      </div>
    </div>
    {/if}

    <!-- Template Selection / Dynamic Form / Existing Steps -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 min-h-96 p-6">
      {#if !state.template && state.currentStep === 0}
        <h2 class="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">Choose a Template</h2>
        <p class="text-gray-600 dark:text-gray-400 mb-6">Start with a pre-made template to speed up your replica creation process.</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {#each ['dad','mom','brother','sister','lover','best_friend','close_relation','self'] as key}
            <button 
              class="border border-gray-200 dark:border-gray-600 rounded-lg p-6 text-left hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-gray-50 dark:bg-gray-700/40 hover:bg-white dark:hover:bg-gray-700/60" 
              onclick={() => selectTemplate(key)}
            >
              <div class="text-3xl mb-3">{templateIcons[key]}</div>
              <div class="font-semibold text-gray-900 dark:text-gray-100 mb-2">{displayNames[key] || key}</div>
              <div class="text-sm text-gray-500 dark:text-gray-400">
                {templates[key].length} {templates[key].length === 1 ? 'question' : 'questions'} to customize your {displayNames[key]?.toLowerCase() || key} replica
              </div>
            </button>
          {/each}
        </div>
        <p class="text-sm text-gray-500 dark:text-gray-400">You can still customize everything in later steps.</p>
      {:else if state.template && state.currentStep === 0}
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-semibold text-gray-800 dark:text-gray-100">{displayNames[state.template] || 'Template' } Questions</h2>
          <div class="flex gap-2">
            <button class="text-sm px-3 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700" onclick={backToTemplates}>Back to Templates</button>
            <button class="text-sm px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50" disabled={!allRequiredAnswered()} onclick={submitTemplateForm}>Save & Continue</button>
          </div>
        </div>
        {#if state.template === 'close_relation'}
          <div class="mb-4">
            <label for="customRelation" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Relationship Label</label>
            <input id="customRelation" class="w-full rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 text-sm" bind:value={customRelationship} placeholder="e.g., Aunt, Uncle, Cousin" />
          </div>
        {/if}
        <div class="space-y-4 overflow-y-auto max-h-[55vh] pr-1">
          {#each templates[state.template] as q}
            <div class="border border-gray-200 dark:border-gray-600 rounded p-4 bg-gray-50 dark:bg-gray-700/40">
              <label for={`q_${q.id}`} class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{q.text} {#if q.required}<span class="text-red-500">*</span>{/if}</label>
              {#if q.type === 'textarea'}
                <textarea 
                  id={`q_${q.id}`} 
                  rows="5" 
                  class="w-full min-h-[120px] rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 text-sm p-3 resize-y focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
                  bind:value={templateAnswers[q.id]} 
                  oninput={(e)=> templateAnswers[q.id]=e.target.value}
                  placeholder="Share your thoughts in detail..."
                ></textarea>
              {:else if q.type === 'select'}
                <select 
                  id={`q_${q.id}`} 
                  class="w-full h-[44px] rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 text-sm p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
                  bind:value={templateAnswers[q.id]} 
                  onchange={(e)=> templateAnswers[q.id]=e.target.value}
                >
                  <option value="">Select...</option>
                  {#each q.options as opt}<option value={opt}>{opt}</option>{/each}
                </select>
              {:else if q.type === 'date'}
                <input 
                  id={`q_${q.id}`} 
                  type="date" 
                  class="w-full h-[44px] rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 text-sm p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
                  bind:value={templateAnswers[q.id]} 
                  oninput={(e)=> templateAnswers[q.id]=e.target.value} 
                />
              {:else}
                <input 
                  id={`q_${q.id}`} 
                  type="text" 
                  class="w-full h-[44px] rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 text-sm p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
                  bind:value={templateAnswers[q.id]} 
                  oninput={(e)=> templateAnswers[q.id]=e.target.value}
                  placeholder="Enter your answer..."
                />
              {/if}
              {#if q.required && !(templateAnswers[q.id]||'').trim()}
                <p class="mt-1 text-xs text-red-500">Required</p>
              {/if}
            </div>
          {/each}
        </div>
      {:else}
        <!-- ORIGINAL WIZARD FLOW -->
        <div class="min-h-96">
          {#if state}
            {#each steps as step (step.number)}
              {#if step.number === state.currentStep}
                {#key step.number}
                  <step.component />
                {/key}
              {/if}
            {/each}
          {/if}
        </div>
      {/if}
    </div>

    <!-- Navigation -->
    <div class="flex justify-between items-center mt-6" >
      <button
        onclick={previousStep}
        disabled={state.currentStep <= 0}
        class="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Previous
      </button>
      
      <div class="text-sm text-gray-500 dark:text-gray-400">
        {#if state.currentStep === 0}Template Selection{/if}
        {#if state.currentStep > 0}Step {state?.currentStep} of {steps.length}{/if}
      </div>
      
      {#if state.currentStep === 0}
        <div></div>
      {:else if state.currentStep < 6}
        <button
          onclick={nextStep}
          disabled={!canProceedToStep(state.currentStep + 1)}
          class="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      {:else}
        <div></div>
      {/if}
    </div>
  </div>
