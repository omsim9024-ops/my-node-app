# Quick Test: Teacher Adviser Automatic Role Sync

## 30-Second Test

Follow these exact steps to verify the system is working:

### Step 1: Open Teacher Dashboard
1. Go to `http://localhost:3000/teacher-dashboard.html`
2. Or log in as a regular teacher at `http://localhost:3000/teacher-login.html`
3. Open browser DevTools: Press `F12`, go to **Console** tab

### Step 2: Watch for Role Polling
In the console, you should see messages starting with `[Teacher Dashboard]`:
```
[Teacher Dashboard] Teacher dashboard loaded. Current email: teacher@example.com
[Teacher Dashboard] startRolePolling called. Will check role every 5 seconds
[Teacher Dashboard] Probing teacher role for: teacher@example.com
[Teacher Dashboard] Normalized role: null
```

### Step 3: Admin Assigns Adviser Role
In another browser/window:
1. Go to Admin Dashboard
2. Go to Teachers → Manage Advisers
3. Select a teacher and assign them the Adviser role + select a section + school year
4. Click Save

### Step 4: Watch Teacher Dashboard
Back to the teacher's browser, watch the console. Within 5 seconds you should see:
```
[Teacher Dashboard] Checking role... Current email: teacher@example.com
[Teacher Dashboard] Got role from current-role endpoint: adviser
[Teacher Dashboard] ADVISER ROLE DETECTED!
[Teacher Dashboard] Role changed from null to adviser - REDIRECTING
[Teacher Dashboard] Navigating to adviser-dashboard.html
```

### Step 5: Automatic Redirect
The page should automatically redirect to the Adviser Dashboard. You should see:
- Your sections listed
- Student counts
- Adviser-specific navigation

---

## If Automatic Redirect Doesn't Happen

### Manual Testing Option
1. Click on your profile picture in the top right
2. Select "🔄 Check for Role Update"
3. You should get a message about your role changing
4. Manually redirect should happen

### Troubleshooting

**No console messages?**
- Check that you're looking at the right tab in DevTools
- Make sure console hasn't been cleared
- Try refreshing the page (F5)

**Role stays as "null"?**
- Go to Admin Dashboard and verify the role was actually saved
- SQL check: `SELECT email, role FROM teachers WHERE email = 'teacher@example.com';`
- The role field should say `adviser` exactly

**Console shows errors?**
- Take a screenshot of the errors
- Check the diagnostic guide: TEACHER_ADVISER_DIAGNOSTIC_GUIDE.md
- Share error messages when reporting issues

**Automatic redirect isn't working but manual button works?**
- The system is working, just use the manual button as temporary workaround
- Check backend logs for any errors
- Verify polling interval is actually 5 seconds (might need browser cache clear)

---

## Database Check (Using Node.js)

If you want to verify the role was saved correctly:

```javascript
// In your Node.js console or a test script
const pool = require('./db').pool;

async function checkTeacherRole() {
  const result = await pool.query(
    'SELECT id, email, role, account_status FROM teachers WHERE email = $1',
    ['teacher@example.com']
  );
  console.log('Teacher:', result.rows[0]);
}

checkTeacherRole();
```

Expected output:
```javascript
Teacher: {
  id: 123,
  email: 'teacher@example.com',
  role: 'adviser',  // ← Should be exactly 'adviser'
  account_status: 'active'
}
```

---

## API Endpoint Test (Using Browser Console)

Test the role endpoint directly:

```javascript
// Open browser console (F12) and paste this:
fetch('/api/teacher-auth/current-role/teacher%40example.com')
  .then(r => r.json())
  .then(d => {
    console.log('Response:', d);
    console.log('Role is:', d.teacher?.role);
  })
  .catch(e => console.error('Error:', e));
```

Expected output:
```
Response: {success: true, teacher: {id: 123, email: "teacher@example.com", role: "adviser", ...}}
Role is: adviser
```

---

## Full Test Checklist

### Before Admin Assignment
- [ ] Teacher logs in
- [ ] Console shows "Normalized role: null"
- [ ] Teacher dashboard displays (no error)
- [ ] Polling message appears every 5 seconds

