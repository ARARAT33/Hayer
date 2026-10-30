/**
 * User Controller for HAYER backend
 * Handles user management, profiles, and user-related operations
 */

const { Op } = require('sequelize');
const config = require('../config');
const { User, Profile, HayerId, Session, Community, AuditEvent } = require('../models');
const { 
  AuthenticationError, 
  AuthorizationError,
  ValidationError,
  NotFoundError,
  ConflictError,
  BadRequestError
} = require('../middleware/errorHandler');
const { hashPassword, verifyPassword, generateToken } = require('../middleware/authentication');
const { isValidEmail, isValidUsername, isValidDisplayName } = require('../utils/validation');

/**
 * Get user by ID (public profile)
 */
const getUserById = async (req, res) => {
  const { id } = req.params;
  
  const user = await User.findByPk(id, {
    include: [
      { model: Profile },
      { model: HayerId, where: { isPrimary: true } }
    ]
  });
  
  if (!user) {
    throw new NotFoundError('User not found');
  }
  
  // Return public profile
  res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      profile: user.Profile ? {
        bio: user.Profile.bio,
        avatar: user.Profile.avatar,
        banner: user.Profile.banner
      } : null,
      hayerId: user.HayerIds && user.HayerIds.length > 0 ? user.HayerIds[0].hayerId : null
    }
  });
};

/**
 * Get user by username (public profile)
 */
const getUserByUsername = async (req, res) => {
  const { username } = req.params;
  
  const user = await User.findOne({
    where: { username: username.toLowerCase() },
    include: [
      { model: Profile },
      { model: HayerId, where: { isPrimary: true } }
    ]
  });
  
  if (!user) {
    throw new NotFoundError('User not found');
  }
  
  // Return public profile
  res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      profile: user.Profile ? {
        bio: user.Profile.bio,
        avatar: user.Profile.avatar,
        banner: user.Profile.banner
      } : null,
      hayerId: user.HayerIds && user.HayerIds.length > 0 ? user.HayerIds[0].hayerId : null
    }
  });
};

/**
 * Get user by HAYER ID (public profile)
 */
const getUserByHayerId = async (req, res) => {
  const { hayerId } = req.params;
  
  const hayerIdObj = await HayerId.findOne({
    where: { hayerId },
    include: [
      {
        model: User,
        include: [
          { model: Profile },
          { model: HayerId, where: { isPrimary: true } }
        ]
      }
    ]
  });
  
  if (!hayerIdObj || !hayerIdObj.User) {
    throw new NotFoundError('User not found');
  }
  
  const user = hayerIdObj.User;
  
  // Return public profile
  res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      profile: user.Profile ? {
        bio: user.Profile.bio,
        avatar: user.Profile.avatar,
        banner: user.Profile.banner
      } : null,
      hayerId: user.HayerIds && user.HayerIds.length > 0 ? user.HayerIds[0].hayerId : null
    }
  });
};

/**
 * Search users
 */
const searchUsers = async (req, res) => {
  const { query, limit = 20, offset = 0 } = req.query;
  
  if (!query || query.length < 2) {
    throw new ValidationError('Search query must be at least 2 characters');
  }
  
  const users = await User.findAll({
    where: {
      [Op.or]: [
        { username: { [Op.iLike]: `%${query}%` } },
        { displayName: { [Op.iLike]: `%${query}%` } },
        { email: { [Op.iLike]: `%${query}%` } }
      ],
      isActive: true
    },
    include: [
      { model: Profile },
      { model: HayerId, where: { isPrimary: true } }
    ],
    limit: Math.min(limit, 100),
    offset,
    order: [['username', 'ASC']]
  });
  
  res.json({
    success: true,
    users: users.map(user => ({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      isVerified: user.isVerified,
      avatar: user.Profile?.avatar,
      hayerId: user.HayerIds && user.HayerIds.length > 0 ? user.HayerIds[0].hayerId : null
    })),
    total: users.length
  });
};

/**
 * Get current user profile
 */
const getCurrentUserProfile = async (req, res) => {
  const user = req.user;
  
  const userWithData = await User.findByPk(user.id, {
    include: [
      { model: Profile },
      { model: HayerId, where: { isPrimary: true } },
      { model: Community, as: 'ownedCommunities', where: { createdBy: user.id } },
      { model: Community, as: 'memberCommunities', through: { attributes: [] } }
    ]
  });
  
  res.json({
    success: true,
    user: {
      id: userWithData.id,
      email: userWithData.email,
      username: userWithData.username,
      displayName: userWithData.displayName,
      isVerified: userWithData.isVerified,
      isActive: userWithData.isActive,
      createdAt: userWithData.createdAt,
      lastLoginAt: userWithData.lastLoginAt,
      loginCount: userWithData.loginCount,
      hayerId: userWithData.HayerIds && userWithData.HayerIds.length > 0 ? userWithData.HayerIds[0].hayerId : null,
      profile: userWithData.Profile || null,
      communities: {
        owned: userWithData.ownedCommunities.length,
        member: userWithData.memberCommunities.length
      }
    }
  });
};

