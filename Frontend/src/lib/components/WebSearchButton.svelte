<script>
  let { 
    active = false, 
    disabled = false, 
    ontoggle 
  } = $props();

  function handleClick() {
    if (disabled) return;
    ontoggle?.({ active: !active });
  }
</script>

<button
  aria-pressed={active}
  aria-disabled={disabled}
  disabled={disabled}
  onclick={handleClick}
  class="px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 flex items-center gap-2"
  class:bg-blue-100={active}
  class:text-blue-800={active}
  class:dark:bg-blue-900={active}
  class:dark:text-blue-200={active}
  class:bg-gray-200={!active && !disabled}
  class:dark:bg-gray-700={!active && !disabled}
  class:text-gray-700={!active && !disabled}
  class:dark:text-gray-200={!active && !disabled}
  class:hover:bg-gray-300={!active && !disabled}
  class:dark:hover:bg-gray-600={!active && !disabled}
  class:opacity-50={disabled}
  class:cursor-not-allowed={disabled}
  title={active ? 'Disable web search' : 'Enable web search'}
>
  <!-- Search icon -->
  <svg 
    class="w-4 h-4" 
    fill="none" 
    stroke="currentColor" 
    viewBox="0 0 24 24"
  >
    <path 
      stroke-linecap="round" 
      stroke-linejoin="round" 
      stroke-width="2" 
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
    ></path>
  </svg>
  
  <span>Web Search</span>
  
  <!-- Active indicator -->
  {#if active}
    <div class="w-2 h-2 bg-current rounded-full opacity-75"></div>
  {/if}
</button>