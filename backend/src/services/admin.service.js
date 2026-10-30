/**
 * Admin Service
 * Provides administrative functions for HAYER ecosystem management
 */

const { Op } = require('sequelize');
const config = require('../config');
const { 
  User, 
  Session, 
  Role, 
  Permission, 
  UserRole,
  Node, 
  Operator,
  Service,
  ServiceInstance,
  StorageObject,
  StorageChunk,
  Replica,
  Community,
  CommunityMember,
  Notification,
  AuditEvent,
  HayerId,
  Backup,
  Report
} = require('../models');
const { 
  NotFoundError, 
  ConflictError,
  ValidationError,
  AuthenticationError,
  AuthorizationError
} = require('../middleware/errorHandler');

// Dashboard methods
const getAdminDashboard = async () => {
  const [userCount, activeUserCount, nodeCount, activeNodeCount, storageCount, communityCount, serviceCount] = await Promise.all([
    User.count(),
    User.count({ where: { isActive: true } }),
    Node.count(),
    Node.count({ where: { isActive: true } }),
    StorageObject.count(),
    Community.count(),
    Service.count()
  ]);
  return {
    users: { total: userCount, active: activeUserCount },
    nodes: { total: nodeCount, active: activeNodeCount },
    storage: { objects: storageCount },
    communities: { total: communityCount },
    services: { total: serviceCount }
  };
};

const getDashboardStatistics = async (options = {}) => {
  const { days = 7 } = options;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const [newUsers, newNodes, newCommunities, newStorageObjects, activeSessions] = await Promise.all([
    User.count({ where: { createdAt: { [Op.gte]: startDate } } }),
    Node.count({ where: { createdAt: { [Op.gte]: startDate } } }),
    Community.count({ where: { createdAt: { [Op.gte]: startDate } } }),
    StorageObject.count({ where: { createdAt: { [Op.gte]: startDate } } }),
    Session.count({ where: { isActive: true, expiresAt: { [Op.gt]: new Date() } } })
  ]);
  return { period: `${days} days`, newUsers, newNodes, newCommunities, newStorageObjects, activeSessions };
};

const getDashboardActivity = async (options = {}) => {
  const { limit = 20 } = options;
  const activity = await AuditEvent.findAll({ limit, order: [['createdAt', 'DESC']], include: [User] });
  return activity;
};

const getDashboardAlerts = async () => {
  const alerts = [];
  const totalStorage = await Node.sum('resources.storage.total');
  const usedStorage = await Node.sum('resources.storage.used');
  const storageUsage = totalStorage > 0 ? (usedStorage / totalStorage) * 100 : 0;
  if (storageUsage > 80) alerts.push({ type: 'storage', severity: 'warning', message: `Storage usage is at ${storageUsage.toFixed(1)}%`, timestamp: new Date().toISOString() });
  const inactiveNodes = await Node.count({ where: { isActive: false, status: { [Op.ne]: 'suspended' } } });
  if (inactiveNodes > 0) alerts.push({ type: 'node', severity: 'info', message: `${inactiveNodes} inactive nodes`, timestamp: new Date().toISOString() });
  const unverifiedUsers = await User.count({ where: { isVerified: false } });
  if (unverifiedUsers > 10) alerts.push({ type: 'user', severity: 'info', message: `${unverifiedUsers} unverified users`, timestamp: new Date().toISOString() });
  return alerts;
};

// User management methods
const listUsers = async (options = {}) => {
  const { isActive = null, isVerified = null, isLocked = null, search = null, limit = 50, offset = 0, sortBy = 'createdAt', sortOrder = 'DESC' } = options;
  const where = {};
  if (isActive !== null) where.isActive = isActive;
  if (isVerified !== null) where.isVerified = isVerified;
  if (isLocked !== null) where.isLocked = isLocked;
  if (search) where[Op.or] = [{ username: { [Op.iLike]: `%${search}%` } }, { email: { [Op.iLike]: `%${search}%` } }, { displayName: { [Op.iLike]: `%${search}%` } }];
  const order = [[sortBy, sortOrder]];
  const result = await User.findAndCountAll({ where, include: [Profile, HayerId], limit, offset, order });
  return { data: result.rows, pagination: { total: result.count, limit, offset, hasMore: offset + limit < result.count } };
};

const getUser = async (userId) => {
  const user = await User.findByPk(userId, { include: [Profile, HayerId, Session, { model: Community, as: 'ownedCommunities' }, { model: CommunityMember, include: [Community] }] });
  if (!user) throw new NotFoundError('User not found');
  return user;
};

const updateUser = async (userId, updates, adminUserId) => {
  const user = await User.findByPk(userId);
  if (!user) throw new NotFoundError('User not found');
  delete updates.passwordHash;
  delete updates.passwordAlgorithm;
  await user.update(updates);
  await AuditEvent.create({ userId: adminUserId, action: 'admin.user.update', entityType: 'user', entityId: user.id, metadata: { changes: updates }, status: 'success' });
  return user;
};

const suspendUser = async (userId, reason, adminUserId) => {
  const user = await User.findByPk(userId);
  if (!user) throw new NotFoundError('User not found');
  if (user.isLocked) throw new ConflictError('User is already suspended');
  await user.update({ isLocked: true, lockReason: reason, lockedUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) });
  await Session.update({ isActive: false, expiresAt: new Date() }, { where: { userId } });
  await AuditEvent.create({ userId: adminUserId, action: 'admin.user.suspend', entityType: 'user', entityId: user.id, metadata: { reason }, status: 'success' });
  return user;
};

const unsuspendUser = async (userId, adminUserId) => {
  const user = await User.findByPk(userId);
  if (!user) throw new NotFoundError('User not found');
  if (!user.isLocked) throw new ConflictError('User is not suspended');
  await user.update({ isLocked: false, lockReason: null, lockedUntil: null, failedLoginAttempts: 0 });
  await AuditEvent.create({ userId: adminUserId, action: 'admin.user.unsuspend', entityType: 'user', entityId: user.id, status: 'success' });
  return user;
};

const banUser = async (userId, reason, adminUserId) => {
  const user = await User.findByPk(userId);
  if (!user) throw new NotFoundError('User not found');
  if (user.isLocked) throw new ConflictError('User is already banned');
  await user.update({ isLocked: true, lockReason: reason, lockedUntil: new Date('9999-12-31') });
  await Session.update({ isActive: false, expiresAt: new Date() }, { where: { userId } });
  await AuditEvent.create({ userId: adminUserId, action: 'admin.user.ban', entityType: 'user', entityId: user.id, metadata: { reason }, status: 'success' });
  return user;
};

const unbanUser = async (userId, adminUserId) => {
  const user = await User.findByPk(userId);
  if (!user) throw new NotFoundError('User not found');
  if (!user.isLocked || user.lockedUntil && user.lockedUntil < new Date('9999-12-31')) throw new ConflictError('User is not banned');
  await user.update({ isLocked: false, lockReason: null, lockedUntil: null, failedLoginAttempts: 0 });
  await AuditEvent.create({ userId: adminUserId, action: 'admin.user.unban', entityType: 'user', entityId: user.id, status: 'success' });
  return user;
};

const verifyUser = async (userId, adminUserId) => {
  const user = await User.findByPk(userId);
  if (!user) throw new NotFoundError('User not found');
  if (user.isVerified) throw new ConflictError('User is already verified');
  await user.update({ isVerified: true, verificationToken: null, verificationTokenExpiresAt: null });
  await AuditEvent.create({ userId: adminUserId, action: 'admin.user.verify', entityType: 'user', entityId: user.id, status: 'success' });
  return user;
};

const unverifyUser = async (userId, adminUserId) => {
  const user = await User.findByPk(userId);
  if (!user) throw new NotFoundError('User not found');
  if (!user.isVerified) throw new ConflictError('User is not verified');
  await user.update({ isVerified: false });
  await AuditEvent.create({ userId: adminUserId, action: 'admin.user.unverify', entityType: 'user', entityId: user.id, status: 'success' });
  return user;
};

const deleteUser = async (userId, adminUserId) => {
  const user = await User.findByPk(userId);
  if (!user) throw new NotFoundError('User not found');
  await Session.destroy({ where: { userId } });
  await Notification.destroy({ where: { userId } });
  await AuditEvent.update({ userId: null }, { where: { userId } });
  await user.destroy();
  await AuditEvent.create({ userId: adminUserId, action: 'admin.user.delete', entityType: 'user', entityId: user.id, status: 'success' });
  return { success: true, message: 'User deleted' };
};

const getUserActivity = async (userId) => {
  const user = await User.findByPk(userId);
  if (!user) throw new NotFoundError('User not found');
  const activity = await AuditEvent.findAll({ where: { userId }, limit: 50, order: [['createdAt', 'DESC']] });
  return activity;
};

const getUserSessions = async (userId) => {
  const user = await User.findByPk(userId);
  if (!user) throw new NotFoundError('User not found');
  const sessions = await Session.findAll({ where: { userId }, order: [['lastActivityAt', 'DESC']] });
  return sessions;
};

