import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(email) {
        // Basic email validation regex
        return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email);
      },
      message: 'Please enter a valid email address'
    }
  },
  // Associated Sensay user ID (per-user ownership in Sensay)
  sensayUserId: {
    type: String,
    trim: true,
    index: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long']
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  // Additional fields for potential future use
  firstName: {
    type: String,
    trim: true
  },
  lastName: {
    type: String,
    trim: true
  },
  lastLogin: {
    type: Date
  },
  // User role: 'caretaker' or 'patient'. Default to 'caretaker' to preserve existing accounts.
  role: {
    type: String,
    enum: ['caretaker', 'patient'],
    default: 'caretaker',
    index: true
  },
  verificationToken: {
    type: String
  },
  // OTP fields for email verification
  otpCode: {
    type: String,
    length: 6
  },
  otpExpires: {
    type: Date
  },
  passwordResetToken: {
    type: String
  },
  passwordResetExpires: {
    type: Date
  },
  // Gallery albums
  albums: [{
    name: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    dateOfMemory: {
      type: Date,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    photos: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Photo'
    }]
  }],
  
  // Gallery photos (standalone photos not in albums)
  photos: [{
    imageUrl: {
      type: String,
      required: true
    },
    imageId: {
      type: String,
      required: true
    },
    originalName: {
      type: String
    },
    description: {
      type: String
    },
    albumId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Album'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Replica profile picture
  replicaImageUrl: {
    type: String
  },
  replicaImageId: {
    type: String
  },
  // User's created replicas
  replicas: [{
    replicaId: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    // Template used (dad, mom, brother, etc.) – optional
    template: {
      type: String,
      trim: true,
      lowercase: true
    },
    profileImageUrl: {
      type: String
    },
    profileImageId: {
      type: String
    },
    selectedSegments: [{
      type: String
    }],
    coverageScore: {
      type: Number,
      default: 0
    },
    isActive: {
      type: Boolean,
      default: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    lastTrained: {
      type: Date
    },
    status: {
      type: String,
      default: 'CREATED'
    },
    lastSyncAt: {
      type: Date
    },
    errorMessage: {
      type: String
    },
    whitelistEmails: [{
      type: String,
      lowercase: true,
      trim: true,
      validate: {
        validator: function(email) {
          return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email);
        },
        message: 'Please enter a valid email address'
      }
    }],
    // Stored copy of the baseline persona text actually injected during first training
    baselinePersona: {
      type: String
    },
    // Stored copy of the consolidated informational profile lines used for training
    infoProfileSnapshot: {
      type: String
    },
    // Custom greeting message for the replica
    greeting: {
      type: String
    },
    // Preferred question to suggest to users when starting conversations
    preferredQuestion: {
      type: String
    }
  }],
  
  // Recently deleted replicas (to prevent re-adding during reconciliation)
  deletedReplicas: [{
    replicaId: {
      type: String,
      required: true
    },
    deletedAt: {
      type: Date,
      default: Date.now,
      expires: 86400 // Auto-remove after 24 hours (in seconds)
    }
  }],
  
  // Whitelisted patient emails for gallery access
  whitelistedPatients: [{
    type: String,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(email) {
        return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email);
      },
      message: 'Please enter a valid email address'
    }
  }]
}, {
  timestamps: true, // Adds createdAt and updatedAt automatically
  toJSON: {
    transform: function(doc, ret) {
      // Remove sensitive fields from JSON output
      delete ret.password;
      delete ret.verificationToken;
      delete ret.otpCode;
      delete ret.otpExpires;
      delete ret.passwordResetToken;
      delete ret.passwordResetExpires;
      return ret;
    }
  }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  // Only hash password if it's been modified (or is new)
  if (!this.isModified('password')) return next();
  
  try {
    // Hash password with cost of 12
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Instance method to check if user is active (verified)
userSchema.methods.isActive = function() {
  return this.isVerified;
};

// Static method to find user by email
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

// Index for better performance
// userSchema.index({ email: 1 }); // Removed to prevent duplicate index warning; unique constraint is already set in schema
userSchema.index({ createdAt: 1 });

const User = mongoose.model('User', userSchema);

export default User;
