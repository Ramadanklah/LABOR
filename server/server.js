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
const EmailService = require('./utils/emailService');
const bodyParser = require('body-parser');
const multer = require('multer');
const csvParser = require('csv-parser');
const parseLDT = require('./utils/ldtParser');
const crypto = require('crypto');
const BulkUserManager = require('./utils/bulkUserManager');

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize cache with 1 hour TTL and check period every 10 minutes
const cache = new NodeCache({ 
  stdTTL: 3600, 
  checkperiod: 600,
  useClones: false // Better performance for large objects
});

// Initialize user model
const userModel = new UserModel();

// Initialize email service
const emailService = new EmailService();

// Initialize bulk user manager
const bulkUserManager = new BulkUserManager(userModel);

// Configure multer for file uploads
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Configure logger
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
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ],
});

// Production-ready middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  threshold: 1024 // Only compress responses larger than 1KB
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // Limit each IP
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const downloadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // Limit download requests
  message: 'Too many download requests, please try again later.',
  skipSuccessfulRequests: true
});

app.use('/api/', limiter);
app.use('/api/download', downloadLimiter);

// CORS configuration - Allow all origins for Mirth Connect compatibility
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL || 'http://localhost:3000'
    : ['http://localhost:3000', 'http://127.0.0.1:3000', '*'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms - User: ${req.user?.email || 'anonymous'}`);
  });
  next();
});

// Cache middleware
const cacheMiddleware = (duration = 300) => (req, res, next) => {
  const key = `${req.originalUrl}-${req.user?.userId || 'anonymous'}`;
  const cached = cache.get(key);
  
  if (cached) {
    logger.debug(`Cache hit for ${key}`);
    return res.json(cached);
  }
  
  res.sendResponse = res.json;
  res.json = (body) => {
    cache.set(key, body, duration);
    logger.debug(`Cache set for ${key}`);
    res.sendResponse(body);
  };
  
  next();
};

// Async error handler
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Enhanced authentication middleware
const authenticateToken = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access token required' 
    });
  }

  try {
    const decoded = await userModel.verifyToken(token);
    const user = await userModel.getUserById(decoded.userId);
    
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

    req.user = user;
    req.userAgent = req.headers['user-agent'];
    req.ipAddress = req.ip || req.connection.remoteAddress;
    next();
  } catch (error) {
    res.status(403).json({ 
      success: false, 
      message: 'Invalid or expired token' 
    });
  }
});

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
        // Lab technicians can see all results
        return filteredResults;
        
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
  const { email, password, otp } = req.body;
  const ipAddress = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'];

  // Input validation
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required'
    });
  }

  try {
    const authResult = await userModel.authenticateUser(email, password, otp, ipAddress, userAgent);
    
    logger.info(`Successful login for user: ${authResult.user.email} (${authResult.user.role})`);
    
    res.json({
      success: true,
      message: 'Login successful',
      token: authResult.token,
      user: authResult.user,
      requiresSetup2FA: authResult.requiresSetup2FA || false
    });
  } catch (error) {
    logger.warn(`Failed login attempt: ${email} - ${error.message}`);
    
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

// Logout endpoint with session invalidation
app.post('/api/auth/logout', authenticateToken, asyncHandler(async (req, res) => {
  const token = req.headers['authorization'].split(' ')[1];
  await userModel.logout(token, req.user.id, req.ipAddress, req.userAgent);
  
  logger.info(`User logged out: ${req.user.email}`);
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
}));

// --- TWO-FACTOR AUTHENTICATION ROUTES ---

// Generate a new 2FA secret for the authenticated user
app.post('/api/auth/setup-2fa', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const result = await userModel.setup2FA(req.user.id);
    res.json({ 
      success: true, 
      otpauthUrl: result.otpauthUrl, 
      secret: result.secret,
      qrCode: result.qrCode
    });
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
    const result = await userModel.verify2FA(req.user.id, token);
    
    // Send notification email
    try {
      await emailService.send2FAEnabledNotification(
        req.user.email, 
        `${req.user.firstName} ${req.user.lastName}`
      );
    } catch (emailError) {
      logger.warn('Failed to send 2FA notification email:', emailError);
    }
    
    res.json({ 
      success: true, 
      message: 'Two-factor authentication enabled successfully',
      backupCodes: result.backupCodes
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}));

// Disable 2FA (Admin or self)
app.post('/api/auth/disable-2fa', authenticateToken, asyncHandler(async (req, res) => {
  const { userId } = req.body;
  
  // Users can disable their own 2FA, admins can disable any user's 2FA
  if (userId && userId !== req.user.id && !userModel.hasPermission(req.user, 'canManageUsers')) {
    return res.status(403).json({ 
      success: false, 
      message: 'Insufficient permissions' 
    });
  }
  
  const targetUserId = userId || req.user.id;
  
  try {
    await userModel.disable2FA(targetUserId, req.user.id);
    
    res.json({ 
      success: true, 
      message: 'Two-factor authentication disabled successfully' 
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}));

// === USER MANAGEMENT ROUTES ===

// Create new user (Admin only)
app.post('/api/users', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  try {
    const newUser = await userModel.createUser(req.body);
    
    logger.info(`New user created: ${newUser.email} (${newUser.role}) by ${req.user.email}`);
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: newUser
    });
  } catch (error) {
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
  
  const result = mockDatabase.getResultById(resultId, req.user);
  
  if (!result) {
    return res.status(404).json({
      success: false,
      message: 'Result not found or access denied'
    });
  }
  
  // Log audit event
  mockDatabase.logAuditEvent('RESULT_ACCESSED', req.user, {
    resultId,
    patient: result.patient,
    type: result.type,
    ipAddress: req.ip
  });
  
  res.json({
    success: true,
    result
  });
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

// Bulk User Management Endpoints (Admin only)
app.post('/api/admin/bulk-import', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  try {
    const { users } = req.body;
    
    if (!Array.isArray(users)) {
      return res.status(400).json({
        success: false,
        message: 'Users must be an array'
      });
    }

    const results = {
      total: users.length,
      successful: 0,
      failed: 0,
      errors: []
    };

    // Process users in batches
    const batchSize = 10;
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      await bulkUserManager.processUserBatch(batch, results);
    }

    // Log audit event
    mockDatabase.logAuditEvent('BULK_USER_IMPORT', req.user, {
      total: results.total,
      successful: results.successful,
      failed: results.failed
    });

    res.json({
      success: true,
      message: 'Bulk import completed',
      results
    });

  } catch (error) {
    logger.error('Bulk import error:', error);
    res.status(500).json({
      success: false,
      message: 'Bulk import failed',
      error: error.message
    });
  }
}));

app.post('/api/admin/generate-sample-doctors', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  try {
    const { count = 100 } = req.body;
    
    if (count > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 1000 users can be generated at once'
      });
    }

    const doctors = await bulkUserManager.generateSampleDoctors();
    const results = {
      total: doctors.length,
      successful: 0,
      failed: 0,
      errors: []
    };

    // Process doctors in batches
    const batchSize = 10;
    for (let i = 0; i < doctors.length; i += batchSize) {
      const batch = doctors.slice(i, i + batchSize);
      await bulkUserManager.processUserBatch(batch, results);
    }

    // Log audit event
    mockDatabase.logAuditEvent('GENERATE_SAMPLE_DOCTORS', req.user, {
      count: results.total,
      successful: results.successful,
      failed: results.failed
    });

    res.json({
      success: true,
      message: `Generated ${results.successful} sample doctors`,
      results
    });

  } catch (error) {
    logger.error('Generate sample doctors error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate sample doctors',
      error: error.message
    });
  }
}));

app.get('/api/admin/user-statistics', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  try {
    const stats = bulkUserManager.getUserStatistics();
    
    res.json({
      success: true,
      statistics: stats
    });

  } catch (error) {
    logger.error('User statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user statistics',
      error: error.message
    });
  }
}));

app.post('/api/admin/validate-user-data', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  try {
    const { userData } = req.body;
    
    if (!userData) {
      return res.status(400).json({
        success: false,
        message: 'User data is required'
      });
    }

    const validation = bulkUserManager.validateUserData(userData);
    
    res.json({
      success: true,
      validation
    });

  } catch (error) {
    logger.error('User validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate user data',
      error: error.message
    });
  }
}));

// Test endpoint to verify server is running
app.get('/api/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Mirth Connect ingestion endpoint to accept LDT payloads
app.post(
  '/api/mirth-webhook',
  bodyParser.text({ type: '*/*', limit: '10mb' }),
  asyncHandler(async (req, res) => {
    logger.info('Received payload from Mirth Connect', {
      contentType: req.headers['content-type'],
      size: req.body ? req.body.length : 0,
    });

    // Basic validation – we expect a non-empty string
    if (!req.body || typeof req.body !== 'string' || req.body.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid LDT payload detected',
      });
    }

    // Parse the LDT payload into individual records
    const parsedRecords = parseLDT(req.body);

    if (parsedRecords.length === 0) {
      return res.status(422).json({
        success: false,
        message: 'Unable to parse any LDT records',
      });
    }

    // Persist the raw message & parsed representation
    const messageId = crypto.randomUUID();
    mockDatabase.addLDTMessage({
      id: messageId,
      receivedAt: new Date().toISOString(),
      raw: req.body,
      parsed: parsedRecords,
    });

    // Extract BSNR, LANR, and patient data from LDT
    const ldtData = mockDatabase.extractLDTIdentifiers(parsedRecords);
    
    // Create result from LDT data
    const newResult = mockDatabase.createResultFromLDT(ldtData, messageId);
    
    // Add the result to the database
    mockDatabase.results.push(newResult);

    // Log the processing
    logger.info(`Processed LDT message ${messageId}:`, {
      recordCount: parsedRecords.length,
      bsnr: ldtData.bsnr,
      lanr: ldtData.lanr,
      patient: newResult.patient,
      assignedTo: newResult.assignedTo,
      resultId: newResult.id
    });

    // Respond with processing details
    res.status(202).json({
      success: true,
      messageId,
      recordCount: parsedRecords.length,
      resultId: newResult.id,
      bsnr: ldtData.bsnr,
      lanr: ldtData.lanr,
      patient: newResult.patient,
      assignedTo: newResult.assignedTo,
      message: newResult.assignedTo 
        ? `Result assigned to ${newResult.assignedTo}` 
        : 'Result created but not assigned (admin review required)'
    });
  })
);

// JSON webhook endpoint for structured data from Mirth Connect
app.post(
  '/api/webhook/json',
  asyncHandler(async (req, res) => {
    logger.info('Received JSON payload from Mirth Connect', {
      contentType: req.headers['content-type'],
      size: req.body ? JSON.stringify(req.body).length : 0,
    });

    // Validate JSON payload structure
    const { lanr, bsnr, patient, type, status, date, resultId, data } = req.body;

    if (!lanr || !bsnr) {
      return res.status(400).json({
        success: false,
        message: 'LANR and BSNR are required fields',
      });
    }

    // Find user by BSNR/LANR
    const user = userModel.getUserByBsnrLanr(bsnr, lanr);
    
    if (!user) {
      logger.warn(`No user found for BSNR: ${bsnr}, LANR: ${lanr}`);
      return res.status(404).json({
        success: false,
        message: `No doctor found for BSNR: ${bsnr}, LANR: ${lanr}`,
        bsnr,
        lanr
      });
    }

    // Create result from JSON data
    const messageId = crypto.randomUUID();
    const jsonResultId = `res_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newResult = {
      id: jsonResultId,
      date: date || new Date().toISOString().slice(0, 10),
      type: type || 'JSON Import',
      status: status || 'Final',
      patient: patient || 'Unknown Patient',
      bsnr,
      lanr,
      doctorId: user.id,
      assignedUsers: [user.email],
      assignedTo: user.email,
      ldtMessageId: messageId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      patientData: {
        firstName: patient ? patient.split(' ')[0] : '',
        lastName: patient ? patient.split(' ').slice(1).join(' ') : '',
        patientId: data?.patientId || null
      },
      labData: {
        name: data?.labName || 'Unknown Lab',
        address: data?.labAddress || '',
        requestId: data?.requestId || null
      },
      testData: {
        requestId: data?.requestId || null,
        testDate: date || new Date().toISOString().slice(0, 10),
        parameters: data?.parameters || [],
        testType: type || 'Unknown Test'
      },
      rawData: data || {}
    };

    // Add the result to the database
    mockDatabase.results.push(newResult);

    // Log the processing
    logger.info(`Processed JSON message ${messageId}:`, {
      resultId: newResult.id,
      bsnr,
      lanr,
      patient: newResult.patient,
      assignedTo: newResult.assignedTo,
      user: user.email
    });

    // Log audit event
    mockDatabase.logAuditEvent('RESULT_CREATED', user, {
      resultId: newResult.id,
      patient: newResult.patient,
      bsnr,
      lanr,
      ipAddress: req.ip
    });

    // Respond with processing details
    res.status(202).json({
      success: true,
      messageId,
      resultId: newResult.id,
      bsnr,
      lanr,
      patient: newResult.patient,
      assignedTo: newResult.assignedTo,
      message: `Result assigned to ${newResult.assignedTo}`,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });
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
  
  try {
    const result = mockDatabase.getResultById(resultId, req.user);
    if (!result) {
      return res.status(404).json({ 
        success: false, 
        message: 'Result not found or access denied' 
      });
    }
    
    const results = [result];
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
  
  try {
    const result = mockDatabase.getResultById(resultId, req.user);
    if (!result) {
      return res.status(404).json({ 
        success: false, 
        message: 'Result not found or access denied' 
      });
    }
    
    const results = [result];
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

// === ENHANCED USER MANAGEMENT ENDPOINTS ===

// Email verification endpoint
app.get('/api/auth/verify-email', asyncHandler(async (req, res) => {
  const { token } = req.query;
  
  if (!token) {
    return res.status(400).json({
      success: false,
      message: 'Verification token required'
    });
  }
  
  try {
    await userModel.verifyEmail(token);
    res.json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}));

// Password reset request
app.post('/api/auth/forgot-password', asyncHandler(async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Email address required'
    });
  }
  
  try {
    const result = await userModel.generatePasswordResetToken(email);
    
    if (result.resetToken) {
      // Send password reset email
      await emailService.sendPasswordResetEmail(
        result.userEmail,
        result.userName,
        result.resetToken
      );
    }
    
    // Always return success to prevent email enumeration
    res.json({
      success: true,
      message: 'If the email exists, a password reset link has been sent'
    });
  } catch (error) {
    logger.error('Password reset error:', error);
    res.json({
      success: true,
      message: 'If the email exists, a password reset link has been sent'
    });
  }
}));

