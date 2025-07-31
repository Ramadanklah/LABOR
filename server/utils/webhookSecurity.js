const crypto = require('crypto');

/**
 * Webhook security middleware
 */
class WebhookSecurity {
  constructor() {
    this.allowedIPs = this.parseAllowedIPs();
    this.webhookSecret = process.env.WEBHOOK_SECRET || process.env.MIRTH_WEBHOOK_SECRET;
  }

  /**
   * Parse allowed IPs from environment variable
   */
  parseAllowedIPs() {
    const ips = process.env.MIRTH_ALLOWED_IPS || '';
    return ips.split(',').map(ip => ip.trim()).filter(ip => ip.length > 0);
  }

  /**
   * Check if IP is in the whitelist
   */
  isIPAllowed(clientIP) {
    if (this.allowedIPs.length === 0) {
      return true; // No restrictions if no IPs specified
    }

    // Handle IPv6 mapped IPv4 addresses
    const normalizedIP = clientIP.replace(/^::ffff:/, '');

    for (const allowedIP of this.allowedIPs) {
      if (this.matchIP(normalizedIP, allowedIP)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Match IP against allowed IP or CIDR range
   */
  matchIP(clientIP, allowedIP) {
    // Exact match
    if (clientIP === allowedIP) {
      return true;
    }

    // CIDR range check
    if (allowedIP.includes('/')) {
      return this.isIPInCIDR(clientIP, allowedIP);
    }

    return false;
  }

  /**
   * Check if IP is in CIDR range
   */
  isIPInCIDR(ip, cidr) {
    const [range, bits] = cidr.split('/');
    const mask = ~(2 ** (32 - bits) - 1);
    return (this.ipToInt(ip) & mask) === (this.ipToInt(range) & mask);
  }

  /**
   * Convert IP address to integer
   */
  ipToInt(ip) {
    return ip.split('.').reduce((acc, part) => (acc << 8) + parseInt(part, 10), 0) >>> 0;
  }

  /**
   * Generate webhook signature
   */
  generateSignature(payload, secret = null) {
    const webhookSecret = secret || this.webhookSecret;
    if (!webhookSecret) {
      throw new Error('Webhook secret not configured');
    }

    const hmac = crypto.createHmac('sha256', webhookSecret);
    hmac.update(payload, 'utf8');
    return 'sha256=' + hmac.digest('hex');
  }

  /**
   * Verify webhook signature
   */
  verifySignature(receivedSignature, payload, secret = null) {
    if (!receivedSignature) {
      return false;
    }

    const expectedSignature = this.generateSignature(payload, secret);
    
    // Use crypto.timingSafeEqual to prevent timing attacks
    if (receivedSignature.length !== expectedSignature.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(receivedSignature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * IP whitelist middleware
   */
  ipWhitelistMiddleware() {
    return (req, res, next) => {
      const clientIP = this.getClientIP(req);
      
      if (!this.isIPAllowed(clientIP)) {
        const error = new Error(`Access denied for IP: ${clientIP}`);
        error.statusCode = 403;
        
        // Log security violation
        console.warn(`Webhook access denied for IP: ${clientIP}`, {
          url: req.url,
          method: req.method,
          userAgent: req.get('User-Agent'),
          timestamp: new Date().toISOString()
        });
        
        return res.status(403).json({
          success: false,
          message: 'Access denied - IP not allowed'
        });
      }
      
      next();
    };
  }

  /**
   * Signature verification middleware
   */
  signatureVerificationMiddleware(options = {}) {
    return (req, res, next) => {
      const signature = req.get('X-Hub-Signature-256') || 
                       req.get('X-Signature') || 
                       req.get('Signature');
      
      if (!signature && options.required !== false) {
        return res.status(401).json({
          success: false,
          message: 'Missing webhook signature'
        });
      }

      if (signature) {
        const payload = JSON.stringify(req.body);
        
        if (!this.verifySignature(signature, payload, options.secret)) {
          // Log security violation
          console.warn('Invalid webhook signature detected', {
            url: req.url,
            method: req.method,
            ip: this.getClientIP(req),
            signature: signature.substring(0, 20) + '...',
            timestamp: new Date().toISOString()
          });
          
          return res.status(401).json({
            success: false,
            message: 'Invalid webhook signature'
          });
        }
      }
      
      next();
    };
  }

  /**
   * Rate limiting middleware for webhooks
   */
  webhookRateLimitMiddleware() {
    const attempts = new Map();
    
    return (req, res, next) => {
      const clientIP = this.getClientIP(req);
      const now = Date.now();
      const windowMs = 5 * 60 * 1000; // 5 minutes
      const maxAttempts = 30; // Max 30 requests per 5 minutes per IP
      
      // Clean old entries
      for (const [ip, data] of attempts.entries()) {
        if (now - data.firstAttempt > windowMs) {
          attempts.delete(ip);
        }
      }
      
      // Get or create attempt record
      let attemptData = attempts.get(clientIP);
      if (!attemptData) {
        attemptData = { count: 0, firstAttempt: now };
        attempts.set(clientIP, attemptData);
      }
      
      // Reset if window expired
      if (now - attemptData.firstAttempt > windowMs) {
        attemptData.count = 0;
        attemptData.firstAttempt = now;
      }
      
      attemptData.count++;
      
      if (attemptData.count > maxAttempts) {
        console.warn(`Webhook rate limit exceeded for IP: ${clientIP}`, {
          attempts: attemptData.count,
          window: windowMs / 1000 + 's',
          timestamp: new Date().toISOString()
        });
        
        return res.status(429).json({
          success: false,
          message: 'Rate limit exceeded for webhook endpoint'
        });
      }
      
      next();
    };
  }

  /**
   * Get client IP address
   */
  getClientIP(req) {
    return req.ip ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
           '0.0.0.0';
  }

  /**
   * Complete webhook security middleware stack
   */
  secureWebhook(options = {}) {
    const middlewares = [];
    
    // IP whitelist (if enabled)
    if (options.ipWhitelist !== false) {
      middlewares.push(this.ipWhitelistMiddleware());
    }
    
    // Rate limiting
    if (options.rateLimit !== false) {
      middlewares.push(this.webhookRateLimitMiddleware());
    }
    
    // Signature verification (if enabled)
    if (options.verifySignature !== false) {
      middlewares.push(this.signatureVerificationMiddleware(options));
    }
    
    return middlewares;
  }

  /**
   * Validate webhook payload structure
   */
  validateWebhookPayload(requiredFields = []) {
    return (req, res, next) => {
      const payload = req.body;
      
      if (!payload || typeof payload !== 'object') {
        return res.status(400).json({
          success: false,
          message: 'Invalid webhook payload format'
        });
      }
      
      // Check required fields
      for (const field of requiredFields) {
        if (!(field in payload)) {
          return res.status(400).json({
            success: false,
            message: `Missing required field: ${field}`
          });
        }
      }
      
      next();
    };
  }

  /**
   * Log webhook activity
   */
  logWebhookActivity() {
    return (req, res, next) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        const clientIP = this.getClientIP(req);
        
        console.info('Webhook request processed', {
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration: `${duration}ms`,
          ip: clientIP,
          userAgent: req.get('User-Agent'),
          contentLength: req.get('content-length'),
          timestamp: new Date().toISOString()
        });
      });
      
      next();
    };
  }
}

module.exports = WebhookSecurity;