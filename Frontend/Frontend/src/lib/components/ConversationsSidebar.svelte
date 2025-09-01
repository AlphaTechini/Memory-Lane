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
    // The confirmation dialog should live here, in the 'container' component.
    if (confirm('Are you sure you want to clear all conversations? This cannot be undone.')) {
      onclear?.();
      mobileOpen = false;
    }
  }
</script>

<!-- Desktop sidebar -->
<aside class="w-72 bg-neutral-100 dark:bg-gray-900 p-3 flex-col h-full hidden md:flex border-r border-gray-200 dark:border-gray-700">
  <SidebarContent
    {conversationsList}
    {activeId}
    onselect={handleSelect}
    onnew={handleNew}
    onclear={handleClear}
  />
</aside>

<!-- Mobile toggle - Fixed positioning -->
<div class="md:hidden fixed top-4 left-4 z-30">
  <button
    class="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 bg-white dark:bg-gray-800 shadow-md"
    aria-label="Open conversations drawer"
    onclick={() => (mobileOpen = true)}
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="lucide lucide-panel-left text-gray-900 dark:text-gray-200"
      ><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M9 3v18" /></svg
    >
  </button>
</div>

<!-- Mobile drawer -->
{#if mobileOpen}
   <div class="fixed inset-0 z-40 md:hidden">
    <button class="absolute inset-0 bg-black opacity-40" aria-label="Close mobile drawer" onclick={() => (mobileOpen = false)}></button>
    <aside class="absolute left-0 top-0 bottom-0 w-72 bg-neutral-100 dark:bg-gray-900 p-3 z-50 shadow-md overflow-y-auto flex flex-col">
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