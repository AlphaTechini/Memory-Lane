<script>
  import { theme, toggleTheme } from "$lib/stores/chat.js";

  let isDark = $derived($theme === "dark");
</script>

<button
  onclick={toggleTheme}
  class="flex items-center justify-center w-10 h-10 rounded-lg border border-white/20 hover:bg-white/10 transition-all duration-200"
  aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
  aria-pressed={isDark}
  title={isDark ? "Switch to light mode" : "Switch to dark mode"}
>
  {#if isDark}
    <!-- Sun icon for light mode -->
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="white"
      stroke="#0F2C59"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  {:else}
    <!-- Moon icon for dark mode -->
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="white"
      stroke="#0F2C59"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  {/if}
</button>
