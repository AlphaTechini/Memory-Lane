import User from '../models/User.js';
import Patient from '../models/Patient.js';

/**
 * Helper function to check if a user can access another user's gallery
 * @param {string} requestUserId - The ID of the user making the request
 * @param {string} ownerUserId - The ID of the gallery owner
 * @returns {Promise<{canRead: boolean, canWrite: boolean, canDelete: boolean, user: Object, owner: Object}>}
 */
export async function checkGalleryAccess(requestUserId, ownerUserId = null) {
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

  const ownerUser = await User.findById(ownerUserId).select('email role whitelistedPatients');
  if (!ownerUser) {
    throw new Error('Gallery owner not found');
  }

  // Check if the request user's email is whitelisted by the owner
  const isWhitelisted = ownerUser.whitelistedPatients && 
    ownerUser.whitelistedPatients.includes(requestUser.email.toLowerCase());

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
    const caretakerWithPatient = await User.findOne({
      $or: [
        { whitelistedPatients: requestUser.email.toLowerCase() },
        { 'replicas.whitelistEmails': requestUser.email.toLowerCase() }
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
