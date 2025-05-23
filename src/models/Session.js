const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: {
    type: Date
  },
  messages: [{
    from: {
      type: String,
      enum: ['user', 'ai'],
      required: true
    },
    text: {
      type: String,
      required: true
    },
    voiceInput: {
      type: Boolean,
      default: false
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  metrics: {
    engagement: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    coherence: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    responseTime: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    }
  },
  rating: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'completed'],
    default: 'active'
  }
}, {
  timestamps: true
});

// Calculate rating before saving
sessionSchema.pre('save', function(next) {
  if (this.metrics) {
    const { engagement, coherence, responseTime } = this.metrics;
    this.rating = Math.round((engagement + coherence + responseTime) / 3);
  }
  next();
});

module.exports = mongoose.model('Session', sessionSchema); 