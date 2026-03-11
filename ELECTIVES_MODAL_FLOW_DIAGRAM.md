# Electives Modal UI/UX Flow Diagram

## User Interface Layout

### BEFORE - Admin Dashboard (Electives Enrollment Table)
```
┌─────────────────────────────────────────────────────────────────────┐
│ STANDARD REPORTS > Electives Enrollment                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Elective                              Male  Female  Total  Action   │
│  ────────────────────────────────────────────────────────────────   │
│  Citizenship and Civic Engagement       2      1      3    [View]   │
│  Creative Industries                    2      0      2    [View]   │
│  Animation (NC II)                      0      1      1    [View]   │
│  Basic Accounting                       1      0      1    [View]   │
│  Broadband Installation                 1      0      1    [View]   │
│  Programming (.NET)                     1      0      1    [View]   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

USER CLICKS "View" ➜ Modal Opens
```

### AFTER - Modal Opened

```
┌────────────────────────────────────────────────────────────────────────┐
│  ⚡ Students: Citizenship and Civic Engagement            [X]          │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  SUMMARY SECTION                                                       │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Male: 2          Female: 1          Total Students: 3           │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  STUDENT DETAILS TABLE                                                 │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │ Name            │ Grade Level │ Gender │ Section             │   │
│  ├─────────────────┼─────────────┼────────┼─────────────────────┤   │
│  │ John Doe        │ Grade 11    │ Male   │ STEM-A              │   │
│  │ Jane Smith      │ Grade 11    │ Female │ STEM-B              │   │
│  │ Mike Johnson    │ Grade 11    │ Male   │ STEM-A              │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                         │
├────────────────────────────────────────────────────────────────────────┤
│                                          [Close]                       │
└────────────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    USER INTERACTION                                 │
│                                                                     │
│  Admin Dashboard Loads                                             │
│  ↓                                                                 │
│  loadElectivesReport(students) called                             │
│  ↓                                                                 │
│  Creates:                                                         │
│  - window.currentReportStudents = [all students]                 │
│  - window.electiveDataGlobal = {counts by elective}              │
│  - window.electiveNameMapping = {sanitized → actual names}       │
│  ↓                                                                 │
│  Table rendered with View buttons                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    USER CLICKS VIEW BUTTON                          │
│                                                                     │
│  onclick="showStatModal('elective-single-{sanitized}',            │
│           'Students: {name}')"                                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────────┐
│              SHOWSTATMODAL() FUNCTION EXECUTED                      │
│                                                                     │
│  1. Extract sanitized name: "citizenship-and-civic-engagement"    │
│  2. Lookup actual name: "Citizenship and Civic Engagement"        │
│  3. Filter students by elective                                   │
│     filteredStudents = students.filter(s =>                       │
│       s.electives.includes("Citizenship and...")                  │
│     )                                                              │
│  4. Count male: 2, female: 1, total: 3                           │
│  5. Generate summary HTML                                         │
│  6. Generate table HTML with student details                      │
│  7. Insert into modal body                                        │
│  8. Show modal with animation                                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    MODAL DISPLAYED TO USER                         │
│                                                                     │
│  - Summary shows accurate counts                                   │
│  - Table lists all matched students                                │
│  - All data matches original table                                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    USER CLOSES MODAL                               │
│                                                                     │
│  Options:                                                          │
│  - Click X button                                                  │
│  - Click Close button                                              │
│  - Click background/outside modal                                  │
│                                                                     │
│  closeStatModal() called                                           │
│  - Remove active class                                             │
│  - Restore body overflow                                           │
│  - Hide modal                                                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Student Filtering Logic

```
Input: Current Student List (100 students from all electives)

                              ↓

Filter Condition:
  FOR EACH student IN allStudents:
    IF student.electives.includes('Citizenship and Civic Engagement'):
      INCLUDE in filteredStudents
    ELSE:
      EXCLUDE from filteredStudents

                              ↓

Output: Filtered List (3 students in this elective)
  ┌─────────────────────────┐
  │ John Doe - Male         │
  │ Jane Smith - Female     │
  │ Mike Johnson - Male     │
  └─────────────────────────┘

                              ↓

Count Breakdown:
  Male Count: 2
  Female Count: 1
  Total Count: 3

                              ↓

Display in Modal:
  Summary: Male: 2 | Female: 1 | Total: 3
  Table: [3 rows of student data]
