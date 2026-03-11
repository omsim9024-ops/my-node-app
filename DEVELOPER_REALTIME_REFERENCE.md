# Developer Reference: Real-Time Update System

## Introduction

This document provides technical guidance for developers extending the real-time update system to other dashboard features beyond student electives and section assignment.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│          DASHBOARD FEATURE (Any Module)                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │ Event Listeners                                 │  │
│  │ ├─ window.DashboardEvents.on('event_type', ...) │  │
│  │ └─ Reacts to changes in real-time              │  │
│  └────────────┬────────────────────────────────────┘  │
│               │                                        │
│               │ Listens to broadcasts                 │
│               ↓                                        │
│  ┌─────────────────────────────────────────────────┐  │
│  │ DashboardRealtimeUtils (DOM Updates)             │  │
│  │ ├─ updateStudentInUI()                           │  │
│  │ ├─ removeStudentFromUI()                         │  │
│  │ ├─ refreshTableSection()                         │  │
│  │ └─ highlightElement()                            │  │
│  └────────────┬────────────────────────────────────┘  │
│               │                                        │
│               │ Updates DOM elements                  │
│               ↓                                        │
│  ┌─────────────────────────────────────────────────┐  │
│  │ UI Updates (No Page Reload)                      │  │
│  │ ├─ Tables refresh                               │  │
│  │ ├─ Counts update                                │  │
│  │ ├─ Lists rearrange                              │  │
│  │ └─ Animations play                              │  │
│  └─────────────────────────────────────────────────┘  │
│                                                        │
└─────────────────────────────────────────────────────────┘
         ↑
         │ Broadcasts events
         │
┌─────────────────────────────────────────────────────────┐
│     DATA CHANGE (Save Function in Modal)                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. User makes changes in modal                         │
│  2. Clicks approve/save                                 │
│  3. Sends data to server                                │
│  4. Server responds success                             │
│  5. Detect what changed                                 │
│  6. Emit events via DashboardEvents.broadcast()         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Implementation Patterns

### Pattern 1: Add Event Listener to Existing Module

**File:** Any module that needs to react to changes

**Location:** Module initialization or setup section

```javascript
// In module's initialization
function setupMyModuleRealtimeUpdates() {
    console.log('[MyModule] Setting up real-time listeners');
    
    if (window.DashboardEvents) {
        // Listen for specific event
        window.DashboardEvents.on('student_section_cleared', (eventData) => {
            console.log('[MyModule] Student section cleared:', eventData);
            
            // Your custom logic
            const studentId = eventData.student_id;
            // ... do something with this ...
            
            // Update your UI
            refreshYourTable();
        });
    }
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupMyModuleRealtimeUpdates);
} else {
    setupMyModuleRealtimeUpdates();
}
```

### Pattern 2: Emit Event from Save Function

**File:** Any save/update function

**Location:** After successful server response

```javascript
async function saveMyData(updates, itemId) {
    try {
        // Send to server
        const response = await fetch('/api/my-endpoint', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        
        if (!response.ok) throw new Error('Save failed');
        
        const result = await response.json();
        
        // ===== EMIT REAL-TIME EVENTS =====
        // Notify all modules of the change
        try {
            window.DashboardEvents?.broadcast('my_data_updated', {
                item_id: itemId,
                changed_fields: Object.keys(updates),
                old_values: { /* what changed */ },
                new_values: { /* what changed to */ },
                timestamp: Date.now(),
                reason: 'admin_edit'  // or 'api_sync', 'import', etc.
            });
            
            console.log('[MyModule] Event broadcast successfully');
        } catch (e) {
            console.warn('[MyModule] Failed to broadcast event:', e);
            // Non-critical failure, save was successful
        }
        
        // Show success
        showNotification('Saved successfully', 'success');
        return result;
    
    } catch (err) {
        console.error('[MyModule] Save failed:', err);
        showNotification('Save failed: ' + err.message, 'error');
        throw err;
    }
}
```

### Pattern 3: Custom DOM Update for Complex Cases

**File:** Your module

**Location:** In event listener

