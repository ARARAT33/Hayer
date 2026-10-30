/**
 * Node Service
 * Manages node registration, health monitoring, resource management, and replication
 */

const crypto = require('crypto');
const { Op } = require('sequelize');
const config = require('../config');
const { Node, Operator, StorageObject, StorageChunk, Replica, AuditEvent, User } = require('../models');
const { 
  NotFoundError, 
  ConflictError,
  ValidationError,
  AuthenticationError,
  AuthorizationError
} = require('../middleware/errorHandler');
const { generateToken } = require('../middleware/authentication');

/**
 * Generate unique node ID
 */
const generateNodeId = async () => {
  let nodeId;
  let exists;
  
  do {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    nodeId = `NODE-${Array.from({ length: 8 }, () => 
      chars.charAt(Math.floor(Math.random() * chars.length))
    ).join('')}`;
    exists = await Node.findOne({ where: { nodeId } });
  } while (exists);
  
  return nodeId;
};

/**
 * Generate node registration token
 */
const generateRegistrationToken = async (operatorId, options = {}) => {
  const { expiresIn = '7d', userAgent = null, ipAddress = null, requestId = null } = options;
  
  const operator = await Operator.findByPk(operatorId);
  if (!operator) {
    throw new NotFoundError('Operator not found');
  }
  
  const token = crypto.randomBytes(64).toString('hex');
  const expiresAt = new Date(Date.now() + (expiresIn === '7d' ? 7 * 24 * 60 * 60 * 1000 : 0));
  
  await operator.update({
    registrationToken: token,
    registrationTokenExpires: expiresAt
  });
  
  await AuditEvent.create({
    userId: operator.userId,
    action: 'node.registration_token_generated',
    entityType: 'operator',
    entityId: operator.id,
    metadata: {
      operatorId: operator.operatorId,
      expiresAt
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return { token, expiresAt };
};

/**
 * Register a new node
 */
const registerNode = async (data, options = {}) => {
  const { 
    operatorId, 
    registrationToken,
    name, 
    description,
    hostname,
    ipAddresses = [],
    publicUrl,
    capabilities = [],
    resources = {},
    location = {},
    metadata = {},
    userAgent = null,
    ipAddress = null,
    requestId = null
  } = data;
  
  // Validate operator and token
  const operator = await Operator.findByPk(operatorId);
  if (!operator) {
    throw new NotFoundError('Operator not found');
  }
  
  if (operator.registrationToken !== registrationToken) {
    throw new AuthenticationError('Invalid registration token', {}, 'INVALID_REGISTRATION_TOKEN');
  }
  
  if (operator.registrationTokenExpires && operator.registrationTokenExpires < new Date()) {
    throw new AuthenticationError('Registration token expired', {}, 'REGISTRATION_TOKEN_EXPIRED');
  }
  
  // Validate capabilities
  const validCapabilities = ['storage', 'compute', 'proxy', 'database', 'cache', 'cdn'];
  const invalidCapabilities = capabilities.filter(c => !validCapabilities.includes(c));
  if (invalidCapabilities.length > 0) {
    throw new ValidationError(`Invalid capabilities: ${invalidCapabilities.join(', ')}`);
  }
  
  // Generate node ID
  const nodeId = await generateNodeId();
  
  // Create node
  const node = await Node.create({
    operatorId,
    nodeId,
    name: name || hostname,
    description,
    hostname,
    ipAddresses,
    publicUrl,
    capabilities,
    resources: {
      cpu: resources.cpu || { total: 0, used: 0 },
      memory: resources.memory || { total: 0, used: 0 },
      storage: resources.storage || { total: 0, used: 0 },
      bandwidth: resources.bandwidth || { total: 0, used: 0 }
    },
    quota: {
      storage: null,
      bandwidth: null,
      connections: null
    },
    location,
    failureDomain: `${operator.operatorId}-${crypto.randomBytes(4).toString('hex')}`,
    status: 'pending',
    isApproved: false,
    isPublic: false,
    isActive: true,
    metadata
  });
  
  // Clear registration token
  await operator.update({
    registrationToken: null,
    registrationTokenExpires: null
  });
  
  // Log to audit trail
  await AuditEvent.create({
    userId: operator.userId,
    action: 'node.register',
    entityType: 'node',
    entityId: node.id,
    metadata: {
      nodeId: node.nodeId,
      name: node.name,
      capabilities: node.capabilities,
      operatorId: operator.operatorId
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return node;
};

/**
 * Get node by ID
 */
const getNodeById = async (nodeId, options = {}) => {
  const { includeDetails = false, userAgent = null, ipAddress = null, requestId = null } = options;
  
  const queryOptions = {
    where: { nodeId }
  };
  
  if (includeDetails) {
    queryOptions.include = [
      { model: Operator },
      { model: Replica, include: [{ model: StorageChunk, include: [StorageObject] }] }
    ];
  }
  
  const node = await Node.findOne(queryOptions);
  
  if (!node) {
    throw new NotFoundError('Node not found');
  }
  
  // Log access
  await AuditEvent.create({
    userId: null,
    action: 'node.access',
    entityType: 'node',
    entityId: node.id,
    metadata: {
      nodeId: node.nodeId,
      includeDetails
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return node;
};

/**
 * Get node by nodeId string
 */
const getNodeByNodeId = async (nodeId) => {
  const node = await Node.findOne({ where: { nodeId } });
  
  if (!node) {
    throw new NotFoundError('Node not found');
  }
  
  return node;
};

/**
 * List all nodes
 */
const listNodes = async (options = {}) => {
  const { 
    operatorId = null,
    status = null,
    isActive = null,
    isApproved = null,
    isPublic = null,
    capability = null,
    limit = 50,
    offset = 0,
    sortBy = 'createdAt',
    sortOrder = 'DESC',
    userAgent = null,
    ipAddress = null,
    requestId = null
  } = options;
  
  const where = {};
  
  if (operatorId) where.operatorId = operatorId;
  if (status) where.status = status;
  if (isActive !== null) where.isActive = isActive;
  if (isApproved !== null) where.isApproved = isApproved;
  if (isPublic !== null) where.isPublic = isPublic;
  if (capability) where.capabilities = { [Op.contains]: [capability] };
  
  const order = [[sortBy, sortOrder]];
  
  const result = await Node.findAndCountAll({
    where,
    include: [{ model: Operator, attributes: ['id', 'operatorId', 'name'] }],
    limit,
    offset,
    order
  });
  
  // Log access
  await AuditEvent.create({
    userId: null,
    action: 'node.list',
    entityType: 'node',
    metadata: {
      filters: { operatorId, status, isActive, isApproved, isPublic, capability },
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
 * Update node information
 */
const updateNode = async (nodeId, updates, options = {}) => {
  const { userId = null, userAgent = null, ipAddress = null, requestId = null } = options;
  
  const node = await Node.findOne({ where: { nodeId } });
  
  if (!node) {
    throw new NotFoundError('Node not found');
  }
  
  // Validate updates
  if (updates.capabilities) {
    const validCapabilities = ['storage', 'compute', 'proxy', 'database', 'cache', 'cdn'];
    const invalidCapabilities = updates.capabilities.filter(c => !validCapabilities.includes(c));
    if (invalidCapabilities.length > 0) {
      throw new ValidationError(`Invalid capabilities: ${invalidCapabilities.join(', ')}`);
    }
  }
  
  const oldValues = { ...node.toJSON() };
  await node.update(updates);
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'node.update',
    entityType: 'node',
    entityId: node.id,
    metadata: {
      nodeId: node.nodeId,
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
  
  return node;
};

/**
 * Approve a node
 */
const approveNode = async (nodeId, options = {}) => {
  const { userId = null, userAgent = null, ipAddress = null, requestId = null } = options;
  
  const node = await Node.findOne({ where: { nodeId } });
  
  if (!node) {
    throw new NotFoundError('Node not found');
  }
  
  if (node.isApproved) {
    throw new ConflictError('Node is already approved');
  }
  
  await node.update({
    isApproved: true,
    status: 'active',
    isActive: true
  });
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'node.approve',
    entityType: 'node',
    entityId: node.id,
    metadata: {
      nodeId: node.nodeId,
      operatorId: node.operatorId
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return node;
};

/**
 * Reject a node
 */
const rejectNode = async (nodeId, reason, options = {}) => {
  const { userId = null, userAgent = null, ipAddress = null, requestId = null } = options;
  
  const node = await Node.findOne({ where: { nodeId } });
  
  if (!node) {
    throw new NotFoundError('Node not found');
  }
  
  if (node.isApproved) {
    throw new ConflictError('Cannot reject an approved node');
  }
  
  await node.update({
    isApproved: false,
    status: 'rejected',
    isActive: false,
    rejectionReason: reason
  });
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'node.reject',
    entityType: 'node',
    entityId: node.id,
    metadata: {
      nodeId: node.nodeId,
      reason
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return node;
};

/**
 * Suspend a node
 */
const suspendNode = async (nodeId, reason, options = {}) => {
  const { userId = null, userAgent = null, ipAddress = null, requestId = null } = options;
  
  const node = await Node.findOne({ where: { nodeId } });
  
  if (!node) {
    throw new NotFoundError('Node not found');
  }
  
  await node.update({
    isActive: false,
    status: 'suspended',
    suspensionReason: reason
  });
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'node.suspend',
    entityType: 'node',
    entityId: node.id,
    metadata: {
      nodeId: node.nodeId,
      reason
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return node;
};

/**
 * Reactivate a node
 */
const reactivateNode = async (nodeId, options = {}) => {
  const { userId = null, userAgent = null, ipAddress = null, requestId = null } = options;
  
  const node = await Node.findOne({ where: { nodeId } });
  
  if (!node) {
    throw new NotFoundError('Node not found');
  }
  
  await node.update({
    isActive: true,
    status: 'active',
    suspensionReason: null
  });
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'node.reactivate',
    entityType: 'node',
    entityId: node.id,
    metadata: {
      nodeId: node.nodeId
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return node;
};

/**
 * Remove a node
 */
const removeNode = async (nodeId, options = {}) => {
  const { userId = null, userAgent = null, ipAddress = null, requestId = null } = options;
  
  const node = await Node.findOne({ where: { nodeId } });
  
  if (!node) {
    throw new NotFoundError('Node not found');
  }
  
  // Check if node has replicas
  const replicaCount = await Replica.count({ where: { nodeId: node.id } });
  if (replicaCount > 0) {
    throw new ConflictError('Cannot remove node with active replicas. Migrate data first.');
  }
  
  await node.destroy();
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'node.remove',
    entityType: 'node',
    entityId: node.id,
    metadata: {
      nodeId: node.nodeId
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return { success: true, message: 'Node removed' };
};

/**
 * Update node heartbeat
 */
const updateNodeHeartbeat = async (nodeId, data, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const node = await Node.findOne({ where: { nodeId } });
  
  if (!node) {
    throw new NotFoundError('Node not found');
  }
  
  const updates = {
    lastHeartbeat: new Date(),
    healthScore: data.healthScore || node.healthScore,
    resources: data.resources || node.resources
  };
  
  await node.update(updates);
  
  // Log heartbeat
  await AuditEvent.create({
    userId: null,
    action: 'node.heartbeat',
    entityType: 'node',
    entityId: node.id,
    metadata: {
      nodeId: node.nodeId,
      healthScore: updates.healthScore
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return node;
};

/**
 * Update node health check
 */
const updateNodeHealthCheck = async (nodeId, data, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const node = await Node.findOne({ where: { nodeId } });
  
  if (!node) {
    throw new NotFoundError('Node not found');
  }
  
  const updates = {
    lastHealthCheck: new Date(),
    healthScore: data.healthScore || node.healthScore,
    status: data.status || node.status,
    healthStatus: data.healthStatus || node.healthStatus
  };
  
  await node.update(updates);
  
  // Log health check
  await AuditEvent.create({
    userId: null,
    action: 'node.health_check',
    entityType: 'node',
    entityId: node.id,
    metadata: {
      nodeId: node.nodeId,
      healthScore: updates.healthScore,
      status: updates.status,
      healthStatus: updates.healthStatus
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return node;
};

/**
 * Get node statistics
 */
const getNodeStats = async (nodeId, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const node = await Node.findOne({
    where: { nodeId },
    include: [
      { model: Replica, include: [{ model: StorageChunk, include: [StorageObject] }] }
    ]
  });
  
  if (!node) {
    throw new NotFoundError('Node not found');
  }
  
  const replicaCount = await Replica.count({ where: { nodeId: node.id } });
  const storageUsed = await Replica.sum('size', { where: { nodeId: node.id } });
  
  const stats = {
    node: node.toJSON(),
    replicas: replicaCount,
    storageUsed: storageUsed || 0,
    uptime: node.lastHeartbeat ? Math.floor((new Date() - new Date(node.lastHeartbeat)) / 1000) : 0
  };
  
  // Log access
  await AuditEvent.create({
    userId: null,
    action: 'node.stats',
    entityType: 'node',
    entityId: node.id,
    metadata: {
      nodeId: node.nodeId,
      replicas: replicaCount,
      storageUsed: stats.storageUsed
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return stats;
};

/**
 * Get nodes for storage
 */
const getStorageNodes = async (options = {}) => {
  const { 
    minStorage = 0,
    minHealthScore = 80,
    maxReplicas = null,
    failureDomain = null,
    limit = 10,
    userAgent = null,
    ipAddress = null,
    requestId = null
  } = options;
  
  const where = {
    isActive: true,
    isApproved: true,
    capabilities: { [Op.contains]: ['storage'] },
    healthScore: { [Op.gte]: minHealthScore }
  };
  
  if (failureDomain) {
    where.failureDomain = failureDomain;
  }
  
  const nodes = await Node.findAll({
    where,
    order: [
      ['healthScore', 'DESC'],
      ['resources.storage.used', 'ASC']
    ],
    limit
  });
  
  // Filter nodes with enough storage
  const filteredNodes = nodes.filter(node => {
    const totalStorage = node.resources.storage.total || 0;
    const usedStorage = node.resources.storage.used || 0;
    const available = totalStorage - usedStorage;
    return available >= minStorage;
  });
  
  // Log access
  await AuditEvent.create({
    userId: null,
    action: 'node.storage_list',
    entityType: 'node',
    metadata: {
      filters: { minStorage, minHealthScore, failureDomain },
      results: filteredNodes.length
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return filteredNodes;
};

/**
 * Select nodes for replication
 */
const selectNodesForReplication = async (chunkSize, options = {}) => {
  const { 
    excludeNodeIds = [],
    requiredReplicas = 3,
    userAgent = null,
    ipAddress = null,
    requestId = null
  } = options;
  
  // Get available storage nodes
  const nodes = await getStorageNodes({
    minStorage: chunkSize * requiredReplicas,
    minHealthScore: 80,
    limit: 20
  });
  
  // Filter out excluded nodes
  const availableNodes = nodes.filter(node => !excludeNodeIds.includes(node.id));
  
  if (availableNodes.length < requiredReplicas) {
    throw new ValidationError(`Not enough nodes available for ${requiredReplicas} replicas`);
  }
  
  // Select nodes from different failure domains
  const selectedNodes = [];
  const usedFailureDomains = new Set();
  
  for (const node of availableNodes) {
    if (selectedNodes.length >= requiredReplicas) break;
    
    if (!usedFailureDomains.has(node.failureDomain)) {
      selectedNodes.push(node);
      usedFailureDomains.add(node.failureDomain);
    }
  }
  
  // If we don't have enough from different domains, add more
  if (selectedNodes.length < requiredReplicas) {
    for (const node of availableNodes) {
      if (selectedNodes.length >= requiredReplicas) break;
      if (!selectedNodes.some(n => n.id === node.id)) {
        selectedNodes.push(node);
      }
    }
  }
  
  // Log selection
  await AuditEvent.create({
    userId: null,
    action: 'node.replication_select',
    entityType: 'node',
    metadata: {
      chunkSize,
      requiredReplicas,
      selectedNodes: selectedNodes.map(n => n.id),
      failureDomains: Array.from(usedFailureDomains)
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return selectedNodes;
};

/**
 * Get node by operator
 */
const getNodesByOperator = async (operatorId, options = {}) => {
  const { 
    isActive = null,
    isApproved = null,
    limit = 50,
    offset = 0,
    userAgent = null,
    ipAddress = null,
    requestId = null
  } = options;
  
  const where = { operatorId };
  
  if (isActive !== null) where.isActive = isActive;
  if (isApproved !== null) where.isApproved = isApproved;
  
  const result = await Node.findAndCountAll({
    where,
    limit,
    offset,
    order: [['createdAt', 'DESC']]
  });
  
  // Log access
  await AuditEvent.create({
    userId: null,
    action: 'node.list_by_operator',
    entityType: 'node',
    metadata: {
      operatorId,
      filters: { isActive, isApproved },
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
 * Get node statistics for operator
 */
const getOperatorNodeStats = async (operatorId, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const total = await Node.count({ where: { operatorId } });
  const active = await Node.count({ where: { operatorId, isActive: true } });
  const approved = await Node.count({ where: { operatorId, isApproved: true } });
  const suspended = await Node.count({ where: { operatorId, isActive: false } });
  
  const stats = {
    total,
    active,
    approved,
    suspended,
    pending: total - approved - suspended
  };
  
  // Log access
  await AuditEvent.create({
    userId: null,
    action: 'node.operator_stats',
    entityType: 'node',
    metadata: {
      operatorId,
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
 * Quarantine a node
 */
const quarantineNode = async (nodeId, reason, options = {}) => {
  const { userId = null, userAgent = null, ipAddress = null, requestId = null } = options;
  
  const node = await Node.findOne({ where: { nodeId } });
  
  if (!node) {
    throw new NotFoundError('Node not found');
  }
  
  await node.update({
    isActive: false,
    status: 'quarantined',
    quarantineReason: reason
  });
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'node.quarantine',
    entityType: 'node',
    entityId: node.id,
    metadata: {
      nodeId: node.nodeId,
      reason
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return node;
};

/**
 * Release node from quarantine
 */
const releaseFromQuarantine = async (nodeId, options = {}) => {
  const { userId = null, userAgent = null, ipAddress = null, requestId = null } = options;
  
  const node = await Node.findOne({ where: { nodeId } });
  
  if (!node) {
    throw new NotFoundError('Node not found');
  }
  
  if (node.status !== 'quarantined') {
    throw new ConflictError('Node is not in quarantine');
  }
  
  await node.update({
    isActive: true,
    status: 'active',
    quarantineReason: null
  });
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'node.release_quarantine',
    entityType: 'node',
    entityId: node.id,
    metadata: {
      nodeId: node.nodeId
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return node;
};

module.exports = {
  generateNodeId,
  generateRegistrationToken,
  registerNode,
  getNodeById,
  getNodeByNodeId,
  listNodes,
  updateNode,
  approveNode,
  rejectNode,
  suspendNode,
  reactivateNode,
  removeNode,
  updateNodeHeartbeat,
  updateNodeHealthCheck,
  getNodeStats,
  getStorageNodes,
  selectNodesForReplication,
  getNodesByOperator,
  getOperatorNodeStats,
  quarantineNode,
  releaseFromQuarantine
};
