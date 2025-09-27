<script>
  import { onMount } from 'svelte';
  import { wizardStore } from '$lib/stores/wizardStore.js';

  let name = $state('');
  let description = $state('');
  let greeting = $state('');
  let preferredQuestion = $state('');
  let consent = $state(false);
  
  // Subscribe to wizard store and initialize with current values
  let unsubscribe;
  onMount(() => {
    const currentState = wizardStore.getState();
    name = currentState.basics?.name || '';
    description = currentState.basics?.description || '';
    greeting = currentState.basics?.greeting || '';
    preferredQuestion = currentState.basics?.preferredQuestion || '';
    consent = currentState.basics?.consent || false;
    
    unsubscribe = wizardStore.subscribe(value => {
      if (value.basics) {
        if (value.basics.name !== undefined) name = value.basics.name;
        if (value.basics.description !== undefined) description = value.basics.description;
        if (value.basics.greeting !== undefined) greeting = value.basics.greeting;
        if (value.basics.preferredQuestion !== undefined) preferredQuestion = value.basics.preferredQuestion;
        if (value.basics.consent !== undefined) consent = value.basics.consent;
      }
    });
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  });

  function updateName(value) {
    name = value;
    wizardStore.updateBasics({ name: value });
  }

  function updateDescription(value) {
    description = value;
    wizardStore.updateBasics({ description: value });
  }

  function updateGreeting(value) {
    greeting = value;
    wizardStore.updateBasics({ greeting: value });
  }

  function updatePreferredQuestion(value) {
    preferredQuestion = value;
    wizardStore.updateBasics({ preferredQuestion: value });
  }

  function updateConsent(value) {
    consent = value;
    wizardStore.updateBasics({ consent: value });
  }
</script>

<div class="p-6">
  <div class="mb-6">
    <h2 class="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Basic Information</h2>
    <p class="text-gray-600 dark:text-gray-400">Let's start with the basics about your AI replica.</p>
  </div>

  <div class="space-y-6">
    <!-- Replica Name -->
    <div>
      <label for="replicaName" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Replica Name *
      </label>
      <input
        type="text"
        id="replicaName"
        bind:value={name}
        oninput={(e) => updateName(e.target.value)}
        required
        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        placeholder="Give your AI replica a memorable name"
      />
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        This is how people will refer to your replica
      </p>
    </div>

    <!-- Description -->
    <div>
      <label for="description" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Short Description *
      </label>
      <textarea
        id="description"
        bind:value={description}
        oninput={(e) => updateDescription(e.target.value)}
        required
        maxlength="50"
        rows="4"
        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        placeholder="Describe your replica briefly (maximum 50 characters)"
      ></textarea>
      <div class="mt-1 flex justify-between items-start">
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Brief description for your replica
        </p>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          {description.length}/50 characters
        </p>
      </div>
      {#if description.length > 50}
        <p class="mt-1 text-sm text-red-600 dark:text-red-400">
          Description must be 50 characters or less
        </p>
      {/if}
    </div>

    <!-- Greeting Message -->
    <div>
      <label for="greeting" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Custom Greeting (Optional)
      </label>
      <textarea
        id="greeting"
        bind:value={greeting}
        oninput={(e) => updateGreeting(e.target.value)}
        maxlength="200"
        rows="3"
        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        placeholder="How should your replica greet people? (e.g., 'Hey there! It's great to chat with you again!')"
      ></textarea>
      <div class="mt-1 flex justify-between items-start">
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Personalized greeting message for conversations
        </p>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          {greeting.length}/200 characters
        </p>
      </div>
    </div>

    <!-- Preferred Question -->
    <div>
      <label for="preferredQuestion" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Preferred Conversation Starter (Optional)
      </label>
      <input
        id="preferredQuestion"
        type="text"
        bind:value={preferredQuestion}
        oninput={(e) => updatePreferredQuestion(e.target.value)}
        maxlength="150"
        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        placeholder="What question would your replica like to ask? (e.g., 'How was your day today?')"
      />
      <div class="mt-1 flex justify-between items-start">
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Question your replica might ask to start conversations
        </p>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          {preferredQuestion.length}/150 characters
        </p>
      </div>
    </div>

    <!-- Consent Checkbox -->
    <div>
      <div class="flex items-start">
        <input
          type="checkbox"
          id="consent"
          bind:checked={consent}
          onchange={(e) => updateConsent(e.target.checked)}
          class="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />
        <div class="ml-3">
          <label for="consent" class="text-sm font-medium text-gray-700 dark:text-gray-300">
            I consent to create an AI replica *
          </label>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            I understand that this replica will be trained on my personal responses and may reflect my personality, 
            opinions, and communication style. I consent to the processing of this personal information for the 
            purpose of creating an AI replica.
          </p>
        </div>
      </div>
    </div>

    <!-- Information Box -->
    <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
      <div class="flex">
        <svg class="flex-shrink-0 h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <div class="ml-3">
          <h3 class="text-sm font-medium text-blue-800 dark:text-blue-200">
            About the Creation Process
          </h3>
          <div class="mt-2 text-sm text-blue-700 dark:text-blue-300">
            <p>
              Creating a high-quality AI replica requires detailed information about your personality, thoughts, 
              and communication style. The next steps will guide you through questions designed to capture your 
              unique characteristics and help build an AI that truly represents you.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
