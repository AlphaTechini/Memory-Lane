<script>
  import { browser } from "$app/environment";
  import MessageBubble from "./MessageBubble.svelte";

  let {
    messages = [],
    suggestedQuestions = [],
    onQuestionSelect,
    contextHeader = "", // e.g., "You are chatting with Grandma's replica"
  } = $props();

  let chatContainer = $state();
  const AUTO_SCROLL_THRESHOLD = 150;

  function isNearBottom() {
    if (!chatContainer) return true;
    const distanceFromBottom =
      chatContainer.scrollHeight -
      (chatContainer.scrollTop + chatContainer.clientHeight);
    return distanceFromBottom <= AUTO_SCROLL_THRESHOLD;
  }

  $effect(() => {
    messages;
    if (!browser || !chatContainer) return;
    requestAnimationFrame(() => {
      if (!chatContainer) return;
      if (isNearBottom()) {
        chatContainer.scrollTo({
          top: chatContainer.scrollHeight,
          behavior: "smooth",
        });
      }
    });
  });
</script>

<div class="flex flex-col h-full bg-background-light dark:bg-background-dark">
  <!-- Contextual grounding header - Helps orient users -->
  {#if contextHeader}
    <div class="context-header m-4 mb-0">
      <p class="text-accessible-base font-medium">{contextHeader}</p>
    </div>
  {/if}

  <!-- Chat messages area -->
  <div
    bind:this={chatContainer}
    class="flex-1 overflow-y-auto p-4 space-y-4 min-h-0"
    role="log"
    aria-live="polite"
    aria-label="Chat messages"
  >
    {#if messages.length === 0}
      <!-- Empty state - Warm, inviting -->
      <div class="flex justify-center items-center h-full">
        <div class="text-center card-accessible max-w-md mx-auto">
          <div class="mb-6">
            <svg
              class="w-20 h-20 mx-auto text-primary dark:text-secondary opacity-80"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              ></path>
            </svg>
          </div>
          <h2
            class="text-accessible-xl font-bold text-text-light dark:text-text-dark mb-3"
          >
            Start a Conversation
          </h2>
          <p class="text-accessible-base text-gray-600 dark:text-gray-300">
            Type a message below or tap the microphone to speak
          </p>
        </div>
      </div>
    {:else}
      {#each messages as message, i (message.id ?? i)}
        <MessageBubble {message} />
      {/each}

      <!-- Suggested questions - Large, tappable buttons -->
      {#if suggestedQuestions.length > 0 && messages.length <= 2 && onQuestionSelect}
        <div class="mt-6 card-accessible">
          <h3
            class="text-accessible-lg font-semibold text-text-light dark:text-text-dark mb-4"
          >
            Suggested questions:
          </h3>
          <div class="space-y-3">
            {#each suggestedQuestions as question (question)}
              <button
                onclick={() => onQuestionSelect(question)}
                class="btn-tactile w-full text-left justify-start border border-cream-200 dark:border-charcoal-700 bg-surface-light dark:bg-surface-dark hover:border-primary transition-colors text-text-light dark:text-text-dark"
                <svg
                  class="w-5 h-5 flex-shrink-0 text-primary dark:text-secondary opacity-70"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span class="text-accessible-base">{question}</span>
              </button>
            {/each}
          </div>
        </div>
      {/if}
    {/if}
  </div>
</div>
