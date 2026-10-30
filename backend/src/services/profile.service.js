/**
 * Profile Service
 * Manages user profiles, social links, and privacy settings
 */

const { Op } = require('sequelize');
const config = require('../config');
const { Profile, User, HayerId, AuditEvent } = require('../models');
const { 
  NotFoundError, 
  ConflictError,
  ValidationError,
  AuthenticationError,
  AuthorizationError
} = require('../middleware/errorHandler');

/**
 * Create a profile for user
 */
const createProfile = async (userId, data, options = {}) => {
  const { 
    bio = null,
    avatarUrl = null,
    bannerUrl = null,
    website = null,
    location = null,
    birthDate = null,
    gender = null,
    socialLinks = {},
    privacySettings = null,
    preferences = null,
    userAgent = null,
    ipAddress = null,
    requestId = null
  } = data;
  
  // Validate user
  const user = await User.findByPk(userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  
  // Check if profile already exists
  const existingProfile = await Profile.findOne({ where: { userId } });
  if (existingProfile) {
    throw new ConflictError('Profile already exists');
  }
  
  // Create profile
  const profile = await Profile.create({
    userId,
    bio,
    avatarUrl,
    bannerUrl,
    website,
    location,
    birthDate,
    gender,
    socialLinks,
    privacySettings: privacySettings || {
      profileVisibility: 'public',
      emailVisibility: 'private',
      searchable: true
    },
    preferences: preferences || {
      theme: 'system',
      language: user.language || 'hy',
      notifications: {
        email: true,
        push: true
      }
    }
  });
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'profile.create',
    entityType: 'profile',
    entityId: profile.id,
    metadata: {
      userId
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return profile;
};

/**
 * Get profile by user ID
 */
const getProfileByUserId = async (userId, options = {}) => {
  const { includeUser = false, userAgent = null, ipAddress = null, requestId = null } = options;
  
  const queryOptions = {
    where: { userId }
  };
  
  if (includeUser) {
    queryOptions.include = [{ model: User }];
  }
  
  const profile = await Profile.findOne(queryOptions);
  
  if (!profile) {
    throw new NotFoundError('Profile not found');
  }
  
  // Log access
  await AuditEvent.create({
    userId,
    action: 'profile.access',
    entityType: 'profile',
    entityId: profile.id,
    metadata: {
      userId
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return profile;
};

/**
 * Get profile by username
 */
const getProfileByUsername = async (username, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const user = await User.findOne({
    where: { username: username.toLowerCase() },
    include: [{ model: Profile }]
  });
  
  if (!user || !user.Profile) {
    throw new NotFoundError('Profile not found');
  }
  
  // Log access
  await AuditEvent.create({
    userId: user.id,
    action: 'profile.access_by_username',
    entityType: 'profile',
    entityId: user.Profile.id,
    metadata: {
      username
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return user.Profile;
};

/**
 * Get profile by HAYER ID
 */
const getProfileByHayerId = async (hayerId, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const hayerIdRecord = await HayerId.findOne({
    where: { hayerId },
    include: [{ model: User, include: [Profile] }]
  });
  
  if (!hayerIdRecord || !hayerIdRecord.User || !hayerIdRecord.User.Profile) {
    throw new NotFoundError('Profile not found');
  }
  
  // Log access
  await AuditEvent.create({
    userId: hayerIdRecord.userId,
    action: 'profile.access_by_hayer_id',
    entityType: 'profile',
    entityId: hayerIdRecord.User.Profile.id,
    metadata: {
      hayerId
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return hayerIdRecord.User.Profile;
};

/**
 * Get public profile by user ID
 */
const getPublicProfileByUserId = async (userId, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const profile = await Profile.findOne({
    where: { userId },
    include: [
      {
        model: User,
        attributes: ['id', 'username', 'displayName', 'createdAt']
      }
    ]
  });
  
  if (!profile) {
    throw new NotFoundError('Profile not found');
  }
  
  // Check privacy settings
  if (profile.privacySettings.profileVisibility !== 'public') {
    throw new AuthorizationError('Profile is not public');
  }
  
  // Log access
  await AuditEvent.create({
    userId,
    action: 'profile.public_access',
    entityType: 'profile',
    entityId: profile.id,
    metadata: {
      userId
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return {
    ...profile.toJSON(),
    User: profile.User
  };
};

/**
 * Get public profile by username
 */
const getPublicProfileByUsername = async (username, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const user = await User.findOne({
    where: { username: username.toLowerCase() },
    include: [
      {
        model: Profile,
        where: { privacySettings: { profileVisibility: 'public' } }
      }
    ]
  });
  
  if (!user || !user.Profile) {
    throw new NotFoundError('Public profile not found');
  }
  
  // Log access
  await AuditEvent.create({
    userId: user.id,
    action: 'profile.public_access_by_username',
    entityType: 'profile',
    entityId: user.Profile.id,
    metadata: {
      username
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return {
    ...user.Profile.toJSON(),
    User: {
      id: user.id,
      username: user.username,
      displayName: user.displayName
    }
  };
};

/**
 * Get public profile by HAYER ID
 */
const getPublicProfileByHayerId = async (hayerId, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const hayerIdRecord = await HayerId.findOne({
    where: { hayerId },
    include: [
      {
        model: User,
        include: [
          {
            model: Profile,
            where: { privacySettings: { profileVisibility: 'public' } }
          }
        ]
      }
    ]
  });
  
  if (!hayerIdRecord || !hayerIdRecord.User || !hayerIdRecord.User.Profile) {
    throw new NotFoundError('Public profile not found');
  }
  
  // Log access
  await AuditEvent.create({
    userId: hayerIdRecord.userId,
    action: 'profile.public_access_by_hayer_id',
    entityType: 'profile',
    entityId: hayerIdRecord.User.Profile.id,
    metadata: {
      hayerId
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return {
    ...hayerIdRecord.User.Profile.toJSON(),
    User: {
      id: hayerIdRecord.User.id,
      username: hayerIdRecord.User.username,
      displayName: hayerIdRecord.User.displayName
    }
  };
};

/**
 * Update profile
 */
const updateProfile = async (userId, updates, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const profile = await Profile.findOne({ where: { userId } });
  
  if (!profile) {
    throw new NotFoundError('Profile not found');
  }
  
  const oldValues = { ...profile.toJSON() };
  await profile.update(updates);
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'profile.update',
    entityType: 'profile',
    entityId: profile.id,
    metadata: {
      changes: {
        old: oldValues,
        new: updates
      }
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return profile;
};

/**
 * Update profile picture
 */
const updateProfilePicture = async (userId, fileData, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const profile = await Profile.findOne({ where: { userId } });
  
  if (!profile) {
    throw new NotFoundError('Profile not found');
  }
  
  // In production, upload file to storage and get URL
  const avatarUrl = fileData.url || fileData.path || null;
  
  const oldAvatarUrl = profile.avatarUrl;
  await profile.update({ avatarUrl });
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'profile.update_picture',
    entityType: 'profile',
    entityId: profile.id,
    metadata: {
      oldAvatarUrl,
      newAvatarUrl: avatarUrl
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return profile;
};

/**
 * Remove profile picture
 */
const removeProfilePicture = async (userId, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const profile = await Profile.findOne({ where: { userId } });
  
  if (!profile) {
    throw new NotFoundError('Profile not found');
  }
  
  const oldAvatarUrl = profile.avatarUrl;
  await profile.update({ avatarUrl: null });
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'profile.remove_picture',
    entityType: 'profile',
    entityId: profile.id,
    metadata: {
      oldAvatarUrl
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return profile;
};

/**
 * Update profile banner
 */
const updateProfileBanner = async (userId, fileData, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const profile = await Profile.findOne({ where: { userId } });
  
  if (!profile) {
    throw new NotFoundError('Profile not found');
  }
  
  // In production, upload file to storage and get URL
  const bannerUrl = fileData.url || fileData.path || null;
  
  const oldBannerUrl = profile.bannerUrl;
  await profile.update({ bannerUrl });
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'profile.update_banner',
    entityType: 'profile',
    entityId: profile.id,
    metadata: {
      oldBannerUrl,
      newBannerUrl: bannerUrl
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return profile;
};

/**
 * Remove profile banner
 */
const removeProfileBanner = async (userId, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const profile = await Profile.findOne({ where: { userId } });
  
  if (!profile) {
    throw new NotFoundError('Profile not found');
  }
  
  const oldBannerUrl = profile.bannerUrl;
  await profile.update({ bannerUrl: null });
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'profile.remove_banner',
    entityType: 'profile',
    entityId: profile.id,
    metadata: {
      oldBannerUrl
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return profile;
};

/**
 * Update profile bio
 */
const updateProfileBio = async (userId, bio, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const profile = await Profile.findOne({ where: { userId } });
  
  if (!profile) {
    throw new NotFoundError('Profile not found');
  }
  
  const oldBio = profile.bio;
  await profile.update({ bio });
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'profile.update_bio',
    entityType: 'profile',
    entityId: profile.id,
    metadata: {
      oldBio,
      newBio: bio
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return profile;
};

/**
 * Update profile social links
 */
const updateProfileSocialLinks = async (userId, socialLinks, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const profile = await Profile.findOne({ where: { userId } });
  
  if (!profile) {
    throw new NotFoundError('Profile not found');
  }
  
  const oldSocialLinks = profile.socialLinks || {};
  await profile.update({ socialLinks });
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'profile.update_social_links',
    entityType: 'profile',
    entityId: profile.id,
    metadata: {
      oldSocialLinks,
      newSocialLinks: socialLinks
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return profile;
};

/**
 * Update profile preferences
 */
const updateProfilePreferences = async (userId, preferences, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const profile = await Profile.findOne({ where: { userId } });
  
  if (!profile) {
    throw new NotFoundError('Profile not found');
  }
  
  const oldPreferences = profile.preferences || {};
  await profile.update({ preferences });
  
  // Update user preferences
  const user = await User.findByPk(userId);
  if (user) {
    await user.update({
      preferences: {
        ...user.preferences,
        ...preferences
      }
    });
  }
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'profile.update_preferences',
    entityType: 'profile',
    entityId: profile.id,
    metadata: {
      oldPreferences,
      newPreferences: preferences
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return profile;
};

/**
 * Update profile privacy settings
 */
const updateProfilePrivacySettings = async (userId, privacySettings, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const profile = await Profile.findOne({ where: { userId } });
  
  if (!profile) {
    throw new NotFoundError('Profile not found');
  }
  
  const oldPrivacySettings = profile.privacySettings || {};
  await profile.update({ privacySettings });
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'profile.update_privacy',
    entityType: 'profile',
    entityId: profile.id,
    metadata: {
      oldPrivacySettings,
      newPrivacySettings: privacySettings
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return profile;
};

/**
 * Get profile visibility settings
 */
const getProfileVisibility = async (userId, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const profile = await Profile.findOne({ where: { userId } });
  
  if (!profile) {
    throw new NotFoundError('Profile not found');
  }
  
  // Log access
  await AuditEvent.create({
    userId,
    action: 'profile.visibility.get',
    entityType: 'profile',
    entityId: profile.id,
    metadata: {
      visibility: profile.privacySettings?.profileVisibility
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return {
    profileVisibility: profile.privacySettings?.profileVisibility || 'public',
    emailVisibility: profile.privacySettings?.emailVisibility || 'private',
    searchable: profile.privacySettings?.searchable || true
  };
};

/**
 * Update profile visibility
 */
const updateProfileVisibility = async (userId, visibility, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const profile = await Profile.findOne({ where: { userId } });
  
  if (!profile) {
    throw new NotFoundError('Profile not found');
  }
  
  const updates = {
    privacySettings: {
      ...profile.privacySettings,
      ...visibility
    }
  };
  
  await profile.update(updates);
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'profile.visibility.update',
    entityType: 'profile',
    entityId: profile.id,
    metadata: {
      visibility
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return profile;
};

/**
 * Search profiles
 */
const searchProfiles = async (query, options = {}) => {
  const { 
    limit = 20,
    offset = 0,
    userAgent = null,
    ipAddress = null,
    requestId = null
  } = options;
  
  const where = {
    [Op.or]: [
      { '$User.username$': { [Op.iLike]: `%${query}%` } },
      { '$User.displayName$': { [Op.iLike]: `%${query}%` } },
      { bio: { [Op.iLike]: `%${query}%` } },
      { location: { [Op.iLike]: `%${query}%` } }
    ],
    privacySettings: { searchable: true }
  };
  
  const result = await Profile.findAndCountAll({
    where,
    include: [
      {
        model: User,
        attributes: ['id', 'username', 'displayName']
      }
    ],
    limit,
    offset,
    order: [['createdAt', 'DESC']]
  });
  
  // Log search
  await AuditEvent.create({
    userId: null,
    action: 'profile.search',
    entityType: 'profile',
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
 * Get profile statistics
 */
const getProfileStats = async (userId, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const profile = await Profile.findOne({ where: { userId } });
  
  if (!profile) {
    throw new NotFoundError('Profile not found');
  }
  
  // In production, we would calculate actual statistics
  const stats = {
    followers: 0,
    following: 0,
    posts: 0,
    comments: 0,
    likes: 0
  };
  
  // Log access
  await AuditEvent.create({
    userId,
    action: 'profile.stats',
    entityType: 'profile',
    entityId: profile.id,
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
 * Get profile followers (stub - to be implemented with follow system)
 */
const getProfileFollowers = async (userId, options = {}) => {
  const { limit = 50, offset = 0, userAgent = null, ipAddress = null, requestId = null } = options;
  
  // In production, query follow table
  return {
    data: [],
    pagination: {
      total: 0,
      limit,
      offset,
      hasMore: false
    }
  };
};

/**
 * Get profile following (stub - to be implemented with follow system)
 */
const getProfileFollowing = async (userId, options = {}) => {
  const { limit = 50, offset = 0, userAgent = null, ipAddress = null, requestId = null } = options;
  
  // In production, query follow table
  return {
    data: [],
    pagination: {
      total: 0,
      limit,
      offset,
      hasMore: false
    }
  };
};

/**
 * Get profile blocks (stub - to be implemented with block system)
 */
const getProfileBlocks = async (userId, options = {}) => {
  const { limit = 50, offset = 0, userAgent = null, ipAddress = null, requestId = null } = options;
  
  // In production, query block table
  return {
    data: [],
    pagination: {
      total: 0,
      limit,
      offset,
      hasMore: false
    }
  };
};

module.exports = {
  createProfile,
  getProfileByUserId,
  getProfileByUsername,
  getProfileByHayerId,
  getPublicProfileByUserId,
  getPublicProfileByUsername,
  getPublicProfileByHayerId,
  updateProfile,
  updateProfilePicture,
  removeProfilePicture,
  updateProfileBanner,
  removeProfileBanner,
  updateProfileBio,
  updateProfileSocialLinks,
  updateProfilePreferences,
  updateProfilePrivacySettings,
  getProfileVisibility,
  updateProfileVisibility,
  searchProfiles,
  getProfileStats,
  getProfileFollowers,
  getProfileFollowing,
  getProfileBlocks
};
