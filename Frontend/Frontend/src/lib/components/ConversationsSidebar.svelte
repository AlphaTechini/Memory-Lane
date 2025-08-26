<script>
  /** @type {{id: string, title: string, lastUpdated: number}[]} */
  /** @type {string|null} */
  // Svelte 5 callback props
  let { 
    conversationsList = [], 
    activeId = null, 
    onselect, 
    onnew 
  } = $props();

  function handleSelect(id) {
    onselect?.({ id });
  }

  function handleNew() {
    onnew?.();
  }

  function formatTimestamp(ts) {
    const date = new Date(ts);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  // Safety helpers for global actions (no local state duplication)
  function toggleDarkMode() {
    if (globalThis.appSettings && typeof globalThis.appSettings.darkMode !== 'undefined') {
      globalThis.appSettings.darkMode = !globalThis.appSettings.darkMode;
    }
  }

  function clearConversations() {
    if (globalThis.appSettings && typeof globalThis.appSettings.clearConversations === 'function') {
      globalThis.appSettings.clearConversations();
    }
  }

  function exportChat() {
    if (globalThis.appSettings && typeof globalThis.appSettings.exportChat === 'function') {
      globalThis.appSettings.exportChat();
    }
  }

  function deleteAccount() {
    if (globalThis.appSettings && typeof globalThis.appSettings.deleteAccount === 'function') {
      globalThis.appSettings.deleteAccount();
    }
  }
</script>

<aside
  role="navigation"
  aria-label="Conversations"
  class="bg-neutral-100/50 w-72 p-2 h-full hidden md:flex flex-col"
>
  <button
    onclick={handleNew}
    class="w-full text-left p-2 mb-2 rounded-lg hover:bg-neutral-200 transition focus:outline-none focus:ring-2 focus:ring-blue-400"
  >
    + New Chat
  </button>

  <div class="flex-grow overflow-y-auto pr-1">
    {#each conversationsList as conversation (conversation.id)}
      <button
        onclick={() => handleSelect(conversation.id)}
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

  <!-- Settings area: uses globalThis.appSettings for all actions (no duplicate local state) -->
  <div class="mt-2 pt-2 border-t space-y-2">
    <button
      onclick={toggleDarkMode}
      class="w-full flex items-center justify-between p-2 rounded-lg hover:bg-neutral-200 transition focus:outline-none focus:ring-2 focus:ring-blue-400"
      aria-pressed={globalThis.appSettings?.darkMode ?? false}
    >
      <span class="text-sm">Dark Mode</span>
      <span class="text-xs text-gray-500">{globalThis.appSettings?.darkMode ? 'On' : 'Off'}</span>
    </button>

    <button
      onclick={clearConversations}
      class="w-full text-left p-2 rounded-lg hover:bg-neutral-200 transition focus:outline-none focus:ring-2 focus:ring-blue-400"
    >
      Clear Conversations
    </button>

    <button
      onclick={exportChat}
      class="w-full text-left p-2 rounded-lg hover:bg-neutral-200 transition focus:outline-none focus:ring-2 focus:ring-blue-400"
    >
      Export Chat
    </button>

    <button
      onclick={deleteAccount}
      class="w-full text-left p-2 rounded-lg text-red-600 hover:bg-red-50 transition focus:outline-none focus:ring-2 focus:ring-red-200"
    >
      Delete Account
    </button>
  </div>
</aside>