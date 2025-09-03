const http = require('http');
const fs = require('fs');

function request(method, path, { headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers,
    };

    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({ status: res.statusCode, headers: res.headers, buffer });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

(async () => {
  try {
    // Health
    const healthRes = await request('GET', '/api/health');
    console.log('[health]', healthRes.status, healthRes.buffer.toString());

    // Legacy login
    const payload = JSON.stringify({ bsnr: '123456789', lanr: '1234567', password: 'doctor123' });
    const loginRes = await request('POST', '/api/login', {
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      body: payload,
    });
    console.log('[login]', loginRes.status, loginRes.buffer.toString());
    if (loginRes.status !== 200) throw new Error('Login failed');
    const loginData = JSON.parse(loginRes.buffer.toString());
    const token = loginData.token;
    if (!token) throw new Error('No token in login response');

    // Results
    const resultsRes = await request('GET', '/api/results', {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('[results]', resultsRes.status);
    if (resultsRes.status !== 200) throw new Error('Results fetch failed');

    // Download LDT
    const ldtRes = await request('GET', '/api/download/ldt', {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('[download-ldt]', ldtRes.status, ldtRes.headers['content-type']);
    if (ldtRes.status !== 200) throw new Error('LDT download failed');
    fs.writeFileSync('/tmp/test_e2e.ldt', ldtRes.buffer);

    // Download PDF
    const pdfRes = await request('GET', '/api/download/pdf', {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('[download-pdf]', pdfRes.status, pdfRes.headers['content-type']);
    if (pdfRes.status !== 200) throw new Error('PDF download failed');
    fs.writeFileSync('/tmp/test_e2e.pdf', pdfRes.buffer);

    console.log('E2E Flow Completed');
  } catch (err) {
    console.error('E2E error:', err.message);
    process.exit(1);
  }
})();

