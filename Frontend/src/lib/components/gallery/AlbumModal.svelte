<script>
  import { createEventDispatcher } from 'svelte';
  
  const { isOpen = false, title = 'Create Album', album = null } = $props();
  
  const dispatch = createEventDispatcher();
  
  let name = $state(album?.name || '');
  let description = $state(album?.description || '');
  let dateOfMemory = $state(album?.dateOfMemory ? new Date(album.dateOfMemory).toISOString().split('T')[0] : '');
  let isSubmitting = $state(false);
  
  $effect(() => {
    if (album) {
      name = album.name || '';
      description = album.description || '';
      dateOfMemory = album.dateOfMemory ? new Date(album.dateOfMemory).toISOString().split('T')[0] : '';
    } else {
      name = '';
      description = '';
      dateOfMemory = '';
    }
  });
  
  function handleClose() {
    if (!isSubmitting) {
      dispatch('close');
    }
  }
  
  async function handleSubmit() {
    if (!name.trim() || !description.trim() || !dateOfMemory) {
      return;
    }
    
    isSubmitting = true;
    
    try {
      const albumData = {
        name: name.trim(),
        description: description.trim(),
        dateOfMemory: dateOfMemory
      };
      
      if (album) {
        dispatch('update', { album, data: albumData });
      } else {
        dispatch('create', albumData);
      }
      
      // Reset form
      name = '';
      description = '';
      dateOfMemory = '';
    } catch (error) {
      console.error('Error submitting album:', error);
    } finally {
      isSubmitting = false;
    }
  }
  
  function handleKeydown(event) {
    if (event.key === 'Escape') {
      handleClose();
    }
  }
</script>

{#if isOpen}
  <!-- Modal backdrop -->
  <div 
    class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
    onclick={handleClose}
    onkeydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
  >
    <!-- Modal content -->
    <div 
      class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
      onclick={(e) => e.stopPropagation()}
    >
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
        <h2 id="modal-title" class="text-xl font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </h2>
        <button
          onclick={handleClose}
          class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          disabled={isSubmitting}
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      
      <!-- Form -->
  <form onsubmit={(e)=>{e.preventDefault();handleSubmit();}} class="p-6 space-y-4">
        <div>
          <label for="album-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Album Name *
          </label>
          <input
            id="album-name"
            type="text"
            bind:value={name}
            placeholder="Enter album name"
            required
            disabled={isSubmitting}
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
        
        <div>
          <label for="album-description" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Description *
          </label>
          <textarea
            id="album-description"
            bind:value={description}
            placeholder="Describe this memory or collection..."
            required
            disabled={isSubmitting}
            rows="3"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed resize-none"
          ></textarea>
        </div>
        
        <div>
          <label for="date-of-memory" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Date of Memory *
          </label>
          <input
            id="date-of-memory"
            type="date"
            bind:value={dateOfMemory}
            required
            disabled={isSubmitting}
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
        
        <!-- Actions -->
        <div class="flex gap-3 pt-4">
          <button
            type="button"
            onclick={handleClose}
            disabled={isSubmitting}
            class="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !name.trim() || !description.trim() || !dateOfMemory}
            class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {#if isSubmitting}
              <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            {/if}
            {album ? 'Update Album' : 'Create Album'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
