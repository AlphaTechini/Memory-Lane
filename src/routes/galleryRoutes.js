import { authenticateToken } from '../middleware/auth.js';
import { uploadImage, deleteImage, validateImageFile } from '../services/cloudinaryService.js';
import User from '../models/User.js';

/**
 * Gallery management routes with Albums and Photos
 * All routes are protected and require authentication
 * @param {import('fastify').FastifyInstance} fastify - The Fastify server instance
 * @param {object} options - Plugin options
 */
async function galleryRoutes(fastify, options) {

  // Schema for album creation
  const albumSchema = {
    body: {
      type: 'object',
      required: ['name', 'description', 'dateOfMemory'],
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 100 },
        description: { type: 'string', minLength: 1, maxLength: 500 },
        dateOfMemory: { type: 'string', format: 'date' }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              album: {
                type: 'object',
                properties: {
                  _id: { type: 'string' },
                  name: { type: 'string' },
                  description: { type: 'string' },
                  dateOfMemory: { type: 'string' },
                  createdAt: { type: 'string' },
                  photos: { type: 'array' }
                }
              }
            }
          }
        }
      }
    }
  };

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
              photos: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    _id: { type: 'string' },
                    imageUrl: { type: 'string' },
                    imageId: { type: 'string' },
                    originalName: { type: 'string' },
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
   * POST /gallery/albums
   * Create a new album
   */
  fastify.post('/gallery/albums', {
    schema: albumSchema,
    preHandler: authenticateToken
  }, async (request, reply) => {
    try {
      const { name, description, dateOfMemory } = request.body;

      const user = await User.findById(request.user.id);
      if (!user) {
        return reply.code(404).send({
          success: false,
          message: 'User not found',
          errors: ['User account not found']
        });
      }

      // Check if album name already exists
      const existingAlbum = user.albums.find(album => album.name.toLowerCase() === name.toLowerCase());
      if (existingAlbum) {
        return reply.code(400).send({
          success: false,
          message: 'Album name already exists',
          errors: ['An album with this name already exists']
        });
      }

      const newAlbum = {
        name,
        description,
        dateOfMemory: new Date(dateOfMemory),
        photos: []
      };

      user.albums.push(newAlbum);
      await user.save();

      const createdAlbum = user.albums[user.albums.length - 1];

      reply.send({
        success: true,
        message: 'Album created successfully',
        data: {
          album: createdAlbum
        }
      });

    } catch (error) {
      fastify.log.error(error, 'Album creation error');
      reply.code(500).send({
        success: false,
        message: 'Failed to create album',
        errors: ['Internal server error']
      });
    }
  });

  /**
   * GET /gallery/albums
   * Get all albums for authenticated user
   */
  fastify.get('/gallery/albums', {
    preHandler: authenticateToken
  }, async (request, reply) => {
    try {
      const user = await User.findById(request.user.id).select('albums');
      
      if (!user) {
        return reply.code(404).send({
          success: false,
          message: 'User not found',
          errors: ['User account not found']
        });
      }

      reply.send({
        success: true,
        message: 'Albums retrieved successfully',
        data: {
          albums: user.albums || [],
          count: user.albums ? user.albums.length : 0
        }
      });

    } catch (error) {
      fastify.log.error(error, 'Albums retrieval error');
      reply.code(500).send({
        success: false,
        message: 'Failed to retrieve albums',
        errors: ['Internal server error']
      });
    }
  });

  /**
   * PUT /gallery/albums/:albumId
   * Update album details
   */
  fastify.put('/gallery/albums/:albumId', {
    preHandler: authenticateToken,
    schema: {
      params: {
        type: 'object',
        properties: {
          albumId: { type: 'string' }
        },
        required: ['albumId']
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          description: { type: 'string', minLength: 1, maxLength: 500 },
          dateOfMemory: { type: 'string', format: 'date' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { albumId } = request.params;
      const updates = request.body;

      const user = await User.findById(request.user.id);
      if (!user) {
        return reply.code(404).send({
          success: false,
          message: 'User not found'
        });
      }

      const album = user.albums.id(albumId);
      if (!album) {
        return reply.code(404).send({
          success: false,
          message: 'Album not found'
        });
      }

      // Update fields if provided
      if (updates.name) album.name = updates.name;
      if (updates.description) album.description = updates.description;
      if (updates.dateOfMemory) album.dateOfMemory = new Date(updates.dateOfMemory);

      await user.save();

      reply.send({
        success: true,
        message: 'Album updated successfully',
        data: { album }
      });

    } catch (error) {
      fastify.log.error(error, 'Album update error');
      reply.code(500).send({
        success: false,
        message: 'Failed to update album'
      });
    }
  });

  /**
   * DELETE /gallery/albums/:albumId
   * Delete an album and optionally its photos
   */
  fastify.delete('/gallery/albums/:albumId', {
    preHandler: authenticateToken,
    schema: {
      params: {
        type: 'object',
        properties: {
          albumId: { type: 'string' }
        },
        required: ['albumId']
      },
      querystring: {
        type: 'object',
        properties: {
          deletePhotos: { type: 'boolean', default: false }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { albumId } = request.params;
      const { deletePhotos = false } = request.query;

      const user = await User.findById(request.user.id);
      if (!user) {
        return reply.code(404).send({
          success: false,
          message: 'User not found'
        });
      }

      const album = user.albums.id(albumId);
      if (!album) {
        return reply.code(404).send({
          success: false,
          message: 'Album not found'
        });
      }

      if (deletePhotos) {
        // Delete photos from album from Cloudinary and user's photos array
        const albumPhotoIds = album.photos;
        for (const photoId of albumPhotoIds) {
          const photo = user.photos.id(photoId);
          if (photo) {
            try {
              await deleteImage(photo.imageId);
            } catch (cloudinaryError) {
              fastify.log.warn(cloudinaryError, 'Failed to delete from Cloudinary');
            }
            user.photos.pull(photoId);
          }
        }
      } else {
        // Just remove albumId reference from photos
        const albumPhotoIds = album.photos;
        for (const photoId of albumPhotoIds) {
          const photo = user.photos.id(photoId);
          if (photo) {
            photo.albumId = undefined;
          }
        }
      }

      // Remove the album
      user.albums.pull(albumId);
      await user.save();

      reply.send({
        success: true,
        message: deletePhotos ? 'Album and photos deleted successfully' : 'Album deleted successfully',
        data: {
          albums: user.albums,
          photos: user.photos
        }
      });

    } catch (error) {
      fastify.log.error(error, 'Album deletion error');
      reply.code(500).send({
        success: false,
        message: 'Failed to delete album'
      });
    }
  });

  /**
   * POST /gallery/photos
   * Upload photos (can be added to an album or standalone)
   */
  fastify.post('/gallery/photos', {
    preHandler: authenticateToken
  }, async (request, reply) => {
    try {
      fastify.log.info('Starting photo upload process');
      
      // Check if request is multipart
      if (!request.isMultipart()) {
        fastify.log.error('Request is not multipart');
        return reply.code(400).send({
          success: false,
          message: 'Request must be multipart/form-data',
          errors: ['Invalid content type']
        });
      }

      const user = await User.findById(request.user.id);
      if (!user) {
        fastify.log.error(`User not found: ${request.user.id}`);
        return reply.code(404).send({
          success: false,
          message: 'User not found'
        });
      }

      let albumId = null;
      let description = '';
      const files = [];

      // Process multipart data
      for await (const part of request.parts()) {
        fastify.log.info(`Processing part: ${part.fieldname}, type: ${part.type}`);
        
        if (part.type === 'file') {
          // This is a file upload
          if (part.fieldname === 'images') {
            fastify.log.info(`Processing file: ${part.filename}, mimetype: ${part.mimetype}`);
            
            if (!part.filename) {
              fastify.log.warn('File part has no filename, skipping');
              continue;
            }

            // Validate file before processing
            try {
              validateImageFile({
                filename: part.filename,
                mimetype: part.mimetype
              });
            } catch (validationError) {
              fastify.log.error(validationError, `File validation failed for ${part.filename}`);
              continue;
            }

            // Read file data into buffer
            const chunks = [];
            let totalSize = 0;
            const maxSize = 10 * 1024 * 1024; // 10MB

            for await (const chunk of part.file) {
              totalSize += chunk.length;
              if (totalSize > maxSize) {
                fastify.log.error(`File ${part.filename} exceeds maximum size of 10MB`);
                throw new Error(`File ${part.filename} is too large (max 10MB)`);
              }
              chunks.push(chunk);
            }

            if (chunks.length === 0) {
              fastify.log.warn(`File ${part.filename} has no data, skipping`);
              continue;
            }

            const fileBuffer = Buffer.concat(chunks);
            fastify.log.info(`File ${part.filename} loaded: ${fileBuffer.length} bytes`);

            files.push({
              filename: part.filename,
              mimetype: part.mimetype,
              buffer: fileBuffer
            });
          }
        } else {
          // This is a field value
          const value = part.value;
          fastify.log.info(`Processing field: ${part.fieldname} = ${value}`);
          
          if (part.fieldname === 'albumId' && value) {
            albumId = value;
          } else if (part.fieldname === 'description' && value) {
            description = value;
          }
        }
      }

      fastify.log.info(`Processed ${files.length} files, albumId: ${albumId}, description: ${description}`);

      if (files.length === 0) {
        fastify.log.error('No valid files found in request');
        return reply.code(400).send({
          success: false,
          message: 'No valid files provided',
          errors: ['At least one image file is required']
        });
      }

      // Validate album if albumId is provided
      let album = null;
      if (albumId) {
        album = user.albums.id(albumId);
        if (!album) {
          fastify.log.error(`Album not found: ${albumId}`);
          return reply.code(404).send({
            success: false,
            message: 'Album not found'
          });
        }
        fastify.log.info(`Album found: ${album.name}`);
      }

      // Process each file
      const uploadResults = [];
      const errors = [];

      for (const file of files) {
        try {
          fastify.log.info(`Uploading file: ${file.filename}`);
          
          // Upload to Cloudinary
          const cloudinaryResult = await uploadImage(file.buffer, {
            folder: `users/${request.user.id}/photos`
          });

          fastify.log.info(`Cloudinary upload successful for ${file.filename}: ${cloudinaryResult.public_id}`);

          const photoData = {
            imageUrl: cloudinaryResult.url,
            imageId: cloudinaryResult.public_id,
            originalName: file.filename,
            description: description || '',
            albumId: albumId || undefined,
            uploadedAt: new Date()
          };

          user.photos.push(photoData);
          const newPhoto = user.photos[user.photos.length - 1];
          
          // Add photo to album if specified
          if (album) {
            album.photos.push(newPhoto._id);
            fastify.log.info(`Added photo ${newPhoto._id} to album ${album.name}`);
          }

          uploadResults.push(newPhoto);

        } catch (error) {
          fastify.log.error(error, `Failed to upload ${file.filename}`);
          errors.push(`${file.filename}: ${error.message}`);
        }
      }

      if (uploadResults.length === 0) {
        fastify.log.error('All file uploads failed');
        return reply.code(400).send({
          success: false,
          message: 'No valid images could be uploaded',
          errors
        });
      }

      await user.save();
      fastify.log.info(`Successfully uploaded ${uploadResults.length} photos`);

      reply.send({
        success: true,
        message: `Successfully uploaded ${uploadResults.length} photo(s)${album ? ` to album "${album.name}"` : ''}`,
        data: {
          photos: uploadResults,
          uploaded: uploadResults.length,
          errors: errors.length > 0 ? errors : undefined
        }
      });

    } catch (error) {
      fastify.log.error(error, 'Photo upload error');
      reply.code(500).send({
        success: false,
        message: 'Failed to upload photos',
        errors: ['Internal server error']
      });
    }
  });

  /**
   * GET /gallery/photos
   * Get all photos for authenticated user
   */
  fastify.get('/gallery/photos', {
    preHandler: authenticateToken,
    schema: {
      querystring: {
        type: 'object',
        properties: {
          albumId: { type: 'string' },
          standalone: { type: 'boolean' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { albumId, standalone } = request.query;
      
      const user = await User.findById(request.user.id).select('photos albums');
      
      if (!user) {
        return reply.code(404).send({
          success: false,
          message: 'User not found'
        });
      }

      let photos = user.photos || [];

      // Filter photos based on query parameters
      if (albumId) {
        photos = photos.filter(photo => photo.albumId && photo.albumId.toString() === albumId);
      } else if (standalone) {
        photos = photos.filter(photo => !photo.albumId);
      }

      reply.send({
        success: true,
        message: 'Photos retrieved successfully',
        data: {
          photos,
          count: photos.length
        }
      });

    } catch (error) {
      fastify.log.error(error, 'Photos retrieval error');
      reply.code(500).send({
        success: false,
        message: 'Failed to retrieve photos'
      });
    }
  });

  /**
   * PUT /gallery/photos/:photoId
   * Update photo details (description, album assignment)
   */
  fastify.put('/gallery/photos/:photoId', {
    preHandler: authenticateToken,
    schema: {
      params: {
        type: 'object',
        properties: {
          photoId: { type: 'string' }
        },
        required: ['photoId']
      },
      body: {
        type: 'object',
        properties: {
          description: { type: 'string', maxLength: 500 },
          albumId: { type: 'string' },
          removeFromAlbum: { type: 'boolean' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { photoId } = request.params;
      const { description, albumId, removeFromAlbum } = request.body;

      const user = await User.findById(request.user.id);
      if (!user) {
        return reply.code(404).send({
          success: false,
          message: 'User not found'
        });
      }

      const photo = user.photos.id(photoId);
      if (!photo) {
        return reply.code(404).send({
          success: false,
          message: 'Photo not found'
        });
      }

      // Update description if provided
      if (description !== undefined) {
        photo.description = description;
      }

      // Handle album assignment/removal
      if (removeFromAlbum) {
        // Remove from current album
        if (photo.albumId) {
          const currentAlbum = user.albums.id(photo.albumId);
          if (currentAlbum) {
            currentAlbum.photos.pull(photoId);
          }
        }
        photo.albumId = undefined;
      } else if (albumId) {
        // Add to new album
        const newAlbum = user.albums.id(albumId);
        if (!newAlbum) {
          return reply.code(404).send({
            success: false,
            message: 'Target album not found'
          });
        }

        // Remove from current album if any
        if (photo.albumId) {
          const currentAlbum = user.albums.id(photo.albumId);
          if (currentAlbum) {
            currentAlbum.photos.pull(photoId);
          }
        }

        // Add to new album
        photo.albumId = albumId;
        if (!newAlbum.photos.includes(photoId)) {
          newAlbum.photos.push(photoId);
        }
      }

      await user.save();

      reply.send({
        success: true,
        message: 'Photo updated successfully',
        data: { photo }
      });

    } catch (error) {
      fastify.log.error(error, 'Photo update error');
      reply.code(500).send({
        success: false,
        message: 'Failed to update photo'
      });
    }
  });

  /**
   * DELETE /gallery/photos/:photoId
   * Delete a specific photo
   */
  fastify.delete('/gallery/photos/:photoId', {
    preHandler: authenticateToken,
    schema: {
      params: {
        type: 'object',
        properties: {
          photoId: { type: 'string' }
        },
        required: ['photoId']
      }
    }
  }, async (request, reply) => {
    try {
      const { photoId } = request.params;
      
      const user = await User.findById(request.user.id);
      if (!user) {
        return reply.code(404).send({
          success: false,
          message: 'User not found'
        });
      }

      const photo = user.photos.id(photoId);
      if (!photo) {
        return reply.code(404).send({
          success: false,
          message: 'Photo not found'
        });
      }

      // Remove from album if it's in one
      if (photo.albumId) {
        const album = user.albums.id(photo.albumId);
        if (album) {
          album.photos.pull(photoId);
        }
      }

      // Delete from Cloudinary
      try {
        await deleteImage(photo.imageId);
      } catch (cloudinaryError) {
        fastify.log.warn(cloudinaryError, 'Failed to delete from Cloudinary, continuing with database deletion');
      }

      // Remove from database
      user.photos.pull(photoId);
      await user.save();

      reply.send({
        success: true,
        message: 'Photo deleted successfully',
        data: {
          photos: user.photos,
          albums: user.albums
        }
      });

    } catch (error) {
      fastify.log.error(error, 'Photo deletion error');
      reply.code(500).send({
        success: false,
        message: 'Failed to delete photo'
      });
    }
  });

  /**
   * POST /gallery/albums/:albumId/photos
   * Add existing photos to an album
   */
  fastify.post('/gallery/albums/:albumId/photos', {
    preHandler: authenticateToken,
    schema: {
      params: {
        type: 'object',
        properties: {
          albumId: { type: 'string' }
        },
        required: ['albumId']
      },
      body: {
        type: 'object',
        properties: {
          photoIds: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1
          }
        },
        required: ['photoIds']
      }
    }
  }, async (request, reply) => {
    try {
      const { albumId } = request.params;
      const { photoIds } = request.body;

      const user = await User.findById(request.user.id);
      if (!user) {
        return reply.code(404).send({
          success: false,
          message: 'User not found'
        });
      }

      const album = user.albums.id(albumId);
      if (!album) {
        return reply.code(404).send({
          success: false,
          message: 'Album not found'
        });
      }

      const addedPhotos = [];
      const errors = [];

      for (const photoId of photoIds) {
        const photo = user.photos.id(photoId);
        if (!photo) {
          errors.push(`Photo ${photoId} not found`);
          continue;
        }

        // Remove from current album if any
        if (photo.albumId) {
          const currentAlbum = user.albums.id(photo.albumId);
          if (currentAlbum) {
            currentAlbum.photos.pull(photoId);
          }
        }

        // Add to new album
        photo.albumId = albumId;
        if (!album.photos.includes(photoId)) {
          album.photos.push(photoId);
          addedPhotos.push(photo);
        }
      }

      await user.save();

      reply.send({
        success: true,
        message: `Successfully added ${addedPhotos.length} photo(s) to album "${album.name}"`,
        data: {
          album,
          addedPhotos,
          errors: errors.length > 0 ? errors : undefined
        }
      });

    } catch (error) {
      fastify.log.error(error, 'Add photos to album error');
      reply.code(500).send({
        success: false,
        message: 'Failed to add photos to album'
      });
    }
  });

  /**
   * GET /gallery
   * Get all gallery content (albums and standalone photos) for authenticated user
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
                albums: { type: 'array' },
                photos: { type: 'array' },
                images: { type: 'array' }, // Legacy field for backward compatibility
                count: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const user = await User.findById(request.user.id).select('albums photos gallery');
      
      if (!user) {
        return reply.code(404).send({
          success: false,
          message: 'User not found',
          errors: ['User account not found']
        });
      }

      // For backward compatibility, include legacy gallery field in images
      const legacyImages = user.gallery || [];
      const totalCount = (user.albums?.length || 0) + (user.photos?.length || 0) + legacyImages.length;

      reply.send({
        success: true,
        message: 'Gallery retrieved successfully',
        data: {
          albums: user.albums || [],
          photos: user.photos || [],
          images: legacyImages, // Legacy field
          count: totalCount
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
   * POST /gallery/upload (Legacy endpoint for backward compatibility)
   * Upload images as standalone photos
   */
  fastify.post('/gallery/upload', {
    preHandler: authenticateToken
  }, async (request, reply) => {
    try {
      fastify.log.info('Starting legacy gallery upload process');
      
      // Check if request is multipart
      if (!request.isMultipart()) {
        fastify.log.error('Request is not multipart');
        return reply.code(400).send({
          success: false,
          message: 'Request must be multipart/form-data',
          errors: ['Invalid content type']
        });
      }

      const user = await User.findById(request.user.id);
      if (!user) {
        fastify.log.error(`User not found: ${request.user.id}`);
        return reply.code(404).send({
          success: false,
          message: 'User not found'
        });
      }

      const files = [];

      // Process multipart data
      for await (const part of request.parts()) {
        fastify.log.info(`Processing part: ${part.fieldname}, type: ${part.type}`);
        
        if (part.type === 'file' && part.fieldname === 'images') {
          fastify.log.info(`Processing file: ${part.filename}, mimetype: ${part.mimetype}`);
          
          if (!part.filename) {
            fastify.log.warn('File part has no filename, skipping');
            continue;
          }

          // Validate file before processing
          try {
            validateImageFile({
              filename: part.filename,
              mimetype: part.mimetype
            });
          } catch (validationError) {
            fastify.log.error(validationError, `File validation failed for ${part.filename}`);
            continue;
          }

          // Read file data into buffer
          const chunks = [];
          let totalSize = 0;
          const maxSize = 10 * 1024 * 1024; // 10MB

          for await (const chunk of part.file) {
            totalSize += chunk.length;
            if (totalSize > maxSize) {
              fastify.log.error(`File ${part.filename} exceeds maximum size of 10MB`);
              throw new Error(`File ${part.filename} is too large (max 10MB)`);
            }
            chunks.push(chunk);
          }

          if (chunks.length === 0) {
            fastify.log.warn(`File ${part.filename} has no data, skipping`);
            continue;
          }

          const fileBuffer = Buffer.concat(chunks);
          fastify.log.info(`File ${part.filename} loaded: ${fileBuffer.length} bytes`);

          files.push({
            filename: part.filename,
            mimetype: part.mimetype,
            buffer: fileBuffer
          });
        }
      }

      fastify.log.info(`Processed ${files.length} files for legacy upload`);

      if (files.length === 0) {
        fastify.log.error('No valid files found in legacy upload request');
        return reply.code(400).send({
          success: false,
          message: 'No valid files provided',
          errors: ['At least one image file is required']
        });
      }

      // Process each file
      const uploadResults = [];
      const errors = [];

      for (const file of files) {
        try {
          fastify.log.info(`Uploading file: ${file.filename}`);
          
          // Upload to Cloudinary
          const cloudinaryResult = await uploadImage(file.buffer, {
            folder: `users/${request.user.id}/photos`
          });

          fastify.log.info(`Cloudinary upload successful for ${file.filename}: ${cloudinaryResult.public_id}`);

          const photoData = {
            imageUrl: cloudinaryResult.url,
            imageId: cloudinaryResult.public_id,
            originalName: file.filename,
            uploadedAt: new Date()
          };

          user.photos.push(photoData);
          uploadResults.push(user.photos[user.photos.length - 1]);

        } catch (error) {
          fastify.log.error(error, `Failed to upload ${file.filename}`);
          errors.push(`${file.filename}: ${error.message}`);
        }
      }

      if (uploadResults.length === 0) {
        fastify.log.error('All legacy file uploads failed');
        return reply.code(400).send({
          success: false,
          message: 'No valid images could be uploaded',
          errors
        });
      }

      await user.save();
      fastify.log.info(`Successfully uploaded ${uploadResults.length} photos via legacy endpoint`);

      // Return in legacy format for backward compatibility
      reply.send({
        success: true,
        message: `Successfully uploaded ${uploadResults.length} image(s)`,
        data: {
          gallery: user.photos, // Legacy field name
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
   * DELETE /gallery/:imageId (Legacy endpoint)
   * Delete specific image from gallery (works for both old gallery and new photos)
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
      
      const user = await User.findById(request.user.id);
      
      if (!user) {
        return reply.code(404).send({
          success: false,
          message: 'User not found',
          errors: ['User account not found']
        });
      }

      let deleted = false;
      let deletedType = '';

      // Try to find in new photos array first
      const photoIndex = user.photos.findIndex(photo => photo._id.toString() === imageId || photo.imageId === imageId);
      if (photoIndex !== -1) {
        const photo = user.photos[photoIndex];
        
        // Remove from album if it's in one
        if (photo.albumId) {
          const album = user.albums.id(photo.albumId);
          if (album) {
            album.photos.pull(photo._id);
          }
        }

        // Delete from Cloudinary
        try {
          await deleteImage(photo.imageId);
        } catch (cloudinaryError) {
          fastify.log.warn(cloudinaryError, 'Failed to delete from Cloudinary');
        }

        user.photos.splice(photoIndex, 1);
        deleted = true;
        deletedType = 'photo';
      } 
      // Fallback to legacy gallery array
      else if (user.gallery) {
        const legacyIndex = user.gallery.findIndex(img => img._id.toString() === imageId || img.imageId === imageId);
        if (legacyIndex !== -1) {
          const legacyImage = user.gallery[legacyIndex];
          
          // Delete from Cloudinary
          try {
            await deleteImage(legacyImage.imageId);
          } catch (cloudinaryError) {
            fastify.log.warn(cloudinaryError, 'Failed to delete from Cloudinary');
          }

          user.gallery.splice(legacyIndex, 1);
          deleted = true;
          deletedType = 'legacy image';
        }
      }

      if (!deleted) {
        return reply.code(404).send({
          success: false,
          message: 'Image not found',
          errors: ['Image not found in gallery']
        });
      }

      await user.save();

      reply.send({
        success: true,
        message: `${deletedType.charAt(0).toUpperCase() + deletedType.slice(1)} deleted successfully`,
        data: {
          gallery: user.gallery || [], // Legacy format
          photos: user.photos || [],
          albums: user.albums || [],
          count: (user.gallery?.length || 0) + (user.photos?.length || 0)
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
   * Clear all images from gallery (both legacy and new)
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

      const deletionErrors = [];

      // Delete all photos from Cloudinary
      if (user.photos) {
        for (const photo of user.photos) {
          try {
            await deleteImage(photo.imageId);
          } catch (error) {
            deletionErrors.push(`${photo.imageId}: ${error.message}`);
          }
        }
      }

      // Delete all legacy gallery images from Cloudinary
      if (user.gallery) {
        for (const image of user.gallery) {
          try {
            await deleteImage(image.imageId);
          } catch (error) {
            deletionErrors.push(`${image.imageId}: ${error.message}`);
          }
        }
      }

      // Clear albums and photos in database
      user.photos = [];
      user.gallery = [];
      user.albums = [];
      await user.save();

      reply.send({
        success: true,
        message: 'Gallery cleared successfully',
        data: {
          gallery: [],
          photos: [],
          albums: [],
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