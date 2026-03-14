const http = require('http');
const data = JSON.stringify({ action: 'test_click', details: { actor: { id: 123, role: 'student', name: 'Test Student' }, button: 'test' } });

const options = {
  hostname: 'localhost',
  port: 3005,
  path: '/api/audit/track',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, (res) => {
  console.log('status', res.statusCode);
  res.setEncoding('utf8');
  res.on('data', (chunk) => process.stdout.write(chunk));
  res.on('end', () => process.exit(0));
});

req.on('error', (e) => { console.error('error', e); process.exit(1); });
req.write(data);
req.end();
