# Real-Time Update System - Quick Start Guide

## 🚀 For Developers: Get Started in 5 Minutes

This guide shows you how to use and extend the real-time update system without reading all the documentation.

---

## The 30-Second Version

The dashboard now has a **real-time event system** that:
1. Detects when data changes (via your save function)
2. Broadcasts events to all modules instantly
3. Modules listen and update their UI automatically
4. **No page reloads needed**

**All built in. Just use it.**

---

## Using Existing Real-Time Features

### Listen to Student Updates

```javascript
// In your module initialization:
window.DashboardEvents.on('student_section_cleared', (eventData) => {
    console.log('Student needs reassignment:', eventData.student_name);
    // Update your UI here
    myModule.refreshStudentList();
});
```

### Listen to General Student Changes

```javascript
window.DashboardEvents.on('student_updated', (eventData) => {
    if (eventData.section_cleared) {
        console.log('Section was cleared');
    }
    if (eventData.elective_changed) {
        console.log('Electives changed');
    }
    // React to changes
});
```

### Update UI When Event Fires

```javascript
window.DashboardEvents.on('student_section_cleared', (eventData) => {
    const studentId = eventData.student_id;
    
    // Option 1: Update specific fields
    window.DashboardRealtimeUtils.updateStudentInUI(studentId, {
        section_id: null,
        section_name: 'Unassigned'
    });
    
    // Option 2: Remove from table
    window.DashboardRealtimeUtils.removeStudentFromUI(studentId);
    
    // Option 3: Refresh your table
    myTable.refresh();
});
```

---

## Creating Real-Time Events in Your Feature

### Step 1: Add Event Broadcast

In your save function, after server responds with success:

```javascript
// YOUR_SAVE_FUNCTION
async function saveMyFeature(data) {
    try {
        const response = await fetch('/api/endpoint', {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            // ✅ ADD THIS: Broadcast your change
            window.DashboardEvents?.broadcast('my_feature_changed', {
                item_id: data.id,
                item_name: data.name,
                change_type: 'update',
                timestamp: Date.now()
            });
            
            showNotification('Saved successfully!', 'success');
        }
    } catch (error) {
        showNotification('Error saving', 'error');
    }
}
```

### Step 2: Listen in Other Modules

In modules that need to react to your change:

```javascript
// MODULE_THAT_NEEDS_UPDATE.js
function initializeRealtimeListeners() {
    window.DashboardEvents.on('my_feature_changed', (eventData) => {
        console.log('Detected change:', eventData);
        
        // Update your UI
        if (eventData.change_type === 'update') {
            refreshMyTable();
        }
    });
}

// Call this on page load
document.addEventListener('DOMContentLoaded', initializeRealtimeListeners);
```

### Step 3: Done! ✅

Users will see changes instantly across all modules. No page reload needed.

---

## Common Patterns

### Pattern 1: Refresh Table When Something Changes

```javascript
window.DashboardEvents.on('enrollment_approved', (eventData) => {
    // Refresh the enrollment table
    refreshEnrollmentTable();
});
```

### Pattern 2: Update Specific Row

```javascript
window.DashboardEvents.on('student_updated', (eventData) => {
    // Update just that student's row
    window.DashboardRealtimeUtils.updateStudentInUI(eventData.student_id, {
        status: 'Updated',
        last_change: eventData.timestamp
    });
});
```

### Pattern 3: Update Counts/Statistics

```javascript
window.DashboardEvents.on('enrollment_status_changed', (eventData) => {
    // Update dashboard statistics
    window.DashboardRealtimeUtils.updateDashboardStats({
        // Pass whatever your stats are
        approved_count: newCount,
        pending_count: pendingCount
    });
});
```

### Pattern 4: Batch Updates

```javascript
window.DashboardEvents.on('bulk_operation_complete', (eventData) => {
    // Update multiple students at once
    window.DashboardRealtimeUtils.batchUpdateStudents([
        { student_id: 123, section: 'A' },
        { student_id: 124, section: 'B' },
        { student_id: 125, section: 'C' }
    ]);
});
```

---

## Event Payload Template

Use this template for consistent event data:

```javascript
window.DashboardEvents?.broadcast('event_name', {
    // Identifier for what changed
    item_id: 123,
    item_name: 'Name of item',
    
    // What changed and why
    change_type: 'update',  // 'create', 'update', 'delete'
    reason: 'manual_edit',   // 'elective_change', 'track_change', etc.
    
    // Extra data modules might need
    old_value: previousData,
    new_value: currentData,
    
    // Always include timestamp
    timestamp: Date.now()
});
```

