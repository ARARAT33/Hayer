const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { jwtAuth, isAdmin, checkRole, checkPermission } = require('../middleware/authentication');
const { asyncHandler } = require('../middleware/errorHandler');
const rateLimit = require('express-rate-limit');
const config = require('../config');

// Rate limiting for admin routes
const adminLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: 10,
  message: {
    error: true,
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many admin requests. Please try again later.',
    timestamp: new Date().toISOString()
  }
});

// All admin routes require JWT and admin privileges
router.use(jwtAuth());
router.use(isAdmin);

// Dashboard routes
router.get('/dashboard', asyncHandler(adminController.getAdminDashboard));
router.get('/dashboard/statistics', asyncHandler(adminController.getDashboardStatistics));
router.get('/dashboard/activity', asyncHandler(adminController.getDashboardActivity));
router.get('/dashboard/alerts', asyncHandler(adminController.getDashboardAlerts));

// User management routes
router.get('/users', asyncHandler(adminController.listUsers));
router.get('/users/:userId', asyncHandler(adminController.getUser));
router.patch('/users/:userId', asyncHandler(adminController.updateUser));
router.patch('/users/:userId/suspend', asyncHandler(adminController.suspendUser));
router.patch('/users/:userId/unsuspend', asyncHandler(adminController.unsuspendUser));
router.patch('/users/:userId/ban', asyncHandler(adminController.banUser));
router.patch('/users/:userId/unban', asyncHandler(adminController.unbanUser));
router.patch('/users/:userId/verify', asyncHandler(adminController.verifyUser));
router.patch('/users/:userId/unverify', asyncHandler(adminController.unverifyUser));
router.delete('/users/:userId', asyncHandler(adminController.deleteUser));
router.get('/users/:userId/activity', asyncHandler(adminController.getUserActivity));
router.get('/users/:userId/sessions', asyncHandler(adminController.getUserSessions));
router.post('/users/:userId/impersonate', asyncHandler(adminController.impersonateUser));

// Role management routes
router.get('/roles', asyncHandler(adminController.listRoles));
router.post('/roles', asyncHandler(adminController.createRole));
router.get('/roles/:roleId', asyncHandler(adminController.getRole));
router.patch('/roles/:roleId', asyncHandler(adminController.updateRole));
router.delete('/roles/:roleId', asyncHandler(adminController.deleteRole));
router.get('/roles/:roleId/users', asyncHandler(adminController.getRoleUsers));
router.post('/roles/:roleId/users/:userId', asyncHandler(adminController.assignRoleToUser));
router.delete('/roles/:roleId/users/:userId', asyncHandler(adminController.removeRoleFromUser));

// Permission management routes
router.get('/permissions', asyncHandler(adminController.listPermissions));
router.post('/permissions', asyncHandler(adminController.createPermission));
router.get('/permissions/:permissionId', asyncHandler(adminController.getPermission));
router.patch('/permissions/:permissionId', asyncHandler(adminController.updatePermission));
router.delete('/permissions/:permissionId', asyncHandler(adminController.deletePermission));

// Node management routes
router.get('/nodes', asyncHandler(adminController.listNodes));
router.get('/nodes/:nodeId', asyncHandler(adminController.getNode));
router.patch('/nodes/:nodeId', asyncHandler(adminController.updateNode));
router.patch('/nodes/:nodeId/approve', asyncHandler(adminController.approveNode));
router.patch('/nodes/:nodeId/reject', asyncHandler(adminController.rejectNode));
router.patch('/nodes/:nodeId/suspend', asyncHandler(adminController.suspendNode));
router.patch('/nodes/:nodeId/unsuspend', asyncHandler(adminController.unsuspendNode));
router.patch('/nodes/:nodeId/quarantine', asyncHandler(adminController.quarantineNode));
router.patch('/nodes/:nodeId/unquarantine', asyncHandler(adminController.unquarantineNode));
router.patch('/nodes/:nodeId/revoke', asyncHandler(adminController.revokeNode));
router.patch('/nodes/:nodeId/restore', asyncHandler(adminController.restoreNode));
router.delete('/nodes/:nodeId', asyncHandler(adminController.deleteNode));

