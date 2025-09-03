// Simple API test without external dependencies
const http = require('http');

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function testAPI() {
  console.log('🔧 Testing API Endpoints');
  console.log('========================\n');

  try {
    // Test 1: Health Check
    console.log('1. 🏥 Testing server health...');
    const healthResponse = await makeRequest({
      hostname: 'localhost',
      port: 5002,
      path: '/api/test',
      method: 'GET'
    });
    
    console.log(`   Status: ${healthResponse.status}`);
    console.log(`   Response: ${JSON.stringify(healthResponse.data)}`);

    if (healthResponse.status !== 200) {
      console.log('   ❌ Server health check failed');
      return;
    }
    console.log('   ✅ Server is healthy');

    // Test 2: Login
    console.log('\n2. 🔐 Testing login...');
    const loginData = JSON.stringify({
      email: 'admin@laborresults.de',
      password: 'admin123'
    });

    const loginResponse = await makeRequest({
      hostname: 'localhost',
      port: 5002,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(loginData)
      }
    }, loginData);

    console.log(`   Status: ${loginResponse.status}`);
    console.log(`   Response: ${JSON.stringify(loginResponse.data)}`);

    if (loginResponse.status !== 200 || !loginResponse.data.success) {
      console.log('   ❌ Login failed');
      return;
    }

    const token = loginResponse.data.token;
    console.log('   ✅ Login successful');
    console.log(`   Token: ${token ? 'Received' : 'Missing'}`);

    // Test 3: Fetch Users
    console.log('\n3. 👥 Testing users endpoint...');
    const usersResponse = await makeRequest({
      hostname: 'localhost',
      port: 5002,
      path: '/api/users',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log(`   Status: ${usersResponse.status}`);
    console.log(`   Response: ${JSON.stringify(usersResponse.data, null, 2)}`);

    if (usersResponse.status === 200 && usersResponse.data.success) {
      console.log('   ✅ Users endpoint working');
      console.log(`   Users count: ${usersResponse.data.users?.length || 0}`);
    } else {
      console.log('   ❌ Users endpoint failed');
    }

    // Test 4: Fetch Roles
    console.log('\n4. 🎭 Testing roles endpoint...');
    const rolesResponse = await makeRequest({
      hostname: 'localhost',
      port: 5002,
      path: '/api/roles',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log(`   Status: ${rolesResponse.status}`);
    console.log(`   Response: ${JSON.stringify(rolesResponse.data, null, 2)}`);

    if (rolesResponse.status === 200 && rolesResponse.data.success) {
      console.log('   ✅ Roles endpoint working');
      console.log(`   Roles count: ${rolesResponse.data.roles?.length || 0}`);
    } else {
      console.log('   ❌ Roles endpoint failed');
    }

    // Test 5: Fetch Results
    console.log('\n5. 📊 Testing results endpoint...');
    const resultsResponse = await makeRequest({
      hostname: 'localhost',
      port: 5002,
      path: '/api/results',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log(`   Status: ${resultsResponse.status}`);
    console.log(`   Response: ${JSON.stringify(resultsResponse.data, null, 2)}`);

    if (resultsResponse.status === 200 && resultsResponse.data.success) {
      console.log('   ✅ Results endpoint working');
      console.log(`   Results count: ${resultsResponse.data.results?.length || 0}`);
    } else {
      console.log('   ❌ Results endpoint failed');
    }

    // Test 6: Publish one result to Mirth (as lab)
    console.log('\n6. 🚀 Publishing one result to Mirth...');
    const labLoginData = JSON.stringify({ email: 'lab@laborresults.de', password: 'lab123' });
    const labLogin = await makeRequest({
      hostname: 'localhost',
      port: 5002,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(labLoginData) }
    }, labLoginData);
    if (labLogin.status === 200 && labLogin.data && labLogin.data.token) {
      const labToken = labLogin.data.token;
      const list = await makeRequest({
        hostname: 'localhost',
        port: 5002,
        path: '/api/results',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${labToken}` }
      });
      const any = list.data && list.data.results && list.data.results[0];
      if (any) {
        const resp = await makeRequest({
          hostname: 'localhost',
          port: 5002,
          path: `/api/results/${any.id}/publish`,
          method: 'POST',
          headers: { 'Authorization': `Bearer ${labToken}` }
        });
        console.log('   Publish response:', JSON.stringify(resp.data));
      } else {
        console.log('   No results available to publish');
      }
    } else {
      console.log('   Lab login failed; skipping publish test');
    }

    console.log('\n🎉 API test completed!');

  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

testAPI();