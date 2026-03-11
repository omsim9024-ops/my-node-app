# Electives Modal - Quick Testing Guide

## How to Test the Feature

### Step 1: Access the Admin Dashboard
1. Log in to the Admin Dashboard
2. Navigate to **Standard Reports** section
3. Scroll to **Electives Enrollment**

### Step 2: Locate the Table
You should see a table with the following columns:
- **Elective** (Elective name)
- **Male** (Number of male students)
- **Female** (Number of female students)  
- **Total** (Total enrolled students)
- **Action** (Contains the "View" button)

### Step 3: Click the View Button
1. Find an elective with enrollment data (e.g., "Citizenship and Civic Engagement" with 2 Male, 1 Female, 3 Total)
2. Click the **View** button in the Action column
3. The modal should open immediately

### Step 4: Verify Modal Content

#### Summary Section (Top of Modal)
You should see a summary card showing:
- 🔵 **Male**: Shows the number of male students (should match the table)
- 🔵 **Female**: Shows the number of female students (should match the table)
- 🔵 **Total Students**: Total count (should match the table)

**Example for "Citizenship and Civic Engagement":**
```
Male: 2          Female: 1          Total Students: 3
```

#### Student List Table (Below Summary)
The table should display all students with:
- **Name**: Full student name (displayed in bold)
- **Grade Level**: Student's grade (e.g., Grade 11)
- **Gender**: Male or Female
- **Section**: Student's section/class

**Expected Columns:**
| Name | Grade Level | Gender | Section |
|------|-------------|--------|---------|
| (Student 1) | Grade 11 | Male | Section-A |
| (Student 2) | Grade 11 | Female | Section-B |
| (Student 3) | Grade 11 | Male | Section-A |

### Step 5: Validate Data Accuracy

- [ ] Count of male students in table = Male count in summary
- [ ] Count of female students in table = Female count in summary
- [ ] Total row count = Total in summary
- [ ] No students from other electives appear in the list
- [ ] All student names are displayed correctly
- [ ] Grade levels are accurate
- [ ] Gender is accurate
- [ ] Section information is populated (or shows "--" if missing)

### Step 6: Test Modal Controls

- [ ] Click the **X** button to close the modal
- [ ] Click **Close** button at the bottom to close the modal
- [ ] Click outside the modal to close it (background click)
- [ ] Modal reopens when clicking View again on the same elective

### Step 7: Test with Different Electives

Repeat the process with different electives that have varying enrollment:
- [ ] Electives with 0 students → Modal should show "No students found"
- [ ] Electives with only male students
- [ ] Electives with only female students
- [ ] Electives with mixed enrollment

### Step 8: Check Console for Debugging

Open Developer Tools (F12) and check the Console tab:
- [ ] No JavaScript errors should appear
- [ ] The following debug logs should appear when clicking View:
  ```
  [showStatModal] === ELECTIVE DEBUG ===
  [showStatModal] Target elective name: [ElectiveName]
  [showStatModal] Total matched students: [Count]
  [showStatModal] Filtered students count: [Count]
  ```

## Troubleshooting

### Issue: Modal doesn't open when clicking View
**Solution:**
1. Check browser console (F12) for errors
2. Verify students have electives data in enrollments
3. Clear browser cache and refresh the page

### Issue: Modal shows wrong student count
**Solution:**
1. Verify the enrollment data in the database
2. Check that students have the correct elective assigned
3. Clear browser cache (page might be showing cached data)
4. Open console to verify the SQLite data

### Issue: Section information shows as "--"
**Solution:**
1. This is normal if section data is not populated in the database
2. Section data may be optional in your system
3. Verify the enrollments table has section information

### Issue: Gender breakdown doesn't match
**Solution:**
1. Check student gender values are properly stored as 'male', 'female', 'm', 'f', 'Male', or 'Female'
2. Open console to see the filtered students details
3. Verify database values match expected format

## Expected Behavior Summary

✅ **When working correctly:**
- Clicking "View" opens a modal smoothly
- Modal displays a summary with male/female/total counts
- All enrolled students are listed with their details
- Counts in summary match the count of rows in the table
- Gender breakdown totals match the original table
- Only students in that specific elective are shown
- Modal can be closed and reopened

❌ **If something's wrong:**
- Check browser console (F12) for error messages
- Verify student enrollment data in database
- Check that electives are properly assigned to students
- Look at server logs for API errors

## Performance Notes

- Modal loads instantly (data is already loaded in page)
- Scrollable table for large enrollment lists
- Smooth animations on open/close
- No page reload required

## File References

**Implementation File**: `admin-dashboard.js` (Lines 3850-3950)
**Function**: `showStatModal(filter, title)`
**CSS Used**: `.report-table`, `.modal-content`, `.modal-body`

---

**Test Date**: _______________
**Tester Name**: _______________
**Status**: ✅ Pass / ❌ Fail / ⚠️ Partial

**Notes**: _____________________________________________________


