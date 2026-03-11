# Enrollment Form Submission - Visual Architecture

## End-to-End Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          BROWSER (Frontend)                             │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ enrollment-form.html                                            │   │
│  │ ┌─────────────────────────────────────────────────┐             │   │
│  │ │ FORM FIELDS (50+ fields)                        │             │   │
│  │ │ ├─ Student Info (firstName, lastName, etc.)    │             │   │
│  │ │ ├─ LRN (hasLRN, lrn)                           │             │   │
│  │ │ ├─ Demographics (birthdate, sex, age)          │             │   │
│  │ │ ├─ Disabilities (checkbox array)               │             │   │
│  │ │ ├─ Addresses (current & permanent)             │             │   │
│  │ │ ├─ Parents/Guardians (names & contacts)        │             │   │
│  │ │ ├─ Learning Modality (select)                  │             │   │
│  │ │ ├─ Documents (file uploads)                    │             │   │
│  │ │ └─ Agreements (certification, privacy)         │             │   │
│  │ └─────────────────────────────────────────────────┘             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              ↓                                          │
│                    User clicks "Review"                                 │
│                              ↓                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ enrollment-form.js: validateAndSubmit()                         │   │
│  │ ├─ Validate required fields                                    │   │
│  │ ├─ Check conditional validations                              │   │
│  │ ├─ Validate LRN format (if needed)                            │   │
│  │ └─ Call showReviewModal() ───→ Shows data summary             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              ↓                                          │
│                  User clicks "Confirm & Submit"                         │
│                              ↓                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ enrollment-form.js: submitEnrollment()                          │   │
│  │ ┌─────────────────────────────────────────────────┐             │   │
│  │ │ 1. collectFormData()                            │             │   │
│  │ │    └─ Extract all form fields from HTML        │             │   │
│  │ │       returns: { firstName: "John", ... }      │             │   │
│  │ └─────────────────────────────────────────────────┘             │   │
│  │ ┌─────────────────────────────────────────────────┐             │   │
│  │ │ 2. readFileAsDataURL()                          │             │   │
│  │ │    └─ Convert file uploads to base64 strings   │             │   │
│  │ │       returns: { psaBirthCert: "data:img..." } │             │   │
│  │ └─────────────────────────────────────────────────┘             │   │
│  │ ┌─────────────────────────────────────────────────┐             │   │
│  │ │ 3. Build enrollmentPayload                      │             │   │
│  │ │    └─ Map form fields to API parameters        │             │   │
│  │ │       returns: {                                │             │   │
│  │ │         student_id: 1,                          │             │   │
│  │ │         firstName: "John",                      │             │   │
│  │ │         lastName: "Doe",                        │             │   │
│  │ │         gradeLevel: "10",                       │             │   │
│  │ │         disability: ["blind"],                  │             │   │
│  │ │         learningModality: "online",             │             │   │
│  │ │         ...all 50+ fields individually          │             │   │
│  │ │       }                                         │             │   │
│  │ └─────────────────────────────────────────────────┘             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                              ↓ HTTP POST
                    ┌─────────────────────────┐
                    │  /api/enrollments      │
                    │  Content-Type: JSON     │
                    └─────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    NODE.js SERVER (Backend)                             │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ routes/enrollments.js: POST /                                   │   │
