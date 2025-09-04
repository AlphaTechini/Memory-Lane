const { 
  createReplica, 
  trainReplica, 
  sendChatMessage,
  getKnowledgeBaseEntryStatus 
} = require('../services/sensayService');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

/**
 * Enhanced Sensay API routes with complete functionality
 * @param {import('fastify').FastifyInstance} fastify - The Fastify server instance
 * @param {object} options - Plugin options
 */
async function sensayRoutes(fastify, options) {

  // Schema for replica creation
  const createReplicaSchema = {
    body: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        shortDescription: { type: 'string' },
        greeting: { type: 'string' },
        ownerID: { type: 'string' },
        slug: { type: 'string' },
        llm: {
          type: 'object',
          properties: {
            model: { type: 'string' }
          },
          required: ['model']
        }
      },
      required: ['name', 'shortDescription', 'greeting', 'ownerID', 'slug', 'llm']
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

  // Schema for chat
  const chatSchema = {
    params: {
      type: 'object',
      properties: {
        replicaId: { type: 'string' }
      },
      required: ['replicaId']
    },
    headers: {
      type: 'object',
      properties: {
        'x-user-id': { type: 'string' }
      },
      required: ['x-user-id']
    },
    body: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        context: { 
          type: 'array',
          items: {
            type: 'object',
            properties: {
              role: { type: 'string' },
              content: { type: 'string' }
            }
          }
        },
        streaming: { type: 'boolean' }
      },
      required: ['message']
    }
  };

  /**
   * Create a new replica (protected route)
   */
  fastify.post('/api/replicas', { 
    schema: createReplicaSchema,
    preHandler: authenticateToken 
  }, async (request, reply) => {
    try {
      const replica = await createReplica(request.body);
      
      return { 
        success: true, 
        replica 
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
   * Chat with a replica (protected route)
   */
  fastify.post('/api/replicas/:replicaId/chat', { 
    schema: chatSchema,
    preHandler: authenticateToken 
  }, async (request, reply) => {
    try {
      const { replicaId } = request.params;
      const userId = request.user.id; // Get from authenticated user
      const { message, context = [], streaming = false } = request.body;

      const response = await sendChatMessage(replicaId, message, userId, context, streaming);
      
      if (streaming) {
        // Handle streaming response
        reply.raw.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        });
        
        response.data.pipe(reply.raw);
        return reply;
      }
      
      return { 
        success: true, 
        response: response.message || response.content || response 
      };
    } catch (error) {
      fastify.log.error(error, 'Error in chat');
      
      if (error.status) {
        return reply.status(error.status).send({ 
          success: false, 
          error: error.message 
        });
      }
      
      return reply.status(500).send({ 
        success: false, 
        error: 'Failed to process chat message' 
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

  /**
   * Health check endpoint
   */
  fastify.get('/api/health', async (request, reply) => {
    return { 
      success: true, 
      message: 'Sensay API integration is healthy',
      timestamp: new Date().toISOString()
    };
  });
}

module.exports = sensayRoutes;