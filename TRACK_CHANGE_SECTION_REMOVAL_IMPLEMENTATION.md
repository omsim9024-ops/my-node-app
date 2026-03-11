# Track Change - Automatic Section Removal Implementation

## Overview
When an admin edits a student's academic information in the Student Directory and changes their track (e.g., from Academic to TechPro), the system **automatically removes the student from their current section assignment**. This is necessary because students in different tracks are assigned to different sections.

## Feature Flow

```
Admin changes student track in Student Directory
          ↓
Frontend detects track change
          ↓
System clears old track electives
          ↓
System sets section_id = null AND class_id = null
          ↓
PATCH request sent to backend with updated data
          ↓
Backend clears section_id on students table
          ↓
Frontend refreshes data and notifies storage listeners
          ↓
Section Assignment module reloads and shows student as unassigned
          ↓
Admin can now reassign student to new section based on new track
```

## Implementation Details

### 1. Frontend Detection (admin-dashboard-students.js)

**Location:** `saveEnrollmentDetailWithData()` function (lines 2137-2176)

**Logic:**
```javascript
if (student && updated.track && student.track && student.track !== updated.track) {
    // Track is changing - clear old electives AND remove section assignment
    
    // 1. Clear old track electives
    updated.enrollment_data.academicElectives = null;  // if old track was academic
    updated.enrollment_data.techproElectives = null;   // if old track was techpro
    
    // 2. Remove section assignment
    updated.section_id = null;
    updated.class_id = null;
}
```

**What it does:**
- Detects when `student.track` differs from `updated.track`
- Clears electives from the OLD track (keeps new track electives if applicable)
- **Explicitly sets `section_id = null` and `class_id = null`** to remove the section assignment
- Logs detailed information for debugging

### 2. Backend Processing (routes/enrollments.js)

**Endpoint:** `PATCH /api/enrollments/by-student/:identifier`

**Changes Made:**
- Added handling for `section_id` field updates
- Added handling for `class_id` field updates
- When these fields are provided in the request, the backend updates the `students` table

**Implementation (lines 207-217):**
```javascript
// Handle section_id: Update when explicitly provided (including null to clear assignment)
if (typeof updates.section_id !== 'undefined') {
    console.log('[Enrollments] Updating section_id:', updates.section_id);
    studentFields.push(`section_id = $${idx++}`);
    studentValues.push(updates.section_id);
}

// Handle class_id: Update when explicitly provided
if (typeof updates.class_id !== 'undefined') {
    console.log('[Enrollments] Updating class_id:', updates.class_id);
    studentFields.push(`class_id = $${idx++}`);
    studentValues.push(updates.class_id);
}
```

**Result:** The `students.section_id` column is set to NULL, effectively removing the section assignment.

### 3. Automatic Refresh & Reload

**Frontend Refresh (admin-dashboard-students.js, lines 2325-2330):**
```javascript
if (typeof loadStudents === 'function') await loadStudents();
applyFilters();
if (typeof loadEnrollments === 'function') loadEnrollments(window.currentFilter || 'all');
if (typeof loadDashboardStats === 'function') loadDashboardStats();

// Notify via localStorage
localStorage.setItem('enrollmentUpdate', JSON.stringify({ id: idKey, ts: Date.now() }));
localStorage.setItem('students', String(Date.now()));
```

**Section Assignment Module Auto-reload (admin-dashboard-section-assignment-v2.js, lines 50-60):**
```javascript
window.addEventListener('storage', (e) => {
    if (e.key === 'enrollmentUpdate' || e.key === 'students' || e.key === 'enrollments') {
        loadSectionAssignmentData();  // Reloads unassigned students
        displayClassList();            // Refreshes class list
    }
});
```

## Database Schema

**Students Table Structure:**
```sql
CREATE TABLE students (
    id SERIAL PRIMARY KEY,
    student_id VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    grade_level VARCHAR(50),
    section_id INTEGER REFERENCES sections(id),  -- Gets set to NULL when track changes
    class_id INTEGER REFERENCES classes(id),
    ...
);
```

## User Experience

### Step-by-Step Workflow

1. **Admin opens Student Directory** and finds a student assigned to Section "IX-Phoenix" (Academic track)
2. **Admin clicks Edit** on the student row
3. **In the Edit Modal**:
   - Changes Grade Level (if needed)
   - Changes Track from "Academic" → "TechPro"
   - Selects new TechPro electives
   - Clicks "Save Changes"
4. **System processes the change**:
   - ✅ Old Academic electives are cleared
   - ✅ New TechPro electives are saved
   - ✅ Section assignment is CLEARED automatically
   - ✅ Student is removed from "IX-Phoenix" section
5. **Confirmation message** shows "Saved changes to server"
6. **Admin navigates to Section Assignment module**
7. **Student now appears in "Unassigned Students"** list (not yet assigned to a new section)
8. **Admin can now assign the student** to a new section that matches the TechPro track

## Testing Checklist

- [ ] Create/find a student assigned to a section with Academic track
- [ ] Edit the student through Student Directory
- [ ] Change the track to TechPro
- [ ] Select appropriate TechPro electives
- [ ] Save the changes
- [ ] Verify in browser console that `section_id = null` is logged
- [ ] Verify backend logs show the section_id update
- [ ] Navigate to Section Assignment module
- [ ] Confirm student appears in "Unassigned Students" (no longer in full section list)
- [ ] Verify previous section's student count decremented
- [ ] Reassign student to a new TechPro section
- [ ] Verify all data persists correctly

## Logging

The implementation includes detailed logging at both frontend and backend:

**Frontend Logs:**
```
[Students] ✅ TRACK CHANGE DETECTED
[Students]   Old track: academic type: string
[Students]   New track: techpro type: string
[Students] Track changed from academic to techpro - clearing old track electives and removing section
[Students]   - Cleared academicElectives (old track was academic)
[Students]   ✅ SET section_id = null, class_id = null
```

**Backend Logs:**
```
[Enrollments] Updating section_id: null
[Enrollments] Updating class_id: null
[Enrollments] Student updated: { ... updated record ... }
```

## Code References

- **Frontend Detection:** [admin-dashboard-students.js](admin-dashboard-students.js#L2143-L2176)
- **Backend Processing:** [routes/enrollments.js](routes/enrollments.js#L207-L217)
- **Auto-reload Listener:** [admin-dashboard-section-assignment-v2.js](admin-dashboard-section-assignment-v2.js#L50-L60)

## Edge Cases Handled

1. **Student has no current section** → No-op, section_id was already NULL
2. **Track changes multiple times** → Each change clears previous section
3. **Only track changes, everything else stays same** → Only section is removed, other data preserved
4. **Backend fails** → Frontend falls back to local-only update, but section_id update is still attempted
5. **Different track electives** → Old track electives are cleared, new track electives preserved

## Advantages of This Approach

✅ **Automatic** - No manual intervention needed from admin
✅ **Atomic** - Track change and section removal happen together
✅ **Reversible** - Admin can reassign to a new section immediately
✅ **Data-consistent** - Students table is the source of truth for section assignments
✅ **Scalable** - Works with all tracks (Academic, TechPro, Doorway)
✅ **Observable** - Detailed logging for debugging and auditing
✅ **Integrated** - Triggers automatic refresh across all modules

## Related Features

- **Student Directory Module** - Where track changes are initiated
- **Section Assignment Module** - Where students are reassigned to new sections
- **Enrollment Modal** - Electives management for students
- **Admin Dashboard** - Overall management interface

