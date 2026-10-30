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

// Get HAYER ID information by HAYER ID
router.get('/:hayerId', asyncHandler(hayerIdController.getHayerIdById));

// Verify HAYER ID exists
router.get('/:hayerId/verify', asyncHandler(hayerIdController.verifyHayerId));

// Authenticated routes (require JWT)

// Get current user's HAYER IDs
router.get('/me', jwtAuth(), asyncHandler(hayerIdController.getCurrentUserHayerIds));

// Get primary HAYER ID
router.get('/me/primary', jwtAuth(), asyncHandler(hayerIdController.getPrimaryHayerId));

// Create new HAYER ID
router.post('/me', jwtAuth(), asyncHandler(hayerIdController.createHayerId));

// Set primary HAYER ID
router.patch('/me/:id/primary', jwtAuth(), asyncHandler(hayerIdController.setPrimaryHayerId));

// Update HAYER ID
router.patch('/me/:id', jwtAuth(), checkOwnership(hayerIdController.HayerId), asyncHandler(hayerIdController.updateHayerId));

// Delete HAYER ID
router.delete('/me/:id', jwtAuth(), checkOwnership(hayerIdController.HayerId), asyncHandler(hayerIdController.deleteHayerId));

// Generate HAYER ID recovery code
router.post('/me/recovery-code', jwtAuth(), asyncHandler(hayerIdController.generateRecoveryCode));

// Verify HAYER ID recovery code
router.post('/me/recovery-code/verify', jwtAuth(), asyncHandler(hayerIdController.verifyRecoveryCode));

// Link external account to HAYER ID
router.post('/me/link', jwtAuth(), asyncHandler(hayerIdController.linkExternalAccount));

// Unlink external account from HAYER ID
router.delete('/me/link/:provider', jwtAuth(), asyncHandler(hayerIdController.unlinkExternalAccount));

// Get linked accounts
router.get('/me/links', jwtAuth(), asyncHandler(hayerIdController.getLinkedAccounts));

// Admin routes (require admin privileges)

// List all HAYER IDs
router.get('/admin/list', jwtAuth(), isAdmin, asyncHandler(hayerIdController.listAllHayerIds));

// Get HAYER ID details (admin)
router.get('/admin/:id', jwtAuth(), isAdmin, asyncHandler(hayerIdController.getHayerIdDetails));

// Update HAYER ID (admin)
router.patch('/admin/:id', jwtAuth(), isAdmin, asyncHandler(hayerIdController.updateHayerIdAdmin));

// Suspend HAYER ID (admin)
router.patch('/admin/:id/suspend', jwtAuth(), isAdmin, asyncHandler(hayerIdController.suspendHayerId));

// Unsuspend HAYER ID (admin)
router.patch('/admin/:id/unsuspend', jwtAuth(), isAdmin, asyncHandler(hayerIdController.unsuspendHayerId));

// Search HAYER IDs (admin)
router.get('/admin/search', jwtAuth(), isAdmin, asyncHandler(hayerIdController.searchHayerIds));

// Get HAYER ID statistics (admin)
router.get('/admin/statistics', jwtAuth(), isAdmin, asyncHandler(hayerIdController.getHayerIdStatistics));

// Resolve HAYER ID to user
router.get('/admin/:hayerId/resolve', jwtAuth(), isAdmin, asyncHandler(hayerIdController.resolveHayerId));

// Federation routes

// Get HAYER ID federation information
router.get('/:hayerId/federation', asyncHandler(hayerIdController.getFederationInfo));

// Verify HAYER ID across federation
router.post('/:hayerId/federation/verify', asyncHandler(hayerIdController.verifyFederation));

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'hayer-id',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
