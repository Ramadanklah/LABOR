# Lab Results Management System

A comprehensive, multi-tenant healthcare platform for managing laboratory results with advanced security, compliance, and interoperability features.

## 🏥 Features

### Core Functionality
- **Multi-tenant Architecture**: Complete tenant isolation with subdomain-based routing
- **LDT Message Processing**: Robust ingestion pipeline with validation and quarantine
- **Lab Results Management**: Complete CRUD operations with audit trails
- **Export System**: PDF, CSV, LDT, and FHIR exports with background processing
- **FHIR Integration**: Full FHIR R4 compliance for healthcare interoperability

### Security & Compliance
- **Row-Level Security (RLS)**: Database-level tenant isolation
- **Multi-Factor Authentication (MFA)**: TOTP-based 2FA for all users
- **Role-Based Access Control (RBAC)**: Granular permissions system
- **Audit Logging**: Comprehensive audit trails for compliance
- **Data Encryption**: At-rest and in-transit encryption
- **GDPR Compliance**: Data retention and deletion policies

### Performance & Monitoring
- **OpenTelemetry Integration**: Distributed tracing and metrics
- **Prometheus Monitoring**: Comprehensive SLOs and alerting
- **Redis Caching**: High-performance caching layer
- **Background Job Processing**: BullMQ for async operations
- **Health Checks**: Automated health monitoring

### Developer Experience
- **TypeScript Support**: Full type safety
- **ESLint & Prettier**: Code quality and formatting
- **Husky Git Hooks**: Pre-commit quality checks
- **Docker Multi-stage Builds**: Optimized containerization
- **Comprehensive Testing**: Unit, integration, and e2e tests

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+
- PostgreSQL 15+
- Redis 7+

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd lab-results-system
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start the development environment**
   ```bash
   docker-compose up -d
   ```

4. **Run database migrations**
   ```bash
   docker-compose exec server npm run db:migrate
   ```

5. **Seed demo data (optional)**
   ```bash
   docker-compose exec server npm run db:seed
   ```

6. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000
   - Grafana: http://localhost:3001 (admin/admin123)
   - Prometheus: http://localhost:9090
   - Jaeger: http://localhost:16686

### Demo Credentials
```
Default Tenant:
- Admin: admin@laborresults.de / admin123
- Doctor: doctor@laborresults.de / doctor123
- Lab: lab@laborresults.de / lab123

Demo Tenant:
- Admin: admin@demo.laborresults.de / demo123
```

## 🏗️ Architecture

### Multi-Tenancy
- **Tenant Resolution**: Subdomain-based routing (e.g., `tenant1.laborresults.de`)
- **Database Isolation**: Row-Level Security (RLS) policies
- **API Key Management**: Per-tenant API keys with scoped permissions
- **BSNR Mapping**: Automatic tenant routing based on BSNR codes

### Data Flow
```
LDT Message → Validation → Tenant Resolution → Processing → Storage → Normalization
     ↓
Quarantine (if malformed) → Retry Logic → Error Handling
```

### Security Model
```
User Authentication → MFA Verification → Role Assignment → Permission Check → Resource Access
```

## 📊 API Documentation

### Authentication Endpoints
- `POST /api/auth/login` - User login with MFA
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - User logout
- `POST /api/auth/mfa/setup` - Setup MFA
- `POST /api/auth/mfa/verify` - Verify MFA token

### LDT Processing
- `POST /api/ldt/ingest` - Ingest LDT messages
- `GET /api/ldt/messages` - List LDT messages
- `GET /api/ldt/messages/:id` - Get LDT message details
- `POST /api/ldt/messages/:id/retry` - Retry failed message

### Lab Results
- `GET /api/results` - List lab results
- `POST /api/results` - Create lab result
- `GET /api/results/:id` - Get result details
- `PUT /api/results/:id` - Update result
- `DELETE /api/results/:id` - Delete result

### Exports
- `POST /api/exports` - Create export job
- `GET /api/exports` - List export jobs
- `GET /api/exports/:id` - Get export status
- `GET /api/exports/:id/download` - Download export file

### FHIR Endpoints
- `GET /fhir/Observation` - FHIR Observation resources
- `GET /fhir/Patient` - FHIR Patient resources
- `GET /fhir/Practitioner` - FHIR Practitioner resources

### Admin Endpoints
- `GET /api/admin/tenants` - List tenants
- `POST /api/admin/tenants` - Create tenant
- `GET /api/admin/users` - List users
- `POST /api/admin/users` - Create user
- `GET /api/admin/audit-logs` - View audit logs

## 📚 Canonical Docs

- SECURITY: see `SECURITY.md`
- TENANCY: see `TENANCY.md`
- IMPORT WORKFLOW: see `IMPORT_WORKFLOW.md`
- OPERATIONS: see `OPERATION.md`
- TEST PLAN: see `TEST_PLAN.md`

## 🔧 Configuration

### Environment Variables

