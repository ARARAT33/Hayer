const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { jwtAuth, isAdmin, checkRole, checkPermission, checkOwnership } = require('../middleware/authentication');
const { asyncHandler } = require('../middleware/errorHandler');
const rateLimit = require('express-rate-limit');
const config = require('../config');

// Rate limiting for user routes
const userLimiter = rateLimit({
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

// Get user by ID (public profile)
router.get('/:id', asyncHandler(userController.getUserById));

// Get user by username (public profile)
router.get('/username/:username', asyncHandler(userController.getUserByUsername));

// Get user by HAYER ID (public profile)
router.get('/hayer/:hayerId', asyncHandler(userController.getUserByHayerId));

// Search users
router.get('/', asyncHandler(userController.searchUsers));

// Authenticated routes (require JWT)

// Get current user profile
router.get('/me', jwtAuth(), asyncHandler(userController.getCurrentUserProfile));

// Update current user profile
router.patch('/me', jwtAuth(), asyncHandler(userController.updateCurrentUserProfile));

// Update user settings
router.patch('/me/settings', jwtAuth(), asyncHandler(userController.updateUserSettings));

// Get user preferences
router.get('/me/preferences', jwtAuth(), asyncHandler(userController.getUserPreferences));

// Update user preferences
router.patch('/me/preferences', jwtAuth(), asyncHandler(userController.updateUserPreferences));

// Get user privacy settings
router.get('/me/privacy', jwtAuth(), asyncHandler(userController.getUserPrivacySettings));

// Update user privacy settings
router.patch('/me/privacy', jwtAuth(), asyncHandler(userController.updateUserPrivacySettings));

// Upload avatar
router.post('/me/avatar', jwtAuth(), asyncHandler(userController.uploadAvatar));

// Remove avatar
router.delete('/me/avatar', jwtAuth(), asyncHandler(userController.removeAvatar));

// Change email
router.patch('/me/email', jwtAuth(), asyncHandler(userController.changeEmail));

// Verify new email
router.post('/me/email/verify', jwtAuth(), asyncHandler(userController.verifyNewEmail));

// Change username
router.patch('/me/username', jwtAuth(), asyncHandler(userController.changeUsername));

// Deactivate account
router.patch('/me/deactivate', jwtAuth(), asyncHandler(userController.deactivateAccount));

// Reactivate account
router.patch('/me/reactivate', jwtAuth(), asyncHandler(userController.reactivateAccount));

// Delete account
router.delete('/me', jwtAuth(), asyncHandler(userController.deleteAccount));

// Export user data
router.get('/me/export', jwtAuth(), asyncHandler(userController.exportUserData));

// Get user activity
router.get('/me/activity', jwtAuth(), asyncHandler(userController.getUserActivity));

// Get user notifications
router.get('/me/notifications', jwtAuth(), asyncHandler(userController.getUserNotifications));

// Update user notification
router.patch('/me/notifications/:id', jwtAuth(), asyncHandler(userController.updateUserNotification));

// Admin routes (require admin privileges)

// List all users
router.get('/admin/list', jwtAuth(), isAdmin, asyncHandler(userController.listAllUsers));

// Get user details (admin)
router.get('/admin/:id', jwtAuth(), isAdmin, asyncHandler(userController.getUserDetails));

// Update user (admin)
router.patch('/admin/:id', jwtAuth(), isAdmin, asyncHandler(userController.updateUser));

// Suspend user (admin)
router.patch('/admin/:id/suspend', jwtAuth(), isAdmin, asyncHandler(userController.suspendUser));

// Unsuspend user (admin)
router.patch('/admin/:id/unsuspend', jwtAuth(), isAdmin, asyncHandler(userController.unsuspendUser));

// Ban user (admin)
router.patch('/admin/:id/ban', jwtAuth(), isAdmin, asyncHandler(userController.banUser));

// Unban user (admin)
router.patch('/admin/:id/unban', jwtAuth(), isAdmin, asyncHandler(userController.unbanUser));

// Verify user (admin)
router.patch('/admin/:id/verify', jwtAuth(), isAdmin, asyncHandler(userController.verifyUser));

// Unverify user (admin)
router.patch('/admin/:id/unverify', jwtAuth(), isAdmin, asyncHandler(userController.unverifyUser));

// Impersonate user (admin)
router.post('/admin/:id/impersonate', jwtAuth(), isAdmin, asyncHandler(userController.impersonateUser));

// Search users (admin)
router.get('/admin/search', jwtAuth(), isAdmin, asyncHandler(userController.searchUsersAdmin));

// Get user statistics (admin)
router.get('/admin/statistics', jwtAuth(), isAdmin, asyncHandler(userController.getUserStatistics));

// Export all user data (admin)
router.get('/admin/export', jwtAuth(), isAdmin, asyncHandler(userController.exportAllUserData));

// Moderation routes

// Report user
router.post('/:id/report', jwtAuth(), asyncHandler(userController.reportUser));

// Get user reports (moderator)
router.get('/:id/reports', jwtAuth(), checkRole(['admin', 'moderator']), asyncHandler(userController.getUserReports));

// Relationship routes

// Follow user
router.post('/:id/follow', jwtAuth(), asyncHandler(userController.followUser));

// Unfollow user
router.delete('/:id/follow', jwtAuth(), asyncHandler(userController.unfollowUser));

// Block user
router.post('/:id/block', jwtAuth(), asyncHandler(userController.blockUser));

// Unblock user
router.delete('/:id/block', jwtAuth(), asyncHandler(userController.unblockUser));

// Get user followers
router.get('/:id/followers', asyncHandler(userController.getUserFollowers));

// Get user following
router.get('/:id/following', asyncHandler(userController.getUserFollowing));

// Get user blocks
router.get('/:id/blocks', jwtAuth(), checkOwnership(User), asyncHandler(userController.getUserBlocks));

// Check if current user follows another user
router.get('/:id/follow/check', jwtAuth(), asyncHandler(userController.checkFollow));

// Check if current user blocks another user
router.get('/:id/block/check', jwtAuth(), asyncHandler(userController.checkBlock));

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'user',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
