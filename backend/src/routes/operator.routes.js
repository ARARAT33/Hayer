const express = require('express');
const router = express.Router();
const operatorController = require('../controllers/operator.controller');
const { jwtAuth, isAdmin, checkRole, checkPermission, checkOwnership } = require('../middleware/authentication');
const { asyncHandler } = require('../middleware/errorHandler');
const rateLimit = require('express-rate-limit');
const config = require('../config');

// Rate limiting for operator routes
const operatorLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: 20,
  message: {
    error: true,
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests. Please try again later.',
    timestamp: new Date().toISOString()
  }
});

// Public routes

// Get operator information by operator ID
router.get('/:operatorId', asyncHandler(operatorController.getOperatorById));

// Get operator information by user ID
router.get('/user/:userId', asyncHandler(operatorController.getOperatorByUserId));

// List public operators
router.get('/', asyncHandler(operatorController.listPublicOperators));

// Get operator statistics
router.get('/:operatorId/statistics', asyncHandler(operatorController.getOperatorStatistics));

// Get operator nodes
router.get('/:operatorId/nodes', asyncHandler(operatorController.getOperatorNodes));

// Authenticated routes (require JWT)

// Become an operator
router.post('/', jwtAuth(), asyncHandler(operatorController.becomeOperator));

// Get current user's operator profile
router.get('/me', jwtAuth(), asyncHandler(operatorController.getCurrentUserOperator));

// Update operator profile
router.patch('/me', jwtAuth(), asyncHandler(operatorController.updateOperatorProfile));

// Update operator settings
router.patch('/me/settings', jwtAuth(), asyncHandler(operatorController.updateOperatorSettings));

// Upload operator logo
router.post('/me/logo', jwtAuth(), asyncHandler(operatorController.uploadOperatorLogo));

// Remove operator logo
router.delete('/me/logo', jwtAuth(), asyncHandler(operatorController.removeOperatorLogo));

// Get operator nodes (authenticated)
router.get('/me/nodes', jwtAuth(), asyncHandler(operatorController.getCurrentUserOperatorNodes));

// Get operator node details
router.get('/me/nodes/:nodeId', jwtAuth(), asyncHandler(operatorController.getOperatorNodeDetails));

// Create node as operator
router.post('/me/nodes', jwtAuth(), asyncHandler(operatorController.createOperatorNode));

// Update operator node
router.patch('/me/nodes/:nodeId', jwtAuth(), asyncHandler(operatorController.updateOperatorNode));

// Delete operator node
router.delete('/me/nodes/:nodeId', jwtAuth(), asyncHandler(operatorController.deleteOperatorNode));

// Get operator users
router.get('/me/users', jwtAuth(), asyncHandler(operatorController.getOperatorUsers));

// Invite user to operator
router.post('/me/users/invite', jwtAuth(), asyncHandler(operatorController.inviteUserToOperator));

// Remove user from operator
router.delete('/me/users/:userId', jwtAuth(), asyncHandler(operatorController.removeUserFromOperator));

// Get operator activity
router.get('/me/activity', jwtAuth(), asyncHandler(operatorController.getOperatorActivity));

// Get operator notifications
router.get('/me/notifications', jwtAuth(), asyncHandler(operatorController.getOperatorNotifications));

// Get operator statistics
router.get('/me/statistics', jwtAuth(), asyncHandler(operatorController.getCurrentUserOperatorStatistics));

// Get operator dashboard
router.get('/me/dashboard', jwtAuth(), asyncHandler(operatorController.getOperatorDashboard));

// Admin routes (require admin privileges)

// List all operators
router.get('/admin/list', jwtAuth(), isAdmin, asyncHandler(operatorController.listAllOperators));

// Get operator details (admin)
router.get('/admin/:operatorId', jwtAuth(), isAdmin, asyncHandler(operatorController.getOperatorDetails));

// Update operator (admin)
router.patch('/admin/:operatorId', jwtAuth(), isAdmin, asyncHandler(operatorController.updateOperatorAdmin));

// Verify operator
router.patch('/admin/:operatorId/verify', jwtAuth(), isAdmin, asyncHandler(operatorController.verifyOperator));

// Unverify operator
router.patch('/admin/:operatorId/unverify', jwtAuth(), isAdmin, asyncHandler(operatorController.unverifyOperator));

// Suspend operator
router.patch('/admin/:operatorId/suspend', jwtAuth(), isAdmin, asyncHandler(operatorController.suspendOperator));

// Unsuspend operator
router.patch('/admin/:operatorId/unsuspend', jwtAuth(), isAdmin, asyncHandler(operatorController.unsuspendOperator));

// Ban operator
router.patch('/admin/:operatorId/ban', jwtAuth(), isAdmin, asyncHandler(operatorController.banOperator));

// Unban operator
router.patch('/admin/:operatorId/unban', jwtAuth(), isAdmin, asyncHandler(operatorController.unbanOperator));

// Delete operator (admin)
router.delete('/admin/:operatorId', jwtAuth(), isAdmin, asyncHandler(operatorController.deleteOperatorAdmin));

// Search operators (admin)
router.get('/admin/search', jwtAuth(), isAdmin, asyncHandler(operatorController.searchOperators));

// Get operator statistics (admin)
router.get('/admin/statistics', jwtAuth(), isAdmin, asyncHandler(operatorController.getOperatorStatisticsAdmin));

// Export operator data (admin)
router.get('/admin/export', jwtAuth(), isAdmin, asyncHandler(operatorController.exportOperatorData));

// Operator node management (admin)
router.get('/admin/:operatorId/nodes', jwtAuth(), isAdmin, asyncHandler(operatorController.getOperatorNodesAdmin));
router.post('/admin/:operatorId/nodes', jwtAuth(), isAdmin, asyncHandler(operatorController.createOperatorNodeAdmin));
router.patch('/admin/:operatorId/nodes/:nodeId', jwtAuth(), isAdmin, asyncHandler(operatorController.updateOperatorNodeAdmin));
router.delete('/admin/:operatorId/nodes/:nodeId', jwtAuth(), isAdmin, asyncHandler(operatorController.deleteOperatorNodeAdmin));

// Operator user management (admin)
router.get('/admin/:operatorId/users', jwtAuth(), isAdmin, asyncHandler(operatorController.getOperatorUsersAdmin));
router.post('/admin/:operatorId/users/:userId', jwtAuth(), isAdmin, asyncHandler(operatorController.addUserToOperatorAdmin));
router.delete('/admin/:operatorId/users/:userId', jwtAuth(), isAdmin, asyncHandler(operatorController.removeUserFromOperatorAdmin));

// Operator tier management (admin)
router.patch('/admin/:operatorId/tier', jwtAuth(), isAdmin, asyncHandler(operatorController.updateOperatorTier));

// Operator quota management (admin)
router.patch('/admin/:operatorId/quota', jwtAuth(), isAdmin, asyncHandler(operatorController.updateOperatorQuota));

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'operator',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
