// Test enrollment edit modal functionality
console.log('=== Testing Enrollment Edit Modal ===');

// Mock DOM elements
global.document = {
    getElementById: (id) => {
        const elements = {
            enrollmentEditModal: { 
                style: { display: 'none' },
                classList: { 
                    add: function(cls) { 
                        console.log(`Adding class ${cls} to enrollmentEditModal`);
                        this.active = true;
                    },
                    remove: function(cls) { 
                        console.log(`Removing class ${cls} from enrollmentEditModal`);
                        this.active = false;
                    },
                    contains: function(cls) { return this.active; }
                }
            },
            enrollmentEditForm: { 
                reset: () => console.log('Resetting enrollment edit form')
            }
        };
        return elements[id] || null;
    }
};

// Mock enrollment data
const mockEnrollment = {
    id: 'test-123',
    last_name: 'Test',
    first_name: 'Student',
    email: 'test@example.com',
    grade_level: '10',
    status: 'Active'
};

// Load the openEnrollmentEditModal function
const fs = require('fs');
const studentDashboardCode = fs.readFileSync('./student-dashboard.js', 'utf8');

// Extract the function
const funcMatch = studentDashboardCode.match(/function openEnrollmentEditModal\(enrollment\)\s*{[^}]*}/s);
if (funcMatch) {
    eval(funcMatch[0]);
    
    // Test the function
    console.log('\n--- Testing openEnrollmentEditModal ---');
    openEnrollmentEditModal(mockEnrollment);
    
    const modal = global.document.getElementById('enrollmentEditModal');
    console.log('Modal display style:', modal.style.display);
    console.log('Modal has active class:', modal.classList.contains('active'));
    
    if (modal.style.display === 'flex' && modal.classList.contains('active')) {
        console.log('✅ Modal should be visible and working!');
    } else {
        console.log('❌ Modal did not open properly');
    }
    
} else {
    console.log('❌ Could not find openEnrollmentEditModal function');
}

console.log('\n=== Test Complete ===');

