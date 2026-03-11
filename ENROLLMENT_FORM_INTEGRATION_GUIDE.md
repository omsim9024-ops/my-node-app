# Enrollment Form Submission - Frontend to Backend Integration Guide

## Overview
The enrollment form submission process works in two stages:
1. **Review Stage**: User fills form, clicks "Review and Submit Enrollment" → Modal shows summary
2. **Submission Stage**: User confirms details, clicks "Confirm and Submit" → Data sent to API

## Frontend Data Collection (enrollment-form.js)

### Stage 1: Form Validation (`validateAndSubmit`)
- Validates all required fields are filled
- Checks conditional fields based on user selections
- Validates LRN format (12 digits)
- Calls `showReviewModal()` if validation passes

### Stage 2: Data Collection (`collectFormData`)
Collects all form data from the HTML form including:
- Basic form fields (text, select, radio, checkbox)
- Arrays for checkboxes (disabilities, electives)
- Agreement states (certification, dataPrivacy)

**Important**: The `name` attribute in HTML is used to collect the data, not the `id` attribute

### Stage 3: Submission (`submitEnrollment`)
Prepares and sends enrollment payload to backend with:
- Student ID (from localStorage)
- All form fields properly mapped
- Optional file uploads (converted to data URLs)

## Data Transformation: Form → API

### Input Mapping (Form Fields → API Fields)

| HTML Form Field | Field Type | API Parameter | Data Type | Notes |
|-----------------|-----------|---------------|-----------|-------|
| hasLRN | radio | hasLRN | 'yes'\|'no' | |
| lrn | text | lrn | string\|null | 12-digit LRN number |
| firstName | text | firstName | string | |
| middleName | text | middleName | string | |
| lastName | text | lastName | string | |
| extensionName | text | extensionName | string | Jr., Sr., III, etc. |
| birthdate | date | birthdate | YYYY-MM-DD | |
| age | number | age | int | |
| sex | select | sex | 'Male'\|'Female' | |
| placeOfBirth | text | placeOfBirth | string | |
| motherTongue | select | motherTongue | string | Language name (or 'other') |
| motherTongueOtherText | text | motherTongueOtherText | string\|null | If motherTongue = 'other' |
| gradeLevel | select | gradeLevel | '7'-'12'\|null | Grade to enroll (stored directly as integer; no FK check) |
| semester | select | semester | 'First'\|'Second'\|null | For grades 11-12 |
| track | select | track | 'academic'\|'techpro'\|'doorway'\|null | For grades 11-12 (backend converts these strings to numeric track_id values for storage) |
| academicElectives | checkbox[] | electives | array | Selected academic electives |
| techproElectives | checkbox[] | electives | array | Selected tech-pro elective |
| doorwayAcademic | checkbox[] | electives | array | Doorway academic choice |
| doorwayTechPro | checkbox[] | electives | array | Doorway tech-pro choice |
| returningLearner | radio | returningLearner | 'yes'\|'no' | |
| lastGradeLevel | select | lastGradeLevel | '1'-'12'\|null | If returningLearner = 'yes' |
| lastSchoolYear | text | lastSchoolYear | string\|null | Format: "2024-2025" |
| lastSchoolAttended | text | lastSchoolAttended | string\|null | School name |
| schoolID | text | schoolID | string\|null | DepEd institution ID |
| isIP | radio | isIP | 'yes'\|'no' | Indigenous Person status |
| ipGroup | select | ipGroup | string\|null | If isIP = 'yes' |
| ipOtherText | text | ipOtherText | string\|null | If ipGroup = 'other' |
| is4Ps | radio | is4Ps | 'yes'\|'no' | Pantawid Pamilya beneficiary |
| householdID | text | householdID | string\|null | If is4Ps = 'yes' |
| hasPWD | radio | hasPWD | 'yes'\|'no' | Persons with Disability |
| disability[] | checkbox | disability | array | Disability types (if hasPWD = 'yes') |
| disabilityDetails | textarea | disabilityDetails | string\|null | Additional details |
| currentSitio | text | currentSitio | string\|null | Sitio/Street name |
| currentCountry | select | currentCountry | string\|null | Country of residence |
| currentProvince | select | currentProvince | string\|null | Province (if Philippines) |
| currentMunicipality | select | currentMunicipality | string\|null | Municipality/City |
| currentBarangay | select | currentBarangay | string\|null | Barangay |
| currentZipCode | text | currentZipCode | string\|null | ZIP/Postal code |
| sameAsCurrentAddress | checkbox | sameAsCurrentAddress | boolean | Copy current to permanent |
| permanentSitio | text | permanentSitio | string\|null | Permanent sitio/street |
| permanentCountry | select | permanentCountry | string\|null | Permanent country |
| permanentProvince | select | permanentProvince | string\|null | Permanent province |
| permanentMunicipality | select | permanentMunicipality | string\|null | Permanent municipality |
| permanentBarangay | select | permanentBarangay | string\|null | Permanent barangay |
| permanentZipCode | text | permanentZipCode | string\|null | Permanent ZIP |
| fatherName | text | fatherName | string\|null | Full name |
| fatherContact | tel | fatherContact | string\|null | Phone number |
| motherMaidenName | text | motherMaidenName | string\|null | Mother's maiden name |
| motherContact | tel | motherContact | string\|null | Phone number |
| guardianName | text | guardianName | string\|null | Full name (if applicable) |
| guardianContact | tel | guardianContact | string\|null | Phone number |
| learningModality | select | learningModality | 'modular-print'\|'modular-digital'\|'online'\|'educational-tv'\|'radio-based'\|'homeschooling'\|'blended' | |
| psaBirthCert | file | enrollmentFiles | data-url\|null | Converted to data URL |
| reportCard | file | enrollmentFiles | data-url\|null | Converted to data URL |
| studentImage | file | enrollmentFiles | data-url\|null | Converted to data URL |
| certification | checkbox | certification | boolean | Must be checked |
| dataPrivacy | checkbox | dataPrivacy | boolean | Must be checked |

