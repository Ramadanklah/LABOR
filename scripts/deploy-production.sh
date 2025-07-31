#!/bin/bash

# Production Deployment Script for Lab Results System
# This script automates the deployment process

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="laborresults"
DOMAIN="${DOMAIN:-localhost}"
EMAIL="${ADMIN_EMAIL:-admin@${DOMAIN}}"
BACKUP_DIR="${BACKUP_LOCATION:-./backups}"
LOG_FILE="deployment.log"

# Functions
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker first."
    fi
    
    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed. Please install Docker Compose first."
    fi
    
    # Check if required files exist
    if [ ! -f ".env.production" ]; then
        error ".env.production file not found. Please create it with all required variables."
    fi
    
    # Check if SSL certificates exist (if using HTTPS)
    if [ "$ENABLE_SSL" = "true" ]; then
        if [ ! -f "ssl/cert.pem" ] || [ ! -f "ssl/private.key" ]; then
            warning "SSL certificates not found. Will attempt to generate Let's Encrypt certificates."
        fi
    fi
    
    success "Prerequisites check completed"
}

# Generate SSL certificates using Let's Encrypt
generate_ssl_certificates() {
    if [ "$ENABLE_SSL" != "true" ]; then
        return
    fi
    
    log "Generating SSL certificates..."
    
    # Create SSL directory
    mkdir -p ssl
    
    # Check if certbot is installed
    if ! command -v certbot &> /dev/null; then
        log "Installing certbot..."
        if command -v apt-get &> /dev/null; then
            sudo apt-get update
            sudo apt-get install -y certbot python3-certbot-nginx
        elif command -v yum &> /dev/null; then
            sudo yum install -y certbot python3-certbot-nginx
        else
            error "Cannot install certbot automatically. Please install it manually."
        fi
    fi
    
    # Generate certificates
    sudo certbot certonly --standalone \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        -d "$DOMAIN" \
        --non-interactive
    
    # Copy certificates to ssl directory
    sudo cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ssl/cert.pem
    sudo cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" ssl/private.key
    sudo chown $USER:$USER ssl/cert.pem ssl/private.key
    
    success "SSL certificates generated"
}

# Create NGINX configuration
create_nginx_config() {
    log "Creating NGINX configuration..."
    
    mkdir -p nginx/conf.d
    
    cat > nginx/nginx.conf << 'EOF'
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Security headers
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;" always;

    # Performance
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;

    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    access_log /var/log/nginx/access.log main;

    include /etc/nginx/conf.d/*.conf;
}
EOF

    # Create main server configuration
    if [ "$ENABLE_SSL" = "true" ]; then
        cat > nginx/conf.d/default.conf << EOF
# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    # SSL configuration
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\\n";
        add_header Content-Type text/plain;
    }

    # API endpoints
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://app:5000/api/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Auth endpoints with stricter rate limiting
    location /api/auth/ {
        limit_req zone=auth burst=5 nodelay;
        proxy_pass http://app:5000/api/auth/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Webhook endpoints (restricted)
    location ~ ^/api/(mirth-)?webhook {
        # Add IP restrictions here if needed
        # allow 192.168.1.0/24;
        # deny all;
        
        proxy_pass http://app:5000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Static files
    location / {
        root /var/www/html;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }
}
EOF
    else
        cat > nginx/conf.d/default.conf << EOF
server {
    listen 80;
    server_name $DOMAIN;

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\\n";
        add_header Content-Type text/plain;
    }

    # API endpoints
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://app:5000/api/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Auth endpoints with stricter rate limiting
    location /api/auth/ {
        limit_req zone=auth burst=5 nodelay;
        proxy_pass http://app:5000/api/auth/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Static files
    location / {
        root /var/www/html;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }
}
EOF
    fi
    
    success "NGINX configuration created"
}

# Setup directories and permissions
setup_directories() {
    log "Setting up directories and permissions..."
    
    # Create necessary directories
    mkdir -p "$BACKUP_DIR"
    mkdir -p logs
    mkdir -p uploads
    mkdir -p ssl
    
    # Set permissions
    chmod 755 "$BACKUP_DIR"
    chmod 755 logs
    chmod 755 uploads
    
    success "Directories setup completed"
}

# Generate secrets
generate_secrets() {
    log "Generating secrets..."
    
    # Check if secrets already exist in .env.production
    if grep -q "JWT_SECRET.*change-this" .env.production || ! grep -q "JWT_SECRET" .env.production; then
        JWT_SECRET=$(openssl rand -hex 32)
        sed -i "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env.production
    fi
    
    if grep -q "WEBHOOK_SECRET.*change-this" .env.production || ! grep -q "WEBHOOK_SECRET" .env.production; then
        WEBHOOK_SECRET=$(openssl rand -hex 32)
        sed -i "s/WEBHOOK_SECRET=.*/WEBHOOK_SECRET=$WEBHOOK_SECRET/" .env.production
    fi
    
    if grep -q "MIRTH_WEBHOOK_SECRET.*change-this" .env.production || ! grep -q "MIRTH_WEBHOOK_SECRET" .env.production; then
        MIRTH_WEBHOOK_SECRET=$(openssl rand -hex 32)
        sed -i "s/MIRTH_WEBHOOK_SECRET=.*/MIRTH_WEBHOOK_SECRET=$MIRTH_WEBHOOK_SECRET/" .env.production
    fi
    
    success "Secrets generated"
}

