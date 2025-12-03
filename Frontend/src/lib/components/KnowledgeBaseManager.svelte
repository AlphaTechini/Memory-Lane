<script>
	import { createEventDispatcher } from 'svelte';
	import { 
		createKnowledgeBaseEntry, 
		getKnowledgeBaseEntries, 
		deleteKnowledgeBaseEntry,
		validateKnowledgeBaseData,
		getStatusBadgeClass,
		getTypeBadgeClass,
		formatKnowledgeBaseEntry
	} from '$lib/knowledgeBase.js';
	
	const dispatch = createEventDispatcher();
	
	export let selectedReplica = '';
	export let knowledgeBaseEntries = [];
	export let isLoading = false;
	
	let trainingData = {
		title: '',
		text: '',
		url: '',
		autoRefresh: false,
		filename: ''
	};
	let inputType = 'text'; // 'text', 'url', 'file'
	let showDetails = {};
	
	function resetForm() {
		trainingData = {
			title: '',
			text: '',
			url: '',
			autoRefresh: false,
			filename: ''
		};
	}
	
	async function handleCreate() {
		if (!selectedReplica) {
			dispatch('message', { text: 'Please select a replica', type: 'error' });
			return;
		}

		// Validate input
		const validation = validateKnowledgeBaseData(trainingData, inputType);
		if (!validation.isValid) {
			dispatch('message', { text: validation.error, type: 'error' });
			return;
		}

		isLoading = true;
		try {
			const result = await createKnowledgeBaseEntry(selectedReplica, trainingData);
			
			if (result.success && result.results && result.results.length > 0) {
				const createdEntry = result.results[0];
				let successMessage = `Knowledge base entry created successfully! ID: ${createdEntry.knowledgeBaseID}`;
				
				// Show signed URL if it's a file upload
				if (createdEntry.signedURL) {
					successMessage += `\n\nUpload your file to: ${createdEntry.signedURL}`;
				}
				
				dispatch('message', { text: successMessage, type: 'success' });
				resetForm();
				dispatch('refresh'); // Trigger parent to reload entries
			} else {
				dispatch('message', { text: 'Failed to create knowledge base entry', type: 'error' });
			}
		} catch (error) {
			console.error('Knowledge base creation error:', error);
			dispatch('message', { text: error.message || 'An error occurred while creating the entry', type: 'error' });
		} finally {
			isLoading = false;
		}
	}
	
	async function handleDelete(entryId) {
		if (!confirm('Are you sure you want to delete this knowledge base entry?')) {
			return;
		}
		
		try {
			await deleteKnowledgeBaseEntry(selectedReplica, entryId);
			dispatch('message', { text: 'Knowledge base entry deleted successfully', type: 'success' });
			dispatch('refresh'); // Trigger parent to reload entries
		} catch (error) {
			console.error('Delete error:', error);
			dispatch('message', { text: error.message || 'Failed to delete entry', type: 'error' });
		}
	}

	function toggleDetails(entryId) {
		showDetails[entryId] = !showDetails[entryId];
		showDetails = { ...showDetails };
	}

	function truncateText(text, maxLength = 150) {
		if (!text || text.length <= maxLength) return text;
		return text.substring(0, maxLength) + '...';
	}
</script>