const impersonateUser = async (userId, adminUserId) => {
  const user = await User.findByPk(userId);
  if (!user) throw new NotFoundError('User not found');
  const token = require('jsonwebtoken').sign({ id: user.id, email: user.email, username: user.username, impersonating: true, impersonatedBy: adminUserId }, config.jwt.secret, { expiresIn: '1h' });
  await AuditEvent.create({ userId: adminUserId, action: 'admin.user.impersonate', entityType: 'user', entityId: user.id, metadata: { impersonatedUserId: user.id }, status: 'success' });
  return { token, user };
};

// Role management methods
const listRoles = async (options = {}) => {
  const { limit = 50, offset = 0 } = options;
  const result = await Role.findAndCountAll({ include: [Permission], limit, offset, order: [['name', 'ASC']] });
  return { data: result.rows, pagination: { total: result.count, limit, offset, hasMore: offset + limit < result.count } };
};

const createRole = async (data, adminUserId) => {
  const { name, description, isSystem = false } = data;
  const existingRole = await Role.findOne({ where: { name } });
  if (existingRole) throw new ConflictError('Role already exists');
  const role = await Role.create({ name, description, isSystem });
  await AuditEvent.create({ userId: adminUserId, action: 'admin.role.create', entityType: 'role', entityId: role.id, metadata: { name }, status: 'success' });
  return role;
};

const getRole = async (roleId) => {
  const role = await Role.findByPk(roleId, { include: [Permission, User] });
  if (!role) throw new NotFoundError('Role not found');
  return role;
};

const updateRole = async (roleId, updates, adminUserId) => {
  const role = await Role.findByPk(roleId);
  if (!role) throw new NotFoundError('Role not found');
  if (role.isSystem) throw new AuthorizationError('Cannot update system role');
  await role.update(updates);
  await AuditEvent.create({ userId: adminUserId, action: 'admin.role.update', entityType: 'role', entityId: role.id, metadata: { changes: updates }, status: 'success' });
  return role;
};

const deleteRole = async (roleId, adminUserId) => {
  const role = await Role.findByPk(roleId);
  if (!role) throw new NotFoundError('Role not found');
  if (role.isSystem) throw new AuthorizationError('Cannot delete system role');
  await UserRole.destroy({ where: { roleId } });
  await Permission.destroy({ where: { roleId } });
  await role.destroy();
  await AuditEvent.create({ userId: adminUserId, action: 'admin.role.delete', entityType: 'role', entityId: role.id, status: 'success' });
  return { success: true, message: 'Role deleted' };
};

const getRoleUsers = async (roleId) => {
  const role = await Role.findByPk(roleId);
  if (!role) throw new NotFoundError('Role not found');
  const users = await User.findAll({ include: [{ model: Role, where: { id: roleId } }] });
  return users;
};

const assignRoleToUser = async (roleId, userId, adminUserId) => {
  const role = await Role.findByPk(roleId);
  const user = await User.findByPk(userId);
  if (!role || !user) throw new NotFoundError('Role or user not found');
  const existing = await UserRole.findOne({ where: { roleId, userId } });
  if (existing) throw new ConflictError('User already has this role');
  const userRole = await UserRole.create({ userId, roleId, assignedBy: adminUserId });
  await AuditEvent.create({ userId: adminUserId, action: 'admin.role.assign', entityType: 'role', entityId: role.id, metadata: { userId, roleId }, status: 'success' });
  return userRole;
};

const removeRoleFromUser = async (roleId, userId, adminUserId) => {
  const userRole = await UserRole.findOne({ where: { roleId, userId } });
  if (!userRole) throw new NotFoundError('User does not have this role');
  await userRole.destroy();
  await AuditEvent.create({ userId: adminUserId, action: 'admin.role.remove', entityType: 'role', entityId: roleId, metadata: { userId, roleId }, status: 'success' });
  return { success: true, message: 'Role removed from user' };
};

// Permission management methods
const listPermissions = async (options = {}) => {
  const { roleId = null, limit = 50, offset = 0 } = options;
  const where = {};
  if (roleId) where.roleId = roleId;
  const result = await Permission.findAndCountAll({ where, include: [Role], limit, offset, order: [['resource', 'ASC'], ['action', 'ASC']] });
  return { data: result.rows, pagination: { total: result.count, limit, offset, hasMore: offset + limit < result.count } };
};

const createPermission = async (data, adminUserId) => {
  const { roleId, resource, action, scope = 'all' } = data;
  const role = await Role.findByPk(roleId);
  if (!role) throw new NotFoundError('Role not found');
  const existing = await Permission.findOne({ where: { roleId, resource, action } });
  if (existing) throw new ConflictError('Permission already exists');
  const permission = await Permission.create({ roleId, resource, action, scope });
  await AuditEvent.create({ userId: adminUserId, action: 'admin.permission.create', entityType: 'permission', entityId: permission.id, metadata: { roleId, resource, action }, status: 'success' });
  return permission;
};

const getPermission = async (permissionId) => {
  const permission = await Permission.findByPk(permissionId, { include: [Role] });
  if (!permission) throw new NotFoundError('Permission not found');
  return permission;
};

const updatePermission = async (permissionId, updates, adminUserId) => {
  const permission = await Permission.findByPk(permissionId);
  if (!permission) throw new NotFoundError('Permission not found');
  await permission.update(updates);
  await AuditEvent.create({ userId: adminUserId, action: 'admin.permission.update', entityType: 'permission', entityId: permission.id, metadata: { changes: updates }, status: 'success' });
  return permission;
};

const deletePermission = async (permissionId, adminUserId) => {
  const permission = await Permission.findByPk(permissionId);
  if (!permission) throw new NotFoundError('Permission not found');
  await permission.destroy();
  await AuditEvent.create({ userId: adminUserId, action: 'admin.permission.delete', entityType: 'permission', entityId: permission.id, status: 'success' });
  return { success: true, message: 'Permission deleted' };
};

// Node management methods
const listNodes = async (options = {}) => {
  const { isActive = null, isVerified = null, operatorId = null, search = null, limit = 50, offset = 0, sortBy = 'createdAt', sortOrder = 'DESC' } = options;
  const where = {};
  if (isActive !== null) where.isActive = isActive;
  if (isVerified !== null) where.isVerified = isVerified;
  if (operatorId) where.operatorId = operatorId;
  if (search) where[Op.or] = [{ name: { [Op.iLike]: `%${search}%` } }, { description: { [Op.iLike]: `%${search}%` } }];
  const order = [[sortBy, sortOrder]];
  const result = await Node.findAndCountAll({ where, include: [Operator], limit, offset, order });
  return { data: result.rows, pagination: { total: result.count, limit, offset, hasMore: offset + limit < result.count } };
};

const getNode = async (nodeId) => {
  const node = await Node.findByPk(nodeId, { include: [Operator, Replica, StorageChunk] });
  if (!node) throw new NotFoundError('Node not found');
  return node;
};

const updateNode = async (nodeId, updates, adminUserId) => {
  const node = await Node.findByPk(nodeId);
  if (!node) throw new NotFoundError('Node not found');
  await node.update(updates);
  await AuditEvent.create({ userId: adminUserId, action: 'admin.node.update', entityType: 'node', entityId: node.id, metadata: { changes: updates }, status: 'success' });
  return node;
};

const approveNode = async (nodeId, adminUserId) => {
  const node = await Node.findByPk(nodeId);
  if (!node) throw new NotFoundError('Node not found');
  await node.update({ isVerified: true, status: 'active', verifiedBy: adminUserId, verifiedAt: new Date() });
  await AuditEvent.create({ userId: adminUserId, action: 'admin.node.approve', entityType: 'node', entityId: node.id, status: 'success' });
  return node;
};

const rejectNode = async (nodeId, reason, adminUserId) => {
  const node = await Node.findByPk(nodeId);
  if (!node) throw new NotFoundError('Node not found');
  await node.update({ isVerified: false, status: 'rejected', rejectionReason: reason, verifiedBy: adminUserId, verifiedAt: new Date() });
  await AuditEvent.create({ userId: adminUserId, action: 'admin.node.reject', entityType: 'node', entityId: node.id, metadata: { reason }, status: 'success' });
  return node;
};

const suspendNode = async (nodeId, reason, adminUserId) => {
  const node = await Node.findByPk(nodeId);
  if (!node) throw new NotFoundError('Node not found');
  await node.update({ isActive: false, status: 'suspended', suspensionReason: reason, suspendedBy: adminUserId, suspendedAt: new Date() });
  await AuditEvent.create({ userId: adminUserId, action: 'admin.node.suspend', entityType: 'node', entityId: node.id, metadata: { reason }, status: 'success' });
  return node;
};

const unsuspendNode = async (nodeId, adminUserId) => {
  const node = await Node.findByPk(nodeId);
  if (!node) throw new NotFoundError('Node not found');
  await node.update({ isActive: true, status: 'active', suspensionReason: null, suspendedBy: null, suspendedAt: null });
  await AuditEvent.create({ userId: adminUserId, action: 'admin.node.unsuspend', entityType: 'node', entityId: node.id, status: 'success' });
  return node;
};

const quarantineNode = async (nodeId, reason, adminUserId) => {
  const node = await Node.findByPk(nodeId);
  if (!node) throw new NotFoundError('Node not found');
  await node.update({ isActive: false, status: 'quarantined', quarantineReason: reason, quarantinedBy: adminUserId, quarantinedAt: new Date() });
  await AuditEvent.create({ userId: adminUserId, action: 'admin.node.quarantine', entityType: 'node', entityId: node.id, metadata: { reason }, status: 'success' });
  return node;
};

