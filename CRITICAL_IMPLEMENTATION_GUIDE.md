# LABOR System - Critical Implementation Quick Start Guide

## Overview

This guide provides step-by-step instructions for implementing the most critical missing components that are blocking production readiness. Focus on these items in order of priority.

## Priority 1: Multi-Tenancy Foundation

### Step 1: Database Schema Changes

Create a new migration file:

```sql
-- sql/migrations/V2__add_multi_tenancy.sql

-- Add tenant table
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255) UNIQUE,
  bsnr VARCHAR(9) UNIQUE,
  status VARCHAR(20) DEFAULT 'active',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add tenant_id to existing tables
ALTER TABLE users ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE patients ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE practices ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE raw_messages ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE results ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE reports ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE audit_logs ADD COLUMN tenant_id UUID REFERENCES tenants(id);

-- Create indexes for performance
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_patients_tenant_id ON patients(tenant_id);
CREATE INDEX idx_practices_tenant_id ON practices(tenant_id);
CREATE INDEX idx_raw_messages_tenant_id ON raw_messages(tenant_id);
CREATE INDEX idx_results_tenant_id ON results(tenant_id);
CREATE INDEX idx_reports_tenant_id ON reports(tenant_id);
CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id);

-- Insert default tenant for existing data
INSERT INTO tenants (id, name, domain, bsnr, status) 
VALUES (
  gen_random_uuid(), 
  'Default Tenant', 
  'default.laborresults.de', 
  '999999999', 
  'active'
);

-- Update existing data to use default tenant
UPDATE users SET tenant_id = (SELECT id FROM tenants WHERE bsnr = '999999999');
UPDATE patients SET tenant_id = (SELECT id FROM tenants WHERE bsnr = '999999999');
UPDATE practices SET tenant_id = (SELECT id FROM tenants WHERE bsnr = '999999999');
UPDATE raw_messages SET tenant_id = (SELECT id FROM tenants WHERE bsnr = '999999999');
UPDATE results SET tenant_id = (SELECT id FROM tenants WHERE bsnr = '999999999');
UPDATE reports SET tenant_id = (SELECT id FROM tenants WHERE bsnr = '999999999');
UPDATE audit_logs SET tenant_id = (SELECT id FROM tenants WHERE bsnr = '999999999');
```

### Step 2: Tenant Context Middleware

Create `server/middleware/tenantContext.js`:

```javascript
const extractTenantId = (req) => {
  // Method 1: From subdomain
  const host = req.get('host');
  const subdomain = host.split('.')[0];
  
  // Method 2: From header
  const tenantHeader = req.get('X-Tenant-ID');
  
  // Method 3: From JWT (if already authenticated)
  const tenantFromJWT = req.user?.tenantId;
  
  // Method 4: From BSNR in LDT payload (for webhooks)
  if (req.path.includes('mirth-webhook') && req.body) {
    const bsnr = extractBsnrFromLDT(req.body);
    if (bsnr) {
      return getTenantIdByBsnr(bsnr);
    }
  }
  
  return tenantHeader || tenantFromJWT || getTenantIdBySubdomain(subdomain);
};

const tenantContext = (req, res, next) => {
  const tenantId = extractTenantId(req);
  
  if (!tenantId) {
    return res.status(400).json({ 
      success: false, 
      message: 'Tenant not specified' 
    });
  }
  
  req.tenantId = tenantId;
  next();
};

module.exports = { tenantContext, extractTenantId };
```

### Step 3: Update User Model

Modify `server/models/User.js`:

```javascript
// Add tenant support to JWT
generateToken(user) {
  const payload = {
    userId: user.id,
    tenantId: user.tenantId, // Add this
    role: user.role,
    email: user.email
  };
  
  return jwt.sign(payload, this.jwtSecret, {
    expiresIn: this.jwtExpiration
  });
}

// Add tenant filtering to all queries
getAllUsers(filters = {}) {
  let users = Array.from(this.users.values());
  
  // Add tenant filtering
  if (filters.tenantId) {
    users = users.filter(user => user.tenantId === filters.tenantId);
  }
  
  // ... rest of filtering logic
  return users;
}
```

## Priority 2: Message Queue System

### Step 1: Install Dependencies

```bash
cd server
npm install bull redis
```

### Step 2: Create Queue Configuration

Create `server/queue/config.js`:

```javascript
const Queue = require('bull');

const redisConfig = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD,
    db: process.env.REDIS_DB || 0
  }
};

// LDT Processing Queue
const ldtProcessingQueue = new Queue('ldt-processing', redisConfig);

// Dead Letter Queue
const dlqQueue = new Queue('dead-letter-queue', redisConfig);

// Configure queue settings
ldtProcessingQueue.on('failed', (job, err) => {
  console.error('Job failed:', job.id, err.message);
  
  if (job.attemptsMade >= job.opts.attempts) {
    // Move to DLQ
    dlqQueue.add('failed-ldt', {
      originalJob: job.data,
      error: err.message,
      failedAt: new Date().toISOString()
    });
  }
});

module.exports = {
  ldtProcessingQueue,
  dlqQueue
};
```

