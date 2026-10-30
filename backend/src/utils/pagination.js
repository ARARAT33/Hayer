/**
 * Pagination utilities for HAYER backend
 * Provides pagination functions for database queries and API responses
 */

const { Op } = require('sequelize');

/**
 * Default pagination options
 */
const DEFAULT_PAGINATION = {
  page: 1,
  limit: 20,
  offset: 0,
  order: [['createdAt', 'DESC']],
  include: [],
  where: {},
  distinct: false
};

/**
 * Parse pagination query parameters
 */
const parsePaginationParams = (query) => {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || DEFAULT_PAGINATION.limit;
  const offset = (page - 1) * limit;
  
  // Parse order
  let order = DEFAULT_PAGINATION.order;
  if (query.order) {
    const orderParts = query.order.split(':');
    if (orderParts.length === 2) {
      const [field, direction] = orderParts;
      order = [[field, direction.toUpperCase()]];
    }
  }
  
  return {
    page,
    limit,
    offset,
    order
  };
};

/**
 * Parse filter query parameters
 */
const parseFilterParams = (query, allowedFields = []) => {
  const where = {};
  
  for (const [key, value] of Object.entries(query)) {
    // Skip pagination parameters
    if (['page', 'limit', 'order', 'fields', 'include'].includes(key)) {
      continue;
    }
    
    // Skip if not in allowed fields
    if (allowedFields.length > 0 && !allowedFields.includes(key)) {
      continue;
    }
    
    // Handle different filter types
    if (key.endsWith('_like')) {
      const field = key.slice(0, -5);
      where[field] = { [Op.iLike]: `%${value}%` };
    } else if (key.endsWith('_gt')) {
      const field = key.slice(0, -3);
      where[field] = { [Op.gt]: value };
    } else if (key.endsWith('_gte')) {
      const field = key.slice(0, -4);
      where[field] = { [Op.gte]: value };
    } else if (key.endsWith('_lt')) {
      const field = key.slice(0, -3);
      where[field] = { [Op.lt]: value };
    } else if (key.endsWith('_lte')) {
      const field = key.slice(0, -4);
      where[field] = { [Op.lte]: value };
    } else if (key.endsWith('_ne')) {
      const field = key.slice(0, -3);
      where[field] = { [Op.ne]: value };
    } else if (key.endsWith('_in')) {
      const field = key.slice(0, -3);
      const values = value.split(',');
      where[field] = { [Op.in]: values };
    } else if (key.endsWith('_not_in')) {
      const field = key.slice(0, -8);
      const values = value.split(',');
      where[field] = { [Op.notIn]: values };
    } else if (key.endsWith('_null')) {
      const field = key.slice(0, -5);
      where[field] = { [Op.is]: null };
    } else if (key.endsWith('_not_null')) {
      const field = key.slice(0, -10);
      where[field] = { [Op.not]: null };
    } else {
      // Simple equality
      where[key] = value;
    }
  }
  
  return where;
};

/**
 * Parse include query parameters
 */
const parseIncludeParams = (query, allowedIncludes = []) => {
  const include = [];
  
  if (query.include) {
    const includes = query.include.split(',');
    
    for (const includeName of includes) {
      if (allowedIncludes.length === 0 || allowedIncludes.includes(includeName)) {
        include.push(includeName);
      }
    }
  }
  
  return include;
};

/**
 * Parse field selection query parameters
 */
const parseFieldParams = (query, allowedFields = []) => {
  const fields = [];
  
  if (query.fields) {
    const requestedFields = query.fields.split(',');
    
    for (const field of requestedFields) {
      if (allowedFields.length === 0 || allowedFields.includes(field)) {
        fields.push(field);
      }
    }
  }
  
  return fields;
};

/**
 * Create pagination metadata
 */
const createPaginationMeta = (total, page, limit) => {
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;
  
  return {
    total,
    totalPages,
    currentPage: page,
    itemsPerPage: limit,
    hasNextPage,
    hasPrevPage,
    nextPage: hasNextPage ? page + 1 : null,
    prevPage: hasPrevPage ? page - 1 : null
  };
};

/**
 * Create paginated response
 */
const createPaginatedResponse = (data, total, page, limit, options = {}) => {
  const { includeMeta = true, includeData = true } = options;
  
  const response = {};
  
  if (includeData) {
    response.data = data;
  }
  
  if (includeMeta) {
    response.meta = createPaginationMeta(total, page, limit);
  }
  
  return response;
};

/**
 * Paginate database query
 */
const paginateQuery = async (model, options = {}) => {
  const {
    page = 1,
    limit = 20,
    order = [['createdAt', 'DESC']],
    where = {},
    include = [],
    attributes = null,
    group = null,
    distinct = false,
    paranoid = true,
    subQuery = false
  } = options;
  
  const offset = (page - 1) * limit;
  
  // Get total count
  const countOptions = {
    where,
    include: include.map(i => ({ ...i, required: true })),
    group,
    paranoid
  };
  
  const total = await model.count(countOptions);
  
  // Get paginated data
  const findOptions = {
    where,
    order,
    limit,
    offset,
    include,
    attributes,
    group,
    distinct,
    paranoid,
    subQuery
  };
  
  const data = await model.findAll(findOptions);
  
  return {
    data,
    meta: createPaginationMeta(total, page, limit)
  };
};

