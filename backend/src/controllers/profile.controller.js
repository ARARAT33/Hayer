/**
 * Profile Controller
 * Handles profile management endpoints
 */

const profileService = require('../services/profile.service');
const { 
  AuthenticationError, 
  AuthorizationError,
  ValidationError,
  NotFoundError,
  ConflictError
} = require('../middleware/errorHandler');
const { extractUserFromRequest, checkPermission } = require('../middleware/authentication');

/**
 * Get public profile by user ID
 */
const getPublicProfileByUserId = async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    const profile = await profileService.getPublicProfileByUserId(userId, {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get public profile by username
 */
const getPublicProfileByUsername = async (req, res, next) => {
  try {
    const { username } = req.params;
    
    const profile = await profileService.getPublicProfileByUsername(username, {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get public profile by HAYER ID
 */
const getPublicProfileByHayerId = async (req, res, next) => {
  try {
    const { hayerId } = req.params;
    
    const profile = await profileService.getPublicProfileByHayerId(hayerId, {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Search profiles
 */
const searchProfiles = async (req, res, next) => {
  try {
    const { query } = req.query;
    const { limit = 20, offset = 0 } = req.query;
    
    const result = await profileService.searchProfiles(query, {
      limit: parseInt(limit),
      offset: parseInt(offset),
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
 * Get current user's profile
 */
const getCurrentUserProfile = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const profile = await profileService.getProfileByUserId(user.id, {
      includeUser: true,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create profile (if doesn't exist)
 */
const createProfile = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
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
      preferences = null
    } = req.body;
    
    const profile = await profileService.createProfile(user.id, {
      bio,
      avatarUrl,
      bannerUrl,
      website,
      location,
      birthDate,
      gender,
      socialLinks,
      privacySettings,
      preferences
    }, {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.status(201).json({
      success: true,
      data: profile
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update profile
 */
const updateProfile = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const updates = req.body;
    
    const profile = await profileService.updateProfile(user.id, updates, {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update profile picture
 */
const updateProfilePicture = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    if (!req.file && !req.body.url) {
      throw new ValidationError('File or URL is required');
    }
    
    const fileData = req.file || req.body;
    
    const profile = await profileService.updateProfilePicture(user.id, fileData, {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove profile picture
 */
const removeProfilePicture = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const profile = await profileService.removeProfilePicture(user.id, {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update profile banner
 */
const updateProfileBanner = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    if (!req.file && !req.body.url) {
      throw new ValidationError('File or URL is required');
    }
    
    const fileData = req.file || req.body;
    
    const profile = await profileService.updateProfileBanner(user.id, fileData, {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove profile banner
 */
const removeProfileBanner = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const profile = await profileService.removeProfileBanner(user.id, {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update profile bio
 */
const updateProfileBio = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { bio } = req.body;
    
    if (!bio) {
      throw new ValidationError('Bio is required');
    }
    
    const profile = await profileService.updateProfileBio(user.id, bio, {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update profile social links
 */
const updateProfileSocialLinks = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { socialLinks } = req.body;
    
    if (!socialLinks) {
      throw new ValidationError('Social links are required');
    }
    
    const profile = await profileService.updateProfileSocialLinks(user.id, socialLinks, {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update profile preferences
 */
const updateProfilePreferences = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { preferences } = req.body;
    
    if (!preferences) {
      throw new ValidationError('Preferences are required');
    }
    
    const profile = await profileService.updateProfilePreferences(user.id, preferences, {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update profile privacy settings
 */
const updateProfilePrivacySettings = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { privacySettings } = req.body;
    
    if (!privacySettings) {
      throw new ValidationError('Privacy settings are required');
    }
    
    const profile = await profileService.updateProfilePrivacySettings(user.id, privacySettings, {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get profile visibility settings
 */
const getProfileVisibility = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const visibility = await profileService.getProfileVisibility(user.id, {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      data: visibility
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update profile visibility
 */
const updateProfileVisibility = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { visibility } = req.body;
    
    if (!visibility) {
      throw new ValidationError('Visibility settings are required');
    }
    
    const profile = await profileService.updateProfileVisibility(user.id, visibility, {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get profile statistics
 */
const getProfileStats = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const stats = await profileService.getProfileStats(user.id, {
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
 * Get profile followers
 */
const getProfileFollowers = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { limit = 50, offset = 0 } = req.query;
    
    const result = await profileService.getProfileFollowers(user.id, {
      limit: parseInt(limit),
      offset: parseInt(offset),
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
 * Get profile following
 */
const getProfileFollowing = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { limit = 50, offset = 0 } = req.query;
    
    const result = await profileService.getProfileFollowing(user.id, {
      limit: parseInt(limit),
      offset: parseInt(offset),
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
 * Get profile blocks
 */
const getProfileBlocks = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { limit = 50, offset = 0 } = req.query;
    
    const result = await profileService.getProfileBlocks(user.id, {
      limit: parseInt(limit),
      offset: parseInt(offset),
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

module.exports = {
  getPublicProfileByUserId,
  getPublicProfileByUsername,
  getPublicProfileByHayerId,
  searchProfiles,
  getCurrentUserProfile,
  createProfile,
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
  getProfileStats,
  getProfileFollowers,
  getProfileFollowing,
  getProfileBlocks
};
