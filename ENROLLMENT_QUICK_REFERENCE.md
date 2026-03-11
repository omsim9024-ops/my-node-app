# Enrollment System - Quick Reference

## 🎯 Current Status
✅ **ACTIVE**: New 65-column enrollment system is fully operational

## 📋 Form Submission Flow
1. Student fills out `/enrollment-form.html` with 50+ fields
2. Form POSTs to `POST /api/enrollments` endpoint
3. Endpoint receives data, transforms it (disabilites → flags, names → parts)
4. Inserts into `enrollments` table (65 columns)
5. Returns HTTP 201 with enrollment_id

## 🗄️ Database Structure
**Table**: `enrollments`  
**Rows**: 2+ test records  
**Columns**: 65 (granular, no JSON blobs)

### Key Column Groups
| Group | Count | Examples |
|-------|-------|----------|
| Learner Info | 8 | with_lrn, firstname, lastname, middle_name |
| Demographics | 5 | birthdate, sex, age, place_of_birth |
| Disabilities | 16 | learner_has_disability, disability_vi_blind, disability_sld, ... |
| Addresses | 7 | cu_address_sitio_street, cu_address_zip, pe_address_sitio_street |
| Parent/Guardian | 12 | father_*, mother_*, guardian_* (each: lastname, firstname, middlename, contact) |
| School References | 2 | last_school, semester |
| Modalities | 7 | modality_modular_print, modality_online, ... |
| Certification | 3 | parent_guardian, consent, subjects |
| System | 4 | enrollment_files, school_year_id, grade_to_enroll_id, student_id |

## 🔄 Data Transformation Examples

### Before (From Form)
```json
{
  "learningModality": "modular-print",
  "disability": ["blind", "speech-language"],
  "fatherName": "John Patrick Doe"
}
```

### After (In Database - 65 Individual Columns)
```sql
modality_modular_print=1, modality_modular_digital=0, modality_online=0, ... |
learner_has_disability='Yes', disability_vi_blind=1, disability_sld=1, disability_asd=0, ... |
father_firstname='John', father_middlename='Patrick', father_lastname='Doe'
```

## 📁 Important Files

### Active Code
- `/routes/enrollments.js` - POST endpoint (main code to use)
- `/db.js` - Database connection pool

### Migration/Backup
- `/setup-student-enrollments.js` - Created new table (already executed)
- `/routes/enrollments-old.js` - Backup of original endpoint
- `/enrollments_backup` - Backup of old data in database

### Testing
- `/test-enrollment.ps1` - PowerShell test script
- Query: `SELECT * FROM enrollments WHERE id=3` - View test data

## 🧪 Testing

### Quick Test
```bash
# Run from PowerShell in project directory
powershell -File test-enrollment.ps1

# Expected output:
# Success!
# enrollment_id: [4, 5, 6, ...]
```

### Manual SQL Test
```sql
-- Verify new structure
SELECT COUNT(*) as total_enrollments FROM enrollments;

-- View specific enrollment
SELECT id, firstname, lastname, learner_has_disability, disability_vi_blind 
FROM enrollments WHERE id=4;

-- Check all columns exist
DESCRIBE enrollments;
```

## ⚙️ Helper Functions (In /routes/enrollments.js)

### `mapModality(modalityString)`
Converts: `"modular-print"` → `{modality_modular_print: 1, modality_modular_digital: 0, ...}`

### `mapDisabilities(disabilityArray)`
Converts: `["blind", "speech-language"]` → `{learner_has_disability: 'Yes', disability_vi_blind: 1, disability_sld: 1, ...}`

### `parseFullName(fullNameString)`
Converts: `"John Patrick Doe"` → `{firstname: 'John', middlename: 'Patrick', lastname: 'Doe'}`

## 🚨 Common Issues & Solutions

| Issue | Cause | Fix |
|-------|-------|-----|
| HTTP 400: "Missing required fields" | Missing student_id, firstName, lastName, birthdate, or sex | Add required fields to form data |
| HTTP 500: "Foreign key constraint fails" | Referenced ID doesn't exist | Use valid student_id or school_year_id (grade_to_enroll_id is now free-form integer) |
| HTTP 500: "Column count doesn't match" | SQL mismatch (shouldn't happen) | Verify 65 columns = 65 ? = 65 array values |
| NULL values in grade/school_year | Student didn't provide these fields | Either make optional or add to form |

## 📊 Query Examples

### Get all enrollments for a student
```sql
SELECT * FROM enrollments 
WHERE student_id = 1 
ORDER BY created_at DESC;
```

### Find students with disabilities
```sql
SELECT id, firstname, lastname, learner_has_disability
FROM enrollments 
WHERE learner_has_disability = 'Yes'
LIMIT 10;
```

### Count by learning modality
```sql
SELECT 
  SUM(modality_modular_print) as modular_print_count,
  SUM(modality_online) as online_count,
  SUM(modality_blended) as blended_count
FROM enrollments;
```

### Export to CSV (students with disabilities)
```sql
SELECT id, firstname, lastname, birthdate, 
  CASE WHEN disable_vi_blind=1 THEN 'Blind' 
       WHEN disability_vi_low=1 THEN 'Low Vision'
       ELSE 'Other'
  END as disability_type
FROM enrollments 
WHERE learner_has_disability = 'Yes'
INTO OUTFILE '/tmp/disabilities.csv'
FIELDS TERMINATED BY ',';
```

## 🔗 Related Documentation
- See: `ENROLLMENT_MIGRATION_COMPLETE.md` (full technical details)
- Form: `enrollment-form.html` (front-end form)
- Schema Reference: `student_enrollments.sql` (original design)

## ✅ Last Verified
- Date: 2026-02-25
- Test Status: ✅ Both test enrollments created successfully
- SQL Status: ✅ All 65 columns functional
- Data Status: ✅ Complex data correctly transformed and stored

---

**Questions?** Check error logs: `npm start` output or Node console for details


