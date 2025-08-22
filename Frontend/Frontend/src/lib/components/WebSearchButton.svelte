<script>
  import { dispatch } from 'svelte';

  /** @type {boolean} */
  export let active = false;
  /** @type {boolean} */
  export let disabled = false;

  function handleClick() {
    if (disabled) return;
    dispatch('toggle', { active: !active });
  }
</script>

<button
  aria-pressed={active}
  aria-disabled={disabled}
  disabled={disabled}
  on:click={handleClick}
  class="px-3 py-1.5 text-sm font-medium rounded-lg transition focus:outline-none focus:ring-2 focus:ring-offset-2"
  class:bg-blue-100={active}
  class:text-blue-800={active}
  class:ring-blue-400={active}
  class:bg-neutral-200={!active && !disabled}
  class:text-neutral-700={!active && !disabled}
  class:hover:bg-neutral-300={!active && !disabled}
  class:opacity-50={disabled}
  class:pointer-events-none={disabled}
  class:bg-gray-200={disabled}
  class:text-gray-400={disabled}
>
  Web Search
</button>

