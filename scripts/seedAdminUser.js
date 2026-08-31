require('dotenv').config();

const mongoose = require('mongoose');
const User = require('../models/User');

const ADMIN_EMAIL = process.env.ADMIN_SEED_EMAIL || 'coin@atvanev.in';
const ADMIN_PASSWORD = process.env.ADMIN_SEED_PASSWORD;
const ADMIN_PHONE = process.env.ADMIN_SEED_PHONE || '9999999999';

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

const seedAdminUser = async () => {
  if (!ADMIN_PASSWORD) {
    throw new Error('ADMIN_SEED_PASSWORD is required');
  }

  await connect();

  let admin = await User.findOne({ email: ADMIN_EMAIL });

  if (!admin) {
    admin = new User({
      name: 'Atvan Admin',
      email: ADMIN_EMAIL,
      phone: ADMIN_PHONE,
      paymentStatus: 'completed',
      serviceActivated: true,
      kycStatus: 'verified'
    });
  }

  admin.name = admin.name || 'Atvan Admin';
  admin.phone = admin.phone || ADMIN_PHONE;
  admin.password = ADMIN_PASSWORD;
  admin.isAdmin = true;
  admin.blocked = false;
  admin.paymentStatus = 'completed';
  admin.serviceActivated = true;
  admin.kycStatus = 'verified';

  await admin.save();

  console.log('Admin user ready');
  console.log(`Email: ${ADMIN_EMAIL}`);
  console.log(`Unique ID: ${admin.uniqueId}`);
};

seedAdminUser()
  .catch((error) => {
    console.error('Admin seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
