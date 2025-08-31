// server/server.js
require('dotenv').config(); // Load environment variables from .env
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');
const winston = require('winston');
const path = require('path');
const LDTGenerator = require('./utils/ldtGenerator');
const PDFGenerator = require('./utils/pdfGenerator');
const { UserModel, USER_ROLES, ROLE_PERMISSIONS } = require('./models/User');
const bodyParser = require('body-parser');
const parseLDT = require('./utils/ldtParser');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const promClient = require('prom-client');

const app = express();
const PORT = process.env.PORT || 5000;

// Swagger/OpenAPI setup
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Lab Results API',
    version: '1.0.0',
    description: 'API documentation for Lab Results Management System',
  },
  servers: [
    { url: 'http://localhost:' + PORT },
  ],
};

const swaggerOptions = {
  swaggerDefinition,
  apis: ['./server.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Initialize cache with optimized settings
const cache = new NodeCache({ 
  stdTTL: 3600, // 1 hour default TTL
  checkperiod: 600, // Check every 10 minutes
  useClones: false, // Better performance for large objects
  maxKeys: 1000, // Maximum cache entries
  deleteOnExpire: true, // Automatically delete expired entries
});

// Initialize Prometheus metrics
const collectDefaultMetrics = promClient.collectDefaultMetrics;
const register = new promClient.Registry();
collectDefaultMetrics({ register });

// Basic request counter
const httpRequestCounter = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
});
register.registerMetric(httpRequestCounter);

// Enhanced token management with expiration tracking
const tokenStore = new Map(); // token -> { userId, expiresAt, revoked }
const revokedTokens = new Set();

// Clean up expired tokens every hour
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of tokenStore.entries()) {
    if (data.expiresAt < now || data.revoked) {
      tokenStore.delete(token);
      revokedTokens.delete(token);
    }
  }
}, 60 * 60 * 1000); // Every hour

// Ensure raw logs directory exists for append-only raw message storage
const RAW_LOG_DIR = path.join(__dirname, 'logs_raw');
try {
  if (!fs.existsSync(RAW_LOG_DIR)) {
    fs.mkdirSync(RAW_LOG_DIR, { recursive: true });
  }
} catch (e) {
  // non-fatal
}

// Initialize user model
const userModel = new UserModel();

// Basic tenant resolver: derive tenant from subdomain or header
function resolveTenantId(req) {
  const headerTenant = req.headers['x-tenant-id'];
  if (headerTenant && typeof headerTenant === 'string') return headerTenant;
  const host = req.headers.host || '';
  const parts = host.split('.');
  if (parts.length > 2) {
    return parts[0];
  }
  return process.env.DEFAULT_TENANT_ID || 'default';
}

app.use((req, res, next) => {
  req.tenantId = resolveTenantId(req);
  next();
});

// Configure logger with performance optimizations
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.colorize(),
    winston.format.simple()
  ),
  defaultMeta: { service: 'lab-results-api' },
  transports: [
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ],
});

// Production-ready middleware with enhanced security
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https:"],
      objectSrc: ["'none"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  // Enhanced security headers
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  // Additional security headers
  noSniff: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  permittedCrossDomainPolicies: { permittedPolicies: "none" },
  frameguard: { action: "deny" },
  xssFilter: true,
  hidePoweredBy: true
}));

// Additional security headers
app.use((req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions policy
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Content security policy for additional protection
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https:; connect-src 'self'; object-src 'none'; media-src 'self'; frame-src 'none'; base-uri 'self'; form-action 'self'");
  }
  
  next();
});

// Optimized compression with better settings
app.use(compression({
  filter: (req, res) => {
    // Don't compress small responses or already compressed content
    if (req.headers['x-no-compression'] || 
        req.headers['content-encoding'] ||
        req.headers['content-length'] < 1024) {
      return false;
    }
    return compression.filter(req, res);
  },
  threshold: 1024, // Only compress responses larger than 1KB
  level: 6, // Balanced compression level
  memLevel: 8, // Memory usage for compression
}));

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (err) {
    res.status(500).send('Metrics collection error');
  }
});

// Rate limiting with different strategies for production security
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // Limit each IP
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  // Enhanced security for production
  keyGenerator: (req) => {
    // Use IP + user agent for better rate limiting
    return req.ip + ':' + (req.headers['user-agent'] || 'unknown');
  },
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil(15 * 60 / 1000) // 15 minutes in seconds
    });
  }
});

// Stricter rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 3 : 10, // Stricter in production
  message: 'Too many login attempts, please try again later.',
  skipSuccessfulRequests: true,
  skipFailedRequests: false,
  keyGenerator: (req) => req.ip,
  handler: (req, res) => {
    logger.warn(`Auth rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Too many authentication attempts. Account may be temporarily locked.',
      retryAfter: Math.ceil(15 * 60 / 1000)
    });
  }
});

// Rate limiting for download endpoints
const downloadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: process.env.NODE_ENV === 'production' ? 10 : 50, // Stricter in production
  message: 'Too many download requests, please try again later.',
  skipSuccessfulRequests: true,
  skipFailedRequests: false,
  keyGenerator: (req) => req.ip,
  handler: (req, res) => {
    logger.warn(`Download rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Too many download requests, please try again later.',
      retryAfter: Math.ceil(5 * 60 / 1000)
    });
  }
});

