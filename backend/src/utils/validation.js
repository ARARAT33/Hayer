/**
 * Validation utilities for HAYER backend
 * Provides common validation functions and schemas
 */

const validator = require('validator');
const { Op } = require('sequelize');
const { User, HayerId, Node, Service, Community } = require('../models');

/**
 * Common validation schemas
 */

// Email validation
const isValidEmail = (email) => {
  return validator.isEmail(email);
};

// Username validation
const isValidUsername = (username) => {
  return validator.isAlphanumeric(username) && validator.isLength(username, { min: 3, max: 80 });
};

// Password validation
const isValidPassword = (password, options = {}) => {
  const { minLength = 8, maxLength = 128, requireUppercase = false, requireLowercase = false, requireNumber = false, requireSymbol = false } = options;
  
  if (!validator.isLength(password, { min: minLength, maxLength })) {
    return false;
  }
  
  if (requireUppercase && !validator.hasUppercase(password)) {
    return false;
  }
  
  if (requireLowercase && !validator.hasLowercase(password)) {
    return false;
  }
  
  if (requireNumber && !validator.hasNumber(password)) {
    return false;
  }
  
  if (requireSymbol && !validator.hasSymbol(password)) {
    return false;
  }
  
  return true;
};

// URL validation
const isValidUrl = (url, options = {}) => {
  const { requireHttps = false, allowLocal = false } = options;
  
  if (!validator.isURL(url)) {
    return false;
  }
  
  if (requireHttps && !url.startsWith('https://')) {
    return false;
  }
  
  if (!allowLocal && (url.includes('localhost') || url.includes('127.0.0.1'))) {
    return false;
  }
  
  return true;
};

// UUID validation
const isValidUUID = (uuid, version = 4) => {
  return validator.isUUID(uuid, version);
};

// HAYER ID validation
const isValidHayerId = (hayerId) => {
  return validator.isAlphanumeric(hayerId) && validator.isLength(hayerId, { min: 8, max: 64 });
};

// Node ID validation
const isValidNodeId = (nodeId) => {
  return validator.isLength(nodeId, { min: 1, max: 180 });
};

// Service ID validation
const isValidServiceId = (serviceId) => {
  return validator.isLength(serviceId, { min: 1, max: 180 });
};

// Community ID validation
const isValidCommunityId = (communityId) => {
  return validator.isLength(communityId, { min: 1, max: 180 });
};

// Token validation
const isValidToken = (token, options = {}) => {
  const { minLength = 32, maxLength = 500 } = options;
  return validator.isLength(token, { min: minLength, maxLength });
};

// Hash validation
const isValidHash = (hash, algorithm = 'sha256') => {
  const lengths = {
    md5: 32,
    sha1: 40,
    sha256: 64,
    sha384: 96,
    sha512: 128
  };
  
  const expectedLength = lengths[algorithm.toLowerCase()] || 64;
  return validator.isHexadecimal(hash) && hash.length === expectedLength;
};

// Public key validation (basic)
const isValidPublicKey = (publicKey) => {
  return validator.isLength(publicKey, { min: 100, max: 5000 });
};

// Private key validation (basic)
const isValidPrivateKey = (privateKey) => {
  return validator.isLength(privateKey, { min: 100, max: 5000 });
};

// IP address validation
const isValidIP = (ip, version = 'either') => {
  return validator.isIP(ip, version);
};

// IPv4 validation
const isValidIPv4 = (ip) => {
  return validator.isIP(ip, 4);
};

// IPv6 validation
const isValidIPv6 = (ip) => {
  return validator.isIP(ip, 6);
};

// CIDR validation
const isValidCIDR = (cidr) => {
  const parts = cidr.split('/');
  if (parts.length !== 2) {
    return false;
  }
  
  const ip = parts[0];
  const prefix = parts[1];
  
  if (!validator.isIP(ip)) {
    return false;
  }
  
  if (!validator.isNumeric(prefix)) {
    return false;
  }
  
  const prefixNum = parseInt(prefix, 10);
  const ipVersion = validator.isIP(ip, 6) ? 6 : 4;
  const maxPrefix = ipVersion === 6 ? 128 : 32;
  
  return prefixNum >= 0 && prefixNum <= maxPrefix;
};

// Domain validation
const isValidDomain = (domain) => {
  return validator.isFQDN(domain);
};

// Port validation
const isValidPort = (port) => {
  const portNum = parseInt(port, 10);
  return portNum >= 0 && portNum <= 65535;
};

// Size validation (bytes)
const isValidSize = (size, options = {}) => {
  const { min = 0, max = Number.MAX_SAFE_INTEGER } = options;
  const sizeNum = parseInt(size, 10);
  return sizeNum >= min && sizeNum <= max;
};

