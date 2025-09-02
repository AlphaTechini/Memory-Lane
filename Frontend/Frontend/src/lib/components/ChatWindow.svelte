<script>
  import { browser } from '$app/environment';
  import MessageBubble from './MessageBubble.svelte';

  let { messages = [] } = $props();

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
  {/if}
</div>