### Step 3: Create Worker

Create `server/workers/ldtProcessor.js`:

```javascript
const { ldtProcessingQueue } = require('../queue/config');
const parseLDT = require('../utils/ldtParser');
const { uploadToS3 } = require('../services/s3Service');
const { generatePDF } = require('../utils/pdfGenerator');

ldtProcessingQueue.process('process-ldt', async (job) => {
  const { messageId, rawPayload, tenantId } = job.data;
  
  try {
    // Parse LDT
    const parsedRecords = parseLDT(rawPayload);
    
    // Extract identifiers
    const ldtData = extractLDTIdentifiers(parsedRecords);
    
    // Create result in database
    const result = await createResultFromLDT(ldtData, messageId, tenantId);
    
    // Upload raw LDT to S3
    const ldtKey = `tenants/${tenantId}/ldt/${messageId}.ldt`;
    await uploadToS3(Buffer.from(rawPayload), ldtKey, 'text/plain');
    
    // Generate and upload PDF
    const pdfBuffer = await generatePDF([result]);
    const pdfKey = `tenants/${tenantId}/pdfs/${result.id}.pdf`;
    await uploadToS3(pdfBuffer, pdfKey, 'application/pdf');
    
    // Update result with S3 keys
    await updateResultWithS3Keys(result.id, {
      ldtKey,
      pdfKey
    });
    
    return { 
      success: true, 
      resultId: result.id,
      ldtKey,
      pdfKey
    };
  } catch (error) {
    console.error('LDT processing failed:', error);
    throw error; // Will trigger retry
  }
});

module.exports = { ldtProcessingQueue };
```

### Step 4: Update Webhook Endpoint

Modify the webhook in `server/server.js`:

```javascript
const { ldtProcessingQueue } = require('./workers/ldtProcessor');

// Update webhook to be asynchronous
app.post('/api/mirth-webhook', 
  webhookLimiter,
  express.raw({ type: '*/*', limit: '10mb' }),
  validateWebhookSignature,
  asyncHandler(async (req, res) => {
    // ... existing validation code ...
    
    const messageId = crypto.randomUUID();
    const tenantId = extractTenantId(req);
    
    // Add to queue instead of processing synchronously
    await ldtProcessingQueue.add('process-ldt', {
      messageId,
      rawPayload: ldtPayload,
      tenantId
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    });
    
    // Respond immediately
    res.status(202).json({
      success: true,
      messageId,
      message: 'LDT queued for processing'
    });
  })
);
```

## Priority 3: S3 Storage Integration

### Step 1: Install AWS SDK

```bash
cd server
npm install aws-sdk
```

### Step 2: Create S3 Service

Create `server/services/s3Service.js`:

```javascript
const AWS = require('aws-sdk');

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'eu-central-1'
});

const uploadToS3 = async (fileBuffer, key, contentType) => {
  const params = {
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: fileBuffer,
    ContentType: contentType,
    ServerSideEncryption: 'AES256',
    Metadata: {
      uploadedAt: new Date().toISOString(),
      tenantId: key.split('/')[1] // Extract from key path
    }
  };
  
  try {
    const result = await s3.upload(params).promise();
    console.log('File uploaded to S3:', result.Location);
    return result;
  } catch (error) {
    console.error('S3 upload failed:', error);
    throw error;
  }
};

const downloadFromS3 = async (key) => {
  const params = {
    Bucket: process.env.S3_BUCKET,
    Key: key
  };
  
  try {
    const result = await s3.getObject(params).promise();
    return result.Body;
  } catch (error) {
    console.error('S3 download failed:', error);
    throw error;
  }
};

const deleteFromS3 = async (key) => {
  const params = {
    Bucket: process.env.S3_BUCKET,
    Key: key
  };
  
  try {
    await s3.deleteObject(params).promise();
    console.log('File deleted from S3:', key);
  } catch (error) {
    console.error('S3 delete failed:', error);
    throw error;
  }
};

module.exports = {
  uploadToS3,
  downloadFromS3,
  deleteFromS3
};
```

### Step 3: Update Download Endpoints

Modify download endpoints in `server/server.js`:

```javascript
const { downloadFromS3 } = require('./services/s3Service');

// Update PDF download to use S3
app.get('/api/download/pdf/:resultId', authenticateToken, requirePermission('canDownloadReports'), asyncHandler(async (req, res) => {
  const { resultId } = req.params;
  
  // Get result with S3 keys
  const result = await getResultById(resultId, req.user);
  if (!result) {
    return res.status(404).json({ success: false, message: 'Result not found' });
  }
  
  try {
    // Download from S3
    const pdfBuffer = await downloadFromS3(result.pdfKey);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="result_${resultId}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    
    res.send(pdfBuffer);
  } catch (error) {
    console.error('PDF download failed:', error);
    res.status(500).json({ success: false, message: 'Failed to download PDF' });
  }
}));
```

## Priority 4: Secrets Management

### Step 1: Create Secrets Configuration

Create `server/config/secrets.js`:

