# Enrollment Form Testing Guide

## Quick Start Test

### 1. Landing Page → Login → Dashboard → Enrollment

**Steps:**
1. Open `index.html` in browser
2. Click "Get Started" button
3. Redirect to `auth.html?role=student`
4. Login with test credentials:
   - **New Student**: Click "Register here", fill form, register
   - **Returning Student**: Use registered credentials
   - Test Email: `student@test.com`
   - Test Password: `password123`
5. After login, you'll be in `student-dashboard.html`
6. Look for "Enroll Now" button in the top right of dashboard header
7. Click "Enroll Now" → Opens `enrollment-form.html`

---

## Feature-by-Feature Testing

### Test 1: LRN Section
**Expected Behavior:**
- By default, LRN input field is hidden (has `hidden` class)
- When "Yes" is selected → LRN input field appears
- When "No" is selected → LRN input field disappears

**Test Steps:**
1. Open enrollment form
2. In "Learner Reference Number" section, select "No" → Input should be hidden
3. Select "Yes" → 12-digit input field should appear
4. Type "123456789012" in the field
5. Select "No" again → Field should disappear

**Expected Result:** ✅ Field visibility toggles correctly

---

### Test 2: Returning Learner Section
**Expected Behavior:**
- By default, returning learner fields are hidden
- When "Yes" is selected → Shows Grade Level, School Year, School ID
- When "No" is selected → Fields disappear

**Test Steps:**
1. Scroll to "Returning Learner/Transferee" section
2. Select "No" → Dependent fields should be hidden
3. Select "Yes" → Grade Level dropdown, School Year, and School ID fields appear
4. Select dropdown options and fill fields
5. Select "No" again → Fields hide

**Expected Result:** ✅ Fields toggle based on selection

---

### Test 3: Learner Information Section
**Expected Behavior:**
- Required fields: First Name, Last Name, Sex, Place of Birth, Mother Tongue
- Date of Birth field should auto-calculate age
- All fields remain visible (no conditional logic)

**Test Steps:**
1. Fill in Learner Information:
   - Last Name: "Dela Cruz"
   - First Name: "Juan"
   - Middle Name: "Santos" (optional)
   - Birth Date: "2010-05-15"
   - Sex: "Male"
   - Place of Birth: "Manila"
   - Mother Tongue: "Filipino"
2. After entering birth date, verify Age field auto-populates
3. Verify all fields have proper formatting

**Expected Result:** ✅ Age auto-calculates, all fields accept input

---

### Test 4: IP (Indigenous People) Status
**Expected Behavior:**
- "Yes" selection shows IP Group dropdown
- IP Group dropdown includes options + "Other"
- "Other" option triggers additional text input
- "No" selection hides all dependent fields

**Test Steps:**
1. Select "Yes" for IP status → Dropdown appears
2. Select "Aeta" from dropdown → No text field appears
3. Select "Other" → Text input field appears
4. Type "Igorot" in the text field
5. Change to "No" → All dependent fields disappear

**Expected Result:** ✅ Conditional fields work as expected

---

### Test 5: 4Ps Beneficiary
**Expected Behavior:**
- "Yes" selection shows Household ID field
- "No" selection hides the field

**Test Steps:**
1. Select "Yes" for 4Ps → Household ID field appears
2. Enter "HH12345678"
3. Select "No" → Field disappears

**Expected Result:** ✅ Field visibility toggles

---

### Test 6: PWD (Disability) Status
**Expected Behavior:**
- "Yes" selection shows disability checkboxes
- Multiple checkboxes can be selected
- "No" selection hides checkbox list

**Test Steps:**
1. Select "Yes" for PWD → Checkboxes appear:
   - Visual Impairment
   - Hearing Impairment
   - Speech Impairment
   - Physical Disability
   - Psychosocial Disability
   - Intellectual Disability
2. Select multiple checkboxes
3. Uncheck some options
4. Select "No" → All checkboxes disappear

**Expected Result:** ✅ Checkboxes appear/disappear correctly

---

### Test 7: Grade Level & Senior High Fields
**Expected Behavior:**
- Grade Level 7-10: Only shows grade dropdown
- Grade Level 11-12: Shows Semester and Track dropdowns, triggers Electives section

**Test Steps:**
1. Select Grade 7 → No additional fields appear
2. Select Grade 11 → Semester and Track dropdowns appear
3. Select Grade 12 → Semester and Track dropdowns appear
4. Select "1st Semester" for Semester
5. Change back to Grade 7 → Senior high fields disappear

