# Lab Results Management System - Test Suite Documentation

This document provides comprehensive information about the test suite for the Lab Results Management System.

## Overview

The test suite covers all aspects of the healthcare lab results platform, ensuring reliability, security, and compliance with healthcare data standards. The testing framework is built using **Jest** as the primary testing framework.

## Test Structure

### Test Categories

1. **Unit Tests** - Individual component and function testing
2. **Integration Tests** - API endpoints and data flow testing
3. **End-to-End (E2E) Tests** - Complete user workflow testing
4. **Security Tests** - Authentication, authorization, and data protection
5. **Performance Tests** - Load testing and optimization validation

### Framework Configuration

- **Primary Framework**: Jest 29.7.0
- **API Testing**: Supertest
- **React Testing**: React Testing Library
- **Coverage Target**: 70% minimum across all metrics

## Test Files

### Server Tests

```
server/
├── jest.config.js              # Jest configuration for server
├── jest.setup.js               # Test setup and global utilities
├── jest.global-setup.js        # Global test environment setup
├── jest.global-teardown.js     # Global cleanup
├── user-management.test.js     # User authentication and management
└── ldt-processing.test.js      # LDT file parsing and processing
```

### Client Tests

```
client/
├── jest.config.js              # Jest configuration for React
├── babel.config.js             # Babel configuration for testing
├── src/
│   ├── setupTests.js           # React testing setup
│   └── components/
│       ├── App.test.jsx        # Main application component
│       └── LoginPage.test.jsx  # Login functionality
```

### Integration & E2E Tests

```
├── integration.test.js         # Full API integration testing
├── e2e.test.js                # End-to-end workflow testing
└── run-tests.js               # Test runner script
```

## Running Tests

### Quick Start

```bash
# Install all dependencies
npm run install:all

# Run complete test suite
npm test

# Run specific test categories
npm run test:server      # Server-only tests
npm run test:client      # Client-only tests
npm run test:integration # Integration tests
npm run test:e2e         # End-to-end tests

# Run with coverage
npm run test:coverage
```

### Test Runner Options

```bash
# Advanced test runner usage
node run-tests.js [options]

Options:
  --skip-install     Skip dependency installation
  --server-only      Run only server tests
  --client-only      Run only client tests
  --integration-only Run only integration tests
  --e2e-only         Run only E2E tests
  --coverage         Generate coverage reports
  --verbose          Verbose output
  --help, -h         Show help message
```

### Direct Jest Usage

```bash
# Server tests
cd server && npm test

# Client tests
cd client && npm test

# Specific test files
jest integration.test.js --verbose
jest e2e.test.js --detectOpenHandles
```

## Test Coverage

### Coverage Targets

- **Branches**: 70% minimum
- **Functions**: 70% minimum
- **Lines**: 70% minimum
- **Statements**: 70% minimum

### Coverage Reports

Coverage reports are generated in multiple formats:
- **Text**: Console output during test runs
- **LCOV**: For CI/CD integration
- **HTML**: Detailed visual reports in `coverage/` directory

## Test Categories Details

### 1. User Management Tests (`user-management.test.js`)

**Coverage:**
- User registration and validation
- Authentication flows (email/password, BSNR/LANR)
- Two-factor authentication (2FA)
- Password strength enforcement
- Account lockout mechanisms
- Role-based permissions
- Session management

**Key Test Cases:**
```javascript
// User creation with validation
it('should create a new user with valid data', async () => {
  const userData = { email, password, firstName, lastName, role, bsnr, lanr };
  const user = await userModel.createUser(userData);
  expect(user).toHaveProperty('id');
  expect(user.password).not.toBe(userData.password); // Hashed
});

// 2FA verification
it('should enable 2FA with valid token', async () => {
  const { base32 } = userModel.generateTwoFactorSecret(userId);
  const token = speakeasy.totp({ secret: base32, encoding: 'base32' });
  const result = await userModel.enableTwoFactor(userId, token);
  expect(result.success).toBe(true);
});
```

### 2. LDT Processing Tests (`ldt-processing.test.js`)

