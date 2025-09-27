/**
 * Knowledge Base API utilities for the new Sensay API
 * Supports text, URL, file, and YouTube content types with optional fields
 */

/**
 * Create a new knowledge base entry
 * @param {string} replicaId - The replica ID
 * @param {Object} data - Entry data
 * @param {string} [data.title] - Optional title
 * @param {string} [data.text] - Text content
 * @param {string} [data.url] - URL content
 * @param {boolean} [data.autoRefresh] - Auto-refresh for URLs
 * @param {string} [data.filename] - Filename for file uploads
 * @returns {Promise<Object>} API response with 207 status and results array
 */
export async function createKnowledgeBaseEntry(replicaId, data) {
	// The app stores the auth token under 'authToken' in several places (see Step7ReviewSubmit)
	const token = localStorage.getItem('authToken') || localStorage.getItem('token');
	if (!token) {
		throw new Error('No authentication token found');
	}

	// Only include fields that have values (API supports optional fields)
	const requestBody = {};
	
	if (data.title?.trim()) requestBody.title = data.title.trim();
	if (data.text?.trim()) requestBody.text = data.text.trim();
	if (data.url?.trim()) requestBody.url = data.url.trim();
	if (data.autoRefresh) requestBody.autoRefresh = data.autoRefresh;
	if (data.filename?.trim()) requestBody.filename = data.filename.trim();

	// Backend create endpoint uses /api/replicas/:replicaId/kb/entries
	const response = await fetch(`/api/replicas/${replicaId}/kb/entries`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${token}`
		},
		body: JSON.stringify(requestBody)
	});

	const result = await response.json();
	if (!response.ok) {
		throw new Error(result.error || `HTTP ${response.status}: ${response.statusText}`);
	}

	return result;
}

/**
 * Get knowledge base entries for a replica
 * @param {string} replicaId - The replica ID
 * @returns {Promise<Array>} List of knowledge base entries
 */
export async function getKnowledgeBaseEntries(replicaId) {
	const token = localStorage.getItem('authToken') || localStorage.getItem('token');
	if (!token) {
		throw new Error('No authentication token found');
	}

	const response = await fetch(`/api/replicas/${replicaId}/kb`, {
		headers: {
			'Authorization': `Bearer ${token}`
		}
	});

	const result = await response.json();
	if (!response.ok) {
		throw new Error(result.error || `HTTP ${response.status}: ${response.statusText}`);
	}

	return result.entries || [];
}

/**
 * Get a specific knowledge base entry with full details
 * @param {string} replicaId - The replica ID
 * @param {string|number} entryId - The entry ID
 * @returns {Promise<Object>} Knowledge base entry details
 */
export async function getKnowledgeBaseEntry(replicaId, entryId) {
	const token = localStorage.getItem('authToken') || localStorage.getItem('token');
	if (!token) {
		throw new Error('No authentication token found');
	}

	const response = await fetch(`/api/replicas/${replicaId}/kb/${entryId}`, {
		headers: {
			'Authorization': `Bearer ${token}`
		}
	});

	const result = await response.json();
	if (!response.ok) {
		throw new Error(result.error || `HTTP ${response.status}: ${response.statusText}`);
	}

	return result;
}

/**
 * Update a knowledge base entry
 * @param {string} replicaId - The replica ID
 * @param {string|number} entryId - The entry ID
 * @param {Object} updateData - Data to update (supports all API fields)
 * @returns {Promise<Object>} Update result
 */
export async function updateKnowledgeBaseEntry(replicaId, entryId, updateData) {
	const token = localStorage.getItem('authToken') || localStorage.getItem('token');
	if (!token) {
		throw new Error('No authentication token found');
	}

	// Only include fields that have values
	const requestBody = {};
	Object.keys(updateData).forEach(key => {
		if (updateData[key] !== undefined && updateData[key] !== null && updateData[key] !== '') {
			requestBody[key] = updateData[key];
		}
	});

	const response = await fetch(`/api/replicas/${replicaId}/kb/${entryId}`, {
		method: 'PATCH',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${token}`
		},
		body: JSON.stringify(requestBody)
	});

	const result = await response.json();
	if (!response.ok) {
		throw new Error(result.error || `HTTP ${response.status}: ${response.statusText}`);
	}

	return result;
}