**Expected Result:** ✅ Senior high fields only show for grades 11-12

---

### Test 8: Academic Track Electives
**Expected Behavior:**
- Shows 5 categories of academic electives
- Max 2 selections allowed
- Attempting 3rd selection shows error message
- Selected items persist until unchecked

**Test Steps:**
1. Grade Level: Select "11"
2. Semester: Select "1st Semester"
3. Track: Select "Academic"
4. Electives section populates with categories:
   - Arts, Social Sciences, & Humanities
   - Business & Entrepreneurship
   - Sports, Health, & Wellness
   - Science, Technology, Engineering, & Mathematics
   - Field Experience
5. Select 2 electives from different categories
6. Attempt to select a 3rd elective → Alert: "You can select a maximum of 2 academic electives"
7. Uncheck one → Can now select another

**Expected Result:** ✅ Max 2 electives enforced with alert

---

### Test 9: Tech-Pro Track Electives
**Expected Behavior:**
- Shows 5 categories of tech-pro electives
- Max 1 selection allowed
- Alert appears when trying to select 2nd item

**Test Steps:**
1. Grade Level: Select "12"
2. Semester: Select "2nd Semester"
3. Track: Select "Tech-Pro"
4. Electives section populates with categories:
   - Information & Computer Technology
   - Industrial Arts
   - Agriculture & Fishery Arts
   - Family & Consumer Science
   - Maritime
5. Select 1 elective
6. Attempt to select another → Alert: "You can select only 1 Tech-Pro elective"
7. Uncheck → Can select a different one

**Expected Result:** ✅ Max 1 elective enforced

---

### Test 10: Doorway Track Electives
**Expected Behavior:**
- Shows both Academic and Tech-Pro sections separately
- Max 1 academic + 1 tech-pro selection required
- Attempting more than max shows appropriate alert

**Test Steps:**
1. Grade Level: Select "11"
2. Semester: Select "1st Semester"
3. Track: Select "Doorway"
4. Two sections appear:
   - Academic Electives section
   - Tech-Pro Electives section
5. Select 1 academic elective
6. Try selecting another academic → Alert: "You can select only 1 academic elective"
7. Select 1 tech-pro elective
8. Try selecting another tech-pro → Alert: "You can select only 1 Tech-Pro elective"

**Expected Result:** ✅ Correct elective limits enforced for doorway

---

### Test 11: Current Address Fields
**Expected Behavior:**
- All address fields remain visible (no conditional logic)
- Country pre-filled with "Philippines"
- Accepts text input for all fields

**Test Steps:**
1. Scroll to "Current Address" section
2. Fill in:
   - Sitio: "Purok 1"
   - Barangay: "San Jose" (required)
   - Municipality: "Tagaytay" (required)
   - Province: "Cavite" (required)
   - Zip Code: "4120"
3. Verify Country field is pre-filled with "Philippines"

**Expected Result:** ✅ All fields accept input, country pre-filled

---

### Test 12: Permanent Address Auto-Copy
**Expected Behavior:**
- "Same as Current Address" checkbox unchecked by default
- When checked → Copies all current address values to permanent address
- When unchecked → Permanent address remains unchanged
- Manual editing of permanent address works independently

**Test Steps:**
1. Fill Current Address:
   - Sitio: "Purok 2"
   - Barangay: "San Roque"
   - Municipality: "Tagaytay"
   - Province: "Cavite"
   - Country: "Philippines"
   - Zip Code: "4120"
2. Check "Same as Current Address" → All fields in Permanent Address auto-populate
3. Manually change a Permanent Address field
4. Verify it retained the manual change
5. Uncheck the checkbox → No data changes
6. Re-check → Data copies again

**Expected Result:** ✅ Auto-copy works bi-directionally on checkbox

---

### Test 13: Parent/Guardian Information
**Expected Behavior:**
- All fields are optional
- Fields can accept text input
- Relationship dropdown has predefined options

**Test Steps:**
1. Leave fields blank (optional test)
2. Fill in:
   - Name: "Maria Dela Cruz"
   - Relationship: "Mother"
   - Contact: "09171234567"
   - Occupation: "Teacher"
3. Verify all fields accept input

**Expected Result:** ✅ Optional fields work as expected

---

### Test 14: Learning Modality Selection
**Expected Behavior:**
- 7 options available (radio buttons)
- Only one can be selected
- Selection is required for form submission

