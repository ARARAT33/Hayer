const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profile.controller');
const { jwtAuth, isAdmin, checkRole, checkPermission, checkOwnership } = require('../middleware/authentication');
const { asyncHandler } = require('../middleware/errorHandler');
const rateLimit = require('express-rate-limit');
const config = require('../config');

// Rate limiting for profile routes
const profileLimiter = rateLimit({
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

// Get public profile by user ID
router.get('/:userId', asyncHandler(profileController.getPublicProfileByUserId));

// Get public profile by username
router.get('/username/:username', asyncHandler(profileController.getPublicProfileByUsername));

// Get public profile by HAYER ID
router.get('/hayer/:hayerId', asyncHandler(profileController.getPublicProfileByHayerId));

// Search profiles
router.get('/search', asyncHandler(profileController.searchProfiles));

// Authenticated routes (require JWT)

// Get current user's profile
router.get('/me', jwtAuth(), asyncHandler(profileController.getCurrentUserProfile));

// Create profile (if doesn't exist)
router.post('/me', jwtAuth(), asyncHandler(profileController.createProfile));

// Update profile
router.patch('/me', jwtAuth(), asyncHandler(profileController.updateProfile));

// Update profile picture
router.post('/me/picture', jwtAuth(), asyncHandler(profileController.updateProfilePicture));

// Remove profile picture
router.delete('/me/picture', jwtAuth(), asyncHandler(profileController.removeProfilePicture));

// Update profile banner
router.post('/me/banner', jwtAuth(), asyncHandler(profileController.updateProfileBanner));

// Remove profile banner
router.delete('/me/banner', jwtAuth(), asyncHandler(profileController.removeProfileBanner));

// Update profile bio
router.patch('/me/bio', jwtAuth(), asyncHandler(profileController.updateProfileBio));

// Update profile social links
router.patch('/me/social', jwtAuth(), asyncHandler(profileController.updateProfileSocialLinks));

// Update profile preferences
router.patch('/me/preferences', jwtAuth(), asyncHandler(profileController.updateProfilePreferences));

// Update profile privacy settings
router.patch('/me/privacy', jwtAuth(), asyncHandler(profileController.updateProfilePrivacySettings));

// Get profile visibility
router.get('/me/visibility', jwtAuth(), asyncHandler(profileController.getProfileVisibility));

// Update profile visibility
router.patch('/me/visibility', jwtAuth(), asyncHandler(profileController.updateProfileVisibility));

// Get profile followers
router.get('/me/followers', jwtAuth(), asyncHandler(profileController.getProfileFollowers));

// Get profile following
router.get('/me/following', jwtAuth(), asyncHandler(profileController.getProfileFollowing));

// Get profile blocks
router.get('/me/blocks', jwtAuth(), asyncHandler(profileController.getProfileBlocks));

// Get profile activity
router.get('/me/activity', jwtAuth(), asyncHandler(profileController.getProfileActivity));

// Get profile statistics
router.get('/me/statistics', jwtAuth(), asyncHandler(profileController.getProfileStatistics));

// Export profile data
router.get('/me/export', jwtAuth(), asyncHandler(profileController.exportProfileData));

// Delete profile
router.delete('/me', jwtAuth(), asyncHandler(profileController.deleteProfile));

// Admin routes (require admin privileges)

// List all profiles
router.get('/admin/list', jwtAuth(), isAdmin, asyncHandler(profileController.listAllProfiles));

// Get profile details (admin)
router.get('/admin/:userId', jwtAuth(), isAdmin, asyncHandler(profileController.getProfileDetails));

// Update profile (admin)
router.patch('/admin/:userId', jwtAuth(), isAdmin, asyncHandler(profileController.updateProfileAdmin));

// Delete profile (admin)
router.delete('/admin/:userId', jwtAuth(), isAdmin, asyncHandler(profileController.deleteProfileAdmin));

// Search profiles (admin)
router.get('/admin/search', jwtAuth(), isAdmin, asyncHandler(profileController.searchProfilesAdmin));

// Get profile statistics (admin)
router.get('/admin/statistics', jwtAuth(), isAdmin, asyncHandler(profileController.getProfileStatisticsAdmin));

// Export all profile data (admin)
router.get('/admin/export', jwtAuth(), isAdmin, asyncHandler(profileController.exportAllProfileData));

// Profile moderation routes

// Report profile
router.post('/:userId/report', jwtAuth(), asyncHandler(profileController.reportProfile));

// Get profile reports (moderator)
router.get('/:userId/reports', jwtAuth(), checkRole(['admin', 'moderator']), asyncHandler(profileController.getProfileReports));

// Verify profile (moderator)
router.patch('/:userId/verify', jwtAuth(), checkRole(['admin', 'moderator']), asyncHandler(profileController.verifyProfile));

// Unverify profile (moderator)
router.patch('/:userId/unverify', jwtAuth(), checkRole(['admin', 'moderator']), asyncHandler(profileController.unverifyProfile));

// Feature profile (moderator)
router.patch('/:userId/feature', jwtAuth(), checkRole(['admin', 'moderator']), asyncHandler(profileController.featureProfile));

// Unfeature profile (moderator)
router.patch('/:userId/unfeature', jwtAuth(), checkRole(['admin', 'moderator']), asyncHandler(profileController.unfeatureProfile));

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'profile',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
