import { getCurrentSensayUser, ensureSensayUser as ensureSensayUserService } from '../services/sensayService.js';
import logger from '../utils/logger.js';
import User from '../models/User.js';
import Patient from '../models/Patient.js';

// Simple UUID v4-ish validator to avoid passing arbitrary objects into DB lookups
const isUuid = (v) => {
  if (!v || typeof v !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
};

/**
 * Middleware to ensure user has a valid Sensay user ID and is properly linked
 * This middleware should be used on routes that require Sensay functionality (like replica creation)
 * 
 * @param {Object} options - Configuration options
 * @param {boolean} options.required - Whether Sensay user is required (default: true)
 * @param {boolean} options.autoCreate - Whether to auto-create missing Sensay users (default: true)
 * @param {boolean} options.skipSync - Whether to skip user data sync (default: false)
 */
export const ensureSensayUser = (options = {}) => {
  const {
    required = true,
    autoCreate = true,
    skipSync = false
  } = options;

  return async (request, reply) => {
    try {
      // Check if user is authenticated first
      if (!request.user) {
        return reply.status(401).send({
          success: false,
          message: 'User authentication required'
        });
      }

      const userIdRaw = request.user.id || request.user._id;

      if (!isUuid(String(userIdRaw))) {
        logger?.warn?.(`Invalid user id in request token: ${String(userIdRaw)}`) || console.warn('Invalid user id in request token');
        return reply.status(401).send({ success: false, message: 'Invalid authentication token' });
      }

      const userId = String(userIdRaw);
      let user = request.user;

      // If user object doesn't have sensayUserId, fetch from database
  if (!user.sensayUserId) {
          const dbUser = await User.findById(userId);
        if (dbUser) {
          user = dbUser;
          request.user = dbUser; // Update request.user with complete data
        }
      }

      // Check if user has sensayUserId
      if (!user.sensayUserId) {
        if (!autoCreate) {
          if (required) {
            return reply.status(400).send({
              success: false,
              message: 'Sensay user not linked for this account. Please contact support or retry later.',
              error: 'SENSAY_USER_NOT_LINKED',
              suggestedAction: 'contact_support'
            });
          } else {
            // Not required, continue without Sensay user
            request.sensayUser = null;
            return ;
          }
        }

        // Auto-create Sensay user
          logger?.info?.(`Creating missing Sensay user for ${user.email}`) || console.log('Creating missing Sensay user');
        
        try {
          const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
          const sensayResult = await ensureSensayUserService({
            email: user.email,
            name: fullName || user.email.split('@')[0],
            id: userId
          });

          if (sensayResult.success && sensayResult.user) {
            // Update user in database
            user.sensayUserId = sensayResult.user.id;
            user.sensayError = undefined; // Clear any previous errors
            await user.save();

            // Update request.user
            request.user.sensayUserId = sensayResult.user.id;
            request.sensayUser = sensayResult.user;

            logger?.info?.(`Auto-created Sensay user ${sensayResult.user.id} for ${user.email}`) || console.log('Auto-created Sensay user');
          } else if (sensayResult.conflict) {
            // User exists in Sensay but we can't retrieve it
            logger?.warn?.(`Sensay user exists for ${user.email} but cannot be auto-linked`) || console.warn('Sensay user exists but cannot be auto-linked');
            
            if (required) {
              return reply.status(409).send({
                success: false,
                message: 'Sensay user already exists for this email but cannot be automatically linked. Please contact support.',
                error: 'SENSAY_USER_EXISTS_CANNOT_LINK',
                suggestedAction: 'contact_support'
              });
            } else {
              request.sensayUser = null;
              return ;
            }
          } else {
            throw new Error(sensayResult.message || 'Failed to create Sensay user');
          }
        } catch (createError) {
          logger?.error?.(`Failed to auto-create Sensay user for ${user.email}: ${createError.message}`) || console.error('Failed to auto-create Sensay user', createError.message);

          // Update user with error information
          try {
            user.sensayError = {
              createdAt: new Date(),
              message: createError.message,
              lastAttempt: new Date()
            };
            await user.save();
          } catch (persistErr) {
            logger?.warn?.(`Failed to persist Sensay error for user ${userId}`) || console.warn('Failed to persist Sensay error');
          }

          if (required) {
            return reply.status(500).send({
              success: false,
              message: 'Failed to create Sensay user. Please contact support or retry later.',
              error: 'SENSAY_USER_CREATION_FAILED',
              suggestedAction: 'retry_or_contact_support'
            });
          } else {
            request.sensayUser = null;
            return ;
          }
        }
      } else {
        // User has sensayUserId, verify it exists and sync if needed
        if (!skipSync) {
          try {
            const sensayUser = await getCurrentSensayUser(user.sensayUserId);
            
            if (!sensayUser) {
              logger?.warn?.(`Sensay user ${user.sensayUserId} not found for ${user.email}`) || console.warn('Sensay user not found');
              
              if (autoCreate) {
                // Try to recreate the user
                logger?.info?.(`Recreating missing Sensay user for ${user.email}`) || console.log('Recreating missing Sensay user');
                
                const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
                const sensayResult = await ensureSensayUserService({
                  email: user.email,
                  name: fullName || user.email.split('@')[0],
                  id: userId.toString()
                });

                if (sensayResult.success && sensayResult.user) {
                  user.sensayUserId = sensayResult.user.id;
                  await user.save();
                  request.user.sensayUserId = sensayResult.user.id;
                  request.sensayUser = sensayResult.user;
                } else {
                  throw new Error('Failed to recreate Sensay user');
                }
              } else {
                if (required) {
                  return reply.status(400).send({
                    success: false,
                    message: 'Sensay user not found. Please contact support.',
                    error: 'SENSAY_USER_NOT_FOUND',
                    suggestedAction: 'contact_support'
                  });
                } else {
                  request.sensayUser = null;
                  return ;
                }
              }
            } else {
              request.sensayUser = sensayUser;
            }
          } catch (syncError) {
            logger?.warn?.(`Failed to verify Sensay user ${user.sensayUserId}: ${syncError.message}`) || console.warn('Failed to verify Sensay user', syncError.message);
            
            if (required) {
              return reply.status(500).send({
                success: false,
                message: 'Failed to verify Sensay user. Please retry later.',
                error: 'SENSAY_USER_VERIFICATION_FAILED',
                suggestedAction: 'retry'
              });
            } else {
              request.sensayUser = null;
              return ;
            }
          }
        } else {
          // Skip sync, just pass the sensayUserId
          request.sensayUser = { id: user.sensayUserId };
        }
      }

      ;
    } catch (error) {
      logger?.error?.(`Sensay user middleware error: ${error.message}`) || console.error('Sensay user middleware error', error.message);
      
      return reply.status(500).send({
        success: false,
        message: 'Internal server error while processing Sensay user',
        error: 'SENSAY_MIDDLEWARE_ERROR'
      });
    }
  };
};

/**
 * Middleware to validate that the current user is properly linked to Sensay
 * This is a lighter-weight check that just verifies the link exists
 */
export const validateSensayLink = async (request, reply) => {
  try {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        message: 'User authentication required'
      });
    }

    const userIdRaw = request.user.id || request.user._id;

    if (!isUuid(String(userIdRaw))) {
      logger?.warn?.(`Invalid user id in request token: ${String(userIdRaw)}`) || console.warn('Invalid user id in request token');
      return reply.status(401).send({ success: false, message: 'Invalid authentication token' });
    }

    const userId = String(userIdRaw);
    let user = request.user;

    // If user object doesn't have sensayUserId, fetch from database
    if (!user.sensayUserId) {
      const dbUser = await User.findById(userId);
      if (dbUser) {
        user = dbUser;
        request.user = dbUser;
      }
    }

    // Set user identifier for Sensay API calls
    // Sensay will handle authorization (owner/whitelist) validation internally
    const sensayUserId = user.sensayUserId || user.email || user.id;
    
    if (!sensayUserId) {
      return reply.status(400).send({
        success: false,
        message: 'Unable to identify user for Sensay API call',
        error: 'USER_ID_REQUIRED'
      });
    }
    
    request.sensayUserId = sensayUserId;
    logger?.info?.(`Prepared Sensay API call for user: ${user.email} (ID: ${sensayUserId})`) || console.log(`Prepared Sensay API call for user: ${user.email}`);
    ;
  } catch (error) {
    logger?.error?.(`Sensay link validation error: ${error.message}`) || console.error('Sensay link validation error', error.message);
    
    return reply.status(500).send({
      success: false,
      message: 'Internal server error while validating Sensay link',
      error: 'SENSAY_LINK_VALIDATION_ERROR'
    });
  }
};

