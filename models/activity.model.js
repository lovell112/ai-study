const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    required: true
  },
  details: {
    type: String
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  success: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  uniqueHash: {
    type: String,
    unique: true,
    sparse: true
  }
});

activitySchema.index({ userId: 1, createdAt: -1 });

activitySchema.pre('save', function(next) {
  if (!this.uniqueHash && this.userId && this.action) {
    const now = new Date();
    const minuteRounded = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      now.getHours(),
      now.getMinutes()
    ).getTime();
    this.uniqueHash = `${this.userId}-${this.action}-${this.success}-${minuteRounded}`;
  }
  next();
});

module.exports = mongoose.model('Activity', activitySchema);
