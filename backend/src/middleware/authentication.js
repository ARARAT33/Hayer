/**
 * Authentication middleware for HAYER backend
 * Handles JWT verification, session validation, and role-based access control
 */

const jwt = require('jsonwebtoken');
const config = require('../config');
const { User, Session, Credential, HayerId } = require('../models');
const { AuthenticationError, AuthorizationError, NotFoundError } = require('./errorHandler');
const crypto = require('crypto');

/**
 * Generate JWT token
 */
const generateToken = (payload, expiresIn = config.jwt.expiresIn) => {
  return jwt.sign(payload, config.jwt.secret, { expiresIn });
};

/**
 * Generate refresh token
 */
const generateRefreshToken = (payload) => {
  return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.refreshExpiresIn });
};

/**
 * Verify JWT token
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (error) {
    throw new AuthenticationError(error.message);
  }
};

/**
 * Decode JWT token without verification
 */
const decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch (error) {
    return null;
  }
};

/**
 * Extract token from request
 */
const extractToken = (req) => {
  // Check Authorization header
  const authHeader = req.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Check cookies
  if (req.cookies && req.cookies[config.session.cookieName]) {
    return req.cookies[config.session.cookieName];
  }

  // Check body
  if (req.body && req.body.token) {
    return req.body.token;
  }

  // Check query parameters
  if (req.query && req.query.token) {
    return req.query.token;
  }

  return null;
};

/**
 * JWT authentication middleware
 */
