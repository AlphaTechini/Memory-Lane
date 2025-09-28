import { getCurrentSensayUser, ensureSensayUser } from '../services/sensayService.js';
import logger from '../utils/logger.js';
import User from '../models/User.js';

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

  return async (req, res, next) => {
    try {
      // Check if user is authenticated first
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'User authentication required'
        });
      }

      const userId = req.user.id || req.user._id;
      let user = req.user;

      // If user object doesn't have sensayUserId, fetch from database
      if (!user.sensayUserId) {
        const dbUser = await User.findById(userId);
        if (dbUser) {
          user = dbUser;
          req.user = dbUser; // Update req.user with complete data
        }
      }

      // Check if user has sensayUserId
      if (!user.sensayUserId) {
        if (!autoCreate) {
          if (required) {
            return res.status(400).json({
              success: false,
              message: 'Sensay user not linked for this account. Please contact support or retry later.',
              error: 'SENSAY_USER_NOT_LINKED',
              suggestedAction: 'contact_support'
            });
          } else {
            // Not required, continue without Sensay user
            req.sensayUser = null;
            return next();
          }
        }

        // Auto-create Sensay user
        logger?.info?.(`Creating missing Sensay user for ${user.email}`) || console.log('Creating missing Sensay user');
        
        try {
          const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
          const sensayResult = await ensureSensayUser({
            email: user.email,
            name: fullName || user.email.split('@')[0],
            id: userId.toString()
          });

          if (sensayResult.success && sensayResult.user) {
            // Update user in database
            user.sensayUserId = sensayResult.user.id;
            user.sensayError = undefined; // Clear any previous errors
            await user.save();

            // Update req.user
            req.user.sensayUserId = sensayResult.user.id;
            req.sensayUser = sensayResult.user;

            logger?.info?.(`Auto-created Sensay user ${sensayResult.user.id} for ${user.email}`) || console.log('Auto-created Sensay user');
          } else if (sensayResult.conflict) {
            // User exists in Sensay but we can't retrieve it
            logger?.warn?.(`Sensay user exists for ${user.email} but cannot be auto-linked`) || console.warn('Sensay user exists but cannot be auto-linked');
            
            if (required) {
              return res.status(409).json({
                success: false,
                message: 'Sensay user already exists for this email but cannot be automatically linked. Please contact support.',
                error: 'SENSAY_USER_EXISTS_CANNOT_LINK',
                suggestedAction: 'contact_support'
              });
            } else {
              req.sensayUser = null;
              return next();
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
            return res.status(500).json({
              success: false,
              message: 'Failed to create Sensay user. Please contact support or retry later.',
              error: 'SENSAY_USER_CREATION_FAILED',
              suggestedAction: 'retry_or_contact_support'
            });
          } else {
            req.sensayUser = null;
            return next();
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
                const sensayResult = await ensureSensayUser({
                  email: user.email,
                  name: fullName || user.email.split('@')[0],
                  id: userId.toString()
                });

                if (sensayResult.success && sensayResult.user) {
                  user.sensayUserId = sensayResult.user.id;
                  await user.save();
                  req.user.sensayUserId = sensayResult.user.id;
                  req.sensayUser = sensayResult.user;
                } else {
                  throw new Error('Failed to recreate Sensay user');
                }
              } else {
                if (required) {
                  return res.status(400).json({
                    success: false,
                    message: 'Sensay user not found. Please contact support.',
                    error: 'SENSAY_USER_NOT_FOUND',
                    suggestedAction: 'contact_support'
                  });
                } else {
                  req.sensayUser = null;
                  return next();
                }
              }
            } else {
              req.sensayUser = sensayUser;
            }
          } catch (syncError) {
            logger?.warn?.(`Failed to verify Sensay user ${user.sensayUserId}: ${syncError.message}`) || console.warn('Failed to verify Sensay user', syncError.message);
            
            if (required) {
              return res.status(500).json({
                success: false,
                message: 'Failed to verify Sensay user. Please retry later.',
                error: 'SENSAY_USER_VERIFICATION_FAILED',
                suggestedAction: 'retry'
              });
            } else {
              req.sensayUser = null;
              return next();
            }
          }
        } else {
          // Skip sync, just pass the sensayUserId
          req.sensayUser = { id: user.sensayUserId };
        }
      }

      next();
    } catch (error) {
      logger?.error?.(`Sensay user middleware error: ${error.message}`) || console.error('Sensay user middleware error', error.message);
      
      return res.status(500).json({
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
export const validateSensayLink = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    const userId = req.user.id || req.user._id;
    let user = req.user;

    // If user object doesn't have sensayUserId, fetch from database
    if (!user.sensayUserId) {
      const dbUser = await User.findById(userId);
      if (dbUser) {
        user = dbUser;
        req.user = dbUser;
      }
    }

    if (!user.sensayUserId) {
      return res.status(400).json({
        success: false,
        message: 'Sensay user not linked for this account. Please contact support or retry later.',
        error: 'SENSAY_USER_NOT_LINKED',
        suggestedAction: 'contact_support'
      });
    }

    req.sensayUserId = user.sensayUserId;
    next();
  } catch (error) {
    logger?.error?.(`Sensay link validation error: ${error.message}`) || console.error('Sensay link validation error', error.message);
    
    return res.status(500).json({
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
export const addSensayUser = async (req, res, next) => {
  try {
    if (!req.user) {
      return next();
    }

    const userId = req.user.id || req.user._id;
    let user = req.user;

    // If user object doesn't have sensayUserId, fetch from database
    if (!user.sensayUserId) {
      const dbUser = await User.findById(userId);
      if (dbUser && dbUser.sensayUserId) {
        user = dbUser;
        req.user = dbUser;
      }
    }

    if (user.sensayUserId) {
      try {
        const sensayUser = await getCurrentSensayUser(user.sensayUserId);
        req.sensayUser = sensayUser;
        req.sensayUserId = user.sensayUserId;
      } catch (error) {
        logger?.warn?.(`Failed to fetch Sensay user ${user.sensayUserId}: ${error.message}`) || console.warn('Failed to fetch Sensay user');
        req.sensayUser = null;
        req.sensayUserId = user.sensayUserId;
      }
    } else {
      req.sensayUser = null;
      req.sensayUserId = null;
    }

    next();
  } catch (error) {
    logger?.error?.(`Add Sensay user middleware error: ${error.message}`) || console.error('Add Sensay user middleware error', error.message);
    // Don't fail the request, just continue without Sensay user
    req.sensayUser = null;
    req.sensayUserId = null;
    next();
  }
};

export default {
  ensureSensayUser,
  validateSensayLink,
  addSensayUser
};