const path = require('path');
const { config } = require('dotenv');

// Load environment variables
config({ path: path.resolve(__dirname, '../../.env') });

// Validate required environment variables
const requiredEnvVars = [
  'NODE_ENV',
  'PORT',
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
  'JWT_SECRET',
  'SESSION_SECRET',
  'STORAGE_ENCRYPTION_KEY'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}

// Export configuration
module.exports = {
  // Server Configuration
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  host: process.env.HOST || '0.0.0.0',

  // Database Configuration
  db: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true',
    pool: {
      max: parseInt(process.env.DB_POOL_MAX, 10) || 20,
      min: parseInt(process.env.DB_POOL_MIN, 10) || 5,
      acquire: parseInt(process.env.DB_POOL_ACQUIRE, 10) || 30000,
      idle: parseInt(process.env.DB_POOL_IDLE, 10) || 10000
    }
  },

  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  },

  // Session Configuration
  session: {
    secret: process.env.SESSION_SECRET,
    cookieName: process.env.SESSION_COOKIE_NAME || 'hayer_session',
    cookieMaxAge: parseInt(process.env.SESSION_COOKIE_MAX_AGE, 10) || 86400000
  },

  // WebAuthn Configuration
  webauthn: {
    rpName: process.env.WEBAUTHN_RP_NAME || 'HAYER',
    rpID: process.env.WEBAUTHN_RP_ID || 'localhost',
    origin: process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000',
    attestation: process.env.WEBAUTHN_ATTESTATION || 'none'
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
    message: process.env.RATE_LIMIT_MESSAGE || 'Too many requests, please try again later'
  },

  // CORS Configuration
  cors: {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000', 'http://localhost:8080'],
    methods: process.env.CORS_METHODS ? process.env.CORS_METHODS.split(',') : ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: process.env.CORS_ALLOWED_HEADERS ? process.env.CORS_ALLOWED_HEADERS.split(',') : ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization']
  },

  // Security Headers
  security: {
    contentSecurityPolicy: process.env.HELMET_CONTENT_SECURITY_POLICY || "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'",
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filePath: process.env.LOG_FILE_PATH || './logs',
    fileName: process.env.LOG_FILE_NAME || 'hayer-backend',
    maxSize: process.env.LOG_MAX_SIZE || '10m',
    maxFiles: parseInt(process.env.LOG_MAX_FILES, 10) || 10
  },

  // Storage Configuration
  storage: {
    encryptionKey: process.env.STORAGE_ENCRYPTION_KEY,
    chunkSize: parseInt(process.env.STORAGE_CHUNK_SIZE, 10) || 4194304, // 4MB
    replicaCount: parseInt(process.env.STORAGE_REPLICA_COUNT, 10) || 3,
    minNodesForQuorum: parseInt(process.env.STORAGE_MIN_NODES_FOR_QUORUM, 10) || 2
  },

  // Node Network Configuration
  nodeNetwork: {
    registryUrl: process.env.NODE_REGISTRY_URL || 'http://localhost:3000/api/nodes',
    healthCheckInterval: parseInt(process.env.NODE_HEALTH_CHECK_INTERVAL, 10) || 60000,
    timeout: parseInt(process.env.NODE_TIMEOUT_MS, 10) || 10000,
    maxRetries: parseInt(process.env.NODE_MAX_RETRIES, 10) || 3
  },

  // OAuth Configuration
  oauth: {
    stateSecret: process.env.OAUTH_STATE_SECRET,
    tokenSecret: process.env.OAUTH_TOKEN_SECRET
  },

  // Admin Configuration
  admin: {
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    initialized: process.env.ADMIN_INITIALIZED === 'true'
  },

  // Registry Configuration
  registry: {
    sources: process.env.REGISTRY_SOURCES ? process.env.REGISTRY_SOURCES.split(',') : ['https://raw.githubusercontent.com/ARARAT33/Hayer/main/registry.json'],
    cacheTTL: parseInt(process.env.REGISTRY_CACHE_TTL, 10) || 3600000,
    signatureSecret: process.env.REGISTRY_SIGNATURE_SECRET
  },

  // Backup Configuration
  backup: {
    dir: process.env.BACKUP_DIR || './backups',
    interval: parseInt(process.env.BACKUP_INTERVAL, 10) || 86400000,
    retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS, 10) || 30
  },

  // Monitoring Configuration
  monitoring: {
    enabled: process.env.MONITORING_ENABLED === 'true',
    port: parseInt(process.env.MONITORING_PORT, 10) || 9090
  },

  // Feature Flags
  features: {
    passkeys: process.env.FEATURE_PASSKEYS !== 'false',
    mfa: process.env.FEATURE_MFA !== 'false',
    oauth: process.env.FEATURE_OAUTH !== 'false',
    sso: process.env.FEATURE_SSO !== 'false',
    storage: process.env.FEATURE_STORAGE !== 'false',
    federation: process.env.FEATURE_FEDERATION !== 'false'
  }
};
