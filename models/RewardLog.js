const mongoose = require('mongoose');

const rewardLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  coinsEarned: {
    type: Number,
    required: true
  },
  reason: {
    type: String,
    required: true,
    enum: [
      'login',
      'referral',
      'bonus',
      'redemption',
      'transfer',
      'Account Activation',
      'Payment Reward',
      'Referral Bonus',
      'Coin Purchase',
      'Daily Growth'
    ]
  },
  transactionId: {
    type: String
  },
  tierAtTime: {
    type: String,
    enum: ['Silver', 'Gold', 'Platinum', 'Growth', 'Purchase'],
    required: true
  },
  loginCount: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('RewardLog', rewardLogSchema);
