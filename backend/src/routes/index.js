const express = require('express');
const router = express.Router();

// Import route files
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const hayerIdRoutes = require('./hayerId.routes');
const profileRoutes = require('./profile.routes');
const nodeRoutes = require('./node.routes');
const operatorRoutes = require('./operator.routes');
const storageRoutes = require('./storage.routes');
const serviceRoutes = require('./service.routes');
const communityRoutes = require('./community.routes');
const notificationRoutes = require('./notification.routes');
const adminRoutes = require('./admin.routes');
const healthRoutes = require('./health.routes');
const registryRoutes = require('./registry.routes');

// API version prefix
const API_VERSION = '/v1';

// Health check routes
router.use('/health', healthRoutes);

// Registry routes (public)
router.use('/registry', registryRoutes);

// Authentication routes (public)
router.use(`${API_VERSION}/auth`, authRoutes);

// User routes
router.use(`${API_VERSION}/users`, userRoutes);

// HAYER ID routes
router.use(`${API_VERSION}/hayer-ids`, hayerIdRoutes);

// Profile routes
router.use(`${API_VERSION}/profiles`, profileRoutes);

// Node routes
router.use(`${API_VERSION}/nodes`, nodeRoutes);

// Operator routes
router.use(`${API_VERSION}/operators`, operatorRoutes);

// Storage routes
router.use(`${API_VERSION}/storage`, storageRoutes);

// Service routes
router.use(`${API_VERSION}/services`, serviceRoutes);

// Community routes
router.use(`${API_VERSION}/communities`, communityRoutes);

// Notification routes
router.use(`${API_VERSION}/notifications`, notificationRoutes);

// Admin routes
router.use(`${API_VERSION}/admin`, adminRoutes);

// API documentation route
router.get('/docs', (req, res) => {
  res.json({
    message: 'HAYER API Documentation',
    version: '1.0.0',
    endpoints: {
      auth: `${API_VERSION}/auth`,
      users: `${API_VERSION}/users`,
      hayerIds: `${API_VERSION}/hayer-ids`,
      profiles: `${API_VERSION}/profiles`,
      nodes: `${API_VERSION}/nodes`,
      operators: `${API_VERSION}/operators`,
      storage: `${API_VERSION}/storage`,
      services: `${API_VERSION}/services`,
      communities: `${API_VERSION}/communities`,
      notifications: `${API_VERSION}/notifications`,
      admin: `${API_VERSION}/admin`,
      health: '/health',
      registry: '/registry'
    }
  });
});

// OpenAPI specification route
router.get('/openapi.json', (req, res) => {
  res.json({
    openapi: '3.1.0',
    info: {
      title: 'HAYER API',
      version: '1.0.0',
      description: 'Unified Armenian Digital Ecosystem API',
      contact: {
        name: 'HAYER Team',
        email: 'team@hayer.local'
      },
      license: {
        name: 'AGPL-3.0',
        url: 'https://www.gnu.org/licenses/agpl-3.0.html'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000/api',
        description: 'Development server'
      },
      {
        url: 'https://api.hayer.local/api',
        description: 'Production server'
      }
    ],
    paths: {
      '/auth/register': {
        post: {
          tags: ['Authentication'],
          summary: 'Register a new user',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/RegisterRequest'
                }
              }
            }
          },
          responses: {
            201: {
              description: 'User registered successfully'
            },
            400: {
              description: 'Invalid request'
            },
            409: {
              description: 'User already exists'
            }
          }
        }
      },
      '/auth/login': {
        post: {
          tags: ['Authentication'],
          summary: 'Login with email and password',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/LoginRequest'
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Login successful'
            },
            401: {
              description: 'Invalid credentials'
            }
          }
        }
      },
      '/auth/logout': {
        post: {
          tags: ['Authentication'],
          summary: 'Logout current user',
          security: [
            {
              bearerAuth: []
            }
          ],
          responses: {
            200: {
              description: 'Logout successful'
            }
          }
        }
      },
      '/auth/refresh': {
        post: {
          tags: ['Authentication'],
          summary: 'Refresh access token',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    refreshToken: {
                      type: 'string'
                    }
                  },
                  required: ['refreshToken']
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Token refreshed successfully'
            },
            401: {
              description: 'Invalid refresh token'
            }
          }
        }
      }
    },
    components: {
      schemas: {
        RegisterRequest: {
          type: 'object',
          properties: {
            email: {
              type: 'string',
              format: 'email'
            },
            username: {
              type: 'string'
            },
            password: {
              type: 'string',
              minLength: 8
            },
            displayName: {
              type: 'string'
            }
          },
          required: ['email', 'username', 'password']
        },
        LoginRequest: {
          type: 'object',
          properties: {
            email: {
              type: 'string',
              format: 'email'
            },
            username: {
              type: 'string'
            },
            password: {
              type: 'string'
            }
          },
          required: ['password'],
          oneOf: [
            { required: ['email'] },
            { required: ['username'] }
          ]
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            email: {
              type: 'string',
              format: 'email'
            },
            username: {
              type: 'string'
            },
            displayName: {
              type: 'string'
            },
            isActive: {
              type: 'boolean'
            },
            isVerified: {
              type: 'boolean'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        HayerId: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            userId: {
              type: 'string',
              format: 'uuid'
            },
            hayerId: {
              type: 'string'
            },
            isPrimary: {
              type: 'boolean'
            }
          }
        }
      },
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    }
  });
});

// Root route
router.get('/', (req, res) => {
  res.json({
    message: 'HAYER API Gateway',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
