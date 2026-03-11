# SHS Track & Electives Implementation - Testing Guide

## Overview
This guide walks through testing the SHS (Senior High School) track-based elective selection and filtering functionality in the Admin Dashboard.

## Feature Structure

### Data Flow
```
Grade Selection (11 or 12) 
    ↓
Track Selection (Academic, TechPro, or Doorway)
    ↓
Electives Display (organized by category)
    ↓
Electives Selection (multiple checkboxes)
    ↓
Section Dropdown Filtering (shows only matching sections)
    ↓
Student List Filtering (shows only matching students)
```

## Test Scenarios

### Test 1: Academic Track Electives Display

**Setup:**
1. Open Admin Dashboard
2. Navigate to "Section Assignment" tab
3. Verify you can see:
   - Grade selector (dropdown: 11, 12)
   - Track selector (initially hidden)
   - Electives container (initially empty)

**Test Steps:**
1. Select Grade: **11** or **12**
2. Observe: Track selector should become visible
3. Select Track: **Academic**
4. Observe: Electives should display organized by these categories:
   - **Arts & Humanities** (e.g., Creative Writing, Philosophy, World Literature)
   - **Business** (e.g., Accounting, Business Ethics, Entrepreneurship)
   - **Sports/Health** (e.g., Physical Fitness, Sports Medicine, Nutrition)
   - **STEM** (e.g., Calculus 2, Engineering Design, Biology 1-2)
   - **Field Experience** (e.g., Practicum in Education, Internship)

**Expected Results:**
- Each category displayed with clear header
- Checkboxes visible for each elective
- No TechPro electives should appear
- Console logs should show category organization

**Console Verification:**
```javascript
// Should log:
[SectionAssignment-v2] updateSHSElectivesOptions called with track: Academic
[SectionAssignment-v2] Total electives for track: 87
[SectionAssignment-v2] Electives by category:
  - Arts & Humanities: 17 items
  - Business: 18 items
  - Sports/Health: 18 items
  - STEM: 18 items
  - Field Experience: 16 items
```

---

### Test 2: TechPro Track Electives Display

**Test Steps:**
1. Select Grade: **11** or **12**
2. Select Track: **TechPro**
3. Observe: Electives should display organized by:
   - **ICT** (Information & Communication Technology)
   - **Industrial Arts** (Welding, Carpentry, Automotive)
   - **Agriculture/Fishery**
   - **Family/Consumer Science** (Culinary, Hospitality, Fashion)
   - **Maritime** (Boat Building, Seamanship, Navigation)

**Expected Results:**
- Each category displayed with clear header
- Checkboxes visible for each elective
- No Academic electives should appear
- Different electives than Academic track

---

### Test 3: Doorway Track Electives Display

**Test Steps:**
1. Select Grade: **11** or **12**
2. Select Track: **Doorway**
3. Observe: Electives should display BOTH Academic and TechPro categories

**Expected Results:**
- All 10 categories visible (5 Academic + 5 TechPro)
- Student can mix-and-match electives from both tracks
- Total ~177 electives available

---

### Test 4: Single Elective Selection

**Setup:**
- Grade: 12, Track: Academic

**Test Steps:**
1. Under "Arts & Humanities" category, check **"Creative Writing"**
2. Observe:
   - Checkbox is marked
   - State updated in console
   - Section dropdown refreshes

**Expected Console Log:**
```javascript
[SectionAssignment-v2] Elective selected: Creative Writing
[SectionAssignment-v2] Total selected electives: 1
[SectionAssignment-v2] updateSHSSectionOptions called
[SectionAssignment-v2] Filtered sections count: X
```

---

### Test 5: Multiple Electives Selection (Same Category)

**Test Steps:**
1. Under "STEM" category, check:
   - **"Biology 1-2"**
   - **"Physics 1-2"**
2. Observe:
   - Both checkboxes marked
   - Console shows both selections
   - Section dropdown filters to sections with EITHER elective

**Expected Behavior:**
- Sections that have "Biology 1-2" appear
- Sections that have "Physics 1-2" appear
- Sections with BOTH appear
- **Logic:** Section matches if it contains ANY of the selected electives

---

