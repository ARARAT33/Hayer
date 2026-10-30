const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { createLogger, transports, format } = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const { sequelize } = require('./models');
const apiRouter = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');
const securityMiddleware = require('./middleware/security');

// Create app
const app = express();

// Ensure directories exist
const ensureDirs = () => {
  const dirs = [
    path.join(__dirname, '../logs'),
    path.join(__dirname, '../uploads'),
    path.join(__dirname, '../temp'),
    config.backup.dir
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

ensureDirs();

// Configure Winston logger
const logger = createLogger({
  level: config.logging.level,
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    }),
    new DailyRotateFile({
      filename: path.join(config.logging.filePath, `${config.logging.fileName}-%DATE%.log`),
      datePattern: 'YYYY-MM-DD',
      maxSize: config.logging.maxSize,
      maxFiles: config.logging.maxFiles,
      format: format.combine(
        format.timestamp(),
        format.json()
      )
    }),
    new transports.File({
      filename: path.join(config.logging.filePath, `${config.logging.fileName}.error.log`),
      level: 'error',
      format: format.combine(
        format.timestamp(),
        format.json()
      )
    })
  ],
  exceptionHandlers: [
    new DailyRotateFile({
      filename: path.join(config.logging.filePath, `${config.logging.fileName}-exceptions-%DATE%.log`),
      datePattern: 'YYYY-MM-DD',
      maxSize: config.logging.maxSize,
      maxFiles: config.logging.maxFiles
    })
  ],
  rejectionHandlers: [
    new DailyRotateFile({
      filename: path.join(config.logging.filePath, `${config.logging.fileName}-rejections-%DATE%.log`),
      datePattern: 'YYYY-MM-DD',
      maxSize: config.logging.maxSize,
      maxFiles: config.logging.maxFiles
    })
  ]
});

// Make logger available globally
app.set('logger', logger);

// Trust proxy if in production
if (config.env === 'production') {
  app.set('trust proxy', true);
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: config.security.contentSecurityPolicy,
  hsts: config.security.hsts
}));

// CORS configuration
app.use(cors({
  origin: config.cors.origin,
  methods: config.cors.methods,
  allowedHeaders: config.cors.allowedHeaders,
  credentials: true,
  maxAge: 86400
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: config.rateLimit.message,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/api/health';
  }
});
app.use(limiter);

// Request logging
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));

// Parse request bodies
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Cookie parser
app.use(cookieParser(config.session.secret));

// Compression
app.use(compression());

// Security headers
app.use(securityMiddleware);

// Request logger middleware
app.use(requestLogger);

// API routes
app.use('/api', apiRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    service: 'hayer-backend'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'HAYER Backend API',
    version: '1.0.0',
    docs: '/api/docs',
    health: '/health'
  });
});

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Path ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString()
  });
});

// Error handler
app.use(errorHandler);

// Database connection test
const testDatabaseConnection = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established successfully');
    
    // Test models sync (in development only)
    if (config.env === 'development') {
      await sequelize.sync({ alter: true });
      logger.info('Database models synchronized');
    }
  } catch (error) {
    logger.error('Database connection error:', error.message);
    setTimeout(testDatabaseConnection, 5000);
  }
};

// Initialize database connection
if (config.env !== 'test') {
  testDatabaseConnection();
}

// Start server
const PORT = config.port;
const HOST = config.host;

const server = app.listen(PORT, HOST, () => {
  logger.info(`HAYER Backend server running on http://${HOST}:${PORT}`);
  logger.info(`Environment: ${config.env}`);
  logger.info(`Database: ${config.db.host}:${config.db.port}/${config.db.name}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error.message, error.stack);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(async () => {
    try {
      await sequelize.close();
      logger.info('Database connection closed');
      logger.info('Server stopped');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error.message);
      process.exit(1);
    }
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  server.close(async () => {
    try {
      await sequelize.close();
      logger.info('Database connection closed');
      logger.info('Server stopped');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error.message);
      process.exit(1);
    }
  });
});

module.exports = { app, server, logger };
