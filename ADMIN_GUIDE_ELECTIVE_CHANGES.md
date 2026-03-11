# Admin Quick Guide: Elective Changes & Section Reassignment

## What Changed?
When you change a student's electives in the **Student Directory > Edit Modal**, their section assignment is now **automatically cleared** if the track stays the same.

## Why?
- Prevents students from being assigned to sections that don't match their electives
- Ensures proper alignment between electives and class assignments
- Streamlines the reassignment workflow

## Step-by-Step Workflow

### Scenario: Update a Student's Electronics Class

**Before (Manual Approach):**
1. Edit student → Change electives
2. Approve changes
3. Go to Section Assignment
4. Manually find and remove student from section
5. Reassign to new section
6. ❌ Error-prone, multiple steps

**After (Automatic Approach):**
1. Edit student → Change electives
2. **Review shows the changes**
3. Click Approve
4. ✅ Section assignment **automatically cleared**
5. Go to Section Assignment
6. Student appears as **"Unassigned"**
7. Click assign → Done!

### Example Walkthrough

#### Step 1: Open Student Directory
```
Admin Dashboard > Student Management > Student Directory
```

#### Step 2: Find and Edit Student
```
Search for: "John Smith"
Click: Edit button for that student
Modal opens: Enrollment Details
```

#### Step 3: Navigate to Academic Tab
```
Click the "Academic" tab in modal
You should see:
- Grade Level
- Semester  
- Track (e.g., "TechPro")
- Search Electives bar
- ELECTIVES section
```

#### Step 4: Modify Electives
```
Current electives: Animation (NC II), Web Development (NC IV)
Goal: Change to just Animation (NC II)

Action:
1. Uncheck "Web Development (NC IV)"
2. Leave "Animation (NC II)" checked
3. Track remains: TechPro ← IMPORTANT
```

#### Step 5: Review Changes
```
Click "Review" button
Modal shows what changed:
- ✏️ ELECTIVES: Animation (NC II), Web Development (NC IV) → Animation (NC II)
```

#### Step 6: Approve
```
Click "Approve" button
System processes:
- ✅ Electives updated
- ✅ Section assignment cleared  
- ✅ Student now unassigned
```

#### Step 7: Reassign (If Needed)
```
Go to: Section Assignment module
Filter: "Unassigned Students"
You'll see: "John Smith"

Click "Assign" → Pick appropriate section
```

## What Happens Automatically?

When you approve elective changes:

| Automatic Action | Result |
|---|---|
| Compares old vs new electives | Detects what changed |
| Checks if track stayed same | Determines if section should clear |
| If electives changed | **Clears section assignment** |
| Sends update to server | Persists the change |

Behind the scenes:
```
Old Electives: [Animation, Web Development]
New Electives: [Animation]
Track: TechPro → TechPro (NO CHANGE)
Result: SECTION REMOVED ✅
```

## Visual Indicators

### In the Edit Modal (Review Screen)

```
ACADEMIC INFORMATION

TRACK: TechPro
   (no change indicator)

ELECTIVES: Animation (NC II), Web Development (NC IV) → Animation (NC II)
   ✏️ (shows as "changed" in review)
```

The ✏️ symbol indicates this field was modified.

### In Section Assignment Module

Students appear in one of two lists:

1. **ASSIGNED Students**
   ```
   Name: John Smith
   Grade: 11
   Section: TechPro-A
   Electives: Animation
   Status: Assigned ✓
   ```

2. **UNASSIGNED Students**
   ```
   Name: John Smith  
   Grade: 11
   Section: ---
   Electives: Animation
   Status: Unassigned ⚠️
   
   Action: [Assign] [Details]
   ```

After elective change, student moves from Assigned → Unassigned.

## Important Notes

### ✅ When Section IS Automatically Cleared
- Electives change
- Track: **SAME** ✓
- Had previous electives: **YES** ✓
- Action: **Section removed, needs reassignment**

### ❌ When Section IS NOT Automatically Cleared
- Only track changes (existing feature still handles this)
- No actual changes made to form
- Student has no previous electives (new enrollment)
- Other fields changed but not electives

### 🔄 Track Changes (Separate Process)
If you change the track (Academic → TechPro):
- All old electives automatically cleared
- Section always removed
- Student reassigned with new electives

## Common Questions

### Q: What if I just want to update the form but keep the section?
**A:** Don't change the electives. System only removes section if electives change.

### Q: Will students be notified?
**A:** Currently no automatic notification. (Planned for future)

### Q: Can I undo the section removal?
**A:** Not directly. You'll need to reassign in Section Assignment module. The elective change itself is saved, but you can reassign to a different section if needed.

### Q: What if no one reassigns the student?
**A:** Student will appear unassigned until someone does the reassignment in Section Assignment module.

### Q: Does this affect JHS (Junior High) students?
**A:** No. This only applies to SHS (Senior High) students who have tracks and electives.

### Q: Can I modify section assignment and electives in one step?
**A:** No. First update electives here, then reassign section in Section Assignment module.

## Troubleshooting

### "Student still has old section after approval"
**Check:**
1. Did you actually change the electives? (or just viewed?)
2. Did you click "Approve" button? (not Cancel or back)
3. Wait a moment, then refresh page
4. Clear browser cache if necessary

### "Student not appearing in Section Assignment"
**Check:**
1. Navigate to Section Assignment module
2. Click "Refresh" or reload page
3. Filter for "Unassigned Students"
4. Search by student name
5. Verify the enrollment date matches

### "Can't find unassigned students"
**Try:**
1. Clear all filters first
2. Scroll through the list (may be long)
3. Use Search/Filter by name
4. Check if student is in correct Grade Level/Track filter

## Best Practices

### ✅ DO
- Review all changes before approving
- Verify electives match student's goals
- Reassign students promptly in Section Assignment
- Check track before making elective changes
- Use clear reasons when documenting changes

### ❌ DON'T  
- Make accidental changes and then undo (causes unnecessary reassignments)
- Change electives without understanding section implications
- Forget to reassign unassigned students
- Change track if you only meant to update electives
- Close modal without saving (click Cancel/back)

## Permission Notes

You need these permissions:
- ✅ View Student Directory
- ✅ Edit Student Records
- ✅ Assign Sections

Contact your system administrator if you lack these permissions.

## Related Tasks

After using this feature:

1. **After changing electives:**
   - Go to → Section Assignment
   - Find unassigned student
   - Click Assign
   - Select compatible section
   - Confirm

2. **For bulk operations:**
   - Multiple students to change?
   - Use Student Directory filters
   - Edit each one (one at a time currently)
   - Then use Section Assignment for bulk reassign

3. **For reports:**
   - Electives Report shows updated info
   - Section Report shows unassigned

## Need Help?

- **How to use edit modal:** See "Student Management" documentation
- **Section assignment troubleshooting:** See "Section Assignment" guide
- **Electives configuration:** See "Electives Setup" documentation
- **Technical issues:** Contact IT Support with:
  - Student ID affected
  - Changes you made
  - Expected vs actual result
  - Browser console error (if any)

## Summary

| What | Before | After |
|------|--------|-------|
| Elective change | Manual section removal | Auto removed |
| Time to update | 5+ steps | 3 steps |
| Error risk | High (manual) | Low (automatic) |
| Reassignment | Required | Required |
| Student state | Inconsistently assigned | Properly unassigned |

**Result: Faster, safer, more reliable student updates!** ✨