// Rate limiting for admin endpoints
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 50 : 200, // Stricter for admin operations
  message: 'Too many admin requests, please try again later.',
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  keyGenerator: (req) => req.ip,
  handler: (req, res) => {
    logger.warn(`Admin rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Too many admin requests, please try again later.',
      retryAfter: Math.ceil(15 * 60 / 1000)
    });
  }
});

// Apply rate limiting to different route groups
app.use('/api/', limiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/setup-2fa', authLimiter);
app.use('/api/auth/verify-2fa', authLimiter);
app.use('/api/download', downloadLimiter);
app.use('/api/admin', adminLimiter);
app.use('/api/users', adminLimiter);

// CORS configuration with optimizations
const buildAllowedOrigins = () => {
  if (process.env.NODE_ENV !== 'production') {
    return ['http://localhost:3000', 'http://127.0.0.1:3000'];
  }
  const fromEnv = (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  return fromEnv;
};

const allowedOrigins = buildAllowedOrigins();

const corsOptions = {
  origin: function(origin, callback) {
    // Allow non-browser or same-origin requests (no Origin header)
    if (!origin) return callback(null, true);

    if (allowedOrigins.length === 0) {
      // If not configured in production, reflect the origin to avoid hard failures.
      // It is recommended to set FRONTEND_URLS in production.
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400, // Cache preflight requests for 24 hours
};
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

// Enhanced body parsing with security limits
const maxBodySize = process.env.NODE_ENV === 'production' ? '5mb' : '10mb';
const maxParams = process.env.NODE_ENV === 'production' ? 500 : 1000;

app.use(express.json({ 
  limit: maxBodySize,
  strict: true,
  type: 'application/json',
  verify: (req, res, buf) => {
    // Additional validation for JSON payloads
    if (buf.length > 5 * 1024 * 1024) { // 5MB hard limit
      throw new Error('Request body too large');
    }
    req.rawBody = buf;
  }
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: maxBodySize,
  parameterLimit: maxParams,
  verify: (req, res, buf) => {
    // Additional validation for URL-encoded payloads
    if (buf.length > 5 * 1024 * 1024) { // 5MB hard limit
      throw new Error('Request body too large');
    }
  }
}));

// Request size validation middleware
app.use((req, res, next) => {
  const contentLength = parseInt(req.headers['content-length'] || '0');
  
  if (contentLength > 5 * 1024 * 1024) { // 5MB limit
    logger.warn(`Request too large: ${contentLength} bytes from ${req.ip}`);
    return res.status(413).json({
      success: false,
      message: 'Request entity too large'
    });
  }
  
  next();
});

// Request logging middleware with performance tracking
app.use((req, res, next) => {
  const start = Date.now();
  const originalSend = res.send;
  
  res.send = function(data) {
    const duration = Date.now() - start;
    const bodyBuffer = Buffer.isBuffer(data) ? data : Buffer.from(typeof data === 'string' ? data : JSON.stringify(data || ''));
    const size = bodyBuffer.length;
    
    logger.info(`${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms - ${size}bytes - User: ${req.user?.email || 'anonymous'}`);
    
    // Add performance headers
    res.set('X-Response-Time', `${duration}ms`);
    res.set('X-Response-Size', `${size}bytes`);

    // Increment metrics counter
    try {
      httpRequestCounter.inc({ method: req.method, route: req.route?.path || req.originalUrl.split('?')[0], status: String(res.statusCode) });
    } catch (_) {}
    
    return originalSend.call(this, data);
  };
  
  next();
});

// Enhanced cache middleware with better performance
const cacheMiddleware = (duration = 300) => (req, res, next) => {
  // Skip cache for non-GET requests or when cache is disabled
  if (req.method !== 'GET' || req.headers['x-no-cache']) {
    return next();
  }
  
  const key = `${req.originalUrl}-${req.user?.userId || 'anonymous'}`;
  const cached = cache.get(key);
  
  if (cached) {
    logger.debug(`Cache hit for ${key}`);
    res.set('X-Cache', 'HIT');
    return res.json(cached);
  }
  
  // Override res.json to cache the response
  const originalJson = res.json;
  res.json = function(body) {
    // Only cache successful responses
    if (res.statusCode >= 200 && res.statusCode < 300) {
      cache.set(key, body, duration);
      logger.debug(`Cache set for ${key} (${duration}s)`);
    }
    
    res.set('X-Cache', 'MISS');
    return originalJson.call(this, body);
  };
  
  next();
};

// Async error handler
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Enhanced authentication middleware with token validation
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access token required' 
    });
  }

  // Check if token is revoked
  if (revokedTokens.has(token)) {
    return res.status(401).json({
      success: false,
      message: 'Token revoked'
    });
  }

  // Check token store for additional validation
  const tokenData = tokenStore.get(token);
  if (tokenData && tokenData.revoked) {
    return res.status(401).json({
      success: false,
      message: 'Token revoked'
    });
  }

  try {
    const decoded = userModel.verifyToken(token);
    
    // Additional token expiration check
    if (decoded.exp && Date.now() >= decoded.exp * 1000) {
      // Remove expired token
      tokenStore.delete(token);
      revokedTokens.add(token);
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    const user = userModel.getUserById(decoded.userId);
    
    if (!user) {
      return res.status(403).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    if (!user.isActive) {
      return res.status(403).json({ 
        success: false, 
        message: 'User account is disabled' 
      });
    }

    // Check if user's role has changed (token invalidation)
    if (user.role !== decoded.role) {
      // Revoke token if user role changed
      revokedTokens.add(token);
      tokenStore.delete(token);
      return res.status(401).json({
        success: false,
        message: 'Token invalidated due to role change'
      });
    }

    // Update token store with current user info
    tokenStore.set(token, {
      userId: user.id,
      expiresAt: decoded.exp ? decoded.exp * 1000 : Date.now() + (15 * 60 * 1000), // 15 minutes default
      revoked: false
    });

    req.user = user;
    next();
  } catch (error) {
    logger.warn(`Token validation failed: ${error.message}`, { 
      token: token.substring(0, 10) + '...',
      ip: req.ip 
    });
    
    res.status(403).json({ 
      success: false, 
      message: 'Invalid or expired token' 
    });
  }
};

// Permission middleware
const requirePermission = (permission) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (!userModel.hasPermission(req.user, permission)) {
    return res.status(403).json({
      success: false,
      message: 'Insufficient permissions'
    });
  }

  next();
};

// Admin only middleware
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== USER_ROLES.ADMIN) {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  next();
};

// Mock database with enhanced data isolation and LDT matching
const mockDatabase = {
  // Audit log for tracking access and changes
  auditLog: [],

  /**
   * Log an audit event
   * @param {string} event - Event type
   * @param {Object} user - User performing the action
   * @param {Object} details - Additional details
   */
  logAuditEvent(event, user, details = {}) {
    const auditEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      event,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      details,
      ipAddress: details.ipAddress || 'unknown'
    };
    
    this.auditLog.push(auditEntry);
    
    // Also log to Winston
    logger.info(`AUDIT: ${event}`, {
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      details
    });
  },
  // Enhanced results with user associations and LDT data
  results: [
    { 
      id: 'res001', 
      date: '2023-01-15', 
      type: 'Blood Count', 
      status: 'Final', 
      patient: 'Max Mustermann', 
      bsnr: '123456789', 
      lanr: '1234567', 
      doctorId: null, 
      assignedUsers: ['doctor@laborresults.de'],
      assignedTo: 'doctor@laborresults.de',
      ldtMessageId: null,
      createdAt: '2023-01-15T10:00:00.000Z',
      updatedAt: '2023-01-15T10:00:00.000Z'
    },
    { 
      id: 'res002', 
      date: '2023-01-10', 
      type: 'Urinalysis', 
      status: 'Final', 
      patient: 'Erika Musterfrau', 
      bsnr: '123456789', 
      lanr: '1234567', 
      doctorId: null, 
      assignedUsers: ['doctor@laborresults.de'],
      assignedTo: 'doctor@laborresults.de',
      ldtMessageId: null,
      createdAt: '2023-01-10T10:00:00.000Z',
      updatedAt: '2023-01-10T10:00:00.000Z'
    },
    { 
      id: 'res003', 
      date: '2023-01-05', 
      type: 'Microbiology', 
      status: 'Preliminary', 
      patient: 'Max Mustermann', 
      bsnr: '123456789', 
      lanr: '1234567', 
      doctorId: null, 
      assignedUsers: ['doctor@laborresults.de'],
      assignedTo: 'doctor@laborresults.de',
      ldtMessageId: null,
      createdAt: '2023-01-05T10:00:00.000Z',
      updatedAt: '2023-01-05T10:00:00.000Z'
    },
    { 
      id: 'res004', 
      date: '2023-01-20', 
      type: 'Chemistry Panel', 
      status: 'Final', 
      patient: 'Anna Schmidt', 
      bsnr: '123456789', 
      lanr: '1234568', 
      doctorId: null, 
      assignedUsers: ['lab@laborresults.de'],
      assignedTo: 'lab@laborresults.de',
      ldtMessageId: null,
      createdAt: '2023-01-20T10:00:00.000Z',
      updatedAt: '2023-01-20T10:00:00.000Z'
    },
    { 
      id: 'res005', 
      date: '2023-01-18', 
      type: 'Immunology', 
      status: 'Final', 
      patient: 'Peter Mueller', 
      bsnr: '123456789', 
      lanr: '1234568', 
      doctorId: null, 
      assignedUsers: ['lab@laborresults.de'],
      assignedTo: 'lab@laborresults.de',
      ldtMessageId: null,
      createdAt: '2023-01-18T10:00:00.000Z',
      updatedAt: '2023-01-18T10:00:00.000Z'
    },
  ],
 
  // Raw inbound LDT messages received from external systems
  ldtMessages: [],

  /**
   * Persist a newly received LDT message in memory.
   * @param {object} messageObj { id, receivedAt, raw, parsed }
   */
  addLDTMessage(messageObj) {
    this.ldtMessages.push(messageObj);
  },

  /**
   * Extract BSNR and LANR from LDT records
   * @param {Array} parsedRecords - Array of parsed LDT records
   * @returns {Object} { bsnr, lanr, patientData }
   */
  extractLDTIdentifiers(parsedRecords) {
    let bsnr = null;
    let lanr = null;
    let patientData = {};

    for (const record of parsedRecords) {
      // Look for BSNR and LANR in various record types
      if (record.recordType === '8100') {
        // BSNR and LANR might be in different field IDs
        if (record.fieldId === '0201' || record.fieldId === '0020') {
          bsnr = record.content;
        } else if (record.fieldId === '0202' || record.fieldId === '0021') {
          lanr = record.content;
        }
      }

      // Look for patient data in record type 8200 (Patient data)
      if (record.recordType === '8200') {
        if (record.fieldId === '3101') {
          patientData.lastName = record.content;
        } else if (record.fieldId === '3102') {
          patientData.firstName = record.content;
        } else if (record.fieldId === '3103') {
          patientData.birthDate = record.content;
        } else if (record.fieldId === '3110') {
          patientData.gender = record.content;
        }
      }

      // Look for BSNR in record type 0201 (Lab info)
      if (record.recordType === '0201') {
        if (record.fieldId === '7981') {
          bsnr = record.content;
        }
      }

      // Look for LANR in record type 0212 (Lab info)
      if (record.recordType === '0212') {
        if (record.fieldId === '7733') {
          lanr = record.content;
        }
      }

      // Look for patient data in various record types
      if (record.recordType === '3101') {
        patientData.lastName = record.content;
      } else if (record.recordType === '3102') {
        patientData.firstName = record.content;
      } else if (record.recordType === '3103') {
        patientData.birthDate = record.content;
      } else if (record.recordType === '3110') {
        patientData.gender = record.content;
      }
    }

    // If we don't find standard BSNR/LANR, try to extract from other fields
    if (!bsnr || !lanr) {
      for (const record of parsedRecords) {
        // Look for potential identifiers in various fields
        if (record.content && record.content.length >= 5) {
          // Try to find BSNR-like patterns (9 digits)
          if (/^\d{9}$/.test(record.content)) {
            bsnr = record.content;
          }
          // Try to find LANR-like patterns (7 digits)
          else if (/^\d{7}$/.test(record.content)) {
            lanr = record.content;
          }
        }
      }
    }

    return { bsnr, lanr, patientData };
  },

  /**
   * Find user by BSNR and LANR
   * @param {string} bsnr - BSNR value
   * @param {string} lanr - LANR value
   * @returns {Object|null} User object or null if not found
   */
  findUserByBsnrLanr(bsnr, lanr) {
    if (!bsnr || !lanr) return null;
    
    // Use the userModel to find the user
    return userModel.getUserByBsnrLanr(bsnr, lanr);
  },

  /**
   * Create a new result from LDT data
   * @param {Object} ldtData - Extracted LDT data
   * @param {string} ldtMessageId - ID of the LDT message
   * @returns {Object} New result object
   */
  createResultFromLDT(ldtData, ldtMessageId) {
    const resultId = `res_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const result = {
      id: resultId,
      date: new Date().toISOString().slice(0, 10),
      type: 'LDT Import',
      status: 'Final',
      patient: `${ldtData.patientData.firstName || ''} ${ldtData.patientData.lastName || ''}`.trim() || 'Unknown Patient',
      bsnr: ldtData.bsnr,
      lanr: ldtData.lanr,
      doctorId: null,
      assignedUsers: [],
      assignedTo: null, // Will be set if user is found
      ldtMessageId: ldtMessageId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      patientData: ldtData.patientData
    };

    // Try to find and assign user
    if (ldtData.bsnr && ldtData.lanr) {
      const user = this.findUserByBsnrLanr(ldtData.bsnr, ldtData.lanr);
      if (user) {
        result.assignedTo = user.email;
        result.assignedUsers = [user.email];
        result.doctorId = user.id;
      }
    }

    return result;
  },
  
  // Get results based on user role and permissions
  getResultsForUser(user) {
    let filteredResults = this.results;

    switch (user.role) {
      case USER_ROLES.ADMIN:
        // Admins can see all results (including unassigned)
        return filteredResults;
        
      case USER_ROLES.LAB_TECHNICIAN:
        // Lab technicians can only see results explicitly assigned to them
        return filteredResults.filter(result =>
          result.assignedTo === user.email ||
          result.assignedUsers.includes(user.email)
        );
        
      case USER_ROLES.DOCTOR:
        // Doctors can only see results assigned to them or matching their BSNR/LANR
        return filteredResults.filter(result => 
          result.assignedTo === user.email ||
          (result.bsnr === user.bsnr && result.lanr === user.lanr) ||
          result.assignedUsers.includes(user.email) ||
          result.doctorId === user.id
        );
        
      case USER_ROLES.PATIENT:
        // Patients can only see their own results (would need patient ID matching)
        return filteredResults.filter(result => 
          result.patientEmail === user.email // This would be implemented with proper patient records
        );
        
      default:
        return [];
    }
  },

  /**
   * Get unassigned results (for admin review)
   * @param {Object} user - User object
   * @returns {Array} Array of unassigned results
   */
  getUnassignedResults(user) {
    if (user.role !== USER_ROLES.ADMIN) {
      return [];
    }
    
    return this.results.filter(result => !result.assignedTo);
  },

  /**
   * Manually assign a result to a user
   * @param {string} resultId - Result ID
   * @param {string} userEmail - User email to assign to
   * @param {Object} user - Admin user making the assignment
   * @returns {Object|null} Updated result or null if not found
   */
  assignResultToUser(resultId, userEmail, user) {
    if (user.role !== USER_ROLES.ADMIN) {
      return null;
    }

    const result = this.results.find(r => r.id === resultId);
    if (!result) return null;

    // Find the target user
    const targetUser = userModel.getUserByEmail(userEmail);
    if (!targetUser) return null;

    // Update the result
    result.assignedTo = userEmail;
    result.assignedUsers = [userEmail];
    result.doctorId = targetUser.id;
    result.updatedAt = new Date().toISOString();

    // Log the assignment
    logger.info(`Result ${resultId} assigned to ${userEmail} by admin ${user.email}`);

    return result;
  },

  getResultById(id, user) {
    const result = this.results.find(r => r.id === id);
    if (!result) return null;

    // Check if user has access to this result
    const userResults = this.getResultsForUser(user);
    return userResults.find(r => r.id === id) || null;
  }
};

// --- API Routes ---

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    userStats: userModel.getUserStats()
  });
});

