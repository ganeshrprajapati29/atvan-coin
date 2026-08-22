const Settings = require('../models/Settings');

const defaultAppConfig = {
  maintenanceMode: false,
  maintenanceTitle: 'App under maintenance',
  maintenanceMessage: 'We are improving ATVAN Coin. Please check back shortly.',
  maintenanceImageUrl: '',
  supportPhone: '9953701057',
  updatedAt: null
};

// @desc    Get all settings
// @route   GET /api/settings
// @access  Private/Admin
const getSettings = async (req, res) => {
  try {
    const settings = await Settings.find({}).sort({ category: 1, key: 1 });
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get setting by key
// @route   GET /api/settings/:key
// @access  Private/Admin
const getSettingByKey = async (req, res) => {
  try {
    const setting = await Settings.findOne({ key: req.params.key });
    if (!setting) {
      return res.status(404).json({ message: 'Setting not found' });
    }
    res.json(setting);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update or create setting
// @route   PUT /api/settings/:key
// @access  Private/Admin
const updateSetting = async (req, res) => {
  try {
    const { value, description, category } = req.body;

    const setting = await Settings.findOneAndUpdate(
      { key: req.params.key },
      { value, description, category },
      { new: true, upsert: true, runValidators: true }
    );

    res.json(setting);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete setting
// @route   DELETE /api/settings/:key
// @access  Private/Admin
const deleteSetting = async (req, res) => {
  try {
    const setting = await Settings.findOneAndDelete({ key: req.params.key });
    if (!setting) {
      return res.status(404).json({ message: 'Setting not found' });
    }
    res.json({ message: 'Setting deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get settings by category
// @route   GET /api/settings/category/:category
// @access  Private/Admin
const getSettingsByCategory = async (req, res) => {
  try {
    const settings = await Settings.find({ category: req.params.category }).sort({ key: 1 });
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Public app runtime config
// @route   GET /api/app-config
// @access  Public
const getAppConfig = async (req, res) => {
  try {
    const setting = await Settings.findOne({ key: 'app_maintenance' }).lean();
    res.json({
      ...defaultAppConfig,
      ...(setting?.value || {}),
      updatedAt: setting?.updatedAt || setting?.value?.updatedAt || null
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getSettings,
  getSettingByKey,
  updateSetting,
  deleteSetting,
  getSettingsByCategory,
  getAppConfig,
  defaultAppConfig
};
