# Student Profile - Testing Guide for School Year & Section Display

## 👤 For Students

### What Should I See?

When you open the **Profile** section in the Student Dashboard, you should see:

1. **School Year:** The current active school year set by your admin (e.g., "2024-2025")
2. **Section:** The section your admin assigned you to (e.g., "OKI (JHS-G7-OKI)")
   - Shows "Not Assigned" if you're not in a section yet

### The Data Updates Automatically

- **Every 30 seconds:** Profile checks for updates while you're viewing it
- **When you click "🔄 Refresh Data":** Profile updates immediately
- **When you open Profile tab:** Fresh data is fetched right away

### How to Check Your Assignment

1. Click **Profile** in the navigation menu
2. Scroll down to **Academic Information** section
3. Look for:
   - **School Year:** Should show the current active year
   - **Section:** Should show your assigned section name

---

## 👨‍💼 For Admins

### Setting Up for Testing

#### Step 1: Activate a School Year
1. Open **Admin Dashboard**
2. Click **School Years** in the sidebar
3. Create a new school year (if needed): "2025-2026"
4. Click **Activate** button next to it
5. ✅ You'll see: "School year activated successfully!"

#### Step 2: Assign Students to Sections
1. Click **Student Management** → **Section Assignment**
2. Select **Grade Level** (JHS or SHS)
3. Select **Section** you want to assign students to
4. Check the boxes next to student names
5. Click **Preview Section Assignment**
6. Click **Confirm Assignment**
7. ✅ You'll see: "Students successfully assigned!"

---

## 🧪 Test Scenarios

### Test 1: View Active School Year (Basic)
**Time:** 2 minutes

**Setup:**
- Have one browser open to Admin Dashboard
- Have another browser open to Student Dashboard

**Steps:**
1. **Admin:** Go to School Years tab
2. **Admin:** Verify a school year is activated (should see it marked as "Active")
3. **Student:** Click Profile tab
4. **Student:** Look at "School Year:" field

**Expected Result:**
- ✅ School Year field shows the active year (e.g., "2024-2025")
- ✅ Not showing "--" 
- ✅ Not showing "Error Loading"

---

### Test 2: View Section Assignment (Intermediate)
**Time:** 5 minutes

**Setup:**
- Have one browser with Admin Dashboard
- Have another browser with Student Dashboard
- Student must be enrolled and have no section assignment yet

**Steps:**
1. **Admin:** Go to Section Assignment tab
2. **Admin:** Select a grade level and section
3. **Admin:** Find the student (e.g., "Maria Santos")
4. **Admin:** Check the student's checkbox
5. **Admin:** Click "Confirm Assignment"
6. **Admin:** Wait for success message
7. **Student:** Click Profile tab (or wait - should auto-update)
8. **Student:** Look at "Section:" field

**Expected Result:**
- ✅ Section field shows the assigned section (e.g., "OKI (JHS-G7-OKI)")
- ✅ Section appears within 30 seconds even without reload
- ✅ Shows section name and code

---

### Test 3: Auto-Update While Profile Open (Advanced)
**Time:** 10 minutes

**Setup:**
- Both dashboards visible side-by-side (or use 2 monitors)
- Student profile open, not yet assigned

**Steps:**
1. **Student:** Navigate to Profile section
2. **Student:** Note "Section:" shows "Not Assigned"
3. **Admin:** In Admin Dashboard, go to Section Assignment
4. **Admin:** Assign same student to a section
5. **Admin:** Click "Confirm Assignment"
6. **Student:** Watch the Profile section "Section:" field
7. **Student:** Should update within 30 seconds (OR click "🔄 Refresh Data" for instant update)

**Expected Result:**
- ✅ Section updates automatically within 30 seconds
- ✅ OR updates immediately when "🔄 Refresh Data" clicked
- ✅ No page reload required
- ✅ Shows success message in admin when assigned

---

### Test 4: Multiple Enrollments (Complex)
**Time:** 15 minutes

**Setup:**
- Same student has multiple enrollments (possible after re-enrollment)
- Some approved, some pending
- Want to verify correct enrollment is shown

**Steps:**
1. **Admin:** Create multiple enrollments for same student
2. **Admin:** Assign only the "approved" enrollment to a section
3. **Admin:** Leave the "pending" enrollment unassigned
4. **Student:** Open Profile section
5. **Student:** Check what section is displayed

**Expected Result:**
- ✅ Shows the approved enrollment's section assignment
- ✅ Ignores unassigned enrollments
- ✅ Only shows one section (the active assigned one)

---

### Test 5: Manual Refresh (Basic)
**Time:** 3 minutes

**Setup:**
- Student Dashboard open
- Profile section visible

**Steps:**
1. **Student:** Click Profile section
2. **Student:** Note current School Year and Section values
3. **Student:** Click "🔄 Refresh Data" button
4. **Student:** Watch button show "⏳ Refreshing..."
5. **Student:** Wait for button to return to "🔄 Refresh Data"
6. **Student:** Check alert message

**Expected Result:**
- ✅ Button shows loading state: "⏳ Refreshing..."
- ✅ Button re-enables after refresh completes
- ✅ Shows success alert: "✅ Profile data refreshed!"
- ✅ Data updates (or shows same if no changes)

---

### Test 6: Auto-Polling (Intermediate)
**Time:** 35 seconds

**Setup:**
- Browser DevTools open (F12)
- Console tab visible
- Student Dashboard Profile section open

**Steps:**
1. **Student:** Click Profile
2. **Observer:** Look at Console for logs
3. **Observer:** Should see: `[Student Dashboard] Starting profile data polling`
4. **Wait:** 30 seconds
5. **Observer:** Should see: `[Student Dashboard] Polling for profile updates...`

