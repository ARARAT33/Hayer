/**
 * HAYER ID Service
 * Manages HAYER ID lifecycle, federation, and integration
 */

const crypto = require('crypto');
const { Op } = require('sequelize');
const config = require('../config');
const { HayerId, User, Profile, Credential, AuditEvent } = require('../models');
const { 
  NotFoundError, 
  ConflictError,
  ValidationError,
  AuthenticationError
} = require('../middleware/errorHandler');
const { generateToken, hashData } = require('../middleware/authentication');
const { isValidHayerId, isValidUsername } = require('../utils/validation');

/**
 * Generate a unique HAYER ID
 * Format: HAYER-[A-Z0-9]{8-12}
 */
const generateHayerId = async () => {
  const prefix = 'HAYER';
  const length = 10;
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  
  let hayerId;
  let exists;
  
  do {
    const randomPart = Array.from({ length }, () => 
      chars.charAt(Math.floor(Math.random() * chars.length))
    ).join('');
    hayerId = `${prefix}-${randomPart}`;
    exists = await HayerId.findOne({ where: { hayerId } });
  } while (exists);
  
  return hayerId;
};

/**
 * Generate a deterministic HAYER ID from username
 * Used for creating predictable HAYER IDs
 */
const generateDeterministicHayerId = async (username) => {
  const prefix = 'HAYER';
  const hash = crypto.createHash('sha256').update(username).digest('hex');
  const randomPart = hash.substring(0, 10).toUpperCase();
  
  let hayerId = `${prefix}-${randomPart}`;
  
  // Check if exists and append suffix if needed
  let exists = await HayerId.findOne({ where: { hayerId } });
  let suffix = 0;
  
  while (exists) {
    suffix++;
    hayerId = `${prefix}-${randomPart}-${suffix}`;
    exists = await HayerId.findOne({ where: { hayerId } });
  }
  
  return hayerId;
};

/**
 * Create a new HAYER ID for a user
 */
