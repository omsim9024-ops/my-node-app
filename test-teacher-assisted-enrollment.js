// Test teacher-assisted enrollment functionality
console.log('Testing Teacher-Assisted Enrollment...');

// Mock URL with teacher-assisted parameter
global.window = {
    location: {
        search: '?school=default-school&teacher-assisted=true',
        origin: 'http://localhost:3001'
    }
};

// Load enrollment form functions
const fs = require('fs');
const enrollmentCode = fs.readFileSync('./enrollment-form.js', 'utf8');

// Extract and test the relevant functions
const functions = [
    'getEnrollmentAssistContext',
    'isTeacherAssistedEnrollment',
    'applyTeacherAssistedUiMode'
];

functions.forEach(funcName => {
    const regex = new RegExp(`(?:async\\s+)?function\\s+${funcName}\\s*\\([^)]*\\)\\s*{[^}]*}`, 'gs');
    const matches = enrollmentCode.match(regex);
    if (matches && matches[0]) {
        eval(matches[0]);
        console.log(`✅ Loaded function: ${funcName}`);
    } else {
        console.log(`❌ Function not found: ${funcName}`);
    }
});

// Test the functionality
async function runTest() {
    try {
        console.log('\n=== Testing Teacher-Assisted Detection ===');
        
        // Test getEnrollmentAssistContext
        const context = getEnrollmentAssistContext();
        console.log('Context:', context);
        
        // Test isTeacherAssistedEnrollment
        const isAssisted = isTeacherAssistedEnrollment();
        console.log('Is teacher assisted:', isAssisted);
        
        // Mock DOM element
        global.document = {
            getElementById: (id) => {
                if (id === 'teacherAssistedBadge') {
                    return { style: { display: 'none' } };
                }
                return null;
            }
        };
        
        // Test applyTeacherAssistedUiMode
        applyTeacherAssistedUiMode();
        
        const badge = global.document.getElementById('teacherAssistedBadge');
        console.log('Badge display style:', badge ? badge.style.display : 'Badge not found');
        
        if (context.teacherAssisted === true && isAssisted === true) {
            console.log('✅ Teacher-assisted parameter detected correctly!');
        } else {
            console.log('❌ Teacher-assisted parameter not detected');
        }
        
        console.log('\n✅ Teacher-Assisted Enrollment test completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

runTest();

