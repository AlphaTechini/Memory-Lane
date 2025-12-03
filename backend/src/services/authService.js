import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import validator from 'validator';
import emailService from './emailService.js';
import { ensureSensayUser, syncUserWithSensay } from './sensayService.js';
import logger from '../utils/logger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Authentication Service
 */
class AuthService {

  /**
   * Login or register user with Google ID token
   * @param {String} idToken - Google ID token from frontend
   * @returns {Object} Login result with JWT and user object
   */
  async loginWithGoogle(idToken) {
    try {
      // Lazy import firebase admin
      let firebaseAdmin;
      try {
        firebaseAdmin = (await import('../firebase.js')).default;
      } catch (importErr) {
        return {
          success: false,
          message: 'Google sign-in is not configured on this server',
          errors: ['Firebase admin module not available']
        };
      }

      // Verify the Google ID token
      let decoded;
      try {
        decoded = await firebaseAdmin.auth().verifyIdToken(idToken);
      } catch (verifyError) {
        logger?.error?.('[loginWithGoogle] Token verification failed', verifyError);
        return {
          success: false,
          message: 'Invalid Google token',
          errors: ['Token verification failed']
        };
      }

      const googleId = decoded.uid;
      const email = decoded.email;
      const name = decoded.name || '';

      if (!email) {
        return {
          success: false,
          message: 'No email found in Google account',
          errors: ['Email required for registration']
        };
      }

      // Parse name
      let firstName = null, lastName = null;
      if (name) {
        const parts = name.trim().split(' ');
        firstName = parts[0] || null;
        lastName = parts.length > 1 ? parts.slice(1).join(' ') : null;
      }

      // Check if user exists with this googleId
      let user = await User.findOne({ googleId });
      
      if (user) {
        // Update user info if changed
        let updated = false;
        if (email && user.email !== email) { 
          user.email = email; 
          updated = true; 
        }
        if (firstName && user.firstName !== firstName) { 
          user.firstName = firstName; 
          updated = true; 
        }
        if (lastName && user.lastName !== lastName) { 
          user.lastName = lastName; 
          updated = true; 
        }
        if (!user.isVerified) { 
          user.isVerified = true; 
          updated = true; 
        }
        
        user.lastLogin = new Date();
        if (updated) await user.save();
      } else {
        // Check if user exists with this email
        user = await User.findByEmail(email);
        
        if (user) {
          // Link Google account to existing email account
          if (!user.googleId) {
            user.googleId = googleId;
            if (firstName && !user.firstName) user.firstName = firstName;
            if (lastName && !user.lastName) user.lastName = lastName;
            if (!user.isVerified) user.isVerified = true;
            user.lastLogin = new Date();
            await user.save();
          }
        } else {
          // Create new user
          user = await User.create({
            email,
            googleId,
            firstName,
            lastName,
            isVerified: true,
            role: 'caretaker',
            lastLogin: new Date()
          });

          // Create Sensay user
          try {
            const fullName = (firstName || lastName) ? 
              `${firstName || ''} ${lastName || ''}`.trim() : 
              email.split('@')[0];
            
            const sensayResult = await ensureSensayUser({ 
              email: user.email, 
              name: fullName,
              id: user._id.toString()
            });
            
            if (sensayResult.success && sensayResult.user) {
              user.sensayUserId = sensayResult.user.id;
              await user.save();
            }
          } catch (sensayErr) {
            logger?.warn?.('[loginWithGoogle] Sensay user creation failed', sensayErr);
            // Non-fatal - user can still login
          }
        }
      }

      // Generate JWT token
      const token = this.generateToken(user);

      return {
        success: true,
        message: 'Google sign-in successful',
        user: user.toJSON(),
        token
      };
    } catch (error) {
      logger?.error?.('[loginWithGoogle] unexpected error', error);
      return {
        success: false,
        message: 'Google sign-in failed, Please note only caretakers can sign in with Google. Try another email.',

        errors: [error.message || 'Unexpected error']
      };
    }
  }
  
