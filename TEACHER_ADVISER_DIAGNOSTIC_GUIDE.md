# Teacher Adviser Dashboard Auto-Sync - Diagnostic Guide

## Quick Diagnosis Steps

If the teacher dashboard is not automatically updating after role assignment, follow these steps to diagnose:

### Step 1: Enable Browser Console Logging

1. Open the teacher-dashboard.html in a browser
2. Press **F12** or **Ctrl+Shift+I** to open Developer Tools
3. Go to the **Console** tab
4. Look for blue messages starting with `[Teacher Dashboard]` or `[Teacher Login]`

### Step 2: Check Initial Logs After Page Load

You should see messages like:

```
[Teacher Dashboard] Page loaded, starting role polling...
[Teacher Dashboard] localStorage.loggedInUser: {...}
[Teacher Dashboard] sessionStorage.teacherData: {...}
[Teacher Dashboard] DOMContentLoaded fired
[Teacher Dashboard] Starting role polling...
[Teacher Dashboard] Probing role...
```

**If you see these messages:** ✅ Polling is starting  
**If you DON'T see these messages:** ❌ Page load event isn't firing or functions aren't defined

### Step 3: Check Stored User Data

In the browser console, run:

```javascript
console.log('Stored user:', JSON.parse(localStorage.getItem('loggedInUser')))
```

**Expected output:**
```javascript
{
  id: 5,
  email: "teacher@example.com",
  role: null,                    // or whatever their current role is
  type: "teacher",
  name: "Teacher Name"
}
```

**If email is missing:** ❌ This is why polling fails - email is required

### Step 4: Check Role Probe Results

Look for messages like:

```
[Teacher Dashboard] Probing role...
[Teacher Dashboard] Found stored email: teacher@example.com
[Teacher Dashboard] current-role endpoint returned status: 200
[Teacher Dashboard] Got role from current-role endpoint: adviser
[Teacher Dashboard] Normalized role: adviser
```

**Status 200 with role 'adviser':** ✅ Endpoint is working  
**Status 404:** ❌ Teacher not found in database  
**Status 5xx:** ❌ Server error  
**No response:** ❌ Endpoint not found or network issue

### Step 5: Check Role Comparison

Look for:

```
[Teacher Dashboard] Initial probe result: adviser
[Teacher Dashboard] Normalized role: adviser
[Teacher Dashboard] ADVISER ROLE DETECTED - Redirecting to adviser-dashboard.html
```

**If you see the redirect message:** ✅ Polling detected role, redirect initiated  
**If you see role but NO redirect message:** ❌ Role comparison failed

### Step 6: Check Polling Intervals

After initial check, you should see messages every 5 seconds:

```
[Teacher Dashboard] Poll result - Role: adviser | Last: adviser
```

**Repeating every 5 seconds:** ✅ Polling is active  
**Not repeating:** ❌ Polling interval not started

---

## Common Issues & Solutions

### Issue 1: "No stored user data found"

**Problem:** Email not in localStorage  
**Cause:** Teacher logged in before role polling code was updated

**Solution:**
```javascript
// Manually test role check by email
fetch('/api/teacher-auth/current-role/teacher%40example.com')
  .then(r => r.json())
  .then(d => console.log('Role:', d.teacher?.role))
```

### Issue 2: "current-role endpoint returned status 404"

**Problem:** Teacher email doesn't match database  
**Cause:** Email mismatch or teacher doesn't exist in teachers table

**Solution:**
1. Verify email in login matches teachers table email
2. Check if teacher was created in admin dashboard or self-signup

### Issue 3: Role detected but no redirect

**Problem:** Normalization or comparison failing  
**Cause:** Role value is different (e.g., "Adviser" with capital A)

**Solution:** Check exact role value in logs:
```javascript
// In console
fetch('/api/teacher-auth/current-role/teacher%40example.com')
  .then(r => r.json())
  .then(d => {
    const role = d.teacher.role;
    console.log('Role:', role);
    console.log('Type:', typeof role);
    console.log('Normalized:', String(role).toLowerCase());
  })
```

### Issue 4: Endpoint returns 5xx error

**Problem:** Server error in endpoint  
**Cause:** Database connection issue or query error

**Solution:**
1. Check server logs for error details
2. Restart the server
3. Verify database connection is working

---

## Test the Endpoint Directly

### Method 1: Browser Console

```javascript
// Replace teacher@example.com with actual email
const email = 'teacher@example.com';
const url = `/api/teacher-auth/current-role/${encodeURIComponent(email)}`;

fetch(url, { cache: 'no-store' })
  .then(r => {
    console.log('Status:', r.status);
    return r.json();
  })
  .then(d => {
    console.log('Response:', d);
    if (d.teacher) {
      console.log('Role:', d.teacher.role);
    }
  })
  .catch(err => console.error('Error:', err))
```

### Method 2: cURL (if you have access to terminal)

```bash
curl http://localhost:3001/api/teacher-auth/current-role/teacher%40example.com
```

**Expected Response:**
```json
{
  "success": true,
  "teacher": {
    "id": 5,
    "teacher_id": "T001",
    "name": "Teacher Name",
    "email": "teacher@example.com",
    "role": "adviser",
    "account_status": "active"
  }
}
```

---

## Debug Checklist

Before reporting an issue, verify:

- [ ] Teacher can log in successfully
- [ ] Login stores email in localStorage (check in Step 3)
- [ ] Direct endpoint test works (Step 4)
- [ ] Browser console shows detailed logs (Step 1)
- [ ] Role polling interval is active (Step 6)
- [ ] Admin can assign adviser role via modal (check admin logs too)
- [ ] Role value in database matches expected (e.g., 'adviser' not 'Adviser')

---

## Collecting Logs for Diagnosis

To help troubleshoot, collect these logs:

1. **Browser Console Output**
   - Open F12 → Console
   - Right-click → Select all → Copy
   - Paste into diagnostic report

2. **API Endpoint Test**
   - Run the endpoint test from Method 1 above
   - Copy the full response JSON

3. **Server Logs**
   - Check server terminal for any errors
   - Look for `Error fetching teacher role:` messages

4. **Database Check**
   ```sql
   SELECT id, email, role FROM teachers WHERE email = 'teacher@example.com';
   ```

---

## Performance Notes

**Normal Behavior:**
- First probe: < 500ms
- Each 5-second poll: < 100ms
- Redirect upon role change: < 1 second

**If you see delays > 1 second:**
- Check network latency
- Review browser network tab (F12 → Network)
- Check server performance

---

## Next Steps

1. Follow the diagnostic steps above
2. Check browser console and note what you see
3. Test the endpoint directly
4. Compare with expected messages above
5. If still not working, provide:
   - Browser console output (full)
   - API endpoint test result
   - Server logs
   - Database query result for the teacher record

