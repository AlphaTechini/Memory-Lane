<script>
  import { browser } from '$app/environment';

  /**
   * @type {import('$lib/stores/chat.js').Message[]}
   */
  let { messages = [] } = $props();

  let chatContainer;

  // Reactive auto-scroll when messages change
  $effect(() => {
    // By reading `messages` here, we ensure the effect re-runs when they change.
    // The effect runs *after* the DOM has updated, so we can safely scroll.
    messages;
    if (!browser || !chatContainer) return;

    chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
  });
</script>

<div bind:this={chatContainer} class="flex-1 overflow-y-auto p-4 space-y-4 bg-white dark:bg-gray-800">
  {#if messages.length === 0}
    <div class="flex justify-center items-center h-full">
      <p class="text-gray-500">Select a conversation or start a new one.</p>
    </div>
  {/if}
  {#each messages as message, i (message.id ?? i)}
    <div
      class="flex items-end"
      class:justify-end={message.sender === 'user'}
      class:justify-start={message.sender !== 'user'}
    >
      <div
        class="max-w-xs md:max-w-md lg:max-w-2xl px-4 py-2 rounded-lg"
        class:bg-blue-500={message.sender === 'user'}
        class:text-white={message.sender === 'user'}
        class:bg-gray-200={message.sender !== 'user'}
        class:dark:bg-gray-700={message.sender !== 'user'}
        class:dark:text-gray-200={message.sender !== 'user'}
      >
        <p class="text-sm">{message.text}</p>
      </div>
    </div>
  {/each}
</div>