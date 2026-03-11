# Real-Time Update Troubleshooting Guide

## Issue: Students Not Appearing After Track/Elective Change

If students edited in the Student Directory don't automatically appear in Section Assignment, follow this troubleshooting guide.

---

## Step 1: Enable Console Logging

1. Open **Admin Dashboard**
2. Press **F12** to open Developer Tools
3. Go to **Console** tab
4. Clear the console with `console.clear()`

---

## Step 2: Edit a Student and Observe Console

1. Click **Student Management** → **Student Directory**
2. Find a **SHS student** with a **Track** assigned (e.g., "Academic")
3. Click **Edit**
4. **Change the Track** to a different value (e.g., "TechPro")
5. Click **Approve**
6. **DON'T CLOSE THE CONSOLE** - watch for logs

---

## Step 3: Read the Console Output

### Expected Success Flow

If everything is working, you should see these logs in order:

```
// Student saves changes to server
[Students] ========== PAYLOAD CONSTRUCTION CHECK ==========
[Students] ✓ Has section_id? true
[Students] ✓ section_id value? null    ← CRITICAL: Should be null

// Server responds with success
[Students] Status: 200 OK
[Students] ✓ Response successful

// Events are broadcast
[Students] === REAL-TIME EVENT EMISSION ===
[Students] Event triggers:
[Students]   - Section cleared? true
[Students]   - Track changed? true
[Students] 🎯 BROADCASTING: student_section_cleared
[Students]   Reason: track_change
[Students]   Student: John Smith (ID: 123)  ← Check ID format
[Students] ✅ Broadcast sent successfully

// Section Assignment listener receives event
[Section Assignment] 🎯 Received student_section_cleared event: {student_id: 123, ...}
[Section Assignment] Processing real-time update for: John Smith (ID: 123, Reason: track_change)
[Section Assignment] Current level filter: SHS

// Fresh data is loaded from API
[Section Assignment] ✓ Fresh student data loaded successfully
[Section Assignment]   Total students from API: 45

// Filters are applied
[Section Assignment] ✓ Filters applied, filtered students: 12

// Student is found
[Section Assignment] ✅ SUCCESS: Student found in filtered list: John Smith
[Section Assignment]   Student object: {id: 123, student_id: "123", name: "John Smith", level: "SHS", ...}

// UI is updated
[Section Assignment] ✓ Student highlighted
[Section Assignment] ✓ Count updated
```

### If You DON'T See These Logs

Go to the relevant section below:

---

## Troubleshooting: Event Not Broadcasting

### Symptom
You don't see: `[Students] 🎯 BROADCASTING: student_section_cleared`

### Diagnostic Steps

1. **Check if section is actually being cleared:**
   ```
   Look for: [Students] ✓ section_id value? null
   If shows a number instead of null → Section NOT cleared
   ```

2. **Check if track is actually changing:**
   ```
   Look for: [Students]   - Track changed? true
   If shows false → Track not actually changing
   SOLUTION: Edit modal wasn't picking up track change
   ```

3. **Check for save errors:**
   ```
   Look for: [Students] Status: 200 OK
   If shows 400/500 error → Server rejected the save
   SOLUTION: Check server logs for save errors
   ```

### Common Causes

**❌ Problem:** "Section cleared? false"
- **Cause:** Section clearing logic didn't trigger
- **Solution:** Verify you're actually changing Track or Electives
- **Action:** Try changing to a completely different value

**❌ Problem:** "Track changed? false"
- **Cause:** New track value is same as old track
- **Solution:** Make sure you're changing to a DIFFERENT track
- **Action:** Double-check the track dropdown shows different value

**❌ Problem:** "Status: 500"
- **Cause:** Server error during save
- **Solution:** Check server logs for database errors
- **Action:** Report error to IT team

---

## Troubleshooting: Event Broadcasting But Not Received

### Symptom
You see: `[Students] ✅ Broadcast sent successfully`
But DON'T see: `[Section Assignment] 🎯 Received student_section_cleared event`

### Diagnostic Steps

1. **Check if event listener is registered:**
   ```javascript
   // In console:
   window.DashboardEvents.listeners
   ```
   **Should show:**
   ```
   {
     student_section_cleared: [Function, ...],
     student_updated: [Function, ...]
   }
   ```

2. **Check if BroadcastChannel is available:**
   ```javascript
   // In console:
   window.DashboardEvents.broadcastChannel !== null
   ```
   **Should show:** `true` (if false, using fallback)

3. **Are you on the right page?**
   - Make sure Section Assignment page is open/loaded
   - If in different tab, it should still sync via BroadcastChannel

### Common Causes

**❌ Problem:** "Listener not registered"
- **Cause:** setupRealtimeEventListeners didn't run
- **Solution:** Check for JavaScript errors on page
- **Action:** Refresh page and check console for red errors

**❌ Problem:** "BroadcastChannel not available"
- **Cause:** Browser doesn't support it (very old browser)
- **Solution:** Still works with localStorage fallback (~500ms delay)
- **Action:** Try on Chrome/Firefox/Edge

**❌ Problem:** "Event received but wrong tab"
- **Cause:** BroadcastChannel only works within same origin
- **Solution:** Make sure both pages are same domain/port
- **Action:** Check URL bar for both windows

---

## Troubleshooting: Event Received But Student Not Found

### Symptom
You see: `[Section Assignment] 🎯 Received student_section_cleared event`
But see: `[Section Assignment] ⚠️ Student NOT found in filtered list`

### Diagnostic Steps

