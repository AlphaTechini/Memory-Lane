<script>
  import { browser } from '$app/environment';
  import { protectRoute, apiCall, logout } from '$lib/auth.js';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import AlbumCard from '$lib/components/gallery/AlbumCard.svelte';
  import PhotoCard from '$lib/components/gallery/PhotoCard.svelte';
  import AlbumModal from '$lib/components/gallery/AlbumModal.svelte';
  import PhotoSelector from '$lib/components/gallery/PhotoSelector.svelte';

  let albums = $state([]);
  let photos = $state([]);
  let loading = $state(true);
  let uploading = $state(false);
  let error = $state('');
  let success = $state('');
  
  // Modal states
  let showAlbumModal = $state(false);
  let showPhotoSelector = $state(false);
  let editingAlbum = $state(null);
  let selectedAlbumForPhotos = $state(null);
  
  // View states
  let currentView = $state('overview'); // 'overview', 'albums', 'photos'
  let selectedAlbum = $state(null);

  // Protect this route
  $effect(() => {
    if (browser) {
      protectRoute().then(isAuthorized => {
        if (isAuthorized) {
          loadGallery();
        }
      });
    }
  });

  async function loadGallery() {
    try {
      loading = true;
      error = '';
      
      const response = await apiCall('/gallery');
      
      if (response && response.ok) {
        const data = await response.json();
        if (data.success) {
          albums = data.data.albums || [];
          photos = data.data.photos || [];
          
          // For backward compatibility, also include legacy images as photos
          const legacyImages = data.data.images || [];
          legacyImages.forEach(image => {
            if (!photos.find(photo => photo.imageId === image.imageId)) {
              photos.push({
                ...image,
                _id: image._id || image.imageId,
                originalName: image.originalName || 'Legacy Image',
                description: image.description || '',
                uploadedAt: image.uploadedAt
              });
            }
          });
        } else {
          error = data.message || 'Failed to load gallery';
        }
      } else {
        error = 'Failed to load gallery';
      }
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  async function uploadImages(files, albumId = null, description = '') {
    if (!files || files.length === 0) return;

    uploading = true;
    error = '';
    success = '';

    try {
      const formData = new FormData();
      
      for (let file of files) {
        formData.append('images', file);
      }
      
      if (albumId) {
        formData.append('albumId', albumId);
      }
      
      if (description) {
        formData.append('description', description);
      }

      const response = await apiCall('/gallery/photos', {
        method: 'POST',
        body: formData,
        headers: {} // Remove Content-Type to let browser set it for FormData
      });

      if (response && response.ok) {
        const data = await response.json();
        if (data.success) {
          success = data.message;
          await loadGallery(); // Refresh the gallery
          
          // Clear success message after 3 seconds
          setTimeout(() => {
            success = '';
          }, 3000);
        } else {
          error = data.message || 'Upload failed';
        }
      } else {
        error = 'Upload failed';
      }
    } catch (err) {
      error = err.message;
    } finally {
      uploading = false;
    }
  }

  async function createAlbum(albumData) {
    try {
      const response = await apiCall('/gallery/albums', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(albumData),
      });

      if (response && response.ok) {
        const data = await response.json();
        if (data.success) {
          success = 'Album created successfully';
          showAlbumModal = false;
          await loadGallery();
          
          setTimeout(() => {
            success = '';
          }, 3000);
        } else {
          error = data.message || 'Failed to create album';
        }
      } else {
        error = 'Failed to create album';
      }
    } catch (err) {
      error = err.message;
    }
  }

  async function updateAlbum(album, albumData) {
    try {
      const response = await apiCall(`/gallery/albums/${album._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(albumData),
      });

      if (response && response.ok) {
        const data = await response.json();
        if (data.success) {
          success = 'Album updated successfully';
          showAlbumModal = false;
          editingAlbum = null;
          await loadGallery();
          
          setTimeout(() => {
            success = '';
          }, 3000);
        } else {
          error = data.message || 'Failed to update album';
        }
      } else {
        error = 'Failed to update album';
      }
    } catch (err) {
      error = err.message;
    }
  }

  async function deleteAlbum(album) {
    try {
      const response = await apiCall(`/gallery/albums/${album._id}`, {
        method: 'DELETE'
      });

      if (response && response.ok) {
        const data = await response.json();
        if (data.success) {
          success = 'Album deleted successfully';
          await loadGallery();
          
          setTimeout(() => {
            success = '';
          }, 3000);
        } else {
          error = data.message || 'Failed to delete album';
        }
      } else {
        error = 'Failed to delete album';
      }
    } catch (err) {
      error = err.message;
    }
  }

  async function updatePhoto(photo, updates) {
    try {
      const response = await apiCall(`/gallery/photos/${photo._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (response && response.ok) {
        const data = await response.json();
        if (data.success) {
          success = 'Photo updated successfully';
          await loadGallery();
          
          setTimeout(() => {
            success = '';
          }, 3000);
        } else {
          error = data.message || 'Failed to update photo';
        }
      } else {
        error = 'Failed to update photo';
      }
    } catch (err) {
      error = err.message;
    }
  }

  async function deletePhoto(photo) {
    try {
      const response = await apiCall(`/gallery/photos/${photo._id}`, {
        method: 'DELETE'
      });

      if (response && response.ok) {
        const data = await response.json();
        if (data.success) {
          success = 'Photo deleted successfully';
          await loadGallery();
          
          setTimeout(() => {
            success = '';
          }, 3000);
        } else {
          error = data.message || 'Failed to delete photo';
        }
      } else {
        error = 'Failed to delete photo';
      }
    } catch (err) {
      error = err.message;
    }
  }

  async function addPhotosToAlbum({ albumId, photoIds }) {
    try {
      const response = await apiCall(`/gallery/albums/${albumId}/photos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ photoIds }),
      });

      if (response && response.ok) {
        const data = await response.json();
        if (data.success) {
          success = data.message;
          showPhotoSelector = false;
          selectedAlbumForPhotos = null;
          await loadGallery();
          
          setTimeout(() => {
            success = '';
          }, 3000);
        } else {
          error = data.message || 'Failed to add photos to album';
        }
      } else {
        error = 'Failed to add photos to album';
      }
    } catch (err) {
      error = err.message;
    }
  }

  function handleFileInput(event) {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      uploadImages(files);
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files).filter(file => file.type.startsWith('image/'));
    if (files.length > 0) {
      uploadImages(files);
    }
  }

  function handleDragOver(event) {
    event.preventDefault();
  }

  function handleCreateAlbum() {
    editingAlbum = null;
    showAlbumModal = true;
  }

  function handleEditAlbum(album) {
    editingAlbum = album;
    showAlbumModal = true;
  }

  function handleAddPhotosToAlbum(album) {
    selectedAlbumForPhotos = album;
    showPhotoSelector = true;
  }

  function handleViewAlbum(album) {
    selectedAlbum = album;
    currentView = 'album-detail';
  }

  function getStandalonePhotos() {
    return photos.filter(photo => !photo.albumId);
  }

  function getAlbumPhotos(albumId) {
    return photos.filter(photo => photo.albumId === albumId);
  }

  function clearMessages() {
    error = '';
    success = '';
  }
</script>

<svelte:head>
  <title>Gallery - Sensay AI</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
  <!-- Navigation -->
  <nav class="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
    <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
      <div class="flex items-center gap-6">
        <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100">Sensay AI</h1>
        <div class="flex items-center gap-4">
          <a href="/dashboard" class="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">Dashboard</a>
          <a href="/gallery" class="text-blue-600 dark:text-blue-400 font-medium">Gallery</a>
          <a href="/create-replicas" class="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">Create Replicas</a>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <ThemeToggle />
        <button
          onclick={logout}
          class="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
        >
          Logout
        </button>
      </div>
    </div>
  </nav>

  <!-- Main Content -->
  <main class="max-w-6xl mx-auto px-4 py-8">
    <!-- Header with navigation -->
    <div class="mb-8">
      <div class="flex items-center justify-between mb-4">
        {#if currentView === 'album-detail'}
          <div>
            <button
              onclick={() => { currentView = 'overview'; selectedAlbum = null; }}
              class="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mb-2"
            >
              <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
              </svg>
              Back to Gallery
            </button>
            <h2 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {selectedAlbum?.name || 'Album'}
            </h2>
            <p class="text-gray-600 dark:text-gray-400">{selectedAlbum?.description}</p>
          </div>
        {:else}
          <div>
            <h2 class="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Your Gallery</h2>
            <p class="text-gray-600 dark:text-gray-400">Organize your memories in albums or upload standalone photos</p>
          </div>
        {/if}
        
        <div class="flex items-center gap-3">
          {#if currentView !== 'album-detail'}
            <button
              onclick={handleCreateAlbum}
              class="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors flex items-center gap-2"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
              </svg>
              Create Album
            </button>
          {/if}
        </div>
      </div>

      <!-- View tabs -->
      {#if currentView !== 'album-detail'}
        <div class="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
          <button
            onclick={() => currentView = 'overview'}
            class="px-4 py-2 rounded-md text-sm font-medium transition-colors {
              currentView === 'overview' 
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' 
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }"
          >
            Overview
          </button>
          <button
            onclick={() => currentView = 'albums'}
            class="px-4 py-2 rounded-md text-sm font-medium transition-colors {
              currentView === 'albums' 
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' 
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }"
          >
            Albums ({albums.length})
          </button>
          <button
            onclick={() => currentView = 'photos'}
            class="px-4 py-2 rounded-md text-sm font-medium transition-colors {
              currentView === 'photos' 
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' 
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }"
          >
            All Photos ({photos.length})
          </button>
        </div>
      {/if}
    </div>

    <!-- Upload Section -->
    {#if currentView !== 'album-detail'}
      <div class="mb-8">
        <div
          class="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
          ondrop={handleDrop}
          ondragover={handleDragOver}
          role="button"
          tabindex="0"
          aria-label="Drag and drop images here or click to choose files"
        >
          <div class="mb-4">
            <svg class="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
              <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>
          <div class="mb-4">
            <p class="text-gray-600 dark:text-gray-400 mb-2">
              Drag and drop images here, or
            </p>
            <label class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer transition-colors">
              <span>Choose Files</span>
              <input
                type="file"
                multiple
                accept="image/*"
                onchange={handleFileInput}
                class="hidden"
              />
            </label>
          </div>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            PNG, JPG, GIF up to 10MB each
          </p>
        </div>
      </div>
    {/if}

    <!-- Status Messages -->
    {#if success}
      <div class="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-4">
        <div class="flex justify-between items-center">
          <p class="text-green-600 dark:text-green-400">{success}</p>
          <button onclick={clearMessages} class="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300" aria-label="Close success message">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      </div>
    {/if}

    {#if error}
      <div class="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
        <div class="flex justify-between items-center">
          <p class="text-red-600 dark:text-red-400">{error}</p>
          <button onclick={clearMessages} class="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300" aria-label="Close error message">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      </div>
    {/if}

    {#if uploading}
      <div class="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
        <div class="flex items-center">
          <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p class="text-blue-600 dark:text-blue-400">Uploading images...</p>
        </div>
      </div>
    {/if}

    <!-- Content based on view -->
    {#if loading}
      <div class="flex items-center justify-center py-12">
        <svg class="animate-spin h-8 w-8 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span class="ml-2 text-gray-600 dark:text-gray-400">Loading gallery...</span>
      </div>
    {:else if currentView === 'overview'}
      <!-- Overview: Show albums and recent photos -->
      <div class="space-y-8">
        <!-- Albums section -->
        {#if albums.length > 0}
          <div>
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Albums</h3>
              <button
                onclick={() => currentView = 'albums'}
                class="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm"
              >
                View all albums →
              </button>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {#each albums.slice(0, 4) as album (album._id)}
                <AlbumCard 
                  {album} 
                  on:edit={(e) => handleEditAlbum(e.detail)}
                  on:delete={(e) => deleteAlbum(e.detail)}
                  on:addPhotos={(e) => handleAddPhotosToAlbum(e.detail)}
                  on:view={(e) => handleViewAlbum(e.detail)}
                />
              {/each}
            </div>
          </div>
        {/if}

        <!-- Recent photos section -->
        {@const standalonePhotos = getStandalonePhotos()}
        {#if standalonePhotos.length > 0}
          <div>
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Recent Photos</h3>
              <button
                onclick={() => currentView = 'photos'}
                class="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm"
              >
                View all photos →
              </button>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {#each standalonePhotos.slice(0, 8) as photo (photo._id)}
                <PhotoCard
                  {photo}
                  {albums}
                  showAlbumSelector={true}
                  on:update={(e) => updatePhoto(e.detail.photo, e.detail.updates)}
                  on:delete={(e) => deletePhoto(e.detail)}
                  on:view={(e) => console.log('View photo:', e.detail)}
                />
              {/each}
            </div>
          </div>
        {/if}

        <!-- Empty state -->
        {#if albums.length === 0 && photos.length === 0}
          <div class="text-center py-12">
            <svg class="mx-auto h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No content yet</h3>
            <p class="text-gray-600 dark:text-gray-400">Create your first album or upload some photos to get started</p>
          </div>
        {/if}
      </div>
    {:else if currentView === 'albums'}
      <!-- Albums only view -->
      {#if albums.length === 0}
        <div class="text-center py-12">
          <svg class="mx-auto h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No albums yet</h3>
          <p class="text-gray-600 dark:text-gray-400 mb-4">Create your first album to organize your memories</p>
          <button
            onclick={handleCreateAlbum}
            class="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
          >
            Create Album
          </button>
        </div>
      {:else}
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {#each albums as album (album._id)}
            <AlbumCard 
              {album} 
              on:edit={(e) => handleEditAlbum(e.detail)}
              on:delete={(e) => deleteAlbum(e.detail)}
              on:addPhotos={(e) => handleAddPhotosToAlbum(e.detail)}
              on:view={(e) => handleViewAlbum(e.detail)}
            />
          {/each}
        </div>
      {/if}
    {:else if currentView === 'photos'}
      <!-- All photos view -->
      {#if photos.length === 0}
        <div class="text-center py-12">
          <svg class="mx-auto h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No photos yet</h3>
          <p class="text-gray-600 dark:text-gray-400">Upload some photos to get started</p>
        </div>
      {:else}
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {#each photos as photo (photo._id)}
            <PhotoCard
              {photo}
              {albums}
              showAlbumSelector={true}
              on:update={(e) => updatePhoto(e.detail.photo, e.detail.updates)}
              on:delete={(e) => deletePhoto(e.detail)}
              on:view={(e) => console.log('View photo:', e.detail)}
            />
          {/each}
        </div>
      {/if}
    {:else if currentView === 'album-detail' && selectedAlbum}
      <!-- Album detail view -->
      {@const albumPhotos = getAlbumPhotos(selectedAlbum._id)}
      <div class="mb-6">
        <button
          onclick={() => handleAddPhotosToAlbum(selectedAlbum)}
          class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
          </svg>
          Add Photos to Album
        </button>
      </div>

      {#if albumPhotos.length === 0}
        <div class="text-center py-12">
          <svg class="mx-auto h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No photos in this album</h3>
          <p class="text-gray-600 dark:text-gray-400 mb-4">Add some photos to bring this album to life</p>
          <button
            onclick={() => handleAddPhotosToAlbum(selectedAlbum)}
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Add Photos
          </button>
        </div>
      {:else}
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {#each albumPhotos as photo (photo._id)}
            <PhotoCard
              {photo}
              {albums}
              showAlbumSelector={true}
              on:update={(e) => updatePhoto(e.detail.photo, e.detail.updates)}
              on:delete={(e) => deletePhoto(e.detail)}
              on:view={(e) => console.log('View photo:', e.detail)}
            />
          {/each}
        </div>
      {/if}
    {/if}
  </main>
</div>

<!-- Modals -->
<AlbumModal
  bind:isOpen={showAlbumModal}
  title={editingAlbum ? 'Edit Album' : 'Create Album'}
  album={editingAlbum}
  on:create={(e) => createAlbum(e.detail)}
  on:update={(e) => updateAlbum(e.detail.album, e.detail.data)}
  on:close={() => { showAlbumModal = false; editingAlbum = null; }}
/>

<PhotoSelector
  bind:isOpen={showPhotoSelector}
  photos={getStandalonePhotos()}
  {albums}
  selectedAlbum={selectedAlbumForPhotos}
  on:addPhotos={(e) => addPhotosToAlbum(e.detail)}
  on:close={() => { showPhotoSelector = false; selectedAlbumForPhotos = null; }}
/>