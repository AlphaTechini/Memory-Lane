<script>
  import { onMount } from "svelte";
  import { wizardStore } from "$lib/stores/wizardStore.js";
  import { apiUrl } from "$lib/utils/api.js";

  let fileInput = $state(null);
  let isUploading = $state(false);
  let uploadError = $state(null);
  let dragOver = $state(false);

  // Get wizard state reactively
  let wizardState = $state({});

  // Subscribe to wizard store
  let unsubscribe;
  onMount(() => {
    unsubscribe = wizardStore.subscribe((value) => {
      wizardState = value;
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  });

  // Image validation
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

  function validateFile(file) {
    if (!file) return { valid: false, error: "No file selected" };

    if (!ALLOWED_TYPES.includes(file.type)) {
      return {
        valid: false,
        error: "Please upload a JPEG, PNG, or WebP image",
      };
    }

    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: "File size must be less than 10MB" };
    }

    return { valid: true };
  }

  async function uploadToBackend(file) {
    const formData = new FormData();
    formData.append("image", file);

    try {
      const response = await fetch(apiUrl("/replica/upload"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.errors?.[0] || "Upload failed");
      }

      const result = await response.json();
      return {
        success: true,
        url: result.data.replicaImageUrl,
        publicId: result.data.replicaImageId,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
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
        isUploaded: false,
      });

      // Upload to backend
      const uploadResult = await uploadToBackend(file);

      if (uploadResult.success) {
        wizardStore.updateProfileImage({
          file: file,
          previewUrl: previewUrl,
          cloudinaryUrl: uploadResult.url,
          publicId: uploadResult.publicId,
          isUploaded: true,
        });
      } else {
        uploadError = uploadResult.error;
        wizardStore.updateProfileImage(null);
      }
    } catch (error) {
      console.error("Profile image upload failed:", error);
      uploadError = "Upload failed. Please try again.";
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
      fileInput.value = "";
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
    <h2
      class="text-3xl font-bold text-text-light dark:text-text-dark mb-2 font-serif"
    >
      Profile Image
    </h2>
    <p class="text-charcoal-600 dark:text-cream-400 leading-relaxed">
      Upload a profile picture for your replica. This will be the avatar that
      represents your digital twin.
    </p>
  </div>

  <div class="max-w-lg mx-auto">
    {#if wizardState?.profileImage?.previewUrl}
      <!-- Image Preview -->
      <div class="mb-6">
        <div class="relative">
          <div
            class="w-64 h-64 mx-auto rounded-full overflow-hidden border-4 border-cream-200 dark:border-charcoal-600 shadow-md"
          >
            <img
              src={wizardState.profileImage.previewUrl}
              alt="Profile preview"
              class="w-full h-full object-cover"
            />
          </div>

          <!-- Upload status indicator -->
          <div class="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
            {#if isUploading}
              <div
                class="bg-primary text-white px-3 py-1.5 rounded-full text-xs flex items-center gap-2 shadow-sm font-medium"
              >
                <svg
                  class="animate-spin w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  ></path>
                </svg>
                Uploading...
              </div>
            {:else if wizardState.profileImage.isUploaded}
              <div
                class="bg-success text-white px-3 py-1.5 rounded-full text-xs flex items-center gap-1.5 shadow-sm font-medium"
              >
                <span class="material-symbols-outlined text-[14px]"
                  >check_circle</span
                >
                Uploaded
              </div>
            {:else}
              <div
                class="bg-warning text-white px-3 py-1.5 rounded-full text-xs shadow-sm font-medium"
              >
                Processing...
              </div>
            {/if}
          </div>
        </div>

        <!-- Image actions -->
        <div class="mt-8 flex justify-center gap-3">
          <button
            onclick={triggerFileSelect}
            disabled={isUploading}
            class="btn-tactile btn-tactile-primary px-5 py-2 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-1.5"
          >
            <span class="material-symbols-outlined text-[18px]">imagesmode</span
            >
            Change Image
          </button>
          <button
            onclick={removeImage}
            disabled={isUploading}
            class="btn-tactile px-5 py-2 border border-cream-300 dark:border-charcoal-600 text-charcoal-700 dark:text-cream-300 rounded-md hover:bg-cream-100 dark:hover:bg-charcoal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
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
        class="border-2 border-dashed rounded-xl p-10 text-center transition-all bg-surface-light dark:bg-surface-dark {dragOver
          ? 'border-primary bg-primary/5 dark:bg-primary/10'
          : 'border-cream-300 dark:border-charcoal-600 hover:border-primary/50'}"
        ondrop={handleDrop}
        ondragover={handleDragOver}
        ondragleave={handleDragLeave}
        onkeydown={(e) => e.key === "Enter" && triggerFileSelect()}
      >
        <div
          class="w-16 h-16 mx-auto mb-5 text-charcoal-300 dark:text-charcoal-500 flex items-center justify-center"
        >
          <span class="material-symbols-outlined text-4xl">cloud_upload</span>
        </div>

        <div class="mb-6">
          <p
            class="text-xl font-semibold text-text-light dark:text-text-dark mb-2 font-serif"
          >
            Upload Profile Image
          </p>
          <p class="text-[15px] text-charcoal-500 dark:text-cream-400">
            Drag and drop an image here, or click to select
          </p>
        </div>

        <button
          onclick={triggerFileSelect}
          disabled={isUploading}
          class="btn-tactile btn-tactile-primary px-6 py-2.5 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2 mx-auto"
        >
          {#if isUploading}
            <svg
              class="animate-spin w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              ><path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              ></path></svg
            >
            Uploading...
          {:else}
            <span class="material-symbols-outlined text-[18px]"
              >add_photo_alternate</span
            >
            Choose Image
          {/if}
        </button>

        <div
          class="mt-6 text-[13px] text-charcoal-400 dark:text-charcoal-500 flex flex-col items-center gap-1 font-medium"
        >
          <p>Supported formats: JPEG, PNG, WebP</p>
          <p>Maximum size: 10MB</p>
          <p>Recommended: Square image, at least 400x400px</p>
        </div>
      </div>
    {/if}

    <!-- Error Message -->
    {#if uploadError}
      <div class="mt-6 p-4 bg-error/10 border border-error/20 rounded-xl">
        <div class="flex items-start gap-3">
          <span class="material-symbols-outlined text-error mt-0.5">error</span>
          <div>
            <h3 class="font-semibold text-error">Upload Error</h3>
            <p class="text-[14px] text-error/80 mt-1">{uploadError}</p>
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
    <div
      class="mt-8 p-5 bg-primary/5 dark:bg-primary/10 border border-primary/20 dark:border-primary/30 rounded-xl"
    >
      <div class="flex items-start gap-4">
        <span
          class="material-symbols-outlined text-primary dark:text-secondary mt-0.5"
          >info</span
        >
        <div>
          <h3 class="font-semibold text-text-light dark:text-text-dark">
            Optional Step
          </h3>
          <p
            class="text-[14px] text-charcoal-700 dark:text-cream-300 mt-1.5 leading-relaxed"
          >
            Adding a profile image is optional. You can skip this step and add
            an image later if you prefer. A default avatar will be used if no
            image is provided.
          </p>
        </div>
      </div>
    </div>

    <!-- Tips -->
    <div
      class="mt-6 bg-surface-light dark:bg-surface-dark border border-cream-200 dark:border-charcoal-700 rounded-xl p-5 shadow-sm"
    >
      <h3
        class="font-semibold text-text-light dark:text-text-dark mb-3 text-[15px]"
      >
        Tips for a great profile image:
      </h3>
      <ul class="text-[14px] text-charcoal-600 dark:text-cream-400 space-y-2">
        <li class="flex items-center gap-2">
          <span
            class="text-primary text-xl leading-none w-3 flex justify-center"
            >•</span
          > Use a clear, well-lit photo of yourself
        </li>
        <li class="flex items-center gap-2">
          <span
            class="text-primary text-xl leading-none w-3 flex justify-center"
            >•</span
          > Square images work best for profile pictures
        </li>
        <li class="flex items-center gap-2">
          <span
            class="text-primary text-xl leading-none w-3 flex justify-center"
            >•</span
          > Make sure your face is clearly visible
        </li>
        <li class="flex items-center gap-2">
          <span
            class="text-primary text-xl leading-none w-3 flex justify-center"
            >•</span
          > Avoid busy backgrounds or multiple people
        </li>
        <li class="flex items-center gap-2">
          <span
            class="text-primary text-xl leading-none w-3 flex justify-center"
            >•</span
          > High resolution images will look better
        </li>
      </ul>
    </div>
  </div>
</div>
