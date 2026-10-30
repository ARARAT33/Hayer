/**
 * Encryption utilities for HAYER backend
 * Provides client-side and server-side encryption functions
 */

const crypto = require('crypto');
const config = require('../config');
const CryptoJS = require('crypto-js');

/**
 * Encryption algorithms
 */
const ALGORITHMS = {
  AES_256_GCM: 'aes-256-gcm',
  AES_256_CBC: 'aes-256-cbc',
  RSA: 'rsa',
  CHACHA20_POLY1305: 'chacha20-poly1305'
};

/**
 * Hash algorithms
 */
const HASH_ALGORITHMS = {
  SHA256: 'sha256',
  SHA384: 'sha384',
  SHA512: 'sha512',
  BLAKE2B: 'blake2b',
  BLAKE2S: 'blake2s'
};

/**
 * Key derivation algorithms
 */
const KDF_ALGORITHMS = {
  PBKDF2: 'pbkdf2',
  SCRYPT: 'scrypt',
  ARGON2: 'argon2'
};

/**
 * Generate a secure random key
 */
const generateKey = (size = 32) => {
  return crypto.randomBytes(size);
};

/**
 * Generate a secure random IV (Initialization Vector)
 */
const generateIV = (size = 12) => {
  return crypto.randomBytes(size);
};

/**
 * Generate a secure random salt
 */
const generateSalt = (size = 16) => {
  return crypto.randomBytes(size);
};

/**
 * Generate a secure random nonce
 */
const generateNonce = (size = 12) => {
  return crypto.randomBytes(size);
};

/**
 * Hash data using SHA-256
 */
const sha256 = (data) => {
  const hash = crypto.createHash('sha256');
  hash.update(data);
  return hash.digest('hex');
};

/**
 * Hash data using SHA-512
 */
const sha512 = (data) => {
  const hash = crypto.createHash('sha512');
  hash.update(data);
  return hash.digest('hex');
};

/**
 * Hash data with salt
 */
const hashWithSalt = (data, salt, algorithm = 'sha256') => {
  const hash = crypto.createHash(algorithm);
  hash.update(salt);
  hash.update(data);
  return hash.digest('hex');
};

/**
 * HMAC (Hash-based Message Authentication Code)
 */
const hmac = (data, key, algorithm = 'sha256') => {
  const hmac = crypto.createHmac(algorithm, key);
  hmac.update(data);
  return hmac.digest('hex');
};

/**
 * Verify HMAC
 */
const verifyHmac = (data, key, signature, algorithm = 'sha256') => {
  const expectedSignature = hmac(data, key, algorithm);
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
};

/**
 * Encrypt data using AES-256-GCM
 */
const encryptAES256GCM = (data, key, iv = null) => {
  if (!key) {
    throw new Error('Encryption key is required');
  }
  
  // Ensure key is 32 bytes
  if (key.length !== 32) {
    if (key.length < 32) {
      key = Buffer.concat([key, Buffer.alloc(32 - key.length)]);
    } else {
      key = key.slice(0, 32);
    }
  }
  
  // Generate IV if not provided
  if (!iv) {
    iv = generateIV(12);
  }
  
  // Ensure IV is 12 bytes for GCM
  if (iv.length !== 12) {
    iv = iv.slice(0, 12);
  }
  
  // Create cipher
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  // Encrypt
  const encrypted = Buffer.concat([
    cipher.update(data, 'utf8'),
    cipher.final(),
    cipher.getAuthTag()
  ]);
  
  return {
    algorithm: ALGORITHMS.AES_256_GCM,
    iv: iv.toString('base64'),
    ciphertext: encrypted.slice(0, -16).toString('base64'),
    authTag: encrypted.slice(-16).toString('base64')
  };
};

/**
 * Decrypt data using AES-256-GCM
 */
const decryptAES256GCM = (encryptedData, key) => {
  if (!key) {
    throw new Error('Decryption key is required');
  }
  
  // Ensure key is 32 bytes
  if (key.length !== 32) {
    if (key.length < 32) {
      key = Buffer.concat([key, Buffer.alloc(32 - key.length)]);
    } else {
      key = key.slice(0, 32);
    }
  }
  
  const { iv, ciphertext, authTag } = encryptedData;
  
  // Decode from base64
  const ivBuffer = Buffer.from(iv, 'base64');
  const ciphertextBuffer = Buffer.from(ciphertext, 'base64');
  const authTagBuffer = Buffer.from(authTag, 'base64');
  
  // Create decipher
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, ivBuffer);
  decipher.setAuthTag(authTagBuffer);
  
  // Decrypt
  const decrypted = Buffer.concat([
    decipher.update(ciphertextBuffer),
    decipher.final()
  ]);
  
  return decrypted.toString('utf8');
};

/**
 * Encrypt data using AES-256-CBC
 */
