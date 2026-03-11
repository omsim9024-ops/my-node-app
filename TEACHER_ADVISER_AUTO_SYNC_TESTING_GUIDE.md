# Teacher Adviser Dashboard Auto-Sync - Testing Guide

## Quick Test (5 minutes)

### Test Case 1: Teacher Currently Logged In Gets Adviser Role

**Setup:**
- Have a teacher account ready (email: test.teacher@cnhs.edu)
- Have admin account ready

**Steps:**

1. **Teacher Login (First Terminal/Tab)**
   ```
   Visit: http://localhost:3001/teacher-login.html
   Email: test.teacher@cnhs.edu
   Password: [teacher password]
   Click: Login
   Expected: Redirects to teacher-dashboard.html (Enrolled Students page)
   ```

2. **Keep Teacher Dashboard Open**
   - Leave this tab/window open
   - Dashboard is polling for role changes every 5 seconds

3. **Admin Assign Role (Second Terminal/Tab)**
   ```
   Visit: http://localhost:3001/admin-dashboard.html
   Login: [admin credentials]
   Navigate: Manage Teachers → Teacher Registration
   Find: test.teacher@cnhs.edu in the table
   Click: 🔗 ASSIGN button
   Modal Opens: Assign Role modal
   ```

4. **Fill Assign Role Form**
   ```
   Role: Select "Adviser"
   School Year: Select a school year (e.g., "2024-2025")
   Sections: Select 1-2 sections (e.g., "JHS-A1", "JHS-B2")
   Click: Save
   ```

5. **Success Alert**
   ```
   Expected Alert:
   ───────────────────────────────────────────
   "Role assigned successfully!
   
   ✓ Teacher assigned as Adviser
   ✓ Sections assigned to teacher
   ✓ Teacher's dashboard will auto-update
   
   The teacher's dashboard will automatically
   change to the Adviser Dashboard within 5 seconds
   when they next visit or upon page refresh."
   ───────────────────────────────────────────
   
   Click: OK
   ```

6. **Watch Teacher Dashboard Auto-Sync**
   ```
   Switch back to Teacher Dashboard tab
   Wait 0-5 seconds...
   
   Expected: Page AUTOMATICALLY redirects to adviser-dashboard.html
   
   You should see:
   ───────────────────────────────────────────
   📚 Adviser Dashboard
   Welcome, [Teacher Name]
   
   Dashboard Overview:
   - Total Sections: 2
   - Total Students: [count]
   - Notifications: 0
   ───────────────────────────────────────────
   ```

7. **Verify Adviser Dashboard**
   - Sections tab shows assigned sections
   - Overview stats are populated
   - Logout button works
   - URL is adviser-dashboard.html

**✅ Test Passed If:**
- Teacher dashboard automatically redirected to adviser dashboard
- No manual refresh required
- Redirect happened within 5 seconds
- Adviser dashboard displays correctly

---

## Detailed Test Cases

### Test Case 2: Teacher Logs In After Role Assignment

**Setup:**
- Teacher not yet logged in
- Admin has already assigned teacher as adviser with sections

**Steps:**

1. **Admin assigns role first**
   ```
   Follow Test Case 1 steps 1-5, but use a different teacher
   who is NOT currently logged in
   ```

2. **Teacher logs in after assignment**
   ```
   Visit: http://localhost:3001/teacher-login.html
   Email: [the newly assigned adviser teacher]
   Password: [password]
   Click: Login
   ```

3. **Expected Result:**
   ```
   Login endpoint checks role: returns "adviser"
   Login handler detects role = "adviser"
   Browser REDIRECTS to adviser-dashboard.html
   
   Expected: Land directly on adviser-dashboard.html
   No teacher-dashboard shown at all
   ```

**✅ Test Passed If:**
- Teacher lands directly on adviser-dashboard.html
- No redirect delay
- User data properly stored in localStorage

---

### Test Case 3: Role Change Detection (Role Removed)

**Setup:**
- Teacher assigned as adviser, currently viewing adviser-dashboard.html
- Admin will remove adviser role

**Steps:**

1. **Teacher on Adviser Dashboard**
   ```
   Follow Test Case 1 completely
   Stop at step 7 with adviser dashboard open
   Leave this tab open
   ```

