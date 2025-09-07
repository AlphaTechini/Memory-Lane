import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  text: {
    type: String,
    required: true
  },
  sender: {
    type: String,
    enum: ['user', 'bot'],
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const conversationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  replicaId: {
    type: String,
    required: true
  },
  title: {
    type: String,
    default: function() {
      // Generate title from first user message or timestamp
      const firstMessage = this.messages.find(m => m.sender === 'user');
      if (firstMessage) {
        return firstMessage.text.substring(0, 50) + (firstMessage.text.length > 50 ? '...' : '');
      }
      return `Conversation ${new Date().toLocaleDateString()}`;
    }
  },
  messages: [messageSchema],
  isActive: {
    type: Boolean,
    default: true
  },
  lastMessageAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Update lastMessageAt when messages are added
conversationSchema.pre('save', function(next) {
  if (this.messages && this.messages.length > 0) {
    this.lastMessageAt = this.messages[this.messages.length - 1].timestamp;
  }
  next();
});

// Index for efficient queries
conversationSchema.index({ userId: 1, replicaId: 1, lastMessageAt: -1 });

const Conversation = mongoose.model('Conversation', conversationSchema);

export default Conversation;
