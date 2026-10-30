/**
 * Authentication Service for HAYER backend
 * Provides business logic for authentication, authorization, and session management
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const config = require('../config');
const { User, Session, Credential, HayerId, Passkey, TOTP, AuditEvent } = require('../models');
const { 
  AuthenticationError, 
  AuthorizationError,
  ValidationError,
  NotFoundError,
  ConflictError,
  BadRequestError
} = require('../middleware/errorHandler');
const { hashPassword, verifyPassword, generateToken, generateRefreshToken } = require('../middleware/authentication');
const { isValidEmail, isValidUsername, isValidPassword } = require('../utils/validation');
const speakeasy = require('speakeasy');
const base32 = require('thirty-two');

/**
 * Generate unique HAYER ID
 */
const generateHayerId = async () => {
  let hayerId;
  let exists;
  
  do {
    const length = Math.floor(Math.random() * 9) + 8;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    hayerId = Array.from({ length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
    exists = await HayerId.findOne({ where: { hayerId } });
  } while (exists);
  
  return hayerId;
};

/**
 * Create HAYER ID for user
 */
const createHayerId = async (userId) => {
  const hayerId = await generateHayerId();
  return await HayerId.create({ userId, hayerId, isPrimary: true });
};

/**
 * Register new user
 */
const registerUser = async (data, req) => {
  const { email, username, password, displayName, language = 'hy' } = data;
  
  // Validate input
  if (!email || !username || !password) {
    throw new ValidationError('Email, username, and password are required');
  }
  
  if (!isValidEmail(email)) {
    throw new ValidationError('Invalid email format');
  }
  
  if (!isValidUsername(username)) {
    throw new ValidationError('Username must be 3-80 alphanumeric characters');
  }
  
  if (!isValidPassword(password, { minLength: 8 })) {
    throw new ValidationError('Password must be at least 8 characters long');
  }
  
  // Check if email already exists
  const existingEmail = await User.findOne({ where: { email: email.toLowerCase() } });
  if (existingEmail) {
    throw new ConflictError('Email already registered', { field: 'email' });
  }
  
  // Check if username already exists
  const existingUsername = await User.findOne({ where: { username: username.toLowerCase() } });
  if (existingUsername) {
    throw new ConflictError('Username already taken', { field: 'username' });
  }
  
  // Create user
  const user = await User.create({
    email: email.toLowerCase(),
    username: username.toLowerCase(),
    displayName: displayName || username,
    passwordHash: await hashPassword(password),
    passwordAlgorithm: 'bcrypt',
    isActive: true,
    isVerified: false,
    preferences: { language }
  });
  
  // Create HAYER ID
  await createHayerId(user.id);
  
  // Create verification token
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  
  await user.update({ verificationToken, verificationTokenExpiresAt });
  
  // Log registration
  await AuditEvent.create({
    userId: user.id,
    action: 'register',
    category: 'authentication',
    resource: 'user',
    resourceId: user.id,
    description: `User ${username} registered`,
    status: 'success',
    severity: 'info',
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.id
  });
  
  return user;
};

/**
 * Login user
 */
const loginUser = async (data, req) => {
  const { email, username, password, rememberMe = false } = data;
  
  // Validate input
  if ((!email && !username) || !password) {
    throw new ValidationError('Email or username and password are required');
  }
  
  // Find user
  const user = await User.findOne({
    where: {
      [Op.or]: [
        { email: email?.toLowerCase() },
        { username: (username || email)?.toLowerCase() }
      ]
    },
    include: [
      { model: HayerId, where: { isPrimary: true } },
      { model: TOTP, where: { isActive: true, isDefault: true } },
      { model: Session, where: { isActive: true }, required: false }
    ]
  });
  
  if (!user) {
    // Log failed attempt
    await AuditEvent.create({
      action: 'login',
      category: 'authentication',
      resource: 'user',
      description: 'Failed login attempt',
      status: 'failure',
      severity: 'warning',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: req.id,
      details: { attemptedIdentifier: email || username, reason: 'user_not_found' }
    });
    
    throw new AuthenticationError('Invalid credentials', {}, 'INVALID_CREDENTIALS');
  }
  
  // Check if user is active
  if (!user.isActive) {
    throw new AuthenticationError('Account is deactivated', {}, 'ACCOUNT_DEACTIVATED');
  }
  
  // Check if account is locked
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AuthenticationError('Account is temporarily locked. Please try again later.', {}, 'ACCOUNT_LOCKED');
  }
  
  // Check password
  const isPasswordValid = await verifyPassword(password, user.passwordHash);
  
  if (!isPasswordValid) {
    // Increment failed login attempts
    await user.increment('failedLoginAttempts');
    
    // Lock account after 5 failed attempts
    if (user.failedLoginAttempts >= 5) {
      const lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      await user.update({ lockedUntil });
    }
    
    // Log failed attempt
    await AuditEvent.create({
      userId: user.id,
      action: 'login',
      category: 'authentication',
      resource: 'user',
      resourceId: user.id,
      description: `Failed login attempt for user ${user.username}`,
      status: 'failure',
      severity: 'warning',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: req.id,
      details: { reason: 'invalid_password', failedAttempts: user.failedLoginAttempts + 1 }
    });
    
    throw new AuthenticationError('Invalid credentials', {}, 'INVALID_CREDENTIALS');
  }
  
  // Reset failed login attempts
  await user.update({
    failedLoginAttempts: 0,
    lastLoginAt: new Date(),
    loginCount: user.loginCount + 1
  });
  
  // Check if TOTP is required
  if (user.TOTPs && user.TOTPs.length > 0 && user.TOTPs[0].isActive) {
    const tempToken = generateToken({ id: user.id, email: user.email, temp: true }, '5m');
    return { requiresTOTP: true, tempToken, userId: user.id };
  }
  
  // Generate tokens
  const token = generateToken({ id: user.id, email: user.email });
  const refreshToken = generateRefreshToken({ id: user.id, email: user.email });
  
  // Create session
  const session = await createSession(user, req, { rememberMe });
  
  // Log successful login
  await AuditEvent.create({
    userId: user.id,
    action: 'login',
    category: 'authentication',
    resource: 'user',
    resourceId: user.id,
    description: `User ${user.username} logged in`,
    status: 'success',
    severity: 'info',
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.id,
    details: { method: 'password', rememberMe, sessionId: session.id }
  });
  
  return {
    user,
    token,
    refreshToken,
    session,
    hayerId: user.HayerIds && user.HayerIds.length > 0 ? user.HayerIds[0].hayerId : null
  };
};

/**
 * Create session
 */
const createSession = async (user, req, options = {}) => {
  const { rememberMe = false, deviceInfo = {} } = options;
  const token = crypto.randomBytes(64).toString('hex');
  const refreshToken = crypto.randomBytes(64).toString('hex');
  const expiresAt = rememberMe 
    ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    : new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  
  const ipAddress = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || '';
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
  
  return { session, token, refreshToken, expiresAt };
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
    }
    
    if (ua.includes('windows')) {
      result.os = 'Windows';
      const versionMatch = userAgent.match(/windows nt (\d+\.\d+)/i);
      if (versionMatch) result.osVersion = versionMatch[1];
    } else if (ua.includes('mac os x')) {
      result.os = 'macOS';
      const versionMatch = userAgent.match(/mac os x (\d+[._]\d+)/i);
      if (versionMatch) result.osVersion = versionMatch[1].replace('_', '.');
    } else if (ua.includes('linux')) {
      result.os = 'Linux';
    } else if (ua.includes('android')) {
      result.os = 'Android';
      result.type = 'mobile';
    } else if (ua.includes('iphone') || ua.includes('ipad')) {
      result.os = 'iOS';
      result.type = 'mobile';
    }
    
    if (ua.includes('mobile')) result.type = 'mobile';
    else if (ua.includes('tablet')) result.type = 'tablet';
    
    if (ua.includes('iphone')) result.name = 'iPhone';
    else if (ua.includes('ipad')) result.name = 'iPad';
    else if (ua.includes('android')) result.name = 'Android Device';
  } catch (error) {
    // Ignore parsing errors
  }
  
  return result;
};