2. **Admin Removes Adviser Role**
   ```
   In admin dashboard, find the same teacher
   (This would require an "Edit" or "Remove Role" button)
   OR directly in database:
   UPDATE teachers SET role = NULL WHERE email = 'test.teacher@cnhs.edu'
   ```

3. **Watch Adviser Dashboard**
   ```
   Wait 0-5 seconds for next polling cycle
   
   Expected: Page AUTOMATICALLY redirects to teacher-dashboard.html
   The adviser dashboard detects role change
   ```

**✅ Test Passed If:**
- Adviser dashboard automatically redirected to teacher dashboard
- Detection happened within 5 seconds
- User is back at regular teacher view

---

### Test Case 4: Multiple Teachers with Different Roles

**Setup:**
- Multiple teacher accounts
- Assign different roles to different teachers

**Steps:**

1. **Create 3 teacher accounts**
   ```
   T1: teacher1@cnhs.edu - Will be assigned Adviser
   T2: teacher2@cnhs.edu - Will remain regular teacher
   T3: teacher3@cnhs.edu - Will be assigned Subject Teacher
   ```

2. **All three log in simultaneously**
   ```
   Open 3 browser tabs/windows
   Each logs in with different teacher account
   ```

3. **Each gets different dashboard**
   ```
   T1: teacher-dashboard.html (pending assignment)
   T2: teacher-dashboard.html (regular teacher)
   T3: teacher-dashboard.html (regular teacher)
   ```

4. **Admin assigns roles**
   ```
   T1 → Assign as Adviser
   T3 → Assign as Subject Teacher
   T2 → Leave as regular teacher
   ```

5. **Dashboards auto-sync**
   ```
   Wait 5 seconds...
   
   T1 should redirect to: adviser-dashboard.html
   T2 should remain on: teacher-dashboard.html
   T3 should redirect to: subject-teacher-dashboard.html
   (when that dashboard exists)
   ```

**✅ Test Passed If:**
- Each teacher sees appropriate dashboard
- Role assignments are independent
- Email uniqueness preserved

---

## Browser Console Testing

### Monitor Polling Activity

**Open Browser Console:**
```
F12 or Right-click → Inspect → Console
```

**Look for these logs:**
```
[Adviser Dashboard] Starting role polling...
[Adviser Dashboard] Role changed from "null" to "adviser"
```

OR on teacher dashboard:
```
startRolePolling called
Checking role via probeTeacherRoleOnce()
Role detected: adviser
Redirecting to adviser-dashboard.html
```

### Manual API Test

**In Browser Console:**
```javascript
// Test the new endpoint directly
fetch('/api/teacher-auth/current-role/test.teacher%40cnhs.edu')
  .then(r => r.json())
  .then(d => console.log(d))

// Expected response:
// {
//   success: true,
//   teacher: {
//     id: 5,
//     email: "test.teacher@cnhs.edu",
//     role: "adviser",
//     ...
//   }
// }
```

### Storage Verification

**In Browser Console:**
```javascript
// Check localStorage
console.log(JSON.parse(localStorage.getItem('loggedInUser')))

// Should show:
// {
//   id: 5,
//   email: "test.teacher@cnhs.edu",
//   role: "adviser",
//   type: "teacher",
//   name: "Test Teacher"
// }
```

---

## Network Testing

### Monitor API Calls

**Open Browser DevTools:**
1. Go to Network tab
2. Filter by XHR/Fetch
3. Watch for `/api/teacher-auth/current-role/` calls
4. Should see new call every 5 seconds when dashboard is open

### Expected Network Pattern

```
Time    Request                              Status    Size
────────────────────────────────────────────────────────────
0:00s   /teacher-login                       200       150B
0:02s   /api/teacher-auth/current-role/...  200       250B
0:07s   /api/teacher-auth/current-role/...  200       250B
0:12s   /api/teacher-auth/current-role/...  200       250B
0:17s   /api/teacher-auth/current-role/...  200       250B
        (continues every 5 seconds)
```

### Check Request Headers

