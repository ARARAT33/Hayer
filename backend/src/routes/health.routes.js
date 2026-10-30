const express = require('express');
const router = express.Router();
const healthController = require('../controllers/health.controller');
const { jwtAuth, isAdmin } = require('../middleware/authentication');
const { asyncHandler } = require('../middleware/errorHandler');

// Public health check
router.get('/', asyncHandler(healthController.healthCheck));

// Detailed health check
router.get('/detailed', asyncHandler(healthController.detailedHealthCheck));

// Service-specific health checks
router.get('/database', asyncHandler(healthController.databaseHealthCheck));
router.get('/cache', asyncHandler(healthController.cacheHealthCheck));
router.get('/storage', asyncHandler(healthController.storageHealthCheck));
router.get('/queue', asyncHandler(healthController.queueHealthCheck));

// Component health checks
router.get('/components', asyncHandler(healthController.getComponentHealth));
router.get('/components/:component', asyncHandler(healthController.getComponentHealthByName));

// System metrics
router.get('/metrics', asyncHandler(healthController.getSystemMetrics));
router.get('/metrics/system', asyncHandler(healthController.getSystemMetrics));
router.get('/metrics/process', asyncHandler(healthController.getProcessMetrics));
router.get('/metrics/memory', asyncHandler(healthController.getMemoryMetrics));
router.get('/metrics/database', asyncHandler(healthController.getDatabaseMetrics));

// Status endpoints
router.get('/status', asyncHandler(healthController.getSystemStatus));
router.get('/status/database', asyncHandler(healthController.getDatabaseStatus));
router.get('/status/cache', asyncHandler(healthController.getCacheStatus));
router.get('/status/storage', asyncHandler(healthController.getStorageStatus));
router.get('/status/queue', asyncHandler(healthController.getQueueStatus));

// Ping endpoints
router.get('/ping', asyncHandler(healthController.ping));
router.get('/ping/database', asyncHandler(healthController.pingDatabase));
router.get('/ping/cache', asyncHandler(healthController.pingCache));

// Readiness checks
router.get('/ready', asyncHandler(healthController.readinessCheck));
router.get('/ready/database', asyncHandler(healthController.databaseReadinessCheck));
router.get('/ready/all', asyncHandler(healthController.fullReadinessCheck));

// Liveness checks
router.get('/live', asyncHandler(healthController.livenessCheck));
router.get('/live/database', asyncHandler(healthController.databaseLivenessCheck));

// Startup checks
router.get('/startup', asyncHandler(healthController.startupCheck));

// Version information
router.get('/version', asyncHandler(healthController.getVersionInfo));
router.get('/version/detailed', asyncHandler(healthController.getDetailedVersionInfo));

// Environment information (admin only)
router.get('/env', jwtAuth(), isAdmin, asyncHandler(healthController.getEnvironmentInfo));

// Configuration information (admin only)
router.get('/config', jwtAuth(), isAdmin, asyncHandler(healthController.getConfigurationInfo));

// System information (admin only)
router.get('/system', jwtAuth(), isAdmin, asyncHandler(healthController.getSystemInfo));

// Health check history (admin only)
router.get('/history', jwtAuth(), isAdmin, asyncHandler(healthController.getHealthCheckHistory));
router.get('/history/:checkId', jwtAuth(), isAdmin, asyncHandler(healthController.getHealthCheckById));

// Clear health check history (admin only)
router.delete('/history', jwtAuth(), isAdmin, asyncHandler(healthController.clearHealthCheckHistory));

// Export health data (admin only)
router.get('/export', jwtAuth(), isAdmin, asyncHandler(healthController.exportHealthData));

// Health alert endpoints (admin only)
router.get('/alerts', jwtAuth(), isAdmin, asyncHandler(healthController.getHealthAlerts));
router.get('/alerts/:alertId', jwtAuth(), isAdmin, asyncHandler(healthController.getHealthAlertById));
router.post('/alerts/:alertId/acknowledge', jwtAuth(), isAdmin, asyncHandler(healthController.acknowledgeHealthAlert));
router.delete('/alerts/:alertId', jwtAuth(), isAdmin, asyncHandler(healthController.deleteHealthAlert));

// Health notification endpoints
router.post('/notify', jwtAuth(), isAdmin, asyncHandler(healthController.notifyHealthStatus));
router.post('/notify/test', jwtAuth(), isAdmin, asyncHandler(healthController.testHealthNotification));

// Custom health checks
router.post('/check', jwtAuth(), isAdmin, asyncHandler(healthController.runCustomHealthCheck));

// Reset health checks
router.post('/reset', jwtAuth(), isAdmin, asyncHandler(healthController.resetHealthChecks));

module.exports = router;
