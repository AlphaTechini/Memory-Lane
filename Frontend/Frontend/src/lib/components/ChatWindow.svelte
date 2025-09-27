<script>
  import { browser } from '$app/environment';
  import MessageBubble from './MessageBubble.svelte';

  let { messages = [], suggestedQuestions = [], onQuestionSelect } = $props();

  let chatContainer = $state();

  // Auto-scroll when messages change (Svelte 5 style)
  $effect(() => {
    // Reading messages here makes the effect reactive to changes
    messages;
    
    if (!browser || !chatContainer) return;

    // Use requestAnimationFrame to ensure DOM is updated
    requestAnimationFrame(() => {
      if (chatContainer) {
        chatContainer.scrollTo({ 
          top: chatContainer.scrollHeight, 
          behavior: 'smooth' 
        });
      }
    });
  });
</script>

<div 
  bind:this={chatContainer} 
  class="flex-1 overflow-y-auto p-4 space-y-4 bg-white dark:bg-gray-800 min-h-0 transition-colors duration-200"
>
  {#if messages.length === 0}
    <div class="flex justify-center items-center h-full">
      <div class="text-center">
        <div class="mb-4">
          <svg class="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
          </svg>
        </div>
        <p class="text-gray-500 dark:text-gray-400 text-lg">Start a conversation</p>
        <p class="text-gray-400 dark:text-gray-500 text-sm mt-2">Type a message below to begin</p>
      </div>
    </div>
  {:else}
    {#each messages as message, i (message.id ?? i)}
      <MessageBubble {message} />
    {/each}
    
    <!-- Show suggested questions only if there are very few messages (like just a greeting) -->
    {#if suggestedQuestions.length > 0 && messages.length <= 2 && onQuestionSelect}
      <div class="mt-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
        <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Suggested questions:</h4>
        <div class="space-y-2">
          {#each suggestedQuestions as question (question)}
            <button
              onclick={() => onQuestionSelect(question)}
              class="w-full text-left px-3 py-2 text-sm bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md hover:bg-gray-100 dark:hover:bg-gray-500 transition-colors duration-200 text-gray-700 dark:text-gray-200"
            >
              {question}
            </button>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</div>