// File size validation (human readable)
const isValidFileSize = (size, maxSize) => {
  // Parse human readable size (e.g., '10MB', '1GB')
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const unit = size.slice(-2).toUpperCase();
  const sizeNum = parseFloat(size);
  
  const unitIndex = units.findIndex(u => u === unit);
  if (unitIndex === -1) {
    return false;
  }
  
  const sizeInBytes = sizeNum * Math.pow(1024, unitIndex);
  return sizeInBytes <= maxSize;
};

// MIME type validation
const isValidMimeType = (mimeType) => {
  return validator.isMimeType(mimeType);
};

// File extension validation
const isValidFileExtension = (filename, allowedExtensions) => {
  const extension = filename.split('.').pop().toLowerCase();
  return allowedExtensions.includes(extension);
};

// Filename validation
const isValidFilename = (filename) => {
  return validator.isLength(filename, { min: 1, max: 255 }) &&
    !filename.includes('/') &&
    !filename.includes('\\') &&
    !filename.includes('..') &&
    !filename.startsWith('.') &&
    !filename.includes(' ');
};

// Display name validation
const isValidDisplayName = (displayName) => {
  return validator.isLength(displayName, { min: 1, max: 200 });
};

// Description validation
const isValidDescription = (description) => {
  return validator.isLength(description, { min: 0, max: 5000 });
};

// Bio validation
const isValidBio = (bio) => {
  return validator.isLength(bio, { min: 0, max: 5000 });
};

// Tag validation
const isValidTag = (tag) => {
  return validator.isAlphanumeric(tag.replace(/[\s-]/g, '')) && validator.isLength(tag, { min: 1, max: 50 });
};

// Tags validation
const isValidTags = (tags, maxTags = 50) => {
  if (!Array.isArray(tags)) {
    return false;
  }
  
  if (tags.length > maxTags) {
    return false;
  }
  
  return tags.every(tag => isValidTag(tag));
};

// Color validation (hex)
const isValidColor = (color) => {
  return validator.isHexColor(color);
};

// Language validation
const isValidLanguage = (language) => {
  return validator.isAlpha(language) && validator.isLength(language, { min: 2, max: 10 });
};

// Timezone validation
const isValidTimezone = (timezone) => {
  return validator.isLength(timezone, { min: 3, max: 50 });
};

// Country code validation
const isValidCountryCode = (countryCode) => {
  return validator.isAlpha(countryCode) && validator.isLength(countryCode, { min: 2, max: 2 });
};

// Phone number validation
const isValidPhoneNumber = (phoneNumber, countryCode = null) => {
  if (countryCode) {
    return validator.isMobilePhone(phoneNumber, [countryCode]);
  }
  return validator.isMobilePhone(phoneNumber);
};

// Date validation
const isValidDate = (date, options = {}) => {
  const { minDate, maxDate } = options;
  
  const dateObj = new Date(date);
  
  if (isNaN(dateObj.getTime())) {
    return false;
  }
  
  if (minDate && dateObj < new Date(minDate)) {
    return false;
  }
  
  if (maxDate && dateObj > new Date(maxDate)) {
    return false;
  }
  
  return true;
};

// Date string validation (ISO format)
const isValidDateString = (dateString) => {
  return validator.isISO8601(dateString);
};

// Time validation (HH:MM:SS format)
const isValidTime = (time) => {
  return /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/.test(time);
};

// JSON validation
const isValidJson = (jsonString) => {
  try {
    JSON.parse(jsonString);
    return true;
  } catch {
    return false;
  }
};

// Base64 validation
const isValidBase64 = (base64String) => {
  try {
    Buffer.from(base64String, 'base64');
    return true;
  } catch {
    return false;
  }
};

// Hex validation
const isValidHex = (hexString) => {
  return validator.isHexadecimal(hexString);
};

// Numeric validation
const isValidNumeric = (value, options = {}) => {
  const { min, max, allowFloat = true } = options;
  
  if (allowFloat) {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return false;
    }
    
    if (min !== undefined && num < min) {
      return false;
    }
    
    if (max !== undefined && num > max) {
      return false;
    }
    
    return true;
  } else {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return false;
    }
    
    if (min !== undefined && num < min) {
      return false;
    }
    
    if (max !== undefined && num > max) {
      return false;
    }
    
    return true;
  }
};

// Integer validation
const isValidInteger = (value, options = {}) => {
  const { min, max } = options;
  const num = parseInt(value, 10);
  
  if (isNaN(num)) {
    return false;
  }
  
  if (min !== undefined && num < min) {
    return false;
  }
  
  if (max !== undefined && num > max) {
    return false;
  }
  
  return true;
};