// Create initial admin user (only if no users exist)
app.post('/api/setup/initial-admin', asyncHandler(async (req, res) => {
  // Only allow if no users exist
  const userStats = userModel.getUserStats();
  if (userStats.total > 0) {
    return res.status(403).json({
      success: false,
      message: 'Users already exist. Initial admin setup not allowed.'
    });
  }

  const { email, password, firstName, lastName } = req.body;

  // Validation
  if (!email || !password || !firstName || !lastName) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: email, password, firstName, lastName'
    });
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid email format'
    });
  }

  // Password validation (relaxed for initial setup)
  if (password.length < 8) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 8 characters long'
    });
  }

  try {
    const adminUser = await userModel.createUser({
      email,
      password,
      firstName,
      lastName,
      role: USER_ROLES.ADMIN,
      bsnr: '999999999',
      lanr: '9999999',
      isActive: true
    });

    // Generate JWT token for immediate use
    const token = userModel.generateToken(adminUser);

    logger.info(`Initial admin user created: ${adminUser.email}`);

    res.status(201).json({
      success: true,
      message: 'Initial admin user created successfully',
      user: adminUser,
      token,
      securityWarning: 'CHANGE THE DEFAULT PASSWORD IMMEDIATELY!'
    });
  } catch (error) {
    logger.error(`Initial admin creation failed: ${error.message}`);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}));