```javascript
window.DashboardEvents.on('my_data_updated', (eventData) => {
    const { item_id, changed_fields } = eventData;
    
    // Case 1: Simple field update
    if (changed_fields.includes('name')) {
        window.DashboardRealtimeUtils.updateStudentInUI(item_id, {
            name: eventData.new_values.name
        });
        return;
    }
    
    // Case 2: Remove item from list
    if (changed_fields.includes('status') && eventData.new_values.status === 'archived') {
        window.DashboardRealtimeUtils.removeStudentFromUI(item_id);
        return;
    }
    
    // Case 3: Complex update - custom logic
    if (changed_fields.includes('complex_field')) {
        const element = document.querySelector(`[data-item-id="${item_id}"]`);
        if (element) {
            // Custom DOM manipulation
            const newValue = eventData.new_values.complex_field;
            element.querySelector('.complex-display').innerHTML = formatComplexValue(newValue);
            
            // Highlight the element
            window.DashboardRealtimeUtils.highlightElement(element);
        }
    }
});
```

---

## Common Integration Scenarios

### Scenario 1: Add Real-Time to Teacher Management

**Goal:** When teacher is assigned to sections, update Section Assignment list real-time

**Implementation:**

```javascript
// In teacher save function (admin-dashboard.js or similar)
async function saveTeacherAssignments(teacherId, assignments) {
    const response = await fetch(`/api/teachers/${teacherId}/assignments`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assignments)
    });
    
    if (!response.ok) throw new Error('Failed');
    
    // Emit event
    window.DashboardEvents?.broadcast('teacher_assigned', {
        teacher_id: teacherId,
        teacher_name: getTeacherName(teacherId),
        sections_assigned: assignments.sections,
        timestamp: Date.now()
    });
    
    showNotification('Teacher assigned to sections', 'success');
}

// In Section Assignment module listener
window.DashboardEvents.on('teacher_assigned', (eventData) => {
    console.log('[SectionAssignment] Teacher assigned:', eventData.teacher_name);
    
    // Update the teacher assignment table immediately
    const teacherRow = document.querySelector(`[data-teacher-id="${eventData.teacher_id}"]`);
    if (teacherRow) {
        // Highlight it
        window.DashboardRealtimeUtils.highlightElement(teacherRow);
        
        // Refresh the section view
        window.DashboardRealtimeUtils.refreshTableSection('sectionTable');
    }
});
```

### Scenario 2: Real-Time Enrollment Verification

**Goal:** When enrollment is approved/rejected, update the enrollment list real-time

**Implementation:**

```javascript
// In enrollment approval function
async function approveEnrollment(enrollmentId, reviewData) {
    const response = await fetch(`/api/enrollments/${enrollmentId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reviewData)
    });
    
    const result = await response.json();
    
    // Emit approval event
    window.DashboardEvents?.broadcast('enrollment_approved', {
        enrollment_id: enrollmentId,
        student_id: result.student_id,
        student_name: result.student_name,
        approved_at: result.created_at,
        timestamp: Date.now()
    });
    
    showNotification(`${result.student_name} enrollment approved!`, 'success');
}

// In Enrollment Reports listener
window.DashboardEvents.on('enrollment_approved', (eventData) => {
    console.log('[EnrollmentReports] Enrollment approved:', eventData.student_name);
    
    // Remove from pending list
    window.DashboardRealtimeUtils.removeStudentFromUI(eventData.enrollment_id);
    
    // Update counts
    window.DashboardRealtimeUtils.updateDashboardStats({
        pendingEnrollments: getPendingCount() - 1,
        approvedEnrollments: getApprovedCount() + 1
    });
});
```

### Scenario 3: Real-Time Administrative Changes

**Goal:** When school year is set/changed, update all modules real-time

**Implementation:**

```javascript
// In school year management
async function setActiveSchoolYear(schoolYearId) {
    const response = await fetch(`/api/school-years/${schoolYearId}/activate`, {
        method: 'POST'
    });
    
    const result = await response.json();
    
    // Update global variable
    window.activeSchoolYearId = schoolYearId;
    window.activeSchoolYearLabel = result.label;
    
    // Broadcast change
    window.DashboardEvents?.broadcast('school_year_changed', {
        school_year_id: schoolYearId,
        school_year_label: result.label,
        start_year: result.start_year,
        end_year: result.end_year,
        timestamp: Date.now()
    });
    
    showNotification(`Active school year: ${result.label}`, 'success');
}

