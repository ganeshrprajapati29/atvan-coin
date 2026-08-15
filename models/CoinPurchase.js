const mongoose = require('mongoose');

const coinPurchaseSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 100
  },
  baseCoins: {
    type: Number,
    required: true
  },
  dailyGrowthCoins: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    default: 'manual_upi'
  },
  upiId: {
    type: String,
    default: 'ciborigroup01@fbl'
  },
  utrNumber: String,
  screenshotUrl: String,
  adminNote: String,
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  rejectedAt: Date,
  lastAccruedAt: Date,
  nextAccrualAt: Date,
  certificateNo: {
    type: String,
    unique: true,
    sparse: true
  }
}, {
  timestamps: true
});

coinPurchaseSchema.index({ user: 1, status: 1 });
coinPurchaseSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('CoinPurchase', coinPurchaseSchema);
