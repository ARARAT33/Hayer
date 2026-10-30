const express = require('express');
const router = express.Router();
const communityController = require('../controllers/community.controller');
const { jwtAuth, isAdmin, checkRole, checkPermission, checkOwnership } = require('../middleware/authentication');
const { asyncHandler } = require('../middleware/errorHandler');
const rateLimit = require('express-rate-limit');
const config = require('../config');

// Rate limiting for community routes
const communityLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: 30,
  message: {
    error: true,
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests. Please try again later.',
    timestamp: new Date().toISOString()
  }
});

// Public routes

// List public communities
router.get('/', asyncHandler(communityController.listPublicCommunities));

// Get community by ID
router.get('/:communityId', asyncHandler(communityController.getCommunityById));

// Get community by name
router.get('/name/:name', asyncHandler(communityController.getCommunityByName));

// Search communities
router.get('/search', asyncHandler(communityController.searchCommunities));

// Get community categories
router.get('/categories', asyncHandler(communityController.getCommunityCategories));

// Get featured communities
router.get('/featured', asyncHandler(communityController.getFeaturedCommunities));

// Get popular communities
router.get('/popular', asyncHandler(communityController.getPopularCommunities));

// Get recent communities
router.get('/recent', asyncHandler(communityController.getRecentCommunities));

// Get community members count
router.get('/:communityId/members/count', asyncHandler(communityController.getCommunityMembersCount));

// Get community posts count
router.get('/:communityId/posts/count', asyncHandler(communityController.getCommunityPostsCount));

// Authenticated routes (require JWT)

// Create community
router.post('/', jwtAuth(), asyncHandler(communityController.createCommunity));

// Get current user's communities
router.get('/me', jwtAuth(), asyncHandler(communityController.getCurrentUserCommunities));

// Get communities user owns
router.get('/me/owned', jwtAuth(), asyncHandler(communityController.getOwnedCommunities));

// Get communities user moderates
router.get('/me/moderated', jwtAuth(), asyncHandler(communityController.getModeratedCommunities));

// Get communities user is member of
router.get('/me/member', jwtAuth(), asyncHandler(communityController.getMemberCommunities));

// Get community details
router.get('/me/:communityId', jwtAuth(), asyncHandler(communityController.getCommunityDetails));

// Update community
router.patch('/me/:communityId', jwtAuth(), checkOwnership(communityController.Community), asyncHandler(communityController.updateCommunity));

// Update community settings
router.patch('/me/:communityId/settings', jwtAuth(), checkOwnership(communityController.Community), asyncHandler(communityController.updateCommunitySettings));

// Upload community icon
router.post('/me/:communityId/icon', jwtAuth(), checkOwnership(communityController.Community), asyncHandler(communityController.uploadCommunityIcon));

// Remove community icon
router.delete('/me/:communityId/icon', jwtAuth(), checkOwnership(communityController.Community), asyncHandler(communityController.removeCommunityIcon));

// Upload community banner
router.post('/me/:communityId/banner', jwtAuth(), checkOwnership(communityController.Community), asyncHandler(communityController.uploadCommunityBanner));

// Remove community banner
router.delete('/me/:communityId/banner', jwtAuth(), checkOwnership(communityController.Community), asyncHandler(communityController.removeCommunityBanner));

// Delete community
router.delete('/me/:communityId', jwtAuth(), checkOwnership(communityController.Community), asyncHandler(communityController.deleteCommunity));

// Join community
router.post('/:communityId/join', jwtAuth(), asyncHandler(communityController.joinCommunity));

// Leave community
router.post('/:communityId/leave', jwtAuth(), asyncHandler(communityController.leaveCommunity));

// Request to join community (private/invite-only)
router.post('/:communityId/request-join', jwtAuth(), asyncHandler(communityController.requestJoinCommunity));

// Cancel join request
router.delete('/:communityId/request-join', jwtAuth(), asyncHandler(communityController.cancelJoinRequest));

