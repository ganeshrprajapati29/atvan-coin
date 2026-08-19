const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const {
  getOnboardingContent,
  updateOnboardingContent,
  updateBlock,
  resetOnboardingContent,
  uploadImage
} = require('../controllers/onboardingContentController');

const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');

// Configure multer for onboarding image uploads (temp local file, then
// pushed to Cloudinary and removed - same pattern as KYC document uploads).
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../uploads/onboarding');
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const allowed = /jpeg|jpg|png|webp/;
    const extname = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowed.test(file.mimetype);
    if (mimetype && extname) return cb(null, true);
    cb(new Error('Only image files (jpeg, jpg, png, webp) are allowed!'));
  }
});

// Public route
router.route('/').get(getOnboardingContent);

// Protected admin routes
router.route('/').put(protect, admin, updateOnboardingContent);
router.route('/block/:id').put(protect, admin, updateBlock);
router.route('/reset').post(protect, admin, resetOnboardingContent);
router.route('/upload-image').post(protect, admin, upload.single('image'), uploadImage);

module.exports = router;