const unquarantineNode = async (nodeId, adminUserId) => {
  const node = await Node.findByPk(nodeId);
  if (!node) throw new NotFoundError('Node not found');
  await node.update({ isActive: true, status: 'active', quarantineReason: null, quarantinedBy: null, quarantinedAt: null });
  await AuditEvent.create({ userId: adminUserId, action: 'admin.node.unquarantine', entityType: 'node', entityId: node.id, status: 'success' });
  return node;
};

const revokeNode = async (nodeId, reason, adminUserId) => {
  const node = await Node.findByPk(nodeId);
  if (!node) throw new NotFoundError('Node not found');
  await node.update({ isActive: false, isVerified: false, status: 'revoked', revocationReason: reason, revokedBy: adminUserId, revokedAt: new Date() });
  await AuditEvent.create({ userId: adminUserId, action: 'admin.node.revoke', entityType: 'node', entityId: node.id, metadata: { reason }, status: 'success' });
  return node;
};

const restoreNode = async (nodeId, adminUserId) => {
  const node = await Node.findByPk(nodeId);
  if (!node) throw new NotFoundError('Node not found');
  await node.update({ isActive: true, isVerified: true, status: 'active', revocationReason: null, revokedBy: null, revokedAt: null });
  await AuditEvent.create({ userId: adminUserId, action: 'admin.node.restore', entityType: 'node', entityId: node.id, status: 'success' });
  return node;
};

const deleteNode = async (nodeId, adminUserId) => {
  const node = await Node.findByPk(nodeId);
  if (!node) throw new NotFoundError('Node not found');
  await node.destroy();
  await AuditEvent.create({ userId: adminUserId, action: 'admin.node.delete', entityType: 'node', entityId: node.id, status: 'success' });
  return { success: true, message: 'Node deleted' };
};

// Operator management methods
const listOperators = async (options = {}) => {
  const { isVerified = null, isActive = null, search = null, limit = 50, offset = 0, sortBy = 'createdAt', sortOrder = 'DESC' } = options;
  const where = {};
  if (isVerified !== null) where.isVerified = isVerified;
  if (isActive !== null) where.isActive = isActive;
  if (search) where[Op.or] = [{ name: { [Op.iLike]: `%${search}%` } }, { displayName: { [Op.iLike]: `%${search}%` } }, { contactEmail: { [Op.iLike]: `%${search}%` } }];
  const order = [[sortBy, sortOrder]];
  const result = await Operator.findAndCountAll({ where, include: [Node, User], limit, offset, order });
  return { data: result.rows, pagination: { total: result.count, limit, offset, hasMore: offset + limit < result.count } };
};

const getOperator = async (operatorId) => {
  const operator = await Operator.findByPk(operatorId, { include: [Node, User] });
  if (!operator) throw new NotFoundError('Operator not found');
  return operator;
};

const updateOperator = async (operatorId, updates, adminUserId) => {
  const operator = await Operator.findByPk(operatorId);
  if (!operator) throw new NotFoundError('Operator not found');
  await operator.update(updates);
  await AuditEvent.create({ userId: adminUserId, action: 'admin.operator.update', entityType: 'operator', entityId: operator.id, metadata: { changes: updates }, status: 'success' });
  return operator;
};

const verifyOperator = async (operatorId, adminUserId) => {
  const operator = await Operator.findByPk(operatorId);
  if (!operator) throw new NotFoundError('Operator not found');
  if (operator.isVerified) throw new ConflictError('Operator is already verified');
  await operator.update({ isVerified: true, verifiedBy: adminUserId, verifiedAt: new Date() });
  await AuditEvent.create({ userId: adminUserId, action: 'admin.operator.verify', entityType: 'operator', entityId: operator.id, status: 'success' });
  return operator;
};

const unverifyOperator = async (operatorId, adminUserId) => {
  const operator = await Operator.findByPk(operatorId);
  if (!operator) throw new NotFoundError('Operator not found');
  if (!operator.isVerified) throw new ConflictError('Operator is not verified');
  await operator.update({ isVerified: false, verifiedBy: null, verifiedAt: null });
  await AuditEvent.create({ userId: adminUserId, action: 'admin.operator.unverify', entityType: 'operator', entityId: operator.id, status: 'success' });
  return operator;
};

const suspendOperator = async (operatorId, reason, adminUserId) => {
  const operator = await Operator.findByPk(operatorId);
  if (!operator) throw new NotFoundError('Operator not found');
  await operator.update({ isActive: false, status: 'suspended', suspensionReason: reason, suspendedBy: adminUserId, suspendedAt: new Date() });
  await Node.update({ isActive: false, status: 'suspended', suspensionReason: `Operator suspended: ${reason}` }, { where: { operatorId } });
  await AuditEvent.create({ userId: adminUserId, action: 'admin.operator.suspend', entityType: 'operator', entityId: operator.id, metadata: { reason }, status: 'success' });
  return operator;
};

const unsuspendOperator = async (operatorId, adminUserId) => {
  const operator = await Operator.findByPk(operatorId);
  if (!operator) throw new NotFoundError('Operator not found');
  await operator.update({ isActive: true, status: 'active', suspensionReason: null, suspendedBy: null, suspendedAt: null });
  await Node.update({ isActive: true, status: 'active', suspensionReason: null }, { where: { operatorId, status: 'suspended' } });
  await AuditEvent.create({ userId: adminUserId, action: 'admin.operator.unsuspend', entityType: 'operator', entityId: operator.id, status: 'success' });
  return operator;
};

const deleteOperator = async (operatorId, adminUserId) => {
  const operator = await Operator.findByPk(operatorId);
  if (!operator) throw new NotFoundError('Operator not found');
  await Node.destroy({ where: { operatorId } });
  await operator.destroy();
  await AuditEvent.create({ userId: adminUserId, action: 'admin.operator.delete', entityType: 'operator', entityId: operator.id, status: 'success' });
  return { success: true, message: 'Operator and all associated nodes deleted' };
};

// Service management methods
const listServices = async (options = {}) => {
  const { isActive = null, isVerified = null, type = null, category = null, search = null, limit = 50, offset = 0, sortBy = 'createdAt', sortOrder = 'DESC' } = options;
  const where = {};
  if (isActive !== null) where.isActive = isActive;
  if (isVerified !== null) where.isVerified = isVerified;
  if (type) where.type = type;
  if (category) where.category = category;
  if (search) where[Op.or] = [{ name: { [Op.iLike]: `%${search}%` } }, { displayName: { [Op.iLike]: `%${search}%` } }, { description: { [Op.iLike]: `%${search}%` } }];
  const order = [[sortBy, sortOrder]];
  const result = await Service.findAndCountAll({ where, include: [ServiceInstance], limit, offset, order });
  return { data: result.rows, pagination: { total: result.count, limit, offset, hasMore: offset + limit < result.count } };
};

const createService = async (data, adminUserId) => {
  const { name, displayName, description, type, category, config, isActive = true, isVerified = false } = data;
  const service = await Service.create({ name, displayName, description, type, category, config, isActive, isVerified, createdBy: adminUserId });
  await AuditEvent.create({ userId: adminUserId, action: 'admin.service.create', entityType: 'service', entityId: service.id, metadata: { name, type }, status: 'success' });
  return service;
};

const getService = async (serviceId) => {
  const service = await Service.findByPk(serviceId, { include: [ServiceInstance] });
  if (!service) throw new NotFoundError('Service not found');
  return service;
};

const updateService = async (serviceId, updates, adminUserId) => {
  const service = await Service.findByPk(serviceId);
  if (!service) throw new NotFoundError('Service not found');
  await service.update(updates);
  await AuditEvent.create({ userId: adminUserId, action: 'admin.service.update', entityType: 'service', entityId: service.id, metadata: { changes: updates }, status: 'success' });
  return service;
};

const deleteService = async (serviceId, adminUserId) => {
  const service = await Service.findByPk(serviceId);
  if (!service) throw new NotFoundError('Service not found');
  await ServiceInstance.destroy({ where: { serviceId } });
  await service.destroy();
  await AuditEvent.create({ userId: adminUserId, action: 'admin.service.delete', entityType: 'service', entityId: service.id, status: 'success' });
  return { success: true, message: 'Service and all instances deleted' };
};

const listServiceInstances = async (serviceId, options = {}) => {
  const { isActive = null, isVerified = null, limit = 50, offset = 0 } = options;
  const where = { serviceId };
  if (isActive !== null) where.isActive = isActive;
  if (isVerified !== null) where.isVerified = isVerified;
  const result = await ServiceInstance.findAndCountAll({ where, limit, offset, order: [['createdAt', 'DESC']] });
  return { data: result.rows, pagination: { total: result.count, limit, offset, hasMore: offset + limit < result.count } };
};

const getServiceInstance = async (serviceId, instanceId) => {
  const instance = await ServiceInstance.findByPk(instanceId);
  if (!instance || instance.serviceId !== serviceId) throw new NotFoundError('Service instance not found');
  return instance;
};

