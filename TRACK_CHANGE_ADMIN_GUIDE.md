# Admin Guide: Managing Track Changes and Section Assignments

## Quick Overview
When you change a student's **track** (Academic → TechPro, TechPro → Academic, etc.), the system **automatically removes them from their current section assignment**. This is necessary because different tracks have different section groupings.

## When Does This Happen?

✅ **Automatic section removal occurs when:**
- You edit a student in the Student Directory
- You change their track field
- You save the changes

❌ **Section is NOT removed when:**
- You change other fields (name, address, grade, etc.)
- You change only the electives
- You save without changing the track

## Step-by-Step: Changing a Student's Track

### 1. Open Student Directory
- Navigate to the **Student Management** section
- Click on **Student Directory** tab

### 2. Find and Edit the Student
- Search for the student by name or LRN
- Click the **Edit** button on the student row
- The enrollment detail modal will open

### 3. Update Academic Information
In the **Academic** tab:
- Change the **Grade Level** if needed
- **Change the Track** (e.g., from Academic to TechPro)
- Select appropriate **electives** for the new track:
  - **Academic track**: Select 2 academic electives
  - **TechPro track**: Select 1 TechPro elective
  - **Doorway track**: Select 1 Academic + 1 TechPro elective

### 4. Save Changes
- Click the **"Save"** button at the bottom
- Wait for confirmation: "Saved changes to server"
- The modal will close automatically

### 5. What Happens Automatically
After you save:
- ✅ Old track's electives are cleared
- ✅ New track's electives are saved
- ✅ **Student is removed from their previous section**
- ✅ System status updates across all modules

### 6. Reassign to New Section
Now the student needs to be assigned to a section matching their new track:

1. Go to **Section Assignment** module
2. Select the appropriate **Grade Level** and **Section** for the new track
3. Find the student in the **"Unassigned Students"** list (they'll be at the top)
4. Select the student
5. Click **"Assign to Section"**
6. Confirm the assignment

## Example Scenarios

### Scenario 1: Academic → TechPro
| Step | Track | Section Assignment |
|------|-------|-------------------|
| Initial | Academic | Section IX-Phoenix |
| Edit Academic info | TechPro | **Section REMOVED** ✓ |
| Reassign | TechPro | Section IX-Lambda |

### Scenario 2: Grade Promotion with Same Track
| Step | Grade | Track | Section |
|------|-------|-------|---------|
| Initial | Grade 9 | Academic | Section IX-Phoenix |
| Edit (grade only) | Grade 10 | Academic | **Still IX-Phoenix** ✗ |

→ In this case, section is **NOT** removed because track didn't change.

### Scenario 3: Doorway → Academic
| Step | Track | Electives Selected | Section |
|------|-------|------------------|---------|
| Initial | Doorway | 1 Academic + 1 TechPro | Section X-Omega |
| Change to Academic | Academic | 2 Academic | **Section REMOVED** ✓ |
| Reassign | Academic | Same 2 Academic | New Academic Section |

## System Notifications

You'll see confirmation messages at each step:

| Message | Meaning |
|---------|---------|
| "Saved changes to server" | ✅ Track change and section removal successful |
| "No changes to save" | ⚠️ You didn't actually change anything |
| "Failed to reject enrollment: ..." | ❌ Server error - check connection and try again |

## Checking the Status

### To verify a student's section was removed:
1. Go to **Student Directory** again
2. Search for the student
3. The student row should show **no section assigned** (or empty section field)

### To see unassigned students:
1. Go to **Section Assignment** module
2. Select the correct **Grade Level**
3. Look at the **"Unassigned Students"** table
4. The student should appear there (ready for reassignment)

## Important Notes

⚠️ **Remember:**
- You **MUST reassign the student** to a section that matches their new track
- Students can't be in a section that doesn't match their track
- If a student changes tracks again, their new section will be removed too
- Always verify the electives are correct for the new track

💡 **Best Practice:**
1. Change track → System auto-removes section
2. Immediately reassign to new section → Student is active again
3. Avoid leaving students unassigned for long periods

## Troubleshooting

### "Student not appearing in Unassigned Students"
- Refresh the page (F5)
- Make sure you selected the correct Grade Level
- Check if student might be in a different school year

### "Can't save changes"
- Check your internet connection
- Ensure all required fields have values
- Try again - temporary server issues are rare

### "Student still shows in old section"
- Wait 1-2 seconds and refresh
- Check the Section Assignment module to see current state
- Contact IT if issue persists

## FAQ

**Q: What if I accidentally change a student's track?**
A: Edit them again and change it back to the correct track. Their new section assignment will also be removed if you do this.

**Q: Can I change the track without removing the section?**
A: No - for data integrity, tracks and sections must align. The system automatically enforces this.

**Q: What happens to attendance records when section is removed?**
A: Attendance records are preserved in the system. They're separate from section assignments.

**Q: Can I change just the electives without affecting the section?**
A: Yes! Only changing the track removes the section. Changing electives alone keeps the section intact.

**Q: How long does reassignment take?**
A: It's immediate. The student appears in unassigned list within seconds, and once reassigned, they're active in the new section right away.

