const http = require('http');

const host = process.env.HOST || '127.0.0.1';
const port = process.env.PORT || 5000;
const path = '/api/health';

function check() {
  const options = {
    host,
    port,
    path,
    timeout: 5000,
  };

  const req = http.get(options, (res) => {
    if (res.statusCode === 200) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  });

  req.on('error', () => process.exit(1));
  req.setTimeout(5000, () => {
    req.destroy();
    process.exit(1);
  });
}

check();

