/**
 * Test script to verify API response formats
 */

const API_BASE = 'http://localhost:3002';

async function testAPIFormats() {
    console.log('\n=== Testing API Response Formats ===\n');
    
    try {
        // Test 1: School years endpoint format
        console.log('Test 1: /api/school-years response format...');
        let res = await fetch(`${API_BASE}/api/school-years`);
        let data = await res.json();
        console.log('Response type:', typeof data);
        console.log('Is Array:', Array.isArray(data));
        console.log('Response:', JSON.stringify(data, null, 2).substring(0, 500));
        
        // Test 2: Sections endpoint format
        console.log('\nTest 2: /api/sections response format...');
        res = await fetch(`${API_BASE}/api/sections`);
        data = await res.json();
        console.log('Response type:', typeof data);
        console.log('Is Array:', Array.isArray(data));
        if (Array.isArray(data)) {
            console.log('Array length:', data.length);
            console.log('First item:', JSON.stringify(data[0], null, 2));
        } else {
            console.log('Response:', JSON.stringify(data, null, 2).substring(0, 500));
        }
        
        // Test 3: Sections by school year endpoint
        console.log('\nTest 3: /api/sections/by-school-year/1 response format...');
        res = await fetch(`${API_BASE}/api/sections/by-school-year/1`);
        data = await res.json();
        console.log('Response type:', typeof data);
        console.log('Is Array:', Array.isArray(data));
        console.log('Array length:', Array.isArray(data) ? data.length : 'N/A');
        
    } catch (err) {
        console.error('Error:', err.message);
    }
}

// Helper fetch for Node.js
if (typeof fetch === 'undefined') {
    const http = require('http');
    global.fetch = async (url, options = {}) => {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const client = http;
            const requestOptions = {
                hostname: urlObj.hostname,
                port: urlObj.port,
                path: urlObj.pathname + urlObj.search,
                method: options.method || 'GET',
                headers: options.headers || {}
            };
            
            const req = client.request(requestOptions, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    resolve({
                        ok: res.statusCode >= 200 && res.statusCode < 300,
                        status: res.statusCode,
                        json: () => Promise.resolve(JSON.parse(data || '[]'))
                    });
                });
            });
            
            req.on('error', reject);
            if (options.body) req.write(options.body);
            req.end();
        });
    };
}

testAPIFormats();

