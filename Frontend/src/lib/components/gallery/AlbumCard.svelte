<script>
  import { createEventDispatcher } from 'svelte';

  // Explicit, reactive props
  export let album;
  export let showControls = true;
  export let canDelete = true;
  // Optional photos array passed from parent so we can compute counts from actual photos
  export let photos = [];

  const dispatch = createEventDispatcher();
  
  function handleEdit() {
    dispatch('edit', album);
  }
  
  function handleDelete() {
    if (confirm(`Are you sure you want to delete the album "${album.name}"? This will not delete the photos in the album.`)) {
      dispatch('delete', album);
    }
  }
  
  function handleAddPhotos() {
    dispatch('addPhotos', album);
  }
  
  function handleView() {
    dispatch('view', album);
  }
  
  import { formatTimestamp } from '$lib/utils/formatDate.js';
  function formatDate(dateString) {
    return formatTimestamp(dateString);
  }
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow group">
  <div class="aspect-video relative flex items-center justify-center bg-gray-100 dark:bg-gray-700">
    {#if album.coverImageUrl}
      <img
        src={album.coverImageUrl}
        alt={album.name}
        class="absolute inset-0 w-full h-full object-cover"
        loading="lazy"
      />
      <div class="absolute inset-0 bg-black/30"></div>
    {:else}
      <div class="absolute inset-0 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900"></div>
    {/if}
    <div class="relative text-center p-4">
      <svg class="w-10 h-10 mx-auto text-blue-500 dark:text-blue-300 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
      {#if $$props.photos}
        <!-- If parent passes a photos array, compute count from actual photos for accuracy -->
        <p class="text-xs text-gray-100 bg-black/40 rounded-full px-2 py-0.5 inline-block">{$$props.photos.filter(p => p.albumId === album._id).length} photos</p>
      {:else}
        <!-- Fallback to stored album.photos length for backward compatibility -->
        <p class="text-xs text-gray-100 bg-black/40 rounded-full px-2 py-0.5 inline-block">{album.photos?.length || 0} photos</p>
      {/if}
    </div>
    
    {#if showControls}
      <!-- Album controls -->
      <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
        <button
          onclick={handleEdit}
          class="p-1.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
          title="Edit album"
          aria-label="Edit album"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
          </svg>
        </button>
        {#if canDelete}
          <button
            onclick={handleDelete}
            class="p-1.5 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
            title="Delete album"
            aria-label="Delete album"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
          </button>
        {/if}
      </div>
    {/if}
  </div>
  
  <div class="p-4">
    <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 truncate">{album.name}</h3>
    <p class="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">{album.description}</p>
    <p class="text-xs text-gray-500 dark:text-gray-500 mb-4">Memory from {formatDate(album.dateOfMemory)}</p>
    
    <div class="flex gap-2">
      <button
        onclick={handleView}
        class="flex-1 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
      >
        View Album
      </button>
      {#if showControls}
        <button
          onclick={handleAddPhotos}
          class="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
          title="Add photos to album"
          aria-label="Add photos to album"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
          </svg>
        </button>
      {/if}
    </div>
  </div>
</div>