```javascript
const AWS = require('aws-sdk');

class SecretsManager {
  constructor() {
    this.secretsManager = new AWS.SecretsManager({
      region: process.env.AWS_REGION || 'eu-central-1'
    });
  }
  
  async getSecret(secretName) {
    if (process.env.NODE_ENV === 'production') {
      try {
        const data = await this.secretsManager.getSecretValue({
          SecretId: secretName
        }).promise();
        
        if (data.SecretString) {
          return JSON.parse(data.SecretString);
        }
      } catch (error) {
        console.error('Failed to get secret:', error);
        throw error;
      }
    } else {
      // Development: use environment variables
      return {
        JWT_SECRET: process.env.JWT_SECRET,
        DATABASE_URL: process.env.DATABASE_URL,
        REDIS_PASSWORD: process.env.REDIS_PASSWORD,
        AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
        AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
        MIRTH_WEBHOOK_SECRET: process.env.MIRTH_WEBHOOK_SECRET
      };
    }
  }
}

const secretsManager = new SecretsManager();

module.exports = { secretsManager };
```

### Step 2: Update Environment Configuration

Create `.env.example` (remove all secrets):

```bash
# Application
NODE_ENV=production
PORT=5000

# Database (URL will come from secrets)
DATABASE_URL=postgresql://...

# Redis (password will come from secrets)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# AWS (keys will come from secrets)
AWS_REGION=eu-central-1
S3_BUCKET=labor-results-storage

# Monitoring
PROMETHEUS_PORT=9090
GRAFANA_PORT=3001

# Security
MIRTH_ALLOWED_IPS=192.168.1.100,10.0.0.50
```

### Step 3: Update Application to Use Secrets

Modify `server/server.js`:

```javascript
const { secretsManager } = require('./config/secrets');

// Initialize secrets on startup
let secrets;
(async () => {
  try {
    secrets = await secretsManager.getSecret('labor-app-secrets');
    console.log('Secrets loaded successfully');
  } catch (error) {
    console.error('Failed to load secrets:', error);
    process.exit(1);
  }
})();

// Use secrets in JWT
const generateToken = (user) => {
  return jwt.sign({
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role
  }, secrets.JWT_SECRET, {
    expiresIn: '15m'
  });
};
```

## Priority 5: Basic Monitoring Enhancement

### Step 1: Add Prometheus Metrics

Create `server/metrics/metrics.js`:

```javascript
const prometheus = require('prom-client');

// HTTP request duration
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code', 'tenant_id'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

// LDT processing metrics
const ldtProcessingDuration = new prometheus.Histogram({
  name: 'ldt_processing_duration_seconds',
  help: 'Duration of LDT processing in seconds',
  labelNames: ['tenant_id', 'status'],
  buckets: [1, 5, 10, 30, 60]
});

// Queue metrics
const queueSize = new prometheus.Gauge({
  name: 'ldt_queue_size',
  help: 'Number of jobs in LDT processing queue',
  labelNames: ['queue_name']
});

// Error rate
const errorRate = new prometheus.Counter({
  name: 'api_errors_total',
  help: 'Total number of API errors',
  labelNames: ['endpoint', 'error_type', 'tenant_id']
});

module.exports = {
  httpRequestDuration,
  ldtProcessingDuration,
  queueSize,
  errorRate
};
```

### Step 2: Add Metrics Endpoint

Add to `server/server.js`:

```javascript
const { httpRequestDuration, errorRate } = require('./metrics/metrics');

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', prometheus.register.contentType);
    res.end(await prometheus.register.metrics());
  } catch (error) {
    res.status(500).end(error);
  }
});

// Add metrics middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration
      .labels(req.method, req.route?.path || req.path, res.statusCode, req.tenantId || 'unknown')
      .observe(duration);
  });
  
  next();
});
```

## Testing the Implementation

### Step 1: Test Multi-Tenancy

```bash
# Test tenant isolation
curl -H "X-Tenant-ID: tenant1" http://localhost:5000/api/results
curl -H "X-Tenant-ID: tenant2" http://localhost:5000/api/results
# Should return different results
```

### Step 2: Test Message Queue

```bash
# Send test LDT
curl -X POST http://localhost:5000/api/mirth-webhook \
  -H "Content-Type: text/plain" \
  -H "X-Tenant-ID: tenant1" \
  -d "test LDT content"
# Should return 202 immediately
```

### Step 3: Test S3 Integration

```bash
# Check if files are uploaded to S3
aws s3 ls s3://your-bucket/tenants/tenant1/ldt/
aws s3 ls s3://your-bucket/tenants/tenant1/pdfs/
```

### Step 4: Test Monitoring

```bash
# Check metrics endpoint
curl http://localhost:5000/metrics
# Should return Prometheus metrics
```

## Next Steps

After implementing these critical components:

1. **Set up Kubernetes deployment**
2. **Configure TLS/HTTPS**
3. **Implement comprehensive testing**
4. **Set up backup and recovery**
5. **Configure alerting rules**

This implementation provides the foundation for production readiness. Each component can be enhanced further based on specific requirements.