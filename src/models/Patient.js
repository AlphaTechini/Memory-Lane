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
  // Optional link to a full User account (if the patient also has a User record)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Replica ids this patient is allowed to access (keeps an easy lookup)
  allowedReplicas: [{
    type: String
  }],
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

const Patient = mongoose.model('Patient', patientSchema);
export default Patient;