/**
 * Refresh token
 */
const refreshAccessToken = async (refreshToken, req) => {
  const session = await Session.findOne({
    where: { refreshToken, isActive: true },
    include: [{ model: User }]
  });
  
  if (!session) {
    throw new AuthenticationError('Invalid refresh token', {}, 'INVALID_REFRESH_TOKEN');
  }
  
  if (session.expiresAt && session.expiresAt < new Date()) {
    throw new AuthenticationError('Refresh token expired', {}, 'REFRESH_TOKEN_EXPIRED');
  }
  
  if (!session.User.isActive) {
    throw new AuthenticationError('Account is deactivated', {}, 'ACCOUNT_DEACTIVATED');
  }
  
  const newToken = generateToken({ id: session.User.id, email: session.User.email });
  const newRefreshToken = generateRefreshToken({ id: session.User.id, email: session.User.email });
  
  await session.update({
    token: newToken,
    refreshToken: newRefreshToken,
    lastActivityAt: new Date()
  });
  
  await AuditEvent.create({
    userId: session.User.id,
    action: 'refresh_token',
    category: 'authentication',
    resource: 'session',
    resourceId: session.id,
    description: `Token refreshed for user ${session.User.username}`,
    status: 'success',
    severity: 'info',
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.id
  });
  
  return { token: newToken, refreshToken: newRefreshToken };
};

