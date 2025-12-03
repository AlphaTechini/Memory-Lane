import mongoose from 'mongoose';

const patientSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  caretakerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  caretakerEmail: String,
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  firstName: String,
  lastName: String,
  allowedReplicas: {
    type: [String],
    default: []
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: Date
}, {
  timestamps: true,
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

// Compound unique index for email + caretakerId
patientSchema.index({ email: 1, caretakerId: 1 }, { unique: true });
patientSchema.index({ email: 1 });
patientSchema.index({ caretakerId: 1 });
patientSchema.index({ userId: 1 }, { sparse: true });

// Virtual for full name
patientSchema.virtual('fullName').get(function() {
  return `${this.firstName || ''} ${this.lastName || ''}`.trim();
});

// Static methods
patientSchema.statics.findByCaretaker = function(caretakerId) {
  return this.find({ caretakerId, isActive: true });
};

patientSchema.statics.findByEmail = function(email, caretakerId) {
  const query = { email: email.toLowerCase() };
  if (caretakerId) {
    query.caretakerId = caretakerId;
  }
  return this.findOne(query);
};

const Patient = mongoose.model('Patient', patientSchema);

export default Patient;