---

## Available Utility Functions

### `updateStudentInUI(studentId, updates)`
Updates specific fields in student rows

```javascript
window.DashboardRealtimeUtils.updateStudentInUI(123, {
    section_id: 456,
    section_name: 'Section A',
    status: 'Assigned'
});
```

### `removeStudentFromUI(studentId)`
Removes student from tables with fade animation

```javascript
window.DashboardRealtimeUtils.removeStudentFromUI(123);
```

### `refreshTableSection(sectionId)`
Refreshes a specific section's table

```javascript
window.DashboardRealtimeUtils.refreshTableSection('section_assignment');
```

### `updateDashboardStats(stats)`
Updates statistics with flash effect

```javascript
window.DashboardRealtimeUtils.updateDashboardStats({
    total_students: 150,
    assigned: 120,
    unassigned: 30
});
```

### `highlightElement(element)`
Brief yellow flash on element

```javascript
const element = document.querySelector('[data-student-id="123"]');
window.DashboardRealtimeUtils.highlightElement(element);
```

### `batchUpdateStudents(updates)`
Update multiple students at once

```javascript
window.DashboardRealtimeUtils.batchUpdateStudents([
    { student_id: 123, section: 'A' },
    { student_id: 124, section: 'B' }
]);
```

---

## Debugging Your Real-Time Features

### See What Events Are Broadcasting

```javascript
// In console (F12):
// Look for these messages:
// [DashboardEvents] Emitting event: "student_section_cleared" {...}
// [DashboardEvents] Broadcasting via BroadcastChannel...
```

### Check If Your Listeners Are Registered

```javascript
// In console:
window.DashboardEvents.listeners;
// Shows all registered event listeners
```

### Test Event Manually

```javascript
// In console, manually trigger an event:
window.DashboardEvents.emit('student_section_cleared', {
    student_id: 123,
    student_name: 'Test Student',
    reason: 'test'
});
```

### Check Browser Compatibility

```javascript
// In console:
typeof BroadcastChannel !== 'undefined'  // true = modern browser
// If false, using localStorage fallback (slower but works)
```

---

## Real-World Examples

### Example 1: Teacher Assignment Feature

**File:** `admin-dashboard-teacher.js`

```javascript
async function assignTeacher(studentId, teacherId) {
    const response = await fetch('/api/assign-teacher', {
        method: 'POST',
        body: JSON.stringify({ student_id: studentId, teacher_id: teacherId })
    });
    
    if (response.ok) {
        // Broadcast the change
        window.DashboardEvents?.broadcast('teacher_assigned', {
            student_id: studentId,
            teacher_id: teacherId,
            timestamp: Date.now()
        });
        
        showNotification('Teacher assigned!');
    }
}

// Set up listeners in other modules
window.DashboardEvents.on('teacher_assigned', (eventData) => {
    console.log('Updating UI for teacher assignment...');
    refreshStudentTable();
});
```

### Example 2: Enrollment Approval Feature

**File:** `admin-dashboard-enrollment.js`

```javascript
async function approveEnrollment(enrollmentId) {
    const response = await fetch(`/api/enrollments/${enrollmentId}/approve`, {
        method: 'POST'
    });
    
    if (response.ok) {
        window.DashboardEvents?.broadcast('enrollment_approved', {
            enrollment_id: enrollmentId,
            timestamp: Date.now()
        });
    }
}

// Listen in reports module
window.DashboardEvents.on('enrollment_approved', (eventData) => {
    // Update counts
    updateEnrollmentCounts();
    // Refresh table
    refreshEnrollmentTable();
});
```

### Example 3: Multi-Tab Synchronization

```javascript
// Any change in one tab appears in other tabs automatically!

// Tab 1: Edit student electives
// → Broadcasts student_section_cleared event

// Tab 2: Section Assignment page
// → Event received automatically via BroadcastChannel
// → Student appears in unassigned list
// → No manual refresh needed

// Tab 3: Reports page  
// → Event received automatically
// → Statistics updated
// → All in sync
```

---

## Common Issues & Solutions

### "Nothing happens when I broadcast"

