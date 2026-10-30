const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/service.controller');
const { jwtAuth, isAdmin, checkRole, checkPermission, checkOwnership } = require('../middleware/authentication');
const { asyncHandler } = require('../middleware/errorHandler');
const rateLimit = require('express-rate-limit');
const config = require('../config');

// Rate limiting for service routes
const serviceLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: 20,
  message: {
    error: true,
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests. Please try again later.',
    timestamp: new Date().toISOString()
  }
});

// Public routes

// List public services
router.get('/', asyncHandler(serviceController.listPublicServices));

// Get service by ID
router.get('/:serviceId', asyncHandler(serviceController.getServiceById));

// Get service by name
router.get('/name/:name', asyncHandler(serviceController.getServiceByName));

// Search services
router.get('/search', asyncHandler(serviceController.searchServices));

// Get service categories
router.get('/categories', asyncHandler(serviceController.getServiceCategories));

// Get service types
router.get('/types', asyncHandler(serviceController.getServiceTypes));

// Get featured services
router.get('/featured', asyncHandler(serviceController.getFeaturedServices));

// Get popular services
router.get('/popular', asyncHandler(serviceController.getPopularServices));

// Get service instances
router.get('/:serviceId/instances', asyncHandler(serviceController.getServiceInstances));

// Get service instance by ID
router.get('/:serviceId/instances/:instanceId', asyncHandler(serviceController.getServiceInstanceById));

// Authenticated routes (require JWT)

// Create service instance
router.post('/:serviceId/instances', jwtAuth(), asyncHandler(serviceController.createServiceInstance));

// Get current user's service instances
router.get('/me/instances', jwtAuth(), asyncHandler(serviceController.getCurrentUserServiceInstances));

// Get service instance details
router.get('/me/instances/:instanceId', jwtAuth(), checkOwnership(serviceController.ServiceInstance), asyncHandler(serviceController.getServiceInstanceDetails));

// Update service instance
router.patch('/me/instances/:instanceId', jwtAuth(), checkOwnership(serviceController.ServiceInstance), asyncHandler(serviceController.updateServiceInstance));

// Update service instance configuration
router.patch('/me/instances/:instanceId/config', jwtAuth(), checkOwnership(serviceController.ServiceInstance), asyncHandler(serviceController.updateServiceInstanceConfig));

// Update service instance credentials
router.patch('/me/instances/:instanceId/credentials', jwtAuth(), checkOwnership(serviceController.ServiceInstance), asyncHandler(serviceController.updateServiceInstanceCredentials));

// Delete service instance
router.delete('/me/instances/:instanceId', jwtAuth(), checkOwnership(serviceController.ServiceInstance), asyncHandler(serviceController.deleteServiceInstance));

// Connect to service instance
router.post('/me/instances/:instanceId/connect', jwtAuth(), checkOwnership(serviceController.ServiceInstance), asyncHandler(serviceController.connectToServiceInstance));

// Disconnect from service instance
router.post('/me/instances/:instanceId/disconnect', jwtAuth(), checkOwnership(serviceController.ServiceInstance), asyncHandler(serviceController.disconnectFromServiceInstance));

// Get service instance status
router.get('/me/instances/:instanceId/status', jwtAuth(), checkOwnership(serviceController.ServiceInstance), asyncHandler(serviceController.getServiceInstanceStatus));

// Get service instance health
router.get('/me/instances/:instanceId/health', jwtAuth(), checkOwnership(serviceController.ServiceInstance), asyncHandler(serviceController.getServiceInstanceHealth));

// Get service instance users
router.get('/me/instances/:instanceId/users', jwtAuth(), checkOwnership(serviceController.ServiceInstance), asyncHandler(serviceController.getServiceInstanceUsers));

// Invite user to service instance
router.post('/me/instances/:instanceId/invite', jwtAuth(), checkOwnership(serviceController.ServiceInstance), asyncHandler(serviceController.inviteUserToServiceInstance));

// Remove user from service instance
router.delete('/me/instances/:instanceId/users/:userId', jwtAuth(), checkOwnership(serviceController.ServiceInstance), asyncHandler(serviceController.removeUserFromServiceInstance));

// Get service instance statistics
router.get('/me/instances/:instanceId/statistics', jwtAuth(), checkOwnership(serviceController.ServiceInstance), asyncHandler(serviceController.getServiceInstanceStatistics));

// Sync service instance
router.post('/me/instances/:instanceId/sync', jwtAuth(), checkOwnership(serviceController.ServiceInstance), asyncHandler(serviceController.syncServiceInstance));

