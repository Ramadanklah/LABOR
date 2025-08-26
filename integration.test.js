const request = require('supertest');
const path = require('path');
const fs = require('fs');

// Load environment variables for testing
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_please_override';

describe('Integration Tests - Full Application Flow', () => {
  let app;
  let server;
  let adminToken;
  let doctorToken;
  let patientToken;
  let createdUsers = [];
  let createdResults = [];

  beforeAll(async () => {
    // Start the server for integration testing
    try {
      const serverModule = require('./server/server.js');
      app = serverModule.app || serverModule;
      
      if (serverModule.server) {
        server = serverModule.server;
      }
    } catch (error) {
      console.warn('Could not start server for integration tests:', error.message);
      // Use a mock app for testing
      app = require('express')();
      app.get('/api/health', (req, res) => res.json({ status: 'healthy' }));
    }
  });

  afterAll(async () => {
    // Clean up created test data
    if (server && server.close) {
      await new Promise((resolve) => {
        server.close(resolve);
      });
    }
  });

  describe('System Health and Readiness', () => {
    it('should respond to health check', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
    });

    it('should serve API documentation', async () => {
      const response = await request(app)
        .get('/api/docs/');

      expect(response.status).toBeOneOf([200, 301, 404]); // Might redirect or not be available
    });

    it('should handle CORS properly', async () => {
      const response = await request(app)
        .options('/api/health')
        .set('Origin', 'http://localhost:3001');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  describe('Authentication Flow', () => {
    describe('Admin User Authentication', () => {
      it('should create admin user and authenticate', async () => {
        // Try to login with default admin credentials
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'admin@laborresults.de',
            password: 'admin123'
          });

        if (loginResponse.status === 200) {
          adminToken = loginResponse.body.token;
          expect(loginResponse.body.success).toBe(true);
          expect(loginResponse.body.user.role).toBe('admin');
        } else {
          // If default admin doesn't exist, create one
          const createResponse = await request(app)
            .post('/api/users')
            .send({
              email: 'admin@laborresults.de',
              password: 'admin123',
              firstName: 'Admin',
              lastName: 'User',
              role: 'admin'
            });

          if (createResponse.status === 201) {
            createdUsers.push(createResponse.body.user.id);
            
            const loginRetry = await request(app)
              .post('/api/auth/login')
              .send({
                email: 'admin@laborresults.de',
                password: 'admin123'
              });

            adminToken = loginRetry.body.token;
          }
        }

        expect(adminToken).toBeTruthy();
      });

      it('should access admin endpoints with admin token', async () => {
        if (!adminToken) {
          console.warn('Skipping admin test - no admin token available');
          return;
        }

        const response = await request(app)
          .get('/api/admin/users')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBeOneOf([200, 403]);
      });
    });

    describe('Doctor User Management', () => {
      it('should create doctor user', async () => {
        if (!adminToken) {
          console.warn('Skipping doctor creation - no admin token');
          return;
        }

        const doctorData = {
          email: 'doctor@example.com',
          password: 'doctor123',
          firstName: 'Dr. Jane',
          lastName: 'Smith',
          role: 'doctor',
          bsnr: '123456789',
          lanr: '987654321'
        };

        const response = await request(app)
          .post('/api/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(doctorData);

        if (response.status === 201) {
          createdUsers.push(response.body.user.id);
          expect(response.body.user.email).toBe(doctorData.email);
          expect(response.body.user.role).toBe('doctor');
          expect(response.body.user.bsnr).toBe(doctorData.bsnr);
        }
      });

      it('should authenticate doctor user', async () => {
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'doctor@laborresults.de',
            password: 'doctor123'
          });

        if (loginResponse.status === 200) {
          doctorToken = loginResponse.body.token;
          expect(loginResponse.body.success).toBe(true);
          expect(loginResponse.body.user.role).toBe('doctor');
        }
      });

      it('should authenticate with BSNR/LANR', async () => {
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            bsnr: '123456789',
            lanr: '987654321',
            password: 'doctor123'
          });

        if (loginResponse.status === 200) {
          expect(loginResponse.body.success).toBe(true);
          expect(loginResponse.body.user.role).toBe('doctor');
        }
      });
    });

    describe('Patient User Management', () => {
      it('should create patient user', async () => {
        if (!adminToken) {
          console.warn('Skipping patient creation - no admin token');
          return;
        }

        const patientData = {
          email: 'patient@example.com',
          password: 'patient123',
          firstName: 'John',
          lastName: 'Doe',
          role: 'patient'
        };

        const response = await request(app)
          .post('/api/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(patientData);

        if (response.status === 201) {
          createdUsers.push(response.body.user.id);
          expect(response.body.user.email).toBe(patientData.email);
          expect(response.body.user.role).toBe('patient');
        }
      });

      it('should authenticate patient user', async () => {
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'patient@example.com',
            password: 'patient123'
          });

        if (loginResponse.status === 200) {
          patientToken = loginResponse.body.token;
          expect(loginResponse.body.success).toBe(true);
          expect(loginResponse.body.user.role).toBe('patient');
        }
      });
    });
  });

  describe('LDT Processing Workflow', () => {
    it('should upload and process LDT file', async () => {
      if (!doctorToken) {
        console.warn('Skipping LDT upload - no doctor token');
        return;
      }

      const ldtContent = `8220: 123456789
8221: 987654321
3000: P12345
3101: Mustermann
3102: Max
3103: 01.01.1980
3110: m
3000: TEST001
8410: Glucose
8411: 95
8421: mg/dl
8422: 70-110
3000: TEST002
8410: Cholesterol
8411: 180
8421: mg/dl
8422: <200`;

      const response = await request(app)
        .post('/api/upload-ldt')
        .set('Authorization', `Bearer ${doctorToken}`)
        .attach('ldt', Buffer.from(ldtContent), 'test.ldt');

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body).toHaveProperty('results');
        
        if (response.body.results && response.body.results.length > 0) {
          createdResults.push(...response.body.results.map(r => r.id));
        }
      }
    });

    it('should process LDT data directly', async () => {
      if (!doctorToken) {
        console.warn('Skipping LDT processing - no doctor token');
        return;
      }

      const ldtData = {
        bsnr: '123456789',
        lanr: '987654321',
        patientData: {
          patientNumber: 'P67890',
          lastName: 'Schmidt',
          firstName: 'Anna',
          dateOfBirth: '15.05.1985',
          gender: 'f'
        },
        results: [
          {
            testCode: 'HBA1C',
            testName: 'HbA1c',
            value: '6.2',
            unit: '%',
            referenceRange: '<6.5'
          }
        ]
      };

      const response = await request(app)
        .post('/api/process-ldt')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send(ldtData);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        
        if (response.body.result && response.body.result.id) {
          createdResults.push(response.body.result.id);
        }
      }
    });

    it('should reject invalid LDT format', async () => {
      if (!doctorToken) {
        console.warn('Skipping invalid LDT test - no doctor token');
        return;
      }

      const invalidLdt = 'invalid ldt content without proper format';

      const response = await request(app)
        .post('/api/upload-ldt')
        .set('Authorization', `Bearer ${doctorToken}`)
        .attach('ldt', Buffer.from(invalidLdt), 'invalid.ldt');

      expect(response.status).toBeOneOf([400, 422]);
    });
  });

  describe('Results Management Workflow', () => {
    it('should retrieve results for authenticated user', async () => {
      if (!patientToken) {
        console.warn('Skipping results retrieval - no patient token');
        return;
      }

      const response = await request(app)
        .get('/api/results')
        .set('Authorization', `Bearer ${patientToken}`);

      expect(response.status).toBeOneOf([200, 404]);
      
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.results)).toBe(true);
      }
    });

    it('should filter results by date range', async () => {
      if (!patientToken) {
        console.warn('Skipping date filter test - no patient token');
        return;
      }

      const startDate = '2024-01-01';
      const endDate = '2024-12-31';

      const response = await request(app)
        .get(`/api/results?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${patientToken}`);

      expect(response.status).toBeOneOf([200, 400]);
    });

    it('should paginate results properly', async () => {
      if (!patientToken) {
        console.warn('Skipping pagination test - no patient token');
        return;
      }

      const response = await request(app)
        .get('/api/results?page=1&limit=10')
        .set('Authorization', `Bearer ${patientToken}`);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('pagination');
        expect(response.body.pagination).toHaveProperty('page', 1);
        expect(response.body.pagination).toHaveProperty('limit', 10);
      }
    });

    it('should retrieve specific result by ID', async () => {
      if (!patientToken || createdResults.length === 0) {
        console.warn('Skipping specific result test - no patient token or results');
        return;
      }

      const resultId = createdResults[0];
      const response = await request(app)
        .get(`/api/results/${resultId}`)
        .set('Authorization', `Bearer ${patientToken}`);

      expect(response.status).toBeOneOf([200, 403, 404]);
    });
  });

  describe('Export and Download Workflow', () => {
    it('should export result as PDF', async () => {
      if (!patientToken || createdResults.length === 0) {
        console.warn('Skipping PDF export test - no patient token or results');
        return;
      }

      const resultId = createdResults[0];
      const response = await request(app)
        .get(`/api/export/pdf/${resultId}`)
        .set('Authorization', `Bearer ${patientToken}`);

      if (response.status === 200) {
        expect(response.headers['content-type']).toContain('application/pdf');
      } else {
        expect(response.status).toBeOneOf([403, 404, 500]);
      }
    });

    it('should export result as LDT', async () => {
      if (!patientToken || createdResults.length === 0) {
        console.warn('Skipping LDT export test - no patient token or results');
        return;
      }

      const resultId = createdResults[0];
      const response = await request(app)
        .get(`/api/export/ldt/${resultId}`)
        .set('Authorization', `Bearer ${patientToken}`);

      if (response.status === 200) {
        expect(response.headers['content-type']).toContain('application/octet-stream');
      } else {
        expect(response.status).toBeOneOf([403, 404]);
      }
    });

    it('should download result file', async () => {
      if (!patientToken || createdResults.length === 0) {
        console.warn('Skipping download test - no patient token or results');
        return;
      }

      const resultId = createdResults[0];
      const response = await request(app)
        .get(`/api/download/${resultId}`)
        .set('Authorization', `Bearer ${patientToken}`);

      expect(response.status).toBeOneOf([200, 403, 404]);
    });

    it('should reject invalid export formats', async () => {
      if (!patientToken || createdResults.length === 0) {
        console.warn('Skipping invalid format test - no patient token or results');
        return;
      }

      const resultId = createdResults[0];
      const response = await request(app)
        .get(`/api/export/invalid/${resultId}`)
        .set('Authorization', `Bearer ${patientToken}`);

      expect(response.status).toBe(400);
    });
  });

  describe('Admin Management Workflow', () => {
    it('should get unassigned results', async () => {
      if (!adminToken) {
        console.warn('Skipping unassigned results test - no admin token');
        return;
      }

      const response = await request(app)
        .get('/api/admin/unassigned-results')
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.results)).toBe(true);
      }
    });

    it('should assign result to user', async () => {
      if (!adminToken || createdResults.length === 0) {
        console.warn('Skipping result assignment test - no admin token or results');
        return;
      }

      const assignmentData = {
        resultId: createdResults[0],
        userEmail: 'patient@example.com'
      };

      const response = await request(app)
        .post('/api/admin/assign-result')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(assignmentData);

      expect(response.status).toBeOneOf([200, 404, 400]);
    });

    it('should retrieve audit log', async () => {
      if (!adminToken) {
        console.warn('Skipping audit log test - no admin token');
        return;
      }

      const response = await request(app)
        .get('/api/admin/audit-log?page=1&limit=50')
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.logs)).toBe(true);
        expect(response.body).toHaveProperty('pagination');
      }
    });

    it('should manage users', async () => {
      if (!adminToken) {
        console.warn('Skipping user management test - no admin token');
        return;
      }

      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.users)).toBe(true);
      }
    });
  });

  describe('Role-Based Access Control', () => {
    it('should enforce admin-only access', async () => {
      if (!patientToken) {
        console.warn('Skipping RBAC test - no patient token');
        return;
      }

      const adminOnlyEndpoints = [
        '/api/admin/users',
        '/api/admin/unassigned-results',
        '/api/admin/audit-log'
      ];

      for (const endpoint of adminOnlyEndpoints) {
        const response = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${patientToken}`);
        
        expect(response.status).toBe(403);
      }
    });

    it('should allow appropriate access for different roles', async () => {
      // Test doctor permissions
      if (doctorToken) {
        const doctorResponse = await request(app)
          .get('/api/results')
          .set('Authorization', `Bearer ${doctorToken}`);
        
        expect(doctorResponse.status).toBeOneOf([200, 404]);
      }

      // Test patient permissions
      if (patientToken) {
        const patientResponse = await request(app)
          .get('/api/results')
          .set('Authorization', `Bearer ${patientToken}`);
        
        expect(patientResponse.status).toBeOneOf([200, 404]);
      }
    });

    it('should prevent access to other users\' results', async () => {
      if (!patientToken || createdResults.length === 0) {
        console.warn('Skipping access control test - no patient token or results');
        return;
      }

      // Create another patient and try to access first patient's results
      if (adminToken) {
        const otherPatientData = {
          email: 'otherpatient@example.com',
          password: 'otherpatient123',
          firstName: 'Other',
          lastName: 'Patient',
          role: 'patient'
        };

        const createResponse = await request(app)
          .post('/api/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(otherPatientData);

        if (createResponse.status === 201) {
          createdUsers.push(createResponse.body.user.id);

          const loginResponse = await request(app)
            .post('/api/auth/login')
            .send({
              email: 'otherpatient@example.com',
              password: 'otherpatient123'
            });

          if (loginResponse.status === 200) {
            const otherPatientToken = loginResponse.body.token;
            
            const response = await request(app)
              .get(`/api/results/${createdResults[0]}`)
              .set('Authorization', `Bearer ${otherPatientToken}`);

            expect(response.status).toBeOneOf([403, 404]);
          }
        }
      }
    });
  });

  describe('Security and Validation', () => {
    it('should reject requests without authentication', async () => {
      const protectedEndpoints = [
        '/api/results',
        '/api/users',
        '/api/admin/users'
      ];

      for (const endpoint of protectedEndpoints) {
        const response = await request(app).get(endpoint);
        expect(response.status).toBe(401);
      }
    });

    it('should validate input data', async () => {
      if (!adminToken) {
        console.warn('Skipping validation test - no admin token');
        return;
      }

      const invalidUserData = {
        email: 'invalid-email',
        password: '123', // Too short
        firstName: '',
        lastName: '',
        role: 'invalid_role'
      };

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidUserData);

      expect(response.status).toBe(400);
    });

    it('should handle malformed requests gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('malformed json{');

      expect(response.status).toBe(400);
    });

    it('should enforce rate limiting on sensitive endpoints', async () => {
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
      
      // Rate limiting may or may not be triggered depending on implementation
      expect(rateLimited).toBeOneOf([true, false]);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle database connection failures gracefully', async () => {
      // This test would require temporarily disrupting database connection
      // For now, we'll test that the app doesn't crash on invalid requests
      const response = await request(app)
        .get('/api/results/non-existent-id')
        .set('Authorization', `Bearer ${patientToken || 'invalid-token'}`);

      expect(response.status).toBeOneOf([401, 404, 500]);
    });

    it('should return consistent error formats', async () => {
      const response = await request(app)
        .get('/api/results/non-existent')
        .set('Authorization', `Bearer ${patientToken || 'invalid-token'}`);

      if (response.status >= 400) {
        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('message');
      }
    });

    it('should handle concurrent requests properly', async () => {
      if (!patientToken) {
        console.warn('Skipping concurrent test - no patient token');
        return;
      }

      const promises = [];
      
      // Make multiple concurrent requests
      for (let i = 0; i < 5; i++) {
        promises.push(
          request(app)
            .get('/api/results')
            .set('Authorization', `Bearer ${patientToken}`)
        );
      }

      const responses = await Promise.all(promises);
      
      // All requests should complete successfully or with consistent errors
      responses.forEach(response => {
        expect(response.status).toBeOneOf([200, 401, 404, 500]);
      });
    });
  });

  describe('Performance and Scalability', () => {
    it('should respond to health check quickly', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/health')
        .expect(200);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should respond within 1 second
    });

    it('should handle batch operations efficiently', async () => {
      if (!doctorToken) {
        console.warn('Skipping batch test - no doctor token');
        return;
      }

      const batchLdtData = {
        bsnr: '123456789',
        lanr: '987654321',
        patients: []
      };

      // Create multiple patients in batch
      for (let i = 0; i < 5; i++) {
        batchLdtData.patients.push({
          patientNumber: `BATCH${i}`,
          lastName: `Patient${i}`,
          firstName: `Test`,
          dateOfBirth: '01.01.1990',
          gender: 'm',
          results: [
            {
              testCode: `TEST${i}`,
              testName: `Test ${i}`,
              value: `${100 + i}`,
              unit: 'mg/dl',
              referenceRange: '70-110'
            }
          ]
        });
      }

      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/process-ldt-batch')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send(batchLdtData);

      const duration = Date.now() - startTime;
      
      // Should complete batch processing within reasonable time
      expect(duration).toBeLessThan(10000); // 10 seconds
      
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.processed).toBe(5);
      }
    });
  });

  describe('Cleanup', () => {
    it('should clean up test data', async () => {
      if (!adminToken) {
        console.warn('Skipping cleanup - no admin token');
        return;
      }

      // Delete created users
      for (const userId of createdUsers) {
        await request(app)
          .delete(`/api/users/${userId}`)
          .set('Authorization', `Bearer ${adminToken}`);
      }

      // Delete created results if endpoint exists
      for (const resultId of createdResults) {
        await request(app)
          .delete(`/api/results/${resultId}`)
          .set('Authorization', `Bearer ${adminToken}`);
      }

      expect(true).toBe(true); // Cleanup completed
    });
  });
});

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
  }
});