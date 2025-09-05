const crypto = require('crypto');
const fetchFn = globalThis.fetch
  ? globalThis.fetch.bind(globalThis)
  : (...args) => import('node-fetch').then(mod => mod.default(...args));

function buildMirthHeaders(ldtContent, secret, extraHeaders = {}) {
  if (typeof ldtContent !== 'string') {
    throw new Error('ldtContent must be a string');
  }
  if (!secret || typeof secret !== 'string') {
    throw new Error('Mirth secret is required');
  }
  const timestamp = Date.now().toString();
  const signature = crypto
    .createHmac('sha256', secret)
    .update(timestamp + '.' + ldtContent)
    .digest('hex');
  return {
    'Content-Type': 'text/plain',
    'X-Timestamp': timestamp,
    'X-Signature': `sha256=${signature}`,
    ...extraHeaders,
  };
}

async function sendLDTToMirth(ldtContent, options = {}) {
  const endpoint = options.endpoint || process.env.MIRTH_OUTBOUND_URL;
  const secret = options.secret || process.env.MIRTH_OUTBOUND_SECRET;
  const timeoutMs = Number(options.timeoutMs || process.env.MIRTH_OUTBOUND_TIMEOUT_MS || 10000);
  const retries = Number(options.retries || process.env.MIRTH_OUTBOUND_RETRIES || 2);

  if (!endpoint) {
    throw new Error('MIRTH_OUTBOUND_URL not configured');
  }
  if (!secret) {
    throw new Error('MIRTH_OUTBOUND_SECRET not configured');
  }

  const headers = buildMirthHeaders(ldtContent, secret, options.headers);

  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetchFn(endpoint, {
        method: 'POST',
        headers,
        body: ldtContent,
        signal: controller.signal,
      });
      clearTimeout(timer);

      const text = await res.text().catch(() => '');

      if (!res.ok) {
        const error = new Error(`Mirth responded with ${res.status}`);
        error.status = res.status;
        error.body = text;
        throw error;
      }

      return { ok: true, status: res.status, body: text };
    } catch (err) {
      lastError = err;
      // Backoff before retry
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 300 * Math.pow(2, attempt)));
        continue;
      }
    }
  }

  const error = new Error(`Failed to send LDT to Mirth: ${lastError && lastError.message}`);
  error.cause = lastError;
  throw error;
}

module.exports = {
  buildMirthHeaders,
  sendLDTToMirth,
};