**Coverage:**
- LDT file parsing and validation
- Data extraction and normalization
- Error handling for malformed files
- BSNR/LANR validation
- Multi-patient batch processing
- Performance optimization

**Key Test Cases:**
```javascript
// LDT parsing with multiple results
it('should parse LDT with multiple test results', () => {
  const ldtContent = `8220: 123456789...`;
  const result = parseLDT(ldtContent);
  expect(result.success).toBe(true);
  expect(result.data.results).toHaveLength(3);
});

// Round-trip testing
it('should maintain data integrity in parse-generate cycle', () => {
  const originalData = { bsnr, lanr, patientData, results };
  const ldtContent = ldtGenerator.generate(originalData);
  const parseResult = parseLDT(ldtContent);
  expect(parseResult.data.bsnr).toBe(originalData.bsnr);
});
```

### 3. React Component Tests

**Coverage:**
- Component rendering and state management
- User interactions and event handling
- Form validation and submission
- Error boundary functionality
- Accessibility compliance
- Performance optimization

**Key Test Cases:**
```javascript
// Login form functionality
it('should handle successful login', async () => {
  const user = userEvent.setup();
  mockApiClient.post.mockResolvedValue({
    data: { success: true, token: 'mock-token', user: mockUserData }
  });
  
  await user.type(screen.getByLabelText(/email/i), 'test@example.com');
  await user.type(screen.getByLabelText(/password/i), 'password123');
  await user.click(screen.getByRole('button', { name: /sign in/i }));
  
  expect(mockOnLogin).toHaveBeenCalledWith(mockUserData);
});
```

### 4. Integration Tests (`integration.test.js`)

**Coverage:**
- Complete API workflow testing
- Database integration
- File upload and processing
- Authentication and authorization
- Multi-user scenarios
- Error handling and recovery

**Test Flow:**
1. System health verification
2. User registration and authentication
3. LDT file upload and processing
4. Result assignment and access control
5. Export functionality validation
6. Admin operations testing
7. Cleanup and verification

### 5. End-to-End Tests (`e2e.test.js`)

**Coverage:**
- Complete user workflows
- Multi-role interactions
- Data privacy and security
- Performance under load
- GDPR compliance
- System scalability

**Workflow Examples:**
```javascript
// Doctor workflow: Upload → Process → Assign
it('should complete doctor workflow', async () => {
  // 1. Doctor uploads LDT file
  const uploadResponse = await request(app)
    .post('/api/upload-ldt')
    .set('Authorization', `Bearer ${doctorToken}`)
    .attach('ldt', Buffer.from(ldtContent), 'results.ldt');
    
  // 2. Results are processed and stored
  expect(uploadResponse.body.success).toBe(true);
  
  // 3. Admin assigns results to patients
  const assignResponse = await request(app)
    .post('/api/admin/assign-result')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ resultId, userEmail });
    
  // 4. Patient can access assigned results
  const accessResponse = await request(app)
    .get(`/api/results/${resultId}`)
    .set('Authorization', `Bearer ${patientToken}`);
    
  expect(accessResponse.status).toBe(200);
});
```

## Security Testing

### Authentication Security
- Password strength enforcement
- Account lockout after failed attempts
- JWT token validation
- Session management
- 2FA implementation

### Data Access Control
- Role-based permissions (RBAC)
- Patient data isolation
- SQL injection prevention
- XSS attack prevention
- CSRF protection

### GDPR Compliance
- Data anonymization in logs
- User data export functionality
- Right to deletion implementation
- Consent management

## Performance Testing

### Load Testing
- Concurrent user authentication
- Simultaneous result queries
- Large file upload handling
- Database query optimization

### Scalability Testing
- Multi-tenant data isolation
- Caching effectiveness
- Resource utilization monitoring
- Response time optimization

## Test Data Management

