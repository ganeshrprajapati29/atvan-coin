const express = require('express');
const router = express.Router();
const { getUsers, getWithdrawals, getAnalytics, updateUser, deleteUser, createUser, activateUserAccount, sendCoinCertificate, getCoinPurchases, approveCoinPurchase, rejectCoinPurchase, getDashboardStats, getRecentActivity, changeUserPassword, updateAdminProfile } = require('../controllers/adminController');
const { getUserDetails, createOrUpdateUserDetails, deleteUserDetails } = require('../controllers/userDetailsController');
const { getTransactions } = require('../controllers/transactionController');
const { getSettings, updateSetting } = require('../controllers/settingsController');
const { getActivityLogs, getActivityStats, getActivityLogById, cleanupOldLogs } = require('../controllers/activityLogController');
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');

router.get('/users', protect, admin, getUsers);
router.post('/users', protect, admin, createUser);
router.post('/users/:id/activate', protect, admin, activateUserAccount);
router.post('/users/:id/send-certificate', protect, admin, sendCoinCertificate);
router.get('/coin-purchases', protect, admin, getCoinPurchases);
router.put('/coin-purchases/:id/approve', protect, admin, approveCoinPurchase);
router.put('/coin-purchases/:id/reject', protect, admin, rejectCoinPurchase);
router.get('/withdrawals', protect, admin, getWithdrawals);
router.get('/analytics', protect, admin, getAnalytics);
router.get('/dashboard-stats', protect, admin, getDashboardStats);
router.get('/recent-activity', protect, admin, getRecentActivity);
router.put('/users/:id', protect, admin, updateUser);
router.put('/users/:id/change-password', protect, admin, changeUserPassword);
router.put('/profile', protect, admin, updateAdminProfile);
router.delete('/users/:id', protect, admin, deleteUser);

// User Details routes
router.get('/user-details', protect, admin, getUserDetails);
router.post('/user-details', protect, admin, createOrUpdateUserDetails);
router.delete('/user-details/:userId', protect, admin, deleteUserDetails);

// Transactions routes
router.get('/transactions', protect, admin, getTransactions);

// Settings routes
router.get('/settings', protect, admin, getSettings);
router.put('/settings/:key', protect, admin, updateSetting);

// Activity Logs routes
router.get('/activity-logs', protect, admin, getActivityLogs);
router.get('/activity-logs/stats', protect, admin, getActivityStats);
router.get('/activity-logs/:id', protect, admin, getActivityLogById);
router.delete('/activity-logs/cleanup', protect, admin, cleanupOldLogs);

module.exports = router;
