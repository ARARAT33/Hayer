/**
 * Storage Controller
 * Handles storage management endpoints
 */

const storageService = require('../services/storage.service');
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
 * Upload a file
 */
const uploadFile = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    if (!req.file && !req.body.data) {
      throw new ValidationError('File data is required');
    }
    
    const { 
      name,
      description,
      mimeType = req.file?.mimetype || 'application/octet-stream',
      isPublic = false,
      chunkSize = storageService.DEFAULT_CHUNK_SIZE,
      metadata = {}
    } = req.body;
    
    const fileData = req.file?.buffer || req.body.data;
    
    const result = await storageService.createStorageObject(user.id, {
      name,
      description,
      mimeType,
      isPublic,
      chunkSize: parseInt(chunkSize),
      metadata,
      data: fileData
    }, {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.status(201).json({
      success: true,
      data: result.storageObject,
      encryptionKey: result.encryptionKey // In production, encrypt this with user's public key
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get storage object metadata
 */
const getStorageObject = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { objectId } = req.params;
    const { includeChunks = false, includeReplicas = false } = req.query;
    
    const storageObject = await storageService.getStorageObject(objectId, {
      includeChunks: includeChunks === 'true',
      includeReplicas: includeReplicas === 'true',
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    // Check ownership or public access
    if (storageObject.ownerId !== user.id && !storageObject.isPublic) {
      throw new AuthorizationError('Access denied');
    }
    
    res.json({
      success: true,
      data: storageObject
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List storage objects
 */
const listStorageObjects = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { 
      name = null,
      type = null,
      status = null,
      isPublic = null,
      limit = 50,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;
    
    const result = await storageService.listStorageObjects(user.id, {
      name,
      type,
      status,
      isPublic: isPublic === 'true' ? true : isPublic === 'false' ? false : null,
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
 * Update storage object metadata
 */
const updateStorageObject = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { objectId } = req.params;
    const updates = req.body;
    
    const storageObject = await storageService.updateStorageObject(
      user.id,
      objectId,
      updates,
      {
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        requestId: req.requestId
      }
    );
    
    res.json({
      success: true,
      data: storageObject
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete storage object
 */
const deleteStorageObject = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { objectId } = req.params;
    
    const result = await storageService.deleteStorageObject(user.id, objectId, {
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
 * Download file
 */
const downloadFile = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { objectId } = req.params;
    const { encryptionKeyId, encryptionKey } = req.body;
    
    // Get storage object to verify ownership
    const storageObject = await storageService.getStorageObjectById(objectId);
    
    if (!storageObject) {
      throw new NotFoundError('Storage object not found');
    }
    
    if (storageObject.ownerId !== user.id && !storageObject.isPublic) {
      throw new AuthorizationError('Access denied');
    }
    
    // Get encryption key from user's stored keys
    // In production, we would retrieve this from a secure key storage
    const keyData = {
      keyId: encryptionKeyId || storageObject.encryptionKeyId,
      key: encryptionKey ? Buffer.from(encryptionKey, 'base64') : null
    };
    
    if (!keyData.key) {
      throw new ValidationError('Encryption key required');
    }
    
    const result = await storageService.getStorageObjectData(
      user.id,
      objectId,
      {
        encryptionKey: keyData,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        requestId: req.requestId
      }
    );
    
    res.set({
      'Content-Type': result.mimeType,
      'Content-Length': result.size,
      'Content-Disposition': `attachment; filename="${storageObject.name || objectId}"`
    });
    
    res.send(result.data);
  } catch (error) {
    next(error);
  }
};

/**
 * Get storage chunk
 */
const getStorageChunk = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { chunkId } = req.params;
    
    const chunk = await storageService.getStorageChunk(chunkId);
    
    // Verify ownership
    const storageObject = await storageService.getStorageObjectById(chunk.storageObjectId);
    if (!storageObject || storageObject.ownerId !== user.id) {
      throw new AuthorizationError('Access denied');
    }
    
    res.json({
      success: true,
      data: chunk
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get replicas for a chunk
 */
const getReplicasForChunk = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { chunkId } = req.params;
    
    const chunk = await storageService.getStorageChunk(chunkId);
    
    // Verify ownership
    const storageObject = await storageService.getStorageObjectById(chunk.storageObjectId);
    if (!storageObject || storageObject.ownerId !== user.id) {
      throw new AuthorizationError('Access denied');
    }
    
    const replicas = await storageService.getReplicasForChunk(chunkId);
    
    res.json({
      success: true,
      data: replicas
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify replica integrity
 */
const verifyReplicaIntegrity = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { replicaId } = req.params;
    
    const result = await storageService.verifyReplicaIntegrity(replicaId);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Repair replicas
 */
const repairReplicas = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { chunkId } = req.params;
    
    const chunk = await storageService.getStorageChunk(chunkId);
    
    // Verify ownership
    const storageObject = await storageService.getStorageObjectById(chunk.storageObjectId);
    if (!storageObject || storageObject.ownerId !== user.id) {
      throw new AuthorizationError('Access denied');
    }
    
    const result = await storageService.repairReplicas(chunk.id, {
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
 * Check storage health
 */
const checkStorageHealth = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const result = await storageService.checkStorageHealth(user.id, {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get storage statistics
 */
const getStorageStats = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const stats = await storageService.getStorageStats(user.id);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Share storage object
 */
const shareStorageObject = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { objectId } = req.params;
    const shareData = req.body;
    
    const result = await storageService.shareStorageObject(
      user.id,
      objectId,
      shareData,
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
 * Get shared storage objects
 */
const getSharedStorageObjects = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { limit = 50, offset = 0 } = req.query;
    
    const result = await storageService.getSharedStorageObjects(user.id, {
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
 * Search storage objects
 */
const searchStorageObjects = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { query } = req.query;
    const { limit = 20, offset = 0 } = req.query;
    
    const result = await storageService.searchStorageObjects(
      user.id,
      query,
      {
        limit: parseInt(limit),
        offset: parseInt(offset),
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
 * Get available storage nodes
 */
const getStorageNodes = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { 
      minStorage = 0,
      minHealthScore = 80,
      limit = 10
    } = req.query;
    
    const nodes = await nodeService.getStorageNodes({
      minStorage: parseInt(minStorage),
      minHealthScore: parseInt(minHealthScore),
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
 * Select nodes for upload
 */
const selectNodesForUpload = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { fileSize } = req.query;
    const { requiredReplicas = 3 } = req.body;
    
    const nodes = await nodeService.selectNodesForReplication(
      parseInt(fileSize),
      {
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

module.exports = {
  uploadFile,
  getStorageObject,
  listStorageObjects,
  updateStorageObject,
  deleteStorageObject,
  downloadFile,
  getStorageChunk,
  getReplicasForChunk,
  verifyReplicaIntegrity,
  repairReplicas,
  checkStorageHealth,
  getStorageStats,
  shareStorageObject,
  getSharedStorageObjects,
  searchStorageObjects,
  getStorageNodes,
  selectNodesForUpload
};
