<script>
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { protectRoute, apiCall, logout } from '$lib/auth.js';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';

  let photos = $state([]);
  let loading = $state(true);
  let uploading = $state(false);
  let error = $state('');
  let success = $state('');

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
          photos = data.data.images || [];
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

  async function uploadImages(files) {
    if (!files || files.length === 0) return;

    uploading = true;
    error = '';
    success = '';

    try {
      const formData = new FormData();
      
      for (let file of files) {
        formData.append('images', file);
      }

      const response = await apiCall('/gallery/upload', {
        method: 'POST',
        body: formData,
        headers: {} // Remove Content-Type to let browser set it for FormData
      });

      if (response && response.ok) {
        const data = await response.json();
        if (data.success) {
          success = `Successfully uploaded ${files.length} image(s)`;
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

  async function deleteImageFromBackend(imageId) {
    try {
      const response = await apiCall(`/gallery/${imageId}`, {
        method: 'DELETE'
      });

      if (response && response.ok) {
        const data = await response.json();
        if (data.success) {
          success = 'Image deleted successfully';
          await loadGallery(); // Refresh the gallery
          
          // Clear success message after 3 seconds
          setTimeout(() => {
            success = '';
          }, 3000);
        } else {
          error = data.message || 'Failed to delete image';
        }
      } else {
        error = 'Failed to delete image';
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
    <!-- Header -->
    <div class="mb-8">
      <h2 class="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Your Gallery</h2>
      <p class="text-gray-600 dark:text-gray-400">Upload and manage your images</p>
    </div>

    <!-- Upload Section -->
    <div class="mb-8">
      <div
        class="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
        ondrop={handleDrop}
        ondragover={handleDragOver}
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

    <!-- Status Messages -->
    {#if success}
      <div class="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-4">
        <p class="text-green-600 dark:text-green-400">{success}</p>
      </div>
    {/if}

    {#if error}
      <div class="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
        <p class="text-red-600 dark:text-red-400">{error}</p>
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

    <!-- Gallery Grid -->
    {#if loading}
      <div class="flex items-center justify-center py-12">
        <svg class="animate-spin h-8 w-8 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span class="ml-2 text-gray-600 dark:text-gray-400">Loading gallery...</span>
      </div>
    {:else if photos.length === 0}
      <div class="text-center py-12">
        <svg class="mx-auto h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No images yet</h3>
        <p class="text-gray-600 dark:text-gray-400">Upload some images to get started</p>
      </div>
    {:else}
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {#each photos as photo (photo._id)}
          <div class="group relative bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow">
            <div class="aspect-square">
              <img
                src={photo.url}
                alt={photo.originalName || 'Gallery image'}
                class="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            <div class="p-3">
              <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {photo.originalName || 'Untitled'}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {new Date(photo.uploadedAt).toLocaleDateString()}
              </p>
            </div>
            <!-- Delete Button -->
            <button
              onclick={() => deleteImageFromBackend(photo._id)}
              class="absolute top-2 right-2 bg-red-600 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
              title="Delete image"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            </button>
          </div>
        {/each}
      </div>
    {/if}
  </main>
</div>