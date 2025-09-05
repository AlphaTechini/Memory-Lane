<script>
  import { onMount } from 'svelte';
  import { wizardStore } from '$lib/stores/wizardStore.js';

  let fileInput = $state(null);
  let isUploading = $state(false);
  let uploadError = $state(null);
  let dragOver = $state(false);
  
  // Get wizard state reactively
  let wizardState = $state({});
  
  // Subscribe to wizard store
  let unsubscribe;
  onMount(() => {
    unsubscribe = wizardStore.subscribe(value => {
      wizardState = value;
    });
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  });

  // Image validation
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  function validateFile(file) {
    if (!file) return { valid: false, error: 'No file selected' };
    
    if (!ALLOWED_TYPES.includes(file.type)) {
      return { valid: false, error: 'Please upload a JPEG, PNG, or WebP image' };
    }
    
    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: 'File size must be less than 10MB' };
    }
    
    return { valid: true };
  }

  async function uploadToBackend(file) {
    const formData = new FormData();
    formData.append('image', file);
    
    try {
      const response = await fetch('http://localhost:4000/replica/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.errors?.[0] || 'Upload failed');
      }
      
      const result = await response.json();
      return {
        success: true,
        url: result.data.replicaImageUrl,
        publicId: result.data.replicaImageId
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async function handleFileUpload(file) {
    if (!file) return;
    
    const validation = validateFile(file);
    if (!validation.valid) {
      uploadError = validation.error;
      return;
    }

    isUploading = true;
    uploadError = null;

    try {
      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      wizardStore.updateProfileImage({
        file: file,
        previewUrl: previewUrl,
        isUploaded: false
      });

      // Upload to backend
      const uploadResult = await uploadToBackend(file);
      
      if (uploadResult.success) {
        wizardStore.updateProfileImage({
          file: file,
          previewUrl: previewUrl,
          cloudinaryUrl: uploadResult.url,
          publicId: uploadResult.publicId,
          isUploaded: true
        });
      } else {
        uploadError = uploadResult.error;
        wizardStore.updateProfileImage(null);
      }
    } catch (error) {
      uploadError = 'Upload failed. Please try again.';
      wizardStore.updateProfileImage(null);
    } finally {
      isUploading = false;
    }
  }

  function handleFileSelect(event) {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    dragOver = false;
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  }

  function handleDragOver(event) {
    event.preventDefault();
    dragOver = true;
  }

  function handleDragLeave(event) {
    event.preventDefault();
    dragOver = false;
  }

  function removeImage() {
    if (wizardState?.profileImage?.previewUrl) {
      URL.revokeObjectURL(wizardState.profileImage.previewUrl);
    }
    wizardStore.updateProfileImage(null);
    uploadError = null;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  function triggerFileSelect() {
    fileInput?.click();
  }

  // Cleanup preview URL on component destroy
  $effect(() => {
    return () => {
      if (wizardState?.profileImage?.previewUrl) {
        URL.revokeObjectURL(wizardState.profileImage.previewUrl);
      }
    };
  });
</script>

<!-- Hidden file input -->
<input
  bind:this={fileInput}
  type="file"
  accept=".jpg,.jpeg,.png,.webp"
  style="display: none;"
  onchange={handleFileSelect}
/>

<div class="p-6">
  <div class="mb-6">
    <h2 class="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Profile Image</h2>
    <p class="text-gray-600 dark:text-gray-400">
      Upload a profile picture for your replica. This will be the avatar that represents your digital twin.
    </p>
  </div>

  <div class="max-w-lg mx-auto">
    {#if wizardState?.profileImage?.previewUrl}
      <!-- Image Preview -->
      <div class="mb-6">
        <div class="relative">
          <div class="w-64 h-64 mx-auto rounded-full overflow-hidden border-4 border-gray-200 dark:border-gray-600 shadow-lg">
            <img 
              src={wizardState.profileImage.previewUrl} 
              alt="Profile preview"
              class="w-full h-full object-cover"
            />
          </div>
          
          <!-- Upload status indicator -->
          <div class="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
            {#if isUploading}
              <div class="bg-blue-600 text-white px-3 py-1 rounded-full text-xs flex items-center gap-2">
                <svg class="animate-spin w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                </svg>
                Uploading...
              </div>
            {:else if wizardState.profileImage.isUploaded}
              <div class="bg-green-600 text-white px-3 py-1 rounded-full text-xs flex items-center gap-1">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                Uploaded
              </div>
            {:else}
              <div class="bg-yellow-600 text-white px-3 py-1 rounded-full text-xs">
                Processing...
              </div>
            {/if}
          </div>
        </div>

        <!-- Image actions -->
        <div class="mt-6 flex justify-center gap-3">
          <button
            onclick={triggerFileSelect}
            disabled={isUploading}
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Change Image
          </button>
          <button
            onclick={removeImage}
            disabled={isUploading}
            class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Remove
          </button>
        </div>
      </div>
    {:else}
      <!-- Upload Area -->
      <div
        role="button"
        tabindex="0"
        class="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center transition-colors {dragOver ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''}"
        ondrop={handleDrop}
        ondragover={handleDragOver}
        ondragleave={handleDragLeave}
        onkeydown={(e) => e.key === 'Enter' && triggerFileSelect()}
      >
        <div class="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-500">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
          </svg>
        </div>
        
        <div class="mb-4">
          <p class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            Upload Profile Image
          </p>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Drag and drop an image here, or click to select
          </p>
        </div>

        <button
          onclick={triggerFileSelect}
          disabled={isUploading}
          class="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isUploading ? 'Uploading...' : 'Choose Image'}
        </button>

        <div class="mt-4 text-xs text-gray-500 dark:text-gray-400">
          <p>Supported formats: JPEG, PNG, WebP</p>
          <p>Maximum size: 10MB</p>
          <p>Recommended: Square image, at least 400x400px</p>
        </div>
      </div>
    {/if}

    <!-- Error Message -->
    {#if uploadError}
      <div class="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <div class="flex items-start gap-3">
          <svg class="flex-shrink-0 w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div>
            <h3 class="font-medium text-red-800 dark:text-red-200">Upload Error</h3>
            <p class="text-sm text-red-700 dark:text-red-300 mt-1">{uploadError}</p>
          </div>
        </div>
      </div>
    {/if}

    <!-- Hidden file input -->
    <input
      bind:this={fileInput}
      type="file"
      accept="image/jpeg,image/jpg,image/png,image/webp"
      onchange={handleFileSelect}
      class="hidden"
    />

    <!-- Optional Notice -->
    <div class="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
      <div class="flex items-start gap-3">
        <svg class="flex-shrink-0 w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <div>
          <h3 class="font-medium text-blue-800 dark:text-blue-200">Optional Step</h3>
          <p class="text-sm text-blue-700 dark:text-blue-300 mt-1">
            Adding a profile image is optional. You can skip this step and add an image later if you prefer.
            A default avatar will be used if no image is provided.
          </p>
        </div>
      </div>
    </div>

    <!-- Tips -->
    <div class="mt-6 bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
      <h3 class="font-medium text-gray-900 dark:text-gray-100 mb-3">Tips for a great profile image:</h3>
      <ul class="text-sm text-gray-600 dark:text-gray-400 space-y-1">
        <li>• Use a clear, well-lit photo of yourself</li>
        <li>• Square images work best for profile pictures</li>
        <li>• Make sure your face is clearly visible</li>
        <li>• Avoid busy backgrounds or multiple people</li>
        <li>• High resolution images will look better</li>
      </ul>
    </div>
  </div>
</div>
