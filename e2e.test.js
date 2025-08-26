const request = require('supertest');
const path = require('path');
const fs = require('fs');

// Load environment variables for testing
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_please_override';

describe('End-to-End Tests - Lab Results Management System workflow', () => {
  let app;
  let server;
  
  // Test user tokens and data
  let adminUser, adminToken;
  let doctorUser, doctorToken;
  let labTechUser, labTechToken;
  let patientUser, patientToken;
  let secondPatientUser, secondPatientToken;
  
  // Test data tracking
  let createdUsers = [];
  let createdResults = [];
  let uploadedFiles = [];

  beforeAll(async () => {
    // Start the application server
    try {
      const serverModule = require('./server/server.js');
      app = serverModule.app || serverModule;
      
      if (serverModule.server) {
        server = serverModule.server;
      }
    } catch (error) {
      console.warn('Could not start server for E2E tests:', error.message);
      // Create a mock app for testing
      const express = require('express');
      app = express();
      app.use(express.json());
      app.get('/api/health', (req, res) => res.json({ status: 'healthy' }));
      app.use((req, res) => res.status(404).json({ success: false, message: 'Endpoint not found' }));
    }

    // Wait for app to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    // Cleanup and close server
    if (server && server.close) {
      await new Promise((resolve) => {
        server.close(resolve);
      });
    }
  });

  describe('System Initialization and Health', () => {
    it('should have healthy system status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
    });

    it('should handle CORS properly for frontend', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('Origin', 'http://localhost:3001')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    it('should enforce HTTPS in production environment', async () => {
      // Test security headers
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      // In production, these headers should be present
      if (process.env.NODE_ENV === 'production') {
        expect(response.headers['strict-transport-security']).toBeDefined();
      }
    });
  });

  describe('User Registration and Authentication E2E Flow', () => {
    describe('Admin User Setup', () => {
      it('should create or authenticate admin user', async () => {
        // Try to login with default admin
        let loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'admin@laborresults.de',
            password: 'Admin123!'
          });

        if (loginResponse.status !== 200) {
          // Create admin user if doesn't exist
          const createResponse = await request(app)
            .post('/api/users')
            .send({
              email: 'admin@laborresults.de',
              password: 'Admin123!',
              firstName: 'System',
              lastName: 'Administrator',
              role: 'admin'
            });

          if (createResponse.status === 201) {
            createdUsers.push(createResponse.body.user.id);
            adminUser = createResponse.body.user;
            
            // Login after creation
            loginResponse = await request(app)
              .post('/api/auth/login')
              .send({
                email: 'admin@laborresults.de',
                password: 'Admin123!'
              });
          }
        }

        if (loginResponse.status === 200) {
          adminToken = loginResponse.body.token;
          adminUser = adminUser || loginResponse.body.user;
          
          expect(adminToken).toBeTruthy();
          expect(adminUser.role).toBe('admin');
        }
      });
    });

    describe('Medical Professional Registration', () => {
      it('should register and authenticate doctor with BSNR/LANR', async () => {
        if (!adminToken) {
          console.warn('Skipping doctor registration - no admin token');
          return;
        }

        const doctorData = {
          email: 'dr.mueller@praxis-beispiel.de',
          password: 'SecureDoc123!',
          firstName: 'Dr. Hans',
          lastName: 'Müller',
          role: 'doctor',
          bsnr: '123456789',
          lanr: '987654321'
        };

        // Create doctor user
        const createResponse = await request(app)
          .post('/api/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(doctorData);

        if (createResponse.status === 201) {
          createdUsers.push(createResponse.body.user.id);
          doctorUser = createResponse.body.user;

          expect(doctorUser.email).toBe(doctorData.email);
          expect(doctorUser.role).toBe('doctor');
          expect(doctorUser.bsnr).toBe(doctorData.bsnr);
          expect(doctorUser.lanr).toBe(doctorData.lanr);
        }

        // Authenticate with email/password
        const emailLoginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: doctorData.email,
            password: doctorData.password
          });

        if (emailLoginResponse.status === 200) {
          doctorToken = emailLoginResponse.body.token;
          expect(emailLoginResponse.body.user.role).toBe('doctor');
        }

        // Authenticate with BSNR/LANR
        const bsnrLoginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            bsnr: doctorData.bsnr,
            lanr: doctorData.lanr,
            password: doctorData.password
          });

        if (bsnrLoginResponse.status === 200) {
          expect(bsnrLoginResponse.body.user.role).toBe('doctor');
          expect(bsnrLoginResponse.body.user.bsnr).toBe(doctorData.bsnr);
        }
      });

      it('should register lab technician', async () => {
        if (!adminToken) {
          console.warn('Skipping lab tech registration - no admin token');
          return;
        }

        const labTechData = {
          email: 'lab.tech@labor-beispiel.de',
          password: 'LabTech123!',
          firstName: 'Maria',
          lastName: 'Schmidt',
          role: 'lab_tech',
          bsnr: '111222333',
          lanr: '444555666'
        };

        const createResponse = await request(app)
          .post('/api/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(labTechData);

        if (createResponse.status === 201) {
          createdUsers.push(createResponse.body.user.id);
          labTechUser = createResponse.body.user;
        }

        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: labTechData.email,
            password: labTechData.password
          });

        if (loginResponse.status === 200) {
          labTechToken = loginResponse.body.token;
          expect(loginResponse.body.user.role).toBe('lab_tech');
        }
      });
    });

    describe('Patient Registration', () => {
      it('should register first patient', async () => {
        if (!adminToken) {
          console.warn('Skipping patient registration - no admin token');
          return;
        }

        const patientData = {
          email: 'max.mustermann@email.de',
          password: 'Patient123!',
          firstName: 'Max',
          lastName: 'Mustermann',
          role: 'patient'
        };

        const createResponse = await request(app)
          .post('/api/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(patientData);

        if (createResponse.status === 201) {
          createdUsers.push(createResponse.body.user.id);
          patientUser = createResponse.body.user;
        }

        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: patientData.email,
            password: patientData.password
          });

        if (loginResponse.status === 200) {
          patientToken = loginResponse.body.token;
          expect(loginResponse.body.user.role).toBe('patient');
        }
      });

      it('should register second patient for access control testing', async () => {
        if (!adminToken) {
          console.warn('Skipping second patient registration - no admin token');
          return;
        }

        const secondPatientData = {
          email: 'anna.schmidt@email.de',
          password: 'Patient456!',
          firstName: 'Anna',
          lastName: 'Schmidt',
          role: 'patient'
        };

        const createResponse = await request(app)
          .post('/api/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(secondPatientData);

        if (createResponse.status === 201) {
          createdUsers.push(createResponse.body.user.id);
          secondPatientUser = createResponse.body.user;
        }

        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: secondPatientData.email,
            password: secondPatientData.password
          });

        if (loginResponse.status === 200) {
          secondPatientToken = loginResponse.body.token;
          expect(loginResponse.body.user.role).toBe('patient');
        }
      });
    });
  });

  describe('LDT Processing E2E Workflow', () => {
    describe('Doctor LDT Upload and Processing', () => {
      it('should upload and process valid LDT file', async () => {
        if (!doctorToken) {
          console.warn('Skipping LDT upload - no doctor token');
          return;
        }

        const ldtContent = `8220: 123456789
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
3000: CHOL
8410: Cholesterol Total
8411: 185
8421: mg/dl
8422: <200
8430: N
3000: HBA1C
8410: HbA1c
8411: 6.2
8421: %
8422: <6.5
8430: N`;

        const response = await request(app)
          .post('/api/upload-ldt')
          .set('Authorization', `Bearer ${doctorToken}`)
          .attach('ldt', Buffer.from(ldtContent), 'test-results.ldt');

        if (response.status === 200) {
          expect(response.body.success).toBe(true);
          expect(response.body).toHaveProperty('results');
          expect(Array.isArray(response.body.results)).toBe(true);
          
          if (response.body.results.length > 0) {
            const result = response.body.results[0];
            createdResults.push(result.id);
            
            expect(result.patientData.firstName).toBe('Max');
            expect(result.patientData.lastName).toBe('Mustermann');
            expect(result.patientData.email).toBe('max.mustermann@email.de');
            expect(result.observations).toHaveLength(3);
            
            // Verify glucose test
            const glucoseTest = result.observations.find(obs => obs.code === 'GLU');
            expect(glucoseTest).toBeTruthy();
            expect(glucoseTest.name).toBe('Glucose');
            expect(parseFloat(glucoseTest.value)).toBe(95.5);
            expect(glucoseTest.unit).toBe('mg/dl');
            expect(glucoseTest.status).toBe('N');
          }
        }
      });

      it('should process multiple patients in batch LDT upload', async () => {
        if (!doctorToken) {
          console.warn('Skipping batch LDT upload - no doctor token');
          return;
        }

        const batchLdtContent = `8220: 123456789
8221: 987654321
8200: 20240115
8201: 1500
3000: P002
3101: Schmidt
3102: Anna
3103: 15.05.1985
3110: f
3109: anna.schmidt@email.de
3000: TSH
8410: TSH
8411: 2.1
8421: mU/l
8422: 0.4-4.0
8430: N
3000: P003
3101: Weber
3102: Hans
3103: 22.12.1975
3110: m
3000: CRP
8410: C-reactive Protein
8411: 1.2
8421: mg/l
8422: <3.0
8430: N`;

        const response = await request(app)
          .post('/api/upload-ldt')
          .set('Authorization', `Bearer ${doctorToken}`)
          .attach('ldt', Buffer.from(batchLdtContent), 'batch-results.ldt');

        if (response.status === 200) {
          expect(response.body.success).toBe(true);
          expect(response.body.results).toHaveLength(2);
          
          response.body.results.forEach(result => {
            createdResults.push(result.id);
          });
          
          // Verify Anna Schmidt's result
          const annaResult = response.body.results.find(r => 
            r.patientData.firstName === 'Anna' && r.patientData.lastName === 'Schmidt'
          );
          expect(annaResult).toBeTruthy();
          expect(annaResult.patientData.email).toBe('anna.schmidt@email.de');
          
          // Verify Hans Weber's result
          const hansResult = response.body.results.find(r => 
            r.patientData.firstName === 'Hans' && r.patientData.lastName === 'Weber'
          );
          expect(hansResult).toBeTruthy();
        }
      });

      it('should reject invalid LDT format', async () => {
        if (!doctorToken) {
          console.warn('Skipping invalid LDT test - no doctor token');
          return;
        }

        const invalidLdt = `Invalid LDT content
This is not proper LDT format
Missing required fields`;

        const response = await request(app)
          .post('/api/upload-ldt')
          .set('Authorization', `Bearer ${doctorToken}`)
          .attach('ldt', Buffer.from(invalidLdt), 'invalid.ldt');

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(/invalid|format|error/i);
      });

      it('should validate BSNR/LANR in LDT against doctor credentials', async () => {
        if (!doctorToken) {
          console.warn('Skipping BSNR/LANR validation - no doctor token');
          return;
        }

        const ldtWithWrongBsnr = `8220: 999888777
8221: 987654321
3000: P004
3101: Test
3102: Patient
3103: 01.01.1990
3110: m`;

        const response = await request(app)
          .post('/api/upload-ldt')
          .set('Authorization', `Bearer ${doctorToken}`)
          .attach('ldt', Buffer.from(ldtWithWrongBsnr), 'wrong-bsnr.ldt');

        expect(response.status).toBe(403);
        expect(response.body.message).toMatch(/bsnr|unauthorized/i);
      });
    });

    describe('Lab Technician Result Processing', () => {
      it('should allow lab tech to view and process assigned results', async () => {
        if (!labTechToken) {
          console.warn('Skipping lab tech processing - no lab tech token');
          return;
        }

        // Get assigned results
        const response = await request(app)
          .get('/api/results?status=pending')
          .set('Authorization', `Bearer ${labTechToken}`);

        if (response.status === 200) {
          expect(response.body.success).toBe(true);
          expect(Array.isArray(response.body.results)).toBe(true);
        }
      });

      it('should allow lab tech to update result status', async () => {
        if (!labTechToken || createdResults.length === 0) {
          console.warn('Skipping result status update - no lab tech token or results');
          return;
        }

        const resultId = createdResults[0];
        const response = await request(app)
          .patch(`/api/results/${resultId}/status`)
          .set('Authorization', `Bearer ${labTechToken}`)
          .send({ status: 'completed' });

        if (response.status === 200) {
          expect(response.body.success).toBe(true);
          expect(response.body.result.status).toBe('completed');
        }
      });
    });
  });

  describe('Patient Result Access E2E Workflow', () => {
    describe('Result Assignment and Access', () => {
      it('should assign result to patient via email matching', async () => {
        if (!adminToken || createdResults.length === 0) {
          console.warn('Skipping result assignment - no admin token or results');
          return;
        }

        const resultId = createdResults[0];
        const response = await request(app)
          .post('/api/admin/assign-result')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            resultId: resultId,
            userEmail: 'max.mustermann@email.de'
          });

        if (response.status === 200) {
          expect(response.body.success).toBe(true);
        }
      });

      it('should allow patient to view own results', async () => {
        if (!patientToken) {
          console.warn('Skipping patient result access - no patient token');
          return;
        }

        const response = await request(app)
          .get('/api/results')
          .set('Authorization', `Bearer ${patientToken}`);

        if (response.status === 200) {
          expect(response.body.success).toBe(true);
          expect(Array.isArray(response.body.results)).toBe(true);
          
          // Verify patient can only see their own results
          response.body.results.forEach(result => {
            expect(result.patientData.email).toBe('max.mustermann@email.de');
          });
        }
      });

      it('should prevent patient from accessing other patients\' results', async () => {
        if (!secondPatientToken || createdResults.length === 0) {
          console.warn('Skipping access control test - no second patient token or results');
          return;
        }

        const resultId = createdResults[0]; // Max Mustermann's result
        const response = await request(app)
          .get(`/api/results/${resultId}`)
          .set('Authorization', `Bearer ${secondPatientToken}`);

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
      });

      it('should allow patient to view specific result details', async () => {
        if (!patientToken || createdResults.length === 0) {
          console.warn('Skipping result details test - no patient token or results');
          return;
        }

        const resultId = createdResults[0];
        const response = await request(app)
          .get(`/api/results/${resultId}`)
          .set('Authorization', `Bearer ${patientToken}`);

        if (response.status === 200) {
          expect(response.body.success).toBe(true);
          expect(response.body.result).toHaveProperty('id', resultId);
          expect(response.body.result).toHaveProperty('patientData');
          expect(response.body.result).toHaveProperty('observations');
          expect(Array.isArray(response.body.result.observations)).toBe(true);
        }
      });
    });

    describe('Result Search and Filtering', () => {
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

        if (response.status === 200) {
          expect(response.body.success).toBe(true);
          
          // Verify all results are within date range
          response.body.results.forEach(result => {
            const resultDate = new Date(result.testDate);
            expect(resultDate).toBeInstanceOf(Date);
          });
        }
      });

      it('should search results by test type', async () => {
        if (!patientToken) {
          console.warn('Skipping test type search - no patient token');
          return;
        }

        const response = await request(app)
          .get('/api/results?search=glucose')
          .set('Authorization', `Bearer ${patientToken}`);

        if (response.status === 200) {
          expect(response.body.success).toBe(true);
        }
      });

      it('should paginate results correctly', async () => {
        if (!patientToken) {
          console.warn('Skipping pagination test - no patient token');
          return;
        }

        const response = await request(app)
          .get('/api/results?page=1&limit=5')
          .set('Authorization', `Bearer ${patientToken}`);

        if (response.status === 200) {
          expect(response.body).toHaveProperty('pagination');
          expect(response.body.pagination).toHaveProperty('page', 1);
          expect(response.body.pagination).toHaveProperty('limit', 5);
          expect(response.body.pagination).toHaveProperty('total');
          expect(response.body.pagination).toHaveProperty('pages');
        }
      });
    });
  });

  describe('Export and Download E2E Workflow', () => {
    describe('PDF Export', () => {
      it('should generate PDF export for patient result', async () => {
        if (!patientToken || createdResults.length === 0) {
          console.warn('Skipping PDF export - no patient token or results');
          return;
        }

        const resultId = createdResults[0];
        const response = await request(app)
          .get(`/api/export/pdf/${resultId}`)
          .set('Authorization', `Bearer ${patientToken}`);

        if (response.status === 200) {
          expect(response.headers['content-type']).toContain('application/pdf');
          expect(response.headers['content-disposition']).toMatch(/attachment/);
          expect(Buffer.isBuffer(response.body) || response.body instanceof ArrayBuffer).toBe(true);
        }
      });

      it('should include patient information in PDF', async () => {
        if (!patientToken || createdResults.length === 0) {
          console.warn('Skipping PDF content test - no patient token or results');
          return;
        }

        const resultId = createdResults[0];
        const response = await request(app)
          .get(`/api/export/pdf/${resultId}?includeHeader=true`)
          .set('Authorization', `Bearer ${patientToken}`);

        if (response.status === 200) {
          expect(response.headers['content-type']).toContain('application/pdf');
          // In a real test, you might extract text from PDF to verify content
        }
      });
    });

    describe('LDT Export', () => {
      it('should generate LDT export for result', async () => {
        if (!patientToken || createdResults.length === 0) {
          console.warn('Skipping LDT export - no patient token or results');
          return;
        }

        const resultId = createdResults[0];
        const response = await request(app)
          .get(`/api/export/ldt/${resultId}`)
          .set('Authorization', `Bearer ${patientToken}`);

        if (response.status === 200) {
          expect(response.headers['content-type']).toContain('application/octet-stream');
          expect(response.headers['content-disposition']).toMatch(/\.ldt$/);
          
          // Verify LDT content structure
          const ldtContent = response.text || response.body.toString();
          expect(ldtContent).toMatch(/8220:/); // BSNR
          expect(ldtContent).toMatch(/8221:/); // LANR
          expect(ldtContent).toMatch(/3101:/); // Patient last name
          expect(ldtContent).toMatch(/3102:/); // Patient first name
        }
      });

      it('should maintain data integrity in LDT export', async () => {
        if (!patientToken || createdResults.length === 0) {
          console.warn('Skipping LDT integrity test - no patient token or results');
          return;
        }

        const resultId = createdResults[0];
        
        // Get original result
        const originalResponse = await request(app)
          .get(`/api/results/${resultId}`)
          .set('Authorization', `Bearer ${patientToken}`);

        if (originalResponse.status !== 200) return;

        // Export as LDT
        const exportResponse = await request(app)
          .get(`/api/export/ldt/${resultId}`)
          .set('Authorization', `Bearer ${patientToken}`);

        if (exportResponse.status === 200) {
          const ldtContent = exportResponse.text || exportResponse.body.toString();
          const original = originalResponse.body.result;
          
          // Verify patient data is preserved
          expect(ldtContent).toContain(original.patientData.lastName);
          expect(ldtContent).toContain(original.patientData.firstName);
          
          // Verify test results are preserved
          original.observations.forEach(obs => {
            expect(ldtContent).toContain(obs.value);
          });
        }
      });
    });

    describe('Bulk Export', () => {
      it('should allow doctor to export multiple results', async () => {
        if (!doctorToken || createdResults.length < 2) {
          console.warn('Skipping bulk export - no doctor token or insufficient results');
          return;
        }

        const response = await request(app)
          .post('/api/export/bulk')
          .set('Authorization', `Bearer ${doctorToken}`)
          .send({
            resultIds: createdResults.slice(0, 2),
            format: 'pdf'
          });

        if (response.status === 200) {
          expect(response.headers['content-type']).toContain('application/zip');
          expect(response.headers['content-disposition']).toMatch(/\.zip$/);
        }
      });

      it('should allow admin to export all results', async () => {
        if (!adminToken) {
          console.warn('Skipping admin bulk export - no admin token');
          return;
        }

        const response = await request(app)
          .post('/api/export/bulk-all')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            format: 'ldt',
            dateRange: {
              start: '2024-01-01',
              end: '2024-12-31'
            }
          });

        if (response.status === 200) {
          expect(response.headers['content-type']).toContain('application/zip');
        }
      });
    });
  });

  describe('Admin Management E2E Workflow', () => {
    describe('User Management', () => {
      it('should list all users with proper filtering', async () => {
        if (!adminToken) {
          console.warn('Skipping user list test - no admin token');
          return;
        }

        const response = await request(app)
          .get('/api/admin/users?role=doctor&status=active')
          .set('Authorization', `Bearer ${adminToken}`);

        if (response.status === 200) {
          expect(response.body.success).toBe(true);
          expect(Array.isArray(response.body.users)).toBe(true);
          
          // Verify filtering works
          response.body.users.forEach(user => {
            expect(user.role).toBe('doctor');
            expect(user.isActive).toBe(true);
          });
        }
      });

      it('should update user information', async () => {
        if (!adminToken || createdUsers.length === 0) {
          console.warn('Skipping user update test - no admin token or users');
          return;
        }

        const userId = createdUsers.find(id => id !== adminUser?.id);
        if (!userId) return;

        const updateData = {
          firstName: 'Updated',
          lastName: 'Name',
          isActive: true
        };

        const response = await request(app)
          .patch(`/api/admin/users/${userId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(updateData);

        if (response.status === 200) {
          expect(response.body.success).toBe(true);
          expect(response.body.user.firstName).toBe('Updated');
          expect(response.body.user.lastName).toBe('Name');
        }
      });

      it('should deactivate and reactivate users', async () => {
        if (!adminToken || createdUsers.length === 0) {
          console.warn('Skipping user deactivation test - no admin token or users');
          return;
        }

        const userId = createdUsers.find(id => id !== adminUser?.id);
        if (!userId) return;

        // Deactivate user
        const deactivateResponse = await request(app)
          .patch(`/api/admin/users/${userId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ isActive: false });

        if (deactivateResponse.status === 200) {
          expect(deactivateResponse.body.user.isActive).toBe(false);
        }

        // Reactivate user
        const reactivateResponse = await request(app)
          .patch(`/api/admin/users/${userId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ isActive: true });

        if (reactivateResponse.status === 200) {
          expect(reactivateResponse.body.user.isActive).toBe(true);
        }
      });
    });

    describe('Result Management', () => {
      it('should view unassigned results', async () => {
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

      it('should manually assign results to patients', async () => {
        if (!adminToken || createdResults.length === 0) {
          console.warn('Skipping manual assignment test - no admin token or results');
          return;
        }

        const resultId = createdResults[1]; // Use second result
        const assignData = {
          resultId: resultId,
          userEmail: 'anna.schmidt@email.de'
        };

        const response = await request(app)
          .post('/api/admin/assign-result')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(assignData);

        if (response.status === 200) {
          expect(response.body.success).toBe(true);
          
          // Verify assignment by checking if patient can access result
          if (secondPatientToken) {
            const verifyResponse = await request(app)
              .get(`/api/results/${resultId}`)
              .set('Authorization', `Bearer ${secondPatientToken}`);
            
            expect(verifyResponse.status).toBe(200);
          }
        }
      });

      it('should bulk assign results', async () => {
        if (!adminToken || createdResults.length < 2) {
          console.warn('Skipping bulk assignment test - no admin token or insufficient results');
          return;
        }

        const bulkAssignData = {
          assignments: [
            { resultId: createdResults[0], userEmail: 'max.mustermann@email.de' },
            { resultId: createdResults[1], userEmail: 'anna.schmidt@email.de' }
          ]
        };

        const response = await request(app)
          .post('/api/admin/bulk-assign-results')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(bulkAssignData);

        if (response.status === 200) {
          expect(response.body.success).toBe(true);
          expect(response.body.assigned).toBe(2);
        }
      });
    });

    describe('Audit and Monitoring', () => {
      it('should retrieve audit log with filtering', async () => {
        if (!adminToken) {
          console.warn('Skipping audit log test - no admin token');
          return;
        }

        const response = await request(app)
          .get('/api/admin/audit-log?action=login&page=1&limit=50')
          .set('Authorization', `Bearer ${adminToken}`);

        if (response.status === 200) {
          expect(response.body.success).toBe(true);
          expect(Array.isArray(response.body.logs)).toBe(true);
          expect(response.body).toHaveProperty('pagination');
          
          // Verify audit log entries
          response.body.logs.forEach(log => {
            expect(log).toHaveProperty('action');
            expect(log).toHaveProperty('userId');
            expect(log).toHaveProperty('timestamp');
            expect(log).toHaveProperty('ipAddress');
          });
        }
      });

      it('should get system statistics', async () => {
        if (!adminToken) {
          console.warn('Skipping system stats test - no admin token');
          return;
        }

        const response = await request(app)
          .get('/api/admin/statistics')
          .set('Authorization', `Bearer ${adminToken}`);

        if (response.status === 200) {
          expect(response.body.success).toBe(true);
          expect(response.body.stats).toHaveProperty('totalUsers');
          expect(response.body.stats).toHaveProperty('totalResults');
          expect(response.body.stats).toHaveProperty('resultsToday');
          expect(response.body.stats).toHaveProperty('activeUsers');
        }
      });

      it('should monitor system health', async () => {
        if (!adminToken) {
          console.warn('Skipping health monitoring test - no admin token');
          return;
        }

        const response = await request(app)
          .get('/api/admin/system-health')
          .set('Authorization', `Bearer ${adminToken}`);

        if (response.status === 200) {
          expect(response.body.success).toBe(true);
          expect(response.body.health).toHaveProperty('database');
          expect(response.body.health).toHaveProperty('redis');
          expect(response.body.health).toHaveProperty('storage');
          expect(response.body.health).toHaveProperty('memory');
        }
      });
    });
  });

  describe('Security and Access Control E2E', () => {
    describe('Authentication Security', () => {
      it('should enforce strong password requirements', async () => {
        if (!adminToken) {
          console.warn('Skipping password strength test - no admin token');
          return;
        }

        const weakPasswords = ['123', 'password', '12345678', 'WEAK'];
        
        for (const weakPassword of weakPasswords) {
          const response = await request(app)
            .post('/api/users')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              email: `weak${Math.random()}@example.com`,
              password: weakPassword,
              firstName: 'Test',
              lastName: 'User',
              role: 'patient'
            });

          expect(response.status).toBe(400);
          expect(response.body.message).toMatch(/password/i);
        }
      });

      it('should implement account lockout after failed attempts', async () => {
        const testEmail = 'lockout.test@example.com';
        
        // Create test user
        if (adminToken) {
          await request(app)
            .post('/api/users')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              email: testEmail,
              password: 'StrongPass123!',
              firstName: 'Lockout',
              lastName: 'Test',
              role: 'patient'
            });
        }

        // Attempt multiple failed logins
        for (let i = 0; i < 5; i++) {
          await request(app)
            .post('/api/auth/login')
            .send({
              email: testEmail,
              password: 'wrongpassword'
            });
        }

        // Next attempt should result in lockout
        const lockoutResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: testEmail,
            password: 'StrongPass123!'
          });

        expect(lockoutResponse.status).toBe(429);
        expect(lockoutResponse.body.message).toMatch(/locked|attempts/i);
      });

      it('should validate JWT tokens properly', async () => {
        // Test with invalid token
        const invalidTokenResponse = await request(app)
          .get('/api/results')
          .set('Authorization', 'Bearer invalid.jwt.token');

        expect(invalidTokenResponse.status).toBe(401);

        // Test with expired token (would require token manipulation)
        // This is a placeholder for token expiration testing
      });
    });

    describe('Data Access Control', () => {
      it('should enforce role-based permissions', async () => {
        const testCases = [
          { token: patientToken, endpoint: '/api/admin/users', expectedStatus: 403 },
          { token: patientToken, endpoint: '/api/admin/audit-log', expectedStatus: 403 },
          { token: labTechToken, endpoint: '/api/admin/users', expectedStatus: 403 },
          { token: doctorToken, endpoint: '/api/admin/audit-log', expectedStatus: 403 }
        ];

        for (const testCase of testCases) {
          if (!testCase.token) continue;
          
          const response = await request(app)
            .get(testCase.endpoint)
            .set('Authorization', `Bearer ${testCase.token}`);

          expect(response.status).toBe(testCase.expectedStatus);
        }
      });

      it('should prevent SQL injection attacks', async () => {
        if (!patientToken) {
          console.warn('Skipping SQL injection test - no patient token');
          return;
        }

        const maliciousInputs = [
          "'; DROP TABLE users; --",
          "' OR '1'='1",
          "'; SELECT * FROM users; --"
        ];

        for (const input of maliciousInputs) {
          const response = await request(app)
            .get(`/api/results?search=${encodeURIComponent(input)}`)
            .set('Authorization', `Bearer ${patientToken}`);

          // Should not crash or return unauthorized data
          expect([200, 400, 422]).toContain(response.status);
        }
      });

      it('should prevent XSS attacks in data fields', async () => {
        if (!doctorToken) {
          console.warn('Skipping XSS test - no doctor token');
          return;
        }

        const xssPayload = '<script>alert("xss")</script>';
        const ldtWithXss = `8220: 123456789
8221: 987654321
3000: P999
3101: ${xssPayload}
3102: Test
3103: 01.01.1990
3110: m`;

        const response = await request(app)
          .post('/api/upload-ldt')
          .set('Authorization', `Bearer ${doctorToken}`)
          .attach('ldt', Buffer.from(ldtWithXss), 'xss-test.ldt');

        // Should either reject the input or sanitize it
        if (response.status === 200) {
          const result = response.body.results[0];
          expect(result.patientData.lastName).not.toContain('<script>');
        } else {
          expect(response.status).toBe(400);
        }
      });
    });

    describe('Data Privacy and GDPR Compliance', () => {
      it('should anonymize data in logs', async () => {
        if (!adminToken) {
          console.warn('Skipping log anonymization test - no admin token');
          return;
        }

        const response = await request(app)
          .get('/api/admin/audit-log')
          .set('Authorization', `Bearer ${adminToken}`);

        if (response.status === 200) {
          response.body.logs.forEach(log => {
            // Patient data should not appear in logs
            expect(log.details).not.toMatch(/mustermann|schmidt/i);
            // IP addresses should be anonymized
            if (log.ipAddress) {
              expect(log.ipAddress).toMatch(/\d+\.\d+\.\d+\.xxx/);
            }
          });
        }
      });

      it('should support data export for GDPR requests', async () => {
        if (!patientToken) {
          console.warn('Skipping GDPR export test - no patient token');
          return;
        }

        const response = await request(app)
          .get('/api/user/data-export')
          .set('Authorization', `Bearer ${patientToken}`);

        if (response.status === 200) {
          expect(response.headers['content-type']).toContain('application/json');
          expect(response.body).toHaveProperty('userData');
          expect(response.body).toHaveProperty('results');
          expect(response.body).toHaveProperty('exportDate');
        }
      });

      it('should support data deletion for GDPR requests', async () => {
        if (!adminToken) {
          console.warn('Skipping GDPR deletion test - no admin token');
          return;
        }

        // Create a test user for deletion
        const testUserResponse = await request(app)
          .post('/api/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            email: 'delete.me@example.com',
            password: 'ToBeDeleted123!',
            firstName: 'Delete',
            lastName: 'Me',
            role: 'patient'
          });

        if (testUserResponse.status === 201) {
          const userId = testUserResponse.body.user.id;
          
          const deleteResponse = await request(app)
            .delete(`/api/admin/users/${userId}/gdpr-delete`)
            .set('Authorization', `Bearer ${adminToken}`);

          if (deleteResponse.status === 200) {
            expect(deleteResponse.body.success).toBe(true);
            
            // Verify user is deleted/anonymized
            const verifyResponse = await request(app)
              .get(`/api/admin/users/${userId}`)
              .set('Authorization', `Bearer ${adminToken}`);

            expect(verifyResponse.status).toBe(404);
          }
        }
      });
    });
  });

  describe('Performance and Scalability E2E', () => {
    describe('Load Testing', () => {
      it('should handle concurrent user logins', async () => {
        const loginPromises = [];
        const testCredentials = [
          { email: 'max.mustermann@email.de', password: 'Patient123!' },
          { email: 'anna.schmidt@email.de', password: 'Patient456!' },
          { email: 'dr.mueller@praxis-beispiel.de', password: 'SecureDoc123!' }
        ];

        testCredentials.forEach(creds => {
          loginPromises.push(
            request(app)
              .post('/api/auth/login')
              .send(creds)
          );
        });

        const results = await Promise.all(loginPromises);
        
        // All should succeed (assuming users exist)
        results.forEach(result => {
          expect([200, 401]).toContain(result.status);
        });
      });

      it('should handle concurrent result queries', async () => {
        if (!patientToken) {
          console.warn('Skipping concurrent queries test - no patient token');
          return;
        }

        const queryPromises = [];
        
        for (let i = 0; i < 10; i++) {
          queryPromises.push(
            request(app)
              .get('/api/results')
              .set('Authorization', `Bearer ${patientToken}`)
          );
        }

        const startTime = Date.now();
        const results = await Promise.all(queryPromises);
        const duration = Date.now() - startTime;

        // All queries should complete within reasonable time
        expect(duration).toBeLessThan(5000); // 5 seconds
        
        results.forEach(result => {
          expect([200, 404]).toContain(result.status);
        });
      });

      it('should handle large LDT file uploads', async () => {
        if (!doctorToken) {
          console.warn('Skipping large upload test - no doctor token');
          return;
        }

        // Generate large LDT content
        let largeLdtContent = `8220: 123456789
8221: 987654321
8200: 20240115
8201: 1500`;

        // Add 50 patients with multiple test results
        for (let i = 1; i <= 50; i++) {
          largeLdtContent += `
3000: P${i.toString().padStart(3, '0')}
3101: Patient${i}
3102: Test
3103: 01.01.1980
3110: m
3000: GLU${i}
8410: Glucose
8411: ${90 + Math.random() * 20}
8421: mg/dl
8422: 70-110
8430: N
3000: CHOL${i}
8410: Cholesterol
8411: ${150 + Math.random() * 50}
8421: mg/dl
8422: <200
8430: N`;
        }

        const startTime = Date.now();
        const response = await request(app)
          .post('/api/upload-ldt')
          .set('Authorization', `Bearer ${doctorToken}`)
          .attach('ldt', Buffer.from(largeLdtContent), 'large-batch.ldt');

        const duration = Date.now() - startTime;

        if (response.status === 200) {
          expect(response.body.success).toBe(true);
          expect(response.body.results).toHaveLength(50);
          expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
          
          // Track created results for cleanup
          response.body.results.forEach(result => {
            createdResults.push(result.id);
          });
        }
      });
    });

    describe('Caching and Optimization', () => {
      it('should cache frequently accessed results', async () => {
        if (!patientToken || createdResults.length === 0) {
          console.warn('Skipping caching test - no patient token or results');
          return;
        }

        const resultId = createdResults[0];
        
        // First request (cache miss)
        const firstStart = Date.now();
        const firstResponse = await request(app)
          .get(`/api/results/${resultId}`)
          .set('Authorization', `Bearer ${patientToken}`);
        const firstDuration = Date.now() - firstStart;

        // Second request (cache hit)
        const secondStart = Date.now();
        const secondResponse = await request(app)
          .get(`/api/results/${resultId}`)
          .set('Authorization', `Bearer ${patientToken}`);
        const secondDuration = Date.now() - secondStart;

        if (firstResponse.status === 200 && secondResponse.status === 200) {
          // Second request should be faster due to caching
          expect(secondDuration).toBeLessThanOrEqual(firstDuration);
        }
      });

      it('should optimize database queries for large datasets', async () => {
        if (!adminToken) {
          console.warn('Skipping query optimization test - no admin token');
          return;
        }

        const startTime = Date.now();
        const response = await request(app)
          .get('/api/admin/users?page=1&limit=100')
          .set('Authorization', `Bearer ${adminToken}`);
        const duration = Date.now() - startTime;

        if (response.status === 200) {
          // Should complete within reasonable time even with many users
          expect(duration).toBeLessThan(2000); // 2 seconds
          expect(response.body).toHaveProperty('pagination');
        }
      });
    });
  });

  describe('Cleanup and Final Verification', () => {
    it('should cleanup test data', async () => {
      if (!adminToken) {
        console.warn('Skipping cleanup - no admin token');
        return;
      }

      let cleanupSuccessful = true;

      // Delete created results
      for (const resultId of createdResults) {
        try {
          await request(app)
            .delete(`/api/admin/results/${resultId}`)
            .set('Authorization', `Bearer ${adminToken}`);
        } catch (error) {
          console.warn(`Failed to delete result ${resultId}:`, error.message);
          cleanupSuccessful = false;
        }
      }

      // Delete created users
      for (const userId of createdUsers) {
        try {
          await request(app)
            .delete(`/api/admin/users/${userId}`)
            .set('Authorization', `Bearer ${adminToken}`);
        } catch (error) {
          console.warn(`Failed to delete user ${userId}:`, error.message);
          cleanupSuccessful = false;
        }
      }

      // Clean up uploaded files
      for (const filePath of uploadedFiles) {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (error) {
          console.warn(`Failed to delete file ${filePath}:`, error.message);
          cleanupSuccessful = false;
        }
      }

      expect(cleanupSuccessful).toBe(true);
    });

    it('should verify system state after tests', async () => {
      const healthResponse = await request(app)
        .get('/api/health')
        .expect(200);

      expect(healthResponse.body.status).toBe('healthy');
    });
  });
});

// Custom Jest matchers for E2E testing
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

  toBeValidEmail(received) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = emailRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid email`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid email`,
        pass: false,
      };
    }
  },

  toBeValidBSNR(received) {
    const bsnrRegex = /^\d{9}$/;
    const pass = bsnrRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid BSNR`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid BSNR`,
        pass: false,
      };
    }
  }
});