│  │                                                                 │   │
│  │ 1. Extract req.body (JSON payload)                              │   │
│  │    └─ { student_id, firstName, lastName, ... }                │   │
│  │                                                                 │   │
│  │ 2. Validate required fields ┐                                  │   │
│  │    ├─ student_id ✓          │ Destructure and                 │   │
│  │    ├─ firstName ✓           │ Validate                        │   │
│  │    ├─ lastName ✓            │                                 │   │
│  │    ├─ birthdate ✓           │                                 │   │
│  │    └─ sex ✓                 ┘                                 │   │
│  │                                                                 │   │
│  │ 3. Apply Helper Functions                                       │   │
│  │    ├─ mapModality('online')                                    │   │
│  │    │  └─ Returns: {modality_online: 1, others: 0}            │   │
│  │    │                                                            │   │
│  │    ├─ mapDisabilities(['blind'])                               │   │
│  │    │  └─ Returns: {learner_has_disability: 'Yes',             │   │
│  │    │              disability_vi_blind: 1, others: 0}          │   │
│  │    │                                                            │   │
│  │    └─ parseFullName('Peter Doe')                               │   │
│  │       └─ Returns: {firstname: 'Peter', lastname: 'Doe'}       │   │
│  │                                                                 │   │
│  │ 4. Get Active School Year ID                                   │   │
│  │    └─ Query: SELECT id FROM school_years WHERE is_active      │   │
│  │                                                                 │   │
│  │ 5. Build SQL Insert Values Array (65 values):                 │   │
│  │    [                                                            │   │
│  │      'Yes',            ← with_lrn                              │   │
│  │      'No',             ← returning                              │   │
│  │      null,             ← psa_no                                │   │
│  │      null,             ← lrn_no                                │   │
│  │      'Doe',            ← lastname                              │   │
│  │      'John',           ← firstname                             │   │
│  │      '-',              ← middle_name                           │   │
│  │      '-',              ← ext_name                              │   │
│  │      '2010-01-15',     ← birthdate                            │   │
│  │      'Male',           ← sex                                   │   │
│  │      16,               ← age                                   │   │
│  │      'Manila',         ← place_of_birth                       │   │
│  │      'No',             ← is_ip_member                         │   │
│  │      'No',             ← four_p_beneficiary                   │   │
│  │      'No',             ← learner_has_disability               │   │
│  │      0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0         ← 16 disability flags
│  │      null,             ← disability_other                     │   │
│  │      '-',              ← cu_address_sitio_street              │   │
│  │      '-',              ← cu_address_house                     │   │
│  │      '1000',           ← cu_address_zip                       │   │
│  │      0,                ← address_permanent_current            │   │
│  │      '-',              ← pe_address_sitio_street              │   │
│  │      '-',              ← pe_address_house                     │   │
│  │      '1000',           ← pe_address_zip                       │   │
│  │      '-', '-', '-', '09123456789',  ← father fields          │   │
│  │      '-', '-', '-', '09987654321',  ← mother fields          │   │
│  │      '-', '-', '-', '-',            ← guardian fields        │   │
│  │      'ABC School',     ← last_school                          │   │
│  │      'First',          ← semester                              │   │
│  │      0, 0, 1, 0, 0, 0, 0             ← 7 modality flags      │   │
│  │      '',               ← parent_guardian                      │   │
│  │      1,                ← consent                               │   │
│  │      '-',              ← subjects                              │   │
│  │      '{}',             ← enrollment_files (JSON)             │   │
│  │      2,                ← school_year_id (FK)                 │   │
│  │      10,               ← grade_to_enroll_id (grade level, no FK) │   │
│  │      1                 ← student_id (FK)                     │   │
│  │    ]                                                            │   │
│  │                                                                 │   │
│  │ 6. Execute SQL INSERT                                          │   │
│  │    INSERT INTO enrollments (65 cols) VALUES (65 placeholders) │   │
│  │    └─ Returns: insertId = 4                                  │   │
│  │                                                                 │   │
│  │ 7. Return Success Response                                     │   │
│  │    {                                                            │   │
│  │      success: true,                                            │   │
│  │      message: "Enrollment submitted successfully",             │   │
│  │      enrollment_id: 4                                         │   │
│  │    }                                                            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                              ↓ HTTP 201
┌─────────────────────────────────────────────────────────────────────────┐
│                      MYSQL DATABASE                                     │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Table: enrollments (65 columns)                                  │  │
│  │                                                                  │  │
│  │ Row: [4]                                                         │  │
│  │  id: 4                                                           │  │
│  │  with_lrn: 'Yes'                                                │  │
│  │  returning: 'No'                                                │  │
│  │  psa_no: NULL                                                   │  │
│  │  lrn_no: NULL                                                   │  │
│  │  lastname: 'Doe'                                                │  │
│  │  firstname: 'John'                                              │  │
│  │  middle_name: '-'                                              │  │
│  │  ext_name: '-'                                                 │  │
│  │  birthdate: '2010-01-15'                                       │  │
│  │  sex: 'Male'                                                   │  │
│  │  age: 16                                                        │  │
│  │  place_of_birth: 'Manila'                                      │  │
│  │  learner_has_disability: 'No'                                  │  │
│  │  disability_vi_blind: 0                                        │  │
│  │  [... all 16 disability flags ... ]                           │  │
│  │  modality_online: 1  [all other modality_* = 0]               │  │
│  │  [... 58 more columns with data ... ]                         │  │
│  │  created_at: 2026-02-25 14:30:15                              │  │
│  │  updated_at: 2026-02-25 14:30:15                              │  │
│  │                                                                  │  │
│  │  ✅ Successfully inserted with all 65 columns                  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                          BROWSER (Return)                               │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ JavaScript Processing                                           │   │
│  │                                                                 │   │
│  │ 1. Parse JSON response                                          │   │
│  │    └─ { success: true, enrollment_id: 4 }                     │   │
│  │                                                                 │   │
│  │ 2. Save to localStorage                                         │   │
│  │    ├─ enrollments: [{...enrollment...}]                       │   │
│  │    └─ studentData: {..., hasEnrollment: true, ...}            │   │
│  │                                                                 │   │
│  │ 3. Show Success Notification                                    │   │
│  │    └─ "✅ Enrollment submitted successfully! ID: 4"           │   │
│  │                                                                 │   │
│  │ 4. Close Modal                                                  │   │
│  │                                                                 │   │
│  │ 5. Redirect to Dashboard                                        │   │
│  │    └─ window.location.href = 'student-dashboard.html'         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Transformation Pipeline

