const { 
  createReplica, 
  trainReplica, 
  getKnowledgeBaseEntryStatus 
} = require('../services/sensayService');

/**
 * Replica management routes
 * @param {import('fastify').FastifyInstance} fastify - The Fastify server instance
 * @param {object} options - Plugin options
 */
async function replicaRoutes(fastify, options) {

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

  /**
   * Create a new replica
   */
  fastify.post('/api/replicas', { schema: createReplicaSchema }, async (request, reply) => {
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
   * Train a replica with text content
   */
  fastify.post('/api/replicas/train', { schema: trainWithTextSchema }, async (request, reply) => {
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
   * Train a replica with file upload
   */
  fastify.post('/api/replicas/train/file', async (request, reply) => {
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

module.exports = replicaRoutes;