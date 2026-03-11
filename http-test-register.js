const http = require('http');

const data = JSON.stringify({
  firstName: 'Alice',
  lastName: 'Tester',
  email: 'alice.'+Date.now()+'@example.com',
  password: 'password123',
  gradeLevel: '10'
});

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/auth/register',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, res => {
  console.log(`STATUS: ${res.statusCode}`);
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log('BODY:', body));
});

req.on('error', e => console.error('request error', e));
req.write(data);
req.end();