/**
 * Middleware to add Sensay user information to the request if available
 * This doesn't require Sensay user but adds it if present
 */
export const addSensayUser = async (request, reply) => {
  try {
    if (!request.user) {
      return ;
    }

    const userIdRaw = request.user.id || request.user._id;

    if (!isUuid(String(userIdRaw))) {
      logger?.warn?.(`Invalid user id in request token: ${String(userIdRaw)}`) || console.warn('Invalid user id in request token');
      // don't fail requests here; just treat as no-sensay-user
      request.sensayUser = null;
      request.sensayUserId = null;
      return;
    }

    const userId = String(userIdRaw);
    let user = request.user;

    // If user object doesn't have sensayUserId, fetch from database
    if (!user.sensayUserId) {
      const dbUser = await User.findById(userId);
      if (dbUser && dbUser.sensayUserId) {
        user = dbUser;
        request.user = dbUser;
      }
    }

    if (user.sensayUserId) {
      try {
        const sensayUser = await getCurrentSensayUser(user.sensayUserId);
        request.sensayUser = sensayUser;
        request.sensayUserId = user.sensayUserId;
      } catch (error) {
        logger?.warn?.(`Failed to fetch Sensay user ${user.sensayUserId}: ${error.message}`) || console.warn('Failed to fetch Sensay user');
        request.sensayUser = null;
        request.sensayUserId = user.sensayUserId;
      }
    } else {
      request.sensayUser = null;
      request.sensayUserId = null;
    }

    ;
  } catch (error) {
    logger?.error?.(`Add Sensay user middleware error: ${error.message}`) || console.error('Add Sensay user middleware error', error.message);
    // Don't fail the request, just continue without Sensay user
    request.sensayUser = null;
    request.sensayUserId = null;
    ;
  }
};

export default {
  ensureSensayUser,
  validateSensayLink,
  addSensayUser
};
