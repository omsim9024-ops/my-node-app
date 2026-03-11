/**
 * Debug script to test the modal loading flow
 */

const API_BASE = 'http://localhost:3002';

async function testModalFlow() {
    console.log('\n=== Testing Modal Loading Flow ===\n');
    
    try {
        // Step 1: Simulate loadActiveSchoolYear()
        console.log('Step 1: Fetching active school year...');
        let res = await fetch(`${API_BASE}/api/school-years`);
        let years = await res.json();
        console.log('Response:', years);
        
        const active = Array.isArray(years) ? years.find(y => y.is_active) : null;
        let activeSchoolYearId = active ? active.id : null;
        console.log(`✓ Active School Year ID: ${activeSchoolYearId}`);
        
        // Step 2: Simulate loadSectionsForAssignment()
        console.log('\nStep 2: Fetching sections...');
        let endpoint = '/api/sections';
        if (activeSchoolYearId) {
            endpoint = `/api/sections/by-school-year/${activeSchoolYearId}`;
        }
        
        console.log(`Endpoint: ${endpoint}`);
        res = await fetch(`${API_BASE}${endpoint}`);
        let sections = await res.json();
        
        console.log(`Response type: ${typeof sections}`);
        console.log(`Is Array: ${Array.isArray(sections)}`);
        console.log(`Response:`, sections);
        
        if (Array.isArray(sections)) {
            console.log(`✓ Got ${sections.length} sections`);
            console.log('\nFirst 5 sections:');
            sections.slice(0, 5).forEach((s, i) => {
                console.log(`  ${i + 1}. ID: ${s.id}, Code: ${s.section_code}, Name: ${s.section_name}`);
            });
        } else {
            console.error('✗ Sections is not an array!', sections);
        }
        
        // Step 3: Simulate DOM population
        console.log('\nStep 3: Simulating DOM population...');
        const mockSelect = document.createElement('select');
        mockSelect.id = 'assignSection';
        mockSelect.innerHTML = '<option value="">-- Select Section --</option>';
        
        if (Array.isArray(sections)) {
            sections.forEach(section => {
                const option = document.createElement('option');
                option.value = section.id;
                const grade = section.grade || '';
                const code = section.section_code || '';
                const name = section.section_name || '';
                option.textContent = `${code} - ${name} ${grade ? '(Grade ' + grade + ')' : ''}`;
                mockSelect.appendChild(option);
            });
        }
        
        console.log(`✓ Created select with ${mockSelect.options.length - 1} options`);
        console.log('\nGenerated Options:');
        for (let i = 1; i < mockSelect.options.length; i++) {
            console.log(`  ${i}. ${mockSelect.options[i].text}`);
        }
        
        console.log('\n=== Test Complete ===\n');
        
    } catch (err) {
        console.error('Error:', err);
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

testModalFlow();

