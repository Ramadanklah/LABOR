const request = require('supertest')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const app = require('../server')

describe('Authentication Endpoints', () => {
  let testUser
  let authToken

  beforeEach(() => {
    testUser = global.testUtils.generateTestUser()
  })

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'doctor@laborresults.de',
          password: 'doctor123'
        })
        .expect(200)

      expect(response.body).toHaveProperty('success', true)
      expect(response.body).toHaveProperty('token')
      expect(response.body).toHaveProperty('user')
      expect(response.body.user).toHaveProperty('email', 'doctor@laborresults.de')
      expect(response.body.user).toHaveProperty('role', 'doctor')
    })

    it('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid@example.com',
          password: 'wrongpassword'
        })
        .expect(401)

      expect(response.body).toHaveProperty('success', false)
      expect(response.body).toHaveProperty('message')
    })

    it('should reject empty credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({})
        .expect(400)

      expect(response.body).toHaveProperty('success', false)
    })

    it('should reject malformed email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid-email',
          password: 'password123'
        })
        .expect(400)

      expect(response.body).toHaveProperty('success', false)
    })

    it('should handle rate limiting', async () => {
      // Make multiple requests to trigger rate limiting
      const requests = Array(6).fill().map(() =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'wrongpassword'
          })
      )

      const responses = await Promise.all(requests)
      const lastResponse = responses[responses.length - 1]

      expect(lastResponse.status).toBe(429)
    })
  })

  describe('POST /api/auth/register', () => {
    it('should register a new user with valid data', async () => {
      const newUser = {
        email: 'newuser@example.com',
        password: 'SecurePassword123!',
        role: 'doctor',
        name: 'New User'
      }

      const response = await request(app)
        .post('/api/auth/register')
        .send(newUser)
        .expect(201)

      expect(response.body).toHaveProperty('success', true)
      expect(response.body).toHaveProperty('user')
      expect(response.body.user).toHaveProperty('email', newUser.email)
      expect(response.body.user).not.toHaveProperty('password')
    })

    it('should reject duplicate email', async () => {
      const duplicateUser = {
        email: 'doctor@laborresults.de',
        password: 'SecurePassword123!',
        role: 'doctor'
      }

      const response = await request(app)
        .post('/api/auth/register')
        .send(duplicateUser)
        .expect(409)

      expect(response.body).toHaveProperty('success', false)
      expect(response.body.message).toContain('already exists')
    })

    it('should validate password complexity', async () => {
      const weakPasswordUser = {
        email: 'weak@example.com',
        password: '123',
        role: 'doctor'
      }

      const response = await request(app)
        .post('/api/auth/register')
        .send(weakPasswordUser)
        .expect(400)

      expect(response.body).toHaveProperty('success', false)
      expect(response.body.message).toContain('password')
    })
  })

  describe('GET /api/auth/me', () => {
    beforeEach(async () => {
      // Login to get token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'doctor@laborresults.de',
          password: 'doctor123'
        })

      authToken = loginResponse.body.token
    })

    it('should return current user profile', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body).toHaveProperty('success', true)
      expect(response.body).toHaveProperty('user')
      expect(response.body.user).toHaveProperty('email', 'doctor@laborresults.de')
    })

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401)

      expect(response.body).toHaveProperty('success', false)
    })

    it('should reject invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401)

      expect(response.body).toHaveProperty('success', false)
    })
  })

  describe('POST /api/auth/logout', () => {
    beforeEach(async () => {
      // Login to get token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'doctor@laborresults.de',
          password: 'doctor123'
        })

      authToken = loginResponse.body.token
    })

    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body).toHaveProperty('success', true)
    })

    it('should invalidate token after logout', async () => {
      // First logout
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)

      // Try to use the same token
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(401)

      expect(response.body).toHaveProperty('success', false)
    })
  })

  describe('POST /api/auth/refresh', () => {
    beforeEach(async () => {
      // Login to get token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'doctor@laborresults.de',
          password: 'doctor123'
        })

      authToken = loginResponse.body.token
    })

    it('should refresh token successfully', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body).toHaveProperty('success', true)
      expect(response.body).toHaveProperty('token')
      expect(response.body.token).not.toBe(authToken)
    })
  })
})