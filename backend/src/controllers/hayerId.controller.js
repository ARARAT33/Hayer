/**
 * HAYER ID Controller
 * Handles HAYER ID management endpoints
 */

const config = require('../config');
const hayerIdService = require('../services/hayerId.service');
const { 
  AuthenticationError, 
  AuthorizationError,
  ValidationError,
  NotFoundError,
  ConflictError
} = require('../middleware/errorHandler');
const { extractUserFromRequest } = require('../middleware/authentication');

/**
 * Create a new HAYER ID for the current user
 */
const createHayerId = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { customHayerId, isPrimary = false } = req.body;
    
    const hayerId = await hayerIdService.createHayerId(user.id, {
      customHayerId,
      isPrimary,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.status(201).json({
      success: true,
      data: hayerId
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user's HAYER ID
 */
const getMyHayerId = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const hayerId = await hayerIdService.getHayerIdByUserId(user.id);
    
    res.json({
      success: true,
      data: hayerId
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all HAYER IDs for the current user
 */
const getMyHayerIds = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const hayerIds = await hayerIdService.getAllHayerIdsForUser(user.id);
    
    res.json({
      success: true,
      data: hayerIds
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get HAYER ID by HAYER ID string
 */
const getHayerId = async (req, res, next) => {
  try {
    const { hayerId } = req.params;
    
    const hayerIdRecord = await hayerIdService.getHayerIdById(hayerId);
    
    res.json({
      success: true,
      data: hayerIdRecord
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update HAYER ID settings
 */
const updateHayerId = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { hayerId } = req.params;
    const updates = req.body;
    
    // Verify ownership
    const isOwner = await hayerIdService.verifyHayerIdOwnership(user.id, hayerId);
    if (!isOwner) {
      throw new AuthorizationError('You do not own this HAYER ID');
    }
    
    const updatedHayerId = await hayerIdService.updateHayerId(
      user.id,
      hayerId,
      updates,
      {
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        requestId: req.requestId
      }
    );
    
    res.json({
      success: true,
      data: updatedHayerId
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Set a HAYER ID as primary
 */
const setPrimaryHayerId = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { hayerId } = req.params;
    
    // Verify ownership
    const isOwner = await hayerIdService.verifyHayerIdOwnership(user.id, hayerId);
    if (!isOwner) {
      throw new AuthorizationError('You do not own this HAYER ID');
    }
    
    const updatedHayerId = await hayerIdService.setPrimaryHayerId(
      user.id,
      hayerId,
      {
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        requestId: req.requestId
      }
    );
    
    res.json({
      success: true,
      data: updatedHayerId,
      message: 'HAYER ID set as primary'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Deactivate a HAYER ID
 */
const deactivateHayerId = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { hayerId } = req.params;
    
    // Verify ownership
    const isOwner = await hayerIdService.verifyHayerIdOwnership(user.id, hayerId);
    if (!isOwner) {
      throw new AuthorizationError('You do not own this HAYER ID');
    }
    
    const deactivatedHayerId = await hayerIdService.deactivateHayerId(
      user.id,
      hayerId,
      {
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        requestId: req.requestId
      }
    );
    
    res.json({
      success: true,
      data: deactivatedHayerId,
      message: 'HAYER ID deactivated'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get HAYER ID by username
 */
const getHayerIdByUsername = async (req, res, next) => {
  try {
    const { username } = req.params;
    
    const hayerId = await hayerIdService.getHayerIdByUsername(username);
    
    res.json({
      success: true,
      data: hayerId
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get HAYER ID by email
 */
const getHayerIdByEmail = async (req, res, next) => {
  try {
    const { email } = req.params;
    
    const hayerId = await hayerIdService.getHayerIdByEmail(email);
    
    res.json({
      success: true,
      data: hayerId
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Search HAYER IDs
 */
const searchHayerIds = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    const { query } = req.query;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    
    const result = await hayerIdService.searchHayerIds(query, {
      limit,
      offset,
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
 * Generate federation token for HAYER ID
 */
const generateFederationToken = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { hayerId } = req.params;
    const { expiresIn = '7d' } = req.body;
    
    // Verify ownership
    const isOwner = await hayerIdService.verifyHayerIdOwnership(user.id, hayerId);
    if (!isOwner) {
      throw new AuthorizationError('You do not own this HAYER ID');
    }
    
    const tokenData = await hayerIdService.generateFederationToken(
      user.id,
      hayerId,
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
 * Verify federation token
 */
const verifyFederationToken = async (req, res, next) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      throw new ValidationError('Token is required');
    }
    
    const result = await hayerIdService.verifyFederationToken(token);
    
    if (!result.valid) {
      return res.status(401).json({
        success: false,
        error: result.error || 'Invalid token'
      });
    }
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get HAYER ID statistics (admin only)
 */
const getHayerIdStats = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    // Check admin role
    if (!user.roles || !user.roles.includes('admin') || !user.roles.includes('super_admin')) {
      throw new AuthorizationError('Admin access required');
    }
    
    const stats = await hayerIdService.getHayerIdStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify HAYER ID ownership
 */
const verifyOwnership = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { hayerId } = req.params;
    
    const isOwner = await hayerIdService.verifyHayerIdOwnership(user.id, hayerId);
    
    res.json({
      success: true,
      data: { isOwner }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createHayerId,
  getMyHayerId,
  getMyHayerIds,
  getHayerId,
  updateHayerId,
  setPrimaryHayerId,
  deactivateHayerId,
  getHayerIdByUsername,
  getHayerIdByEmail,
  searchHayerIds,
  generateFederationToken,
  verifyFederationToken,
  getHayerIdStats,
  verifyOwnership
};
