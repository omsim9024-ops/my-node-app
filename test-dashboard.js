// Simulate the dashboard environment
global.window = {
    location: {
        search: '?school=default-school',
        hash: '#subject-teacher-dashboard',
        href: 'http://localhost:3001/subject-teacher-dashboard.html?school=default-school#subject-teacher-dashboard'
    },
    localStorage: {
        getItem: (key) => {
            // Simulate logged in teacher
            if (key === 'loggedInUser') {
                return JSON.stringify({
                    id: 12,
                    teacher_id: "8742368",
                    name: "HUHUIG",
                    email: "icil@gmail.com",
                    role: "subject_teacher"
                });
            }
            return null;
        },
        setItem: () => {},
        removeItem: () => {}
    },
    sessionStorage: {
        getItem: (key) => {
            // Simulate logged in teacher
            if (key === 'teacherData') {
                return JSON.stringify({
                    id: 12,
                    teacher_id: "8742368",
                    name: "HUHUIG",
                    email: "icil@gmail.com",
                    role: "subject_teacher"
                });
            }
            return null;
        },
        setItem: () => {},
        removeItem: () => {}
    }
};

global.document = {
    getElementById: (id) => {
        const elements = {
            teacherNameDisplay: { textContent: 'Loading...' },
            schoolYearDisplay: { textContent: 'Loading...' },
            subjectsCountDisplay: { textContent: '0' },
            studentsCountDisplay: { textContent: '0' },
            teacherRoleDisplay: { textContent: 'Subject Teacher' }
        };
        return elements[id] || null;
    },
    createElement: (tag) => ({
        id: '',
        className: '',
        style: { cssText: '' },
        textContent: '',
        innerHTML: '',
        appendChild: () => {},
        setAttribute: () => {},
        addEventListener: () => {}
    }),
    querySelector: () => null,
    body: { appendChild: () => {} }
};

global.console = console;
global.fetch = require('node-fetch');

// Load the dashboard functions
const fs = require('fs');
const dashboardCode = fs.readFileSync('./subject-teacher-dashboard.js', 'utf8');

// Remove DOM-specific code and create a testable version
const testableCode = dashboardCode
    .replace(/document\.addEventListener\([^}]+\}\);/g, '') // Remove DOM listeners
    .replace(/window\./g, 'global.window.'); // Replace window with global.window

eval(testableCode);

async function testDashboard() {
    try {
        console.log('=== Testing Dashboard Data Loading ===');
        
        // Test fetchDashboardData
        await fetchDashboardData();
        
        console.log('\n=== Results ===');
        console.log('Current Teacher:', currentTeacher);
        console.log('Teaching Assignments:', teachingAssignments.length, 'items');
        console.log('All Students:', allStudents.length, 'items');
        
        if (currentTeacher && currentTeacher.name) {
            console.log('✅ Teacher data loaded successfully');
        } else {
            console.log('❌ Teacher data failed to load');
        }
        
        if (allStudents && allStudents.length > 0) {
            console.log('✅ Students data loaded successfully');
            console.log('Sample student:', allStudents[0]);
        } else {
            console.log('❌ Students data failed to load');
        }
        
        // Test populateDashboardCards
        console.log('\n=== Testing Dashboard Cards ===');
        await populateDashboardCards();
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testDashboard();

