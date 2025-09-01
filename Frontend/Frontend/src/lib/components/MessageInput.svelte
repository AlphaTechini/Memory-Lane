<script>
  import { createEventDispatcher } from 'svelte';
  import VoiceRecorder from './VoiceRecorder.svelte';
  import WebSearchButton from './WebSearchButton.svelte';
  import { webSearchActive } from '$lib/stores/chat.js';

  const dispatch = createEventDispatcher();

  let { 
    disabled = false,
    onsend 
  } = $props();

  let value = $state('');
  let isSubmitting = $state(false);
  let textareaElement = $state(null);

  function handleSubmit(event) {
    event.preventDefault();
    if (!value.trim() || isSubmitting) return;
    
    isSubmitting = true;

    const payload = { text: value.trim() };

    // Backwards-compatible callback prop (if provided)
    onsend?.(payload);
    // Dispatch Svelte event so parents using on:send receive it
    dispatch('send', payload);

    value = '';
    
    setTimeout(() => {
      isSubmitting = false;
      textareaElement?.focus();
    }, 100);
  }

  function handleKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
  }

  function handleVoiceRecorded(audioData) {
    const transcription = `[Voice message - ${Math.floor(audioData.duration)}s]`;
    const payload = { 
      text: transcription,
      audio: {
        url: audioData.url,
        blob: audioData.blob,
        duration: audioData.duration
      }
    };

    onsend?.(payload);
    dispatch('send', payload);
  }

  function handleWebSearchToggle(event) {
    webSearchActive.set(event.active);
  }

  // Auto-resize textarea
  function autoResize() {
    if (textareaElement) {
      textareaElement.style.height = 'auto';
      textareaElement.style.height = Math.min(textareaElement.scrollHeight, 120) + 'px';
    }
  }

  $effect(() => {
    value; // Track value changes
    autoResize();
  });
</script>

<div class="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
  <!-- Web Search Toggle -->
  <div class="mb-3 flex justify-start">
    <WebSearchButton 
      active={$webSearchActive}
      disabled={disabled || isSubmitting}
      ontoggle={handleWebSearchToggle}
    />
  </div>

  <!-- Message Input Form -->
  <form onsubmit={handleSubmit} class="flex items-end gap-2">
    <div class="flex-1 relative">
      <textarea
        bind:this={textareaElement}
        bind:value
        onkeydown={handleKeydown}
        oninput={autoResize}
        placeholder="Type a message..."
        disabled={disabled || isSubmitting}
        class="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 disabled:opacity-50 transition-all"
        style="min-height: 44px; max-height: 120px; overflow-y: auto;"
      ></textarea>
    </div>

    <!-- Voice Recorder -->
    <VoiceRecorder 
      disabled={disabled || isSubmitting}
      onrecorded={handleVoiceRecorded}
    />

    <!-- Send Button -->
    <button
      type="submit"
      disabled={!value.trim() || disabled || isSubmitting}
      class="p-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300"
      aria-label="Send message"
    >
      {#if isSubmitting}
        <!-- Loading spinner -->
        <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      {:else}
        <!-- Send icon -->
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m22 2-7 20-4-9-9-4Z"/>
          <path d="M22 2 11 13"/>
        </svg>
      {/if}
    </button>
  </form>
</div>