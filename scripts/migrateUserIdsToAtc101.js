require('dotenv').config();

const mongoose = require('mongoose');
const User = require('../models/User');
const Referral = require('../models/Referral');

const PREFIX = 'ATC';
const START_NUMBER = 101;
const TEMP_PREFIX = `TMP_${Date.now()}_`;
const apply = process.argv.includes('--apply');

const formatAtcId = (number) => `${PREFIX}${String(number).padStart(3, '0')}`;

const connect = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required');
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000
  });
};

const run = async () => {
  await connect();

  const users = await User.find({})
    .select('_id name email uniqueId referralCode createdAt')
    .sort({ createdAt: 1, _id: 1 })
    .lean();

  if (!users.length) {
    console.log('No users found.');
    return;
  }

  const assignments = users.map((user, index) => ({
    user,
    nextId: formatAtcId(START_NUMBER + index),
    tempId: `${TEMP_PREFIX}${user._id}`
  }));

  console.log(`Users found: ${assignments.length}`);
  console.log(`New range: ${assignments[0].nextId} -> ${assignments[assignments.length - 1].nextId}`);
  console.table(assignments.slice(0, 10).map(({ user, nextId }) => ({
    name: user.name,
    email: user.email,
    currentId: user.uniqueId,
    currentReferralCode: user.referralCode,
    nextId
  })));

  if (!apply) {
    console.log('Dry run only. Re-run with --apply to update users.');
    return;
  }

  const atcReferrals = await Referral.find({ referralCode: /^ATC\d+$/ })
    .select('_id referralCode')
    .lean();

  for (const referral of atcReferrals) {
    await Referral.updateOne(
      { _id: referral._id },
      { $set: { referralCode: `${TEMP_PREFIX}REF_${referral._id}` } }
    );
  }

  for (const { user, tempId } of assignments) {
    await User.updateOne(
      { _id: user._id },
      { $set: { uniqueId: tempId, referralCode: tempId } },
      { runValidators: true }
    );
  }

  for (const { user, nextId } of assignments) {
    await User.updateOne(
      { _id: user._id },
      { $set: { uniqueId: nextId, referralCode: nextId } },
      { runValidators: true }
    );

    const openReferral = await Referral.findOne({
      referrer: user._id,
      referred: null
    }).sort({ createdAt: -1 });

    if (openReferral) {
      openReferral.referralCode = nextId;
      await openReferral.save();
    } else {
      await Referral.create({
        referrer: user._id,
        referralCode: nextId,
        referred: null,
        status: 'pending'
      });
    }
  }

  const duplicateIds = await User.aggregate([
    { $group: { _id: '$uniqueId', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }
  ]);

  const migratedUsers = await User.find({}).select('uniqueId').lean();
  const belowStart = migratedUsers.filter((user) => {
    const match = /^ATC(\d+)$/.exec(user.uniqueId || '');
    return match && Number(match[1]) < START_NUMBER;
  }).length;

  if (duplicateIds.length || belowStart) {
    throw new Error(`Migration verification failed. duplicateIds=${duplicateIds.length}, belowStart=${belowStart}`);
  }

  console.log('Migration complete.');
};

run()
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