// In ALL modules that need this
window.DashboardEvents.on('school_year_changed', (eventData) => {
    console.log('[MyModule] School year changed:', eventData.school_year_label);
    
    // Update UI to show current school year
    const yearDisplay = document.querySelector('[data-school-year-display]');
    if (yearDisplay) {
        yearDisplay.textContent = eventData.school_year_label;
    }
    
    // Refresh all data for new school year
    if (typeof loadMyData === 'function') {
        loadMyData();
    }
});
```

---

## API Deep Dive

### DashboardEvents API

#### broadcast(eventType, data)
**Emits event to all listeners across tabs/windows**

```javascript
// Signature
broadcast(eventType: string, data: any): void

// Examples
window.DashboardEvents.broadcast('student_section_cleared', {
    student_id: 123,
    student_name: 'John Smith',
    reason: 'elective_change',
    timestamp: Date.now()
});

// With multiple listeners
// This single broadcast triggers:
// - Local listeners immediately
// - BroadcastChannel (other tabs/windows) instantly
// - localStorage fallback if needed
```

#### on(eventType, callback)
**Subscribe to event for this session**

```javascript
// Signature
on(eventType: string, callback: Function): void

// Callback receives event data as parameter
window.DashboardEvents.on('student_section_cleared', (eventData) => {
    console.log('Section cleared for student:', eventData.student_id);
    
    // Access all passed data
    const { student_id, student_name, reason, timestamp } = eventData;
});

// Multiple listeners work together
window.DashboardEvents.on('event_type', callback1);
window.DashboardEvents.on('event_type', callback2);
// Both callbacks execute when event fires
```

#### off(eventType, callback)
**Unsubscribe from event**

```javascript
// Signature
off(eventType: string, callback: Function): void

// Important: Use for cleanup to prevent memory leaks
const myCallback = (eventData) => {
    console.log('Event fired:', eventData);
};

// Subscribe
window.DashboardEvents.on('my_event', myCallback);

// Later, cleanup
window.DashboardEvents.off('my_event', myCallback);
```

#### emit(eventType, data)
**Emit to local listeners only (current page/tab)**

```javascript
// Signature
emit(eventType: string, data: any): void

// Use when you don't need cross-tab communication
window.DashboardEvents.emit('internal_event', {
    localData: 'only this tab sees it'
});

// Useful for internal state changes that don't need sync
```

---

### DashboardRealtimeUtils API

#### updateStudentInUI(studentId, updates)
**Update specific fields in all matching student rows**

```javascript
// Signature
updateStudentInUI(studentId: number|string, updates: object): boolean
// Returns: true if updated, false if not found

// Finds all elements with data-student-id attribute and updates visible fields
window.DashboardRealtimeUtils.updateStudentInUI(123, {
    name: "New Name",
    section: "Grade 11-A",
    track: "Academic",
    electives: ["Course1", "Course2"],
    section_id: null,  // Sets data attribute
    custom_field: "value"  // Also updates DOM
});

// Updates these default fields:
// - [data-field="name"] or .student-name
// - [data-field="section"] or .student-section
// - [data-field="track"] or .student-track
// - [data-field="electives"] or .student-electives
// - Also sets data-section-id attribute
```

#### removeStudentFromUI(studentId)
**Remove student row with fade animation**

```javascript
// Signature
removeStudentFromUI(studentId: number|string): number
// Returns: count of removed elements

const removed = window.DashboardRealtimeUtils.removeStudentFromUI(123);
console.log(`Removed ${removed} element(s)`);

// Animation:
// 1. Opacity fades to 0.5
// 2. Waits 300ms
// 3. Element removed from DOM
```

#### refreshTableSection(sectionId)
**Trigger refresh of specific table/section**

```javascript
// Signature
refreshTableSection(sectionId: string): boolean
// Returns: true if refresh triggered, false if handler not found

// Auto-detects type based on section ID
window.DashboardRealtimeUtils.refreshTableSection('studentTableContainer');
// Looks for renderStudentTable() function

window.DashboardRealtimeUtils.refreshTableSection('sectionAssignment');
// Looks for displayStudentList() function

