const { buildMirthHeaders } = require('./mirthClient');

describe('mirthClient headers', () => {
  test('buildMirthHeaders includes signature and timestamp', () => {
    const content = 'TEST-LDT';
    const secret = 's3cr3t';
    const headers = buildMirthHeaders(content, secret);
    expect(headers['Content-Type']).toBe('text/plain');
    expect(headers['X-Timestamp']).toBeDefined();
    expect(headers['X-Signature']).toMatch(/^sha256=[a-f0-9]{64}$/);
  });
});

