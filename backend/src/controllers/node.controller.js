/**
 * Node Controller
 * Handles node management endpoints
 */

const nodeService = require('../services/node.service');
const { 
  AuthenticationError, 
  AuthorizationError,
  ValidationError,
  NotFoundError,
  ConflictError
} = require('../middleware/errorHandler');
const { extractUserFromRequest, checkPermission } = require('../middleware/authentication');

/**
 * Generate registration token for operator
 */
const generateRegistrationToken = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    // Check if user has operator role
    const hasPermission = await checkPermission(user, 'operator', 'manage', 'own');
    if (!hasPermission) {
      throw new AuthorizationError('Operator permissions required');
    }
    
    const { operatorId } = req.params;
    const { expiresIn = '7d' } = req.body;
    
    const tokenData = await nodeService.generateRegistrationToken(
      operatorId,
      {
        expiresIn,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        requestId: req.requestId
      }
    );
    
    res.json({
      success: true,
      ...tokenData
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Register a new node
 */
const registerNode = async (req, res, next) => {
  try {
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
      metadata = {}
    } = req.body;
    
    const node = await nodeService.registerNode(
      {
        operatorId,
        registrationToken,
        name,
        description,
        hostname,
        ipAddresses,
        publicUrl,
        capabilities,
        resources,
        location,
        metadata
      },
      {
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        requestId: req.requestId
      }
    );
    
    res.status(201).json({
      success: true,
      data: node
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get node by ID
 */
const getNode = async (req, res, next) => {
  try {
    const { nodeId } = req.params;
    const { includeDetails = false } = req.query;
    
    const node = await nodeService.getNodeById(nodeId, {
      includeDetails: includeDetails === 'true',
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      data: node
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List all nodes
 */
const listNodes = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    
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
      sortOrder = 'DESC'
    } = req.query;
    
    const result = await nodeService.listNodes({
      operatorId,
      status,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : null,
      isApproved: isApproved === 'true' ? true : isApproved === 'false' ? false : null,
      isPublic: isPublic === 'true' ? true : isPublic === 'false' ? false : null,
      capability,
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
 * Update node information
 */
const updateNode = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { nodeId } = req.params;
    const updates = req.body;
    
    // Check ownership or admin
    const node = await nodeService.getNodeByNodeId(nodeId);
    const hasPermission = await checkPermission(user, 'node', 'manage', node.operatorId);
    if (!hasPermission) {
      throw new AuthorizationError('Permission denied');
    }
    
    const updatedNode = await nodeService.updateNode(
      nodeId,
      updates,
      {
        userId: user.id,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        requestId: req.requestId
      }
    );
    
    res.json({
      success: true,
      data: updatedNode
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Approve a node (admin only)
 */
const approveNode = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    // Check admin role
    const hasPermission = await checkPermission(user, 'node', 'approve', 'all');
    if (!hasPermission) {
      throw new AuthorizationError('Admin permissions required');
    }
    
    const { nodeId } = req.params;
    
    const node = await nodeService.approveNode(nodeId, {
      userId: user.id,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      data: node,
      message: 'Node approved'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reject a node (admin only)
 */
const rejectNode = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    // Check admin role
    const hasPermission = await checkPermission(user, 'node', 'approve', 'all');
    if (!hasPermission) {
      throw new AuthorizationError('Admin permissions required');
    }
    
    const { nodeId } = req.params;
    const { reason } = req.body;
    
    const node = await nodeService.rejectNode(nodeId, reason, {
      userId: user.id,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      data: node,
      message: 'Node rejected'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Suspend a node (admin or operator)
 */
const suspendNode = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { nodeId } = req.params;
    const { reason } = req.body;
    
    // Check ownership or admin
    const node = await nodeService.getNodeByNodeId(nodeId);
    const hasPermission = await checkPermission(user, 'node', 'manage', node.operatorId);
    if (!hasPermission) {
      throw new AuthorizationError('Permission denied');
    }
    
    const suspendedNode = await nodeService.suspendNode(nodeId, reason, {
      userId: user.id,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      data: suspendedNode,
      message: 'Node suspended'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reactivate a node (admin or operator)
 */
const reactivateNode = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { nodeId } = req.params;
    
    // Check ownership or admin
    const node = await nodeService.getNodeByNodeId(nodeId);
    const hasPermission = await checkPermission(user, 'node', 'manage', node.operatorId);
    if (!hasPermission) {
      throw new AuthorizationError('Permission denied');
    }
    
    const reactivatedNode = await nodeService.reactivateNode(nodeId, {
      userId: user.id,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      data: reactivatedNode,
      message: 'Node reactivated'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove a node (admin or operator)
 */
const removeNode = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { nodeId } = req.params;
    
    // Check ownership or admin
    const node = await nodeService.getNodeByNodeId(nodeId);
    const hasPermission = await checkPermission(user, 'node', 'manage', node.operatorId);
    if (!hasPermission) {
      throw new AuthorizationError('Permission denied');
    }
    
    const result = await nodeService.removeNode(nodeId, {
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
 * Update node heartbeat
 */
const updateNodeHeartbeat = async (req, res, next) => {
  try {
    const { nodeId } = req.params;
    const data = req.body;
    
    const node = await nodeService.updateNodeHeartbeat(nodeId, data, {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      data: node
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update node health check
 */
const updateNodeHealthCheck = async (req, res, next) => {
  try {
    const { nodeId } = req.params;
    const data = req.body;
    
    const node = await nodeService.updateNodeHealthCheck(nodeId, data, {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      data: node
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get node statistics
 */
const getNodeStats = async (req, res, next) => {
  try {
    const { nodeId } = req.params;
    
    const stats = await nodeService.getNodeStats(nodeId, {
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
 * Get storage nodes
 */
const getStorageNodes = async (req, res, next) => {
  try {
    const { 
      minStorage = 0,
      minHealthScore = 80,
      maxReplicas = null,
      failureDomain = null,
      limit = 10
    } = req.query;
    
    const nodes = await nodeService.getStorageNodes({
      minStorage: parseInt(minStorage),
      minHealthScore: parseInt(minHealthScore),
      maxReplicas: maxReplicas ? parseInt(maxReplicas) : null,
      failureDomain,
      limit: parseInt(limit),
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      data: nodes
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Select nodes for replication
 */
const selectNodesForReplication = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { chunkSize } = req.params;
    const { 
      excludeNodeIds = [],
      requiredReplicas = 3
    } = req.body;
    
    const nodes = await nodeService.selectNodesForReplication(
      parseInt(chunkSize),
      {
        excludeNodeIds,
        requiredReplicas,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        requestId: req.requestId
      }
    );
    
    res.json({
      success: true,
      data: nodes
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get nodes by operator
 */
const getNodesByOperator = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { operatorId } = req.params;
    const { 
      isActive = null,
      isApproved = null,
      limit = 50,
      offset = 0
    } = req.query;
    
    // Check ownership or admin
    const hasPermission = await checkPermission(user, 'node', 'view', operatorId);
    if (!hasPermission) {
      throw new AuthorizationError('Permission denied');
    }
    
    const result = await nodeService.getNodesByOperator(operatorId, {
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : null,
      isApproved: isApproved === 'true' ? true : isApproved === 'false' ? false : null,
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
 * Get operator node statistics
 */
const getOperatorNodeStats = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { operatorId } = req.params;
    
    // Check ownership or admin
    const hasPermission = await checkPermission(user, 'node', 'view', operatorId);
    if (!hasPermission) {
      throw new AuthorizationError('Permission denied');
    }
    
    const stats = await nodeService.getOperatorNodeStats(operatorId, {
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
 * Quarantine a node (admin only)
 */
const quarantineNode = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    // Check admin role
    const hasPermission = await checkPermission(user, 'node', 'quarantine', 'all');
    if (!hasPermission) {
      throw new AuthorizationError('Admin permissions required');
    }
    
    const { nodeId } = req.params;
    const { reason } = req.body;
    
    const node = await nodeService.quarantineNode(nodeId, reason, {
      userId: user.id,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      data: node,
      message: 'Node quarantined'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Release node from quarantine (admin only)
 */
const releaseFromQuarantine = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    // Check admin role
    const hasPermission = await checkPermission(user, 'node', 'quarantine', 'all');
    if (!hasPermission) {
      throw new AuthorizationError('Admin permissions required');
    }
    
    const { nodeId } = req.params;
    
    const node = await nodeService.releaseFromQuarantine(nodeId, {
      userId: user.id,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      data: node,
      message: 'Node released from quarantine'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  generateRegistrationToken,
  registerNode,
  getNode,
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
