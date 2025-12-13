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
userSchema.pre('save', async function() {
  // Use async middleware (no `next` callback). If password wasn't modified, do nothing.
    if (!this.isModified('password')) return next();
    // If password already looks like a bcrypt hash, skip re-hashing
    if (/^\$2[aby]\$/.test(this.password)) return next();
    const rounds = parseInt(process.env.BCRYPT_ROUNDS, 10) || 12;
    const salt = await bcrypt.genSalt(rounds);
    this.password = await bcrypt.hash(this.password, salt);
    return next();
});

// Compare a raw password with the hashed password
userSchema.methods.comparePassword = async function(candidate) {
  if (!this.password) return false;
    const isHashed = /^\$2[aby]\$/.test(this.password);
    if (isHashed) {
      // Normal path: stored password is a bcrypt hash
      return bcrypt.compare(candidate, this.password);
    }

    // Stored password appears to be plain-text (legacy). Compare directly.
    const matchesPlain = candidate === this.password;
    if (matchesPlain) {
      try {
        // Upgrade to hashed password on successful login
        const rounds = parseInt(process.env.BCRYPT_ROUNDS, 10) || 12;
        const salt = await bcrypt.genSalt(rounds);
        const hashed = await bcrypt.hash(candidate, salt);
        // Set hashed password and save. Pre-save hook will detect it's already hashed and skip re-hashing.
        this.password = hashed;
        await this.save();
      } catch (e) {
        // Non-fatal: if upgrade fails, still allow login
        console.warn('Failed to upgrade password hash for user', this._id, e?.message || e);
      }
      return true;
    }

    return false;
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