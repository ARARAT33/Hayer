/**
 * Operator Controller
 * Handles operator management endpoints
 */

const operatorService = require('../services/operator.service');
const { 
  AuthenticationError, 
  AuthorizationError,
  ValidationError,
  NotFoundError,
  ConflictError
} = require('../middleware/errorHandler');
const { extractUserFromRequest, checkPermission } = require('../middleware/authentication');

/**
 * Create a new operator
 */
const createOperator = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { 
      name,
      description,
      website,
      contactEmail,
      quota = null,
      metadata = {}
    } = req.body;
    
    const result = await operatorService.createOperator(user.id, {
      name,
      description,
      website,
      contactEmail,
      quota,
      metadata
    }, {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.status(201).json({
      success: true,
      data: result.operator,
      apiKey: result.apiKey,
      apiSecret: result.apiSecret // In production, this should be encrypted or only shown once
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get operator by ID
 */
const getOperator = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    const { operatorId } = req.params;
    const { includeNodes = false } = req.query;
    
    const operator = await operatorService.getOperatorById(operatorId, {
      includeNodes: includeNodes === 'true',
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    // Check ownership or admin
    if (user && operator.userId !== user.id) {
      const hasPermission = await checkPermission(user, 'operator', 'view', 'all');
      if (!hasPermission) {
        throw new AuthorizationError('Permission denied');
      }
    }
    
    res.json({
      success: true,
      data: operator
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user's operator
 */
const getMyOperator = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const operator = await operatorService.getOperatorByUserId(user.id);
    
    res.json({
      success: true,
      data: operator
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List all operators
 */
const listOperators = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    
    const { 
      status = null,
      isVerified = null,
      isTrusted = null,
      limit = 50,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;
    
    const result = await operatorService.listOperators({
      status,
      isVerified: isVerified === 'true' ? true : isVerified === 'false' ? false : null,
      isTrusted: isTrusted === 'true' ? true : isTrusted === 'false' ? false : null,
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
 * Update operator information
 */
const updateOperator = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { operatorId } = req.params;
    const updates = req.body;
    
    // Check ownership
    const operator = await operatorService.getOperatorById(operatorId);
    if (operator.userId !== user.id) {
      throw new AuthorizationError('Permission denied');
    }
    
    const updatedOperator = await operatorService.updateOperator(
      user.id,
      operatorId,
      updates,
      {
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        requestId: req.requestId
      }
    );
    
    res.json({
      success: true,
      data: updatedOperator
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify operator (admin only)
 */
const verifyOperator = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    // Check admin role
    const hasPermission = await checkPermission(user, 'operator', 'verify', 'all');
    if (!hasPermission) {
      throw new AuthorizationError('Admin permissions required');
    }
    
    const { operatorId } = req.params;
    
    const operator = await operatorService.verifyOperator(operatorId, {
      userId: user.id,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      data: operator,
      message: 'Operator verified'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Set operator as trusted (admin only)
 */
const setTrustedOperator = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    // Check admin role
    const hasPermission = await checkPermission(user, 'operator', 'trust', 'all');
    if (!hasPermission) {
      throw new AuthorizationError('Admin permissions required');
    }
    
    const { operatorId } = req.params;
    const { trusted = true } = req.body;
    
    const operator = await operatorService.setTrustedOperator(operatorId, trusted, {
      userId: user.id,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      data: operator,
      message: `Operator ${trusted ? 'trusted' : 'untrusted'}`
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Suspend operator (admin only)
 */
const suspendOperator = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    // Check admin role
    const hasPermission = await checkPermission(user, 'operator', 'suspend', 'all');
    if (!hasPermission) {
      throw new AuthorizationError('Admin permissions required');
    }
    
    const { operatorId } = req.params;
    const { reason } = req.body;
    
    const operator = await operatorService.suspendOperator(operatorId, reason, {
      userId: user.id,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      data: operator,
      message: 'Operator suspended'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reactivate operator (admin only)
 */
const reactivateOperator = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    // Check admin role
    const hasPermission = await checkPermission(user, 'operator', 'reactivate', 'all');
    if (!hasPermission) {
      throw new AuthorizationError('Admin permissions required');
    }
    
    const { operatorId } = req.params;
    
    const operator = await operatorService.reactivateOperator(operatorId, {
      userId: user.id,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      data: operator,
      message: 'Operator reactivated'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove operator (admin only)
 */
const removeOperator = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    // Check admin role
    const hasPermission = await checkPermission(user, 'operator', 'remove', 'all');
    if (!hasPermission) {
      throw new AuthorizationError('Admin permissions required');
    }
    
    const { operatorId } = req.params;
    
    const result = await operatorService.removeOperator(operatorId, {
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
 * Regenerate API key
 */
const regenerateApiKey = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { operatorId } = req.params;
    
    // Check ownership
    const operator = await operatorService.getOperatorById(operatorId);
    if (operator.userId !== user.id) {
      throw new AuthorizationError('Permission denied');
    }
    
    const result = await operatorService.regenerateApiKey(
      user.id,
      operatorId,
      {
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        requestId: req.requestId
      }
    );
    
    res.json({
      success: true,
      apiKey: result.apiKey,
      apiSecret: result.apiSecret // In production, this should be encrypted or only shown once
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Set operator public key
 */
const setOperatorPublicKey = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { operatorId } = req.params;
    const { publicKey } = req.body;
    
    // Check ownership
    const operator = await operatorService.getOperatorById(operatorId);
    if (operator.userId !== user.id) {
      throw new AuthorizationError('Permission denied');
    }
    
    const updatedOperator = await operatorService.setOperatorPublicKey(
      user.id,
      operatorId,
      publicKey,
      {
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        requestId: req.requestId
      }
    );
    
    res.json({
      success: true,
      data: updatedOperator
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get operator statistics
 */
const getOperatorStats = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    const { operatorId } = req.params;
    
    const stats = await operatorService.getOperatorStats(operatorId, {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    // Check ownership or admin
    if (user && stats.operator.userId !== user.id) {
      const hasPermission = await checkPermission(user, 'operator', 'view', 'all');
      if (!hasPermission) {
        throw new AuthorizationError('Permission denied');
      }
    }
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get operator dashboard
 */
const getOperatorDashboard = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { operatorId } = req.params;
    
    // Check ownership
    const operator = await operatorService.getOperatorById(operatorId);
    if (operator.userId !== user.id) {
      throw new AuthorizationError('Permission denied');
    }
    
    const dashboard = await operatorService.getOperatorDashboard(operatorId, {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Search operators
 */
const searchOperators = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    const { query } = req.query;
    const { limit = 20, offset = 0 } = req.query;
    
    const result = await operatorService.searchOperators(query, {
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
 * Get all operators statistics (admin only)
 */
const getAllOperatorsStats = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    // Check admin role
    const hasPermission = await checkPermission(user, 'operator', 'view', 'all');
    if (!hasPermission) {
      throw new AuthorizationError('Admin permissions required');
    }
    
    const stats = await operatorService.getAllOperatorsStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify API key
 */
const verifyApiKey = async (req, res, next) => {
  try {
    const { apiKey, apiSecret } = req.body;
    
    if (!apiKey || !apiSecret) {
      throw new ValidationError('API key and secret are required');
    }
    
    const result = await operatorService.verifyApiKey(apiKey, apiSecret);
    
    if (!result.valid) {
      return res.status(401).json({
        success: false,
        error: result.error
      });
    }
    
    res.json({
      success: true,
      data: {
        valid: true,
        operatorId: result.operator.operatorId
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOperator,
  getOperator,
  getMyOperator,
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
  getAllOperatorsStats,
  verifyApiKey
};
