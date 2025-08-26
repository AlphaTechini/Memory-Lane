<script>
  import { dispatch } from 'svelte/events';
  import { webSearchActive, webSearchAllowed, activeConversationId, setWebSearchAllowed } from '$lib/stores/chat.js';

  let text = '';
  let textarea;

  // Enable web-search for the active conversation as soon as user types in the box
  function handleInput() {
    if ($activeConversationId && !$webSearchAllowed[$activeConversationId]) {
      setWebSearchAllowed($activeConversationId, true);
    }
  }

  function send() {
    if (text.trim()) {
      dispatch('send', { text: text.trim() });
      text = '';
      textarea.focus();
    }
  }

  function handleKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  }
</script>

<!-- Make input area shrink-0 so it stays visible at the bottom; padding adjusts on small screens -->
<div class="p-4 bg-white/50 backdrop-blur-sm shrink-0">
  <div class="relative">
    <textarea
      bind:this={textarea}
      bind:value={text}
      on:input={handleInput}
      on:keydown={handleKeydown}
      rows="1"
      placeholder="Chat with Sensai..."
      class="w-full p-3 pr-12 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
    ></textarea>
    <button
      on:click={send}
      disabled={!text.trim()}
      class="absolute right-2 bottom-2 p-2 rounded-lg transition"
      class:bg-blue-500={text.trim()}
      class:text-white={text.trim()}
      class:bg-gray-200={!text.trim()}
      class:text-gray-400={!text.trim()}
      class:cursor-not-allowed={!text.trim()}
      class:hover:bg-blue-600={text.trim()}
      aria-label="Send message"
    >
      <!-- rotate the existing icon to point right instead of up -->
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 transform rotate-90" viewBox="0 0 20 20" fill="currentColor">
        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
      </svg>
    </button>
  </div>

  <div class="mt-2 flex justify-start">
    {#if $activeConversationId}
      {#if $webSearchAllowed[$activeConversationId]}
        <button
          on:click={() => webSearchActive.update((v) => !v)}
          class="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition border"
          class:bg-blue-500={$webSearchActive}
          class:text-white={$webSearchActive}
          class:border-blue-500={$webSearchActive}
          class:bg-transparent={!$webSearchActive}
          class:text-gray-600={!$webSearchActive}
          class:border-gray-300={!$webSearchActive}
          class:hover:bg-gray-100={!$webSearchActive}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c1.355 0 2.707-.157 4.018-.452M12 21c-1.355 0-2.707-.157-4.018-.452M12 3a9.004 9.004 0 00-8.716 6.747M12 3a9.004 9.004 0 018.716 6.747M12 3c1.355 0 2.707.157 4.018-.452M12 3c-1.355 0-2.707-.157-4.018-.452M12 12a3 3 0 100-6 3 3 0 000 6z" />
          </svg>
          <span>Web Search</span>
        </button>
      {:else}
        <button
          disabled
          class="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition border bg-gray-200 text-gray-400 pointer-events-none"
          aria-disabled="true"
          title="Web Search will be enabled after you start typing"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c1.355 0 2.707-.157 4.018-.452M12 21c-1.355 0-2.707-.157-4.018-.452M12 3a9.004 9.004 0 00-8.716 6.747M12 3a9.004 9.004 0 018.716 6.747M12 3c1.355 0 2.707.157 4.018-.452M12 3c-1.355 0-2.707-.157-4.018-.452M12 12a3 3 0 100-6 3 3 0 000 6z" />
          </svg>
          <span>Web Search</span>
        </button>
      {/if}
    {/if}
  </div>
</div>