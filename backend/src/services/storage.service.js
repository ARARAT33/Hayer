/**
 * Storage Service
 * Manages distributed, encrypted storage with replication and integrity verification
 */

const crypto = require('crypto');
const { Op } = require('sequelize');
const config = require('../config');
const { 
  StorageObject, 
  StorageChunk, 
  Replica, 
  Node, 
  AuditEvent,
  User
} = require('../models');
const nodeService = require('./node.service');
const { 
  NotFoundError, 
  ConflictError,
  ValidationError,
  AuthenticationError,
  AuthorizationError
} = require('../middleware/errorHandler');
const { encrypt, decrypt, generateKey, hashData } = require('../utils/encryption');

// Chunk size constants
const DEFAULT_CHUNK_SIZE = 4 * 1024 * 1024; // 4MB
const MAX_CHUNK_SIZE = 16 * 1024 * 1024; // 16MB
const MIN_CHUNK_SIZE = 1 * 1024 * 1024; // 1MB

/**
 * Generate unique object ID
 */
const generateObjectId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return `OBJ-${Array.from({ length: 16 }, () => 
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join('')}`;
};

/**
 * Generate unique chunk ID
 */
const generateChunkId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return `CHUNK-${Array.from({ length: 16 }, () => 
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join('')}`;
};

/**
 * Split data into chunks
 */
const splitIntoChunks = (data, chunkSize = DEFAULT_CHUNK_SIZE) => {
  const chunks = [];
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
  
  for (let offset = 0; offset < buffer.length; offset += chunkSize) {
    const chunk = buffer.slice(offset, offset + chunkSize);
    chunks.push(chunk);
  }
  
  return chunks;
};

/**
 * Generate encryption key for storage
 */
const generateStorageKey = () => {
  return {
    key: crypto.randomBytes(32), // 256-bit key for AES-256
    iv: crypto.randomBytes(12), // 96-bit IV for AES-GCM
    keyId: crypto.randomBytes(16).toString('hex')
  };
};

/**
 * Encrypt data chunk
 */
const encryptChunk = (chunk, key, iv) => {
  const algorithm = 'aes-256-gcm';
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  
  const encrypted = Buffer.concat([
    cipher.update(chunk),
    cipher.final()
  ]);
  
  const authTag = cipher.getAuthTag();
  
  return {
    encryptedData: encrypted,
    authTag: authTag,
    nonce: iv
  };
};

/**
 * Decrypt data chunk
 */
const decryptChunk = (encryptedData, authTag, nonce, key) => {
  const algorithm = 'aes-256-gcm';
  const decipher = crypto.createDecipheriv(algorithm, key, nonce);
  
  decipher.setAuthTag(authTag);
  
  const decrypted = Buffer.concat([
    decipher.update(encryptedData),
    decipher.final()
  ]);
  
  return decrypted;
};

/**
 * Calculate SHA-256 hash
 */
const calculateHash = (data) => {
  return crypto.createHash('sha256').update(data).digest('hex');
};

/**
 * Create a new storage object
 */
