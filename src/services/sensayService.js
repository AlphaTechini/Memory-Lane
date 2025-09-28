import axios from 'axios';
import { sensayConfig } from '../config/sensay.js';
import logger from '../utils/logger.js';

/**
 * Complete Sensay API service with replica creation, training, and chat functionality
 */

// Create base Axios instance
const sensayApi = axios.create({
  baseURL: sensayConfig.baseUrl,
  timeout: 30000, // 30 second timeout
});

/**
 * Create a Sensay user (per-user ownership)\n * @param {Object} params
 * @param {string} params.email
 * @param {string} params.name
 * @param {string} [params.id] optional specific id to request
 * @returns {Promise<Object>} { id, email, name } or { conflict: true, existing?: any }
 */
export const createSensayUser = async ({ email, name, id }) => {
  try {
    // Ensure name meets Sensay constraints (<=50 chars, allowed pattern)
    const trimmedName = (name || '').substring(0, 50);
    const namePattern = /^[a-zA-Z0-9\s().,'\-/]*$/;
    const safeName = namePattern.test(trimmedName) ? trimmedName : trimmedName.replace(/[^a-zA-Z0-9\s().,'\-/]/g, '').trim();
    const body = { email, name: safeName };
    if (id) body.id = id;
    const res = await sensayApi.post('/v1/users', body, { headers: sensayConfig.headers.base });
    logger?.info?.(`Created Sensay user ${res.data.id} for ${email}`) || console.log('Created Sensay user', res.data.id);
    return res.data;
  } catch (error) {
    if (error.response?.status === 409) {
      // Conflict – user already exists. Return indicator instead of throwing.
      logger?.warn?.(`Sensay user already exists for ${email}`) || console.warn('Sensay user conflict', email);
      return { conflict: true, error: error.response.data };
    }
    logger?.warn?.(`Failed to create Sensay user for ${email}: ${error.message}`) || console.warn('Failed to create Sensay user', error.message);
    throw handleSensayError(error, 'Failed to create Sensay user');
  }
};

/**
 * List replicas for an owner (Sensay user). Normalizes varying response shapes.
 * @param {string} ownerID
 * @returns {Promise<Array>} replicas
 */
export const listReplicas = async (ownerID) => {
  if (!ownerID) throw new Error('ownerID required');
  try {
    // Use withUser headers to include X-USER-ID for user-specific replica fetching
    const headers = sensayConfig.headers.withUser(ownerID);
    const res = await sensayApi.get(`${sensayConfig.endpoints.replicas}?ownerID=${encodeURIComponent(ownerID)}`, {
      headers
    });
    const data = res.data || {};
    
    // According to Sensay API docs, response format is: { success: true, items: [...], total: number }
    if (data.success && Array.isArray(data.items)) {
      console.log(`Sensay API returned ${data.items.length} replicas out of ${data.total} total for user ${ownerID}`);
      return data.items;
    }
    
    // Legacy fallback patterns
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.replicas)) return data.replicas;
    if (Array.isArray(data.data)) return data.data;
    
    // Final fallback: collect objects with id-like fields
    const fallbackItems = Object.values(data).filter(v => v && typeof v === 'object' && (v.id || v.uuid));
    console.warn('Sensay API response did not match expected format, using fallback extraction:', fallbackItems.length);
    return fallbackItems;
  } catch (error) {
    throw handleSensayError(error, 'Failed to list replicas');
  }
};

/**
 * Fetch a Sensay user by id
 * @param {string} userId
 * @returns {Promise<Object|null>} null if 404
 */
export const getSensayUser = async (userId) => {
  try {
    const res = await sensayApi.get(`/v1/users/${userId}`, { headers: sensayConfig.headers.base });
    return res.data;
  } catch (error) {
    if (error.response?.status === 404) {
      return null;
    }
    throw handleSensayError(error, 'Failed to fetch Sensay user');
  }
};

/**
 * Search for Sensay users by email
 * @param {string} email
 * @returns {Promise<Object|null>} User object if found, null if not found
 */
export const findSensayUserByEmail = async (email) => {
  try {
    // Try to list users and find by email - this may need to be adjusted based on actual Sensay API
    const res = await sensayApi.get('/v1/users', { 
      headers: sensayConfig.headers.base,
      params: { email } // Assuming the API supports email search
    });
    
    if (res.data && Array.isArray(res.data)) {
      return res.data.find(user => user.email === email) || null;
    } else if (res.data && res.data.email === email) {
      return res.data;
    }
    
    return null;
  } catch (error) {
    if (error.response?.status === 404) {
      return null;
    }
    logger?.warn?.(`Failed to search Sensay user by email ${email}: ${error.message}`) || console.warn('Failed to search Sensay user', error.message);
    return null; // Return null instead of throwing to allow fallback
  }
};

/**
 * Creates a new replica in Sensay
 * @param {Object} replicaData - The replica configuration
 * @param {string} replicaData.name - The name of the replica
 * @param {string} replicaData.shortDescription - Brief description
 * @param {string} replicaData.greeting - Initial greeting message
 * @param {string} replicaData.slug - URL-friendly identifier
 * @param {Object} replicaData.llm - LLM configuration
 * @param {string} replicaData.llm.model - Model to use (e.g., 'gpt-4o')
 * @returns {Promise<Object>} Created replica object
 */
export const createReplica = async (replicaData) => {
  try {
  // Validate required fields (ownerID now provided per-user, no longer from env)
  const requiredFields = ['name', 'shortDescription', 'greeting', 'ownerID', 'slug', 'llm'];
    for (const field of requiredFields) {
      if (!replicaData[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    // Validate LLM field has model property
    if (!replicaData.llm.model) {
      throw new Error('Missing required field: llm.model');
    }

    const response = await sensayApi.post(sensayConfig.endpoints.replicas, replicaData, {
      headers: sensayConfig.headers.base,
      validateStatus: () => true, // we'll handle non-2xx explicitly
    });

    if (response.status < 200 || response.status >= 300) {
      const err = new Error(`Replica creation failed with status ${response.status}`);
      err.response = response;
      throw err;
    }

  const raw = response.data || {};
  // Some environments may return a provisional 'uuid' before a full replica object is materialized
  const resolvedId = raw.id || raw.replicaId || raw.replica?.id || raw.data?.id || raw.uuid;

    if (!resolvedId) {
      logger?.error?.('Sensay createReplica response missing id/uuid field', { keys: Object.keys(raw) }) || console.error('Replica response missing id. Keys:', Object.keys(raw));
      throw new Error('Sensay API did not return a replica id');
    }

    logger?.info?.(`Created Sensay replica ${resolvedId} for owner ${replicaData.ownerID}`) || console.log('Created replica', resolvedId);

    // Normalize return to always have .id
    return { ...raw, id: resolvedId };
  } catch (error) {
    console.error('Error creating replica:', error.message);
    throw handleSensayError(error, 'Failed to create replica');
  }
};

/**
 * Creates a new knowledge base entry for a replica based on text, file, URL, or YouTube Videos
 * @param {string} replicaId - The replica UUID to train
 * @param {Object} entryData - Knowledge base entry data
 * @param {string} [entryData.title] - Title for this knowledge base entry
 * @param {string} [entryData.url] - A public URL to an HTML page or YouTube video to ingest
 * @param {boolean} [entryData.autoRefresh] - Whether to allow automatic content updates from the URL
 * @param {string} [entryData.text] - The text content you want your replica to learn
 * @param {string} [entryData.filename] - The name of the file to upload
 * @returns {Promise<Object>} Created KB entry response with 207 status
 */
export const createKnowledgeBaseEntry = async (replicaId, entryData) => {
  console.log(`🔍 Creating KB entry for replica ${replicaId} with data:`, JSON.stringify(entryData, null, 2));
  console.log(`🔍 Using headers:`, JSON.stringify(sensayConfig.headers.base, null, 2));
  
  // Return a mock success response if we're in development and the API isn't fully configured
  if (!sensayConfig.organizationSecret || sensayConfig.organizationSecret.includes('placeholder')) {
    console.log(`⚠️ Knowledge base training skipped - Sensay API not properly configured`);
    return { 
      success: true,
      results: [{
        type: 'text',
        enqueued: true,
        knowledgeBaseID: `mock_kb_${Date.now()}`
      }],
      message: 'KB entry skipped (API not configured)' 
    };
  }
  
  const url = `/v1/replicas/${replicaId}/knowledge-base`;
  console.log(`🔍 Creating KB entry at: ${sensayConfig.baseUrl}${url}`);
  
  // Prepare the request body according to the new API specification
  const requestBody = {};
  
  // Add fields based on what's provided
  if (entryData.title) requestBody.title = entryData.title;
  if (entryData.url) requestBody.url = entryData.url;
  if (entryData.autoRefresh !== undefined) requestBody.autoRefresh = entryData.autoRefresh;
  if (entryData.text) requestBody.text = entryData.text;
  if (entryData.filename) requestBody.filename = entryData.filename;
  
  // Legacy support - handle old parameter names
  if (!requestBody.text && entryData.rawText) requestBody.text = entryData.rawText;
  if (!requestBody.text && entryData.content) requestBody.text = entryData.content;
  
  try {
    const headers = {
      ...sensayConfig.headers.base,
      'X-API-Version': '2025-03-25'
    };

    const response = await sensayApi.post(url, requestBody, { headers });
    
    console.log(`✅ KB entry created successfully`);
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    
    // Validate response format according to API specification
    if (response.status === 207 && response.data.success && response.data.results) {
      const data = response.data || {};
      const normalized = { ...data };

      const resultIds = Array.isArray(data.results)
        ? data.results
            .map(item => item?.knowledgeBaseID ?? item?.knowledgeBaseId ?? item?.id ?? item?.entryId)
            .filter(Boolean)
        : [];

      const primaryId = data.id
        ?? data.knowledgeBaseID
        ?? data.knowledgeBaseId
        ?? (Array.isArray(data.entryIds) ? data.entryIds[0] : undefined)
        ?? resultIds[0];

      if (primaryId && !normalized.id) {
        normalized.id = primaryId;
      }

      if (resultIds.length && !normalized.entryIds) {
        normalized.entryIds = resultIds;
      }

      return normalized;
    } else {
      throw new Error('Unexpected response format from KB creation');
    }
    
  } catch (error) {
    console.log(`❌ Knowledge base creation failed:`, {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      url: error.config?.url
    });
    
    // Handle specific error cases according to API specification
    if (error.response?.status === 400) {
      console.warn(`⚠️ Bad request for KB entry creation (400)`);
      throw new Error('Bad Request: Invalid entry data provided');
    }
    
    if (error.response?.status === 401) {
      console.warn(`⚠️ Unauthorized KB entry creation (401)`);
      throw new Error('Unauthorized: Invalid API credentials');
    }
    
    if (error.response?.status === 404) {
      console.warn(`⚠️ Knowledge base endpoint returned 404 for replica ${replicaId}`);
      console.warn(`   - The replica doesn't exist in the Sensay system`);
      console.warn(`   - The API credentials are incorrect`);
      console.warn(`   - The replica UUID format is wrong`);
      // Return mock response for development continuity
      return { 
        success: true,
        results: [{
          type: 'text',
          enqueued: true,
          knowledgeBaseID: `temp_kb_${Date.now()}`
        }],
        message: 'KB training postponed (replica not found)' 
      };
    }
    
    if (error.response?.status === 409) {
      console.warn(`⚠️ URL already exists in knowledge base (409)`);
      throw new Error('Conflict: URL already exists in the knowledge base');
    }
    
    if (error.response?.status === 415) {
      console.warn(`⚠️ Unsupported media type for KB entry creation (415)`);
      throw new Error('Unsupported Media Type: Invalid file type or content');
    }
    
    // For other errors, log them and throw
    console.error('Knowledge base creation failed:', error.message);
    throw handleSensayError(error, 'Failed to create knowledge base entry');
  }
};

/**
 * Updates a knowledge base entry with raw text content
 * @param {string} entryId - The KB entry ID
 * @param {string} rawText - The text content to add
 * @returns {Promise<Object>} Updated KB entry object
 */
export const updateKnowledgeBaseWithText = async (replicaId, entryId, rawText) => {
  if (!replicaId) throw new Error('replicaId required');
  if (!entryId) throw new Error('entryId required');
  try {
    const url = `/v1/replicas/${replicaId}/knowledge-base/${entryId}`;
    const response = await sensayApi.put(
      url,
      { rawText },
      { headers: { ...sensayConfig.headers.base, 'X-API-Version': '2025-03-25' } }
    );

    return response.data;
  } catch (error) {
    console.error('Error updating KB entry with text:', error.message);
    throw handleSensayError(error, 'Failed to update knowledge base entry');
  }
};

/**
 * Gets the status of a knowledge base entry
 * @param {string} replicaId - The replica ID
 * @param {string} knowledgeBaseID - The knowledge base entry ID
 * @returns {Promise<Object>} KB entry status and details
 */
export const getKnowledgeBaseEntryStatus = async (replicaId, knowledgeBaseID) => {
  console.log(`🔍 Checking KB entry status for replica ${replicaId}, entry ${knowledgeBaseID}`);
  
  // Skip for mock entries
  if (String(knowledgeBaseID).startsWith('mock_kb_') || String(knowledgeBaseID).startsWith('temp_kb_')) {
    console.log(`⚠️ Skipping status check for mock/temp entry: ${knowledgeBaseID}`);
    return { 
      id: knowledgeBaseID, 
      status: 'READY', 
      success: true, 
      message: 'Mock entry marked as ready' 
    };
  }
  
  const url = `/v1/replicas/${replicaId}/knowledge-base/${knowledgeBaseID}`;
  console.log(`🔍 Checking status at: ${sensayConfig.baseUrl}${url}`);
  
  try {
    const response = await sensayApi.get(url, { 
      headers: sensayConfig.headers.base 
    });
    
    console.log(`✅ KB entry status retrieved`);
    console.log('Status response:', JSON.stringify(response.data, null, 2));
    
    return response.data;
    
  } catch (error) {
    console.log(`❌ Failed to get KB entry status:`, {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      url: error.config?.url
    });
    
    // If it's a 404, the entry might not exist
    if (error.response?.status === 404) {
      console.warn(`⚠️ KB entry ${knowledgeBaseID} not found (404)`);
      return { 
        id: knowledgeBaseID, 
        status: 'NOT_FOUND', 
        success: false, 
        message: 'Entry not found' 
      };
    }
    
    throw handleSensayError(error, 'Failed to get knowledge base entry status');
  }
};

/**
 * Get detailed information about a specific knowledge base entry
 * @param {string} replicaId - The replica UUID
 * @param {string|number} entryId - The knowledge base entry ID
 * @returns {Promise<Object>} Complete KB entry details including type, status, content, and metadata
 */
export const getKnowledgeBaseEntry = async (replicaId, entryId) => {
  if (!replicaId) throw new Error('replicaId required');
  if (!entryId) throw new Error('entryId required');
  
  console.log(`🔍 Fetching KB entry for replica ${replicaId}, entry ${entryId}`);
  
  if (!sensayConfig.isProperlyConfigured()) {
    console.log(`⚠️ Knowledge base retrieval skipped - Sensay API not properly configured`);
    return { 
      id: entryId,
      replicaUUID: replicaId,
      type: 'text',
      status: 'READY',
      success: true,
      title: 'Mock Entry',
      rawText: 'Mock training content',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      language: 'en',
      message: 'Mock entry (API not configured)' 
    };
  }

  // Skip for mock entries
  if (String(entryId).startsWith('mock_kb_') || String(entryId).startsWith('temp_kb_')) {
    console.log(`⚠️ Returning mock data for mock/temp entry: ${entryId}`);
    return { 
      id: entryId,
      replicaUUID: replicaId,
      type: 'text',
      status: 'READY',
      success: true,
      title: 'Mock Entry',
      rawText: 'Mock training content',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      language: 'en',
      generatedFacts: ['Mock fact 1', 'Mock fact 2'],
      rawTextChunks: [
        {
          content: 'Mock training content chunk',
          chunkChars: 28,
          chunkIndex: 0,
          chunkTokens: 5
        }
      ]
    };
  }

  const url = `/v1/replicas/${replicaId}/knowledge-base/${entryId}`;
  console.log(`🔍 Fetching KB entry at: ${sensayConfig.baseUrl}${url}`);

  try {
    const headers = {
      ...sensayConfig.headers.base,
      'X-API-Version': '2025-03-25'
    };

    const response = await sensayApi.get(url, { headers });
    
    console.log(`✅ KB entry retrieved successfully`);
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    
    return response.data;
    
  } catch (error) {
    console.log(`❌ Failed to fetch KB entry:`, {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      url: error.config?.url
    });
    
    // Handle specific error cases according to API specification
    if (error.response?.status === 404) {
      console.warn(`⚠️ KB entry ${entryId} not found (404)`);
      throw new Error('Knowledge base entry not found');
    }
    
    if (error.response?.status === 400) {
      console.warn(`⚠️ Bad request for KB entry retrieval (400)`);
      throw new Error('Bad Request: Invalid entry ID or parameters');
    }
    
    if (error.response?.status === 401) {
      console.warn(`⚠️ Unauthorized KB entry retrieval (401)`);
      throw new Error('Unauthorized: Invalid API credentials');
    }
    
    if (error.response?.status === 415) {
      console.warn(`⚠️ Unsupported media type for KB entry retrieval (415)`);
      throw new Error('Unsupported Media Type');
    }
    
    console.error('Knowledge base entry retrieval failed:', error.message);
    throw handleSensayError(error, 'Failed to retrieve knowledge base entry');
  }
};

/**
 * Requests a signed URL for file upload
 * @param {string} entryId - The KB entry ID
 * @param {string} filename - Name of the file to upload
 * @param {string} contentType - MIME type of the file
 * @returns {Promise<Object>} Signed URL response
 */
export const requestSignedUploadUrl = async (entryId, filename, contentType) => {
  try {
    const response = await sensayApi.post(
      `${sensayConfig.endpoints.upload}/signed-url`,
      {
        entryId,
        filename,
        contentType,
      },
      {
        headers: sensayConfig.headers.base,
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error requesting signed upload URL:', error.message);
    throw handleSensayError(error, 'Failed to request signed upload URL');
  }
};

/**
 * Uploads a file using the signed URL
 * @param {string} signedUrl - The signed URL from requestSignedUploadUrl
 * @param {Buffer} fileBuffer - The file content as buffer
 * @param {string} contentType - MIME type of the file
 * @returns {Promise<void>}
 */
export const uploadFileToSignedUrl = async (signedUrl, fileBuffer, contentType) => {
  try {
    await axios.put(signedUrl, fileBuffer, {
      headers: {
        'Content-Type': contentType,
      },
    });
  } catch (error) {
    console.error('Error uploading file:', error.message);
    throw new Error('Failed to upload file to signed URL');
  }
};

/**
 * Polls a knowledge base entry until it's ready or times out
 * @param {string} replicaId - The replica ID
 * @param {string} knowledgeBaseID - The KB entry ID
 * @param {number} maxAttempts - Maximum polling attempts (default: 60)
 * @param {number} intervalMs - Polling interval in milliseconds (default: 5000)
 * @returns {Promise<Object>} Final KB entry status
 */
export const pollKnowledgeBaseEntryStatus = async (replicaId, knowledgeBaseID, maxAttempts = 60, intervalMs = 5000) => {
  let attempts = 0;
  
  console.log(`🔍 Starting to poll KB entry status for replica ${replicaId}, entry ${knowledgeBaseID}`);
  
  while (attempts < maxAttempts) {
    try {
      const status = await getKnowledgeBaseEntryStatus(replicaId, knowledgeBaseID);
      
      console.log(`📊 Poll attempt ${attempts + 1}/${maxAttempts}: Status = ${status.status}`);
      
      if (['READY', 'VECTOR_CREATED', 'PROCESSED_TEXT'].includes(status.status)) {
        console.log(`✅ KB entry ${knowledgeBaseID} reached terminal status ${status.status} after ${attempts + 1} attempts`);
        return status;
      }
      
      if (status.status === 'FAILED' || status.status === 'ERROR' || status.status === 'UNPROCESSABLE') {
        throw new Error(`Knowledge base entry processing failed: ${status.error || status.message || 'Unknown error'}`);
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, intervalMs));
      attempts++;
      
    } catch (error) {
      console.log(`❌ Poll attempt ${attempts + 1} failed:`, error.message);
      if (attempts >= maxAttempts - 1) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, intervalMs));
      attempts++;
    }
  }
  
  throw new Error(`Knowledge base entry processing timed out after ${maxAttempts} attempts`);
};

/**
 * Sends a chat message to a replica
 * @param {string} replicaId - The replica ID
 * @param {string} message - The message to send
 * @param {string} userId - The user ID for authentication
 * @param {Array} [context=[]] - Conversation context
 * @param {boolean} [streaming=false] - Whether to use streaming response
 * @returns {Promise<Object>} Chat response
 */
export const sendChatMessage = async (replicaId, message, userId, context = [], streaming = false) => {
  try {
    const endpoint = sensayConfig.endpoints.chat.replace('{replicaId}', replicaId);
    const headers = streaming 
      ? sensayConfig.headers.streaming(userId)
      : sensayConfig.headers.withUser(userId);

    // According to Sensay API docs, the request body should have:
    // - content: the prompt/message
    // - skip_chat_history: boolean (optional)
    // - source: string (optional)
    const requestBody = {
      content: message,
      skip_chat_history: false, // We want to maintain chat history
      source: 'web' // Indicate this is from web interface
    };

    // If we have context, we might need to format it differently
    // The API docs don't show how to send prior context, so we'll rely on chat history
    console.log(`Sending chat message to replica ${replicaId}:`, { 
      message: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
      streaming,
      endpoint 
    });

    const response = await sensayApi.post(
      endpoint,
      requestBody,
      {
        headers,
        responseType: streaming ? 'stream' : 'json',
      }
    );

    if (streaming) {
      return response; // Return the stream directly
    }

    console.log('Chat response received:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error sending chat message:', error.message);
    console.error('Error details:', error.response?.data || error);
    throw handleSensayError(error, 'Failed to send chat message');
  }
};

/**
 * Complete training workflow: create entry, add content, poll for completion
 * @param {string} replicaId - The replica ID
 * @param {Object} trainingData - Training data
 * @param {string} trainingData.title - Title for the KB entry
 * @param {string} [trainingData.description] - Description
 * @param {string} [trainingData.rawText] - Raw text content (mutually exclusive with file)
 * @param {Object} [trainingData.file] - File data {buffer, filename, contentType}
 * @returns {Promise<Object>} Final training result
 */
export const trainReplica = async (replicaId, trainingData) => {
  try {
    // 1. Create KB entry
    console.log('Creating knowledge base entry...');
    let kbEntry;
    let attempts = 0;
    let lastErr;
    let textIncludedInCreate = false;
    while (attempts < 3) {
      try {
        // Include raw text or filename in the initial KB create request when available
        const createPayload = {
          title: trainingData.title,
          description: trainingData.description,
          metadata: trainingData.metadata,
        };
        if (trainingData.rawText) createPayload.text = trainingData.rawText;
        if (trainingData.file && trainingData.file.filename) createPayload.filename = trainingData.file.filename;

        textIncludedInCreate = Boolean(createPayload.text);

        kbEntry = await createKnowledgeBaseEntry(replicaId, createPayload);
        break;
      } catch (err) {
        lastErr = err;
        const msg = err.message?.toLowerCase() || '';
        if (msg.includes('not found')) {
          attempts++;
          console.warn(`KB create 404 for replica ${replicaId} (attempt ${attempts}) waiting 1s`);
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        throw err;
      }
    }
    if (!kbEntry) throw lastErr || new Error('Unable to create KB entry after retries');

    // Sensay may return a 207 multi-status with results[] containing a knowledgeBaseID
    let entryId = kbEntry.id || kbEntry.uuid || kbEntry.data?.id;
    if (!entryId && Array.isArray(kbEntry.results) && kbEntry.results[0]) {
      entryId = kbEntry.results[0].knowledgeBaseID || kbEntry.results[0].knowledgeBaseId || kbEntry.results[0].id;
    }

    // 2. Add content (text or file)
    if (trainingData.rawText) {
      if (textIncludedInCreate) {
        console.log('Raw text was provided during create; skipping separate update');
      } else {
        console.log('Adding raw text to KB entry (update)...');
        await updateKnowledgeBaseWithText(replicaId, entryId, trainingData.rawText);
      }
    } else if (trainingData.file) {
      console.log('Uploading file to KB entry...');
      const signedUrlResponse = await requestSignedUploadUrl(
        entryId, 
        trainingData.file.filename, 
        trainingData.file.contentType
      );
      
      await uploadFileToSignedUrl(
        signedUrlResponse.signedUrl, 
        trainingData.file.buffer, 
        trainingData.file.contentType
      );
    } else {
      throw new Error('Either rawText or file must be provided for training');
    }

    // 3. Poll for completion
    console.log('Polling for training completion...');
    const finalStatus = await pollKnowledgeBaseEntryStatus(replicaId, entryId);
    
    console.log('Training completed successfully');
    return finalStatus;

  } catch (error) {
    console.error('Error in training workflow:', error.message);
    throw error;
  }
};

/**
 * Enhanced error handler for Sensay API responses
 * @param {Error} error - The axios error
 * @param {string} message - Custom error message
 * @returns {Error} Formatted error
 */
const handleSensayError = (error, message) => {
  if (error.response) {
    // API responded with error status
    const status = error.response.status;
    const data = error.response.data;
    
    console.error(`Sensay API Error: Status ${status}`, data);
    
    // Handle specific Sensay error cases
    switch (status) {
      case 401:
        return new Error('Unauthorized: Check your organization secret and user ID');
      case 403:
        return new Error('Forbidden: Insufficient permissions');
      case 404:
        return new Error('Not found: Resource does not exist');
      case 429:
        return new Error('Rate limit exceeded: Please retry after some time');
      case 500:
        return new Error('Sensay server error: Please try again later');
      default:
        const apiError = new Error(`${message}: ${data?.message || data?.error || 'Unknown error'}`);
        apiError.status = status;
        apiError.response = error.response;
        return apiError;
    }
  } else if (error.request) {
    console.error('No response from Sensay API:', error.request);
    return new Error(`${message}: Network error - could not connect to Sensay API`);
  } else {
    console.error('Request setup error:', error.message);
    return new Error(`${message}: ${error.message}`);
  }
};

/**
 * Poll Sensay for replica availability (GET /v1/replicas/:id)
 * Some downstream endpoints (KB) may 404 briefly right after creation.
 */
export const waitForReplicaAvailable = async (replicaId, maxAttempts = 5, delayMs = 1000) => {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await sensayApi.get(`/v1/replicas/${replicaId}`, { headers: sensayConfig.headers.base });
      if (res.status >= 200 && res.status < 300) return res.data;
    } catch (err) {
      // Ignore 404/5xx until attempts exhausted
    }
    await new Promise(r => setTimeout(r, delayMs));
  }
  throw new Error('Replica not yet available after retries');
};

/**
 * List knowledge base entries for a replica using the official API endpoint
 * @param {string} replicaId - The replica UUID
 * @param {Object} options - Query options (status, type, search, etc.)
 * @returns {Promise<Object>} KB entries with pagination info
 */
export const listKnowledgeBaseEntries = async (replicaId, options = {}) => {
  if (!replicaId) throw new Error('replicaId required');
  try {
    const params = new URLSearchParams();
    
    // Add query parameters according to API documentation
    if (options.status) params.append('status', Array.isArray(options.status) ? options.status.join(',') : options.status);
    if (options.type) params.append('type', Array.isArray(options.type) ? options.type.join(',') : options.type);
    if (options.search) params.append('search', options.search);
    if (options.hasError) params.append('hasError', options.hasError);
    if (options.page) params.append('page', options.page);
    if (options.pageSize) params.append('pageSize', options.pageSize);
    if (options.sortBy) params.append('sortBy', options.sortBy);
    if (options.sortOrder) params.append('sortOrder', options.sortOrder);
    
    const queryString = params.toString();
    const url = `/v1/replicas/${replicaId}/knowledge-base${queryString ? `?${queryString}` : ''}`;
    
    const res = await sensayApi.get(url, { headers: sensayConfig.headers.base });
    return res.data;
  } catch (error) {
    console.error('Error listing KB entries:', error.message);
    throw handleSensayError(error, 'Failed to list knowledge base entries');
  }
};

/**
 * Delete a knowledge base entry using the official API endpoint
 * @param {string} replicaId - The replica UUID
 * @param {number} entryId - The knowledge base entry ID
 * @returns {Promise<Object>} Deletion result
 */
export const deleteKnowledgeBaseEntry = async (replicaId, entryId) => {
  if (!replicaId) throw new Error('replicaId required');
  if (!entryId) throw new Error('entryId required');
  try {
    const res = await sensayApi.delete(`/v1/replicas/${replicaId}/knowledge-base/${entryId}`, { 
      headers: sensayConfig.headers.base 
    });
    return res.data || { success: true };
  } catch (error) {
    console.error('Error deleting KB entry:', error.message);
    throw handleSensayError(error, 'Failed to delete knowledge base entry');
  }
};

/**
 * Updates an existing replica in Sensay
 * @param {string} replicaUUID - The replica UUID to update
 * @param {Object} updateData - The updated replica data
 * @returns {Promise<Object>} Updated replica object
 */
export const updateReplica = async (replicaUUID, updateData) => {
  try {
    if (!replicaUUID) {
      throw new Error('Missing required parameter: replicaUUID');
    }

    const response = await sensayApi.put(`/v1/replicas/${replicaUUID}`, updateData, {
      headers: {
        ...sensayConfig.headers.base,
        'X-API-Version': '2025-03-25'
      }
    });

    if (response.status >= 200 && response.status < 300) {
      logger?.info?.(`Updated Sensay replica ${replicaUUID}`) || console.log('Updated replica', replicaUUID);
      return response.data;
    } else {
      throw new Error(`Update failed with status ${response.status}`);
    }
  } catch (error) {
    console.error('Error updating replica:', error.message);
    throw handleSensayError(error, 'Failed to update replica');
  }
};

/**
 * Start a training session placeholder. Returns a lightweight session object.
 * This is intentionally a thin wrapper so routes that expect start/complete
 * training session functions can import them without failing when the
 * underlying Sensay API does not expose explicit session endpoints.
 */
export const startTrainingSession = async (replicaId) => {
  console.log(`Starting training session for replica ${replicaId}`);
  // Return a local session id; callers may immediately call completeTrainingSession
  return { success: true, sessionId: `local_session_${Date.now()}` };
};

/**
 * Complete a training session placeholder. If you want real behavior, replace
 * this with a call into Sensay to finalize any queued training work.
 */
export const completeTrainingSession = async (replicaId, sessionId) => {
  console.log(`Completing training session ${sessionId} for replica ${replicaId}`);
  // No-op completion that signals success; keeps route logic simple for now.
  return { success: true, sessionId, completedAt: new Date().toISOString() };
};

/**
 * Delete a replica in Sensay (thin wrapper). Returns Sensay response or a mock.
 * @param {string} replicaId
 */
export const deleteReplica = async (replicaId) => {
  if (!replicaId) throw new Error('replicaId required');
  if (!sensayConfig.isProperlyConfigured()) {
    console.log(`⚠️ Sensay not configured - mock delete for ${replicaId}`);
    return { success: true, id: replicaId, message: 'Mock delete' };
  }

  try {
    const res = await sensayApi.delete(`/v1/replicas/${replicaId}`, { headers: sensayConfig.headers.base });
    return res.data || { success: true };
  } catch (error) {
    console.error('Error deleting replica in Sensay:', error.message);
    throw handleSensayError(error, 'Failed to delete replica');
  }
};

/**
 * Update a knowledge base entry (PATCH/PUT). This is a flexible helper used by routes.
 * @param {string} replicaId
 * @param {string} entryId
 * @param {Object} updateData
 */
export const updateKnowledgeBaseEntry = async (replicaId, entryId, updateData) => {
  if (!replicaId) throw new Error('replicaId required');
  if (!entryId) throw new Error('entryId required');

  if (!sensayConfig.isProperlyConfigured()) {
    console.log(`⚠️ Sensay not configured - mock update for ${entryId}`);
    return { success: true, id: entryId, ...updateData };
  }

  try {
    const url = `/v1/replicas/${replicaId}/knowledge-base/${entryId}`;
    const res = await sensayApi.patch(url, updateData, { headers: sensayConfig.headers.base });
    return res.data;
  } catch (error) {
    console.error('Error updating KB entry:', error.message);
    throw handleSensayError(error, 'Failed to update knowledge base entry');
  }
};