const createHayerId = async (userId, options = {}) => {
  const { 
    customHayerId = null, 
    isPrimary = true, 
    isActive = true,
    userAgent = null,
    ipAddress = null,
    requestId = null
  } = options;
  
  // Validate user exists
  const user = await User.findByPk(userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  
  // Check if user already has a primary HAYER ID
  if (isPrimary) {
    const existingPrimary = await HayerId.findOne({
      where: { userId, isPrimary: true }
    });
    if (existingPrimary) {
      throw new ConflictError('User already has a primary HAYER ID');
    }
  }
  
  // Generate or use custom HAYER ID
  let hayerIdValue;
  if (customHayerId) {
    if (!isValidHayerId(customHayerId)) {
      throw new ValidationError('Invalid HAYER ID format');
    }
    
    const existing = await HayerId.findOne({ where: { hayerId: customHayerId } });
    if (existing) {
      throw new ConflictError('HAYER ID already exists');
    }
    hayerIdValue = customHayerId;
  } else {
    hayerIdValue = await generateHayerId();
  }
  
  // Create the HAYER ID
  const hayerId = await HayerId.create({
    userId,
    hayerId: hayerIdValue,
    isPrimary,
    isActive
  });
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'hayer_id.create',
    entityType: 'hayer_id',
    entityId: hayerId.id,
    metadata: {
      hayerId: hayerIdValue,
      isPrimary,
      isActive
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return hayerId;
};

/**
 * Get HAYER ID by user ID
 */
const getHayerIdByUserId = async (userId) => {
  const hayerId = await HayerId.findOne({
    where: { userId, isActive: true },
    include: [
      {
        model: User,
        attributes: ['id', 'username', 'email', 'displayName', 'isVerified']
      }
    ]
  });
  
  if (!hayerId) {
    throw new NotFoundError('HAYER ID not found for user');
  }
  
  return hayerId;
};

/**
 * Get HAYER ID by HAYER ID string
 */
const getHayerIdById = async (hayerIdValue) => {
  const hayerId = await HayerId.findOne({
    where: { hayerId: hayerIdValue, isActive: true },
    include: [
      {
        model: User,
        attributes: ['id', 'username', 'email', 'displayName', 'isVerified']
      }
    ]
  });
  
  if (!hayerId) {
    throw new NotFoundError('HAYER ID not found');
  }
  
  return hayerId;
};

/**
 * Get all HAYER IDs for a user
 */
const getAllHayerIdsForUser = async (userId) => {
  const hayerIds = await HayerId.findAll({
    where: { userId },
    order: [['isPrimary', 'DESC'], ['createdAt', 'ASC']]
  });
  
  return hayerIds;
};

/**
 * Update HAYER ID settings
 */
const updateHayerId = async (userId, hayerIdValue, updates, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const hayerId = await HayerId.findOne({
    where: { hayerId: hayerIdValue, userId }
  });
  
  if (!hayerId) {
    throw new NotFoundError('HAYER ID not found');
  }
  
  // Prevent changing primary status if another primary exists
  if (updates.isPrimary === true) {
    const existingPrimary = await HayerId.findOne({
      where: { userId, isPrimary: true, id: { [Op.ne]: hayerId.id } }
    });
    if (existingPrimary) {
      throw new ConflictError('Another primary HAYER ID exists for this user');
    }
  }
  
  const oldValues = { ...hayerId.toJSON() };
  await hayerId.update(updates);
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'hayer_id.update',
    entityType: 'hayer_id',
    entityId: hayerId.id,
    metadata: {
      hayerId: hayerIdValue,
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
  
  return hayerId;
};

/**
 * Deactivate a HAYER ID
 */
const deactivateHayerId = async (userId, hayerIdValue, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const hayerId = await HayerId.findOne({
    where: { hayerId: hayerIdValue, userId }
  });
  
  if (!hayerId) {
    throw new NotFoundError('HAYER ID not found');
  }
  
  // Prevent deactivating primary HAYER ID if it's the only one
  if (hayerId.isPrimary) {
    const otherHayerIds = await HayerId.count({
      where: { userId, id: { [Op.ne]: hayerId.id } }
    });
    if (otherHayerIds === 0) {
      throw new ValidationError('Cannot deactivate the only HAYER ID for a user');
    }
  }
  
  await hayerId.update({ isActive: false });
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'hayer_id.deactivate',
    entityType: 'hayer_id',
    entityId: hayerId.id,
    metadata: {
      hayerId: hayerIdValue,
      wasPrimary: hayerId.isPrimary
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return hayerId;
};

/**
 * Set a HAYER ID as primary
 */
const setPrimaryHayerId = async (userId, hayerIdValue, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const hayerId = await HayerId.findOne({
    where: { hayerId: hayerIdValue, userId, isActive: true }
  });
  
  if (!hayerId) {
    throw new NotFoundError('HAYER ID not found or inactive');
  }
  
  // Update all HAYER IDs for this user
  await HayerId.update(
    { isPrimary: false },
    { where: { userId } }
  );
  
  await hayerId.update({ isPrimary: true });
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'hayer_id.set_primary',
    entityType: 'hayer_id',
    entityId: hayerId.id,
    metadata: {
      hayerId: hayerIdValue
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return hayerId;
};

/**
 * Verify HAYER ID ownership
 */
const verifyHayerIdOwnership = async (userId, hayerIdValue) => {
  const hayerId = await HayerId.findOne({
    where: { hayerId: hayerIdValue, userId, isActive: true }
  });
  
  return !!hayerId;
};

/**
 * Get HAYER ID by username
 */
const getHayerIdByUsername = async (username) => {
  const user = await User.findOne({
    where: { username },
    include: [
      {
        model: HayerId,
        where: { isActive: true },
        required: false
      }
    ]
  });
  
  if (!user || !user.HayerIds || user.HayerIds.length === 0) {
    throw new NotFoundError('No active HAYER ID found for username');
  }
  
  return user.HayerIds[0];
};

/**
 * Get HAYER ID by email
 */
const getHayerIdByEmail = async (email) => {
  const user = await User.findOne({
    where: { email },
    include: [
      {
        model: HayerId,
        where: { isActive: true },
        required: false
      }
    ]
  });
  
  if (!user || !user.HayerIds || user.HayerIds.length === 0) {
    throw new NotFoundError('No active HAYER ID found for email');
  }
  
  return user.HayerIds[0];
};

/**
 * Search HAYER IDs
 */
const searchHayerIds = async (query, options = {}) => {
  const { limit = 20, offset = 0, userAgent = null, ipAddress = null, requestId = null } = options;
  
  const where = {};
  
  if (query) {
    where[Op.or] = [
      { hayerId: { [Op.iLike]: `%${query}%` } },
      { '$User.username$': { [Op.iLike]: `%${query}%` } },
      { '$User.displayName$': { [Op.iLike]: `%${query}%` } }
    ];
  }
  
  where.isActive = true;
  
  const result = await HayerId.findAndCountAll({
    where,
    include: [
      {
        model: User,
        attributes: ['id', 'username', 'displayName', 'email']
      }
    ],
    limit,
    offset,
    order: [['hayerId', 'ASC']]
  });
  
  // Log search to audit trail
  await AuditEvent.create({
    userId: null,
    action: 'hayer_id.search',
    entityType: 'hayer_id',
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
 * Generate a federation token for HAYER ID
 */
const generateFederationToken = async (userId, hayerIdValue, options = {}) => {
  const { expiresIn = '7d', userAgent = null, ipAddress = null, requestId = null } = options;
  
  const hayerId = await HayerId.findOne({
    where: { hayerId: hayerIdValue, userId, isActive: true }
  });
  
  if (!hayerId) {
    throw new NotFoundError('HAYER ID not found');
  }
  
  const token = generateToken(
    { userId, hayerId: hayerIdValue, purpose: 'federation' },
    config.jwt.federationSecret,
    { expiresIn }
  );
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'hayer_id.federation_token_generated',
    entityType: 'hayer_id',
    entityId: hayerId.id,
    metadata: {
      hayerId: hayerIdValue,
      expiresIn
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return {
    token,
    expiresAt: new Date(Date.now() + (expiresIn === '7d' ? 7 * 24 * 60 * 60 * 1000 : 0))
  };
};

/**
 * Verify a federation token
 */
const verifyFederationToken = async (token) => {
  try {
    const decoded = require('jsonwebtoken').verify(
      token,
      config.jwt.federationSecret
    );
    
    if (decoded.purpose !== 'federation') {
      throw new AuthenticationError('Invalid token purpose');
    }
    
    const hayerId = await HayerId.findOne({
      where: { hayerId: decoded.hayerId, userId: decoded.userId, isActive: true }
    });
    
    if (!hayerId) {
      throw new NotFoundError('HAYER ID not found or inactive');
    }
    
    return {
      valid: true,
      userId: decoded.userId,
      hayerId: decoded.hayerId,
      hayerIdRecord: hayerId
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message
    };
  }
};

/**
 * Get HAYER ID statistics
 */
const getHayerIdStats = async () => {
  const total = await HayerId.count();
  const active = await HayerId.count({ where: { isActive: true } });
  const primary = await HayerId.count({ where: { isPrimary: true } });
  const uniqueUsers = await HayerId.count({ 
    distinct: true, 
    col: 'userId' 
  });
  
  return {
    total,
    active,
    primary,
    uniqueUsers,
    inactive: total - active
  };
};

module.exports = {
  generateHayerId,
  generateDeterministicHayerId,
  createHayerId,
  getHayerIdByUserId,
  getHayerIdById,
  getAllHayerIdsForUser,
  updateHayerId,
  deactivateHayerId,
  setPrimaryHayerId,
  verifyHayerIdOwnership,
  getHayerIdByUsername,
  getHayerIdByEmail,
  searchHayerIds,
  generateFederationToken,
  verifyFederationToken,
  getHayerIdStats
};
