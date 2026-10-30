/**
 * Operator Service
 * Manages node operators, their resources, and permissions
 */

const crypto = require('crypto');
const { Op } = require('sequelize');
const config = require('../config');
const { Operator, Node, User, AuditEvent } = require('../models');
const { 
  NotFoundError, 
  ConflictError,
  ValidationError,
  AuthenticationError,
  AuthorizationError
} = require('../middleware/errorHandler');
const { generateToken } = require('../middleware/authentication');

/**
 * Generate unique operator ID
 */
const generateOperatorId = async () => {
  let operatorId;
  let exists;
  
  do {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    operatorId = `OP-${Array.from({ length: 8 }, () => 
      chars.charAt(Math.floor(Math.random() * chars.length))
    ).join('')}`;
    exists = await Operator.findOne({ where: { operatorId } });
  } while (exists);
  
  return operatorId;
};

/**
 * Generate operator API key
 */
const generateApiKey = () => {
  const key = crypto.randomBytes(32).toString('base64');
  const secret = crypto.randomBytes(64).toString('base64');
  return { key, secret };
};

/**
 * Create a new operator
 */
const createOperator = async (userId, data, options = {}) => {
  const { 
    name,
    description,
    website,
    contactEmail,
    isVerified = false,
    isTrusted = false,
    quota = null,
    metadata = {},
    userAgent = null,
    ipAddress = null,
    requestId = null
  } = data;
  
  // Validate user
  const user = await User.findByPk(userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  
  // Check if user already has an operator
  const existingOperator = await Operator.findOne({ where: { userId } });
  if (existingOperator) {
    throw new ConflictError('User already has an operator account');
  }
  
  // Generate operator ID
  const operatorId = await generateOperatorId();
  
  // Generate API key
  const apiKey = generateApiKey();
  
  // Create operator
  const operator = await Operator.create({
    userId,
    operatorId,
    name: name || user.displayName || user.username,
    description,
    website,
    contactEmail: contactEmail || user.email,
    publicKey: null,
    status: 'active',
    isVerified,
    isTrusted,
    quota: quota || {
      nodes: null,
      storage: null,
      bandwidth: null
    },
    metadata,
    apiKey: apiKey.key,
    apiSecret: apiKey.secret
  });
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'operator.create',
    entityType: 'operator',
    entityId: operator.id,
    metadata: {
      operatorId: operator.operatorId,
      name: operator.name
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return {
    operator,
    apiKey: apiKey.key,
    apiSecret: apiKey.secret // In production, this should be encrypted or only shown once
  };
};

/**
 * Get operator by ID
 */
const getOperatorById = async (operatorId, options = {}) => {
  const { includeNodes = false, userAgent = null, ipAddress = null, requestId = null } = options;
  
  const queryOptions = {
    where: { operatorId }
  };
  
  if (includeNodes) {
    queryOptions.include = [{ model: Node }];
  }
  
  const operator = await Operator.findOne(queryOptions);
  
  if (!operator) {
    throw new NotFoundError('Operator not found');
  }
  
  // Log access
  await AuditEvent.create({
    userId: operator.userId,
    action: 'operator.access',
    entityType: 'operator',
    entityId: operator.id,
    metadata: {
      operatorId: operator.operatorId,
      includeNodes
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return operator;
};

/**
 * Get operator by user ID
 */
const getOperatorByUserId = async (userId) => {
  const operator = await Operator.findOne({ where: { userId } });
  
  if (!operator) {
    throw new NotFoundError('Operator not found for user');
  }
  
  return operator;
};

/**
 * Get operator by ID (short version)
 */
const getOperator = async (id) => {
  const operator = await Operator.findByPk(id);
  
  if (!operator) {
    throw new NotFoundError('Operator not found');
  }
  
  return operator;
};

/**
 * List all operators
 */
const listOperators = async (options = {}) => {
  const { 
    userId = null,
    status = null,
    isVerified = null,
    isTrusted = null,
    limit = 50,
    offset = 0,
    sortBy = 'createdAt',
    sortOrder = 'DESC',
    userAgent = null,
    ipAddress = null,
    requestId = null
  } = options;
  
  const where = {};
  
  if (userId) where.userId = userId;
  if (status) where.status = status;
  if (isVerified !== null) where.isVerified = isVerified;
  if (isTrusted !== null) where.isTrusted = isTrusted;
  
  const order = [[sortBy, sortOrder]];
  
  const result = await Operator.findAndCountAll({
    where,
    include: [{ model: User, attributes: ['id', 'username', 'email', 'displayName'] }],
    limit,
    offset,
    order
  });
  
  // Log access
  await AuditEvent.create({
    userId: null,
    action: 'operator.list',
    entityType: 'operator',
    metadata: {
      filters: { userId, status, isVerified, isTrusted },
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
 * Update operator information
 */
const updateOperator = async (userId, operatorId, updates, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const operator = await Operator.findOne({ where: { operatorId, userId } });
  
  if (!operator) {
    throw new NotFoundError('Operator not found');
  }
  
  const oldValues = { ...operator.toJSON() };
  
  // Prevent updating sensitive fields
  delete updates.apiKey;
  delete updates.apiSecret;
  delete updates.userId;
  delete updates.operatorId;
  
  await operator.update(updates);
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'operator.update',
    entityType: 'operator',
    entityId: operator.id,
    metadata: {
      operatorId: operator.operatorId,
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
  
  return operator;
};

/**
 * Verify operator
 */
const verifyOperator = async (operatorId, options = {}) => {
  const { userId = null, userAgent = null, ipAddress = null, requestId = null } = options;
  
  const operator = await Operator.findOne({ where: { operatorId } });
  
  if (!operator) {
    throw new NotFoundError('Operator not found');
  }
  
  if (operator.isVerified) {
    throw new ConflictError('Operator is already verified');
  }
  
  await operator.update({ isVerified: true });
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'operator.verify',
    entityType: 'operator',
    entityId: operator.id,
    metadata: {
      operatorId: operator.operatorId
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return operator;
};

/**
 * Set operator as trusted
 */
const setTrustedOperator = async (operatorId, trusted, options = {}) => {
  const { userId = null, userAgent = null, ipAddress = null, requestId = null } = options;
  
  const operator = await Operator.findOne({ where: { operatorId } });
  
  if (!operator) {
    throw new NotFoundError('Operator not found');
  }
  
  await operator.update({ isTrusted: trusted });
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: trusted ? 'operator.trust' : 'operator.untrust',
    entityType: 'operator',
    entityId: operator.id,
    metadata: {
      operatorId: operator.operatorId,
      trusted
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return operator;
};

/**
 * Suspend operator
 */
const suspendOperator = async (operatorId, reason, options = {}) => {
  const { userId = null, userAgent = null, ipAddress = null, requestId = null } = options;
  
  const operator = await Operator.findOne({ where: { operatorId } });
  
  if (!operator) {
    throw new NotFoundError('Operator not found');
  }
  
  await operator.update({
    status: 'suspended',
    suspensionReason: reason
  });
  
  // Suspend all nodes owned by this operator
  await Node.update(
    { isActive: false, status: 'suspended' },
    { where: { operatorId: operator.id } }
  );
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'operator.suspend',
    entityType: 'operator',
    entityId: operator.id,
    metadata: {
      operatorId: operator.operatorId,
      reason
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return operator;
};

/**
 * Reactivate operator
 */
const reactivateOperator = async (operatorId, options = {}) => {
  const { userId = null, userAgent = null, ipAddress = null, requestId = null } = options;
  
  const operator = await Operator.findOne({ where: { operatorId } });
  
  if (!operator) {
    throw new NotFoundError('Operator not found');
  }
  
  await operator.update({
    status: 'active',
    suspensionReason: null
  });
  
  // Reactivate all nodes owned by this operator
  await Node.update(
    { isActive: true, status: 'active' },
    { where: { operatorId: operator.id } }
  );
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'operator.reactivate',
    entityType: 'operator',
    entityId: operator.id,
    metadata: {
      operatorId: operator.operatorId
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return operator;
};

/**
 * Remove operator
 */
const removeOperator = async (operatorId, options = {}) => {
  const { userId = null, userAgent = null, ipAddress = null, requestId = null } = options;
  
  const operator = await Operator.findOne({ where: { operatorId } });
  
  if (!operator) {
    throw new NotFoundError('Operator not found');
  }
  
  // Check if operator has active nodes
  const nodeCount = await Node.count({
    where: { operatorId: operator.id, isActive: true }
  });
  
  if (nodeCount > 0) {
    throw new ConflictError('Cannot remove operator with active nodes. Suspend or remove nodes first.');
  }
  
  await operator.destroy();
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'operator.remove',
    entityType: 'operator',
    entityId: operator.id,
    metadata: {
      operatorId: operator.operatorId
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return { success: true, message: 'Operator removed' };
};

/**
 * Regenerate API key
 */
const regenerateApiKey = async (userId, operatorId, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const operator = await Operator.findOne({ where: { operatorId, userId } });
  
  if (!operator) {
    throw new NotFoundError('Operator not found');
  }
  
  const apiKey = generateApiKey();
  
  await operator.update({
    apiKey: apiKey.key,
    apiSecret: apiKey.secret
  });
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'operator.regenerate_api_key',
    entityType: 'operator',
    entityId: operator.id,
    metadata: {
      operatorId: operator.operatorId
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return {
    apiKey: apiKey.key,
    apiSecret: apiKey.secret // In production, this should be encrypted or only shown once
  };
};

/**
 * Set operator public key
 */
const setOperatorPublicKey = async (userId, operatorId, publicKey, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const operator = await Operator.findOne({ where: { operatorId, userId } });
  
  if (!operator) {
    throw new NotFoundError('Operator not found');
  }
  
  await operator.update({ publicKey });
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'operator.set_public_key',
    entityType: 'operator',
    entityId: operator.id,
    metadata: {
      operatorId: operator.operatorId,
      publicKey: publicKey ? '***SET***' : null
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return operator;
};

/**
 * Get operator statistics
 */
const getOperatorStats = async (operatorId, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const operator = await Operator.findOne({ where: { operatorId } });
  
  if (!operator) {
    throw new NotFoundError('Operator not found');
  }
  
  const totalNodes = await Node.count({ where: { operatorId: operator.id } });
  const activeNodes = await Node.count({ where: { operatorId: operator.id, isActive: true } });
  const approvedNodes = await Node.count({ where: { operatorId: operator.id, isApproved: true } });
  const totalStorage = await Node.sum('resources.storage.total', { where: { operatorId: operator.id } });
  const usedStorage = await Node.sum('resources.storage.used', { where: { operatorId: operator.id } });
  
  const stats = {
    operator: operator.toJSON(),
    nodes: {
      total: totalNodes,
      active: activeNodes,
      approved: approvedNodes,
      suspended: totalNodes - activeNodes
    },
    storage: {
      total: totalStorage || 0,
      used: usedStorage || 0,
      available: (totalStorage || 0) - (usedStorage || 0)
    }
  };
  
  // Log access
  await AuditEvent.create({
    userId: operator.userId,
    action: 'operator.stats',
    entityType: 'operator',
    entityId: operator.id,
    metadata: {
      operatorId: operator.operatorId,
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
 * Get operator dashboard data
 */
const getOperatorDashboard = async (operatorId, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const operator = await Operator.findOne({
    where: { operatorId },
    include: [
      {
        model: Node,
        include: [Replica]
      }
    ]
  });
  
  if (!operator) {
    throw new NotFoundError('Operator not found');
  }
  
  // Calculate statistics
  const stats = {
    operator: operator.toJSON(),
    nodes: operator.Nodes.map(node => ({
      ...node.toJSON(),
      replicaCount: node.Replicas.length
    })),
    totalReplicas: operator.Nodes.reduce((sum, node) => sum + node.Replicas.length, 0)
  };
  
  // Log access
  await AuditEvent.create({
    userId: operator.userId,
    action: 'operator.dashboard',
    entityType: 'operator',
    entityId: operator.id,
    metadata: {
      operatorId: operator.operatorId
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return stats;
};

/**
 * Search operators
 */
const searchOperators = async (query, options = {}) => {
  const { 
    limit = 20,
    offset = 0,
    userAgent = null,
    ipAddress = null,
    requestId = null
  } = options;
  
  const where = {
    [Op.or]: [
      { operatorId: { [Op.iLike]: `%${query}%` } },
      { name: { [Op.iLike]: `%${query}%` } },
      { description: { [Op.iLike]: `%${query}%` } },
      { website: { [Op.iLike]: `%${query}%` } },
      { contactEmail: { [Op.iLike]: `%${query}%` } }
    ]
  };
  
  const result = await Operator.findAndCountAll({
    where,
    limit,
    offset,
    order: [['createdAt', 'DESC']]
  });
  
  // Log search
  await AuditEvent.create({
    userId: null,
    action: 'operator.search',
    entityType: 'operator',
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
 * Get operator by API key
 */
const getOperatorByApiKey = async (apiKey) => {
  const operator = await Operator.findOne({
    where: { apiKey }
  });
  
  if (!operator) {
    throw new AuthenticationError('Invalid API key', {}, 'INVALID_API_KEY');
  }
  
  if (operator.status !== 'active') {
    throw new AuthenticationError('Operator is not active', {}, 'OPERATOR_NOT_ACTIVE');
  }
  
  return operator;
};

/**
 * Verify API key
 */
const verifyApiKey = async (apiKey, apiSecret) => {
  const operator = await Operator.findOne({
    where: { apiKey, apiSecret }
  });
  
  if (!operator) {
    return { valid: false, error: 'Invalid API key or secret' };
  }
  
  if (operator.status !== 'active') {
    return { valid: false, error: 'Operator is not active' };
  }
  
  return { valid: true, operator };
};

/**
 * Get all operators statistics
 */
const getAllOperatorsStats = async () => {
  const total = await Operator.count();
  const active = await Operator.count({ where: { status: 'active' } });
  const verified = await Operator.count({ where: { isVerified: true } });
  const trusted = await Operator.count({ where: { isTrusted: true } });
  const suspended = await Operator.count({ where: { status: 'suspended' } });
  
  return {
    total,
    active,
    verified,
    trusted,
    suspended,
    pending: total - active - suspended
  };
};

module.exports = {
  generateOperatorId,
  generateApiKey,
  createOperator,
  getOperatorById,
  getOperatorByUserId,
  getOperator,
  listOperators,
  updateOperator,
  verifyOperator,
  setTrustedOperator,
  suspendOperator,
  reactivateOperator,
  removeOperator,
  regenerateApiKey,
  setOperatorPublicKey,
  getOperatorStats,
  getOperatorDashboard,
  searchOperators,
  getOperatorByApiKey,
  verifyApiKey,
  getAllOperatorsStats
};
