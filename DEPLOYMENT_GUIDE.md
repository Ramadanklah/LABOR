# Lab Results System - Production Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the Lab Results Management System to production environments. The system is designed to be scalable, secure, and maintainable.

## Prerequisites

### System Requirements

- **Operating System**: Linux (Ubuntu 20.04+ recommended)
- **CPU**: 4+ cores
- **RAM**: 8GB+ (16GB recommended)
- **Storage**: 100GB+ SSD
- **Network**: Stable internet connection

### Software Requirements

- **Docker**: 20.10+
- **Docker Compose**: 2.0+
- **Git**: Latest version
- **Node.js**: 18+ (for local development)

### Infrastructure Requirements

- **Domain Name**: Configured with SSL certificate
- **Load Balancer**: For high availability
- **Backup Storage**: For database and file backups
- **Monitoring**: Prometheus, Grafana, ELK Stack

## Environment Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-org/lab-results-system.git
cd lab-results-system
```

### 2. Environment Configuration

Create environment files for different environments:

#### Production Environment (.env.prod)

```bash
# Application Configuration
NODE_ENV=production
PORT=5000
HOST=0.0.0.0

# Database Configuration
DB_HOST=postgres
DB_PORT=5432
DB_NAME=laborresults_prod
DB_USER=postgres
DB_PASSWORD=your_secure_password_here
DB_SSL=true

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password_here

# JWT Configuration
JWT_SECRET=your_very_long_and_secure_jwt_secret_here
JWT_EXPIRES_IN=24h

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_SECURE=true

# Lab Information
LAB_NAME=Your Medical Laboratory
LAB_STREET=123 Medical Center Street
LAB_ZIP=12345
LAB_CITY=Medical City
LAB_PHONE=+49-123-456789
LAB_EMAIL=info@yourlab.com

# Frontend Configuration
FRONTEND_URL=https://your-domain.com
API_URL=https://your-domain.com/api

# Security Configuration
CORS_ORIGIN=https://your-domain.com
RATE_LIMIT_WINDOW=15m
RATE_LIMIT_MAX=100

# Logging Configuration
LOG_LEVEL=info
LOG_FILE_PATH=/app/logs

# Monitoring Configuration
PROMETHEUS_ENABLED=true
METRICS_PORT=9090

# Backup Configuration
BACKUP_RETENTION_DAYS=30
BACKUP_SCHEDULE=0 2 * * *

# SSL Configuration
SSL_CERT_PATH=/etc/ssl/certs/your-domain.crt
SSL_KEY_PATH=/etc/ssl/private/your-domain.key
```

#### Staging Environment (.env.staging)

```bash
# Similar to production but with staging-specific values
NODE_ENV=staging
DB_NAME=laborresults_staging
FRONTEND_URL=https://staging.your-domain.com
```

### 3. SSL Certificate Setup

#### Using Let's Encrypt (Recommended)

```bash
# Install Certbot
sudo apt update
sudo apt install certbot

# Obtain SSL certificate
sudo certbot certonly --standalone -d your-domain.com -d www.your-domain.com

# Set up auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

#### Using Custom SSL Certificate

Place your SSL certificate files in the appropriate locations:
- Certificate: `/etc/ssl/certs/your-domain.crt`
- Private Key: `/etc/ssl/private/your-domain.key`

## Deployment Methods

### Method 1: Docker Compose (Recommended)

#### 1. Production Deployment

```bash
# Build and start all services
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d

# Check service status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

#### 2. Staging Deployment

```bash
# Deploy to staging
docker-compose -f docker-compose.staging.yml --env-file .env.staging up -d
```

### Method 2: Kubernetes Deployment

#### 1. Create Kubernetes Namespace

```yaml
# k8s/namespace.yml
apiVersion: v1
kind: Namespace
metadata:
  name: lab-results-system
```

#### 2. Deploy Application

```bash
# Apply namespace
kubectl apply -f k8s/namespace.yml

