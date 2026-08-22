const express = require('express');
const router = express.Router();
const { getAppConfig } = require('../controllers/settingsController');

router.get('/', getAppConfig);

module.exports = router;