```
┌──────────────────────────────────────────────────────────────────────┐
│            Form Input                                                │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  learningModality = "modular-print" (single string)                 │
│          │                                                          │
│          ↓                                                          │
│  ┌──────────────────────────────────┐                             │
│  │ mapModality() Function           │                             │
│  │                                  │                             │
│  │ if (modality === 'modular-print')│                             │
│  │   flags.modality_modular_print=1 │                             │
│  │                                  │                             │
│  └──────────────────────────────────┘                             │
│          │                                                          │
│          ↓                                                          │
│  Database Storage (7 INDIVIDUAL COLUMNS)                           │
│  ┌──────────────────────────────────────────┐                     │
│  │ modality_modular_print:    1              │                    │
│  │ modality_modular_digital:  0              │                    │
│  │ modality_online:           0              │                    │
│  │ modality_tv:               0              │                    │
│  │ modality_rbi:              0              │                    │
│  │ modality_homeschooling:    0              │                    │
│  │ modality_blended:          0              │                    │
│  └──────────────────────────────────────────┘                     │
│                                                                      │
│  ==========================================                         │
│                                                                      │
│  disability[] = ["blind", "speech-language"] (array)               │
│          │                                                          │
│          ↓                                                          │
│  ┌──────────────────────────────────┐                             │
│  │ mapDisabilities() Function       │                             │
│  │                                  │                             │
│  │ flags.learner_has_disability='Y' │                             │
│  │ for each item in array:          │                             │
│  │   'blind' →flag.disability_vi... │                             │
│  │   'speech-lang'→ flag.disability │                             │
│  │                                  │                             │
│  └──────────────────────────────────┘                             │
│          │                                                          │
│          ↓                                                          │
│  Database Storage (17 INDIVIDUAL COLUMNS)                          │
│  ┌──────────────────────────────────────────┐                     │
│  │ learner_has_disability:    Yes            │                    │
│  │ disability_vi_blind:       1              │                    │
│  │ disability_vi_low:         0              │                    │
│  │ disability_sld:            1              │                    │
│  │ disability_asd:            0              │                    │
│  │ ... (13 more flags) ...    0              │                    │
│  └──────────────────────────────────────────┘                     │
│                                                                      │
│  ==========================================                         │
│                                                                      │
│  fatherName = "Peter John Doe" (single string)                     │
│          │                                                          │
│          ↓                                                          │
│  ┌──────────────────────────────────┐                             │
│  │ parseFullName() Function         │                             │
│  │                                  │                             │
│  │ Split by spaces, parse into:     │                             │
│  │ firstname, middlename, lastname  │                             │
│  │                                  │                             │
│  └──────────────────────────────────┘                             │
│          │                                                          │
│          ↓                                                          │
│  Database Storage (3 SEPARATE COLUMNS)                             │
│  ┌──────────────────────────────────────────┐                     │
│  │ father_firstname:    Peter                │                    │
│  │ father_middlename:   John                 │                    │
│  │ father_lastname:     Doe                  │                    │
│  └──────────────────────────────────────────┘                     │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Field Validation Flow

```
Form Field Submitted
        ↓
    ┌────────────────────────────────┐
    │ Is it required? (has required  │
    │         attribute)             │
    └────────────────────────────────┘
            ↙   ↘
        YES     NO
        ↙         ↘
    Required      Optional
    Validation    (pass through
        ↓         if empty)
    ┌──────────────────────┐
    │ Is value empty?      │
    └──────────────────────┘
        ↙   ↘
      YES    NO
      ↙       ↘
    BLOCK    ┌─────────────────────┐
     (show  │ Is it conditional?  │
     error) │ (needs validation   │
           │  only if X=yes)     │
           └─────────────────────┘
               ↙   ↘
            YES     NO
            ↙       ↘
      Check    Type-specific
      parent  Validation
      value      (LRN format
        ↓        phone format
      Validate   date range)
        ↓        ↓
      Pass or    Pass or
      Block      Block
        ↓        ↓
    Set value in payload
        ↓
    Send to API
```

## Error Handling Flow

```
Form Submission Attempted
        ↓
┌─────────────────────────┐
│ Frontend Validation     │
│ (enrollment-form.js)    │
└─────────────────────────┘
        ↓
    ┌───┴───────────────────────┐
    │ All fields valid?         │
    └───┴───────────────────────┘
    ↙   ↘
  NO    YES
  ↙      ↘
Show      Open Review
Error     Modal
notify    ↓
        User Reviews
          ↓
      Click Confirm
        ↓
┌────────────────────────────┐
│ Backend Receives POST      │
│ /api/enrollments           │
└────────────────────────────┘
        ↓
    ┌────────────────────┐
    │ Required fields    │
    │ validation         │
    └────────────────────┘
      ↙   ↘
    PASS   FAIL
    ↙       ↘
  Transform   HTTP 400
  Data       {error: "Missing..."}
    ↓        ↓
  ┌──────────────┐
  │ DB Insert    │ Show Error
  │ 65 columns   │ Notification
  └──────────────┘
    ↓ ↙ ↘
SUCCESS FAIL
(201)  (500)
  ↓     ↓
Return HTTP 500
Enroll {error: "FK..."}
ID       ↓
  ↓    Show Error
Save   Notification
to DB
  ↓
Return
Enroll
ID
  ↓
Show
Success
```

---

**Diagram Version**: 1.0  
**Created**: 2026-02-25  
**For**: Enrollment System Form Submission Integration


