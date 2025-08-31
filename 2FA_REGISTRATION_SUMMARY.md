# 2-Factor Authentication Registration Summary

## 🎯 Overview

This document provides a complete guide for registering new users with 2-factor authentication (2FA) in the Lab Results API. The system supports both manual and automated 2FA setup processes.

## 📋 Available Methods

### Method 1: Manual Step-by-Step Process
**Best for**: Individual user registration with full control
**Process**: 6 steps from user creation to 2FA verification

### Method 2: Enhanced One-Step Registration
**Best for**: Bulk user creation with immediate 2FA setup
**Process**: Single API call creates user and generates 2FA setup data

## 🔧 API Endpoints

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/api/users` | POST | Create new user | Admin |
| `/api/users/register-with-2fa` | POST | Create user + 2FA setup | Admin |
| `/api/auth/login` | POST | User login | None |
| `/api/auth/setup-2fa` | POST | Setup 2FA | User |
| `/api/auth/verify-2fa` | POST | Verify and enable 2FA | User |

## 🚀 Quick Start Guide

### Prerequisites
- Admin access to the system
- TOTP authenticator app (Google Authenticator, Authy, etc.)
- Valid user information

### Method 1: Manual Process

#### Step 1: Create User (Admin)
```bash
curl -X POST http://localhost:5000/api/users \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "doctor@example.com",
    "password": "SecurePassword123!",
    "firstName": "Dr. John",
    "lastName": "Smith",
    "role": "doctor",
    "bsnr": "123456789",
    "lanr": "1234567"
  }'
```

#### Step 2: User Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "doctor@example.com",
    "password": "SecurePassword123!"
  }'
```

#### Step 3: Setup 2FA
```bash
curl -X POST http://localhost:5000/api/auth/setup-2fa \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

#### Step 4: Verify 2FA
```bash
curl -X POST http://localhost:5000/api/auth/verify-2fa \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "123456"
  }'
```

### Method 2: Enhanced One-Step Registration

```bash
curl -X POST http://localhost:5000/api/users/register-with-2fa \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "doctor@example.com",
    "password": "SecurePassword123!",
    "firstName": "Dr. John",
    "lastName": "Smith",
    "role": "doctor",
    "bsnr": "123456789",
    "lanr": "1234567"
  }'
```

**Response includes:**
- User information
- 2FA secret key
- QR code URL
- Setup instructions

## 📱 Authenticator App Setup

### Supported Apps
- Google Authenticator
- Authy
- Microsoft Authenticator
- 1Password
- LastPass Authenticator
- Any TOTP-compatible app

### Setup Process
1. **Scan QR Code**: Use the QR code URL from the API response
2. **Manual Entry**: Enter the secret key manually if QR scanning fails
3. **Verify**: The app will generate a 6-digit code
4. **Submit**: Use the code to verify 2FA setup

## 🔒 Security Features

### Password Requirements
- **Development**: Minimum 8 characters
- **Production**: Minimum 12 characters with complexity requirements
  - At least one lowercase letter
  - At least one uppercase letter
  - At least one number
  - At least one special character

### 2FA Security
- TOTP-based authentication (RFC 6238)
- 30-second time window
- Rate-limited setup attempts
- Secure secret generation
- Token expiration handling

### Rate Limiting
- **Auth endpoints**: 3-10 attempts per 15 minutes (production/development)
- **2FA setup**: Rate-limited to prevent abuse
- **Login attempts**: Account lockout after 5 failed attempts

## 🧪 Testing

### Automated Test Script
```bash
# Run the complete test suite
node test-2fa-registration.js

