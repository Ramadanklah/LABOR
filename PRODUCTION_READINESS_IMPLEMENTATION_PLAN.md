# LABOR System - Production Readiness Implementation Plan

## Current Status Assessment

### ✅ Implemented Components
- Basic authentication and authorization
- Mirth Connect webhook integration
- LDT parsing and processing
- Basic Docker infrastructure
- Monitoring stack (Prometheus, Grafana, Loki)
- Audit logging structure

### ❌ Critical Missing Components (MUST-HAVE)

## A. Multi-Tenancy Implementation (CRITICAL)

### Current State: ❌ NOT IMPLEMENTED
The system currently has no multi-tenant architecture. All data is shared globally.

### Required Implementation:

#### 1. Database Schema Changes
```sql
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

-- Add tenant_id to all tables
ALTER TABLE users ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE patients ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE practices ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE raw_messages ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE results ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE reports ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE audit_logs ADD COLUMN tenant_id UUID REFERENCES tenants(id);

-- Create indexes for tenant isolation
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_patients_tenant_id ON patients(tenant_id);
CREATE INDEX idx_practices_tenant_id ON practices(tenant_id);
CREATE INDEX idx_raw_messages_tenant_id ON raw_messages(tenant_id);
CREATE INDEX idx_results_tenant_id ON results(tenant_id);
CREATE INDEX idx_reports_tenant_id ON reports(tenant_id);
CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id);
```

#### 2. Backend Multi-Tenancy Middleware
```javascript
// server/middleware/tenantContext.js
const tenantContext = (req, res, next) => {
  // Extract tenant from subdomain, header, or JWT
  const tenantId = extractTenantId(req);
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant not specified' });
  }
  
  req.tenantId = tenantId;
  next();
};

// Add to all database queries
const addTenantFilter = (query, tenantId) => {
  return query.where('tenant_id', tenantId);
};
```

#### 3. JWT Token Enhancement
```javascript
// Include tenant info in JWT
const token = jwt.sign({
  userId: user.id,
  tenantId: user.tenantId,
  role: user.role
}, secret);
```

## B. Message Queue & Worker System (CRITICAL)

### Current State: ❌ NOT IMPLEMENTED
LDT processing is synchronous, blocking the webhook response.

### Required Implementation:

#### 1. Redis Queue Setup
```javascript
// server/queue/queue.js
const Queue = require('bull');
const ldtProcessingQueue = new Queue('ldt-processing', {
  redis: process.env.REDIS_URL
});

// Add job to queue
ldtProcessingQueue.add('process-ldt', {
  messageId,
  rawPayload,
  tenantId
}, {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000
  }
});
```

#### 2. Worker Implementation
```javascript
// server/workers/ldtProcessor.js
ldtProcessingQueue.process('process-ldt', async (job) => {
  const { messageId, rawPayload, tenantId } = job.data;
  
  try {
    // Parse LDT
    const parsedRecords = parseLDT(rawPayload);
    
    // Extract identifiers
    const ldtData = extractLDTIdentifiers(parsedRecords);
    
    // Create result
    const result = await createResultFromLDT(ldtData, messageId, tenantId);
    
    // Upload to S3
    await uploadToS3(result);
    
    // Generate PDF
    await generatePDF(result);
    
    return { success: true, resultId: result.id };
  } catch (error) {
    throw error; // Will trigger retry
  }
});
```

#### 3. Dead Letter Queue
```javascript
ldtProcessingQueue.on('failed', (job, err) => {
  if (job.attemptsMade >= job.opts.attempts) {
    // Move to DLQ
    dlqQueue.add('failed-ldt', {
      originalJob: job.data,
      error: err.message
    });
  }
});
```

## C. S3 Storage & File Management (CRITICAL)

### Current State: ❌ NOT IMPLEMENTED
Files are stored locally or in memory.

### Required Implementation:

#### 1. S3 Integration
```javascript
// server/services/s3Service.js
const AWS = require('aws-sdk');
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const uploadToS3 = async (fileBuffer, key, contentType) => {
  const params = {
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: fileBuffer,
    ContentType: contentType,
    ServerSideEncryption: 'AES256'
  };
  
  return s3.upload(params).promise();
};
```

#### 2. Virus Scanning
```javascript
// server/services/virusScan.js
const scanFile = async (fileBuffer) => {
  // Integrate with ClamAV or cloud virus scanning service
  const result = await virusScanner.scan(fileBuffer);
  
  if (result.infected) {
    throw new Error('File contains malware');
  }
  
  return result;
};
```

## D. Secrets Management (CRITICAL)

### Current State: ❌ NOT IMPLEMENTED
Secrets are hardcoded or in .env files.

### Required Implementation:

#### 1. Environment Variables Cleanup
```bash
# Remove all secrets from .env files
# Use only non-sensitive config in .env
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://...
```

#### 2. Secrets Injection
```javascript
// server/config/secrets.js
const getSecret = async (secretName) => {
  if (process.env.NODE_ENV === 'production') {
    // Use AWS Secrets Manager or HashiCorp Vault
    return await secretsManager.getSecret(secretName);
  } else {
    return process.env[secretName];
  }
};
```

## E. Production Infrastructure (CRITICAL)

### Current State: ⚠️ PARTIAL
Basic Docker setup exists but lacks production hardening.

### Required Implementation:

#### 1. Kubernetes Deployment
```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: labor-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: labor-api
  template:
    metadata:
      labels:
        app: labor-api
    spec:
      containers:
      - name: api
        image: labor-api:latest
        ports:
        - containerPort: 5000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

#### 2. Ingress & TLS
```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: labor-ingress
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - api.laborresults.de
    secretName: labor-tls
  rules:
  - host: api.laborresults.de
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: labor-api-service
            port:
              number: 80
```

## F. Observability & Monitoring (CRITICAL)

### Current State: ⚠️ PARTIAL
Basic monitoring exists but lacks comprehensive observability.

### Required Implementation:

#### 1. OpenTelemetry Integration
```javascript
// server/telemetry/otel.js
const { NodeTracerProvider } = require('@opentelemetry/node');
const { SimpleSpanProcessor } = require('@opentelemetry/tracing');
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');

const provider = new NodeTracerProvider();
const exporter = new JaegerExporter({
  endpoint: process.env.JAEGER_ENDPOINT
});

provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
provider.register();
```

#### 2. Structured Logging
```javascript
// server/utils/logger.js
const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { 
    service: 'labor-api',
    tenantId: req.tenantId,
    userId: req.user?.id 
  }
});
```

#### 3. Metrics Collection
```javascript
// server/metrics/metrics.js
const prometheus = require('prom-client');
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code', 'tenant_id']
});
```

## G. Security Hardening (CRITICAL)

### Current State: ⚠️ PARTIAL
Basic security exists but needs hardening.

### Required Implementation:

#### 1. IP Allowlisting for Mirth
```javascript
// server/middleware/ipWhitelist.js
const allowedIPs = process.env.MIRTH_ALLOWED_IPS?.split(',') || [];

const ipWhitelist = (req, res, next) => {
  const clientIP = req.ip;
  
  if (!allowedIPs.includes(clientIP)) {
    return res.status(403).json({ error: 'IP not allowed' });
  }
  
  next();
};
```

#### 2. Enhanced Audit Logging
```javascript
// server/middleware/audit.js
const auditLog = (action, target, details) => {
  return async (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Log after response
      logger.info('AUDIT', {
        action,
        target,
        userId: req.user?.id,
        tenantId: req.tenantId,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        statusCode: res.statusCode,
        details
      });
      
      return originalSend.call(this, data);
    };
    
    next();
  };
};
```

## H. Backup & Disaster Recovery (CRITICAL)

### Current State: ❌ NOT IMPLEMENTED
No backup strategy exists.

### Required Implementation:

#### 1. Database Backup
```bash
#!/bin/bash
# scripts/backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backup_${DATE}.sql"

