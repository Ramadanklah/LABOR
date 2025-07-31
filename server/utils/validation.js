const { body, param, query, validationResult } = require('express-validator');

/**
 * Middleware to handle validation results
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

/**
 * Strong password validation
 */
const passwordValidation = [
  body('password')
    .isLength({ min: 12 })
    .withMessage('Password must be at least 12 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'),
];

/**
 * Email validation
 */
const emailValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .isLength({ max: 254 })
    .withMessage('Email must be less than 254 characters'),
];

/**
 * User registration validation
 */
const validateUserRegistration = [
  ...emailValidation,
  ...passwordValidation,
  body('firstName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name is required and must be less than 50 characters')
    .matches(/^[a-zA-ZäöüÄÖÜß\s-']+$/)
    .withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),
  body('lastName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name is required and must be less than 50 characters')
    .matches(/^[a-zA-ZäöüÄÖÜß\s-']+$/)
    .withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),
  body('role')
    .isIn(['admin', 'doctor', 'lab_technician', 'viewer'])
    .withMessage('Invalid role specified'),
  body('bsnr')
    .optional()
    .matches(/^\d{9}$/)
    .withMessage('BSNR must be exactly 9 digits'),
  body('lanr')
    .optional()
    .matches(/^\d{7}$/)
    .withMessage('LANR must be exactly 7 digits'),
  handleValidationErrors
];

/**
 * User login validation
 */
const validateUserLogin = [
  ...emailValidation,
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  body('twoFactorCode')
    .optional()
    .matches(/^\d{6}$/)
    .withMessage('Two-factor code must be 6 digits'),
  handleValidationErrors
];

/**
 * Password reset validation
 */
const validatePasswordReset = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required')
    .isLength({ min: 32, max: 128 })
    .withMessage('Invalid reset token format'),
  ...passwordValidation,
  handleValidationErrors
];

/**
 * User update validation
 */
const validateUserUpdate = [
  param('id')
    .isUUID()
    .withMessage('Invalid user ID format'),
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters')
    .matches(/^[a-zA-ZäöüÄÖÜß\s-']+$/)
    .withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters')
    .matches(/^[a-zA-ZäöüÄÖÜß\s-']+$/)
    .withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),
  body('role')
    .optional()
    .isIn(['admin', 'doctor', 'lab_technician', 'viewer'])
    .withMessage('Invalid role specified'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  body('bsnr')
    .optional()
    .matches(/^\d{9}$/)
    .withMessage('BSNR must be exactly 9 digits'),
  body('lanr')
    .optional()
    .matches(/^\d{7}$/)
    .withMessage('LANR must be exactly 7 digits'),
  handleValidationErrors
];

/**
 * UUID parameter validation
 */
const validateUUIDParam = (paramName = 'id') => [
  param(paramName)
    .isUUID()
    .withMessage(`Invalid ${paramName} format`),
  handleValidationErrors
];

/**
 * Pagination validation
 */
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Page must be a number between 1 and 1000'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be a number between 1 and 100'),
  handleValidationErrors
];

/**
 * Two-factor authentication validation
 */
const validateTwoFactor = [
  body('code')
    .matches(/^\d{6}$/)
    .withMessage('Two-factor code must be 6 digits'),
  handleValidationErrors
];

/**
 * Webhook validation
 */
const validateWebhook = [
  body('data')
    .notEmpty()
    .withMessage('Webhook data is required'),
  body('timestamp')
    .optional()
    .isISO8601()
    .withMessage('Invalid timestamp format'),
  body('signature')
    .optional()
    .isLength({ min: 32 })
    .withMessage('Invalid signature format'),
  handleValidationErrors
];

/**
 * File upload validation
 */
const validateFileUpload = [
  body('file')
    .custom((value, { req }) => {
      if (!req.file) {
        throw new Error('File is required');
      }
      
      // Check file size (10MB limit)
      if (req.file.size > 10 * 1024 * 1024) {
        throw new Error('File size must be less than 10MB');
      }
      
      // Check file type
      const allowedTypes = ['text/plain', 'application/csv', 'text/csv'];
      if (!allowedTypes.includes(req.file.mimetype)) {
        throw new Error('Only text and CSV files are allowed');
      }
      
      return true;
    }),
  handleValidationErrors
];

/**
 * Audit log query validation
 */
const validateAuditQuery = [
  query('userId')
    .optional()
    .isUUID()
    .withMessage('Invalid user ID format'),
  query('action')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('Action must be between 1 and 50 characters'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid start date format'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid end date format'),
  ...validatePagination
];

/**
 * Rate limiting validation for sensitive endpoints
 */
const sensitiveEndpointLimiter = (windowMs = 15 * 60 * 1000, max = 5) => {
  const rateLimit = require('express-rate-limit');
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message: 'Too many attempts from this IP, please try again later.',
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

module.exports = {
  handleValidationErrors,
  validateUserRegistration,
  validateUserLogin,
  validatePasswordReset,
  validateUserUpdate,
  validateUUIDParam,
  validatePagination,
  validateTwoFactor,
  validateWebhook,
  validateFileUpload,
  validateAuditQuery,
  sensitiveEndpointLimiter,
  passwordValidation,
  emailValidation
};