# Deploy application
deploy_application() {
    log "Deploying application..."
    
    # Source environment variables
    export $(grep -v '^#' .env.production | xargs)
    
    # Build and start containers
    docker-compose -f docker-compose.prod.yml down
    docker-compose -f docker-compose.prod.yml build --no-cache
    docker-compose -f docker-compose.prod.yml up -d
    
    # Wait for services to be ready
    log "Waiting for services to be ready..."
    sleep 30
    
    # Check if services are running
    if ! docker-compose -f docker-compose.prod.yml ps | grep -q "Up"; then
        error "Some services failed to start. Check logs with: docker-compose -f docker-compose.prod.yml logs"
    fi
    
    success "Application deployed successfully"
}

# Run database migrations
run_migrations() {
    log "Running database migrations..."
    
    # Wait for database to be ready
    until docker-compose -f docker-compose.prod.yml exec postgres pg_isready -U "${DB_USER:-postgres}"; do
        log "Waiting for database to be ready..."
        sleep 2
    done
    
    # Run Prisma migrations
    docker-compose -f docker-compose.prod.yml exec app npx prisma db push
    
    success "Database migrations completed"
}

# Setup monitoring
setup_monitoring() {
    log "Setting up monitoring..."
    
    # Create monitoring directory
    mkdir -p monitoring
    
    # Create basic Prometheus configuration
    cat > monitoring/prometheus.yml << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  # - "first_rules.yml"
  # - "second_rules.yml"

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'app'
    static_configs:
      - targets: ['app:5000']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'nginx'
    static_configs:
      - targets: ['nginx:80']
    metrics_path: '/metrics'
    scrape_interval: 30s
EOF
    
    success "Monitoring setup completed"
}

# Setup backup cron job
setup_backup_cron() {
    log "Setting up backup cron job..."
    
    # Add backup script to host cron (fallback)
    CRON_SCHEDULE="${BACKUP_SCHEDULE:-0 2 * * *}"
    BACKUP_COMMAND="cd $(pwd) && ./scripts/backup-database.sh backup"
    
    # Check if cron job already exists
    if ! crontab -l 2>/dev/null | grep -q "backup-database.sh"; then
        (crontab -l 2>/dev/null; echo "$CRON_SCHEDULE $BACKUP_COMMAND") | crontab -
        success "Backup cron job added"
    else
        warning "Backup cron job already exists"
    fi
}

# Health check
health_check() {
    log "Performing health check..."
    
    # Check if application is responding
    if command -v curl &> /dev/null; then
        if curl -f "http://localhost/health" &> /dev/null; then
            success "Application health check passed"
        else
            error "Application health check failed"
        fi
    else
        warning "curl not found, skipping health check"
    fi
    
    # Check database connection
    if docker-compose -f docker-compose.prod.yml exec postgres pg_isready -U "${DB_USER:-postgres}" &> /dev/null; then
        success "Database health check passed"
    else
        error "Database health check failed"
    fi
}

# Show deployment summary
show_summary() {
    success "=== DEPLOYMENT SUMMARY ==="
    echo
    echo "🚀 Lab Results System deployed successfully!"
    echo
    echo "📊 Access URLs:"
    if [ "$ENABLE_SSL" = "true" ]; then
        echo "   Application: https://$DOMAIN"
        echo "   API: https://$DOMAIN/api"
    else
        echo "   Application: http://$DOMAIN"
        echo "   API: http://$DOMAIN/api"
    fi
    echo "   Prometheus: http://localhost:9090"
    echo
    echo "📁 Important directories:"
    echo "   Logs: ./logs"
    echo "   Backups: $BACKUP_DIR"
    echo "   SSL: ./ssl"
    echo
    echo "🔧 Management commands:"
    echo "   View logs: docker-compose -f docker-compose.prod.yml logs -f"
    echo "   Stop services: docker-compose -f docker-compose.prod.yml down"
    echo "   Restart services: docker-compose -f docker-compose.prod.yml restart"
    echo "   Backup database: ./scripts/backup-database.sh backup"
    echo
    echo "📄 Log file: $LOG_FILE"
    echo
    warning "Remember to:"
    echo "   1. Update DNS records to point to this server"
    echo "   2. Configure firewall rules (ports 80, 443, 22)"
    echo "   3. Set up SSL certificate auto-renewal"
    echo "   4. Review and update .env.production with real values"
    echo "   5. Configure email SMTP settings"
}

# Main deployment process
main() {
    log "Starting Lab Results System production deployment"
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --domain)
                DOMAIN="$2"
                shift 2
                ;;
            --email)
                EMAIL="$2"
                shift 2
                ;;
            --ssl)
                ENABLE_SSL="true"
                shift
                ;;
            --no-ssl)
                ENABLE_SSL="false"
                shift
                ;;
            --help)
                echo "Usage: $0 [options]"
                echo "Options:"
                echo "  --domain DOMAIN    Set domain name (default: localhost)"
                echo "  --email EMAIL      Set admin email"
                echo "  --ssl              Enable SSL with Let's Encrypt"
                echo "  --no-ssl           Disable SSL (default)"
                echo "  --help             Show this help"
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                ;;
        esac
    done
    
    # Run deployment steps
    check_prerequisites
    setup_directories
    generate_secrets
    create_nginx_config
    setup_monitoring
    
    if [ "$ENABLE_SSL" = "true" ]; then
        generate_ssl_certificates
    fi
    
    deploy_application
    run_migrations
    setup_backup_cron
    health_check
    show_summary
    
    success "Deployment completed successfully!"
}

# Run main function with all arguments
main "$@"