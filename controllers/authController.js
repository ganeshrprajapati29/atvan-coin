const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const cloudinary = require('../config/cloudinary');
const razorpay = require('../config/razorpay');

const User = require('../models/User');
const UserDetails = require('../models/UserDetails');
const RewardLog = require('../models/RewardLog');
const Transaction = require('../models/Transaction');
const CoinPurchase = require('../models/CoinPurchase');

const { calculateReward, updateUserTier } = require('../utils/rewardAlgorithm');
const { sendWelcomeEmail, sendResetEmail } = require('../utils/sendMail');
const { logUserActivity } = require('../utils/activityLogger');
const { calculatePurchasePlan, accrueDailyGrowth } = require('../utils/coinGrowth');

const { processReferral, completeReferral } = require('../controllers/referralController');


// 🔹 Generate JWT token
const generateToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET || "secret123",
    { expiresIn: '30d' }
  );
};


// ================= REGISTER =================

const register = async (req, res) => {
  try {
    const { name, fatherName, email, phone, password, dob, gender, referralCode } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: 'All required fields are required' });
    }

    const userExists = await User.findOne({ email: email.trim().toLowerCase() });

    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = await User.create({
      name: name.trim(),
      fatherName: fatherName ? fatherName.trim() : '',
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      password,
      dob: dob ? new Date(dob) : null,
      gender
    });

    await UserDetails.create({
      user: user._id,
      dateOfBirth: dob ? new Date(dob) : null,
      gender
    });

    if (referralCode) {
      await processReferral(referralCode, user._id);
    }

    try {
      await sendWelcomeEmail(user);
    } catch (mailError) {
      console.error("Welcome email failed:", mailError.message);
    }

    try {
      await logUserActivity.signup(user, req);
    } catch {}

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      uniqueId: user.uniqueId,
      totalCoins: user.totalCoins,
      tier: user.tier,
      paymentRequired: true,
      amount: 100,
      token: generateToken(user._id)
    });

  } catch (error) {
    console.error("REGISTER ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};


// ================= LOGIN =================

const login = async (req, res) => {
  try {
    console.log("LOGIN BODY:", req.body);

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    if (!user.password) {
      return res.status(500).json({ message: "User password missing in DB" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid password" });
    }

    user.loginCount += 1;
    user.lastLogin = new Date();
    updateUserTier(user);

    await user.save();

    try {
      await logUserActivity.login(user, req);
    } catch {}

    const token = generateToken(user._id);

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      totalCoins: user.totalCoins,
      tier: user.tier,
      isAdmin: user.isAdmin,
      token
    });

  } catch (error) {
    console.error("🔥 LOGIN CRASH:", error);
    res.status(500).json({ message: error.message });
  }
};


// ================= PROFILE =================

const getProfile = async (req, res) => {
  try {
    await accrueDailyGrowth(req.user._id);
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// ================= FORGOT PASSWORD =================

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');

    user.resetPasswordToken = crypto.createHash('sha256')
      .update(resetToken)
      .digest('hex');

    user.resetPasswordExpires = Date.now() + 10 * 60 * 1000;

    await user.save();

    await sendResetEmail(user, resetToken);

    res.json({ message: 'Password reset email sent' });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// ================= RESET PASSWORD =================

const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    const resetPasswordToken = crypto.createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    try {
      await logUserActivity.passwordChange(user, req);
    } catch {}

    res.json({ message: 'Password reset successful' });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// ================= PAYMENT ORDER =================

const createPaymentOrder = async (req, res) => {
  try {
    const { amount, utrNumber, screenshotUrl } = req.body;

    if (!amount || Number(amount) < 100) {
      return res.status(400).json({ message: 'Minimum purchase amount is ₹100' });
    }

    if (!utrNumber || !String(utrNumber).trim()) {
      return res.status(400).json({ message: 'UTR / transaction number is required' });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { baseCoins, dailyGrowthCoins } = calculatePurchasePlan(amount);
    const purchase = await CoinPurchase.create({
      user: user._id,
      amount: Number(amount),
      baseCoins,
      dailyGrowthCoins,
      utrNumber: String(utrNumber).trim(),
      screenshotUrl
    });

    await Transaction.create({
      user: user._id,
      coinPurchase: purchase._id,
      status: 'PENDING',
      amount: Number(amount),
      currency: 'INR',
      transactionType: 'coin_purchase',
      coins: baseCoins,
      dailyGrowthCoins,
      referenceId: `CP-${purchase._id}`,
      apiResponse: {
        mode: 'manual_upi',
        upiId: purchase.upiId,
        utrNumber: String(utrNumber).trim()
      }
    });

    res.json({
      message: 'Payment request submitted. Coins will be credited after admin approval.',
      purchase,
      amount: Number(amount),
      currency: 'INR',
      coins: baseCoins,
      dailyGrowthCoins,
      upiId: purchase.upiId,
      whatsapp: '9953701057',
      status: purchase.status
    });

  } catch (error) {
    console.error("Payment request error:", error);
    res.status(500).json({ message: 'Failed to submit payment request' });
  }
};


// ================= VERIFY PAYMENT =================

const verifyPayment = async (req, res) => {
  try {
    const { amount, purchaseId } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const purchase = purchaseId
      ? await CoinPurchase.findOne({ _id: purchaseId, user: user._id })
      : null;

    if (purchase) {
      return res.json({
        message: 'Payment request is awaiting admin approval',
        purchase
      });
    }

    const { baseCoins, dailyGrowthCoins } = calculatePurchasePlan(amount || 100);
    const nextPurchase = await CoinPurchase.create({
      user: user._id,
      amount: Number(amount || 100),
      baseCoins,
      dailyGrowthCoins
    });

    res.json({
      message: 'Payment request submitted. Coins will be credited after admin approval.',
      purchase: nextPurchase
    });

  } catch (error) {
    console.error("Verify payment error:", error);
    res.status(500).json({ message: error.message });
  }
};


// ================= CHANGE PASSWORD =================

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long' });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    try {
      await logUserActivity.passwordChange(user, req);
    } catch {}

    res.json({ message: 'Password changed successfully' });

  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ message: error.message });
  }
};


module.exports = {
  register,
  login,
  getProfile,
  forgotPassword,
  resetPassword,
  changePassword,
  createPaymentOrder,
  verifyPayment
};
