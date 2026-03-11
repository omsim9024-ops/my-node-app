/**
 * Test script to verify sections are fetching correctly for teacher role assignment
 */

const API_BASE = 'http://localhost:3002';

async function testSectionsAndSchoolYears() {
    console.log('\n=== Testing Sections & School Years for Teacher Assignment ===\n');
    
    try {
        // Test 1: Get school years
        console.log('Test 1: Fetch school years...');
        let res = await fetch(`${API_BASE}/api/school-years`);
        let data = await res.json();
        console.log(`✓ Found ${data.length || 0} school years`);
        if (Array.isArray(data) && data.length > 0) {
            data.forEach((sy, i) => {
                console.log(`  ${i + 1}. ID: ${sy.id}, Year: ${sy.school_year}, Active: ${sy.is_active ? '✓' : '✗'}`);
            });
            
            const activeYear = data.find(sy => sy.is_active);
            if (activeYear) {
                console.log(`\n✓ Active School Year found: ${activeYear.school_year} (ID: ${activeYear.id})`);
            } else {
                console.warn('⚠️  No active school year found!');
            }
        }
        
        // Test 2: Get all sections
        console.log('\nTest 2: Fetch all sections...');
        res = await fetch(`${API_BASE}/api/sections`);
        data = await res.json();
        console.log(`✓ Found ${(Array.isArray(data) ? data : []).length} sections`);
        
        if (Array.isArray(data) && data.length > 0) {
            data.slice(0, 5).forEach((s, i) => {
                console.log(`  ${i + 1}. ID: ${s.id}, Code: ${s.section_code}, Name: ${s.section_name}, Grade: ${s.grade}, School Year ID: ${s.school_year_id}`);
            });
            
            // Check if sections have school_year_id
            const sectionsWithYearId = data.filter(s => s.school_year_id);
            const sectionsWithoutYearId = data.filter(s => !s.school_year_id);
            console.log(`\n  Sections WITH school_year_id: ${sectionsWithYearId.length}`);
            console.log(`  Sections WITHOUT school_year_id: ${sectionsWithoutYearId.length}`);
        }
        
        // Test 3: Get sections by specific school year (if one exists)
        const activeYear = (Array.isArray(data) ? [] : []).find ? data.find(sy => sy.is_active) : null;
        if (activeYear) {
            console.log(`\nTest 3: Fetch sections for active school year (ID: ${activeYear.id})...`);
            res = await fetch(`${API_BASE}/api/sections/by-school-year/${activeYear.id}`);
            data = await res.json();
            console.log(`✓ Found ${(Array.isArray(data) ? data : []).length} sections for active school year`);
            if (Array.isArray(data) && data.length > 0) {
                data.slice(0, 3).forEach((s, i) => {
                    console.log(`  ${i + 1}. Code: ${s.section_code}, Name: ${s.section_name}`);
                });
            } else {
                console.warn('⚠️  No sections for active school year!');
            }
        }
        
        console.log('\n=== Test Complete ===\n');
        
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

testSectionsAndSchoolYears();