**Test Steps:**
1. Select "Face-to-face"
2. Try selecting another → Previous deselects, new one selected
3. Verify options:
   1. Face-to-face
   2. Blended Learning
   3. Fully Online
   4. Modular Distance Learning
   5. TV-based Learning
   6. Radio-based Learning
   7. Print-based Learning

**Expected Result:** ✅ Radio buttons work correctly (mutually exclusive)

---

### Test 15: Certification & Data Privacy
**Expected Behavior:**
- Both checkboxes required for submission
- Attempting submit without checking shows error message

**Test Steps:**
1. Don't check either checkbox
2. Click "Review and Submit Enrollment" button
3. Alert should show: "You must agree to the certification and data privacy agreement"
4. Check the certification checkbox
5. Click submit again → Should proceed to review modal

**Expected Result:** ✅ Validation works correctly

---

### Test 16: Form Validation Before Submit
**Expected Behavior:**
- Required fields validation
- Grade 11-12 specific validations
- Elective requirement validations
- Error messages for each validation failure

**Test Steps - Scenario 1: Missing Grade 11-12 Track**
1. Grade Level: "11"
2. Semester: "1st Semester"
3. Track: Leave empty
4. Click "Review and Submit"
5. Alert: "Please select a track"

**Test Steps - Scenario 2: Missing Academic Electives**
1. Grade Level: "11"
2. Semester: "1st Semester"
3. Track: "Academic"
4. No electives selected
5. Check certification
6. Click "Review and Submit"
7. Alert: "Please select at least 1 academic elective"

**Test Steps - Scenario 3: Grade 7-10 with electives section hidden**
1. Grade Level: "9"
2. Certification checked
3. Click "Review and Submit"
4. Should show review modal (electives not required)

**Expected Result:** ✅ All validations trigger appropriately

---

### Test 17: Review Modal Display
**Expected Behavior:**
- Modal shows summary of entered data
- Displays organized sections
- Shows learner info, grade/track, address, learning modality
- Has "Edit" and "Confirm" buttons

**Test Steps:**
1. Fill minimal required fields:
   - First Name: "John"
   - Last Name: "Doe"
   - Birth Date: "2010-01-15"
   - Sex: "Male"
   - Place of Birth: "Manila"
   - Current Address: Fill all required fields
   - Learning Modality: Select one
   - Certification: Check
2. Click "Review and Submit Enrollment"
3. Review Modal opens showing:
   - Learner Information section
   - Enrollment Details section
   - Address section
   - Learning Modality section

**Expected Result:** ✅ Modal displays with organized summary

---

### Test 18: Edit Button in Modal
**Expected Behavior:**
- Clicking "Back to Form" button closes modal
- Returns to form with all entered data preserved
- Form can be edited and re-submitted

**Test Steps:**
1. Fill form partially
2. Click "Review and Submit"
3. Review modal opens
4. Click "Back to Form" button
5. Modal closes, form visible with all data intact
6. Edit a field (e.g., change name)
7. Click "Review and Submit" again
8. Modal shows updated data

**Expected Result:** ✅ Edit button preserves and returns to form

---

### Test 19: Form Submission & localStorage
**Expected Behavior:**
- Clicking "Confirm and Submit" saves to localStorage
- Data saved under 'enrollments' key
- Creates new enrollment record with timestamp
- Shows success message
- Redirects to student-dashboard.html

**Test Steps:**
1. Fill complete form with all required data
2. Click "Review and Submit"
3. Review modal shows data
4. Click "Confirm and Submit"
5. Browser shows: "✅ Enrollment submitted successfully!"
6. Auto-redirects to student-dashboard.html
7. Open browser DevTools → Application → localStorage
8. Find 'enrollments' key
9. Verify it contains JSON array with submitted enrollment

**Expected Result:** ✅ Data saves and redirect works

---

### Test 20: Responsive Design
**Expected Behavior:**
- Form adapts to different screen sizes
- Mobile: Single column layout
- Tablet: 2 column layout where appropriate
- Desktop: Full width optimization

**Test Steps:**
1. Open enrollment form in desktop view (1200px+)
2. Resize to tablet (768px)
3. Verify form sections stack properly
4. Resize to mobile (375px)
5. Verify:
   - Inputs stack vertically
   - Buttons are full width
   - Text is readable
   - No horizontal scrolling

**Expected Result:** ✅ Layout adapts responsively

