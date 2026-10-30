/**
 * Service Service
 * Manages service catalog, instances, and integrations
 */

const crypto = require('crypto');
const { Op } = require('sequelize');
const config = require('../config');
const { Service, ServiceInstance, User, AuditEvent, HayerId, OAuthToken } = require('../models');
const { 
  NotFoundError, 
  ConflictError,
  ValidationError,
  AuthenticationError,
  AuthorizationError
} = require('../middleware/errorHandler');
const { generateToken } = require('../middleware/authentication');

/**
 * Generate unique service ID
 */
const generateServiceId = async () => {
  let serviceId;
  let exists;
  
  do {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    serviceId = `SVC-${Array.from({ length: 8 }, () => 
      chars.charAt(Math.floor(Math.random() * chars.length))
    ).join('')}`;
    exists = await Service.findOne({ where: { serviceId } });
  } while (exists);
  
  return serviceId;
};

/**
 * Generate unique instance ID
 */
const generateInstanceId = async () => {
  let instanceId;
  let exists;
  
  do {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    instanceId = `INST-${Array.from({ length: 8 }, () => 
      chars.charAt(Math.floor(Math.random() * chars.length))
    ).join('')}`;
    exists = await ServiceInstance.findOne({ where: { instanceId } });
  } while (exists);
  
  return instanceId;
};

/**
 * Create a new service
 */
