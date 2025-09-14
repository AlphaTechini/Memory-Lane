<!-- src/lib/components/SidebarContent.svelte -->
<script>
  import { goto } from '$app/navigation';

  let {
    conversationsList = [],
    activeId = null,
    onselect,
    onnew,
    onclear
  } = $props();
</script>

<!-- Dashboard Button -->
<div class="mb-4">
  <button
  on:click={() => goto('/dashboard')}
    class="w-full flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-lg font-medium transition-all duration-200 shadow-sm hover:shadow-md"
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      <rect x="9" y="9" width="6" height="6"/>
      <path d="M9 3v6"/>
      <path d="M21 9h-6"/>
      <path d="M21 15h-6"/>
      <path d="M15 15v6"/>
      <path d="M9 15v6"/>
    </svg>
    Dashboard
  </button>
</div>

<div class="flex items-center justify-between mb-2">
  <div class="font-semibold text-gray-900 dark:text-gray-200">Conversations</div>
  <button class="p-1 rounded-md text-gray-600 hover:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-700 transition-colors" on:click={onnew} aria-label="New conversation">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-plus"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
  </button>
</div>

<div class="flex-1 overflow-y-auto -mr-2 pr-2 mb-4">
  {#each conversationsList as conversation (conversation.id)}
    <button
      class="w-full text-left p-2 rounded-md truncate text-gray-700 dark:text-gray-300 transition-colors {activeId === conversation.id ? 'bg-blue-100 text-blue-800 font-semibold dark:bg-blue-900 dark:text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}"
  on:click={() => onselect?.({ detail: { id: conversation.id } })}
    >
      {conversation.title}
    </button>
  {/each}
  
  {#if conversationsList.length === 0}
    <div class="text-center py-8 text-gray-500 dark:text-gray-400">
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-2 opacity-50">
        <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
      </svg>
      <p class="text-sm">No conversations yet</p>
      <p class="text-xs mt-1">Start a new chat to begin</p>
    </div>
  {/if}
</div>

<div class="mt-auto pt-2 border-t border-gray-200 dark:border-gray-700">
  <button
  on:click={onclear}
    class="w-full text-left p-2 rounded-md hover:bg-red-100 text-red-600 dark:text-red-400 dark:hover:bg-red-900/50 flex items-center gap-2 transition-colors"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="lucide lucide-trash-2"
      ><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path
        d="M10 11v6"
      /><path d="M14 11v6" /></svg
    >
    Clear conversations
  </button>
</div>