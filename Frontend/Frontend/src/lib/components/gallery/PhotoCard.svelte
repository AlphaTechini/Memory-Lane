<script>
  import { createEventDispatcher } from 'svelte';
  
  export let photo;
  export let albums = [];
  export let showControls = true;
  export let showAlbumSelector = false;
  
  const dispatch = createEventDispatcher();
  
  let isEditing = $state(false);
  let description = $state(photo.description || '');
  let selectedAlbumId = $state(photo.albumId || '');
  
  function handleEdit() {
    isEditing = true;
  }
  
  function handleCancelEdit() {
    isEditing = false;
    description = photo.description || '';
    selectedAlbumId = photo.albumId || '';
  }
  
  async function handleSaveEdit() {
    const updates = {};
    
    if (description !== (photo.description || '')) {
      updates.description = description;
    }
    
    if (selectedAlbumId !== (photo.albumId || '')) {
      if (selectedAlbumId === '') {
        updates.removeFromAlbum = true;
      } else {
        updates.albumId = selectedAlbumId;
      }
    }
    
    if (Object.keys(updates).length > 0) {
      dispatch('update', { photo, updates });
    }
    
    isEditing = false;
  }
  
  function handleDelete() {
    if (confirm('Are you sure you want to delete this photo?')) {
      dispatch('delete', photo);
    }
  }
  
  function handleView() {
    dispatch('view', photo);
  }
  
  function getAlbumName(albumId) {
    const album = albums.find(a => a._id === albumId);
    return album ? album.name : 'Unknown Album';
  }
  
  function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString();
  }
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow group">
  <div class="aspect-square relative">
    <img
      src={photo.imageUrl}
      alt={photo.originalName || 'Gallery photo'}
      class="w-full h-full object-cover cursor-pointer"
      onclick={handleView}
      loading="lazy"
    />
    
    {#if showControls}
      <!-- Photo controls -->
      <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
        <button
          onclick={handleEdit}
          class="p-1.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
          title="Edit photo"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
          </svg>
        </button>
        <button
          onclick={handleDelete}
          class="p-1.5 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
          title="Delete photo"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
          </svg>
        </button>
      </div>
    {/if}
    
    {#if photo.albumId}
      <div class="absolute bottom-2 left-2">
        <span class="px-2 py-1 bg-black/50 text-white text-xs rounded-full">
          {getAlbumName(photo.albumId)}
        </span>
      </div>
    {/if}
  </div>
  
  <div class="p-3">
    {#if isEditing}
      <!-- Edit mode -->
      <div class="space-y-3">
        <div>
          <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description {#if photo.albumId}<span class="text-yellow-600 dark:text-yellow-400">(overwrites album description)</span>{/if}
          </label>
          <textarea
            bind:value={description}
            placeholder="Add a description..."
            class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows="2"
          ></textarea>
        </div>
        
        {#if showAlbumSelector}
          <div>
            <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Album</label>
            <select
              bind:value={selectedAlbumId}
              class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">No album (standalone)</option>
              {#each albums as album (album._id)}
                <option value={album._id}>{album.name}</option>
              {/each}
            </select>
          </div>
        {/if}
        
        <div class="flex gap-2">
          <button
            onclick={handleSaveEdit}
            class="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
          >
            Save
          </button>
          <button
            onclick={handleCancelEdit}
            class="px-3 py-1.5 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    {:else}
      <!-- View mode -->
      <div>
        <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate mb-1">
          {photo.originalName || 'Untitled'}
        </p>
        
        {#if photo.description}
          <p class="text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
            {photo.description}
          </p>
        {/if}
        
        <p class="text-xs text-gray-500 dark:text-gray-500">
          {formatDate(photo.uploadedAt)}
        </p>
      </div>
    {/if}
  </div>
</div>
