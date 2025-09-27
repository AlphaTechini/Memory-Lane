<script>
  import { wizardStore } from '$lib/stores/wizardStore.js';
  import { createKnowledgeBaseEntry, uploadToSignedUrl, getKnowledgeBaseEntry, getKnowledgeBaseEntries } from '$lib/knowledgeBase.js';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  let state = $state({
    knowledgeBase: {
      entries: [],
      currentEntry: {
        title: '',
        text: '',
        url: '',
        filename: '',
        autoRefresh: false,
        inputType: 'text'
      }
    }
  });
  let isLoading = $state(false);
  let isLoadingEntries = $state(false);
  let error = $state(null);
  let selectedFile = null;
  let progressMessage = $state('');

  // Helper to get auth headers
  function getAuthHeaders() {
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }

  // Subscribe to wizard store
  $effect(() => {
    const unsubscribe = wizardStore.subscribe(value => {
      state = value;
    });
    return unsubscribe;
  });

  // Track replicaId and load entries when it becomes available
  let replicaId = null;
  $effect(() => {
    const w = wizardStore.getState?.() || state;
    replicaId = w?.replicaId || null;
    if (replicaId) {
      loadExistingEntries(replicaId);
    }
  });

  async function loadExistingEntries(replicaId) {
    isLoadingEntries = true;
    try {
      const entries = await getKnowledgeBaseEntries(replicaId);
      // Update wizard store with server entries
      entries.forEach(entry => {
        const formattedEntry = {
          id: entry.id,
          title: entry.title || entry.generatedTitle || `Entry ${entry.id}`,
          inputType: entry.website ? 'url' : entry.file ? 'file' : 'text',
          text: entry.rawText,
          url: entry.website?.url,
          filename: entry.file?.name,
          status: entry.status || 'PROCESSING',
          autoRefresh: entry.website?.autoRefresh || false
        };
        wizardStore.addKnowledgeBaseEntry(formattedEntry);
      });
    } catch (err) {
      console.warn('Failed to load existing KB entries:', err);
    } finally {
      isLoadingEntries = false;
    }
  }

  function updateCurrentEntry(field, value) {
    wizardStore.updateKnowledgeBaseEntry(field, value);
  }

  function addEntry() {
    const { currentEntry } = state.knowledgeBase;
    
    // Validate based on input type
    if (currentEntry.inputType === 'text' && !currentEntry.text.trim()) {
      error = 'Please enter some text content';
      return;
    }
    if (currentEntry.inputType === 'url' && !currentEntry.url.trim()) {
      error = 'Please enter a valid URL';
      return;
    }
    if (currentEntry.inputType === 'file' && !currentEntry.filename.trim()) {
      error = 'Please select a file';
      return;
    }

    error = null;
    // If it's a file, ensure we have the file blob in `selectedFile`
    if (currentEntry.inputType === 'file') {
      if (!selectedFile) {
        error = 'Please select a file to upload';
        return;
      }
    }

    // Optimistically add to store with a temp id and mark as processing
    const tempId = `local_${Date.now()}`;
    wizardStore.addKnowledgeBaseEntry({ ...currentEntry, id: tempId, status: 'PROCESSING' });

    // Start async upload/create flow
    isLoading = true;
    progressMessage = 'Creating knowledge base entry...';
    (async () => {
      try {
        // Determine replicaId from wizard store state
        const currentWizard = wizardStore.getState?.() || state;
        const replicaIdToUse = currentWizard.replicaId || null;
        if (!replicaIdToUse) {
          throw new Error('Replica ID not set. Please create or select a replica before adding KB entries.');
        }

        // Create entry on backend
        progressMessage = 'Creating entry on server...';
        const createResp = await createKnowledgeBaseEntry(replicaIdToUse, {
          title: currentEntry.title,
          text: currentEntry.inputType === 'text' ? currentEntry.text : undefined,
          url: currentEntry.inputType === 'url' ? currentEntry.url : undefined,
          autoRefresh: currentEntry.autoRefresh,
          filename: currentEntry.inputType === 'file' ? currentEntry.filename : undefined
        });

        // Backend returns results[] with knowledgeBaseID or signedURL in 207
        const results = createResp.results || [];
        const primary = results[0] || {};
        const kbId = primary.knowledgeBaseID || primary.id || primary.uuid;

        if (!kbId) {
          throw new Error('Server did not return a knowledge base entry ID');
        }

        // If there's a signedUrl, upload the file
        if (primary.signedURL && selectedFile) {
          progressMessage = 'Uploading file...';
          await uploadToSignedUrl(primary.signedURL, selectedFile, selectedFile.type || 'application/octet-stream');
        }

        // Poll for status with proper auth headers
        progressMessage = 'Processing entry...';
        let finalStatus = null;
        const authHeaders = getAuthHeaders();
        
        for (let i = 0; i < 12; i++) {
          try {
            const statusResp = await fetch(`/api/replicas/${replicaIdToUse}/kb/${kbId}/status`, {
              headers: authHeaders
            });
            if (statusResp.ok) {
              const jr = await statusResp.json();
              finalStatus = jr.status?.status || jr.status || (jr.result && jr.result.status) || jr;
              console.log(`Poll ${i + 1}: Status = ${finalStatus}`);
              if (finalStatus === 'READY') {
                progressMessage = 'Entry ready!';
                break;
              }
              if (finalStatus === 'ERROR' || finalStatus === 'UNPROCESSABLE') {
                throw new Error(`Entry processing failed: ${finalStatus}`);
              }
            } else if (statusResp.status === 404) {
              // Entry might not be indexed yet, continue polling
            } else {
              console.warn(`Status poll failed: ${statusResp.status}`);
            }
          } catch (pollErr) {
            console.warn('Status poll error:', pollErr);
          }
          if (i < 11) await new Promise(r => setTimeout(r, 2500));
        }

        // Replace temp entry in store with real id/status
        wizardStore.removeKnowledgeBaseEntry(tempId);
        const serverEntry = {
          id: kbId,
          title: currentEntry.title || `Entry ${kbId}`,
          inputType: currentEntry.inputType,
          text: currentEntry.inputType === 'text' ? currentEntry.text : undefined,
          url: currentEntry.inputType === 'url' ? currentEntry.url : undefined,
          filename: currentEntry.inputType === 'file' ? currentEntry.filename : undefined,
          status: finalStatus || 'PROCESSING',
          autoRefresh: currentEntry.autoRefresh
        };
        wizardStore.addKnowledgeBaseEntry(serverEntry);

        // Clear form and state
        wizardStore.clearKnowledgeBaseForm();
        selectedFile = null;
        progressMessage = `✅ Entry "${serverEntry.title}" added successfully`;
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          progressMessage = '';
        }, 3000);
        
      } catch (err) {
        console.error('KB add failed', err);
        const errorMsg = err.message || String(err);
        error = errorMsg;
        progressMessage = '';
        
        // Remove temp entry and add error entry
        wizardStore.removeKnowledgeBaseEntry(tempId);
        wizardStore.addKnowledgeBaseEntry({ 
          ...currentEntry, 
          id: `err_${Date.now()}`, 
          status: 'ERROR', 
          error: errorMsg,
          title: currentEntry.title || 'Failed Entry'
        });
        
        // Clear error after 5 seconds
        setTimeout(() => {
          error = null;
        }, 5000);
        
      } finally {
        isLoading = false;
      }
    })();
  }

  function removeEntry(id) {
    wizardStore.removeKnowledgeBaseEntry(id);
  }

  function clearForm() {
    wizardStore.clearKnowledgeBaseForm();
    error = null;
  }

  function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
      selectedFile = file;
      updateCurrentEntry('filename', file.name);
    }
  }
