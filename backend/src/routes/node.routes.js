const express = require('express');
const router = express.Router();
const nodeController = require('../controllers/node.controller');
const { jwtAuth, isAdmin, checkRole, checkPermission, checkOwnership } = require('../middleware/authentication');
const { asyncHandler } = require('../middleware/errorHandler');
const rateLimit = require('express-rate-limit');
const config = require('../config');

// Rate limiting for node routes
const nodeLimiter = rateLimit({
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

// Get node information by node ID
router.get('/:nodeId', asyncHandler(nodeController.getNodeById));

// Get node information by URL
router.get('/url/:url', asyncHandler(nodeController.getNodeByUrl));

// List public nodes
router.get('/', asyncHandler(nodeController.listPublicNodes));

// Get node health status
router.get('/:nodeId/health', asyncHandler(nodeController.getNodeHealth));

// Get node statistics
router.get('/:nodeId/statistics', asyncHandler(nodeController.getNodeStatistics));

// Get node capabilities
router.get('/:nodeId/capabilities', asyncHandler(nodeController.getNodeCapabilities));

// Authenticated routes (require JWT)

// Register new node
router.post('/', jwtAuth(), asyncHandler(nodeController.registerNode));

// Get current user's nodes
router.get('/me', jwtAuth(), asyncHandler(nodeController.getCurrentUserNodes));

// Get node details
router.get('/me/:id', jwtAuth(), checkOwnership(nodeController.Node), asyncHandler(nodeController.getNodeDetails));

// Update node
router.patch('/me/:id', jwtAuth(), checkOwnership(nodeController.Node), asyncHandler(nodeController.updateNode));

// Update node status
router.patch('/me/:id/status', jwtAuth(), checkOwnership(nodeController.Node), asyncHandler(nodeController.updateNodeStatus));

// Update node resources
router.patch('/me/:id/resources', jwtAuth(), checkOwnership(nodeController.Node), asyncHandler(nodeController.updateNodeResources));

// Update node configuration
router.patch('/me/:id/config', jwtAuth(), checkOwnership(nodeController.Node), asyncHandler(nodeController.updateNodeConfig));

// Delete node
router.delete('/me/:id', jwtAuth(), checkOwnership(nodeController.Node), asyncHandler(nodeController.deleteNode));

// Get node health checks
router.get('/me/:id/health-checks', jwtAuth(), checkOwnership(nodeController.Node), asyncHandler(nodeController.getNodeHealthChecks));

// Run health check
router.post('/me/:id/health-check', jwtAuth(), checkOwnership(nodeController.Node), asyncHandler(nodeController.runHealthCheck));

// Get node logs
router.get('/me/:id/logs', jwtAuth(), checkOwnership(nodeController.Node), asyncHandler(nodeController.getNodeLogs));

// Get node metrics
router.get('/me/:id/metrics', jwtAuth(), checkOwnership(nodeController.Node), asyncHandler(nodeController.getNodeMetrics));

// Get node storage information
router.get('/me/:id/storage', jwtAuth(), checkOwnership(nodeController.Node), asyncHandler(nodeController.getNodeStorage));

// Admin routes (require admin privileges)

// List all nodes
router.get('/admin/list', jwtAuth(), isAdmin, asyncHandler(nodeController.listAllNodes));

// Get node details (admin)
router.get('/admin/:id', jwtAuth(), isAdmin, asyncHandler(nodeController.getNodeDetailsAdmin));

// Update node (admin)
router.patch('/admin/:id', jwtAuth(), isAdmin, asyncHandler(nodeController.updateNodeAdmin));

// Approve node
router.patch('/admin/:id/approve', jwtAuth(), isAdmin, asyncHandler(nodeController.approveNode));

// Reject node
router.patch('/admin/:id/reject', jwtAuth(), isAdmin, asyncHandler(nodeController.rejectNode));

// Suspend node
router.patch('/admin/:id/suspend', jwtAuth(), isAdmin, asyncHandler(nodeController.suspendNode));

// Unsuspend node
router.patch('/admin/:id/unsuspend', jwtAuth(), isAdmin, asyncHandler(nodeController.unsuspendNode));

// Quarantine node
router.patch('/admin/:id/quarantine', jwtAuth(), isAdmin, asyncHandler(nodeController.quarantineNode));

// Unquarantine node
router.patch('/admin/:id/unquarantine', jwtAuth(), isAdmin, asyncHandler(nodeController.unquarantineNode));

// Revoke node
router.patch('/admin/:id/revoke', jwtAuth(), isAdmin, asyncHandler(nodeController.revokeNode));

// Restore node
router.patch('/admin/:id/restore', jwtAuth(), isAdmin, asyncHandler(nodeController.restoreNode));

// Search nodes (admin)
router.get('/admin/search', jwtAuth(), isAdmin, asyncHandler(nodeController.searchNodes));

// Get node statistics (admin)
router.get('/admin/statistics', jwtAuth(), isAdmin, asyncHandler(nodeController.getNodeStatisticsAdmin));

// Get node registry
router.get('/admin/registry', jwtAuth(), isAdmin, asyncHandler(nodeController.getNodeRegistry));

// Update node registry
router.post('/admin/registry', jwtAuth(), isAdmin, asyncHandler(nodeController.updateNodeRegistry));

// Export node data (admin)
router.get('/admin/export', jwtAuth(), isAdmin, asyncHandler(nodeController.exportNodeData));

// Node management routes

// Pause node
router.post('/me/:id/pause', jwtAuth(), checkOwnership(nodeController.Node), asyncHandler(nodeController.pauseNode));

// Resume node
router.post('/me/:id/resume', jwtAuth(), checkOwnership(nodeController.Node), asyncHandler(nodeController.resumeNode));

// Restart node
router.post('/me/:id/restart', jwtAuth(), checkOwnership(nodeController.Node), asyncHandler(nodeController.restartNode));

// Shutdown node
router.post('/me/:id/shutdown', jwtAuth(), checkOwnership(nodeController.Node), asyncHandler(nodeController.shutdownNode));

// Update node software
router.post('/me/:id/update', jwtAuth(), checkOwnership(nodeController.Node), asyncHandler(nodeController.updateNodeSoftware));

// Get node update status
router.get('/me/:id/update', jwtAuth(), checkOwnership(nodeController.Node), asyncHandler(nodeController.getNodeUpdateStatus));

// Node network routes

// Get node network status
router.get('/network/status', asyncHandler(nodeController.getNetworkStatus));

// Get node network topology
router.get('/network/topology', asyncHandler(nodeController.getNetworkTopology));

// Get node network health
router.get('/network/health', asyncHandler(nodeController.getNetworkHealth));

// Get node network metrics
router.get('/network/metrics', asyncHandler(nodeController.getNetworkMetrics));

// Get node network capacity
router.get('/network/capacity', asyncHandler(nodeController.getNetworkCapacity));

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'node',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
