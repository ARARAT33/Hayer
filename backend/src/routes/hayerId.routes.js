const express = require('express');
const router = express.Router();
const hayerIdController = require('../controllers/hayerId.controller');
const { jwtAuth, isAdmin, checkRole, checkPermission, checkOwnership } = require('../middleware/authentication');
const { asyncHandler } = require('../middleware/errorHandler');
const rateLimit = require('express-rate-limit');
const config = require('../config');

// Rate limiting for HAYER ID routes
const hayerIdLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: 10,
  message: {
    error: true,
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests. Please try again later.',
    timestamp: new Date().toISOString()
  }
});

// Public routes

// Get HAYER ID by HAYER ID string
router.get('/:hayerId', asyncHandler(hayerIdController.getHayerId));

// Get HAYER ID by username
router.get('/username/:username', asyncHandler(hayerIdController.getHayerIdByUsername));

// Get HAYER ID by email
router.get('/email/:email', asyncHandler(hayerIdController.getHayerIdByEmail));

// Search HAYER IDs
router.get('/search', asyncHandler(hayerIdController.searchHayerIds));

// Verify federation token
router.post('/federation/verify', asyncHandler(hayerIdController.verifyFederationToken));

// Authenticated routes (require JWT)

// Get current user's HAYER ID
router.get('/me', jwtAuth(), asyncHandler(hayerIdController.getMyHayerId));

// Get all HAYER IDs for current user
router.get('/me/all', jwtAuth(), asyncHandler(hayerIdController.getMyHayerIds));

// Create new HAYER ID
router.post('/me', jwtAuth(), hayerIdLimiter, asyncHandler(hayerIdController.createHayerId));

// Update HAYER ID settings
router.patch('/me/:hayerId', jwtAuth(), asyncHandler(hayerIdController.updateHayerId));

// Set primary HAYER ID
router.patch('/me/:hayerId/primary', jwtAuth(), asyncHandler(hayerIdController.setPrimaryHayerId));

// Deactivate HAYER ID
router.delete('/me/:hayerId', jwtAuth(), asyncHandler(hayerIdController.deactivateHayerId));

// Verify HAYER ID ownership
router.get('/me/:hayerId/verify', jwtAuth(), asyncHandler(hayerIdController.verifyOwnership));

// Generate federation token
router.post('/me/:hayerId/federation/token', jwtAuth(), asyncHandler(hayerIdController.generateFederationToken));

// Admin routes (require admin privileges)

// Get HAYER ID statistics
router.get('/admin/statistics', jwtAuth(), isAdmin, asyncHandler(hayerIdController.getHayerIdStats));

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'hayer-id',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
