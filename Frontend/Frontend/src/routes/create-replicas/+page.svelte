<script>
  import { onMount } from 'svelte';
  import { wizardStore } from '$lib/stores/wizardStore.js';
  import { protectRoute } from '$lib/auth.js';
  
  import Step1Basics from '$lib/components/wizard/Step1Basics.svelte';
  import Step2RequiredQuestions from '$lib/components/wizard/Step2RequiredQuestions.svelte';
  import Step3ChooseSegments from '$lib/components/wizard/Step3ChooseSegments.svelte';
  import Step4OptionalQuestions from '$lib/components/wizard/Step4OptionalQuestions.svelte';
  import Step5ProfileImage from '$lib/components/wizard/Step5ProfileImage.svelte';
  import Step6ReviewSubmit from '$lib/components/wizard/Step6ReviewSubmit.svelte';

  let state = $state();

  $effect(() => {
    return wizardStore.subscribe(value => {
      state = value;
    });
  });

  onMount(() => {
    protectRoute();
    wizardStore.loadFromStorage();
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
    wizardStore.setCurrentStep(stepNumber);
  }

  function nextStep() {
    if (state.currentStep < 6) {
      wizardStore.setCurrentStep(state.currentStep + 1);
    }
  }

  function previousStep() {
    if (state.currentStep > 1) {
      wizardStore.setCurrentStep(state.currentStep - 1);
    }
  }

  function canProceedToStep(stepNumber) {
    if (stepNumber <= state.currentStep) return true;
    
    switch (stepNumber) {
      case 2:
        return state?.basics?.name?.trim() && state?.basics?.description?.trim() && state?.basics?.consent;
      case 3:
        return Object.keys(state?.requiredAnswers || {}).length >= 10;
      case 4:
        return (state?.selectedSegments || []).length > 0;
      case 5:
        return Object.keys(state?.optionalAnswers || {}).length >= 40;
      case 6:
        return true; // Image is optional
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
  <title>Create Replica - Sensay AI</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900">
  <div class="max-w-4xl mx-auto px-4 py-8">
    <!-- Header -->
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        Create Your Digital Replica
      </h1>
      <p class="text-gray-600 dark:text-gray-400">
        Build an AI that thinks and responds like you
      </p>
    </div>

    <!-- Progress Bar -->
    <div class="mb-8">
      <div class="flex justify-between items-center mb-4">
        {#each steps as step}
          <div class="flex flex-col items-center flex-1">
            <button
              onclick={() => canProceedToStep(step.number) && goToStep(step.number)}
              class="w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-medium transition-colors mb-2
                {getStepStatus(step.number) === 'completed' 
                  ? 'bg-green-600 border-green-600 text-white' 
                  : getStepStatus(step.number) === 'current'
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : getStepStatus(step.number) === 'available'
                  ? 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-blue-500 hover:text-blue-600'
                  : 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'}"
              disabled={!canProceedToStep(step.number)}
            >
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

    <!-- Step Content -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 min-h-96">
      {#if state}
        {#each steps as step}
          {#if step.number === state.currentStep}
            <svelte:component this={step.component} />
          {/if}
        {/each}
      {/if}
    </div>

    <!-- Navigation -->
    <div class="flex justify-between items-center mt-6">
      <button
        onclick={previousStep}
        disabled={state.currentStep <= 1}
        class="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Previous
      </button>
      
      <div class="text-sm text-gray-500 dark:text-gray-400">
        Step {state?.currentStep || 1} of {steps.length}
      </div>
      
      {#if state.currentStep < 6}
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
</div>
