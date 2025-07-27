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

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL || 'http://localhost:3000'
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
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
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access token required' 
    });
  }

  try {
    const decoded = userModel.verifyToken(token);
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

    req.user = user;
    next();
  } catch (error) {
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

// Mock database with enhanced data isolation
const mockDatabase = {
  // Enhanced results with user associations
  results: [
    { id: 'res001', date: '2023-01-15', type: 'Blood Count', status: 'Final', patient: 'Max Mustermann', bsnr: '123456789', lanr: '1234567', doctorId: null, assignedUsers: ['doctor@laborresults.de'] },
    { id: 'res002', date: '2023-01-10', type: 'Urinalysis', status: 'Final', patient: 'Erika Musterfrau', bsnr: '123456789', lanr: '1234567', doctorId: null, assignedUsers: ['doctor@laborresults.de'] },
    { id: 'res003', date: '2023-01-05', type: 'Microbiology', status: 'Preliminary', patient: 'Max Mustermann', bsnr: '123456789', lanr: '1234567', doctorId: null, assignedUsers: ['doctor@laborresults.de'] },
    { id: 'res004', date: '2023-01-20', type: 'Chemistry Panel', status: 'Final', patient: 'Anna Schmidt', bsnr: '123456789', lanr: '1234568', doctorId: null, assignedUsers: ['lab@laborresults.de'] },
    { id: 'res005', date: '2023-01-18', type: 'Immunology', status: 'Final', patient: 'Peter Mueller', bsnr: '123456789', lanr: '1234568', doctorId: null, assignedUsers: ['lab@laborresults.de'] },
  ],

  // Get results based on user role and permissions
  getResultsForUser(user) {
    let filteredResults = this.results;

    switch (user.role) {
      case USER_ROLES.ADMIN:
        // Admins can see all results
        return filteredResults;
        
      case USER_ROLES.LAB_TECHNICIAN:
        // Lab technicians can see all results
        return filteredResults;
        
      case USER_ROLES.DOCTOR:
        // Doctors can only see results assigned to them or their BSNR/LANR
        return filteredResults.filter(result => 
          result.bsnr === user.bsnr && result.lanr === user.lanr ||
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

// Login endpoint with enhanced authentication
app.post('/api/auth/login', asyncHandler(async (req, res) => {
  const { email, password, bsnr, lanr } = req.body;

  // Input validation
  if ((!email && (!bsnr || !lanr)) || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email or BSNR/LANR and password are required'
    });
  }

  try {
    const authResult = await userModel.authenticateUser(email, password, bsnr, lanr);
    
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

// Logout endpoint (client-side token invalidation)
app.post('/api/auth/logout', authenticateToken, (req, res) => {
  logger.info(`User logged out: ${req.user.email}`);
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

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
  
  res.json({
    success: true,
    result
  });
}));

// Mirth Connect ingestion endpoint with enhanced validation
app.post('/api/mirth-webhook', asyncHandler(async (req, res) => {
  logger.info('Received data from Mirth Connect', { 
    headers: req.headers,
    bodySize: JSON.stringify(req.body).length 
  });

  // Validate incoming data structure
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({
      success: false,
      message: 'Invalid data format'
    });
  }

  // Process data (placeholder for actual implementation)
  // In production: validate against LDT schema, sanitize, store in database
  
  res.status(200).json({
    success: true,
    message: 'Data received and processed successfully',
    timestamp: new Date().toISOString()
  });
}));

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

// Start server
const server = app.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info('User management system initialized with default users:');
  logger.info('  Admin: admin@laborresults.de / admin123');
  logger.info('  Doctor: doctor@laborresults.de / doctor123');
  logger.info('  Lab Tech: lab@laborresults.de / lab123');
});

// Handle server errors
server.on('error', (error) => {
  logger.error('Server error:', error);
});

module.exports = app;