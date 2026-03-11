# Student Profile - Admin Dashboard Sync Implementation Guide

## 📋 Overview

The Student Dashboard's Student Profile section now automatically displays the active school year and assigned section based on Admin Dashboard configuration. When an admin activates a school year or assigns a student to a section, the Student Profile automatically reflects these updates.

## 🔄 Data Flow Architecture

### 1. **Active School Year Sync**
```
Admin Dashboard
    ↓ (Activates School Year via PUT /api/school-years/{id}/activate)
    ↓
Database Updated
    ↓
Student Dashboard (On Profile Load or Auto-Refresh)
    ↓ (Fetches GET /api/school-years/active)
    ↓
Profile Shows: "2025-2026" (or current active year)
```

### 2. **Section Assignment Sync**
```
Admin Dashboard (Section Assignment Tab)
    ↓ (Assigns Students via POST /api/sections/{id}/assign-students)
    ↓
Database: enrollments.section_id = {sectionId}
    ↓
Student Dashboard (On Profile Load or Auto-Refresh)
    ↓ (Fetches GET /api/enrollments/student/{studentId})
    ↓ (Finds enrollment with section_id)
    ↓ (Fetches GET /api/sections/{section_id})
    ↓
Profile Shows: "OKI (JHS-G7-OKI)" or assigned section name
```

## 🚀 Implementation Details

### Key Functions (student-dashboard.js)

#### 1. **loadActiveSchoolYear()**
- **Priority:** API First → LocalStorage Fallback
- **Behavior:** Always fetches fresh from API for real-time updates
- **Returns:** School year object with `school_year` field
- **Fallback:** Uses localStorage if API fails

```javascript
// Call sequence:
// 1. Try API: GET /api/school-years/active
// 2. On success: Store in localStorage AND window.activeSchoolYear
// 3. On failure: Use cached value from localStorage
```

#### 2. **loadAndDisplayActiveSchoolYear()**
- **Async Function:** Properly awaits API calls
- **Target:** `#profileSchoolYear` element
- **Display:** Shows "2024-2025" or similar format
- **Fallback States:** "--" if not available or "Error Loading"

#### 3. **loadAndDisplayAssignedSection(studentId)**
- **Async Function:** Properly awaits enrollment and section data
- **Steps:**
  1. Fetch enrollments for student
  2. Find approved enrollment with `section_id` (or any enrollment with assignment)
  3. Fetch section details for that section
  4. Display formatted as "Section Name (Section Code)"
- **Target:** `#profileSection` element
- **Fallback States:** "Not Assigned", "Error Loading Section"

#### 4. **startProfilePolling(studentId)**
- **Interval:** Every 30 seconds
- **Scope:** Only while Profile section is active
- **Action:** Silently refreshes school year and section data
- **Logging:** Detailed console logs for debugging

#### 5. **stopProfilePolling()**
- **Trigger:** When user leaves Profile section
- **Action:** Clears the polling interval
- **Prevents:** Unnecessary API calls when profile not visible

## 📱 User Experience Flow

### Scenario 1: Student Opens Profile Section
```
1. Student clicks Profile in navigation
2. setupNavigation() triggers:
   - Call loadAndDisplayActiveSchoolYear()
   - Call loadAndDisplayAssignedSection(studentId)
   - Call startProfilePolling(studentId)
3. Profile shows current school year and section
4. Polling begins every 30 seconds
5. If admin changes data, profile updates within 30 seconds
```

### Scenario 2: Student Manually Refreshes
```
1. Student clicks "🔄 Refresh Data" button
2. Button shows "⏳ Refreshing..."
3. Both functions run in parallel
4. Data updates immediately
5. Button re-enables and shows success message
```

### Scenario 3: Student Closes Profile Section
```
1. Student clicks another tab (Grades, Schedule, Dashboard)
2. setupNavigation() triggers stopProfilePolling()
3. Polling interval is cleared
4. No unnecessary API calls
```

## 🧪 Test Scenarios