const updateServiceInstance = async (serviceId, instanceId, updates, adminUserId) => {
  const instance = await ServiceInstance.findByPk(instanceId);
  if (!instance || instance.serviceId !== serviceId) throw new NotFoundError('Service instance not found');
  await instance.update(updates);
  await AuditEvent.create({ userId: adminUserId, action: 'admin.service.instance.update', entityType: 'service_instance', entityId: instance.id, metadata: { changes: updates }, status: 'success' });
  return instance;
};

const deleteServiceInstance = async (serviceId, instanceId, adminUserId) => {
  const instance = await ServiceInstance.findByPk(instanceId);
  if (!instance || instance.serviceId !== serviceId) throw new NotFoundError('Service instance not found');
  await instance.destroy();
  await AuditEvent.create({ userId: adminUserId, action: 'admin.service.instance.delete', entityType: 'service_instance', entityId: instance.id, status: 'success' });
  return { success: true, message: 'Service instance deleted' };
};

// Storage management methods
const getStorageInfo = async () => {
  const [totalObjects, totalChunks, totalReplicas, totalSize] = await Promise.all([
    StorageObject.count(),
    StorageChunk.count(),
    Replica.count(),
    StorageObject.sum('size')
  ]);
  return { totalObjects, totalChunks, totalReplicas, totalSize: totalSize || 0 };
};

const getStorageStatistics = async (options = {}) => {
  const { days = 7 } = options;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const [newObjects, newChunks, totalUploaded, totalDownloaded] = await Promise.all([
    StorageObject.count({ where: { createdAt: { [Op.gte]: startDate } } }),
    StorageChunk.count({ where: { createdAt: { [Op.gte]: startDate } } }),
    StorageObject.sum('size', { where: { createdAt: { [Op.gte]: startDate } } }),
    0 // Would need download tracking
  ]);
  return { period: `${days} days`, newObjects, newChunks, totalUploaded: totalUploaded || 0, totalDownloaded };
};

const getStorageUsage = async (options = {}) => {
  const { userId, nodeId } = options;
  const where = {};
  if (userId) where.userId = userId;
  if (nodeId) where['$chunks.nodeId$'] = nodeId;
  const objects = await StorageObject.findAll({ where, include: [StorageChunk] });
  const totalSize = objects.reduce((sum, obj) => sum + (obj.size || 0), 0);
  return { userId, nodeId, totalSize, objectCount: objects.length };
};

const listStorageObjects = async (options = {}) => {
  const { userId, nodeId, isEncrypted = null, search = null, limit = 50, offset = 0 } = options;
  const where = {};
  if (userId) where.userId = userId;
  if (nodeId) where['$chunks.nodeId$'] = nodeId;
  if (isEncrypted !== null) where.isEncrypted = isEncrypted;
  if (search) where[Op.or] = [{ name: { [Op.iLike]: `%${search}%` } }, { metadata: { [Op.iLike]: `%${search}%` } }];
  const result = await StorageObject.findAndCountAll({ where, include: [StorageChunk], limit, offset, order: [['createdAt', 'DESC']] });
  return { data: result.rows, pagination: { total: result.count, limit, offset, hasMore: offset + limit < result.count } };
};

const getStorageObject = async (objectId) => {
  const storageObject = await StorageObject.findByPk(objectId, { include: [StorageChunk, Replica, User] });
  if (!storageObject) throw new NotFoundError('Storage object not found');
  return storageObject;
};

const updateStorageObject = async (objectId, updates, adminUserId) => {
  const storageObject = await StorageObject.findByPk(objectId);
  if (!storageObject) throw new NotFoundError('Storage object not found');
  await storageObject.update(updates);
  await AuditEvent.create({ userId: adminUserId, action: 'admin.storage.object.update', entityType: 'storage_object', entityId: storageObject.id, metadata: { changes: updates }, status: 'success' });
  return storageObject;
};

const deleteStorageObject = async (objectId, adminUserId) => {
  const storageObject = await StorageObject.findByPk(objectId);
  if (!storageObject) throw new NotFoundError('Storage object not found');
  // Delete all chunks and replicas
  const chunks = await StorageChunk.findAll({ where: { objectId } });
  for (const chunk of chunks) {
    await Replica.destroy({ where: { chunkId: chunk.id } });
  }
  await StorageChunk.destroy({ where: { objectId } });
  await storageObject.destroy();
  await AuditEvent.create({ userId: adminUserId, action: 'admin.storage.object.delete', entityType: 'storage_object', entityId: storageObject.id, status: 'success' });
  return { success: true, message: 'Storage object and all chunks deleted' };
};

const cleanupStorage = async (options, adminUserId) => {
  const { dryRun = true, olderThanDays = 30 } = options;
  const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const oldObjects = await StorageObject.findAll({ where: { createdAt: { [Op.lt]: cutoffDate } } });
  if (dryRun) {
    return { dryRun: true, wouldDelete: oldObjects.length, objects: oldObjects };
  }
  for (const obj of oldObjects) {
    await deleteStorageObject(obj.id, adminUserId);
  }
  await AuditEvent.create({ userId: adminUserId, action: 'admin.storage.cleanup', entityType: 'storage', metadata: { olderThanDays, deletedCount: oldObjects.length }, status: 'success' });
  return { success: true, deletedCount: oldObjects.length };
};

const repairStorage = async (options, adminUserId) => {
  const { objectId, verifyOnly = false } = options;
  const where = {};
  if (objectId) where.objectId = objectId;
  const chunks = await StorageChunk.findAll({ where, include: [Replica] });
  const results = [];
  for (const chunk of chunks) {
    const replicas = await Replica.findAll({ where: { chunkId: chunk.id } });
    const expectedReplicas = config.storage.replicationFactor || 3;
    if (replicas.length < expectedReplicas) {
      if (!verifyOnly) {
        // Would need to replicate to more nodes
        results.push({ chunkId: chunk.id, status: 'needs_repair', missingReplicas: expectedReplicas - replicas.length });
      } else {
        results.push({ chunkId: chunk.id, status: 'needs_repair', missingReplicas: expectedReplicas - replicas.length });
      }
    } else {
      results.push({ chunkId: chunk.id, status: 'ok', replicas: replicas.length });
    }
  }
  await AuditEvent.create({ userId: adminUserId, action: 'admin.storage.repair', entityType: 'storage', metadata: { verifyOnly, results }, status: 'success' });
  return { results, verifyOnly };
};

const verifyStorage = async (options, adminUserId) => {
  const { objectId } = options;
  const where = {};
  if (objectId) where.id = objectId;
  const objects = await StorageObject.findAll({ where, include: [StorageChunk, Replica] });
  const results = [];
  for (const obj of objects) {
    const chunks = await StorageChunk.findAll({ where: { objectId: obj.id } });
    let allReplicasOk = true;
    for (const chunk of chunks) {
      const replicas = await Replica.findAll({ where: { chunkId: chunk.id } });
      if (replicas.length < (config.storage.replicationFactor || 3)) {
        allReplicasOk = false;
        break;
      }
    }
    results.push({ objectId: obj.id, status: allReplicasOk ? 'ok' : 'incomplete' });
  }
  await AuditEvent.create({ userId: adminUserId, action: 'admin.storage.verify', entityType: 'storage', metadata: { results }, status: 'success' });
  return { results };
};

const backupStorage = async (options, adminUserId) => {
  const { full = false } = options;
  // In a real implementation, this would create a backup of all storage metadata
  const backup = await Backup.create({ type: full ? 'full' : 'metadata', createdBy: adminUserId });
  await AuditEvent.create({ userId: adminUserId, action: 'admin.storage.backup', entityType: 'backup', entityId: backup.id, metadata: { type: backup.type }, status: 'success' });
  return { success: true, backupId: backup.id };
};

const restoreStorage = async (options, adminUserId) => {
  const { backupId } = options;
  const backup = await Backup.findByPk(backupId);
  if (!backup) throw new NotFoundError('Backup not found');
  // In a real implementation, this would restore from backup
  await AuditEvent.create({ userId: adminUserId, action: 'admin.storage.restore', entityType: 'backup', entityId: backup.id, status: 'success' });
  return { success: true, message: 'Storage restore initiated' };
};

// Community management methods
const listCommunities = async (options = {}) => {
  const { isVerified = null, isFeatured = null, isActive = null, search = null, limit = 50, offset = 0, sortBy = 'createdAt', sortOrder = 'DESC' } = options;
  const where = {};
  if (isVerified !== null) where.isVerified = isVerified;
  if (isFeatured !== null) where.isFeatured = isFeatured;
  if (isActive !== null) where.isActive = isActive;
  if (search) where[Op.or] = [{ name: { [Op.iLike]: `%${search}%` } }, { displayName: { [Op.iLike]: `%${search}%` } }, { description: { [Op.iLike]: `%${search}%` } }];
  const order = [[sortBy, sortOrder]];
  const result = await Community.findAndCountAll({ where, include: [User], limit, offset, order });
  return { data: result.rows, pagination: { total: result.count, limit, offset, hasMore: offset + limit < result.count } };
};

const getCommunity = async (communityId) => {
  const community = await Community.findByPk(communityId, { include: [User, CommunityMember] });
  if (!community) throw new NotFoundError('Community not found');
  return community;
};

