#!/usr/bin/env node
/**
 * Comprehensive MySQL Migration Verification Script
 * Tests all major API endpoints to ensure successful migration from PostgreSQL to MySQL
 */

const http = require('http');
const BASE_URL = 'http://localhost:3004';

// Helper function to make HTTP requests
function makeRequest(method, path) {
    return new Promise((resolve, reject) => {
        const url = new URL(BASE_URL + path);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

async function runTests() {
    console.log('🧪 MySQL Migration Verification\n');
    console.log('Testing API endpoints to confirm MySQL compatibility...\n');

    const tests = [
        {
            name: 'Students API',
            method: 'GET',
            path: '/api/students',
            check: (data) => Array.isArray(data) && data.length > 0
        },
        {
            name: 'Student by ID',
            method: 'GET',
            path: '/api/students/6',
            check: (data) => data.id && data.student_id
        },
        {
            name: 'Enrollments API',
            method: 'GET',
            path: '/api/enrollments',
            check: (data) => Array.isArray(data)
        },
        {
            name: 'Enrollment Approved Status',
            method: 'GET',
            path: '/api/enrollments?status=Approved',
            check: (data) => Array.isArray(data)
        },
        {
            name: 'Sections API',
            method: 'GET',
            path: '/api/sections',
            check: (data) => Array.isArray(data)
        },
        {
            name: 'Teachers API',
            method: 'GET',
            path: '/api/teachers',
            check: (data) => Array.isArray(data)
        },
        {
            name: 'School Years API',
            method: 'GET',
            path: '/api/school-years',
            check: (data) => Array.isArray(data)
        },
        {
            name: 'Active School Year',
            method: 'GET',
            path: '/api/school-years/active',
            check: (data) => data && (data.id || Array.isArray(data))
        },
        {
            name: 'Guidance Dashboard Stats',
            method: 'GET',
            path: '/api/guidance/dashboard/stats',
            check: (data) => data.totalActiveCases !== undefined
        },
        {
            name: 'System Health',
            method: 'GET',
            path: '/api/system-health/',
            check: (data) => data.uptime !== undefined && data.apiHealth !== undefined
        }
    ];

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
        try {
            const result = await makeRequest(test.method, test.path);
            const isValid = test.check(result.data);
            
            if (isValid && result.status === 200) {
                console.log(`✅ ${test.name}`);
                console.log(`   Status: ${result.status}, Records: ${Array.isArray(result.data) ? result.data.length : 'single'}\n`);
                passed++;
            } else {
                console.log(`❌ ${test.name}`);
                console.log(`   Status: ${result.status}, Validation: ${!isValid ? 'FAILED' : 'OK'}`);
                console.log(`   Response: ${JSON.stringify(result.data).substring(0, 100)}...\n`);
                failed++;
            }
        } catch (err) {
            console.log(`❌ ${test.name}`);
            console.log(`   Error: ${err.message}\n`);
            failed++;
        }
    }

    console.log('\n📊 Test Results:');
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   Total: ${tests.length}\n`);

    if (failed === 0) {
        console.log('🎉 All tests passed! MySQL migration successful!\n');
        process.exit(0);
    } else {
        console.log('⚠️  Some tests failed. Review the errors above.\n');
        process.exit(1);
    }
}

// Run tests with error handling
runTests().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});

