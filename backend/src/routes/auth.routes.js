const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { jwtAuth, optionalAuth } = require('../middleware/authentication');
const { asyncHandler } = require('../middleware/errorHandler');
const rateLimit = require('express-rate-limit');
const config = require('../config');

// Rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: 5, // More restrictive for auth endpoints
  message: {
    error: true,
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many authentication attempts. Please try again later.',
    timestamp: new Date().toISOString()
  },
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  }
});

// Public routes (no authentication required)

// Register new user
router.post('/register', authLimiter, asyncHandler(authController.register));

// Login with email/username and password
router.post('/login', authLimiter, asyncHandler(authController.login));

// Login with passkey
router.post('/login/passkey', authLimiter, asyncHandler(authController.loginWithPasskey));

// Initiate passkey registration
router.post('/passkey/register/options', jwtAuth(), asyncHandler(authController.passkeyRegistrationOptions));

// Verify passkey registration
router.post('/passkey/register/verify', jwtAuth(), asyncHandler(authController.verifyPasskeyRegistration));

// Initiate passkey authentication
router.post('/passkey/login/options', asyncHandler(authController.passkeyLoginOptions));

// Verify passkey authentication
router.post('/passkey/login/verify', asyncHandler(authController.verifyPasskeyLogin));

// List available passkeys
router.get('/passkey', jwtAuth(), asyncHandler(authController.listPasskeys));

// Remove passkey
router.delete('/passkey/:id', jwtAuth(), asyncHandler(authController.removePasskey));

// Set default passkey
router.patch('/passkey/:id/default', jwtAuth(), asyncHandler(authController.setDefaultPasskey));

// TOTP setup
router.post('/totp/setup', jwtAuth(), asyncHandler(authController.setupTOTP));

// TOTP verification
router.post('/totp/verify', jwtAuth(), asyncHandler(authController.verifyTOTP));

// TOTP enable/disable
router.patch('/totp', jwtAuth(), asyncHandler(authController.toggleTOTP));

// Generate backup codes
router.post('/backup-codes/generate', jwtAuth(), asyncHandler(authController.generateBackupCodes));

// Verify backup code
router.post('/backup-codes/verify', asyncHandler(authController.verifyBackupCode));

// Password reset request
router.post('/reset-password/request', authLimiter, asyncHandler(authController.requestPasswordReset));

// Password reset verification
router.post('/reset-password/verify', authLimiter, asyncHandler(authController.verifyPasswordReset));

// Password reset
router.post('/reset-password', authLimiter, asyncHandler(authController.resetPassword));

// Email verification request
router.post('/verify-email/request', authLimiter, asyncHandler(authController.requestEmailVerification));

// Email verification
router.post('/verify-email', authLimiter, asyncHandler(authController.verifyEmail));

// OAuth routes

// OAuth authorization
router.get('/oauth/authorize', optionalAuth, asyncHandler(authController.oauthAuthorize));

// OAuth token exchange
router.post('/oauth/token', asyncHandler(authController.oauthToken));

// OAuth callback
router.get('/oauth/callback', asyncHandler(authController.oauthCallback));

// OAuth provider list
router.get('/oauth/providers', asyncHandler(authController.listOAuthProviders));

// SSO routes

// SSO metadata
router.get('/sso/metadata', asyncHandler(authController.getSSOMetadata));

// SSO authorization
router.post('/sso/authorize', asyncHandler(authController.ssoAuthorize));

// SSO token
router.post('/sso/token', asyncHandler(authController.ssoToken));

// SSO user info
router.get('/sso/userinfo', jwtAuth(), asyncHandler(authController.ssoUserInfo));

// SSO JWKS
router.get('/sso/jwks', asyncHandler(authController.getSSOJWKS));

// Authenticated routes (require valid JWT)

// Logout
router.post('/logout', jwtAuth(), asyncHandler(authController.logout));

// Logout from all sessions
router.post('/logout/all', jwtAuth(), asyncHandler(authController.logoutAll));

// Refresh token
router.post('/refresh', asyncHandler(authController.refreshToken));

// Get current user
router.get('/me', jwtAuth(), asyncHandler(authController.getCurrentUser));

// List sessions
router.get('/sessions', jwtAuth(), asyncHandler(authController.listSessions));

// Revoke session
router.delete('/sessions/:id', jwtAuth(), asyncHandler(authController.revokeSession));

// Revoke all other sessions
router.post('/sessions/revoke-others', jwtAuth(), asyncHandler(authController.revokeOtherSessions));

// Change password
router.patch('/password', jwtAuth(), asyncHandler(authController.changePassword));

// Update authentication settings
router.patch('/settings', jwtAuth(), asyncHandler(authController.updateAuthSettings));

// Get authentication settings
router.get('/settings', jwtAuth(), asyncHandler(authController.getAuthSettings));

// Health check for auth service
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'auth',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