const jwtAuth = (options = {}) => {
  const { requireUser = true, requireVerified = false } = options;

  return async (req, res, next) => {
    try {
      const token = extractToken(req);
      
      if (!token) {
        throw new AuthenticationError('Authentication token required', {}, 'TOKEN_REQUIRED');
      }

      // Verify token
      const decoded = verifyToken(token);
      
      // Find user
      const user = await User.findByPk(decoded.id, {
        include: [
          { model: HayerId, where: { isPrimary: true } },
          { model: Session, where: { token }, required: false }
        ]
      });

      if (!user) {
        throw new AuthenticationError('User not found', {}, 'USER_NOT_FOUND');
      }

      // Check if user is active
      if (!user.isActive) {
        throw new AuthenticationError('Account is deactivated', {}, 'ACCOUNT_DEACTIVATED');
      }

      // Check if user is verified (if required)
      if (requireVerified && !user.isVerified) {
        throw new AuthenticationError('Account verification required', {}, 'ACCOUNT_UNVERIFIED');
      }

      // Check if token is expired
      if (decoded.exp * 1000 < Date.now()) {
        throw new AuthenticationError('Token expired', {}, 'TOKEN_EXPIRED');
      }

      // Check if session is valid
      const session = await Session.findOne({ where: { token } });
      if (session && !session.isActive) {
        throw new AuthenticationError('Session expired', {}, 'SESSION_EXPIRED');
      }

      // Attach user and decoded token to request
      req.user = user;
      req.token = token;
      req.decoded = decoded;
      req.session = session;

      // Generate new token if it's about to expire (within 5 minutes)
      const tokenExpiry = decoded.exp * 1000;
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;
      
      if (tokenExpiry - now < fiveMinutes) {
        const newToken = generateToken({ id: user.id, email: user.email });
        res.setHeader('X-New-Token', newToken);
        
        // Update session token
        if (session) {
          await session.update({ token: newToken });
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Session-based authentication middleware
 */
const sessionAuth = async (req, res, next) => {
  try {
    const sessionToken = req.cookies?.[config.session.cookieName];
    
    if (!sessionToken) {
      throw new AuthenticationError('Session required', {}, 'SESSION_REQUIRED');
    }

    // Find session
    const session = await Session.findOne({
      where: { token: sessionToken, isActive: true },
      include: [{ model: User }]
    });

    if (!session) {
      throw new AuthenticationError('Invalid session', {}, 'INVALID_SESSION');
    }

    // Check if session has expired
    if (session.expiresAt && session.expiresAt < new Date()) {
      throw new AuthenticationError('Session expired', {}, 'SESSION_EXPIRED');
    }

    // Check if user is active
    if (!session.User.isActive) {
      throw new AuthenticationError('Account is deactivated', {}, 'ACCOUNT_DEACTIVATED');
    }

    // Attach user and session to request
    req.user = session.User;
    req.session = session;

    // Update last activity
    await session.update({ lastActivityAt: new Date() });

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Optional authentication middleware
 * Attaches user if authenticated, but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);
    
    if (token) {
      try {
        const decoded = verifyToken(token);
        const user = await User.findByPk(decoded.id, {
          include: [{ model: HayerId, where: { isPrimary: true } }]
        });

        if (user && user.isActive) {
          req.user = user;
          req.token = token;
          req.decoded = decoded;
        }
      } catch (error) {
        // Token is invalid, but we don't fail
        console.error('Invalid token:', error.message);
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Role-based access control middleware
 */
const checkPermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AuthorizationError('Authentication required', {}, 'AUTHENTICATION_REQUIRED');
      }

      // Check if user has the required permission
      const hasPermission = await checkUserPermission(req.user.id, requiredPermission);
      
      if (!hasPermission) {
        throw new AuthorizationError('Insufficient permissions', {}, 'INSUFFICIENT_PERMISSIONS');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Check if user has specific permission
 */
const checkUserPermission = async (userId, requiredPermission) => {
  const user = await User.findByPk(userId, {
    include: [
      {
        model: Role,
        include: [
          {
            model: Permission,
            where: { name: requiredPermission }
          }
        ]
      }
    ]
  });

  if (!user) {
    return false;
  }

  // Check user permissions
  for (const role of user.Roles) {
    for (const permission of role.Permissions) {
      if (permission.name === requiredPermission) {
        return true;
      }
    }
  }

  return false;
};

/**
 * Role-based access control middleware
 */
const checkRole = (requiredRoles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AuthorizationError('Authentication required', {}, 'AUTHENTICATION_REQUIRED');
      }

      // Check if user has any of the required roles
      const hasRole = await checkUserRole(req.user.id, requiredRoles);
      
      if (!hasRole) {
        throw new AuthorizationError('Insufficient role privileges', {}, 'INSUFFICIENT_ROLE');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Check if user has specific role
 */
const checkUserRole = async (userId, requiredRoles) => {
  if (!Array.isArray(requiredRoles)) {
    requiredRoles = [requiredRoles];
  }

  const user = await User.findByPk(userId, {
    include: [{ model: Role }]
  });

  if (!user) {
    return false;
  }

  // Check user roles
  for (const role of user.Roles) {
    if (requiredRoles.includes(role.name)) {
      return true;
    }
  }

  return false;
};

/**
 * Check if user is admin
 */
const isAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AuthorizationError('Authentication required', {}, 'AUTHENTICATION_REQUIRED');
    }

    const hasAdminRole = await checkUserRole(req.user.id, ['admin', 'super_admin']);
    
    if (!hasAdminRole) {
      throw new AuthorizationError('Admin privileges required', {}, 'ADMIN_REQUIRED');
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Check if user owns the resource
 */
const checkOwnership = (resourceModel, resourceIdParam = 'id') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AuthorizationError('Authentication required', {}, 'AUTHENTICATION_REQUIRED');
      }

      const resourceId = req.params[resourceIdParam];
      if (!resourceId) {
        throw new BadRequestError('Resource ID required');
      }

      // Find resource
      const resource = await resourceModel.findByPk(resourceId);
      
      if (!resource) {
        throw new NotFoundError('Resource not found');
      }

      // Check ownership
      const ownerField = resourceModel.getAttributes().ownerId ? 'ownerId' : 'userId';
      
      if (resource[ownerField] !== req.user.id) {
        throw new AuthorizationError('Resource access denied', {}, 'RESOURCE_ACCESS_DENIED');
      }

      req.resource = resource;
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Generate session token
 */
const generateSessionToken = () => {
  return crypto.randomBytes(64).toString('hex');
};

/**
 * Hash password
 */
const hashPassword = async (password) => {
  // In production, use argon2id
  // For now, use bcrypt as a fallback
  const bcrypt = require('bcryptjs');
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
};

/**
 * Verify password
 */
const verifyPassword = async (password, hash) => {
  const bcrypt = require('bcryptjs');
  return bcrypt.compare(password, hash);
};

/**
 * Create session
 */
const createSession = async (user, req, options = {}) => {
  const { rememberMe = false, deviceInfo = {} } = options;

  const token = generateSessionToken();
  const refreshToken = generateSessionToken();
  const expiresAt = rememberMe 
    ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    : new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Extract device information
  const ipAddress = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || '';

  // Parse user agent
  const device = parseUserAgent(userAgent);

  const session = await Session.create({
    userId: user.id,
    token,
    refreshToken,
    ipAddress,
    userAgent,
    deviceId: deviceInfo.deviceId || crypto.randomBytes(16).toString('hex'),
    deviceName: deviceInfo.deviceName || device.name,
    deviceType: deviceInfo.deviceType || device.type,
    os: deviceInfo.os || device.os,
    osVersion: deviceInfo.osVersion || device.osVersion,
    browser: deviceInfo.browser || device.browser,
    browserVersion: deviceInfo.browserVersion || device.browserVersion,
    expiresAt,
    lastActivityAt: new Date()
  });

  return {
    session,
    token,
    refreshToken,
    expiresAt
  };
};

/**
 * Parse user agent string
 */
const parseUserAgent = (userAgent) => {
  const result = {
    browser: 'Unknown',
    browserVersion: null,
    os: 'Unknown',
    osVersion: null,
    type: 'desktop',
    name: null
  };

  if (!userAgent) return result;

  try {
    const ua = userAgent.toLowerCase();

    // Browser detection
    if (ua.includes('chrome')) {
      result.browser = 'Chrome';
      const versionMatch = userAgent.match(/chrome\/([\d.]+)/i);
      if (versionMatch) result.browserVersion = versionMatch[1];
    } else if (ua.includes('firefox')) {
      result.browser = 'Firefox';
      const versionMatch = userAgent.match(/firefox\/([\d.]+)/i);
      if (versionMatch) result.browserVersion = versionMatch[1];
    } else if (ua.includes('safari')) {
      result.browser = 'Safari';
      const versionMatch = userAgent.match(/version\/([\d.]+)/i);
      if (versionMatch) result.browserVersion = versionMatch[1];
    } else if (ua.includes('edge')) {
      result.browser = 'Edge';
      const versionMatch = userAgent.match(/edge\/([\d.]+)/i);
      if (versionMatch) result.browserVersion = versionMatch[1];
    } else if (ua.includes('opera')) {
      result.browser = 'Opera';
      const versionMatch = userAgent.match(/opera\/([\d.]+)/i);
      if (versionMatch) result.browserVersion = versionMatch[1];
    }

    // OS detection
    if (ua.includes('windows')) {
      result.os = 'Windows';
      const versionMatch = userAgent.match(/windows nt (\d+\.\d+)/i);
      if (versionMatch) result.osVersion = versionMatch[1];
    } else if (ua.includes('mac os x') || ua.includes('macintosh')) {
      result.os = 'macOS';
      const versionMatch = userAgent.match(/mac os x (\d+[._]\d+)/i);
      if (versionMatch) result.osVersion = versionMatch[1].replace('_', '.');
    } else if (ua.includes('linux')) {
      result.os = 'Linux';
    } else if (ua.includes('android')) {
      result.os = 'Android';
      result.type = 'mobile';
      const versionMatch = userAgent.match(/android (\d+\.\d+)/i);
      if (versionMatch) result.osVersion = versionMatch[1];
    } else if (ua.includes('iphone') || ua.includes('ipad')) {
      result.os = 'iOS';
      result.type = 'mobile';
      const versionMatch = userAgent.match(/os (\d+[._]\d+)/i);
      if (versionMatch) result.osVersion = versionMatch[1].replace('_', '.');
    }

    // Device type
    if (ua.includes('mobile')) {
      result.type = 'mobile';
    } else if (ua.includes('tablet')) {
      result.type = 'tablet';
    }

    // Device name
    if (ua.includes('iphone')) {
      result.name = 'iPhone';
    } else if (ua.includes('ipad')) {
      result.name = 'iPad';
    } else if (ua.includes('android')) {
      result.name = 'Android Device';
    }

  } catch (error) {
    // Ignore parsing errors
  }

  return result;
};

/**
 * Invalidate session
 */
const invalidateSession = async (sessionId) => {
  const session = await Session.findByPk(sessionId);
  if (session) {
    await session.update({ isActive: false, expiresAt: new Date() });
  }
  return session;
};

/**
 * Invalidate all user sessions except current one
 */
const invalidateOtherSessions = async (userId, currentSessionId) => {
  await Session.update(
    { isActive: false, expiresAt: new Date() },
    { where: { userId, id: { [Op.ne]: currentSessionId } } }
  );
};

/**
 * Invalidate all user sessions
 */
const invalidateAllSessions = async (userId) => {
  await Session.update(
    { isActive: false, expiresAt: new Date() },
    { where: { userId } }
  );
};

module.exports = {
  generateToken,
  generateRefreshToken,
  verifyToken,
  decodeToken,
  extractToken,
  jwtAuth,
  sessionAuth,
  optionalAuth,
  checkPermission,
  checkUserPermission,
  checkRole,
  checkUserRole,
  isAdmin,
  checkOwnership,
  generateSessionToken,
  hashPassword,
  verifyPassword,
  createSession,
  parseUserAgent,
  invalidateSession,
  invalidateOtherSessions,
  invalidateAllSessions,
  AppError: require('./errorHandler').AppError,
  AuthenticationError,
  AuthorizationError
};
