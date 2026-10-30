const express = require('express');
const router = express.Router();
const storageController = require('../controllers/storage.controller');
const { jwtAuth, isAdmin, checkRole, checkPermission, checkOwnership } = require('../middleware/authentication');
const { asyncHandler } = require('../middleware/errorHandler');
const rateLimit = require('express-rate-limit');
const config = require('../config');

// Rate limiting for storage routes
const storageLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: 50,
  message: {
    error: true,
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests. Please try again later.',
    timestamp: new Date().toISOString()
  }
});

// Public routes

// Get storage object metadata (if public)
router.get('/objects/:objectId/metadata', asyncHandler(storageController.getObjectMetadata));

// Get public storage object
router.get('/objects/:objectId', asyncHandler(storageController.getPublicObject));

// Authenticated routes (require JWT)

// Create storage object
router.post('/objects', jwtAuth(), asyncHandler(storageController.createStorageObject));

// Upload file
router.post('/upload', jwtAuth(), asyncHandler(storageController.uploadFile));

// Upload chunk
router.post('/upload/chunk', jwtAuth(), asyncHandler(storageController.uploadChunk));

// Complete upload
router.post('/upload/:objectId/complete', jwtAuth(), asyncHandler(storageController.completeUpload));

// Get storage object
router.get('/objects/:objectId', jwtAuth(), asyncHandler(storageController.getStorageObject));

// Get storage object metadata
router.get('/objects/:objectId/meta', jwtAuth(), asyncHandler(storageController.getObjectMetadata));

// Get storage object chunks
router.get('/objects/:objectId/chunks', jwtAuth(), asyncHandler(storageController.getObjectChunks));

// Get storage object replicas
router.get('/objects/:objectId/replicas', jwtAuth(), asyncHandler(storageController.getObjectReplicas));

// Update storage object
router.patch('/objects/:objectId', jwtAuth(), checkOwnership(storageController.StorageObject), asyncHandler(storageController.updateStorageObject));

// Delete storage object
router.delete('/objects/:objectId', jwtAuth(), checkOwnership(storageController.StorageObject), asyncHandler(storageController.deleteStorageObject));

// Download file
router.get('/download/:objectId', jwtAuth(), asyncHandler(storageController.downloadFile));

// Download chunk
router.get('/download/:objectId/chunk/:chunkIndex', jwtAuth(), asyncHandler(storageController.downloadChunk));

// List storage objects
router.get('/objects', jwtAuth(), asyncHandler(storageController.listStorageObjects));

// Search storage objects
router.get('/objects/search', jwtAuth(), asyncHandler(storageController.searchStorageObjects));

// Get storage quota
router.get('/quota', jwtAuth(), asyncHandler(storageController.getStorageQuota));

// Get storage usage
router.get('/usage', jwtAuth(), asyncHandler(storageController.getStorageUsage));

// Get storage statistics
router.get('/statistics', jwtAuth(), asyncHandler(storageController.getStorageStatistics));

// Create directory
router.post('/directories', jwtAuth(), asyncHandler(storageController.createDirectory));

// List directories
router.get('/directories', jwtAuth(), asyncHandler(storageController.listDirectories));

// Get directory contents
router.get('/directories/:directoryId', jwtAuth(), asyncHandler(storageController.getDirectoryContents));

// Update directory
router.patch('/directories/:directoryId', jwtAuth(), asyncHandler(storageController.updateDirectory));

// Delete directory
router.delete('/directories/:directoryId', jwtAuth(), asyncHandler(storageController.deleteDirectory));

// Share storage object
router.post('/objects/:objectId/share', jwtAuth(), checkOwnership(storageController.StorageObject), asyncHandler(storageController.shareObject));

// Unshare storage object
router.delete('/objects/:objectId/share/:userId', jwtAuth(), checkOwnership(storageController.StorageObject), asyncHandler(storageController.unshareObject));

// Get shared objects
router.get('/shared', jwtAuth(), asyncHandler(storageController.getSharedObjects));

// Get objects shared with me
router.get('/shared/with-me', jwtAuth(), asyncHandler(storageController.getObjectsSharedWithMe));