const updateCommunity = async (communityId, updates, adminUserId) => {
  const community = await Community.findByPk(communityId);
  if (!community) throw new NotFoundError('Community not found');
  await community.update(updates);
  await AuditEvent.create({ userId: adminUserId, action: 'admin.community.update', entityType: 'community', entityId: community.id, metadata: { changes: updates }, status: 'success' });
  return community;
};

const verifyCommunity = async (communityId, adminUserId) => {
  const community = await Community.findByPk(communityId);
  if (!community) throw new NotFoundError('Community not found');
  if (community.isVerified) throw new ConflictError('Community is already verified');
  await community.update({ isVerified: true, verifiedBy: adminUserId, verifiedAt: new Date() });
  await AuditEvent.create({ userId: adminUserId, action: 'admin.community.verify', entityType: 'community', entityId: community.id, status: 'success' });
  return community;
};

const unverifyCommunity = async (communityId, adminUserId) => {
  const community = await Community.findByPk(communityId);
  if (!community) throw new NotFoundError('Community not found');
  if (!community.isVerified) throw new ConflictError('Community is not verified');
  await community.update({ isVerified: false, verifiedBy: null, verifiedAt: null });
  await AuditEvent.create({ userId: adminUserId, action: 'admin.community.unverify', entityType: 'community', entityId: community.id, status: 'success' });
  return community;
};

const featureCommunity = async (communityId, adminUserId) => {
  const community = await Community.findByPk(communityId);
  if (!community) throw new NotFoundError('Community not found');
  if (community.isFeatured) throw new ConflictError('Community is already featured');
  await community.update({ isFeatured: true, featuredBy: adminUserId, featuredAt: new Date() });
  await AuditEvent.create({ userId: adminUserId, action: 'admin.community.feature', entityType: 'community', entityId: community.id, status: 'success' });
  return community;
};

const unfeatureCommunity = async (communityId, adminUserId) => {
  const community = await Community.findByPk(communityId);
  if (!community) throw new NotFoundError('Community not found');
  if (!community.isFeatured) throw new ConflictError('Community is not featured');
  await community.update({ isFeatured: false, featuredBy: null, featuredAt: null });
  await AuditEvent.create({ userId: adminUserId, action: 'admin.community.unfeature', entityType: 'community', entityId: community.id, status: 'success' });
  return community;
};

const deleteCommunity = async (communityId, adminUserId) => {
  const community = await Community.findByPk(communityId);
  if (!community) throw new NotFoundError('Community not found');
  await CommunityMember.destroy({ where: { communityId } });
  await community.destroy();
  await AuditEvent.create({ userId: adminUserId, action: 'admin.community.delete', entityType: 'community', entityId: community.id, status: 'success' });
  return { success: true, message: 'Community and all members deleted' };
};

// Audit log methods
const getAuditLogs = async (options = {}) => {
  const { userId, action, category, startDate, endDate, limit = 50, offset = 0 } = options;
  const where = {};
  if (userId) where.userId = userId;
  if (action) where.action = action;
  if (category) where.category = category;
  if (startDate) where.createdAt = { [Op.gte]: new Date(startDate) };
  if (endDate) {
    if (!where.createdAt) where.createdAt = {};
    where.createdAt[Op.lte] = new Date(endDate);
  }
  const result = await AuditEvent.findAndCountAll({ where, limit, offset, order: [['createdAt', 'DESC']] });
  return { data: result.rows, pagination: { total: result.count, limit, offset, hasMore: offset + limit < result.count } };
};

const getAuditLog = async (logId) => {
  const auditLog = await AuditEvent.findByPk(logId, { include: [User] });
  if (!auditLog) throw new NotFoundError('Audit log not found');
  return auditLog;
};

const getAuditLogsByUser = async (userId, options = {}) => {
  const { limit = 50, offset = 0 } = options;
  const result = await AuditEvent.findAndCountAll({ where: { userId }, limit, offset, order: [['createdAt', 'DESC']] });
  return { data: result.rows, pagination: { total: result.count, limit, offset, hasMore: offset + limit < result.count } };
};

const getAuditLogsByAction = async (action, options = {}) => {
  const { limit = 50, offset = 0 } = options;
  const result = await AuditEvent.findAndCountAll({ where: { action }, limit, offset, order: [['createdAt', 'DESC']] });
  return { data: result.rows, pagination: { total: result.count, limit, offset, hasMore: offset + limit < result.count } };
};

const getAuditLogsByCategory = async (category, options = {}) => {
  const { limit = 50, offset = 0 } = options;
  const result = await AuditEvent.findAndCountAll({ where: { category }, limit, offset, order: [['createdAt', 'DESC']] });
  return { data: result.rows, pagination: { total: result.count, limit, offset, hasMore: offset + limit < result.count } };
};

const clearAuditLogs = async (options, adminUserId) => {
  const { olderThanDays = 30 } = options;
  const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const count = await AuditEvent.count({ where: { createdAt: { [Op.lt]: cutoffDate } } });
  await AuditEvent.destroy({ where: { createdAt: { [Op.lt]: cutoffDate } } });
  await AuditEvent.create({ userId: adminUserId, action: 'admin.audit.clear', entityType: 'audit', metadata: { olderThanDays, deletedCount: count }, status: 'success' });
  return { success: true, deletedCount: count };
};

const exportAuditLogs = async (options = {}) => {
  const { startDate, endDate } = options;
  const where = {};
  if (startDate) where.createdAt = { [Op.gte]: new Date(startDate) };
  if (endDate) {
    if (!where.createdAt) where.createdAt = {};
    where.createdAt[Op.lte] = new Date(endDate);
  }
  const logs = await AuditEvent.findAll({ where, include: [User], order: [['createdAt', 'ASC']] });
  return logs;
};

// System management methods
const getSystemInfo = async () => {
  const [userCount, nodeCount, storageCount, serviceCount, communityCount] = await Promise.all([
    User.count(),
    Node.count(),
    StorageObject.count(),
    Service.count(),
    Community.count()
  ]);
  return {
    version: '1.0.0',
    name: 'HAYER',
    users: userCount,
    nodes: nodeCount,
    storageObjects: storageCount,
    services: serviceCount,
    communities: communityCount,
    uptime: process.uptime()
  };
};

const getSystemHealth = async () => {
  const [activeNodes, inactiveNodes, healthyNodes, unhealthyNodes] = await Promise.all([
    Node.count({ where: { isActive: true } }),
    Node.count({ where: { isActive: false } }),
    Node.count({ where: { status: 'active' } }),
    Node.count({ where: { status: { [Op.ne]: 'active' } } })
  ]);
  return {
    status: healthyNodes > 0 ? 'healthy' : 'degraded',
    activeNodes,
    inactiveNodes,
    healthyNodes,
    unhealthyNodes
  };
};

const getSystemMetrics = async (options = {}) => {
  const { hours = 1 } = options;
  const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);
  const [newUsers, newNodes, newObjects, newSessions] = await Promise.all([
    User.count({ where: { createdAt: { [Op.gte]: startDate } } }),
    Node.count({ where: { createdAt: { [Op.gte]: startDate } } }),
    StorageObject.count({ where: { createdAt: { [Op.gte]: startDate } } }),
    Session.count({ where: { createdAt: { [Op.gte]: startDate } } })
  ]);
  return { period: `${hours} hours`, newUsers, newNodes, newObjects, newSessions };
};

const getSystemStatus = async () => {
  return {
    status: 'operational',
    timestamp: new Date().toISOString(),
    maintenanceMode: false
  };
};

const restartSystem = async (adminUserId) => {
  await AuditEvent.create({ userId: adminUserId, action: 'admin.system.restart', entityType: 'system', status: 'initiated' });
  // In a real implementation, this would trigger a restart
  return { success: true, message: 'System restart initiated' };
};

const shutdownSystem = async (adminUserId) => {
  await AuditEvent.create({ userId: adminUserId, action: 'admin.system.shutdown', entityType: 'system', status: 'initiated' });
  // In a real implementation, this would trigger a shutdown
  return { success: true, message: 'System shutdown initiated' };
};

const enableMaintenance = async (message, adminUserId) => {
  // Would update some maintenance flag in database or config
  await AuditEvent.create({ userId: adminUserId, action: 'admin.system.maintenance.enable', entityType: 'system', metadata: { message }, status: 'success' });
  return { success: true, message: 'Maintenance mode enabled' };
};

const disableMaintenance = async (adminUserId) => {
  // Would clear maintenance flag
  await AuditEvent.create({ userId: adminUserId, action: 'admin.system.maintenance.disable', entityType: 'system', status: 'success' });
  return { success: true, message: 'Maintenance mode disabled' };
};

// Configuration management methods
const getConfiguration = async () => {
  // In a real implementation, this would read from a configuration table
  return config;
};

const updateConfiguration = async (updates, adminUserId) => {
  // In a real implementation, this would update configuration in database
  await AuditEvent.create({ userId: adminUserId, action: 'admin.config.update', entityType: 'config', metadata: { changes: updates }, status: 'success' });
  return { success: true, message: 'Configuration updated' };
};

const getConfigurationKey = async (key) => {
  // In a real implementation, this would read a specific config key
  return config[key];
};

const updateConfigurationKey = async (key, value, adminUserId) => {
  // In a real implementation, this would update a specific config key
  await AuditEvent.create({ userId: adminUserId, action: 'admin.config.key.update', entityType: 'config', metadata: { key, value }, status: 'success' });
  return { success: true, key, value };
};