<!-- Add New Knowledge Base Entry -->
<div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
	<h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Add Knowledge Base Entry</h2>
	
	<!-- Input Type Selection -->
	<div class="mb-4">
		<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
			Content Type
		</label>
		<div class="flex flex-wrap gap-4">
			<label class="flex items-center">
				<input type="radio" bind:group={inputType} value="text" class="mr-2 text-blue-600" />
				<span class="text-sm text-gray-700 dark:text-gray-300">📝 Text Content</span>
			</label>
			<label class="flex items-center">
				<input type="radio" bind:group={inputType} value="url" class="mr-2 text-blue-600" />
				<span class="text-sm text-gray-700 dark:text-gray-300">🌐 Website/YouTube URL</span>
			</label>
			<label class="flex items-center">
				<input type="radio" bind:group={inputType} value="file" class="mr-2 text-blue-600" />
				<span class="text-sm text-gray-700 dark:text-gray-300">📁 File Upload</span>
			</label>
		</div>
	</div>

	<!-- Title (Optional) -->
	<div class="mb-4">
		<label for="entry-title" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
			Title (Optional)
		</label>
		<input 
			id="entry-title"
			type="text"
			bind:value={trainingData.title}
			class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
			placeholder="Enter a descriptive title for this entry..."
		/>
	</div>

	<!-- Dynamic Content Input -->
	{#if inputType === 'text'}
		<div class="mb-4">
			<label for="training-text" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
				Training Text *
			</label>
			<textarea 
				id="training-text"
				bind:value={trainingData.text}
				rows="8"
				class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
				placeholder="Enter the text you want your replica to learn from..."
			></textarea>
			<p class="text-sm text-gray-500 dark:text-gray-400 mt-2">
				Provide detailed information, examples, or knowledge that you want your replica to learn from.
			</p>
		</div>
	{:else if inputType === 'url'}
		<div class="mb-4">
			<label for="training-url" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
				Website URL *
			</label>
			<input 
				id="training-url"
				type="url"
				bind:value={trainingData.url}
				class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
				placeholder="https://example.com or https://www.youtube.com/watch?v=..."
			/>
			<p class="text-sm text-gray-500 dark:text-gray-400 mt-2">
				Supports websites and YouTube videos. The content will be automatically extracted and processed.
			</p>
		</div>
		<div class="mb-4">
			<label class="flex items-center">
				<input type="checkbox" bind:checked={trainingData.autoRefresh} class="mr-2 text-blue-600" />
				<span class="text-sm text-gray-700 dark:text-gray-300">Auto-refresh content from URL</span>
			</label>
			<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
				When enabled, the system will periodically check for updates to the content.
			</p>
		</div>
	{:else if inputType === 'file'}
		<div class="mb-4">
			<label for="filename" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
				Filename *
			</label>
			<input 
				id="filename"
				type="text"
				bind:value={trainingData.filename}
				class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
				placeholder="document.pdf, data.csv, presentation.pptx, video.mp4, etc."
			/>
			<div class="mt-2 text-sm text-gray-500 dark:text-gray-400">
				<p class="font-medium">Supported file types:</p>
				<ul class="mt-1 space-y-1 text-xs">
					<li>📄 <strong>Documents:</strong> PDF, DOC, DOCX, RTF, TXT, MD, HTML</li>
					<li>📊 <strong>Spreadsheets:</strong> CSV, TSV, XLS, XLSX, ODS</li>
					<li>🎤 <strong>Audio:</strong> MP3, WAV, AAC, OGG, FLAC</li>
					<li>🎥 <strong>Video:</strong> MP4, MPEG, MOV, AVI, WEBM, MKV (max 90 min)</li>
					<li>🖼️ <strong>Images:</strong> PNG, JPG, JPEG, WEBP, HEIC, TIFF, BMP</li>
				</ul>
				<p class="mt-2 font-medium">You'll receive an upload URL after creating the entry.</p>
			</div>
		</div>
	{/if}

	<button 
		on:click={handleCreate}
		disabled={isLoading}
		class="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200 flex items-center justify-center"
	>
		{#if isLoading}
			<svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
				<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
			</svg>
			Creating...
		{:else}
			Create Knowledge Base Entry
		{/if}
	</button>
</div>

<!-- Existing Knowledge Base Entries -->
{#if knowledgeBaseEntries.length > 0}
	<div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
		<h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">
			Knowledge Base Entries ({knowledgeBaseEntries.length})
		</h2>
		
		<div class="space-y-4">
			{#each knowledgeBaseEntries as entry}
				{@const formattedEntry = formatKnowledgeBaseEntry(entry)}
				<div class="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
					<div class="flex justify-between items-start">
						<div class="flex-1">
							<div class="flex items-start justify-between">
								<h3 class="font-medium text-gray-900 dark:text-white text-lg">
									{formattedEntry.title}
								</h3>
								<div class="flex space-x-2 ml-4">
									<button
										on:click={() => toggleDetails(entry.id)}
										class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 p-1"
										title="Toggle details"
									>
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
										</svg>
									</button>
									<button
										on:click={() => handleDelete(entry.id)}
										class="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1"
										title="Delete entry"
									>
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
										</svg>
									</button>
								</div>
							</div>
							
							<div class="flex flex-wrap gap-2 mt-2">
								<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getTypeBadgeClass(formattedEntry.type)}">
									{formattedEntry.type}
								</span>
								<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getStatusBadgeClass(formattedEntry.status)}">
									{formattedEntry.status}
								</span>
								<span class="text-xs text-gray-500 dark:text-gray-400 px-2.5 py-0.5">
									ID: {formattedEntry.id}
								</span>
								{#if formattedEntry.language}
									<span class="text-xs text-gray-500 dark:text-gray-400 px-2.5 py-0.5">
										{formattedEntry.language.toUpperCase()}
									</span>
								{/if}
							</div>

							{#if formattedEntry.url}
								<p class="text-sm text-blue-600 dark:text-blue-400 mt-2 truncate">
									<span class="font-medium">URL:</span> {formattedEntry.url}
								</p>
							{/if}

							{#if formattedEntry.summary}
								<p class="text-sm text-gray-600 dark:text-gray-300 mt-2">
									{truncateText(formattedEntry.summary)}
								</p>
							{/if}

							<!-- Detailed Information -->
							{#if showDetails[entry.id]}
								<div class="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
									<h4 class="font-medium text-gray-900 dark:text-white mb-2">Entry Details</h4>
									
									{#if formattedEntry.rawText}
										<div class="mb-3">
											<label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Raw Text:</label>
											<p class="text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 p-2 rounded border max-h-32 overflow-y-auto">
												{formattedEntry.rawText}
											</p>
										</div>
									{/if}

									{#if formattedEntry.generatedFacts && formattedEntry.generatedFacts.length > 0}
										<div class="mb-3">
											<label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Generated Facts:</label>
											<ul class="text-xs text-gray-600 dark:text-gray-400 space-y-1">
												{#each formattedEntry.generatedFacts as fact}
													<li class="flex items-start">
														<span class="mr-2">•</span>
														<span>{fact}</span>
													</li>
												{/each}
											</ul>
										</div>
									{/if}

									{#if formattedEntry.rawTextChunks && formattedEntry.rawTextChunks.length > 0}
										<div class="mb-3">
											<label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
												Text Chunks ({formattedEntry.rawTextChunks.length}):
											</label>
											<div class="space-y-1 max-h-24 overflow-y-auto">
												{#each formattedEntry.rawTextChunks as chunk, index}
													<div class="text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 p-2 rounded border">
														<span class="font-medium">Chunk {index + 1}:</span> {truncateText(chunk.content, 100)}
														<span class="text-gray-500 ml-2">({chunk.chunkTokens} tokens)</span>
													</div>
												{/each}
											</div>
										</div>
									{/if}

									{#if formattedEntry.createdAt}
										<div class="flex justify-between text-xs text-gray-500 dark:text-gray-400">
											<span>Created: {new Date(formattedEntry.createdAt).toLocaleString()}</span>
											{#if formattedEntry.updatedAt && formattedEntry.updatedAt !== formattedEntry.createdAt}
												<span>Updated: {new Date(formattedEntry.updatedAt).toLocaleString()}</span>
											{/if}
										</div>
									{/if}
								</div>
							{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>
	</div>
{:else}
	<div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
		<div class="text-center py-12">
			<svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
			</svg>
			<h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No knowledge base entries</h3>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
				Get started by creating your first knowledge base entry above.
			</p>
		</div>
	</div>
{/if}