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

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize cache with 1 hour TTL and check period every 10 minutes
const cache = new NodeCache({ 
  stdTTL: 3600, 
  checkperiod: 600,
  useClones: false // Better performance for large objects
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
app.use('/api/download/', downloadLimiter);

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
    logger.info(`${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// Cache middleware
const cacheMiddleware = (duration = 300) => (req, res, next) => {
  const key = req.originalUrl;
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

// Mock database with improved performance
const mockDatabase = {
  users: new Map([
    ['123456789-1234567', { 
      bsnr: '123456789', 
      lanr: '1234567', 
      password: 'securepassword',
      lastLogin: null,
      loginAttempts: 0
    }]
  ]),
  
  results: [
    { id: 'res001', date: '2023-01-15', type: 'Blood Count', status: 'Final', patient: 'Max Mustermann', bsnr: '123456789', lanr: '1234567' },
    { id: 'res002', date: '2023-01-10', type: 'Urinalysis', status: 'Final', patient: 'Erika Musterfrau', bsnr: '123456789', lanr: '1234567' },
    { id: 'res003', date: '2023-01-05', type: 'Microbiology', status: 'Preliminary', patient: 'Max Mustermann', bsnr: '123456789', lanr: '1234567' },
    { id: 'res004', date: '2023-01-20', type: 'Chemistry Panel', status: 'Final', patient: 'Anna Schmidt', bsnr: '123456789', lanr: '1234567' },
    { id: 'res005', date: '2023-01-18', type: 'Immunology', status: 'Final', patient: 'Peter Mueller', bsnr: '123456789', lanr: '1234567' },
  ],

  // Optimized lookup methods
  getUserByCredentials(bsnr, lanr) {
    return this.users.get(`${bsnr}-${lanr}`);
  },

  getResultsByUser(bsnr, lanr) {
    return this.results.filter(result => 
      result.bsnr === bsnr && result.lanr === lanr
    );
  },

  getResultById(id, bsnr, lanr) {
    return this.results.find(result => 
      result.id === id && result.bsnr === bsnr && result.lanr === lanr
    );
  }
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

  // In production, use proper JWT verification
  if (token === 'fake-jwt-token') {
    req.user = { bsnr: '123456789', lanr: '1234567' };
    next();
  } else {
    res.status(403).json({ 
      success: false, 
      message: 'Invalid or expired token' 
    });
  }
};

// --- API Routes ---

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Enhanced login endpoint
app.post('/api/login', asyncHandler(async (req, res) => {
  const { bsnr, lanr, password } = req.body;

  // Input validation
  if (!bsnr || !lanr || !password) {
    return res.status(400).json({
      success: false,
      message: 'BSNR, LANR, and password are required'
    });
  }

  // Rate limiting check for failed attempts
  const userKey = `${bsnr}-${lanr}`;
  const user = mockDatabase.getUserByCredentials(bsnr, lanr);

  if (!user) {
    logger.warn(`Login attempt with invalid credentials: ${bsnr}/${lanr}`);
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  // Check password (in production, use bcrypt)
  if (user.password !== password) {
    user.loginAttempts = (user.loginAttempts || 0) + 1;
    logger.warn(`Failed login attempt for user: ${bsnr}/${lanr}`);
    
    if (user.loginAttempts >= 5) {
      logger.error(`Account locked due to too many failed attempts: ${bsnr}/${lanr}`);
      return res.status(429).json({
        success: false,
        message: 'Account temporarily locked due to too many failed attempts'
      });
    }
    
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  // Successful login
  user.loginAttempts = 0;
  user.lastLogin = new Date().toISOString();
  
  logger.info(`Successful login for user: ${bsnr}/${lanr}`);
  
  res.json({
    success: true,
    message: 'Login successful',
    token: 'fake-jwt-token', // In production, generate proper JWT
    user: {
      bsnr: user.bsnr,
      lanr: user.lanr,
      lastLogin: user.lastLogin
    }
  });
}));

// Enhanced results endpoint with caching
app.get('/api/results', authenticateToken, cacheMiddleware(300), asyncHandler(async (req, res) => {
  const { bsnr, lanr } = req.user;
  
  logger.info(`Fetching results for user: ${bsnr}/${lanr}`);
  
  const results = mockDatabase.getResultsByUser(bsnr, lanr);
  
  // Add pagination support
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  
  const paginatedResults = results.slice(startIndex, endIndex);
  
  res.json({
    results: paginatedResults,
    pagination: {
      page,
      limit,
      total: results.length,
      pages: Math.ceil(results.length / limit)
    }
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

// Optimized download endpoints with streaming
app.get('/api/download/ldt/:resultId?', authenticateToken, asyncHandler(async (req, res) => {
  const { bsnr, lanr } = req.user;
  const { resultId } = req.params;
  
  try {
    let results;
    let filename;
    
    if (resultId) {
      const result = mockDatabase.getResultById(resultId, bsnr, lanr);
      if (!result) {
        return res.status(404).json({ 
          success: false, 
          message: 'Result not found' 
        });
      }
      results = [result];
      filename = `result_${resultId}_${new Date().toISOString().slice(0, 10)}.ldt`;
    } else {
      results = mockDatabase.getResultsByUser(bsnr, lanr);
      filename = `lab_results_${new Date().toISOString().slice(0, 10)}.ldt`;
    }

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
    logger.info(`LDT file downloaded: ${filename} by ${bsnr}/${lanr}`);
    
  } catch (error) {
    logger.error('Error generating LDT file:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to generate LDT file',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message 
    });
  }
}));

app.get('/api/download/pdf/:resultId?', authenticateToken, asyncHandler(async (req, res) => {
  const { bsnr, lanr } = req.user;
  const { resultId } = req.params;
  
  try {
    let results;
    let filename;
    
    if (resultId) {
      const result = mockDatabase.getResultById(resultId, bsnr, lanr);
      if (!result) {
        return res.status(404).json({ 
          success: false, 
          message: 'Result not found' 
        });
      }
      results = [result];
      filename = `result_${resultId}_${new Date().toISOString().slice(0, 10)}.pdf`;
    } else {
      results = mockDatabase.getResultsByUser(bsnr, lanr);
      filename = `lab_results_${new Date().toISOString().slice(0, 10)}.pdf`;
    }

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
    logger.info(`PDF file downloaded: ${filename} by ${bsnr}/${lanr}`);
    
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
app.use('*', (req, res) => {
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
});

// Handle server errors
server.on('error', (error) => {
  logger.error('Server error:', error);
});

module.exports = app;