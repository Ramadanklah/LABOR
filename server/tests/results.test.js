const request = require('supertest')
const app = require('../server')

describe('Results Management Endpoints', () => {
  let authToken
  let adminToken
  let testResult

  beforeEach(async () => {
    // Login as doctor
    const doctorResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'doctor@laborresults.de',
        password: 'doctor123'
      })
    authToken = doctorResponse.body.token

    // Login as admin
    const adminResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@laborresults.de',
        password: 'admin123'
      })
    adminToken = adminResponse.body.token

    testResult = global.testUtils.generateTestResult()
  })

  describe('GET /api/results', () => {
    it('should return results for authenticated user', async () => {
      const response = await request(app)
        .get('/api/results')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body).toHaveProperty('success', true)
      expect(response.body).toHaveProperty('results')
      expect(Array.isArray(response.body.results)).toBe(true)
    })

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .get('/api/results')
        .expect(401)

      expect(response.body).toHaveProperty('success', false)
    })

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/results?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body).toHaveProperty('pagination')
      expect(response.body.pagination).toHaveProperty('page', 1)
      expect(response.body.pagination).toHaveProperty('limit', 10)
    })

    it('should support filtering by status', async () => {
      const response = await request(app)
        .get('/api/results?status=Final')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body).toHaveProperty('success', true)
      expect(response.body.results.every(r => r.status === 'Final')).toBe(true)
    })

    it('should support date range filtering', async () => {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const endDate = new Date().toISOString().split('T')[0]

      const response = await request(app)
        .get(`/api/results?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body).toHaveProperty('success', true)
    })
  })

  describe('GET /api/results/:id', () => {
    it('should return specific result by ID', async () => {
      // First get all results to find an ID
      const resultsResponse = await request(app)
        .get('/api/results')
        .set('Authorization', `Bearer ${authToken}`)

      if (resultsResponse.body.results.length > 0) {
        const resultId = resultsResponse.body.results[0].id

        const response = await request(app)
          .get(`/api/results/${resultId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)

        expect(response.body).toHaveProperty('success', true)
        expect(response.body).toHaveProperty('result')
        expect(response.body.result).toHaveProperty('id', resultId)
      }
    })

    it('should return 404 for non-existent result', async () => {
      const response = await request(app)
        .get('/api/results/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404)

      expect(response.body).toHaveProperty('success', false)
    })

    it('should validate result ID format', async () => {
      const response = await request(app)
        .get('/api/results/invalid-id-format')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400)

      expect(response.body).toHaveProperty('success', false)
    })
  })

  describe('GET /api/results/:id/download', () => {
    it('should download result as PDF', async () => {
      // First get all results to find an ID
      const resultsResponse = await request(app)
        .get('/api/results')
        .set('Authorization', `Bearer ${authToken}`)

      if (resultsResponse.body.results.length > 0) {
        const resultId = resultsResponse.body.results[0].id

        const response = await request(app)
          .get(`/api/results/${resultId}/download`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)

        expect(response.headers['content-type']).toContain('application/pdf')
        expect(response.headers['content-disposition']).toContain('attachment')
      }
    })

    it('should return 404 for non-existent result download', async () => {
      const response = await request(app)
        .get('/api/results/non-existent-id/download')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404)

      expect(response.body).toHaveProperty('success', false)
    })
  })

  describe('POST /api/results', () => {
    it('should create new result with valid data', async () => {
      const newResult = {
        patient: 'Jane Doe',
        type: 'Blood Test',
        status: 'Pending',
        date: new Date().toISOString(),
        assignedTo: 'doctor@laborresults.de',
        data: {
          parameters: [
            { name: 'Glucose', value: '95', unit: 'mg/dL', normal: '70-100' }
          ]
        }
      }

      const response = await request(app)
        .post('/api/results')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newResult)
        .expect(201)

      expect(response.body).toHaveProperty('success', true)
      expect(response.body).toHaveProperty('result')
      expect(response.body.result).toHaveProperty('patient', newResult.patient)
    })

    it('should validate required fields', async () => {
      const invalidResult = {
        patient: '', // Empty patient name
        type: 'Blood Test'
      }

      const response = await request(app)
        .post('/api/results')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidResult)
        .expect(400)

      expect(response.body).toHaveProperty('success', false)
      expect(response.body.message).toContain('patient')
    })

    it('should validate date format', async () => {
      const invalidResult = {
        patient: 'John Doe',
        type: 'Blood Test',
        date: 'invalid-date'
      }

      const response = await request(app)
        .post('/api/results')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidResult)
        .expect(400)

      expect(response.body).toHaveProperty('success', false)
    })
  })

  describe('PUT /api/results/:id', () => {
    it('should update existing result', async () => {
      // First create a result
      const newResult = {
        patient: 'Update Test',
        type: 'Blood Test',
        status: 'Pending',
        date: new Date().toISOString()
      }

      const createResponse = await request(app)
        .post('/api/results')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newResult)

      const resultId = createResponse.body.result.id

      // Update the result
      const updateData = {
        status: 'Final',
        data: {
          parameters: [
            { name: 'Updated Parameter', value: '100', unit: 'mg/dL' }
          ]
        }
      }

      const response = await request(app)
        .put(`/api/results/${resultId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200)

      expect(response.body).toHaveProperty('success', true)
      expect(response.body.result).toHaveProperty('status', 'Final')
    })

    it('should return 404 for non-existent result update', async () => {
      const response = await request(app)
        .put('/api/results/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'Final' })
        .expect(404)

      expect(response.body).toHaveProperty('success', false)
    })
  })

  describe('DELETE /api/results/:id', () => {
    it('should delete result (admin only)', async () => {
      // First create a result
      const newResult = {
        patient: 'Delete Test',
        type: 'Blood Test',
        status: 'Pending',
        date: new Date().toISOString()
      }

      const createResponse = await request(app)
        .post('/api/results')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newResult)

      const resultId = createResponse.body.result.id

      // Delete the result as admin
      const response = await request(app)
        .delete(`/api/results/${resultId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(response.body).toHaveProperty('success', true)
    })

    it('should reject deletion by non-admin user', async () => {
      const response = await request(app)
        .delete('/api/results/some-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403)

      expect(response.body).toHaveProperty('success', false)
    })
  })

  describe('POST /api/results/bulk-upload', () => {
    it('should upload multiple results via CSV', async () => {
      const csvData = `patient,type,status,date,assignedTo
John Doe,Blood Test,Pending,2024-01-15,doctor@laborresults.de
Jane Smith,Urine Test,Final,2024-01-16,doctor@laborresults.de`

      const response = await request(app)
        .post('/api/results/bulk-upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from(csvData), {
          filename: 'results.csv',
          contentType: 'text/csv'
        })
        .expect(200)

      expect(response.body).toHaveProperty('success', true)
      expect(response.body).toHaveProperty('uploaded', 2)
    })

    it('should validate CSV format', async () => {
      const invalidCsv = `invalid,format,data
no,proper,headers`

      const response = await request(app)
        .post('/api/results/bulk-upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from(invalidCsv), {
          filename: 'invalid.csv',
          contentType: 'text/csv'
        })
        .expect(400)

      expect(response.body).toHaveProperty('success', false)
    })
  })

  describe('GET /api/results/statistics', () => {
    it('should return result statistics', async () => {
      const response = await request(app)
        .get('/api/results/statistics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body).toHaveProperty('success', true)
      expect(response.body).toHaveProperty('statistics')
      expect(response.body.statistics).toHaveProperty('total')
      expect(response.body.statistics).toHaveProperty('byStatus')
      expect(response.body.statistics).toHaveProperty('byType')
    })

    it('should support date range filtering for statistics', async () => {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const endDate = new Date().toISOString().split('T')[0]

      const response = await request(app)
        .get(`/api/results/statistics?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body).toHaveProperty('success', true)
    })
  })
})