### After Admin Assignment
- [ ] Within 5 seconds: Console shows "ADVISER ROLE DETECTED!"
- [ ] Console shows "Navigating to adviser-dashboard.html"
- [ ] Page redirects to adviser dashboard
- [ ] Adviser dashboard displays sections and students
- [ ] No JavaScript errors in console

### Manual Button Test
- [ ] "🔄 Check for Role Update" button appears in profile dropdown
- [ ] Clicking it gives immediate feedback
- [ ] If role changed, manual redirect works

### Edge Cases
- [ ] If role removed while on adviser dashboard, redirects back
- [ ] If browser reloaded, still shows correct dashboard
- [ ] Multiple tab test: Open teacher-dashboard in two tabs, assign role - both should receive redirect

---

## Log Messages Reference

### Normal Sequence
```
[Teacher Dashboard] Teacher dashboard loaded
[Teacher Dashboard] startRolePolling called
[Teacher Dashboard] Probing teacher role for: email@domain.com
[Teacher Dashboard] Found stored email: email@domain.com
[Teacher Dashboard] current-role endpoint returned status: 200
[Teacher Dashboard] Got role from current-role endpoint: null (or adviser/subject)
[Teacher Dashboard] Normalized role: null
```

### Role Change Detected
```
[Teacher Dashboard] ADVISER ROLE DETECTED!
[Teacher Dashboard] Role changed from null to adviser
[Teacher Dashboard] Redirecting to appropriate dashboard
[Teacher Dashboard] Navigating to adviser-dashboard.html
```

### Error Cases
```
[Teacher Dashboard] No stored email found! Using fallback...
[Teacher Dashboard] Fallback failed: could not determine email
[Teacher Dashboard] Error fetching current role: [error details]
[Teacher Dashboard] API returned error: [status code]
```

---

## Success Timeline

| Time | Expected Event |
|------|--------|
| Now | Teacher logged in, dashboard loads |
| +1 sec | First role check completes |
| +2-5 sec | Admin assigns role |
| +3-8 sec | Teacher's console shows detection |
| +10 sec | Page redirects to adviser dashboard |

---

## If Still Having Issues

1. **Check diagnostic guide**: [TEACHER_ADVISER_DIAGNOSTIC_GUIDE.md](TEACHER_ADVISER_DIAGNOSTIC_GUIDE.md)
2. **Review architecture**: [TEACHER_ADVISER_AUTO_SYNC_ARCHITECTURE.md](TEACHER_ADVISER_AUTO_SYNC_ARCHITECTURE.md)  
3. **Check implementation**: [TEACHER_ADVISER_AUTO_SYNC_IMPLEMENTATION.md](TEACHER_ADVISER_AUTO_SYNC_IMPLEMENTATION.md)
4. **Run full test suite**: [TEACHER_ADVISER_AUTO_SYNC_TESTING_GUIDE.md](TEACHER_ADVISER_AUTO_SYNC_TESTING_GUIDE.md)

---

## Console Commands for Debugging

```javascript
// Check what's stored in browser
console.log('Stored user:', JSON.parse(localStorage.loggedInUser || '{}'));
console.log('Session user:', JSON.parse(sessionStorage.teacherData || '{}'));

// Manually trigger role check
fetch('/api/teacher-auth/current-role/teacher%40example.com')
  .then(r => r.json())
  .then(d => console.log(d));

// Check if polling is active (run on teacher-dashboard.html)
console.log('Polling running:', window._rolePollingInterval ? 'YES' : 'NO');

// Manually navigate
window.location.href = 'adviser-dashboard.html';
```

---

## Support Information

When requesting help, include:
1. Browser console output (F12 → Console tab)
2. Database value: `SELECT email, role FROM teachers WHERE id = ?`
3. Are you testing with NEW teacher login or existing session?
4. Is the adviser role actually assigned in admin dashboard?
5. Did you clear browser cache (Ctrl+F5)?

---

**Ready to test?** Open [teacher-dashboard.html](teacher-dashboard.html) and follow Step 1 above!

