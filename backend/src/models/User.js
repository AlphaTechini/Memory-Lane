import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  googleId: {
    type: String,
    sparse: true
  },
  password: {
    type: String,
    select: false // Don't include password in queries by default
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  firstName: String,
  lastName: String,
  lastLogin: Date,
  role: {
    type: String,
    enum: ['caretaker', 'patient', 'admin'],
    default: 'caretaker'
  },
  verificationToken: {
    type: String,
    select: false
  },
  otpCode: {
    type: String,
    select: false
  },
  otpExpires: {
    type: Date,
    select: false
  },
  passwordResetToken: {
    type: String,
    select: false
  },
  passwordResetExpires: {
    type: Date,
    select: false
  },
  albums: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  photos: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  replicaImageUrl: String,
  replicaImageId: String,
  replicas: {
    type: mongoose.Schema.Types.Mixed,
    default: []
  },
  whitelistedPatients: {
    type: [String],
    default: []
  },
  patientWhitelist: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  gallery: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  }
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret.__v;
      return ret;
    }
  },
  toObject: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ googleId: 1 }, { unique: true, sparse: true });
userSchema.index({ role: 1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName || ''} ${this.lastName || ''}`.trim();
});

// Instance methods
userSchema.methods.toSafeObject = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.verificationToken;
  delete obj.otpCode;
  delete obj.otpExpires;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  return obj;
};

// Hash password before saving if modified
userSchema.pre('save', async function(next) {
  try {
    // Skip if password not modified or doesn't exist
    if (!this.isModified('password') || !this.password) return next();
    
    // If password already looks like a bcrypt hash, skip re-hashing
    if (/^\$2[aby]\$/.test(this.password)) return next();
    
    const rounds = parseInt(process.env.BCRYPT_ROUNDS, 10) || 12;
    const salt = await bcrypt.genSalt(rounds);
    this.password = await bcrypt.hash(this.password, salt);
    console.log('Password hashed for user:', this.email);
    return next();
  } catch (err) {
    console.error('Error hashing password:', err);
    return next(err);
  }
});

// Compare a raw password with the hashed password
userSchema.methods.comparePassword = async function(candidate) {
  try {
    console.log('[comparePassword] Starting comparison for user:', this._id);
    console.log('[comparePassword] Stored password exists:', !!this.password);
    console.log('[comparePassword] Candidate password exists:', !!candidate);
    
    if (!this.password) {
      console.warn('[comparePassword] No password stored for user', this._id);
      return false;
    }
    
    if (!candidate) {
      console.warn('[comparePassword] Empty candidate password for user', this._id);
      return false;
    }

    const storedPassword = String(this.password);
    const candidatePassword = String(candidate);
    
    const isHashed = /^\$2[aby]\$/.test(storedPassword);
    console.log('[comparePassword] Password is hashed:', isHashed);
    
    if (isHashed) {
      // Normal path: stored password is a bcrypt hash
      const result = await bcrypt.compare(candidatePassword, storedPassword);
      console.log('[comparePassword] Bcrypt comparison result:', result);
      return result;
    }

    // Stored password is plain-text (legacy data). Compare directly.
    console.log('[comparePassword] Comparing plain-text passwords');
    const matchesPlain = candidatePassword === storedPassword;
    console.log('[comparePassword] Plain-text match:', matchesPlain);
    
    if (matchesPlain) {
      // Upgrade to hashed password on successful login
      try {
        const rounds = parseInt(process.env.BCRYPT_ROUNDS, 10) || 12;
        const salt = await bcrypt.genSalt(rounds);
        const hashed = await bcrypt.hash(candidatePassword, salt);
        
        // Use updateOne to avoid triggering pre-save hook issues
        await this.constructor.updateOne(
          { _id: this._id },
          { $set: { password: hashed } }
        );
        console.log('[comparePassword] Password upgraded to hash for user:', this._id);
      } catch (e) {
        // Non-fatal: if upgrade fails, still allow login
        console.warn('[comparePassword] Failed to upgrade password hash:', e?.message || e);
      }
      return true;
    }

    console.log('[comparePassword] Password mismatch for user:', this._id);
    return false;
  } catch (error) {
    console.error('[comparePassword] Error for user', this._id, ':', error?.message || error);
    return false;
  }
};

// Static methods
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

userSchema.statics.findByGoogleId = function(googleId) {
  return this.findOne({ googleId });
};

const User = mongoose.model('User', userSchema);

export default User;