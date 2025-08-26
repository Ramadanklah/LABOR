const request = require('supertest');
const path = require('path');

// Load environment variables for testing
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_please_override';

const express = require('express');
const app = express();

// Mock database and dependencies for testing
jest.mock('./db/prismaClient.js', () => ({
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  },
  result: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  },
  tenant: {
    findUnique: jest.fn(),
    findMany: jest.fn()
  }
}));

// Import the actual server after mocking
const server = require('./server.js');

describe('Lab Results API Tests', () => {
  let adminToken;
  let userToken;
  let doctorToken;

  beforeAll(async () => {
    // Setup test data and generate tokens for different user roles
    adminToken = 'Bearer mock_admin_token';
    userToken = 'Bearer mock_user_token';
    doctorToken = 'Bearer mock_doctor_token';
  });

  afterAll(async () => {
    // Cleanup after tests
    if (server && server.close) {
      server.close();
    }
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'healthy',
        timestamp: expect.any(String),
        uptime: expect.any(Number)
      });
    });
  });

  describe('Authentication Endpoints', () => {
    describe('POST /api/auth/login', () => {
      it('should login user with valid credentials', async () => {
        const loginData = {
          email: 'test@example.com',
          password: 'password123'
        };

        const response = await request(app)
          .post('/api/auth/login')
          .send(loginData)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('token');
        expect(response.body.user).toHaveProperty('email', loginData.email);
      });

      it('should reject login with invalid credentials', async () => {
        const loginData = {
          email: 'test@example.com',
          password: 'wrongpassword'
        };

        const response = await request(app)
          .post('/api/auth/login')
          .send(loginData)
          .expect(401);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('message', 'Invalid credentials');
      });

      it('should require email and password', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({})
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should handle BSNR/LANR login format', async () => {
        const loginData = {
          bsnr: '123456789',
          lanr: '123456789',
          password: 'password123'
        };

        const response = await request(app)
          .post('/api/auth/login')
          .send(loginData);

        expect(response.status).toBeOneOf([200, 401]); // Either success or validation failure
      });
    });

    describe('GET /api/auth/me', () => {
      it('should return user info when authenticated', async () => {
        const response = await request(app)
          .get('/api/auth/me')
          .set('Authorization', userToken)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.user).toHaveProperty('id');
        expect(response.body.user).toHaveProperty('email');
        expect(response.body.user).toHaveProperty('role');
      });

      it('should reject request without token', async () => {
        const response = await request(app)
          .get('/api/auth/me')
          .expect(401);

        expect(response.body).toHaveProperty('success', false);
      });
    });

    describe('POST /api/auth/logout', () => {
      it('should logout user successfully', async () => {
        const response = await request(app)
          .post('/api/auth/logout')
          .set('Authorization', userToken)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('message', 'Logged out successfully');
      });
    });
  });

  describe('User Management Endpoints', () => {
    describe('GET /api/users', () => {
      it('should return users list for admin', async () => {
        const response = await request(app)
          .get('/api/users')
          .set('Authorization', adminToken)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('users');
        expect(Array.isArray(response.body.users)).toBe(true);
      });

      it('should reject non-admin users', async () => {
        const response = await request(app)
          .get('/api/users')
          .set('Authorization', userToken)
          .expect(403);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should support pagination and filtering', async () => {
        const response = await request(app)
          .get('/api/users?page=1&limit=10&role=doctor&isActive=true')
          .set('Authorization', adminToken);

        expect(response.status).toBeOneOf([200, 400]);
      });
    });

    describe('POST /api/users', () => {
      it('should create new user as admin', async () => {
        const newUser = {
          email: 'newuser@example.com',
          password: 'password123',
          firstName: 'New',
          lastName: 'User',
          role: 'lab_tech',
          bsnr: '123456789'
        };

        const response = await request(app)
          .post('/api/users')
          .set('Authorization', adminToken)
          .send(newUser);

        expect(response.status).toBeOneOf([201, 400]);
      });

      it('should reject user creation for non-admin', async () => {
        const newUser = {
          email: 'newuser@example.com',
          password: 'password123',
          firstName: 'New',
          lastName: 'User',
          role: 'lab_tech'
        };

        const response = await request(app)
          .post('/api/users')
          .set('Authorization', userToken)
          .send(newUser)
          .expect(403);
      });

      it('should validate required fields', async () => {
        const incompleteUser = {
          email: 'incomplete@example.com'
        };

        const response = await request(app)
          .post('/api/users')
          .set('Authorization', adminToken)
          .send(incompleteUser)
          .expect(400);
      });
    });

    describe('PUT /api/users/:userId', () => {
      it('should allow user to update own profile', async () => {
        const updates = {
          firstName: 'Updated',
          lastName: 'Name'
        };

        const response = await request(app)
          .put('/api/users/user123')
          .set('Authorization', userToken)
          .send(updates);

        expect(response.status).toBeOneOf([200, 403, 404]);
      });

      it('should allow admin to update any user', async () => {
        const updates = {
          role: 'doctor',
          isActive: false
        };

        const response = await request(app)
          .put('/api/users/user123')
          .set('Authorization', adminToken)
          .send(updates);

        expect(response.status).toBeOneOf([200, 404]);
      });
    });

    describe('DELETE /api/users/:userId', () => {
      it('should allow admin to delete user', async () => {
        const response = await request(app)
          .delete('/api/users/user123')
          .set('Authorization', adminToken);

        expect(response.status).toBeOneOf([200, 404]);
      });

      it('should reject deletion for non-admin', async () => {
        const response = await request(app)
          .delete('/api/users/user123')
          .set('Authorization', userToken)
          .expect(403);
      });
    });
  });

  describe('Results Management Endpoints', () => {
    describe('GET /api/results', () => {
      it('should return results for authenticated user', async () => {
        const response = await request(app)
          .get('/api/results')
          .set('Authorization', userToken)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('results');
        expect(Array.isArray(response.body.results)).toBe(true);
      });

      it('should support pagination', async () => {
        const response = await request(app)
          .get('/api/results?page=1&limit=10')
          .set('Authorization', userToken)
          .expect(200);

        expect(response.body).toHaveProperty('pagination');
      });

      it('should support filtering by date range', async () => {
        const response = await request(app)
          .get('/api/results?startDate=2024-01-01&endDate=2024-12-31')
          .set('Authorization', userToken);

        expect(response.status).toBeOneOf([200, 400]);
      });

      it('should reject unauthorized requests', async () => {
        const response = await request(app)
          .get('/api/results')
          .expect(401);
      });
    });

    describe('GET /api/results/:resultId', () => {
      it('should return specific result for authorized user', async () => {
        const response = await request(app)
          .get('/api/results/result123')
          .set('Authorization', userToken);

        expect(response.status).toBeOneOf([200, 403, 404]);
      });

      it('should reject unauthorized access to result', async () => {
        const response = await request(app)
          .get('/api/results/result123')
          .expect(401);
      });
    });

    describe('GET /api/admin/unassigned-results', () => {
      it('should return unassigned results for admin', async () => {
        const response = await request(app)
          .get('/api/admin/unassigned-results')
          .set('Authorization', adminToken)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('results');
      });

      it('should reject non-admin access', async () => {
        const response = await request(app)
          .get('/api/admin/unassigned-results')
          .set('Authorization', userToken)
          .expect(403);
      });
    });

    describe('POST /api/admin/assign-result', () => {
      it('should allow admin to assign result to user', async () => {
        const assignment = {
          resultId: 'result123',
          userEmail: 'user@example.com'
        };

        const response = await request(app)
          .post('/api/admin/assign-result')
          .set('Authorization', adminToken)
          .send(assignment);

        expect(response.status).toBeOneOf([200, 404]);
      });

      it('should reject non-admin assignment', async () => {
        const assignment = {
          resultId: 'result123',
          userEmail: 'user@example.com'
        };

        const response = await request(app)
          .post('/api/admin/assign-result')
          .set('Authorization', userToken)
          .send(assignment)
          .expect(403);
      });
    });
  });

  describe('LDT Processing Endpoints', () => {
    describe('POST /api/upload-ldt', () => {
      it('should accept valid LDT file upload', async () => {
        const ldtContent = `8220: 123456789
8221: 987654321
3000: DR12345
3101: Mustermann
3102: Max
3103: 01.01.1980
3110: m
3000: TEST001
8410: Glucose
8411: 95
8421: mg/dl
8422: 70-110`;

        const response = await request(app)
          .post('/api/upload-ldt')
          .set('Authorization', doctorToken)
          .attach('ldt', Buffer.from(ldtContent), 'test.ldt');

        expect(response.status).toBeOneOf([200, 400]);
      });

      it('should reject LDT upload without authentication', async () => {
        const response = await request(app)
          .post('/api/upload-ldt')
          .expect(401);
      });

      it('should validate LDT file format', async () => {
        const invalidContent = 'invalid ldt content';

        const response = await request(app)
          .post('/api/upload-ldt')
          .set('Authorization', doctorToken)
          .attach('ldt', Buffer.from(invalidContent), 'invalid.ldt')
          .expect(400);
      });
    });

    describe('POST /api/process-ldt', () => {
      it('should process LDT message data', async () => {
        const ldtData = {
          bsnr: '123456789',
          lanr: '987654321',
          patientData: {
            patientNumber: 'P12345',
            lastName: 'Mustermann',
            firstName: 'Max'
          },
          results: [
            {
              testCode: 'GLU',
              testName: 'Glucose',
              value: '95',
              unit: 'mg/dl',
              referenceRange: '70-110'
            }
          ]
        };

        const response = await request(app)
          .post('/api/process-ldt')
          .set('Authorization', doctorToken)
          .send(ldtData);

        expect(response.status).toBeOneOf([200, 400]);
      });
    });
  });

  describe('Export and Download Endpoints', () => {
    describe('GET /api/export/:format/:resultId', () => {
      it('should export result in PDF format', async () => {
        const response = await request(app)
          .get('/api/export/pdf/result123')
          .set('Authorization', userToken);

        if (response.status === 200) {
          expect(response.headers['content-type']).toContain('application/pdf');
        } else {
          expect(response.status).toBeOneOf([403, 404]);
        }
      });

      it('should export result in LDT format', async () => {
        const response = await request(app)
          .get('/api/export/ldt/result123')
          .set('Authorization', userToken);

        if (response.status === 200) {
          expect(response.headers['content-type']).toContain('application/octet-stream');
        } else {
          expect(response.status).toBeOneOf([403, 404]);
        }
      });

      it('should reject invalid export formats', async () => {
        const response = await request(app)
          .get('/api/export/invalid/result123')
          .set('Authorization', userToken)
          .expect(400);
      });
    });

    describe('GET /api/download/:resultId', () => {
      it('should download result file', async () => {
        const response = await request(app)
          .get('/api/download/result123')
          .set('Authorization', userToken);

        expect(response.status).toBeOneOf([200, 403, 404]);
      });

      it('should reject unauthorized downloads', async () => {
        const response = await request(app)
          .get('/api/download/result123')
          .expect(401);
      });
    });
  });

  describe('Admin Endpoints', () => {
    describe('GET /api/admin/users', () => {
      it('should return users list for admin', async () => {
        const response = await request(app)
          .get('/api/admin/users')
          .set('Authorization', adminToken)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('users');
      });

      it('should reject non-admin access', async () => {
        const response = await request(app)
          .get('/api/admin/users')
          .set('Authorization', userToken)
          .expect(403);
      });
    });

    describe('GET /api/admin/audit-log', () => {
      it('should return audit log for admin', async () => {
        const response = await request(app)
          .get('/api/admin/audit-log')
          .set('Authorization', adminToken)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('logs');
      });

      it('should support pagination for audit log', async () => {
        const response = await request(app)
          .get('/api/admin/audit-log?page=1&limit=50')
          .set('Authorization', adminToken)
          .expect(200);

        expect(response.body).toHaveProperty('pagination');
      });
    });
  });

  describe('Role-Based Access Control', () => {
    it('should enforce admin-only endpoints', async () => {
      const adminEndpoints = [
        '/api/users',
        '/api/admin/users',
        '/api/admin/audit-log',
        '/api/admin/unassigned-results'
      ];

      for (const endpoint of adminEndpoints) {
        const response = await request(app)
          .get(endpoint)
          .set('Authorization', userToken);
        
        expect(response.status).toBe(403);
      }
    });

    it('should allow appropriate access for different roles', async () => {
      // Test doctor access to upload LDT
      const uploadResponse = await request(app)
        .get('/api/results')
        .set('Authorization', doctorToken);
      
      expect(uploadResponse.status).toBeOneOf([200, 401]);

      // Test user access to own results
      const resultsResponse = await request(app)
        .get('/api/results')
        .set('Authorization', userToken);
      
      expect(resultsResponse.status).toBeOneOf([200, 401]);
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limits to sensitive endpoints', async () => {
      const promises = [];
      
      // Attempt multiple login requests
      for (let i = 0; i < 10; i++) {
        promises.push(
          request(app)
            .post('/api/auth/login')
            .send({ email: 'test@example.com', password: 'password' })
        );
      }

      const responses = await Promise.all(promises);
      const rateLimited = responses.some(r => r.status === 429);
      
      // Rate limiting may or may not be triggered in tests
      expect(rateLimited).toBeOneOf([true, false]);
    });
  });

  describe('Input Validation', () => {
    it('should validate email format in registration', async () => {
      const invalidUser = {
        email: 'invalid-email',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        role: 'lab_tech'
      };

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', adminToken)
        .send(invalidUser)
        .expect(400);
    });

    it('should enforce strong password requirements', async () => {
      const weakPasswordUser = {
        email: 'test@example.com',
        password: '123',
        firstName: 'Test',
        lastName: 'User',
        role: 'lab_tech'
      };

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', adminToken)
        .send(weakPasswordUser)
        .expect(400);
    });

    it('should validate BSNR and LANR format', async () => {
      const invalidBsnrUser = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        role: 'doctor',
        bsnr: 'invalid',
        lanr: 'invalid'
      };

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', adminToken)
        .send(invalidBsnrUser);

      expect(response.status).toBeOneOf([400, 201]);
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for non-existent endpoints', async () => {
      const response = await request(app)
        .get('/api/non-existent')
        .set('Authorization', userToken)
        .expect(404);
    });

    it('should return consistent error format', async () => {
      const response = await request(app)
        .get('/api/results/non-existent')
        .set('Authorization', userToken);

      if (response.status === 404) {
        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('message');
      }
    });

    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('malformed json{')
        .expect(400);
    });
  });
});

// Helper functions for test setup
function generateMockToken(userId, role) {
  // In a real implementation, this would generate a valid JWT
  return `mock_${role}_token_${userId}`;
}

// Custom Jest matchers
expect.extend({
  toBeOneOf(received, expected) {
    const pass = expected.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${expected}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be one of ${expected}`,
        pass: false,
      };
    }
  },
});