### Test 6: Multiple Electives Selection (Different Categories)

**Test Steps:**
1. Check **"Creative Writing"** (Arts & Humanities)
2. Check **"Accounting"** (Business)
3. Observe:
   - Both checkboxes marked
   - Console shows both selections
   - Section dropdown filters appropriately

**Expected Behavior:**
- Shows sections created with either "Creative Writing" OR "Accounting"

---

### Test 7: Deselect Elective

**Test Steps:**
1. Select "Creative Writing"
2. Observe it's checked and section list updates
3. Uncheck "Creative Writing"
4. Observe:
   - Checkbox unchecked
   - Section list updates (different sections now visible)

**Expected Console Log:**
```javascript
[SectionAssignment-v2] Elective deselected: Creative Writing
[SectionAssignment-v2] Total selected electives: 0
[SectionAssignment-v2] updateSHSSectionOptions called
[SectionAssignment-v2] Filtered sections count: 0
[SectionAssignment-v2] No sections available...
```

---

### Test 8: Track Change Clears Electives

**Test Steps:**
1. Select Academic track
2. Check "Biology 1-2"
3. Select TechPro track
4. Observe:
   - All previously selected Academic electives are UNCHECKED
   - TechPro electives display
   - Section dropdown resets

**Expected Behavior:**
- Switching tracks automatically clears previous selections
- Clean start with new track's electives

---

### Test 9: Section Filtering by Track + Electives

**Prerequisites:**
- Create multiple SHS sections in "Sections" tab:
  - Section A: Grade 12, Academic, Electives: "Biology 1-2, Physics 1-2"
  - Section B: Grade 12, Academic, Electives: "Creative Writing"
  - Section C: Grade 12, TechPro, Electives: "Computer Programming Java"

**Test Steps:**
1. Go to Section Assignment tab
2. Select Grade: 12
3. Select Track: Academic
4. Check elective: "Biology 1-2"
5. Observe: Only Section A appears in dropdown

6. Check additional elective: "Creative Writing"
7. Observe: Both Section A and Section B appear

8. Uncheck "Biology 1-2", keep "Creative Writing"
9. Observe: Only Section B appears

10. Select Track: TechPro
11. Check: "Computer Programming Java"
12. Observe: Only Section C appears

**Expected Console Output:**
```javascript
[SectionAssignment-v2] updateSHSSectionOptions called
[SectionAssignment-v2] Grade: 12
[SectionAssignment-v2] Track: Academic
[SectionAssignment-v2] Selected electives: [ 'Biology 1-2' ]
[SectionAssignment-v2] Filtered sections count: 1
[SectionAssignment-v2] Added section option: Section A (SHS-12-A)
```

---

### Test 10: Student List Filtering by Electives

**Prerequisites:**
- Create/enroll student data with different electives:
  - Student A: Grade 12, Academic, Elective: "Biology 1-2"
  - Student B: Grade 12, Academic, Elective: "Creative Writing"
  - Student C: Grade 12, TechPro, Elective: "Computer Programming Java"

**Test Steps:**
1. Section Assignment tab
2. Grade: 12, Track: Academic
3. Leave electives unchecked
4. Observe: All 3 students appear in list

5. Check "Biology 1-2"
6. Observe: Only Student A appears

7. Check "Creative Writing" (in addition to Biology)
8. Observe: Students A and B appear (matching either elective)

9. Uncheck "Biology 1-2", keep "Creative Writing"
10. Observe: Only Student B appears

11. Select TechPro track, check "Computer Programming Java"
12. Observe: Only Student C appears

**Expected Console Log:**
```javascript
[SectionAssignment-v2] updateSHSStudentsList called
[SectionAssignment-v2] Grade: 12
[SectionAssignment-v2] Track: Academic
[SectionAssignment-v2] Selected electives: [ 'Biology 1-2' ]
[SectionAssignment-v2] Students after grade filter: 2
[SectionAssignment-v2] Students after track filter: 2
[SectionAssignment-v2] Students after elective filter: 1
```

---

### Test 11: Section Assignment Submission

