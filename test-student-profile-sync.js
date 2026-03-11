/**
 * Student Profile Admin Sync Test Script
 * Tests the integration between Admin Dashboard and Student Dashboard
 * for school year and section assignment synchronization
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3000';
const API_KEY = process.env.API_KEY || ''; // Add if using API key authentication

// Test results tracker
const testResults = {
    passed: 0,
    failed: 0,
    tests: []
};

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[36m',
    bold: '\x1b[1m'
};

function log(...args) {
    console.log(...args);
}

function success(msg) {
    log(`${colors.green}✅ ${msg}${colors.reset}`);
}

function error(msg) {
    log(`${colors.red}❌ ${msg}${colors.reset}`);
}

function info(msg) {
    log(`${colors.blue}ℹ️  ${msg}${colors.reset}`);
}

function warn(msg) {
    log(`${colors.yellow}⚠️  ${msg}${colors.reset}`);
}

function testHeader(title) {
    log(`\n${colors.bold}${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    log(`${colors.bold}${title}${colors.reset}`);
    log(`${colors.bold}${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
}

function recordTest(name, passed, details = '') {
    testResults.tests.push({ name, passed, details });
    if (passed) {
        testResults.passed++;
        success(name);
    } else {
        testResults.failed++;
        error(name);
    }
    if (details) {
        info(details);
    }
}

async function makeRequest(method, endpoint, body = null) {
    const url = `${API_BASE}${endpoint}`;
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    if (API_KEY) {
        options.headers['Authorization'] = `Bearer ${API_KEY}`;
    }

    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(url, options);
        const data = await response.json().catch(() => null);
        return { status: response.status, ok: response.ok, data };
    } catch (err) {
        return { status: 0, ok: false, error: err.message };
    }
}

// Test 1: Check if API is reachable
async function testAPIConnectivity() {
    testHeader('Test 1: API Connectivity');

    const result = await makeRequest('GET', '/api/school-years');
    recordTest(
        'API is reachable',
        result.ok,
        result.ok ? '✓ Backend server responding' : `✗ Status: ${result.status}`
    );
}

// Test 2: Verify active school year endpoint
async function testActiveSchoolYear() {
    testHeader('Test 2: Active School Year');

    const result = await makeRequest('GET', '/api/school-years/active');
    
    if (result.ok && result.data) {
        success('GET /api/school-years/active responds correctly');
        info(`Active School Year: ${result.data.school_year || 'Not set'}`);
        recordTest('Active school year data structure', !!result.data.school_year);
    } else {
        error('Failed to fetch active school year');
        recordTest('Active school year endpoint', false, `Status: ${result.status}`);
    }
}

// Test 3: Verify student enrollments endpoint
async function testStudentEnrollments() {
    testHeader('Test 3: Student Enrollments');

    // Get all enrollments first to find a student
    const enrollmentsResult = await makeRequest('GET', '/api/enrollments');
    
    if (!enrollmentsResult.ok || !Array.isArray(enrollmentsResult.data)) {
        error('Could not fetch enrollments');
        recordTest('Student enrollments endpoint', false);
        return;
    }

    success(`Found ${enrollmentsResult.data.length} total enrollments`);

    if (enrollmentsResult.data.length > 0) {
        const testEnrollment = enrollmentsResult.data[0];
        const studentId = testEnrollment.student_id || testEnrollment.id;

        info(`Testing with student ID: ${studentId}`);

        const result = await makeRequest('GET', `/api/enrollments/student/${studentId}`);
        
        if (result.ok && Array.isArray(result.data)) {
            recordTest(
                `Student ${studentId} enrollments fetch`,
                true,
                `Found ${result.data.length} enrollment(s)`
            );

            // Check for section assignments
            const assignedEnrollments = result.data.filter(e => e.section_id);
            info(`Enrollments with section assignments: ${assignedEnrollments.length}`);

            // Analyze assignment status
            if (assignedEnrollments.length > 0) {
                assignedEnrollments.forEach((e, idx) => {
                    info(`  Enrollment ${idx + 1}: ID=${e.id}, Section ID=${e.section_id}, Status=${e.status}`);
                });
            } else {
                warn(`No section assignments found for this student`);
            }
        } else {
            recordTest(
                `Student ${studentId} enrollments fetch`,
                false,
                `Status: ${result.status}`
            );
        }
    }
}

// Test 4: Verify sections endpoint
async function testSectionsEndpoint() {
    testHeader('Test 4: Sections Endpoint');

    const result = await makeRequest('GET', '/api/sections');
    
    if (result.ok && Array.isArray(result.data)) {
        recordTest(
            'GET /api/sections responds correctly',
            true,
            `Found ${result.data.length} sections`
        );

        if (result.data.length > 0) {
            const section = result.data[0];
            info(`Sample section: "${section.section_name}" (Code: ${section.section_code})`);

            // Test getting a specific section
            const sectionDetail = await makeRequest('GET', `/api/sections/${section.id}`);
            recordTest(
                `GET /api/sections/${section.id} detail fetch`,
                sectionDetail.ok,
                sectionDetail.ok ? '✓ Can fetch section details' : `✗ Status: ${sectionDetail.status}`
            );
        }
    } else {
        recordTest('GET /api/sections endpoint', false, `Status: ${result.status}`);
    }
}

// Test 5: Verify section with students
async function testSectionWithStudents() {
    testHeader('Test 5: Section Students List');

    // Get sections
    const sectionsResult = await makeRequest('GET', '/api/sections');
    
    if (!sectionsResult.ok || sectionsResult.data.length === 0) {
        warn('No sections to test');
        return;
    }

    // Find a section with students
    for (const section of sectionsResult.data) {
        const studentsResult = await makeRequest('GET', `/api/sections/${section.id}/students`);
        
        if (studentsResult.ok && Array.isArray(studentsResult.data)) {
            recordTest(
                `Section ${section.section_name} students endpoint`,
                true,
                `${studentsResult.data.length} student(s) in this section`
            );

            if (studentsResult.data.length > 0) {
                info(`Sample: ${studentsResult.data[0].first_name} ${studentsResult.data[0].last_name}`);
            }
            return;
        }
    }

    warn('No sections with students found for testing');
}

// Test 6: Verify database schema
async function testDatabaseSchema() {
    testHeader('Test 6: Database Schema Verification');

    // This test checks if the enrollments table has section_id column
    // by attempting to update it
    info('Checking enrollments table structure...');
    
    const enrollmentsResult = await makeRequest('GET', '/api/enrollments');
    
    if (enrollmentsResult.ok && Array.isArray(enrollmentsResult.data)) {
        const hasEnrollments = enrollmentsResult.data.length > 0;
        recordTest('Enrollments table accessible', hasEnrollments);

        if (hasEnrollments) {
            const enrollment = enrollmentsResult.data[0];
            const hasSectionIdField = 'section_id' in enrollment;
            recordTest(
                'Enrollments table has section_id column',
                hasSectionIdField,
                hasSectionIdField ? '✓ Column exists' : '✗ Migration may not have run'
            );
        }
    }
}

// Test 7: Complete synchronization flow
async function testSyncFlow() {
    testHeader('Test 7: Complete Sync Flow Simulation');

    log('Simulating: Admin sets active school year → Student loads profile\n');

    // Step 1: Get active school year (as admin would set)
    info('Step 1: Checking active school year...');
    const schoolYearResult = await makeRequest('GET', '/api/school-years/active');
    
    if (!schoolYearResult.ok) {
        warn('No active school year set - admin should activate one first');
        recordTest('Step 1: Active school year fetch', false);
        return;
    }

    success(`Active school year: ${schoolYearResult.data.school_year}`);
    recordTest('Step 1: Active school year fetch', true);

    // Step 2: Get a student
    info('Step 2: Finding a student with assignment...');
    const enrollmentsResult = await makeRequest('GET', '/api/enrollments');
    
    if (!enrollmentsResult.ok || enrollmentsResult.data.length === 0) {
        warn('No enrollments found');
        return;
    }

    // Find an enrollment with section assignment
    const assignedEnrollment = enrollmentsResult.data.find(e => e.section_id);
    
    if (!assignedEnrollment) {
        warn('No students with section assignments - admin should assign one first');
        recordTest('Step 2: Find assigned student', false, 'No assignments found');
        return;
    }

    const studentId = assignedEnrollment.student_id || assignedEnrollment.id;
    success(`Found student ${studentId} assigned to section ${assignedEnrollment.section_id}`);
    recordTest('Step 2: Find assigned student', true);

    // Step 3: Get student enrollments (as student dashboard would)
    info('Step 3: Fetching student enrollments...');
    const studentEnrollmentsResult = await makeRequest('GET', `/api/enrollments/student/${studentId}`);
    
    if (!studentEnrollmentsResult.ok) {
        recordTest('Step 3: Student enrollments fetch', false);
        return;
    }

    const enrollmentWithSection = studentEnrollmentsResult.data.find(e => e.section_id);
    
    if (!enrollmentWithSection) {
        warn('Student has no section assignments');
        recordTest('Step 3: Get enrollment with section', false);
        return;
    }

    success(`Found enrollment ${enrollmentWithSection.id} with section ${enrollmentWithSection.section_id}`);
    recordTest('Step 3: Get enrollment with section', true);

    // Step 4: Get section details (as student dashboard would)
    info('Step 4: Fetching section details...');
    const sectionResult = await makeRequest('GET', `/api/sections/${enrollmentWithSection.section_id}`);
    
    if (!sectionResult.ok || !sectionResult.data) {
        recordTest('Step 4: Section details fetch', false);
        return;
    }

    success(`Section details: "${sectionResult.data.section_name}"`);
    recordTest('Step 4: Section details fetch', true);

    // Summary
    log(`\n${colors.green}${colors.bold}SYNC FLOW COMPLETE:${colors.reset}`);
    info(`Student Profile would display:`);
    info(`  School Year: ${schoolYearResult.data.school_year}`);
    info(`  Section: ${sectionResult.data.section_name} (${sectionResult.data.section_code || 'N/A'})`);
}

// Run all tests
async function runAllTests() {
    log(`${colors.bold}${colors.blue}╔════════════════════════════════════════════════════════════╗${colors.reset}`);
    log(`${colors.bold}${colors.blue}║  Student Profile Admin Sync - Integration Test Suite  ║${colors.reset}`);
    log(`${colors.bold}${colors.blue}╚════════════════════════════════════════════════════════════╝${colors.reset}`);

    info(`API Base: ${API_BASE}\n`);

    await testAPIConnectivity();
    await testActiveSchoolYear();
    await testStudentEnrollments();
    await testSectionsEndpoint();
    await testSectionWithStudents();
    await testDatabaseSchema();
    await testSyncFlow();

    // Summary Report
    testHeader('Test Summary Report');
    
    const total = testResults.passed + testResults.failed;
    const percentage = total > 0 ? ((testResults.passed / total) * 100).toFixed(1) : 0;

    log(`Total Tests: ${total}`);
    log(`${colors.green}Passed: ${testResults.passed}${colors.reset}`);
    log(`${colors.red}Failed: ${testResults.failed}${colors.reset}`);
    log(`Success Rate: ${colors.bold}${percentage}%${colors.reset}\n`);

    if (testResults.failed === 0) {
        log(`${colors.green}${colors.bold}🎉 ALL TESTS PASSED! 🎉${colors.reset}`);
        log('The Student Profile Admin Sync implementation is working correctly!\n');
    } else {
        log(`${colors.yellow}${colors.bold}⚠️  Some tests failed. See details above.${colors.reset}\n`);
    }

    return testResults.failed === 0 ? 0 : 1;
}

// Handle command line execution
if (require.main === module) {
    runAllTests().then(exitCode => {
        process.exit(exitCode);
    }).catch(err => {
        error('Unexpected error during test execution:');
        console.error(err);
        process.exit(1);
    });
}

module.exports = { runAllTests, testResults };