// Get community members
router.get('/:communityId/members', jwtAuth(), asyncHandler(communityController.getCommunityMembers));

// Get community member
router.get('/:communityId/members/:userId', jwtAuth(), asyncHandler(communityController.getCommunityMember));

// Update community member role
router.patch('/:communityId/members/:userId/role', jwtAuth(), asyncHandler(communityController.updateCommunityMemberRole));

// Remove community member
router.delete('/:communityId/members/:userId', jwtAuth(), asyncHandler(communityController.removeCommunityMember));

// Ban community member
router.post('/:communityId/members/:userId/ban', jwtAuth(), asyncHandler(communityController.banCommunityMember));

// Unban community member
router.delete('/:communityId/members/:userId/ban', jwtAuth(), asyncHandler(communityController.unbanCommunityMember));

// Get community join requests
router.get('/:communityId/join-requests', jwtAuth(), asyncHandler(communityController.getCommunityJoinRequests));

// Approve join request
router.post('/:communityId/join-requests/:requestId/approve', jwtAuth(), asyncHandler(communityController.approveJoinRequest));

// Reject join request
router.post('/:communityId/join-requests/:requestId/reject', jwtAuth(), asyncHandler(communityController.rejectJoinRequest));

// Invite user to community
router.post('/:communityId/invite', jwtAuth(), asyncHandler(communityController.inviteUserToCommunity));

// Cancel invitation
router.delete('/:communityId/invite/:userId', jwtAuth(), asyncHandler(communityController.cancelInvitation));

// Get community invitations
router.get('/:communityId/invitations', jwtAuth(), asyncHandler(communityController.getCommunityInvitations));

// Accept invitation
router.post('/:communityId/invitations/:invitationId/accept', jwtAuth(), asyncHandler(communityController.acceptInvitation));

// Reject invitation
router.post('/:communityId/invitations/:invitationId/reject', jwtAuth(), asyncHandler(communityController.rejectInvitation));

// Get community statistics
router.get('/:communityId/statistics', jwtAuth(), asyncHandler(communityController.getCommunityStatistics));

// Get community activity
router.get('/:communityId/activity', jwtAuth(), asyncHandler(communityController.getCommunityActivity));

// Get community settings
router.get('/:communityId/settings', jwtAuth(), asyncHandler(communityController.getCommunitySettings));

// Update community rules
router.patch('/:communityId/rules', jwtAuth(), checkOwnership(communityController.Community), asyncHandler(communityController.updateCommunityRules));

// Update community guidelines
router.patch('/:communityId/guidelines', jwtAuth(), checkOwnership(communityController.Community), asyncHandler(communityController.updateCommunityGuidelines));

// Update community welcome message
router.patch('/:communityId/welcome', jwtAuth(), checkOwnership(communityController.Community), asyncHandler(communityController.updateCommunityWelcomeMessage));

// Community post routes

// Create post in community
router.post('/:communityId/posts', jwtAuth(), asyncHandler(communityController.createCommunityPost));

// Get community posts
router.get('/:communityId/posts', asyncHandler(communityController.getCommunityPosts));

// Get community post
router.get('/:communityId/posts/:postId', asyncHandler(communityController.getCommunityPost));

// Update community post
router.patch('/:communityId/posts/:postId', jwtAuth(), asyncHandler(communityController.updateCommunityPost));

// Delete community post
router.delete('/:communityId/posts/:postId', jwtAuth(), asyncHandler(communityController.deleteCommunityPost));

// Pin community post
router.post('/:communityId/posts/:postId/pin', jwtAuth(), asyncHandler(communityController.pinCommunityPost));

// Unpin community post
router.delete('/:communityId/posts/:postId/pin', jwtAuth(), asyncHandler(communityController.unpinCommunityPost));

// Lock community post
router.post('/:communityId/posts/:postId/lock', jwtAuth(), asyncHandler(communityController.lockCommunityPost));

// Unlock community post
router.delete('/:communityId/posts/:postId/lock', jwtAuth(), asyncHandler(communityController.unlockCommunityPost));

