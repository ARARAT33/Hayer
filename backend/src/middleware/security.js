const helmet = require('helmet');
const config = require('../config');

/**
 * Security middleware for HAYER backend
 * Implements various security headers and protections
 */

// Content Security Policy
const contentSecurityPolicy = helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
    fontSrc: ["'self'"],
    connectSrc: ["'self'"],
    frameSrc: ["'self'"],
    mediaSrc: ["'self'", 'blob:', 'https:'],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
    upgradeInsecureRequests: []
  }
});

// Cross-Origin Opener Policy
const crossOriginOpenerPolicy = helmet.crossOriginOpenerPolicy({ policy: 'same-origin' });

// Cross-Origin Resource Policy
const crossOriginResourcePolicy = helmet.crossOriginResourcePolicy({ policy: 'same-origin' });

// Cross-Origin Embedder Policy
const crossOriginEmbedderPolicy = helmet.crossOriginEmbedderPolicy({ policy: 'require-corp' });

// HTTP Strict Transport Security
const hsts = helmet.hsts({
  maxAge: 31536000,
  includeSubDomains: true,
  preload: true
});

// X-Content-Type-Options
const xContentTypeOptions = helmet.noSniff();

// X-Frame-Options
const xFrameOptions = helmet.frameguard({ action: 'deny' });

// X-XSS-Protection
const xssFilter = helmet.xssFilter();

// Referrer Policy
const referrerPolicy = helmet.referrerPolicy({ policy: 'same-origin' });

// Permissions Policy
const permissionsPolicy = helmet.permissionsPolicy({
  directives: {
    geolocation: [],
    microphone: [],
    camera: [],
    payment: [],
    usb: [],
    vr: []
  }
});

// Hide X-Powered-By header
const hidePoweredBy = helmet.hidePoweredBy();

/**
 * Main security middleware function
 */
const securityMiddleware = (req, res, next) => {
  // Apply all security headers
  contentSecurityPolicy(req, res, () => {})
  crossOriginOpenerPolicy(req, res, () => {})
  crossOriginResourcePolicy(req, res, () => {})
  crossOriginEmbedderPolicy(req, res, () => {})
  hsts(req, res, () => {})
  xContentTypeOptions(req, res, () => {})
  xFrameOptions(req, res, () => {})
  xssFilter(req, res, () => {})
  referrerPolicy(req, res, () => {})
  permissionsPolicy(req, res, () => {})
  hidePoweredBy(req, res, () => {})

  // Set additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), vr=()');

  // Remove server information
  res.removeHeader('X-Powered-By');

  // Add HAYER-specific headers
  res.setHeader('X-HAYER-Version', '1.0.0');
  res.setHeader('X-HAYER-Request-ID', req.id || req.headers['x-request-id'] || require('crypto').randomBytes(16).toString('hex'));

  next();
};

/**
 * CSRF protection middleware
 * Note: This is a placeholder. In production, use csurf or similar
 */
const csrfProtection = (req, res, next) => {
  // Skip for certain methods and paths
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  if (req.path.startsWith('/api/auth') || req.path.startsWith('/api/health')) {
    return next();
  }

  // In production, validate CSRF token
  if (config.env === 'production') {
    const csrfToken = req.headers['x-csrf-token'] || req.body._csrf;
    const sessionToken = req.session?.csrfToken;
    
    if (!csrfToken || csrfToken !== sessionToken) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid CSRF token',
        code: 'INVALID_CSRF_TOKEN'
      });
    }
  }

  next();
};

/**
 * Input validation middleware
 * Validates and sanitizes request input
 */
const inputValidation = (req, res, next) => {
  // Validate query parameters
  if (req.query) {
    for (const [key, value] of Object.entries(req.query)) {
      // Basic sanitization
      if (typeof value === 'string') {
        req.query[key] = value.trim();
      }
    }
  }

  // Validate body
  if (req.body) {
    for (const [key, value] of Object.entries(req.body)) {
      // Basic sanitization
      if (typeof value === 'string') {
        req.body[key] = value.trim();
      }
    }
  }

  next();
};

/**
 * Rate limiting middleware for specific routes
 */
const createRateLimiter = (options = {}) => {
  const { windowMs = 900000, max = 100, message = 'Too many requests' } = options;
  
  const rateLimiter = rateLimit({
    windowMs,
    max,
    message: {
      error: 'Rate Limit Exceeded',
      message,
      code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false
  });

  return rateLimiter;
};

/**
 * IP filtering middleware
 * Blocks requests from known malicious IPs
 */
const ipFilter = (req, res, next) => {
  // In production, check against a blocklist
  const blockedIPs = []; // Load from database or config
  const clientIP = req.ip || req.connection.remoteAddress;

  if (blockedIPs.includes(clientIP)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Access denied',
      code: 'IP_BLOCKED'
    });
  }

  next();
};

/**
 * SSL enforcement middleware
 * Redirects HTTP to HTTPS in production
 */
const enforceSSL = (req, res, next) => {
  if (config.env === 'production' && !req.secure) {
    const httpsUrl = `https://${req.headers.host}${req.url}`;
    return res.redirect(301, httpsUrl);
  }
  next();
};

module.exports = {
  securityMiddleware,
  csrfProtection,
  inputValidation,
  createRateLimiter,
  ipFilter,
  enforceSSL,
  contentSecurityPolicy,
  hsts,
  xContentTypeOptions,
  xFrameOptions,
  xssFilter,
  referrerPolicy,
  permissionsPolicy
};
