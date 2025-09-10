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

  // Upload form state
  let uploadForm = $state({
    files: [],
    description: '',
    dateOfMemory: '',
    selectedAlbumId: ''
  });
  let fileInput = $state(null);

  // Search / filter / sort state
  let searchQuery = $state('');
  let sortOption = $state('recent'); // recent | oldest | name-asc | name-desc
  let showFilters = $state(false);

  // Simple debounce mechanism for search (avoid recompute on every keystroke)
  let debouncedSearch = $state('');
  let searchTimeout;
  $effect(() => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => { debouncedSearch = searchQuery.trim().toLowerCase(); }, 200);
  });

  // Protect this route - allow access for authenticated users, verification not required for gallery
  $effect(() => {
    if (browser) {
      protectRoute(false).then(isAuthorized => {
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

          // Auto assign local coverImageUrl from first photo if missing (non-destructive; no backend write)
          albums.forEach(album => {
            if (!album.coverImageUrl) {
              const first = photos.find(p => p.albumId === album._id);
              if (first) {
                album.coverImageUrl = first.url || first.secure_url || first.imageUrl; // best-effort field names
              }
            }
          });
          
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

  async function uploadImages(files, albumId = null, description = '', dateOfMemory = '') {
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

      if (dateOfMemory) {
        formData.append('dateOfMemory', dateOfMemory);
      }

      const response = await apiCall('/gallery/photos', {
        method: 'POST',
        body: formData
      });

      if (response && response.ok) {
        const data = await response.json();
        if (data.success) {
          success = data.message;
          await loadGallery(); // Refresh the gallery
          
          // Clear upload form
          uploadForm.files = [];
          uploadForm.description = '';
          uploadForm.dateOfMemory = '';
          uploadForm.selectedAlbumId = '';
          if (fileInput) fileInput.value = '';
          
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
    uploadForm.files = files;
  // Do not auto-upload here. User will click the "Upload Photos" button to start upload.
  // This preserves the user's ability to set description/date/album before uploading.
  }

  function handleFileSelect() {
    fileInput?.click();
  }

  function removeFile(index) {
    uploadForm.files = uploadForm.files.filter((_, i) => i !== index);
    if (fileInput) fileInput.value = '';
  }

  function handleUploadSubmit() {
    if (uploadForm.files.length === 0) {
      error = 'Please select at least one file to upload';
      return;
    }
    uploadImages(
      uploadForm.files, 
      uploadForm.selectedAlbumId || null, 
      uploadForm.description, 
      uploadForm.dateOfMemory
    );
  }

  function handleDrop(event) {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files).filter(file => file.type.startsWith('image/'));
    if (files.length > 0) {
      // Store dropped files in the form; user must click Upload Photos to send them.
      uploadForm.files = files;
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

  // Filter & sort helpers
  function sortItems(list, type) {
    switch (type) {
      case 'oldest':
        return [...list].sort((a,b) => new Date(a.uploadedAt || a.createdAt || 0) - new Date(b.uploadedAt || b.createdAt || 0));
      case 'name-asc':
        return [...list].sort((a,b) => (a.name||a.originalName||'').localeCompare(b.name||b.originalName||''));
      case 'name-desc':
        return [...list].sort((a,b) => (b.name||b.originalName||'').localeCompare(a.name||a.originalName||''));
      case 'recent':
      default:
        return [...list].sort((a,b) => new Date(b.uploadedAt || b.createdAt || 0) - new Date(a.uploadedAt || a.createdAt || 0));
    }
  }

  function albumMatches(album) {
    if (!debouncedSearch) return true;
    const q = debouncedSearch;
    return (
      (album.name && album.name.toLowerCase().includes(q)) ||
      (album.description && album.description.toLowerCase().includes(q))
    );
  }

  function photoMatches(photo) {
    if (!debouncedSearch) return true;
    const q = debouncedSearch;
    return (
      (photo.originalName && photo.originalName.toLowerCase().includes(q)) ||
      (photo.description && photo.description.toLowerCase().includes(q))
    );
  }

  function getFilteredAlbums(limit = null) {
    let list = albums.filter(albumMatches);
    list = sortItems(list, sortOption);
    if (limit) return list.slice(0, limit);
    return list;
  }

  function getFilteredStandalonePhotos(limit = null) {
    let list = getStandalonePhotos().filter(photoMatches);
    list = sortItems(list, sortOption);
    if (limit) return list.slice(0, limit);
    return list;
  }

  function getFilteredAllPhotos() {
    return sortItems(photos.filter(photoMatches), sortOption);
  }

  function clearMessages() {
    error = '';
    success = '';
  }
</script>

<svelte:head>
  <title>Gallery - Memory Lane</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
  <!-- Navigation -->
  <nav class="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
    <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
      <div class="flex items-center gap-6">
        <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100">Memory Lane</h1>
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
      {#if currentView !== 'album-detail'}
        <div class="mt-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
          <div class="flex items-center gap-2 flex-1">
            <div class="relative flex-1">
              <input
                type="text"
                placeholder="Search albums & photos..."
                bind:value={searchQuery}
                class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Search gallery"
              />
              {#if searchQuery}
                <button
                  class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  onclick={() => searchQuery = ''}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              {/if}
            </div>
            <select
              bind:value={sortOption}
              class="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Sort items"
            >
              <option value="recent">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="name-asc">Name A–Z</option>
              <option value="name-desc">Name Z–A</option>
            </select>
          </div>
          {#if debouncedSearch}
            <p class="text-xs text-gray-500 dark:text-gray-400">Filtered results for "{searchQuery}"</p>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Enhanced Upload Card -->
    {#if currentView !== 'album-detail'}
      <div class="mb-8">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Add New Photos</h3>
          
          <!-- File Selection -->
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Files
            </label>
            <div class="flex items-center gap-3">
              <button
                onclick={handleFileSelect}
                class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                </svg>
                Choose Files
              </button>
              <input
                bind:this={fileInput}
                type="file"
                multiple
                accept="image/*"
                onchange={handleFileInput}
                class="hidden"
              />
              <span class="text-sm text-gray-600 dark:text-gray-400">
                {uploadForm.files.length > 0 ? `${uploadForm.files.length} file(s) selected` : 'No files selected'}
              </span>
            </div>
            
            <!-- Selected Files Display -->
            {#if uploadForm.files.length > 0}
              <div class="mt-3 space-y-2">
                {#each uploadForm.files as file, index}
                  <div class="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-2 rounded">
                    <span class="text-sm text-gray-700 dark:text-gray-300 truncate">{file.name}</span>
                    <button
                      onclick={() => removeFile(index)}
                      class="text-red-500 hover:text-red-700 dark:hover:text-red-400"
                      aria-label="Remove file"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                      </svg>
                    </button>
                  </div>
                {/each}
              </div>
            {/if}
          </div>

          <!-- Description -->
          <div class="mb-4">
            <label for="photo-description" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              id="photo-description"
              bind:value={uploadForm.description}
              placeholder="Add a description for your photos..."
              rows="3"
              class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            ></textarea>
          </div>

          <!-- Date of Memory -->
          <div class="mb-4">
            <label for="date-of-memory" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Date of Memory
            </label>
            <input
              id="date-of-memory"
              type="date"
              bind:value={uploadForm.dateOfMemory}
              class="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <!-- Album Selection -->
          <div class="mb-6">
            <label for="album-select" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Add to Album (Optional)
            </label>
            <select
              id="album-select"
              bind:value={uploadForm.selectedAlbumId}
              class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select an album...</option>
              {#each albums as album}
                <option value={album._id}>{album.name}</option>
              {/each}
            </select>
          </div>

          <!-- Upload Button -->
          <div class="flex justify-end">
            <button
              onclick={handleUploadSubmit}
              disabled={uploading || uploadForm.files.length === 0}
              class="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {#if uploading}
                <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Uploading...
              {:else}
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                </svg>
                Upload Photos
              {/if}
            </button>
          </div>
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
              {#each getFilteredAlbums(4) as album (album._id)}
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
  {#if getStandalonePhotos().length > 0}
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
              {#each getFilteredStandalonePhotos(8) as photo (photo._id)}
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
          {#each getFilteredAlbums() as album (album._id)}
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
          {#each getFilteredAllPhotos() as photo (photo._id)}
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

  {#if getAlbumPhotos(selectedAlbum._id).length === 0}
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
          {#each getAlbumPhotos(selectedAlbum._id) as photo (photo._id)}
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