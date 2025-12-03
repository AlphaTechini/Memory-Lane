import mongoose from 'mongoose';

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

// Static methods
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

userSchema.statics.findByGoogleId = function(googleId) {
  return this.findOne({ googleId });
};

const User = mongoose.model('User', userSchema);

export default User;