// === AUTHENTICATION ROUTES ===

// Legacy login endpoint for backward compatibility
app.post('/api/login', asyncHandler(async (req, res) => {
  const { bsnr, lanr, password } = req.body;

  // Input validation
  if (!bsnr || !lanr || !password) {
    return res.status(400).json({
      success: false,
      message: 'BSNR, LANR, and password are required'
    });
  }

  try {
    const authResult = await userModel.authenticateUser(null, password, bsnr, lanr);
    
    logger.info(`Successful legacy login for user: ${authResult.user.email} (${authResult.user.role})`);
    
    res.json({
      success: true,
      message: 'Login successful',
      token: authResult.token
    });
  } catch (error) {
    logger.warn(`Failed legacy login attempt: ${bsnr}/${lanr} - ${error.message}`);
    
    res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }
}));

// Enhanced login endpoint with 2FA support
app.post('/api/auth/login', asyncHandler(async (req, res) => {
  const { email, password, bsnr, lanr, otp } = req.body;

  // Input validation
  if ((!email && (!bsnr || !lanr)) || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email or BSNR/LANR and password are required'
    });
  }

  try {
    const authResult = await userModel.authenticateUser(email, password, bsnr, lanr, otp);
    
    logger.info(`Successful login for user: ${authResult.user.email} (${authResult.user.role})`);
    
    res.json({
      success: true,
      message: 'Login successful',
      token: authResult.token,
      user: authResult.user
    });
  } catch (error) {
    logger.warn(`Failed login attempt: ${email || `${bsnr}/${lanr}`} - ${error.message}`);
    
    res.status(401).json({
      success: false,
      message: error.message
    });
  }
}));

// Get current user info
app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

// Enhanced logout endpoint with proper token revocation
app.post('/api/auth/logout', authenticateToken, (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (token) {
    // Add to revoked tokens set
    revokedTokens.add(token);
    
    // Update token store
    const tokenData = tokenStore.get(token);
    if (tokenData) {
      tokenData.revoked = true;
      tokenStore.set(token, tokenData);
    }
    
    // Log the logout event
    logger.info(`User logged out: ${req.user.email}`, {
      userId: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
  }
  
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Force logout all user sessions (admin only)
app.post('/api/auth/logout-all', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({
      success: false,
      message: 'User ID is required'
    });
  }
  
  // Revoke all tokens for the specified user
  let revokedCount = 0;
  for (const [token, data] of tokenStore.entries()) {
    if (data.userId === userId) {
      data.revoked = true;
      revokedTokens.add(token);
      revokedCount++;
    }
  }
  
  logger.info(`Admin ${req.user.email} force logged out user ${userId}`, {
    adminId: req.user.id,
    targetUserId: userId,
    revokedTokens: revokedCount
  });
  
  res.json({
    success: true,
    message: `Successfully logged out user. ${revokedCount} sessions revoked.`
  });
}));

// --- TWO-FACTOR AUTHENTICATION ROUTES ---

// Generate a new 2FA secret for the authenticated user
app.post('/api/auth/setup-2fa', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { otpauthUrl, base32 } = userModel.generateTwoFactorSecret(req.user.id);
    res.json({ success: true, otpauthUrl, secret: base32 });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}));

