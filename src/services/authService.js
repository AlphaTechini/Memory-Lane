import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import validator from 'validator';
import emailService from './emailService.js';

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
      isVerified: user.isVerified
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
    try {
      const { email, password, firstName, lastName } = userData;

      // Validate input data
      const validation = this.validateSignupData(userData);
      if (!validation.isValid) {
        return {
          success: false,
          message: 'Validation failed',
          errors: validation.errors
        };
      }

      // Check if user already exists
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return {
          success: false,
          message: 'User with this email already exists',
          errors: ['Email is already registered']
        };
      }

      // Create new user
      const newUser = new User({
        email: email.toLowerCase().trim(),
        password,
        firstName: firstName?.trim(),
        lastName: lastName?.trim(),
        isVerified: false // Default to false, will need email verification
      });

      const savedUser = await newUser.save();

      // Generate and send OTP for email verification
      const otpResult = await this.generateAndSendOTP(savedUser.email);
      
      if (!otpResult.success) {
        // User was created but OTP failed - they can resend later
        console.warn('User created but OTP sending failed:', otpResult.message);
      }

      return {
        success: true,
        message: 'User registered successfully. Please check your email for verification code.',
        user: savedUser.toJSON(),
        otpSent: otpResult.success,
        emailPreviewURL: otpResult.emailPreviewURL // For development
      };

    } catch (error) {
      // Handle MongoDB duplicate key error
      if (error.code === 11000) {
        return {
          success: false,
          message: 'User with this email already exists',
          errors: ['Email is already registered']
        };
      }

      // Handle mongoose validation errors
      if (error.name === 'ValidationError') {
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
   * Generate and send OTP to user's email
   * @param {String} email - User's email address
   * @returns {Object} OTP generation result
   */
  async generateAndSendOTP(email) {
    try {
      const user = await User.findByEmail(email);
      if (!user) {
        return {
          success: false,
          message: 'User not found',
          errors: ['No user found with this email address']
        };
      }

      if (user.isVerified) {
        return {
          success: false,
          message: 'User already verified',
          errors: ['This account is already verified']
        };
      }

      // Generate 6-digit OTP
      const otpCode = emailService.generateOTP();
      const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

      // Save OTP to user
      user.otpCode = otpCode;
      user.otpExpires = otpExpires;
      await user.save();

      // Send OTP email
      const emailResult = await emailService.sendOTPEmail(
        user.email, 
        otpCode, 
        user.firstName
      );

      if (!emailResult.success) {
        return {
          success: false,
          message: 'Failed to send OTP email',
          errors: ['Email service temporarily unavailable']
        };
      }

      return {
        success: true,
        message: 'OTP sent successfully',
        otpExpires: otpExpires.toISOString(),
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

      if (user.isVerified) {
        return {
          success: false,
          message: 'User already verified',
          errors: ['This account is already verified']
        };
      }

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
      if (user.otpCode !== otpCode) {
        return {
          success: false,
          message: 'Invalid OTP',
          errors: ['Incorrect verification code. Please try again.']
        };
      }

      // OTP is valid - verify the user
      user.isVerified = true;
      user.otpCode = undefined;
      user.otpExpires = undefined;
      await user.save();

      // Send welcome email
      await emailService.sendWelcomeEmail(user.email, user.firstName);

      // Generate token for immediate login
      const token = this.generateToken(user);

      return {
        success: true,
        message: 'Account verified successfully',
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