/**
 * Update current user profile
 */
const updateCurrentUserProfile = async (req, res) => {
  const user = req.user;
  const { displayName, bio, website, location, language, timezone, phone } = req.body;
  
  // Get or create profile
  let profile = await Profile.findOne({ where: { userId: user.id } });
  
  if (!profile) {
    profile = await Profile.create({ userId: user.id });
  }
  
  // Update user
  const userUpdates = {};
  if (displayName && displayName !== user.displayName) {
    if (!isValidDisplayName(displayName)) {
      throw new ValidationError('Display name must be 1-200 characters');
    }
    userUpdates.displayName = displayName;
  }
  
  // Update profile
  const profileUpdates = {};
  if (bio !== undefined) {
    if (bio && bio.length > 5000) {
      throw new ValidationError('Bio must be at most 5000 characters');
    }
    profileUpdates.bio = bio;
  }
  
  if (website !== undefined) {
    if (website && !validator.isURL(website)) {
      throw new ValidationError('Invalid website URL');
    }
    profileUpdates.website = website;
  }
  
  if (location !== undefined) {
    if (location && location.length > 200) {
      throw new ValidationError('Location must be at most 200 characters');
    }
    profileUpdates.location = location;
  }
  
  if (language !== undefined) {
    if (language && language.length > 10) {
      throw new ValidationError('Language must be at most 10 characters');
    }
    profileUpdates.language = language;
  }
  
  if (timezone !== undefined) {
    if (timezone && timezone.length > 50) {
      throw new ValidationError('Timezone must be at most 50 characters');
    }
    profileUpdates.timezone = timezone;
  }
  
  if (phone !== undefined) {
    if (phone && phone.length > 20) {
      throw new ValidationError('Phone must be at most 20 characters');
    }
    profileUpdates.phone = phone;
  }
  
  // Apply updates
  if (Object.keys(userUpdates).length > 0) {
    await user.update(userUpdates);
  }
  
  if (Object.keys(profileUpdates).length > 0) {
    await profile.update(profileUpdates);
  }
  
  // Log profile update
  await AuditEvent.create({
    userId: user.id,
    action: 'update_profile',
    category: 'user_management',
    resource: 'profile',
    resourceId: profile.id,
    description: `User ${user.username} updated profile`,
    status: 'success',
    severity: 'info',
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.id
  });
  
  res.json({
    success: true,
    message: 'Profile updated successfully',
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: userUpdates.displayName || user.displayName,
      profile: { ...profile.toJSON(), ...profileUpdates }
    }
  });
};

/**
 * Update user settings
 */
const updateUserSettings = async (req, res) => {
  const user = req.user;
  const { settings } = req.body;
  
  if (!settings || typeof settings !== 'object') {
    throw new ValidationError('Settings must be an object');
  }
  
  // Update user preferences
  await user.update({
    preferences: {
      ...(user.preferences || {}),
      ...settings
    }
  });
  
  res.json({
    success: true,
    message: 'Settings updated successfully',
    settings: user.preferences
  });
};

/**
 * Get user preferences
 */
const getUserPreferences = async (req, res) => {
  const user = req.user;
  
  res.json({
    success: true,
    preferences: user.preferences || {}
  });
};

/**
 * Update user preferences
 */
const updateUserPreferences = async (req, res) => {
  const user = req.user;
  const { preferences } = req.body;
  
  if (!preferences || typeof preferences !== 'object') {
    throw new ValidationError('Preferences must be an object');
  }
  
  // Update user preferences
  await user.update({
    preferences: {
      ...(user.preferences || {}),
      ...preferences
    }
  });
  
  res.json({
    success: true,
    message: 'Preferences updated successfully',
    preferences: user.preferences
  });
};

/**
 * Get user privacy settings
 */
const getUserPrivacySettings = async (req, res) => {
  const user = req.user;
  
  // Get profile with privacy settings
  const profile = await Profile.findOne({ where: { userId: user.id } });
  
  res.json({
    success: true,
    privacySettings: profile ? profile.privacySettings : {}
  });
};

/**
 * Update user privacy settings
 */
