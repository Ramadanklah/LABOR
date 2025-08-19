# 🚀 PRODUCTION DEPLOYMENT GUIDE

## 📋 **PRE-DEPLOYMENT CHECKLIST**

### ✅ **Application Status**
- [x] Backend API fully functional
- [x] Frontend application working
- [x] User authentication system operational
- [x] User management features working
- [x] Database connections stable
- [x] All API endpoints tested
- [x] Error handling implemented
- [x] Security measures in place

### ✅ **Code Quality**
- [x] All API endpoint mismatches fixed
- [x] Error handling enhanced
- [x] Logging implemented
- [x] Code optimized for production
- [x] Security best practices applied

## 🏗️ **DEPLOYMENT OPTIONS**

### Option 1: Docker Compose (Recommended)

#### 1. **Environment Setup**
```bash
# Create production environment file
cp .env.example .env.production

# Configure production variables
nano .env.production
```

Required environment variables:
```env
NODE_ENV=production
DATABASE_URL=postgresql://labuser:your_password@postgres:5432/lab_results
REDIS_URL=redis://redis:6379
JWT_SECRET=your_super_secure_jwt_secret_here
DB_PASSWORD=your_secure_database_password
GRAFANA_PASSWORD=your_grafana_admin_password
FRONTEND_URLS=https://yourdomain.com,https://www.yourdomain.com
SMTP_HOST=your_smtp_server
SMTP_PORT=587
SMTP_USER=your_email@domain.com
SMTP_PASS=your_email_password
```

#### 2. **SSL Certificate Setup**
```bash
# Create SSL directory
mkdir -p ssl

# Generate self-signed certificate (for testing)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/private.key -out ssl/certificate.crt

# Or copy your real SSL certificates
cp your_certificate.crt ssl/certificate.crt
cp your_private.key ssl/private.key
```

#### 3. **Deploy with Docker Compose**
```bash
# Build and start all services
docker-compose -f docker-compose.prod.yml up -d

# Check service status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

#### 4. **Verify Deployment**
```bash
# Check health endpoint
curl https://yourdomain.com/api/health

# Test login
curl -X POST https://yourdomain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@laborresults.de","password":"admin123"}'
```

### Option 2: Manual Deployment

#### 1. **Server Setup**
```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt-get install postgresql postgresql-contrib

# Install Redis
sudo apt-get install redis-server

# Install Nginx
sudo apt-get install nginx
```

#### 2. **Database Setup**
```bash
# Create database user and database
sudo -u postgres psql
CREATE USER labuser WITH PASSWORD 'your_password';
CREATE DATABASE lab_results OWNER labuser;
GRANT ALL PRIVILEGES ON DATABASE lab_results TO labuser;
\q
```

#### 3. **Application Deployment**
```bash
# Clone repository
git clone <your-repo-url> /opt/lab-results
cd /opt/lab-results

# Install dependencies
cd server && npm install --production
cd ../client && npm install

# Build client
npm run build

# Set up environment
cp .env.example .env
nano .env  # Configure production settings

# Start server with PM2
npm install -g pm2
pm2 start server/server.js --name "lab-results-api"
pm2 startup
pm2 save
```

#### 4. **Nginx Configuration**
```nginx
# /etc/nginx/sites-available/lab-results
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";

    # Serve static files
    location / {
        root /opt/lab-results/client/dist;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API proxy
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/lab-results /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 🔒 **SECURITY CONFIGURATION**

### 1. **Firewall Setup**
```bash
# Configure UFW
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### 2. **SSL/TLS Configuration**
```bash
# Install Certbot for Let's Encrypt
sudo apt-get install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### 3. **Database Security**
```bash
# Secure PostgreSQL
sudo -u postgres psql
ALTER USER postgres PASSWORD 'secure_password';
\q

# Edit PostgreSQL config
sudo nano /etc/postgresql/*/main/postgresql.conf
# Set: listen_addresses = 'localhost'

sudo nano /etc/postgresql/*/main/pg_hba.conf
# Change: local all all peer -> local all all md5
```

## 📊 **MONITORING SETUP**

### 1. **Application Monitoring**
The Docker Compose setup includes:
- **Prometheus**: Metrics collection (http://yourdomain.com:9090)
- **Grafana**: Dashboards (http://yourdomain.com:3001)
- **Loki**: Log aggregation
- **Promtail**: Log shipping

### 2. **Health Checks**
```bash
# Set up health check monitoring
curl -f https://yourdomain.com/api/health || exit 1
```

### 3. **Log Monitoring**
```bash
# View application logs
docker-compose -f docker-compose.prod.yml logs -f app

# View Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

## 🔄 **BACKUP STRATEGY**

### 1. **Database Backups**
```bash
# Automated backup script (included in Docker setup)
#!/bin/bash
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -h postgres -U labuser lab_results > $BACKUP_DIR/backup_$DATE.sql
find $BACKUP_DIR -name "backup_*.sql" -mtime +7 -delete
```

### 2. **Application Backups**
```bash
# Backup application files
tar -czf /backups/app_backup_$(date +%Y%m%d).tar.gz /opt/lab-results
```

## 🚀 **DEPLOYMENT COMMANDS**

### Quick Start (Docker)
```bash
# 1. Clone and configure
git clone <repo> && cd lab-results
cp .env.example .env.production
# Edit .env.production with your settings

# 2. Deploy
docker-compose -f docker-compose.prod.yml up -d

# 3. Verify
curl http://localhost/api/health
```

### Update Deployment
```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
```

## 🔧 **TROUBLESHOOTING**

### Common Issues:

1. **502 Bad Gateway**
   - Check if backend is running: `docker-compose ps`
   - Check logs: `docker-compose logs app`

2. **Database Connection Error**
   - Verify DATABASE_URL in .env
   - Check PostgreSQL status: `docker-compose logs postgres`

3. **SSL Certificate Issues**
   - Verify certificate files exist
   - Check Nginx configuration: `nginx -t`

4. **CORS Errors**
   - Update FRONTEND_URLS in .env
   - Restart application

### Health Check Commands:
```bash
# Check all services
docker-compose -f docker-compose.prod.yml ps

# Check specific service logs
docker-compose -f docker-compose.prod.yml logs app
docker-compose -f docker-compose.prod.yml logs postgres
docker-compose -f docker-compose.prod.yml logs nginx

# Test API endpoints
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@laborresults.de","password":"admin123"}'
```

## 📈 **PERFORMANCE OPTIMIZATION**

### 1. **Database Optimization**
- Connection pooling configured
- Indexes on frequently queried fields
- Query optimization

### 2. **Caching Strategy**
- Redis for session storage
- API response caching
- Static asset caching

### 3. **Load Balancing**
- Nginx reverse proxy
- Multiple application instances
- Database read replicas

## ✅ **POST-DEPLOYMENT VERIFICATION**

1. **Functional Tests**
   - [ ] User login works
   - [ ] User creation works
   - [ ] Lab results display
   - [ ] File downloads work
   - [ ] Admin functions accessible

2. **Security Tests**
   - [ ] HTTPS redirect works
   - [ ] Authentication required for protected routes
   - [ ] Admin-only functions restricted
   - [ ] CORS properly configured

3. **Performance Tests**
   - [ ] Page load times < 3 seconds
   - [ ] API response times < 500ms
   - [ ] Database queries optimized
   - [ ] Static assets cached

**🎉 Your Lab Results Management System is now ready for production!**