/**
 * Delete a knowledge base entry
 * @param {string} replicaId - The replica ID
 * @param {string|number} entryId - The entry ID
 * @returns {Promise<Object>} Delete result
 */
export async function deleteKnowledgeBaseEntry(replicaId, entryId) {
	const token = localStorage.getItem('authToken') || localStorage.getItem('token');
	if (!token) {
		throw new Error('No authentication token found');
	}

	const response = await fetch(`/api/replicas/${replicaId}/kb/${entryId}`, {
		method: 'DELETE',
		headers: {
			'Authorization': `Bearer ${token}`
		}
	});

	const result = await response.json();
	if (!response.ok) {
		throw new Error(result.error || `HTTP ${response.status}: ${response.statusText}`);
	}

	return result;
}

/**
 * Helper function to format knowledge base entry data for display
 * @param {Object} entry - Raw entry data
 * @returns {Object} Formatted entry data
 */
export function formatKnowledgeBaseEntry(entry) {
	return {
		id: entry.id,
		title: entry.title || entry.generatedTitle || `Entry ${entry.id}`,
		type: entry.type || 'text',
		status: entry.status || 'PROCESSING',
		url: entry.url,
		summary: entry.summary,
		language: entry.language,
		createdAt: entry.createdAt,
		updatedAt: entry.updatedAt,
		rawText: entry.rawText,
		generatedFacts: entry.generatedFacts || [],
		rawTextChunks: entry.rawTextChunks || [],
		// Media-specific data
		website: entry.website,
		youtube: entry.youtube,
		file: entry.file,
		error: entry.error
	};
}

/**
 * Helper function to determine content type from input data
 * @param {Object} data - Input data
 * @returns {string} Content type ('text', 'url', 'file')
 */
export function getContentType(data) {
	if (data.filename?.trim()) return 'file';
	if (data.url?.trim()) return 'url';
	return 'text';
}

/**
 * Helper function to validate knowledge base entry data
 * @param {Object} data - Entry data to validate
 * @param {string} inputType - Type of input ('text', 'url', 'file')
 * @returns {Object} Validation result with isValid and error
 */
export function validateKnowledgeBaseData(data, inputType) {
	if (inputType === 'text' && !data.text?.trim()) {
		return { isValid: false, error: 'Please enter training text' };
	}
	
	if (inputType === 'url' && !data.url?.trim()) {
		return { isValid: false, error: 'Please enter a valid URL' };
	}
	
	if (inputType === 'file' && !data.filename?.trim()) {
		return { isValid: false, error: 'Please specify a filename' };
	}
	
	// URL validation for url type
	if (inputType === 'url' && data.url?.trim()) {
		try {
			new URL(data.url.trim());
		} catch (e) {
			return { isValid: false, error: 'Please enter a valid URL format' };
		}
	}
	
	return { isValid: true, error: null };
}

/**
 * Helper function to get status badge color
 * @param {string} status - Entry status
 * @returns {string} CSS class for status badge
 */
export function getStatusBadgeClass(status) {
	switch (status?.toUpperCase()) {
		case 'READY':
			return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
		case 'PROCESSING':
		case 'PROCESSED_TEXT':
		case 'VECTOR_CREATED':
			return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
		case 'NEW':
		case 'FILE_UPLOADED':
		case 'RAW_TEXT':
			return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
		case 'UNPROCESSABLE':
		case 'ERROR':
			return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
		default:
			return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
	}
}

/**
 * Helper function to get type badge color
 * @param {string} type - Entry type
 * @returns {string} CSS class for type badge
 */
export function getTypeBadgeClass(type) {
	switch (type?.toLowerCase()) {
		case 'text':
			return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
		case 'website':
		case 'url':
			return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
		case 'youtube':
			return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
		case 'file':
			return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
		default:
			return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
	}
}

/**
 * Upload a file buffer to a signed URL (used for KB file uploads)
 * @param {string} signedUrl
 * @param {ArrayBuffer|Blob} fileData
 * @param {string} contentType
 */
export async function uploadToSignedUrl(signedUrl, fileData, contentType) {
	const resp = await fetch(signedUrl, {
		method: 'PUT',
		headers: {
			'Content-Type': contentType
		},
		body: fileData
	});
	if (!resp.ok) {
		const text = await resp.text().catch(()=>null);
		throw new Error(`Failed to upload file to signed URL: ${resp.status} ${resp.statusText} ${text || ''}`);
	}
	return true;
}