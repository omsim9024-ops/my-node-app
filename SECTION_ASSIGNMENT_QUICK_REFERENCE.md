# 👥 Section Assignment - Quick Reference Card

## 🚀 Quick Start

### 1. Navigate to Section Assignment
- Admin Dashboard → Student Management → Section Assignment

### 2. Choose Level
- 🧒 Junior High School (JHS) - Grades 7-10
- 🎓 Senior High School (SHS) - Grades 11-12

---

## 📊 Panel Overview

| Left Panel | Right Panel |
|-----------|------------|
| 📋 Students | 🏫 Section |
| Search & Filters | Section Selector |
| Student List | Section Details |
| Checkboxes | Assigned Students |
| Action Buttons | Confirmation |

---

## 🔍 Filter Cheat Sheet

| Filter | JHS | SHS |
|--------|-----|-----|
| Grade | ✓ 7-10 | ✓ 11-12 |
| Track | ✗ | ✓ Acad/Tech/Door |
| Elective | ✗ | ✓ All |
| Gender | ✓ M/F | ✓ M/F |
| Search | By Name/ID | By Name/ID |

---

## ⚡ Quick Actions

| Action | How To | Result |
|--------|-------|--------|
| **Assign 1-2 students** | Check boxes → Select Section → "Assign Selected" | Manual assignment |
| **Assign whole grade** | Filter Grade → Select Section → "Assign All" | Bulk assignment (fast!) |
| **Assign by track** | Filter Track+Elective → Select Section → "Assign All" | SHS bulk (recommended) |
| **Remove student** | Select section → Find student → Click ❌ | Student removed |
| **Reset filters** | Click ↺ Reset button | All filters cleared |

---

## ✔️ Eligibility Rules

### JHS
```
✓ Student Grade = Section Grade
Example: Grade 7 student → Grade 7 section only
```

### SHS
```
✓ Student Grade = Section Grade
✓ Student Track = Section Track  
✓ Student Elective = Section Elective

Example: Grade 11 Academic ICT → Grade 11 Academic ICT section only
```

---

## 💡 Pro Tips

1. **Bulk Assignment First**
   - Use "Assign All Filtered" for large groups
   - Much faster than manual selection

2. **Filter Before Assign**
   - Filter by grade first
   - Then by track/elective (SHS)
   - Select target section
   - Bulk assign

3. **Check Before Confirming**
   - Read the summary dialog
   - Verify section name
   - Confirm student count

4. **Use Search for Exceptions**
   - Find individual students
   - Manually check/assign
   - Useful for special cases

---

## 🎯 Common Workflows

### Workflow 1: Grade-Level Assignment
```
1. Select JHS
2. Filter Grade 7
3. Select 7-A section
4. Click "Assign All Filtered"
5. Confirm "You are assigning 40 students..."
6. Done! ✓
```

### Workflow 2: Track-Based Assignment (SHS)
```
1. Select SHS
2. Filter Track: Academic
3. Filter Elective: Science
4. Select matching section
5. Click "Assign All Filtered"
6. Confirm and assign
7. Done! ✓
```

### Workflow 3: Manual Mixed Assignment
```
1. Select level
2. Search/Filter to find students
3. Check 3-5 students you want
4. Select target section
5. Click "Assign Selected (3)"
6. Confirm
7. Done! ✓
```

---

## 📈 Live Statistics

As you work, watch these update:
- **Filtered**: Number of students matching your filters
- **Selected**: Number of students you've checked
- **Assigned**: Number of students in selected section

---

## ⚠️ Important Notes

- ✅ System prevents duplicate assignments
- ✅ Already-assigned students don't appear in list
- ✅ Validation prevents grade/track mismatches
- ✅ Only shows "Approved" enrollments
- ✅ All changes saved to database

---

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| No students shown | Check filters, ensure grade selected |
| Can't click "Assign" | Select a section first |
| Section not showing | Select correct level (JHS/SHS) |
| Students already assigned | They won't appear in student list |
| Validation error | Student doesn't match section requirements |

---

## 📞 Quick Links
- Full Guide: `SECTION_ASSIGNMENT_COMPLETE_GUIDE.md`
- API Reference: Contact backend team
- Support: Check browser console for errors

---

**Remember**: 
- ✅ Always check the confirmation summary
- ✅ Use bulk assign for speed
- ✅ Filters prevent mistakes
- ✅ Validation ensures data integrity

Good luck with section assignments! 🎓