const updateUserPrivacySettings = async (req, res) => {
  const user = req.user;
  const { privacySettings } = req.body;
  
  if (!privacySettings || typeof privacySettings !== 'object') {
    throw new ValidationError('Privacy settings must be an object');
  }
  
  // Get or create profile
  let profile = await Profile.findOne({ where: { userId: user.id } });
  
  if (!profile) {
    profile = await Profile.create({ userId: user.id });
  }
  
  // Update privacy settings
  await profile.update({
    privacySettings: {
      ...(profile.privacySettings || {}),
      ...privacySettings
    }
  });
  
  res.json({
    success: true,
    message: 'Privacy settings updated successfully',
    privacySettings: profile.privacySettings
  });
};

/**
 * Upload avatar
 */
const uploadAvatar = async (req, res) => {
  const user = req.user;
  
  // In a real implementation, this would handle file upload
  // For now, we'll just accept a URL
  const { avatarUrl } = req.body;
  
  if (!avatarUrl) {
    throw new ValidationError('Avatar URL is required');
  }
  
  // Get or create profile
  let profile = await Profile.findOne({ where: { userId: user.id } });
  
  if (!profile) {
    profile = await Profile.create({ userId: user.id });
  }
  
  // Update avatar
  await profile.update({ avatar: avatarUrl });
  
  res.json({
    success: true,
    message: 'Avatar uploaded successfully',
    avatar: avatarUrl
  });
};

/**
 * Remove avatar
 */
const removeAvatar = async (req, res) => {
  const user = req.user;
  
  const profile = await Profile.findOne({ where: { userId: user.id } });
  
  if (!profile) {
    throw new NotFoundError('Profile not found');
  }
  
  await profile.update({ avatar: null });
  
  res.json({
    success: true,
    message: 'Avatar removed successfully'
  });
};

/**
 * Change email
 */
const changeEmail = async (req, res) => {
  const user = req.user;
  const { newEmail, currentPassword } = req.body;
  
  if (!newEmail || !currentPassword) {
    throw new ValidationError('New email and current password are required');
  }
  
  if (!isValidEmail(newEmail)) {
    throw new ValidationError('Invalid email format');
  }
  
  // Verify current password
  const isPasswordValid = await verifyPassword(currentPassword, user.passwordHash);
  
  if (!isPasswordValid) {
    throw new AuthenticationError('Current password is incorrect', {}, 'INVALID_CURRENT_PASSWORD');
  }
  
  // Check if email already exists
  const existingUser = await User.findOne({ where: { email: newEmail.toLowerCase() } });
  
  if (existingUser && existingUser.id !== user.id) {
    throw new ConflictError('Email already in use', { field: 'email' });
  }
  
  // Update email and mark as unverified
  await user.update({
    email: newEmail.toLowerCase(),
    isVerified: false,
    verificationToken: null,
    verificationTokenExpiresAt: null
  });
  
  // Generate new verification token
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  
  await user.update({
    verificationToken,
    verificationTokenExpiresAt
  });
  
  // Log email change
  await AuditEvent.create({
    userId: user.id,
    action: 'change_email',
    category: 'user_management',
    resource: 'user',
    resourceId: user.id,
    description: `User ${user.username} changed email`,
    status: 'success',
    severity: 'info',
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.id,
    details: {
      oldEmail: user.email,
      newEmail
    }
  });
  
  res.json({
    success: true,
    message: 'Email changed successfully. Please verify your new email address.',
    requiresVerification: true
  });
};

/**
 * Verify new email
 */
const verifyNewEmail = async (req, res) => {
  const user = req.user;
  const { token } = req.body;
  
  if (!token) {
    throw new ValidationError('Verification token is required');
  }
  
  if (user.verificationToken !== token) {
    throw new AuthenticationError('Invalid verification token', {}, 'INVALID_VERIFICATION_TOKEN');
  }
  
  if (user.verificationTokenExpiresAt < new Date()) {
    throw new AuthenticationError('Verification token expired', {}, 'VERIFICATION_TOKEN_EXPIRED');
  }
  
  // Verify email
  await user.update({
    isVerified: true,
    verificationToken: null,
    verificationTokenExpiresAt: null
  });
  
  res.json({
    success: true,
    message: 'Email verified successfully'
  });
};

/**
 * Change username
 */
