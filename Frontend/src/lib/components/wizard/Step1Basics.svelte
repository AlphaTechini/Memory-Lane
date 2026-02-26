<script>
  import { onMount } from "svelte";
  import { wizardStore } from "$lib/stores/wizardStore.js";

  let name = $state("");
  let description = $state("");
  let greeting = $state("");
  let preferredQuestion = $state("");
  let consent = $state(false);

  // Subscribe to wizard store and initialize with current values
  let unsubscribe;
  onMount(() => {
    const currentState = wizardStore.getState();
    name = currentState.basics?.name || "";
    description = currentState.basics?.description || "";
    greeting = currentState.basics?.greeting || "";
    preferredQuestion = currentState.basics?.preferredQuestion || "";
    consent = currentState.basics?.consent || false;

    unsubscribe = wizardStore.subscribe((value) => {
      if (value.basics) {
        if (value.basics.name !== undefined) name = value.basics.name;
        if (value.basics.description !== undefined)
          description = value.basics.description;
        if (value.basics.greeting !== undefined)
          greeting = value.basics.greeting;
        if (value.basics.preferredQuestion !== undefined)
          preferredQuestion = value.basics.preferredQuestion;
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

  let creationPath = $state("questionnaire");
  let uploadedFileInfo = $state(null);

  onMount(() => {
    const unsub2 = wizardStore.subscribe((value) => {
      creationPath = value.creationPath || "questionnaire";
      uploadedFileInfo = value.uploadedFileInfo || null;
    });
    return () => {
      unsub2();
    };
  });

  function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      wizardStore.setCreationPath("upload");
      wizardStore.setUploadedFileInfo({
        name: file.name,
        type: file.type,
        dataUrl: ev.target.result,
      });
    };
    reader.readAsDataURL(file);
    event.target.value = ""; // Reset input
  }

  function clearFile() {
    wizardStore.setUploadedFileInfo(null);
    wizardStore.setCreationPath("questionnaire");
  }
</script>

<div class="p-6">
  <div class="mb-6">
    <h2
      class="text-3xl font-bold text-text-light dark:text-text-dark font-serif mb-2"
    >
      Basic Information
    </h2>
    <p class="text-charcoal-600 dark:text-cream-400">
      Let's start with the basics about your AI replica.
    </p>
  </div>

  <div class="space-y-6">
    <!-- Replica Name -->
    <div>
      <label
        for="replicaName"
        class="block text-sm font-medium text-text-light dark:text-text-dark mb-2"
      >
        Replica Name *
      </label>
      <input
        type="text"
        id="replicaName"
        bind:value={name}
        oninput={(e) => updateName(e.target.value)}
        required
        class="w-full px-4 py-3 border border-cream-300 dark:border-charcoal-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-white dark:bg-surface-dark text-text-light dark:text-text-dark transition-colors"
        placeholder="Give your AI replica a memorable name"
      />
      <p class="mt-2 text-sm text-charcoal-500 dark:text-cream-500">
        This is how people will refer to your replica
      </p>
    </div>

    <!-- Description -->
    <div>
      <label
        for="description"
        class="block text-sm font-medium text-text-light dark:text-text-dark mb-2"
      >
        Short Description *
      </label>
      <textarea
        id="description"
        bind:value={description}
        oninput={(e) => updateDescription(e.target.value)}
        required
        maxlength="50"
        rows="4"
        class="w-full px-4 py-3 border border-cream-300 dark:border-charcoal-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-white dark:bg-surface-dark text-text-light dark:text-text-dark transition-colors resize-y"
        placeholder="Describe your replica briefly (maximum 50 characters)"
      ></textarea>
      <div class="mt-2 flex justify-between items-start">
        <p class="text-sm text-charcoal-500 dark:text-cream-500">
          Brief description for your replica
        </p>
        <p class="text-xs text-charcoal-500 dark:text-cream-500">
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
      <label
        for="greeting"
        class="block text-sm font-medium text-text-light dark:text-text-dark mb-2"
      >
        Custom Greeting (Optional)
      </label>
      <textarea
        id="greeting"
        bind:value={greeting}
        oninput={(e) => updateGreeting(e.target.value)}
        maxlength="200"
        rows="3"
        class="w-full px-4 py-3 border border-cream-300 dark:border-charcoal-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-white dark:bg-surface-dark text-text-light dark:text-text-dark transition-colors resize-y"
        placeholder="How should your replica greet people? (e.g., 'Hey there! It's great to chat with you again!')"
      ></textarea>
      <div class="mt-2 flex justify-between items-start">
        <p class="text-sm text-charcoal-500 dark:text-cream-500">
          Personalized greeting message for conversations
        </p>
        <p class="text-xs text-charcoal-500 dark:text-cream-500">
          {greeting.length}/200 characters
        </p>
      </div>
    </div>

    <!-- Preferred Question -->
    <div>
      <label
        for="preferredQuestion"
        class="block text-sm font-medium text-text-light dark:text-text-dark mb-2"
      >
        Preferred Conversation Starter (Optional)
      </label>
      <input
        id="preferredQuestion"
        type="text"
        bind:value={preferredQuestion}
        oninput={(e) => updatePreferredQuestion(e.target.value)}
        maxlength="150"
        class="w-full px-4 py-3 border border-cream-300 dark:border-charcoal-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-white dark:bg-surface-dark text-text-light dark:text-text-dark transition-colors"
        placeholder="What question would your replica like to ask? (e.g., 'How was your day today?')"
      />
      <div class="mt-2 flex justify-between items-start">
        <p class="text-sm text-charcoal-500 dark:text-cream-500">
          Question your replica might ask to start conversations
        </p>
        <p class="text-xs text-charcoal-500 dark:text-cream-500">
          {preferredQuestion.length}/150 characters
        </p>
      </div>
    </div>

    <!-- Consent Checkbox -->
    <div>
      <div
        class="flex items-start bg-cream-50 dark:bg-charcoal-700/30 p-4 rounded-xl border border-cream-200 dark:border-charcoal-600"
      >
        <input
          type="checkbox"
          id="consent"
          bind:checked={consent}
          onchange={(e) => updateConsent(e.target.checked)}
          class="mt-1 w-5 h-5 text-primary border-cream-300 dark:border-charcoal-500 rounded focus:ring-primary dark:bg-charcoal-700"
        />
        <div class="ml-4">
          <label
            for="consent"
            class="text-sm font-medium text-text-light dark:text-text-dark cursor-pointer"
          >
            I consent to create an AI replica *
          </label>
          <p class="text-sm text-charcoal-600 dark:text-cream-400 mt-1">
            I understand that this replica will be trained on my personal
            responses and may reflect my personality, opinions, and
            communication style. I consent to the processing of this personal
            information for the purpose of creating an AI replica.
          </p>
        </div>
      </div>
    </div>

    <!-- Creation Path Selection -->
    <div class="mt-8 border-t border-cream-200 dark:border-charcoal-700 pt-8">
      <h3
        class="text-lg font-semibold text-text-light dark:text-text-dark mb-4 font-serif"
      >
        How would you like to build this replica? *
      </h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <!-- Path A: Questionnaire -->
        <button
          onclick={() => wizardStore.setCreationPath("questionnaire")}
          class="border rounded-xl p-6 flex flex-col items-center justify-center text-center transition-all {creationPath ===
          'questionnaire'
            ? 'border-primary bg-primary/5 dark:bg-primary/10 ring-2 ring-primary'
            : 'border-cream-300 dark:border-charcoal-600 bg-white dark:bg-surface-dark hover:border-primary/50 dark:hover:border-primary/50'}"
        >
          <span
            class="material-symbols-outlined text-4xl mb-3 {creationPath ===
            'questionnaire'
              ? 'text-primary dark:text-secondary'
              : 'text-charcoal-400 dark:text-cream-500'}">quiz</span
          >
          <span class="font-medium text-text-light dark:text-text-dark text-lg"
            >Answer Questions</span
          >
          <span class="text-sm text-charcoal-500 dark:text-cream-400 mt-2"
            >Recommended for a personalized touch</span
          >
        </button>

        <!-- Path B: Document Upload -->
        <div class="relative">
          <button
            onclick={() =>
              document.getElementById("wizard-file-upload").click()}
            class="w-full h-full border rounded-xl p-6 flex flex-col items-center justify-center text-center transition-all {creationPath ===
            'upload'
              ? 'border-primary bg-primary/5 dark:bg-primary/10 ring-2 ring-primary'
              : 'border-cream-300 dark:border-charcoal-600 bg-white dark:bg-surface-dark hover:border-primary/50 dark:hover:border-primary/50'}"
          >
            <span
              class="material-symbols-outlined text-4xl mb-3 {creationPath ===
              'upload'
                ? 'text-primary dark:text-secondary'
                : 'text-charcoal-400 dark:text-cream-500'}">upload_file</span
            >
            <span
              class="font-medium text-text-light dark:text-text-dark text-lg"
              >Upload Document</span
            >
            <span class="text-sm text-charcoal-500 dark:text-cream-400 mt-2"
              >Skip questions and extract from PDF/DOCX</span
            >
          </button>
          <input
            type="file"
            id="wizard-file-upload"
            class="hidden"
            accept=".pdf,.docx,.txt"
            onchange={handleFileSelect}
          />
        </div>
      </div>

      {#if creationPath === "upload" && uploadedFileInfo}
        <div
          class="mt-6 p-4 bg-secondary/10 dark:bg-secondary/20 text-secondary dark:text-secondary border border-secondary/30 dark:border-secondary/40 rounded-xl flex items-center justify-between"
        >
          <div class="flex items-center gap-3">
            <span class="material-symbols-outlined text-2xl">draft</span>
            <div>
              <p class="font-medium text-base">{uploadedFileInfo.name}</p>
              <p class="text-sm opacity-80">Ready to train replica instantly</p>
            </div>
          </div>
          <button
            onclick={clearFile}
            class="text-red-500 hover:text-red-700 font-medium text-sm px-3 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >Remove</button
          >
        </div>
      {/if}
    </div>

    <!-- Information Box -->
    <div
      class="bg-primary/5 dark:bg-primary/10 border border-primary/20 dark:border-primary/30 rounded-xl p-5"
    >
      <div class="flex gap-4">
        <svg
          class="flex-shrink-0 h-6 w-6 text-primary dark:text-secondary mt-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          ></path>
        </svg>
        <div>
          <h3 class="font-medium text-text-light dark:text-text-dark text-base">
            About the Creation Process
          </h3>
          <div
            class="mt-2 text-sm text-charcoal-700 dark:text-cream-300 leading-relaxed"
          >
            <p>
              Creating a high-quality AI replica requires detailed information
              about your personality, thoughts, and communication style. The
              next steps will guide you through questions designed to capture
              your unique characteristics and help build an AI that truly
              represents you.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