// Community comment routes

// Add comment to post
router.post('/:communityId/posts/:postId/comments', jwtAuth(), asyncHandler(communityController.addCommentToPost));

// Get post comments
router.get('/:communityId/posts/:postId/comments', asyncHandler(communityController.getPostComments));

// Get comment
router.get('/:communityId/posts/:postId/comments/:commentId', asyncHandler(communityController.getComment));

// Update comment
router.patch('/:communityId/posts/:postId/comments/:commentId', jwtAuth(), asyncHandler(communityController.updateComment));

// Delete comment
router.delete('/:communityId/posts/:postId/comments/:commentId', jwtAuth(), asyncHandler(communityController.deleteComment));

// Community reaction routes

// Add reaction to post
router.post('/:communityId/posts/:postId/reactions', jwtAuth(), asyncHandler(communityController.addReactionToPost));

// Remove reaction from post
router.delete('/:communityId/posts/:postId/reactions/:reaction', jwtAuth(), asyncHandler(communityController.removeReactionFromPost));

// Get post reactions
router.get('/:communityId/posts/:postId/reactions', asyncHandler(communityController.getPostReactions));

// Add reaction to comment
router.post('/:communityId/posts/:postId/comments/:commentId/reactions', jwtAuth(), asyncHandler(communityController.addReactionToComment));

// Remove reaction from comment
router.delete('/:communityId/posts/:postId/comments/:commentId/reactions/:reaction', jwtAuth(), asyncHandler(communityController.removeReactionFromComment));

// Admin routes (require admin privileges)

// List all communities
router.get('/admin/list', jwtAuth(), isAdmin, asyncHandler(communityController.listAllCommunities));

// Get community details (admin)
router.get('/admin/:communityId', jwtAuth(), isAdmin, asyncHandler(communityController.getCommunityDetailsAdmin));

// Update community (admin)
router.patch('/admin/:communityId', jwtAuth(), isAdmin, asyncHandler(communityController.updateCommunityAdmin));

// Delete community (admin)
router.delete('/admin/:communityId', jwtAuth(), isAdmin, asyncHandler(communityController.deleteCommunityAdmin));

// Verify community (admin)
router.patch('/admin/:communityId/verify', jwtAuth(), isAdmin, asyncHandler(communityController.verifyCommunity));

// Unverify community (admin)
router.patch('/admin/:communityId/unverify', jwtAuth(), isAdmin, asyncHandler(communityController.unverifyCommunity));

// Feature community (admin)
router.patch('/admin/:communityId/feature', jwtAuth(), isAdmin, asyncHandler(communityController.featureCommunity));

// Unfeature community (admin)
router.patch('/admin/:communityId/unfeature', jwtAuth(), isAdmin, asyncHandler(communityController.unfeatureCommunity));

// Suspend community (admin)
router.patch('/admin/:communityId/suspend', jwtAuth(), isAdmin, asyncHandler(communityController.suspendCommunity));

// Unsuspend community (admin)
router.patch('/admin/:communityId/unsuspend', jwtAuth(), isAdmin, asyncHandler(communityController.unsuspendCommunity));

// Search communities (admin)
router.get('/admin/search', jwtAuth(), isAdmin, asyncHandler(communityController.searchCommunitiesAdmin));

// Get community statistics (admin)
router.get('/admin/statistics', jwtAuth(), isAdmin, asyncHandler(communityController.getCommunityStatisticsAdmin));

// Export community data (admin)
router.get('/admin/export', jwtAuth(), isAdmin, asyncHandler(communityController.exportCommunityData));

// Community moderation routes

// Report community
router.post('/:communityId/report', jwtAuth(), asyncHandler(communityController.reportCommunity));

// Report post
router.post('/:communityId/posts/:postId/report', jwtAuth(), asyncHandler(communityController.reportPost));

// Report comment
router.post('/:communityId/posts/:postId/comments/:commentId/report', jwtAuth(), asyncHandler(communityController.reportComment));

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'community',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