const changeUsername = async (req, res) => {
  const user = req.user;
  const { newUsername, currentPassword } = req.body;
  
  if (!newUsername || !currentPassword) {
    throw new ValidationError('New username and current password are required');
  }
  
  if (!isValidUsername(newUsername)) {
    throw new ValidationError('Username must be 3-80 alphanumeric characters');
  }
  
  // Verify current password
  const isPasswordValid = await verifyPassword(currentPassword, user.passwordHash);
  
  if (!isPasswordValid) {
    throw new AuthenticationError('Current password is incorrect', {}, 'INVALID_CURRENT_PASSWORD');
  }
  
  // Check if username already exists
  const existingUser = await User.findOne({ where: { username: newUsername.toLowerCase() } });
  
  if (existingUser && existingUser.id !== user.id) {
    throw new ConflictError('Username already taken', { field: 'username' });
  }
  
  // Update username
  const oldUsername = user.username;
  await user.update({ username: newUsername.toLowerCase() });
  
  // Log username change
  await AuditEvent.create({
    userId: user.id,
    action: 'change_username',
    category: 'user_management',
    resource: 'user',
    resourceId: user.id,
    description: `User changed username from ${oldUsername} to ${newUsername}`,
    status: 'success',
    severity: 'info',
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.id
  });
  
  res.json({
    success: true,
    message: 'Username changed successfully',
    username: newUsername.toLowerCase()
  });
};

/**
 * Deactivate account
 */
const deactivateAccount = async (req, res) => {
  const user = req.user;
  const { currentPassword, reason } = req.body;
  
  if (!currentPassword) {
    throw new ValidationError('Current password is required');
  }
  
  // Verify current password
  const isPasswordValid = await verifyPassword(currentPassword, user.passwordHash);
  
  if (!isPasswordValid) {
    throw new AuthenticationError('Current password is incorrect', {}, 'INVALID_CURRENT_PASSWORD');
  }
  
  // Deactivate account
  await user.update({
    isActive: false,
    deactivatedAt: new Date(),
    deactivationReason: reason || null
  });
  
  // Invalidate all sessions
  await Session.update(
    { isActive: false, expiresAt: new Date() },
    { where: { userId: user.id } }
  );
  
  // Log deactivation
  await AuditEvent.create({
    userId: user.id,
    action: 'deactivate_account',
    category: 'user_management',
    resource: 'user',
    resourceId: user.id,
    description: `User ${user.username} deactivated account`,
    status: 'success',
    severity: 'warning',
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.id,
    details: { reason }
  });
  
  res.json({
    success: true,
    message: 'Account deactivated successfully'
  });
};

/**
 * Reactivate account
 */
const reactivateAccount = async (req, res) => {
  const user = req.user;
  const { currentPassword } = req.body;
  
  if (!currentPassword) {
    throw new ValidationError('Current password is required');
  }
  
  // Verify current password
  const isPasswordValid = await verifyPassword(currentPassword, user.passwordHash);
  
  if (!isPasswordValid) {
    throw new AuthenticationError('Current password is incorrect', {}, 'INVALID_CURRENT_PASSWORD');
  }
  
  // Reactivate account
  await user.update({
    isActive: true,
    deactivatedAt: null,
    deactivationReason: null
  });
  
  // Log reactivation
  await AuditEvent.create({
    userId: user.id,
    action: 'reactivate_account',
    category: 'user_management',
    resource: 'user',
    resourceId: user.id,
    description: `User ${user.username} reactivated account`,
    status: 'success',
    severity: 'info',
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.id
  });
  
  res.json({
    success: true,
    message: 'Account reactivated successfully'
  });
};

/**
 * Delete account
 */
const deleteAccount = async (req, res) => {
  const user = req.user;
  const { currentPassword, confirmDeletion } = req.body;
  
  if (!currentPassword || !confirmDeletion) {
    throw new ValidationError('Current password and deletion confirmation are required');
  }
  
  if (confirmDeletion !== 'DELETE') {
    throw new ValidationError('Deletion confirmation must be "DELETE"');
  }
  
  // Verify current password
  const isPasswordValid = await verifyPassword(currentPassword, user.passwordHash);
  
  if (!isPasswordValid) {
    throw new AuthenticationError('Current password is incorrect', {}, 'INVALID_CURRENT_PASSWORD');
  }
  
  // Delete user (soft delete)
  await user.destroy();
  
  // Log deletion
  await AuditEvent.create({
    userId: user.id,
    action: 'delete_account',
    category: 'user_management',
    resource: 'user',
    resourceId: user.id,
    description: `User ${user.username} deleted account`,
    status: 'success',
    severity: 'warning',
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.id
  });
  
  res.json({
    success: true,
    message: 'Account deleted successfully'
  });
};

/**
 * Export user data
 */
