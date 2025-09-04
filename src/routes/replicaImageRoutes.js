import { authenticateToken } from '../middleware/auth.js';
import { uploadImage, deleteImage, validateImageFile } from '../services/cloudinaryService.js';
import User from '../models/User.js';

/**
 * Replica profile picture management routes
 * All routes are protected and require authentication
 * @param {import('fastify').FastifyInstance} fastify - The Fastify server instance
 * @param {object} options - Plugin options
 */
async function replicaImageRoutes(fastify, options) {

  /**
   * POST /replica/upload
   * Upload replica profile picture (single image)
   */
  fastify.post('/replica/upload', {
    preHandler: authenticateToken,
    schema: {
      consumes: ['multipart/form-data'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: {
              type: 'object',
              properties: {
                replicaImageUrl: { type: 'string' },
                replicaImageId: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const file = await request.file();
      
      if (!file) {
        return reply.code(400).send({
          success: false,
          message: 'No file provided',
          errors: ['Image file is required']
        });
      }

      // Validate file
      validateImageFile(file);

      // Get current user
      const user = await User.findById(request.user.id);
      
      if (!user) {
        return reply.code(404).send({
          success: false,
          message: 'User not found',
          errors: ['User account not found']
        });
      }

      // Delete existing replica image if it exists
      if (user.replicaImageId) {
        try {
          await deleteImage(user.replicaImageId);
        } catch (error) {
          fastify.log.warn(error, 'Failed to delete existing replica image from Cloudinary');
        }
      }

      // Read file buffer
      const fileBuffer = await file.toBuffer();
      
      // Upload new image to Cloudinary
      const cloudinaryResult = await uploadImage(fileBuffer, {
        folder: `users/${request.user.id}/replica`,
        transformation: [
          { width: 500, height: 500, crop: 'fill', gravity: 'face' },
          { quality: 'auto:good' },
          { format: 'auto' }
        ]
      });

      // Update user's replica image fields
      user.replicaImageUrl = cloudinaryResult.url;
      user.replicaImageId = cloudinaryResult.public_id;
      await user.save();

      reply.send({
        success: true,
        message: 'Replica profile picture uploaded successfully',
        data: {
          replicaImageUrl: user.replicaImageUrl,
          replicaImageId: user.replicaImageId
        }
      });

    } catch (error) {
      fastify.log.error(error, 'Replica image upload error');
      
      if (error.message.includes('Invalid file type') || error.message.includes('File too large')) {
        reply.code(400).send({
          success: false,
          message: 'Invalid file',
          errors: [error.message]
        });
      } else {
        reply.code(500).send({
          success: false,
          message: 'Failed to upload replica image',
          errors: ['Internal server error']
        });
      }
    }
  });

  /**
   * GET /replica
   * Get replica profile picture info for authenticated user
   */
  fastify.get('/replica', {
    preHandler: authenticateToken,
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: {
              type: 'object',
              properties: {
                replicaImageUrl: { type: ['string', 'null'] },
                replicaImageId: { type: ['string', 'null'] },
                hasImage: { type: 'boolean' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const user = await User.findById(request.user.id).select('replicaImageUrl replicaImageId');
      
      if (!user) {
        return reply.code(404).send({
          success: false,
          message: 'User not found',
          errors: ['User account not found']
        });
      }

      reply.send({
        success: true,
        message: 'Replica profile picture info retrieved successfully',
        data: {
          replicaImageUrl: user.replicaImageUrl || null,
          replicaImageId: user.replicaImageId || null,
          hasImage: !!(user.replicaImageUrl && user.replicaImageId)
        }
      });

    } catch (error) {
      fastify.log.error(error, 'Replica image retrieval error');
      reply.code(500).send({
        success: false,
        message: 'Failed to retrieve replica image info',
        errors: ['Internal server error']
      });
    }
  });

  /**
   * DELETE /replica
   * Delete replica profile picture
   */
  fastify.delete('/replica', {
    preHandler: authenticateToken,
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: {
              type: 'object',
              properties: {
                replicaImageUrl: { type: 'null' },
                replicaImageId: { type: 'null' },
                hasImage: { type: 'boolean' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const user = await User.findById(request.user.id);
      
      if (!user) {
        return reply.code(404).send({
          success: false,
          message: 'User not found',
          errors: ['User account not found']
        });
      }

      if (!user.replicaImageId) {
        return reply.code(404).send({
          success: false,
          message: 'No replica image found',
          errors: ['User has no replica profile picture']
        });
      }

      // Delete from Cloudinary
      try {
        await deleteImage(user.replicaImageId);
      } catch (error) {
        fastify.log.warn(error, 'Failed to delete replica image from Cloudinary, continuing with database deletion');
      }

      // Clear replica image fields in database
      user.replicaImageUrl = undefined;
      user.replicaImageId = undefined;
      await user.save();

      reply.send({
        success: true,
        message: 'Replica profile picture deleted successfully',
        data: {
          replicaImageUrl: null,
          replicaImageId: null,
          hasImage: false
        }
      });

    } catch (error) {
      fastify.log.error(error, 'Replica image deletion error');
      reply.code(500).send({
        success: false,
        message: 'Failed to delete replica image',
        errors: ['Internal server error']
      });
    }
  });

  /**
   * PUT /replica/upload
   * Alternative endpoint for updating replica profile picture
   * (same as POST but semantically correct for updates)
   */
  fastify.put('/replica/upload', {
    preHandler: authenticateToken,
    schema: {
      consumes: ['multipart/form-data']
    }
  }, async (request, reply) => {
    // Reuse the POST logic
    return fastify.inject({
      method: 'POST',
      url: '/replica/upload',
      headers: request.headers,
      payload: request.body
    });
  });
}

export default replicaImageRoutes;
