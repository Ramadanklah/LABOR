# Lab Results System - Production Deployment Guide

This guide will help you deploy the Lab Results System to production with enterprise-grade security, monitoring, and backup capabilities.

## 🚀 Quick Start

```bash
# 1. Clone and prepare
git clone <repository-url>
cd lab-results-system

# 2. Configure environment
cp .env.production.example .env.production
# Edit .env.production with your settings

# 3. Deploy with SSL
./scripts/deploy-production.sh --domain yourdomain.com --email admin@yourdomain.com --ssl

# 4. Verify deployment
curl https://yourdomain.com/health
```

## 📋 Prerequisites

### System Requirements
- **OS**: Ubuntu 20.04+ / CentOS 8+ / RHEL 8+
- **RAM**: Minimum 4GB, Recommended 8GB+
- **Storage**: Minimum 50GB SSD
- **CPU**: 2+ cores
- **Network**: Static IP with port 80/443 access

### Software Dependencies
- Docker 20.10+
- Docker Compose 2.0+
- Git
- OpenSSL
- Certbot (for SSL certificates)

### Installation Script
```bash
#!/bin/bash
# Install dependencies on Ubuntu/Debian
sudo apt update
sudo apt install -y docker.io docker-compose git openssl certbot

# Enable Docker
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $USER

# Logout and login again for group changes
```

## 🔒 Security Hardening

### 1. Environment Configuration

**Critical**: Update `.env.production` with secure values:

```bash
# Generate secure secrets
JWT_SECRET=$(openssl rand -hex 32)
WEBHOOK_SECRET=$(openssl rand -hex 32)
MIRTH_WEBHOOK_SECRET=$(openssl rand -hex 32)
DB_PASSWORD=$(openssl rand -base64 32)
REDIS_PASSWORD=$(openssl rand -base64 32)
```

### 2. Database Security
- Uses PostgreSQL with SCRAM-SHA-256 authentication
- Database only accessible from localhost
- Connection pooling with limits
- Automated daily backups with encryption

### 3. Network Security
- NGINX reverse proxy with security headers
- Rate limiting on all endpoints
- IP whitelisting for webhook endpoints
- SSL/TLS encryption with modern ciphers

### 4. Application Security
- JWT tokens with secure secrets
- Input validation on all endpoints
- Password strength enforcement
- Two-factor authentication ready
- Audit logging for all user actions

## 📧 Email Configuration (Gmail)

### Setup Gmail SMTP
1. Enable 2FA on your Gmail account
2. Generate an App Password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate password for "Mail"

3. Update `.env.production`:
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=your-email@gmail.com
FROM_NAME="Lab Results System"
```

### Test Email Configuration
```bash
# Test email sending
docker-compose -f docker-compose.prod.yml exec app node -e "
const GmailAuthService = require('./utils/gmailAuth');
const service = new GmailAuthService();
service.testEmailConfiguration().then(console.log);
"
```

## 🔗 Domain and SSL Setup

### DNS Configuration
Point your domain to your server:
```
A    yourdomain.com    → YOUR_SERVER_IP
AAAA yourdomain.com    → YOUR_SERVER_IPv6 (if applicable)
```

### SSL Certificate Management
```bash
# Automatic SSL with deployment script
./scripts/deploy-production.sh --domain yourdomain.com --ssl

# Manual SSL certificate renewal
sudo certbot renew --dry-run

# Setup auto-renewal cron
echo "0 2 * * * certbot renew --quiet" | sudo crontab -
```

## 🐳 Container Management

### Basic Operations
```bash
# Start all services
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f app
docker-compose -f docker-compose.prod.yml logs -f postgres

# Stop services
docker-compose -f docker-compose.prod.yml down

# Restart specific service
docker-compose -f docker-compose.prod.yml restart app

# Update application
git pull
docker-compose -f docker-compose.prod.yml build app
docker-compose -f docker-compose.prod.yml up -d app
```

### Health Monitoring
```bash
# Check container health
docker-compose -f docker-compose.prod.yml ps

# Application health endpoint
curl https://yourdomain.com/health

# Database health
docker-compose -f docker-compose.prod.yml exec postgres pg_isready
```

## 💾 Backup and Recovery

### Automated Backups
Backups run automatically at 2 AM daily via cron job:
```bash
# View backup status
./scripts/backup-database.sh list

# Manual backup
./scripts/backup-database.sh backup

# Verify backup
./scripts/backup-database.sh verify /backups/laborresults_backup_YYYYMMDD_HHMMSS.sql.gz
```

### Database Recovery
```bash
# Restore from backup
./scripts/backup-database.sh restore /backups/laborresults_backup_YYYYMMDD_HHMMSS.sql.gz