// Operator management routes
router.get('/operators', asyncHandler(adminController.listOperators));
router.get('/operators/:operatorId', asyncHandler(adminController.getOperator));
router.patch('/operators/:operatorId', asyncHandler(adminController.updateOperator));
router.patch('/operators/:operatorId/verify', asyncHandler(adminController.verifyOperator));
router.patch('/operators/:operatorId/unverify', asyncHandler(adminController.unverifyOperator));
router.patch('/operators/:operatorId/suspend', asyncHandler(adminController.suspendOperator));
router.patch('/operators/:operatorId/unsuspend', asyncHandler(adminController.unsuspendOperator));
router.delete('/operators/:operatorId', asyncHandler(adminController.deleteOperator));

// Service management routes
router.get('/services', asyncHandler(adminController.listServices));
router.post('/services', asyncHandler(adminController.createService));
router.get('/services/:serviceId', asyncHandler(adminController.getService));
router.patch('/services/:serviceId', asyncHandler(adminController.updateService));
router.delete('/services/:serviceId', asyncHandler(adminController.deleteService));
router.get('/services/:serviceId/instances', asyncHandler(adminController.listServiceInstances));
router.get('/services/:serviceId/instances/:instanceId', asyncHandler(adminController.getServiceInstance));
router.patch('/services/:serviceId/instances/:instanceId', asyncHandler(adminController.updateServiceInstance));
router.delete('/services/:serviceId/instances/:instanceId', asyncHandler(adminController.deleteServiceInstance));

// Storage management routes
router.get('/storage', asyncHandler(adminController.getStorageInfo));
router.get('/storage/statistics', asyncHandler(adminController.getStorageStatistics));
router.get('/storage/usage', asyncHandler(adminController.getStorageUsage));
router.get('/storage/objects', asyncHandler(adminController.listStorageObjects));
router.get('/storage/objects/:objectId', asyncHandler(adminController.getStorageObject));
router.patch('/storage/objects/:objectId', asyncHandler(adminController.updateStorageObject));
router.delete('/storage/objects/:objectId', asyncHandler(adminController.deleteStorageObject));
router.post('/storage/cleanup', asyncHandler(adminController.cleanupStorage));
router.post('/storage/repair', asyncHandler(adminController.repairStorage));
router.post('/storage/verify', asyncHandler(adminController.verifyStorage));
router.post('/storage/backup', asyncHandler(adminController.backupStorage));
router.post('/storage/restore', asyncHandler(adminController.restoreStorage));

// Community management routes
router.get('/communities', asyncHandler(adminController.listCommunities));
router.get('/communities/:communityId', asyncHandler(adminController.getCommunity));
router.patch('/communities/:communityId', asyncHandler(adminController.updateCommunity));
router.patch('/communities/:communityId/verify', asyncHandler(adminController.verifyCommunity));
router.patch('/communities/:communityId/unverify', asyncHandler(adminController.unverifyCommunity));
router.patch('/communities/:communityId/feature', asyncHandler(adminController.featureCommunity));
router.patch('/communities/:communityId/unfeature', asyncHandler(adminController.unfeatureCommunity));
router.delete('/communities/:communityId', asyncHandler(adminController.deleteCommunity));

// Audit log routes
router.get('/audit', asyncHandler(adminController.getAuditLogs));
router.get('/audit/:logId', asyncHandler(adminController.getAuditLog));
router.get('/audit/users/:userId', asyncHandler(adminController.getAuditLogsByUser));
router.get('/audit/actions/:action', asyncHandler(adminController.getAuditLogsByAction));
router.get('/audit/categories/:category', asyncHandler(adminController.getAuditLogsByCategory));
router.delete('/audit', asyncHandler(adminController.clearAuditLogs));
router.get('/audit/export', asyncHandler(adminController.exportAuditLogs));

// System management routes
router.get('/system', asyncHandler(adminController.getSystemInfo));
router.get('/system/health', asyncHandler(adminController.getSystemHealth));
router.get('/system/metrics', asyncHandler(adminController.getSystemMetrics));
router.get('/system/status', asyncHandler(adminController.getSystemStatus));
router.post('/system/restart', asyncHandler(adminController.restartSystem));
router.post('/system/shutdown', asyncHandler(adminController.shutdownSystem));
router.post('/system/maintenance/enable', asyncHandler(adminController.enableMaintenance));
router.post('/system/maintenance/disable', asyncHandler(adminController.disableMaintenance));

