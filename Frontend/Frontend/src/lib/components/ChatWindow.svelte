<script>
  import { browser } from '$app/environment';
  import MessageBubble from './MessageBubble.svelte';

  /** @type {{id: string, sender: 'user' | 'bot', text: string, ts: number, meta?: any}[]} */
  let { messages = [] } = $props();

  let chatContainer;
  let autoScroll = true;

  function handleScroll() {
    if (!browser || !chatContainer) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainer;
    // Disable auto-scroll if user scrolls up
    autoScroll = scrollHeight - scrollTop - clientHeight < 1;
  }

  if (browser) {
    function scrollToBottom() {
      if (chatContainer && autoScroll) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }

    $effect(() => {
      // run when messages changes
      messages;
      scrollToBottom();
      autoScroll = true; // Re-enable auto-scroll on new message
    });
  }
</script>

<!-- Ensure this container can shrink and allow overflow-y scrolling (min-h-0) -->
<div
  bind:this={chatContainer}
  onscroll={handleScroll}
  class="flex-1 p-4 space-y-4 overflow-y-auto min-h-0"
  role="log"
>
  {#each messages as message (message.id)}
    <MessageBubble {message} />
  {/each}
</div>
