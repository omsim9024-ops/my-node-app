# Elective Change Section Assignment Feature

## Overview
Implemented automatic section assignment removal when an admin changes a student's electives while keeping the same track in the Student Directory Edit Modal.

## Implementation Details

### Location
File: `admin-dashboard-students.js`
Function: `saveEnrollmentDetailWithData()` (around line 2250)

### How It Works

#### 1. **Track Change Detection** (Existing Feature)
When a student's track changes (e.g., Academic → TechPro), the system:
- Clears all old electives from the previous track
- Removes the student's section assignment (`section_id = null`, `class_id = null`)
- Forces reassignment through the Section Assignment module

#### 2. **Elective Change Detection** (NEW Feature)
Now, even when the track stays the same, the system detects if the electives have changed:
- Compares old and new electives
- If any electives were changed/removed while track remains the same
- Automatically removes the section assignment

### Logic Flow

```
SAVE REQUEST
↓
1. Check if track changed
   ├─ YES: Clear electives & remove section assignment
   └─ NO: Continue to step 2
↓
2. Check if electives changed (same track)
   ├─ YES: Remove section assignment
   │       (Student must be reassigned in Section Assignment module)
   └─ NO: Continue normally
↓
3. Send updated data to server
```

### Key Features

✅ **Elective Comparison**
- Normalizes electives (lowercase, trim whitespace)
- Deduplicates electives using Set
- Handles multiple elective fields (academicElectives, techproElectives, doorwayAcademic, doorwayTechPro, electives)

✅ **Safe Comparison**
- Only triggers on meaningful changes
- Requires there to be previous electives (doesn't trigger if changing from 0 to N electives)
- Works with both JSON and string enrollment_data formats

✅ **Clear Logging**
- Detailed console logs for debugging
- Shows old vs new electives
- Indicates when section removal is triggered

### Code Changes

**Added Section** (Lines 2253-2321):
```javascript
// ===== ELECTIVE CHANGE DETECTION (even when track stays the same) =====
// This handles the case where admin changes electives while keeping the same track
if (!trackIsChanging) {  // Only check if track is NOT changing
    // Collect OLD electives from student's existing enrollment data
    let oldElectives = [];
    if (student.enrollment_data) {
        const enrollData = typeof student.enrollment_data === 'string' 
            ? JSON.parse(student.enrollment_data) 
            : student.enrollment_data;
        // Collect from all possible elective fields
        if (Array.isArray(enrollData.academicElectives)) oldElectives.push(...enrollData.academicElectives);
        if (Array.isArray(enrollData.techproElectives)) oldElectives.push(...enrollData.techproElectives);
        // ... other elective fields
    }
    
    // Collect NEW electives from updated object
    let newElectives = [];
    if (updated.enrollment_data) {
        // Same collection from all elective fields
        if (Array.isArray(updated.enrollment_data.academicElectives)) newElectives.push(...updated.enrollment_data.academicElectives);
        // ... other fields
    }
    
    // Normalize and compare
    const normalizeElectives = (arr) => Array.from(new Set(arr.map(...))).sort();
    const oldElectivesNorm = normalizeElectives(oldElectives);
    const newElectivesNorm = normalizeElectives(newElectives);
    
    // If different, remove section assignment
    if (electivesChanged && oldElectivesNorm.length > 0) {
        updated.section_id = null;
        updated.class_id = null;
        console.log('[Students] SECTION REMOVAL TRIGGERED (ELECTIVE CHANGE)');
    }
}
```

### Affected Workflows

**Admin Edit Modal Flow:**
1. Admin opens Student Directory
2. Opens Edit Modal for a student
3. Changes electives in the ACADEMIC tab (while track stays the same)
4. Clicks "Approve"
5. System detects elective change
6. **Automatically removes section assignment**
7. Student now appears with no section in Section Assignment list
8. Admin must reassign through Section Assignment module

### Related Modules

- **Section Assignment Module**: `admin-dashboard-section-assignment.js`
  - Students with null `section_id` appear as "Unassigned"
  - Admin can reassign them with new section allocation
  
- **Enrollment Reports**: `admin-dashboard.js`
  - Will show students with cleared sections as unassigned
  - Tracks the reassignment process

### Testing Checklist

- [ ] Edit a student's electives (same track)
- [ ] Verify the review dialog shows changes
- [ ] Click Approve
- [ ] Check server logs for section_id = null in update payload
- [ ] Verify student appears in Section Assignment with no section
- [ ] Test with different track changes
- [ ] Test edge cases (null electives, empty arrays)
- [ ] Check browser console for detailed logs

### Console Debugging

When testing, check browser console (F12 > Console) for logs:
```
[Students] ELECTIVE COMPARISON:
[Students]   Old electives: animation (nc ii), broadband installation (nc ii)
[Students]   New electives: animation (nc ii)
[Students]   → Different number of electives
[Students] ✅✅✅ ELECTIVE CHANGE DETECTED (same track) ✅✅✅
[Students] ✅✅✅ SECTION REMOVAL TRIGGERED (ELECTIVE CHANGE) ✅✅✅
```

### API Impact

When electives change:
- **PATCH** request to `/api/enrollments/by-student/{studentId}`
- Includes `section_id: null` and `class_id: null`
- Server should handle null values as "remove assignment"
- Enrollment data preserves the new electives

Example payload:
```json
{
  "section_id": null,
  "class_id": null,
  "enrollment_data": {
    "track": "techpro",
    "techproElectives": ["Animation (NC II)"]
  }
}
```

## Benefits

1. **Data Integrity**: Ensures students can't be assigned to old sections with new electives
2. **User Workflow**: No need for admins to manually clear section assignment
3. **System Flow**: Automatically integrates with Section Assignment module
4. **Audit Trail**: Console logs track when and why section assignments are removed

## Future Enhancements

- [ ] Add notification to student when electives change
- [ ] Auto-suggest section reassignment with compatible sections  
- [ ] Track elective change history for audit purposes
- [ ] Batch reassignment feature for multiple students


