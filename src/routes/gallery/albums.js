import { authenticateToken, requireCaretaker, validatePatientCaretakerRelationship } from '../../middleware/auth.js';
import { requireGalleryAccess } from '../../middleware/galleryAuth.js';
import User from '../../models/User.js';

const isUuid = (v) => {
  if (!v || typeof v !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
};

export default async function albumsRoutes(fastify, options) {
  // Create album -> POST /gallery/albums (registered under /gallery prefix)
  fastify.post('/', {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'description', 'dateOfMemory'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          description: { type: 'string', minLength: 1, maxLength: 500 },
          dateOfMemory: { type: 'string', format: 'date' }
        }
      }
    },
    preHandler: [authenticateToken, validatePatientCaretakerRelationship]
  }, async (request, reply) => {
    try {
      const { name, description, dateOfMemory } = request.body;

      const userIdRaw = request.user?.id || request.user?._id;
      if (!isUuid(String(userIdRaw))) return reply.code(401).send({ success: false, message: 'Invalid authentication token' });

      const user = await User.findById(String(userIdRaw));
      if (!user) {
        return reply.code(404).send({ success: false, message: 'User not found', errors: ['User account not found'] });
      }

      const existingAlbum = user.albums.find(album => album.name.toLowerCase() === name.toLowerCase());
      if (existingAlbum) {
        return reply.code(400).send({ success: false, message: 'Album name already exists', errors: ['An album with this name already exists'] });
      }

      const newAlbum = { name, description, dateOfMemory: new Date(dateOfMemory), photos: [] };
      user.albums.push(newAlbum);
      await user.save();

      const createdAlbum = user.albums[user.albums.length - 1];
      reply.send({ success: true, message: 'Album created successfully', data: { album: createdAlbum } });
    } catch (error) {
      fastify.log.error(error, 'Album creation error');
      reply.code(500).send({ success: false, message: 'Failed to create album', errors: ['Internal server error'] });
    }
  });

  // List albums -> GET /gallery/albums
  fastify.get('/', { preHandler: [authenticateToken, requireGalleryAccess()] }, async (request, reply) => {
    try {
      const access = request.galleryAccess;
      
      if (!access.canRead) {
        return reply.code(403).send({ 
          success: false, 
          message: access.error || 'Access denied to this gallery',
          errors: ['Gallery access denied'] 
        });
      }

      // Use the owner from gallery access (could be caretaker for whitelisted patients)
      if (!access || !access.owner || !isUuid(String(access.owner._id))) {
        return reply.code(404).send({ success: false, message: 'Gallery owner not found', errors: ['Owner account not found'] });
      }

      const targetUser = await User.findById(String(access.owner._id)).select('albums');
      if (!targetUser) {
        return reply.code(404).send({ success: false, message: 'Gallery owner not found', errors: ['Owner account not found'] });
      }

      reply.send({ 
        success: true, 
        message: 'Albums retrieved successfully', 
        data: { 
          albums: targetUser.albums || [], 
          count: targetUser.albums ? targetUser.albums.length : 0,
          isOwner: access.isOwner,
          isWhitelisted: access.isWhitelisted
        } 
      });
    } catch (error) {
      fastify.log.error(error, 'Albums retrieval error');
      reply.code(500).send({ success: false, message: 'Failed to retrieve albums', errors: ['Internal server error'] });
    }
  });

  // Update album -> PUT /gallery/albums/:albumId
  fastify.put('/:albumId', {
    preHandler: authenticateToken,
    schema: {
      params: { type: 'object', properties: { albumId: { type: 'string' } }, required: ['albumId'] },
      body: { type: 'object', properties: { name: { type: 'string', minLength: 1, maxLength: 100 }, description: { type: 'string', minLength: 1, maxLength: 500 }, dateOfMemory: { type: 'string', format: 'date' } } }
    }
  }, async (request, reply) => {
    try {
      const { albumId } = request.params;
      const updates = request.body;
  const userIdRaw = request.user?.id || request.user?._id;
  if (!isUuid(String(userIdRaw))) return reply.code(401).send({ success: false, message: 'Invalid authentication token' });

  const user = await User.findById(String(userIdRaw));
  if (!user) return reply.code(404).send({ success: false, message: 'User not found' });
      const album = user.albums.id(albumId);
      if (!album) return reply.code(404).send({ success: false, message: 'Album not found' });
      if (updates.name) album.name = updates.name;
      if (updates.description) album.description = updates.description;
      if (updates.dateOfMemory) album.dateOfMemory = new Date(updates.dateOfMemory);
      await user.save();
      reply.send({ success: true, message: 'Album updated successfully', data: { album } });
    } catch (error) {
      fastify.log.error(error, 'Album update error');
      reply.code(500).send({ success: false, message: 'Failed to update album' });
    }
  });

  // Delete album -> DELETE /gallery/albums/:albumId
  fastify.delete('/:albumId', {
    preHandler: [authenticateToken, requireGalleryAccess(true)],
    schema: {
      params: { type: 'object', properties: { albumId: { type: 'string' } }, required: ['albumId'] },
      querystring: { type: 'object', properties: { deletePhotos: { type: 'boolean', default: false } } }
    }
  }, async (request, reply) => {
    try {
      const { albumId } = request.params;
      const { deletePhotos = false } = request.query;
      const access = request.galleryAccess;
      
      // Use the owner from gallery access
      if (!access || !access.owner || !isUuid(String(access.owner._id))) {
        return reply.code(404).send({ success: false, message: 'User not found' });
      }

      const user = await User.findById(String(access.owner._id));
      if (!user) return reply.code(404).send({ success: false, message: 'User not found' });
      const album = user.albums.id(albumId);
      if (!album) return reply.code(404).send({ success: false, message: 'Album not found' });

      if (deletePhotos) {
        const albumPhotoIds = album.photos;
        for (const photoId of albumPhotoIds) {
          const photo = user.photos.id(photoId);
          if (photo) {
            try { await import('../../services/cloudinaryService.js').then(m => m.deleteImage(photo.imageId)); } catch (cloudinaryError) { fastify.log.warn(cloudinaryError, 'Failed to delete from Cloudinary'); }
            user.photos.pull(photoId);
          }
        }
      } else {
        const albumPhotoIds = album.photos;
        for (const photoId of albumPhotoIds) {
          const photo = user.photos.id(photoId);
          if (photo) photo.albumId = undefined;
        }
      }

      user.albums.pull(albumId);
      await user.save();
      reply.send({ success: true, message: deletePhotos ? 'Album and photos deleted successfully' : 'Album deleted successfully', data: { albums: user.albums, photos: user.photos } });
    } catch (error) {
      fastify.log.error(error, 'Album deletion error');
      reply.code(500).send({ success: false, message: 'Failed to delete album' });
    }
  });
}
