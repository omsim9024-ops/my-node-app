const http = require('http');
const data = JSON.stringify({ action: 'click:button', details: { actor: { id: 999, role: 'student', name: 'Test User' }, button: 'testTrack' } });

const options = {
  hostname: 'localhost',
  port: 3004,
  path: '/api/audit/track',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, (res) => {
  console.log('status', res.statusCode);
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('body', body);
    process.exit(0);
  });
});

req.on('error', (err) => { console.error('error', err); process.exit(1); });
req.write(data);
req.end();
