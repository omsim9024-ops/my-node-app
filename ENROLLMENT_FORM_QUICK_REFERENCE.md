# Enrollment Form Quick Reference Guide

## File Locations & Purposes

| File | Lines | Purpose |
|------|-------|---------|
| `enrollment-form.html` | 533 | Form structure with all sections and modals |
| `enrollment-form.css` | 600+ | Complete styling and responsive design |
| `enrollment-form.js` | 624 | All dynamic behavior and logic |
| `ENROLLMENT_FORM_README.md` | - | Detailed implementation guide |
| `ENROLLMENT_FORM_TESTING.md` | - | 20 test scenarios with procedures |
| `ENROLLMENT_FORM_IMPLEMENTATION_SUMMARY.md` | - | Complete project summary |

---

## Quick Navigation

### Entry Points
- **Dashboard**: `student-dashboard.html` (has "Enroll Now" button)
- **Form**: `enrollment-form.html` (main enrollment form)
- **Back Button**: Links back to `student-dashboard.html`

### Key IDs in HTML (for JavaScript)
```
Form Elements:
- #enrollmentForm - Main form element
- #submitBtn - Submit for review button
- #confirmBtn - Confirm submission button
- #editBtn - Back to form button

Conditional Sections:
- #lrnField - LRN input (hidden by default)
- #returningLearnerFields - Returning learner fields
- #ipFields - IP status fields
- #ipOtherField - IP other text input
- #fpsFields - 4Ps fields
- #disabilityFields - PWD disability checkboxes
- #seniorHighFields - Semester, track, electives

Electives:
- #electiveSelection - Electives container (hidden by default)
- #electivesList - Where electives render

Address:
- #currentSitio, #currentBarangay, #currentMunicipality, etc.
- #permanentSitio, #permanentBarangay, #permanentMunicipality, etc.
- #sameAsCurrentAddress - Auto-copy checkbox

Modal:
- #reviewModal - Review modal container
- #enrollmentSummary - Where summary displays

Fields:
- #gradeLevel - Grade level dropdown
- #semester - Semester dropdown
- #track - Track dropdown
- #learningModality - Learning modality selection
- #certificationCheckbox - Certification checkbox
```

---

## JavaScript Function Quick Map

### Initialization
```javascript
// Called on page load
setupConditionalFields()     // Setup all conditional field listeners
setupFormValidation()       // Setup validation listeners
setupModal()                // Setup modal button listeners
setupAddressSync()          // Setup address copy listener
```

### Conditional Logic Handlers
```javascript
// All radio groups auto-trigger their handlers
hasLRN → toggles #lrnField
returningLearner → toggles #returningLearnerFields
isIP → toggles #ipFields
is4Ps → toggles #fpsFields
hasPWD → toggles #disabilityFields
gradeLevel → triggers seniorHighFields for 11-12
```

### Electives Rendering
```javascript
updateElectives()              // Main trigger function
renderAcademicElectives()      // For Academic track
renderTechProElectives()       // For Tech-Pro track
renderDoorwayElectives()       // For Doorway track
validateAcademicElectives()    // Enforce max 2
validateTechProElectives()     // Enforce max 1
validateDoorwayElectives()     // Enforce 1 of each
```

### Form Submission Flow
```javascript
validateAndSubmit()            // Main validation
  → Check certification
  → Check electives if grades 11-12
  → If valid: showReviewModal()

showReviewModal()              // Display summary modal
  → collectFormData()          // Gather values
  → generateSummaryHTML()      // Format summary
  → Display modal with edit/confirm buttons

submitEnrollment()             // Confirm submission
  → Save to localStorage
  → Show success message
  → Redirect to dashboard
```

### Utilities
```javascript
collectFormData()              // Gathers all form values
generateSummaryHTML()          // Creates formatted summary
copyCurrentToPermanentAddress() // Address sync
closeReviewModal()             // Close modal
```

---

## HTML Structure Hierarchy

