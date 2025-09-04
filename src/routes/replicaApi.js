import { 
  createReplica, 
  trainReplica, 
  getKnowledgeBaseEntryStatus,
  sendChatMessage
} from '../services/sensayService.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import User from '../models/User.js';
import { REQUIRED_QUESTIONS, OPTIONAL_SEGMENTS, getQuestionText } from '../utils/questionBank.js';

/**
 * Replica management routes
 * @param {import('fastify').FastifyInstance} fastify - The Fastify server instance
 * @param {object} options - Plugin options
 */
async function replicaRoutes(fastify, options) {

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
      
      // Generate a slug from the name
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      
      // Create a greeting from the description
      const greeting = `Hi! I'm ${name}. ${description.slice(0, 100)}${description.length > 100 ? '...' : ''}`;
      
      // Prepare Sensay replica data
      const sensayReplicaData = {
        name,
        shortDescription: description,
        greeting,
        ownerID: request.user.id,
        slug: `${slug}-${Date.now()}`, // Make it unique
        llm: {
          model: 'gpt-4' // Default model
        }
      };
      
      // Create replica in Sensay
      const sensayReplica = await createReplica(sensayReplicaData);
      
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
      
      // Train the replica with all responses
      for (const training of trainingTexts) {
        try {
          await trainReplica(sensayReplica.id, {
            title: training.title,
            rawText: training.content
          });
        } catch (trainError) {
          fastify.log.warn(trainError, `Failed to train replica with: ${training.title}`);
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
          trainingCount: trainingTexts.length
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
   * Chat with a replica (protected route)
   */
  fastify.post('/api/replicas/:replicaId/chat', { 
    preHandler: authenticateToken 
  }, async (request, reply) => {
    try {
      const { replicaId } = request.params;
      const { message, context = [] } = request.body;
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
      
      // Send chat message to Sensay
      const response = await sendChatMessage(replicaId, message, userId, context);
      
      return { 
        success: true, 
        response 
      };
    } catch (error) {
      fastify.log.error(error, 'Error in replica chat');
      
      if (error.status) {
        return reply.status(error.status).send({ 
          success: false, 
          error: error.message 
        });
      }
      
      return reply.status(500).send({ 
        success: false, 
        error: 'Failed to send message' 
      });
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
  fastify.get('/api/kb/:entryId/status', async (request, reply) => {
    try {
      const { entryId } = request.params;
      const status = await getKnowledgeBaseEntryStatus(entryId);
      
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
}

export default replicaRoutes;