// Password reset with token
app.post('/api/auth/reset-password', asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;
  
  if (!token || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Reset token and new password required'
    });
  }
  
  if (newPassword.length < 8) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 8 characters long'
    });
  }
  
  try {
    await userModel.resetPassword(token, newPassword);
    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}));

// Enhanced user creation with email notifications
app.post('/api/admin/users', authenticateToken, requirePermission('canCreateUsers'), asyncHandler(async (req, res) => {
  const { sendEmail = true, ...userData } = req.body;
  
  try {
    const newUser = await userModel.createUser(userData, req.user.id);
    
    // Send welcome email if requested and user needs email verification
    if (sendEmail && newUser.activationToken) {
      try {
        await emailService.sendWelcomeEmail(
          newUser.email,
          `${newUser.firstName} ${newUser.lastName}`,
          userData.password, // Send original password before hashing
          newUser.activationToken
        );
      } catch (emailError) {
        logger.warn('Failed to send welcome email:', emailError);
      }
    }
    
    logger.info(`New user created: ${newUser.email} (${newUser.role}) by ${req.user.email}`);
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: newUser,
      emailSent: sendEmail && newUser.activationToken
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}));

// Enhanced user listing with pagination
app.get('/api/admin/users', authenticateToken, requirePermission('canViewAllUsers'), asyncHandler(async (req, res) => {
  const { role, isActive, search, page = 1, limit = 50 } = req.query;
  
  const filters = {};
  if (role) filters.role = role;
  if (isActive !== undefined) filters.isActive = isActive === 'true';
  if (search) filters.search = search;
  
  const pagination = {
    page: parseInt(page),
    limit: parseInt(limit)
  };
  
  try {
    const result = await userModel.getAllUsers(filters, pagination);
    const stats = await userModel.getUserStats();
    
    res.json({
      success: true,
      ...result,
      stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}));

// Bulk user operations
app.post('/api/admin/users/bulk', authenticateToken, requirePermission('canCreateUsers'), upload.single('csvFile'), asyncHandler(async (req, res) => {
  const { operation } = req.body;
  
  if (operation === 'import' && req.file) {
    const fs = require('fs');
    const users = [];
    const errors = [];
    
    try {
      const stream = fs.createReadStream(req.file.path)
        .pipe(csvParser());
      
      for await (const row of stream) {
        try {
          const userData = {
            email: row.email,
            firstName: row.firstName,
            lastName: row.lastName,
            role: row.role,
            bsnr: row.bsnr,
            lanr: row.lanr,
            password: row.password || Math.random().toString(36).slice(-12) // Generate random password if not provided
          };
          
          const newUser = await userModel.createUser(userData, req.user.id);
          users.push(newUser);
          
          // Send welcome email
          try {
            await emailService.sendWelcomeEmail(
              newUser.email,
              `${newUser.firstName} ${newUser.lastName}`,
              userData.password,
              newUser.activationToken
            );
          } catch (emailError) {
            logger.warn(`Failed to send welcome email to ${newUser.email}:`, emailError);
          }
          
        } catch (error) {
          errors.push({
            row: row,
            error: error.message
          });
        }
      }
      
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      
      res.json({
        success: true,
        message: `Imported ${users.length} users successfully`,
        imported: users.length,
        errors: errors.length,
        errorDetails: errors
      });
      
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  } else {
    res.status(400).json({
      success: false,
      message: 'Invalid operation or missing CSV file'
    });
  }
}));

// Admin password reset (bypass token)
app.post('/api/admin/users/:userId/reset-password', authenticateToken, requirePermission('canResetPasswords'), asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { newPassword, sendEmail = true } = req.body;
  
  if (!newPassword) {
    return res.status(400).json({
      success: false,
      message: 'New password required'
    });
  }
  
  try {
    const user = await userModel.getUserById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    await userModel.updateUser(userId, { password: newPassword }, req.user.id);
    
    // Send notification email
    if (sendEmail) {
      try {
        // Generate a temporary reset token for the email link
        const resetResult = await userModel.generatePasswordResetToken(user.email);
        if (resetResult.resetToken) {
          await emailService.sendPasswordResetEmail(
            user.email,
            `${user.firstName} ${user.lastName}`,
            resetResult.resetToken
          );
        }
      } catch (emailError) {
        logger.warn('Failed to send password reset notification:', emailError);
      }
    }
    
    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}));

// Get audit logs
app.get('/api/admin/audit-logs', authenticateToken, requirePermission('canViewAnalytics'), asyncHandler(async (req, res) => {
  const { userId, action, startDate, endDate, page = 1, limit = 50 } = req.query;
  
  const filters = {};
  if (userId) filters.userId = userId;
  if (action) filters.action = action;
  if (startDate) filters.startDate = startDate;
  if (endDate) filters.endDate = endDate;
  
  const pagination = {
    page: parseInt(page),
    limit: parseInt(limit)
  };
  
  try {
    const result = await userModel.getAuditLogs(filters, pagination);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}));

// User dashboard data endpoint
app.get('/api/dashboard', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const dashboardData = {
      user: req.user,
      notifications: [],
      recentActivity: [],
      stats: {}
    };
    
    // Role-specific dashboard data
    if (userModel.hasPermission(req.user, 'canViewAnalytics')) {
      dashboardData.stats = await userModel.getUserStats();
      
      // Recent audit logs
      const auditResult = await userModel.getAuditLogs({}, { page: 1, limit: 10 });
      dashboardData.recentActivity = auditResult.logs;
    }
    
    // Check if user needs to set up 2FA
    if (req.user.mustSetup2FA && !req.user.isTwoFactorEnabled) {
      dashboardData.notifications.push({
        type: 'warning',
        title: 'Security Setup Required',
        message: 'You must set up Two-Factor Authentication to secure your account.',
        action: 'setup-2fa'
      });
    }
    
    res.json({
      success: true,
      dashboard: dashboardData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}));

// === ENHANCED USER MANAGEMENT ENDPOINTS ===

// Email verification endpoint
app.get('/api/auth/verify-email', asyncHandler(async (req, res) => {
  const { token } = req.query;
  
  if (!token) {
    return res.status(400).json({
      success: false,
      message: 'Verification token required'
    });
  }
  
  try {
    await userModel.verifyEmail(token);
    res.json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}));

// Password reset request
app.post('/api/auth/forgot-password', asyncHandler(async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Email address required'
    });
  }
  
  try {
    const result = await userModel.generatePasswordResetToken(email);
    
    if (result.resetToken) {
      // Send password reset email
      await emailService.sendPasswordResetEmail(
        result.userEmail,
        result.userName,
        result.resetToken
      );
    }
    
    // Always return success to prevent email enumeration
    res.json({
      success: true,
      message: 'If the email exists, a password reset link has been sent'
    });
  } catch (error) {
    logger.error('Password reset error:', error);
    res.json({
      success: true,
      message: 'If the email exists, a password reset link has been sent'
    });
  }
}));

// Password reset with token
app.post('/api/auth/reset-password', asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;
  
  if (!token || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Reset token and new password required'
    });
  }
  
  if (newPassword.length < 8) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 8 characters long'
    });
  }
  
  try {
    await userModel.resetPassword(token, newPassword);
    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}));

