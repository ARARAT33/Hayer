const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const { jwtAuth, isAdmin, checkRole, checkPermission, checkOwnership } = require('../middleware/authentication');
const { asyncHandler } = require('../middleware/errorHandler');
const rateLimit = require('express-rate-limit');
const config = require('../config');

// Rate limiting for notification routes
const notificationLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: 50,
  message: {
    error: true,
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests. Please try again later.',
    timestamp: new Date().toISOString()
  }
});

// Authenticated routes (require JWT)

// Get all notifications for current user
router.get('/', jwtAuth(), asyncHandler(notificationController.getAllNotifications));

// Get unread notifications
router.get('/unread', jwtAuth(), asyncHandler(notificationController.getUnreadNotifications));

// Get notification by ID
router.get('/:notificationId', jwtAuth(), asyncHandler(notificationController.getNotificationById));

// Mark notification as read
router.patch('/:notificationId/read', jwtAuth(), asyncHandler(notificationController.markNotificationAsRead));

// Mark all notifications as read
router.patch('/read/all', jwtAuth(), asyncHandler(notificationController.markAllNotificationsAsRead));

// Mark notification as unread
router.patch('/:notificationId/unread', jwtAuth(), asyncHandler(notificationController.markNotificationAsUnread));

// Archive notification
router.patch('/:notificationId/archive', jwtAuth(), asyncHandler(notificationController.archiveNotification));

// Unarchive notification
router.patch('/:notificationId/unarchive', jwtAuth(), asyncHandler(notificationController.unarchiveNotification));

// Delete notification
router.delete('/:notificationId', jwtAuth(), asyncHandler(notificationController.deleteNotification));

// Delete all notifications
router.delete('/', jwtAuth(), asyncHandler(notificationController.deleteAllNotifications));

// Delete all read notifications
router.delete('/read', jwtAuth(), asyncHandler(notificationController.deleteAllReadNotifications));

// Get notification count
router.get('/count', jwtAuth(), asyncHandler(notificationController.getNotificationCount));

// Get unread notification count
router.get('/count/unread', jwtAuth(), asyncHandler(notificationController.getUnreadNotificationCount));

// Get notification preferences
router.get('/preferences', jwtAuth(), asyncHandler(notificationController.getNotificationPreferences));

// Update notification preferences
router.patch('/preferences', jwtAuth(), asyncHandler(notificationController.updateNotificationPreferences));

// Test notification
router.post('/test', jwtAuth(), asyncHandler(notificationController.testNotification));

// Subscribe to notifications
router.post('/subscribe', jwtAuth(), asyncHandler(notificationController.subscribeToNotifications));

// Unsubscribe from notifications
router.post('/unsubscribe', jwtAuth(), asyncHandler(notificationController.unsubscribeFromNotifications));

// Get notification channels
router.get('/channels', jwtAuth(), asyncHandler(notificationController.getNotificationChannels));

// Update notification channel settings
router.patch('/channels/:channelId', jwtAuth(), asyncHandler(notificationController.updateNotificationChannelSettings));

// Admin routes (require admin privileges)

// List all notifications
router.get('/admin/list', jwtAuth(), isAdmin, asyncHandler(notificationController.listAllNotifications));

// Get notification details (admin)
router.get('/admin/:notificationId', jwtAuth(), isAdmin, asyncHandler(notificationController.getNotificationDetails));

// Create notification (admin)
router.post('/admin', jwtAuth(), isAdmin, asyncHandler(notificationController.createNotification));

// Update notification (admin)
router.patch('/admin/:notificationId', jwtAuth(), isAdmin, asyncHandler(notificationController.updateNotification));

// Delete notification (admin)
router.delete('/admin/:notificationId', jwtAuth(), isAdmin, asyncHandler(notificationController.deleteNotificationAdmin));

// Send notification to user (admin)
router.post('/admin/send', jwtAuth(), isAdmin, asyncHandler(notificationController.sendNotification));

// Broadcast notification (admin)
router.post('/admin/broadcast', jwtAuth(), isAdmin, asyncHandler(notificationController.broadcastNotification));

// Get notification statistics (admin)
router.get('/admin/statistics', jwtAuth(), isAdmin, asyncHandler(notificationController.getNotificationStatistics));

// Search notifications (admin)
router.get('/admin/search', jwtAuth(), isAdmin, asyncHandler(notificationController.searchNotifications));

// Export notifications (admin)
router.get('/admin/export', jwtAuth(), isAdmin, asyncHandler(notificationController.exportNotifications));

// Notification template routes (admin)

// List notification templates
router.get('/admin/templates', jwtAuth(), isAdmin, asyncHandler(notificationController.listNotificationTemplates));

// Get notification template
router.get('/admin/templates/:templateId', jwtAuth(), isAdmin, asyncHandler(notificationController.getNotificationTemplate));

// Create notification template
router.post('/admin/templates', jwtAuth(), isAdmin, asyncHandler(notificationController.createNotificationTemplate));

// Update notification template
router.patch('/admin/templates/:templateId', jwtAuth(), isAdmin, asyncHandler(notificationController.updateNotificationTemplate));

// Delete notification template
router.delete('/admin/templates/:templateId', jwtAuth(), isAdmin, asyncHandler(notificationController.deleteNotificationTemplate));

// Test notification template
router.post('/admin/templates/:templateId/test', jwtAuth(), isAdmin, asyncHandler(notificationController.testNotificationTemplate));

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'notification',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