/**
 * Logout user
 */
const logoutUser = async (user, session, req) => {
  if (session) {
    await session.update({ isActive: false, expiresAt: new Date() });
  }
  
  await AuditEvent.create({
    userId: user.id,
    action: 'logout',
    category: 'authentication',
    resource: 'session',
    resourceId: session?.id,
    description: `User ${user.username} logged out`,
    status: 'success',
    severity: 'info',
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.id
  });
};

/**
 * Logout all sessions
 */
const logoutAllSessions = async (user, req) => {
  await Session.update(
    { isActive: false, expiresAt: new Date() },
    { where: { userId: user.id } }
  );
  
  await AuditEvent.create({
    userId: user.id,
    action: 'logout_all',
    category: 'authentication',
    resource: 'sessions',
    description: `User ${user.username} logged out from all sessions`,
    status: 'success',
    severity: 'info',
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.id
  });
};

/**
 * Change password
 */
const changePassword = async (user, currentPassword, newPassword, req) => {
  const isCurrentPasswordValid = await verifyPassword(currentPassword, user.passwordHash);
  
  if (!isCurrentPasswordValid) {
    throw new AuthenticationError('Current password is incorrect', {}, 'INVALID_CURRENT_PASSWORD');
  }
  
  if (!isValidPassword(newPassword, { minLength: 8 })) {
    throw new ValidationError('New password must be at least 8 characters long');
  }
  
  await user.update({
    passwordHash: await hashPassword(newPassword),
    passwordAlgorithm: 'bcrypt'
  });
  
  // Invalidate all sessions except current one
  const currentSession = req.session;
  if (currentSession) {
    await Session.update(
      { isActive: false, expiresAt: new Date() },
      { where: { userId: user.id, id: { [Op.ne]: currentSession.id } } }
    );
  }
  
  await AuditEvent.create({
    userId: user.id,
    action: 'change_password',
    category: 'authentication',
    resource: 'user',
    resourceId: user.id,
    description: `Password changed for user ${user.username}`,
    status: 'success',
    severity: 'info',
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.id
  });
};

/**
 * Request password reset
 */
const requestPasswordReset = async (email, req) => {
  const user = await User.findOne({ where: { email: email.toLowerCase() } });
  
  if (!user) {
    // Don't reveal that user doesn't exist
    await AuditEvent.create({
      action: 'request_password_reset',
      category: 'authentication',
      resource: 'user',
      description: 'Password reset requested for non-existent email',
      status: 'success',
      severity: 'info',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: req.id,
      details: { email: email.toLowerCase() }
    });
    return { success: true };
  }
  
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  
  await user.update({ resetToken, resetTokenExpiresAt });
  
  await AuditEvent.create({
    userId: user.id,
    action: 'request_password_reset',
    category: 'authentication',
    resource: 'user',
    resourceId: user.id,
    description: `Password reset requested for user ${user.username}`,
    status: 'success',
    severity: 'info',
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.id
  });
  
  return { success: true };
};

/**
 * Verify password reset token
 */
const verifyPasswordResetToken = async (token) => {
  const user = await User.findOne({
    where: {
      resetToken: token,
      resetTokenExpiresAt: { [Op.gt]: new Date() }
    }
  });
  
  if (!user) {
    throw new AuthenticationError('Invalid or expired reset token', {}, 'INVALID_RESET_TOKEN');
  }
  
  return user;
};

/**
 * Reset password
 */
const resetPassword = async (token, newPassword, req) => {
  const user = await verifyPasswordResetToken(token);
  
  if (!isValidPassword(newPassword, { minLength: 8 })) {
    throw new ValidationError('New password must be at least 8 characters long');
  }
  
  await user.update({
    passwordHash: await hashPassword(newPassword),
    resetToken: null,
    resetTokenExpiresAt: null
  });
  
  // Invalidate all sessions
  await Session.update(
    { isActive: false, expiresAt: new Date() },
    { where: { userId: user.id } }
  );
  
  await AuditEvent.create({
    userId: user.id,
    action: 'reset_password',
    category: 'authentication',
    resource: 'user',
    resourceId: user.id,
    description: `Password reset for user ${user.username}`,
    status: 'success',
    severity: 'info',
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.id
  });
  
  return user;
};

/**
 * Request email verification
 */
const requestEmailVerification = async (user, req) => {
  if (user.isVerified) {
    return { success: true, alreadyVerified: true };
  }
  
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  
  await user.update({ verificationToken, verificationTokenExpiresAt });
  
  await AuditEvent.create({
    userId: user.id,
    action: 'request_email_verification',
    category: 'authentication',
    resource: 'user',
    resourceId: user.id,
    description: `Email verification requested for user ${user.username}`,
    status: 'success',
    severity: 'info',
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.id
  });
  
  return { success: true };
};

