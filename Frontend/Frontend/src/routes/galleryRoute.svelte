<script>
  import { writable } from 'svelte/store';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';

  // Gallery store for persistent images
  function createGalleryStore() {
    let initialImages = [];
    if (browser) {
      const stored = localStorage.getItem('gallery_images');
      if (stored) {
        try {
          initialImages = JSON.parse(stored);
        } catch (e) {
          console.error('Failed to parse gallery images', e);
        }
      }
    }

    const { subscribe, update } = writable(initialImages);

    if (browser) {
      subscribe((images) => {
        localStorage.setItem('gallery_images', JSON.stringify(images));
      });
    }

    return {
      subscribe,
      addImage: (imageData) => update(images => [...images, {
        id: crypto.randomUUID(),
        ...imageData,
        timestamp: Date.now()
      }]),
      removeImage: (id) => update(images => images.filter(img => img.id !== id))
    };
  }

  const galleryStore = createGalleryStore();
  let fileInput = $state(null);
  let selectedImage = $state(null);
  let showUploadModal = $state(false);

  function openFileDialog() {
    fileInput?.click();
  }

  function removeImage(id) {
    if (confirm('Are you sure you want to delete this image?')) {
      galleryStore.removeImage(id);
    }
  }

  function openImageModal(image) {
    selectedImage = image;
  }

  function closeImageModal() {
    selectedImage = null;
  }

  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
</script>

<svelte:head>
  <title>Gallery - Memory Lane</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900">
  <!-- Navigation -->
  <nav class="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
    <div class="max-w-6xl mx-auto px-4 py-4">
      <div class="flex justify-between items-center">
        <div class="flex items-center space-x-4">
          <button
            onclick={() => goto('/')}
            class="flex items-center space-x-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m12 19-7-7 7-7"/>
              <path d="M19 12H5"/>
            </svg>
            <span>Back to Memory Lane</span>
          </button>
        </div>
        <ThemeToggle />
      </div>
    </div>
  </nav>

  <!-- Header -->
  <header class="bg-white dark:bg-gray-800 shadow-sm">
    <div class="max-w-6xl mx-auto px-4 py-6">
      <div class="flex justify-between items-center">
        <div>
          <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Gallery</h1>
          <p class="text-gray-600 dark:text-gray-400 mt-1">Your photo collection</p>
        </div>
        <button
          onclick={() => showUploadModal = true}
          class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
            <circle cx="12" cy="13" r="3"/>
          </svg>
          Add Photos
        </button>
      </div>
    </div>
  </header>

  <!-- Gallery Grid -->
  <main class="max-w-6xl mx-auto px-4 py-8">
    {#if $galleryStore.length === 0}
      <div class="text-center py-16">
        <div class="w-24 h-24 mx-auto mb-4 text-gray-400">
          <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
            <circle cx="9" cy="9" r="2"/>
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
          </svg>
        </div>
        <h3 class="text-xl font-medium text-gray-900 dark:text-white mb-2">No photos yet</h3>
        <p class="text-gray-600 dark:text-gray-400 mb-4">Start building your memory collection</p>
        <button
          onclick={() => showUploadModal = true}
          class="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg transition-colors"
        >
          Upload Your First Photo
        </button>
      </div>
    {:else}
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {#each $galleryStore as image (image.id)}
          <div class="group relative bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 overflow-hidden">
            <button
              onclick={() => openImageModal(image)}
              class="w-full aspect-square overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <img
                src={image.url}
                alt={image.name}
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                loading="lazy"
              />
            </button>
            
            <!-- Image Info -->
            <div class="p-3">
              <h3 class="font-medium text-gray-900 dark:text-white truncate" title={image.name}>
                {image.name}
              </h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                {formatFileSize(image.size)}
              </p>
            </div>

            <!-- Delete Button -->
            <button
              onclick={() => removeImage(image.id)}
              class="absolute top-2 right-2 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-red-300"
              aria-label="Delete image"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 6 6 18"/>
                <path d="m6 6 12 12"/>
              </svg>
            </button>
          </div>
        {/each}
      </div>
    {/if}
  </main>

  <!-- Upload Modal -->
  {#if showUploadModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center">
      <button 
        class="absolute inset-0 bg-black opacity-50" 
        onclick={() => showUploadModal = false}
        aria-label="Close modal"
      ></button>
      
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 relative z-10">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-bold text-gray-900 dark:text-white">Add Photos</h2>
          <button
            onclick={() => showUploadModal = false}
            class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 6 6 18"/>
              <path d="m6 6 12 12"/>
            </svg>
          </button>
        </div>

        <div class="space-y-4">
          <button
            onclick={openFileDialog}
            class="w-full p-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center hover:border-blue-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <div class="w-12 h-12 mx-auto mb-3 text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
                <circle cx="12" cy="13" r="3"/>
              </svg>
            </div>
            <p class="text-gray-600 dark:text-gray-400">Click to select photos</p>
            <p class="text-sm text-gray-500 dark:text-gray-500 mt-1">JPG, PNG, GIF up to 10MB</p>
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Image Modal -->
  {#if selectedImage}
    <div class="fixed inset-0 z-50 flex items-center justify-center">
      <button 
        class="absolute inset-0 bg-black opacity-75" 
        onclick={closeImageModal}
        aria-label="Close image"
      ></button>
      
      <div class="relative z-10 max-w-4xl mx-auto p-4">
        <img
          src={selectedImage.src}
          alt={selectedImage.alt}
          class="max-w-full max-h-screen object-contain mx-auto"
        />
        <div class="text-center mt-4">
          <h3 class="text-white text-lg font-semibold">{selectedImage.alt}</h3>
          <button
            onclick={closeImageModal}
            class="mt-2 px-4 py-2 bg-white text-gray-900 rounded-md hover:bg-gray-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>