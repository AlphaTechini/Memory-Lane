<script>
  let { message } = $props();

  const isUser = $derived(message.sender === 'user');
  const hasWebSearch = $derived(message.meta?.webSearch === true);
</script>

<div class="flex" class:justify-end={isUser} class:justify-start={!isUser}>
  <div
    class="p-3 rounded-2xl max-w-[80%] shadow-sm"
    class:bg-gray-200={isUser}
    class:bg-white={!isUser}
  >
    <p class="whitespace-pre-wrap">{message.text}</p>
    {#if hasWebSearch}
      <div class="mt-2 flex items-center">
        <span class="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
          Web Search
        </span>
      </div>
    {/if}
  </div>
</div>