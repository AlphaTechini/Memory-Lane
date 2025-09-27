import mongoose from 'mongoose';

const patientSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true,
    validate: {
      validator: function (email) {
        return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email);
      },
      message: 'Please enter a valid email address'
    }
  },
  // Reference to the caretaker (owner) user
  caretaker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // Denormalized caretaker email for quick display (not authoritative)
  caretakerEmail: {
    type: String,
    lowercase: true,
    trim: true
  },
  // Optional link to a full User account (if the patient also has a User record)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Basic profile (optional, may be inferred from email prefix)
  firstName: {
    type: String,
    trim: true
  },
  lastName: {
    type: String,
    trim: true
  },
  // Replica ids this patient is allowed to access (keeps an easy lookup)
  allowedReplicas: [{
    type: String
  }],
  // Lightweight active flag (caretaker can disable access)
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  lastLogin: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date
  }
}, {
  timestamps: true
});

patientSchema.index({ email: 1, caretaker: 1 }, { unique: true });

// Static helper to find by email (case-insensitive)
patientSchema.statics.findByEmail = function(email) {
  if (!email) return null;
  return this.findOne({ email: email.toLowerCase() });
};

// Instance helper to update last login
patientSchema.methods.updateLastLogin = async function() {
  this.lastLogin = new Date();
  await this.save({ validateBeforeSave: false });
  return this.lastLogin;
};

// toJSON cleanup (avoid caretaker internal ids unless needed)
patientSchema.set('toJSON', {
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  }
});

const Patient = mongoose.model('Patient', patientSchema);
export default Patient;
