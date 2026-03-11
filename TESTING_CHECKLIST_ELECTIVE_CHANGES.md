# Testing Checklist: Elective Change Section Assignment Feature

## Pre-Test Requirements

- [ ] Database has test students with electives and section assignments
- [ ] Admin account with appropriate permissions
- [ ] Section Assignment module functioning
- [ ] Admin Dashboard and Student Directory accessible
- [ ] Network activity monitored (DevTools > Network tab)
- [ ] Browser console open (DevTools > Console)

## Test Cases

### Test Case 1: Basic Elective Change (Same Track)

**Setup:**
- Create/find student: "Test Student 1"
- Track: TechPro
- Current electives: [Animation (NC II), Web Development (NC IV)]
- Current section: TechPro-Section-A

**Steps:**
1. [ ] Navigate to Admin Dashboard > Student Directory
2. [ ] Search for "Test Student 1"
3. [ ] Click "Edit" button
4. [ ] Go to "Academic" tab
5. [ ] Verify current electives display: Animation, Web Development
6. [ ] Uncheck "Web Development (NC IV)"
7. [ ] Keep track as "TechPro" (unchanged)
8. [ ] Click "Review" button

**Verify in Review Modal:**
9. [ ] See section: "ACADEMIC INFORMATION"
10. [ ] See "ELECTIVES:" with ✏️ change indicator
11. [ ] Shows: "Animation (NC II), Web Development (NC IV) → Animation (NC II)"
12. [ ] Click "Approve"

**Verify Backend (Console):**
13. [ ] Check browser console (F12 > Console)
14. [ ] Look for logs starting with `[Students]`
15. [ ] Should see: `ELECTIVE COMPARISON:`
16. [ ] Should see: `Old electives: animation (nc ii), web development (nc iv)`
17. [ ] Should see: `New electives: animation (nc ii)`
18. [ ] Should see: `Different number of electives`
19. [ ] Should see: `✅✅✅ ELECTIVE CHANGE DETECTED (same track) ✅✅✅`
20. [ ] Should see: `✅✅✅ SECTION REMOVAL TRIGGERED (ELECTIVE CHANGE) ✅✅✅`

**Verify Network Request:**
21. [ ] Check DevTools > Network tab
22. [ ] Find PATCH request to `/api/enrollments/by-student/...`
23. [ ] Click on request, go to "Request" tab
24. [ ] Verify JSON payload contains:
    ```json
    "section_id": null,
    "class_id": null
    ```
25. [ ] Verify response status: 200 (Success)

**Verify in Section Assignment:**
26. [ ] Navigate to Section Assignment module
27. [ ] Filter by Grade 11 (if applicable)
28. [ ] Find "Test Student 1" in UNASSIGNED list
29. [ ] Verify student appears with:
    - Name: Test Student 1 ✓
    - Grade: 11 ✓
    - Electives: Animation (NC II) ✓
    - Section: --- (empty) ✓

**✅ Test Case 1: PASSED** if all steps verified

---

### Test Case 2: Track Change (Confirm Existing Feature Still Works)

**Setup:**
- Use "Test Student 2"
- Track: Academic
- Electives: [English, Mathematics]
- Current section: Academic-Section-B

**Steps:**
1. [ ] Navigate to Student Directory
2. [ ] Edit "Test Student 2"
3. [ ] Go to "Academic" tab
4. [ ] Change Track from "Academic" to "TechPro"
5. [ ] Click "Review"
6. [ ] Verify old electives are cleared
7. [ ] Click "Approve"

**Verify:**
8. [ ] Console shows: `TRACK CHANGE DETECTED`
9. [ ] Console shows: `Changing from "academic" to "techpro"`
10. [ ] Console shows: `✅✅✅ SECTION REMOVAL TRIGGERED ✅✅✅` (for track change)
11. [ ] Payload has `section_id: null`
12. [ ] Student appears unassigned in Section Assignment

**✅ Test Case 2: PASSED** if all steps verified

---

### Test Case 3: No Change Scenario

**Setup:**
- Use "Test Student 3"
- Track: TechPro
- Electives: [Cooking (NC II)]
- Current section: TechPro-Section-C

**Steps:**
1. [ ] Edit "Test Student 3"
2. [ ] Go to "Academic" tab
3. [ ] **Make NO changes to electives or track**
4. [ ] Click "Review"

**Verify:**
5. [ ] Review shows "No changes detected" message
6. [ ] "Approve" button might be disabled or warns
7. [ ] Click back / Cancel
8. [ ] Return to Student Directory
9. [ ] Verify student still assigned to TechPro-Section-C

**Console:**
10. [ ] Should NOT see `ELECTIVE CHANGE DETECTED` log

**✅ Test Case 3: PASSED** if no changes are processed

---

### Test Case 4: Same Electives, Different Representation

**Setup:**
- Student has electives stored as: ["Animation (NC II)", "Web Dev"]
- (Note: Different capitalization/names for same course)

**Steps:**
1. [ ] Edit student
2. [ ] Current electives show: "Animation (NC II)", "Web Dev"
3. [ ] Manually check: "Animation (NC II)", "Web Development (NC IV)"
4. [ ] Click "Review" and "Approve"

