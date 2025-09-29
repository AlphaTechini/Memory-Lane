import { authenticateToken, requireCaretaker } from '../../middleware/auth.js';
import { requireGalleryAccess } from '../../middleware/galleryAuth.js';
import { uploadImage, validateImageFile } from '../../services/cloudinaryService.js';
import User from '../../models/User.js';

const isUuid = (v) => {
  if (!v || typeof v !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
};

export default async function legacyRoutes(fastify, options) {
  // Restrict legacy upload endpoint to caretakers only to avoid patient-upload issues
  // Allow patients to upload but persist images under their caretaker's account
  fastify.post('/gallery/upload', { preHandler: [authenticateToken] }, async (request, reply) => {
    try {
      fastify.log.info('Starting legacy gallery upload process');
      if (!request.isMultipart()) return reply.code(400).send({ success: false, message: 'Request must be multipart/form-data', errors: ['Invalid content type'] });

      // Determine owner (caretaker) for persistence
      let ownerIdRaw;
      if (request.isPatient) {
        const caretakerId = request.user?.caretakerId;
        if (!caretakerId) return reply.code(403).send({ success: false, message: 'No caretaker assigned', errors: ['Patient must be linked to a caretaker to upload images'] });
        ownerIdRaw = caretakerId;
      } else {
        ownerIdRaw = request.user?.id || request.user?._id;
      }

      if (!isUuid(String(ownerIdRaw))) return reply.code(401).send({ success: false, message: 'Invalid authentication token' });

      const user = await User.findById(String(ownerIdRaw));
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
      let targetUser;

      // Handle patient tokens differently
      if (request.isPatient) {
        const patientData = request.user;
        fastify.log.info(`Patient ${patientData.email} accessing gallery, looking for caretaker`);
        
        if (!patientData.caretakerId) {
          fastify.log.warn(`No caretaker found for patient ${patientData.email}`);
          return reply.code(403).send({ 
            success: false, 
            message: 'No caretaker found for this patient',
            errors: ['Patient must be linked to a caretaker to access gallery'] 
          });
        }
        
        const caretaker = await User.findById(patientData.caretakerId).select('email albums photos gallery');
        if (!caretaker) {
          fastify.log.warn(`Caretaker not found for patient ${patientData.email}`);
          return reply.code(404).send({ 
            success: false, 
            message: 'Caretaker not found',
            errors: ['Associated caretaker account not found'] 
          });
        }
        
        fastify.log.info(`Found caretaker ${caretaker.email} for patient ${patientData.email}`);
        targetUser = caretaker;
      } else {
        // Handle caretaker tokens
        const requestUserIdRaw = request.user?.id || request.user?._id;
        if (!isUuid(String(requestUserIdRaw))) return reply.code(401).send({ success: false, message: 'Invalid authentication token' });

        const requestUser = await User.findById(String(requestUserIdRaw)).select('email role albums photos gallery');
        if (!requestUser) return reply.code(404).send({ success: false, message: 'User not found', errors: ['User account not found'] });

        targetUser = requestUser;
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