## API Request/Response

### HTTP Request

**URL**: `POST /api/enrollments`  
**Content-Type**: `application/json`

### Request Body Example

```json
{
  "student_id": 1,
  "gradeLevel": "10",
  "semester": "First",
  "track": null,
  "electives": [],
  "returningLearner": "no",
  "lastGradeLevel": null,
  "lastSchoolYear": null,
  "lastSchoolAttended": null,
  "schoolID": null,
  "hasLRN": "yes",
  "lrn": "123456789012",
  "lastName": "Doe",
  "firstName": "John",
  "middleName": "Patrick",
  "extensionName": "",
  "birthdate": "2010-01-15",
  "age": 16,
  "sex": "Male",
  "placeOfBirth": "Manila",
  "motherTongue": "Filipino",
  "motherTongueOtherText": null,
  "isIP": "no",
  "ipGroup": null,
  "ipOtherText": null,
  "is4Ps": "yes",
  "householdID": "HH-123456",
  "hasPWD": "no",
  "disability": [],
  "disabilityDetails": null,
  "currentSitio": "Sitio Magubo",
  "currentCountry": "Philippines",
  "currentProvince": "Davao de Oro",
  "currentMunicipality": "Compostela",
  "currentBarangay": "Aurora",
  "currentZipCode": "8200",
  "permanentSitio": "Sitio Magubo",
  "permanentCountry": "Philippines",
  "permanentProvince": "Davao de Oro",
  "permanentMunicipality": "Compostela",
  "permanentBarangay": "Aurora",
  "permanentZipCode": "8200",
  "sameAsCurrentAddress": true,
  "fatherName": "Peter Doe",
  "fatherContact": "09234567890",
  "motherMaidenName": "Maria Santos",
  "motherContact": "09123456789",
  "guardianName": null,
  "guardianContact": null,
  "learningModality": "modular-print",
  "certification": true,
  "dataPrivacy": true,
  "enrollmentFiles": {
    "psaBirthCert": "data:image/png;base64,iVBOR...",
    "reportCard": null,
    "studentImage": "data:image/jpeg;base64,/9j/4AA..."
  }
}
```

### Success Response (HTTP 201)

```json
{
  "success": true,
  "message": "Enrollment submitted successfully",
  "enrollment_id": 4
}
```

> **Note:** the POST call itself only confirms receipt. When the
> dashboard or other clients fetch saved enrollments via
> `GET /api/enrollments` (or `/api/enrollments/student/:id`), the
> response objects include additional derived fields such as
> `track` (human‑readable from the stored `track_id`) and
> `enrollment_date` (timestamp for when the record was created).

### Error Response (HTTP 400/500)

```json
{
  "error": "Failed to submit enrollment",
  "details": "Cannot add or update a child row: a foreign key constraint fails..."
}
```

Or for validation errors:

```json
{
  "error": "Missing required fields: student_id, firstName, lastName, birthdate, sex"
}
```

## Backend Processing

### Step 1: Validation (routes/enrollments.js)
- Required fields check: student_id, firstName, lastName, birthdate, sex
- All other fields are optional but mapped to columns

