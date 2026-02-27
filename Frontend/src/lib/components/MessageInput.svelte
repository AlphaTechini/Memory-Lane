<script>
  import { createEventDispatcher } from "svelte";
  import VoiceRecorder from "./VoiceRecorder.svelte";

  let { webSearchActive = false } = $props();

  const dispatch = createEventDispatcher();

  let value = $state("");
  let textarea = $state();
  let isSubmitting = $state(false);

  // Auto-resize textarea
  $effect(() => {
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 150) + "px";
    }
  });

  function handleSubmit(event) {
    event.preventDefault();

    const trimmedValue = value.trim();
    if (!trimmedValue || isSubmitting) return;

    isSubmitting = true;
    dispatch("send", { text: trimmedValue });
    value = "";

    setTimeout(() => {
      isSubmitting = false;
    }, 100);

    textarea?.focus();
  }

  function handleKeydown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
  }

  // Handle voice recording result
  function handleVoiceRecorded(event) {
    // For now, we'll just show that voice was recorded
    // In a full implementation, this would send to speech-to-text API
    console.log("Voice recorded:", event.detail);
    // Could dispatch a voice message event here
  }
</script>

<div class="flex-1 w-full bg-transparent">
  <!-- Web search indicator -->
  {#if webSearchActive}
    <div
      class="px-4 py-3 bg-teal-500/10 border-b-2 border-teal-500/30 w-full mb-2 rounded-xl"
    >
      <div
        class="flex items-center gap-3 text-accessible-base text-teal-700 dark:text-teal-300"
      >
        <svg
          class="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          ></path>
        </svg>
        <span class="font-medium"
          >Web search is on - your message will include web results</span
        >
      </div>
    </div>
  {/if}

  <form onsubmit={handleSubmit} class="flex items-end gap-2 w-full">
    <!-- Message input - Large, accessible -->
    <div class="flex-1 relative">
      <textarea
        bind:this={textarea}
        bind:value
        onkeydown={handleKeydown}
        placeholder="Type your message..."
        class="w-full bg-transparent text-slate-800 dark:text-cream-50 placeholder-slate-400 dark:placeholder-charcoal-400 border-none focus:ring-0 resize-none max-h-32 min-h-[44px] py-3 text-base leading-relaxed"
        rows="1"
        disabled={isSubmitting}
      ></textarea>
    </div>

    <!-- Voice Input Button - Prominent, large touch target -->
    <div
      class="flex-shrink-0 flex items-center gap-2 mb-1.5 pl-2 border-l border-slate-200 dark:border-charcoal-600"
    >
      <VoiceRecorder onrecorded={handleVoiceRecorded} />

      <!-- Send button -->
      <button
        type="submit"
        disabled={!value.trim() || isSubmitting}
        class="w-10 h-10 rounded-full bg-primary hover:bg-primary/90 text-white flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95 disabled:hover:scale-100"
        aria-label={isSubmitting ? "Sending message..." : "Send message"}
      >
        {#if isSubmitting}
          <svg
            class="w-5 h-5 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            ></circle>
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        {:else}
          <span class="material-symbols-outlined text-xl">send</span>
        {/if}
      </button>
    </div>
  </form>
</div>
