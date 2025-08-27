<script>
  import { webSearchActive } from '$lib/stores/chat.js';

  let text = $state('');

  // The 'onsend' prop is a callback function passed from the parent.
  let { onsend } = $props();

  function send() {
    const trimmedText = text.trim();
    // FIX: Only send the message and clear the input if the text is not empty.
    if (trimmedText) {
      // The parent component expects an event-like object with a `detail` property.
      onsend({ detail: { text: trimmedText } });
      text = '';
    }
  }

  function handleKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  }
</script>

<div class="p-4 sm:px-6 border-t border-gray-200 dark:border-gray-700">
  <form on:submit|preventDefault={send} class="flex items-center gap-4">
    <textarea
      bind:value={text}
      on:keydown={handleKeydown}
      class="flex-1 p-2 border rounded-md resize-none bg-white dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
      placeholder="Type a message..."
      rows="1"
    ></textarea>
    <label class="flex items-center gap-1 text-sm dark:text-gray-300">
      <input type="checkbox" bind:checked={$webSearchActive} />
      Web Search
    </label>
    <button type="submit" class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-blue-300" disabled={!text.trim()}>Send</button>
  </form>
</div>