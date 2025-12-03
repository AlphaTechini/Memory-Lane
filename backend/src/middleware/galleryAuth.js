import User from '../models/User.js';
import Patient from '../models/Patient.js';

/**
 * Helper function to check if a user can access another user's gallery
 * @param {string} requestUserId - The ID of the user making the request
 * @param {string} ownerUserId - The ID of the gallery owner
 * @returns {Promise<{canRead: boolean, canWrite: boolean, canDelete: boolean, user: Object, owner: Object}>}
 */
export async function checkGalleryAccess(requestUserId, ownerUserId = null) {
  // Basic validation helpers
  const isUuid = (s) => typeof s === 'string' && /^[0-9a-fA-F\-]{36}$/.test(s);

  if (!isUuid(requestUserId)) {
    throw new Error('Invalid request user id format');
  }

  const requestUser = await User.findById(requestUserId).select('email role');
  if (!requestUser) {
    throw new Error('Request user not found');
  }

  // Handle patient access using the new Patient model
  // Check if this is a patient trying to access their caretaker's gallery
  const patientRecord = await Patient.findByEmail(requestUser.email);
  if (patientRecord) {
    // Find the caretaker for this patient
    const caretaker = await User.findById(patientRecord.caretaker).select('email role albums photos');
    
    if (!caretaker) {
      return {
        canRead: false,
        canWrite: false,
        canDelete: false,
        user: requestUser,
        owner: null,
        isOwner: false,
        isWhitelisted: false,
        error: 'Caretaker not found for this patient'
      };
    }
    
    // Patient should access their caretaker's gallery, not their own
    return {
      canRead: true,
      canWrite: false, // Patients can view but not edit galleries 
      canDelete: false, // Patients cannot delete anything
      user: requestUser,
      owner: caretaker,
      isOwner: false,
      isWhitelisted: true,
      patientRecord: patientRecord
    };
  }

  // If no owner specified or same user, check their own gallery
  if (!ownerUserId || requestUserId === ownerUserId) {
    return {
      canRead: true,
      canWrite: true,
      canDelete: true,
      user: requestUser,
      owner: requestUser,
      isOwner: true
    };
  }

  // Validate ownerUserId before using it in a DB query
  if (ownerUserId && ownerUserId !== requestUserId && !isUuid(ownerUserId)) {
    throw new Error('Invalid owner user id format');
  }

  const ownerUser = ownerUserId ? await User.findById(ownerUserId).select('email role whitelistedPatients') : null;
  if (!ownerUser && ownerUserId) {
    throw new Error('Gallery owner not found');
  }
  if (!ownerUser) {
    throw new Error('Gallery owner not found');
  }

  // Check if the request user's email is whitelisted by the owner
  const isWhitelisted = ownerUser && ownerUser.whitelistedPatients && 
    ownerUser.whitelistedPatients.includes(String(requestUser.email).toLowerCase());

  // Allow whitelisted users to access gallery regardless of role (they become patients when whitelisted)
  if (isWhitelisted) {
    return {
      canRead: true,
      canWrite: false, // Patients can view but not edit/update photos and albums
      canDelete: false, // Cannot delete anything
      user: requestUser,
      owner: ownerUser,
      isOwner: false,
      isWhitelisted: true
    };
  }

  // Additional check: if this is a patient role user, check if they're whitelisted in any caretaker's replica
  if (requestUser.role === 'patient') {
    const patientEmail = typeof requestUser.email === 'string' ? requestUser.email.toLowerCase() : '';
    if (patientEmail) {
      const caretakerWithPatient = await User.findOne({
        $or: [
          { whitelistedPatients: patientEmail },
          { 'replicas.whitelistEmails': patientEmail }
        ]
      }).select('email role albums photos');

      if (caretakerWithPatient) {
        return {
          canRead: true,
          canWrite: false, // Patients can view but not edit
          canDelete: false, // Cannot delete anything
          user: requestUser,
          owner: caretakerWithPatient,
          isOwner: false,
          isWhitelisted: true
        };
      }
    }
    
    // fall through if no caretaker found
  }

  // No access
  return {
    canRead: false,
    canWrite: false,
    canDelete: false,
    user: requestUser,
    owner: ownerUser,
    isOwner: false,
    isWhitelisted: false
  };
}

/**
 * Middleware to check gallery access for routes
 * @param {boolean} requiresDelete - Whether the route requires delete permissions
 */
export function requireGalleryAccess(requiresDelete = false) {
  return async (request, reply) => {
    try {
      const ownerUserId = request.params.userId || request.body.userId || request.user.id;
      const access = await checkGalleryAccess(request.user.id, ownerUserId);

      if (!access.canRead) {
        return reply.code(403).send({
          success: false,
          message: access.error || 'Access denied to this gallery'
        });
      }

      if (requiresDelete && !access.canDelete) {
        return reply.code(403).send({
          success: false,
          message: 'Delete permission denied. Patients cannot delete content.'
        });
      }

      // Store access info in request for use in handlers
      request.galleryAccess = access;
    } catch (error) {
      request.log.error(error, 'Gallery access check failed');
      return reply.code(500).send({
        success: false,
        message: 'Error checking gallery access',
        error: error.message
      });
    }
  };
}