```
GET /api/teacher-auth/current-role/test.teacher%40cnhs.edu HTTP/1.1
Host: localhost:3001
Cache-Control: no-store
Connection: keep-alive
```

---

## Stress Test (Optional)

### Test with Delayed Role Assignment

**Purpose:** Verify polling continues even if there's a delay

**Steps:**
1. Teacher logs in
2. Wait 30 seconds before admin assigns role
3. Verify auto-sync still works after delay
4. Expected: Redirect happens on next poll cycle

### Test with Network Interruption

**Purpose:** Verify polling recovers from connection loss

**Steps:**
1. Teacher on adviser dashboard
2. Disconnect network (offline mode)
3. Wait 5 seconds
4. Reconnect network
5. Expected: Polling resumes automatically

---

## Database Verification

### Check Role Was Updated

**In Terminal (if you have DB access):**
```sql
SELECT id, email, role FROM teachers WHERE email = 'test.teacher@cnhs.edu';

-- Should return:
-- id | email                    | role
-- 5  | test.teacher@cnhs.edu   | adviser
```

### Check Section Assignments

```sql
SELECT teacher_id, section_id, school_year_id FROM teacher_section_assignments 
WHERE teacher_id = 5;

-- Should return multiple rows for assigned sections
```

---

## Checklist: Before Going Live

- [ ] API endpoint `/api/teacher-auth/current-role/:email` responds correctly
- [ ] Teacher login stores email in localStorage
- [ ] Teacher dashboard polling starts automatically on page load
- [ ] Adviser dashboard polling starts automatically on page load
- [ ] Test Case 1 passes (role change while logged in)
- [ ] Test Case 2 passes (login after role assigned)
- [ ] Test Case 3 passes (role revocation)
- [ ] Test Case 4 passes (multiple teachers)
- [ ] Browser console shows no JavaScript errors
- [ ] Network tab shows periodic /current-role/ calls
- [ ] Success message explains auto-sync clearly
- [ ] Adviser dashboard displays sections correctly
- [ ] Logout functionality works
- [ ] Page refresh doesn't lose user data
- [ ] Multiple browser tabs don't cause conflicts

---

## Troubleshooting Test Failures

### Issue: Redirect not happening

**Checklist:**
```
☐ Is role polling running? (check console)
☐ Is email in localStorage? (check in console)
☐ Does /current-role/:email endpoint respond?
  Test: curl http://localhost:3001/api/teacher-auth/current-role/test%40email.com
☐ Is the returned role correct?
☐ Is the polling interval short enough? (should be 5s max)
```

**Solution:**
```javascript
// In browser console, force a check:
window.location.href = 'adviser-dashboard.html';
// Or manually trigger the role check
```

### Issue: Adviser dashboard doesn't load

**Checklist:**
```
☐ Does adviser-dashboard.html file exist?
☐ Are there JavaScript errors? (check console)
☐ Is the API returning adviser data?
  Test: /api/adviser-dashboard/sections-teacher/5
☐ Is sessionStorage populated?
```

**Solution:**
```
Clear browser cache and cookies
Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
Check console for specific error messages
```

### Issue: Role polling not starting

**Checklist:**
```
☐ Is the page fully loaded? (DOMContentLoaded fired)
☐ Is email/user data in storage?
☐ Are there JavaScript errors?
☐ Is the polling interval correct? (should be 5000ms)
```

**Solution:**
```javascript
// Manually start polling in console:
startRolePolling();
```

---

## Performance Monitoring

### Expected Metrics

```
Page Load Time:        <2 seconds
First Poll:            <100 ms
Subsequent Polls:      <50 ms
Dashboard Redirect:    <500 ms
Memory per Dashboard:  <2 MB
Network per Poll:      ~100 bytes
```

### Monitor in DevTools

```
Performance tab:
1. Click Record
2. Wait for 2 role polling cycles (10 seconds)
3. Stop Recording
4. Check timeline for consistent 5-second intervals
5. Look for XHR calls at regular intervals
```

---

## Sign-Off

**Test Completed By:** ________________  
**Date:** ________________  
**All Tests Passed:** ☐ Yes ☐ No  
**Issues Found:** [List any issues]  
**Notes:** [Any additional notes]

