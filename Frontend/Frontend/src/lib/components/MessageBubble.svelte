<script>
  import { fly } from 'svelte/transition';
  import { formatTimestamp } from '$lib/utils/formatDate.js';

  let { message } = $props();
  
  // Use Svelte 5 $derived for reactive values
  let isUser = $derived(message?.sender === 'user');
  let hasWebSearch = $derived(message?.meta?.webSearch === true);
</script>

<!-- Proper chat layout: user messages right, bot messages left -->
<div 
  class="flex w-full"
  class:justify-end={isUser}
  class:justify-start={!isUser}
>
  <div
    in:fly={{ x: isUser ? 60 : -60, duration: 300 }}
    class="max-w-[75%] sm:max-w-[65%] md:max-w-[55%] lg:max-w-[45%]"
  >
    <!-- Message bubble -->
    <div
      class="px-4 py-3 rounded-2xl shadow-sm break-words transition-all duration-200 border"
      class:bg-blue-500={isUser}
      class:text-white={isUser}
      class:border-blue-500={isUser}
      class:bg-gray-100={!isUser}
      class:dark:bg-gray-700={!isUser}
      class:border-gray-200={!isUser}
      class:dark:border-gray-600={!isUser}
      class:text-gray-900={!isUser}
      class:dark:text-gray-100={!isUser}
      class:rounded-br-md={isUser}
      class:rounded-bl-md={!isUser}
    >
      <p class="whitespace-pre-wrap text-sm leading-relaxed">{message.text}</p>
      
      <!-- Web search indicator -->
      {#if hasWebSearch}
        <div class="mt-2 flex items-center gap-1">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
          <span class="text-xs opacity-75 font-medium">Web Search</span>
        </div>
      {/if}
    </div>
    
    <!-- Timestamp (optional) -->
    {#if message.timestamp}
      <div 
        class="text-xs text-gray-400 dark:text-gray-500 mt-1 px-1"
        class:text-right={isUser}
        class:text-left={!isUser}
      >
        {#if message.timestamp}
          {formatTimestamp(message.timestamp)}
        {/if}
      </div>
    {/if}
  </div>
</div>