/**
 * Verify email
 */
const verifyEmail = async (token, req) => {
  const user = await User.findOne({
    where: {
      verificationToken: token,
      verificationTokenExpiresAt: { [Op.gt]: new Date() }
    }
  });
  
  if (!user) {
    throw new AuthenticationError('Invalid or expired verification token', {}, 'INVALID_VERIFICATION_TOKEN');
  }
  
  await user.update({
    isVerified: true,
    verificationToken: null,
    verificationTokenExpiresAt: null
  });
  
  await AuditEvent.create({
    userId: user.id,
    action: 'verify_email',
    category: 'authentication',
    resource: 'user',
    resourceId: user.id,
    description: `Email verified for user ${user.username}`,
    status: 'success',
    severity: 'info',
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.id
  });
  
  return user;
};

/**
 * Get current user
 */
const getCurrentUser = async (user) => {
  const userWithData = await User.findByPk(user.id, {
    include: [
      { model: HayerId, where: { isPrimary: true } },
      { model: Profile }
    ]
  });
  
  return userWithData;
};

/**
 * List sessions
 */
const listSessions = async (user) => {
  const sessions = await Session.findAll({
    where: { userId: user.id },
    order: [['lastActivityAt', 'DESC']]
  });
  
  return sessions;
};

/**
 * Revoke session
 */
const revokeSession = async (user, sessionId, currentSessionId) => {
  const session = await Session.findOne({
    where: { id: sessionId, userId: user.id }
  });
  
  if (!session) {
    throw new NotFoundError('Session not found');
  }
  
  if (session.id === currentSessionId) {
    throw new BadRequestError('Cannot revoke current session');
  }
  
  await session.update({ isActive: false, expiresAt: new Date() });
  
  return session;
};

/**
 * Revoke other sessions
 */
const revokeOtherSessions = async (user, currentSessionId) => {
  await Session.update(
    { isActive: false, expiresAt: new Date() },
    { where: { userId: user.id, id: { [Op.ne]: currentSessionId } } }
  );
};

/**
 * Get authentication settings
 */
const getAuthSettings = async (user) => {
  const passkeyCount = await Passkey.count({ where: { userId: user.id, isActive: true } });
  const totpCount = await TOTP.count({ where: { userId: user.id, isActive: true } });
  const backupCodesCount = await TOTP.count({
    where: { 
      userId: user.id, 
      isActive: true,
      backupCodes: { [Op.ne]: null },
      backupCodes: { [Op.not]: [] }
    }
  });
  
  return {
    hasPasskeys: passkeyCount > 0,
    hasTOTP: totpCount > 0,
    hasBackupCodes: backupCodesCount > 0,
    mfaEnabled: user.preferences?.auth?.mfaEnabled || false,
    defaultAuthMethod: user.preferences?.auth?.defaultAuthMethod || 'password'
  };
};

// ============================================================================
// PASSKEY / WEB AUTHN METHODS
// ============================================================================

/**
 * Generate passkey registration options
 */
const passkeyRegistrationOptions = async (user, req) => {
  const { generateRegistrationOptions } = require('webauthn');
  
  const options = await generateRegistrationOptions({
    rpName: config.app.name || 'HAYER',
    rpID: config.auth.passkey.rpId || (config.env === 'production' ? 'hayer.am' : 'localhost'),
    userID: user.id,
    userName: user.email || user.username,
    userDisplayName: user.displayName || user.username,
    attestationType: 'none',
    authenticatorSelection: {
      userVerification: 'preferred',
      residentKey: 'required'
    },
    supportedAlgorithmIDs: [-7, -257] // ES256, RS256
  });
  
  // Store challenge for verification
  const challenge = crypto.randomBytes(32).toString('base64');
  await user.update({
    passkeyChallenge: challenge,
    passkeyChallengeExpires: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
  });
  
  // Replace challenge in options with our stored one
  options.challenge = Buffer.from(challenge, 'base64');
  
  await AuditEvent.create({
    userId: user.id,
    action: 'passkey.registration_started',
    category: 'authentication',
    resource: 'passkey',
    description: `Passkey registration started for user ${user.username}`,
    status: 'success',
    severity: 'info',
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.id
  });
  
  return {
    options: {
      ...options,
      challenge: challenge // Return as base64 string
    },
    userId: user.id
  };
};

/**
 * Verify passkey registration
 */