**Verify:**
5. [ ] Should trigger elective change (if they truly are different courses)
6. [ ] Consult course mapping if courses are actually different names
7. [ ] Should remove section if genuinely different

**✅ Test Case 4: PASSED** if logic correctly distinguishes

---

### Test Case 5: New Enrollment (0 → N Electives)

**Setup:**
- New student with NO previous electives
- No section assigned yet

**Steps:**
1. [ ] Edit new student
2. [ ] Add electives for first time: ["Animation (NC II)"]
3. [ ] Click "Review" and "Approve"

**Verify:**
4. [ ] Console should show: `No elective change detected` (or similar message)
5. [ ] Section should NOT be removed (because oldElectivesNorm.length === 0)
6. [ ] Console condition: `oldElectivesNorm.length > 0` should be false

**✅ Test Case 5: PASSED** if no section removed for new enrollment

---

### Test Case 6: Multiple Electives Change

**Setup:**
- Student with 2 academic electives
- Track: Academic (stays same)

**Steps:**
1. [ ] Edit student
2. [ ] Current: [Leadership, Creative Writing]
3. [ ] Change to: [Philosophy, Citizenship]
4. [ ] Click "Review" and "Approve"

**Verify:**
5. [ ] Console: `Different number of electives` OR specific changes logged
6. [ ] Both old electives changed (100% different)
7. [ ] Should trigger section removal
8. [ ] Student unassigned in Section Assignment

**✅ Test Case 6: PASSED**

---

### Test Case 7: Add Elective (Without Removing)

**Setup:**
- Student with 1 elective: [Animation]
- Academic Track allows 2

**Steps:**
1. [ ] Edit student
2. [ ] Current: [Animation] 
3. [ ] Add second: [Animation, Web Development]
4. [ ] Track: Academic (same)
5. [ ] Click "Review" and "Approve"

**Verify:**
6. [ ] Console: `Different number of electives`
7. [ ] Should still trigger removal (added != removed, but still different)
8. [ ] Student appears unassigned

**Note:** This tests the "number of electives" comparison path

**✅ Test Case 7: PASSED**

---

### Test Case 8: Remove and Add Different Electives

**Setup:**
- Student: [Art, Music] (Academic)
- Electives need significant change

**Steps:**
1. [ ] Edit student
2. [ ] Current: [Art, Music]
3. [ ] Change to: [Philosophy, Leadership]  
4. [ ] Track: Academic (same)
5. [ ] Click "Review" and "Approve"

**Verify:**
6. [ ] All 4 electives are different
7. [ ] Section should be removed
8. [ ] Student unassigned

**✅ Test Case 8: PASSED**

---

### Test Case 9: Case Sensitivity Edge Case

**Setup:**
- Stored as: "Animation (NC II)"
- Attempt to enter: "animation (nc ii)"

**Steps:**
1. [ ] Use browser dev tools to manually edit form
2. [ ] Change one elective to different capitalization
3. [ ] Click "Approve"