  /**
   * Generate JWT token for user (caretakers only)
   */
  generateToken(user) {
    if (user.role === 'patient') {
      throw new Error('Cannot generate caretaker token for patient user');
    }

    const payload = {
      id: user._id,
      email: user.email,
      isVerified: user.isVerified,
      role: user.role || 'caretaker',
      type: 'caretaker'
    };
    
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'sensay-api',
      audience: 'sensay-app'
    });
  }

  /**
   * Verify JWT token
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

  validateSignupData(userData) {
    const errors = [];
    const { email, password, firstName, lastName } = userData;

    if (!email) {
      errors.push('Email is required');
    } else if (!validator.isEmail(email)) {
      errors.push('Please provide a valid email address');
    }

    if (!password) {
      errors.push('Password is required');
    } else if (password.length < 6) {
      errors.push('Password must be at least 6 characters long');
    } else if (password.length > 128) {
      errors.push('Password must be less than 128 characters');
    }

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

  async signUp(userData) {
    const signupEmail = userData?.email || null;

    try {
      const { email, password, firstName, lastName, role } = userData;

      const validation = this.validateSignupData(userData);
      if (!validation.isValid) {
        console.warn(`[signup] validation failed for ${email}:`, validation.errors);
        return {
          success: false,
          message: 'Validation failed',
          errors: validation.errors
        };
      }

      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        if (!existingUser.isVerified) {
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
        
        console.warn(`[signup] duplicate verified email attempt: ${email}`);
        const isPatient = existingUser.role === 'patient';
        
        if (isPatient) {
          const otpDetails = await this.generateAndSendOTP(existingUser.email);
          const baseMessage = 'You already have a patient account with this email.';
          const followUp = otpDetails.otpSent
            ? ' Check your inbox for the verification code so you can continue.'
            : ' We tried to send a verification code but ran into an issue.';

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
            message: 'You already have an account with this email. Please login instead.',
            errors: ['Account already exists - please login instead'],
            accountType: 'caretaker',
            suggestedAction: 'login'
          };
        }
      }

      const newUser = new User({
        email: email.toLowerCase().trim(),
        password,
        firstName: firstName?.trim(),
        lastName: lastName?.trim(),
        role: role || 'caretaker',
        isVerified: false
      });

      const savedUser = await newUser.save();
      console.log(`[signup] created new user ${savedUser._id} (${savedUser.email})`);

      try {
        const fullName = (firstName || lastName) ? `${firstName || ''} ${lastName || ''}`.trim() : email.split('@')[0];
        logger?.info?.(`Creating Sensay user for ${savedUser.email}`);
        
        const sensayResult = await ensureSensayUser({ 
          email: savedUser.email, 
          name: fullName,
          id: savedUser._id.toString()
        });
        
        if (sensayResult.success && sensayResult.user) {
          savedUser.sensayUserId = sensayResult.user.id;
          await savedUser.save();
          
          const action = sensayResult.created ? 'Created and linked' : 'Linked existing';
          logger?.info?.(`${action} Sensay user ${sensayResult.user.id} to local user ${savedUser._id}`);
        } else {
          throw new Error(sensayResult.message || 'Failed to ensure Sensay user');
        }
        
      } catch (sensayErr) {
        try {
          savedUser.sensayError = {
            createdAt: new Date(),
            message: sensayErr.message || 'Sensay user creation failed',
            lastAttempt: new Date()
          };
          await savedUser.save();
        } catch (persistErr) {
          logger?.warn?.(`Failed to persist sensayError for user ${savedUser._id}`);
        }

        logger?.error?.(`User ${savedUser._id} created without Sensay user ID`);
      }

      const otpResult = await this.generateAndSendOTP(savedUser.email);
      
      if (!otpResult.otpSent) {
        console.warn('User created but OTP sending failed:', otpResult.message);
      }

      try {
        const Patient = (await import('../models/Patient.js')).default;
        await Patient.updateMany(
          { email: savedUser.email.toLowerCase(), $or: [ { userId: { $exists: false } }, { userId: null } ] },
          { $set: { userId: savedUser._id, updatedAt: new Date() } }
        );
        console.log(`[signup] linked Patient docs to user ${savedUser._id}`);
      } catch (linkErr) {
        logger?.warn?.(`Failed to link Patient docs for ${savedUser.email}`);
      }

      return {
        success: true,
        message: 'User registered successfully. Please check your email for verification code.',
        user: savedUser.toJSON(),
        sensayLinked: Boolean(savedUser.sensayUserId),
        sensayError: savedUser.sensayError || null,
        otpSent: otpResult.otpSent,
        emailPreviewURL: otpResult.emailPreviewURL
      };

    } catch (error) {
      logger.error('[signup] unexpected failure', {
        email: signupEmail,
        code: error?.code,
        message: error?.message
      });

      if (error?.code === 'P2002' || error?.code === 11000) {
        return {
          success: false,
          message: 'User with this email already exists',
          errors: ['Email is already registered']
        };
      }

      if (error?.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => err.message);
        return {
          success: false,
          message: 'Validation failed',
          errors
        };
      }

      throw error;
    }
  }

  async login(loginData) {
    try {
      const { email, password } = loginData;

      const validation = this.validateLoginData(loginData);
      if (!validation.isValid) {
        return {
          success: false,
          message: 'Validation failed',
          errors: validation.errors
        };
      }

      const user = await User.findByEmail(email);
      if (!user) {
        return {
          success: false,
          message: 'Invalid email or password',
          errors: ['Invalid credentials']
        };
      }

      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        return {
          success: false,
          message: 'Invalid email or password',
          errors: ['Invalid credentials']
        };
      }

      if (!user.isVerified) {
        return {
          success: false,
          message: 'Account not verified. Please verify your email before logging in.',
          errors: ['Account not verified']
        };
      }

      user.lastLogin = new Date();
      await user.save();

      const token = this.generateToken(user);

      return {
        success: true,
        message: 'Login successful',
        user: user.toJSON(),
        token
      };

    } catch (error) {
      throw error;
    }
  }

  async getUserById(userId) {
    try {
      const user = await User.findById(userId).select('-password');
      return user;
    } catch (error) {
      throw error;
    }
  }

  async patientSignup(email) {
    try {
      logger.info(`Patient signup attempt for email: ${email}`);
      
      if (!validator.isEmail(email)) {
        logger.warn(`Invalid email format for patient signup: ${email}`);
        return {
          success: false,
          message: 'Please provide a valid email address',
          errors: ['Invalid email format']
        };
      }

      const Patient = (await import('../models/Patient.js')).default;
      const patient = await Patient.findByEmail(email.toLowerCase());

      if (!patient) {
        logger.warn(`Patient not found in database: ${email}`);
        return {
          success: false,
          message: 'Email not found. Please contact your caretaker to be added.',
          errors: ['Patient not found']
        };
      }

      logger.info(`Found patient record for ${email}`);
      await patient.updateLastLogin();

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

  async patientLogin(email) {
    try {
      return await this.patientSignup(email);
    } catch (error) {
      logger.error('Error in patient login:', error);
      throw error;
    }
  }

  generatePatientToken(patient) {
    if (!patient._id || !patient.email || !patient.caretaker) {
      throw new Error('Invalid patient object');
    }

    const payload = {
      id: patient._id,
      email: patient.email,
      role: 'patient',
      caretakerId: patient.caretaker,
      allowedReplicas: patient.allowedReplicas || [],
      type: 'patient',
      isVerified: true
    };
    
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'sensay-api',
      audience: 'sensay-app'
    });
  }

  async generateAndSendOTP(email) {
    try {
      logger.info(`Generating OTP for: ${email}`);
      const user = await User.findByEmail(email);
      if (!user) {
        logger.error(`User not found for OTP: ${email}`);
        return {
          success: false,
          message: 'User not found',
          errors: ['No user found with this email']
        };
      }
      
      logger.info(`Found user: ${user.email}, verified: ${user.isVerified}`);

      const otpCode = emailService.generateOTP();
      const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

      user.otpCode = otpCode;
      user.otpExpires = otpExpires;
      await user.save();

      let emailResult = { success: false };
      try {
        const sendInfo = await emailService.sendOTPEmail(user.email, otpCode, user.firstName);
        if (sendInfo && (sendInfo.messageId || sendInfo.accepted || sendInfo.previewURL)) {
          emailResult = { success: true, previewURL: sendInfo.previewURL };
        }
      } catch (emailErr) {
        logger?.warn?.(`Failed to send OTP email: ${emailErr.message}`);
        emailResult = { success: false, message: emailErr.message };
      }

      return {
        success: true,
        message: emailResult.success ? 'OTP sent successfully' : 'OTP generated, but email delivery failed.',
        otpExpires: otpExpires.toISOString(),
        otpSent: Boolean(emailResult.success),
        emailPreviewURL: emailResult.previewURL
      };

    } catch (error) {
      throw error;
    }
  }

  async verifyOTP(email, otpCode) {
    try {
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

      const user = await User.findByEmail(email);
      if (!user) {
        return {
          success: false,
          message: 'User not found',
          errors: ['No user found with this email']
        };
      }

      const wasAlreadyVerified = Boolean(user.isVerified);

      if (!user.otpCode) {
        return {
          success: false,
          message: 'No OTP found',
          errors: ['No verification code found. Please request a new one.']
        };
      }

      if (user.otpExpires < new Date()) {
        user.otpCode = undefined;
        user.otpExpires = undefined;
        await user.save();

        return {
          success: false,
          message: 'OTP expired',
          errors: ['Verification code has expired. Please request a new one.']
        };
      }

      const submittedOtp = String(otpCode).trim();
      const storedOtp = user.otpCode != null ? String(user.otpCode).trim() : '';

      if (storedOtp !== submittedOtp) {
        logger?.warn?.(`OTP mismatch for ${user.email}`);
        return {
          success: false,
          message: 'Invalid OTP',
          errors: ['Incorrect verification code. Please try again.']
        };
      }

      // Verify patient has caretaker link
      if (user.role === 'patient') {
        const normalizedEmail = user.email.toLowerCase();
        let caretakerLink = await User.findOne({
          $or: [
            { whitelistedPatients: normalizedEmail },
            { 'replicas.whitelistEmails': normalizedEmail }
          ]
        }).select('_id role');

        if (!caretakerLink) {
          const PatientModel = (await import('../models/Patient.js')).default;
          caretakerLink = await PatientModel.findOne({ email: normalizedEmail }).select('caretaker');
        }

        if (!caretakerLink) {
          user.otpCode = undefined;
          user.otpExpires = undefined;
          await user.save();
          return {
            success: false,
            message: 'We couldn\'t find a caretaker connected to this patient account.',
            errors: ['PATIENT_NOT_LINKED']
          };
        }
      }

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

  async resendOTP(email) {
    try {
      if (!email || !validator.isEmail(email)) {
        return {
          success: false,
          message: 'Valid email is required',
          errors: ['Please provide a valid email address']
        };
      }

      return await this.generateAndSendOTP(email);

    } catch (error) {
      throw error;
    }
  }

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
      user.verificationToken = undefined;
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

  async updateUserProfile(userId, updates) {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      const allowedUpdates = ['firstName', 'lastName'];
      const filteredUpdates = {};
      
      for (const field of allowedUpdates) {
        if (updates[field] !== undefined) {
          filteredUpdates[field] = updates[field];
        }
      }

      const user = await User.findByIdAndUpdate(
        userId,
        filteredUpdates,
        { 
          new: true,
          runValidators: true
        }
      );

      if (!user) {
        throw new Error('User not found');
      }

      if (user.sensayUserId) {
        try {
          await syncUserWithSensay(user);
          logger?.info?.(`Synced user profile updates with Sensay for user ${userId}`);
        } catch (syncError) {
          logger?.warn?.(`Failed to sync profile updates with Sensay: ${syncError.message}`);
        }
      }

      return user;
    } catch (error) {
      throw error;
    }
  }

  async syncUserWithSensay(userId) {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const syncResult = await syncUserWithSensay(user);
      
      if (syncResult.success) {
        logger?.info?.(`Successfully synced user ${userId} with Sensay`);
      } else {
        logger?.warn?.(`Failed to sync user ${userId} with Sensay: ${syncResult.message}`);
      }

      return syncResult;
    } catch (error) {
      logger?.error?.(`Error syncing user ${userId} with Sensay: ${error.message}`);
      throw error;
    }
  }

  async ensureUserInSensay(userId) {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (user.sensayUserId) {
        try {
          const syncResult = await syncUserWithSensay(user);
          if (syncResult.success) {
            return { success: true, message: 'User already exists in Sensay', sensayUserId: user.sensayUserId };
          }
        } catch (syncError) {
          logger?.warn?.(`Existing Sensay user ${user.sensayUserId} may not be valid`);
        }
      }

      const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
      const sensayResult = await ensureSensayUser({
        email: user.email,
        name: fullName || user.email.split('@')[0],
        id: user._id.toString()
      });

      if (sensayResult.success && sensayResult.user) {
        user.sensayUserId = sensayResult.user.id;
        user.sensayError = undefined;
        await user.save();

        const action = sensayResult.created ? 'Created new' : 'Linked existing';
        logger?.info?.(`${action} Sensay user ${sensayResult.user.id} for local user ${userId}`);

        return {
          success: true,
          message: `${action} Sensay user successfully`,
          sensayUserId: sensayResult.user.id,
          created: sensayResult.created
        };
      } else if (sensayResult.conflict) {
        logger?.warn?.(`Sensay user exists for ${user.email} but cannot be auto-linked`);
        
        return {
          success: false,
          message: 'Sensay user already exists but cannot be automatically linked.',
          conflict: true,
          requiresManualLinking: true
        };
      } else {
        throw new Error(sensayResult.message || 'Failed to ensure user in Sensay');
      }

    } catch (error) {
      logger?.error?.(`Error ensuring user ${userId} exists in Sensay: ${error.message}`);
      
      try {
        const user = await User.findById(userId);
        if (user) {
          user.sensayError = {
            createdAt: new Date(),
            message: error.message,
            lastAttempt: new Date()
          };
          await user.save();
        }
      } catch (persistErr) {
        logger?.warn?.(`Failed to persist Sensay error for user ${userId}`);
      }

      throw error;
    }
  }
}

export default new AuthService();
