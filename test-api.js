const http = require('http');

function testApi(path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3001,
            path: path,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                console.log(`\n=== ${path} ===`);
                console.log('Status:', res.statusCode);
                console.log('Response:', data.substring(0, 300) + (data.length > 300 ? '...' : ''));
                resolve({ statusCode: res.statusCode, data: data });
            });
        });

        req.on('error', (err) => {
            console.error('Error:', err.message);
            reject(err);
        });

        req.end();
    });
}

async function runTests() {
    try {
        await testApi('/api/system-health/schools/resolve');
        await testApi('/api/school-years/active?school=default-school');
        await testApi('/api/teachers?school=default-school');
        await testApi('/api/teaching-assignments/me?school=default-school');
        await testApi('/api/students/all?school=default-school');
    } catch (err) {
        console.error('Test failed:', err);
    }
}

runTests();