const exportUserData = async (req, res) => {
  const user = req.user;
  
  // Get all user data
  const userData = await User.findByPk(user.id, {
    include: [
      { model: Profile },
      { model: HayerId },
      { model: Session },
      { model: Community, as: 'ownedCommunities' },
      { model: Community, as: 'memberCommunities' }
    ]
  });
  
  // Log export
  await AuditEvent.create({
    userId: user.id,
    action: 'export_data',
    category: 'user_management',
    resource: 'user',
    resourceId: user.id,
    description: `User ${user.username} exported data`,
    status: 'success',
    severity: 'info',
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.id
  });
  
  res.json({
    success: true,
    message: 'Data export requested',
    data: {
      user: userData.toJSON(),
      exportedAt: new Date().toISOString()
    }
  });
};

/**
 * Get user activity
 */
const getUserActivity = async (req, res) => {
  const user = req.user;
  const { limit = 20, offset = 0 } = req.query;
  
  const activity = await AuditEvent.findAll({
    where: { userId: user.id },
    order: [['createdAt', 'DESC']],
    limit: Math.min(limit, 100),
    offset
  });
  
  res.json({
    success: true,
    activity: activity.map(event => ({
      id: event.id,
      action: event.action,
      category: event.category,
      resource: event.resource,
      description: event.description,
      status: event.status,
      severity: event.severity,
      createdAt: event.createdAt
    })),
    total: activity.length
  });
};

/**
 * Get user notifications
 */
const getUserNotifications = async (req, res) => {
  // This will be implemented in the notification controller
  res.json({
    success: true,
    notifications: []
  });
};

/**
 * Update user notification
 */
const updateUserNotification = async (req, res) => {
  // This will be implemented in the notification controller
  res.json({
    success: true,
    message: 'Notification updated'
  });
};

// Admin functions will be implemented as needed

module.exports = {
  getUserById,
  getUserByUsername,
  getUserByHayerId,
  searchUsers,
  getCurrentUserProfile,
  updateCurrentUserProfile,
  updateUserSettings,
  getUserPreferences,
  updateUserPreferences,
  getUserPrivacySettings,
  updateUserPrivacySettings,
  uploadAvatar,
  removeAvatar,
  changeEmail,
  verifyNewEmail,
  changeUsername,
  deactivateAccount,
  reactivateAccount,
  deleteAccount,
  exportUserData,
  getUserActivity,
  getUserNotifications,
  updateUserNotification,
  // Admin functions
  listAllUsers: async (req, res) => {
    throw new Error('Not implemented yet');
  },
  getUserDetails: async (req, res) => {
    throw new Error('Not implemented yet');
  },
  updateUser: async (req, res) => {
    throw new Error('Not implemented yet');
  },
  suspendUser: async (req, res) => {
    throw new Error('Not implemented yet');
  },
  unsuspendUser: async (req, res) => {
    throw new Error('Not implemented yet');
  },
  banUser: async (req, res) => {
    throw new Error('Not implemented yet');
  },
  unbanUser: async (req, res) => {
    throw new Error('Not implemented yet');
  },
  verifyUser: async (req, res) => {
    throw new Error('Not implemented yet');
  },
  unverifyUser: async (req, res) => {
    throw new Error('Not implemented yet');
  },
  impersonateUser: async (req, res) => {
    throw new Error('Not implemented yet');
  },
  searchUsersAdmin: async (req, res) => {
    throw new Error('Not implemented yet');
  },
  getUserStatistics: async (req, res) => {
    throw new Error('Not implemented yet');
  },
  exportAllUserData: async (req, res) => {
    throw new Error('Not implemented yet');
  },
  // Relationship functions
  followUser: async (req, res) => {
    throw new Error('Not implemented yet');
  },
  unfollowUser: async (req, res) => {
    throw new Error('Not implemented yet');
  },
  blockUser: async (req, res) => {
    throw new Error('Not implemented yet');
  },
  unblockUser: async (req, res) => {
    throw new Error('Not implemented yet');
  },
  getUserFollowers: async (req, res) => {
    throw new Error('Not implemented yet');
  },
  getUserFollowing: async (req, res) => {
    throw new Error('Not implemented yet');
  },
  getUserBlocks: async (req, res) => {
    throw new Error('Not implemented yet');
  },
  checkFollow: async (req, res) => {
    throw new Error('Not implemented yet');
  },
  checkBlock: async (req, res) => {
    throw new Error('Not implemented yet');
  },
  reportUser: async (req, res) => {
    throw new Error('Not implemented yet');
  },
  getUserReports: async (req, res) => {
    throw new Error('Not implemented yet');
  }
};
