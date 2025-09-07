<script>
  import { createEventDispatcher } from 'svelte';
  import WebSearchButton from './WebSearchButton.svelte';

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
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
  });

  function handleSubmit(event) {
    event.preventDefault();
    
    const trimmedValue = value.trim();
    if (!trimmedValue || isSubmitting) return;
    
    isSubmitting = true;
    
  // Dispatch the send event using standard Svelte event
  dispatch('send', { text: trimmedValue });
    
    // Clear input
    value = '';
    
    // Reset submitting state
    setTimeout(() => {
      isSubmitting = false;
    }, 100);
    
    // Focus textarea
    textarea?.focus();
  }

  function handleKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
  }

  function handleWebSearchToggle(event) {
    // This will be handled by the parent component
  }
</script>

<div class="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 transition-colors duration-200">
  <!-- Web search indicator -->
  {#if webSearchActive}
    <div class="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
      <div class="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
        </svg>
        Web search enabled - your message will include web results
      </div>
    </div>
  {/if}

  <form onsubmit={handleSubmit} class="p-4">
    <div class="flex gap-3 items-end">
      <!-- Message input -->
      <div class="flex-1 relative">
        <textarea
          bind:this={textarea}
          bind:value
          onkeydown={handleKeydown}
          placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
          class="w-full resize-none rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors duration-200 min-h-[48px] max-h-[120px]"
          rows="1"
          disabled={isSubmitting}
        ></textarea>
        
        <!-- Character count (optional) -->
        {#if value.length > 0}
          <div class="absolute -top-6 right-0 text-xs text-gray-400 dark:text-gray-500">
            {value.length}
          </div>
        {/if}
      </div>

      <!-- Send button -->
      <button
        type="submit"
        disabled={!value.trim() || isSubmitting}
        class="px-4 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:dark:bg-gray-600 text-white font-medium transition-all duration-200 flex items-center gap-2 min-w-[80px] justify-center"
        class:opacity-50={!value.trim() || isSubmitting}
        class:cursor-not-allowed={!value.trim() || isSubmitting}
      >
        {#if isSubmitting}
          <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        {:else}
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
          </svg>
        {/if}
        Send
      </button>
    </div>
  </form>
</div>