# 🏫 Sections Management - Quick Start Guide

## How to Access
1. Log in to Admin Dashboard
2. Go to **Student Management** menu (left sidebar)
3. Click **Sections** submenu item
4. You'll see the Sections Management page

---

## 📋 Quick Overview

### Two School Levels

#### 🧒 Junior High School (JHS)
- For Grades 7-10
- Simpler structure with fewer fields
- Optional program type (Regular/Special Program)
- **School year automatically assigned** from active school year

#### 🎓 Senior High School (SHS)
- For Grades 11-12
- Advanced structure with tracks and electives
- Dynamic electives based on selected track
- Bulk creation tool for multiple sections
- **School year automatically assigned** from active school year

---

## 🎯 Creating a Section

### Step 1: Select School Level
- Click either **Junior High** or **Senior High** button
- Form will update based on selection

### Step 2: Fill Required Fields

#### For JHS:
```
Grade: [8]
Section Name: [Rizal]
Adviser: [Mr. Juan Dela Cruz]
Status: [Active] ✓ (or Inactive)
School Year: Automatically set to active year
```

#### For SHS:
```
Grade: [11]
Track: [TechPro]
Electives: [☑ ICT] [☑ Cookery]
Section Name: [Alpha]
Adviser: [Ms. Maria Santos]
Status: [Active] ✓
School Year: Automatically set to active year
```

### Step 3: Watch Section Code Preview
- Code auto-generates as you type
- **JHS**: `JHS-G8-RIZAL`
- **SHS**: `SHS-G11-TECH-ICT-ALPHA`

### Step 4: Submit
- Click **"Create Section"** button
- Success message confirms creation
- Section appears in reference table below

---

## ⚡ Advanced Features

### 🎯 Bulk Create (SHS Only)
1. Fill in Grade, Track, Electives, and Adviser
2. Click **"➕ Bulk Create Sections"** button
3. Enter section names: `A, B, C, Alpha, Beta`
4. Click **"Create All"**
5. System creates all at once!

**Example:**
- Grade: 11
- Track: TechPro
- Electives: ICT, Cookery
- Names: A, B, C
- **Result**: Creates 3 sections (G11-Tech-ICT-A, G11-Tech-ICT-B, G11-Tech-ICT-C)

### ⚠️ Duplicate Check (SHS Only)
- System warns if section combination already exists
- Prevents duplicate grades + track + electives + name
- "Duplicate" warning appears in yellow box

### 🔄 Dynamic Electives
- Select a **Track** (Academic / TechPro / Doorway)
- Electives automatically update
- Choose your electives from available options

---

## 📊 View Existing Sections

Below the form, you'll see a **"📋 Existing Sections"** table showing:
- Section Code
- Level (JHS or SHS)
- Grade
- Section Name
- Adviser Name
- Status (Active ✓ or Inactive)
- School Year

---

## 🎨 Form Fields Reference

### Common Fields (JHS & SHS)
| Field | Type | Example |
|-------|------|---------|
| School Year | Dropdown | 2024-2025 |
| Status | Dropdown | Active / Inactive |
| Remarks/Notes | Text | Optional additional info |

### JHS Only
| Field | Type | Example |
|-------|------|---------|
| Grade | Dropdown | 7, 8, 9, 10 |
| Section Name | Text | Rizal, Gold, A |
| Adviser | Dropdown | Teacher names |
| Program Type | Dropdown | Regular / Special Program |
| **School Year** | **Auto** | **Uses active school year** |

### SHS Only
| Field | Type | Example |
|-------|------|---------|
| Grade | Dropdown | 11, 12 |
| Track | Dropdown | Academic / TechPro / Doorway |
| Electives | Checkboxes | Select 1+ from track |
| Section Name | Text | Alpha, Beta, A, B |
| Adviser | Dropdown | Teacher names |
| Class Type | Dropdown | Regular / Special Class |
| Session | Dropdown | Morning / Afternoon |
| **School Year** | **Auto** | **Uses active school year** |

