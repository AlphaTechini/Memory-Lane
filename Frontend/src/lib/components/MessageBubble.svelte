<script>
  import { fly } from "svelte/transition";
  import { formatTimestamp } from "$lib/utils/formatDate.js";

  let { message } = $props();

  let isUser = $derived(message?.sender === "user");
  let hasWebSearch = $derived(message?.meta?.webSearch === true);
</script>

<!-- Accessible chat layout: user messages right, bot messages left -->
<div
  class="flex w-full"
  class:justify-end={isUser}
  class:justify-start={!isUser}
>
  <div
    in:fly={{ x: isUser ? 40 : -40, duration: 250 }}
    class="max-w-[85%] sm:max-w-[75%] md:max-w-[65%]"
  >
    <!-- Message bubble - Tactile, readable -->
    <div
      class="max-w-full p-4 sm:p-5 rounded-2xl shadow-sm border border-cream-200 dark:border-charcoal-700 {isUser
        ? 'bg-primary dark:bg-primary-hover text-white rounded-br-none'
        : 'bg-surface-light dark:bg-surface-dark text-text-light dark:text-text-dark rounded-bl-none'}"
    >
      <!-- Message text - Large, readable -->
      <p class="whitespace-pre-wrap text-accessible-base leading-relaxed">
        {message.text}
      </p>

      <!-- Web search indicator -->
      {#if hasWebSearch}
        <div
          class="mt-3 pt-2 border-t border-current/20 flex items-center gap-2"
        >
          <svg
            class="w-5 h-5"
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
          <span class="text-accessible-sm font-medium opacity-80"
            >Includes web search results</span
          >
        </div>
      {/if}
    </div>

    <!-- Timestamp - Clear, readable -->
    {#if message.timestamp}
      <div
        class="text-accessible-sm text-charcoal-600 dark:text-cream-400 mt-2 px-2"
        class:text-right={isUser}
        class:text-left={!isUser}
      >
        {formatTimestamp(message.timestamp)}
      </div>
    {/if}
  </div>
</div>
