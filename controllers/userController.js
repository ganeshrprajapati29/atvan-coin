const User = require('../models/User');
const RewardLog = require('../models/RewardLog');
const { logUserActivity } = require('../utils/activityLogger');
const { accrueDailyGrowth } = require('../utils/coinGrowth');

// @desc    Get leaderboard
// @route   GET /api/users/leaderboard
// @access  Private
const getLeaderboard = async (req, res) => {
  try {
    const leaderboard = await User.find({})
      .select('name email totalCoins tier loginCount')
      .sort({ totalCoins: -1, loginCount: -1 })
      .limit(50);

    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const { name, fatherName, phone, address, dob, gender, aadhaarNumber, panNumber } = req.body;

    const user = await User.findById(req.user._id);

    if (name) user.name = name;
    if (fatherName !== undefined) user.fatherName = fatherName;
    if (phone) user.phone = phone;
    if (address !== undefined) user.address = address;
    if (dob) user.dob = new Date(dob);
    if (gender) user.gender = gender;

    // Validate and update Aadhaar number
    if (aadhaarNumber) {
      if (!/^\d{12}$/.test(aadhaarNumber)) {
        return res.status(400).json({ message: 'Aadhaar number must be 12 digits' });
      }
      // Check if another user already has this Aadhaar number
      const existingUser = await User.findOne({ aadhaarNumber, _id: { $ne: user._id } });
      if (existingUser) {
        return res.status(400).json({ message: 'Aadhaar number already registered' });
      }
      user.aadhaarNumber = aadhaarNumber;
    }

    // Validate and update PAN number
    if (panNumber) {
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panNumber.toUpperCase())) {
        return res.status(400).json({ message: 'Invalid PAN number format' });
      }
      // Check if another user already has this PAN number
      const existingUser = await User.findOne({ panNumber: panNumber.toUpperCase(), _id: { $ne: user._id } });
      if (existingUser) {
        return res.status(400).json({ message: 'PAN number already registered' });
      }
      user.panNumber = panNumber.toUpperCase();
    }

    await user.save();

    // Log profile update
    const changes = {};
    if (name) changes.name = name;
    if (fatherName !== undefined) changes.fatherName = fatherName;
    if (phone) changes.phone = phone;
    if (address !== undefined) changes.address = address;
    if (dob) changes.dob = dob;
    if (gender) changes.gender = gender;
    if (aadhaarNumber) changes.aadhaarNumber = aadhaarNumber;
    if (panNumber) changes.panNumber = panNumber;

    await logUserActivity.profileUpdate(user, req, changes);

    res.json({ message: 'Profile updated successfully', user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update user bank details
// @route   PUT /api/users/bank-details
// @access  Private
const updateBankDetails = async (req, res) => {
  try {
    const { accountHolderName, accountNumber, ifsc, bankName, upiId } = req.body;

    const user = await User.findById(req.user._id);

    user.bankDetails = {
      accountHolderName,
      accountNumber,
      ifsc,
      bankName,
      upiId
    };

    await user.save();

    res.json({ message: 'Bank details updated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user reward history
// @route   GET /api/users/rewards
// @access  Private
const getRewardHistory = async (req, res) => {
  try {
    await accrueDailyGrowth(req.user._id);
    const rewards = await RewardLog.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(rewards);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user transaction history (coin transfers)
// @route   GET /api/users/transactions
// @access  Private
const getTransactionHistory = async (req, res) => {
  try {
    await accrueDailyGrowth(req.user._id);
    const transactions = await RewardLog.find({
      user: req.user._id
    })
    .populate('user', 'name uniqueId')
    .sort({ createdAt: -1 })
    .limit(50);

    // For each transaction, find the other party
    const enrichedTransactions = await Promise.all(
      transactions.map(async (transaction) => {
        const relatedLog = await RewardLog.findOne({
          transactionId: transaction.transactionId,
          user: { $ne: req.user._id }
        }).populate('user', 'name uniqueId');

        const isTransfer = transaction.reason === 'transfer';
        return {
          ...transaction.toObject(),
          otherParty: isTransfer && relatedLog ? {
            name: relatedLog.user.name,
            uniqueId: relatedLog.user.uniqueId
          } : null,
          type: transaction.coinsEarned > 0 ? 'received' : 'sent',
          amount: Math.abs(transaction.coinsEarned)
        };
      })
    );

    res.json(enrichedTransactions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user dashboard data
// @route   GET /api/users/dashboard
// @access  Private
const getDashboard = async (req, res) => {
  try {
    await accrueDailyGrowth(req.user._id);
    const user = await User.findById(req.user._id).select('-password');

    const totalEarned = await RewardLog.aggregate([
      { $match: { user: req.user._id } },
      { $group: { _id: null, total: { $sum: '$coinsEarned' } } }
    ]);

    const recentRewards = await RewardLog.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(10);

    const pendingWithdrawals = await require('../models/Withdrawal').countDocuments({
      user: req.user._id,
      status: 'pending'
    });

    res.json({
      user,
      totalEarned: totalEarned[0]?.total || 0,
      recentRewards,
      pendingWithdrawals
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Transfer coins to another user
// @route   POST /api/users/transfer-coins
// @access  Private
const transferCoins = async (req, res) => {
  try {
    const { recipientId, amount } = req.body;

    if (!recipientId || !amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid recipient or amount' });
    }

    const sender = await User.findById(req.user._id);
    const recipient = await User.findOne({ uniqueId: recipientId });

    if (!recipient) {
      return res.status(404).json({ message: 'Recipient not found' });
    }

    if (sender._id.equals(recipient._id)) {
      return res.status(400).json({ message: 'Cannot transfer to yourself' });
    }

    if (sender.totalCoins < amount) {
      return res.status(400).json({ message: 'Insufficient coins' });
    }

    sender.totalCoins -= amount;
    recipient.totalCoins += amount;

    await sender.save();
    await recipient.save();

    // Log the transfer
    await RewardLog.create({
      user: sender._id,
      coinsEarned: -amount,
      reason: 'transfer',
      tierAtTime: sender.tier
    });

    await RewardLog.create({
      user: recipient._id,
      coinsEarned: amount,
      reason: 'transfer',
      tierAtTime: recipient.tier
    });

    // Log activity
    await logUserActivity.transferSent(sender, recipient, req, amount);
    await logUserActivity.transferReceived(recipient, sender, req, amount);

    res.json({ message: 'Coins transferred successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user by unique ID
// @route   GET /api/users/by-unique-id/:uniqueId
// @access  Private
const getUserByUniqueId = async (req, res) => {
  try {
    const { uniqueId } = req.params;

    const user = await User.findOne({ uniqueId }).select('name uniqueId tier totalCoins');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Search users by uniqueId or phone
// @route   GET /api/users/search?query=...
// @access  Public
const searchUser = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.length < 2) {
      return res.set('Cache-Control', 'no-cache, no-store, must-revalidate').json([]);
    }

    // Normalize query: remove +91 prefix and spaces for phone search
    const normalizedQuery = query.replace(/^\+91\s*/, '').replace(/\s+/g, '');

    const searchQuery = {
      $or: [
        { uniqueId: new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        { phone: new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        { phone: new RegExp(normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        { phone: new RegExp(('91' + normalizedQuery).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        { phone: new RegExp(('\\+91' + normalizedQuery).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }
      ]
    };

    // Exclude self if user is authenticated
    if (req.user) {
      searchQuery._id = { $ne: req.user._id };
    }

    const users = await User.find(searchQuery).select('name uniqueId phone _id').limit(10);

    res.set('Cache-Control', 'no-cache, no-store, must-revalidate').json(users);
  } catch (error) {
    console.error('Search user error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Pay coins to another user
// @route   POST /api/users/pay-to-user
// @access  Private
const payToUser = async (req, res) => {
  try {
    const { recipientId, amount, note } = req.body;

    if (!recipientId || !amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid recipient or amount' });
    }

    const sender = await User.findById(req.user._id);
    const recipient = await User.findById(recipientId);

    if (!recipient) {
      return res.status(404).json({ message: 'Recipient not found' });
    }

    if (sender._id.equals(recipient._id)) {
      return res.status(400).json({ message: 'Cannot pay to yourself' });
    }

    if (sender.totalCoins < amount) {
      return res.status(400).json({ message: 'Insufficient coins' });
    }

    sender.totalCoins -= amount;
    recipient.totalCoins += amount;

    await sender.save();
    await recipient.save();

    // Generate transaction ID
    const transactionId = 'TXN' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase();

    // Log the payment
    await RewardLog.create({
      user: sender._id,
      coinsEarned: -amount,
      reason: 'transfer',
      transactionId,
      tierAtTime: sender.tier
    });

    await RewardLog.create({
      user: recipient._id,
      coinsEarned: amount,
      reason: 'transfer',
      transactionId,
      tierAtTime: recipient.tier
    });

    // Log activity
    await logUserActivity.paymentMade(sender, recipient, req, amount, note);
    await logUserActivity.paymentReceived(recipient, sender, req, amount);

    res.json({ message: 'Payment successful', transactionId });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getLeaderboard,
  updateProfile,
  updateBankDetails,
  getRewardHistory,
  getTransactionHistory,
  getDashboard,
  transferCoins,
  getUserByUniqueId,
  searchUser,
  payToUser
};
