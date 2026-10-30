/**
 * Global error handler middleware for HAYER backend
 * Handles all errors and formats them consistently
 */

const config = require('../config');
const { AuditEvent } = require('../models');

// Error classes
class AppError extends Error {
  constructor(message, statusCode, code, details = {}, severity = 'error') {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode || 500;
    this.code = code || 'INTERNAL_ERROR';
    this.details = details;
    this.severity = severity;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details = {}, code = 'VALIDATION_ERROR') {
    super(message, 400, code, details, 'warning');
  }
}

class AuthenticationError extends AppError {
  constructor(message, details = {}, code = 'AUTHENTICATION_ERROR') {
    super(message, 401, code, details, 'warning');
  }
}

class AuthorizationError extends AppError {
  constructor(message, details = {}, code = 'AUTHORIZATION_ERROR') {
    super(message, 403, code, details, 'warning');
  }
}

class NotFoundError extends AppError {
  constructor(message, details = {}, code = 'NOT_FOUND') {
    super(message, 404, code, details, 'warning');
  }
}

class RateLimitError extends AppError {
  constructor(message, details = {}, code = 'RATE_LIMIT_EXCEEDED') {
    super(message, 429, code, details, 'warning');
  }
}

class ConflictError extends AppError {
  constructor(message, details = {}, code = 'CONFLICT') {
    super(message, 409, code, details, 'warning');
  }
}

class BadRequestError extends AppError {
  constructor(message, details = {}, code = 'BAD_REQUEST') {
    super(message, 400, code, details, 'warning');
  }
}

// Map of common error types to HTTP status codes
const errorStatusCodes = {
  SequelizeValidationError: 400,
  SequelizeUniqueConstraintError: 409,
  SequelizeForeignKeyConstraintError: 400,
  SequelizeDatabaseError: 500,
  JsonWebTokenError: 401,
  TokenExpiredError: 401,
  NotBeforeError: 401,
  TypeError: 400,
  SyntaxError: 400
};

// Map of error messages for common errors
const errorMessages = {
  SequelizeValidationError: 'Validation error',
  SequelizeUniqueConstraintError: 'Resource already exists',
  SequelizeForeignKeyConstraintError: 'Referenced resource does not exist',
  SequelizeDatabaseError: 'Database error',
  JsonWebTokenError: 'Invalid token',
  TokenExpiredError: 'Token expired',
  NotBeforeError: 'Token not yet valid'
};

/**
 * Log error to audit trail
 */
const logError = async (error, req, severity = 'error') => {
  try {
    const userId = req.user?.id || null;
    const sessionId = req.session?.id || null;
    
    await AuditEvent.create({
      userId,
      action: 'error',
      category: 'system',
      resource: error.code || 'unknown',
      resourceId: req.id,
      description: error.message,
      details: {
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        error: {
          name: error.name,
          code: error.code,
          stack: config.env === 'development' ? error.stack : undefined
        }
      },
      status: 'failure',
      severity,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: req.id,
      source: 'error_handler'
    });
  } catch (auditError) {
    // Don't let audit logging errors break the error handling
    console.error('Failed to log error to audit trail:', auditError.message);
  }
};

/**
 * Format error response
 */
const formatError = (error, req) => {
  const logger = req.app.get('logger');
  
  // Determine status code
  let statusCode = error.statusCode || 500;
  let code = error.code || 'INTERNAL_ERROR';
  let message = error.message || 'Internal server error';
  let severity = error.severity || 'error';
  let details = error.details || {};
  let isOperational = error.isOperational || false;

  // Handle known error types
  if (error.name in errorStatusCodes) {
    statusCode = errorStatusCodes[error.name];
    message = errorMessages[error.name] || message;
    code = error.name.replace('Sequelize', '').replace('Error', '');
  }

  // Handle Sequelize errors
  if (error.name === 'SequelizeValidationError') {
    details = error.errors ? error.errors.reduce((acc, err) => {
      acc[err.path] = err.message;
      return acc;
    }, {}) : {};
    code = 'VALIDATION_ERROR';
  }

  if (error.name === 'SequelizeUniqueConstraintError') {
    const field = error.fields ? Object.keys(error.fields)[0] : 'field';
    message = `${field} already exists`;
    details = { field, value: error.fields?.[field] };
    code = 'DUPLICATE_ENTRY';
  }

  if (error.name === 'JsonWebTokenError') {
    message = 'Invalid authentication token';
    code = 'INVALID_TOKEN';
  }

  if (error.name === 'TokenExpiredError') {
    message = 'Authentication token expired';
    code = 'TOKEN_EXPIRED';
  }

  // Log the error
  logger.error(`[${statusCode}] ${code}: ${message}`, {
    error: {
      name: error.name,
      message: error.message,
      stack: config.env === 'development' ? error.stack : undefined
    },
    request: {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userId: req.user?.id
    }
  });

  // Log to audit trail (non-blocking)
  if (statusCode >= 400) {
    logError(error, req, severity);
  }

  // Prepare response
  const response = {
    error: true,
    code,
    message,
    ...(config.env === 'development' && { details }),
    ...(config.env === 'development' && { stack: error.stack }),
    timestamp: new Date().toISOString(),
    requestId: req.id
  };

  // Remove stack trace in production
  if (config.env === 'production') {
    delete response.stack;
  }

  return { statusCode, response };
};

/**
 * Main error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  // Handle 404 errors
  if (res.statusCode === 404 && !res.headersSent) {
    return res.status(404).json({
      error: true,
      code: 'NOT_FOUND',
      message: 'Resource not found',
      timestamp: new Date().toISOString(),
      requestId: req.id
    });
  }

  // Handle errors that have already been sent
  if (res.headersSent) {
    return next(err);
  }

  // Format the error
  const { statusCode, response } = formatError(err, req);

  // Send response
  res.status(statusCode).json(response);
};

/**
 * Async handler wrapper to catch errors in async routes
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404 handler for unknown routes
 */
const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`Path ${req.method} ${req.path} not found`);
  next(error);
};

module.exports = {
  errorHandler,
  asyncHandler,
  notFoundHandler,
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  ConflictError,
  BadRequestError
};
