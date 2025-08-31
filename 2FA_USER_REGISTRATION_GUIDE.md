# 2-Factor Authentication User Registration Guide

## Overview

This guide explains how to register a new user with 2-factor authentication (2FA) in the Lab Results API. The process involves creating a user account and then setting up 2FA using a time-based one-time password (TOTP) authenticator app.

## Prerequisites

- Admin access to the system
- A TOTP authenticator app (Google Authenticator, Authy, Microsoft Authenticator, etc.)
- Valid user information

## Step-by-Step Process

### Step 1: Create User Account (Admin Only)

First, an admin must create the user account:

```bash
# Create new user (Admin only)
POST /api/users
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "email": "doctor@example.com",
  "password": "SecurePassword123!",
  "firstName": "Dr. John",
  "lastName": "Smith",
  "role": "doctor",
  "bsnr": "123456789",
  "lanr": "1234567",
  "specialization": "Internal Medicine",
  "department": "Cardiology"
}
```

**Response:**
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

### Step 2: User Login

The new user must log in to access 2FA setup:

```bash
# User login
POST /api/auth/login
Content-Type: application/json

{
  "email": "doctor@example.com",
  "password": "SecurePassword123!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_1234567890_abc123",
    "email": "doctor@example.com",
    "role": "doctor",
    "isTwoFactorEnabled": false
  }
}
```

### Step 3: Setup 2FA

The user initiates 2FA setup:

```bash
# Setup 2FA
POST /api/auth/setup-2fa
Authorization: Bearer <user_token>
Content-Type: application/json

{}
```

**Response:**
```json
{
  "success": true,
  "otpauthUrl": "otpauth://totp/Laboratory%20Results%20(doctor@example.com)?secret=JBSWY3DPEHPK3PXP&issuer=Laboratory%20Results",
  "secret": "JBSWY3DPEHPK3PXP"
}
```

### Step 4: Scan QR Code

1. Open your TOTP authenticator app
2. Scan the QR code or manually enter the secret
3. The app will generate a 6-digit code

### Step 5: Verify and Enable 2FA

Submit the generated code to verify and enable 2FA:

```bash
# Verify 2FA
POST /api/auth/verify-2fa
Authorization: Bearer <user_token>
Content-Type: application/json

{
  "token": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Two-factor authentication enabled successfully"
}
```

### Step 6: Login with 2FA

For subsequent logins, the user must provide both password and 2FA code:

```bash
# Login with 2FA
POST /api/auth/login
Content-Type: application/json

{
  "email": "doctor@example.com",
  "password": "SecurePassword123!",
  "otp": "123456"
}
```

## Complete Example Script

Here's a complete example using curl:

```bash
#!/bin/bash

# Configuration
API_BASE="http://localhost:5000/api"
ADMIN_TOKEN="your_admin_token"
USER_EMAIL="doctor@example.com"
USER_PASSWORD="SecurePassword123!"

echo "Step 1: Creating user account..."
USER_RESPONSE=$(curl -s -X POST "$API_BASE/users" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$USER_EMAIL\",
    \"password\": \"$USER_PASSWORD\",
    \"firstName\": \"Dr. John\",
    \"lastName\": \"Smith\",
    \"role\": \"doctor\",
    \"bsnr\": \"123456789\",
    \"lanr\": \"1234567\"
  }")

echo "User created: $USER_RESPONSE"

echo "Step 2: User login..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$USER_EMAIL\",
    \"password\": \"$USER_PASSWORD\"
  }")

USER_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token')
echo "Login successful, token: ${USER_TOKEN:0:20}..."

echo "Step 3: Setup 2FA..."
TFA_RESPONSE=$(curl -s -X POST "$API_BASE/auth/setup-2fa" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{}")

OTPAUTH_URL=$(echo $TFA_RESPONSE | jq -r '.otpauthUrl')
SECRET=$(echo $TFA_RESPONSE | jq -r '.secret')

echo "2FA Secret: $SECRET"
echo "OTP Auth URL: $OTPAUTH_URL"

echo "Step 4: Please scan the QR code or enter the secret in your authenticator app"
echo "Then enter the generated 6-digit code:"
read -p "Enter 2FA code: " TFA_CODE

echo "Step 5: Verifying 2FA..."
VERIFY_RESPONSE=$(curl -s -X POST "$API_BASE/auth/verify-2fa" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"token\": \"$TFA_CODE\"
  }")

echo "2FA verification: $VERIFY_RESPONSE"

echo "Step 6: Testing login with 2FA..."
echo "Please enter the current 2FA code:"
read -p "Enter 2FA code: " LOGIN_TFA_CODE

FINAL_LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$USER_EMAIL\",
    \"password\": \"$USER_PASSWORD\",
    \"otp\": \"$LOGIN_TFA_CODE\"
  }")

echo "Final login with 2FA: $FINAL_LOGIN_RESPONSE"
```

## Enhanced User Registration with 2FA

For convenience, here's an enhanced registration endpoint that creates a user and sets up 2FA in one step:

```javascript
// Enhanced user registration with 2FA setup
app.post('/api/users/register-with-2fa', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  try {
    // Create user first
    const newUser = await userModel.createUser(req.body);
    
    // Generate 2FA secret
    const { otpauthUrl, base32 } = userModel.generateTwoFactorSecret(newUser.id);
    
    // Return user info with 2FA setup data
    res.status(201).json({
      success: true,
      message: 'User created successfully with 2FA setup',
      user: newUser,
      twoFactorSetup: {
        otpauthUrl,
        secret: base32,
        qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}));
```

## Security Considerations

1. **Secret Storage**: The 2FA secret is stored temporarily until verified
2. **Token Expiration**: 2FA setup tokens expire after verification
3. **Rate Limiting**: 2FA endpoints are rate-limited to prevent brute force
4. **Backup Codes**: Consider implementing backup codes for account recovery
5. **Device Management**: Allow users to manage multiple 2FA devices

## Troubleshooting

### Common Issues

1. **Invalid OTP Code**: Ensure the authenticator app is synchronized
2. **Expired Setup**: Restart 2FA setup if the process takes too long
3. **QR Code Issues**: Manually enter the secret if QR scanning fails
4. **Multiple Devices**: Each device needs to be set up separately

### Error Messages

- `"Two-factor authentication is already enabled"`: User already has 2FA
- `"Invalid two-factor authentication code"`: Wrong or expired code
- `"Two-factor setup has not been initiated"`: Need to run setup first

## Best Practices

1. **Backup Recovery**: Always provide backup recovery options
2. **User Education**: Provide clear instructions for 2FA setup
3. **Testing**: Test 2FA setup in development environment
4. **Monitoring**: Monitor 2FA usage and failure rates
5. **Documentation**: Keep this guide updated with any changes

## API Endpoints Summary

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/api/users` | POST | Create new user | Admin |
| `/api/auth/login` | POST | User login | None |
| `/api/auth/setup-2fa` | POST | Setup 2FA | User |
| `/api/auth/verify-2fa` | POST | Verify and enable 2FA | User |
| `/api/auth/logout` | POST | Logout user | User |

## Support

For additional support:
1. Check the application logs for detailed error messages
2. Verify the authenticator app is working correctly
3. Ensure network connectivity for API calls
4. Contact system administrator for account issues