import { 
  createReplica, 
  trainReplica, 
  getKnowledgeBaseEntryStatus,
  sendChatMessage,
  waitForReplicaAvailable,
  listReplicas,
  createKnowledgeBaseEntry,
  updateKnowledgeBaseWithText,
  pollKnowledgeBaseEntryStatus,
  updateReplica
} from '../services/sensayService.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import User from '../models/User.js';
import Conversation from '../models/Conversation.js';
import { REQUIRED_QUESTIONS, OPTIONAL_SEGMENTS, getQuestionText } from '../utils/questionBank.js';
import { sensayConfig } from '../config/sensay.js';

/**
 * Replica management routes
 * @param {import('fastify').FastifyInstance} fastify - The Fastify server instance
 * @param {object} options - Plugin options
 */
async function replicaRoutes(fastify, options) {
  // Safe wrapper for creating empty KB entry
  const createKnowledgeBaseEntrySafe = async (replicaId, data) => {
    return await createKnowledgeBaseEntry(replicaId, data);
  };

  // Schema for replica creation from wizard
  const createReplicaSchema = {
    body: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        requiredAnswers: { type: 'object' },
        optionalAnswers: { type: 'object' },
        selectedSegments: { 
          type: 'array',
          items: { type: 'string' }
        },
        profileImage: { type: 'string' },
        coverageScore: { type: 'number' }
      },
      required: ['name', 'description', 'requiredAnswers', 'optionalAnswers', 'selectedSegments']
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          replica: { type: 'object' }
        }
      }
    }
  };

  // Schema for training with text
  const trainWithTextSchema = {
    body: {
      type: 'object',
      properties: {
        replicaId: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        rawText: { type: 'string' }
      },
      required: ['replicaId', 'title', 'rawText']
    }
  };

  /**
   * Create a new replica from wizard data (protected route)
   */
  fastify.post('/api/replicas', { 
    schema: createReplicaSchema,
    preHandler: authenticateToken 
  }, async (request, reply) => {
    try {
      const { name, description, requiredAnswers, optionalAnswers, selectedSegments, profileImage, coverageScore } = request.body;
      
      // Load user and ensure they have a Sensay user ID
      const user = await User.findById(request.user.id);
      if (!user || !user.sensayUserId) {
        return reply.status(400).send({
          success: false,
          code: 'SENSAY_USER_MISSING',
            error: 'Sensay user not linked for this account. Please contact support or retry later.'
        });
      }

      // Generate a slug from the name
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      
      // Ensure description is within 50 character limit for Sensay API
      const shortDescription = description.length > 50 ? description.substring(0, 50) : description;
      
      // Create a greeting from the description
      const greeting = `Hi! I'm ${name}. ${shortDescription}`;
      
      // Prepare Sensay replica data with supported model
      const sensayReplicaData = {
        name,
        shortDescription,
        greeting,
        ownerID: user.sensayUserId,
        slug: `${slug}-${Date.now()}`, // Make it unique
        llm: {
          model: "gpt-4o" // Use gpt-4o which is allowed by the plan
        }
      };

      // Additional validation per requirements
      if (!name || !shortDescription || !greeting || !sensayReplicaData.slug || !sensayReplicaData.llm?.model || !sensayReplicaData.ownerID) {
        return reply.status(400).send({ success: false, error: 'Missing required replica fields' });
      }

      fastify.log.info(`Creating replica with gpt-4o model for owner (user): ${user.sensayUserId}`);
      
      // Create replica in Sensay
      const sensayReplica = await createReplica(sensayReplicaData);

      // Wait for replica availability to reduce immediate 404s in KB creation
      try {
        await waitForReplicaAvailable(sensayReplica.id);
      } catch (availErr) {
        fastify.log.warn(availErr, 'Replica availability polling exhausted, proceeding with training attempts anyway');
      }
      
      // Prepare training data from wizard responses
      const trainingTexts = [];
      
      // Add required answers as training data
      Object.entries(requiredAnswers).forEach(([questionId, answer]) => {
        const question = REQUIRED_QUESTIONS.find(q => q.id === questionId);
        if (question && answer.trim()) {
          trainingTexts.push({
            title: `Required: ${question.text}`,
            content: answer
          });
        }
      });
      
      // Add optional answers as training data
      Object.entries(optionalAnswers).forEach(([questionId, answer]) => {
        if (answer.trim()) {
          const questionText = getQuestionText(questionId);
          trainingTexts.push({
            title: `Personal: ${questionText}`,
            content: answer
          });
        }
      });
      
      // Training strategy: attempt full set; if certain validation errors occur, fallback to simplified single-entry answers.
      let trainingCount = 0;
      let usedSimplified = false;
      const fallbackPattern = /(invalid|format|too large|unsupported|payload)/i;

      const attemptEntries = async (entries) => {
        for (const entry of entries) {
          try {
            if (!sensayReplica?.id) {
              fastify.log.warn('Replica id missing; aborting further training attempts');
              break;
            }
            await trainReplica(sensayReplica.id, {
              title: entry.title.substring(0, 80), // keep titles concise
              rawText: entry.content
            });
            trainingCount++;
          } catch (err) {
            fastify.log.warn(err, `Failed to train replica with: ${entry.title}`);
            const msg = err.message?.toLowerCase() || '';
            if (msg.includes('not found')) {
              fastify.log.warn('Encountered Not Found during training; stopping to avoid spamming.');
              // Don't break completely - allow replica creation to succeed even if training fails
              fastify.log.info(`Replica ${sensayReplica.id} created successfully, but training failed due to API limitations.`);
              break; // eventual consistency issue; stop further until later manual training
            }
            if (fallbackPattern.test(msg)) {
              // Signal to fallback to simplified approach
              throw new Error('FALLBACK_TRIGGER');
            }
            // Non-fallback error: continue to next entry
          }
        }
      };

      try {
        await attemptEntries(trainingTexts);
      } catch (flag) {
        if (flag.message === 'FALLBACK_TRIGGER') {
          usedSimplified = true;
          // Build simplified single combined raw answer payload (answers only, no prefixes)
          const allAnswers = [
            ...Object.values(requiredAnswers || {}),
            ...Object.values(optionalAnswers || {})
          ].filter(a => typeof a === 'string' && a.trim());
          if (allAnswers.length) {
            const combined = allAnswers.join('\n\n');
            try {
              await trainReplica(sensayReplica.id, {
                title: 'User Answers',
                rawText: combined.substring(0, 15000) // safety cap
              });
              trainingCount = 1; // overwrite with simplified count if successful
            } catch (fallbackErr) {
              fastify.log.warn(fallbackErr, 'Simplified fallback training failed');
            }
          }
        }
      }
      
      // Save replica info to user's profile
      const replicaData = {
        replicaId: sensayReplica.id,
        name,
        description,
        profileImageUrl: profileImage || null,
        selectedSegments,
        coverageScore: coverageScore || 0,
        lastTrained: new Date()
      };
      
      await User.findByIdAndUpdate(
        request.user.id,
        { $push: { replicas: replicaData } },
        { new: true }
      );
      
      return { 
        success: true, 
        replica: {
          id: sensayReplica.id,
          ...replicaData,
          trainingCount,
          usedSimplified
        }
      };
    } catch (error) {
      fastify.log.error(error, 'Error creating replica');
      
      if (error.status) {
        return reply.status(error.status).send({ 
          success: false, 
          error: error.message 
        });
      }
      
      return reply.status(500).send({ 
        success: false, 
        error: 'Failed to create replica' 
      });
    }
  });

  /**
   * Reconcile local replicas with Sensay remote state
   */
  fastify.post('/api/replicas/reconcile', { preHandler: authenticateToken }, async (request, reply) => {
    try {
      const user = await User.findById(request.user.id);
      if (!user?.sensayUserId) {
        return reply.status(400).send({ success:false, error:'Sensay user missing' });
      }
      const remote = await listReplicas(user.sensayUserId);
      const now = new Date();
      // According to Sensay API docs, replicas have 'uuid' as primary ID field
      const remoteMap = new Map(remote.map(r => [r.uuid || r.id || r.replicaId, r]));
      const added = []; const updated = []; const removed = [];
      // Update existing
      user.replicas = user.replicas || [];
      user.replicas.forEach(r => {
        const remoteR = remoteMap.get(r.replicaId);
        if (!remoteR) {
          if (r.status !== 'REMOVED_REMOTE') {
            r.status = 'REMOVED_REMOTE';
            removed.push(r.replicaId);
          }
          return;
        }
        // drift check
        let changed = false;
        if (remoteR.name && remoteR.name !== r.name) { r.name = remoteR.name; changed = true; }
        // Use shortDescription first, then short_description, then fallback to description
        const remoteDesc = remoteR.shortDescription || remoteR.short_description || remoteR.description || '';
        if (remoteDesc && remoteDesc !== r.description) { r.description = remoteDesc; changed = true; }
        if (r.status === 'PENDING_CREATE') { r.status = 'CREATED'; changed = true; }
        // preserve selectedSegments (do not overwrite) – if remote starts providing categories later we could merge.
        r.lastSyncAt = now;
        if (changed) updated.push(r.replicaId);
        remoteMap.delete(r.replicaId);
      });
      // Remaining remote not in local -> add
  for (const [id, rr] of remoteMap.entries()) {
        if (!id) continue;
        const replicaId = rr.uuid || rr.id || id;
        const description = rr.shortDescription || rr.short_description || rr.description || '';
        user.replicas.push({
          replicaId: replicaId,
            name: rr.name || 'Replica',
            description: description,
    status: 'CREATED',
    lastSyncAt: now,
    selectedSegments: []
        });
        added.push(replicaId);
      }
      await user.save({ validateBeforeSave:false });
      return { success:true, added, updated, removed, total: user.replicas.length };
    } catch (err) {
      request.log.error(err, 'Reconcile error');
      return reply.status(500).send({ success:false, error:'Failed to reconcile' });
    }
  });

  /**
   * Get user's replicas (protected route)
   */
  fastify.get('/api/user/replicas', { 
    preHandler: authenticateToken 
  }, async (request, reply) => {
    try {
      const user = await User.findById(request.user.id).select('replicas');
      
      return { 
        success: true, 
        replicas: user?.replicas || [] 
      };
    } catch (error) {
      fastify.log.error(error, 'Error fetching user replicas');
      
      return reply.status(500).send({ 
        success: false, 
        error: 'Failed to fetch replicas' 
      });
    }
  });

  /**
   * Get accessible replicas for patient users (protected route)
   */
  fastify.get('/api/user/accessible-replicas', { 
    preHandler: authenticateToken 
  }, async (request, reply) => {
    try {
      const currentUser = await User.findById(request.user.id).select('email role');
      
      // Only patients can access this endpoint
      if (currentUser.role !== 'patient') {
        return reply.status(403).send({ 
          success: false, 
          error: 'Access denied. This endpoint is for patient users only.' 
        });
      }

      // Find all users with replicas that have this patient's email in their whitelist
      const usersWithAccessibleReplicas = await User.find({
        'replicas.whitelistEmails': currentUser.email
      }).select('replicas');

      let accessibleReplicas = [];
      
      // Extract replicas that include the patient's email in whitelist
      for (const user of usersWithAccessibleReplicas) {
        for (const replica of user.replicas) {
          if (replica.whitelistEmails && replica.whitelistEmails.includes(currentUser.email)) {
            accessibleReplicas.push(replica);
          }
        }
      }
      
      return { 
        success: true, 
        replicas: accessibleReplicas 
      };
    } catch (error) {
      fastify.log.error(error, 'Error fetching accessible replicas');
      
      return reply.status(500).send({ 
        success: false, 
        error: 'Failed to fetch accessible replicas' 
      });
    }
  });

  /**
   * Get a single replica by id (protected route)
   */
  fastify.get('/api/replicas/:replicaId', {
    preHandler: authenticateToken
  }, async (request, reply) => {
    try {
      const { replicaId } = request.params;
      const user = await User.findById(request.user.id).select('replicas');
      const replica = user?.replicas?.find(r => r.replicaId === replicaId);
      if (!replica) {
        return reply.status(404).send({ success: false, error: 'Replica not found' });
      }
      return { success: true, replica };
    } catch (error) {
      fastify.log.error(error, 'Error fetching replica');
      return reply.status(500).send({ success: false, error: 'Failed to fetch replica' });
    }
  });

  /**
   * Chat with a replica (protected route)
   */
  fastify.post('/api/replicas/:replicaId/chat', { 
    preHandler: authenticateToken 
  }, async (request, reply) => {
    try {
      const { replicaId } = request.params;
      const { message, context = [], conversationId } = request.body;
      const userId = request.user.id;
      
      // Verify user owns this replica
      const user = await User.findById(userId);
      const userReplica = user?.replicas?.find(r => r.replicaId === replicaId);
      
      if (!userReplica) {
        return reply.status(403).send({ 
          success: false, 
          error: 'Access denied: Replica not found or not owned by user' 
        });
      }
      
      if (!user.sensayUserId) {
        return reply.status(400).send({ 
          success: false, 
          error: 'Sensay user ID missing. Please ensure your account is properly configured.' 
        });
      }
      
      // Send chat message to Sensay using the Sensay user ID, not MongoDB user ID
      const sensayResponse = await sendChatMessage(replicaId, message, user.sensayUserId, context);
      
      // Extract the content from Sensay API response
      // According to API docs: { success: true, content: "reply text" }
      const replyText = sensayResponse?.content || sensayResponse?.response?.content || 'Sorry, I could not process that.';
      
      // Save conversation to database
      let conversation;
      if (conversationId) {
        // Continue existing conversation
        conversation = await Conversation.findOne({ 
          _id: conversationId, 
          userId, 
          replicaId 
        });
      }
      
      if (!conversation) {
        // Create new conversation
        conversation = new Conversation({
          userId,
          replicaId,
          messages: [],
          isActive: true
        });
      }
      
      // Add user message
      const userMessage = {
        id: Date.now().toString(),
        text: message,
        sender: 'user',
        timestamp: new Date()
      };
      conversation.messages.push(userMessage);
      
      // Add bot response
      const botMessage = {
        id: (Date.now() + 1).toString(),
        text: replyText,
        sender: 'bot',
        timestamp: new Date()
      };
      conversation.messages.push(botMessage);
      
      // Update conversation title if it's the first message
      if (conversation.messages.length === 2) {
        conversation.title = message.substring(0, 50) + (message.length > 50 ? '...' : '');
      }
      
      await conversation.save();
      
      return { 
        success: true, 
        message: replyText,
        conversationId: conversation._id,
        response: {
          message: replyText,
          content: replyText
        }
      };
    } catch (error) {
      fastify.log.error(error, 'Error in replica chat');
      
      // Log more details for debugging
      fastify.log.error({
        replicaId: request.params.replicaId,
        userId: request.user?.id,
        message: request.body?.message?.substring(0, 100),
        errorDetails: error.response?.data || error.message
      }, 'Detailed chat error info');
      
      if (error.status) {
        return reply.status(error.status).send({ 
          success: false, 
          error: error.message 
        });
      }
      
      return reply.status(500).send({ 
        success: false,
        error: 'Internal server error while processing chat message'
      });
    }
  });

  /**
   * Start a chat-based training session (just validates ownership, no API call)
   * Client will accumulate messages then call end session to create KB entry with combined text.
   */
  fastify.post('/api/replicas/:replicaId/training-sessions', { preHandler: authenticateToken }, async (request, reply) => {
    try {
      const { replicaId } = request.params;
      const user = await User.findById(request.user.id);
      const owned = user?.replicas?.some(r => r.replicaId === replicaId);
      if (!owned) {
        return reply.status(403).send({ success:false, error:'Replica not owned' });
      }
      
      // Just return a session object - no API call yet
      const placeholderTitle = request.body?.title || 'Chat Session Training';
      return { 
        success: true, 
        session: { 
          replicaId, 
          startedAt: new Date(),
          title: placeholderTitle
        } 
      };
    } catch (err) {
      fastify.log.error(err, 'Start training session failed');
      return reply.status(500).send({ success:false, error:'Failed to start training session' });
    }
  });

  /**
   * Complete a chat-based training session: create KB entry with aggregated chat text
   */
  fastify.post('/api/replicas/:replicaId/training-sessions/:sessionId/complete', { preHandler: authenticateToken }, async (request, reply) => {
    try {
      const { replicaId } = request.params;
      const { rawText, title } = request.body || {};
      if (!rawText || !rawText.trim()) {
        return reply.status(400).send({ success:false, error:'rawText required' });
      }
      const user = await User.findById(request.user.id);
      const owned = user?.replicas?.some(r => r.replicaId === replicaId);
      if (!owned) {
        return reply.status(403).send({ success:false, error:'Replica not owned' });
      }
      
      // Create knowledge base entry with the training text using the new two-step process
      const sessionTitle = title || 'Chat Session Training';
      const MAX_TOTAL = 60000; // overall cap
      const capped = rawText.substring(0, MAX_TOTAL);

      console.log('Creating KB entry with text length:', capped.length);
      
      // Use the updated function that does create + update in one call
      const kbEntry = await createKnowledgeBaseEntrySafe(replicaId, { 
        title: sessionTitle,
        rawText: capped // Use 'rawText' for the training content
      });
      
      console.log('KB entry response:', kbEntry);
      
      // Extract entry ID from the response
      const entryId = kbEntry?.id;
      console.log('Extracted entry ID:', entryId);
      
      if (!entryId) {
        console.error('No entry ID found in KB response:', kbEntry);
        throw new Error('Failed to get KB entry ID from response');
      }
      
      // Poll for status only if we have a valid entry ID
      let status = 'PROCESSING';
      if (entryId && !String(entryId).startsWith('mock_kb_') && !String(entryId).startsWith('temp_kb_')) {
        try {
          const statusResult = await pollKnowledgeBaseEntryStatus(replicaId, entryId, 30, 5000);
          status = statusResult?.status || 'PROCESSING';
          console.log('KB entry status:', status);
        } catch (pollErr) {
          fastify.log.warn(pollErr, `Polling incomplete for entry ${entryId}`);
        }
      } else {
        console.log('Skipping status polling for mock/temp entry ID:', entryId);
        status = 'READY'; // Assume ready for mock entries
      }

      // Update replica last trained timestamp if successful
      if (status === 'READY' || status === 'PROCESSED_TEXT' || status === 'VECTOR_CREATED') {
        try {
          await User.updateOne(
            { _id: request.user.id, 'replicas.replicaId': replicaId },
            { $set: { 'replicas.$.lastTrained': new Date() } }
          );
        } catch (tsErr) {
          fastify.log.warn(tsErr, 'Failed to update lastTrained timestamp');
        }
      }

      return {
        success: true,
        entryId,
        status,
        multiPart: false,
        totalParts: 1
      };
    } catch (err) {
      fastify.log.error(err, 'Complete training session failed');
      return reply.status(500).send({ success:false, error:'Failed to complete training session' });
    }
  });

  /** Webhook endpoint (Sensay can POST training status updates here) */
  fastify.post('/api/webhooks/sensay', async (request, reply) => {
    try {
      const event = request.body;
      // Basic logging; extend with signature verification if Sensay provides one
      fastify.log.info({ event }, 'Received Sensay webhook');
      return { received:true };
    } catch (err) {
      fastify.log.error(err, 'Webhook error');
      return reply.status(500).send({ success:false });
    }
  });

  /**
   * Delete a replica (protected route)
   */
  fastify.delete('/api/replicas/:replicaId', { 
    preHandler: authenticateToken 
  }, async (request, reply) => {
    try {
      const { replicaId } = request.params;
      const userId = request.user.id;
      
      // Remove replica from user's profile
      await User.findByIdAndUpdate(
        userId,
        { $pull: { replicas: { replicaId } } }
      );
      
      return { 
        success: true, 
        message: 'Replica deleted successfully' 
      };
    } catch (error) {
      fastify.log.error(error, 'Error deleting replica');
      
      return reply.status(500).send({ 
        success: false, 
        error: 'Failed to delete replica' 
      });
    }
  });

  /**
   * Train a replica with text content (protected route)
   */
  fastify.post('/api/replicas/train', { 
    schema: trainWithTextSchema,
    preHandler: authenticateToken 
  }, async (request, reply) => {
    try {
      const { replicaId, title, description, rawText } = request.body;
      
      const result = await trainReplica(replicaId, {
        title,
        description,
        rawText
      });
      
      return { 
        success: true, 
        trainingResult: result 
      };
    } catch (error) {
      fastify.log.error(error, 'Error training replica');
      
      if (error.status) {
        return reply.status(error.status).send({ 
          success: false, 
          error: error.message 
        });
      }
      
      return reply.status(500).send({ 
        success: false, 
        error: 'Failed to train replica' 
      });
    }
  });

  /**
   * Train a replica with file upload (protected route)
   */
  fastify.post('/api/replicas/train/file', { 
    preHandler: authenticateToken 
  }, async (request, reply) => {
    try {
      const data = await request.file();
      
      if (!data) {
        return reply.status(400).send({ 
          success: false, 
          error: 'No file provided' 
        });
      }

      const { replicaId, title, description } = data.fields;
      
      if (!replicaId?.value || !title?.value) {
        return reply.status(400).send({ 
          success: false, 
          error: 'replicaId and title are required' 
        });
      }

      const fileBuffer = await data.toBuffer();
      
      const result = await trainReplica(replicaId.value, {
        title: title.value,
        description: description?.value,
        file: {
          buffer: fileBuffer,
          filename: data.filename,
          contentType: data.mimetype
        }
      });
      
      return { 
        success: true, 
        trainingResult: result 
      };
    } catch (error) {
      fastify.log.error(error, 'Error training replica with file');
      
      if (error.status) {
        return reply.status(error.status).send({ 
          success: false, 
          error: error.message 
        });
      }
      
      return reply.status(500).send({ 
        success: false, 
        error: 'Failed to train replica with file' 
      });
    }
  });

  /**
   * Get training status
   */
  fastify.get('/api/replicas/:replicaId/kb/:entryId/status', async (request, reply) => {
    try {
      const { replicaId, entryId } = request.params;
      const status = await getKnowledgeBaseEntryStatus(replicaId, entryId);
      
      return { 
        success: true, 
        status 
      };
    } catch (error) {
      fastify.log.error(error, 'Error getting training status');
      
      if (error.status) {
        return reply.status(error.status).send({ 
          success: false, 
          error: error.message 
        });
      }
      
      return reply.status(500).send({ 
        success: false, 
        error: 'Failed to get training status' 
      });
    }
  });

  /**
   * Create a KB entry for a replica and immediately populate it with raw user text
   * Body: { title: string, rawText: string, description?: string }
   */
  fastify.post('/api/replicas/:replicaId/kb/entries', { preHandler: authenticateToken }, async (request, reply) => {
    try {
      const { replicaId } = request.params;
      const { title, rawText, description } = request.body || {};
      if (!title || !rawText || !rawText.trim()) {
        return reply.status(400).send({ success:false, error:'title and rawText required' });
      }
      // Verify ownership
      const user = await User.findById(request.user.id).select('replicas');
      if (!user?.replicas?.some(r => r.replicaId === replicaId)) {
        return reply.status(403).send({ success:false, error:'Replica not owned' });
      }
      
      // Create entry with content using the new two-step process
      const entry = await createKnowledgeBaseEntry(replicaId, { 
        title: title.substring(0,80), 
        rawText,
        description 
      });
      
      const entryId = entry.id;
      if (!entryId) {
        return reply.status(500).send({ success:false, error:'Failed to obtain KB entry id' });
      }
      
      // Poll briefly (client can continue polling via /api/kb/:entryId/status)
      let statusResult = null;
      try {
        statusResult = await pollKnowledgeBaseEntryStatus(replicaId, entryId, 20, 3000); // up to ~60s
      } catch (pollErr) {
        request.log.warn(pollErr, 'KB entry polling incomplete');
      }
      
      // Set lastTrained timestamp if READY
      if (statusResult?.status === 'READY') {
        try {
          await User.updateOne(
            { _id: request.user.id, 'replicas.replicaId': replicaId },
            { $set: { 'replicas.$.lastTrained': new Date() } }
          );
        } catch (tsErr) {
          request.log.warn(tsErr, 'Failed to update lastTrained after KB entry');
        }
      }
      return {
        success: true,
        entryId,
        status: statusResult?.status || 'PROCESSING',
        result: statusResult
      };
    } catch (err) {
      request.log.error(err, 'Create + populate KB entry failed');
      if (err.status) return reply.status(err.status).send({ success:false, error: err.message });
      return reply.status(500).send({ success:false, error:'Failed to create and populate KB entry' });
    }
  });

  // Knowledge base management convenience endpoints (protected)
  fastify.get('/api/replicas/:replicaId/kb', { preHandler: authenticateToken }, async (request, reply) => {
    try {
      const { replicaId } = request.params;
      const user = await User.findById(request.user.id).select('replicas');
      if (!user?.replicas?.some(r => r.replicaId === replicaId)) {
        return reply.status(403).send({ success:false, error:'Replica not owned' });
      }
      const { listKnowledgeBaseEntries } = await import('../services/sensayService.js');
      const entries = await listKnowledgeBaseEntries(replicaId);
      return { success:true, entries };
    } catch (err) {
      request.log.error(err, 'List KB entries failed');
      return reply.status(500).send({ success:false, error:'Failed to list KB entries' });
    }
  });

  fastify.get('/api/replicas/:replicaId/kb/:entryId', { preHandler: authenticateToken }, async (request, reply) => {
    try {
      const { replicaId, entryId } = request.params;
      const { getKnowledgeBaseEntry } = await import('../services/sensayService.js');
      const entry = await getKnowledgeBaseEntry(replicaId, entryId);
      return { success:true, entry };
    } catch (err) {
      request.log.error(err, 'Get KB entry failed');
      if (err.status === 404) return reply.status(404).send({ success:false, error:'Not found' });
      return reply.status(500).send({ success:false, error:'Failed to fetch KB entry' });
    }
  });

  fastify.delete('/api/replicas/:replicaId/kb/:entryId', { preHandler: authenticateToken }, async (request, reply) => {
    try {
      const { replicaId, entryId } = request.params;
      const { deleteKnowledgeBaseEntry } = await import('../services/sensayService.js');
      const resp = await deleteKnowledgeBaseEntry(replicaId, entryId);
      return { success:true, result: resp };
    } catch (err) {
      request.log.error(err, 'Delete KB entry failed');
      return reply.status(500).send({ success:false, error:'Failed to delete KB entry' });
    }
  });

  /**
   * Get conversations for a specific replica
   */
  fastify.get('/api/replicas/:replicaId/conversations', { 
    preHandler: authenticateToken 
  }, async (request, reply) => {
    try {
      const { replicaId } = request.params;
      const userId = request.user.id;
      
      // Verify user owns this replica
      const user = await User.findById(userId);
      const userReplica = user?.replicas?.find(r => r.replicaId === replicaId);
      
      if (!userReplica) {
        return reply.status(403).send({ 
          success: false, 
          error: 'Access denied: Replica not found or not owned by user' 
        });
      }

      // Get conversations for this replica
      const conversations = await Conversation.find({ 
        userId, 
        replicaId,
        isActive: true 
      })
      .select('_id title lastMessageAt messages')
      .sort({ lastMessageAt: -1 })
      .limit(50);
      
      // Transform conversations for frontend
      const formattedConversations = conversations.map(conv => ({
        id: conv._id,
        title: conv.title,
        lastMessageAt: conv.lastMessageAt,
        messageCount: conv.messages.length,
        lastMessage: conv.messages.length > 0 ? conv.messages[conv.messages.length - 1].text.substring(0, 100) : ''
      }));
      
      return { 
        success: true, 
        conversations: formattedConversations 
      };
    } catch (error) {
      fastify.log.error(error, 'Error fetching conversations');
      return reply.status(500).send({ 
        success: false, 
        error: 'Failed to fetch conversations' 
      });
    }
  });

  /**
   * Get messages for a specific conversation
   */
  fastify.get('/api/conversations/:conversationId/messages', { 
    preHandler: authenticateToken 
  }, async (request, reply) => {
    try {
      const { conversationId } = request.params;
      const userId = request.user.id;
      
      // Get conversation and verify ownership
      const conversation = await Conversation.findOne({ 
        _id: conversationId, 
        userId 
      });
      
      if (!conversation) {
        return reply.status(404).send({ 
          success: false, 
          error: 'Conversation not found or access denied' 
        });
      }
      
      return { 
        success: true, 
        messages: conversation.messages,
        conversation: {
          id: conversation._id,
          title: conversation.title,
          replicaId: conversation.replicaId
        }
      };
    } catch (error) {
      fastify.log.error(error, 'Error fetching conversation messages');
      return reply.status(500).send({ 
        success: false, 
        error: 'Failed to fetch conversation messages' 
      });
    }
  });

  /**
   * Update replica whitelist emails (protected route)
   */
  fastify.put('/api/replicas/:replicaId', { 
    preHandler: authenticateToken 
  }, async (request, reply) => {
    try {
      const { replicaId } = request.params;
      const { whitelistEmails } = request.body;
      const userId = request.user.id;
      
      // Verify user owns this replica
      const user = await User.findById(userId);
      const userReplica = user?.replicas?.find(r => r.replicaId === replicaId);
      
      if (!userReplica) {
        return reply.status(403).send({ 
          success: false, 
          error: 'Access denied: Replica not found or not owned by user' 
        });
      }

      // Get current replica data from the database
      const currentReplica = userReplica;
      
      // Prepare update data for Sensay API
      const updateData = {
        name: currentReplica.name,
        shortDescription: currentReplica.description,
        greeting: `Hi! I'm ${currentReplica.name}. ${currentReplica.description}`,
        slug: `${currentReplica.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
        ownerID: user.sensayUserId,
        private: whitelistEmails && whitelistEmails.length > 0,
        whitelistEmails: whitelistEmails || [],
        llm: {
          model: "gpt-4o"
        }
      };
      
      // Update replica in Sensay
      const { updateReplica } = await import('../services/sensayService.js');
      const updatedReplica = await updateReplica(replicaId, updateData);
      
      // Also update the local User model
      userReplica.whitelistEmails = whitelistEmails || [];
      await user.save();
      
      return { 
        success: true, 
        message: 'Replica updated successfully',
        replica: updatedReplica
      };
    } catch (error) {
      fastify.log.error(error, 'Error updating replica');
      
      if (error.status) {
        return reply.status(error.status).send({ 
          success: false, 
          error: error.message 
        });
      }
      
      return reply.status(500).send({ 
        success: false, 
        error: 'Failed to update replica' 
      });
    }
  });
}

export default replicaRoutes;