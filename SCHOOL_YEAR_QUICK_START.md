# School Year Management - Quick Start Guide

## 🎯 What's New?
Admins can now manage school years centrally. When a school year is activated, ALL admin dashboard data (enrollments, students, reports) automatically filters to show only that year's data.

## 📋 Quick Steps

### Step 1: Create a School Year
1. Login to Admin Dashboard
2. Click **"📅 School Years"** in the sidebar
3. Under "Create New School Year" form:
   - **School Year**: Enter in format like `2025-2026`
   - **Start Date**: Click to pick the date (e.g., June 1, 2025)
   - **End Date**: Click to pick the end date (e.g., March 31, 2026)
4. Click **"➕ Create School Year"**
5. See success message ✓

### Step 2: Activate a School Year
1. In the **"All School Years"** table at the bottom
2. Find the school year you want to use
3. Click the **"Activate"** button
4. **Dashboard automatically updates!** ✨
   - Dashboard stats update
   - Recent enrollments list updates
   - All reports filter to this year

### Step 3: View What Changed
- **Dashboard Section**: Numbers now show only this year's data
- **Enrollment Management**: Only this year's enrollments visible
- **Reports**: All reports show only approved students from this year
- **Student Directory**: Shows only students enrolled this year

## 🔄 Real-Time Sync
- If you have multiple tabs/windows open, they ALL sync automatically
- Change active year in one tab → all other tabs update
- Students and staff see the active year automatically

## 📊 What Gets Filtered?

When you activate a school year:
- ✓ Dashboard statistics
- ✓ Enrollment lists
- ✓ Recent enrollments
- ✓ All reports (Demographics, Disability, Indigenous, 4Ps, etc.)
- ✓ Student directory
- ✓ Data visualization charts

## ⚡ Tips & Tricks

### Can't Delete a School Year?
Only **inactive** school years can be deleted. If you want to delete a year:
1. First, activate a different year
2. Then delete the old one

### Check Which Year is Active
Look for the **"📅 Active School Year"** card at the top of the School Years section. It shows:
- School year name (e.g., "2025-2026")
- Start and end dates
- Status: "Currently Active"

### Create Multiple Years in Advance
You can create next year's school year ahead of time:
1. Create "2026-2027" year now
2. Keep it **inactive**
3. When June comes, just click **"Activate"**
4. Everything switches automatically ✨

## 🎓 How This Affects Students & Enrollment

### Students See:
- Only their data for the active school year
- Their enrollments for current year
- Dashboard relevant to active year

### New Enrollments:
- Automatically tagged with current active school year
- Can filter old enrollments if needed

### Enrollment Form:
- Always uses current active school year
- Submits with correct school year ID

## 🆘 Troubleshooting

### Active Year Not Showing?
- Refresh the page (Ctrl+R or Cmd+R)
- Check if you're on the School Years page
- Look in the green card at the top

### Data Not Updating After Activation?
- Wait a few seconds (automatic sync)
- Refresh the page
- Check browser console for errors (F12)

### Want to See All Data (All Years)?
- In URL, add `?activeYear=false`
- This shows all data regardless of active year
- Admin feature only

## 📱 Database Impact

Behind the scenes:
- New `school_years` table stores all years
- Each enrollment tagged with `school_year_id`
- Only active year queries run by default
- Data stays in database (nothing deleted when deactivating)

## 💡 Best Practices

1. **Create Early**: Create next school year a month before
2. **Test First**: Create test year, activate it, check data
3. **One Active**: Only ONE year can be active at a time
4. **Archive Old**: Keep old years in system (don't delete)
5. **Communicate**: Let staff know when switching years

## 🔐 Permissions

- **Admins**: Full access to create, activate, delete school years
- **Students**: Can see only active year data (read-only)
- **Teachers**: Can see only active year data (when implemented)

## Example Workflow

```
June 2025: Create "2025-2026" school year (June 1 - March 31)
├─ Leave it inactive while "2024-2025" is active
├─ Check everything works correctly
└─ No data impact yet

March 31, 2026: Activate "2025-2026"
├─ All dashboard data switches immediately
├─ New enrollments go to 2025-2026
├─ Reports show 2025-2026 data
└─ Students see 2025-2026 info

April 1, 2026: Optional - Deactivate "2024-2025"
├─ Delete "2024-2025" if not needed
├─ Or keep for archive/reference
└─ Data remains in system either way
```

## Quick Reference

| Action | Steps |
|--------|-------|
| **Create Year** | School Years → Form → Fill details → Create |
| **Activate Year** | School Years → Table → Click Activate |
| **Delete Year** | School Years → Table → Click Delete (inactive only) |
| **Check Active** | Green card at top of School Years section |
| **Switch Year** | Just activate a different year → all data updates |

---

**Questions?** Check the full documentation in `SCHOOL_YEAR_MANAGEMENT.md`