# Point-in-time recovery (if WAL archiving enabled)
# This requires additional PostgreSQL configuration
```

### Backup Best Practices
- Keep at least 30 days of backups
- Store backups off-site (S3, Google Cloud, etc.)
- Test recovery procedures monthly
- Monitor backup success/failure

## 📊 Monitoring and Observability

### Prometheus Metrics
Access Prometheus at `http://localhost:9090`

Key metrics to monitor:
- HTTP response times and status codes
- Database connection pool usage
- Memory and CPU utilization
- Disk space usage
- Active user sessions

### Log Management
Logs are centralized using Fluentd:
```bash
# View application logs
docker-compose -f docker-compose.prod.yml logs -f app

# View NGINX access logs
docker-compose -f docker-compose.prod.yml logs -f nginx

# Search logs
docker-compose -f docker-compose.prod.yml exec fluentd grep "ERROR" /var/log/fluentd/app.log
```

### Alerting Setup
Configure alerts for:
- High error rates (>5%)
- Response time >2 seconds
- Database connection failures
- Disk space >80% full
- Failed backups

## 🔧 Maintenance Tasks

### Daily
- Monitor application health
- Check backup success
- Review error logs

### Weekly
- Review security logs
- Update system packages
- Check SSL certificate expiry

### Monthly
- Test backup recovery
- Review performance metrics
- Update dependencies

### Security Updates
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Docker images
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d

# Update Node.js dependencies
cd server && npm audit fix
```

## 🔐 Mirth Connect Integration

### Webhook Security
Configure Mirth Connect to send webhooks with:
- IP whitelisting in `.env.production`:
```bash
MIRTH_ALLOWED_IPS="192.168.1.100,10.0.0.0/8"
```

- Signature verification:
```bash
MIRTH_WEBHOOK_SECRET="your-shared-secret"
```

### Mirth HTTP Sender Configuration
```xml
<!-- Add to Mirth HTTP Sender -->
<Header name="X-Hub-Signature-256">${WEBHOOK_SIGNATURE}</Header>
<Header name="Content-Type">application/json</Header>
```

## 🚨 Troubleshooting

### Common Issues

#### Application Won't Start
```bash
# Check container logs
docker-compose -f docker-compose.prod.yml logs app

# Check environment variables
docker-compose -f docker-compose.prod.yml exec app env | grep -E "(JWT|DB|SMTP)"

# Verify database connection
docker-compose -f docker-compose.prod.yml exec app npx prisma db push
```

#### SSL Certificate Issues
```bash
# Check certificate validity
openssl x509 -in ssl/cert.pem -text -noout

# Regenerate certificates
sudo certbot delete --cert-name yourdomain.com
./scripts/deploy-production.sh --domain yourdomain.com --ssl
```

#### Email Not Working
```bash
# Test SMTP connection
docker-compose -f docker-compose.prod.yml exec app node -e "
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});
transporter.verify().then(console.log).catch(console.error);
"
```

#### High Memory Usage
```bash
# Check container resource usage
docker stats

# Restart services to clear memory
docker-compose -f docker-compose.prod.yml restart
```

### Performance Optimization

#### Database Tuning
```sql
-- Monitor slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;

-- Check index usage
SELECT schemaname, tablename, attname, n_distinct, correlation 
FROM pg_stats 
WHERE tablename = 'User';
```

#### Application Tuning
```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=2048"

# Enable clustering
NODE_ENV=production PM2_INSTANCES=max
```

## 📞 Support and Documentation

### Getting Help
- Check application logs first
- Review this documentation
- Search existing issues
- Create detailed bug reports

### Log Levels
- `error`: Critical issues requiring immediate attention
- `warn`: Issues that should be monitored
- `info`: General operational information
- `debug`: Detailed debugging information

### Performance Benchmarks
Target performance metrics:
- Response time: <500ms (95th percentile)
- Uptime: >99.9%
- Error rate: <1%
- Database queries: <100ms average

## 🔄 Disaster Recovery

### Full System Recovery
1. Provision new server with same specifications
2. Install dependencies using installation script
3. Restore latest configuration and SSL certificates
4. Restore database from latest backup
5. Deploy application using deployment script
6. Update DNS if IP changed
7. Verify all services are operational

### RTO/RPO Targets
- **Recovery Time Objective (RTO)**: 4 hours
- **Recovery Point Objective (RPO)**: 24 hours
- **Maximum Tolerable Downtime**: 8 hours

---

## 📚 Additional Resources

- [Security Best Practices](./SECURITY.md)
- [API Documentation](./API_DOCUMENTATION.md)
- [Development Guide](./README.md)
- [Troubleshooting Guide](./TROUBLESHOOTING_GUIDE.md)

For technical support, please contact your system administrator or create an issue in the project repository.