window.DashboardRealtimeUtils.refreshTableSection('enrollmentReport');
// Looks for loadEnrollments() function
```

#### updateDashboardStats(stats)
**Update statistics in real-time with flash effect**

```javascript
// Signature
updateDashboardStats(stats: object): void

window.DashboardRealtimeUtils.updateDashboardStats({
    totalStudents: 450,
    enrolledStudents: 425,
    unassignedStudents: 25,
    totalSections: 18
});

// Finds and updates:
// - #statsStudents or [data-stat="students"]
// - #statsEnrolled or [data-stat="enrolled"]
// - #statsUnassigned or [data-stat="unassigned"]
// - #statsSections or [data-stat="sections"]

// Flash animation plays on update
```

#### highlightElement(element)
**Flash visual highlight on element**

```javascript
// Signature
highlightElement(element: HTMLElement): void

const newRow = document.querySelector('[data-student-id="123"]');
window.DashboardRealtimeUtils.highlightElement(newRow);

// Animation:
// 1. Background color changes to #fff3cd (light yellow)
// 2. Smooth transition over 0.5s
// 3. Returns to transparent after 1s
```

#### batchUpdateStudents(updates)
**Update multiple students at once**

```javascript
// Signature
batchUpdateStudents(updates: array): number
// Returns: count of updated students

window.DashboardRealtimeUtils.batchUpdateStudents([
    {
        id: 123,
        changes: {
            name: "John Smith",
            section: "Grade 11-A"
        }
    },
    {
        id: 124,
        changes: {
            name: "Jane Doe",
            section: "Grade 11-B"
        }
    },
    {
        id: 125,
        changes: {
            name: "Bob Johnson",
            section: null  // unassigned
        }
    }
]);
// Returns: 3 (all updated)
```

---

## Event Naming Convention

Events should follow a clear naming pattern:

```javascript
// Pattern: [entity]_[action]
// Examples:

// Student events
'student_updated'           // Any student field changed
'student_section_cleared'   // Section cleared for student
'student_enrolled'          // New student enrolled
'student_archived'          // Student archived
'student_electives_changed' // Specific field change

// Teacher events
'teacher_assigned'          // Teacher assigned to sections
'teacher_updated'           // Teacher info changed
'teacher_removed'           // Teacher removed

// Enrollment events
'enrollment_approved'       // Enrollment approved
'enrollment_rejected'       // Enrollment rejected
'enrollment_created'        // New enrollment

// System events
'school_year_changed'       // Active school year changed
'section_created'           // New section created
'sync_complete'             // Data sync complete

// Rule: Use snake_case, specific but not overly verbose
```

---

## Error Handling

### Safe Broadcasting

```javascript
// Always wrap broadcasts in try-catch
try {
    window.DashboardEvents?.broadcast('event_type', data);
} catch (e) {
    console.error('[MyModule] Event broadcast failed:', e);
    // Non-critical failure - don't break the user flow
}

// Why?
// - Prevents one module's error from breaking others
// - Allows graceful degradation
// - User still sees success message even if real-time fails
```

### Safe Listener Definition

```javascript
// Always check if DashboardEvents exists
if (window.DashboardEvents) {
    window.DashboardEvents.on('event_type', (eventData) => {
        try {
            // Your logic here
        } catch (e) {
            console.error('[MyModule] Listener error:', e);
            // Listener failures shouldn't crash notifications
        }
    });
}

// Why?
// - System may not be initialized yet on some pages
// - Listener function might have bugs
// - Error in one listener shouldn't affect others
```

---

## Performance Optimization

### Debounce Rapid Updates

```javascript
// If you're emitting events rapidly
let debounceTimer;

function emitStudentUpdate(studentId, changes) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        window.DashboardEvents?.broadcast('student_updated', {
            student_id: studentId,
            changes: changes,
            timestamp: Date.now()
        });
    }, 300);  // Wait 300ms before broadcasting
}

// Prevents event spam when making multiple rapid saves
```

### Throttle Listener Execution

```javascript
// If listener performs expensive operation
let throttleTimeout;
const throttleDelay = 1000;  // 1 second

