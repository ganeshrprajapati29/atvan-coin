const User = require('../models/User');
const Withdrawal = require('../models/Withdrawal');
const RewardLog = require('../models/RewardLog');
const Service = require('../models/Service');
const KYC = require('../models/KYC');
const Transaction = require('../models/Transaction');
const CoinPurchase = require('../models/CoinPurchase');
const ActivityLog = require('../models/ActivityLog');
const { sendUserCredentialsEmail, sendCoinCertificateEmail } = require('../utils/sendMail');
const { completeReferral } = require('./referralController');
const crypto = require('crypto');

// @desc    Get all users with pagination
// @route   GET /api/admin/users
// @access  Private/Admin
const getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12; // Default 12 users per page
    const skip = (page - 1) * limit;

    // Get total count for pagination
    const totalUsers = await User.countDocuments();

    const users = await User.find({})
      .select('-password')
      .populate('referredBy', 'name uniqueId')
      .populate('referrals', 'name uniqueId')
      .sort({ createdAt: -1 }) // Sort by newest first
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalUsers / limit);

    res.json({
      users,
      pagination: {
        currentPage: page,
        totalPages,
        totalUsers,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        limit
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all withdrawals
// @route   GET /api/admin/withdrawals
// @access  Private/Admin
const getWithdrawals = async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({})
      .populate('user', 'name email')
      .sort({ createdAt: -1 });
    res.json(withdrawals);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get dashboard analytics
// @route   GET /api/admin/analytics
// @access  Private/Admin
const getAnalytics = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalCoinsEarned = await RewardLog.aggregate([
      { $group: { _id: null, total: { $sum: '$coinsEarned' } } }
    ]);
    const totalWithdrawals = await Withdrawal.countDocuments();
    const pendingWithdrawals = await Withdrawal.countDocuments({ status: 'PENDING' });
    const totalServices = await Service.countDocuments({ status: 'active' });

    // Daily logins (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dailyLogins = await RewardLog.countDocuments({
      reason: 'login',
      createdAt: { $gte: oneDayAgo }
    });

    res.json({
      totalUsers,
      totalCoinsEarned: totalCoinsEarned[0]?.total || 0,
      totalWithdrawals,
      pendingWithdrawals,
      totalServices,
      dailyLogins
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update user (Admin only)
// @route   PUT /api/admin/users/:id
// @access  Private/Admin
const updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updates = req.body;
    Object.keys(updates).forEach(key => {
      if (key !== 'password') { // Don't allow password update this way
        user[key] = updates[key];
      }
    });

    await user.save();
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete user (Admin only)
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete associated data
    await RewardLog.deleteMany({ user: req.params.id });
    await Transaction.deleteMany({ user: req.params.id });
    await Withdrawal.deleteMany({ user: req.params.id });
    await KYC.deleteMany({ user: req.params.id });
    await ActivityLog.deleteMany({ user: req.params.id });

    // Delete the user
    await User.findByIdAndDelete(req.params.id);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create new user (Admin only)
// @route   POST /api/admin/users
// @access  Private/Admin
const createUser = async (req, res) => {
  try {
    const { name, fatherName, email, phone, address, dob, gender, aadhaarNumber, panNumber } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Generate random password
    const password = crypto.randomBytes(8).toString('hex');

    // Create user
    const user = new User({
      name,
      fatherName,
      email,
      phone,
      address,
      dob,
      gender,
      aadhaarNumber,
      panNumber,
      password
    });

    await user.save();

    // Send email with credentials
    try {
      await sendUserCredentialsEmail(user, password);
    } catch (emailError) {
      console.error('Failed to send email:', emailError);
      // Don't fail the request if email fails
    }

    // Return user without password
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({
      message: 'User created successfully',
      user: userResponse
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Activate user account (Admin only)
// @route   POST /api/admin/users/:id/activate
// @access  Private/Admin
const activateUserAccount = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update user status
    user.paymentStatus = 'completed';
    user.serviceActivated = true;

    // Add coins based on payment amount (assuming ₹100 for 10 coins)
    const coinsToAdd = 10;
    user.totalCoins += coinsToAdd;

    // Update tier
    user.updateTier();

    await user.save();

    // Create reward log
    const rewardLog = new RewardLog({
      user: user._id,
      coinsEarned: coinsToAdd,
      reason: 'Account Activation',
      description: 'Account activated by admin'
    });
    await rewardLog.save();

    // Send activation email
    try {
      await sendUserCredentialsEmail(user, 'Account Activated');
    } catch (emailError) {
      console.error('Failed to send activation email:', emailError);
      // Don't fail the request if email fails
    }

    res.json({
      message: 'User account activated successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        paymentStatus: user.paymentStatus,
        serviceActivated: user.serviceActivated,
        totalCoins: user.totalCoins,
        tier: user.tier
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Send coin certificate to user (Admin only)
// @route   POST /api/admin/users/:id/send-certificate
// @access  Private/Admin
const sendCoinCertificate = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Send certificate email
    try {
      const latestPurchase = await CoinPurchase.findOne({
        user: user._id,
        status: 'approved'
      }).sort({ approvedAt: -1, createdAt: -1 });
      await sendCoinCertificateEmail(user, latestPurchase);
      res.json({ message: 'Coin certificate sent successfully to user email' });
    } catch (emailError) {
      console.error('Failed to send certificate email:', emailError);
      res.status(500).json({ message: 'Failed to send certificate email' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getCoinPurchases = async (req, res) => {
  try {
    const purchases = await CoinPurchase.find({})
      .populate('user', 'name email phone uniqueId totalCoins aadhaarNumber panNumber')
      .populate('approvedBy', 'name email uniqueId')
      .sort({ createdAt: -1 });

    res.json(purchases);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const approveCoinPurchase = async (req, res) => {
  try {
    const purchase = await CoinPurchase.findById(req.params.id).populate('user');

    if (!purchase) {
      return res.status(404).json({ message: 'Purchase request not found' });
    }

    if (purchase.status === 'approved') {
      return res.json({ message: 'Purchase already approved', purchase });
    }

    if (purchase.status === 'rejected') {
      return res.status(400).json({ message: 'Rejected purchase cannot be approved' });
    }

    const user = await User.findById(purchase.user._id || purchase.user);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const approvedAt = new Date();
    const certificateNo = `CF-${approvedAt.getFullYear()}-${String(purchase._id).slice(-6).toUpperCase()}`;

    user.totalCoins = Number(((user.totalCoins || 0) + purchase.baseCoins).toFixed(8));
    user.paymentStatus = 'completed';
    user.serviceActivated = true;
    user.updateTier();
    await user.save();

    purchase.status = 'approved';
    purchase.approvedBy = req.user._id;
    purchase.approvedAt = approvedAt;
    purchase.lastAccruedAt = approvedAt;
    purchase.nextAccrualAt = new Date(approvedAt.getTime() + 24 * 60 * 60 * 1000);
    purchase.certificateNo = certificateNo;
    purchase.adminNote = req.body?.adminNote || purchase.adminNote;
    await purchase.save();

    await RewardLog.create({
      user: user._id,
      coinsEarned: purchase.baseCoins,
      reason: 'Coin Purchase',
      transactionId: `CP-${purchase._id}`,
      tierAtTime: 'Purchase'
    });

    await Transaction.findOneAndUpdate(
      { coinPurchase: purchase._id },
      {
        status: 'SUCCESS',
        coins: purchase.baseCoins,
        dailyGrowthCoins: purchase.dailyGrowthCoins,
        referenceId: certificateNo,
        apiResponse: {
          mode: 'manual_upi',
          approvedBy: req.user._id,
          approvedAt
        }
      },
      { new: true }
    );

    await completeReferral(user._id);

    res.json({
      message: 'Purchase approved and coins credited',
      purchase,
      user
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const rejectCoinPurchase = async (req, res) => {
  try {
    const purchase = await CoinPurchase.findById(req.params.id);

    if (!purchase) {
      return res.status(404).json({ message: 'Purchase request not found' });
    }

    if (purchase.status === 'approved') {
      return res.status(400).json({ message: 'Approved purchase cannot be rejected' });
    }

    purchase.status = 'rejected';
    purchase.rejectedAt = new Date();
    purchase.adminNote = req.body?.adminNote || purchase.adminNote;
    await purchase.save();

    await Transaction.findOneAndUpdate(
      { coinPurchase: purchase._id },
      {
        status: 'REJECTED',
        errorMessage: purchase.adminNote || 'Rejected by admin'
      }
    );

    res.json({ message: 'Purchase rejected', purchase });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get dashboard stats
// @route   GET /api/admin/dashboard-stats
// @access  Private/Admin
const getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Total users
    const totalUsers = await User.countDocuments();

    // New users today
    const newUsersToday = await User.countDocuments({
      createdAt: { $gte: today, $lt: tomorrow }
    });

    // Total transactions
    const totalTransactions = await Transaction.countDocuments();

    // Transactions today
    const transactionsToday = await Transaction.countDocuments({
      createdAt: { $gte: today, $lt: tomorrow }
    });

    // Total coins
    const totalCoinsResult = await RewardLog.aggregate([
      { $group: { _id: null, total: { $sum: '$coinsEarned' } } }
    ]);
    const totalCoins = totalCoinsResult[0]?.total || 0;

    // Total KYC
    const totalKYC = await KYC.countDocuments();

    // Pending KYC
    const pendingKYC = await KYC.countDocuments({ status: 'pending' });

    // Pending withdrawals
    const pendingWithdrawals = await Withdrawal.countDocuments({ status: 'PENDING' });

    // Revenue today (sum of transaction amounts today)
    const revenueResult = await Transaction.aggregate([
      { $match: { createdAt: { $gte: today, $lt: tomorrow } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const revenueToday = revenueResult[0]?.total || 0;

    // Pending tickets (placeholder, assuming no ticket system yet)
    const pendingTickets = 0;

    res.json({
      totalUsers,
      newUsersToday,
      totalTransactions,
      transactionsToday,
      totalCoins,
      totalKYC,
      pendingKYC,
      pendingWithdrawals,
      pendingTickets,
      revenueToday
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Change user password (Admin only)
// @route   PUT /api/admin/users/:id/change-password
// @access  Private/Admin
const changeUserPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update admin profile (Admin only)
// @route   PUT /api/admin/profile
// @access  Private/Admin
const updateAdminProfile = async (req, res) => {
  try {
    const adminId = req.user._id;
    const { name, email, uniqueId, currentPassword, newPassword } = req.body;

    const admin = await User.findById(adminId);

    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    // If changing password, verify current password
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ message: 'Current password is required to change password' });
      }

      const isMatch = await admin.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: 'New password must be at least 6 characters long' });
      }

      admin.password = newPassword;
    }

    // Update other fields
    if (name) admin.name = name;
    if (email) admin.email = email;
    if (uniqueId) admin.uniqueId = uniqueId;

    await admin.save();

    // Return updated admin data (excluding password)
    const adminResponse = admin.toObject();
    delete adminResponse.password;

    res.json({
      message: 'Profile updated successfully',
      admin: adminResponse
    });
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate key error
      const field = Object.keys(error.keyValue)[0];
      return res.status(400).json({ message: `${field} already exists` });
    }
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get recent activity
// @route   GET /api/admin/recent-activity
// @access  Private/Admin
const getRecentActivity = async (req, res) => {
  try {
    const activities = await ActivityLog.find({})
      .populate('user', 'name')
      .sort({ timestamp: -1 })
      .limit(10)
      .lean();

    const formattedActivities = activities.map(activity => ({
      description: activity.description,
      timestamp: activity.timestamp.toLocaleString(),
      timeAgo: getTimeAgo(activity.timestamp)
    }));

    res.json(formattedActivities);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Helper function to calculate time ago
const getTimeAgo = (date) => {
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} hours ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays} days ago`;
};

module.exports = {
  getUsers,
  getWithdrawals,
  getAnalytics,
  updateUser,
  deleteUser,
  createUser,
  activateUserAccount,
  sendCoinCertificate,
  getCoinPurchases,
  approveCoinPurchase,
  rejectCoinPurchase,
  getDashboardStats,
  getRecentActivity,
  changeUserPassword,
  updateAdminProfile
};