### Step 2: Data Transformation
**Helper functions applied to normalize data:**

1. **mapModality(learningModalityString)**
   - Input: 'modular-print' (string from form)
   - Output: 7 boolean flags (modality_modular_print: 1, others: 0)

2. **mapDisabilities(disabilityArray)**
   - Input: ['blind', 'speech-language'] (array of selected disabilities)
   - Output: 16 boolean flags (disability_vi_blind: 1, disability_sld: 1, others: 0, learner_has_disability: 'Yes')

3. **parseFullName(fullNameString)**
   - Input: 'John Patrick Doe' (for parent/guardian names)
   - Output: {firstname: 'John', middlename: 'Patrick', lastname: 'Doe'}

### Step 3: SQL Insert
Inserts into 65 columns with transformed data:
- Column 1: with_lrn (from hasLRN)
- Column 2: returning (from returningLearner)
- Columns 3-4: psa_no, lrn_no
- Columns 5-8: lastname, firstname, middle_name, ext_name
- ... (total 65 columns, see ENROLLMENT_MIGRATION_COMPLETE.md for full list)

## Common Issues & Fixes

### Issue 1: "Column count doesn't match value count"
**Cause**: Mismatch between number of form fields sent and database columns  
**Fix**: Verify all 65 columns are in the SQL INSERT statement ✅ (already fixed)

### Issue 2: "Foreign key constraint fails"
**Cause**: Referenced grade_id doesn't exist  
**Fix**: gradeLevel is now a raw integer; no lookup required (previously needed to match grades table). Ensure value is 7–12.

### Issue 3: Field data not appearing in database
**Cause**: Form field name attribute doesn't match what backend expects  
**Fix**: Check field name in HTML matches the mapping in submitEnrollment() function

### Issue 4: Arrays not being collected correctly
**Cause**: Multiple checkboxes with same name not being collected  
**Fix**: `collectFormData()` manually collects checkbox arrays like:
```javascript
data.disabilities = [];
document.querySelectorAll('input[name="disability"]:checked').forEach(cb => {
    data.disabilities.push(cb.value);
});
```

## Testing the Integration

### Quick Test with Browser Console
```javascript
// Check if form fields are being collected
const form = document.getElementById('enrollmentForm');
const formData = new FormData(form);
console.log(Object.fromEntries(formData));

// Manually trigger submission
document.getElementById('submitBtn').click();
```

### Test with Network Tab
1. Open Browser DevTools → Network tab
2. Fill form and click "Review and Submit Enrollment"
3. In the modal, click "Confirm and Submit"
4. Watch for POST request to `/api/enrollments`
5. Check request/response bodies for correct data

### Verify in Database
```sql
-- Check if enrollment was inserted
SELECT id, firstname, lastname, learner_has_disability, 
       disability_vi_blind, modality_modular_print
FROM enrollments 
WHERE id = (SELECT MAX(id) FROM enrollments);
```

## Code Flow Diagram

```
1. Student fills form
   ↓
2. Click "Review and Submit Enrollment"
   ↓ (validateAndSubmit called)
3. Validation checks all required fields
   ↓
4. If valid: showReviewModal()
   ↓ (collectFormData, generateSummaryHTML)
5. Modal displays summary and files
   ↓
6. Student reviews and clicks "Confirm and Submit"
   ↓ (confirmBtn.onClick → submitEnrollment)
7. Read file uploads as data URLs
   ↓ (filePromises)
8. Build enrollmentPayload with all fields properly mapped
   ↓
9. POST to /api/enrollments with JSON body
   ↓
10. Backend validates, transforms, and inserts
    ↓
11. Return enrollment_id
    ↓
12. Save to localStorage and show success
    ↓
13. Redirect to student-dashboard.html
```

## File References

- **Frontend**: `/enrollment-form.js` (submitEnrollment, collectFormData, validateAndSubmit)
- **HTML Form**: `/enrollment-form.html` (all input field names and types)
- **Backend API**: `/routes/enrollments.js` (POST endpoint, helpers)
- **CSS**: `/enrollment-form.css` (modal styling)

## Recent Changes (February 2026)

✅ Fixed submitEnrollment to flatten form fields instead of nesting in enrollment_data  
✅ Added proper field name mappings matching HTML form  
✅ Added console logging for debugging  
✅ Added proper semester value transformation ('first' → 'First')  
✅ Added all elective array options (academic, techpro, doorway)  
✅ Added error details in response handling

---

**Last Updated**: 2026-02-25  
**Status**: ✅ Ready for testing