---

## 🎓 Electives by Track

### Academic Track
- Advanced Math
- Science Research
- Creative Writing

### TechPro Track
- ICT
- Cookery
- Electrical

### Doorway Track
- Entrepreneurship
- Skills Training

---

## ✅ Validation Rules

### Required Fields (won't let you save without these)

**JHS:**
- ✓ School Year
- ✓ Grade
- ✓ Section Name
- ✓ Adviser
- ✓ Status

**SHS:**
- ✓ School Year
- ✓ Grade
- ✓ Track
- ✓ At least 1 Elective
- ✓ Section Name
- ✓ Adviser
- ✓ Status
- ⚠️ No duplicate combinations

### Optional Fields
- Program Type (JHS)
- Remarks/Notes (JHS & SHS)
- Class Type (SHS)
- Session (SHS)

---

## 💡 Pro Tips

1. **Bulk Create Saves Time**
   - Instead of creating 4 sections one by one
   - Use Bulk Creator to make them all at once
   - Just type names separated by commas

2. **Auto Section Codes**
   - Codes are generated automatically
   - Shows in preview box before saving
   - You can see exactly how it will look

3. **Track Selection**
   - Change track to see different electives
   - Electives list updates automatically
   - Choose one or multiple electives

4. **Adviser Dropdown**
   - Teachers are pre-populated
   - Can be expanded with more teachers
   - Each section needs one adviser

5. **Check Existing Sections**
   - Scroll down to see all created sections
   - Verify your section was created
   - Reference table auto-updates

---

## 🚀 Common Workflows

### Workflow 1: Create Single JHS Section
1. Select "Junior High"
2. Choose Grade, Name, Adviser
3. Click "Create Section"
4. ✅ Done! (School year auto-assigned)

### Workflow 2: Create Multiple SHS Sections with Same Config
1. Select "Senior High"
2. Set Grade, Track, Electives, Adviser
3. Click "➕ Bulk Create Sections"
4. Enter names: "A, B, C, D"
5. Click "Create All"
6. ✅ All 4 sections created instantly! (School year auto-assigned)

### Workflow 3: Create SHS Section with Multiple Electives
1. Select "Senior High"
2. Set Grade 11, Track "TechPro"
3. Check both "ICT" and "Cookery" electives
4. Enter Section Name "Alpha"
5. Select Adviser "Ms. Maria Santos"
6. Click "Create Section"
7. Code shows: SHS-G11-TECH-ICT-ALPHA
8. ✅ Section created with multiple electives! (School year auto-assigned)

---

## 🔄 Future Features (Coming Soon)

- Edit existing sections
- Delete sections
- Bulk import from CSV/Excel
- Section schedules/timetables
- Student enrollment by section
- Adviser workload reports
- Generate official section reports

---

## ❓ FAQ

**Q: Where do I select the school year?**
A: You don't! School year is automatically assigned from the currently active school year set in the School Years tab. This ensures all new sections use the correct year.

**Q: What if I need sections for a different school year?**
A: Change the active school year in the School Years tab first, then create sections. New sections will use the newly active year.

**Q: Can I change a section after creating it?**
A: Current version doesn't have edit yet. We're adding that soon!

**Q: What if I make a typo in section name?**
A: You'll need to create a new one with the correct name for now.

**Q: Can I use the same adviser for multiple sections?**
A: Yes! One adviser can teach multiple sections.

**Q: What's the difference between Regular and Special Program?**
A: Regular = Standard curriculum. Special Program = Enhanced/specialized program.

**Q: Can I have multiple electives in SHS?**
A: Yes! We recommend it for more flexibility. Select as many as needed.

**Q: The bulk creator isn't working?**
A: Make sure you've filled in all required fields (Grade, Track, at least 1 Elective, Adviser) before using bulk creator.

---

## 📞 Need Help?

Check the documentation at: `SECTIONS_MANAGEMENT_FEATURE.md`

---

**Version**: 1.0
**Last Updated**: February 5, 2026