pg_dump $DATABASE_URL > "/backups/${BACKUP_FILE}"
gzip "/backups/${BACKUP_FILE}"

# Upload to S3
aws s3 cp "/backups/${BACKUP_FILE}.gz" "s3://${BACKUP_BUCKET}/database/"

# Cleanup old backups (keep 30 days)
find /backups -name "backup_*.sql.gz" -mtime +30 -delete
```

#### 2. S3 Backup
```javascript
// server/services/backupService.js
const backupS3 = async () => {
  const objects = await s3.listObjects({
    Bucket: process.env.S3_BUCKET
  }).promise();
  
  // Create backup bucket
  await s3.createBucket({
    Bucket: `${process.env.S3_BUCKET}-backup-${new Date().toISOString().slice(0, 10)}`
  }).promise();
  
  // Copy objects
  for (const obj of objects.Contents) {
    await s3.copyObject({
      Bucket: `${process.env.S3_BUCKET}-backup-${new Date().toISOString().slice(0, 10)}`,
      CopySource: `${process.env.S3_BUCKET}/${obj.Key}`,
      Key: obj.Key
    }).promise();
  }
};
```

## Implementation Timeline

### Sprint 1 (2-3 weeks): Foundation
- [ ] Multi-tenancy database schema and migrations
- [ ] Tenant context middleware
- [ ] JWT tenant enhancement
- [ ] Basic S3 integration
- [ ] Secrets management setup

### Sprint 2 (2-3 weeks): Processing Pipeline
- [ ] Redis queue implementation
- [ ] LDT processing worker
- [ ] Dead letter queue
- [ ] Virus scanning integration
- [ ] File upload/download with S3

### Sprint 3 (2-3 weeks): Production Infrastructure
- [ ] Kubernetes deployment
- [ ] Ingress and TLS setup
- [ ] Monitoring and alerting
- [ ] Backup and recovery
- [ ] Security hardening

### Sprint 4 (1-2 weeks): Testing & Validation
- [ ] Load testing
- [ ] Security audit
- [ ] Disaster recovery testing
- [ ] Performance optimization
- [ ] Documentation

## Acceptance Criteria

### Multi-Tenancy
- [ ] Each tenant's data is completely isolated
- [ ] No cross-tenant data access possible
- [ ] Tenant context is enforced on all endpoints
- [ ] JWT tokens include tenant information

### Message Processing
- [ ] Webhook responds within 200ms
- [ ] LDT processing happens asynchronously
- [ ] Failed jobs go to DLQ
- [ ] Retry mechanism works correctly

### Security
- [ ] No secrets in code or configuration files
- [ ] All endpoints use HTTPS
- [ ] IP allowlisting for Mirth integration
- [ ] Comprehensive audit logging

### Observability
- [ ] Metrics available in Prometheus
- [ ] Distributed tracing with Jaeger
- [ ] Structured logging with tenant context
- [ ] Alerts for critical failures

### Backup & Recovery
- [ ] Automated daily database backups
- [ ] S3 backup strategy
- [ ] Documented restore procedures
- [ ] Tested recovery scenarios

## Risk Assessment

### High Risk Items
1. **Multi-tenancy implementation** - Complex database changes
2. **Message queue system** - New infrastructure component
3. **S3 integration** - File storage migration
4. **Kubernetes deployment** - Infrastructure complexity

### Mitigation Strategies
1. **Phased rollout** - Implement one component at a time
2. **Comprehensive testing** - Unit, integration, and load tests
3. **Rollback procedures** - Document how to revert changes
4. **Monitoring** - Extensive monitoring during rollout

## Next Steps

1. **Immediate**: Review and approve this implementation plan
2. **Week 1**: Set up development environment for multi-tenancy
3. **Week 2**: Begin database schema changes
4. **Week 3**: Implement tenant context middleware
5. **Continue**: Follow the sprint timeline above

This plan addresses all critical MUST-HAVE items from your checklist and provides a clear path to production readiness.