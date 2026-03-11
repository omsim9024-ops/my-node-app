# Form Submission Testing Guide

## Pre-Testing Checklist

✅ Backend server running on port 3002 or 3003  
✅ Database connection working (MySQL)  
✅ enrollment-form.html loaded at localhost:3001/enrollment-form.html  
✅ Student logged in (localStorage has studentData with id)

## Test Procedure

### Step 1: Prepare Test Data
1. Open browser DevTools (F12)
2. Go to Application → LocalStorage → localhost:3001
3. Verify `studentData` exists with an `id` field (minimum: `{"id": 1, ...}`)
   - If missing, log in first or create with: `localStorage.setItem('studentData', JSON.stringify({id: 1}))`

### Step 2: Fill Form (Minimal Required Fields)
1. **Grade Level**: Select "Grade 10" (or any grade)
2. **Returning Learner**: Select "No"
3. **LRN Status**: Select "Yes"
4. **LRN Number**: Enter "123456789012" (12 digits)
5. **Learner Info**:
   - First Name: "John"
   - Middle Name: "Patrick"
   - Last Name: "Doe"
   - Birthdate: "2010-01-15" (any past date)
   - Age: "16" (any number)
   - Sex: "Male"
   - Place of Birth: "Manila"
6. **Current Address**: Fill at least Sitio/Street and Zip Code
7. **Learning Modality**: Select any option (e.g., "Online")
8. **Agreements**: Check BOTH checkboxes:
   - ☑ Certification Agreement
   - ☑ Data Privacy Agreement

### Step 3: Click "Review and Submit Enrollment"
**Expected Behavior**:
- Form validates (all required fields highlight green)
- Modal popup appears with summary
- Shows all form data in readable format
- Shows any uploaded documents (if any)
- Shows agreement checkmarks

### Step 4: Review the Summary
Check that all fields display correctly:
- ✓ Name displays as "JOHN PATRICK DOE"
- ✓ Learning modality shows selected value
- ✓ Agreements show "✓ AGREED"

### Step 5: Click "Confirm and Submit"
**Monitor in Browser DevTools**:

#### Network Tab
1. Go to DevTools → Network tab
2. Click "Confirm and Submit"
3. Watch for POST request to `/api/enrollments`
4. Click on the request and check:
   - **Request Headers**: Contains `Content-Type: application/json`
   - **Request Payload**: Shows all form fields
   - **Response Status**: Should be `201 Created`
   - **Response Body**: Should show:
     ```json
     {
       "success": true,
       "message": "Enrollment submitted successfully",
       "enrollment_id": X
     }
     ```

#### Console Tab
1. Watch for these success logs:
   ```
   [ENROLLMENT] submitEnrollment called
   [ENROLLMENT] Prepared payload: {...}
   [ENROLLMENT] Response status: 201
   [ENROLLMENT] Response body: {...}
   [ENROLLMENT] Success! Enrollment ID: X
   ```

**Expected Result**: 
- ✅ Success notification: "✅ Enrollment submitted successfully! Your enrollment ID is X"
- ✅ Modal closes
- ✅ Page auto-redirects to student-dashboard.html

### Step 6: Verify in Database
1. Open phpMyAdmin at `localhost/phpmyadmin`
2. Click Database: `ratings`
3. Click Table: `enrollments`
4. Click "Browse"
5. Check the newest row (highest ID):
   - ✓ Should have all your submitted data
   - ✓ firstname: "John"
   - ✓ lastname: "Doe"
   - ✓ with_lrn: "Yes"
   - ✓ learner_has_disability: depends on form (likely "No" for disabled students section)
   - ✓ modality_modular_digital or modality_online or similar: 1 (others: 0)

## Debugging Failed Submissions

### Error: "Please fill in all required fields"
**Troubleshoot**:
- [ ] Grade Level selected?
- [ ] First Name filled?
- [ ] Last Name filled?
- [ ] Birthdate filled?
- [ ] Sex selected?
- [ ] Learning Modality selected?
- [ ] Both checkboxes checked?

### Error: "Column count doesn't match value count"
**Cause**: Old database schema still in use  
**Fix**: 
1. Re-run migration: `node setup-student-enrollments.js`
2. Verify enrollments table has 65 columns in phpMyAdmin

