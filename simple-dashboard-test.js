// Simple test for dashboard core functionality
const http = require('http');
const fs = require('fs');

// Mock browser environment
global.window = {
    location: {
        search: '?school=default-school',
        hash: '#subject-teacher-dashboard'
    },
    localStorage: {
        getItem: (key) => {
            if (key === 'loggedInUser') {
                return JSON.stringify({
                    id: 12,
                    name: "HUHUIG",
                    email: "icil@gmail.com",
                    role: "subject_teacher"
                });
            }
            return null;
        }
    },
    sessionStorage: {
        getItem: (key) => {
            if (key === 'teacherData') {
                return JSON.stringify({
                    id: 12,
                    name: "HUHUIG",
                    email: "icil@gmail.com",
                    role: "subject_teacher"
                });
            }
            return null;
        }
    }
};

global.document = {
    getElementById: (id) => {
        const elements = {
            teacherNameDisplay: { textContent: 'Loading...' },
            schoolYearDisplay: { textContent: 'Loading...' },
            subjectsCountDisplay: { textContent: '0' },
            studentsCountDisplay: { textContent: '0' }
        };
        return elements[id] || null;
    }
};

// Simple fetch implementation
global.fetch = async (url, options = {}) => {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url, 'http://localhost:3001');
        const path = urlObj.pathname + urlObj.search;
        
        const reqOptions = {
            hostname: 'localhost',
            port: 3001,
            path: path,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': options.headers?.['Cookie'] || '',
                ...options.headers
            }
        };

        const req = http.request(reqOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    json: async () => JSON.parse(data),
                    text: async () => data,
                    headers: {
                        get: (name) => res.headers[name.toLowerCase()]
                    }
                });
            });
        });

        req.on('error', reject);
        req.end();
    });
};

// Extract and test only the core functions
const dashboardCode = fs.readFileSync('./subject-teacher-dashboard.js', 'utf8');

// Extract just the functions we need
const functions = [
    'resolveSchoolCode',
    'tenantFetch', 
    'fetchDashboardData',
    'populateDashboardCards'
];

functions.forEach(funcName => {
    const regex = new RegExp(`(?:async\\s+)?function\\s+${funcName}\\s*\\([^)]*\\)\\s*{[^}]*}`, 'gs');
    const matches = dashboardCode.match(regex);
    if (matches && matches[0]) {
        eval(matches[0]);
        console.log(`✅ Loaded function: ${funcName}`);
    } else {
        console.log(`❌ Function not found: ${funcName}`);
    }
});

// Test the functions
async function runTest() {
    try {
        console.log('\n=== Testing Dashboard Functions ===');
        
        // Test resolveSchoolCode
        const schoolCode = resolveSchoolCode();
        console.log('School code:', schoolCode);
        
        // Test fetchDashboardData
        console.log('\n--- Testing fetchDashboardData ---');
        await fetchDashboardData();
        
        console.log('\n--- Results ---');
        console.log('Current teacher exists:', !!global.currentTeacher);
        console.log('Teacher name:', global.currentTeacher?.name || 'Not loaded');
        console.log('Teaching assignments:', global.teachingAssignments?.length || 0);
        console.log('All students:', global.allStudents?.length || 0);
        
        // Test populateDashboardCards
        console.log('\n--- Testing populateDashboardCards ---');
        await populateDashboardCards();
        
        console.log('\n✅ Test completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

runTest();