const verifyPasskeyRegistration = async (user, data, req) => {
  const { verifyRegistrationResponse } = require('webauthn');
  
  const { 
    attestationResponse, 
    clientExtensionResults,
    id,
    rawId,
    type
  } = data;
  
  // Get stored challenge
  if (!user.passkeyChallenge) {
    throw new AuthenticationError('No pending passkey registration', {}, 'NO_PENDING_REGISTRATION');
  }
  
  if (user.passkeyChallengeExpires && user.passkeyChallengeExpires < new Date()) {
    throw new AuthenticationError('Passkey registration expired', {}, 'REGISTRATION_EXPIRED');
  }
  
  const expectedChallenge = user.passkeyChallenge;
  
  // Clear challenge
  await user.update({
    passkeyChallenge: null,
    passkeyChallengeExpires: null
  });
  
  try {
    const verification = await verifyRegistrationResponse({
      response: attestationResponse,
      expectedChallenge: expectedChallenge,
      expectedOrigin: config.auth.passkey.origin || (config.env === 'production' ? 'https://hayer.am' : 'http://localhost:3000'),
      expectedRPID: config.auth.passkey.rpId || (config.env === 'production' ? 'hayer.am' : 'localhost'),
      requireUserVerification: false
    });
    
    const { 
      verified,
      registrationInfo
    } = verification;
    
    if (!verified) {
      throw new AuthenticationError('Passkey verification failed', {}, 'VERIFICATION_FAILED');
    }
    
    // Save passkey
    const passkey = await Passkey.create({
      userId: user.id,
      credentialId: Buffer.from(registrationInfo.credentialID).toString('base64'),
      publicKey: Buffer.from(registrationInfo.publicKey).toString('base64'),
      counter: registrationInfo.counter,
      deviceType: registrationInfo.deviceType || 'platform',
      deviceName: clientExtensionResults?.deviceName || 'Unknown Device',
      deviceInfo: {
        ...clientExtensionResults,
        attestationType: registrationInfo.attestationType
      },
      isDefault: false,
      isActive: true
    });
    
    // If this is the first passkey, set as default
    const passkeyCount = await Passkey.count({ where: { userId: user.id } });
    if (passkeyCount === 1) {
      await passkey.update({ isDefault: true });
    }
    
    await AuditEvent.create({
      userId: user.id,
      action: 'passkey.registration_completed',
      category: 'authentication',
      resource: 'passkey',
      resourceId: passkey.id,
      description: `Passkey registered for user ${user.username}`,
      status: 'success',
      severity: 'info',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: req.id,
      details: { credentialId: passkey.credentialId }
    });
    
    return passkey;
  } catch (error) {
    console.error('Passkey verification error:', error);
    throw new AuthenticationError('Passkey registration failed', error, 'PASSKEY_REGISTRATION_FAILED');
  }
};

/**
 * Generate passkey login options
 */
const passkeyLoginOptions = async (emailOrUsername, req) => {
  const { generateAuthenticationOptions } = require('webauthn');
  
  // Find user
  const user = await User.findOne({
    where: {
      [Op.or]: [
        { email: emailOrUsername?.toLowerCase() },
        { username: emailOrUsername?.toLowerCase() }
      ]
    },
    include: [
      { model: Passkey, where: { isActive: true } }
    ]
  });
  
  if (!user) {
    // Don't reveal that user doesn't exist
    await AuditEvent.create({
      action: 'passkey.login_attempt',
      category: 'authentication',
      resource: 'passkey',
      description: 'Passkey login attempt for non-existent user',
      status: 'failure',
      severity: 'warning',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: req.id
    });
    
    // Return dummy options to prevent enumeration
    return {
      options: {
        challenge: Buffer.from(crypto.randomBytes(32)).toString('base64'),
        rpId: config.auth.passkey.rpId || (config.env === 'production' ? 'hayer.am' : 'localhost'),
        allowCredentials: [],
        timeout: 60000
      },
      userId: null
    };
  }
  
  if (!user.isActive) {
    throw new AuthenticationError('Account is deactivated', {}, 'ACCOUNT_DEACTIVATED');
  }
  
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AuthenticationError('Account is temporarily locked', {}, 'ACCOUNT_LOCKED');
  }
  
  // Generate challenge
  const challenge = crypto.randomBytes(32).toString('base64');
  await user.update({
    passkeyChallenge: challenge,
    passkeyChallengeExpires: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
  });
  
  // Get user's passkeys
  const passkeys = await Passkey.findAll({
    where: { userId: user.id, isActive: true }
  });
  
  const allowCredentials = passkeys.map(pk => ({
    id: Buffer.from(pk.credentialId, 'base64'),
    type: 'public-key',
    transports: ['internal', 'hybrid', 'usb', 'ble', 'nfc']
  }));
  
  const options = await generateAuthenticationOptions({
    allowCredentials,
    userVerification: 'preferred'
  });
  
  // Replace challenge
  options.challenge = Buffer.from(challenge, 'base64');
  
  await AuditEvent.create({
    userId: user.id,
    action: 'passkey.login_started',
    category: 'authentication',
    resource: 'passkey',
    description: `Passkey login started for user ${user.username}`,
    status: 'success',
    severity: 'info',
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.id,
    details: { passkeyCount: passkeys.length }
  });
  
  return {
    options: {
      ...options,
      challenge: challenge
    },
    userId: user.id
  };
};

