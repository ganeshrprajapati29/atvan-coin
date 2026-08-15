const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    withdrawal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Withdrawal'
    },
    coinPurchase: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CoinPurchase'
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    apiResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    status: {
      type: String,
      enum: ['PENDING', 'SUCCESS', 'FAILED', 'REJECTED'],
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'INR'
    },
    payoutId: {
      type: String
    },
    transactionType: {
      type: String,
      enum: ['withdrawal', 'coin_purchase', 'payment', 'growth'],
      default: 'payment'
    },
    coins: Number,
    dailyGrowthCoins: Number,
    referenceId: String,
    errorMessage: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Transaction', transactionSchema);
