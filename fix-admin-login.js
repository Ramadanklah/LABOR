#!/usr/bin/env node

/**
 * Fix Admin Login Script
 * 
 * This script helps fix the "User not found" error by creating the admin user
 * and testing the login functionality.
 */

const axios = require('axios');

// Configuration
const API_BASE = process.env.API_BASE || 'http://localhost:5000/api';
const ADMIN_EMAIL = 'admin@laborresults.de';
const ADMIN_PASSWORD = 'admin123';

async function fixAdminLogin() {
  console.log('🔧 Fixing Admin Login Issue');
  console.log('==========================\n');

  try {
    // Step 1: Check if server is running
    console.log('Step 1: Checking server status...');
    const healthResponse = await axios.get(`${API_BASE}/health`);
    console.log('✅ Server is running');
    console.log(`   Status: ${healthResponse.data.status}`);
    console.log(`   Users: ${healthResponse.data.userStats.total}`);
    console.log('');

    // Step 2: Try to create initial admin user
    console.log('Step 2: Creating initial admin user...');
    const setupResponse = await axios.post(`${API_BASE}/setup/initial-admin`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      firstName: 'System',
      lastName: 'Administrator'
    });

    console.log('✅ Admin user created successfully!');
    console.log(`   Email: ${setupResponse.data.user.email}`);
    console.log(`   Role: ${setupResponse.data.user.role}`);
    console.log(`   Token: ${setupResponse.data.token.substring(0, 20)}...`);
    console.log('');

    // Step 3: Test login with the created user
    console.log('Step 3: Testing admin login...');
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });

    console.log('✅ Admin login successful!');
    console.log(`   Token: ${loginResponse.data.token.substring(0, 20)}...`);
    console.log(`   User: ${loginResponse.data.user.email}`);
    console.log(`   2FA Enabled: ${loginResponse.data.user.isTwoFactorEnabled}`);
    console.log('');

    // Step 4: Test admin endpoints
    console.log('Step 4: Testing admin endpoints...');
    const adminResponse = await axios.get(`${API_BASE}/users`, {
      headers: {
        'Authorization': `Bearer ${loginResponse.data.token}`
      }
    });

    console.log('✅ Admin endpoints working!');
    console.log(`   Users found: ${adminResponse.data.users.length}`);
    console.log('');

    console.log('🎉 Admin login issue fixed successfully!');
    console.log('');
    console.log('📋 Login Credentials:');
    console.log(`   Email: ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
    console.log('');
    console.log('🔒 Security Recommendations:');
    console.log('   1. Change the default password immediately');
    console.log('   2. Enable 2FA for the admin account');
    console.log('   3. Create additional admin users if needed');
    console.log('   4. Use strong passwords for all accounts');

  } catch (error) {
    if (error.response) {
      console.error('❌ Error:', error.response.data.message || error.response.statusText);
      console.error('   Status:', error.response.status);
      
      if (error.response.status === 403 && error.response.data.message.includes('Users already exist')) {
        console.log('');
        console.log('💡 Solution: Admin user already exists. Try logging in with:');
        console.log(`   Email: ${ADMIN_EMAIL}`);
        console.log(`   Password: ${ADMIN_PASSWORD}`);
      }
    } else {
      console.error('❌ Network error:', error.message);
      console.log('');
      console.log('💡 Make sure the server is running on:', API_BASE);
    }
  }
}

// Alternative: Direct login test
async function testLogin() {
  console.log('🔐 Testing Admin Login');
  console.log('=====================\n');

  try {
    const response = await axios.post(`${API_BASE}/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });

    console.log('✅ Login successful!');
    console.log(`   Token: ${response.data.token.substring(0, 20)}...`);
    console.log(`   User: ${response.data.user.email}`);
    console.log(`   Role: ${response.data.user.role}`);
    console.log(`   2FA Enabled: ${response.data.user.isTwoFactorEnabled}`);

  } catch (error) {
    console.error('❌ Login failed:', error.response?.data?.message || error.message);
    
    if (error.response?.status === 401) {
      console.log('');
      console.log('💡 The admin user does not exist. Run the fix script:');
      console.log('   node fix-admin-login.js');
    }
  }
}

// Run based on command line arguments
const command = process.argv[2] || 'fix';

if (command === 'test') {
  testLogin();
} else {
  fixAdminLogin();
}