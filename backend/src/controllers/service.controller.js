/**
 * Service Controller
 * Handles service catalog and instance management endpoints
 */

const serviceService = require('../services/service.service');
const { 
  AuthenticationError, 
  AuthorizationError,
  ValidationError,
  NotFoundError,
  ConflictError
} = require('../middleware/errorHandler');
const { extractUserFromRequest, checkPermission } = require('../middleware/authentication');

/**
 * Create a new service
 */
const createService = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    // Check admin role
    const hasPermission = await checkPermission(user, 'service', 'manage', 'all');
    if (!hasPermission) {
      throw new AuthorizationError('Admin permissions required');
    }
    
    const { 
      name,
      type,
      description,
      icon,
      color,
      isActive = true,
      isSystem = false,
      configSchema = {}
    } = req.body;
    
    const service = await serviceService.createService({
      name,
      type,
      description,
      icon,
      color,
      isActive,
      isSystem,
      configSchema
    }, {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.status(201).json({
      success: true,
      data: service
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get service by ID
 */
const getService = async (req, res, next) => {
  try {
    const { serviceId } = req.params;
    const { includeInstances = false } = req.query;
    
    const service = await serviceService.getServiceById(serviceId, {
      includeInstances: includeInstances === 'true',
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      data: service
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get service by name
 */
const getServiceByName = async (req, res, next) => {
  try {
    const { name } = req.params;
    
    const service = await serviceService.getServiceByName(name);
    
    res.json({
      success: true,
      data: service
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List all services
 */
const listServices = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    
    const { 
      type = null,
      isActive = null,
      isSystem = null,
      limit = 50,
      offset = 0,
      sortBy = 'name',
      sortOrder = 'ASC'
    } = req.query;
    
    const result = await serviceService.listServices({
      type,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : null,
      isSystem: isSystem === 'true' ? true : isSystem === 'false' ? false : null,
      limit: parseInt(limit),
      offset: parseInt(offset),
      sortBy,
      sortOrder,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update service
 */
const updateService = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    // Check admin role
    const hasPermission = await checkPermission(user, 'service', 'manage', 'all');
    if (!hasPermission) {
      throw new AuthorizationError('Admin permissions required');
    }
    
    const { serviceId } = req.params;
    const updates = req.body;
    
    const service = await serviceService.updateService(serviceId, updates, {
      userId: user.id,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      data: service
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Deactivate service
 */
const deactivateService = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    // Check admin role
    const hasPermission = await checkPermission(user, 'service', 'manage', 'all');
    if (!hasPermission) {
      throw new AuthorizationError('Admin permissions required');
    }
    
    const { serviceId } = req.params;
    
    const service = await serviceService.deactivateService(serviceId, {
      userId: user.id,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      data: service,
      message: 'Service deactivated'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Activate service
 */
const activateService = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    // Check admin role
    const hasPermission = await checkPermission(user, 'service', 'manage', 'all');
    if (!hasPermission) {
      throw new AuthorizationError('Admin permissions required');
    }
    
    const { serviceId } = req.params;
    
    const service = await serviceService.activateService(serviceId, {
      userId: user.id,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      data: service,
      message: 'Service activated'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove service
 */
const removeService = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    // Check admin role
    const hasPermission = await checkPermission(user, 'service', 'remove', 'all');
    if (!hasPermission) {
      throw new AuthorizationError('Admin permissions required');
    }
    
    const { serviceId } = req.params;
    
    const result = await serviceService.removeService(serviceId, {
      userId: user.id,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// SERVICE INSTANCE ENDPOINTS
// ============================================================================

/**
 * Create a new service instance
 */
const createServiceInstance = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { 
      serviceId,
      name,
      url,
      apiUrl,
      configuration = {},
      credentials = {}
    } = req.body;
    
    const instance = await serviceService.createServiceInstance(user.id, {
      serviceId,
      name,
      url,
      apiUrl,
      configuration,
      credentials
    }, {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.status(201).json({
      success: true,
      data: instance
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get service instance by ID
 */
const getServiceInstance = async (req, res, next) => {
  try {
    const { instanceId } = req.params;
    const { includeService = false } = req.query;
    
    const instance = await serviceService.getServiceInstanceById(instanceId, {
      includeService: includeService === 'true',
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      data: instance
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List service instances
 */
const listServiceInstances = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    
    const { 
      serviceId = null,
      isActive = null,
      healthStatus = null,
      limit = 50,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;
    
    const result = await serviceService.listServiceInstances({
      serviceId,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : null,
      healthStatus,
      limit: parseInt(limit),
      offset: parseInt(offset),
      sortBy,
      sortOrder,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update service instance
 */
const updateServiceInstance = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { instanceId } = req.params;
    const updates = req.body;
    
    const instance = await serviceService.updateServiceInstance(
      user.id,
      instanceId,
      updates,
      {
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        requestId: req.requestId
      }
    );
    
    res.json({
      success: true,
      data: instance
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Deactivate service instance
 */
const deactivateServiceInstance = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { instanceId } = req.params;
    
    const instance = await serviceService.deactivateServiceInstance(
      user.id,
      instanceId,
      {
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        requestId: req.requestId
      }
    );
    
    res.json({
      success: true,
      data: instance,
      message: 'Service instance deactivated'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Activate service instance
 */
const activateServiceInstance = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { instanceId } = req.params;
    
    const instance = await serviceService.activateServiceInstance(
      user.id,
      instanceId,
      {
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        requestId: req.requestId
      }
    );
    
    res.json({
      success: true,
      data: instance,
      message: 'Service instance activated'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove service instance
 */
const removeServiceInstance = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { instanceId } = req.params;
    
    const result = await serviceService.removeServiceInstance(
      user.id,
      instanceId,
      {
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        requestId: req.requestId
      }
    );
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update service instance health
 */
const updateServiceInstanceHealth = async (req, res, next) => {
  try {
    const { instanceId } = req.params;
    const healthData = req.body;
    
    const instance = await serviceService.updateServiceInstanceHealth(
      instanceId,
      healthData,
      {
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        requestId: req.requestId
      }
    );
    
    res.json({
      success: true,
      data: instance
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get service instance statistics
 */
const getServiceInstanceStats = async (req, res, next) => {
  try {
    const { instanceId } = req.params;
    
    const stats = await serviceService.getServiceInstanceStats(instanceId, {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get service catalog
 */
const getServiceCatalog = async (req, res, next) => {
  try {
    const { type = null, includeInstances = false } = req.query;
    
    const catalog = await serviceService.getServiceCatalog({
      type,
      includeInstances: includeInstances === 'true',
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      ...catalog
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get service types
 */
const getServiceTypes = async (req, res, next) => {
  try {
    const types = await serviceService.getServiceTypes();
    
    res.json({
      success: true,
      data: types
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get services by type
 */
const getServicesByType = async (req, res, next) => {
  try {
    const { type } = req.params;
    const { includeInstances = false } = req.query;
    
    const result = await serviceService.getServicesByType(type, {
      includeInstances: includeInstances === 'true',
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Search services
 */
const searchServices = async (req, res, next) => {
  try {
    const { query } = req.query;
    const { limit = 20, offset = 0 } = req.query;
    
    const result = await serviceService.searchServices(query, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get service statistics
 */
const getServiceStats = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    
    // Check admin role
    if (user) {
      const hasPermission = await checkPermission(user, 'service', 'view', 'all');
      if (!hasPermission) {
        throw new AuthorizationError('Admin permissions required');
      }
    }
    
    const stats = await serviceService.getServiceStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's service instances
 */
const getUserServiceInstances = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { serviceId = null, limit = 50, offset = 0 } = req.query;
    
    const result = await serviceService.getUserServiceInstances(user.id, {
      serviceId,
      limit: parseInt(limit),
      offset: parseInt(offset),
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Register service instance for user
 */
const registerUserServiceInstance = async (req, res, next) => {
  try {
    const user = extractUserFromRequest(req);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    const { 
      serviceId,
      name,
      url,
      apiUrl,
      configuration = {},
      credentials = {}
    } = req.body;
    
    const instance = await serviceService.registerUserServiceInstance(user.id, {
      serviceId,
      name,
      url,
      apiUrl,
      configuration,
      credentials
    }, {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.status(201).json({
      success: true,
      data: instance
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get service integration configuration
 */
const getServiceIntegrationConfig = async (req, res, next) => {
  try {
    const { serviceId } = req.params;
    
    const config = await serviceService.getServiceIntegrationConfig(serviceId, {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createService,
  getService,
  getServiceByName,
  listServices,
  updateService,
  deactivateService,
  activateService,
  removeService,
  createServiceInstance,
  getServiceInstance,
  listServiceInstances,
  updateServiceInstance,
  deactivateServiceInstance,
  activateServiceInstance,
  removeServiceInstance,
  updateServiceInstanceHealth,
  getServiceInstanceStats,
  getServiceCatalog,
  getServiceTypes,
  getServicesByType,
  searchServices,
  getServiceStats,
  getUserServiceInstances,
  registerUserServiceInstance,
  getServiceIntegrationConfig
};
