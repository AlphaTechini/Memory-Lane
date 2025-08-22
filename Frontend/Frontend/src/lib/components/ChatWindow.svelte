<script>
  import { afterUpdate } from 'svelte';
  import MessageBubble from './MessageBubble.svelte';

  /** @type {{id: string, sender: 'user' | 'bot', text: string, ts: number, meta?: any}[]} */
  export let messages = [];

  let chatContainer;
  let autoScroll = true;

  function scrollToBottom() {
    if (chatContainer && autoScroll) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }

  function handleScroll() {
    if (!chatContainer) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainer;
    // Disable auto-scroll if user scrolls up
    autoScroll = scrollHeight - scrollTop - clientHeight < 1;
  }

  afterUpdate(() => {
    scrollToBottom();
    autoScroll = true; // Re-enable auto-scroll on new message
  });
</script>

<div
  bind:this={chatContainer}
  on:scroll={handleScroll}
  class="flex-grow p-4 space-y-4 overflow-y-auto"
  role="log"
>
  {#each messages as message (message.id)}
    <MessageBubble {message} />
  {/each}
</div>
