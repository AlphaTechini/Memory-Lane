<script>
  import { createEventDispatcher } from 'svelte';
  import VoiceRecorder from './VoiceRecorder.svelte';

  let { 
    webSearchActive = false
  } = $props();

  const dispatch = createEventDispatcher();
  
  let value = $state('');
  let textarea = $state();
  let isSubmitting = $state(false);

  // Auto-resize textarea
  $effect(() => {
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
    }
  });

  function handleSubmit(event) {
    event.preventDefault();
    
    const trimmedValue = value.trim();
    if (!trimmedValue || isSubmitting) return;
    
    isSubmitting = true;
    dispatch('send', { text: trimmedValue });
    value = '';
    
    setTimeout(() => {
      isSubmitting = false;
    }, 100);
    
    textarea?.focus();
  }

  function handleKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
  }

  // Handle voice recording result
  function handleVoiceRecorded(event) {
    // For now, we'll just show that voice was recorded
    // In a full implementation, this would send to speech-to-text API
    console.log('Voice recorded:', event.detail);
    // Could dispatch a voice message event here
  }
</script>

<div class="border-t-2 border-cream-300 dark:border-charcoal-600 bg-cream-50 dark:bg-charcoal-800 transition-colors duration-200">
  <!-- Web search indicator -->
  {#if webSearchActive}
    <div class="px-4 py-3 bg-teal-500/10 border-b-2 border-teal-500/30">
      <div class="flex items-center gap-3 text-accessible-base text-teal-700 dark:text-teal-300">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
        </svg>
        <span class="font-medium">Web search is on - your message will include web results</span>
      </div>
    </div>
  {/if}

  <form onsubmit={handleSubmit} class="p-4">
    <div class="flex gap-3 items-end">
      <!-- Voice Input Button - Prominent, large touch target -->
      <div class="flex-shrink-0">
        <VoiceRecorder onrecorded={handleVoiceRecorded} />
      </div>

      <!-- Message input - Large, accessible -->
      <div class="flex-1 relative">
        <label for="message-input" class="sr-only">Type your message</label>
        <textarea
          id="message-input"
          bind:this={textarea}
          bind:value
          onkeydown={handleKeydown}
          placeholder="Type a message or tap the microphone to speak..."
          class="input-accessible w-full resize-none min-h-[56px] max-h-[150px] text-accessible-base"
          rows="1"
          disabled={isSubmitting}
          aria-describedby="input-help"
        ></textarea>
        <p id="input-help" class="sr-only">Press Enter to send, Shift+Enter for new line</p>
      </div>

      <!-- Send button - Large, tactile -->
      <button
        type="submit"
        disabled={!value.trim() || isSubmitting}
        class="btn-tactile btn-tactile-primary min-w-[100px] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
        aria-label={isSubmitting ? 'Sending message...' : 'Send message'}
      >
        {#if isSubmitting}
          <svg class="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        {:else}
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
          </svg>
        {/if}
        <span class="font-semibold">Send</span>
      </button>
    </div>
  </form>
</div>