# Deploy application
kubectl apply -f k8s/ -n lab-results-system

# Check deployment status
kubectl get pods -n lab-results-system
```

### Method 3: Cloud Platform Deployment

#### AWS ECS Deployment

```bash
# Build and push Docker image
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin your-account.dkr.ecr.us-east-1.amazonaws.com
docker build -t lab-results-system .
docker tag lab-results-system:latest your-account.dkr.ecr.us-east-1.amazonaws.com/lab-results-system:latest
docker push your-account.dkr.ecr.us-east-1.amazonaws.com/lab-results-system:latest

# Deploy to ECS
aws ecs update-service --cluster lab-results-cluster --service lab-results-service --force-new-deployment
```

## Database Setup

### 1. Initialize Database

```bash
# Run database migrations
docker-compose -f docker-compose.prod.yml exec app npm run db:migrate

# Seed initial data (if needed)
docker-compose -f docker-compose.prod.yml exec app npm run db:seed
```

### 2. Database Backup Setup

```bash
# Create backup script
cat > scripts/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"
DB_NAME="laborresults_prod"

# Create backup
docker-compose -f docker-compose.prod.yml exec -T postgres pg_dump -U postgres $DB_NAME > $BACKUP_DIR/backup_$DATE.sql

# Compress backup
gzip $BACKUP_DIR/backup_$DATE.sql

# Remove old backups (keep last 30 days)
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +30 -delete

echo "Backup completed: backup_$DATE.sql.gz"
EOF

chmod +x scripts/backup.sh

# Add to crontab for automated backups
crontab -e
# Add: 0 2 * * * /path/to/lab-results-system/scripts/backup.sh
```

## Monitoring Setup

### 1. Prometheus Configuration

```bash
# Create monitoring directory
mkdir -p monitoring/rules