```
body
├── nav.navbar
│   └── #enrollmentForm controls
├── .container
│   └── .form-wrapper
│       ├── .form-header
│       └── #enrollmentForm (form element)
│           ├── Form Section 1: LRN
│           ├── Form Section 2: Returning Learner
│           ├── Form Section 3: Learner Info
│           ├── Form Section 4: IP Status
│           ├── Form Section 5: 4Ps Beneficiary
│           ├── Form Section 6: PWD Status
│           ├── Form Section 7: Grade Level
│           ├── Form Section 8: Electives
│           ├── Form Section 9: Current Address
│           ├── Form Section 10: Permanent Address
│           ├── Form Section 11: Parent/Guardian
│           ├── Form Section 12: Learning Modality
│           ├── Form Section 13: Certification
│           └── Submit Button
├── #reviewModal (hidden by default)
│   └── Modal with summary and confirm/edit buttons
└── footer
```

---

## CSS Class Structure

```
Containers:
- .container - Main wrapper
- .form-wrapper - Form box
- .form-section - Each section
- .form-group - Individual input group
- .form-row - Two-column layout

Input Styling:
- .radio-group - Radio button container
- .radio-label - Individual radio label
- .checkbox-group - Checkbox container
- .checkbox-label - Individual checkbox label

Modals:
- .modal - Modal overlay
- .modal.active - Visible modal
- .modal-content - Modal content box
- .modal-header - Modal header
- .modal-body - Modal content
- .modal-footer - Modal buttons

Buttons:
- .btn - Base button
- .btn-primary - Primary action (green)
- .btn-secondary - Secondary action (gray)

Navigation:
- .navbar - Sticky nav
- .nav-container - Nav content
- .nav-content - Left side content
- .nav-logo-img - Logo image
- .nav-logo-text - School name

Utilities:
- .hidden - Display none (display: none !important)
```

---

## Key State Variables (from localStorage)

```javascript
// Student data (from login/registration)
localStorage.getItem('studentData')
// {
//   studentID: "STU001",
//   firstName: "John",
//   lastName: "Doe",
//   email: "john@school.edu",
//   ...
// }

// Enrollments (added during enrollment)
localStorage.getItem('enrollments')
// [
//   {
//     studentID: "STU001",
//     studentName: "John Doe",
//     enrollmentDate: "2024-01-15T...",
//     status: "pending",
//     enrollmentData: { /* all form data */ }
//   }
// ]
```

---

## Common Tasks & Code Snippets

### Add a new conditional section
```javascript
// 1. Add to HTML:
<div id="newSection" class="form-group hidden">
  <input type="radio" name="newOption" value="yes">
</div>

// 2. Add to JS setupConditionalFields():
document.querySelectorAll('input[name="newOption"]').forEach(radio => {
  radio.addEventListener('change', () => {
    const fields = document.getElementById('newSection');
    if (radio.value === 'yes') {
      fields.classList.remove('hidden');
    } else {
      fields.classList.add('hidden');
    }
  });
});
```

### Add new electives category
```javascript
// In enrollment-form.js, add to ELECTIVES object:
ELECTIVES.academic["New Category"] = [
  "Subject 1",
  "Subject 2",
  "Subject 3"
];

// Electives will automatically render in appropriate tracks
```

### Modify validation rules
```javascript
// In validateAndSubmit() function, add condition:
if (gradeLevel === '11' || gradeLevel === '12') {
  // Add your validation here
  if (!yourCondition) {
    alert('Your error message');
    return;
  }
}
```

### Add new form field
```javascript
// 1. Add to HTML in appropriate section:
<div class="form-group">
  <label for="newField">New Field</label>
  <input type="text" id="newField" name="newField">
</div>

// 2. HTML form automatically handles it - no JS needed
// 3. Data collected by collectFormData() automatically

// 4. To display in review modal, add to generateSummaryHTML():
html += `<div class="summary-item">
  <span class="summary-item-label">New Field:</span>
  <span class="summary-item-value">${data.newField}</span>
</div>`;
```

---

## Debugging Tips

### Check if event listeners are working
```javascript
// In browser console:
document.querySelectorAll('input[name="hasLRN"]')
// Click radio, then:
document.getElementById('lrnField').classList
// Should not have 'hidden' class when "Yes" is selected
```

