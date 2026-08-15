const CoinPurchase = require('../models/CoinPurchase');
const RewardLog = require('../models/RewardLog');
const User = require('../models/User');

const COINS_PER_RUPEE = 0.1;
const ANNUAL_GROWTH_RATE = 0.05;
const DAYS_IN_YEAR = 365;

const calculatePurchasePlan = (amount) => {
  const value = Number(amount);
  const baseCoins = Number((value * COINS_PER_RUPEE).toFixed(8));
  const dailyGrowthCoins = Number(((value * ANNUAL_GROWTH_RATE) / DAYS_IN_YEAR).toFixed(8));
  return { baseCoins, dailyGrowthCoins };
};

const startOfDay = (date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const accrueDailyGrowth = async (userId) => {
  const now = new Date();
  const purchases = await CoinPurchase.find({
    user: userId,
    status: 'approved'
  });

  let totalGrowth = 0;

  for (const purchase of purchases) {
    const anchor = purchase.lastAccruedAt || purchase.approvedAt || purchase.createdAt;
    let nextDay = addDays(startOfDay(anchor), 1);
    let days = 0;

    while (nextDay <= now) {
      days += 1;
      nextDay = addDays(nextDay, 1);
    }

    if (days <= 0) {
      purchase.nextAccrualAt = nextDay;
      await purchase.save();
      continue;
    }

    const growth = Number((purchase.dailyGrowthCoins * days).toFixed(8));
    totalGrowth = Number((totalGrowth + growth).toFixed(8));
    purchase.lastAccruedAt = addDays(nextDay, -1);
    purchase.nextAccrualAt = nextDay;
    await purchase.save();

    await RewardLog.create({
      user: userId,
      coinsEarned: growth,
      reason: 'Daily Growth',
      transactionId: `GROWTH-${purchase._id}-${purchase.lastAccruedAt.toISOString().slice(0, 10)}`,
      tierAtTime: 'Growth'
    });
  }

  if (totalGrowth > 0) {
    const user = await User.findById(userId);
    if (user) {
      user.totalCoins = Number(((user.totalCoins || 0) + totalGrowth).toFixed(8));
      await user.save();
    }
  }

  return totalGrowth;
};

module.exports = {
  ANNUAL_GROWTH_RATE,
  COINS_PER_RUPEE,
  DAYS_IN_YEAR,
  calculatePurchasePlan,
  accrueDailyGrowth
};