// Boolean validation
const isValidBoolean = (value) => {
  return typeof value === 'boolean' || value === 'true' || value === 'false' || value === 1 || value === 0;
};

// Array validation
const isValidArray = (value, options = {}) => {
  const { minLength = 0, maxLength = Infinity, itemValidator = null } = options;
  
  if (!Array.isArray(value)) {
    return false;
  }
  
  if (value.length < minLength || value.length > maxLength) {
    return false;
  }
  
  if (itemValidator && !value.every(item => itemValidator(item))) {
    return false;
  }
  
  return true;
};

// Object validation
const isValidObject = (value, options = {}) => {
  const { minKeys = 0, maxKeys = Infinity, requiredKeys = [], keyValidator = null, valueValidator = null } = options;
  
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  
  const keys = Object.keys(value);
  
  if (keys.length < minKeys || keys.length > maxKeys) {
    return false;
  }
  
  if (requiredKeys.length > 0 && !requiredKeys.every(key => keys.includes(key))) {
    return false;
  }
  
  if (keyValidator && !keys.every(key => keyValidator(key))) {
    return false;
  }
  
  if (valueValidator && !keys.every(key => valueValidator(value[key]))) {
    return false;
  }
  
  return true;
};

// Existence validation (check if resource exists)
const existsInDatabase = async (model, field, value) => {
  const result = await model.findOne({ where: { [field]: value } });
  return !!result;
};

// Uniqueness validation (check if resource is unique)
const isUniqueInDatabase = async (model, field, value, excludeId = null) => {
  const where = { [field]: value };
  
  if (excludeId) {
    where.id = { [Op.ne]: excludeId };
  }
  
  const result = await model.findOne({ where });
  return !result;
};

// Custom validation function
const createValidator = (rules) => {
  return (value) => {
    for (const [field, rule] of Object.entries(rules)) {
      const { validator, message } = rule;
      
      if (!validator(value)) {
        return { valid: false, field, message };
      }
    }
    
    return { valid: true };
  };
};