### Test 1: Initial Page Load
**Expected Behavior:**
- Profile shows correct school year from API or localStorage
- Profile shows section if student is assigned
- Console shows: "[Student Dashboard] School year loaded from API"
- Console shows: "[Student Dashboard] Section assigned: ..."

**Steps:**
1. Open Student Dashboard
2. Navigate to Profile section
3. Check values displayed

---

### Test 2: Admin Activates New School Year
**Setup:**
- Student dashboard already open in one browser/tab
- Admin dashboard open in another browser/tab

**Admin Steps:**
1. Go to School Years tab in Admin Dashboard
2. Create a new school year "2025-2026"
3. Click "Activate" button
4. Wait for success message

**Student Steps:**
1. Wait 30 seconds (for polling to trigger)
2. OR Click "🔄 Refresh Data" button manually
3. Check Profile section school year field

**Expected:** Student Profile shows "2025-2026"

---

### Test 3: Admin Assigns Student to Section
**Setup:**
- No section assigned yet
- Student ID = 5 (or any unassigned student)
- Section exists: "OKI" (JHS-G7-OKI)

**Admin Steps:**
1. Go to Student Management → Section Assignment
2. Select Grade Level (JHS)
3. Check student "Maria Santos" (ID: 5)
4. Select section "OKI"
5. Click "Preview Section Assignment"
6. Click "Confirm Assignment"
7. Wait for success message

**Student Steps:**
1. Open Profile section
2. Scroll to Academic Information
3. Check "Section:" field

**Expected:** Shows "OKI (JHS-G7-OKI)" or section name + code

---

### Test 4: Automatic Update While Profile Open
**Setup:**
- Student profile open showing "Not Assigned"
- Admin ready to assign
- Both browser windows visible side-by-side

**Execution (with Polling):**
1. Student: Keep Profile section open
2. Admin: Assign student to section
3. Admin: See success message
4. Student: Watch Profile section
5. Student: Within 30 seconds, "Section:" should update

**Execution (Manual Refresh):**
1. Admin: Assign student to section
2. Student: Click "🔄 Refresh Data"
3. Student: See section updated immediately

**Expected:** Section field auto-updates or updates on manual refresh

---

### Test 5: Multiple Sections Over Time
**Setup:**
- Student has been assigned to multiple sections across enrollments
- Want to test that we get the most recent/approved enrollment

**Admin Steps:**
1. Assign student to Section A (Approved enrollment)
2. Create another enrollment, Assign to Section B (Approved enrollment)
3. Create third enrollment, NOT assigned (Pending)

**Student Steps:**
1. Open Profile
2. Check Section field

**Expected:** Shows the approved enrollment's section (logic prioritizes: approved+assigned, then any assigned)

---

## 🔍 Console Logging Reference

### Expected Logs on Profile Open
```
[Student Dashboard] Profile section opened - refreshing data
[Student Dashboard] Active school year loaded from API: { school_year: "2024-2025", ... }
[Student Dashboard] School year displayed: 2024-2025
[Student Dashboard] Section assigned: OKI (JHS-G7-OKI)
[Student Dashboard] Starting profile data polling (every 30 seconds)
```

### Expected Logs During Polling
```
[Student Dashboard] Polling for profile updates...
[Student Dashboard] Active school year loaded from API: { ... }
[Student Dashboard] School year displayed: 2024-2025
[Student Dashboard] Profile data polling completed
```

### Expected Logs on Manual Refresh
```
[Student Dashboard] Refresh button clicked - updating profile data
[Student Dashboard] Active school year loaded from API: { ... }
[Student Dashboard] School year displayed: 2024-2025
[Student Dashboard] Section assigned: OKI (JHS-G7-OKI)
[Student Dashboard] Profile data refreshed
```

---

## ⚙️ Configuration

### Polling Interval
- **Location:** `student-dashboard.js:startProfilePolling()`
- **Current:** 30,000 milliseconds (30 seconds)
- **Adjustable:** Change value in `setInterval(..., 30000)`

