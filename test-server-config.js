#!/usr/bin/env node

/**
 * Test script to verify server configuration and functionality
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:5000';

async function testServerConfig() {
  console.log('🔧 Testing Server Configuration');
  console.log('================================\n');

  try {
    // Test 1: Server Health Check
    console.log('1. 🏥 Testing server health...');
    try {
      const healthResponse = await axios.get(`${API_BASE_URL}/api/test`);
      console.log('   ✅ Server is running and accessible');
      console.log(`   📊 Response: ${JSON.stringify(healthResponse.data)}`);
    } catch (error) {
      console.log('   ❌ Server health check failed');
      console.log(`   Error: ${error.message}`);
      return;
    }

    // Test 2: Login with Default Admin User
    console.log('\n2. 🔐 Testing login with default admin user...');
    try {
      const loginResponse = await axios.post(`${API_BASE_URL}/api/auth/login`, {
        email: 'admin@laborresults.de',
        password: 'admin123'
      });
      
      if (loginResponse.data.success) {
        console.log('   ✅ Login successful');
        console.log(`   👤 User: ${loginResponse.data.user.firstName} ${loginResponse.data.user.lastName}`);
        console.log(`   🎫 Token received: ${loginResponse.data.token ? 'Yes' : 'No'}`);
        
        // Test 3: Fetch Results with Token
        console.log('\n3. 📊 Testing results endpoint...');
        try {
          const resultsResponse = await axios.get(`${API_BASE_URL}/api/results`, {
            headers: {
              'Authorization': `Bearer ${loginResponse.data.token}`
            }
          });
          
          console.log('   ✅ Results endpoint accessible');
          console.log(`   📈 Results count: ${resultsResponse.data.results?.length || 0}`);
          
          if (resultsResponse.data.results?.length > 0) {
            console.log('   📋 Sample result:');
            const sample = resultsResponse.data.results[0];
            console.log(`      ID: ${sample.id}`);
            console.log(`      Type: ${sample.type}`);
            console.log(`      Patient: ${sample.patient}`);
            console.log(`      Date: ${sample.date}`);
          }
          
        } catch (error) {
          console.log('   ❌ Results endpoint failed');
          console.log(`   Error: ${error.response?.data?.message || error.message}`);
        }
        
      } else {
        console.log('   ❌ Login failed');
        console.log(`   Message: ${loginResponse.data.message}`);
      }
      
    } catch (error) {
      console.log('   ❌ Login request failed');
      if (error.response) {
        console.log(`   Status: ${error.response.status}`);
        console.log(`   Message: ${error.response.data?.message || error.response.statusText}`);
      } else {
        console.log(`   Error: ${error.message}`);
      }
    }

    // Test 4: Email Service Status
    console.log('\n4. 📧 Testing email service...');
    try {
      // This would require a specific endpoint to test email service
      console.log('   ℹ️  Email service test requires manual verification');
      console.log('   💡 Check server logs for email service initialization');
    } catch (error) {
      console.log('   ❌ Email service test failed');
    }

    // Test 5: LDT Files Check
    console.log('\n5. 📁 Checking for LDT files...');
    const fs = require('fs');
    const path = require('path');
    
    try {
      const ldtFiles = fs.readdirSync(__dirname)
        .filter(file => file.endsWith('.ldt'));
      
      console.log(`   📊 Found ${ldtFiles.length} LDT files in root directory`);
      if (ldtFiles.length > 0) {
        console.log('   📋 LDT files:');
        ldtFiles.forEach(file => {
          const filePath = path.join(__dirname, file);
          const stats = fs.statSync(filePath);
          const content = fs.readFileSync(filePath, 'utf8');
          console.log(`      - ${file} (${stats.size} bytes, ${content.split('\n').length} lines)`);
        });
        console.log('\n   💡 Run the import script to process these files:');
        console.log('      node import-ldt-files.js');
      }
    } catch (error) {
      console.log('   ❌ Error checking LDT files');
      console.log(`   Error: ${error.message}`);
    }

    console.log('\n🎉 Configuration test completed!');
    
  } catch (error) {
    console.error('💥 Fatal error during testing:', error.message);
  }
}

// Run the test
if (require.main === module) {
  testServerConfig().catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = { testServerConfig };