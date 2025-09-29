import { authenticateToken, requireCaretaker, validatePatientCaretakerRelationship } from '../../middleware/auth.js';
import { requireGalleryAccess } from '../../middleware/galleryAuth.js';
import { uploadImage, validateImageFile } from '../../services/cloudinaryService.js';
import User from '../../models/User.js';

const isUuid = (v) => {
  if (!v || typeof v !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
};

export default async function photosRoutes(fastify, options) {
  // Upload photos -> POST /gallery/photos
  fastify.post('/photos', { preHandler: [authenticateToken, requireCaretaker] }, async (request, reply) => {
    try {
      fastify.log.info('Starting photo upload process');

      // Check if request is multipart
      if (!request.isMultipart()) {
        fastify.log.error('Request is not multipart');
        return reply.code(400).send({ success: false, message: 'Request must be multipart/form-data', errors: ['Invalid content type'] });
      }

      // Log content-type for debugging multipart boundaries
      try {
        fastify.log.info({ contentType: request.headers && request.headers['content-type'] }, 'Request Content-Type');
      } catch (hdrErr) {
        fastify.log.warn(hdrErr, 'Failed to log request headers');
      }

      const userIdRaw = request.user?.id || request.user?._id;
      if (!isUuid(String(userIdRaw))) {
        fastify.log.error(`Invalid user id in request token: ${String(userIdRaw)}`);
        return reply.code(401).send({ success: false, message: 'Invalid authentication token' });
      }

      const user = await User.findById(String(userIdRaw));
      if (!user) {
        fastify.log.error(`User not found: ${String(userIdRaw)}`);
        return reply.code(404).send({ success: false, message: 'User not found' });
      }

      let albumId = null;
      let description = '';
      let dateOfMemory = null;
      const files = [];

      // Process multipart data
      for await (const part of request.parts()) {
        fastify.log.info(`Processing part: ${part.fieldname}, type: ${part.type}`);

        if (part.type === 'file') {
          if (part.fieldname === 'images') {
            files.push(part);
          }
        } else {
          const value = part.value;
          fastify.log.info(`Processing field: ${part.fieldname} = ${value}`);
          if (part.fieldname === 'albumId' && value) albumId = value;
          if (part.fieldname === 'description' && value) description = value;
          if (part.fieldname === 'dateOfMemory' && value) {
            try {
              dateOfMemory = new Date(value);
            } catch (e) {
              fastify.log.warn(`Invalid dateOfMemory format: ${value}`);
            }
          }
        }
      }

  fastify.log.info({ files: files.map(f => ({ filename: f.filename, mimetype: f.mimetype })) }, `Processed ${files.length} files, albumId: ${albumId}, description: ${description}, dateOfMemory: ${dateOfMemory}`);

      if (files.length === 0) {
        fastify.log.error('No valid files found in request');
        return reply.code(400).send({ success: false, message: 'No valid files provided', errors: ['At least one image file is required'] });
      }

      // Validate album if albumId is provided
      let album = null;
      if (albumId) {
        album = user.albums.id(albumId);
        if (!album) {
          fastify.log.error(`Album not found: ${albumId}`);
          return reply.code(404).send({ success: false, message: 'Album not found' });
        }
        fastify.log.info(`Album found: ${album.name}`);
      }

      // Helper: attempt upload with retries
      const attemptUpload = async (buffer, opts, maxAttempts = 3) => {
        let attempt = 0;
        let lastErr;
        while (attempt < maxAttempts) {
          try {
            fastify.log.info({ attempt: attempt + 1, timeoutMs: opts.timeoutMs || 20000 }, 'Attempting image upload');
            const res = await uploadImage(buffer, { ...opts, timeoutMs: opts.timeoutMs || 20000 });
            fastify.log.info({ attempt: attempt + 1, public_id: res.public_id, url: res.url }, 'Upload attempt succeeded');
            return res;
          } catch (err) {
            lastErr = err;
            fastify.log.warn({ attempt: attempt + 1, err: err.message || String(err) }, 'Upload attempt failed');
            const msg = String(err.message || '').toLowerCase();
            if (attempt < maxAttempts - 1 && (msg.includes('timeout') || msg.includes('econnrefused') || msg.includes('econnreset') || msg.includes('5') || msg.includes('503'))) {
              attempt++;
              const backoff = Math.min(2000 * Math.pow(2, attempt), 15000);
              const jitter = Math.floor(Math.random() * 500);
              await new Promise(r => setTimeout(r, backoff + jitter));
              continue;
            }
            break;
          }
        }

        // Use mock if Cloudinary not configured
        try {
          const { mockUploadImage, isCloudinaryConfigured } = await import('../../services/cloudinaryService.js');
          if (!isCloudinaryConfigured) {
            fastify.log.warn('Cloudinary not configured, using mock upload');
            const mockRes = await mockUploadImage(buffer, opts);
            fastify.log.info({ public_id: mockRes.public_id, url: mockRes.url }, 'Mock upload result');
            return mockRes;
          }
        } catch (e) {
          fastify.log.warn(e, 'Failed to use mock upload fallback');
        }

        throw lastErr || new Error('Upload failed');
      };

      const uploadResults = [];
      const errors = [];

      for (const partFile of files) {
        try {
          fastify.log.info({ filename: partFile.filename, mimetype: partFile.mimetype }, 'Processing file for upload');

          // Read file part into a Buffer. Different fastify-multipart versions expose the file
          // stream in different shapes: partFile.toBuffer(), partFile.file (stream), or the part
          // itself may be async iterable. Try common variants and fall back to event-based reader.
          let buffer;
          try {
            if (partFile && typeof partFile.toBuffer === 'function') {
              buffer = await partFile.toBuffer();
              fastify.log.debug('Read file using partFile.toBuffer()');
            } else if (partFile && partFile.file && partFile.file[Symbol.asyncIterator]) {
              const chunks = [];
              for await (const chunk of partFile.file) chunks.push(chunk);
              buffer = Buffer.concat(chunks);
              fastify.log.debug('Read file using partFile.file async iterator');
            } else if (partFile && partFile[Symbol.asyncIterator]) {
              const chunks = [];
              for await (const chunk of partFile) chunks.push(chunk);
              buffer = Buffer.concat(chunks);
              fastify.log.debug('Read file using partFile async iterator');
            } else if (partFile && partFile.file && typeof partFile.file.on === 'function') {
              buffer = await new Promise((resolve, reject) => {
                const chunks = [];
                partFile.file.on('data', c => chunks.push(c));
                partFile.file.on('end', () => resolve(Buffer.concat(chunks)));
                partFile.file.on('error', reject);
              });
              fastify.log.debug('Read file using partFile.file event stream');
            } else if (partFile && typeof partFile.on === 'function') {
              buffer = await new Promise((resolve, reject) => {
                const chunks = [];
                partFile.on('data', c => chunks.push(c));
                partFile.on('end', () => resolve(Buffer.concat(chunks)));
                partFile.on('error', reject);
              });
              fastify.log.debug('Read file using partFile event stream');
            } else {
              throw new Error('Unsupported file part shape; unable to read file contents');
            }
          } catch (readErr) {
            // Normalize read errors so they propagate to the outer catch which records file-level errors
            throw new Error(`Failed to read file part: ${readErr && readErr.message ? readErr.message : String(readErr)}`);
          }

          fastify.log.info({ filename: partFile.filename, bufferLength: buffer.length }, 'File buffer created');
          
          // Defensive: explicit zero-length buffer check (Cloudinary returns "Empty file" for these)
          if (!buffer || buffer.length === 0) {
            fastify.log.warn({ filename: partFile.filename }, 'Empty file uploaded (zero-length), skipping upload');
            errors.push(`${partFile.filename || 'file'}: Empty file (0 bytes)`);
            continue;
          }

          fastify.log.info({ filename: partFile.filename, mimetype: partFile.mimetype, bufferLength: buffer.length }, 'Validating file before upload');
          validateImageFile(partFile, buffer);
          fastify.log.info({ filename: partFile.filename }, 'File validation passed');

          const result = await attemptUpload(buffer, { folder: `users/${request.user.id}/photos` }, 3);
          fastify.log.info({ imageId: result.public_id, imageUrl: result.url, bytes: result.bytes, fullResult: result }, 'Cloudinary upload finished for file');

          const photoData = { 
            imageUrl: result.url, 
            imageId: result.public_id, 
            originalName: partFile.filename, 
            description, 
            albumId: albumId || undefined, 
            dateOfMemory: dateOfMemory || undefined,
            uploadedAt: new Date() 
          };
          user.photos.push(photoData);
          const newPhoto = user.photos[user.photos.length - 1];
          if (album) album.photos.push(newPhoto._id);
          uploadResults.push(newPhoto);
        } catch (err) {
          // Log full error and try to serialize rich error info from Cloudinary if present
          fastify.log.error(err, `Upload failed for file: ${partFile.filename}`);
          let detail = (err && (err.message || String(err))) || 'Unknown upload error';
          try {
            // include extra properties if any
            const props = Object.getOwnPropertyNames(err || {}).reduce((acc, k) => { try { acc[k] = err[k]; } catch(e) { acc[k] = String(err[k]); } return acc; }, {});
            const serialized = JSON.stringify(props);
            detail += ` | details: ${serialized}`;
          } catch (serErr) {
            fastify.log.debug(serErr, 'Failed to serialize upload error');
          }
          errors.push(`${partFile.filename || 'file'}: ${detail}`);
        }
      }

      if (uploadResults.length === 0) return reply.code(400).send({ success: false, message: 'No files uploaded', errors });

      await user.save();
      reply.send({ success: true, message: 'Files uploaded', data: { photos: uploadResults, errors } });
    } catch (error) {
      request.log.error(error, 'Gallery upload failed');
      return reply.code(500).send({ success: false, message: 'Upload failed', errors: [error.message || String(error)] });
    }
  });

  // GET /gallery/photos -> registered under /gallery prefix
  fastify.get('/photos', { preHandler: [authenticateToken, requireGalleryAccess()] }, async (request, reply) => {
    try {
      const { albumId, standalone } = request.query;
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
        return reply.code(404).send({ success: false, message: 'Gallery owner not found' });
      }

      const targetUser = await User.findById(String(access.owner._id)).select('photos albums');
      if (!targetUser) {
        return reply.code(404).send({ success: false, message: 'Gallery owner not found' });
      }

      let photos = targetUser.photos || [];
      if (albumId) photos = photos.filter(photo => photo.albumId && photo.albumId.toString() === albumId);
      else if (standalone) photos = photos.filter(photo => !photo.albumId);
      
      reply.send({ 
        success: true, 
        message: 'Photos retrieved successfully', 
        data: { 
          photos, 
          count: photos.length,
          isOwner: access.isOwner,
          isWhitelisted: access.isWhitelisted
        } 
      });
    } catch (error) {
      fastify.log.error(error, 'Photos retrieval error');
      reply.code(500).send({ success: false, message: 'Failed to retrieve photos' });
    }
  });

  // Update photo
  fastify.put('/photos/:photoId', {
    preHandler: [authenticateToken, requireCaretaker],
    schema: { params: { type: 'object', properties: { photoId: { type: 'string' } }, required: ['photoId'] }, body: { type: 'object', properties: { description: { type: 'string', maxLength: 500 }, albumId: { type: 'string' }, removeFromAlbum: { type: 'boolean' } } } }
  }, async (request, reply) => {
    try {
      const { photoId } = request.params;
      const { description, albumId, removeFromAlbum } = request.body;
  const userIdRaw = request.user?.id || request.user?._id;
  if (!isUuid(String(userIdRaw))) return reply.code(401).send({ success: false, message: 'Invalid authentication token' });

  const user = await User.findById(String(userIdRaw));
  if (!user) return reply.code(404).send({ success: false, message: 'User not found' });
      const photo = user.photos.id(photoId);
      if (!photo) return reply.code(404).send({ success: false, message: 'Photo not found' });
      if (description !== undefined) photo.description = description;
      if (removeFromAlbum) {
        if (photo.albumId) {
          const currentAlbum = user.albums.id(photo.albumId);
          if (currentAlbum) currentAlbum.photos.pull(photoId);
        }
        photo.albumId = undefined;
      } else if (albumId) {
        const newAlbum = user.albums.id(albumId);
        if (!newAlbum) return reply.code(404).send({ success: false, message: 'Target album not found' });
        if (photo.albumId) {
          const currentAlbum = user.albums.id(photo.albumId);
          if (currentAlbum) currentAlbum.photos.pull(photoId);
        }
        photo.albumId = albumId;
        if (!newAlbum.photos.includes(photoId)) newAlbum.photos.push(photoId);
      }
      await user.save();
      reply.send({ success: true, message: 'Photo updated successfully', data: { photo } });
    } catch (error) {
      fastify.log.error(error, 'Photo update error');
      reply.code(500).send({ success: false, message: 'Failed to update photo' });
    }
  });

  // Delete photo
  fastify.delete('/photos/:photoId', { 
    preHandler: [authenticateToken, requireGalleryAccess(true)], 
    schema: { params: { type: 'object', properties: { photoId: { type: 'string' } }, required: ['photoId'] } } 
  }, async (request, reply) => {
    try {
      const { photoId } = request.params;
      const access = request.galleryAccess;
      
      // Use the owner from gallery access (could be different from request.user for whitelisted patients)
  if (!access || !access.owner || !isUuid(String(access.owner._id))) return reply.code(404).send({ success: false, message: 'User not found' });

  const user = await User.findById(String(access.owner._id));
  if (!user) return reply.code(404).send({ success: false, message: 'User not found' });
      
      const photo = user.photos.id(photoId);
      if (!photo) return reply.code(404).send({ success: false, message: 'Photo not found' });
      
      if (photo.albumId) {
        const album = user.albums.id(photo.albumId);
        if (album) album.photos.pull(photoId);
      }
      
      try { 
        await import('../../services/cloudinaryService.js').then(m => m.deleteImage(photo.imageId)); 
      } catch (cloudinaryError) { 
        fastify.log.warn(cloudinaryError, 'Failed to delete from Cloudinary, continuing with database deletion'); 
      }
      
      user.photos.pull(photoId);
      await user.save();
      
      reply.send({ success: true, message: 'Photo deleted successfully', data: { photos: user.photos, albums: user.albums } });
    } catch (error) {
      fastify.log.error(error, 'Photo deletion error');
      reply.code(500).send({ success: false, message: 'Failed to delete photo' });
    }
  });
}
