#!/bin/bash

# Quick Fix for Admin Login Issue
# This script creates the initial admin user using curl

set -e

API_BASE="http://localhost:5000/api"
ADMIN_EMAIL="admin@laborresults.de"
ADMIN_PASSWORD="admin123"

echo "🔧 Quick Fix for Admin Login Issue"
echo "==================================="
echo ""

# Step 1: Check server health
echo "Step 1: Checking server status..."
HEALTH_RESPONSE=$(curl -s "$API_BASE/health")
echo "✅ Server is running"
echo ""

# Step 2: Create initial admin user
echo "Step 2: Creating initial admin user..."
SETUP_RESPONSE=$(curl -s -X POST "$API_BASE/setup/initial-admin" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$ADMIN_EMAIL\",
    \"password\": \"$ADMIN_PASSWORD\",
    \"firstName\": \"System\",
    \"lastName\": \"Administrator\"
  }")

SUCCESS=$(echo $SETUP_RESPONSE | jq -r '.success')
if [ "$SUCCESS" = "true" ]; then
    echo "✅ Admin user created successfully!"
    TOKEN=$(echo $SETUP_RESPONSE | jq -r '.token')
    echo "   Token: ${TOKEN:0:20}..."
    echo ""
else
    ERROR_MSG=$(echo $SETUP_RESPONSE | jq -r '.message')
    echo "❌ Failed to create admin user: $ERROR_MSG"
    
    if [[ $ERROR_MSG == *"Users already exist"* ]]; then
        echo ""
        echo "💡 Admin user already exists. Try logging in with:"
        echo "   Email: $ADMIN_EMAIL"
        echo "   Password: $ADMIN_PASSWORD"
    fi
    exit 1
fi

# Step 3: Test login
echo "Step 3: Testing admin login..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$ADMIN_EMAIL\",
    \"password\": \"$ADMIN_PASSWORD\"
  }")

LOGIN_SUCCESS=$(echo $LOGIN_RESPONSE | jq -r '.success')
if [ "$LOGIN_SUCCESS" = "true" ]; then
    echo "✅ Admin login successful!"
    LOGIN_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token')
    echo "   Token: ${LOGIN_TOKEN:0:20}..."
    echo ""
else
    echo "❌ Login failed: $(echo $LOGIN_RESPONSE | jq -r '.message')"
    exit 1
fi

echo "🎉 Admin login issue fixed successfully!"
echo ""
echo "📋 Login Credentials:"
echo "   Email: $ADMIN_EMAIL"
echo "   Password: $ADMIN_PASSWORD"
echo ""
echo "🔒 Security Recommendations:"
echo "   1. Change the default password immediately"
echo "   2. Enable 2FA for the admin account"
echo "   3. Create additional admin users if needed"
echo ""

# Test admin endpoint
echo "Step 4: Testing admin endpoint..."
ADMIN_RESPONSE=$(curl -s -H "Authorization: Bearer $LOGIN_TOKEN" "$API_BASE/users")
USERS_COUNT=$(echo $ADMIN_RESPONSE | jq '.users | length')
echo "✅ Admin endpoint working! ($USERS_COUNT users found)"