### Test User Roles
```javascript
// Admin user
adminUser = {
  email: 'admin@laborresults.de',
  password: 'Admin123!',
  role: 'admin'
};

// Doctor with BSNR/LANR
doctorUser = {
  email: 'dr.mueller@praxis-beispiel.de',
  password: 'SecureDoc123!',
  role: 'doctor',
  bsnr: '123456789',
  lanr: '987654321'
};

// Lab technician
labTechUser = {
  email: 'lab.tech@labor-beispiel.de',
  password: 'LabTech123!',
  role: 'lab_tech'
};

// Patient users
patientUser = {
  email: 'max.mustermann@email.de',
  password: 'Patient123!',
  role: 'patient'
};
```

### Sample LDT Data
```ldt
8220: 123456789
8221: 987654321
8200: 20240115
8201: 1430
3000: P001
3101: Mustermann
3102: Max
3103: 01.01.1980
3110: m
3105: Musterstraße 123
3106: 12345
3107: Musterstadt
3108: 01234567890
3109: max.mustermann@email.de
3000: GLU
8410: Glucose
8411: 95.5
8421: mg/dl
8422: 70-110
8430: N
```

## Environment Setup

### Test Environment Variables
```env
NODE_ENV=test
JWT_SECRET=test_jwt_secret_please_override
DATABASE_URL=postgresql://test:test@localhost:5432/test_db
REDIS_URL=redis://localhost:6379/1
PORT=5001
LOG_LEVEL=error
```

### Database Setup
For full integration testing, ensure:
1. PostgreSQL test database is available
2. Redis instance for session/cache testing
3. File storage directory with proper permissions
4. SMTP server for email testing (optional)

## Continuous Integration

### GitHub Actions Integration
```yaml
# .github/workflows/test.yml
name: Test Suite
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm run install:all
      - run: npm run test:ci
      - uses: codecov/codecov-action@v3
```

### Coverage Reporting
- **Local**: HTML reports in `coverage/` directory
- **CI/CD**: LCOV reports uploaded to Codecov
- **Slack/Email**: Notifications for coverage changes

## Debugging Tests

### Common Issues
1. **Port conflicts**: Ensure test ports are available
2. **Database connections**: Verify test database is accessible
3. **File permissions**: Check upload/download directory permissions
4. **Memory leaks**: Use `--detectOpenHandles` for hanging tests

### Debug Commands
```bash
# Run specific test with debug output
DEBUG=* jest user-management.test.js

# Run with Node.js debugger
node --inspect-brk node_modules/.bin/jest --runInBand

# Memory leak detection
jest --detectOpenHandles --forceExit
```

## Custom Matchers

### Server-side Matchers
```javascript
expect(email).toBeValidEmail();
expect(bsnr).toBeValidBSNR();
expect(lanr).toBeValidLANR();
expect(userRole).toBeOneOf(['admin', 'doctor', 'lab_tech', 'patient']);
```

### Client-side Matchers
```javascript
expect(element).toBeVisible();
expect(input).toHaveValue('expected value');
expect(component).toHaveAttribute('aria-label');
```

## Best Practices

### Test Organization
- **Arrange, Act, Assert**: Clear test structure
- **Descriptive names**: Test purpose should be obvious
- **Independent tests**: No dependencies between tests
- **Cleanup**: Always clean up created data

### Mock Strategy
- **External services**: Always mock third-party APIs
- **Database**: Use test database, not production
- **File system**: Mock file operations where possible
- **Time**: Mock Date/time for consistent results

### Data Isolation
- **Test users**: Create unique test users per test
- **Test data**: Generate unique test data
- **Parallel execution**: Ensure tests can run concurrently
- **Cleanup**: Always clean up after tests

## Maintenance

### Regular Updates
- **Dependencies**: Keep Jest and testing libraries updated
- **Test data**: Refresh sample LDT files regularly
- **Coverage targets**: Adjust based on codebase changes
- **Performance baselines**: Update as system evolves

### Test Health Monitoring
- **Flaky tests**: Identify and fix unreliable tests
- **Slow tests**: Optimize tests taking >5 seconds
- **Coverage gaps**: Add tests for uncovered code
- **Mock drift**: Ensure mocks match real implementations

## Support

For test-related issues:
1. Check this documentation first
2. Review test output and error messages
3. Verify environment setup
4. Contact the development team

Remember: Tests are living documentation - keep them updated as the system evolves!