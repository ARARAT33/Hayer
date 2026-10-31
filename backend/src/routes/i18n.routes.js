/**
 * i18n Routes
 * Բազամալեզու մարշրուտներ
 */

const express = require('express');
const router = express.Router();
const i18nController = require('../middleware/i18n');
const { asyncHandler } = require('../middleware/errorHandler');

// Լեզուներ ստանալ
router.get('/languages', asyncHandler(i18nController.getLanguages));

// Լեզու ընտրել
router.post('/language', asyncHandler(i18nController.setLanguage));

// Տեքստ թարգմանել
router.post('/translate/text', asyncHandler(i18nController.translateText));

// Օբյեկտ թարգմանել
router.post('/translate/object', asyncHandler(i18nController.translateObject));

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'i18n',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
