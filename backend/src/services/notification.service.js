/**
 * Notification Service
 * Manages user notifications, preferences, and delivery
 */

const { Op } = require('sequelize');
const config = require('../config');
const { Notification, User, AuditEvent } = require('../models');
const { 
  NotFoundError, 
  ConflictError,
  ValidationError,
  AuthenticationError,
  AuthorizationError
} = require('../middleware/errorHandler');

/**
 * Generate unique notification ID
 */
const generateNotificationId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return `NOTIF-${Array.from({ length: 16 }, () => 
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join('')}`;
};

/**
 * Create a new notification
 */
const createNotification = async (userId, data, options = {}) => {
  const { 
    type,
    title,
    message,
    data: notificationData = {},
    priority = 'normal',
    relatedEntityType = null,
    relatedEntityId = null,
    expiresAt = null,
    userAgent = null,
    ipAddress = null,
    requestId = null
  } = data;
  
  // Validate user
  const user = await User.findByPk(userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  
  // Validate required fields
  if (!type || !title || !message) {
    throw new ValidationError('Type, title, and message are required');
  }
  
  // Validate priority
  const validPriorities = ['low', 'normal', 'high', 'urgent'];
  if (!validPriorities.includes(priority)) {
    throw new ValidationError(`Invalid priority. Must be one of: ${validPriorities.join(', ')}`);
  }
  
  // Set expiration if not provided
  const defaultExpiration = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  const expirationDate = expiresAt ? new Date(expiresAt) : defaultExpiration;
  
  // Generate notification ID
  const notificationId = generateNotificationId();
  
  // Create notification
  const notification = await Notification.create({
    userId,
    notificationId,
    type,
    title,
    message,
    data: notificationData,
    priority,
    relatedEntityType,
    relatedEntityId,
    isRead: false,
    expiresAt: expirationDate
  });
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'notification.create',
    entityType: 'notification',
    entityId: notification.id,
    metadata: {
      notificationId: notification.notificationId,
      type,
      title,
      priority
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return notification;
};

/**
 * Get notification by ID
 */
const getNotificationById = async (userId, notificationId, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const notification = await Notification.findOne({
    where: { notificationId, userId }
  });
  
  if (!notification) {
    throw new NotFoundError('Notification not found');
  }
  
  // Log access
  await AuditEvent.create({
    userId,
    action: 'notification.access',
    entityType: 'notification',
    entityId: notification.id,
    metadata: {
      notificationId: notification.notificationId
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return notification;
};

/**
 * Get notification by ID (short version)
 */
const getNotification = async (id) => {
  const notification = await Notification.findByPk(id);
  
  if (!notification) {
    throw new NotFoundError('Notification not found');
  }
  
  return notification;
};

/**
 * List notifications for user
 */
const listNotifications = async (userId, options = {}) => {
  const { 
    isRead = null,
    type = null,
    priority = null,
    relatedEntityType = null,
    limit = 20,
    offset = 0,
    sortBy = 'createdAt',
    sortOrder = 'DESC',
    userAgent = null,
    ipAddress = null,
    requestId = null
  } = options;
  
  const where = { userId };
  
  if (isRead !== null) where.isRead = isRead;
  if (type) where.type = type;
  if (priority) where.priority = priority;
  if (relatedEntityType) where.relatedEntityType = relatedEntityType;
  
  // Filter out expired notifications
  where.expiresAt = { [Op.gt]: new Date() };
  
  const order = [[sortBy, sortOrder]];
  
  const result = await Notification.findAndCountAll({
    where,
    limit,
    offset,
    order
  });
  
  // Log access
  await AuditEvent.create({
    userId,
    action: 'notification.list',
    entityType: 'notification',
    metadata: {
      filters: { isRead, type, priority, relatedEntityType },
      results: result.count
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return {
    data: result.rows,
    pagination: {
      total: result.count,
      limit,
      offset,
      hasMore: offset + limit < result.count
    }
  };
};

/**
 * Mark notification as read
 */
const markNotificationAsRead = async (userId, notificationId, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const notification = await Notification.findOne({
    where: { notificationId, userId }
  });
  
  if (!notification) {
    throw new NotFoundError('Notification not found');
  }
  
  if (notification.isRead) {
    throw new ConflictError('Notification is already read');
  }
  
  await notification.update({ isRead: true });
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'notification.mark_read',
    entityType: 'notification',
    entityId: notification.id,
    metadata: {
      notificationId: notification.notificationId
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return notification;
};

/**
 * Mark all notifications as read
 */
const markAllNotificationsAsRead = async (userId, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const result = await Notification.update(
    { isRead: true },
    { where: { userId, isRead: false, expiresAt: { [Op.gt]: new Date() } } }
  );
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'notification.mark_all_read',
    entityType: 'notification',
    metadata: {
      updated: result[0]
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return { success: true, updated: result[0] };
};

/**
 * Delete notification
 */
const deleteNotification = async (userId, notificationId, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const notification = await Notification.findOne({
    where: { notificationId, userId }
  });
  
  if (!notification) {
    throw new NotFoundError('Notification not found');
  }
  
  await notification.destroy();
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'notification.delete',
    entityType: 'notification',
    entityId: notification.id,
    metadata: {
      notificationId: notification.notificationId
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return { success: true, message: 'Notification deleted' };
};

/**
 * Delete all notifications for user
 */
const deleteAllNotifications = async (userId, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const result = await Notification.destroy({
    where: { userId }
  });
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'notification.delete_all',
    entityType: 'notification',
    metadata: {
      deleted: result
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return { success: true, deleted: result };
};

/**
 * Get unread notification count
 */
const getUnreadNotificationCount = async (userId, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const count = await Notification.count({
    where: {
      userId,
      isRead: false,
      expiresAt: { [Op.gt]: new Date() }
    }
  });
  
  // Log access
  await AuditEvent.create({
    userId,
    action: 'notification.count_unread',
    entityType: 'notification',
    metadata: {
      count
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return { count };
};

/**
 * Get notification statistics for user
 */
const getNotificationStats = async (userId, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const total = await Notification.count({ where: { userId, expiresAt: { [Op.gt]: new Date() } } });
  const unread = await Notification.count({ where: { userId, isRead: false, expiresAt: { [Op.gt]: new Date() } } });
  const highPriority = await Notification.count({ where: { userId, priority: { [Op.in]: ['high', 'urgent'] }, expiresAt: { [Op.gt]: new Date() } } });
  
  // Get type counts
  const types = await Notification.findAll({
    where: { userId, expiresAt: { [Op.gt]: new Date() } },
    attributes: ['type'],
    group: ['type']
  });
  
  const typeCounts = {};
  for (const type of types) {
    typeCounts[type.type] = await Notification.count({
      where: { userId, type: type.type, expiresAt: { [Op.gt]: new Date() } }
    });
  }
  
  const stats = {
    total,
    unread,
    highPriority,
    typeCounts
  };
  
  // Log access
  await AuditEvent.create({
    userId,
    action: 'notification.stats',
    entityType: 'notification',
    metadata: {
      stats
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return stats;
};

/**
 * Search notifications
 */
const searchNotifications = async (userId, query, options = {}) => {
  const { 
    limit = 20,
    offset = 0,
    userAgent = null,
    ipAddress = null,
    requestId = null
  } = options;
  
  const where = {
    userId,
    expiresAt: { [Op.gt]: new Date() },
    [Op.or]: [
      { type: { [Op.iLike]: `%${query}%` } },
      { title: { [Op.iLike]: `%${query}%` } },
      { message: { [Op.iLike]: `%${query}%` } }
    ]
  };
  
  const result = await Notification.findAndCountAll({
    where,
    limit,
    offset,
    order: [['createdAt', 'DESC']]
  });
  
  // Log search
  await AuditEvent.create({
    userId,
    action: 'notification.search',
    entityType: 'notification',
    metadata: {
      query,
      results: result.count
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return {
    data: result.rows,
    pagination: {
      total: result.count,
      limit,
      offset,
      hasMore: offset + limit < result.count
    }
  };
};

/**
 * Get notification preferences for user
 */
const getNotificationPreferences = async (userId, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const user = await User.findByPk(userId);
  
  if (!user) {
    throw new NotFoundError('User not found');
  }
  
  const preferences = user.preferences?.notifications || {
    email: true,
    push: true,
    types: {}
  };
  
  // Log access
  await AuditEvent.create({
    userId,
    action: 'notification.preferences.get',
    entityType: 'user',
    entityId: user.id,
    metadata: {
      preferences
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return preferences;
};

/**
 * Update notification preferences
 */
const updateNotificationPreferences = async (userId, preferences, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const user = await User.findByPk(userId);
  
  if (!user) {
    throw new NotFoundError('User not found');
  }
  
  const oldPreferences = user.preferences?.notifications || {};
  
  await user.update({
    preferences: {
      ...user.preferences,
      notifications: preferences
    }
  });
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'notification.preferences.update',
    entityType: 'user',
    entityId: user.id,
    metadata: {
      changes: {
        old: oldPreferences,
        new: preferences
      }
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return user.preferences.notifications;
};

/**
 * Send notification to user
 */
const sendNotification = async (userId, data, options = {}) => {
  const { 
    type,
    title,
    message,
    data: notificationData = {},
    priority = 'normal',
    relatedEntityType = null,
    relatedEntityId = null,
    expiresAt = null,
    userAgent = null,
    ipAddress = null,
    requestId = null,
    sendEmail = true,
    sendPush = true
  } = data;
  
  // Create notification
  const notification = await createNotification(userId, {
    type,
    title,
    message,
    data: notificationData,
    priority,
    relatedEntityType,
    relatedEntityId,
    expiresAt
  }, {
    userAgent,
    ipAddress,
    requestId
  });
  
  // Get user preferences
  const user = await User.findByPk(userId);
  const preferences = user?.preferences?.notifications || {};
  
  // Send email if enabled
  if (sendEmail && preferences.email !== false) {
    // In production, send actual email
    console.log(`Email notification sent to user ${userId}: ${title}`);
  }
  
  // Send push notification if enabled
  if (sendPush && preferences.push !== false) {
    // In production, send actual push notification
    console.log(`Push notification sent to user ${userId}: ${title}`);
  }
  
  return notification;
};

/**
 * Send bulk notifications
 */
const sendBulkNotifications = async (userIds, data, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const notifications = [];
  
  for (const userId of userIds) {
    try {
      const notification = await createNotification(userId, data, {
        userAgent,
        ipAddress,
        requestId
      });
      notifications.push(notification);
    } catch (error) {
      console.error(`Failed to create notification for user ${userId}:`, error);
    }
  }
  
  // Log to audit trail
  await AuditEvent.create({
    userId: null,
    action: 'notification.bulk_send',
    entityType: 'notification',
    metadata: {
      userIds: userIds.length,
      created: notifications.length,
      type: data.type
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return {
    success: true,
    created: notifications.length,
    failed: userIds.length - notifications.length,
    notifications
  };
};

/**
 * Get recent notifications
 */
const getRecentNotifications = async (userId, options = {}) => {
  const { 
    limit = 5,
    userAgent = null,
    ipAddress = null,
    requestId = null
  } = options;
  
  const notifications = await Notification.findAll({
    where: {
      userId,
      expiresAt: { [Op.gt]: new Date() }
    },
    limit,
    order: [['createdAt', 'DESC']]
  });
  
  // Log access
  await AuditEvent.create({
    userId,
    action: 'notification.recent',
    entityType: 'notification',
    metadata: {
      limit,
      results: notifications.length
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return notifications;
};

/**
 * Get notification types
 */
const getNotificationTypes = async () => {
  const notifications = await Notification.findAll({
    attributes: ['type'],
    group: ['type']
  });
  
  return notifications.map(n => n.type);
};

/**
 * Clean up expired notifications
 */
const cleanupExpiredNotifications = async (options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const result = await Notification.destroy({
    where: { expiresAt: { [Op.lte]: new Date() } }
  });
  
  // Log cleanup
  await AuditEvent.create({
    userId: null,
    action: 'notification.cleanup',
    entityType: 'notification',
    metadata: {
      deleted: result
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return { success: true, deleted: result };
};

/**
 * Export notifications
 */
const exportNotifications = async (userId, options = {}) => {
  const { 
    isRead = null,
    type = null,
    limit = 1000,
    offset = 0,
    userAgent = null,
    ipAddress = null,
    requestId = null
  } = options;
  
  const where = { userId, expiresAt: { [Op.gt]: new Date() } };
  
  if (isRead !== null) where.isRead = isRead;
  if (type) where.type = type;
  
  const notifications = await Notification.findAll({
    where,
    limit,
    offset,
    order: [['createdAt', 'DESC']]
  });
  
  // Log export
  await AuditEvent.create({
    userId,
    action: 'notification.export',
    entityType: 'notification',
    metadata: {
      filters: { isRead, type },
      exported: notifications.length
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return notifications;
};

module.exports = {
  generateNotificationId,
  createNotification,
  getNotificationById,
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
  sendNotification,
  sendBulkNotifications,
  getRecentNotifications,
  getNotificationTypes,
  cleanupExpiredNotifications,
  exportNotifications
};