**Test Steps:**
1. Grade: 12, Track: Academic
2. Check electives: "Biology 1-2" and "Physics 1-2"
3. Section dropdown should show only matching sections
4. Select a section from dropdown
5. In students table, select 2-3 students
6. Click "Assign to Section"
7. Observe:
   - Success message appears
   - API call logged in Network tab (POST /api/students/assign-section)
   - Request payload includes: studentIds, sectionId

**Expected Request Body:**
```json
{
  "studentIds": [1, 2, 3],
  "sectionId": 5
}
```

---

### Test 12: Modal Section Creation With Electives

**Test Steps:**
1. Go to "Sections" tab
2. Click "Create New SHS Section" button
3. Modal appears with:
   - Grade selector
   - Track selector
   - Electives grid (organized by category)
   - Section name input
   - Section code input (auto-generated)

4. Select Grade: 12
5. Select Track: Academic
6. Verify electives display by category
7. Check multiple electives: "Biology 1-2", "Chemistry 1-2"
8. Enter Section Name: "SHS-12-Science-A"
9. Click "Create Section"
10. Observe:
    - Section created
    - Section appears in Sections list
    - Section available in Section Assignment dropdown

---

### Test 13: Elective Name Formatting & Display

**Test Steps:**
1. Select Academic track
2. Inspect various elective names in categories

**Expected:**
- Elective names display as-is from database
- No truncation or corruption
- Special characters (if any) display correctly
- Category headers are clear and highlighted

---

### Test 14: Consistency Between Section Creation & Assignment

**Test Steps:**
1. Create section in "Sections" tab:
   - Grade 12, Academic, select "Biology 1-2"
2. Go to "Section Assignment" tab
3. Select Grade 12, Academic track
4. Check "Biology 1-2" in electives
5. Verify this section appears in the section dropdown

**Expected:**
- Section filtering works identically in both UIs
- Same electives available in both places
- No discrepancies in display

---

## Debugging Console Commands

### Check Electives Data Loaded
```javascript
console.log('ELECTIVES available:', !!window.ELECTIVES);
console.log('Academic track electives:', window.ELECTIVES?.academic);
console.log('TechPro track electives:', window.ELECTIVES?.techpro);
```

### Check Electives Map
```javascript
console.log('electivesMap:', window.electivesMap);
console.log('Academic electives count:', window.electivesMap?.Academic?.length);
console.log('TechPro electives count:', window.electivesMap?.TechPro?.length);
console.log('Doorway electives count:', window.electivesMap?.Doorway?.length);
```

### Check Assignment State
```javascript
console.log('sectionAssignmentState:', window.sectionAssignmentState);
console.log('Selected track:', sectionAssignmentState.selectedTrack);
console.log('Selected electives:', Array.from(sectionAssignmentState.selectedElectives));
console.log('Selected students:', Array.from(sectionAssignmentState.selectedStudents));
```

### Check Loaded Sections
```javascript
console.log('All SHS sections:', sectionAssignmentState.allSections.filter(s => s.grade_level >= 11));
console.log('Section with electives:', sectionAssignmentState.allSections.find(s => s.electives));
```

---

## Troubleshooting

### Issue: Electives not displaying
**Checklist:**
- ✓ Enrollment form loaded (check `window.ELECTIVES` exists)
- ✓ shs-track-config.js loaded (check `window.electivesMap` exists)
- ✓ Track is selected (not empty)
- ✓ No JavaScript errors in console
- ✓ Network tab shows no failed requests

**Solution:**
- Check browser console for errors
- Verify script loading order in admin-dashboard.html
- Refresh page and try again
- Check Network tab for 404 or 500 errors

---

### Issue: Sections not filtering correctly
**Checklist:**
- ✓ At least one elective is selected
- ✓ Grade matches section grade
- ✓ Track matches section track
- ✓ Section electives contain at least one selected elective
- ✓ Active school year is set

**Solution:**
- Check console logs for filtering details
- Verify section data has electives stored (should be CSV string)
- Check database: `SELECT * FROM sections WHERE id = X;`
- Verify electives in database match selected electives exactly

---

### Issue: Students not filtering
**Checklist:**
- ✓ Student level is "SHS"
- ✓ Student grade matches selector
- ✓ Student track matches selected track
- ✓ Student elective exactly matches one of selected electives (case-sensitive)