const deleteConfigurationKey = async (key, adminUserId) => {
  // In a real implementation, this would delete a config key
  await AuditEvent.create({ userId: adminUserId, action: 'admin.config.key.delete', entityType: 'config', metadata: { key }, status: 'success' });
  return { success: true, key, message: 'Configuration key deleted' };
};

// Backup management methods
const listBackups = async (options = {}) => {
  const { type, limit = 50, offset = 0 } = options;
  const where = {};
  if (type) where.type = type;
  const result = await Backup.findAndCountAll({ where, limit, offset, order: [['createdAt', 'DESC']] });
  return { data: result.rows, pagination: { total: result.count, limit, offset, hasMore: offset + limit < result.count } };
};

const createBackup = async (data, adminUserId) => {
  const { type = 'full', description = '' } = data;
  const backup = await Backup.create({ type, description, createdBy: adminUserId });
  await AuditEvent.create({ userId: adminUserId, action: 'admin.backup.create', entityType: 'backup', entityId: backup.id, metadata: { type }, status: 'success' });
  return backup;
};

const getBackup = async (backupId) => {
  const backup = await Backup.findByPk(backupId);
  if (!backup) throw new NotFoundError('Backup not found');
  return backup;
};

const restoreBackup = async (backupId, adminUserId) => {
  const backup = await Backup.findByPk(backupId);
  if (!backup) throw new NotFoundError('Backup not found');
  await AuditEvent.create({ userId: adminUserId, action: 'admin.backup.restore', entityType: 'backup', entityId: backup.id, status: 'initiated' });
  return { success: true, message: 'Backup restore initiated' };
};

const deleteBackup = async (backupId, adminUserId) => {
  const backup = await Backup.findByPk(backupId);
  if (!backup) throw new NotFoundError('Backup not found');
  await backup.destroy();
  await AuditEvent.create({ userId: adminUserId, action: 'admin.backup.delete', entityType: 'backup', entityId: backup.id, status: 'success' });
  return { success: true, message: 'Backup deleted' };
};

const exportBackup = async (backupId) => {
  const backup = await Backup.findByPk(backupId);
  if (!backup) throw new NotFoundError('Backup not found');
  // In a real implementation, this would export the backup file
  return { success: true, backupId, message: 'Backup export initiated' };
};

const importBackup = async (file, adminUserId) => {
  // In a real implementation, this would import a backup file
  await AuditEvent.create({ userId: adminUserId, action: 'admin.backup.import', entityType: 'backup', status: 'success' });
  return { success: true, message: 'Backup import initiated' };
};

// Notification management methods
const listNotifications = async (options = {}) => {
  const { isRead = null, type = null, userId = null, limit = 50, offset = 0 } = options;
  const where = {};
  if (isRead !== null) where.isRead = isRead;
  if (type) where.type = type;
  if (userId) where.userId = userId;
  const result = await Notification.findAndCountAll({ where, limit, offset, order: [['createdAt', 'DESC']] });
  return { data: result.rows, pagination: { total: result.count, limit, offset, hasMore: offset + limit < result.count } };
};

const createNotification = async (data, adminUserId) => {
  const { userId, type, title, message, metadata = {} } = data;
  const notification = await Notification.create({ userId, type, title, message, metadata, createdBy: adminUserId });
  await AuditEvent.create({ userId: adminUserId, action: 'admin.notification.create', entityType: 'notification', entityId: notification.id, metadata: { type, userId }, status: 'success' });
  return notification;
};

const getNotification = async (notificationId) => {
  const notification = await Notification.findByPk(notificationId);
  if (!notification) throw new NotFoundError('Notification not found');
  return notification;
};

const updateNotification = async (notificationId, updates, adminUserId) => {
  const notification = await Notification.findByPk(notificationId);
  if (!notification) throw new NotFoundError('Notification not found');
  await notification.update(updates);
  await AuditEvent.create({ userId: adminUserId, action: 'admin.notification.update', entityType: 'notification', entityId: notification.id, metadata: { changes: updates }, status: 'success' });
  return notification;
};

const deleteNotification = async (notificationId, adminUserId) => {
  const notification = await Notification.findByPk(notificationId);
  if (!notification) throw new NotFoundError('Notification not found');
  await notification.destroy();
  await AuditEvent.create({ userId: adminUserId, action: 'admin.notification.delete', entityType: 'notification', entityId: notification.id, status: 'success' });
  return { success: true, message: 'Notification deleted' };
};

const sendNotification = async (data, adminUserId) => {
  const { userId, type, title, message, metadata = {} } = data;
  const notification = await Notification.create({ userId, type, title, message, metadata, createdBy: adminUserId, isRead: false });
  await AuditEvent.create({ userId: adminUserId, action: 'admin.notification.send', entityType: 'notification', entityId: notification.id, metadata: { userId, type }, status: 'success' });
  return { success: true, notification };
};

const broadcastNotification = async (data, adminUserId) => {
  const { type, title, message, metadata = {}, targetRole = null, targetPermission = null } = data;
  let users = [];
  if (targetRole) {
    const role = await Role.findByPk(targetRole);
    if (role) {
      users = await User.findAll({ include: [{ model: Role, where: { id: targetRole } }] });
    }
  } else if (targetPermission) {
    const permission = await Permission.findByPk(targetPermission);
    if (permission) {
      users = await User.findAll({ include: [{ model: Role, include: [{ model: Permission, where: { id: targetPermission } }] }] });
    }
  } else {
    users = await User.findAll();
  }
  const notifications = [];
  for (const user of users) {
    const notification = await Notification.create({ userId: user.id, type, title, message, metadata, createdBy: adminUserId, isRead: false });
    notifications.push(notification);
  }
  await AuditEvent.create({ userId: adminUserId, action: 'admin.notification.broadcast', entityType: 'notification', metadata: { type, recipientCount: users.length }, status: 'success' });
  return { success: true, sentCount: notifications.length, notifications };
};

// Report management methods
const listReports = async (options = {}) => {
  const { status = null, type = null, priority = null, limit = 50, offset = 0 } = options;
  const where = {};
  if (status) where.status = status;
  if (type) where.type = type;
  if (priority) where.priority = priority;
  const result = await Report.findAndCountAll({ where, include: [User], limit, offset, order: [['createdAt', 'DESC']] });
  return { data: result.rows, pagination: { total: result.count, limit, offset, hasMore: offset + limit < result.count } };
};

const getReport = async (reportId) => {
  const report = await Report.findByPk(reportId, { include: [User] });
  if (!report) throw new NotFoundError('Report not found');
  return report;
};

const updateReport = async (reportId, updates, adminUserId) => {
  const report = await Report.findByPk(reportId);
  if (!report) throw new NotFoundError('Report not found');
  await report.update(updates);
  await AuditEvent.create({ userId: adminUserId, action: 'admin.report.update', entityType: 'report', entityId: report.id, metadata: { changes: updates }, status: 'success' });
  return report;
};

const deleteReport = async (reportId, adminUserId) => {
  const report = await Report.findByPk(reportId);
  if (!report) throw new NotFoundError('Report not found');
  await report.destroy();
  await AuditEvent.create({ userId: adminUserId, action: 'admin.report.delete', entityType: 'report', entityId: report.id, status: 'success' });
  return { success: true, message: 'Report deleted' };
};

const resolveReport = async (reportId, data, adminUserId) => {
  const { resolution, notes } = data;
  const report = await Report.findByPk(reportId);
  if (!report) throw new NotFoundError('Report not found');
  await report.update({ status: 'resolved', resolution, resolvedBy: adminUserId, resolvedAt: new Date(), notes });
  await AuditEvent.create({ userId: adminUserId, action: 'admin.report.resolve', entityType: 'report', entityId: report.id, metadata: { resolution }, status: 'success' });
  return report;
};

const getReportsByUser = async (userId, options = {}) => {
  const { limit = 50, offset = 0 } = options;
  const result = await Report.findAndCountAll({ where: { reportedBy: userId }, include: [User], limit, offset, order: [['createdAt', 'DESC']] });
  return { data: result.rows, pagination: { total: result.count, limit, offset, hasMore: offset + limit < result.count } };
};

// Security management methods
const getSecurityInfo = async () => {
  const [activeSessions, activeUsers, totalUsers, totalNodes] = await Promise.all([
    Session.count({ where: { isActive: true } }),
    User.count({ where: { isActive: true } }),
    User.count(),
    Node.count()
  ]);
  return {
    activeSessions,
    activeUsers,
    totalUsers,
    totalNodes,
    encryption: config.encryption.algorithm,
    mfaEnabled: config.auth.mfa.enabled,
    passkeysEnabled: config.auth.passkeys.enabled
  };
};

const getSecurityAudits = async (options = {}) => {
  const { limit = 50, offset = 0 } = options;
  const result = await AuditEvent.findAndCountAll({ where: { category: 'security' }, limit, offset, order: [['createdAt', 'DESC']] });
  return { data: result.rows, pagination: { total: result.count, limit, offset, hasMore: offset + limit < result.count } };
};

const getSecurityVulnerabilities = async (options = {}) => {
  const { severity = null, status = null, limit = 50, offset = 0 } = options;
  // In a real implementation, this would query a vulnerabilities table
  const result = { data: [], pagination: { total: 0, limit, offset, hasMore: false } };
  return result;
};