const encryptAES256CBC = (data, key, iv = null) => {
  if (!key) {
    throw new Error('Encryption key is required');
  }
  
  // Ensure key is 32 bytes
  if (key.length !== 32) {
    if (key.length < 32) {
      key = Buffer.concat([key, Buffer.alloc(32 - key.length)]);
    } else {
      key = key.slice(0, 32);
    }
  }
  
  // Generate IV if not provided
  if (!iv) {
    iv = generateIV(16);
  }
  
  // Ensure IV is 16 bytes for CBC
  if (iv.length !== 16) {
    iv = iv.slice(0, 16);
  }
  
  // Create cipher
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  
  // Encrypt
  const encrypted = Buffer.concat([
    cipher.update(data, 'utf8'),
    cipher.final()
  ]);
  
  return {
    algorithm: ALGORITHMS.AES_256_CBC,
    iv: iv.toString('base64'),
    ciphertext: encrypted.toString('base64')
  };
};

/**
 * Decrypt data using AES-256-CBC
 */
const decryptAES256CBC = (encryptedData, key) => {
  if (!key) {
    throw new Error('Decryption key is required');
  }
  
  // Ensure key is 32 bytes
  if (key.length !== 32) {
    if (key.length < 32) {
      key = Buffer.concat([key, Buffer.alloc(32 - key.length)]);
    } else {
      key = key.slice(0, 32);
    }
  }
  
  const { iv, ciphertext } = encryptedData;
  
  // Decode from base64
  const ivBuffer = Buffer.from(iv, 'base64');
  const ciphertextBuffer = Buffer.from(ciphertext, 'base64');
  
  // Create decipher
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, ivBuffer);
  
  // Decrypt
  const decrypted = Buffer.concat([
    decipher.update(ciphertextBuffer),
    decipher.final()
  ]);
  
  return decrypted.toString('utf8');
};

/**
 * Encrypt data using CryptoJS (for compatibility)
 */
const encryptCryptoJS = (data, key, options = {}) => {
  const { algorithm = 'AES', mode = CryptoJS.mode.ECB, padding = CryptoJS.pad.Pkcs7 } = options;
  
  const encrypted = CryptoJS[algorithm].encrypt(data, key, {
    mode,
    padding
  });
  
  return encrypted.toString();
};

/**
 * Decrypt data using CryptoJS
 */
const decryptCryptoJS = (encryptedData, key, options = {}) => {
  const { algorithm = 'AES', mode = CryptoJS.mode.ECB, padding = CryptoJS.pad.Pkcs7 } = options;
  
  const decrypted = CryptoJS[algorithm].decrypt(encryptedData, key, {
    mode,
    padding
  });
  
  return decrypted.toString(CryptoJS.enc.Utf8);
};

/**
 * Derive key from password using PBKDF2
 */
const deriveKeyPBKDF2 = (password, salt, iterations = 100000, keylen = 32, digest = 'sha256') => {
  return crypto.pbkdf2Sync(password, salt, iterations, keylen, digest);
};

/**
 * Derive key from password using scrypt
 */
const deriveKeyScrypt = (password, salt, options = {}) => {
  const { N = 16384, r = 8, p = 1, maxmem = 64 * 1024 * 1024, keylen = 32 } = options;
  return crypto.scryptSync(password, salt, keylen, { N, r, p, maxmem });
};

/**
 * Generate a key pair for RSA encryption
 */
const generateRSAKeyPair = (options = {}) => {
  const { modulusLength = 2048, publicKeyEncoding = { type: 'spki', format: 'pem' }, privateKeyEncoding = { type: 'pkcs8', format: 'pem' } } = options;
  
  return crypto.generateKeyPairSync('rsa', {
    modulusLength,
    publicKeyEncoding,
    privateKeyEncoding
  });
};

/**
 * Encrypt data using RSA
 */
const encryptRSA = (data, publicKey, options = {}) => {
  const { padding = crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash = 'sha256' } = options;
  
  const buffer = Buffer.from(data, 'utf8');
  const encrypted = crypto.publicEncrypt({
    key: publicKey,
    padding,
    oaepHash
  }, buffer);
  
  return encrypted.toString('base64');
};

/**
 * Decrypt data using RSA
 */
const decryptRSA = (encryptedData, privateKey, options = {}) => {
  const { padding = crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash = 'sha256' } = options;
  
  const encryptedBuffer = Buffer.from(encryptedData, 'base64');
  const decrypted = crypto.privateDecrypt({
    key: privateKey,
    padding,
    oaepHash
  }, encryptedBuffer);
  
  return decrypted.toString('utf8');
};

/**
 * Generate a secure random token
 */
const generateToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Generate a secure random UUID
 */
const generateUUID = () => {
  return crypto.randomUUID();
};

/**
 * Generate a secure random ID
 */
const generateId = (length = 16) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const bytes = crypto.randomBytes(length);
  
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  
  return result;
};

/**
 * Encrypt data for storage (uses HAYER storage encryption key)
 */
const encryptForStorage = (data, key = config.storage.encryptionKey) => {
  if (!key) {
    throw new Error('Storage encryption key is not configured');
  }
  
  const keyBuffer = Buffer.from(key, 'base64');
  return encryptAES256GCM(data, keyBuffer);
};

/**
 * Decrypt data from storage
 */
