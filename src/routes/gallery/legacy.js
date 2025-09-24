import { authenticateToken } from '../../middleware/auth.js';
import { requireGalleryAccess } from '../../middleware/galleryAuth.js';
import { uploadImage, validateImageFile } from '../../services/cloudinaryService.js';
import User from '../../models/User.js';

export default async function legacyRoutes(fastify, options) {
  fastify.post('/gallery/upload', { preHandler: authenticateToken }, async (request, reply) => {
    try {
      fastify.log.info('Starting legacy gallery upload process');
      if (!request.isMultipart()) return reply.code(400).send({ success: false, message: 'Request must be multipart/form-data', errors: ['Invalid content type'] });
      const user = await User.findById(request.user.id);
      if (!user) return reply.code(404).send({ success: false, message: 'User not found' });

      const files = [];
      for await (const part of request.parts()) {
        fastify.log.info(`Processing part: ${part.fieldname}, type: ${part.type}`);
        if (part.type === 'file' && part.fieldname === 'images') files.push(part);
      }

      fastify.log.info(`Processed ${files.length} files for legacy upload`);
      if (files.length === 0) return reply.code(400).send({ success: false, message: 'No valid files provided', errors: ['At least one image file is required'] });

      const uploadResults = [];
      const errors = [];

      for (const file of files) {
        try {
          validateImageFile(file);
          const chunks = [];
          for await (const c of file) chunks.push(c);
          const fileBuffer = Buffer.concat(chunks);
          const cloudinaryResult = await uploadImage(fileBuffer, { folder: `users/${request.user.id}/photos` });
          const photoData = { imageUrl: cloudinaryResult.url, imageId: cloudinaryResult.public_id, originalName: file.filename, uploadedAt: new Date() };
          user.photos.push(photoData);
          uploadResults.push(user.photos[user.photos.length - 1]);
        } catch (error) {
          errors.push(`${file.filename}: ${error.message}`);
        }
      }

      if (uploadResults.length === 0) return reply.code(400).send({ success: false, message: 'No valid images to upload', errors });
      await user.save();
      reply.send({ success: true, message: `Successfully uploaded ${uploadResults.length} image(s)`, data: { gallery: user.photos, uploaded: uploadResults.length, errors: errors.length > 0 ? errors : undefined } });
    } catch (error) {
      fastify.log.error(error, 'Gallery upload error');
      reply.code(500).send({ success: false, message: 'Failed to upload images', errors: ['Internal server error'] });
    }
  });

  // GET /gallery - combined gallery endpoint for backward compatibility
  fastify.get('/gallery', { preHandler: authenticateToken }, async (request, reply) => {
    try {
      const requestUser = await User.findById(request.user.id).select('email role albums photos gallery');
      if (!requestUser) return reply.code(404).send({ success: false, message: 'User not found', errors: ['User account not found'] });

      let targetUser = requestUser;

      // If user is a patient, find their caretaker's gallery
      if (requestUser.role === 'patient') {
        fastify.log.info(`Patient ${requestUser.email} accessing gallery, looking for caretaker`);
        
        const caretaker = await User.findOne({ 
          whitelistedPatients: requestUser.email.toLowerCase() 
        }).select('email albums photos gallery');
        
        if (!caretaker) {
          fastify.log.warn(`No caretaker found for patient ${requestUser.email}`);
          return reply.code(403).send({ 
            success: false, 
            message: 'No caretaker found for this patient',
            errors: ['Patient must be whitelisted by a caretaker to access gallery'] 
          });
        }
        
        fastify.log.info(`Found caretaker ${caretaker.email} for patient ${requestUser.email}`);
        targetUser = caretaker;
      }

      const legacyImages = targetUser.gallery || [];
      const totalCount = (targetUser.albums?.length || 0) + (targetUser.photos?.length || 0) + legacyImages.length;

      reply.send({
        success: true,
        message: 'Gallery retrieved successfully',
        data: {
          albums: targetUser.albums || [],
          photos: targetUser.photos || [],
          images: legacyImages,
          count: totalCount
        }
      });
    } catch (error) {
      fastify.log.error(error, 'Gallery retrieval error');
      reply.code(500).send({ success: false, message: 'Failed to retrieve gallery', errors: ['Internal server error'] });
    }
  });
}