1. **Check student ID format:**
   ```
   Look at: [Section Assignment] Looking for ID: 123 Type: number
   Compare with: [Students]   Student: John Smith (ID: 123)
   Should match exactly (same type and value)
   ```

2. **Check level filter:**
   ```
   Look at: [Section Assignment] Current level filter: SHS
   Check: Is this the right level? (JHS vs SHS)
   ```

3. **Check if student is in API response:**
   ```
   Look at: [Section Assignment] Total students from API: 45
   Look at: [Section Assignment] First 5 filtered students: [...]
   Should include the student's name
   ```

4. **Check debug info:**
   ```
   Look at: [Section Assignment] First 5 filtered students:
   - If student shows here with different level → Wrong level filter
   - If student doesn't show at all → Not returned by API
   ```

### Common Causes

**⚠️ Problem:** "Student is in allStudents but NOT in filteredStudents"
- **Cause:** Student doesn't match current level filter
- **Solution:** Check the current level selector
- **Action:** Make sure you're selecting the right level (SHS/JHS)

**❌ Problem:** "Student ID mismatch"
- **Cause:** ID format different between modules
- **Example:** One module uses `123` (number), other uses `"123"` (string)
- **Solution:** String comparison should handle this
- **Action:** Check if ID has special characters

**❌ Problem:** "Student not in API response"
- **Cause:** Server didn't save section_id as null
- **Solution:** Check server side section clearing logic
- **Action:** 
  1. Open DevTools Network tab
  2. Edit student again
  3. Look for PATCH request to `/api/enrollments/by-student/...`
  4. Check Response → should show `section_id: null`

---

## Step-by-Step Test Procedure

### Complete Test From Scratch

1. **Open Two Windows:**
   - Window A: Admin Dashboard → Student Directory
   - Window B: Admin Dashboard → Section Assignment

2. **In Window A:**
   - Select **SHS** level
   - Find a student with no section assigned (or existing section)
   - Click **Edit**
   - Check current **Track** value
   - Change Track to different value
   - Click **Approve**
   - Watch console logs

3. **In Window B Console:**
   - Run: `console.clear()`
   - Watch for `[Section Assignment]` logs
   - Student should appear in list within 1-2 seconds

4. **Verify Success:**
   - ✅ Student appears in unassigned list
   - ✅ Console shows success logs
   - ✅ No red error messages
   - ✅ Count updates

---

## Advanced Debugging Commands

### Check System Status
```javascript
// Run in console
window.DashboardEvents.listeners
// Should show registered listeners
```

### Manually Test Event Broadcast
```javascript
// Run in console to simulate event
window.DashboardEvents?.broadcast('student_section_cleared', {
    student_id: 123,
    student_name: "Test Student",
    reason: "diagnostic_test",
    timestamp: Date.now()
});

// Check if listener fires
// Should see: [Section Assignment] 🎯 Received student_section_cleared event
```

### Check Section Assignment State
```javascript
// See current state
assignmentState.allStudents.length       // Total unassigned
assignmentState.filteredStudents.length  // After filters
assignmentState.currentLevel             // Current level filter
```

### Check API Response
1. Open **DevTools** → **Network** tab
2. Edit a student
3. Look for PATCH request to `/api/enrollments/by-student/...`
4. Click it and check **Response**
5. Verify: `section_id: null` in response

---

## Performance Metrics to Check

| What | Expected | Problem If |
|-----|----------|-----------|
| Event broadcast to display | < 1 second | > 3 seconds |
| Fresh data load | < 500ms | > 1 second (slow API) |
| Total end-to-end | < 2 seconds | > 3 seconds |
| Console errors | None | Any red errors |

---

## Getting More Help

### Important Information to Share

If you need to report an issue, include:

1. **Console logs** (copy full output from F12 console)
2. **Browser/OS** (Chrome, Firefox, Windows, Mac)
3. **Steps to reproduce** (exactly what you did)
4. **Screenshots** of:
   - Student before edit
   - Track/elective change made
   - Section Assignment after change
5. **Network tab capture** (F12 → Network → repeat action)

### Capture Logs to File
```javascript
// Copy all logs
copy(DebugRealtimeUpdates.exportLog())

// Paste in a .txt file and send
```

---

## Quick Reference: Log Patterns

### ✅ Success Indicator
```
[Students] 🎯 BROADCASTING: student_section_cleared
[Section Assignment] 🎯 Received student_section_cleared event
[Section Assignment] ✅ SUCCESS: Student found in filtered list
```

### ❌ Failure Indicators
```
// Section not cleared
[Students] Event triggers:
[Students]   - Section cleared? false

// Event not broadcast
// (No BROADCASTING line in logs)

// Student not found
[Section Assignment] ⚠️ Student NOT found in filtered list

// API error
[Students] Status: 500
```

---

## Still Having Issues?

1. **Check logs first** - 90% of issues show in console
2. **Run diagnostic test** - See diagnostic-realtime-test.js
3. **Try manual test** - Broadcast event manually
4. **Check server** - Verify section_id saved as null
5. **Restart** - Clear cache and refresh

**Contact IT Team with:**
- Console output
- Network trace
- Steps to reproduce
- Browser details

---

## Resources

- [REALTIME_SECTION_ASSIGNMENT_FIX.md](REALTIME_SECTION_ASSIGNMENT_FIX.md) - Technical details
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - Complete implementation guide
- [diagnostic-realtime-test.js](diagnostic-realtime-test.js) - Automated diagnosis
- [debug-realtime-updates.js](debug-realtime-updates.js) - Event logging system