const decryptFromStorage = (encryptedData, key = config.storage.encryptionKey) => {
  if (!key) {
    throw new Error('Storage encryption key is not configured');
  }
  
  const keyBuffer = Buffer.from(key, 'base64');
  return decryptAES256GCM(encryptedData, keyBuffer);
};

/**
 * Hash password using Argon2 (simulated with PBKDF2 for now)
 * In production, use the actual argon2 library
 */
const hashPassword = async (password, options = {}) => {
  const { iterations = 12, memory = 65536, parallelism = 1, saltLength = 16, keylen = 32 } = options;
  
  // Generate salt
  const salt = generateSalt(saltLength);
  
  // Derive key using PBKDF2 (simulating Argon2)
  const derivedKey = deriveKeyPBKDF2(password, salt, iterations * 1000, keylen);
  
  // Return in format: algorithm$iterations$memory$parallelism$salt$key
  return `${'argon2id'}$${iterations}$${memory}$${parallelism}$${salt.toString('base64')}$${derivedKey.toString('base64')}`;
};

/**
 * Verify password against Argon2 hash
 */
const verifyPassword = async (password, hash) => {
  try {
    const [algorithm, iterations, memory, parallelism, saltB64, keyB64] = hash.split('$');
    
    const salt = Buffer.from(saltB64, 'base64');
    const expectedKey = Buffer.from(keyB64, 'base64');
    
    // Derive key using the same parameters
    const derivedKey = deriveKeyPBKDF2(password, salt, parseInt(iterations) * 1000, expectedKey.length);
    
    // Compare keys
    return crypto.timingSafeEqual(derivedKey, expectedKey);
  } catch (error) {
    return false;
  }
};

/**
 * Generate a secure API key
 */
const generateAPIKey = (prefix = 'hayer', length = 32) => {
  const randomPart = generateId(length);
  const timestamp = Date.now().toString(36);
  const hash = sha256(crypto.randomBytes(16).toString('hex')).slice(0, 8);
  
  return `${prefix}_${timestamp}_${randomPart}_${hash}`;
};

/**
 * Validate API key format
 */
const validateAPIKey = (key, prefix = 'hayer') => {
  const pattern = new RegExp(`^${prefix}_[0-9a-zA-Z]+_[a-zA-Z0-9]+_[a-f0-9]{8}$`);
  return pattern.test(key);
};

/**
 * Generate a secure session ID
 */
const generateSessionId = () => {
  return generateId(32);
};

/**
 * Generate a secure CSRF token
 */
const generateCsrfToken = () => {
  return generateId(32);
};

/**
 * Generate a secure state token for OAuth
 */
const generateStateToken = () => {
  return generateId(32);
};

/**
 * Generate a secure nonce for OAuth
 */
const generateNonceToken = () => {
  return generateId(32);
};

/**
 * Encryption utilities for client-side use
 * These can be exposed to the frontend via API
 */
const clientEncryption = {
  /**
   * Generate a key pair for client-side encryption
   */
  generateKeyPair: () => {
    return generateRSAKeyPair({ modulusLength: 2048 });
  },

  /**
   * Encrypt data with public key (for sending to server)
   */
  encryptWithPublicKey: (data, publicKey) => {
    return encryptRSA(data, publicKey);
  },

  /**
   * Generate a symmetric key for client-side encryption
   */
  generateSymmetricKey: () => {
    return generateKey(32).toString('base64');
  },

  /**
   * Encrypt data with symmetric key
   */
  encrypt: (data, key) => {
    const keyBuffer = Buffer.from(key, 'base64');
    return encryptAES256GCM(data, keyBuffer);
  },

  /**
   * Decrypt data with symmetric key
   */
  decrypt: (encryptedData, key) => {
    const keyBuffer = Buffer.from(key, 'base64');
    return decryptAES256GCM(encryptedData, keyBuffer);
  }
};

module.exports = {
  // Algorithms
  ALGORITHMS,
  HASH_ALGORITHMS,
  KDF_ALGORITHMS,

  // Key generation
  generateKey,
  generateIV,
  generateSalt,
  generateNonce,
  generateToken,
  generateUUID,
  generateId,
  generateAPIKey,
  validateAPIKey,
  generateSessionId,
  generateCsrfToken,
  generateStateToken,
  generateNonceToken,

  // Hash functions
  sha256,
  sha512,
  hashWithSalt,
  hmac,
  verifyHmac,

  // AES encryption
  encryptAES256GCM,
  decryptAES256GCM,
  encryptAES256CBC,
  decryptAES256CBC,

  // CryptoJS compatibility
  encryptCryptoJS,
  decryptCryptoJS,

  // Key derivation
  deriveKeyPBKDF2,
  deriveKeyScrypt,

  // RSA encryption
  generateRSAKeyPair,
  encryptRSA,
  decryptRSA,

  // Password hashing
  hashPassword,
  verifyPassword,

  // Storage encryption
  encryptForStorage,
  decryptFromStorage,

  // Client encryption utilities
  clientEncryption,

  // Default export
  default: {
    encrypt: encryptAES256GCM,
    decrypt: decryptAES256GCM,
    hash: sha256,
    generateKey,
    generateIV,
    generateToken
  }
};
