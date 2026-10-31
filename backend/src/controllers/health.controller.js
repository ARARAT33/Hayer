'use strict';

const os = require('node:os');
const { sequelize } = require('../models');

function result(res, status, data) { return res.status(status).json(data); }
async function databaseState() {
  try { await sequelize.authenticate(); return { status: 'healthy' }; }
  catch (error) { return { status: 'unavailable', message: 'Database connection failed' }; }
}
const healthCheck = (req, res) => result(res, 200, { status: 'healthy', service: 'hayer-backend', timestamp: new Date().toISOString() });
const ping = (req, res) => result(res, 200, { status: 'ok', timestamp: new Date().toISOString() });
const livenessCheck = ping;
const databaseHealthCheck = async (req, res) => {
  const db = await databaseState();
  return result(res, db.status === 'healthy' ? 200 : 503, { service: 'database', ...db, timestamp: new Date().toISOString() });
};
const databaseReadinessCheck = databaseHealthCheck;
const pingDatabase = databaseHealthCheck;
const readinessCheck = databaseHealthCheck;
const fullReadinessCheck = databaseHealthCheck;
const startupCheck = databaseHealthCheck;
const getSystemMetrics = (req, res) => result(res, 200, { uptimeSeconds: Math.floor(process.uptime()), memory: process.memoryUsage(), loadAverage: os.loadavg(), cpuCount: os.cpus().length });
const getProcessMetrics = getSystemMetrics;
const getMemoryMetrics = (req, res) => result(res, 200, process.memoryUsage());
const getSystemStatus = async (req, res) => {
  const db = await databaseState();
  return result(res, db.status === 'healthy' ? 200 : 503, { status: db.status === 'healthy' ? 'healthy' : 'degraded', database: db.status });
};
const getVersionInfo = (req, res) => result(res, 200, { name: 'HAYER API', version: '1.0.0', node: process.version });
const detailedHealthCheck = getSystemStatus;

const implemented = {
  healthCheck, detailedHealthCheck, databaseHealthCheck, ping, pingDatabase,
  readinessCheck, databaseReadinessCheck, fullReadinessCheck, startupCheck,
  livenessCheck, getSystemMetrics, getProcessMetrics, getMemoryMetrics,
  getSystemStatus, getVersionInfo
};
const unsupported = name => (req, res) => result(res, 501, {
  success: false, code: 'HEALTH_ENDPOINT_NOT_IMPLEMENTED',
  message: 'This diagnostic endpoint is not implemented yet.', endpoint: name
});
module.exports = new Proxy(implemented, {
  get(target, property) {
    if (typeof property !== 'string') return target[property];
    return target[property] || unsupported(property);
  }
});