// Validate request body
const validateRequestBody = (body, schema) => {
  const errors = [];
  
  for (const [field, rules] of Object.entries(schema)) {
    const value = body[field];
    
    // Check if required
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push({ field, message: `${field} is required` });
      continue;
    }
    
    // Skip if not required and not provided
    if (value === undefined || value === null) {
      continue;
    }
    
    // Check type
    if (rules.type && typeof value !== rules.type) {
      errors.push({ field, message: `${field} must be a ${rules.type}` });
      continue;
    }
    
    // Check custom validator
    if (rules.validator && !rules.validator(value)) {
      errors.push({ field, message: rules.message || `${field} is invalid` });
      continue;
    }
    
    // Check min length
    if (rules.minLength !== undefined && typeof value === 'string' && value.length < rules.minLength) {
      errors.push({ field, message: `${field} must be at least ${rules.minLength} characters` });
      continue;
    }
    
    // Check max length
    if (rules.maxLength !== undefined && typeof value === 'string' && value.length > rules.maxLength) {
      errors.push({ field, message: `${field} must be at most ${rules.maxLength} characters` });
      continue;
    }
    
    // Check min value
    if (rules.min !== undefined && typeof value === 'number' && value < rules.min) {
      errors.push({ field, message: `${field} must be at least ${rules.min}` });
      continue;
    }
    
    // Check max value
    if (rules.max !== undefined && typeof value === 'number' && value > rules.max) {
      errors.push({ field, message: `${field} must be at most ${rules.max}` });
      continue;
    }
    
    // Check pattern
    if (rules.pattern && typeof value === 'string' && !new RegExp(rules.pattern).test(value)) {
      errors.push({ field, message: `${field} does not match the required pattern` });
      continue;
    }
    
    // Check enum
    if (rules.enum && !rules.enum.includes(value)) {
      errors.push({ field, message: `${field} must be one of: ${rules.enum.join(', ')}` });
      continue;
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

// Common schemas
const schemas = {
  // User schemas
  user: {
    email: { required: true, validator: isValidEmail, message: 'Invalid email format' },
    username: { required: true, validator: isValidUsername, message: 'Username must be 3-80 alphanumeric characters' },
    password: { required: true, validator: (p) => isValidPassword(p, { minLength: 8 }), message: 'Password must be at least 8 characters' },
    displayName: { required: false, validator: isValidDisplayName, message: 'Display name must be 1-200 characters' }
  },
  
  // Profile schemas
  profile: {
    displayName: { required: false, validator: isValidDisplayName, message: 'Display name must be 1-200 characters' },
    bio: { required: false, validator: isValidBio, message: 'Bio must be at most 5000 characters' },
    website: { required: false, validator: (url) => isValidUrl(url, { requireHttps: false }), message: 'Invalid website URL' },
    location: { required: false, validator: isValidDisplayName, message: 'Location must be 1-200 characters' },
    language: { required: false, validator: isValidLanguage, message: 'Invalid language code' },
    timezone: { required: false, validator: isValidTimezone, message: 'Invalid timezone' }
  },
  
  // Node schemas
  node: {
    name: { required: true, validator: isValidDisplayName, message: 'Node name is required' },
    url: { required: true, validator: (url) => isValidUrl(url, { requireHttps: true }), message: 'Invalid node URL' },
    type: { required: true, validator: (type) => ['storage', 'compute', 'gateway', 'proxy', 'cache', 'indexer', 'validator'].includes(type), message: 'Invalid node type' },
    region: { required: false, validator: isValidDisplayName, message: 'Region must be 1-100 characters' },
    country: { required: false, validator: isValidCountryCode, message: 'Invalid country code' }
  },
  
  // Storage schemas
  storageObject: {
    name: { required: true, validator: isValidFilename, message: 'Invalid object name' },
    type: { required: false, validator: (type) => ['file', 'image', 'video', 'audio', 'document', 'archive', 'other'].includes(type), message: 'Invalid object type' },
    mimeType: { required: false, validator: isValidMimeType, message: 'Invalid MIME type' },
    size: { required: false, validator: (size) => isValidSize(size, { min: 0, max: 10 * 1024 * 1024 * 1024 }), message: 'Invalid size' },
    visibility: { required: false, validator: (visibility) => ['private', 'public', 'shared', 'internal'].includes(visibility), message: 'Invalid visibility' }
  },
  
  // Community schemas
  community: {
    name: { required: true, validator: isValidDisplayName, message: 'Community name is required' },
    type: { required: false, validator: (type) => ['public', 'private', 'invite_only', 'restricted'].includes(type), message: 'Invalid community type' },
    category: { required: false, validator: isValidDisplayName, message: 'Category must be 1-100 characters' },
    description: { required: false, validator: isValidDescription, message: 'Description must be at most 5000 characters' },
    tags: { required: false, validator: (tags) => isValidTags(tags, 50), message: 'Invalid tags' }
  },
  
  // Service schemas
  service: {
    name: { required: true, validator: isValidDisplayName, message: 'Service name is required' },
    type: { required: true, validator: (type) => ['social', 'messaging', 'storage', 'media', 'collaboration', 'productivity', 'entertainment', 'utility'].includes(type), message: 'Invalid service type' },
    url: { required: true, validator: (url) => isValidUrl(url, { requireHttps: true }), message: 'Invalid service URL' },
    description: { required: false, validator: isValidDescription, message: 'Description must be at most 5000 characters' }
  }
};

// Validation middleware
const validate = (schema) => {
  return (req, res, next) => {
    const { valid, errors } = validateRequestBody(req.body, schema);
    
    if (!valid) {
      return res.status(400).json({
        error: true,
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        errors,
        timestamp: new Date().toISOString()
      });
    }
    
    next();
  };
};

module.exports = {
  // Validation functions
  isValidEmail,
  isValidUsername,
  isValidPassword,
  isValidUrl,
  isValidUUID,
  isValidHayerId,
  isValidNodeId,
  isValidServiceId,
  isValidCommunityId,
  isValidToken,
  isValidHash,
  isValidPublicKey,
  isValidPrivateKey,
  isValidIP,
  isValidIPv4,
  isValidIPv6,
  isValidCIDR,
  isValidDomain,
  isValidPort,
  isValidSize,
  isValidFileSize,
  isValidMimeType,
  isValidFileExtension,
  isValidFilename,
  isValidDisplayName,
  isValidDescription,
  isValidBio,
  isValidTag,
  isValidTags,
  isValidColor,
  isValidLanguage,
  isValidTimezone,
  isValidCountryCode,
  isValidPhoneNumber,
  isValidDate,
  isValidDateString,
  isValidTime,
  isValidJson,
  isValidBase64,
  isValidHex,
  isValidNumeric,
  isValidInteger,
  isValidBoolean,
  isValidArray,
  isValidObject,
  
  // Database validation
  existsInDatabase,
  isUniqueInDatabase,
  
  // Schema validation
  createValidator,
  validateRequestBody,
  validate,
  
  // Common schemas
  schemas,
  
  // Default export
  default: {
    isValidEmail,
    isValidUsername,
    isValidPassword,
    isValidUrl,
    isValidUUID,
    validateRequestBody,
    validate
  }
};
