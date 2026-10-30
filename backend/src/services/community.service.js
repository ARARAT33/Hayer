/**
 * Community Service
 * Manages communities, posts, comments, and memberships
 */

const crypto = require('crypto');
const { Op } = require('sequelize');
const config = require('../config');
const { 
  Community, 
  CommunityMember,
  User,
  AuditEvent
} = require('../models');
const { 
  NotFoundError, 
  ConflictError,
  ValidationError,
  AuthenticationError,
  AuthorizationError
} = require('../middleware/errorHandler');

/**
 * Generate unique community ID
 */
const generateCommunityId = async () => {
  let communityId;
  let exists;
  
  do {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    communityId = `COMM-${Array.from({ length: 8 }, () => 
      chars.charAt(Math.floor(Math.random() * chars.length))
    ).join('')}`;
    exists = await Community.findOne({ where: { communityId } });
  } while (exists);
  
  return communityId;
};

/**
 * Create a new community
 */
const createCommunity = async (userId, data, options = {}) => {
  const { 
    name,
    description,
    type = 'public',
    category = null,
    icon = null,
    banner = null,
    rules = null,
    settings = {},
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
  if (!name) {
    throw new ValidationError('Community name is required');
  }
  
  // Validate community type
  const validTypes = ['public', 'private', 'restricted'];
  if (!validTypes.includes(type)) {
    throw new ValidationError(`Invalid community type. Must be one of: ${validTypes.join(', ')}`);
  }
  
  // Check if community name already exists
  const existingCommunity = await Community.findOne({
    where: { name: name.toLowerCase() }
  });
  if (existingCommunity) {
    throw new ConflictError('Community name already exists');
  }
  
  // Generate community ID
  const communityId = await generateCommunityId();
  
  // Create community
  const community = await Community.create({
    ownerId: userId,
    name: name.toLowerCase(),
    displayName: name,
    description,
    communityId,
    type,
    category,
    icon,
    banner,
    rules,
    settings: {
      allowPosts: true,
      allowComments: true,
      moderation: 'pre',
      ...settings
    },
    memberCount: 1,
    postCount: 0,
    isActive: true,
    isVerified: false
  });
  
  // Add owner as member
  await CommunityMember.create({
    communityId: community.id,
    userId,
    role: 'owner',
    joinedAt: new Date()
  });
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'community.create',
    entityType: 'community',
    entityId: community.id,
    metadata: {
      communityId: community.communityId,
      name: community.name,
      type: community.type
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return community;
};

/**
 * Get community by ID
 */
const getCommunityById = async (communityId, options = {}) => {
  const { 
    includeMembers = false,
    includeOwner = false,
    userAgent = null,
    ipAddress = null,
    requestId = null
  } = options;
  
  const queryOptions = {
    where: { communityId }
  };
  
  if (includeMembers) {
    queryOptions.include = [{ model: CommunityMember, include: [User] }];
  }
  
  if (includeOwner) {
    queryOptions.include = queryOptions.include || [];
    queryOptions.include.push({ model: User, as: 'owner', attributes: ['id', 'username', 'displayName'] });
  }
  
  const community = await Community.findOne(queryOptions);
  
  if (!community) {
    throw new NotFoundError('Community not found');
  }
  
  // Log access
  await AuditEvent.create({
    userId: null,
    action: 'community.access',
    entityType: 'community',
    entityId: community.id,
    metadata: {
      communityId: community.communityId,
      includeMembers,
      includeOwner
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return community;
};

/**
 * Get community by name
 */
const getCommunityByName = async (name) => {
  const community = await Community.findOne({
    where: { name: name.toLowerCase() }
  });
  
  if (!community) {
    throw new NotFoundError('Community not found');
  }
  
  return community;
};

/**
 * Get community by ID (short version)
 */
const getCommunity = async (id) => {
  const community = await Community.findByPk(id);
  
  if (!community) {
    throw new NotFoundError('Community not found');
  }
  
  return community;
};

/**
 * List communities
 */
const listCommunities = async (options = {}) => {
  const { 
    type = null,
    category = null,
    ownerId = null,
    isActive = null,
    isVerified = null,
    limit = 50,
    offset = 0,
    sortBy = 'createdAt',
    sortOrder = 'DESC',
    userAgent = null,
    ipAddress = null,
    requestId = null
  } = options;
  
  const where = {};
  
  if (type) where.type = type;
  if (category) where.category = category;
  if (ownerId) where.ownerId = ownerId;
  if (isActive !== null) where.isActive = isActive;
  if (isVerified !== null) where.isVerified = isVerified;
  
  const order = [[sortBy, sortOrder]];
  
  const result = await Community.findAndCountAll({
    where,
    include: [{ model: User, as: 'owner', attributes: ['id', 'username', 'displayName'] }],
    limit,
    offset,
    order
  });
  
  // Log access
  await AuditEvent.create({
    userId: null,
    action: 'community.list',
    entityType: 'community',
    metadata: {
      filters: { type, category, ownerId, isActive, isVerified },
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
 * Update community
 */
const updateCommunity = async (userId, communityId, updates, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const community = await Community.findOne({ where: { communityId } });
  
  if (!community) {
    throw new NotFoundError('Community not found');
  }
  
  // Check ownership or moderator
  const isOwner = community.ownerId === userId;
  const isModerator = await CommunityMember.findOne({
    where: { communityId: community.id, userId, role: { [Op.in]: ['owner', 'moderator'] } }
  });
  
  if (!isOwner && !isModerator) {
    throw new AuthorizationError('Permission denied');
  }
  
  // Prevent updating sensitive fields
  if (!isOwner) {
    delete updates.ownerId;
    delete updates.isVerified;
    delete updates.isActive;
  }
  
  const oldValues = { ...community.toJSON() };
  await community.update(updates);
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'community.update',
    entityType: 'community',
    entityId: community.id,
    metadata: {
      communityId: community.communityId,
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
  
  return community;
};

/**
 * Deactivate community
 */
const deactivateCommunity = async (userId, communityId, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const community = await Community.findOne({ where: { communityId } });
  
  if (!community) {
    throw new NotFoundError('Community not found');
  }
  
  // Check ownership
  if (community.ownerId !== userId) {
    throw new AuthorizationError('Permission denied');
  }
  
  if (!community.isActive) {
    throw new ConflictError('Community is already deactivated');
  }
  
  await community.update({ isActive: false });
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'community.deactivate',
    entityType: 'community',
    entityId: community.id,
    metadata: {
      communityId: community.communityId
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return community;
};

/**
 * Activate community
 */
const activateCommunity = async (userId, communityId, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const community = await Community.findOne({ where: { communityId } });
  
  if (!community) {
    throw new NotFoundError('Community not found');
  }
  
  // Check ownership
  if (community.ownerId !== userId) {
    throw new AuthorizationError('Permission denied');
  }
  
  if (community.isActive) {
    throw new ConflictError('Community is already active');
  }
  
  await community.update({ isActive: true });
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'community.activate',
    entityType: 'community',
    entityId: community.id,
    metadata: {
      communityId: community.communityId
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return community;
};

/**
 * Remove community
 */
const removeCommunity = async (userId, communityId, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const community = await Community.findOne({ where: { communityId } });
  
  if (!community) {
    throw new NotFoundError('Community not found');
  }
  
  // Check ownership
  if (community.ownerId !== userId) {
    throw new AuthorizationError('Permission denied');
  }
  
  // Delete all members
  await CommunityMember.destroy({ where: { communityId: community.id } });
  
  await community.destroy();
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'community.remove',
    entityType: 'community',
    entityId: community.id,
    metadata: {
      communityId: community.communityId
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return { success: true, message: 'Community removed' };
};

// ============================================================================
// COMMUNITY MEMBER METHODS
// ============================================================================

/**
 * Join a community
 */
const joinCommunity = async (userId, communityId, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const community = await Community.findOne({ where: { communityId } });
  
  if (!community) {
    throw new NotFoundError('Community not found');
  }
  
  if (!community.isActive) {
    throw new ConflictError('Community is not active');
  }
  
  // Check if user is already a member
  const existingMember = await CommunityMember.findOne({
    where: { communityId: community.id, userId }
  });
  
  if (existingMember) {
    throw new ConflictError('User is already a member of this community');
  }
  
  // Check if community is private
  if (community.type === 'private') {
    throw new AuthorizationError('This is a private community. Invitation required.');
  }
  
  // Add user as member
  const member = await CommunityMember.create({
    communityId: community.id,
    userId,
    role: 'member',
    joinedAt: new Date()
  });
  
  // Update member count
  await community.increment('memberCount');
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'community.join',
    entityType: 'community',
    entityId: community.id,
    metadata: {
      communityId: community.communityId,
      role: 'member'
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return member;
};

/**
 * Leave a community
 */
const leaveCommunity = async (userId, communityId, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const community = await Community.findOne({ where: { communityId } });
  
  if (!community) {
    throw new NotFoundError('Community not found');
  }
  
  // Check if user is a member
  const member = await CommunityMember.findOne({
    where: { communityId: community.id, userId }
  });
  
  if (!member) {
    throw new ConflictError('User is not a member of this community');
  }
  
  // Prevent owner from leaving
  if (member.role === 'owner') {
    throw new AuthorizationError('Owner cannot leave the community. Transfer ownership first.');
  }
  
  await member.destroy();
  
  // Update member count
  await community.decrement('memberCount');
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'community.leave',
    entityType: 'community',
    entityId: community.id,
    metadata: {
      communityId: community.communityId
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return { success: true, message: 'Left community' };
};

/**
 * Get community members
 */
const getCommunityMembers = async (communityId, options = {}) => {
  const { 
    role = null,
    limit = 50,
    offset = 0,
    userAgent = null,
    ipAddress = null,
    requestId = null
  } = options;
  
  const community = await Community.findOne({ where: { communityId } });
  
  if (!community) {
    throw new NotFoundError('Community not found');
  }
  
  const where = { communityId: community.id };
  
  if (role) where.role = role;
  
  const result = await CommunityMember.findAndCountAll({
    where,
    include: [{ model: User, attributes: ['id', 'username', 'displayName', 'avatarUrl'] }],
    limit,
    offset,
    order: [['joinedAt', 'ASC']]
  });
  
  // Log access
  await AuditEvent.create({
    userId: null,
    action: 'community.members.list',
    entityType: 'community',
    entityId: community.id,
    metadata: {
      communityId: community.communityId,
      filters: { role },
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
 * Get user's communities
 */
const getUserCommunities = async (userId, options = {}) => {
  const { 
    type = null,
    limit = 50,
    offset = 0,
    userAgent = null,
    ipAddress = null,
    requestId = null
  } = options;
  
  const queryOptions = {
    include: [
      {
        model: CommunityMember,
        where: { userId },
        attributes: ['role', 'joinedAt']
      }
    ],
    limit,
    offset,
    order: [['createdAt', 'DESC']]
  };
  
  if (type) {
    queryOptions.where = { type };
  }
  
  const result = await Community.findAndCountAll(queryOptions);
  
  // Log access
  await AuditEvent.create({
    userId,
    action: 'community.list_user',
    entityType: 'community',
    metadata: {
      filters: { type },
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
 * Get community member
 */
const getCommunityMember = async (userId, communityId, targetUserId = null, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const community = await Community.findOne({ where: { communityId } });
  
  if (!community) {
    throw new NotFoundError('Community not found');
  }
  
  const targetUser = targetUserId || userId;
  
  const member = await CommunityMember.findOne({
    where: { communityId: community.id, userId: targetUser },
    include: [User]
  });
  
  if (!member) {
    throw new NotFoundError('Member not found');
  }
  
  // Log access
  await AuditEvent.create({
    userId,
    action: 'community.member.get',
    entityType: 'community',
    entityId: community.id,
    metadata: {
      communityId: community.communityId,
      targetUserId: targetUser
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return member;
};

/**
 * Update community member role
 */
const updateCommunityMemberRole = async (userId, communityId, targetUserId, role, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const community = await Community.findOne({ where: { communityId } });
  
  if (!community) {
    throw new NotFoundError('Community not found');
  }
  
  // Check ownership or moderator
  const isOwner = community.ownerId === userId;
  const isModerator = await CommunityMember.findOne({
    where: { communityId: community.id, userId, role: { [Op.in]: ['owner', 'moderator'] } }
  });
  
  if (!isOwner && !isModerator) {
    throw new AuthorizationError('Permission denied');
  }
  
  // Prevent changing owner role
  if (targetUserId === community.ownerId && role !== 'owner') {
    throw new AuthorizationError('Cannot change owner role');
  }
  
  // Validate role
  const validRoles = ['owner', 'moderator', 'member'];
  if (!validRoles.includes(role)) {
    throw new ValidationError(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
  }
  
  const member = await CommunityMember.findOne({
    where: { communityId: community.id, userId: targetUserId }
  });
  
  if (!member) {
    throw new NotFoundError('Member not found');
  }
  
  await member.update({ role });
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'community.member.update_role',
    entityType: 'community',
    entityId: community.id,
    metadata: {
      communityId: community.communityId,
      targetUserId,
      oldRole: member.role,
      newRole: role
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return member;
};

/**
 * Remove community member
 */
const removeCommunityMember = async (userId, communityId, targetUserId, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const community = await Community.findOne({ where: { communityId } });
  
  if (!community) {
    throw new NotFoundError('Community not found');
  }
  
  // Check ownership or moderator
  const isOwner = community.ownerId === userId;
  const isModerator = await CommunityMember.findOne({
    where: { communityId: community.id, userId, role: { [Op.in]: ['owner', 'moderator'] } }
  });
  
  if (!isOwner && !isModerator) {
    throw new AuthorizationError('Permission denied');
  }
  
  // Prevent removing owner
  if (targetUserId === community.ownerId) {
    throw new AuthorizationError('Cannot remove owner. Transfer ownership first.');
  }
  
  // Prevent removing self
  if (targetUserId === userId) {
    throw new AuthorizationError('Cannot remove yourself. Use leave endpoint instead.');
  }
  
  const member = await CommunityMember.findOne({
    where: { communityId: community.id, userId: targetUserId }
  });
  
  if (!member) {
    throw new NotFoundError('Member not found');
  }
  
  await member.destroy();
  
  // Update member count
  await community.decrement('memberCount');
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'community.member.remove',
    entityType: 'community',
    entityId: community.id,
    metadata: {
      communityId: community.communityId,
      targetUserId
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return { success: true, message: 'Member removed' };
};

/**
 * Transfer community ownership
 */
const transferCommunityOwnership = async (userId, communityId, newOwnerId, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const community = await Community.findOne({ where: { communityId } });
  
  if (!community) {
    throw new NotFoundError('Community not found');
  }
  
  // Check ownership
  if (community.ownerId !== userId) {
    throw new AuthorizationError('Permission denied');
  }
  
  // Check if new owner is a member
  const newOwnerMember = await CommunityMember.findOne({
    where: { communityId: community.id, userId: newOwnerId }
  });
  
  if (!newOwnerMember) {
    throw new NotFoundError('New owner is not a member of this community');
  }
  
  // Update community owner
  await community.update({ ownerId: newOwnerId });
  
  // Update member roles
  await CommunityMember.update(
    { role: 'member' },
    { where: { communityId: community.id, userId } }
  );
  
  await newOwnerMember.update({ role: 'owner' });
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'community.transfer_ownership',
    entityType: 'community',
    entityId: community.id,
    metadata: {
      communityId: community.communityId,
      oldOwnerId: userId,
      newOwnerId
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return community;
};

/**
 * Search communities
 */
const searchCommunities = async (query, options = {}) => {
  const { 
    limit = 20,
    offset = 0,
    userAgent = null,
    ipAddress = null,
    requestId = null
  } = options;
  
  const where = {
    isActive: true,
    [Op.or]: [
      { name: { [Op.iLike]: `%${query}%` } },
      { displayName: { [Op.iLike]: `%${query}%` } },
      { description: { [Op.iLike]: `%${query}%` } },
      { communityId: { [Op.iLike]: `%${query}%` } },
      { category: { [Op.iLike]: `%${query}%` } }
    ]
  };
  
  const result = await Community.findAndCountAll({
    where,
    include: [{ model: User, as: 'owner', attributes: ['id', 'username', 'displayName'] }],
    limit,
    offset,
    order: [['memberCount', 'DESC']]
  });
  
  // Log search
  await AuditEvent.create({
    userId: null,
    action: 'community.search',
    entityType: 'community',
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
 * Get community statistics
 */
const getCommunityStats = async (communityId, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const community = await Community.findOne({
    where: { communityId },
    include: [
      { model: CommunityMember, include: [User] },
      { model: User, as: 'owner' }
    ]
  });
  
  if (!community) {
    throw new NotFoundError('Community not found');
  }
  
  const stats = {
    community: community.toJSON(),
    members: {
      total: community.CommunityMembers.length,
      owners: community.CommunityMembers.filter(m => m.role === 'owner').length,
      moderators: community.CommunityMembers.filter(m => m.role === 'moderator').length,
      members: community.CommunityMembers.filter(m => m.role === 'member').length
    }
  };
  
  // Log access
  await AuditEvent.create({
    userId: null,
    action: 'community.stats',
    entityType: 'community',
    entityId: community.id,
    metadata: {
      communityId: community.communityId,
      memberCount: stats.members.total
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return stats;
};

/**
 * Get trending communities
 */
const getTrendingCommunities = async (options = {}) => {
  const { 
    limit = 10,
    userAgent = null,
    ipAddress = null,
    requestId = null
  } = options;
  
  const communities = await Community.findAll({
    where: { isActive: true, isVerified: true },
    include: [
      { model: User, as: 'owner', attributes: ['id', 'username', 'displayName'] },
      { model: CommunityMember, attributes: ['id'] }
    ],
    limit,
    order: [
      ['memberCount', 'DESC'],
      ['createdAt', 'DESC']
    ]
  });
  
  // Log access
  await AuditEvent.create({
    userId: null,
    action: 'community.trending',
    entityType: 'community',
    metadata: {
      results: communities.length
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return {
    data: communities,
    limit
  };
};

/**
 * Verify community
 */
const verifyCommunity = async (userId, communityId, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const community = await Community.findOne({ where: { communityId } });
  
  if (!community) {
    throw new NotFoundError('Community not found');
  }
  
  if (community.isVerified) {
    throw new ConflictError('Community is already verified');
  }
  
  await community.update({ isVerified: true });
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'community.verify',
    entityType: 'community',
    entityId: community.id,
    metadata: {
      communityId: community.communityId
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return community;
};

/**
 * Get community categories
 */
const getCommunityCategories = async () => {
  const communities = await Community.findAll({
    attributes: ['category'],
    group: ['category']
  });
  
  return communities.map(c => c.category).filter(c => c);
};

module.exports = {
  generateCommunityId,
  // Community methods
  createCommunity,
  getCommunityById,
  getCommunityByName,
  getCommunity,
  listCommunities,
  updateCommunity,
  deactivateCommunity,
  activateCommunity,
  removeCommunity,
  // Member methods
  joinCommunity,
  leaveCommunity,
  getCommunityMembers,
  getUserCommunities,
  getCommunityMember,
  updateCommunityMemberRole,
  removeCommunityMember,
  transferCommunityOwnership,
  // Utility methods
  searchCommunities,
  getCommunityStats,
  getTrendingCommunities,
  verifyCommunity,
  getCommunityCategories
};