**Verify:**
4. [ ] Normalization should make them equivalent
5. [ ] Should NOT trigger change (because normalized, they're same)
6. [ ] Section should remain assigned

**✅ Test Case 9: PASSED**

---

### Test Case 10: Whitespace Edge Case

**Setup:**
- Stored as: "Animation (NC II)"
- User enters: " Animation (NC II) " (with spaces)

**Steps:**
1. [ ] Edit student
2. [ ] Manually add spaces/newlines if possible
3. [ ] Click "Approve"

**Verify:**
4. [ ] Trim logic should normalize whitespace
5. [ ] Should NOT trigger change
6. [ ] Section remains assigned

**✅ Test Case 10: PASSED**

---

## Bulk Testing (If applicable)

### Test Case 11: Rapid Sequential Changes

**Setup:**
- 5 students all need elective updates

**Steps:**
1. [ ] Edit Student 1, change electives, approve
2. [ ] Wait for completion
3. [ ] Edit Student 2, change electives, approve
4. [ ] Wait for completion
5. [ ] Repeat for Students 3, 4, 5
6. [ ] Monitor server logs for concurrent requests

**Verify:**
7. [ ] Each student processed independently
8. [ ] No cross-contamination between saves
9. [ ] Each appears as unassigned when appropriate
10. [ ] No database race conditions (all have null section_id)

**✅ Test Case 11: PASSED**

---

## Data Validation Tests

### Test Case 12: Edge Case - Null/Empty Electives

**Setup:**
- Student with null electives field
- OR empty electives array []

**Steps:**
1. [ ] Edit this student
2. [ ] Make some change (e.g., grade)
3. [ ] Attempt to change electives (or leave empty)
4. [ ] Click "Approve"

**Verify:**
5. [ ] No crash or JavaScript error
6. [ ] Console shows graceful handling
7. [ ] Section only removed if there WERE previous electives
8. [ ] Function completes normally

**✅ Test Case 12: PASSED**

---

### Test Case 13: Enrollment Data Format Variations

**Setup:**
- Test students with different enrollment_data formats:
  - JSON object: `{academicElectives: [...]}`
  - JSON string: `"{academicElectives: [...]}"`
  - Legacy format: `{electives: [...]}`

**Steps:**
1. [ ] Edit each format variant
2. [ ] Change electives
3. [ ] Click "Approve"

**Verify:**
4. [ ] Code handles JSON parsing
5. [ ] Fallbacks work for missing fields
6. [ ] All formats trigger elective detection
7. [ ] No errors in console

**✅ Test Case 13: PASSED**

---

## UI/UX Tests

### Test Case 14: Review Modal Shows Changes Clearly

**Steps:**
1. [ ] Edit student and change electives
2. [ ] Click "Review"
3. [ ] Look at Academic Information section

**Verify:**
4. [ ] Old electives visible
5. [ ] Arrow or separator shows change
6. [ ] New electives visible
7. [ ] Field is marked as "changed" (✏️ or similar)
8. [ ] Clearly understandable to admin

**✅ Test Case 14: PASSED**

---

### Test Case 15: Approval Flow is Clear

**Steps:**
1. [ ] See review modal
2. [ ] Click "Approve" button
3. [ ] Modal closes
4. [ ] Return to Student Directory

**Verify:**
5. [ ] Confirmation message appears
6. [ ] "Saved to server" or similar message
7. [ ] No error messages
8. [ ] User knows process completed
9. [ ] Can proceed to reassign in Section Assignment

**✅ Test Case 15: PASSED**

---

## Error Handling Tests

### Test Case 16: Server Error Scenario

**Setup:**
- Simulate server error (modify backend to return 500)
- OR use network throttling to timeout request

**Steps:**
1. [ ] Edit student, make elective change
2. [ ] Cause server error during save
3. [ ] Click "Approve"

**Verify:**
4. [ ] Graceful error message shown
5. [ ] No JavaScript crash
6. [ ] User informed of failure
7. [ ] Can retry
8. [ ] Console shows error details for IT support

**✅ Test Case 16: PASSED**

---

### Test Case 17: Network Error Scenario

**Setup:**
- Disconnect network or use offline mode
- Attempt to save while offline

**Steps:**
1. [ ] Edit student, make change
2. [ ] Go offline (DevTools > Network > Offline)
3. [ ] Click "Approve"

**Verify:**
4. [ ] Shows "offline" or network error
5. [ ] Offers to retry
6. [ ] Can attempt again when online
7. [ ] No data lost

**✅ Test Case 17: PASSED**

---

## Performance Tests

### Test Case 18: Large List Performance

**Setup:**
- Student Directory with 500+ students loaded

**Steps:**
1. [ ] Edit a student
2. [ ] Change electives
3. [ ] Click "Approve"
4. [ ] Monitor performance

**Verify:**
5. [ ] Response time < 2 seconds
6. [ ] Browser doesn't freeze
7. [ ] Elective comparison is fast
8. [ ] No lag in UI

**✅ Test Case 18: PASSED**

---

### Test Case 19: Electives Array with Many Items

**Setup:**
- Student with 100+ items in electives array (edge case)

**Steps:**
1. [ ] Edit student
2. [ ] Change one elective
3. [ ] Click "Approve"

**Verify:**
4. [ ] Comparison still fast (set deduplication works)
5. [ ] Result is correct
6. [ ] No performance degradation

**✅ Test Case 19: PASSED**

---

## Browser Compatibility Tests

### Test Case 20: Cross-Browser Testing

**Browsers to test:**
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

**Steps (per browser):**
1. [ ] Edit student, change electives
2. [ ] Review and approve
3. [ ] Check console for errors
4. [ ] Verify section removed
5. [ ] Check Section Assignment module

**Verify each browser:**
6. [ ] Elective detection works
7. [ ] Console logs appear
8. [ ] No JavaScript errors
9. [ ] Network request succeeds
10. [ ] Section properly cleared

**✅ Test Case 20: PASSED** (All browsers)

---

## Final Verification Checklist

- [ ] All 20 test cases passed
- [ ] No console errors
- [ ] All network requests successful
- [ ] Section Assignment reflects changes
- [ ] Database shows null section_id
- [ ] Student notification flow (if implemented)
- [ ] Documentation is accurate
- [ ] Admin guide is clear
- [ ] No performance issues
- [ ] Cross-browser compatibility confirmed

---

## Sign-Off

**Tested by:** _________________ **Date:** _______  
**System:** _________________ **Environment:** Dev / Staging / Prod  
**Overall Status:** ☐ PASS ☐ FAIL ☐ WITH ISSUES

**Issues Found:**
```
[List any issues encountered]
```

**Notes:**
```
[Additional observations]
```

---

## Test Report Template

**Feature:** Elective Change Section Assignment  
**Version:** 1.0  
**Date Tested:** [Date]  
**Tester:** [Name]  
**Duration:** [Time spent]  
**Tests Run:** [Number] / [Total]  
**Passed:** [Number] / [Total]  
**Failed:** [Number] / [Total]  
**Skipped:** [Number] / [Total]  
**Overall Result:** ☐ Ready for Production ☐ Needs Fixes ☐ Blocked


