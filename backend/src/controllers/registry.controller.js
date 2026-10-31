'use strict';

const fs = require('node:fs');
const path = require('node:path');

const registryPath = path.resolve(__dirname, '../../../registry.json');
const schemaPath = path.resolve(__dirname, '../../../registry.schema.json');

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) {
    const wrapped = new Error('Published public registry is unavailable');
    wrapped.statusCode = 503;
    wrapped.code = 'REGISTRY_UNAVAILABLE';
    wrapped.cause = error;
    throw wrapped;
  }
}
function send(res, data) { return res.json({ success: true, data }); }
function getNodes(req) {
  const registry = readJson(registryPath);
  let nodes = Array.isArray(registry.nodes) ? registry.nodes : [];
  const type = String(req.query.type || '').toLowerCase();
  const query = String(req.query.q || '').trim().toLowerCase();
  if (type) nodes = nodes.filter(node => node.type === type);
  if (query) nodes = nodes.filter(node => [node.name, node.url, node.type, node.region].join(' ').toLowerCase().includes(query));
  return nodes;
}
const notWritable = (req, res) => res.status(501).json({
  success: false,
  code: 'PUBLIC_REGISTRY_READ_ONLY',
  message: 'The public HAYER registry is generated from public directories. Direct mutation is disabled.'
});

const controller = {
  getRegistry: (req, res) => send(res, readJson(registryPath)),
  getRegistrySchema: (req, res) => send(res, readJson(schemaPath)),
  getRegistryVersion: (req, res) => send(res, { version: readJson(registryPath).version, generatedAt: readJson(registryPath).generatedAt }),
  getRegistrySources: (req, res) => send(res, readJson(registryPath).sources || []),
  getRegistryStatistics: (req, res) => {
    const nodes = readJson(registryPath).nodes || [];
    const countByType = {};
    for (const node of nodes) countByType[node.type] = (countByType[node.type] || 0) + 1;
    return send(res, { total: nodes.length, countByType, healthy: nodes.filter(n => n.health === 'healthy').length, unknown: nodes.filter(n => n.health === 'unknown').length });
  },
  searchRegistry: (req, res) => send(res, getNodes(req)),
  getNodes: (req, res) => send(res, getNodes(req)),
  getNode: (req, res) => {
    const node = getNodes(req).find(item => item.id === req.params.nodeId);
    return node ? send(res, node) : res.status(404).json({ success: false, code: 'NODE_NOT_FOUND' });
  },
  getServices: (req, res) => send(res, [...new Set((readJson(registryPath).nodes || []).map(n => n.type))].sort()),
  getService: (req, res) => send(res, getNodes({ query: { ...req.query, type: req.params.serviceId } })),
  getInstances: (req, res) => send(res, getNodes(req)),
  getInstance: (req, res) => {
    const node = getNodes(req).find(item => item.id === req.params.instanceId);
    return node ? send(res, node) : res.status(404).json({ success: false, code: 'INSTANCE_NOT_FOUND' });
  },
  getRegistrySnapshot: (req, res) => send(res, readJson(registryPath)),
  verifyRegistry: (req, res) => {
    const snapshot = req.body && req.body.snapshot ? req.body.snapshot : readJson(registryPath);
    const valid = snapshot && Array.isArray(snapshot.nodes) && snapshot.nodes.every(n => typeof n.url === 'string' && n.url.startsWith('https://'));
    return res.json({ success: true, valid, nodeCount: Array.isArray(snapshot && snapshot.nodes) ? snapshot.nodes.length : 0 });
  },
  getRegistryMirrors: (req, res) => send(res, [])
};
for (const name of [
  'submitNode','updateNode','removeNode','submitService','updateService','removeService',
  'submitInstance','updateInstance','removeInstance','syncRegistry','validateRegistryEntry',
  'getFullRegistry','updateFullRegistry','rebuildRegistry','validateFullRegistry','exportRegistry',
  'importRegistry','signRegistry','verifyRegistrySignature','getRegistryHistory','getRegistryChanges',
  'rollbackRegistry','addRegistryMirror','removeRegistryMirror','syncWithMirror'
]) controller[name] = notWritable;

module.exports = controller;