**Solution:**
- Check student data: `SELECT * FROM students WHERE id = X;`
- Verify student elective name matches exactly
- Check for extra spaces: `student.elective.trim()`
- Use console to debug: `sectionAssignmentState.allStudents`

---

### Issue: Section Creation Modal Not Working
**Checklist:**
- ✓ "Sections" tab is visible
- ✓ "Create New SHS Section" button is visible
- ✓ Modal markup exists in admin-dashboard.html
- ✓ admin-dashboard-sections.js loaded

**Solution:**
- Check for JavaScript errors in console
- Verify modal HTML structure in admin-dashboard.html
- Check admin-dashboard-sections.js for updateSHSElectives() function
- Verify form submission event listener is attached

---

## Logging Overview

### Key Log Points
| Component | Log Prefix | Logged On |
|-----------|------------|-----------|
| updateSHSElectivesOptions | `[SectionAssignment-v2]` | Track change, electives rendering |
| updateSHSSectionOptions | `[SectionAssignment-v2]` | Grade change, elective check, section filtering |
| updateSHSStudentsList | `[SectionAssignment-v2]` | Grade/track/elective change, student filtering |
| shs-track-config.js | `[SHS-Config]` | Initialization, electivesMap creation |
| Elective checkbox click | `[SectionAssignment-v2]` | Each checkbox state change |

### Enabling Detailed Logging
All logging is enabled by default. Search console for `[SectionAssignment-v2]` prefix.

---

## Database Status Verification

### Check Sections Table Structure
```sql
DESCRIBE sections;
```
Should include columns:
- `id` (int)
- `grade_level` (int)
- `track` (varchar) - "Academic", "TechPro", "Doorway"
- `electives` (text) - CSV string of elective names
- `section_name` (varchar)
- `section_code` (varchar)
- `school_year_id` (int) - Reference to school year
- `created_at` (timestamp)

### Check Sample Section with Electives
```sql
SELECT id, grade_level, track, section_code, electives 
FROM sections 
WHERE grade_level IN (11, 12) AND track IN ('Academic', 'TechPro') 
AND electives IS NOT NULL 
LIMIT 5;
```

Expected output:
```
id  | grade_level | track    | section_code | electives
----|-------------|----------|--------------|------------------------------------------
1   | 12          | Academic | SHS-12-A     | Biology 1-2, Physics 1-2
2   | 12          | Academic | SHS-12-B     | Creative Writing, Philosophy
3   | 12          | TechPro  | SHS-12-ICT   | Computer Programming Java, Web Design
```

---

## Performance Notes

- Electives dataset: ~177 total (87 Academic + 90 TechPro)
- Rendering time with 177 electives: <100ms
- Section filtering with multiple electives: <50ms
- Student filtering with multiple electives: <100ms

## Accessibility

- All checkboxes have associated labels
- Category headers use semantic HTML (h3, fieldset)
- Keyboard navigation: Tab through checkboxes, Space/Enter to toggle
- Screen readers: Labels announce "Academic - Biology 1-2" format

---

## File References

- **Frontend UI:** [admin-dashboard-section-assignment-v2.js](admin-dashboard-section-assignment-v2.js#L893) (lines 893-1160)
- **Electives Data:** [enrollment-form.js](enrollment-form.js#L58) (lines 58-220)
- **Configuration:** [shs-track-config.js](shs-track-config.js#L1) (complete file)
- **HTML Structure:** [admin-dashboard.html](admin-dashboard.html#L1540) (scripts section)
- **Backend API:** routes/sections.js (POST /api/sections/create-shs, line 92)
- **Database:** sections table in your database

---

## Summary

This SHS track and electives feature provides:
✅ **Track-based visibility** - Electives shown only for selected track  
✅ **Category organization** - 5 categories per track, clearly labeled  
✅ **Multi-select** - Choose one or more electives  
✅ **Section filtering** - Sections match by grade + track + at least one elective  
✅ **Student filtering** - Students match by grade + track + elective  
✅ **Modal consistency** - Same functionality in section creation and assignment  
✅ **Comprehensive logging** - Detailed console output for debugging  