// Configuration management routes
router.get('/config', asyncHandler(adminController.getConfiguration));
router.patch('/config', asyncHandler(adminController.updateConfiguration));
router.get('/config/:key', asyncHandler(adminController.getConfigurationKey));
router.patch('/config/:key', asyncHandler(adminController.updateConfigurationKey));
router.delete('/config/:key', asyncHandler(adminController.deleteConfigurationKey));

// Backup management routes
router.get('/backups', asyncHandler(adminController.listBackups));
router.post('/backups', asyncHandler(adminController.createBackup));
router.get('/backups/:backupId', asyncHandler(adminController.getBackup));
router.post('/backups/:backupId/restore', asyncHandler(adminController.restoreBackup));
router.delete('/backups/:backupId', asyncHandler(adminController.deleteBackup));
router.get('/backups/export', asyncHandler(adminController.exportBackup));
router.post('/backups/import', asyncHandler(adminController.importBackup));

// Notification management routes
router.get('/notifications', asyncHandler(adminController.listNotifications));
router.post('/notifications', asyncHandler(adminController.createNotification));
router.get('/notifications/:notificationId', asyncHandler(adminController.getNotification));
router.patch('/notifications/:notificationId', asyncHandler(adminController.updateNotification));
router.delete('/notifications/:notificationId', asyncHandler(adminController.deleteNotification));
router.post('/notifications/send', asyncHandler(adminController.sendNotification));
router.post('/notifications/broadcast', asyncHandler(adminController.broadcastNotification));

// Report management routes
router.get('/reports', asyncHandler(adminController.listReports));
router.get('/reports/:reportId', asyncHandler(adminController.getReport));
router.patch('/reports/:reportId', asyncHandler(adminController.updateReport));
router.delete('/reports/:reportId', asyncHandler(adminController.deleteReport));
router.post('/reports/:reportId/resolve', asyncHandler(adminController.resolveReport));
router.get('/reports/users/:userId', asyncHandler(adminController.getReportsByUser));

// Security management routes
router.get('/security', asyncHandler(adminController.getSecurityInfo));
router.get('/security/audits', asyncHandler(adminController.getSecurityAudits));
router.get('/security/vulnerabilities', asyncHandler(adminController.getSecurityVulnerabilities));
router.get('/security/threats', asyncHandler(adminController.getSecurityThreats));
router.post('/security/scan', asyncHandler(adminController.runSecurityScan));
router.post('/security/audit', asyncHandler(adminController.runSecurityAudit));
router.get('/security/alerts', asyncHandler(adminController.getSecurityAlerts));
router.post('/security/alerts/:alertId/acknowledge', asyncHandler(adminController.acknowledgeSecurityAlert));

// Monitoring routes
router.get('/monitoring', asyncHandler(adminController.getMonitoringInfo));
router.get('/monitoring/metrics', asyncHandler(adminController.getMonitoringMetrics));
router.get('/monitoring/alerts', asyncHandler(adminController.getMonitoringAlerts));
router.post('/monitoring/alerts/:alertId/acknowledge', asyncHandler(adminController.acknowledgeMonitoringAlert));
router.get('/monitoring/status', asyncHandler(adminController.getMonitoringStatus));

// Analytics routes
router.get('/analytics', asyncHandler(adminController.getAnalytics));
router.get('/analytics/users', asyncHandler(adminController.getUserAnalytics));
router.get('/analytics/nodes', asyncHandler(adminController.getNodeAnalytics));
router.get('/analytics/storage', asyncHandler(adminController.getStorageAnalytics));
router.get('/analytics/services', asyncHandler(adminController.getServiceAnalytics));

// Export routes
router.get('/export/users', asyncHandler(adminController.exportUsers));
router.get('/export/nodes', asyncHandler(adminController.exportNodes));
router.get('/export/storage', asyncHandler(adminController.exportStorage));
router.get('/export/services', asyncHandler(adminController.exportServices));
router.get('/export/communities', asyncHandler(adminController.exportCommunities));
router.get('/export/audit', asyncHandler(adminController.exportAudit));

// Import routes
router.post('/import/users', asyncHandler(adminController.importUsers));
router.post('/import/nodes', asyncHandler(adminController.importNodes));
router.post('/import/storage', asyncHandler(adminController.importStorage));
router.post('/import/services', asyncHandler(adminController.importServices));
router.post('/import/communities', asyncHandler(adminController.importCommunities));

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'admin',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