// Verify the provided OTP and permanently enable 2FA
app.post('/api/auth/verify-2fa', authenticateToken, asyncHandler(async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ success: false, message: 'OTP token required' });
  }

  try {
    userModel.verifyAndEnableTwoFactor(req.user.id, token);
    res.json({ success: true, message: 'Two-factor authentication enabled successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}));

// === USER MANAGEMENT ROUTES ===

// Create new user (Admin only) with enhanced validation
app.post('/api/users', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  try {
    // Enhanced input validation
    const { email, password, firstName, lastName, role, bsnr, lanr } = req.body;
    
    // Required field validation
    if (!email || !password || !firstName || !lastName || !role) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: email, password, firstName, lastName, role'
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Name validation (prevent injection)
    const nameRegex = /^[a-zA-ZäöüßÄÖÜ\s\-']{2,50}$/;
    if (!nameRegex.test(firstName) || !nameRegex.test(lastName)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid name format. Names must be 2-50 characters and contain only letters, spaces, hyphens, and apostrophes.'
      });
    }

    // Role validation
    const validRoles = ['admin', 'doctor', 'lab_technician', 'patient'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be one of: admin, doctor, lab_technician, patient'
      });
    }

    // BSNR/LANR validation if provided
    if (bsnr && !/^\d{9}$/.test(bsnr)) {
      return res.status(400).json({
        success: false,
        message: 'BSNR must be exactly 9 digits'
      });
    }

    if (lanr && !/^\d{7}$/.test(lanr)) {
      return res.status(400).json({
        success: false,
        message: 'LANR must be exactly 7 digits'
      });
    }

    // Prevent admin from creating another admin in production
    if (process.env.NODE_ENV === 'production' && role === 'admin' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only existing admins can create new admin accounts in production'
      });
    }

    const newUser = await userModel.createUser(req.body);
    
    logger.info(`New user created: ${newUser.email} (${newUser.role}) by ${req.user.email}`);
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: newUser
    });
  } catch (error) {
    logger.error(`User creation failed: ${error.message}`, { 
      attemptedBy: req.user.email,
      attemptedData: { email: req.body.email, role: req.body.role }
    });
    
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}));

