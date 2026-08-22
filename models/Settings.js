const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  description: String,
  category: {
    type: String,
    enum: ['general', 'rewards', 'payments', 'notifications', 'app'],
    default: 'general'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Settings', settingsSchema);