# Test with enhanced registration
node test-2fa-registration.js --enhanced
```

### Quick Test Script
```bash
# Interactive test with curl
./2fa-quick-test.sh
```

### Manual Testing
```bash
# Test individual endpoints
curl -X POST http://localhost:5000/api/health
```

## 📊 Response Examples

### User Creation Response
```json
{
  "success": true,
  "message": "User created successfully",
  "user": {
    "id": "user_1234567890_abc123",
    "email": "doctor@example.com",
    "firstName": "Dr. John",
    "lastName": "Smith",
    "role": "doctor",
    "isActive": true,
    "isTwoFactorEnabled": false,
    "createdAt": "2024-01-15T10:00:00.000Z"
  }
}
```

### 2FA Setup Response
```json
{
  "success": true,
  "otpauthUrl": "otpauth://totp/Laboratory%20Results%20(doctor@example.com)?secret=JBSWY3DPEHPK3PXP&issuer=Laboratory%20Results",
  "secret": "JBSWY3DPEHPK3PXP"
}
```

### Enhanced Registration Response
```json
{
  "success": true,
  "message": "User created successfully with 2FA setup",
  "user": {
    "id": "user_1234567890_abc123",
    "email": "doctor@example.com",
    "firstName": "Dr. John",
    "lastName": "Smith",
    "role": "doctor",
    "isActive": true,
    "isTwoFactorEnabled": false
  },
  "twoFactorSetup": {
    "otpauthUrl": "otpauth://totp/Laboratory%20Results%20(doctor@example.com)?secret=JBSWY3DPEHPK3PXP&issuer=Laboratory%20Results",
    "secret": "JBSWY3DPEHPK3PXP",
    "qrCode": "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=otpauth%3A%2F%2Ftotp%2FLaboratory%2520Results%2520%28doctor%40example.com%29%3Fsecret%3DJBSWY3DPEHPK3PXP%26issuer%3DLaboratory%2520Results",
    "instructions": [
      "1. Scan the QR code with your authenticator app",
      "2. Or manually enter the secret key",
      "3. The app will generate a 6-digit code",
      "4. Use that code when logging in"
    ]
  }
}
```

## ⚠️ Error Handling

### Common Errors
- `"Missing required fields"`: Check all required fields are provided
- `"Invalid email format"`: Ensure email is properly formatted
- `"Password must be at least X characters"`: Use stronger password
- `"Two-factor authentication is already enabled"`: User already has 2FA
- `"Invalid two-factor authentication code"`: Wrong or expired code
- `"Two-factor setup has not been initiated"`: Run setup first

### Troubleshooting
1. **Invalid OTP Code**: Check device time synchronization
2. **QR Code Issues**: Use manual secret entry
3. **Rate Limiting**: Wait before retrying
4. **Token Expiration**: Re-authenticate if needed

## 🔧 Configuration

### Environment Variables
```bash
# Required
JWT_SECRET=your-super-secure-256-bit-random-secret-here
NODE_ENV=production

# Optional
JWT_EXPIRATION=15m
RATE_LIMIT_MAX_REQUESTS=100
```

### Security Settings
- **Password Complexity**: Configurable per environment
- **Rate Limiting**: Different limits for different endpoints
- **Token Expiration**: Configurable JWT expiration
- **Session Management**: Enhanced token tracking

## 📈 Monitoring

### Log Events
- User creation
- 2FA setup initiation
- 2FA verification
- Login attempts
- Failed authentication

### Metrics
- 2FA adoption rate
- Authentication success/failure rates
- Rate limiting events
- Token usage patterns

## 🚀 Production Deployment

### Checklist
- [ ] Strong JWT secret configured
- [ ] Rate limiting enabled
- [ ] Security headers configured
- [ ] SSL/TLS enabled
- [ ] Monitoring configured
- [ ] Backup procedures in place

### Best Practices
1. **Regular Audits**: Monitor 2FA usage and security events
2. **User Training**: Provide clear 2FA setup instructions
3. **Backup Recovery**: Implement account recovery procedures
4. **Testing**: Regular security testing of 2FA implementation

## 📞 Support

### Documentation
- `2FA_USER_REGISTRATION_GUIDE.md`: Detailed step-by-step guide
- `test-2fa-registration.js`: Automated test script
- `2fa-quick-test.sh`: Quick manual test script

### Troubleshooting
1. Check application logs for detailed error messages
2. Verify authenticator app functionality
3. Test network connectivity
4. Contact system administrator for account issues

---

**Last Updated**: $(date)
**Version**: 1.0.0
**Status**: ✅ Production Ready