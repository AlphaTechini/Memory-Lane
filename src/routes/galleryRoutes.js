import { authenticateToken } from '../middleware/auth.js';
import { uploadImage, deleteImage, validateImageFile } from '../services/cloudinaryService.js';
import User from '../models/User.js';

/**
 * Gallery management routes
 * All routes are protected and require authentication
 * @param {import('fastify').FastifyInstance} fastify - The Fastify server instance
 * @param {object} options - Plugin options
 */
async function galleryRoutes(fastify, options) {

  // Schema for file upload validation
  const uploadSchema = {
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
              gallery: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    imageUrl: { type: 'string' },
                    imageId: { type: 'string' },
                    uploadedAt: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    }
  };

  /**
   * POST /gallery/upload
   * Upload multiple images to user gallery
   */
  fastify.post('/gallery/upload', {
    schema: uploadSchema,
    preHandler: authenticateToken
  }, async (request, reply) => {
    try {
      const files = await request.saveRequestFiles();
      
      if (!files || files.length === 0) {
        return reply.code(400).send({
          success: false,
          message: 'No files provided',
          errors: ['At least one image file is required']
        });
      }

      // Validate each file
      const uploadResults = [];
      const errors = [];

      for (const file of files) {
        try {
          validateImageFile(file);
          
          // Read file buffer
          const fileBuffer = await file.toBuffer();
          
          // Upload to Cloudinary
          const cloudinaryResult = await uploadImage(fileBuffer, {
            folder: `users/${request.user.id}/gallery`
          });

          uploadResults.push({
            imageUrl: cloudinaryResult.url,
            imageId: cloudinaryResult.public_id,
            uploadedAt: new Date()
          });

        } catch (error) {
          errors.push(`${file.filename}: ${error.message}`);
        }
      }

      if (uploadResults.length === 0) {
        return reply.code(400).send({
          success: false,
          message: 'No valid images to upload',
          errors
        });
      }

      // Update user's gallery in database
      const user = await User.findByIdAndUpdate(
        request.user.id,
        { $push: { gallery: { $each: uploadResults } } },
        { new: true }
      );

      if (!user) {
        return reply.code(404).send({
          success: false,
          message: 'User not found',
          errors: ['User account not found']
        });
      }

      reply.send({
        success: true,
        message: `Successfully uploaded ${uploadResults.length} image(s)`,
        data: {
          gallery: user.gallery,
          uploaded: uploadResults.length,
          errors: errors.length > 0 ? errors : undefined
        }
      });

    } catch (error) {
      fastify.log.error(error, 'Gallery upload error');
      reply.code(500).send({
        success: false,
        message: 'Failed to upload images',
        errors: ['Internal server error']
      });
    }
  });

  /**
   * GET /gallery
   * Get all gallery images for authenticated user
   */
  fastify.get('/gallery', {
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
                gallery: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      imageUrl: { type: 'string' },
                      imageId: { type: 'string' },
                      uploadedAt: { type: 'string' }
                    }
                  }
                },
                count: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const user = await User.findById(request.user.id).select('gallery');
      
      if (!user) {
        return reply.code(404).send({
          success: false,
          message: 'User not found',
          errors: ['User account not found']
        });
      }

      reply.send({
        success: true,
        message: 'Gallery retrieved successfully',
        data: {
          gallery: user.gallery || [],
          count: user.gallery ? user.gallery.length : 0
        }
      });

    } catch (error) {
      fastify.log.error(error, 'Gallery retrieval error');
      reply.code(500).send({
        success: false,
        message: 'Failed to retrieve gallery',
        errors: ['Internal server error']
      });
    }
  });

  /**
   * DELETE /gallery/:imageId
   * Delete specific image from gallery
   */
  fastify.delete('/gallery/:imageId', {
    preHandler: authenticateToken,
    schema: {
      params: {
        type: 'object',
        properties: {
          imageId: { type: 'string' }
        },
        required: ['imageId']
      }
    }
  }, async (request, reply) => {
    try {
      const { imageId } = request.params;
      
      // Find user and the specific image
      const user = await User.findById(request.user.id);
      
      if (!user) {
        return reply.code(404).send({
          success: false,
          message: 'User not found',
          errors: ['User account not found']
        });
      }

      // Find the image in gallery
      const imageIndex = user.gallery.findIndex(img => img.imageId === imageId);
      
      if (imageIndex === -1) {
        return reply.code(404).send({
          success: false,
          message: 'Image not found',
          errors: ['Image not found in gallery']
        });
      }

      // Delete from Cloudinary
      try {
        await deleteImage(imageId);
      } catch (cloudinaryError) {
        fastify.log.warn(cloudinaryError, 'Failed to delete from Cloudinary, continuing with database deletion');
      }

      // Remove from database
      user.gallery.splice(imageIndex, 1);
      await user.save();

      reply.send({
        success: true,
        message: 'Image deleted successfully',
        data: {
          gallery: user.gallery,
          count: user.gallery.length
        }
      });

    } catch (error) {
      fastify.log.error(error, 'Gallery deletion error');
      reply.code(500).send({
        success: false,
        message: 'Failed to delete image',
        errors: ['Internal server error']
      });
    }
  });

  /**
   * DELETE /gallery/clear
   * Clear all images from gallery
   */
  fastify.delete('/gallery/clear', {
    preHandler: authenticateToken
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

      // Delete all images from Cloudinary
      const deletionErrors = [];
      for (const image of user.gallery) {
        try {
          await deleteImage(image.imageId);
        } catch (error) {
          deletionErrors.push(`${image.imageId}: ${error.message}`);
        }
      }

      // Clear gallery in database
      user.gallery = [];
      await user.save();

      reply.send({
        success: true,
        message: 'Gallery cleared successfully',
        data: {
          gallery: [],
          count: 0,
          deletionErrors: deletionErrors.length > 0 ? deletionErrors : undefined
        }
      });

    } catch (error) {
      fastify.log.error(error, 'Gallery clear error');
      reply.code(500).send({
        success: false,
        message: 'Failed to clear gallery',
        errors: ['Internal server error']
      });
    }
  });
}

export default galleryRoutes;