/**
 * Verify passkey login
 */
const verifyPasskeyLogin = async (data, req) => {
  const { verifyAuthenticationResponse } = require('webauthn');
  
  const { 
    assertionResponse,
    id,
    rawId,
    type
  } = data;
  
  // Find user by credential ID
  const credentialId = Buffer.from(id, 'base64').toString('base64');
  const passkey = await Passkey.findOne({
    where: { credentialId }
  });
  
  if (!passkey) {
    await AuditEvent.create({
      action: 'passkey.login_attempt',
      category: 'authentication',
      resource: 'passkey',
      description: 'Passkey login attempt with unknown credential',
      status: 'failure',
      severity: 'warning',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: req.id
    });
    
    throw new AuthenticationError('Invalid passkey', {}, 'INVALID_PASSKEY');
  }
  
  const user = await User.findByPk(passkey.userId);
  
  if (!user) {
    throw new AuthenticationError('User not found', {}, 'USER_NOT_FOUND');
  }
  
  if (!user.isActive) {
    throw new AuthenticationError('Account is deactivated', {}, 'ACCOUNT_DEACTIVATED');
  }
  
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AuthenticationError('Account is temporarily locked', {}, 'ACCOUNT_LOCKED');
  }
  
  // Get stored challenge
  if (!user.passkeyChallenge) {
    throw new AuthenticationError('No pending passkey login', {}, 'NO_PENDING_LOGIN');
  }
  
  if (user.passkeyChallengeExpires && user.passkeyChallengeExpires < new Date()) {
    throw new AuthenticationError('Passkey login expired', {}, 'LOGIN_EXPIRED');
  }
  
  const expectedChallenge = user.passkeyChallenge;
  
  // Clear challenge
  await user.update({
    passkeyChallenge: null,
    passkeyChallengeExpires: null
  });
  
  try {
    const verification = await verifyAuthenticationResponse({
      response: assertionResponse,
      expectedChallenge: expectedChallenge,
      expectedOrigin: config.auth.passkey.origin || (config.env === 'production' ? 'https://hayer.am' : 'http://localhost:3000'),
      expectedRPID: config.auth.passkey.rpId || (config.env === 'production' ? 'hayer.am' : 'localhost'),
      requireUserVerification: false,
      authenticator: {
        credentialID: Buffer.from(passkey.credentialId, 'base64'),
        credentialPublicKey: Buffer.from(passkey.publicKey, 'base64'),
        counter: passkey.counter
      }
    });
    
    const { 
      verified,
      authenticationInfo
    } = verification;
    
    if (!verified) {
      throw new AuthenticationError('Passkey verification failed', {}, 'VERIFICATION_FAILED');
    }
    
    // Update counter
    await passkey.update({
      counter: authenticationInfo.newCounter,
      lastUsed: new Date()
    });
    
    // Reset failed login attempts
    await user.update({
      failedLoginAttempts: 0,
      lastLoginAt: new Date(),
      lastLoginIp: req.ip
    });
    
    // Generate tokens
    const token = generateToken({ id: user.id, email: user.email });
    const refreshToken = generateRefreshToken({ id: user.id, email: user.email });
    
    // Create session
    const session = await createSession(user, req, { rememberMe: false });
    
    await AuditEvent.create({
      userId: user.id,
      action: 'passkey.login_completed',
      category: 'authentication',
      resource: 'passkey',
      resourceId: passkey.id,
      description: `Passkey login completed for user ${user.username}`,
      status: 'success',
      severity: 'info',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: req.id,
      details: { method: 'passkey', sessionId: session.session.id }
    });
    
    return {
      user,
      token,
      refreshToken,
      session: session.session,
      hayerId: user.HayerIds && user.HayerIds.length > 0 ? user.HayerIds[0].hayerId : null
    };
  } catch (error) {
    console.error('Passkey login verification error:', error);
    throw new AuthenticationError('Passkey login failed', error, 'PASSKEY_LOGIN_FAILED');
  }
};

/**
 * List user's passkeys
 */
const listPasskeys = async (user) => {
  const passkeys = await Passkey.findAll({
    where: { userId: user.id },
    order: [['isDefault', 'DESC'], ['createdAt', 'DESC']]
  });
  
  return passkeys;
};

/**
 * Remove a passkey
 */
