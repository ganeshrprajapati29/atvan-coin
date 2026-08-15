const Transaction = require('../models/Transaction');

// ===============================================
// @desc    Get all transactions
// @route   GET /api/transactions
// @access  Private/Admin
// ===============================================
const getTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({})
      .populate('user', 'name email uniqueId')
      .populate('coinPurchase')
      .populate({
        path: 'withdrawal',
        select: 'amount status user',
        populate: {
          path: 'user',
          select: 'name email uniqueId'
        }
      })
      .sort({ createdAt: -1 });

    return res.status(200).json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return res.status(500).json({ message: error.message });
  }
};

// ===============================================
// @desc    Get transaction by ID
// @route   GET /api/transactions/:id
// @access  Private/Admin
// ===============================================
const getTransactionById = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate({
        path: 'withdrawal',
        select: 'amount status user',
        populate: {
          path: 'user',
          select: 'name email uniqueId'
        }
      });

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    return res.status(200).json(transaction);
  } catch (error) {
    console.error('Error fetching transaction:', error);
    return res.status(500).json({ message: error.message });
  }
};

// ===============================================
// @desc    Get transactions by status
// @route   GET /api/transactions/status/:status
// @access  Private/Admin
// ===============================================
const getTransactionsByStatus = async (req, res) => {
  try {
    const { status } = req.params;

    const transactions = await Transaction.find({ status })
      .populate({
        path: 'withdrawal',
        select: 'amount status user',
        populate: {
          path: 'user',
          select: 'name email uniqueId'
        }
      })
      .sort({ createdAt: -1 });

    return res.status(200).json(transactions);
  } catch (error) {
    console.error('Error filtering transactions:', error);
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getTransactions,
  getTransactionById,
  getTransactionsByStatus
};