**Expected Result:**
- ✅ Console shows "Starting profile data polling"
- ✅ Every 30 seconds, sees "Polling for profile updates..." log
- ✅ When leaving profile tab, sees "Stopping profile data polling" log

---

## 🔍 Console Logging Reference

### What to Look For

Open Developer Tools: **F12 → Console**

#### Expected on Profile Load
```
[Student Dashboard] Profile section opened - refreshing data
[Student Dashboard] Active school year loaded from API: 
  {school_year: "2024-2025", ...}
[Student Dashboard] School year displayed: 2024-2025
[Student Dashboard] Section assigned: OKI (JHS-G7-OKI)
[Student Dashboard] Starting profile data polling (every 30 seconds)
```

#### Expected Every 30 Seconds
```
[Student Dashboard] Polling for profile updates...
[Student Dashboard] Active school year loaded from API: {school_year: "2024-2025"}
[Student Dashboard] Profile data polling completed
```

#### Expected on Manual Refresh
```
[Student Dashboard] Refresh button clicked - updating profile data
[Student Dashboard] Profile data refreshed
```

#### Expected on Tab Change
```
[Student Dashboard] Profile section no longer active, stopping polling
[Student Dashboard] Stopping profile data polling
```

---

## ⚠️ Troubleshooting

### Problem: School Year Shows "--"

**Possible Causes:**
1. No active school year set by admin
2. API connection problem
3. Browser offline

**Solution:**
1. Admin should go to School Years tab and activate a year
2. Check Network tab in DevTools (F12) for API errors
3. Check internet connection
4. Try clicking "🔄 Refresh Data"

---

### Problem: Section Shows "Not Assigned" but Should Be Assigned

**Possible Causes:**
1. Admin hasn't assigned student yet
2. Assignment is pending, not approved
3. Assignment failed silently

**Solution:**
1. Check Admin Dashboard Section Assignment tab
2. Verify student shows in assigned list
3. Try assigning again
4. Click "🔄 Refresh Data" to force update

---

### Problem: Data Not Updating After Admin Changes

**Possible Causes:**
1. Profile tab not open (polling only works when open)
2. Browser tab backgrounded/minimized
3. API connection lost

**Solution:**
1. Click Profile tab to activate
2. Bring browser window to foreground
3. Check internet connection
4. Click "🔄 Refresh Data" button
5. Close and reopen Profile tab

---

### Problem: "Error Loading Section" Displays

**Possible Causes:**
1. Enrollment has section_id but section doesn't exist
2. API error fetching section details
3. Database inconsistency

**Solution:**
1. Admin should verify section exists
2. Admin should re-assign student
3. Contact IT support if problem persists

---

## 📊 What Gets Updated

| Item | Updated From | Update Method | Timing |
|------|---|---|---|
| School Year | Admin School Years Tab | API call | Every 30 sec (polling) or manual refresh |
| Section | Admin Section Assignment Tab | API call | Every 30 sec (polling) or manual refresh |

---

## ✅ Quick Verification Checklist

Use this to verify everything is working:

### For Students:
- [ ] Profile shows School Year value (not "--")
- [ ] Profile shows Section value (or "Not Assigned")
- [ ] Clicking "🔄 Refresh Data" triggers loading state
- [ ] Profile updates after admin makes changes (within 30 sec)
- [ ] No JavaScript errors in console (F12)

### For Admins:
- [ ] Can activate school years
- [ ] Can assign students to sections
- [ ] Success messages appear after actions
- [ ] Students' profiles update with new data

### For Developers:
- [ ] Console shows expected log messages
- [ ] API endpoints responding correctly
- [ ] Network requests visible in DevTools
- [ ] Polling starts/stops correctly on tab navigation
- [ ] No memory leaks (polling cleaned up properly)

---

## 🆘 Getting Help

If something isn't working:

1. **Check Console Logs** (F12 → Console)
   - Look for error messages
   - Look for warning messages
   - Share the logs with support

2. **Check Network Requests** (F12 → Network)
   - Click on `/api/school-years/active` request
   - Check response status (should be 200)
   - Check response data

3. **Verify Database** (If admin/developer)
   - Check school years table has active record
   - Check enrollments table has correct section_id values
   - Run migration if columns missing: `node migrate-add-section-assignment.js`

4. **Check Browser Compatibility**
   - Modern browsers: Chrome, Firefox, Safari, Edge
   - Required: ES6 support, Fetch API
   - Recommended: Clear browser cache (Ctrl+Shift+Delete)

---

## 📱 Mobile Testing

The profile section works on mobile/tablet:

- ✅ Responsive design adapts to smaller screens
- ✅ Touch-friendly "🔄 Refresh Data" button
- ✅ Same auto-polling functionality
- ✅ Console logs available on mobile DevTools

**To test on mobile:**
1. Open on smartphone or tablet
2. Navigate to Profile section
3. Wait for data to load
4. Verify values display correctly
5. Use Chrome DevTools remote debugging if needed

---

## ✨ Tips for Best Experience

1. **Keep Profile Tab Open:** Data updates every 30 seconds automatically
2. **Use Refresh Button:** For instant update instead of waiting 30 seconds
3. **Check Console Logs:** Helps diagnose issues
4. **Keep Server Running:** Backend API must be accessible
5. **Multiple Windows:** Can test real-time sync by having both dashboards open

---

**Happy Testing! 🎉**

For detailed technical information, see: [STUDENT_PROFILE_ADMIN_SYNC_GUIDE.md](STUDENT_PROFILE_ADMIN_SYNC_GUIDE.md)