```

## Modal State Management

```
┌──────────────────────┐
│   MODAL STATES       │
└──────────────────────┘

HIDDEN (Default)
└─ modal.classList = ['modal']
└─ modal.style.display = 'none'
└─ modal.aria-hidden = 'true'
└─ document.body.overflow = 'auto'

         ↕ [showStatModal()]
         
VISIBLE (Active)
└─ modal.classList = ['modal', 'active']
└─ modal.style.display = 'flex'
└─ modal.aria-hidden = 'false'
└─ document.body.overflow = 'hidden'
└─ Content populated with student data

         ↕ [closeStatModal()]
         
HIDDEN (Closed)
└─ Back to initial state
```

## Sample Data Structure

```javascript
// Student Object
{
  id: 1,
  first_name: "John",
  last_name: "Doe",
  email: "john.doe@school.com",
  grade_level: "11",
  gender: "male",              // ← Used for gender count
  section: "STEM-A",           // ← Displayed in table
  electives: [                 // ← Used for filtering
    "Citizenship and Civic Engagement",
    "Pre-Calculus 1-2"
  ]
}

// Filtering Example
student.electives.includes("Citizenship and Civic Engagement") // TRUE → Include
```

## Validation Flow

```
┌───────────────────────────────────────┐
│  DATA VALIDATION CHECKLIST            │
└───────────────────────────────────────┘

☑ Female count in summary = number of {gender: 'f'|'female'} rows
☑ Male count in summary = number of {gender: 'm'|'male'} rows
☑ Total in summary = maleCount + femaleCount = number of table rows
☑ All students in table have selected elective
☑ No students without the elective appear
☑ All student names populated (or show '--')
☑ All grade levels formatted correctly
☑ All genders capitalized properly
☑ Section info displayed (or '--' if missing)
☑ No duplicate student entries

✓ If ALL checks pass → Data Integrity Verified
✗ If ANY check fails → Data Integrity Issue
```

## Responsive Design Behavior

```
DESKTOP (1024px+)
┌─────────────────────────────────────────┐
│ Title                              [X]  │
├─────────────────────────────────────────┤
│                                         │
│ Summary: [Male] [Female] [Total]        │
│                                         │
│ ┌───────────────────────────────────┐   │
│ │ Name | Grade | Gender | Section   │   │
│ ├───────────────────────────────────┤   │
│ │ ... detailed rows ...             │   │
│ └───────────────────────────────────┘   │
│                                         │
├─────────────────────────────────────────┤
│                          [Close]        │
└─────────────────────────────────────────┘

TABLET (768px)
┌────────────────────────────┐
│ Title              [X]     │
├────────────────────────────┤
│ Summary (stacked):         │
│ Male: 2                    │
│ Female: 1                  │
│ Total: 3                   │
│                            │
│ Table (scrollable):        │
│ ... student rows ...       │
│                            │
├────────────────────────────┤
│              [Close]       │
└────────────────────────────┘

MOBILE (320px - 480px)
┌──────────────────┐
│ Title      [X]   │
├──────────────────┤
│ M:2 F:1 T:3     │
│                  │
│ Name             │
│ Grade/Gender/Sec │
│ ──────────────── │
│ ... more rows    │
│                  │
├──────────────────┤
│      [Close]     │
└──────────────────┘
```

## Color & Styling Reference

```
PRIMARY COLORS
├─ Dark Green (#1e5631) - Headers, accents, borders
├─ Light Gray (#f5f5f5) - Summary background
└─ White - Main modal background

TEXT COLORS
├─ Dark Gray (#333) - Primary text
├─ Medium Gray (#666) - Secondary text
└─ Light Gray (#999) - Disabled text

INTERACTIONS
├─ Hover: Light background (#f9f9f9)
├─ Focus: Box shadow outline
└─ Active: Darker shade

ANIMATIONS
├─ Modal open: fadeIn 0.3s + slideUp 0.3s
├─ Table row hover: 0.2s background transition
└─ Button hover: 0.2s color/shadow transition
```

## Summary

**Key Points**:
1. ✅ User clicks View → Modal opens instantly
2. ✅ Summary shows accurate gender/total counts
3. ✅ Table displays all matched students with details
4. ✅ Data integrity verified at display time
5. ✅ All counts match the original table
6. ✅ User can close modal and reopen anytime
7. ✅ Fully responsive on all devices
8. ✅ Accessible with keyboard shortcuts

---
**Implementation Date**: February 16, 2026


