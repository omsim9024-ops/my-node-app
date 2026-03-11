# Admin Dashboard - Elective Update Fix

## Problem
When an admin updated a student's elective in the Admin Dashboard's Student Directory edit modal, the system was displaying BOTH the old and new electives instead of replacing the old one with the new one. This caused confusion and displayed inaccurate student information.

## Root Cause
In the `reviewEnrollmentDetail()` function in `admin-dashboard-students.js`, when collecting form data from the edit modal, the code was **deleting** the old elective fields (`delete obj.academicElectives`, etc.) instead of explicitly setting them. This caused two issues:

1. **Backend didn't know to clear old electives**: When the request was sent to the backend, deleted properties weren't included in the request body. The backend's shallow merge only updates fields that are explicitly provided, so it didn't clear the old values.

2. **No explicit instruction to replace**: The backend needs explicit instructions (even if empty arrays) to replace old data.

## Solution

### Changes Made to `admin-dashboard-students.js`

#### 1. **Explicit Elective Clearing** (Lines ~1793-1825)
Changed from deleting elective properties to explicitly setting them to empty arrays:

**Before:**
```javascript
// Always clear all track-specific electives first
delete obj.academicElectives;
delete obj.techproElectives;
delete obj.doorwayAcademic;
delete obj.doorwayTechPro;
```

**After:**
```javascript
// Always clear all track-specific electives first - EXPLICITLY set to empty arrays
// (Don't delete them - backend needs to know to clear them)
obj.academicElectives = [];
obj.techproElectives = [];
obj.doorwayAcademic = [];
obj.doorwayTechPro = [];
obj.electives = [];

// Only set electives for the CURRENT track, others remain empty/cleared
if (electives.length) {
    obj.electives = electives;
    // Set track-specific fields based on current track
    if (newTrack && newTrack.toLowerCase().includes('academic')) {
        obj.academicElectives = electives;
    } else if (newTrack && newTrack.toLowerCase().includes('techpro')) {
        obj.techproElectives = electives;
    } else if (newTrack && newTrack.toLowerCase().includes('doorway')) {
        obj.doorwayAcademic = electives;
    }
} else {
    // If no electives selected, clear all elective fields
    obj.electives = [];
    obj.academicElectives = [];
    obj.techproElectives = [];
    obj.doorwayAcademic = [];
    obj.doorwayTechPro = [];
}
```

#### 2. **Fallback Local Update Enhancement** (Lines ~2717-2749)
Improved the fallback code (when server save fails) to also update electives in the local arrays:

**Before:**
```javascript
return Object.assign({}, s, {
    fullName: updated.fullName,
    lrn: updated.lrn,
    grade: updated.grade,
    track: updated.track,
    status: updated.status,
    currentAddress: updated.currentAddress,
    birthdate: updated.birthdate,
    gender: updated.gender
    // electives were NOT updated in fallback
});
```

**After:**
```javascript
// Extract electives from enrollment_data
const enrollmentData = updated.enrollment_data || {};
let updatedElectives = [];
if (Array.isArray(enrollmentData.academicElectives)) updatedElectives.push(...enrollmentData.academicElectives);
if (Array.isArray(enrollmentData.techproElectives)) updatedElectives.push(...enrollmentData.techproElectives);
if (Array.isArray(enrollmentData.doorwayAcademic)) updatedElectives.push(...enrollmentData.doorwayAcademic);
if (Array.isArray(enrollmentData.doorwayTechPro)) updatedElectives.push(...enrollmentData.doorwayTechPro);
if (Array.isArray(enrollmentData.electives)) updatedElectives.push(...enrollmentData.electives);

return Object.assign({}, s, {
    fullName: updated.fullName,
    lrn: updated.lrn,
    grade: updated.grade,
    track: updated.track,
    status: updated.status,
    currentAddress: updated.currentAddress,
    birthdate: updated.birthdate,
    gender: updated.gender,
    electives: updatedElectives  // Now included
});
```

## How the Fix Works

1. **Frontend**: When the form is submitted, all elective fields are now explicitly set to empty arrays, and only the new selected electives populate the appropriate track field.

2. **Backend**: The backend's shallow merge (`Object.keys(updates.enrollment_data).forEach(k => { data[k] = updates.enrollment_data[k]; })`) correctly replaces old values with the new ones, including empty arrays.

3. **Student Details Display**: After save:
   - `loadStudents()` is called, which fetches the latest enrollments from the server
   - Student list is rebuilt with `buildStudentList()`, which correctly aggregates electives from the updated enrollment data
   - When the Student Profile is viewed again, it displays only the new electives

## Flow Overview

```
Admin opens Student Profile
    ↓
Admin clicks Edit button
    ↓
Enrollment Detail modal opens with existing electives
    ↓
Admin changes/updates electives in the form
    ↓
Admin clicks Save/Review
    ↓
Form Data Collection:
  - New electives are captured from checkboxes
  - ALL elective fields(academicElectives, techproElectives, doorwayAcademic, doorwayTechPro) are explicitly set to empty arrays
  - Only the current track's field is populated with new selections
    ↓
Review Modal displayed with NEW electives highlighted
    ↓
Admin clicks Confirm
    ↓
Backend receives request with explicit empty arrays for cleared fields
    ↓
Enrollment data is updated with shallow merge (old values replaced)
    ↓
loadStudents() called → fetches latest data from server
    ↓
Student list rebuilt with updated electives (old ones removed)
    ↓
Modal closes
    ↓
Student Details now show ONLY the new electives
```

## Testing Recommendations

1. **Test 1: Change Elective in Same Track**
   - Student: Academic track, currently has "Elective A"
   - Admin changes to "Elective B" (same track)
   - Student Details should show ONLY "Elective B", not both

2. **Test 2: Change Track (Which changes electives)**
   - Student: Academic track with electives
   - Admin changes to TechPro track
   - Student Details should show EMPTY or TechPro electives, not Academic ones

3. **Test 3: Remove All Electives**
   - Student: Has multiple electives
   - Admin deselects all electives
   - Student Details should show "None"

4. **Test 4: Multiple Students**
   - Ensure other students' electives are not affected
   - Verify data is persisted correctly in database

5. **Test 5: Fallback Case**
   - Temporarily disable backend to test fallback code path
   - Local update should also clear old electives

## Files Modified
- `admin-dashboard-students.js` (2 changes in lines ~1793-1825 and ~2717-2749)

## Backend Compatibility
No backend changes required. The existing backend properly handles the explicit empty arrays sent from the frontend.