const getSecurityThreats = async (options = {}) => {
  const { type = null, status = null, limit = 50, offset = 0 } = options;
  // In a real implementation, this would query a threats table
  const result = { data: [], pagination: { total: 0, limit, offset, hasMore: false } };
  return result;
};

const runSecurityScan = async (options, adminUserId) => {
  const { type = 'full', scope = null } = options;
  // In a real implementation, this would run security scans
  await AuditEvent.create({ userId: adminUserId, action: 'admin.security.scan', entityType: 'security', metadata: { type, scope }, status: 'completed' });
  return { success: true, message: 'Security scan completed', type, scope };
};

const runSecurityAudit = async (options, adminUserId) => {
  const { type = 'full', scope = null } = options;
  // In a real implementation, this would run security audits
  await AuditEvent.create({ userId: adminUserId, action: 'admin.security.audit', entityType: 'security', metadata: { type, scope }, status: 'completed' });
  return { success: true, message: 'Security audit completed', type, scope };
};

const getSecurityAlerts = async (options = {}) => {
  const { severity = null, status = null, limit = 50, offset = 0 } = options;
  // In a real implementation, this would query security alerts
  const result = { data: [], pagination: { total: 0, limit, offset, hasMore: false } };
  return result;
};

const acknowledgeSecurityAlert = async (alertId, notes, adminUserId) => {
  // In a real implementation, this would acknowledge a security alert
  await AuditEvent.create({ userId: adminUserId, action: 'admin.security.alert.acknowledge', entityType: 'security', metadata: { alertId, notes }, status: 'success' });
  return { success: true, alertId, acknowledged: true };
};

// Monitoring methods
const getMonitoringInfo = async () => {
  const [totalRequests, errorRate, avgResponseTime] = await Promise.all([
    0, // Would need request tracking
    0, // Would need error tracking
    0  // Would need timing tracking
  ]);
  return { totalRequests, errorRate, avgResponseTime };
};

const getMonitoringMetrics = async (options = {}) => {
  const { hours = 1 } = options;
  // In a real implementation, this would query monitoring metrics
  return { period: `${hours} hours`, requests: 0, errors: 0, avgResponseTime: 0 };
};

const getMonitoringAlerts = async (options = {}) => {
  const { severity = null, status = null, limit = 50, offset = 0 } = options;
  // In a real implementation, this would query monitoring alerts
  const result = { data: [], pagination: { total: 0, limit, offset, hasMore: false } };
  return result;
};

const acknowledgeMonitoringAlert = async (alertId, notes, adminUserId) => {
  // In a real implementation, this would acknowledge a monitoring alert
  await AuditEvent.create({ userId: adminUserId, action: 'admin.monitoring.alert.acknowledge', entityType: 'monitoring', metadata: { alertId, notes }, status: 'success' });
  return { success: true, alertId, acknowledged: true };
};

const getMonitoringStatus = async () => {
  return { status: 'operational', timestamp: new Date().toISOString() };
};

// Analytics methods
const getAnalytics = async (options = {}) => {
  const { days = 7 } = options;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const [userGrowth, nodeGrowth, storageGrowth, activeUsers] = await Promise.all([
    User.count({ where: { createdAt: { [Op.gte]: startDate } } }),
    Node.count({ where: { createdAt: { [Op.gte]: startDate } } }),
    StorageObject.count({ where: { createdAt: { [Op.gte]: startDate } } }),
    User.count({ where: { isActive: true, lastLoginAt: { [Op.gte]: startDate } } })
  ]);
  return { period: `${days} days`, userGrowth, nodeGrowth, storageGrowth, activeUsers };
};

const getUserAnalytics = async (options = {}) => {
  const { days = 7 } = options;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const [newUsers, activeUsers, verifiedUsers, lockedUsers] = await Promise.all([
    User.count({ where: { createdAt: { [Op.gte]: startDate } } }),
    User.count({ where: { isActive: true, lastLoginAt: { [Op.gte]: startDate } } }),
    User.count({ where: { isVerified: true } }),
    User.count({ where: { isLocked: true } })
  ]);
  return { period: `${days} days`, newUsers, activeUsers, verifiedUsers, lockedUsers };
};

const getNodeAnalytics = async (options = {}) => {
  const { days = 7 } = options;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const [newNodes, activeNodes, verifiedNodes, totalStorage] = await Promise.all([
    Node.count({ where: { createdAt: { [Op.gte]: startDate } } }),
    Node.count({ where: { isActive: true } }),
    Node.count({ where: { isVerified: true } }),
    Node.sum('resources.storage.used')
  ]);
  return { period: `${days} days`, newNodes, activeNodes, verifiedNodes, totalStorage: totalStorage || 0 };
};

const getStorageAnalytics = async (options = {}) => {
  const { days = 7 } = options;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const [newObjects, totalSize, encryptedObjects, publicObjects] = await Promise.all([
    StorageObject.count({ where: { createdAt: { [Op.gte]: startDate } } }),
    StorageObject.sum('size', { where: { createdAt: { [Op.gte]: startDate } } }),
    StorageObject.count({ where: { isEncrypted: true } }),
    StorageObject.count({ where: { isPublic: true } })
  ]);
  return { period: `${days} days`, newObjects, totalSize: totalSize || 0, encryptedObjects, publicObjects };
};

const getServiceAnalytics = async (options = {}) => {
  const { days = 7 } = options;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const [newServices, activeServices, totalInstances, verifiedServices] = await Promise.all([
    Service.count({ where: { createdAt: { [Op.gte]: startDate } } }),
    Service.count({ where: { isActive: true } }),
    ServiceInstance.count(),
    Service.count({ where: { isVerified: true } })
  ]);
  return { period: `${days} days`, newServices, activeServices, totalInstances, verifiedServices };
};

// Export methods
const exportUsers = async (options = {}) => {
  const { format = 'json', fields = null } = options;
  const users = await User.findAll({ include: [Profile, HayerId, Role] });
  if (format === 'json') {
    const exportData = users.map(user => {
      const data = user.toJSON();
      if (fields) {
        const selected = {};
        fields.forEach(field => {
          if (field in data) selected[field] = data[field];
        });
        return selected;
      }
      return data;
    });
    return { success: true, data: exportData, count: exportData.length, format };
  }
  // CSV format would be implemented here
  return { success: true, data: users, count: users.length, format };
};

const exportNodes = async (options = {}) => {
  const { format = 'json', fields = null } = options;
  const nodes = await Node.findAll({ include: [Operator, Replica] });
  if (format === 'json') {
    const exportData = nodes.map(node => {
      const data = node.toJSON();
      if (fields) {
        const selected = {};
        fields.forEach(field => {
          if (field in data) selected[field] = data[field];
        });
        return selected;
      }
      return data;
    });
    return { success: true, data: exportData, count: exportData.length, format };
  }
  return { success: true, data: nodes, count: nodes.length, format };
};

const exportStorage = async (options = {}) => {
  const { format = 'json', fields = null, includeChunks = false } = options;
  const storageObjects = await StorageObject.findAll({ include: [User, StorageChunk] });
  if (format === 'json') {
    const exportData = storageObjects.map(obj => {
      const data = obj.toJSON();
      if (!includeChunks) delete data.StorageChunks;
      if (fields) {
        const selected = {};
        fields.forEach(field => {
          if (field in data) selected[field] = data[field];
        });
        return selected;
      }
      return data;
    });
    return { success: true, data: exportData, count: exportData.length, format };
  }
  return { success: true, data: storageObjects, count: storageObjects.length, format };
};

const exportServices = async (options = {}) => {
  const { format = 'json', fields = null } = options;
  const services = await Service.findAll({ include: [ServiceInstance, Operator] });
  if (format === 'json') {
    const exportData = services.map(service => {
      const data = service.toJSON();
      if (fields) {
        const selected = {};
        fields.forEach(field => {
          if (field in data) selected[field] = data[field];
        });
        return selected;
      }
      return data;
    });
    return { success: true, data: exportData, count: exportData.length, format };
  }
  return { success: true, data: services, count: services.length, format };
};

const exportCommunities = async (options = {}) => {
  const { format = 'json', fields = null } = options;
  const communities = await Community.findAll({ include: [User, CommunityMember] });
  if (format === 'json') {
    const exportData = communities.map(community => {
      const data = community.toJSON();
      if (fields) {
        const selected = {};
        fields.forEach(field => {
          if (field in data) selected[field] = data[field];
        });
        return selected;
      }
      return data;
    });
    return { success: true, data: exportData, count: exportData.length, format };
  }
  return { success: true, data: communities, count: communities.length, format };
};

const exportAudit = async (options = {}) => {
  const { format = 'json', days = 30, action = null, userId = null } = options;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const where = { createdAt: { [Op.gte]: startDate } };
  if (action) where.action = action;
  if (userId) where.userId = userId;
  const auditLogs = await AuditEvent.findAll({ where, include: [User], order: [['createdAt', 'ASC']] });
  if (format === 'json') {
    const exportData = auditLogs.map(log => log.toJSON());
    return { success: true, data: exportData, count: exportData.length, format, period: `${days} days` };
  }
  return { success: true, data: auditLogs, count: auditLogs.length, format };
};

