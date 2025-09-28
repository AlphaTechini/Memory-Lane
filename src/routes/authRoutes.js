import authService from '../services/authService.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';

/**
 * Authentication routes
 * @param {import('fastify').FastifyInstance} fastify - The Fastify server instance
 * @param {object} options - Plugin options
 */
async function authRoutes(fastify, options) {

  // Schema for user signup
  const signupSchema = {
    body: {
      type: 'object',
      properties: {
        email: { 
          type: 'string',
          format: 'email',
          description: 'User email address'
        },
        password: { 
          type: 'string',
          minLength: 6,
          maxLength: 128,
          description: 'User password (minimum 6 characters)'
        },
        firstName: { 
          type: 'string',
          maxLength: 50,
          description: 'User first name (optional)'
        },
        lastName: { 
          type: 'string',
          maxLength: 50,
          description: 'User last name (optional)'
        }
      },
      required: ['email', 'password']
    },
    response: {
      201: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          user: {
            type: 'object',
            properties: {
              _id: { type: 'string' },
              email: { type: 'string' },
              firstName: { type: 'string' },
              lastName: { type: 'string' },
              isVerified: { type: 'boolean' },
              createdAt: { type: 'string' }
            }
          },
          token: { type: 'string' }
        }
      },
      400: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          errors: { 
            type: 'array',
            items: { type: 'string' }
          }
        }
      }
    }
  };

  // Schema for user login
  const loginSchema = {
    body: {
      type: 'object',
      properties: {
        email: { 
          type: 'string',
          format: 'email',
          description: 'User email address'
        },
        password: { 
          type: 'string',
          description: 'User password'
        }
      },
      required: ['email', 'password']
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          user: {
            type: 'object',
            properties: {
              _id: { type: 'string' },
              email: { type: 'string' },
              firstName: { type: 'string' },
              lastName: { type: 'string' },
              isVerified: { type: 'boolean' },
              lastLogin: { type: 'string' }
            }
          },
          token: { type: 'string' }
        }
      },
      400: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          errors: { 
            type: 'array',
            items: { type: 'string' }
          }
        }
      },
      401: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          errors: { 
            type: 'array',
            items: { type: 'string' }
          }
        }
      }
    }
  };

  // Schema for OTP verification
  const verifyOTPSchema = {
    body: {
      type: 'object',
      properties: {
        email: { 
          type: 'string',
          format: 'email',
          description: 'User email address'
        },
        otpCode: { 
          type: 'string',
          pattern: '^[0-9]{6}$',
          description: '6-digit OTP code'
        }
      },
      required: ['email', 'otpCode']
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          user: { type: 'object' },
          token: { type: 'string' }
        }
      },
      400: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          errors: { 
            type: 'array',
            items: { type: 'string' }
          }
        }
      }
    }
  };

  // Schema for resending OTP
  const resendOTPSchema = {
    body: {
      type: 'object',
      properties: {
        email: { 
          type: 'string',
          format: 'email',
          description: 'User email address'
        }
      },
      required: ['email']
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          otpExpires: { type: 'string' }
        }
      }
    }
  };

  // Schema for user verification
  const verifySchema = {
    params: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'User ID to verify' }
      },
      required: ['userId']
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          user: { type: 'object' }
        }
      }
    }
  };

  // Schema for patient signup (email only - no OTP)
  const patientSignupSchema = {
    body: {
      type: 'object',
      properties: {
        email: { 
          type: 'string',
          format: 'email',
          description: 'Patient email address'
        }
      },
      required: ['email']
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          patient: { type: 'object' },
          token: { type: 'string' }
        }
      }
    }
  };

  // Schema for patient login (email only - no OTP)
  const patientLoginSchema = {
    body: {
      type: 'object',
      properties: {
        email: { 
          type: 'string',
          format: 'email',
          description: 'Patient email address'
        }
      },
      required: ['email']
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          patient: { type: 'object' },
          token: { type: 'string' }
        }
      }
    }
  };

  /**
   * POST /auth/signup
   * Register a new user
   */
  fastify.post('/auth/signup', { 
    schema: signupSchema,
    config: { rateLimit: { max: 20, timeWindow: '10 minutes' } }
  }, async (request, reply) => {
    try {
      const signupSummary = {
        email: typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : undefined,
        hasPassword: Boolean(request.body?.password),
        hasNames: Boolean(request.body?.firstName || request.body?.lastName),
        role: request.body?.role || 'caretaker'
      };

      fastify.log.info({ reqId: request.id, route: 'auth/signup', payload: signupSummary }, 'Signup request received');
      const result = await authService.signUp(request.body);
      fastify.log.info({
        reqId: request.id,
        route: 'auth/signup',
        success: result.success,
        status: result.statusCode || (result.success ? 201 : 400)
      }, 'Signup result');
      
      if (result.success) {
        const status = result.statusCode || 201;
        reply.code(status).send(result);
      } else {
        reply.code(400).send(result);
      }
    } catch (error) {
      fastify.log.error({ reqId: request.id, route: 'auth/signup', err: error, message: error?.message }, 'Signup handler failed');
      reply.code(500).send({
        success: false,
        message: 'Internal server error during signup',
        errors: ['Server error']
      });
    }
  });

  /**
   * POST /auth/debug/get-otp
   * Debug-only: return stored OTP for an email when a valid secret header is provided.
   * NOTE: This endpoint is gated by the DEBUG_OTP_SECRET env var and should be removed after debugging.
   */
  fastify.post('/auth/debug/get-otp', async (request, reply) => {
    try {
      const secret = process.env.DEBUG_OTP_SECRET;
      const provided = request.headers['x-debug-otp-secret'];

      if (!secret || !provided || provided !== secret) {
        return reply.code(403).send({ success: false, message: 'Not allowed' });
      }

      const { email } = request.body || {};
      if (!email) return reply.code(400).send({ success: false, message: 'Email required' });

      const User = (await import('../models/User.js')).default;
      const user = await User.findByEmail(email);
      if (!user) return reply.code(404).send({ success: false, message: 'User not found' });

      return reply.send({ success: true, otp: user.otpCode, otpExpires: user.otpExpires });
    } catch (error) {
      fastify.log.error({ msg: 'Debug OTP error', err: error?.message, stack: error?.stack });
      return reply.code(500).send({ success: false, message: 'Server error' });
    }
  });

  /**
   * POST /auth/login
   * Login user
   */
  fastify.post('/auth/login', { 
    schema: loginSchema,
    config: { rateLimit: { max: 40, timeWindow: '5 minutes' } }
  }, async (request, reply) => {
    try {
      const loginSummary = {
        email: typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : undefined
      };
      fastify.log.info({ reqId: request.id, route: 'auth/login', payload: loginSummary }, 'Login request received');
      const result = await authService.login(request.body);
      fastify.log.info({ reqId: request.id, route: 'auth/login', success: result.success }, 'Login result');
      
      if (result.success) {
        reply.code(200).send(result);
      } else {
        // Check if it's an unverified account (different from invalid credentials)
        if (result.message.includes('not verified')) {
          reply.code(403).send(result);
        } else {
          reply.code(401).send(result);
        }
      }
    } catch (error) {
      fastify.log.error({ reqId: request.id, route: 'auth/login', err: error, message: error?.message }, 'Login handler failed');
      reply.code(500).send({
        success: false,
        message: 'Internal server error during login',
        errors: ['Server error']
      });
    }
  });

  /**
   * POST /auth/patient-signup
   * Patient signup - sends OTP to email for access
   */
  fastify.post('/auth/patient-signup', { 
    schema: patientSignupSchema,
    config: { rateLimit: { max: 30, timeWindow: '10 minutes' } }
  }, async (request, reply) => {
    try {
      const { email } = request.body;
      const result = await authService.patientSignup(email);
      
      if (result.success) {
        reply.code(200).send(result);
      } else {
        reply.code(400).send(result);
      }
    } catch (error) {
      fastify.log.error({ reqId: request.id, route: 'auth/patient-signup', err: error, message: error?.message }, 'Patient signup handler failed');
      reply.code(500).send({
        success: false,
        message: 'Internal server error during patient signup',
        errors: ['Server error']
      });
    }
  });

  /**
   * POST /auth/patient-login
   * Patient login - sends OTP to email for access
   */
  fastify.post('/auth/patient-login', { 
    schema: patientLoginSchema,
    config: { rateLimit: { max: 60, timeWindow: '5 minutes' } }
  }, async (request, reply) => {
    try {
      const { email } = request.body;
      const safeEmail = typeof email === 'string' ? email.trim().toLowerCase() : undefined;
      fastify.log.info({ reqId: request.id, route: 'auth/patient-login', email: safeEmail }, 'Patient login request received');
      const result = await authService.patientLogin(email);

      fastify.log.info({ reqId: request.id, route: 'auth/patient-login', email: safeEmail, success: result.success }, 'Patient login result');

      if (result.success) {
        reply.code(200).send(result);
      } else {
        fastify.log.warn({ reqId: request.id, route: 'auth/patient-login', email: safeEmail, result }, 'Patient login failed');
        reply.code(400).send(result);
      }
    } catch (error) {
      fastify.log.error({ reqId: request.id, route: 'auth/patient-login', err: error, message: error?.message }, 'Patient login handler failed');
      reply.code(500).send({
        success: false,
        message: 'Internal server error during patient login',
        errors: ['Server error']
      });
    }
  });

  /**
   * POST /auth/verify-otp
   * Verify OTP code and activate account
   */
  fastify.post('/auth/verify-otp', { 
    schema: verifyOTPSchema,
    config: { rateLimit: { max: 25, timeWindow: '10 minutes' } }
  }, async (request, reply) => {
    try {
      const { email, otpCode } = request.body;
      const result = await authService.verifyOTP(email, otpCode);
      
      if (result.success) {
        reply.code(200).send(result);
      } else {
        reply.code(400).send(result);
      }
    } catch (error) {
      fastify.log.error({ reqId: request.id, route: 'auth/verify-otp', err: error, message: error?.message }, 'OTP verification handler failed');
      reply.code(500).send({
        success: false,
        message: 'Internal server error during OTP verification',
        errors: ['Server error']
      });
    }
  });

  /**
   * POST /auth/resend-otp
   * Resend OTP code to user's email
   */
  fastify.post('/auth/resend-otp', { 
    schema: resendOTPSchema,
    config: { rateLimit: { max: 5, timeWindow: '10 minutes' } }
  }, async (request, reply) => {
    try {
      const { email } = request.body;
      const result = await authService.resendOTP(email);
      
      if (result.success) {
        reply.code(200).send(result);
      } else {
        reply.code(400).send(result);
      }
    } catch (error) {
      fastify.log.error({ reqId: request.id, route: 'auth/resend-otp', err: error, message: error?.message }, 'Resend OTP handler failed');
      reply.code(500).send({
        success: false,
        message: 'Internal server error during OTP resend',
        errors: ['Server error']
      });
    }
  });

  /**
   * POST /auth/verify/:userId
   * Verify user account (for email verification)
   */
  fastify.post('/auth/verify/:userId', { schema: verifySchema }, async (request, reply) => {
    try {
      const { userId } = request.params;
      const result = await authService.verifyUser(userId);
      
      if (result.success) {
        reply.code(200).send(result);
      } else {
        reply.code(400).send(result);
      }
    } catch (error) {
      fastify.log.error({ reqId: request.id, route: 'auth/verify', err: error, message: error?.message }, 'Verification handler failed');
      reply.code(500).send({
        success: false,
        message: 'Internal server error during verification',
        errors: ['Server error']
      });
    }
  });

  /**
   * GET /api/auth/me
   * Get current user info (protected route)
   */
  fastify.get('/api/auth/me', { 
    preHandler: authenticateToken 
  }, async (request, reply) => {
    try {
      // User is already attached to request by middleware
      const user = await authService.getUserById(request.user.id);
      
      if (!user) {
        reply.code(404).send({
          success: false,
          message: 'User not found',
          errors: ['User does not exist']
        });
        return;
      }

      // Log full debug info on the server only
      fastify.log.info('Auth.me requested - server-side debug:', {
        id: user._id,
        email: user.email,
        role: user.role,
        sensayUserId: user.sensayUserId
      });

      // Mask email for client response
      const maskEmail = (email) => {
        if (!email || typeof email !== 'string') return email;
        const [local, domain] = email.split('@');
        if (!local || !domain) return email;
        const first = local.charAt(0);
        return `${first}*****@${domain}`;
      };

      const userSafe = user.toJSON();
      userSafe.email = maskEmail(userSafe.email);

      reply.send({
        success: true,
        message: 'User retrieved successfully',
        user: userSafe
      });
    } catch (error) {
      // Log full stack and request context for easier debugging in production
      fastify.log.error({
        msg: 'Get user error',
        errMessage: error?.message,
        stack: error?.stack,
        reqId: request.id,
        route: 'auth/me',
        userId: request.user?.id,
        userEmail: request.user?.email
      });
      reply.code(500).send({
        success: false,
        message: 'Internal server error',
        errors: ['Server error']
      });
    }
  });

  /**
   * POST /auth/logout
   * Logout user (client-side token invalidation)
   */
  fastify.post('/auth/logout', async (request, reply) => {
    // With JWT, logout is typically handled client-side by removing the token
    // For enhanced security, you could implement a token blacklist here
    reply.send({
      success: true,
      message: 'Logged out successfully'
    });
  });

  // Health check endpoint for auth service
  fastify.get('/auth/health', async (request, reply) => {
    reply.send({
      success: true,
      message: 'Authentication service is running',
      timestamp: new Date().toISOString()
    });
  });

  /**
   * GET /auth/dashboard
   * Protected dashboard route - requires authentication
   */
  fastify.get('/auth/dashboard', { 
    preHandler: authenticateToken 
  }, async (request, reply) => {
    try {
      return {
        success: true,
        message: "Welcome to your dashboard",
        user: {
          id: request.user.id,
          email: request.user.email,
          firstName: request.user.firstName,
          lastName: request.user.lastName,
          isVerified: request.user.isVerified
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      reply.code(500).send({
        success: false,
        message: 'Error loading dashboard',
        errors: ['Internal server error']
      });
    }
  });

  /**
   * GET /auth/profile
   * Get detailed user profile (protected route)
   */
  fastify.get('/auth/profile', { 
    preHandler: authenticateToken 
  }, async (request, reply) => {
    try {
      const user = await authService.getUserById(request.user.id);
      
      if (!user) {
        reply.code(404).send({
          success: false,
          message: 'User not found',
          errors: ['User profile not found']
        });
        return;
      }

      return {
        success: true,
        message: 'Profile retrieved successfully',
        data: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          isVerified: user.isVerified,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      };
    } catch (error) {
      reply.code(500).send({
        success: false,
        message: 'Error retrieving profile',
        errors: ['Internal server error']
      });
    }
  });

  /**
   * PUT /auth/profile
   * Update user profile (protected route)
   */
  fastify.put('/auth/profile', { 
    preHandler: authenticateToken,
    schema: {
      body: {
        type: 'object',
        properties: {
          firstName: { type: 'string', maxLength: 50 },
          lastName: { type: 'string', maxLength: 50 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { firstName, lastName } = request.body;
      const userId = request.user.id;

      const updatedUser = await authService.updateUserProfile(userId, {
        firstName,
        lastName
      });

      if (!updatedUser) {
        reply.code(404).send({
          success: false,
          message: 'User not found',
          errors: ['User profile not found']
        });
        return;
      }

      return {
        success: true,
        message: 'Profile updated successfully',
        data: {
          id: updatedUser._id,
          email: updatedUser.email,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          isVerified: updatedUser.isVerified
        }
      };
    } catch (error) {
      reply.code(500).send({
        success: false,
        message: 'Error updating profile',
        errors: ['Internal server error']
      });
    }
  });

  /**
   * POST /auth/link-sensay
   * Create and link Sensay user for accounts missing sensayUserId (protected route)
   */
  fastify.post('/auth/link-sensay', { 
    preHandler: authenticateToken,
    config: { rateLimit: { max: 3, timeWindow: '10 minutes' } }
  }, async (request, reply) => {
    try {
      const userId = request.user.id;
      const User = (await import('../models/User.js')).default;
      const { createSensayUser } = await import('../services/sensayService.js');
      
      const user = await User.findById(userId);
      if (!user) {
        reply.code(404).send({
          success: false,
          message: 'User not found',
          errors: ['User account not found']
        });
        return;
      }
      
      // Only caretakers need Sensay users
      if (user.role === 'patient') {
        reply.code(400).send({
          success: false,
          message: 'Patients do not need Sensay user accounts',
          errors: ['Patient accounts use whitelist email access']
        });
        return;
      }
      
      // Check if already linked
      if (user.sensayUserId) {
        return {
          success: true,
          message: 'Sensay user already linked',
          sensayUserId: user.sensayUserId
        };
      }
      
      // Create Sensay user
      const fullName = (user.firstName || user.lastName) ? 
        `${user.firstName || ''} ${user.lastName || ''}`.trim() : 
        user.email.split('@')[0];
        
      fastify.log.info(`Manually linking Sensay user for ${user.email}`);
      
      const sensayResp = await createSensayUser({ 
        email: user.email, 
        name: fullName 
      });
      
      if (sensayResp && sensayResp.id) {
        user.sensayUserId = sensayResp.id;
        await user.save();
        
        fastify.log.info(`Successfully linked Sensay user ${sensayResp.id} to user ${user._id}`);
        
        return {
          success: true,
          message: 'Sensay user created and linked successfully',
          sensayUserId: sensayResp.id
        };
      } else if (sensayResp?.conflict) {
        fastify.log.warn(`Sensay user conflict for ${user.email} - manual resolution needed`);
        reply.code(409).send({
          success: false,
          message: 'Sensay user already exists but could not be linked automatically',
          errors: ['Please contact support for manual linking']
        });
        return;
      } else {
        reply.code(500).send({
          success: false,
          message: 'Failed to create Sensay user',
          errors: ['Sensay API returned unexpected response']
        });
        return;
      }
      
    } catch (error) {
      fastify.log.error(`Error linking Sensay user for ${request.user.id}:`, error);
      reply.code(500).send({
        success: false,
        message: 'Error creating Sensay user link',
        errors: ['Internal server error']
      });
    }
  });
}

export default authRoutes;
