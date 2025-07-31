const winston = require('winston');

/**
 * Async error wrapper to catch async errors and pass them to error handler
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Production-ready error handling middleware
 */
class ErrorHandler {
  static handle(err, req, res, next) {
    let error = { ...err };
    error.message = err.message;

    // Log error
    winston.error(err.message, {
      stack: err.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });

    // Mongoose bad ObjectId
    if (err.name === 'CastError') {
      const message = 'Resource not found';
      error = new ErrorResponse(message, 404);
    }

    // Mongoose duplicate key
    if (err.code === 11000) {
      const message = 'Duplicate field value entered';
      error = new ErrorResponse(message, 400);
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
      const message = Object.values(err.errors).map(val => val.message);
      error = new ErrorResponse(message, 400);
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
      const message = 'Invalid token';
      error = new ErrorResponse(message, 401);
    }

    if (err.name === 'TokenExpiredError') {
      const message = 'Token expired';
      error = new ErrorResponse(message, 401);
    }

    // Prisma errors
    if (err.code === 'P2002') {
      const message = 'Unique constraint violation';
      error = new ErrorResponse(message, 400);
    }

    if (err.code === 'P2025') {
      const message = 'Record not found';
      error = new ErrorResponse(message, 404);
    }

    // Rate limiting errors
    if (err.status === 429) {
      const message = 'Too many requests, please try again later';
      error = new ErrorResponse(message, 429);
    }

    // File upload errors
    if (err.code === 'LIMIT_FILE_SIZE') {
      const message = 'File too large';
      error = new ErrorResponse(message, 400);
    }

    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      const message = 'Unexpected file field';
      error = new ErrorResponse(message, 400);
    }

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Server Error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  }

  /**
   * 404 Not Found handler
   */
  static notFound(req, res, next) {
    const error = new ErrorResponse(`Not found - ${req.originalUrl}`, 404);
    next(error);
  }

  /**
   * Unhandled promise rejection handler
   */
  static unhandledRejection() {
    process.on('unhandledRejection', (err, promise) => {
      winston.error(`Unhandled Promise Rejection: ${err.message}`, {
        stack: err.stack,
        promise: promise.toString()
      });
      
      // Close server & exit process
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
    });
  }

  /**
   * Uncaught exception handler
   */
  static uncaughtException() {
    process.on('uncaughtException', (err) => {
      winston.error(`Uncaught Exception: ${err.message}`, {
        stack: err.stack
      });
      
      // Close server & exit process
      process.exit(1);
    });
  }
}

/**
 * Custom Error Response class
 */
class ErrorResponse extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Security headers middleware
 */
const securityHeaders = (req, res, next) => {
  // Remove X-Powered-By header
  res.removeHeader('X-Powered-By');
  
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  next();
};

/**
 * Request logging middleware
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
    
    winston.log(logLevel, `${req.method} ${req.originalUrl}`, {
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
      contentLength: res.get('content-length')
    });
  });
  
  next();
};

/**
 * Input sanitization middleware
 */
const sanitizeInput = (req, res, next) => {
  // Remove null bytes
  const sanitizeValue = (value) => {
    if (typeof value === 'string') {
      return value.replace(/\0/g, '');
    }
    return value;
  };

  const sanitizeObject = (obj) => {
    if (typeof obj !== 'object' || obj === null) {
      return sanitizeValue(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  };

  req.body = sanitizeObject(req.body);
  req.query = sanitizeObject(req.query);
  req.params = sanitizeObject(req.params);

  next();
};

module.exports = {
  asyncHandler,
  ErrorHandler,
  ErrorResponse,
  securityHeaders,
  requestLogger,
  sanitizeInput
};