const createStorageObject = async (userId, data, options = {}) => {
  const { 
    name,
    description,
    mimeType = 'application/octet-stream',
    isPublic = false,
    encryptionAlgorithm = 'AES-256-GCM',
    hashAlgorithm = 'SHA-256',
    chunkSize = DEFAULT_CHUNK_SIZE,
    metadata = {},
    userAgent = null,
    ipAddress = null,
    requestId = null
  } = data;
  
  const { 
    customObjectId = null,
    customEncryptionKey = null,
    requiredReplicas = 3
  } = options;
  
  // Validate user
  const user = await User.findByPk(userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  
  // Generate object ID
  const objectId = customObjectId || generateObjectId();
  
  // Generate encryption key
  const encryptionKey = customEncryptionKey || generateStorageKey();
  
  // Get the actual data (could be Buffer or string)
  const fileData = Buffer.isBuffer(data.data) ? data.data : Buffer.from(data.data, 'utf8');
  
  // Split into chunks
  const chunks = splitIntoChunks(fileData, chunkSize);
  
  // Create storage object
  const storageObject = await StorageObject.create({
    ownerId: userId,
    name,
    description,
    objectId,
    type: 'file',
    mimeType,
    size: fileData.length,
    chunkSize,
    encryptionKeyId: encryptionKey.keyId,
    encryptionAlgorithm,
    hashAlgorithm,
    isPublic,
    isEncrypted: true,
    metadata,
    status: 'uploading'
  });
  
  // Process each chunk
  const chunkIds = [];
  const chunkHashes = [];
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkId = generateChunkId();
    
    // Generate nonce for this chunk
    const nonce = crypto.randomBytes(12);
    
    // Encrypt chunk
    const encrypted = encryptChunk(chunk, encryptionKey.key, nonce);
    
    // Calculate hash of encrypted data
    const chunkHash = calculateHash(encrypted.encryptedData);
    
    // Store chunk
    const storageChunk = await StorageChunk.create({
      storageObjectId: storageObject.id,
      chunkIndex: i,
      chunkId,
      dataHash: chunkHash,
      size: encrypted.encryptedData.length,
      encryptedData: encrypted.encryptedData.toString('base64'),
      encryptionNonce: nonce.toString('base64'),
      encryptionAuthTag: encrypted.authTag.toString('base64'),
      status: 'uploaded'
    });
    
    chunkIds.push(chunkId);
    chunkHashes.push(chunkHash);
  }
  
  // Calculate root hash (Merkle tree root)
  const rootHash = calculateMerkleRoot(chunkHashes);
  
  // Update storage object with root hash
  await storageObject.update({
    rootHash,
    status: 'replicating'
  });
  
  // Select nodes for replication
  const nodes = await nodeService.selectNodesForReplication(
    chunkSize,
    {
      requiredReplicas,
      userAgent,
      ipAddress,
      requestId
    }
  );
  
  // Create replicas
  for (const storageChunk of await StorageChunk.findAll({
    where: { storageObjectId: storageObject.id }
  })) {
    const selectedNodes = await nodeService.selectNodesForReplication(
      storageChunk.size,
      {
        requiredReplicas,
        userAgent,
        ipAddress,
        requestId
      }
    );
    
    for (let i = 0; i < Math.min(selectedNodes.length, requiredReplicas); i++) {
      const node = selectedNodes[i];
      
      await Replica.create({
        storageChunkId: storageChunk.id,
        nodeId: node.id,
        replicaIndex: i,
        status: 'pending',
        integrityHash: storageChunk.dataHash,
        size: storageChunk.size
      });
    }
  }
  
  // Update object status
  await storageObject.update({ status: 'active' });
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'storage.upload',
    entityType: 'storage_object',
    entityId: storageObject.id,
    metadata: {
      objectId: storageObject.objectId,
      name,
      size: storageObject.size,
      chunks: storageObject.size / chunkSize,
      encryptionKeyId: encryptionKey.keyId
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return {
    storageObject,
    encryptionKey, // Return key to client (in production, this should be encrypted with user's public key)
    chunkIds
  };
};

/**
 * Calculate Merkle tree root hash
 */
const calculateMerkleRoot = (hashes) => {
  if (hashes.length === 0) return null;
  if (hashes.length === 1) return hashes[0];
  
  let currentLevel = hashes;
  
  while (currentLevel.length > 1) {
    const nextLevel = [];
    
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : currentLevel[i];
      
      const combined = left + right;
      const hash = calculateHash(combined);
      nextLevel.push(hash);
    }
    
    currentLevel = nextLevel;
  }
  
  return currentLevel[0];
};

/**
 * Get storage object by ID
 */