### Verify form data collection
```javascript
// In browser console after filling form:
const formData = new FormData(document.getElementById('enrollmentForm'));
console.log(Object.fromEntries(formData));
// Should show all form values
```

### Check localStorage
```javascript
// View all enrollments:
console.log(JSON.parse(localStorage.getItem('enrollments')));

// View latest enrollment:
const enroll = JSON.parse(localStorage.getItem('enrollments'));
console.log(enroll[enroll.length - 1]);

// Clear enrollments (for testing):
localStorage.removeItem('enrollments');
```

### Test conditional visibility
```javascript
// Manually trigger a section to show:
document.getElementById('lrnField').classList.remove('hidden');

// Manually hide a section:
document.getElementById('lrnField').classList.add('hidden');
```

### Check electives rendering
```javascript
// After selecting track, in console:
document.querySelectorAll('input[name="academicElectives"]').length
// Should show number of rendered electives

// View first few:
document.querySelectorAll('input[name="academicElectives"]').forEach((el, i) => {
  if (i < 3) console.log(el.value);
});
```

---

## Common Issues & Fixes

| Issue | Cause | Solution |
|-------|-------|----------|
| Conditional fields not appearing | Event listener not attached | Check setupConditionalFields() was called |
| Electives not rendering | Track not selected | Select track first in grade 11-12 |
| Address copy not working | Checkbox ID mismatch | Verify #sameAsCurrentAddress ID |
| Form won't submit | Validation failing | Check console for alert message |
| Modal won't show | Certification not checked | Check certification checkbox first |
| Data not saving | localStorage disabled | Enable localStorage in browser |
| Redirect not working | Wrong file path | Verify student-dashboard.html exists |
| Age not calculating | Need to add JS | Add: `birthdate.addEventListener('change', calculateAge)` |

---

## Performance Optimization Tips

1. **Lazy load electives** (for future)
   - Only render visible electives
   - Cache rendered HTML

2. **Debounce validation** (for future)
   - Use setTimeout to delay validation
   - Prevent too many checks

3. **Optimize DOM queries** (for future)
   - Cache querySelector results
   - Use event delegation

4. **Compress electives data** (for future)
   - Use IDs instead of full names
   - Create lookup table

---

## Browser DevTools Commands

### Quick Test Suite
```javascript
// Open Console (F12) and run:

// 1. Check all inputs exist
console.log('Inputs:', document.querySelectorAll('input').length);

// 2. Check all sections exist
console.log('Sections:', document.querySelectorAll('.form-section').length);

// 3. Check event listeners
console.log('LRN options:', document.querySelectorAll('input[name="hasLRN"]'));

// 4. Test data collection
const data = Object.fromEntries(new FormData(document.getElementById('enrollmentForm')));
console.log('Form data keys:', Object.keys(data).length);

// 5. Check localStorage
console.log('Enrollments:', JSON.parse(localStorage.getItem('enrollments')) || []);

// 6. Test modal visibility
document.getElementById('reviewModal').classList.add('active');
// Modal should be visible, then:
document.getElementById('reviewModal').classList.remove('active');
// Modal should hide
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024 | Initial implementation with all features |

---

## Support & Contact

For detailed information, refer to:
- **Implementation Details**: ENROLLMENT_FORM_README.md
- **Testing Procedures**: ENROLLMENT_FORM_TESTING.md
- **Project Summary**: ENROLLMENT_FORM_IMPLEMENTATION_SUMMARY.md

---

## Quick Links

- [Back to Implementation Summary](ENROLLMENT_FORM_IMPLEMENTATION_SUMMARY.md)
- [Full Testing Guide](ENROLLMENT_FORM_TESTING.md)
- [Implementation Details](ENROLLMENT_FORM_README.md)
- [Main Form](enrollment-form.html)
- [Form Styles](enrollment-form.css)
- [Form Logic](enrollment-form.js)
- [Dashboard](student-dashboard.html)

---

**Last Updated**: 2024
**Status**: Production Ready ✅
**Ready for Testing & Deployment**


