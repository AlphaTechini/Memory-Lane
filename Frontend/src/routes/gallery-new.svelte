<script>
  import { writable, derived } from 'svelte/store';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
  const STORAGE_ALBUMS_KEY = 'gallery_albums';
  const STORAGE_PHOTOS_KEY = 'gallery_photos';

  function genId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  function persistedStore(key, initialValue) {
    let stored = initialValue;
    if (browser) {
      try {
        const item = localStorage.getItem(key);
        stored = item ? JSON.parse(item) : initialValue;
      } catch (e) {
        console.warn(`Failed to load ${key} from localStorage:`, e);
      }
    }

    const store = writable(stored);

    if (browser) {
      store.subscribe(value => {
        try {
          localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
          console.warn(`Failed to save ${key} to localStorage:`, e);
        }
      });
    }

    return store;
  }

  const albums = persistedStore(STORAGE_ALBUMS_KEY, []);
  const photos = persistedStore(STORAGE_PHOTOS_KEY, []);

  const selectedAlbumId = writable(null);

  // Album form state
  let newAlbumTitle = $state('');
  let newAlbumDesc = $state('');
  let newAlbumDate = $state(new Date().toISOString().split('T')[0]);
  let editingAlbumId = $state(null);
  let editingAlbumTitle = $state('');
  let editingAlbumDesc = $state('');
  let editingAlbumDate = $state('');

  // Photo form state
  let newPhotoFile = $state(null);
  let newPhotoDesc = $state('');
  let newPhotoAlbumId = $state(null);
  let newPhotoDate = $state(new Date().toISOString().split('T')[0]);
  let editingPhotoId = $state(null);
  let editingPhotoDesc = $state('');
  let editingPhotoAlbumId = $state(null);
  let editingPhotoDate = $state('');

  // UI state
  let showingAddAlbum = $state(false);
  let showingAddPhoto = $state(false);
  let uploadInProgress = $state(false);
  let uploadError = $state('');
  let validationError = $state('');
  let confirmDeleteAlbumId = $state(null);
  let confirmDeletePhotoId = $state(null);
  let selectedImageModal = $state(null);

  const photosInSelectedAlbum = derived(
    [photos, selectedAlbumId],
    ([$photos, $selectedAlbumId]) => {
      if (!$selectedAlbumId) return $photos.filter(p => !p.albumId);
      return $photos.filter(p => p.albumId === $selectedAlbumId);
    }
  );

  $: selectedAlbum = $albums.find(a => a.id === $selectedAlbumId);

  function resetAlbumForm() {
    newAlbumTitle = '';
    newAlbumDesc = '';
    newAlbumDate = new Date().toISOString().split('T')[0];
    editingAlbumId = null;
    editingAlbumTitle = '';
    editingAlbumDesc = '';
    editingAlbumDate = '';
    showingAddAlbum = false;
    validationError = '';
  }

  function resetPhotoForm() {
    newPhotoFile = null;
    newPhotoDesc = '';
    newPhotoAlbumId = null;
    newPhotoDate = new Date().toISOString().split('T')[0];
    editingPhotoId = null;
    editingPhotoDesc = '';
    editingPhotoAlbumId = null;
    editingPhotoDate = '';
    showingAddPhoto = false;
    uploadError = '';
    validationError = '';
  }

  function openAddAlbumForm() {
    resetAlbumForm();
    showingAddAlbum = true;
  }

  function openAddPhotoForm(albumId = null) {
    resetPhotoForm();
    newPhotoAlbumId = albumId;
    showingAddPhoto = true;
  }

  function addAlbum() {
    if (!newAlbumTitle.trim()) {
      validationError = 'Album title is required';
      return;
    }

    const newAlbum = {
      id: genId(),
      title: newAlbumTitle.trim(),
      description: newAlbumDesc.trim(),
      date: newAlbumDate,
      createdAt: Date.now(),
      photoCount: 0
    };

    albums.update(list => [...list, newAlbum]);
    resetAlbumForm();
  }

  function editAlbum(album) {
    editingAlbumId = album.id;
    editingAlbumTitle = album.title;
    editingAlbumDesc = album.description;
    editingAlbumDate = album.date;
    showingAddAlbum = true;
  }

  function saveAlbumEdit() {
    if (!editingAlbumTitle.trim()) {
      validationError = 'Album title is required';
      return;
    }

    albums.update(list => 
      list.map(album => 
        album.id === editingAlbumId 
          ? { ...album, title: editingAlbumTitle.trim(), description: editingAlbumDesc.trim(), date: editingAlbumDate }
          : album
      )
    );
    resetAlbumForm();
  }

  function deleteAlbum(albumId) {
    albums.update(list => list.filter(a => a.id !== albumId));
    photos.update(list => list.filter(p => p.albumId !== albumId));
    
    if ($selectedAlbumId === albumId) {
      selectedAlbumId.set(null);
    }
    confirmDeleteAlbumId = null;
  }

  function handlePhotoFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      uploadError = 'File size must be less than 10MB';
      return;
    }

    if (!file.type.startsWith('image/')) {
      uploadError = 'Please select an image file';
      return;
    }

    newPhotoFile = file;
    uploadError = '';
  }

  function addPhoto() {
    if (!newPhotoFile) {
      validationError = 'Please select a photo';
      return;
    }

    uploadInProgress = true;
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const newPhoto = {
        id: genId(),
        url: e.target.result,
        filename: newPhotoFile.name,
        description: newPhotoDesc.trim(),
        albumId: newPhotoAlbumId,
        date: newPhotoDate,
        createdAt: Date.now(),
        size: newPhotoFile.size
      };

      photos.update(list => [...list, newPhoto]);
      
      // Update album photo count
      if (newPhotoAlbumId) {
        albums.update(list => 
          list.map(album => 
            album.id === newPhotoAlbumId 
              ? { ...album, photoCount: album.photoCount + 1 }
              : album
          )
        );
      }

      resetPhotoForm();
      uploadInProgress = false;
    };

    reader.onerror = () => {
      uploadError = 'Failed to read file';
      uploadInProgress = false;
    };

    reader.readAsDataURL(newPhotoFile);
  }

  function editPhoto(photo) {
    editingPhotoId = photo.id;
    editingPhotoDesc = photo.description;
    editingPhotoAlbumId = photo.albumId;
    editingPhotoDate = photo.date;
    showingAddPhoto = true;
  }

  function savePhotoEdit() {
    photos.update(list => 
      list.map(photo => 
        photo.id === editingPhotoId 
          ? { ...photo, description: editingPhotoDesc.trim(), albumId: editingPhotoAlbumId, date: editingPhotoDate }
          : photo
      )
    );
    resetPhotoForm();
  }

  function deletePhoto(photoId) {
    const photo = $photos.find(p => p.id === photoId);
    photos.update(list => list.filter(p => p.id !== photoId));
    
    // Update album photo count
    if (photo?.albumId) {
      albums.update(list => 
        list.map(album => 
          album.id === photo.albumId 
            ? { ...album, photoCount: Math.max(0, album.photoCount - 1) }
            : album
        )
      );
    }
    
    confirmDeletePhotoId = null;
  }

  function selectAlbum(albumId) {
    selectedAlbumId.set(albumId);
  }

  function showAllPhotos() {
    selectedAlbumId.set(null);
  }

  function openImageModal(photo) {
    selectedImageModal = photo;
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

  import { formatTimestamp } from '$lib/utils/formatDate.js';
  function formatDate(dateString) {
    return formatTimestamp(dateString);
  }
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
    <!-- Controls -->
    <div class="flex gap-4 mb-8">
      <button 
        onclick={openAddAlbumForm}
        class="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14"/>
          <path d="M5 12h14"/>
        </svg>
        Add Album
      </button>
      
      <button 
        onclick={() => openAddPhotoForm()}
        class="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="9" cy="9" r="2"/>
          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
        </svg>
        Add Photo
      </button>

      {#if $selectedAlbumId}
        <button 
          onclick={showAllPhotos}
          class="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
        >
          View All
        </button>
      {/if}
    </div>

    <!-- Album Form -->
    {#if showingAddAlbum}
      <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
        <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
          {editingAlbumId ? 'Edit Album' : 'Create New Album'}
        </h3>
        
        <form onsubmit={(e) => { e.preventDefault(); editingAlbumId ? saveAlbumEdit() : addAlbum(); }} class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Title *</label>
            <input 
              type="text" 
              bind:value={editingAlbumId ? editingAlbumTitle : newAlbumTitle}
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="Album title"
              required
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Description</label>
            <textarea 
              bind:value={editingAlbumId ? editingAlbumDesc : newAlbumDesc}
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              rows="3"
              placeholder="Album description"
            ></textarea>
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Date</label>
            <input 
              type="date" 
              bind:value={editingAlbumId ? editingAlbumDate : newAlbumDate}
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>

          {#if validationError}
            <p class="text-red-600 dark:text-red-400 text-sm">{validationError}</p>
          {/if}

          <div class="flex gap-3">
            <button 
              type="submit"
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
            >
              {editingAlbumId ? 'Save Changes' : 'Create Album'}
            </button>
            <button 
              type="button" 
              onclick={resetAlbumForm}
              class="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-md transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    {/if}

    <!-- Photo Form -->
    {#if showingAddPhoto}
      <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
        <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
          {editingPhotoId ? 'Edit Photo' : 'Add New Photo'}
        </h3>
        
        <form onsubmit={(e) => { e.preventDefault(); editingPhotoId ? savePhotoEdit() : addPhoto(); }} class="space-y-4">
          {#if !editingPhotoId}
            <div>
              <label class="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Photo File *</label>
              <input 
                type="file" 
                accept="image/*"
                onchange={handlePhotoFile}
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                required
              />
            </div>
          {/if}
          
          <div>
            <label class="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Album</label>
            <select 
              bind:value={editingPhotoId ? editingPhotoAlbumId : newPhotoAlbumId}
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value={null}>No Album</option>
              {#each $albums as album (album.id)}
                <option value={album.id}>{album.title}</option>
              {/each}
            </select>
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Description</label>
            <textarea 
              bind:value={editingPhotoId ? editingPhotoDesc : newPhotoDesc}
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              rows="3"
              placeholder="Photo description"
            ></textarea>
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Date</label>
            <input 
              type="date" 
              bind:value={editingPhotoId ? editingPhotoDate : newPhotoDate}
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>

          {#if validationError}
            <p class="text-red-600 dark:text-red-400 text-sm">{validationError}</p>
          {/if}
          
          {#if uploadError}
            <p class="text-red-600 dark:text-red-400 text-sm">{uploadError}</p>
          {/if}

          <div class="flex gap-3">
            <button 
              type="submit"
              disabled={uploadInProgress}
              class="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-md transition-colors"
            >
              {uploadInProgress ? 'Uploading...' : editingPhotoId ? 'Save Changes' : 'Upload Photo'}
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

    <!-- Content Display -->
    {#if !$selectedAlbumId}
      <!-- Albums Grid -->
      <section class="mb-12">
        <h2 class="text-2xl font-semibold mb-6 text-gray-900 dark:text-gray-100">Albums</h2>
        {#if $albums.length === 0}
          <p class="text-gray-500 dark:text-gray-400 text-center py-12">No albums created yet. Create your first album to get started!</p>
        {:else}
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {#each $albums as album (album.id)}
              <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow">
                <div class="aspect-video bg-gray-100 dark:bg-gray-700 relative cursor-pointer" onclick={() => selectAlbum(album.id)}>
                  {#if $photos.find(p => p.albumId === album.id)}
                    <img 
                      src={$photos.find(p => p.albumId === album.id)?.url} 
                      alt="Album cover"
                      class="w-full h-full object-cover"
                    />
                  {:else}
                    <div class="flex items-center justify-center h-full text-gray-400">
                      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <circle cx="9" cy="9" r="2"/>
                        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                      </svg>
                    </div>
                  {/if}
                </div>
                
                <div class="p-4">
                  <h3 class="font-semibold text-gray-900 dark:text-gray-100 mb-1">{album.title}</h3>
                  {#if album.description}
                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">{album.description}</p>
                  {/if}
                  <p class="text-xs text-gray-500 dark:text-gray-500 mb-3">{formatDate(album.date)}</p>
                  
                  <div class="flex justify-between items-center">
                    <span class="text-sm text-gray-500 dark:text-gray-400">
                      {$photos.filter(p => p.albumId === album.id).length} photos
                    </span>
                    <div class="flex gap-2">
                      <button 
                        onclick={() => editAlbum(album)}
                        class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 text-sm"
                      >
                        Edit
                      </button>
                      <button 
                        onclick={() => confirmDeleteAlbumId = album.id}
                        class="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </section>

      <!-- Unorganized Photos -->
      <section>
        <h2 class="text-2xl font-semibold mb-6 text-gray-900 dark:text-gray-100">Unorganized Photos</h2>
        {#if $photos.filter(p => !p.albumId).length === 0}
          <p class="text-gray-500 dark:text-gray-400 text-center py-12">No unorganized photos.</p>
        {:else}
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {#each $photos.filter(p => !p.albumId) as photo (photo.id)}
              <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div class="aspect-square bg-gray-100 dark:bg-gray-700 cursor-pointer" onclick={() => openImageModal(photo)}>
                  <img 
                    src={photo.url} 
                    alt={photo.description || 'Photo'}
                    class="w-full h-full object-cover"
                  />
                </div>
                
                <div class="p-2">
                  <p class="text-xs text-gray-500 dark:text-gray-500 mb-2">{formatDate(photo.date)}</p>
                  <div class="flex justify-between">
                    <button 
                      onclick={() => editPhoto(photo)}
                      class="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
                    >
                      Edit
                    </button>
                    <button 
                      onclick={() => confirmDeletePhotoId = photo.id}
                      class="text-xs text-red-600 hover:text-red-800 dark:text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </section>
    {:else}
      <!-- Album View -->
      <section>
        <div class="flex items-center gap-4 mb-6">
          <button 
            onclick={showAllPhotos}
            class="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5"/>
              <path d="M12 19l-7-7 7-7"/>
            </svg>
            Back to Albums
          </button>
          
          <div>
            <h2 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">{selectedAlbum?.title}</h2>
            {#if selectedAlbum?.description}
              <p class="text-gray-600 dark:text-gray-400">{selectedAlbum.description}</p>
            {/if}
            <p class="text-sm text-gray-500 dark:text-gray-500">{formatDate(selectedAlbum?.date)}</p>
          </div>
        </div>

        {#if $photosInSelectedAlbum.length === 0}
          <p class="text-gray-500 dark:text-gray-400 text-center py-12">No photos in this album yet.</p>
        {:else}
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {#each $photosInSelectedAlbum as photo (photo.id)}
              <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div class="aspect-square bg-gray-100 dark:bg-gray-700 cursor-pointer" onclick={() => openImageModal(photo)}>
                  <img 
                    src={photo.url} 
                    alt={photo.description || 'Photo'}
                    class="w-full h-full object-cover"
                  />
                </div>
                
                <div class="p-2">
                  <p class="text-xs text-gray-500 dark:text-gray-500 mb-2">{formatDate(photo.date)}</p>
                  <div class="flex justify-between">
                    <button 
                      onclick={() => editPhoto(photo)}
                      class="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
                    >
                      Edit
                    </button>
                    <button 
                      onclick={() => confirmDeletePhotoId = photo.id}
                      class="text-xs text-red-600 hover:text-red-800 dark:text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </section>
    {/if}
  </main>

  <!-- Image Modal -->
  {#if selectedImageModal}
    <div class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onclick={closeImageModal}>
      <div class="bg-white dark:bg-gray-800 rounded-lg max-w-4xl max-h-full overflow-auto" onclick={(e) => e.stopPropagation()}>
        <div class="p-4">
          <img 
            src={selectedImageModal.url} 
            alt={selectedImageModal.description || 'Photo'}
            class="w-full h-auto max-h-[70vh] object-contain"
          />
          
          <div class="mt-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {selectedImageModal.filename}
            </h3>
            {#if selectedImageModal.description}
              <p class="text-gray-600 dark:text-gray-400 mb-2">{selectedImageModal.description}</p>
            {/if}
            <div class="flex justify-between items-center text-sm text-gray-500 dark:text-gray-500">
              <span>{formatDate(selectedImageModal.date)}</span>
              <span>{formatFileSize(selectedImageModal.size)}</span>
            </div>
          </div>
          
          <div class="flex justify-end gap-2 mt-4">
            <button 
              onclick={() => { editPhoto(selectedImageModal); closeImageModal(); }}
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
            >
              Edit
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

  <!-- Delete Album Confirmation -->
  {#if confirmDeleteAlbumId}
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Delete Album</h3>
        <p class="text-gray-600 dark:text-gray-400 mb-6">
          Are you sure you want to delete this album? All photos in this album will also be deleted. This action cannot be undone.
        </p>
        
        <div class="flex justify-end gap-3">
          <button 
            onclick={() => confirmDeleteAlbumId = null}
            class="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button 
            onclick={() => deleteAlbum(confirmDeleteAlbumId)}
            class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Delete Photo Confirmation -->
  {#if confirmDeletePhotoId}
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Delete Photo</h3>
        <p class="text-gray-600 dark:text-gray-400 mb-6">
          Are you sure you want to delete this photo? This action cannot be undone.
        </p>
        
        <div class="flex justify-end gap-3">
          <button 
            onclick={() => confirmDeletePhotoId = null}
            class="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button 
            onclick={() => deletePhoto(confirmDeletePhotoId)}
            class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>
