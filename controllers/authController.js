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
const { RAZORPAY_KEY_ID, RAZORPAY_WEBHOOK_SECRET } = require('../config/env');

const { processReferral, completeReferral } = require('../controllers/referralController');

const approveRazorpayPurchase = async (purchase, paymentPayload = {}, approvedBy = null) => {
  if (purchase.status === 'approved') return purchase;

  const user = await User.findById(purchase.user);
  if (!user) throw new Error('User not found');

  const approvedAt = new Date();
  const certificateNo = `CF-${approvedAt.getFullYear()}-${String(purchase._id).slice(-6).toUpperCase()}`;

  user.totalCoins = Number(((user.totalCoins || 0) + purchase.baseCoins).toFixed(8));
  user.paymentStatus = 'completed';
  user.serviceActivated = true;
  user.updateTier();
  await user.save();

  purchase.status = 'approved';
  purchase.paymentMethod = 'razorpay';
  purchase.razorpayPaymentId = paymentPayload.razorpay_payment_id || paymentPayload.id || purchase.razorpayPaymentId;
  purchase.razorpaySignature = paymentPayload.razorpay_signature || purchase.razorpaySignature;
  purchase.approvedBy = approvedBy || purchase.approvedBy;
  purchase.approvedAt = approvedAt;
  purchase.lastAccruedAt = approvedAt;
  purchase.nextAccrualAt = new Date(approvedAt.getTime() + 24 * 60 * 60 * 1000);
  purchase.certificateNo = purchase.certificateNo || certificateNo;
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
      amount: purchase.amount,
      currency: 'INR',
      transactionType: 'coin_purchase',
      coins: purchase.baseCoins,
      dailyGrowthCoins: purchase.dailyGrowthCoins,
      referenceId: purchase.razorpayPaymentId || purchase.certificateNo,
      apiResponse: {
        mode: 'razorpay',
        orderId: purchase.razorpayOrderId,
        paymentId: purchase.razorpayPaymentId,
        approvedAt
      }
    },
    { new: true }
  );

  await completeReferral(user._id);
  return purchase;
};


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
      paymentStatus: user.paymentStatus,
      serviceActivated: user.serviceActivated,
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
      paymentStatus: user.paymentStatus,
      serviceActivated: user.serviceActivated,
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


// ================= LEGACY MANUAL PAYMENT ORDER (kept for old records only) =================

const legacyManualPaymentOrder = async (req, res) => {
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


// ================= LEGACY MANUAL VERIFY PAYMENT (kept for old records only) =================

const legacyManualVerifyPayment = async (req, res) => {
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

const createRazorpayPaymentOrder = async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    if (!amount || amount < 100) {
      return res.status(400).json({ message: 'Minimum purchase amount is Rs.100' });
    }

    if (!razorpay) {
      return res.status(503).json({ message: 'Razorpay is not configured' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const hasCompletedPurchase = user.serviceActivated
      || user.paymentStatus === 'completed'
      || await CoinPurchase.exists({ user: user._id, amount: 100, status: 'approved' });

    if (hasCompletedPurchase) {
      return res.status(409).json({
        message: 'Coin purchase already completed for this account',
        paymentDisabled: true
      });
    }

    const { baseCoins, dailyGrowthCoins } = calculatePurchasePlan(amount);
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: `ATVAN-${Date.now()}-${String(user._id).slice(-6)}`,
      notes: {
        userId: String(user._id),
        email: user.email,
        coins: String(baseCoins),
        product: 'ATVAN_COIN'
      }
    });

    const purchase = await CoinPurchase.create({
      user: user._id,
      amount,
      baseCoins,
      dailyGrowthCoins,
      paymentMethod: 'razorpay',
      razorpayOrderId: order.id
    });

    await Transaction.create({
      user: user._id,
      coinPurchase: purchase._id,
      status: 'PENDING',
      amount,
      currency: 'INR',
      transactionType: 'coin_purchase',
      coins: baseCoins,
      dailyGrowthCoins,
      referenceId: order.id,
      apiResponse: {
        mode: 'razorpay',
        order
      }
    });

    res.json({
      message: 'Razorpay order created',
      keyId: RAZORPAY_KEY_ID,
      order,
      purchase,
      amount,
      currency: 'INR',
      coins: baseCoins,
      dailyGrowthCoins,
      callbackUrl: 'https://coin.atvanev.in/payment',
      status: purchase.status
    });
  } catch (error) {
    console.error('Create Razorpay order error:', error);
    res.status(500).json({ message: 'Failed to create Razorpay order' });
  }
};

const verifyRazorpayPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      purchaseId
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: 'Razorpay payment details are required' });
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: 'Payment signature verification failed' });
    }

    const purchase = await CoinPurchase.findOne({
      ...(purchaseId ? { _id: purchaseId } : {}),
      user: req.user._id,
      razorpayOrderId: razorpay_order_id
    });

    if (!purchase) {
      return res.status(404).json({ message: 'Purchase order not found' });
    }

    await approveRazorpayPurchase(purchase, {
      razorpay_payment_id,
      razorpay_signature
    });

    const updatedUser = await User.findById(req.user._id).select('-password');

    res.json({
      message: 'Payment verified and coins credited',
      purchase,
      user: updatedUser
    });
  } catch (error) {
    console.error('Verify Razorpay payment error:', error);
    res.status(500).json({ message: error.message });
  }
};

const razorpayWebhook = async (req, res) => {
  try {
    if (!RAZORPAY_WEBHOOK_SECRET) {
      return res.status(503).json({ message: 'Webhook secret is not configured' });
    }

    const signature = req.headers['x-razorpay-signature'];
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
    const expected = crypto
      .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    if (signature !== expected) {
      return res.status(400).json({ message: 'Invalid webhook signature' });
    }

    const event = JSON.parse(rawBody.toString('utf8'));
    if (event.event === 'payment.captured' || event.event === 'order.paid') {
      const payment = event.payload?.payment?.entity;
      const order = event.payload?.order?.entity;
      const orderId = payment?.order_id || order?.id;
      const paymentId = payment?.id;

      if (orderId) {
        const purchase = await CoinPurchase.findOne({ razorpayOrderId: orderId });
        if (purchase) {
          await approveRazorpayPurchase(purchase, { id: paymentId });
        }
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Razorpay webhook error:', error);
    res.status(500).json({ message: 'Webhook processing failed' });
  }
};


module.exports = {
  register,
  login,
  getProfile,
  forgotPassword,
  resetPassword,
  changePassword,
  createPaymentOrder: createRazorpayPaymentOrder,
  verifyPayment: verifyRazorpayPayment,
  razorpayWebhook
};
