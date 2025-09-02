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

<!-- Mobile toggle -->
<div class="md:hidden absolute top-4 left-4 z-10">
  <button
    class="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 bg-white dark:bg-gray-800 shadow-md border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 transition-colors duration-200"
    aria-label="Open conversations drawer"
    onclick={() => (mobileOpen = true)}