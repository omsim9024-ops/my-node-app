/**
 * Test script for section assignment API fix
 * This verifies that the assignment endpoint works correctly
 */

const http = require('http');

const API_BASE = 'http://localhost:3002';

async function testAssignment() {
    try {
        console.log('\n=== SECTION ASSIGNMENT API TEST ===\n');
        
        // Step 1: Get all enrollments
        console.log('Step 1: Fetching enrollments...');
        const enrollmentsRes = await fetch(`${API_BASE}/api/enrollments`);
        const enrollments = await enrollmentsRes.json();
        console.log(`✓ Found ${enrollments.length} total enrollments`);
        
        // Find unassigned approved enrollments
        const unassigned = enrollments.filter(e => 
            (e.status || '').toLowerCase() === 'approved' && 
            !e.section_id && 
            !e.class_id
        );
        console.log(`✓ Found ${unassigned.length} unassigned approved enrollments`);
        
        if (unassigned.length === 0) {
            console.log('⚠️  No unassigned enrollments to test with');
            return;
        }
        
        // Step 2: Get sections
        console.log('\nStep 2: Fetching sections...');
        const sectionsRes = await fetch(`${API_BASE}/api/sections`);
        const sections = await sectionsRes.json();
        console.log(`✓ Found ${sections.length} sections`);
        
        if (sections.length === 0) {
            console.log('⚠️  No sections available');
            return;
        }
        
        const testSection = sections[0];
        console.log(`✓ Using section: ${testSection.section_name} (ID: ${testSection.id})`);
        
        // Step 3: Try assignment
        console.log('\nStep 3: Testing assignment...');
        const studentsToAssign = unassigned.slice(0, 2).map(e => e.id);
        console.log(`→ Assigning ${studentsToAssign.length} students to section ${testSection.id}`);
        console.log(`→ Enrollment IDs to assign: ${studentsToAssign.join(', ')}`);
        
        const assignRes = await fetch(`${API_BASE}/api/sections/${testSection.id}/assign-students`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ student_ids: studentsToAssign })
        });
        
        console.log(`→ Response status: ${assignRes.status}`);
        const assignData = await assignRes.json();
        console.log(`✓ Assignment response:`, assignData);
        
        if (assignData.success) {
            console.log(`✓ Successfully assigned ${assignData.assigned_count} enrollment(s)`);
            
            // Step 4: Verify assignment persisted
            console.log('\nStep 4: Verifying assignment persisted...');
            const verifyRes = await fetch(`${API_BASE}/api/enrollments`);
            const updatedEnrollments = await verifyRes.json();
            
            const assignedEnrollments = updatedEnrollments.filter(e => 
                studentsToAssign.includes(e.id) && e.section_id === testSection.id
            );
            
            if (assignedEnrollments.length === studentsToAssign.length) {
                console.log(`✅ VERIFIED: All ${assignedEnrollments.length} assignments were persisted to database!`);
                assignedEnrollments.forEach(e => {
                    console.log(`   - Enrollment ${e.id}: section_id = ${e.section_id}`);
                });
            } else {
                console.log(`❌ FAILED: Only ${assignedEnrollments.length} of ${studentsToAssign.length} assignments persisted`);
            }
        } else {
            console.log(`❌ Assignment failed:`, assignData);
        }
        
    } catch (error) {
        console.error('Test error:', error.message);
    }
}

// Helper fetch for Node.js
if (typeof fetch === 'undefined') {
    global.fetch = async (url, options = {}) => {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const isHttps = urlObj.protocol === 'https:';
            const client = isHttps ? require('https') : require('http');
            
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
                        status: res.statusCode,
                        statusText: res.statusMessage,
                        json: async () => {
                            try {
                                return JSON.parse(data);
                            } catch (e) {
                                return { error: data };
                            }
                        },
                        text: async () => data
                    });
                });
            });
            
            req.on('error', reject);
            
            if (options.body) {
                req.write(options.body);
            }
            
            req.end();
        });
    };
}

testAssignment();

