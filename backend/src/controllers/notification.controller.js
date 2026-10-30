/**
 * Notification Controller
 * Handles notification management endpoints
 */

const notificationService = require('../services/notification.service');
const { 
  AuthenticationError, 
  AuthorizationError,
  ValidationError,
  NotFoundError,
  ConflictError
} = require('../middleware/errorHandler');
const { extractUserFromRequest, checkPermission } = require('../middleware/authentication');

/**
 * Create a new notification
 */
const createNotification = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { 
      type,
      title,
      message,
      data = {},
      priority = 'normal',
      relatedEntityType = null,
      relatedEntityId = null,
      expiresAt = null
    } = req.body;
    
    const notification = await notificationService.createNotification(user.id, {
      type,
      title,
      message,
      data,
      priority,
      relatedEntityType,
      relatedEntityId,
      expiresAt
    }, {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.status(201).json({
      success: true,
      data: notification
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get notification by ID
 */
const getNotification = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { notificationId } = req.params;
    
    const notification = await notificationService.getNotificationById(
      user.id,
      notificationId,
      {
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        requestId: req.requestId
      }
    );
    
    res.json({
      success: true,
      data: notification
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List notifications
 */
const listNotifications = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { 
      isRead = null,
      type = null,
      priority = null,
      relatedEntityType = null,
      limit = 20,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;
    
    const result = await notificationService.listNotifications(user.id, {
      isRead: isRead === 'true' ? true : isRead === 'false' ? false : null,
      type,
      priority,
      relatedEntityType,
      limit: parseInt(limit),
      offset: parseInt(offset),
      sortBy,
      sortOrder,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark notification as read
 */
const markNotificationAsRead = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { notificationId } = req.params;
    
    const notification = await notificationService.markNotificationAsRead(
      user.id,
      notificationId,
      {
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        requestId: req.requestId
      }
    );
    
    res.json({
      success: true,
      data: notification
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark all notifications as read
 */
const markAllNotificationsAsRead = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const result = await notificationService.markAllNotificationsAsRead(user.id, {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete notification
 */
const deleteNotification = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { notificationId } = req.params;
    
    const result = await notificationService.deleteNotification(user.id, notificationId, {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete all notifications
 */
const deleteAllNotifications = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const result = await notificationService.deleteAllNotifications(user.id, {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get unread notification count
 */
const getUnreadNotificationCount = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const result = await notificationService.getUnreadNotificationCount(user.id, {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get notification statistics
 */
const getNotificationStats = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const stats = await notificationService.getNotificationStats(user.id, {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Search notifications
 */
const searchNotifications = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { query } = req.query;
    const { limit = 20, offset = 0 } = req.query;
    
    const result = await notificationService.searchNotifications(
      user.id,
      query,
      {
        limit: parseInt(limit),
        offset: parseInt(offset),
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        requestId: req.requestId
      }
    );
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get notification preferences
 */
const getNotificationPreferences = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const preferences = await notificationService.getNotificationPreferences(user.id, {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      data: preferences
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update notification preferences
 */
const updateNotificationPreferences = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const preferences = req.body;
    
    const updatedPreferences = await notificationService.updateNotificationPreferences(
      user.id,
      preferences,
      {
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        requestId: req.requestId
      }
    );
    
    res.json({
      success: true,
      data: updatedPreferences
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get recent notifications
 */
const getRecentNotifications = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { limit = 5 } = req.query;
    
    const notifications = await notificationService.getRecentNotifications(user.id, {
      limit: parseInt(limit),
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      data: notifications
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get notification types
 */
const getNotificationTypes = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    
    const types = await notificationService.getNotificationTypes();
    
    res.json({
      success: true,
      data: types
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Clean up expired notifications (admin only)
 */
const cleanupExpiredNotifications = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    // Check admin role
    const hasPermission = await checkPermission(user, 'notification', 'manage', 'all');
    if (!hasPermission) {
      throw new AuthorizationError('Admin permissions required');
    }
    
    const result = await notificationService.cleanupExpiredNotifications({
      userId: user.id,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Export notifications
 */
const exportNotifications = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { 
      isRead = null,
      type = null,
      limit = 1000,
      offset = 0
    } = req.query;
    
    const notifications = await notificationService.exportNotifications(user.id, {
      isRead: isRead === 'true' ? true : isRead === 'false' ? false : null,
      type,
      limit: parseInt(limit),
      offset: parseInt(offset),
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      data: notifications
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send test notification
 */
const sendTestNotification = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const notification = await notificationService.sendNotification(
      user.id,
      {
        type: 'test',
        title: 'Test Notification',
        message: 'This is a test notification to verify your notification settings.',
        priority: 'normal',
        sendEmail: true,
        sendPush: true
      },
      {
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        requestId: req.requestId
      }
    );
    
    res.json({
      success: true,
      data: notification,
      message: 'Test notification sent'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createNotification,
  getNotification,
  listNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  deleteAllNotifications,
  getUnreadNotificationCount,
  getNotificationStats,
  searchNotifications,
  getNotificationPreferences,
  updateNotificationPreferences,
  getRecentNotifications,
  getNotificationTypes,
  cleanupExpiredNotifications,
  exportNotifications,
  sendTestNotification
};