// Enhanced user registration with 2FA setup (Admin only)
app.post('/api/users/register-with-2fa', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  try {
    // Enhanced input validation (same as above)
    const { email, password, firstName, lastName, role, bsnr, lanr } = req.body;
    
    // Required field validation
    if (!email || !password || !firstName || !lastName || !role) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: email, password, firstName, lastName, role'
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Name validation (prevent injection)
    const nameRegex = /^[a-zA-ZäöüßÄÖÜ\s\-']{2,50}$/;
    if (!nameRegex.test(firstName) || !nameRegex.test(lastName)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid name format. Names must be 2-50 characters and contain only letters, spaces, hyphens, and apostrophes.'
      });
    }

    // Role validation
    const validRoles = ['admin', 'doctor', 'lab_technician', 'patient'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be one of: admin, doctor, lab_technician, patient'
      });
    }

    // BSNR/LANR validation if provided
    if (bsnr && !/^\d{9}$/.test(bsnr)) {
      return res.status(400).json({
        success: false,
        message: 'BSNR must be exactly 9 digits'
      });
    }

    if (lanr && !/^\d{7}$/.test(lanr)) {
      return res.status(400).json({
        success: false,
        message: 'LANR must be exactly 7 digits'
      });
    }

    // Create user first
    const newUser = await userModel.createUser(req.body);
    
    // Generate 2FA secret
    const { otpauthUrl, base32 } = userModel.generateTwoFactorSecret(newUser.id);
    
    // Generate QR code URL
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`;
    
    logger.info(`New user created with 2FA setup: ${newUser.email} (${newUser.role}) by ${req.user.email}`);
    
    // Return user info with 2FA setup data
    res.status(201).json({
      success: true,
      message: 'User created successfully with 2FA setup',
      user: newUser,
      twoFactorSetup: {
        otpauthUrl,
        secret: base32,
        qrCode: qrCodeUrl,
        instructions: [
          '1. Scan the QR code with your authenticator app',
          '2. Or manually enter the secret key',
          '3. The app will generate a 6-digit code',
          '4. Use that code when logging in'
        ]
      }
    });
  } catch (error) {
    logger.error(`User creation with 2FA failed: ${error.message}`, { 
      attemptedBy: req.user.email,
      attemptedData: { email: req.body.email, role: req.body.role }
    });
    
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}));

// Get all users (Admin only)
app.get('/api/users', authenticateToken, requireAdmin, (req, res) => {
  const { role, isActive, search } = req.query;
  
  const filters = {};
  if (role) filters.role = role;
  if (isActive !== undefined) filters.isActive = isActive === 'true';
  if (search) filters.search = search;
  
  const users = userModel.getAllUsers(filters);
  
  res.json({
    success: true,
    users,
    total: users.length,
    stats: userModel.getUserStats()
  });
});

// Get specific user (Admin or self)
app.get('/api/users/:userId', authenticateToken, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  
  // Users can view their own profile, admins can view any profile
  if (req.user.id !== userId && req.user.role !== USER_ROLES.ADMIN) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }
  
  const user = userModel.getUserById(userId);
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }
  
  res.json({
    success: true,
    user
  });
}));

// Update user (Admin or self for limited fields)
app.put('/api/users/:userId', authenticateToken, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const updates = req.body;
  
  // Users can update their own profile with limited fields
  if (req.user.id !== userId && req.user.role !== USER_ROLES.ADMIN) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }
  
  // Non-admin users can only update certain fields
  if (req.user.id === userId && req.user.role !== USER_ROLES.ADMIN) {
    const allowedFields = ['firstName', 'lastName', 'email', 'password', 'specialization', 'department'];
    const restrictedFields = Object.keys(updates).filter(field => !allowedFields.includes(field));
    
    if (restrictedFields.length > 0) {
      return res.status(403).json({
        success: false,
        message: `Cannot update restricted fields: ${restrictedFields.join(', ')}`
      });
    }
  }
  
  try {
    const updatedUser = await userModel.updateUser(userId, updates);
    
    logger.info(`User updated: ${updatedUser.email} by ${req.user.email}`);
    
    res.json({
      success: true,
      message: 'User updated successfully',
      user: updatedUser
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}));

// Delete user (Admin only)
app.delete('/api/users/:userId', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  
  // Prevent admin from deleting themselves
  if (req.user.id === userId) {
    return res.status(400).json({
      success: false,
      message: 'Cannot delete your own account'
    });
  }
  
  try {
    const user = userModel.getUserById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    userModel.deleteUser(userId);
    
    logger.info(`User deleted: ${user.email} by ${req.user.email}`);
    
    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}));

// Get available roles (for user creation forms)
app.get('/api/roles', authenticateToken, (req, res) => {
  const roles = Object.entries(USER_ROLES).map(([key, value]) => ({
    key,
    value,
    permissions: ROLE_PERMISSIONS[value]
  }));
  
  res.json({
    success: true,
    roles
  });
});

// === ENHANCED RESULTS ROUTES WITH ACCESS CONTROL ===

// Get results with role-based filtering
app.get('/api/results', authenticateToken, cacheMiddleware(300), asyncHandler(async (req, res) => {
  logger.info(`Fetching results for user: ${req.user.email} (${req.user.role})`);
  
  const results = mockDatabase.getResultsForUser(req.user);
  
  // Add pagination support
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  
  const paginatedResults = results.slice(startIndex, endIndex);
  
  // Log audit event
  mockDatabase.logAuditEvent('RESULTS_ACCESSED', req.user, {
    resultCount: results.length,
    page,
    limit,
    ipAddress: req.ip
  });
  
  res.json({
    success: true,
    results: paginatedResults,
    pagination: {
      page,
      limit,
      total: results.length,
      pages: Math.ceil(results.length / limit)
    },
    userRole: req.user.role,
    permissions: req.user.permissions
  });
}));

// Get specific result with access control
app.get('/api/results/:resultId', authenticateToken, asyncHandler(async (req, res) => {
  const { resultId } = req.params;

  // Find regardless of access first
  const anyResult = mockDatabase.results.find(r => r.id === resultId);
  if (!anyResult) {
    return res.status(404).json({ success: false, message: 'Result not found' });
  }

  const accessible = mockDatabase.getResultsForUser(req.user).some(r => r.id === resultId);
  if (!accessible) {
    return res.status(403).json({ success: false, message: 'Access to result denied' });
  }

  // Log audit event
  mockDatabase.logAuditEvent('RESULT_ACCESSED', req.user, {
    resultId,
    patient: anyResult.patient,
    type: anyResult.type,
    ipAddress: req.ip
  });

  res.json({ success: true, result: anyResult });
}));

// === ADMIN ENDPOINTS ===

// Get unassigned results (Admin only)
app.get('/api/admin/unassigned-results', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const unassignedResults = mockDatabase.getUnassignedResults(req.user);
  
  res.json({
    success: true,
    results: unassignedResults,
    count: unassignedResults.length
  });
}));

// Assign result to user (Admin only)
app.post('/api/admin/assign-result', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { resultId, userEmail } = req.body;

  if (!resultId || !userEmail) {
    return res.status(400).json({
      success: false,
      message: 'Result ID and user email are required'
    });
  }

  const updatedResult = mockDatabase.assignResultToUser(resultId, userEmail, req.user);
  
  if (!updatedResult) {
    return res.status(404).json({
      success: false,
      message: 'Result not found or user not found'
    });
  }

  // Log audit event
  mockDatabase.logAuditEvent('RESULT_ASSIGNED', req.user, {
    resultId,
    assignedTo: userEmail,
    patient: updatedResult.patient,
    ipAddress: req.ip
  });

  res.json({
    success: true,
    message: `Result assigned to ${userEmail}`,
    result: updatedResult
  });
}));

// Get all users for assignment (Admin only)
app.get('/api/admin/users', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const users = userModel.getAllUsers({ isActive: true });
  
  res.json({
    success: true,
    users: users.map(user => ({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      bsnr: user.bsnr,
      lanr: user.lanr
    }))
  });
}));

// Get audit log (Admin only)
app.get('/api/admin/audit-log', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 100;
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  
  const auditLog = mockDatabase.auditLog
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(startIndex, endIndex);
  
  res.json({
    success: true,
    auditLog,
    pagination: {
      page,
      limit,
      total: mockDatabase.auditLog.length,
      pages: Math.ceil(mockDatabase.auditLog.length / limit)
    }
  });
}));

// Webhook security helpers
const WEBHOOK_MAX_SKEW_MS = 5 * 60 * 1000; // 5 minutes
const webhookReplayCache = new NodeCache({ stdTTL: 600, checkperiod: 120 });

function validateContentType(req, res) {
  const ct = (req.headers['content-type'] || '').toLowerCase();
  if (!(ct.includes('text/plain') || ct.includes('application/json'))) {
    res.status(415).json({ success: false, message: 'Unsupported Content-Type' });
    return false;
  }
  return true;
}

function computeBodySha256Hex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function validateWebhookSignature(req, res, next) {
  const secret = process.env.MIRTH_WEBHOOK_SECRET;
  if (!secret || typeof secret !== 'string' || secret.trim().length === 0) {
    return res.status(401).json({ success: false, message: 'Webhook secret not configured' });
  }

  const signatureHeader = req.headers['x-signature'] || req.headers['x-signature-sha256'];
  const timestampHeader = req.headers['x-timestamp'];
  const idempotencyKey = req.headers['idempotency-key'];

  if (!signatureHeader || !timestampHeader) {
    return res.status(401).json({ success: false, message: 'Missing signature or timestamp' });
  }

  // Replay protection
  const now = Date.now();
  const ts = Number(timestampHeader);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > WEBHOOK_MAX_SKEW_MS) {
    return res.status(401).json({ success: false, message: 'Invalid or expired timestamp' });
  }

  // Enforce request body type to prevent type confusion
  const bodyIsBuffer = Buffer.isBuffer(req.body);
  const bodyIsString = typeof req.body === 'string';

  // Only allow Buffer or string; reject everything else (arrays, objects, numbers, booleans, etc.)
  if (!(bodyIsBuffer || bodyIsString)) {
    return res.status(400).json({ success: false, message: 'Invalid request body type' });
  }

  const rawBody = bodyIsBuffer ? req.body : Buffer.from(req.body, 'utf8');

  // Type confusion protection: reject if req.body is an array or unexpected type
  if (Array.isArray(req.body) || (typeof req.body === 'object' && !(req.body instanceof Buffer) && req.body !== null)) {
    return res.status(400).json({ success: false, message: 'Invalid request body type' });
  }

  // Verify HMAC SHA256: expected format 'sha256=hex'
  const expected = crypto
    .createHmac('sha256', secret)
    .update(timestampHeader + '.' + rawBody)
    .digest('hex');

  const provided = signatureHeader.includes('=') ? signatureHeader.split('=')[1] : signatureHeader;
  // Guard against length mismatches to avoid throwing
  const expectedBuf = Buffer.from(expected, 'utf8');
  const providedBuf = Buffer.from(provided, 'utf8');
  const valid = expectedBuf.length === providedBuf.length && crypto.timingSafeEqual(expectedBuf, providedBuf);
  if (!valid) {
    return res.status(401).json({ success: false, message: 'Invalid signature' });
  }

  // Replay cache key
  const replayKey = idempotencyKey || (timestampHeader + ':' + computeBodySha256Hex(rawBody));
  if (webhookReplayCache.get(replayKey)) {
    return res.status(200).json({ success: true, message: 'Duplicate webhook ignored' });
  }
  webhookReplayCache.set(replayKey, true, 600);

  // Attach helpers
  req.rawBody = rawBody;
  req.webhookReplayKey = replayKey;
  req.webhookBodyHash = computeBodySha256Hex(rawBody);
  next();
}

// Dedicated rate limiter for webhook path
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 60 : 600,
  message: 'Too many webhook requests',
  standardHeaders: true,
  legacyHeaders: false,
});

// Utility: append-only raw log
async function persistRawMessage(rawBuffer) {
  try {
    const filename = `ldt_${new Date().toISOString().replace(/[:.]/g, '-')}_${crypto.randomUUID()}.txt`;
    const filePath = path.join(RAW_LOG_DIR, filename);
    await fs.promises.writeFile(filePath, rawBuffer);
    return filePath;
  } catch (e) {
    logger.warn('Failed to persist raw message:', e.message);
    return null;
  }
}

// Mirth Connect ingestion endpoint to accept LDT payloads (secured)
app.post(
  '/api/mirth-webhook',
  webhookLimiter,
  express.raw({ type: '*/*', limit: '10mb' }),
  validateWebhookSignature,
  asyncHandler(async (req, res) => {
    if (!validateContentType(req, res)) return;

    const rawBody = req.rawBody || req.body;

    // Defensive type check: ensure rawBody is a Buffer
    if (!(rawBody instanceof Buffer)) {
      logger.warn('Invalid rawBody type in /api/mirth-webhook', { type: typeof rawBody });
      return res.status(400).json({ success: false, message: 'Invalid request body type' });
    }

    logger.info('Received payload from Mirth Connect (secured)', {
      contentType: req.headers['content-type'],
      size: rawBody ? rawBody.length : 0,
      bodyHash: req.webhookBodyHash
    });

    // Persist raw (non-blocking)
    const storedPath = await persistRawMessage(rawBody);

    // Parse the LDT payload
    let ldtPayload;
    const asString = rawBody.toString('utf8');

    if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
      try {
        const jsonBody = JSON.parse(asString);
        ldtPayload = jsonBody.data || jsonBody.payload || jsonBody.content || jsonBody.message || jsonBody.ldt || asString;
        if (ldtPayload !== asString) {
          ldtPayload = String(ldtPayload).replace(/\\n/g, '\n');
        }
      } catch (error) {
        ldtPayload = asString;
      }
    } else {
      ldtPayload = asString;
    }

    if (!ldtPayload || typeof ldtPayload !== 'string' || ldtPayload.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'No valid LDT payload detected' });
    }

    const parsedRecords = parseLDT(ldtPayload);
    if (parsedRecords.length === 0) {
      return res.status(422).json({ success: false, message: 'Unable to parse any LDT records' });
    }

    const messageId = crypto.randomUUID();
    mockDatabase.addLDTMessage({ id: messageId, receivedAt: new Date().toISOString(), raw: ldtPayload, parsed: parsedRecords });

    const ldtData = mockDatabase.extractLDTIdentifiers(parsedRecords);
    const newResult = mockDatabase.createResultFromLDT(ldtData, messageId);
    mockDatabase.results.push(newResult);

    logger.info(`Processed LDT message ${messageId}:`, {
      recordCount: parsedRecords.length,
      bsnr: ldtData.bsnr,
      lanr: ldtData.lanr,
      patient: newResult.patient,
      assignedTo: newResult.assignedTo,
      resultId: newResult.id,
      bodyHash: req.webhookBodyHash,
      storedPath
    });

    res.status(202).json({
      success: true,
      messageId,
      replayKey: req.webhookReplayKey,
      bodyHash: req.webhookBodyHash,
      resultId: newResult.id,
      message: newResult.assignedTo 
        ? `Result assigned to ${newResult.assignedTo}` 
        : 'Result created but not assigned (admin review required)'
    });
  })
);

// Alternative route (kept but secured similarly)
app.post(
  '/api/mirth/webhook',
  webhookLimiter,
  express.raw({ type: '*/*', limit: '10mb' }),
  validateWebhookSignature,
  asyncHandler(async (req, res) => {
    if (!validateContentType(req, res)) return;

    const rawBody = req.rawBody || req.body;
    const asString = rawBody.toString('utf8');

    let ldtPayload;
    if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
      try {
        const jsonBody = JSON.parse(asString);
        ldtPayload = jsonBody.data || jsonBody.payload || jsonBody.content || jsonBody.message || jsonBody.ldt || asString;
        if (ldtPayload !== asString) {
          ldtPayload = ldtPayload.replace(/\\n/g, '\n');
        }
      } catch (error) {
        ldtPayload = asString;
      }
    } else {
      ldtPayload = asString;
    }

    if (!ldtPayload || typeof ldtPayload !== 'string' || ldtPayload.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'No valid LDT payload detected' });
    }

    const parsedRecords = parseLDT(ldtPayload);
    if (parsedRecords.length === 0) {
      return res.status(422).json({ success: false, message: 'Unable to parse any LDT records' });
    }

    const messageId = crypto.randomUUID();
    mockDatabase.addLDTMessage({ id: messageId, receivedAt: new Date().toISOString(), raw: ldtPayload, parsed: parsedRecords });
    const ldtData = mockDatabase.extractLDTIdentifiers(parsedRecords);
    const newResult = mockDatabase.createResultFromLDT(ldtData, messageId);
    mockDatabase.results.push(newResult);

    logger.info(`Processed LDT message ${messageId} (alternative route)`, { resultId: newResult.id, bodyHash: req.webhookBodyHash });

    res.status(202).json({ success: true, messageId, resultId: newResult.id });
  })
);

// Enhanced download endpoints with access control
// Download all results as LDT
app.get('/api/download/ldt', authenticateToken, requirePermission('canDownloadReports'), asyncHandler(async (req, res) => {
  try {
    const results = mockDatabase.getResultsForUser(req.user);
    const filename = `lab_results_${new Date().toISOString().slice(0, 10)}.ldt`;

    const ldtGenerator = new LDTGenerator();
    const ldtContent = ldtGenerator.generateLDT(results, {
      labInfo: {
        name: process.env.LAB_NAME || 'Labor Results System',
        street: process.env.LAB_STREET || 'Medical Center Street 1',
        zipCode: process.env.LAB_ZIP || '12345',
        city: process.env.LAB_CITY || 'Medical City',
        phone: process.env.LAB_PHONE || '+49-123-456789',
        email: process.env.LAB_EMAIL || 'info@laborresults.de'
      }
    });

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', Buffer.byteLength(ldtContent, 'utf8'));
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    res.send(ldtContent);
    logger.info(`LDT file downloaded: ${filename} by ${req.user.email}`);
    
  } catch (error) {
    logger.error('Error generating LDT file:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to generate LDT file',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message 
    });
  }
}));

// Download specific result as LDT
app.get('/api/download/ldt/:resultId', authenticateToken, requirePermission('canDownloadReports'), asyncHandler(async (req, res) => {
  const { resultId } = req.params;
  
  const anyResult = mockDatabase.results.find(r => r.id === resultId);
  if (!anyResult) {
    return res.status(404).json({ success: false, message: 'Result not found' });
  }
  const accessible = mockDatabase.getResultsForUser(req.user).some(r => r.id === resultId);
  if (!accessible) {
    return res.status(403).json({ success: false, message: 'Access to result denied' });
  }

  try {
    const results = [anyResult];
    const filename = `result_${resultId}_${new Date().toISOString().slice(0, 10)}.ldt`;

    const ldtGenerator = new LDTGenerator();
    const ldtContent = ldtGenerator.generateLDT(results, {
      labInfo: {
        name: process.env.LAB_NAME || 'Labor Results System',
        street: process.env.LAB_STREET || 'Medical Center Street 1',
        zipCode: process.env.LAB_ZIP || '12345',
        city: process.env.LAB_CITY || 'Medical City',
        phone: process.env.LAB_PHONE || '+49-123-456789',
        email: process.env.LAB_EMAIL || 'info@laborresults.de'
      }
    });

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', Buffer.byteLength(ldtContent, 'utf8'));
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    res.send(ldtContent);
    logger.info(`LDT file downloaded: ${filename} by ${req.user.email}`);
    
  } catch (error) {
    logger.error('Error generating LDT file:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to generate LDT file',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message 
    });
  }
}));

// Download all results as PDF
app.get('/api/download/pdf', authenticateToken, requirePermission('canDownloadReports'), asyncHandler(async (req, res) => {
  try {
    const results = mockDatabase.getResultsForUser(req.user);
    const filename = `lab_results_${new Date().toISOString().slice(0, 10)}.pdf`;

    const pdfGenerator = new PDFGenerator();
    const pdfBuffer = await pdfGenerator.generatePDF(results, {
      labInfo: {
        name: process.env.LAB_NAME || 'Labor Results System',
        street: process.env.LAB_STREET || 'Medical Center Street 1',
        zipCode: process.env.LAB_ZIP || '12345',
        city: process.env.LAB_CITY || 'Medical City',
        phone: process.env.LAB_PHONE || '+49-123-456789',
        email: process.env.LAB_EMAIL || 'info@laborresults.de'
      }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    res.send(pdfBuffer);
    logger.info(`PDF file downloaded: ${filename} by ${req.user.email}`);
    
  } catch (error) {
    logger.error('Error generating PDF file:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to generate PDF file',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message 
    });
  }
}));

// Download specific result as PDF
app.get('/api/download/pdf/:resultId', authenticateToken, requirePermission('canDownloadReports'), asyncHandler(async (req, res) => {
  const { resultId } = req.params;
  
  const anyResult = mockDatabase.results.find(r => r.id === resultId);
  if (!anyResult) {
    return res.status(404).json({ success: false, message: 'Result not found' });
  }
  const accessible = mockDatabase.getResultsForUser(req.user).some(r => r.id === resultId);
  if (!accessible) {
    return res.status(403).json({ success: false, message: 'Access to result denied' });
  }

  try {
    const results = [anyResult];
    const filename = `result_${resultId}_${new Date().toISOString().slice(0, 10)}.pdf`;
    const pdfGenerator = new PDFGenerator();
    const pdfBuffer = await pdfGenerator.generatePDF(results, {
      labInfo: {
        name: process.env.LAB_NAME || 'Labor Results System',
        street: process.env.LAB_STREET || 'Medical Center Street 1',
        zipCode: process.env.LAB_ZIP || '12345',
        city: process.env.LAB_CITY || 'Medical City',
        phone: process.env.LAB_PHONE || '+49-123-456789',
        email: process.env.LAB_EMAIL || 'info@laborresults.de'
      }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    res.send(pdfBuffer);
    logger.info(`PDF file downloaded: ${filename} by ${req.user.email}`);
    
  } catch (error) {
    logger.error('Error generating PDF file:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to generate PDF file',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message 
    });
  }
}));

// Global error handler
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  
  res.status(error.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server with port conflict handling
function startServer(port, retries = 3) {
  const server = app.listen(port, () => {
    logger.info(`Server running on http://localhost:${port}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info('User management system initialized with default users:');
    logger.info('  Admin: admin@laborresults.de / admin123');
    logger.info('  Doctor: doctor@laborresults.de / doctor123');
    logger.info('  Lab Tech: lab@laborresults.de / lab123');
  });

  // Handle server errors
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      logger.warn(`Port ${port} is already in use`);
      if (retries > 0) {
        const newPort = port + 1;
        logger.info(`Trying port ${newPort}...`);
        server.close();
        setTimeout(() => startServer(newPort, retries - 1), 1000);
      } else {
        logger.error('No available ports found. Please stop the process using port 5000 or use a different port.');
        logger.error('On Windows, run: netstat -ano | findstr :5000 to find the process, then taskkill /PID <pid> /F');
        logger.error('Or set a different PORT environment variable: SET PORT=3001 && npm start');
        process.exit(1);
      }
    } else {
      logger.error('Server error:', error);
      process.exit(1);
    }
  });

  return server;
}

const server = startServer(PORT);

module.exports = app;