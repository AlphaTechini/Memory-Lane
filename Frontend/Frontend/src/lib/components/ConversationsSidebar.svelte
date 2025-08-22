<script>
  import { createEventDispatcher } from 'svelte';

  /** @type {{id: string, title: string, lastUpdated: number}[]} */
  export let conversationsList = [];
  /** @type {string|null} */
  export let activeId = null;

  const dispatch = createEventDispatcher();

  function handleSelect(id) {
    dispatch('select', { id });
  }

  function handleNew() {
    dispatch('new');
  }

  function formatTimestamp(ts) {
    const date = new Date(ts);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
</script>

<aside
  role="navigation"
  aria-label="Conversations"
  class="bg-neutral-100/50 w-72 p-2 flex-col h-full hidden md:flex"
>
  <button
    on:click={handleNew}
    class="w-full text-left p-2 mb-2 rounded-lg hover:bg-neutral-200 transition focus:outline-none focus:ring-2 focus:ring-blue-400"
  >
    + New Chat
  </button>

  <div class="flex-grow overflow-y-auto pr-1">
    {#each conversationsList as conversation (conversation.id)}
      <button
        on:click={() => handleSelect(conversation.id)}
        class="w-full text-left p-2 my-1 rounded-lg transition truncate focus:outline-none focus:ring-2 focus:ring-blue-400"
        class:bg-blue-100={activeId === conversation.id}
        class:hover:bg-neutral-200={activeId !== conversation.id}
        aria-current={activeId === conversation.id ? 'page' : 'false'}
      >
        <div class="font-medium text-sm truncate">{conversation.title}</div>
        <div class="text-xs text-gray-500">{formatTimestamp(conversation.lastUpdated)}</div>
      </button>
    {/each}
  </div>
</aside>