const removePasskey = async (user, passkeyId, req) => {
  const passkey = await Passkey.findOne({
    where: { id: passkeyId, userId: user.id }
  });
  
  if (!passkey) {
    throw new NotFoundError('Passkey not found');
  }
  
  // Prevent removing the last passkey if MFA is required
  const passkeyCount = await Passkey.count({ where: { userId: user.id } });
  if (passkeyCount === 1 && user.preferences?.auth?.mfaRequired) {
    throw new ValidationError('Cannot remove the last passkey when MFA is required');
  }
  
  await passkey.update({ isActive: false });
  
  // If this was the default passkey, set another one as default
  if (passkey.isDefault) {
    const newDefault = await Passkey.findOne({
      where: { userId: user.id, id: { [Op.ne]: passkey.id }, isActive: true },
      order: [['createdAt', 'DESC']]
    });
    
    if (newDefault) {
      await newDefault.update({ isDefault: true });
    }
  }
  
  await AuditEvent.create({
    userId: user.id,
    action: 'passkey.remove',
    category: 'authentication',
    resource: 'passkey',
    resourceId: passkey.id,
    description: `Passkey removed for user ${user.username}`,
    status: 'success',
    severity: 'info',
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.id,
    details: { passkeyId: passkey.id }
  });
  
  return passkey;
};

/**
 * Set default passkey
 */
const setDefaultPasskey = async (user, passkeyId, req) => {
  const passkey = await Passkey.findOne({
    where: { id: passkeyId, userId: user.id, isActive: true }
  });
  
  if (!passkey) {
    throw new NotFoundError('Passkey not found');
  }
  
  // Clear all defaults
  await Passkey.update(
    { isDefault: false },
    { where: { userId: user.id } }
  );
  
  // Set new default
  await passkey.update({ isDefault: true });
  
  await AuditEvent.create({
    userId: user.id,
    action: 'passkey.set_default',
    category: 'authentication',
    resource: 'passkey',
    resourceId: passkey.id,
    description: `Default passkey set for user ${user.username}`,
    status: 'success',
    severity: 'info',
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.id,
    details: { passkeyId: passkey.id }
  });
  
  return passkey;
};

// ============================================================================
// TOTP METHODS
// ============================================================================

/**
 * Setup TOTP for user
 */
const setupTOTP = async (user, req) => {
  // Generate secret
  const secret = speakeasy.generateSecret({
    length: 20,
    name: `${config.app.name || 'HAYER'}:${user.email || user.username}`,
    issuer: config.app.name || 'HAYER'
  });
  
  // Check if user already has TOTP
  const existingTOTP = await TOTP.findOne({ where: { userId: user.id } });
  
  if (existingTOTP) {
    // Update existing
    await existingTOTP.update({
      secret: secret.base32,
      issuer: secret.issuer,
      algorithm: 'sha1',
      digits: 6,
      period: 30,
      isActive: false,
      isDefault: true
    });
    
    return {
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url,
      qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(secret.otpauth_url)}`,
      backupCodes: []
    };
  }
  
  // Create new TOTP
  const totp = await TOTP.create({
    userId: user.id,
    secret: secret.base32,
    issuer: secret.issuer,
    algorithm: 'sha1',
    digits: 6,
    period: 30,
    isActive: false,
    isDefault: true
  });
  
  await AuditEvent.create({
    userId: user.id,
    action: 'totp.setup',
    category: 'authentication',
    resource: 'totp',
    resourceId: totp.id,
    description: `TOTP setup started for user ${user.username}`,
    status: 'success',
    severity: 'info',
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.id
  });
  
  return {
    secret: secret.base32,
    otpauthUrl: secret.otpauth_url,
    qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(secret.otpauth_url)}`,
    backupCodes: []
  };
};

/**
 * Verify TOTP code
 */
const verifyTOTP = async (user, code, tempToken = null) => {
  const totp = await TOTP.findOne({
    where: { userId: user.id, isActive: true }
  });
  
  if (!totp) {
    throw new AuthenticationError('TOTP not set up', {}, 'TOTP_NOT_SETUP');
  }
  
  // Verify code
  const verified = speakeasy.totp.verify({
    secret: totp.secret,
    encoding: 'base32',
    token: code,
    window: 1 // Allow 1 step (30 seconds) before and after
  });
  
  if (!verified) {
    throw new AuthenticationError('Invalid TOTP code', {}, 'INVALID_TOTP_CODE');
  }
  
  // If this is part of login flow with temp token
  if (tempToken) {
    try {
      const decoded = jwt.verify(tempToken, config.jwt.secret);
      if (decoded.temp) {
        // Generate real tokens
        const token = generateToken({ id: user.id, email: user.email });
        const refreshToken = generateRefreshToken({ id: user.id, email: user.email });
        
        // Create session
        const session = await createSession(user, {}, { rememberMe: false });
        
        await AuditEvent.create({
          userId: user.id,
          action: 'totp.verify_login',
          category: 'authentication',
          resource: 'totp',
          resourceId: totp.id,
          description: `TOTP verification completed for login for user ${user.username}`,
          status: 'success',
          severity: 'info'
        });
        
        return {
          success: true,
          token,
          refreshToken,
          session: session.session
        };
      }
    } catch (error) {
      // Ignore invalid temp token
    }
  }
  
  await AuditEvent.create({
    userId: user.id,
    action: 'totp.verify',
    category: 'authentication',
    resource: 'totp',
    resourceId: totp.id,
    description: `TOTP code verified for user ${user.username}`,
    status: 'success',
    severity: 'info'
  });
  
  return { success: true };
};

