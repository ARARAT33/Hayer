/**
 * Request logging middleware for HAYER backend
 * Logs all incoming requests with relevant details
 */

const config = require('../config');
const { AuditEvent } = require('../models');
const { v4: uuidv4 } = require('uuid');

/**
 * Generate unique request ID
 */
const generateRequestId = (req) => {
  return req.headers['x-request-id'] || req.id || uuidv4();
};

/**
 * Extract client information from request
 */
const extractClientInfo = (req) => {
  const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
  const userAgent = req.get('User-Agent') || '';
  
  // Parse user agent
  const clientInfo = {
    ip,
    userAgent
  };

  // Try to extract browser and OS info
  try {
    const ua = userAgent.toLowerCase();
    
    // Browser detection
    if (ua.includes('chrome')) clientInfo.browser = 'Chrome';
    else if (ua.includes('firefox')) clientInfo.browser = 'Firefox';
    else if (ua.includes('safari')) clientInfo.browser = 'Safari';
    else if (ua.includes('edge')) clientInfo.browser = 'Edge';
    else if (ua.includes('opera')) clientInfo.browser = 'Opera';
    else if (ua.includes('trident') || ua.includes('msie')) clientInfo.browser = 'Internet Explorer';
    
    // OS detection
    if (ua.includes('windows')) clientInfo.os = 'Windows';
    else if (ua.includes('macintosh') || ua.includes('mac os x')) clientInfo.os = 'macOS';
    else if (ua.includes('linux')) clientInfo.os = 'Linux';
    else if (ua.includes('android')) clientInfo.os = 'Android';
    else if (ua.includes('iphone') || ua.includes('ipad')) clientInfo.os = 'iOS';
    
    // Device type detection
    if (ua.includes('mobile')) clientInfo.deviceType = 'mobile';
    else if (ua.includes('tablet')) clientInfo.deviceType = 'tablet';
    else clientInfo.deviceType = 'desktop';
  } catch (error) {
    // Ignore parsing errors
  }

  return clientInfo;
};

/**
 * Log request to audit trail
 */
const logRequest = async (req, startTime) => {
  try {
    const userId = req.user?.id || null;
    const sessionId = req.session?.id || null;
    const duration = Date.now() - startTime;
    
    // Skip health checks and options requests
    if (req.path === '/health' || req.path === '/api/health' || req.method === 'OPTIONS') {
      return;
    }

    await AuditEvent.create({
      userId,
      action: req.method.toLowerCase(),
      category: 'request',
      resource: req.path,
      resourceId: req.id,
      description: `${req.method} ${req.path}`,
      details: {
        method: req.method,
        path: req.path,
        query: req.query,
        params: req.params,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        statusCode: res.statusCode,
        duration
      },
      status: res.statusCode >= 400 ? 'failure' : 'success',
      severity: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warning' : 'info',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: req.id,
      source: 'request_logger'
    });
  } catch (error) {
    // Don't let audit logging errors break the request
    console.error('Failed to log request to audit trail:', error.message);
  }
};

/**
 * Main request logging middleware
 */
const requestLogger = (req, res, next) => {
  const logger = req.app.get('logger');
  const startTime = Date.now();

  // Generate request ID
  req.id = generateRequestId(req);

  // Extract client information
  const clientInfo = extractClientInfo(req);
  req.clientInfo = clientInfo;

  // Log request start
  logger.info(`Request started: ${req.method} ${req.path}`, {
    request: {
      id: req.id,
      method: req.method,
      path: req.path,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      userId: req.user?.id
    }
  });

  // Add request ID to response headers
  res.setHeader('X-Request-ID', req.id);

  // Override res.end to log request completion
  const originalEnd = res.end;
  res.end = function (...args) {
    const duration = Date.now() - startTime;
    
    logger.info(`Request completed: ${req.method} ${req.path} ${res.statusCode} ${duration}ms`, {
      request: {
        id: req.id,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration
      }
    });

    // Log to audit trail (non-blocking)
    setImmediate(() => {
      logRequest(req, startTime);
    });

    originalEnd.apply(res, args);
  };

  next();
};

/**
 * Enhanced request logger with more details
 */
const enhancedRequestLogger = (req, res, next) => {
  const logger = req.app.get('logger');
  const startTime = Date.now();

  req.id = generateRequestId(req);
  const clientInfo = extractClientInfo(req);
  req.clientInfo = clientInfo;

  // Log detailed request information
  const logData = {
    timestamp: new Date().toISOString(),
    request: {
      id: req.id,
      method: req.method,
      path: req.path,
      protocol: req.protocol,
      hostname: req.hostname,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      browser: clientInfo.browser,
      os: clientInfo.os,
      deviceType: clientInfo.deviceType,
      query: req.query,
      params: req.params,
      userId: req.user?.id,
      sessionId: req.session?.id
    }
  };

  logger.info('Request details', logData);

  res.setHeader('X-Request-ID', req.id);

  const originalEnd = res.end;
  res.end = function (...args) {
    const duration = Date.now() - startTime;
    
    const responseLog = {
      timestamp: new Date().toISOString(),
      request: {
        id: req.id,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        size: res.getHeader('Content-Length')
      },
      response: {
        headers: res.getHeaders()
      }
    };

    logger.info('Response details', responseLog);

    setImmediate(() => {
      logRequest(req, startTime);
    });

    originalEnd.apply(res, args);
  };

  next();
};

module.exports = {
  requestLogger,
  enhancedRequestLogger,
  generateRequestId,
  extractClientInfo,
  logRequest
};