window.DashboardEvents.on('expensive_event', (eventData) => {
    if (throttleTimeout) return;  // Skip if recently executed
    
    // Do expensive operation
    expensiveFunction(eventData);
    
    // Prevent next execution for throttleDelay
    throttleTimeout = setTimeout(() => {
        throttleTimeout = null;
    }, throttleDelay);
});
```

### Batch DOM Updates

```javascript
// Instead of updating each student individually
// Collect all updates and apply together
const updates = [];
for (let i = 0; i < 50; i++) {
    updates.push({
        id: students[i].id,
        changes: { section: null }
    });
}

// Apply all at once
window.DashboardRealtimeUtils.batchUpdateStudents(updates);

// More efficient than 50 individual updates
```

---

## Testing Real-Time Updates

### Manual Testing

```javascript
// Test broadcasting
window.DashboardEvents.broadcast('test_event', {
    message: 'Hello from real-time',
    timestamp: Date.now()
});

// Check console for: [DashboardEvents] Emitting event: "test_event"

// Listen for test events
window.DashboardEvents.on('test_event', (data) => {
    console.log('Received test event:', data);
});

// Broadcast again, should see listener log
```

### Debug Event Listeners

```javascript
// Check registered listeners
console.log(window.DashboardEvents.listeners);
// Shows all subscribed events and callback count

// Filter for specific event
const studentUpdateListeners = window.DashboardEvents.listeners['student_updated'];
console.log('Listeners for student_updated:', studentUpdateListeners.length);
```

### Monitor Cross-Tab Sync

```javascript
// Open two tabs of the same page
// In console of Tab 1:
window.DashboardEvents.broadcast('test_cross_tab', { from: 'tab1' });

// In Tab 2, register listener first:
window.DashboardEvents.on('test_cross_tab', (data) => {
    console.log('Received from other tab:', data);
});

// In Tab 1 again:
window.DashboardEvents.broadcast('test_cross_tab', { from: 'tab1_again' });

// Should see message in Tab 2
```

---

## Migration Guide: Adding Real-Time to Existing Features

### Step 1: Identify Change Points
```
Find all functions that:
├─ Save data to server
├─ Update student/teacher/enrollment records
├─ Delete items
└─ Modify status/assignments
```

### Step 2: Add Event Emission
```javascript
// After successful save, add:
window.DashboardEvents?.broadcast('appropriate_event', {
    item_id: id,
    changed_fields: ['field1', 'field2'],
    timestamp: Date.now()
});
```

### Step 3: Register Listeners
```javascript
// In modules that should react, add:
window.DashboardEvents.on('appropriate_event', (data) => {
    // Update your UI
    refreshYourTable();
});
```

### Step 4: Test
```
- Edit record in one module
- Verify automatic update in related modules
- Check multiple tabs sync correctly
- Monitor performance
```

---

## Best Practices

### ✅ DO

- Emit specific, semantically meaningful events
- Use consistent event naming (snake_case)
- Always include timestamp in event data
- Keep event payloads small (< 5KB typical)
- Unsubscribe from events when module destroyed
- Handle errors in both emit and listen
- Test cross-tab communication
- Document events your module emits/consumes

### ❌ DON'T

- Create too many event types (consolidate when possible)
- Emit very frequently (> 10x per second)
- Include unnecessary data in event payload
- Forget to check if DashboardEvents exists
- Assume UI elements always exist when updating
- Block event listeners with long operations (use async/await)
- Create memory leaks with uncleared listeners
- Use synchronous operations in listeners

---

## Debugging Checklist

When real-time updates not working:

- [ ] Check browser console for errors
- [ ] Verify DashboardEvents is initialized (search for "[DashboardEvents] ...")
- [ ] Confirm event is being broadcast (add console log)
- [ ] Verify listener is registered (check `.listeners` object)
- [ ] Confirm listener function is being called
- [ ] Check localStorage/BroadcastChannel support (DevTools)
- [ ] Test with hard refresh (Ctrl+Shift+R)
- [ ] Check if feature was broken before real-time added

---

## Summary

The real-time update system provides:
- **Event-driven architecture** for loose coupling
- **DOM utilities** for efficient updates
- **Cross-tab sync** for consistency
- **Extensible design** for new features
- **Performance optimized** for quick responses
- **Error resilient** from individual failures

Use it to transform any dashboard feature into a real-time, synchronized experience!


