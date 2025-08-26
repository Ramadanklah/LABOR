---
description: Repository Information Overview
alwaysApply: true
---

# Lab Results Management System Information

## Summary
A comprehensive, multi-tenant healthcare platform for managing laboratory results with advanced security, compliance, and interoperability features. The system processes LDT (Labor Daten Transfer) messages, manages lab results, and provides export capabilities in various formats.

## Structure
- **server/**: Backend Express.js application with LDT parsing/normalization utilities
- **client/**: Frontend React application built with Vite
- **prisma/**: Database schema and migrations for PostgreSQL
- **deploy/**: Production deployment configurations (Docker Compose and Kubernetes)
- **monitoring/**: Prometheus and Grafana configurations
- **.github/workflows/**: CI pipelines for automated testing and deployment

## Language & Runtime
**Language**: JavaScript/Node.js (Backend), React/JavaScript (Frontend)
**Version**: Node.js 18+
**Build System**: npm (Backend), Vite (Frontend)
**Package Manager**: npm
**Database**: PostgreSQL 15+
**Cache**: Redis 7+

## Dependencies

### Backend Dependencies
**Main Dependencies**:
- Express.js 5.1.0 (API server)
- Prisma 5.7.2 (ORM for PostgreSQL)
- BullMQ 5.0.0 (Background job processing)
- Winston 3.11.0 (Logging)
- OpenTelemetry (Monitoring and tracing)
- Puppeteer 24.17.0 (PDF generation)
- JWT 9.0.2 (Authentication)

**Development Dependencies**:
- Jest 29.7.0 (Testing)
- ESLint 8.55.0 (Linting)
- Prettier 3.1.0 (Formatting)
- Husky 8.0.3 (Git hooks)

### Frontend Dependencies
**Main Dependencies**:
- React 18.2.0
- React Router 6.20.0
- Axios 1.6.2 (HTTP client)

**Development Dependencies**:
- Vite 5.4.19 (Build tool)
- TailwindCSS 3.3.6 (Styling)

## Build & Installation

### Backend
```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate deploy

# Start development server
npm run dev

# Start production server
npm start
```

### Frontend
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Docker
**Dockerfiles**: 
- `Dockerfile` (Backend)
- `Dockerfile.client` (Frontend)

**Docker Compose**: `docker-compose.yml` (Development), `docker-compose.prod.yml` (Production)

**Configuration**:
- Multi-stage builds for both backend and frontend
- Non-root user for production containers
- Health checks for all services
- Includes PostgreSQL, Redis, Mirth Connect, and Grafana

**Run Command**:
```bash
# Development
docker compose up -d

# Production
docker compose -f deploy/prod-compose.yml --env-file .env.production up -d
```

## Testing
**Framework**: Jest 29.7.0
**targetFramework**: Jest
**Test Coverage**: 244 test cases across 88 test suites
**Test Location**: 
- Server tests: `server/*.test.js`
- Client tests: `client/src/**/*.test.jsx`
- Integration tests: `integration.test.js`
- E2E tests: `e2e.test.js`

**Test Categories**:
- User Management (52 tests): Authentication, authorization, user CRUD
- LDT Processing (39 tests): File parsing, data validation, format conversion
- React Components (63 tests): UI components, user interactions, form handling
- API Integration (38 tests): Full workflow testing, database operations
- E2E Workflows (52 tests): Complete user journeys, multi-role scenarios

**Run Commands**:
```bash
# Complete test suite
npm test

# Specific test categories
npm run test:server       # Server-only tests
npm run test:client       # Client-only tests
npm run test:integration  # Integration tests
npm run test:e2e          # End-to-end tests

# Coverage and utilities
npm run test:coverage     # Coverage report
npm run install:all       # Install all dependencies
node validate-tests.js    # Validate test setup
```

**Additional Testing Tools**:
- Supertest 6.3.3 (API testing)
- React Testing Library 13.4.0 (Component testing)
- Custom test utilities and matchers
- Comprehensive test documentation in `TESTING.md`

## Database
**Schema**: Prisma schema with multi-tenant design
**Key Models**:
- Tenant: Multi-tenancy support
- User: User management with role-based access
- Result: Lab results data
- Observation: Individual lab test observations
- LDTMessage: LDT message processing
- Export: Export job management
- AuditLog: Comprehensive audit logging

**Migrations**: Managed through Prisma Migrate