// Enhanced user creation with email notifications
app.post('/api/admin/users', authenticateToken, requirePermission('canCreateUsers'), asyncHandler(async (req, res) => {
  const { sendEmail = true, ...userData } = req.body;
  
  try {
    const newUser = await userModel.createUser(userData, req.user.id);
    
    // Send welcome email if requested and user needs email verification
    if (sendEmail && newUser.activationToken) {
      try {
        await emailService.sendWelcomeEmail(
          newUser.email,
          `${newUser.firstName} ${newUser.lastName}`,
          userData.password, // Send original password before hashing
          newUser.activationToken
        );
      } catch (emailError) {
        logger.warn('Failed to send welcome email:', emailError);
      }
    }
    
    logger.info(`New user created: ${newUser.email} (${newUser.role}) by ${req.user.email}`);
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: newUser,
      emailSent: sendEmail && newUser.activationToken
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}));

// Enhanced user listing with pagination
app.get('/api/admin/users', authenticateToken, requirePermission('canViewAllUsers'), asyncHandler(async (req, res) => {
  const { role, isActive, search, page = 1, limit = 50 } = req.query;
  
  const filters = {};
  if (role) filters.role = role;
  if (isActive !== undefined) filters.isActive = isActive === 'true';
  if (search) filters.search = search;
  
  const pagination = {
    page: parseInt(page),
    limit: parseInt(limit)
  };
  
  try {
    const result = await userModel.getAllUsers(filters, pagination);
    const stats = await userModel.getUserStats();
    
    res.json({
      success: true,
      ...result,
      stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}));

// Get audit logs
app.get('/api/admin/audit-logs', authenticateToken, requirePermission('canViewAnalytics'), asyncHandler(async (req, res) => {
  const { userId, action, startDate, endDate, page = 1, limit = 50 } = req.query;
  
  const filters = {};
  if (userId) filters.userId = userId;
  if (action) filters.action = action;
  if (startDate) filters.startDate = startDate;
  if (endDate) filters.endDate = endDate;
  
  const pagination = {
    page: parseInt(page),
    limit: parseInt(limit)
  };
  
  try {
    const result = await userModel.getAuditLogs(filters, pagination);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}));

// User dashboard data endpoint
app.get('/api/dashboard', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const dashboardData = {
      user: req.user,
      notifications: [],
      recentActivity: [],
      stats: {}
    };
    
    // Role-specific dashboard data
    if (userModel.hasPermission(req.user, 'canViewAnalytics')) {
      dashboardData.stats = await userModel.getUserStats();
      
      // Recent audit logs
      const auditResult = await userModel.getAuditLogs({}, { page: 1, limit: 10 });
      dashboardData.recentActivity = auditResult.logs;
    }
    
    // Check if user needs to set up 2FA
    if (req.user.mustSetup2FA && !req.user.isTwoFactorEnabled) {
      dashboardData.notifications.push({
        type: 'warning',
        title: 'Security Setup Required',
        message: 'You must set up Two-Factor Authentication to secure your account.',
        action: 'setup-2fa'
      });
    }
    
    res.json({
      success: true,
      dashboard: dashboardData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}));

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