```javascript
// Check 1: Are listeners registered?
window.DashboardEvents.listeners;

// Check 2: Are you checking for null?
window.DashboardEvents?.broadcast(...);  // ✅ Safe
window.DashboardEvents.broadcast(...);   // ❌ Could error

// Check 3: Is the event name correct?
// Use exact string matching: 'student_section_cleared'
```

### "My listener never fires"

```javascript
// Check 1: Is the event name exact?
window.DashboardEvents.on('student_section_cleared', ...);  // ✅ Exact

// Check 2: Did you misspell it?
window.DashboardEvents.on('student_cleared', ...);  // ❌ Wrong

// Check 3: Is the listener registered before event fires?
// Register in DOMContentLoaded or page load
window.addEventListener('DOMContentLoaded', () => {
    window.DashboardEvents.on('event_name', ...);
});
```

### "Updates are slow / laggy"

```javascript
// Likely using localStorage (fallback)
// Check console for: "BroadcastChannel not supported"

// Solutions:
// 1. Update browser
// 2. Try another browser
// 3. Check for too many listeners:
window.DashboardEvents.listeners;  // Count listeners
```

### "Changes show in one tab but not others"

```javascript
// Could be a listener registration issue
// Make sure your listener is set up in EACH tab

// Or try manually triggering cross-tab sync:
window.DashboardEvents?.broadcast('your_event', data);

// Check network tab to ensure server actually saved
```

---

## Performance Tips

### Tip 1: Use Targeted Updates
```javascript
// ✅ Inefficient - refreshes whole table
refreshStudentTable();

// ✅ Efficient - updates just one row
window.DashboardRealtimeUtils.updateStudentInUI(studentId, { section: 'A' });
```

### Tip 2: Batch Updates When Possible
```javascript
// ❌ Inefficient - DOM update 100 times
for (let i of students) {
    updateStudentInUI(i.id, i);
}

// ✅ Efficient - single batch operation
window.DashboardRealtimeUtils.batchUpdateStudents(students);
```

### Tip 3: Debounce Frequent Events
```javascript
let timeout;
window.DashboardEvents.on('frequent_event', (data) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
        refreshTable();
    }, 500);  // Wait 500ms before refreshing
});
```

### Tip 4: Unsubscribe When Done
```javascript
// If listener only needed temporarily:
const handler = (data) => { /* ... */ };
window.DashboardEvents.on('event', handler);

// Later, unsubscribe:
window.DashboardEvents.off('event', handler);
```

---

## Quick Reference

### Broadcast an Event
```javascript
window.DashboardEvents?.broadcast('event_name', { data });
```

### Listen to an Event
```javascript
window.DashboardEvents.on('event_name', (data) => {
    // React to event
});
```

### Stop Listening
```javascript
window.DashboardEvents.off('event_name', handler);
```

### Update UI
```javascript
window.DashboardRealtimeUtils.updateStudentInUI(id, data);
```

### Check Listeners
```javascript
window.DashboardEvents.listeners;
```

---

## Next Steps

1. **For Immediate Use:**
   - Listen to `student_section_cleared` in your modules
   - Updates will start appearing automatically

2. **To Add Your Own Events:**
   - Add `window.DashboardEvents?.broadcast(...)` to your save function
   - Add listeners in modules that need updates
   - Test in console before deploying

3. **For More Details:**
   - [REALTIME_UPDATE_SYSTEM.md](REALTIME_UPDATE_SYSTEM.md) - Full technical guide
   - [DEVELOPER_REALTIME_REFERENCE.md](DEVELOPER_REALTIME_REFERENCE.md) - Complete API reference

---

## Test Your Implementation

Quick test to verify everything works:

```javascript
// 1. Open yourself two browser tabs
// 2. In Tab 1 console:
window.DashboardEvents.on('test_event', (data) => {
    console.log('✅ Received event:', data);
});

// 3. In Tab 2 console:
window.DashboardEvents?.broadcast('test_event', { hello: 'world' });

// 4. Check Tab 1 console
// Should show: ✅ Received event: { hello: 'world' }

// If cross-tab works, your implementation is ready!
```

---

## Support

- **Got questions?** Check [DEVELOPER_REALTIME_REFERENCE.md](DEVELOPER_REALTIME_REFERENCE.md)
- **Need examples?** Look at `admin-dashboard-students.js` and `admin-dashboard-section-assignment.js`
- **Debugging?** Enable console logs with `localStorage.debug = 'dashboard:*'`

---

Happy real-time coding! 🚀

