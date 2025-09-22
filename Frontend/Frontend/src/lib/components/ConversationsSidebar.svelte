<script>
  import SidebarContent from './SidebarContent.svelte';

  let { 
    conversationsList = [], 
    activeId = null, 
    onselect, 
    onnew,
    onclear
  } = $props();

  let mobileOpen = $state(false);

  function handleSelect(event) {
    onselect?.(event);
    mobileOpen = false;
  }

  function handleNew() {
    onnew?.();
    mobileOpen = false;
  }

  function handleClear() {
    if (confirm('Are you sure you want to clear all conversations? This cannot be undone.')) {
      onclear?.();
      mobileOpen = false;
    }
  }

  function closeMobileSidebar() {
    mobileOpen = false;
  }
</script>

<!-- Desktop sidebar -->
<aside class="w-72 bg-white dark:bg-gray-900 p-3 flex-col h-full hidden md:flex border-r border-gray-200 dark:border-gray-700 transition-colors duration-200">
  <SidebarContent
    {conversationsList}
    {activeId}
    onselect={handleSelect}
    onnew={handleNew}
    onclear={handleClear}
  />
</aside>

<!-- Mobile toggle button -->
<div class="md:hidden absolute top-4 left-4 z-10">
  <button
    class="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 bg-white dark:bg-gray-800 shadow-md border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 transition-colors duration-200"
    aria-label="Open conversations drawer"
  onclick={() => (mobileOpen = true)}
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
      <path d="M4 6h16M4 12h16M4 18h16"/>
    </svg>
  </button>
</div>

<!-- Mobile sidebar drawer -->
{#if mobileOpen}
  <div class="fixed inset-0 z-50 flex">
    <!-- Overlay -->
    <button
      class="absolute inset-0 bg-black bg-opacity-40"
      aria-label="Close sidebar"
  onclick={closeMobileSidebar}
      tabindex="-1"
    ></button>
    <!-- Sidebar content -->
    <aside class="relative w-72 max-w-full bg-white dark:bg-gray-900 p-3 flex-col h-full border-r border-gray-200 dark:border-gray-700 transition-colors duration-200 z-10 shadow-lg">
      <div class="flex justify-end mb-2">
        <button
          class="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 transition-colors duration-200"
          aria-label="Close conversations drawer"
          onclick={closeMobileSidebar}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
            <path d="M18 6 6 18"/>
            <path d="m6 6 12 12"/>
          </svg>
        </button>
      </div>
      <SidebarContent
        {conversationsList}
        {activeId}
        onselect={handleSelect}
        onnew={handleNew}
        onclear={handleClear}
      />
    </aside>
  </div>
{/if}