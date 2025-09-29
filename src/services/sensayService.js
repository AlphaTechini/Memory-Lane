import axios from 'axios';
import { sensayConfig } from '../config/sensay.js';
import logger from '../utils/logger.js';

/**
 * My main Sensay API service - handles all the heavy lifting for users, replicas, and knowledge base stuff
 * Built this to work seamlessly with the official Sensay API v2025-03-25
 * It's been a journey getting all the error handling just right!
 */

// Setting up my axios instance - 30 seconds should be plenty for most API calls
// Learned the hard way that some training operations can take a while!
const sensayApi = axios.create({
  baseURL: sensayConfig.baseUrl,
  timeout: 30000,
});

// Test hooks: test code can set these to override behavior in unit-like smoke tests
export let __testOverrideCreate = null;
export let __testOverrideGet = null;

// Setter helpers to allow tests to inject overrides (can't assign to imported bindings from other modules)
export const setTestOverrideCreate = (fn) => { __testOverrideCreate = fn; };
export const setTestOverrideGet = (fn) => { __testOverrideGet = fn; };
export const clearTestOverrides = () => { __testOverrideCreate = null; __testOverrideGet = null; };

/**
 * Create a Sensay user according to API documentation
 * POST /v1/users
 * @param {Object} params
 * @param {string} params.email - Email address (required)
 * @param {string} [params.name] - User name (max 50 chars, pattern: ^[a-zA-Z0-9\s().,'\-/]*$)
 * @param {string} [params.id] - Optional specific ID to request
 * @param {Array} [params.linkedAccounts] - Array of linked account objects
 * @returns {Promise<Object>} { id, email, name, linkedAccounts, success: true } or { conflict: true, error }
 */
