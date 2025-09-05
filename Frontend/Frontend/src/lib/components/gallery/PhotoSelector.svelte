<script>
  import { createEventDispatcher } from 'svelte';
  
  export let isOpen = false;
  export let photos = [];
  export let albums = [];
  export let selectedAlbum = null;
  
  const dispatch = createEventDispatcher();
  
  let selectedPhotoIds = $state([]);
  let isSubmitting = $state(false);
  
  function handleClose() {
    if (!isSubmitting) {
      selectedPhotoIds = [];
      dispatch('close');
    }
  }
  
  function togglePhoto(photoId) {
    if (selectedPhotoIds.includes(photoId)) {
      selectedPhotoIds = selectedPhotoIds.filter(id => id !== photoId);
    } else {
      selectedPhotoIds = [...selectedPhotoIds, photoId];
    }
  }
  
  function selectAll() {
    selectedPhotoIds = photos.map(photo => photo._id);
  }
  
  function selectNone() {
    selectedPhotoIds = [];
  }
  
  async function handleSubmit() {
    if (!selectedAlbum || selectedPhotoIds.length === 0) return;
    
    isSubmitting = true;
    
    try {
      dispatch('addPhotos', {
        albumId: selectedAlbum._id,
        photoIds: selectedPhotoIds
      });
      
      selectedPhotoIds = [];
    } catch (error) {
      console.error('Error adding photos to album:', error);
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
      class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
      onclick={(e) => e.stopPropagation()}
    >
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h2 id="modal-title" class="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Add Photos to Album
          </h2>
          {#if selectedAlbum}
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Album: {selectedAlbum.name}
            </p>
          {/if}
        </div>
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
      
      <!-- Controls -->
      <div class="p-6 border-b border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between">
          <div class="flex gap-3">
            <button
              onclick={selectAll}
              class="px-3 py-1.5 text-sm bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
            >
              Select All
            </button>
            <button
              onclick={selectNone}
              class="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Select None
            </button>
          </div>
          <span class="text-sm text-gray-600 dark:text-gray-400">
            {selectedPhotoIds.length} of {photos.length} photos selected
          </span>
        </div>
      </div>
      
      <!-- Photos grid -->
      <div class="p-6">
        {#if photos.length === 0}
          <div class="text-center py-12">
            <svg class="mx-auto h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No photos available</h3>
            <p class="text-gray-600 dark:text-gray-400">Upload some photos first to add them to albums</p>
          </div>
        {:else}
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {#each photos as photo (photo._id)}
              <button
                onclick={() => togglePhoto(photo._id)}
                class="relative aspect-square rounded-lg overflow-hidden border-2 transition-all {
                  selectedPhotoIds.includes(photo._id) 
                    ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800' 
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }"
              >
                <img
                  src={photo.imageUrl}
                  alt={photo.originalName || 'Photo'}
                  class="w-full h-full object-cover"
                  loading="lazy"
                />
                
                <!-- Selection indicator -->
                <div class="absolute inset-0 bg-black/20 flex items-center justify-center {
                  selectedPhotoIds.includes(photo._id) ? '' : 'opacity-0 hover:opacity-100'
                } transition-opacity">
                  <div class="w-6 h-6 rounded-full border-2 border-white bg-white/20 flex items-center justify-center">
                    {#if selectedPhotoIds.includes(photo._id)}
                      <svg class="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                    {/if}
                  </div>
                </div>
                
                <!-- Photo info -->
                <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                  <p class="text-white text-xs truncate">{photo.originalName || 'Untitled'}</p>
                </div>
              </button>
            {/each}
          </div>
        {/if}
      </div>
      
      <!-- Actions -->
      <div class="flex gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
        <button
          onclick={handleClose}
          disabled={isSubmitting}
          class="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          onclick={handleSubmit}
          disabled={isSubmitting || selectedPhotoIds.length === 0}
          class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {#if isSubmitting}
            <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          {/if}
          Add {selectedPhotoIds.length} Photo{selectedPhotoIds.length !== 1 ? 's' : ''}
        </button>
      </div>
    </div>
  </div>
{/if}