const createService = async (data, options = {}) => {
  const { 
    name,
    type,
    description,
    icon,
    color,
    isActive = true,
    isSystem = false,
    configSchema = {},
    userAgent = null,
    ipAddress = null,
    requestId = null
  } = data;
  
  // Validate required fields
  if (!name || !type) {
    throw new ValidationError('Name and type are required');
  }
  
  // Check if service already exists
  const existingService = await Service.findOne({
    where: { name: name.toLowerCase() }
  });
  if (existingService) {
    throw new ConflictError('Service already exists');
  }
  
  // Generate service ID
  const serviceId = await generateServiceId();
  
  // Create service
  const service = await Service.create({
    serviceId,
    name: name.toLowerCase(),
    type: type.toLowerCase(),
    description,
    icon,
    color,
    isActive,
    isSystem,
    configSchema
  });
  
  // Log to audit trail
  await AuditEvent.create({
    userId: null,
    action: 'service.create',
    entityType: 'service',
    entityId: service.id,
    metadata: {
      serviceId: service.serviceId,
      name: service.name,
      type: service.type
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return service;
};

/**
 * Get service by ID
 */
const getServiceById = async (serviceId, options = {}) => {
  const { includeInstances = false, userAgent = null, ipAddress = null, requestId = null } = options;
  
  const queryOptions = {
    where: { serviceId }
  };
  
  if (includeInstances) {
    queryOptions.include = [{ model: ServiceInstance }];
  }
  
  const service = await Service.findOne(queryOptions);
  
  if (!service) {
    throw new NotFoundError('Service not found');
  }
  
  // Log access
  await AuditEvent.create({
    userId: null,
    action: 'service.access',
    entityType: 'service',
    entityId: service.id,
    metadata: {
      serviceId: service.serviceId,
      includeInstances
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return service;
};

/**
 * Get service by name
 */
const getServiceByName = async (name) => {
  const service = await Service.findOne({
    where: { name: name.toLowerCase() }
  });
  
  if (!service) {
    throw new NotFoundError('Service not found');
  }
  
  return service;
};

/**
 * Get service by ID (short version)
 */
const getService = async (id) => {
  const service = await Service.findByPk(id);
  
  if (!service) {
    throw new NotFoundError('Service not found');
  }
  
  return service;
};

/**
 * List all services
 */
const listServices = async (options = {}) => {
  const { 
    type = null,
    isActive = null,
    isSystem = null,
    limit = 50,
    offset = 0,
    sortBy = 'name',
    sortOrder = 'ASC',
    userAgent = null,
    ipAddress = null,
    requestId = null
  } = options;
  
  const where = {};
  
  if (type) where.type = type.toLowerCase();
  if (isActive !== null) where.isActive = isActive;
  if (isSystem !== null) where.isSystem = isSystem;
  
  const order = [[sortBy, sortOrder]];
  
  const result = await Service.findAndCountAll({
    where,
    limit,
    offset,
    order
  });
  
  // Log access
  await AuditEvent.create({
    userId: null,
    action: 'service.list',
    entityType: 'service',
    metadata: {
      filters: { type, isActive, isSystem },
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
 * Update service information
 */
const updateService = async (serviceId, updates, options = {}) => {
  const { userId = null, userAgent = null, ipAddress = null, requestId = null } = options;
  
  const service = await Service.findOne({ where: { serviceId } });
  
  if (!service) {
    throw new NotFoundError('Service not found');
  }
  
  const oldValues = { ...service.toJSON() };
  
  // Prevent updating system fields
  if (service.isSystem) {
    delete updates.isSystem;
    delete updates.serviceId;
  }
  
  await service.update(updates);
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'service.update',
    entityType: 'service',
    entityId: service.id,
    metadata: {
      serviceId: service.serviceId,
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
  
  return service;
};

/**
 * Deactivate service
 */
const deactivateService = async (serviceId, options = {}) => {
  const { userId = null, userAgent = null, ipAddress = null, requestId = null } = options;
  
  const service = await Service.findOne({ where: { serviceId } });
  
  if (!service) {
    throw new NotFoundError('Service not found');
  }
  
  if (!service.isActive) {
    throw new ConflictError('Service is already deactivated');
  }
  
  await service.update({ isActive: false });
  
  // Deactivate all instances
  await ServiceInstance.update(
    { isActive: false },
    { where: { serviceId: service.id } }
  );
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'service.deactivate',
    entityType: 'service',
    entityId: service.id,
    metadata: {
      serviceId: service.serviceId
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return service;
};

/**
 * Activate service
 */
const activateService = async (serviceId, options = {}) => {
  const { userId = null, userAgent = null, ipAddress = null, requestId = null } = options;
  
  const service = await Service.findOne({ where: { serviceId } });
  
  if (!service) {
    throw new NotFoundError('Service not found');
  }
  
  if (service.isActive) {
    throw new ConflictError('Service is already active');
  }
  
  await service.update({ isActive: true });
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'service.activate',
    entityType: 'service',
    entityId: service.id,
    metadata: {
      serviceId: service.serviceId
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return service;
};

/**
 * Remove service
 */
const removeService = async (serviceId, options = {}) => {
  const { userId = null, userAgent = null, ipAddress = null, requestId = null } = options;
  
  const service = await Service.findOne({ where: { serviceId } });
  
  if (!service) {
    throw new NotFoundError('Service not found');
  }
  
  if (service.isSystem) {
    throw new ConflictError('Cannot remove system service');
  }
  
  // Check if service has instances
  const instanceCount = await ServiceInstance.count({
    where: { serviceId: service.id }
  });
  
  if (instanceCount > 0) {
    throw new ConflictError('Cannot remove service with instances. Remove instances first.');
  }
  
  await service.destroy();
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'service.remove',
    entityType: 'service',
    entityId: service.id,
    metadata: {
      serviceId: service.serviceId
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return { success: true, message: 'Service removed' };
};

// ============================================================================
// SERVICE INSTANCE METHODS
// ============================================================================

/**
 * Create a new service instance
 */
const createServiceInstance = async (userId, data, options = {}) => {
  const { 
    serviceId,
    name,
    url,
    apiUrl,
    configuration = {},
    credentials = {},
    isActive = true,
    userAgent = null,
    ipAddress = null,
    requestId = null
  } = data;
  
  // Validate service exists
  const service = await Service.findOne({ where: { serviceId } });
  if (!service) {
    throw new NotFoundError('Service not found');
  }
  
  if (!service.isActive) {
    throw new ConflictError('Service is not active');
  }
  
  // Validate user
  const user = await User.findByPk(userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  
  // Generate instance ID
  const instanceId = await generateInstanceId();
  
  // Create service instance
  const instance = await ServiceInstance.create({
    instanceId,
    serviceId: service.id,
    name,
    url,
    apiUrl,
    configuration,
    credentials,
    isActive,
    healthStatus: 'unknown'
  });
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'service_instance.create',
    entityType: 'service_instance',
    entityId: instance.id,
    metadata: {
      instanceId: instance.instanceId,
      serviceId: service.serviceId,
      name: instance.name,
      url: instance.url
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return instance;
};

/**
 * Get service instance by ID
 */
const getServiceInstanceById = async (instanceId, options = {}) => {
  const { includeService = false, userAgent = null, ipAddress = null, requestId = null } = options;
  
  const queryOptions = {
    where: { instanceId }
  };
  
  if (includeService) {
    queryOptions.include = [{ model: Service }];
  }
  
  const instance = await ServiceInstance.findOne(queryOptions);
  
  if (!instance) {
    throw new NotFoundError('Service instance not found');
  }
  
  // Log access
  await AuditEvent.create({
    userId: null,
    action: 'service_instance.access',
    entityType: 'service_instance',
    entityId: instance.id,
    metadata: {
      instanceId: instance.instanceId,
      includeService
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return instance;
};

/**
 * Get service instance by ID (short version)
 */
const getServiceInstance = async (id) => {
  const instance = await ServiceInstance.findByPk(id);
  
  if (!instance) {
    throw new NotFoundError('Service instance not found');
  }
  
  return instance;
};

/**
 * List service instances
 */
const listServiceInstances = async (options = {}) => {
  const { 
    serviceId = null,
    userId = null,
    isActive = null,
    healthStatus = null,
    limit = 50,
    offset = 0,
    sortBy = 'createdAt',
    sortOrder = 'DESC',
    userAgent = null,
    ipAddress = null,
    requestId = null
  } = options;
  
  const where = {};
  
  if (serviceId) {
    const service = await Service.findOne({ where: { serviceId } });
    if (service) where.serviceId = service.id;
  }
  
  if (isActive !== null) where.isActive = isActive;
  if (healthStatus) where.healthStatus = healthStatus;
  
  const order = [[sortBy, sortOrder]];
  
  const result = await ServiceInstance.findAndCountAll({
    where,
    include: [{ model: Service }],
    limit,
    offset,
    order
  });
  
  // Log access
  await AuditEvent.create({
    userId,
    action: 'service_instance.list',
    entityType: 'service_instance',
    metadata: {
      filters: { serviceId, isActive, healthStatus },
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
 * Update service instance
 */
const updateServiceInstance = async (userId, instanceId, updates, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const instance = await ServiceInstance.findOne({ where: { instanceId } });
  
  if (!instance) {
    throw new NotFoundError('Service instance not found');
  }
  
  const oldValues = { ...instance.toJSON() };
  await instance.update(updates);
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'service_instance.update',
    entityType: 'service_instance',
    entityId: instance.id,
    metadata: {
      instanceId: instance.instanceId,
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
  
  return instance;
};

/**
 * Deactivate service instance
 */
const deactivateServiceInstance = async (userId, instanceId, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const instance = await ServiceInstance.findOne({ where: { instanceId } });
  
  if (!instance) {
    throw new NotFoundError('Service instance not found');
  }
  
  if (!instance.isActive) {
    throw new ConflictError('Service instance is already deactivated');
  }
  
  await instance.update({ isActive: false });
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'service_instance.deactivate',
    entityType: 'service_instance',
    entityId: instance.id,
    metadata: {
      instanceId: instance.instanceId
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return instance;
};

/**
 * Activate service instance
 */
const activateServiceInstance = async (userId, instanceId, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const instance = await ServiceInstance.findOne({ where: { instanceId } });
  
  if (!instance) {
    throw new NotFoundError('Service instance not found');
  }
  
  if (instance.isActive) {
    throw new ConflictError('Service instance is already active');
  }
  
  await instance.update({ isActive: true });
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'service_instance.activate',
    entityType: 'service_instance',
    entityId: instance.id,
    metadata: {
      instanceId: instance.instanceId
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return instance;
};

/**
 * Remove service instance
 */
const removeServiceInstance = async (userId, instanceId, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const instance = await ServiceInstance.findOne({ where: { instanceId } });
  
  if (!instance) {
    throw new NotFoundError('Service instance not found');
  }
  
  await instance.destroy();
  
  // Log to audit trail
  await AuditEvent.create({
    userId,
    action: 'service_instance.remove',
    entityType: 'service_instance',
    entityId: instance.id,
    metadata: {
      instanceId: instance.instanceId
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return { success: true, message: 'Service instance removed' };
};

/**
 * Update service instance health
 */
const updateServiceInstanceHealth = async (instanceId, healthData, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const instance = await ServiceInstance.findOne({ where: { instanceId } });
  
  if (!instance) {
    throw new NotFoundError('Service instance not found');
  }
  
  const updates = {
    healthStatus: healthData.status || 'unknown',
    lastHealthCheck: new Date()
  };
  
  if (healthData.responseTime !== undefined) {
    updates.lastResponseTime = healthData.responseTime;
  }
  
  if (healthData.error) {
    updates.lastError = healthData.error;
  }
  
  await instance.update(updates);
  
  // Log health check
  await AuditEvent.create({
    userId: null,
    action: 'service_instance.health_check',
    entityType: 'service_instance',
    entityId: instance.id,
    metadata: {
      instanceId: instance.instanceId,
      healthStatus: updates.healthStatus,
      responseTime: healthData.responseTime
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return instance;
};

/**
 * Get service instance statistics
 */
const getServiceInstanceStats = async (instanceId, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const instance = await ServiceInstance.findOne({
    where: { instanceId },
    include: [Service]
  });
  
  if (!instance) {
    throw new NotFoundError('Service instance not found');
  }
  
  const stats = {
    instance: instance.toJSON(),
    service: instance.Service.toJSON(),
    uptime: instance.lastHealthCheck ? 
      Math.floor((new Date() - new Date(instance.lastHealthCheck)) / 1000) : 0
  };
  
  // Log access
  await AuditEvent.create({
    userId: null,
    action: 'service_instance.stats',
    entityType: 'service_instance',
    entityId: instance.id,
    metadata: {
      instanceId: instance.instanceId,
      healthStatus: instance.healthStatus
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return stats;
};

/**
 * Get service catalog
 */
const getServiceCatalog = async (options = {}) => {
  const { 
    type = null,
    includeInstances = false,
    userAgent = null,
    ipAddress = null,
    requestId = null
  } = options;
  
  const where = { isActive: true };
  
  if (type) where.type = type.toLowerCase();
  
  const services = await Service.findAll({
    where,
    include: includeInstances ? [{ model: ServiceInstance, where: { isActive: true } }] : [],
    order: [['name', 'ASC']]
  });
  
  // Log access
  await AuditEvent.create({
    userId: null,
    action: 'service.catalog',
    entityType: 'service',
    metadata: {
      type,
      includeInstances,
      results: services.length
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return {
    data: services,
    types: await getServiceTypes()
  };
};

/**
 * Get available service types
 */
const getServiceTypes = async () => {
  const services = await Service.findAll({
    attributes: ['type'],
    group: ['type']
  });
  
  return services.map(s => s.type);
};

/**
 * Get service by type
 */
const getServicesByType = async (type, options = {}) => {
  const { 
    includeInstances = false,
    userAgent = null,
    ipAddress = null,
    requestId = null
  } = options;
  
  const services = await Service.findAll({
    where: { type: type.toLowerCase(), isActive: true },
    include: includeInstances ? [{ model: ServiceInstance, where: { isActive: true } }] : [],
    order: [['name', 'ASC']]
  });
  
  // Log access
  await AuditEvent.create({
    userId: null,
    action: 'service.list_by_type',
    entityType: 'service',
    metadata: {
      type,
      includeInstances,
      results: services.length
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return {
    data: services,
    type
  };
};

/**
 * Search services
 */
const searchServices = async (query, options = {}) => {
  const { 
    limit = 20,
    offset = 0,
    userAgent = null,
    ipAddress = null,
    requestId = null
  } = options;
  
  const where = {
    isActive: true,
    [Op.or]: [
      { name: { [Op.iLike]: `%${query}%` } },
      { description: { [Op.iLike]: `%${query}%` } },
      { serviceId: { [Op.iLike]: `%${query}%` } }
    ]
  };
  
  const result = await Service.findAndCountAll({
    where,
    limit,
    offset,
    order: [['name', 'ASC']]
  });
  
  // Log search
  await AuditEvent.create({
    userId: null,
    action: 'service.search',
    entityType: 'service',
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

/**
 * Get service statistics
 */
const getServiceStats = async () => {
  const total = await Service.count();
  const active = await Service.count({ where: { isActive: true } });
  const system = await Service.count({ where: { isSystem: true } });
  const instances = await ServiceInstance.count();
  const activeInstances = await ServiceInstance.count({ where: { isActive: true } });
  
  // Get type counts
  const types = await getServiceTypes();
  const typeCounts = {};
  
  for (const type of types) {
    typeCounts[type] = await Service.count({ where: { type, isActive: true } });
  }
  
  return {
    total,
    active,
    system,
    instances,
    activeInstances,
    typeCounts
  };
};

/**
 * Get service instance for user
 */
const getUserServiceInstances = async (userId, options = {}) => {
  const { 
    serviceId = null,
    limit = 50,
    offset = 0,
    userAgent = null,
    ipAddress = null,
    requestId = null
  } = options;
  
  const where = { userId };
  
  if (serviceId) {
    const service = await Service.findOne({ where: { serviceId } });
    if (service) where.serviceId = service.id;
  }
  
  const result = await ServiceInstance.findAndCountAll({
    where,
    include: [Service],
    limit,
    offset,
    order: [['createdAt', 'DESC']]
  });
  
  // Log access
  await AuditEvent.create({
    userId,
    action: 'service_instance.list_user',
    entityType: 'service_instance',
    metadata: {
      filters: { serviceId },
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
 * Register service instance for user
 */
const registerUserServiceInstance = async (userId, data, options = {}) => {
  const { 
    serviceId,
    name,
    url,
    apiUrl,
    configuration = {},
    credentials = {},
    userAgent = null,
    ipAddress = null,
    requestId = null
  } = data;
  
  // Create service instance
  const instance = await createServiceInstance(userId, {
    serviceId,
    name,
    url,
    apiUrl,
    configuration,
    credentials
  }, {
    userAgent,
    ipAddress,
    requestId
  });
  
  return instance;
};

/**
 * Get service integration configuration
 */
const getServiceIntegrationConfig = async (serviceId, options = {}) => {
  const { userAgent = null, ipAddress = null, requestId = null } = options;
  
  const service = await Service.findOne({
    where: { serviceId },
    include: [ServiceInstance]
  });
  
  if (!service) {
    throw new NotFoundError('Service not found');
  }
  
  const config = {
    service: service.toJSON(),
    instances: service.ServiceInstances.map(i => ({
      ...i.toJSON(),
      // Hide sensitive credentials
      credentials: i.credentials ? { ...i.credentials, password: '***', secret: '***', token: '***' } : {}
    }))
  };
  
  // Log access
  await AuditEvent.create({
    userId: null,
    action: 'service.integration_config',
    entityType: 'service',
    entityId: service.id,
    metadata: {
      serviceId: service.serviceId
    },
    ipAddress,
    userAgent,
    requestId,
    status: 'success'
  });
  
  return config;
};

module.exports = {
  generateServiceId,
  generateInstanceId,
  // Service methods
  createService,
  getServiceById,
  getServiceByName,
  getService,
  listServices,
  updateService,
  deactivateService,
  activateService,
  removeService,
  // Service instance methods
  createServiceInstance,
  getServiceInstanceById,
  getServiceInstance,
  listServiceInstances,
  updateServiceInstance,
  deactivateServiceInstance,
  activateServiceInstance,
  removeServiceInstance,
  updateServiceInstanceHealth,
  getServiceInstanceStats,
  // Catalog methods
  getServiceCatalog,
  getServiceTypes,
  getServicesByType,
  searchServices,
  getServiceStats,
  // User methods
  getUserServiceInstances,
  registerUserServiceInstance,
  getServiceIntegrationConfig
};