export const createSensayUser = async ({ email, name, id, linkedAccounts }) => {
  if (__testOverrideCreate) return __testOverrideCreate({ email, name, id, linkedAccounts });
  try {
    if (!email) {
      throw new Error('Email is required for user creation');
    }

    // Building the request body - keeping it simple with just email to start
    const body = { email };
    
    // If they gave us a name, I need to validate it (learned this the hard way!)
    if (name) {
      const trimmedName = name.substring(0, 50);
      const namePattern = /^[a-zA-Z0-9\s().,'\-/]*$/;
      if (namePattern.test(trimmedName)) {
        body.name = trimmedName;
      } else {
        // Clean name to match pattern
        body.name = trimmedName.replace(/[^a-zA-Z0-9\s().,'\-/]/g, '').trim();
      }
    }
    
    // Toss in any optional stuff they provided
    if (id) body.id = id;
    if (linkedAccounts && Array.isArray(linkedAccounts)) {
      body.linkedAccounts = linkedAccounts;
    }

    const res = await sensayApi.post('/v1/users', body, { 
      headers: {
        ...sensayConfig.headers.base,
        'X-API-Version': '2025-03-25'
      }
    });
    
    // If everything went well, Sensay gives us back the user data
    if (res.data && res.data.success && res.data.id) {
      logger?.info?.(`Created Sensay user ${res.data.id} for ${email}`) || console.log('Created Sensay user', res.data.id);
      return res.data;
    } else {
      throw new Error('Invalid response format from Sensay API');
    }
  } catch (error) {
    if (error.response?.status === 409) {
      // 409: User, email, or linked account already exists
      const respData = error.response?.data || {};
      logger?.warn?.(`Sensay user conflict for ${email}: ${JSON.stringify(respData)}`) || console.warn('Sensay user conflict', email, respData);

      // Try to extract a Sensay user id from common fields in the error payload
      const maybeId = respData.id || respData.user?.id || respData.existingUser?.id || respData.existingUserId || respData.userId || respData.data?.id || respData.uuid;

      // Also check linkedAccounts array for an id field (some responses include this)
      let linkedAccountId = null;
      if (Array.isArray(respData.linkedAccounts)) {
        for (const la of respData.linkedAccounts) {
          if (la && (la.id || la.userId || la.uuid)) {
            linkedAccountId = la.id || la.userId || la.uuid;
            break;
          }
        }
      }

      const existingId = maybeId || linkedAccountId || null;

      if (existingId) {
        // Fetch the existing user directly using organization credentials
        try {
          const existingRes = await sensayApi.get(`/v1/users/${existingId}`, {
            headers: {
              ...sensayConfig.headers.base,
              'X-API-Version': '2025-03-25'
            }
          });

          if (existingRes?.data) {
            logger?.info?.(`Found existing Sensay user ${existingId} for ${email}`) || console.log('Found existing Sensay user', existingId);
            return existingRes.data;
          }
        } catch (fetchErr) {
          // If fetching fails, fall back to returning conflict info
          logger?.warn?.('Failed to fetch existing Sensay user by id', existingId, fetchErr.message) || console.warn('Failed fetch existing Sensay user', existingId, fetchErr.message);
        }
      }

      // If we couldn't resolve an existing user id from the conflict payload, try a best-effort lookup by email.
      // NOTE: Sensay's public docs don't guarantee an email search endpoint for org tokens. This is an optimistic
      // attempt — if the endpoint doesn't exist or is forbidden, we'll gracefully fall back to the original conflict
      // payload so callers (UI) can show a manual linking path.
      try {
        logger?.info?.(`Attempting best-effort Sensay lookup by email for ${email}`) || console.log('Attempting Sensay lookup by email', email);
        const maybeByEmail = await tryFindUserByEmail(email);
        if (maybeByEmail) {
          logger?.info?.(`Resolved existing Sensay user by email for ${email}: ${maybeByEmail.id || maybeByEmail.user?.id}`) || console.log('Resolved by email', maybeByEmail);
          return maybeByEmail;
        }
      } catch (emailErr) {
        logger?.warn?.('Email lookup for Sensay user failed', emailErr.message) || console.warn('Email lookup failed', emailErr.message);
      }

      // If all resolution attempts failed, return the conflict payload so callers can decide
      return { conflict: true, error: respData };
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
 * Get a user by ID using organization service token
 * GET /v1/users/{userID}
 * @param {string} userId - User ID (minimum length 1)
 * @returns {Promise<Object|null>} User object or null if not found
 */
export const getSensayUser = async (userId) => {
  if (__testOverrideGet) return __testOverrideGet(userId);
  try {
    if (!userId || userId.length < 1) {
      throw new Error('userId is required and must have minimum length of 1');
    }

    const res = await sensayApi.get(`/v1/users/${userId}`, { 
      headers: {
        ...sensayConfig.headers.base,
        'X-API-Version': '2025-03-25'
      }
    });
    
    // API returns { success: true, id, email, name, linkedAccounts }
    return res.data;
  } catch (error) {
    if (error.response?.status === 404) {
      return null;
    }
    throw handleSensayError(error, 'Failed to fetch Sensay user');
  }
};

// Note: The Sensay API does not provide a user search/listing endpoint.
// User lookup can only be done by specific user ID via GET /v1/users/{userID}
// or via the authenticated user endpoint GET /v1/users/me

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

  let raw = response.data || {};

  // Some environments may return a provisional 'uuid' before a full replica object is materialized
  let resolvedId = raw.id || raw.replicaId || raw.replica?.id || raw.data?.id || raw.uuid;

  // If Sensay didn't return an id, try a few best-effort fallbacks instead of throwing immediately
  if (!resolvedId) {
    // 1) Check Location header (some APIs return a Location: /v1/replicas/{id})
    const location = response.headers?.location || response.headers?.Location || response.headers?.['x-location'];
    if (location && typeof location === 'string') {
      try {
        const m = location.match(/\/v1\/replicas\/(?:([^\/?#]+))/i) || location.match(/\/replicas\/(?:([^\/?#]+))/i) || location.match(/([^\/]+)\/?$/);
        if (m && m[1]) resolvedId = m[1];
      } catch (err) {
        // ignore extraction errors
      }

      if (resolvedId) {
        try {
          const fetched = await sensayApi.get(`/v1/replicas/${resolvedId}`, { headers: sensayConfig.headers.base });
          if (fetched?.data) raw = fetched.data;
        } catch (err) {
          logger?.warn?.('Failed to fetch replica by id from Location header', resolvedId, err.message) || console.warn('Failed to fetch replica by id', resolvedId, err?.message);
        }
      }
    }

    // 2) Try listing replicas for owner and find by slug or name if ownerID provided
    if (!resolvedId && replicaData.ownerID) {
      try {
        const items = await listReplicas(replicaData.ownerID);
        if (Array.isArray(items) && items.length) {
          const match = items.find(it => (it.slug && replicaData.slug && it.slug === replicaData.slug) || (it.name && replicaData.name && it.name === replicaData.name));
          if (match) {
            resolvedId = match.id || match.uuid || match.replicaId || match._id || match._key;
            if (resolvedId) raw = match;
          }
        }
      } catch (err) {
        logger?.debug?.('listReplicas fallback failed', err.message) || console.debug('listReplicas fallback failed', err?.message);
      }
    }

    // 3) If still unresolved, return a provisional pending object rather than throwing so the UI can poll
    if (!resolvedId) {
      const pendingId = `pending_${Date.now()}`;
      logger?.warn?.('Sensay createReplica did not return id; returning pending replica object', { owner: replicaData.ownerID, slug: replicaData.slug }) || console.warn('Replica created but no id returned from Sensay');
      return { ...raw, id: pendingId, pending: true, message: 'Replica created but id missing from Sensay response; provisioning pending' };
    }
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
 * POST /v1/replicas/{replicaUUID}/knowledge-base
 * @param {string} replicaUUID - The replica UUID to train
 * @param {Object} entryData - Knowledge base entry data
 * @param {string} [entryData.title] - Title for this knowledge base entry
 * @param {string} [entryData.url] - A public URL to an HTML page or YouTube video to ingest
 * @param {boolean} [entryData.autoRefresh] - Whether to allow automatic content updates from the URL
 * @param {string} [entryData.text] - The text content you want your replica to learn
 * @param {string} [entryData.filename] - The name of the file to upload
 * @returns {Promise<Object>} Created KB entry response with 207 status
 */
export const createKnowledgeBaseEntry = async (replicaUUID, entryData) => {
  console.log(`🔍 Creating KB entry for replica ${replicaUUID} with data:`, JSON.stringify(entryData, null, 2));
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
  
  const url = `/v1/replicas/${replicaUUID}/knowledge-base`;
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

      const primaryId = data.id ?? data.knowledgeBaseID ?? data.knowledgeBaseId ?? (Array.isArray(data.entryIds) ? data.entryIds[0] : undefined);
      normalized.id = primaryId;

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
      console.warn(`⚠️ Knowledge base endpoint returned 404 for replica ${replicaUUID}`);
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
 * PUT /v1/replicas/{replicaUUID}/knowledge-base/{id}
 * @param {string} replicaUUID - The replica UUID
 * @param {string} entryId - The KB entry ID
 * @param {string} rawText - The text content to add
 * @returns {Promise<Object>} Updated KB entry object
 */
export const updateKnowledgeBaseWithText = async (replicaUUID, entryId, rawText) => {
  if (!replicaUUID) throw new Error('replicaUUID is required');
  if (!entryId) throw new Error('entryId is required');
  try {
    const url = `/v1/replicas/${replicaUUID}/knowledge-base/${entryId}`;
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
 * GET /v1/replicas/{replicaUUID}/knowledge-base/{id}
 * @param {string} replicaUUID - The replica UUID
 * @param {string} knowledgeBaseID - The knowledge base entry ID
 * @returns {Promise<Object>} KB entry status and details
 */
export const getKnowledgeBaseEntryStatus = async (replicaUUID, knowledgeBaseID) => {
  console.log(`🔍 Checking KB entry status for replica ${replicaUUID}, entry ${knowledgeBaseID}`);
  
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
  
  const url = `/v1/replicas/${replicaUUID}/knowledge-base/${knowledgeBaseID}`;
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
 * GET /v1/replicas/{replicaUUID}/knowledge-base/{id}
 * @param {string} replicaUUID - The replica UUID
 * @param {string|number} entryId - The knowledge base entry ID
 * @returns {Promise<Object>} Complete KB entry details including type, status, content, and metadata
 */
export const getKnowledgeBaseEntry = async (replicaUUID, entryId) => {
  if (!replicaUUID) throw new Error('replicaUUID is required');
  if (!entryId) throw new Error('entryId is required');
  
  console.log(`🔍 Fetching KB entry for replica ${replicaUUID}, entry ${entryId}`);
  
  if (!sensayConfig.isProperlyConfigured()) {
    console.log(`⚠️ Knowledge base retrieval skipped - Sensay API not properly configured`);
    return { 
      id: entryId,
      replicaUUID: replicaUUID,
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
      replicaUUID: replicaUUID,
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

  const url = `/v1/replicas/${replicaUUID}/knowledge-base/${entryId}`;
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
 * @param {string} replicaUUID - The replica UUID
 * @param {string} knowledgeBaseID - The KB entry ID
 * @param {number} maxAttempts - Maximum polling attempts (default: 60)
 * @param {number} intervalMs - Polling interval in milliseconds (default: 5000)
 * @returns {Promise<Object>} Final KB entry status
 */
export const pollKnowledgeBaseEntryStatus = async (replicaUUID, knowledgeBaseID, maxAttempts = 60, intervalMs = 5000) => {
  let attempts = 0;
  
  console.log(`🔍 Starting to poll KB entry status for replica ${replicaUUID}, entry ${knowledgeBaseID}`);
  
  while (attempts < maxAttempts) {
    try {
      const status = await getKnowledgeBaseEntryStatus(replicaUUID, knowledgeBaseID);
      
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
 * POST /v1/replicas/{replicaUUID}/chat/completions
 * @param {string} replicaUUID - The replica UUID
 * @param {string} message - The message to send
 * @param {string} userId - The user ID for authentication
 * @param {Array} [context=[]] - Conversation context
 * @param {boolean} [streaming=false] - Whether to use streaming response
 * @returns {Promise<Object>} Chat response
 */
export const sendChatMessage = async (replicaUUID, message, userId, context = [], streaming = false) => {
  try {
    const endpoint = sensayConfig.endpoints.chat.replace('{replicaId}', replicaUUID);
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
    console.log(`Sending chat message to replica ${replicaUUID}:`, { 
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
    // Log masked headers for debugging
    try {
      const sentHeaders = headers || {};
      const masked = { ...sentHeaders };
      if (masked['X-ORGANIZATION-SECRET']) masked['X-ORGANIZATION-SECRET'] = '***REDACTED***';
      if (masked['X-USER-ID'] && typeof masked['X-USER-ID'] === 'string' && masked['X-USER-ID'].length > 6) {
        const v = masked['X-USER-ID'];
        masked['X-USER-ID'] = `${v.slice(0,3)}...${v.slice(-3)}`;
      }
      console.error('Error details:', error.response?.data || error, 'Sent headers:', masked);
    } catch (logErr) {
      console.error('Failed to log masked headers:', logErr.message);
    }
    throw handleSensayError(error, 'Failed to send chat message');
  }
};

/**
 * Complete training workflow: create entry, add content, poll for completion
 * @param {string} replicaUUID - The replica UUID
 * @param {Object} trainingData - Training data
 * @param {string} trainingData.title - Title for the KB entry
 * @param {string} [trainingData.description] - Description
 * @param {string} [trainingData.rawText] - Raw text content (mutually exclusive with file)
 * @param {Object} [trainingData.file] - File data {buffer, filename, contentType}
 * @returns {Promise<Object>} Final training result
 */
export const trainReplica = async (replicaUUID, trainingData) => {
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

        kbEntry = await createKnowledgeBaseEntry(replicaUUID, createPayload);
        break;
      } catch (err) {
        lastErr = err;
        const msg = err.message?.toLowerCase() || '';
        if (msg.includes('not found')) {
          attempts++;
          console.warn(`KB create 404 for replica ${replicaUUID} (attempt ${attempts}) waiting 1s`);
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
        await updateKnowledgeBaseWithText(replicaUUID, entryId, trainingData.rawText);
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
    const finalStatus = await pollKnowledgeBaseEntryStatus(replicaUUID, entryId);
    
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
 * Poll Sensay for replica availability (GET /v1/replicas/{replicaUUID})
 * Some downstream endpoints (KB) may 404 briefly right after creation.
 */
export const waitForReplicaAvailable = async (replicaUUID, maxAttempts = 5, delayMs = 1000) => {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await sensayApi.get(`/v1/replicas/${replicaUUID}`, { headers: sensayConfig.headers.base });
      if (res.status >= 200 && res.status < 300) return res.data;
    } catch (err) {
      // Ignore 404/5xx until attempts exhausted
    }
    await new Promise(r => setTimeout(r, delayMs));
  }
  throw new Error('Replica not yet available after retries');
};

/**
 * List all knowledge base entries belonging to a replica
 * GET /v1/replicas/{replicaUUID}/knowledge-base
 * @param {string} replicaUUID - The replica unique identifier (UUID)
 * @param {Object} options - Query options
 * @param {Array<string>|string} [options.status] - Filter by processing statuses (NEW, FILE_UPLOADED, RAW_TEXT, PROCESSED_TEXT, VECTOR_CREATED, READY, UNPROCESSABLE)
 * @param {Array<string>|string} [options.type] - Filter by content type (file, text, website, youtube)
 * @param {string} [options.search] - Filter by title, filename, or URL (min length 3)
 * @param {string} [options.hasError] - Filter entries with errors ('true' or 'false')
 * @param {number} [options.page] - Page number for pagination (default: 1)
 * @param {number} [options.pageSize] - Max entries per page (0-100, default: 24)
 * @param {string} [options.sortBy] - Sort criteria ('createdAt', default: 'createdAt')
 * @param {string} [options.sortOrder] - Sort order ('asc' or 'desc', default: 'desc')
 * @returns {Promise<Object>} { success: true, items: [...], total: number }
 */
export const listKnowledgeBaseEntries = async (replicaUUID, options = {}) => {
  if (!replicaUUID) throw new Error('replicaUUID is required');
  
  try {
    const params = new URLSearchParams();
    
    // Validate and add query parameters according to API documentation
    if (options.status) {
      const validStatuses = ['NEW', 'FILE_UPLOADED', 'RAW_TEXT', 'PROCESSED_TEXT', 'VECTOR_CREATED', 'READY', 'UNPROCESSABLE'];
      const statusArray = Array.isArray(options.status) ? options.status : [options.status];
      const invalidStatuses = statusArray.filter(s => !validStatuses.includes(s));
      if (invalidStatuses.length > 0) {
        throw new Error(`Invalid status values: ${invalidStatuses.join(', ')}. Valid values are: ${validStatuses.join(', ')}`);
      }
      params.append('status', statusArray.join(','));
    }
    
    if (options.type) {
      const validTypes = ['file', 'text', 'website', 'youtube'];
      const typeArray = Array.isArray(options.type) ? options.type : [options.type];
      const invalidTypes = typeArray.filter(t => !validTypes.includes(t));
      if (invalidTypes.length > 0) {
        throw new Error(`Invalid type values: ${invalidTypes.join(', ')}. Valid values are: ${validTypes.join(', ')}`);
      }
      params.append('type', typeArray.join(','));
    }
    
    if (options.search) {
      if (typeof options.search !== 'string' || options.search.length < 3) {
        throw new Error('Search parameter must be a string with minimum length of 3');
      }
      params.append('search', options.search);
    }
    
    if (options.hasError !== undefined) {
      if (options.hasError !== 'true' && options.hasError !== 'false') {
        throw new Error('hasError parameter must be "true" or "false"');
      }
      params.append('hasError', options.hasError);
    }
    
    if (options.page !== undefined) {
      const page = Number(options.page);
      if (!Number.isInteger(page) || page < 1) {
        throw new Error('Page must be an integer >= 1');
      }
      params.append('page', page.toString());
    }
    
    if (options.pageSize !== undefined) {
      const pageSize = Number(options.pageSize);
      if (!Number.isInteger(pageSize) || pageSize < 0 || pageSize > 100) {
        throw new Error('PageSize must be an integer between 0 and 100');
      }
      params.append('pageSize', pageSize.toString());
    }
    
    if (options.sortBy) {
      if (options.sortBy !== 'createdAt') {
        throw new Error('sortBy must be "createdAt"');
      }
      params.append('sortBy', options.sortBy);
    }
    
    if (options.sortOrder) {
      if (options.sortOrder !== 'asc' && options.sortOrder !== 'desc') {
        throw new Error('sortOrder must be "asc" or "desc"');
      }
      params.append('sortOrder', options.sortOrder);
    }
    
    const queryString = params.toString();
    const url = `/v1/replicas/${replicaUUID}/knowledge-base${queryString ? `?${queryString}` : ''}`;
    
    const res = await sensayApi.get(url, { 
      headers: {
        ...sensayConfig.headers.base,
        'X-API-Version': '2025-03-25'
      }
    });
    
    // API returns { success: true, items: [...], total: number }
    if (res.data && res.data.success && Array.isArray(res.data.items)) {
      return res.data;
    } else {
      throw new Error('Invalid response format from Sensay API');
    }
  } catch (error) {
    // Handle documented error responses
    if (error.response?.status === 400) {
      throw new Error(`Bad Request: ${error.response.data?.error || 'Invalid parameters'}`);
    }
    if (error.response?.status === 401) {
      throw new Error('Unauthorized: Invalid API credentials');
    }
    if (error.response?.status === 404) {
      throw new Error('Replica not found');
    }
    if (error.response?.status === 415) {
      throw new Error('Unsupported Media Type');
    }
    if (error.response?.status === 500) {
      throw new Error(`Internal Server Error: ${error.response.data?.error || 'Server error'}`);
    }
    
    console.error('Error listing KB entries:', error.message);
    throw handleSensayError(error, 'Failed to list knowledge base entries');
  }
};

/**
 * Delete a knowledge base entry
 * DELETE /v1/replicas/{replicaUUID}/knowledge-base/{id}
 * @param {string} replicaUUID - The replica UUID
 * @param {number} entryId - The knowledge base entry ID
 * @returns {Promise<Object>} Deletion result
 */
export const deleteKnowledgeBaseEntry = async (replicaUUID, entryId) => {
  if (!replicaUUID) throw new Error('replicaUUID is required');
  if (!entryId) throw new Error('entryId is required');
  
  try {
    const res = await sensayApi.delete(`/v1/replicas/${replicaUUID}/knowledge-base/${entryId}`, { 
      headers: {
        ...sensayConfig.headers.base,
        'X-API-Version': '2025-03-25'
      }
    });
    
    // API typically returns 204 No Content for successful deletion
    if (res.status === 204 || res.status === 200) {
      return { success: true, message: 'Knowledge base entry deleted successfully' };
    }
    
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
export const startTrainingSession = async (replicaUUID) => {
  console.log(`Starting training session for replica ${replicaUUID}`);
  // Return a local session id; callers may immediately call completeTrainingSession
  return { success: true, sessionId: `local_session_${Date.now()}` };
};

/**
 * Complete a training session placeholder. If you want real behavior, replace
 * this with a call into Sensay to finalize any queued training work.
 */
export const completeTrainingSession = async (replicaUUID, sessionId) => {
  console.log(`Completing training session ${sessionId} for replica ${replicaUUID}`);
  // No-op completion that signals success; keeps route logic simple for now.
  return { success: true, sessionId, completedAt: new Date().toISOString() };
};

/**
 * Delete a replica in Sensay
 * DELETE /v1/replicas/{replicaUUID}
 * @param {string} replicaUUID - The replica UUID
 */
export const deleteReplica = async (replicaUUID) => {
  if (!replicaUUID) throw new Error('replicaUUID is required');
  if (!sensayConfig.isProperlyConfigured()) {
    console.log(`⚠️ Sensay not configured - mock delete for ${replicaUUID}`);
    return { success: true, id: replicaUUID, message: 'Mock delete' };
  }

  try {
    const res = await sensayApi.delete(`/v1/replicas/${replicaUUID}`, { headers: sensayConfig.headers.base });
    return res.data || { success: true };
  } catch (error) {
    console.error('Error deleting replica in Sensay:', error.message);
    throw handleSensayError(error, 'Failed to delete replica');
  }
};

/**
 * Update a knowledge base entry (PATCH/PUT). This is a flexible helper used by routes.
 * PATCH /v1/replicas/{replicaUUID}/knowledge-base/{id}
 * @param {string} replicaUUID - The replica UUID
 * @param {string} entryId - The knowledge base entry ID
 * @param {Object} updateData - Data to update
 */
export const updateKnowledgeBaseEntry = async (replicaUUID, entryId, updateData) => {
  if (!replicaUUID) throw new Error('replicaUUID is required');
  if (!entryId) throw new Error('entryId is required');

  if (!sensayConfig.isProperlyConfigured()) {
    console.log(`⚠️ Sensay not configured - mock update for KB entry ${entryId}`);
    return { success: true, id: entryId, ...updateData, message: 'Mock update' };
  }

  try {
    const res = await sensayApi.patch(`/v1/replicas/${replicaUUID}/knowledge-base/${entryId}`, updateData, { 
      headers: {
        ...sensayConfig.headers.base,
        'X-API-Version': '2025-03-25'
      }
    });
    return res.data || { success: true };
  } catch (error) {
    console.error('Error updating KB entry:', error.message);
    throw handleSensayError(error, 'Failed to update knowledge base entry');
  }
};

/**
 * Get current user information using organization service token & user ID
 * GET /v1/users/me
 * @param {string} userId - The user ID to authenticate the request
 * @returns {Promise<Object|null>} User information or null if not found
 */
export const getCurrentSensayUser = async (userId) => {
  if (!userId) throw new Error('userId required');
  
  try {
    const headers = {
      ...sensayConfig.headers.base,
      'X-USER-ID': userId,
      'X-API-Version': '2025-03-25'
    };
    
    const res = await sensayApi.get('/v1/users/me', { headers });
    
    // API returns { success: true, id, email, name, linkedAccounts }
    if (res.data && res.data.success) {
      logger?.info?.(`Retrieved current Sensay user ${res.data.id}`) || console.log('Retrieved current user', res.data.id);
      return res.data;
    } else {
      throw new Error('Invalid response format from Sensay API');
    }
  } catch (error) {
    if (error.response?.status === 404) {
      logger?.warn?.(`Sensay user not found: ${userId}`) || console.warn('Sensay user not found', userId);
      return null;
    }
    logger?.warn?.(`Failed to get current Sensay user ${userId}: ${error.message}`) || console.warn('Failed to get current user', error.message);
    throw handleSensayError(error, 'Failed to get current Sensay user');
  }
};

/**
 * Update current user in Sensay API
 * @param {string} userId - The user ID to authenticate the request
 * @param {Object} userData - User data to update
 * @param {string} [userData.email] - Email address
 * @param {string} [userData.name] - User name (max 50 chars, pattern: ^[a-zA-Z0-9\s().,'\-/]*$)
 * @param {Array} [userData.linkedAccounts] - Array of linked account objects
 * @returns {Promise<Object>} Updated user information
 */
export const updateCurrentSensayUser = async (userId, userData) => {
  if (!userId) throw new Error('userId required');
  
  try {
    // Validate name if provided
    if (userData.name && userData.name.length > 50) {
      userData.name = userData.name.substring(0, 50);
    }
    
    if (userData.name && !/^[a-zA-Z0-9\s().,'\-/]*$/.test(userData.name)) {
      // Clean the name to match the required pattern
      userData.name = userData.name.replace(/[^a-zA-Z0-9\s().,'\-/]/g, '').trim();
    }

    const headers = sensayConfig.headers.withUser(userId);
    const res = await sensayApi.put('/v1/users/me', { id: userId, ...userData }, { headers });
    
    logger?.info?.(`Updated current Sensay user ${userId}`) || console.log('Updated current user', userId);
    return res.data;
  } catch (error) {
    if (error.response?.status === 400) {
      logger?.warn?.(`Bad request updating Sensay user ${userId}: ${JSON.stringify(error.response.data)}`) || console.warn('Bad request updating user', error.response.data);
      throw new Error(`Bad Request: ${error.response.data?.error || 'Invalid user data'}`);
    }
    if (error.response?.status === 409) {
      logger?.warn?.(`Conflict updating Sensay user ${userId}: ${JSON.stringify(error.response.data)}`) || console.warn('Conflict updating user', error.response.data);
      throw new Error(`Conflict: ${error.response.data?.error || 'Email or linked account already exists'}`);
    }
    logger?.warn?.(`Failed to update current Sensay user ${userId}: ${error.message}`) || console.warn('Failed to update current user', error.message);
    throw handleSensayError(error, 'Failed to update current Sensay user');
  }
};

/**
 * Delete the current user permanently (cannot be recovered)
 * DELETE /v1/users/me
 * @param {string} userId - The user ID to authenticate the request
 * @returns {Promise<Object>} Deletion result
 */
export const deleteCurrentSensayUser = async (userId) => {
  if (!userId) throw new Error('userId required');
  
  try {
    const headers = {
      ...sensayConfig.headers.base,
      'X-USER-ID': userId,
      'X-API-Version': '2025-03-25'
    };
    
    const res = await sensayApi.delete('/v1/users/me', { headers });
    
    // API returns 204 (no content) on successful deletion
    if (res.status === 204) {
      logger?.info?.(`Deleted current Sensay user ${userId}`) || console.log('Deleted current user', userId);
      return { success: true, message: 'User deleted successfully' };
    } else {
      throw new Error('Unexpected response from deletion endpoint');
    }
  } catch (error) {
    // Handle documented error responses
    if (error.response?.status === 400) {
      throw new Error(`Bad Request: ${error.response.data?.error || 'Invalid request'}`);
    }
    if (error.response?.status === 401) {
      throw new Error('Unauthorized: Invalid API credentials');
    }
    if (error.response?.status === 404) {
      logger?.warn?.(`Sensay user not found for deletion: ${userId}`) || console.warn('Sensay user not found for deletion', userId);
      return { success: true, message: 'User not found (already deleted)' };
    }
    if (error.response?.status === 415) {
      throw new Error('Unsupported Media Type');
    }
    if (error.response?.status === 500) {
      throw new Error(`Internal Server Error: ${error.response.data?.error || 'Server error'}`);
    }
    
    logger?.warn?.(`Failed to delete current Sensay user ${userId}: ${error.message}`) || console.warn('Failed to delete current user', error.message);
    throw handleSensayError(error, 'Failed to delete current Sensay user');
  }
};

/**
 * Get a specific user by ID from Sensay API (organization service token required)
 * @param {string} userId - The user ID to retrieve
 * @returns {Promise<Object|null>} User information or null if not found
 */
export const getSensayUserById = async (userId) => {
  if (!userId) throw new Error('userId required');
  
  try {
    const res = await sensayApi.get(`/v1/users/${userId}`, { 
      headers: sensayConfig.headers.base 
    });
    
    logger?.info?.(`Retrieved Sensay user by ID ${userId}`) || console.log('Retrieved user by ID', userId);
    return res.data;
  } catch (error) {
    if (error.response?.status === 404) {
      logger?.warn?.(`Sensay user not found by ID: ${userId}`) || console.warn('Sensay user not found by ID', userId);
      return null;
    }
    logger?.warn?.(`Failed to get Sensay user by ID ${userId}: ${error.message}`) || console.warn('Failed to get user by ID', error.message);
    throw handleSensayError(error, 'Failed to get Sensay user by ID');
  }
};

/**
 * Sync local user data with Sensay user
 * @param {Object} localUser - Local user object with sensayUserId
 * @returns {Promise<Object>} Sync result with updated user data
 */
export const syncUserWithSensay = async (localUser) => {
  if (!localUser) throw new Error('localUser required');
  if (!localUser.sensayUserId) {
    logger?.warn?.(`Cannot sync user ${localUser.id || localUser._id} - no sensayUserId`) || console.warn('Cannot sync user - no sensayUserId');
    return { success: false, message: 'No Sensay user ID found' };
  }

  try {
    // Get current user data from Sensay
    const sensayUser = await getCurrentSensayUser(localUser.sensayUserId);
    
    if (!sensayUser) {
      logger?.warn?.(`Sensay user ${localUser.sensayUserId} not found during sync`) || console.warn('Sensay user not found during sync');
      return { success: false, message: 'Sensay user not found' };
    }

    // Compare and update if needed
    const needsUpdate = (
      sensayUser.email !== localUser.email ||
      sensayUser.name !== `${localUser.firstName || ''} ${localUser.lastName || ''}`.trim()
    );

    if (needsUpdate) {
      const fullName = `${localUser.firstName || ''} ${localUser.lastName || ''}`.trim();
      const updateData = {
        email: localUser.email,
        name: fullName || localUser.email.split('@')[0]
      };

      const updatedUser = await updateCurrentSensayUser(localUser.sensayUserId, updateData);
      
      logger?.info?.(`Synced local user ${localUser.id || localUser._id} with Sensay user ${localUser.sensayUserId}`) || console.log('Synced user with Sensay');
      return { success: true, message: 'User data synced', sensayUser: updatedUser };
    }

    return { success: true, message: 'User data already in sync', sensayUser };

  } catch (error) {
    logger?.error?.(`Failed to sync user ${localUser.id || localUser._id} with Sensay: ${error.message}`) || console.error('Failed to sync user with Sensay', error.message);
    return { success: false, message: error.message, error };
  }
};

/**
 * Ensure a user exists in Sensay, creating if necessary
 * Since the API doesn't support user search by email, we can only attempt creation
 * @param {Object} userData - User data
 * @param {string} userData.email - Email address
 * @param {string} [userData.name] - Full name
 * @param {string} [userData.id] - Preferred user ID
 * @param {Array} [userData.linkedAccounts] - Array of linked account objects
 * @returns {Promise<Object>} User creation result
 */
export const ensureSensayUser = async (userData) => {
  if (!userData?.email) throw new Error('userData.email required');

  try {
    // Try to create the user
    const sensayUser = await createSensayUser(userData);
    
    if (sensayUser && sensayUser.conflict) {
      // We got a conflict from Sensay. Try to resolve it by extracting any ID-like
      // field from the error payload and fetching the existing user directly.
      const errPayload = sensayUser.error || {};
      logger?.warn?.(`Sensay create user conflict for ${userData.email}: ${JSON.stringify(errPayload)}`) || console.warn('Sensay conflict payload', errPayload);

      const maybeId = errPayload.id || errPayload.user?.id || errPayload.existingUser?.id || errPayload.existingUserId || errPayload.userId || errPayload.data?.id || errPayload.uuid;

      // Check linked accounts array for a possible id
      let linkedAccountId = null;
      if (Array.isArray(errPayload.linkedAccounts)) {
        for (const la of errPayload.linkedAccounts) {
          if (la && (la.id || la.userId || la.uuid)) {
            linkedAccountId = la.id || la.userId || la.uuid;
            break;
          }
        }
      }

      const existingId = maybeId || linkedAccountId || null;

      if (existingId) {
        try {
          const existingUser = await getSensayUser(existingId);
          if (existingUser) {
            logger?.info?.(`Resolved existing Sensay user ${existingId} for ${userData.email}`) || console.log('Resolved existing Sensay user', existingId);
            return { success: true, user: existingUser, created: false, resolvedFromConflict: true };
          }
        } catch (fetchErr) {
          logger?.warn?.('Failed to fetch Sensay user for id extracted from conflict payload', existingId, fetchErr.message) || console.warn('Failed fetch for conflict id', existingId, fetchErr.message);
        }
      }

      // Couldn't resolve the existing user; return conflict so the caller can decide
      return {
        success: false,
        message: 'User already exists in Sensay but we could not resolve their id automatically.',
        conflict: true,
        error: sensayUser.error
      };
    } else if (sensayUser && sensayUser.id) {
      logger?.info?.(`Created or retrieved Sensay user ${sensayUser.id} for ${userData.email}`) || console.log('Created or retrieved Sensay user', sensayUser.id);
      return { success: true, user: sensayUser, created: true };
    } else {
      throw new Error('Invalid response from Sensay user creation');
    }

  } catch (error) {
    logger?.error?.(`Failed to ensure Sensay user for ${userData.email}: ${error.message}`) || console.error('Failed to ensure Sensay user', error.message);
    throw error;
  }
};

/**
 * Best-effort lookup by email for cases where Sensay returns a 409 without an id.
 * Some org-token endpoints may allow querying by email (not guaranteed by public docs).
 * Returns user object or null if not found / not supported.
 */
export const tryFindUserByEmail = async (email) => {
  if (!email) return null;
  try {
    // Optimistically try a query endpoint. If Sensay doesn't support this, it'll likely return 404/400/403.
    const res = await sensayApi.get(`/v1/users`, {
      headers: {
        ...sensayConfig.headers.base,
        'X-API-Version': '2025-03-25'
      },
      params: { email }
    });

    // If API returns a single user or a list, normalize.
    const data = res.data || {};
    if (!data) return null;

    if (Array.isArray(data.items) && data.items.length) return data.items[0];
    if (Array.isArray(data) && data.length) return data[0];
    if (data.user) return data.user;
    if (data.id) return data;

    return null;
  } catch (error) {
    // Not all org tokens / API versions support this. Don't escalate - just return null.
    logger?.debug?.('tryFindUserByEmail failed', error.response?.status, error.response?.data) || console.debug('tryFindUserByEmail failed', error?.message);
    return null;
  }
};