const http = require('http');
const crypto = require('crypto');

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
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, buffer: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function signBody(secret, timestamp, bodyBuffer) {
  const hex = crypto.createHmac('sha256', secret).update(`${timestamp}.${bodyBuffer}`).digest('hex');
  return `sha256=${hex}`;
}

(async () => {
  try {
    const secret = process.env.MIRTH_WEBHOOK_SECRET || 'test_secret';
    // Build minimal LDT line-based payload including BSNR (9 digits) and LANR (7 digits)
    // Use record types consistent with parser expectations
    const makeLdt = (bsnr, lanr) => {
      const lines = [
        '01380008230', // minimal header-like record
        '014810000204', // minimal lab info marker
        `0199212LDT1014.01`,
        `013810019981${bsnr}`, // 0201/7981-ish BSNR present
        `01382127733${lanr}`   // 0212/7733-ish LANR present
      ];
      return lines.join('\n');
    };

    const sendSigned = async (ldt) => {
      const body = Buffer.from(ldt, 'utf8');
      const ts = Date.now().toString();
      const sig = signBody(secret, ts, body);
      return request('POST', '/api/mirth-webhook', {
        headers: {
          'Content-Type': 'text/plain',
          'X-Timestamp': ts,
          'X-Signature': sig,
        },
        body,
      });
    };

    // Send for doctor (123456789/1234567) and lab tech (123456789/1234568)
    const resDoc = await sendSigned(makeLdt('123456789', '1234567'));
    console.log('[mirth doctor]', resDoc.status, resDoc.buffer.toString());
    const resLab = await sendSigned(makeLdt('123456789', '1234568'));
    console.log('[mirth lab]', resLab.status, resLab.buffer.toString());

    console.log('Done. Now login and verify results via scripts/e2e-login-download.js or UI.');
  } catch (e) {
    console.error('mirth-send error:', e.message);
    process.exit(1);
  }
})();