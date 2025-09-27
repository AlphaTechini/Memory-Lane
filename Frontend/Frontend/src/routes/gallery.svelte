<script>
  import { writable } from 'svelte/store';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import { formatTimestamp } from '$lib/utils/formatDate.js';

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
  const API_BASE_URL = 'http://localhost:4000';

  // Get auth token from localStorage
  function getAuthToken() {
    if (!browser) return null;
    return localStorage.getItem('authToken');
  }

  // Check if user is authenticated
  function isAuthenticated() {
    return !!getAuthToken();
  }

  // Redirect to login if not authenticated
  function checkAuth() {
    if (!isAuthenticated()) {
      goto('/login');
      return false;
    }
    return true;
  }

  // API helper function
  async function apiCall(endpoint, options = {}) {
    const token = getAuthToken();
    if (!token) {
      goto('/login');
      return null;
    }

    const defaultOptions = {
      headers: {
        'Authorization': `Bearer ${token}`,
        ...options.headers
      }
    };

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        ...defaultOptions,
        headers: { ...defaultOptions.headers, ...options.headers }
      });
      return response;
    } catch (err) {
      console.error('API call failed:', err);
      // Clear token and force login on persistent API errors
      if (browser) localStorage.removeItem('authToken');
      goto('/login');
      return null;
    }
  }

  // Store for gallery images from backend
  const galleryImages = writable([]);
  let loading = $state(true);
  let error = $state('');

  // Load gallery images from backend
  async function loadGallery() {
    if (!checkAuth()) return;
    
    try {
      loading = true;
      const response = await apiCall('/gallery');
      
      if (response && response.ok) {
        const data = await response.json();
        if (data.success) {
          galleryImages.set(data.data.gallery || []);
        } else {
          error = data.message || 'Failed to load gallery';
        }
      }
    } catch (err) {
      error = 'Failed to load gallery: ' + err.message;
    } finally {
      loading = false;
    }
  }

  // Upload images to backend
  async function uploadImages(files) {
    if (!checkAuth()) return false;

    try {
      const formData = new FormData();
      
      for (let i = 0; i < files.length; i++) {
        formData.append(`image${i}`, files[i]);
      }

      const response = await apiCall('/gallery/upload', {
        method: 'POST',
        body: formData
      });

      if (response && response.ok) {
        const data = await response.json();
        if (data.success) {
          galleryImages.set(data.data.gallery || []);
          return true;
        } else {
          uploadError = data.message || 'Failed to upload images';
          return false;
        }
      }
    } catch (err) {
      uploadError = 'Upload failed: ' + err.message;
      return false;
    } finally {
      uploadInProgress = false;
    }
  }

  // Delete image from backend
  async function deleteImageFromBackend(imageId) {
    if (!checkAuth()) return false;

    try {
      const response = await apiCall(`/gallery/${imageId}`, {
        method: 'DELETE'
      });

      if (response && response.ok) {
        const data = await response.json();
        if (data.success) {
          galleryImages.set(data.data.gallery || []);
          return true;
        } else {
          error = data.message || 'Failed to delete image';
          return false;
        }
      }
    } catch (err) {
      error = 'Delete failed: ' + err.message;
      return false;
    }
  }

  // Clear entire gallery
  async function clearGallery() {
    if (!checkAuth()) return false;

    try {
      const response = await apiCall('/gallery/clear', {
        method: 'DELETE'
      });

      if (response && response.ok) {
        const data = await response.json();
        if (data.success) {
          galleryImages.set([]);
          return true;
        } else {
          error = data.message || 'Failed to clear gallery';
          return false;
        }
      }
    } catch (err) {
      error = 'Clear failed: ' + err.message;
      return false;
    }
  }

  // UI state
  let showingAddPhoto = $state(false);
  let uploadInProgress = $state(false);
  let uploadError = $state('');
  let validationError = $state('');
  let confirmDeleteImageId = $state(null);
  let confirmClearGallery = $state(false);
  let selectedImageModal = $state(null);
  let selectedFiles = $state([]);

  function resetPhotoForm() {
    selectedFiles = [];
    uploadError = '';
    validationError = '';
    showingAddPhoto = false;
  }

  function openAddPhotoForm() {
    resetPhotoForm();
    showingAddPhoto = true;
  }

  function handlePhotoFiles(event) {
    const files = Array.from(event.target.files || []);
    
    // Validate files
    const validFiles = [];
    const errors = [];

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: File size must be less than 10MB`);
        continue;
      }

      if (!file.type.startsWith('image/')) {
        errors.push(`${file.name}: Please select an image file`);
        continue;
      }

      validFiles.push(file);
    }

    if (errors.length > 0) {
      uploadError = errors.join(', ');
    } else {
      uploadError = '';
    }

    selectedFiles = validFiles;
  }

  async function addPhotos() {
    if (selectedFiles.length === 0) {
      validationError = 'Please select at least one photo';
      return;
    }

    const success = await uploadImages(selectedFiles);
    if (success) {
      resetPhotoForm();
      validationError = '';
    }
  }

  async function deleteImage(imageId) {
    const success = await deleteImageFromBackend(imageId);
    if (success) {
      confirmDeleteImageId = null;
    }
  }

  async function handleClearGallery() {
    const success = await clearGallery();
    if (success) {
      confirmClearGallery = false;
    }
  }

  function openImageModal(image) {
    selectedImageModal = image;
  }

  function closeImageModal() {
    selectedImageModal = null;
  }

  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function formatDate(dateString) {
    return formatTimestamp(dateString);
  }

  // Load gallery on mount
  $effect(() => {
    if (browser) {
      loadGallery();
    }
  });
</script>

<svelte:head>
  <title>Gallery - Sensay AI</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
  <!-- Navigation -->
  <nav class="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
    <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
      <button 
        onclick={() => goto('/dashboard')} 
        class="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 12H5"/>
          <path d="M12 19l-7-7 7-7"/>
        </svg>
        Back to Dashboard
      </button>
      <ThemeToggle />
    </div>
  </nav>

  <!-- Header -->
  <header class="bg-white dark:bg-gray-800 shadow-sm">
    <div class="max-w-6xl mx-auto px-4 py-6">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">Gallery</h1>
      <p class="text-gray-600 dark:text-gray-400 mt-2">Organize your memories in albums and photos</p>
    </div>
  </header>

  <!-- Main Content -->
  <main class="max-w-6xl mx-auto px-4 py-8">
    <!-- Loading State -->
    {#if loading}
      <div class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p class="mt-2 text-gray-600 dark:text-gray-400">Loading gallery...</p>
      </div>
    {:else}
      <!-- Controls -->
      <div class="flex gap-4 mb-8">
        <button 
          onclick={openAddPhotoForm}
          class="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="9" cy="9" r="2"/>
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
          </svg>
          Upload Photos
        </button>

        {#if $galleryImages.length > 0}
          <button 
            onclick={() => confirmClearGallery = true}
            class="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3,6 5,6 21,6"/>
              <path d="m19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"/>
            </svg>
            Clear Gallery
          </button>
        {/if}
      </div>

      <!-- Error Display -->
      {#if error}
        <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p class="text-red-600 dark:text-red-400">{error}</p>
          <button 
            onclick={() => error = ''}
            class="mt-2 text-sm text-red-500 hover:text-red-700 dark:text-red-300 dark:hover:text-red-100"
          >
            Dismiss
          </button>
        </div>
      {/if}

      <!-- Photo Upload Form -->
      {#if showingAddPhoto}
        <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
          <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Upload Photos</h3>
          
          <form onsubmit={(e) => { e.preventDefault(); addPhotos(); }} class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Select Photos *</label>
              <input 
                type="file" 
                accept="image/*"
                multiple
                onchange={handlePhotoFiles}
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                required
              />
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Select up to 5 images, max 10MB each. Supported formats: JPEG, PNG, GIF, WebP
              </p>
            </div>

            {#if selectedFiles.length > 0}
              <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Selected Files ({selectedFiles.length})
                </h4>
                <ul class="space-y-1">
                  {#each selectedFiles as file, idx (file.name ?? idx)}
                    <li class="text-sm text-gray-600 dark:text-gray-400">
                      {file.name} ({formatFileSize(file.size)})
                    </li>
                  {/each}
                </ul>
              </div>
            {/if}

            {#if validationError}
              <p class="text-red-600 dark:text-red-400 text-sm">{validationError}</p>
            {/if}
            
            {#if uploadError}
              <p class="text-red-600 dark:text-red-400 text-sm">{uploadError}</p>
            {/if}

            <div class="flex gap-3">
              <button 
                type="submit"
                disabled={uploadInProgress || selectedFiles.length === 0}
                class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-md transition-colors"
              >
                {uploadInProgress ? 'Uploading...' : 'Upload Photos'}
              </button>
              <button 
                type="button" 
                onclick={resetPhotoForm}
                class="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-md transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      {/if}

      <!-- Gallery Display -->
      {#if $galleryImages.length === 0}
        <div class="text-center py-12">
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" class="mx-auto text-gray-400 dark:text-gray-600 mb-4">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="9" cy="9" r="2"/>
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
          </svg>
          <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No photos yet</h3>
          <p class="text-gray-500 dark:text-gray-400 mb-4">Upload your first photos to get started!</p>
          <button 
            onclick={openAddPhotoForm}
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
          >
            Upload Photos
          </button>
        </div>
      {:else}
        <div>
          <div class="flex justify-between items-center mb-6">
            <h2 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">
              Your Gallery ({$galleryImages.length} photos)
            </h2>
          </div>

          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {#each $galleryImages as image (image.imageId)}
              <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden group">
                <div class="aspect-square bg-gray-100 dark:bg-gray-700 cursor-pointer relative" onclick={() => openImageModal(image)}>
                  <img 
                    src={image.imageUrl} 
                    alt="Gallery image"
                    class="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                  <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200"></div>
                </div>
                
                <div class="p-2">
                  <p class="text-xs text-gray-500 dark:text-gray-500 mb-2">
                    {formatDate(image.uploadedAt)}
                  </p>
                  <div class="flex justify-end">
                    <button 
                      onclick={() => confirmDeleteImageId = image.imageId}
                      class="text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    {/if}
  </main>

  <!-- Image Modal -->
  {#if selectedImageModal}
    <div class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onclick={closeImageModal}>
      <div class="bg-white dark:bg-gray-800 rounded-lg max-w-4xl max-h-full overflow-auto" onclick={(e) => e.stopPropagation()}>
        <div class="p-4">
          <img 
            src={selectedImageModal.imageUrl} 
            alt="Gallery image"
            class="w-full h-auto max-h-[70vh] object-contain"
          />
          
          <div class="mt-4">
            <div class="flex justify-between items-center text-sm text-gray-500 dark:text-gray-500">
              <span>{formatDate(selectedImageModal.uploadedAt)}</span>
            </div>
          </div>
          
          <div class="flex justify-end gap-2 mt-4">
            <button 
              onclick={() => { confirmDeleteImageId = selectedImageModal.imageId; closeImageModal(); }}
              class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
            >
              Delete
            </button>
            <button 
              onclick={closeImageModal}
              class="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-md transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Delete Image Confirmation -->
  {#if confirmDeleteImageId}
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Delete Image</h3>
        <p class="text-gray-600 dark:text-gray-400 mb-6">
          Are you sure you want to delete this image? This action cannot be undone.
        </p>
        
        <div class="flex justify-end gap-3">
          <button 
            onclick={() => confirmDeleteImageId = null}
            class="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button 
            onclick={() => deleteImage(confirmDeleteImageId)}
            class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Clear Gallery Confirmation -->
  {#if confirmClearGallery}
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Clear Gallery</h3>
        <p class="text-gray-600 dark:text-gray-400 mb-6">
          Are you sure you want to delete all images in your gallery? This action cannot be undone.
        </p>
        
        <div class="flex justify-end gap-3">
          <button 
            onclick={() => confirmClearGallery = false}
            class="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button 
            onclick={handleClearGallery}
            class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
          >
            Clear All
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>