// Set object access control
router.patch('/objects/:objectId/access', jwtAuth(), checkOwnership(storageController.StorageObject), asyncHandler(storageController.setObjectAccessControl));

// Set object visibility
router.patch('/objects/:objectId/visibility', jwtAuth(), checkOwnership(storageController.StorageObject), asyncHandler(storageController.setObjectVisibility));

// Set object retention policy
router.patch('/objects/:objectId/retention', jwtAuth(), checkOwnership(storageController.StorageObject), asyncHandler(storageController.setObjectRetentionPolicy));

// Set object tags
router.patch('/objects/:objectId/tags', jwtAuth(), checkOwnership(storageController.StorageObject), asyncHandler(storageController.setObjectTags));

// Set object metadata
router.patch('/objects/:objectId/metadata', jwtAuth(), checkOwnership(storageController.StorageObject), asyncHandler(storageController.setObjectMetadata));

// Admin routes (require admin privileges)

// List all storage objects
router.get('/admin/objects', jwtAuth(), isAdmin, asyncHandler(storageController.listAllStorageObjects));

// Get storage object details (admin)
router.get('/admin/objects/:objectId', jwtAuth(), isAdmin, asyncHandler(storageController.getStorageObjectAdmin));

// Update storage object (admin)
router.patch('/admin/objects/:objectId', jwtAuth(), isAdmin, asyncHandler(storageController.updateStorageObjectAdmin));

// Delete storage object (admin)
router.delete('/admin/objects/:objectId', jwtAuth(), isAdmin, asyncHandler(storageController.deleteStorageObjectAdmin));

// Get storage statistics (admin)
router.get('/admin/statistics', jwtAuth(), isAdmin, asyncHandler(storageController.getStorageStatisticsAdmin));

// Get storage usage by user (admin)
router.get('/admin/usage/:userId', jwtAuth(), isAdmin, asyncHandler(storageController.getStorageUsageByUser));

// Get storage usage by node (admin)
router.get('/admin/usage/node/:nodeId', jwtAuth(), isAdmin, asyncHandler(storageController.getStorageUsageByNode));

// Cleanup storage (admin)
router.post('/admin/cleanup', jwtAuth(), isAdmin, asyncHandler(storageController.cleanupStorage));

// Repair storage (admin)
router.post('/admin/repair', jwtAuth(), isAdmin, asyncHandler(storageController.repairStorage));

// Verify storage integrity (admin)
router.post('/admin/verify', jwtAuth(), isAdmin, asyncHandler(storageController.verifyStorageIntegrity));

// Backup storage (admin)
router.post('/admin/backup', jwtAuth(), isAdmin, asyncHandler(storageController.backupStorage));

// Restore storage (admin)
router.post('/admin/restore', jwtAuth(), isAdmin, asyncHandler(storageController.restoreStorage));

// Export storage data (admin)
router.get('/admin/export', jwtAuth(), isAdmin, asyncHandler(storageController.exportStorageData));

// Storage node routes

// Get storage nodes
router.get('/nodes', jwtAuth(), asyncHandler(storageController.getStorageNodes));

// Get storage node details
router.get('/nodes/:nodeId', jwtAuth(), asyncHandler(storageController.getStorageNodeDetails));

// Get storage node capacity
router.get('/nodes/:nodeId/capacity', jwtAuth(), asyncHandler(storageController.getStorageNodeCapacity));

// Get storage node usage
router.get('/nodes/:nodeId/usage', jwtAuth(), asyncHandler(storageController.getStorageNodeUsage));

// Get storage node health
router.get('/nodes/:nodeId/health', jwtAuth(), asyncHandler(storageController.getStorageNodeHealth));

// Get storage node replicas
router.get('/nodes/:nodeId/replicas', jwtAuth(), asyncHandler(storageController.getStorageNodeReplicas));

// Rebalance storage
router.post('/rebalance', jwtAuth(), isAdmin, asyncHandler(storageController.rebalanceStorage));

// Migrate storage
router.post('/migrate', jwtAuth(), isAdmin, asyncHandler(storageController.migrateStorage));

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'storage',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
