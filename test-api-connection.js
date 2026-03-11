#!/usr/bin/env node

const http = require('http');
const https = require('https');

// Test API connectivity to various ports
const ports = [3000, 3001, 3002, 3010];
const hostname = 'localhost';

async function testPort(port) {
    return new Promise((resolve) => {
        const protocol = port === 443 ? https : http;
        const options = {
            hostname: hostname,
            port: port,
            path: '/api/teacher-auth/list',
            method: 'GET',
            timeout: 3000
        };

        console.log(`Testing: http://${hostname}:${port}/api/teacher-auth/list`);

        const req = protocol.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`  ✓ Response: ${res.statusCode} ${res.statusMessage}`);
                try {
                    const json = JSON.parse(data);
                    const teacherCount = json.teachers ? json.teachers.length : 0;
                    console.log(`  ✓ Teachers in response: ${teacherCount}`);
                    resolve({ port, success: true, status: res.statusCode, teacherCount });
                } catch (e) {
                    console.log(`  ⚠ Response data (first 100 chars): ${data.substring(0, 100)}`);
                    resolve({ port, success: true, status: res.statusCode, teacherCount: 0 });
                }
            });
        });

        req.on('timeout', () => {
            req.destroy();
            console.log(`  ✗ Timeout`);
            resolve({ port, success: false, error: 'timeout' });
        });

        req.on('error', (err) => {
            console.log(`  ✗ Error: ${err.message}`);
            resolve({ port, success: false, error: err.message });
        });

        req.end();
    });
}

async function testAll() {
    console.log('Testing API endpoints...\n');
    const results = [];
    for (const port of ports) {
        const result = await testPort(port);
        results.push(result);
        console.log();
    }

    console.log('Summary:');
    const working = results.filter(r => r.success);
    if (working.length === 0) {
        console.log('  ✗ No API endpoints responding!');
        console.log('\n  Next steps:');
        console.log('  1. Make sure the server is running: node server.js');
        console.log('  2. Check what port it\'s listening on');
        console.log('  3. Verify the database connection');
    } else {
        console.log(`  ✓ Found ${working.length} working endpoint(s)`);
        working.forEach(r => {
            console.log(`  - Port ${r.port}: ${r.teacherCount} teachers`);
        });
    }
}

testAll().catch(console.error);