</script>

<div class="step-container">
  <h2 class="text-2xl font-bold mb-4">Knowledge Base (Optional)</h2>
  <p class="text-gray-600 mb-6">
    Add additional content to help your replica provide more accurate and comprehensive responses. 
    You can add text, web pages, or documents.
  </p>

  <div class="space-y-6">
    <!-- Input Type Selection -->
  <div class="bg-gray-50 p-4 rounded-lg">
      <h3 class="text-lg font-semibold mb-3">Add New Entry</h3>
      
        <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700 mb-2">Content Type</label>
        <div class="flex space-x-4">
          <label class="flex items-center">
            <input 
              type="radio" 
              value="text" 
              bind:group={state.knowledgeBase.currentEntry.inputType}
              on:change={() => updateCurrentEntry('inputType', 'text')}
              class="h-4 w-4 text-blue-600 focus:ring-2 focus:ring-blue-500 border-gray-300"
            />
            <span class="ml-2">Text</span>
          </label>
          <label class="flex items-center">
            <input 
              type="radio" 
              value="url" 
              bind:group={state.knowledgeBase.currentEntry.inputType}
              on:change={() => updateCurrentEntry('inputType', 'url')}
              class="h-4 w-4 text-blue-600 focus:ring-2 focus:ring-blue-500 border-gray-300"
            />
            <span class="ml-2">Website URL</span>
          </label>
          <label class="flex items-center">
            <input 
              type="radio" 
              value="file" 
              bind:group={state.knowledgeBase.currentEntry.inputType}
              on:change={() => updateCurrentEntry('inputType', 'file')}
              class="h-4 w-4 text-blue-600 focus:ring-2 focus:ring-blue-500 border-gray-300"
            />
            <span class="ml-2">File Upload</span>
          </label>
        </div>
      </div>

      <!-- Title Field (always visible) -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Title (Optional)
          </label>
          <input
            type="text"
            bind:value={state.knowledgeBase.currentEntry.title}
            on:input={(e) => updateCurrentEntry('title', e.target.value)}
            placeholder="Give this entry a descriptive title..."
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={!replicaId}
          />
        </div>

      <!-- Content Fields based on type -->
      {#if state.knowledgeBase.currentEntry.inputType === 'text'}
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Text Content *
          </label>
          <textarea
            bind:value={state.knowledgeBase.currentEntry.text}
            on:input={(e) => updateCurrentEntry('text', e.target.value)}
            placeholder="Enter the text content that you want your replica to learn from..."
            rows="6"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          ></textarea>
        </div>
      {/if}

      {#if state.knowledgeBase.currentEntry.inputType === 'url'}
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Website URL *
          </label>
            <input
              type="url"
              bind:value={state.knowledgeBase.currentEntry.url}
              on:input={(e) => updateCurrentEntry('url', e.target.value)}
              placeholder="https://example.com/article"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={!replicaId}
            />
        </div>
        
        <div class="mb-4">
          <label class="flex items-center">
            <input 
              type="checkbox" 
              bind:checked={state.knowledgeBase.currentEntry.autoRefresh}
              on:change={(e) => updateCurrentEntry('autoRefresh', e.target.checked)}
              class="h-4 w-4 text-blue-600 focus:ring-2 focus:ring-blue-500 border-gray-300 rounded"
              disabled={!replicaId}
            />
            <span class="ml-2 text-sm text-gray-700">Auto-refresh content periodically</span>
          </label>
        </div>
      {/if}

      {#if state.knowledgeBase.currentEntry.inputType === 'file'}
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Select File *
          </label>
          <input
            type="file"
            on:change={handleFileSelect}
            accept=".txt,.pdf,.doc,.docx,.md"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={!replicaId}
          />
          {#if state.knowledgeBase.currentEntry.filename}
            <p class="text-sm text-gray-600 mt-1">Selected: {state.knowledgeBase.currentEntry.filename}</p>
          {/if}
        </div>
      {/if}

      {#if error}
        <div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded flex items-center">
          <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
          </svg>
          {error}
        </div>
      {/if}

      {#if progressMessage}
        <div class="mb-4 p-3 bg-blue-100 border border-blue-400 text-blue-700 rounded flex items-center">
          {#if isLoading}
            <svg class="animate-spin -ml-1 mr-3 h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          {:else}
            <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
            </svg>
          {/if}
          {progressMessage}
        </div>
      {/if}

      <div class="flex space-x-3">
        <button
          type="button"
          on:click={addEntry}
          disabled={!replicaId || isLoading}
          class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add Entry
        </button>
        <button
          type="button"
          on:click={clearForm}
          class="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
        >
          Clear
        </button>
      </div>
      {#if !replicaId}
        <div class="mt-3 p-3 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded">
          This step is available only after a replica has been created. Complete the previous steps to create the replica, then return here to add knowledge base entries.
        </div>
      {/if}
    </div>

    <!-- Existing Entries -->
    {#if isLoadingEntries}
      <div class="bg-white border rounded-lg p-4">
        <div class="flex items-center justify-center py-8">
          <svg class="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span class="ml-2 text-gray-600">Loading existing entries...</span>
        </div>
      </div>
    {/if}
    
    {#if !isLoadingEntries && state.knowledgeBase.entries.length > 0}
      <div class="bg-white border rounded-lg p-4">
        <h3 class="text-lg font-semibold mb-3">Knowledge Base Entries ({state.knowledgeBase.entries.length})</h3>
        <div class="space-y-3">
          {#each state.knowledgeBase.entries as entry (entry.id)}
            <div class="border border-gray-200 rounded-lg p-4">
              <div class="flex justify-between items-start">
                <div class="flex-1">
                  <div class="flex items-center space-x-2 mb-2">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                      {entry.inputType === 'text' ? 'bg-blue-100 text-blue-800' :
                       entry.inputType === 'url' ? 'bg-green-100 text-green-800' :
                       'bg-purple-100 text-purple-800'}">
                      {entry.inputType}
                    </span>
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                      {entry.status === 'READY' ? 'bg-green-100 text-green-800' :
                       entry.status === 'PROCESSING' ? 'bg-yellow-100 text-yellow-800' :
                       entry.status === 'ERROR' ? 'bg-red-100 text-red-800' :
                       'bg-gray-100 text-gray-800'}">
                      {entry.status || 'UNKNOWN'}
                    </span>
                    {#if entry.title}
                      <h4 class="font-medium text-gray-900">{entry.title}</h4>
                    {/if}
                  </div>
                  
                  {#if entry.inputType === 'text' && entry.text}
                    <p class="text-sm text-gray-600 line-clamp-3">{entry.text}</p>
                  {/if}
                  
                  {#if entry.inputType === 'url' && entry.url}
                    <div class="text-sm text-gray-600">
                      <a href={entry.url} target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">
                        {entry.url}
                      </a>
                      {#if entry.autoRefresh}
                        <span class="ml-2 text-xs text-green-600">Auto-refresh enabled</span>
                      {/if}
                    </div>
                  {/if}
                  
                  {#if entry.inputType === 'file' && entry.filename}
                    <p class="text-sm text-gray-600">📄 {entry.filename}</p>
                  {/if}
                  
                  {#if entry.error}
                    <div class="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                      <strong>Error:</strong> {entry.error}
                    </div>
                  {/if}
                </div>
                
                <button
                  type="button"
                  on:click={() => removeEntry(entry.id)}
                  class="ml-4 text-red-600 hover:text-red-800 focus:outline-none"
                  title="Remove entry"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                  </svg>
                </button>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <div class="text-center py-6">
      <p class="text-sm text-gray-500 mb-4">
        Knowledge base entries are optional but can significantly improve your replica's responses. 
        You can always add more entries later from the training page.
      </p>
      
      {#if replicaId}
        <div class="flex justify-center space-x-3">
          <button
            type="button"
            on:click={() => goto('/create-replicas')}
            class="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Continue Editing
          </button>
          <button
            type="button"
            on:click={() => goto(`/chat-replicas?created=true&replicaId=${encodeURIComponent(replicaId)}`)}
            class="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            Skip & Go to Chat →
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .step-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
  }
  
  .line-clamp-3 {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .form-radio,
  .form-checkbox {
    height: 1rem; /* h-4 */
    width: 1rem;  /* w-4 */
    border: 1px solid #d1d5db; /* border-gray-300 */
    background: white;
    vertical-align: middle;
    appearance: auto;
  }

  /* Focus styles roughly matching Tailwind's focus:ring-blue-500 */
  .form-radio:focus,
  .form-checkbox:focus {
    outline: none;
    box-shadow: 0 0 0 3px rgba(59,130,246,0.25);
    border-color: #2563eb;
  }

  /* Slight rounding for checkboxes */
  .form-checkbox {
    border-radius: 0.25rem;
  }
</style>