# Create alerting rules
cat > monitoring/rules/alerts.yml << 'EOF'
groups:
  - name: lab-results-alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} errors per second"

      - alert: DatabaseConnectionDown
        expr: pg_up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Database connection down"
          description: "PostgreSQL database is not responding"

      - alert: ApplicationDown
        expr: up{job="lab-results-app"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Application is down"
          description: "Lab Results application is not responding"
EOF
```

### 2. Grafana Dashboard Setup

```bash
# Create dashboard configuration
mkdir -p monitoring/grafana/dashboards
mkdir -p monitoring/grafana/datasources

# Create datasource configuration
cat > monitoring/grafana/datasources/prometheus.yml << 'EOF'
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
EOF

# Create dashboard configuration
cat > monitoring/grafana/dashboards/dashboard.yml << 'EOF'
apiVersion: 1

providers:
  - name: 'default'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /etc/grafana/provisioning/dashboards
EOF
```

## Security Configuration

### 1. Firewall Setup

```bash
# Configure UFW firewall
sudo ufw enable
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH
sudo ufw allow ssh

# Allow HTTP and HTTPS
sudo ufw allow 80
sudo ufw allow 443

# Allow application ports (if not using reverse proxy)
sudo ufw allow 5000

# Allow monitoring ports (restrict to internal network)
sudo ufw allow from 10.0.0.0/8 to any port 9090
sudo ufw allow from 10.0.0.0/8 to any port 3001

# Check firewall status
sudo ufw status verbose
```

### 2. Security Headers

The application includes security headers via Helmet.js, but you can enhance them:

```javascript
// Additional security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

### 3. Rate Limiting

```javascript
// Enhanced rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);
```

## Backup and Recovery

### 1. Automated Backups

```bash
# Create comprehensive backup script
cat > scripts/full-backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"
S3_BUCKET="your-backup-bucket"

# Database backup
docker-compose -f docker-compose.prod.yml exec -T postgres pg_dump -U postgres laborresults_prod > $BACKUP_DIR/db_backup_$DATE.sql

# Application files backup
tar -czf $BACKUP_DIR/app_backup_$DATE.tar.gz -C /app .

# Upload to S3 (if using AWS)
aws s3 cp $BACKUP_DIR/db_backup_$DATE.sql s3://$S3_BUCKET/database/
aws s3 cp $BACKUP_DIR/app_backup_$DATE.tar.gz s3://$S3_BUCKET/application/

# Clean up local backups older than 7 days
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Full backup completed: $DATE"
EOF

chmod +x scripts/full-backup.sh
```

### 2. Recovery Procedures

```bash
# Database recovery
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U postgres laborresults_prod < backup_file.sql

# Application recovery
tar -xzf app_backup.tar.gz -C /app/
```

## Performance Optimization

### 1. Database Optimization

```sql
-- Create indexes for better performance
CREATE INDEX idx_results_date ON results(date);
CREATE INDEX idx_results_status ON results(status);
CREATE INDEX idx_results_assigned_to ON results(assigned_to);
CREATE INDEX idx_users_email ON users(email);

-- Analyze table statistics
ANALYZE results;
ANALYZE users;
```

### 2. Application Optimization

```javascript
// Enable compression
app.use(compression());

// Configure caching
app.use(cacheMiddleware(300)); // 5 minutes cache

// Optimize database connections
const pool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

## Troubleshooting

### Common Issues

#### 1. Application Won't Start

```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs app

# Check environment variables
docker-compose -f docker-compose.prod.yml exec app env

# Check database connectivity
docker-compose -f docker-compose.prod.yml exec app npm run db:test
```

#### 2. Database Connection Issues

```bash
# Check database status
docker-compose -f docker-compose.prod.yml exec postgres pg_isready -U postgres

# Check database logs
docker-compose -f docker-compose.prod.yml logs postgres

# Test connection manually
docker-compose -f docker-compose.prod.yml exec postgres psql -U postgres -d laborresults_prod
```

#### 3. Performance Issues

```bash
# Check resource usage
docker stats

# Check application metrics
curl http://localhost:5000/api/metrics

# Check database performance
docker-compose -f docker-compose.prod.yml exec postgres psql -U postgres -d laborresults_prod -c "SELECT * FROM pg_stat_activity;"
```

### Health Checks

```bash
# Application health
curl -f http://localhost:5000/api/health

# Database health
curl -f http://localhost:5000/api/health/db

# Redis health
curl -f http://localhost:5000/api/health/redis
```

## Maintenance

### Regular Maintenance Tasks

#### Daily
- Check application logs for errors
- Monitor system resources
- Verify backup completion

#### Weekly
- Review security logs
- Update system packages
- Analyze performance metrics

#### Monthly
- Review and rotate logs
- Update SSL certificates
- Review and update dependencies

### Update Procedures

```bash
# Update application
git pull origin main
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d

# Update database schema
docker-compose -f docker-compose.prod.yml exec app npm run db:migrate
```

## Support and Documentation

### Useful Commands

```bash
# View all logs
docker-compose -f docker-compose.prod.yml logs -f

# View specific service logs
docker-compose -f docker-compose.prod.yml logs -f app

# Access application shell
docker-compose -f docker-compose.prod.yml exec app sh

# Access database shell
docker-compose -f docker-compose.prod.yml exec postgres psql -U postgres -d laborresults_prod

# Restart specific service
docker-compose -f docker-compose.prod.yml restart app

# Scale services
docker-compose -f docker-compose.prod.yml up -d --scale app=3
```

### Monitoring URLs

- **Application**: https://your-domain.com
- **API Documentation**: https://your-domain.com/api/docs
- **Grafana**: https://your-domain.com:3001
- **Prometheus**: https://your-domain.com:9090
- **Kibana**: https://your-domain.com:5601

### Contact Information

For support and questions:
- **Email**: support@yourlab.com
- **Documentation**: https://docs.yourlab.com
- **GitHub Issues**: https://github.com/your-org/lab-results-system/issues

---

**Note**: This deployment guide should be customized according to your specific infrastructure and requirements. Always test deployments in a staging environment before applying to production.