// Import methods
const importUsers = async (data, adminUserId) => {
  const { format = 'json', overwrite = false, validate = true } = data;
  let items = data.items || data.data || [];
  if (format === 'json' && typeof items === 'string') {
    try { items = JSON.parse(items); } catch (e) { throw new ValidationError('Invalid JSON data'); }
  }
  const results = { success: 0, failed: 0, errors: [] };
  for (const item of items) {
    try {
      const existing = await User.findOne({ where: { email: item.email } });
      if (existing && !overwrite) {
        results.failed++;
        results.errors.push({ item: item.email, error: 'User already exists' });
        continue;
      }
      if (existing && overwrite) {
        await existing.update(item);
        results.success++;
      } else {
        await User.create(item);
        results.success++;
      }
    } catch (error) {
      results.failed++;
      results.errors.push({ item: item.email || item.username, error: error.message });
    }
  }
  await AuditEvent.create({ userId: adminUserId, action: 'admin.import.users', entityType: 'import', metadata: { count: items.length, success: results.success, failed: results.failed }, status: 'completed' });
  return { success: true, ...results };
};

const importNodes = async (data, adminUserId) => {
  const { format = 'json', overwrite = false } = data;
  let items = data.items || data.data || [];
  if (format === 'json' && typeof items === 'string') {
    try { items = JSON.parse(items); } catch (e) { throw new ValidationError('Invalid JSON data'); }
  }
  const results = { success: 0, failed: 0, errors: [] };
  for (const item of items) {
    try {
      const existing = await Node.findOne({ where: { name: item.name } });
      if (existing && !overwrite) {
        results.failed++;
        results.errors.push({ item: item.name, error: 'Node already exists' });
        continue;
      }
      if (existing && overwrite) {
        await existing.update(item);
        results.success++;
      } else {
        await Node.create(item);
        results.success++;
      }
    } catch (error) {
      results.failed++;
      results.errors.push({ item: item.name, error: error.message });
    }
  }
  await AuditEvent.create({ userId: adminUserId, action: 'admin.import.nodes', entityType: 'import', metadata: { count: items.length, success: results.success, failed: results.failed }, status: 'completed' });
  return { success: true, ...results };
};

const importStorage = async (data, adminUserId) => {
  const { format = 'json', overwrite = false } = data;
  let items = data.items || data.data || [];
  if (format === 'json' && typeof items === 'string') {
    try { items = JSON.parse(items); } catch (e) { throw new ValidationError('Invalid JSON data'); }
  }
  const results = { success: 0, failed: 0, errors: [] };
  for (const item of items) {
    try {
      const existing = await StorageObject.findOne({ where: { id: item.id } });
      if (existing && !overwrite) {
        results.failed++;
        results.errors.push({ item: item.id, error: 'Storage object already exists' });
        continue;
      }
      if (existing && overwrite) {
        await existing.update(item);
        results.success++;
      } else {
        await StorageObject.create(item);
        results.success++;
      }
    } catch (error) {
      results.failed++;
      results.errors.push({ item: item.id, error: error.message });
    }
  }
  await AuditEvent.create({ userId: adminUserId, action: 'admin.import.storage', entityType: 'import', metadata: { count: items.length, success: results.success, failed: results.failed }, status: 'completed' });
  return { success: true, ...results };
};

const importServices = async (data, adminUserId) => {
  const { format = 'json', overwrite = false } = data;
  let items = data.items || data.data || [];
  if (format === 'json' && typeof items === 'string') {
    try { items = JSON.parse(items); } catch (e) { throw new ValidationError('Invalid JSON data'); }
  }
  const results = { success: 0, failed: 0, errors: [] };
  for (const item of items) {
    try {
      const existing = await Service.findOne({ where: { serviceId: item.serviceId } });
      if (existing && !overwrite) {
        results.failed++;
        results.errors.push({ item: item.serviceId, error: 'Service already exists' });
        continue;
      }
      if (existing && overwrite) {
        await existing.update(item);
        results.success++;
      } else {
        await Service.create(item);
        results.success++;
      }
    } catch (error) {
      results.failed++;
      results.errors.push({ item: item.serviceId, error: error.message });
    }
  }
  await AuditEvent.create({ userId: adminUserId, action: 'admin.import.services', entityType: 'import', metadata: { count: items.length, success: results.success, failed: results.failed }, status: 'completed' });
  return { success: true, ...results };
};

const importCommunities = async (data, adminUserId) => {
  const { format = 'json', overwrite = false } = data;
  let items = data.items || data.data || [];
  if (format === 'json' && typeof items === 'string') {
    try { items = JSON.parse(items); } catch (e) { throw new ValidationError('Invalid JSON data'); }
  }
  const results = { success: 0, failed: 0, errors: [] };
  for (const item of items) {
    try {
      const existing = await Community.findOne({ where: { handle: item.handle } });
      if (existing && !overwrite) {
        results.failed++;
        results.errors.push({ item: item.handle, error: 'Community already exists' });
        continue;
      }
      if (existing && overwrite) {
        await existing.update(item);
        results.success++;
      } else {
        await Community.create(item);
        results.success++;
      }
    } catch (error) {
      results.failed++;
      results.errors.push({ item: item.handle, error: error.message });
    }
  }
  await AuditEvent.create({ userId: adminUserId, action: 'admin.import.communities', entityType: 'import', metadata: { count: items.length, success: results.success, failed: results.failed }, status: 'completed' });
  return { success: true, ...results };
};


// Export all admin service methods
module.exports = {
  // Dashboard methods
  getAdminDashboard,
  getDashboardStatistics,
  getDashboardActivity,
  getDashboardAlerts,

  // User management methods
  listUsers,
  getUser,
  updateUser,
  suspendUser,
  unsuspendUser,
  banUser,
  unbanUser,
  verifyUser,
  unverifyUser,
  deleteUser,
  getUserActivity,
  getUserSessions,
  impersonateUser,

  // Role management methods
  listRoles,
  createRole,
  getRole,
  updateRole,
  deleteRole,
  getRoleUsers,
  assignRoleToUser,
  removeRoleFromUser,

  // Permission management methods
  listPermissions,
  createPermission,
  getPermission,
  updatePermission,
  deletePermission,

  // Node management methods
  listNodes,
  getNode,
  updateNode,
  approveNode,
  rejectNode,
  suspendNode,
  unsuspendNode,
  quarantineNode,
  unquarantineNode,
  revokeNode,
  restoreNode,
  deleteNode,

  // Operator management methods
  listOperators,
  getOperator,
  updateOperator,
  verifyOperator,
  unverifyOperator,
  suspendOperator,
  unsuspendOperator,
  deleteOperator,

  // Service management methods
  listServices,
  createService,
  getService,
  updateService,
  deleteService,
  listServiceInstances,
  getServiceInstance,
  updateServiceInstance,
  deleteServiceInstance,

  // Storage management methods
  getStorageInfo,
  getStorageStatistics,
  getStorageUsage,
  listStorageObjects,
  getStorageObject,
  updateStorageObject,
  deleteStorageObject,
  cleanupStorage,
  repairStorage,
  verifyStorage,
  backupStorage,
  restoreStorage,

  // Community management methods
  listCommunities,
  getCommunity,
  updateCommunity,
  verifyCommunity,
  unverifyCommunity,
  featureCommunity,
  unfeatureCommunity,
  deleteCommunity,

  // Audit log methods
  getAuditLogs,
  getAuditLog,
  getAuditLogsByUser,
  getAuditLogsByAction,
  getAuditLogsByCategory,
  clearAuditLogs,
  exportAuditLogs,

  // System management methods
  getSystemInfo,
  getSystemHealth,
  getSystemMetrics,
  getSystemStatus,
  restartSystem,
  shutdownSystem,
  enableMaintenance,
  disableMaintenance,

  // Configuration management methods
  getConfiguration,
  updateConfiguration,
  getConfigurationKey,
  updateConfigurationKey,
  deleteConfigurationKey,

  // Backup management methods
  listBackups,
  createBackup,
  getBackup,
  restoreBackup,
  deleteBackup,
  exportBackup,
  importBackup,

  // Notification management methods
  listNotifications,
  createNotification,
  getNotification,
  updateNotification,
  deleteNotification,
  sendNotification,
  broadcastNotification,

  // Report management methods
  listReports,
  getReport,
  updateReport,
  deleteReport,
  resolveReport,
  getReportsByUser,

  // Security management methods
  getSecurityInfo,
  getSecurityAudits,
  getSecurityVulnerabilities,
  getSecurityThreats,
  runSecurityScan,
  runSecurityAudit,
  getSecurityAlerts,
  acknowledgeSecurityAlert,

  // Monitoring methods
  getMonitoringInfo,
  getMonitoringMetrics,
  getMonitoringAlerts,
  acknowledgeMonitoringAlert,
  getMonitoringStatus,

  // Analytics methods
  getAnalytics,
  getUserAnalytics,
  getNodeAnalytics,
  getStorageAnalytics,
  getServiceAnalytics,

  // Export methods
  exportUsers,
  exportNodes,
  exportStorage,
  exportServices,
  exportCommunities,
  exportAudit,

  // Import methods
  importUsers,
  importNodes,
  importStorage,
  importServices,
  importCommunities
};