/**
 * Paginate with findAndCountAll
 */
const paginateFindAndCountAll = async (model, options = {}) => {
  const {
    page = 1,
    limit = 20,
    order = [['createdAt', 'DESC']],
    where = {},
    include = [],
    attributes = null,
    group = null,
    distinct = false,
    paranoid = true,
    subQuery = false
  } = options;
  
  const offset = (page - 1) * limit;
  
  const findOptions = {
    where,
    order,
    limit,
    offset,
    include,
    attributes,
    group,
    distinct,
    paranoid,
    subQuery
  };
  
  const result = await model.findAndCountAll(findOptions);
  
  return {
    data: result.rows,
    meta: createPaginationMeta(result.count, page, limit)
  };
};

/**
 * Create pagination middleware
 */
const paginationMiddleware = (options = {}) => {
  const {
    defaultLimit = 20,
    maxLimit = 100,
    allowedFields = [],
    allowedIncludes = [],
    allowedOrders = []
  } = options;
  
  return (req, res, next) => {
    try {
      // Parse pagination parameters
      const { page, limit, offset, order } = parsePaginationParams(req.query);
      
      // Apply max limit
      const actualLimit = Math.min(limit, maxLimit);
      const actualOffset = (page - 1) * actualLimit;
      
      // Parse filter parameters
      const where = parseFilterParams(req.query, allowedFields);
      
      // Parse include parameters
      const include = parseIncludeParams(req.query, allowedIncludes);
      
      // Parse order parameters
      let actualOrder = order;
      if (allowedOrders.length > 0 && order.length > 0) {
        const [field, direction] = order[0];
        if (!allowedOrders.includes(field)) {
          actualOrder = DEFAULT_PAGINATION.order;
        }
      }
      
      // Attach pagination to request
      req.pagination = {
        page,
        limit: actualLimit,
        offset: actualOffset,
        order: actualOrder,
        where,
        include
      };
      
      next();
    } catch (error) {
      res.status(400).json({
        error: true,
        code: 'PAGINATION_ERROR',
        message: 'Invalid pagination parameters',
        timestamp: new Date().toISOString()
      });
    }
  };
};

/**
 * Create pagination response middleware
 */
const paginationResponseMiddleware = (options = {}) => {
  const { includeMeta = true } = options;
  
  return (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function (body) {
      if (req.pagination && typeof body === 'object' && body !== null) {
        // Check if this is a paginated response
        if (body.data && Array.isArray(body.data)) {
          const { page, limit, offset } = req.pagination;
          const total = body.total || body.data.length;
          
          const response = createPaginatedResponse(
            body.data,
            total,
            page,
            limit,
            { includeMeta }
          );
          
          // Preserve other response properties
          if (body.message) {
            response.message = body.message;
          }
          if (body.success !== undefined) {
            response.success = body.success;
          }
          if (body.errors) {
            response.errors = body.errors;
          }
          
          return originalSend.call(this, response);
        }
      }
      
      return originalSend.call(this, body);
    };
    
    next();
  };
};

/**
 * Cursor-based pagination
 */
const cursorPagination = {
  /**
   * Encode cursor
   */
  encodeCursor: (value) => {
    return Buffer.from(JSON.stringify(value)).toString('base64');
  },
  
  /**
   * Decode cursor
   */
  decodeCursor: (cursor) => {
    try {
      return JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
    } catch {
      return null;
    }
  },
  
  /**
   * Paginate with cursor
   */
  paginate: async (model, options = {}) => {
    const {
      cursor = null,
      limit = 20,
      order = [['createdAt', 'DESC']],
      where = {},
      include = []
    } = options;
    
    // Decode cursor
    const cursorValue = cursor ? cursorPagination.decodeCursor(cursor) : null;
    
    // Build where clause with cursor
    const cursorWhere = cursorValue ? { [Op.or]: [] } : {};
    
    if (cursorValue && order.length > 0) {
      const [field, direction] = order[0];
      const op = direction === 'ASC' ? Op.gt : Op.lt;
      cursorWhere[Op.or].push({ [field]: { [op]: cursorValue[field] } });
    }
    
    const finalWhere = { ...where, ...cursorWhere };
    
    // Get data
    const data = await model.findAll({
      where: finalWhere,
      order,
      limit,
      include
    });
    
    // Get next cursor
    let nextCursor = null;
    if (data.length > 0) {
      const lastItem = data[data.length - 1];
      const [field] = order[0];
      nextCursor = cursorPagination.encodeCursor({
        [field]: lastItem[field]
      });
    }
    
    return {
      data,
      cursor: nextCursor,
      hasMore: data.length === limit
    };
  }
};

module.exports = {
  // Default pagination
  DEFAULT_PAGINATION,
  
  // Parse functions
  parsePaginationParams,
  parseFilterParams,
  parseIncludeParams,
  parseFieldParams,
  
  // Create functions
  createPaginationMeta,
  createPaginatedResponse,
  
  // Query functions
  paginateQuery,
  paginateFindAndCountAll,
  
  // Middleware
  paginationMiddleware,
  paginationResponseMiddleware,
  
  // Cursor pagination
  cursorPagination,
  
  // Default export
  default: {
    DEFAULT_PAGINATION,
    parsePaginationParams,
    createPaginationMeta,
    createPaginatedResponse,
    paginateQuery,
    paginationMiddleware
  }
};
