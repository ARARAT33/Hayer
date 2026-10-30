const express = require('express');
const router = express.Router();
const registryController = require('../controllers/registry.controller');
const { jwtAuth, isAdmin, checkRole, checkPermission } = require('../middleware/authentication');
const { asyncHandler } = require('../middleware/errorHandler');
const rateLimit = require('express-rate-limit');
const config = require('../config');

// Rate limiting for registry routes
const registryLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: 30,
  message: {
    error: true,
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests. Please try again later.',
    timestamp: new Date().toISOString()
  }
});

// Public routes

// Get registry
router.get('/', asyncHandler(registryController.getRegistry));

// Get registry schema
router.get('/schema', asyncHandler(registryController.getRegistrySchema));

// Get registry version
router.get('/version', asyncHandler(registryController.getRegistryVersion));

// Get registry sources
router.get('/sources', asyncHandler(registryController.getRegistrySources));

// Get registry statistics
router.get('/statistics', asyncHandler(registryController.getRegistryStatistics));

// Search registry
router.get('/search', asyncHandler(registryController.searchRegistry));

// Get nodes from registry
router.get('/nodes', asyncHandler(registryController.getNodes));

// Get node from registry
router.get('/nodes/:nodeId', asyncHandler(registryController.getNode));

// Get services from registry
router.get('/services', asyncHandler(registryController.getServices));

// Get service from registry
router.get('/services/:serviceId', asyncHandler(registryController.getService));

// Get service instances from registry
router.get('/instances', asyncHandler(registryController.getInstances));

// Get service instance from registry
router.get('/instances/:instanceId', asyncHandler(registryController.getInstance));

// Get registry snapshot
router.get('/snapshot', asyncHandler(registryController.getRegistrySnapshot));

// Verify registry signature
router.post('/verify', asyncHandler(registryController.verifyRegistry));

// Authenticated routes (require JWT)

// Submit node to registry
router.post('/nodes', jwtAuth(), asyncHandler(registryController.submitNode));

// Update node in registry
router.patch('/nodes/:nodeId', jwtAuth(), asyncHandler(registryController.updateNode));

// Remove node from registry
router.delete('/nodes/:nodeId', jwtAuth(), asyncHandler(registryController.removeNode));

// Submit service to registry
router.post('/services', jwtAuth(), asyncHandler(registryController.submitService));

// Update service in registry
router.patch('/services/:serviceId', jwtAuth(), asyncHandler(registryController.updateService));

// Remove service from registry
router.delete('/services/:serviceId', jwtAuth(), asyncHandler(registryController.removeService));

// Submit instance to registry
router.post('/instances', jwtAuth(), asyncHandler(registryController.submitInstance));

// Update instance in registry
router.patch('/instances/:instanceId', jwtAuth(), asyncHandler(registryController.updateInstance));

// Remove instance from registry
router.delete('/instances/:instanceId', jwtAuth(), asyncHandler(registryController.removeInstance));

// Sync registry
router.post('/sync', jwtAuth(), asyncHandler(registryController.syncRegistry));

// Validate registry entry
router.post('/validate', jwtAuth(), asyncHandler(registryController.validateRegistryEntry));

// Admin routes (require admin privileges)

// Get full registry (admin)
router.get('/admin', jwtAuth(), isAdmin, asyncHandler(registryController.getFullRegistry));

// Update registry (admin)
router.post('/admin', jwtAuth(), isAdmin, asyncHandler(registryController.updateFullRegistry));

// Rebuild registry (admin)
router.post('/admin/rebuild', jwtAuth(), isAdmin, asyncHandler(registryController.rebuildRegistry));

// Validate registry (admin)
router.post('/admin/validate', jwtAuth(), isAdmin, asyncHandler(registryController.validateFullRegistry));

// Export registry (admin)
router.get('/admin/export', jwtAuth(), isAdmin, asyncHandler(registryController.exportRegistry));

// Import registry (admin)
router.post('/admin/import', jwtAuth(), isAdmin, asyncHandler(registryController.importRegistry));

// Sign registry (admin)
router.post('/admin/sign', jwtAuth(), isAdmin, asyncHandler(registryController.signRegistry));

// Verify registry signature (admin)
router.post('/admin/verify-signature', jwtAuth(), isAdmin, asyncHandler(registryController.verifyRegistrySignature));

// Get registry history (admin)
router.get('/admin/history', jwtAuth(), isAdmin, asyncHandler(registryController.getRegistryHistory));

// Get registry changes (admin)
router.get('/admin/changes', jwtAuth(), isAdmin, asyncHandler(registryController.getRegistryChanges));

// Rollback registry (admin)
router.post('/admin/rollback/:version', jwtAuth(), isAdmin, asyncHandler(registryController.rollbackRegistry));

// Registry mirror routes

// Get registry mirrors
router.get('/mirrors', asyncHandler(registryController.getRegistryMirrors));

// Add registry mirror
router.post('/mirrors', jwtAuth(), isAdmin, asyncHandler(registryController.addRegistryMirror));

// Remove registry mirror
router.delete('/mirrors/:mirrorId', jwtAuth(), isAdmin, asyncHandler(registryController.removeRegistryMirror));

// Sync with mirror
router.post('/mirrors/:mirrorId/sync', jwtAuth(), isAdmin, asyncHandler(registryController.syncWithMirror));

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'registry',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
