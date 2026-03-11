// Test the dashboard fix
console.log('Testing dashboard functions...');

// Test the applyTeacherInfoToDom function
const mockTeacher = {
    id: 12,
    name: "EDWARD LONGAQUIT",
    email: "edward@example.com",
    teacher_id: "123456",
    role: "subject_teacher"
};

// Mock DOM elements
global.document = {
    getElementById: (id) => {
        const elements = {
            teacherNameDisplay: { textContent: '' },
            teacherRoleDisplay: { textContent: '' },
            teacherProfileName: { textContent: '' },
            settingsName: { value: '' },
            settingsEmail: { value: '' },
            settingsEmployeeId: { value: '' }
        };
        return elements[id] || null;
    }
};

global.currentTeacher = mockTeacher;

// Load the applyTeacherInfoToDom function
const fs = require('fs');
const dashboardCode = fs.readFileSync('./subject-teacher-dashboard.js', 'utf8');

// Extract the applyTeacherInfoToDom function
const funcMatch = dashboardCode.match(/function applyTeacherInfoToDom\(\)\s*{[^}]*}/s);
if (funcMatch) {
    eval(funcMatch[0]);
    
    // Test the function
    applyTeacherInfoToDom();
    
    console.log('✅ applyTeacherInfoToDom function loaded and executed successfully');
    console.log('Teacher name display:', global.document.getElementById('teacherNameDisplay').textContent);
    console.log('Teacher role display:', global.document.getElementById('teacherRoleDisplay').textContent);
    console.log('Profile name display:', global.document.getElementById('teacherProfileName').textContent);
} else {
    console.log('❌ Could not find applyTeacherInfoToDom function');
}

console.log('Dashboard fix test completed!');