---

## Data Structure Test

### localStorage Verification
```javascript
// Open DevTools Console and run:
const enrollments = JSON.parse(localStorage.getItem('enrollments'));
console.log(enrollments);

// Expected structure:
{
    enrollments: [
        {
            studentID: "STU001",
            studentName: "Juan Dela Cruz",
            enrollmentDate: "2024-01-15T10:30:00.000Z",
            status: "pending",
            enrollmentData: {
                hasLRN: "yes",
                lrn: "123456789012",
                returningLearner: "no",
                firstName: "Juan",
                lastName: "Dela Cruz",
                middleName: "Santos",
                birthdate: "2010-05-15",
                age: "14",
                sex: "Male",
                placeOfBirth: "Manila",
                motherTongue: "Filipino",
                isIP: "no",
                is4Ps: "no",
                hasPWD: "no",
                gradeLevel: "11",
                semester: "1st Semester",
                track: "Academic",
                academicElectives: ["Computer Programming", "Advanced Mathematics"],
                currentSitio: "Purok 1",
                currentBarangay: "San Jose",
                currentMunicipality: "Tagaytay",
                currentProvince: "Cavite",
                currentCountry: "Philippines",
                currentZipCode: "4120",
                permanentSitio: "Purok 1",
                permanentBarangay: "San Jose",
                permanentMunicipality: "Tagaytay",
                permanentProvince: "Cavite",
                permanentCountry: "Philippines",
                permanentZipCode: "4120",
                learningModality: "Face-to-face",
                certification: "on"
            }
        }
    ]
}
```

---

## Common Issues & Solutions

### Issue: Electives not appearing
**Solution**: 
- Verify Grade Level is 11 or 12
- Verify Track is selected
- Check browser console for JavaScript errors

### Issue: Address auto-copy not working
**Solution**:
- Verify checkbox ID is `sameAsCurrentAddress`
- Ensure all address fields have correct IDs
- Check that current address is filled before checking

### Issue: Modal won't open
**Solution**:
- Verify certification checkbox is checked
- Verify form validation passes
- Check browser console for errors

### Issue: Redirect to dashboard not working
**Solution**:
- Verify student-dashboard.html exists in same directory
- Check browser console for redirect errors
- Verify localStorage was saved properly

---

## Performance Testing

### Load Time
- Form should load in under 1 second
- Electives should render in under 500ms
- Modal should appear instantly

### Memory Usage
- Form data in localStorage should be under 10KB per enrollment
- No memory leaks from event listeners

### Browser Compatibility
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

---

## Success Criteria

### All tests pass when:
- ✅ All conditional fields toggle correctly
- ✅ Electives populate dynamically for all tracks
- ✅ Max elective selections enforced with alerts
- ✅ Address auto-copy works
- ✅ Form validation prevents invalid submissions
- ✅ Review modal displays complete summary
- ✅ Data saves to localStorage with correct structure
- ✅ Redirect to dashboard succeeds
- ✅ Responsive design works on all screen sizes
- ✅ No JavaScript errors in console

---

## Browser Console Testing

### Check for errors:
1. Open DevTools (F12)
2. Go to Console tab
3. Submit form
4. Should show NO errors or warnings
5. Should show successful localStorage save

### Test localStorage:
```javascript
// View all enrollments
JSON.parse(localStorage.getItem('enrollments'))

// View specific enrollment
const enrollments = JSON.parse(localStorage.getItem('enrollments'));
console.log(enrollments[enrollments.length - 1])

// Clear all enrollments
localStorage.removeItem('enrollments')
```

---

## End-to-End User Flow

1. **Start**: Landing page (index.html)
2. **Registration**: Create new student account
3. **Login**: With registered credentials
4. **Dashboard**: View dashboard with profile
5. **Enroll**: Click "Enroll Now" button
6. **Form**: Fill enrollment form (10-15 minutes)
7. **Review**: Check summary in modal
8. **Confirm**: Submit enrollment
9. **Success**: Redirect to dashboard with confirmation
10. **Verify**: Check localStorage for saved enrollment

---

## Sign-off Checklist

- [ ] All 20 feature tests passed
- [ ] Data structure validated
- [ ] Responsive design verified
- [ ] No console errors
- [ ] localStorage saves correctly
- [ ] Redirect to dashboard works
- [ ] Browser compatibility confirmed
- [ ] Performance acceptable
- [ ] Ready for deployment