Note: The following values are examples for local development only. Do not commit real secrets. For production, use a secrets manager and CI/CD injection.

#### Database
```env
DATABASE_URL=postgresql://username:password@localhost:5432/lab_results_db
DATABASE_POOL_SIZE=20
DATABASE_TIMEOUT=30000
```

#### Security
```env
JWT_SECRET=dev-only-change-me
JWT_ACCESS_TOKEN_EXPIRY=15m
JWT_REFRESH_TOKEN_EXPIRY=7d
BCRYPT_ROUNDS=12
```

#### Redis
```env
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=dev-only
```

#### Storage
```env
STORAGE_TYPE=local  # local, s3, minio
S3_BUCKET=lab-results-storage
S3_REGION=eu-central-1
S3_ACCESS_KEY=dev-only
S3_SECRET_KEY=dev-only
```

#### Monitoring
```env
OTEL_ENDPOINT=http://localhost:4317
METRICS_PORT=9090
```

## 🧪 Testing

### Run Tests
```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Coverage report
npm run test:coverage
```

### Test Categories
- **Unit Tests**: Individual function and component testing
- **Integration Tests**: API endpoint and database interaction testing
- **E2E Tests**: Full user workflow testing
- **Security Tests**: Authentication and authorization testing
- **Performance Tests**: Load and stress testing

## 📈 Monitoring & Observability

### Metrics
- **API Performance**: Request rate, latency, error rates
- **Database Performance**: Connection pool, query performance
- **System Resources**: CPU, memory, disk usage
- **Business Metrics**: LDT processing rate, export generation

### SLOs (Service Level Objectives)
- **API Availability**: 99.9%
- **API Latency**: p95 < 500ms
- **LDT Processing**: 99% success rate
- **Export Generation**: 95% success rate
- **Authentication**: 99% success rate

### Alerts
- Critical: API availability, authentication failures, tenant isolation violations
- Warning: High resource usage, export failures, security events

## 🔒 Security Features

### Authentication & Authorization
- **Multi-Factor Authentication**: TOTP-based 2FA
- **JWT Tokens**: Secure token-based authentication
- **Refresh Token Rotation**: Automatic token refresh with reuse detection
- **Role-Based Access Control**: Granular permission system
- **API Key Management**: Scoped API keys for integrations

### Data Protection
- **Row-Level Security**: Database-level tenant isolation
- **Data Encryption**: AES-256 encryption at rest and in transit
- **Audit Logging**: Comprehensive audit trails
- **Data Retention**: Configurable retention policies
- **GDPR Compliance**: Right to be forgotten implementation

### Network Security
- **HTTPS Only**: TLS 1.3 encryption
- **Security Headers**: HSTS, CSP, X-Frame-Options
- **Rate Limiting**: IP and user-based rate limiting
- **CORS Configuration**: Strict CORS policies
- **Input Validation**: Comprehensive input sanitization

## 🚀 Deployment

### Production Deployment

1. **Environment Setup**
   ```bash
   # Set production environment variables
   export NODE_ENV=production
   export DATABASE_URL=your-production-db-url
   export REDIS_URL=your-production-redis-url
   ```

2. **Database Migration**
   ```bash
   npm run db:migrate
   ```

3. **Build and Deploy**
   ```bash
   # Build production images
   docker-compose -f docker-compose.prod.yml build

   # Deploy
   docker-compose -f docker-compose.prod.yml up -d
   ```

### Kubernetes Deployment
```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -n lab-results
```

## 📚 Development

### Project Structure
```
├── server/                 # Backend application
│   ├── models/            # Data models
│   ├── routes/            # API routes
│   ├── middleware/        # Express middleware
│   ├── utils/             # Utility functions
│   └── tests/             # Backend tests
├── client/                # Frontend application
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom hooks
│   │   ├── services/      # API services
│   │   └── utils/         # Utility functions
│   └── tests/             # Frontend tests
├── prisma/                # Database schema and migrations
├── monitoring/            # Monitoring configuration
├── scripts/               # Deployment and utility scripts
└── docs/                  # Documentation
```

### Code Quality
- **ESLint**: Code linting with healthcare-specific rules
- **Prettier**: Code formatting
- **Husky**: Git hooks for quality checks
- **TypeScript**: Type safety
- **Jest**: Testing framework

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Documentation
- [API Documentation](docs/api.md)
- [Deployment Guide](docs/deployment.md)
- [Security Guide](docs/security.md)
- [Troubleshooting](docs/troubleshooting.md)

### Contact
- **Email**: support@laborresults.de
- **Issues**: [GitHub Issues](https://github.com/your-org/lab-results-system/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/lab-results-system/discussions)

## 🔄 Changelog

See [CHANGELOG.md](CHANGELOG.md) for a detailed history of changes.

## 🙏 Acknowledgments

- FHIR community for healthcare interoperability standards
- Prisma team for the excellent ORM
- OpenTelemetry community for observability tools
- All contributors and maintainers