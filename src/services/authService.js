import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import validator from 'validator';
import emailService from './emailService.js';
import { createSensayUser } from './sensayService.js';
import logger from '../utils/logger.js';

// JWT secret - in production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Authentication Service
 * Handles user registration, login, and token generation
 */
class AuthService {
  
  /**
   * Generate JWT token for user
   * @param {Object} user - User object
   * @returns {String} JWT token
   */
  generateToken(user) {
    const payload = {
      id: user._id,
      email: user.email,
  isVerified: user.isVerified,
  role: user.role || 'caretaker'
    };
    
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'sensay-api',
      audience: 'sensay-app'
    });
  }

  /**
   * Verify JWT token
   * @param {String} token - JWT token
   * @returns {Object} Decoded token payload
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET, {
        issuer: 'sensay-api',
        audience: 'sensay-app'
      });
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Validate user input for registration
   * @param {Object} userData - User data to validate
   * @returns {Object} Validation result
   */
  validateSignupData(userData) {
    const errors = [];
    const { email, password, firstName, lastName } = userData;

    // Email validation
    if (!email) {
      errors.push('Email is required');
    } else if (!validator.isEmail(email)) {
      errors.push('Please provide a valid email address');
    }

    // Password validation
    if (!password) {
      errors.push('Password is required');
    } else if (password.length < 6) {
      errors.push('Password must be at least 6 characters long');
    } else if (password.length > 128) {
      errors.push('Password must be less than 128 characters');
    }

    // Optional: Strong password validation (disabled for development)
    if (process.env.NODE_ENV === 'production' && password && !this.isStrongPassword(password)) {
      errors.push('Password must contain at least one uppercase letter, one lowercase letter, and one number');
    }

    // Name validation (optional)
    if (firstName && !validator.isAlpha(firstName.replace(/\s/g, ''))) {
      errors.push('First name must contain only letters');
    }
    
    if (lastName && !validator.isAlpha(lastName.replace(/\s/g, ''))) {
      errors.push('Last name must contain only letters');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if password meets strength requirements
   * @param {String} password - Password to check
   * @returns {Boolean} True if password is strong
   */
  isStrongPassword(password) {
    // At least one uppercase, one lowercase, one number
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;
    return strongPasswordRegex.test(password);
  }

  /**
   * Validate login data
   * @param {Object} loginData - Login data to validate
   * @returns {Object} Validation result
   */
  validateLoginData(loginData) {
    const errors = [];
    const { email, password } = loginData;

    if (!email) {
      errors.push('Email is required');
    } else if (!validator.isEmail(email)) {
      errors.push('Please provide a valid email address');
    }

    if (!password) {
      errors.push('Password is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Register a new user
   * @param {Object} userData - User registration data
   * @returns {Object} Registration result
   */
  async signUp(userData) {
    const signupEmail = userData?.email || null;

    try {
  const { email, password, firstName, lastName, role } = userData;

      // Validate input data
      const validation = this.validateSignupData(userData);
      if (!validation.isValid) {
        console.warn(`[signup] validation failed for ${email}:`, validation.errors);
        return {
          success: false,
          message: 'Validation failed',
          errors: validation.errors
        };
      }

      // Check if user already exists
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        if (!existingUser.isVerified) {
          // Resend OTP for unverified user instead of hard failing
            const resend = await this.generateAndSendOTP(existingUser.email);
            const baseMsg = 'Account already exists but is not verified.';
            return {
              success: true,
              message: resend.otpSent ? `${baseMsg} New verification code sent.` : baseMsg,
              user: existingUser.toJSON(),
              otpSent: resend.otpSent,
              emailPreviewURL: resend.emailPreviewURL,
              unverified: true
            };
        }
        
        // Better messaging for existing verified users
        console.warn(`[signup] duplicate verified email attempt: ${email}`);
        const isPatient = existingUser.role === 'patient';
        
        if (isPatient) {
          // Treat repeat patient signup as passwordless login request.
          const otpDetails = await this.generateAndSendOTP(existingUser.email);
          const baseMessage = 'You already have a patient account with this email.';
          const followUp = otpDetails.otpSent
            ? ' Check your inbox for the verification code so you can continue.'
            : ' We tried to send a verification code but ran into an issue. Please request a new code or contact your caretaker.';

          return {
            success: true,
            message: `${baseMessage}${followUp}`,
            user: existingUser.toJSON(),
            otpSent: otpDetails.otpSent,
            otpExpires: otpDetails.otpExpires,
            accountType: 'patient',
            suggestedAction: otpDetails.otpSent ? 'verify-otp' : 'resend-otp',
            reusedAccount: true,
            statusCode: otpDetails.otpSent ? 200 : 202
          };
        } else {
          return {
            success: false,
            message: 'You already have an account with this email. Please use the login page to access your existing account.',
            errors: ['Account already exists - please login instead'],
            accountType: 'caretaker',
            suggestedAction: 'login'
          };
        }
      }

  // Create new user
      const newUser = new User({
        email: email.toLowerCase().trim(),
        password,
        firstName: firstName?.trim(),
        lastName: lastName?.trim(),
        role: role || 'caretaker', // Preserve existing accounts as caretakers by default
        isVerified: false // Default to false, will need email verification
      });

  const savedUser = await newUser.save();
  console.log(`[signup] created new user ${savedUser._id} (${savedUser.email})`);

      // Attempt to create corresponding Sensay user with retry logic
      const createSensayUserWithRetry = async (retries = 3) => {
        for (let attempt = 1; attempt <= retries; attempt++) {
          try {
            const fullName = (firstName || lastName) ? `${firstName || ''} ${lastName || ''}`.trim() : email.split('@')[0];
            logger?.info?.(`Attempting to create Sensay user for ${savedUser.email} (attempt ${attempt}/${retries})`) || console.log(`Creating Sensay user attempt ${attempt}`);
            
            const sensayResp = await createSensayUser({ email: savedUser.email, name: fullName });
            
            if (sensayResp && sensayResp.id) {
              savedUser.sensayUserId = sensayResp.id;
              await savedUser.save();
              logger?.info?.(`Successfully linked Sensay user ${sensayResp.id} to local user ${savedUser._id}`) || console.log('Linked Sensay user', sensayResp.id);
              return true;
            } else if (sensayResp?.conflict) {
              // Handle conflict - try to find existing Sensay user
              logger?.warn?.(`Sensay user already exists for ${savedUser.email}, attempting to resolve conflict`) || console.warn('Sensay user conflict, resolving...');
              
              try {
                // Try to get the existing user from Sensay API
                const { getSensayUser } = await import('./sensayService.js');
                // Since we don't have the exact ID, we'll skip this for now and log for manual resolution
                logger?.warn?.(`Manual intervention needed: Sensay user exists for ${savedUser.email} but ID not linked`) || console.warn('Manual intervention needed for Sensay user conflict');
                return false;
              } catch (conflictErr) {
                logger?.warn?.(`Failed to resolve Sensay user conflict for ${savedUser.email}: ${conflictErr.message}`) || console.warn('Failed to resolve conflict');
                return false;
              }
            }
            
            logger?.warn?.(`Sensay user creation returned unexpected response for ${savedUser.email}:`, sensayResp) || console.warn('Unexpected Sensay response');
            return false;
            
          } catch (sensayErr) {
            logger?.warn?.(`Sensay user creation attempt ${attempt}/${retries} failed for ${email}: ${sensayErr.message}`) || console.warn(`Sensay creation attempt ${attempt} failed:`, sensayErr.message);
            
            if (attempt === retries) {
              logger?.error?.(`All ${retries} attempts to create Sensay user failed for ${email}. User will need manual linking.`) || console.error('All Sensay user creation attempts failed');
              return false;
            }
            
            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
          }
        }
        return false;
      };
      
      const sensaySuccess = await createSensayUserWithRetry();
      if (!sensaySuccess) {
        logger?.error?.(`CRITICAL: User ${savedUser._id} (${savedUser.email}) created without Sensay user ID. Replica creation will fail until manually resolved.`) || console.error('CRITICAL: User created without Sensay ID');
      }

      // Generate and send OTP for email verification
  const otpResult = await this.generateAndSendOTP(savedUser.email);
      
      if (!otpResult.otpSent) {
        // User was created but OTP failed - they can resend later
        console.warn('User created but OTP sending failed:', otpResult.message);
      }

      // Link any existing Patient documents (created earlier by caretakers) to this newly created User
      try {
        const Patient = (await import('../models/Patient.js')).default;
        // Update all patient docs with this email that don't already have a userId
        await Patient.updateMany(
          { email: savedUser.email.toLowerCase(), $or: [ { userId: { $exists: false } }, { userId: null } ] },
          { $set: { userId: savedUser._id, updatedAt: new Date() } }
        );
        console.log(`[signup] linked Patient docs to new user ${savedUser._id} for email ${savedUser.email}`);
      } catch (linkErr) {
        // Non-fatal: log and continue
        logger?.warn?.(`Failed to link Patient docs for ${savedUser.email}: ${linkErr.message}`) || console.warn('Failed to link Patient docs', linkErr.message);
      }

      return {
        success: true,
        message: 'User registered successfully. Please check your email for verification code.',
        user: savedUser.toJSON(),
        otpSent: otpResult.otpSent,
        emailPreviewURL: otpResult.emailPreviewURL // For development
      };

    } catch (error) {
      logger.error('[signup] unexpected failure', {
        email: signupEmail,
        code: error?.code,
        name: error?.name,
        message: error?.message,
        meta: error?.meta,
        stack: error?.stack
      });

      // Handle Prisma unique constraint errors (email already exists)
      if (error?.code === 'P2002' && Array.isArray(error?.meta?.target) && error.meta.target.includes('User_email_key')) {
        return {
          success: false,
          message: 'User with this email already exists',
          errors: ['Email is already registered']
        };
      }

      // Handle Prisma validation errors (e.g., field length)
      if (error?.code === 'P2000') {
        return {
          success: false,
          message: 'Invalid data provided',
          errors: ['One of the fields is too long or has invalid data']
        };
      }

  // Handle Prisma unique constraint errors alongside legacy shims
      if (error?.code === 11000) {
        console.warn(`[signup] duplicate key error for ${signupEmail}`, error.keyValue);
        return {
          success: false,
          message: 'User with this email already exists',
          errors: ['Email is already registered']
        };
      }

  // Handle validation errors coming from the Prisma compatibility layer
      if (error?.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => err.message);
        return {
          success: false,
          message: 'Validation failed',
          errors
        };
      }

      throw error; // Re-throw unexpected errors
    }
  }

  /**
   * Login user
   * @param {Object} loginData - Login credentials
   * @returns {Object} Login result
   */
  async login(loginData) {
    try {
      const { email, password } = loginData;

      // Validate input data
      const validation = this.validateLoginData(loginData);
      if (!validation.isValid) {
        return {
          success: false,
          message: 'Validation failed',
          errors: validation.errors
        };
      }

      // Find user by email
      const user = await User.findByEmail(email);
      if (!user) {
        return {
          success: false,
          message: 'Invalid email or password',
          errors: ['Invalid credentials']
        };
      }

      // Check if password is correct
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        return {
          success: false,
          message: 'Invalid email or password',
          errors: ['Invalid credentials']
        };
      }

      // Check if user is verified
      if (!user.isVerified) {
        return {
          success: false,
          message: 'Account not verified. Please verify your email before logging in.',
          errors: ['Account not verified']
        };
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Generate token
      const token = this.generateToken(user);

      return {
        success: true,
        message: 'Login successful',
        user: user.toJSON(),
        token
      };

    } catch (error) {
      throw error; // Re-throw for controller to handle
    }
  }

  /**
   * Get user by ID from token
   * @param {String} userId - User ID
   * @returns {Object} User object
   */
  async getUserById(userId) {
    try {
      const user = await User.findById(userId).select('-password');
      return user;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Patient signup - simplified authentication for memory loss patients
   * @param {String} email - Patient email
   * @returns {Object} Response with success status and token
   */
  async patientSignup(email) {
    try {
      logger.info(`Patient signup attempt for email: ${email}`);
      
      // Validate email
      if (!validator.isEmail(email)) {
        logger.warn(`Invalid email format for patient signup: ${email}`);
        return {
          success: false,
          message: 'Please provide a valid email address',
          errors: ['Invalid email format']
        };
      }

      // Import Patient model
      const Patient = (await import('../models/Patient.js')).default;
      
      // Check if patient exists in Patient collection
      const patient = await Patient.findByEmail(email.toLowerCase());

      if (!patient) {
        logger.warn(`Patient not found in database: ${email}`);
        return {
          success: false,
          message: 'Email not found in our system. Please contact your caretaker to be added.',
          errors: ['Patient not found']
        };
      }

      logger.info(`Found patient record for ${email}, caretaker: ${patient.caretakerEmail}`);

      // Update last login
      await patient.updateLastLogin();

      // Generate token for patient (simplified payload)
      const token = this.generatePatientToken(patient);

      return {
        success: true,
        message: 'Welcome! You have been successfully signed in.',
        patient: {
          _id: patient._id,
          email: patient.email,
          firstName: patient.firstName,
          lastName: patient.lastName,
          caretakerEmail: patient.caretakerEmail,
          allowedReplicas: patient.allowedReplicas
        },
        token
      };

    } catch (error) {
      logger.error('Error in patient signup:', error);
      throw error;
    }
  }

  /**
   * Patient login - same as signup (simplified for memory loss patients)
   * @param {String} email - Patient email
   * @returns {Object} Response with success status and token
   */
  async patientLogin(email) {
    try {
      // Reuse the same logic as patient signup
      return await this.patientSignup(email);
    } catch (error) {
      logger.error('Error in patient login:', error);
      throw error;
    }
  }

  /**
   * Generate JWT token for patient
   * @param {Object} patient - Patient object
   * @returns {String} JWT token
   */
  generatePatientToken(patient) {
    const payload = {
      id: patient._id,
      email: patient.email,
      role: 'patient',
      caretakerId: patient.caretaker,
      allowedReplicas: patient.allowedReplicas,
      type: 'patient' // Distinguish from regular user tokens
    };
    
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'sensay-api',
      audience: 'sensay-app'
    });
  }

  /**
   * Generate and send OTP to user's email
   * @param {String} email - User's email address
   * @returns {Object} OTP generation result
   */
  async generateAndSendOTP(email) {
    try {
      logger.info(`Attempting to find user for OTP generation: ${email}`);
      const user = await User.findByEmail(email);
      if (!user) {
        logger.error(`User not found for OTP generation: ${email}`);
        return {
          success: false,
          message: 'User not found',
          errors: ['No user found with this email address']
        };
      }
      
      logger.info(`Found user for OTP generation: ${user.email}, role: ${user.role}, verified: ${user.isVerified}`);

      // NOTE: Allow sending OTP even if user is already verified.
      // This supports a passwordless/email-only sign-in flow for patients
      // who already have an account. We will not flip verification state
      // here — OTP is used either to verify a new account or to login.

      // Generate 6-digit OTP
      const otpCode = emailService.generateOTP();
      const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

      // Save OTP to user
      user.otpCode = otpCode;
      user.otpExpires = otpExpires;
      await user.save();

      // Send OTP email (non-blocking). If email subsystem fails, return success with otpSent=false
      let emailResult = { success: false };
      try {
        const sendInfo = await emailService.sendOTPEmail(
          user.email,
          otpCode,
          user.firstName
        );

        // nodemailer returns an info object on success; normalize to { success: true, info }
        if (sendInfo && sendInfo.messageId) {
          emailResult = { success: true, info: sendInfo };
        } else if (sendInfo && sendInfo.accepted) {
          emailResult = { success: true, info: sendInfo };
        } else if (sendInfo && sendInfo.previewURL) {
          emailResult = { success: true, previewURL: sendInfo.previewURL };
        } else {
          // Some other truthy return value
          emailResult = { success: true, info: sendInfo };
        }
      } catch (emailErr) {
        logger?.warn?.(`Non-blocking: failed to send OTP email to ${user.email}: ${emailErr.message}`) || console.warn('Failed to send OTP email', emailErr.message);
        emailResult = { success: false, message: emailErr.message };
      }

      return {
        success: true,
        message: emailResult.success ? 'OTP sent successfully' : 'OTP generated, but email delivery failed. Please try resending shortly.',
        otpExpires: otpExpires.toISOString(),
        otpSent: Boolean(emailResult.success),
        emailPreviewURL: emailResult.previewURL // For development testing
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Verify OTP code and activate user account
   * @param {String} email - User's email address
   * @param {String} otpCode - 6-digit OTP code
   * @returns {Object} Verification result
   */
  async verifyOTP(email, otpCode) {
    try {
      // Validate input
      if (!email || !otpCode) {
        return {
          success: false,
          message: 'Email and OTP code are required',
          errors: ['Missing required fields']
        };
      }

      if (!validator.isEmail(email)) {
        return {
          success: false,
          message: 'Invalid email format',
          errors: ['Please provide a valid email address']
        };
      }

      if (!/^\d{6}$/.test(otpCode)) {
        return {
          success: false,
          message: 'Invalid OTP format',
          errors: ['OTP must be a 6-digit number']
        };
      }

      // Find user
      const user = await User.findByEmail(email);
      if (!user) {
        return {
          success: false,
          message: 'User not found',
          errors: ['No user found with this email address']
        };
      }

      // If user is already verified we still allow OTP-based login.
      // This supports passwordless sign-in for patients who already have accounts.
      const wasAlreadyVerified = Boolean(user.isVerified);

      // Check if OTP exists
      if (!user.otpCode) {
        return {
          success: false,
          message: 'No OTP found',
          errors: ['No verification code found. Please request a new one.']
        };
      }

      // Check if OTP is expired
      if (user.otpExpires < new Date()) {
        // Clear expired OTP
        user.otpCode = undefined;
        user.otpExpires = undefined;
        await user.save();

        return {
          success: false,
          message: 'OTP expired',
          errors: ['Verification code has expired. Please request a new one.']
        };
      }

      // Verify OTP code
      // Normalize types and whitespace to avoid mismatch between stored and submitted codes
      const submittedOtp = String(otpCode).trim();
      const storedOtp = user.otpCode != null ? String(user.otpCode).trim() : '';

      // Prepare normalized email for logging/lookups
      const normalizedEmail = (user.email || '').toLowerCase();

      if (storedOtp !== submittedOtp) {
        // Mask OTPs safely even if empty
        const mask = s => (s && s.length ? s.replace(/./g, '*') : '(none)');
        logger?.warn?.(`OTP mismatch for ${normalizedEmail}: stored='${mask(storedOtp)}' submitted='${mask(submittedOtp)}'`) || console.warn('OTP mismatch for', normalizedEmail);
        return {
          success: false,
          message: 'Invalid OTP',
          errors: ['Incorrect verification code. Please try again.']
        };
      }

      // Patients must be associated with a caretaker before receiving access
      if (user.role === 'patient') {
        let caretakerLink = null;
        try {
          caretakerLink = await User.findOne({
            $or: [
              { whitelistedPatients: normalizedEmail },
              { 'replicas.whitelistEmails': normalizedEmail }
            ]
          }).select('_id role');
        } catch (lookupErr) {
          logger?.warn?.(`Failed caretaker lookup for patient ${normalizedEmail}: ${lookupErr.message}`) || console.warn('Caretaker lookup failed', lookupErr.message);
        }

        if (!caretakerLink) {
          try {
            const PatientModel = (await import('../models/Patient.js')).default;
            caretakerLink = await PatientModel.findOne({ email: normalizedEmail }).select('caretaker');
          } catch (patientLookupErr) {
            logger?.warn?.(`Failed patient record lookup for ${normalizedEmail}: ${patientLookupErr.message}`) || console.warn('Patient record lookup failed', patientLookupErr.message);
          }
        }

        if (!caretakerLink) {
          user.otpCode = undefined;
          user.otpExpires = undefined;
          await user.save();
          return {
            success: false,
            message: 'We couldn\'t find a caretaker connected to this patient account yet. Please ask your caretaker to grant access before signing in.',
            errors: ['PATIENT_NOT_LINKED']
          };
        }
      }

      // OTP is valid - if not yet verified, mark verified and send welcome email
      user.otpCode = undefined;
      user.otpExpires = undefined;
      if (!wasAlreadyVerified) {
        user.isVerified = true;
        try {
          await emailService.sendWelcomeEmail(user.email, user.firstName);
        } catch (e) {
          // non-fatal
        }
      }

      await user.save();

      // Generate token for immediate login
      const token = this.generateToken(user);

      return {
        success: true,
        message: wasAlreadyVerified ? 'Login successful (OTP verified)' : 'Account verified successfully',
        user: user.toJSON(),
        token
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Resend OTP code
   * @param {String} email - User's email address
   * @returns {Object} Resend result
   */
  async resendOTP(email) {
    try {
      if (!email || !validator.isEmail(email)) {
        return {
          success: false,
          message: 'Valid email is required',
          errors: ['Please provide a valid email address']
        };
      }

      // Use the same method as generateAndSendOTP
      return await this.generateAndSendOTP(email);

    } catch (error) {
      throw error;
    }
  }

  /**
   * Verify user account (for email verification)
   * @param {String} userId - User ID
   * @returns {Object} Verification result
   */
  async verifyUser(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return {
          success: false,
          message: 'User not found'
        };
      }

      if (user.isVerified) {
        return {
          success: false,
          message: 'User is already verified'
        };
      }

      user.isVerified = true;
      user.verificationToken = undefined; // Clear verification token
      await user.save();

      return {
        success: true,
        message: 'User verified successfully',
        user: user.toJSON()
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update user profile
   * @param {String} userId - User ID
   * @param {Object} updates - Profile updates
   * @returns {Object} Updated user object
   */
  async updateUserProfile(userId, updates) {
    try {
      // Validate input
      if (!userId) {
        throw new Error('User ID is required');
      }

      // Only allow specific fields to be updated
      const allowedUpdates = ['firstName', 'lastName'];
      const filteredUpdates = {};
      
      for (const field of allowedUpdates) {
        if (updates[field] !== undefined) {
          filteredUpdates[field] = updates[field];
        }
      }

      // Update user in database
      const user = await User.findByIdAndUpdate(
        userId,
        filteredUpdates,
        { 
          new: true, // Return updated document
          runValidators: true // Run schema validators
        }
      );

      if (!user) {
        throw new Error('User not found');
      }

      return user;
    } catch (error) {
      throw error;
    }
  }
}

export default new AuthService();
