// Diagnostic Test for Real-Time Section Assignment
// Run this in browser console to debug real-time updates

console.clear();
console.log("=== REAL-TIME UPDATE DIAGNOSTIC TEST ===\n");

// Test 1: Check if DashboardEvents exists
console.log("TEST 1: DashboardEvents System");
console.log("  DashboardEvents exists?", typeof window.DashboardEvents !== 'undefined');
if (window.DashboardEvents) {
    console.log("  - Listeners:", window.DashboardEvents.listeners);
    console.log("  - BroadcastChannel available?", window.DashboardEvents.broadcastChannel !== null);
}

// Test 2: Check if Section Assignment module is loaded
console.log("\nTEST 2: Section Assignment Module");
console.log("  assignmentState exists?", typeof assignmentState !== 'undefined');
if (typeof assignmentState !== 'undefined') {
    console.log("  - currentLevel:", assignmentState.currentLevel);
    console.log("  - Total unassigned students:", assignmentState.allStudents?.length || 0);
    console.log("  - Filtered students:", assignmentState.filteredStudents?.length || 0);
    console.log("  - loadAllStudents_Fresh exists?", typeof loadAllStudents_Fresh === 'function');
    console.log("  - applyFilters exists?", typeof applyFilters === 'function');
}

// Test 3: Manually trigger a test event
console.log("\nTEST 3: Manual Event Broadcast");
console.log("  Triggering test event...");

const testSuccess = (data) => {
    console.log("  ✅ Event received successfully:", data);
};

if (window.DashboardEvents) {
    window.DashboardEvents.on('__test_event__', testSuccess);
    window.DashboardEvents?.broadcast('__test_event__', { 
        test: 'message',
        timestamp: Date.now()
    });
    
    setTimeout(() => {
        console.log("  (Allow 100ms for BroadcastChannel propagation)");
    }, 100);
}

// Test 4: Check for listener registration
console.log("\nTEST 4: Listener Registration");
if (window.DashboardEvents) {
    const listeners = window.DashboardEvents.listeners;
    console.log("  Registered listeners:");
    Object.keys(listeners).forEach(event => {
        console.log(`    - ${event}: ${listeners[event].length} listener(s)`);
    });
}

// Test 5: Simulate a student_section_cleared event
console.log("\nTEST 5: Simulate student_section_cleared Event");
console.log("  Creating test student object...");

const testStudentId = 999;
const testStudent = {
    student_id: testStudentId,
    student_name: "TEST STUDENT - DO NOT ASSIGN"
};

console.log("  Test student:", testStudent);
console.log("  Broadcasting student_section_cleared event...");

if (window.DashboardEvents) {
    window.DashboardEvents?.broadcast('student_section_cleared', {
        student_id: testStudentId,
        student_name: "TEST STUDENT - DO NOT ASSIGN",
        reason: "diagnostic_test",
        timestamp: Date.now()
    });
    
    console.log("  Event broadcast sent. Check Section Assignment logs below for confirmation...");
}

// Test 6: Check API connectivity
console.log("\nTEST 6: API Connectivity Test");
console.log("  Testing GET /api/enrollments...");

fetch('/api/enrollments')
    .then(res => {
        console.log(`  ✅ API responds with status ${res.status}`);
        return res.json();
    })
    .then(data => {
        console.log(`  ✅ API returns ${Array.isArray(data) ? data.length : 'data'} enrollments`);
        // Show first few students
        if (Array.isArray(data) && data.length > 0) {
            console.log("  First enrollment sample:");
            const first = data[0];
            console.log(`    - student_id: ${first.student_id}`);
            console.log(`    - section_id: ${first.section_id}`);
            console.log(`    - class_id: ${first.class_id}`);
        }
    })
    .catch(err => {
        console.error(`  ❌ API Error: ${err.message}`);
    });

// Test 7: Check console for errors
console.log("\nTEST 7: Check Browser Console");
console.log("  Look for these patterns:");
console.log("    ✅ [DashboardEvents] - Event system logs");
console.log("    ✅ [Section Assignment] - Section module logs");
console.log("    ✅ [Students] - Student directory logs");
console.log("    ❌ Any red error messages");

console.log("\n=== DIAGNOSTIC COMPLETE ===");
console.log("NEXT STEPS:");
console.log("1. Check console for any red errors");
console.log("2. Look for [Section Assignment] and [Students] log patterns");
console.log("3. Verify allStudents and filteredStudents have data");
console.log("4. Test editing a student and checking console logs");
console.log("5. Review REALTIME_SECTION_ASSIGNMENT_FIX.md for detailed debugging");