/**
 * Toggle TOTP on/off
 */
const toggleTOTP = async (user, enable, req) => {
  const totp = await TOTP.findOne({
    where: { userId: user.id, isDefault: true }
  });
  
  if (!totp) {
    throw new NotFoundError('TOTP not found');
  }
  
  // If enabling, verify that TOTP is properly set up
  if (enable && !totp.secret) {
    throw new ValidationError('TOTP secret not configured');
  }
  
  await totp.update({ isActive: enable });
  
  await AuditEvent.create({
    userId: user.id,
    action: enable ? 'totp.enable' : 'totp.disable',
    category: 'authentication',
    resource: 'totp',
    resourceId: totp.id,
    description: `TOTP ${enable ? 'enabled' : 'disabled'} for user ${user.username}`,
    status: 'success',
    severity: 'info',
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.id
  });
  
  return totp;
};

/**
 * Generate backup codes
 */
const generateBackupCodes = async (user, count = 10, req) => {
  const totp = await TOTP.findOne({
    where: { userId: user.id, isDefault: true }
  });
  
  if (!totp) {
    throw new NotFoundError('TOTP not found');
  }
  
  // Generate backup codes
  const backupCodes = [];
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    backupCodes.push(code);
  }
  
  // Hash codes for storage (we store hashes, not plain codes)
  const backupCodeHashes = backupCodes.map(code => 
    crypto.createHash('sha256').update(code).digest('hex')
  );
  
  await totp.update({ backupCodes: backupCodeHashes });
  
  await AuditEvent.create({
    userId: user.id,
    action: 'totp.backup_codes_generated',
    category: 'authentication',
    resource: 'totp',
    resourceId: totp.id,
    description: `Backup codes generated for user ${user.username}`,
    status: 'success',
    severity: 'info',
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.id,
    details: { count }
  });
  
  return {
    backupCodes, // Return plain codes only once (for display to user)
    count
  };
};

/**
 * Verify backup code
 */
const verifyBackupCode = async (user, code) => {
  const totp = await TOTP.findOne({
    where: { userId: user.id, isActive: true }
  });
  
  if (!totp || !totp.backupCodes || totp.backupCodes.length === 0) {
    throw new AuthenticationError('No backup codes available', {}, 'NO_BACKUP_CODES');
  }
  
  // Hash the provided code
  const codeHash = crypto.createHash('sha256').update(code).digest('hex');
  
  // Check if code exists
  const codeIndex = totp.backupCodes.indexOf(codeHash);
  
  if (codeIndex === -1) {
    throw new AuthenticationError('Invalid backup code', {}, 'INVALID_BACKUP_CODE');
  }
  
  // Remove used code
  const updatedCodes = [...totp.backupCodes];
  updatedCodes.splice(codeIndex, 1);
  
  await totp.update({ backupCodes: updatedCodes });
  
  await AuditEvent.create({
    userId: user.id,
    action: 'totp.backup_code_used',
    category: 'authentication',
    resource: 'totp',
    resourceId: totp.id,
    description: `Backup code used for user ${user.username}`,
    status: 'success',
    severity: 'info',
    details: { remainingCodes: updatedCodes.length }
  });
  
  return { success: true, remainingCodes: updatedCodes.length };
};

module.exports = {
  generateHayerId,
  createHayerId,
  registerUser,
  loginUser,
  createSession,
  parseUserAgent,
  refreshAccessToken,
  logoutUser,
  logoutAllSessions,
  changePassword,
  requestPasswordReset,
  verifyPasswordResetToken,
  resetPassword,
  requestEmailVerification,
  verifyEmail,
  getCurrentUser,
  listSessions,
  revokeSession,
  revokeOtherSessions,
  getAuthSettings,
  // Passkey methods
  passkeyRegistrationOptions,
  verifyPasskeyRegistration,
  passkeyLoginOptions,
  verifyPasskeyLogin,
  listPasskeys,
  removePasskey,
  setDefaultPasskey,
  // TOTP methods
  setupTOTP,
  verifyTOTP,
  toggleTOTP,
  generateBackupCodes,
  verifyBackupCode
};