### Error: "Foreign key constraint fails"
**Cause**: This should no longer occur – we removed the grade-to-grades FK and now store the raw grade level (7–12).
If you still see this error it means the migration hasn't been applied or the database schema is stale.
**Fix**:
1. Re-run migration script: `node setup-student-enrollments.js` to drop the FK.
2. Ensure `grade_to_enroll_id` column is free-form integer (phpMyAdmin: check structure).
3. Select a grade level between 7 and 12 in the form, not an unrelated ID.

### Error: "Cannot read property 'id' of undefined"
**Cause**: Student not logged in  
**Fix**: 
```javascript
// In console, set test student
localStorage.setItem('studentData', JSON.stringify({
  id: 1,
  firstName: "Test",
  lastName: "Student"
}));
// Then reload page and try again
```

### Error: "XMLHttpRequest is not defined"
**Possible Cause**: Node.js environment (not browser)  
**Fix**: Make sure you're testing in a browser, not Node.js

### Error: "Failed to submit enrollment: URL not found"
**Cause**: Backend API not running or wrong port  
**Fix**: 
1. Start backend: `npm start`
2. Check it's running: `curl http://localhost:3002/health` (or 3003)
3. Verify API_BASE in enrollment-form.js points to correct origin

## Manual Request Testing (if form not working)

### Using Browser Console
```javascript
// Test API endpoint directly
const testData = {
  student_id: 1,
  firstName: "John",
  lastName: "Doe",
  birthdate: "2010-01-15",
  sex: "Male",
  learningModality: "online",
  hasLRN: "no",
  hasPWD: "no",
  is4Ps: "no",
  isIP: "no",
  returningLearner: "no",
  certification: true,
  dataPrivacy: true,
  currentSitio: "Test Sitio",
  currentZipCode: "1000"
};

fetch('http://localhost:3002/api/enrollments', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify(testData)
})
.then(r => r.json())
.then(data => console.log('Success:', data))
.catch(err => console.error('Error:', err));
```

## Form Field Validation Guide

### Auto-Calculated Fields
- **age**: User enters manually (not auto-calculated)
- **semester**: Default "First" if grades 11-12 selected
- **learner_has_disability**: Auto set to "No" unless disability checked

### Conditional Fields (appear when)
- LRN Number field: when "Yes" selected for "Do you have an LRN?"
- Disability type checkboxes: when "Yes" selected for "Do you have disability?"
- 4Ps Household ID: when "Yes" selected for "4Ps Beneficiary?"
- IP Group: when "Yes" selected for "Indigenous Person?"
- Last School info: when "Yes" selected for "Returning Learner?"
- Semester/Track/Electives: when Grade 11 or 12 selected

### Fields That Trigger 'Same as Current'
- All address fields auto-populate from current address when "Same as Current Address" checkbox is checked

## Performance Checklist

- [ ] Form submission takes <5 seconds
- [ ] No console errors (besides warnings)
- [ ] Network request completes with 201 status
- [ ] Data appears in database within 1 second
- [ ] Notification shows immediately after success
- [ ] Page redirect happens smoothly

## Success Verification Checklist

- [x] Form validation works (required fields enforced)
- [x] Modal displays summary correctly
- [x] Network request sends correct JSON
- [x] Backend returns 201 + enrollment_id
- [x] Data inserted in database with 65 columns
- [x] Success notification appears
- [x] Redirect to dashboard works
- [x] localStorage updated with enrollment info

---

## Quick Commands Reference

### Reset Test Data
```javascript
// Clear enrollments (WARNING: destructive)
localStorage.removeItem('enrollments');
localStorage.removeItem('enrollmentCreated');

// Set test student
localStorage.setItem('studentData', JSON.stringify({id: 1, firstName: "Test", lastName: "Student"}));
```

### Check API Endpoint
```bash
# From terminal, test if backend is running
curl http://localhost:3002/health
# Should return: OK or similar

# Test enrollment endpoint
curl -X POST http://localhost:3002/api/enrollments \
  -H "Content-Type: application/json" \
  -d '{"student_id":1,"firstName":"Test","lastName":"Student","birthdate":"2010-01-15","sex":"Male"}'
```

### Check Database
```sql
-- Count enrollments
SELECT COUNT(*) as total FROM enrollments;

-- View latest enrollment
SELECT * FROM enrollments ORDER BY id DESC LIMIT 1;

-- Check column structure
DESCRIBE enrollments;
```

---

**Last Updated**: 2026-02-25  
**Tested**: ✅ Yes - With test records ID 3 and 4


