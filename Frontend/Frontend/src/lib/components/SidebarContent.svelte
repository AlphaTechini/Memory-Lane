<script>
  let {
    conversationsList = [],
    activeId = null,
    onselect,
    onnew,
    onclear
  } = $props();
</script>

<div class="flex items-center justify-between mb-2">
  <div class="font-semibold text-gray-900 dark:text-gray-200">Conversations</div>
  <button class="p-1 rounded-md text-gray-600 hover:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-700" onclick={onnew} aria-label="New conversation">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-plus"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
  </button>
</div>
<div class="flex-1 overflow-y-auto -mr-2 pr-2">
  {#each conversationsList as conversation (conversation.id)}
    <button
      class="w-full text-left p-2 rounded-md truncate text-gray-700 dark:text-gray-300 {activeId === conversation.id ? 'bg-blue-100 text-blue-800 font-semibold dark:bg-blue-900 dark:text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}"
      onclick={() => onselect?.({ detail: { id: conversation.id } })}
    >
      {conversation.title}
    </button>
  {/each}
</div>
<div class="mt-auto pt-2 border-t border-gray-200 dark:border-gray-700">
  <button
    onclick={onclear}
    class="w-full text-left p-2 rounded-md hover:bg-red-100 text-red-600 dark:text-red-500 dark:hover:bg-red-900/50 flex items-center gap-2"
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
