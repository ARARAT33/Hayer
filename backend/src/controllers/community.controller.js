/**
 * Community Controller
 * Handles community management endpoints
 */

const communityService = require('../services/community.service');
const { 
  AuthenticationError, 
  AuthorizationError,
  ValidationError,
  NotFoundError,
  ConflictError
} = require('../middleware/errorHandler');
const { extractUserFromRequest, checkPermission } = require('../middleware/authentication');

/**
 * Create a new community
 */
const createCommunity = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { 
      name,
      description,
      type = 'public',
      category = null,
      icon = null,
      banner = null,
      rules = null,
      settings = {}
    } = req.body;
    
    const community = await communityService.createCommunity(user.id, {
      name,
      description,
      type,
      category,
      icon,
      banner,
      rules,
      settings
    }, {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.status(201).json({
      success: true,
      data: community
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get community by ID
 */
const getCommunity = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const { includeMembers = false, includeOwner = false } = req.query;
    
    const community = await communityService.getCommunityById(communityId, {
      includeMembers: includeMembers === 'true',
      includeOwner: includeOwner === 'true',
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      data: community
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get community by name
 */
const getCommunityByName = async (req, res, next) => {
  try {
    const { name } = req.params;
    
    const community = await communityService.getCommunityByName(name);
    
    res.json({
      success: true,
      data: community
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List communities
 */
const listCommunities = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    
    const { 
      type = null,
      category = null,
      ownerId = null,
      isActive = null,
      isVerified = null,
      limit = 50,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;
    
    const result = await communityService.listCommunities({
      type,
      category,
      ownerId,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : null,
      isVerified: isVerified === 'true' ? true : isVerified === 'false' ? false : null,
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
 * Update community
 */
const updateCommunity = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { communityId } = req.params;
    const updates = req.body;
    
    const community = await communityService.updateCommunity(
      user.id,
      communityId,
      updates,
      {
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        requestId: req.requestId
      }
    );
    
    res.json({
      success: true,
      data: community
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Deactivate community
 */
const deactivateCommunity = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { communityId } = req.params;
    
    const community = await communityService.deactivateCommunity(user.id, communityId, {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      data: community,
      message: 'Community deactivated'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Activate community
 */
const activateCommunity = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { communityId } = req.params;
    
    const community = await communityService.activateCommunity(user.id, communityId, {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      data: community,
      message: 'Community activated'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove community
 */
const removeCommunity = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { communityId } = req.params;
    
    const result = await communityService.removeCommunity(user.id, communityId, {
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

// ============================================================================
// COMMUNITY MEMBER ENDPOINTS
// ============================================================================

/**
 * Join a community
 */
const joinCommunity = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { communityId } = req.params;
    
    const member = await communityService.joinCommunity(user.id, communityId, {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      data: member
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Leave a community
 */
const leaveCommunity = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { communityId } = req.params;
    
    const result = await communityService.leaveCommunity(user.id, communityId, {
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
 * Get community members
 */
const getCommunityMembers = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const { role = null, limit = 50, offset = 0 } = req.query;
    
    const result = await communityService.getCommunityMembers(communityId, {
      role,
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
 * Get user's communities
 */
const getUserCommunities = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { type = null, limit = 50, offset = 0 } = req.query;
    
    const result = await communityService.getUserCommunities(user.id, {
      type,
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
 * Get community member
 */
const getCommunityMember = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    const { communityId } = req.params;
    const { userId: targetUserId } = req.query;
    
    const member = await communityService.getCommunityMember(
      user.id,
      communityId,
      targetUserId,
      {
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        requestId: req.requestId
      }
    );
    
    res.json({
      success: true,
      data: member
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update community member role
 */
const updateCommunityMemberRole = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { communityId, userId: targetUserId } = req.params;
    const { role } = req.body;
    
    const member = await communityService.updateCommunityMemberRole(
      user.id,
      communityId,
      targetUserId,
      role,
      {
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        requestId: req.requestId
      }
    );
    
    res.json({
      success: true,
      data: member
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove community member
 */
const removeCommunityMember = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { communityId, userId: targetUserId } = req.params;
    
    const result = await communityService.removeCommunityMember(
      user.id,
      communityId,
      targetUserId,
      {
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
 * Transfer community ownership
 */
const transferCommunityOwnership = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { communityId } = req.params;
    const { newOwnerId } = req.body;
    
    const community = await communityService.transferCommunityOwnership(
      user.id,
      communityId,
      newOwnerId,
      {
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        requestId: req.requestId
      }
    );
    
    res.json({
      success: true,
      data: community,
      message: 'Community ownership transferred'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Search communities
 */
const searchCommunities = async (req, res, next) => {
  try {
    const { query } = req.query;
    const { limit = 20, offset = 0 } = req.query;
    
    const result = await communityService.searchCommunities(query, {
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
 * Get community statistics
 */
const getCommunityStats = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    
    const stats = await communityService.getCommunityStats(communityId, {
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
 * Get trending communities
 */
const getTrendingCommunities = async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;
    
    const result = await communityService.getTrendingCommunities({
      limit: parseInt(limit),
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
 * Verify community (admin only)
 */
const verifyCommunity = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    // Check admin role
    const hasPermission = await checkPermission(user, 'community', 'verify', 'all');
    if (!hasPermission) {
      throw new AuthorizationError('Admin permissions required');
    }
    
    const { communityId } = req.params;
    
    const community = await communityService.verifyCommunity(user.id, communityId, {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      data: community,
      message: 'Community verified'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get community categories
 */
const getCommunityCategories = async (req, res, next) => {
  try {
    const categories = await communityService.getCommunityCategories();
    
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCommunity,
  getCommunity,
  getCommunityByName,
  listCommunities,
  updateCommunity,
  deactivateCommunity,
  activateCommunity,
  removeCommunity,
  joinCommunity,
  leaveCommunity,
  getCommunityMembers,
  getUserCommunities,
  getCommunityMember,
  updateCommunityMemberRole,
  removeCommunityMember,
  transferCommunityOwnership,
  searchCommunities,
  getCommunityStats,
  getTrendingCommunities,
  verifyCommunity,
  getCommunityCategories
};
