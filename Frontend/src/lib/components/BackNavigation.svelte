<script>
  import { goto } from "$app/navigation";

  let {
    showBack = true,
    showHome = true,
    customBackAction = null,
    title = null,
    subtitle = null,
  } = $props();

  function goBack() {
    if (customBackAction) {
      customBackAction();
    } else {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        goto("/dashboard");
      }
    }
  }

  function goHome() {
    goto("/dashboard");
  }
</script>

<div
  class="flex items-center justify-between bg-cream-50/80 dark:bg-charcoal-900/80 backdrop-blur-sm border-b border-cream-200 dark:border-charcoal-700 px-6 py-3 mb-6 shadow-sm sticky top-0 z-10"
>
  <div class="flex items-center gap-6">
    {#if showBack}
      <button
        onclick={goBack}
        class="w-10 h-10 flex items-center justify-center rounded-xl bg-white text-primary border border-cream-200 shadow-sm hover:shadow-md hover:bg-cream-50 active:scale-95 transition-all duration-200 group"
        title="Go back"
        aria-label="Go back to previous page"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="group-hover:-translate-x-0.5 transition-transform"
          aria-hidden="true"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>
    {/if}

    {#if title}
      <div class="flex flex-col">
        <h1
          class="text-xl font-bold text-charcoal-800 dark:text-cream-100 font-display"
        >
          {title}
        </h1>
        {#if subtitle}
          <p
            class="text-xs font-medium text-charcoal-600/70 dark:text-cream-300/70 uppercase tracking-tight"
          >
            {subtitle}
          </p>
        {/if}
      </div>
    {/if}
  </div>

  {#if showHome}
    <button
      onclick={goHome}
      class="w-10 h-10 flex items-center justify-center rounded-xl bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary-hover active:scale-95 transition-all duration-200 group"
      title="Go to Home"
      aria-label="Go to Home"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="group-hover:scale-110 transition-transform"
        aria-hidden="true"
      >
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9,22 9,12 15,12 15,22" />
      </svg>
    </button>
  {/if}
</div>