// Backup service instance
router.post('/me/instances/:instanceId/backup', jwtAuth(), checkOwnership(serviceController.ServiceInstance), asyncHandler(serviceController.backupServiceInstance));

// Restore service instance
router.post('/me/instances/:instanceId/restore', jwtAuth(), checkOwnership(serviceController.ServiceInstance), asyncHandler(serviceController.restoreServiceInstance));

// Admin routes (require admin privileges)

// Create service
router.post('/', jwtAuth(), isAdmin, asyncHandler(serviceController.createService));

// List all services
router.get('/admin/list', jwtAuth(), isAdmin, asyncHandler(serviceController.listAllServices));

// Get service details (admin)
router.get('/admin/:serviceId', jwtAuth(), isAdmin, asyncHandler(serviceController.getServiceDetails));

// Update service
router.patch('/admin/:serviceId', jwtAuth(), isAdmin, asyncHandler(serviceController.updateService));

// Delete service
router.delete('/admin/:serviceId', jwtAuth(), isAdmin, asyncHandler(serviceController.deleteService));

// List all service instances (admin)
router.get('/admin/:serviceId/instances', jwtAuth(), isAdmin, asyncHandler(serviceController.listAllServiceInstances));

// Get service instance details (admin)
router.get('/admin/:serviceId/instances/:instanceId', jwtAuth(), isAdmin, asyncHandler(serviceController.getServiceInstanceDetailsAdmin));

// Update service instance (admin)
router.patch('/admin/:serviceId/instances/:instanceId', jwtAuth(), isAdmin, asyncHandler(serviceController.updateServiceInstanceAdmin));

// Delete service instance (admin)
router.delete('/admin/:serviceId/instances/:instanceId', jwtAuth(), isAdmin, asyncHandler(serviceController.deleteServiceInstanceAdmin));

// Verify service instance (admin)
router.patch('/admin/:serviceId/instances/:instanceId/verify', jwtAuth(), isAdmin, asyncHandler(serviceController.verifyServiceInstance));

// Unverify service instance (admin)
router.patch('/admin/:serviceId/instances/:instanceId/unverify', jwtAuth(), isAdmin, asyncHandler(serviceController.unverifyServiceInstance));

// Suspend service instance (admin)
router.patch('/admin/:serviceId/instances/:instanceId/suspend', jwtAuth(), isAdmin, asyncHandler(serviceController.suspendServiceInstance));

// Unsuspend service instance (admin)
router.patch('/admin/:serviceId/instances/:instanceId/unsuspend', jwtAuth(), isAdmin, asyncHandler(serviceController.unsuspendServiceInstance));

// Search services (admin)
router.get('/admin/search', jwtAuth(), isAdmin, asyncHandler(serviceController.searchServicesAdmin));

// Get service statistics (admin)
router.get('/admin/statistics', jwtAuth(), isAdmin, asyncHandler(serviceController.getServiceStatistics));

// Get service usage (admin)
router.get('/admin/usage', jwtAuth(), isAdmin, asyncHandler(serviceController.getServiceUsage));

// Export service data (admin)
router.get('/admin/export', jwtAuth(), isAdmin, asyncHandler(serviceController.exportServiceData));

// Service integration routes

// Get service integration options
router.get('/:serviceId/integration/options', jwtAuth(), asyncHandler(serviceController.getServiceIntegrationOptions));

// Test service integration
router.post('/:serviceId/integration/test', jwtAuth(), asyncHandler(serviceController.testServiceIntegration));

// Setup service integration
router.post('/:serviceId/integration/setup', jwtAuth(), asyncHandler(serviceController.setupServiceIntegration));

// Remove service integration
router.delete('/:serviceId/integration', jwtAuth(), asyncHandler(serviceController.removeServiceIntegration));

// Get service integration status
router.get('/:serviceId/integration/status', jwtAuth(), asyncHandler(serviceController.getServiceIntegrationStatus));

// Service federation routes

// Get service federation information
router.get('/:serviceId/federation', asyncHandler(serviceController.getServiceFederationInfo));

// Join federation
router.post('/:serviceId/federation/join', jwtAuth(), asyncHandler(serviceController.joinFederation));

// Leave federation
router.post('/:serviceId/federation/leave', jwtAuth(), asyncHandler(serviceController.leaveFederation));

// Get federation members
router.get('/:serviceId/federation/members', asyncHandler(serviceController.getFederationMembers));

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'service',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
