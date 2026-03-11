/**
 * Final verification that the API is working
 */
const http = require('http');

function testAPI(endpoint) {
    return new Promise((resolve) => {
        const options = {
            hostname: 'localhost',
            port: 3002,
            path: endpoint,
            method: 'GET'
        };
        
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    console.log(`✓ ${endpoint}`);
                    console.log(`  Status: ${res.statusCode}`);
                    console.log(`  Array: ${Array.isArray(json)}`);
                    console.log(`  Count: ${Array.isArray(json) ? json.length : 'N/A'}`);
                    if (Array.isArray(json) && json.length > 0) {
                        console.log(`  Sample: ${json[0].section_code} - ${json[0].section_name}`);
                    }
                    resolve(true);
                } catch (e) {
                    console.error(`✗ ${endpoint} - Parse error:`, e.message);
                    resolve(false);
                }
            });
        });
        
        req.on('error', (err) => {
            console.error(`✗ ${endpoint} -`, err.message);
            resolve(false);
        });
        
        req.end();
    });
}

async function runTests() {
    console.log('=== API Verification ===\n');
    
    await testAPI('/api/sections');
    console.log('');
    await testAPI('/api/sections/by-school-year/1');
    console.log('');
    await testAPI('/api/school-years');
}

runTests();