### API Base URL
- **Uses:** `window.location.origin`
- **Endpoints:**
  - `GET /api/school-years/active`
  - `GET /api/enrollments/student/{studentId}`
  - `GET /api/sections/{sectionId}`

---

## 🛠️ Troubleshooting

### Issue: Profile Shows "--" for School Year
**Possible Causes:**
1. No active school year set in database
2. API endpoint `/api/school-years/active` failing
3. Network connectivity issue
4. Invalid school year data format

**Solution:**
- Check browser console for error messages
- Verify admin has activated a school year
- Check network tab in DevTools for API errors
- Run test: `curl http://localhost:3000/api/school-years/active`

---

### Issue: Section Shows "Not Assigned" When Should Be Assigned
**Possible Causes:**
1. Enrollment not found in database
2. Enrollment has no `section_id` value
3. Enrollment has wrong student_id
4. Assignment API call failed silently

**Solution:**
- Check console for "Error loading enrollments" messages
- Database query: `SELECT * FROM enrollments WHERE student_id = {studentId};`
- Verify `section_id` is populated
- Check Admin Dashboard section assignment succeeded

---

### Issue: Polling Not Working / Profile Not Auto-Updating
**Possible Causes:**
1. User navigated away from profile before polling started
2. Profile section not properly marked active
3. Browser tab backgrounded/sleeping
4. JavaScript errors preventing interval setup

**Solution:**
- Check browser console for JavaScript errors
- Verify profile section has `class="active"`
- Look for "Starting profile data polling" in console
- Check if polling stops when navigating away

---

## 📊 Data Update Latency

| Action | Max Latency |
|--------|------------|
| Admin activates school year → Student sees update (manual refresh) | <1 second (API call) |
| Admin activates school year → Student sees update (auto-polling) | 30 seconds |
| Admin assigns section → Student sees update (manual refresh) | <1 second (API call) |
| Admin assigns section → Student sees update (auto-polling) | 30 seconds |

---

## 🔐 Security Notes

- ✅ All API calls use same authentication as other dashboard endpoints
- ✅ Student can only see their own enrollment data
- ✅ Polling is client-side only (no server-side WebSocket)
- ✅ No real-time sync (polling-based approach is simpler)

---

## 📝 Implementation Files Modified

1. **[student-dashboard.js](student-dashboard.js)**
   - Enhanced `loadActiveSchoolYear()` - API-first with localStorage fallback
   - Updated `loadAndDisplayActiveSchoolYear()` - Async with fresh API calls
   - Updated `loadAndDisplayAssignedSection()` - Async with proper error handling
   - Added `startProfilePolling()` - 30-second polling while profile open
   - Added `stopProfilePolling()` - Cleanup when profile closed
   - Enhanced `setupNavigation()` - Added polling control
   - Updated refresh button handler - Proper async/await

2. **[student-dashboard.html](student-dashboard.html)**
   - ✅ Already has `#profileSchoolYear` element
   - ✅ Already has `#profileSection` element
   - No changes needed

---

## ✅ Verification Checklist

Use this checklist to verify the implementation is working:

- [ ] Student opens profile, sees school year from database
- [ ] Student opens profile, sees section if assigned
- [ ] Admin activates new school year, student sees update on refresh
- [ ] Admin assigns student, student sees section on refresh
- [ ] Polling logs appear in console every 30 seconds while profile open
- [ ] Polling stops when user leaves profile section
- [ ] Manual refresh button works and shows success message
- [ ] No JavaScript errors in console
- [ ] Works on multiple browser tabs simultaneously
- [ ] Works on mobile viewport

---

## 🚀 Deployment Notes

This implementation requires:
- ✅ Backend API endpoints working correctly
- ✅ Database has `enrollments.section_id` column (from migration)
- ✅ School years table with `is_active` flag
- ✅ Proper CORS configuration for API calls

No additional dependencies or libraries required.

