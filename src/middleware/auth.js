import authService from '../services/authService.js';

/**
 * Authentication middleware for Fastify
 */

/**
 * JWT Authentication middleware
 * Verifies JWT token from Authorization header
 */
export const authenticateToken = async (request, reply) => {
  try {
    // Extract token from Authorization header
    const authHeader = request.headers.authorization;
    
    if (!authHeader) {
      reply.code(401).send({
        success: false,
        message: 'Access token required',
        errors: ['No authorization header provided']
      });
      return;
    }

    if (!authHeader.startsWith('Bearer ')) {
      reply.code(401).send({
        success: false,
        message: 'Invalid token format',
        errors: ['Authorization header must start with "Bearer "']
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      reply.code(401).send({
        success: false,
        message: 'Access token required',
        errors: ['No token provided']
      });
      return;
    }

    // Verify token
    const decoded = authService.verifyToken(token);

    // Basic validation of token payload to prevent injection via crafted token fields
    const isSafeUuid = id => typeof id === 'string' && /^[0-9a-fA-F\-]{36}$/.test(id);
    if (!decoded || !decoded.id || typeof decoded.id !== 'string') {
      reply.code(401).send({ success: false, message: 'Invalid token payload', errors: ['Malformed token payload'] });
      return;
    }

    // If token type indicates caretaker/patient ensure id looks like a UUID (Prisma UUID format)
    if (!isSafeUuid(decoded.id)) {
      reply.code(401).send({ success: false, message: 'Invalid token id format', errors: ['Malformed user id in token'] });
      return;
    }
    
    // Check if this is a patient token
    if (decoded.type === 'patient') {
      // Handle patient authentication
      const Patient = (await import('../models/Patient.js')).default;
      const patient = await Patient.findById(decoded.id);
      
      if (!patient || !patient.isActive) {
        reply.code(401).send({
          success: false,
          message: 'Patient not found or inactive',
          errors: ['Invalid token - patient does not exist or is inactive']
        });
        return;
      }

      // Add patient info to request object
      request.user = {
        id: patient._id,
        email: patient.email,
        role: 'patient',
        firstName: patient.firstName,
        lastName: patient.lastName,
        caretakerId: patient.caretaker,
        allowedReplicas: patient.allowedReplicas,
        isVerified: true // Patients are automatically verified through caretaker
      };
      request.isPatient = true;
      
    } else {
      // Handle regular user authentication
      const user = await authService.getUserById(decoded.id);
      
      if (!user) {
        reply.code(401).send({
          success: false,
          message: 'User not found',
          errors: ['Token is valid but user does not exist']
        });
        return;
      }

      if (!user.isVerified) {
        reply.code(403).send({
          success: false,
          message: 'Account not verified',
          errors: ['Please verify your email before accessing this resource']
        });
        return;
      }

      // Add user to request object for use in route handlers
      request.user = {
        id: user._id,
        email: user.email,
        isVerified: user.isVerified,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role || 'caretaker'
      };
      request.isPatient = false;
    }

  } catch (error) {
    if (error.message.includes('Invalid or expired token')) {
      reply.code(401).send({
        success: false,
        message: 'Invalid or expired token',
        errors: ['Please login again']
      });
    } else {
      reply.code(500).send({
        success: false,
        message: 'Authentication error',
        errors: ['Internal server error during authentication']
      });
    }
  }
};

/**
 * Optional authentication middleware
 * Adds user info to request if token is provided, but doesn't require it
 */
export const optionalAuth = async (request, reply) => {
  try {
    const authHeader = request.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      if (token) {
        const decoded = authService.verifyToken(token);
        const user = await authService.getUserById(decoded.id);
        
        if (user && user.isVerified) {
          request.user = {
            id: user._id,
            email: user.email,
            isVerified: user.isVerified,
            firstName: user.firstName,
            lastName: user.lastName
          };
        }
      }
    }
    
    // Continue regardless of token validity
  } catch (error) {
    // Silently fail for optional auth
    console.log('Optional auth failed:', error.message);
  }
};

/**
 * Caretaker-only middleware
 * Requires authentication and caretaker role
 */
export const requireCaretaker = async (request, reply) => {
  // First authenticate
  await authenticateToken(request, reply);
  
  // Ensure this is a caretaker, not a patient
  if (request.isPatient || request.user.role !== 'caretaker') {
    reply.code(403).send({
      success: false,
      message: 'Caretaker access required',
      errors: ['This endpoint is only accessible to caretakers']
    });
    return;
  }
};

/**
 * Patient-only middleware
 * Requires authentication and patient role
 */
export const requirePatient = async (request, reply) => {
  // First authenticate
  await authenticateToken(request, reply);
  
  // Ensure this is a patient, not a caretaker
  if (!request.isPatient || request.user.role !== 'patient') {
    reply.code(403).send({
      success: false,
      message: 'Patient access required',
      errors: ['This endpoint is only accessible to patients']
    });
    return;
  }
};

/**
 * Patient-caretaker relationship validation
 * Ensures patient can only access resources from their assigned caretaker
 */
export const validatePatientCaretakerRelationship = async (request, reply) => {
  // Only apply to patient requests
  if (!request.isPatient) return;
  
  const caretakerIdFromRequest = request.params.caretakerId || request.query.caretakerId || request.body.caretakerId;
  
  if (caretakerIdFromRequest && caretakerIdFromRequest !== request.user.caretakerId.toString()) {
    reply.code(403).send({
      success: false,
      message: 'Access denied',
      errors: ['You can only access resources from your assigned caretaker']
    });
    return;
  }
};

/**
 * Admin only middleware
 * Requires authentication and admin role (extend user model for roles)
 */
export const requireAdmin = async (request, reply) => {
  // First authenticate
  await authenticateToken(request, reply);
  
  // Check if user has admin role (you'd need to add role field to User model)
  // For now, we'll check if user email is in admin list
  const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
  
  if (!adminEmails.includes(request.user.email)) {
    reply.code(403).send({
      success: false,
      message: 'Admin access required',
      errors: ['Insufficient permissions']
    });
    return;
  }
};

/**
 * Rate limiting middleware (basic implementation)
 * In production, use @fastify/rate-limit plugin
 */
const loginAttempts = new Map();

export const loginRateLimit = async (request, reply) => {
  const email = request.body.email?.toLowerCase();
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 5;

  if (!email) return; // Skip if no email provided

  const userAttempts = loginAttempts.get(email) || { count: 0, windowStart: now };

  // Reset window if enough time has passed
  if (now - userAttempts.windowStart > windowMs) {
    userAttempts.count = 0;
    userAttempts.windowStart = now;
  }

  // Check if too many attempts
  if (userAttempts.count >= maxAttempts) {
    const timeLeft = Math.ceil((windowMs - (now - userAttempts.windowStart)) / 1000 / 60);
    reply.code(429).send({
      success: false,
      message: `Too many login attempts. Please try again in ${timeLeft} minutes.`,
      errors: ['Rate limit exceeded']
    });
    return;
  }

  // Increment attempts
  userAttempts.count++;
  loginAttempts.set(email, userAttempts);
};

/**
 * Clean up old rate limit entries (call periodically)
 */
export const cleanupRateLimit = () => {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;

  for (const [email, data] of loginAttempts.entries()) {
    if (now - data.windowStart > windowMs) {
      loginAttempts.delete(email);
    }
  }
};

// Clean up every hour
setInterval(cleanupRateLimit, 60 * 60 * 1000);