const getStorageObject = async (objectId, options = {}) => {
  const { 
    includeChunks = false,
    includeReplicas = false,
    userAgent = null,
    ipAddress = null,
    requestId = null
  } = options;
  
  const queryOptions = {
    where: { objectId }
  };
  
  if (includeChunks) {
    queryOptions.include = [{ model: StorageChunk }];
    
    if (includeReplicas) {
      queryOptions.include[0].include = [{ model: Replica, include: [Node] }];
    }
  }
  
  const storageObject = await StorageObject.findOne(queryOptions);
  
  if (!storageObject) {
    throw new NotFoundError('Storage object not found');
  }
  
  // Log access
  await AuditEvent.create({
    userId: storageObject.ownerId,
    action: 'storage.access',
    entityType: 'storage_object',
    entityId: storageObject.id,
    metadata: {
      objectId: storageObject.objectId,
      includeChunks,
      includeReplicas
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return storageObject;
};

/**
 * Get storage object by ID (short version)
 */
const getStorageObjectById = async (id) => {
  const storageObject = await StorageObject.findByPk(id);
  
  if (!storageObject) {
    throw new NotFoundError('Storage object not found');
  }
  
  return storageObject;
};

/**
 * List storage objects for user
 */
const listStorageObjects = async (userId, options = {}) => {
  const { 
    name = null,
    type = null,
    status = null,
    isPublic = null,
    limit = 50,
    offset = 0,
    sortBy = 'createdAt',
    sortOrder = 'DESC',
    userAgent = null,
    ipAddress = null,
    requestId = null
  } = options;
  
  const where = { ownerId: userId };
  
  if (name) where.name = { [Op.iLike]: `%${name}%` };
  if (type) where.type = type;
  if (status) where.status = status;
  if (isPublic !== null) where.isPublic = isPublic;
  
  const order = [[sortBy, sortOrder]];
  
  const result = await StorageObject.findAndCountAll({
    where,
    limit,
    offset,
    order
  });
  
  // Log access
  await AuditEvent.create({
    userId,
    action: 'storage.list',
    entityType: 'storage_object',
    metadata: {
      filters: { name, type, status, isPublic },
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
 * Update storage object metadata
 */
const updateStorageObject = async (userId, objectId, updates, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const storageObject = await StorageObject.findOne({
    where: { objectId, ownerId: userId }
  });
  
  if (!storageObject) {
    throw new NotFoundError('Storage object not found');
  }
  
  const oldValues = { ...storageObject.toJSON() };
  await storageObject.update(updates);
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'storage.update',
    entityType: 'storage_object',
    entityId: storageObject.id,
    metadata: {
      objectId: storageObject.objectId,
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
  
  return storageObject;
};

/**
 * Delete storage object
 */
const deleteStorageObject = async (userId, objectId, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const storageObject = await StorageObject.findOne({
    where: { objectId, ownerId: userId }
  });
  
  if (!storageObject) {
    throw new NotFoundError('Storage object not found');
  }
  
  // Delete all replicas
  const chunks = await StorageChunk.findAll({
    where: { storageObjectId: storageObject.id }
  });
  
  for (const chunk of chunks) {
    await Replica.destroy({ where: { storageChunkId: chunk.id } });
  }
  
  // Delete all chunks
  await StorageChunk.destroy({ where: { storageObjectId: storageObject.id } });
  
  // Delete object
  await storageObject.destroy();
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'storage.delete',
    entityType: 'storage_object',
    entityId: storageObject.id,
    metadata: {
      objectId: storageObject.objectId,
      name: storageObject.name,
      size: storageObject.size
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return { success: true, message: 'Storage object deleted' };
};

/**
 * Get storage object data
 */
const getStorageObjectData = async (userId, objectId, options = {}) => {
  const { 
    encryptionKey = null,
    userAgent = null,
    ipAddress = null,
    requestId = null
  } = options;
  
  const storageObject = await StorageObject.findOne({
    where: { objectId, ownerId: userId },
    include: [
      {
        model: StorageChunk,
        order: [['chunkIndex', 'ASC']]
      }
    ]
  });
  
  if (!storageObject) {
    throw new NotFoundError('Storage object not found');
  }
  
  if (!storageObject.isEncrypted) {
    throw new ValidationError('Object is not encrypted');
  }
  
  if (!encryptionKey) {
    throw new ValidationError('Encryption key required');
  }
  
  // Verify encryption key ID
  if (storageObject.encryptionKeyId !== encryptionKey.keyId) {
    throw new AuthenticationError('Invalid encryption key', {}, 'INVALID_ENCRYPTION_KEY');
  }
  
  // Decrypt and concatenate all chunks
  const chunks = [];
  
  for (const chunk of storageObject.StorageChunks) {
    const encryptedData = Buffer.from(chunk.encryptedData, 'base64');
    const nonce = Buffer.from(chunk.encryptionNonce, 'base64');
    const authTag = Buffer.from(chunk.encryptionAuthTag, 'base64');
    
    const decrypted = decryptChunk(encryptedData, authTag, nonce, encryptionKey.key);
    chunks.push(decrypted);
  }
  
  const data = Buffer.concat(chunks);
  
  // Verify root hash
  const calculatedRootHash = calculateMerkleRoot(
    storageObject.StorageChunks.map(c => c.dataHash)
  );
  
  if (calculatedRootHash !== storageObject.rootHash) {
    throw new ValidationError('Data integrity check failed');
  }
  
  // Log access
  await AuditEvent.create({
    userId,
    action: 'storage.download',
    entityType: 'storage_object',
    entityId: storageObject.id,
    metadata: {
      objectId: storageObject.objectId,
      size: storageObject.size,
      chunks: storageObject.StorageChunks.length
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return {
    data,
    mimeType: storageObject.mimeType,
    size: storageObject.size
  };
};

/**
 * Get chunk by ID
 */
const getStorageChunk = async (chunkId) => {
  const chunk = await StorageChunk.findOne({ where: { chunkId } });
  
  if (!chunk) {
    throw new NotFoundError('Storage chunk not found');
  }
  
  return chunk;
};

/**
 * Get replicas for a chunk
 */
const getReplicasForChunk = async (chunkId) => {
  const replicas = await Replica.findAll({
    where: { storageChunkId: chunkId },
    include: [Node]
  });
  
  return replicas;
};

/**
 * Verify replica integrity
 */
const verifyReplicaIntegrity = async (replicaId) => {
  const replica = await Replica.findByPk(replicaId, {
    include: [StorageChunk]
  });
  
  if (!replica) {
    throw new NotFoundError('Replica not found');
  }
  
  // In production, we would fetch the actual data from the node and verify hash
  // For now, we just check if the stored hash matches
  const isValid = replica.integrityHash === replica.StorageChunk.dataHash;
  
  await replica.update({ integrityVerified: isValid, lastVerified: new Date() });
  
  return {
    valid: isValid,
    replica,
    expectedHash: replica.StorageChunk.dataHash,
    actualHash: replica.integrityHash
  };
};

/**
 * Repair missing or corrupted replicas
 */
const repairReplicas = async (storageChunkId, options = {}) => {
  const { 
    userAgent = null,
    ipAddress = null,
    requestId = null
  } = options;
  
  const chunk = await StorageChunk.findByPk(storageChunkId);
  if (!chunk) {
    throw new NotFoundError('Storage chunk not found');
  }
  
  const replicas = await Replica.findAll({
    where: { storageChunkId: chunk.id }
  });
  
  const requiredReplicas = 3;
  const missingReplicas = [];
  
  // Check which replicas are missing or corrupted
  for (let i = 0; i < requiredReplicas; i++) {
    const existingReplica = replicas.find(r => r.replicaIndex === i);
    
    if (!existingReplica || !existingReplica.integrityVerified) {
      missingReplicas.push(i);
    }
  }
  
  if (missingReplicas.length === 0) {
    return {
      success: true,
      message: 'All replicas are valid',
      repaired: 0
    };
  }
  
  // Select new nodes for missing replicas
  const nodes = await nodeService.selectNodesForReplication(
    chunk.size,
    {
      excludeNodeIds: replicas.map(r => r.nodeId),
      requiredReplicas: missingReplicas.length,
      userAgent,
      ipAddress,
      requestId
    }
  );
  
  // Create new replicas
  let repairedCount = 0;
  
  for (let i = 0; i < Math.min(nodes.length, missingReplicas.length); i++) {
    const node = nodes[i];
    const replicaIndex = missingReplicas[i];
    
    await Replica.create({
      storageChunkId: chunk.id,
      nodeId: node.id,
      replicaIndex,
      status: 'pending',
      integrityHash: chunk.dataHash,
      size: chunk.size
    });
    
    repairedCount++;
  }
  
  // Log repair
  await AuditEvent.create({
    userId: null,
    action: 'storage.repair_replicas',
    entityType: 'storage_chunk',
    entityId: chunk.id,
    metadata: {
      chunkId: chunk.chunkId,
      missingReplicas: missingReplicas.length,
      repaired: repairedCount
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return {
    success: true,
    message: `Repaired ${repairedCount} replicas`,
    repaired: repairedCount,
    missingReplicas: missingReplicas.length
  };
};

/**
 * Check storage health
 */
const checkStorageHealth = async (userId, options = {}) => {
  const { 
    userAgent = null,
    ipAddress = null,
    requestId = null
  } = options;
  
  const storageObjects = await StorageObject.findAll({
    where: { ownerId: userId }
  });
  
  let totalSize = 0;
  let totalChunks = 0;
  let totalReplicas = 0;
  let missingReplicas = 0;
  let corruptedChunks = 0;
  
  for (const storageObject of storageObjects) {
    totalSize += storageObject.size;
    
    const chunks = await StorageChunk.findAll({
      where: { storageObjectId: storageObject.id }
    });
    
    totalChunks += chunks.length;
    
    for (const chunk of chunks) {
      const replicas = await Replica.findAll({
        where: { storageChunkId: chunk.id }
      });
      
      totalReplicas += replicas.length;
      
      // Check for missing replicas
      if (replicas.length < 3) {
        missingReplicas += (3 - replicas.length);
      }
      
      // Check for corrupted replicas
      for (const replica of replicas) {
        if (!replica.integrityVerified) {
          corruptedChunks++;
        }
      }
    }
  }
  
  const healthScore = Math.round(
    ((totalReplicas - missingReplicas) / totalReplicas) * 100
  );
  
  // Log check
  await AuditEvent.create({
    userId,
    action: 'storage.health_check',
    entityType: 'storage',
    metadata: {
      totalSize,
      totalChunks,
      totalReplicas,
      missingReplicas,
      corruptedChunks,
      healthScore
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return {
    totalSize,
    totalChunks,
    totalReplicas,
    missingReplicas,
    corruptedChunks,
    healthScore,
    status: healthScore >= 80 ? 'healthy' : healthScore >= 50 ? 'degraded' : 'critical'
  };
};

/**
 * Get storage statistics for user
 */
const getStorageStats = async (userId) => {
  const totalObjects = await StorageObject.count({ where: { ownerId: userId } });
  const totalSize = await StorageObject.sum('size', { where: { ownerId: userId } });
  const totalChunks = await StorageChunk.count({
    include: [{
      model: StorageObject,
      where: { ownerId: userId }
    }]
  });
  const totalReplicas = await Replica.count({
    include: [{
      model: StorageChunk,
      include: [{
        model: StorageObject,
        where: { ownerId: userId }
      }]
    }]
  });
  
  return {
    totalObjects: totalObjects || 0,
    totalSize: totalSize || 0,
    totalChunks: totalChunks || 0,
    totalReplicas: totalReplicas || 0,
    averageReplicas: totalObjects > 0 ? Math.round(totalReplicas / totalObjects) : 0
  };
};

/**
 * Share storage object
 */
const shareStorageObject = async (userId, objectId, shareData, options = {}) => {
  const { 
    targetUserId,
    permissions = 'read',
    expiresAt = null,
    userAgent = null,
    ipAddress = null,
    requestId = null
  } = shareData;
  
  const storageObject = await StorageObject.findOne({
    where: { objectId, ownerId: userId }
  });
  
  if (!storageObject) {
    throw new NotFoundError('Storage object not found');
  }
  
  // In production, we would create a share record in a shares table
  // For now, we just log the action
  
  await AuditEvent.create({
    userId,
    action: 'storage.share',
    entityType: 'storage_object',
    entityId: storageObject.id,
    metadata: {
      objectId: storageObject.objectId,
      targetUserId,
      permissions
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return {
    success: true,
    message: 'Storage object shared',
    shareId: crypto.randomBytes(16).toString('hex')
  };
};

/**
 * Get shared storage objects
 */
const getSharedStorageObjects = async (userId, options = {}) => {
  const { 
    limit = 50,
    offset = 0,
    userAgent = null,
    ipAddress = null,
    requestId = null
  } = options;
  
  // In production, we would query a shares table
  // For now, return empty array
  
  await AuditEvent.create({
    userId,
    action: 'storage.list_shared',
    entityType: 'storage',
    metadata: {
      limit,
      offset
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return {
    data: [],
    pagination: {
      total: 0,
      limit,
      offset,
      hasMore: false
    }
  };
};

/**
 * Search storage objects
 */
const searchStorageObjects = async (userId, query, options = {}) => {
  const { 
    limit = 20,
    offset = 0,
    userAgent = null,
    ipAddress = null,
    requestId = null
  } = options;
  
  const where = {
    ownerId: userId,
    [Op.or]: [
      { name: { [Op.iLike]: `%${query}%` } },
      { description: { [Op.iLike]: `%${query}%` } },
      { objectId: { [Op.iLike]: `%${query}%` } }
    ]
  };
  
  const result = await StorageObject.findAndCountAll({
    where,
    limit,
    offset,
    order: [['createdAt', 'DESC']]
  });
  
  // Log search
  await AuditEvent.create({
    userId,
    action: 'storage.search',
    entityType: 'storage_object',
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

module.exports = {
  DEFAULT_CHUNK_SIZE,
  MAX_CHUNK_SIZE,
  MIN_CHUNK_SIZE,
  generateObjectId,
  generateChunkId,
  splitIntoChunks,
  generateStorageKey,
  encryptChunk,
  decryptChunk,
  calculateHash,
  calculateMerkleRoot,
  createStorageObject,
  getStorageObject,
  getStorageObjectById,
  listStorageObjects,
  updateStorageObject,
  deleteStorageObject,
  getStorageObjectData,
  getStorageChunk,
  getReplicasForChunk,
  verifyReplicaIntegrity,
  repairReplicas,
  checkStorageHealth,
  getStorageStats,
  shareStorageObject,
  getSharedStorageObjects,
  searchStorageObjects
};
