# School Year Integration with Reports & Analytics

## Overview
All reports in the Admin Dashboard automatically filter by the active school year. When an admin changes the active school year, all report data updates instantly to show only that year's information.

## Reports Affected

### 1. Demographics Report
- **Total Male Students** - Shows only active year
- **Total Female Students** - Shows only active year
- **Gender Summary Table** - Filtered by active year
- **Grade Level Population** - Shows active year distribution

### 2. Disability Report
- **Students With Disability** - Active year only
- **Disability Percentage** - Calculated from active year
- **Disability Breakdown Table** - Active year data

### 3. Indigenous People (IP) Report
- **Total IP Students** - Active year count
- **IP Membership Report** - Active year breakdown

### 4. 4Ps Beneficiaries Report
- **Male/Female 4Ps Students** - Active year
- **Total 4Ps Students** - Active year
- **Grade Distribution** - Active year 4Ps enrollment

### 5. Mother Tongue Distribution
- **Language Distribution** - Active year only
- **All language statistics** - Filtered by active year

### 6. Track & Program Enrollment
- **Academic Track** - Active year enrollments
- **TechPro Track** - Active year enrollments
- **Doorway Track** - Active year enrollments

### 7. Electives Enrollment
- **Elective Statistics** - Active year only
- **Top 30 Electives** - Filtered by active year
- **Category Summaries** - Active year breakdown

### 8. Data Visualization Charts
- **Gender Overview Chart** - Active year
- **Grade Distribution Chart** - Active year
- **Disability Breakdown Chart** - Active year
- **Track Enrollment Chart** - Active year
- **Electives Chart (Top 30)** - Active year

## How the Integration Works

### Frontend (UI) Integration
All report functions in `admin-dashboard-viz.js` use the active school year to filter visualizations:

```javascript
// Example: When generating reports, active year is used
const activeSchoolYear = window.activeSchoolYear;
// Only approved students from active year are included
const filteredData = enrollmentDataStore.filter(e => 
  e.status === 'Approved' && 
  e.school_year_id === activeSchoolYear.id
);
```

### Backend (API) Integration
The `/api/enrollments` and `/api/enrollments/stats` endpoints filter by active school year:

```javascript
// Backend automatically adds this to queries:
WHERE e.school_year_id = (
  SELECT id FROM school_years WHERE is_active = true LIMIT 1
)
```

### Data Flow for Reports

```
1. Admin activates new school year
   └─> localStorage.activeSchoolYear updated
   └─> storage event triggered

2. Dashboard listens for storage events
   └─> Reloads enrollmentDataStore
   └─> Clears chart instances

3. Report functions recalculate
   └─> Query filtered enrollments from API
   └─> Filter by active year in backend
   └─> Process only approved students
   └─> Generate statistics

4. Charts and tables update
   └─> All visualizations reflect new data
   └─> Reports show new year's statistics
```

## Important: Approved Students Only

**All reports show ONLY approved students from the active school year.**

This is by design:
- **Pending enrollments** - Not included
- **Rejected enrollments** - Not included
- **Inactive school years** - Not included
- **Only approved students** in active year appear in reports

### Approval Notice
Every report page displays:
> ℹ️ Note: These reports include only **approved students**. Pending and rejected enrollments are excluded.

## Implementation Details

### 1. Report Customization
The "⚙️ Customize Report" panel includes:
- School name (default: "Compostela National High School")
- School address
- Report title
- Include date checkbox
- Include logo checkbox
- Footer text
- Show page numbers checkbox

**Active year selection:** Not customizable - always uses active year

### 2. Export Functions
- **Print** (🖨️) - Prints current report for active year
- **Excel Export** (📥) - Exports active year data as spreadsheet

Both automatically include active school year context in:
- Report headers
- File names (suggested: "Report_2025-2026.xlsx")
- Document properties

### 3. Chart Libraries
Uses Chart.js for visualizations:
- Pie charts for gender/disability/track distribution
- Bar charts for grade levels
- Horizontal bar charts for top electives

Charts automatically filter data by active school year on initialization.

## Changing Active School Year - Report Updates

### Timeline of Changes

1. **Admin clicks "Activate" on a school year**
   - API updates database (transaction)
   - Deactivates old year
   - Activates new year
   - Returns success

2. **Dashboard receives response**
   - Updates localStorage.activeSchoolYear
   - Calls loadDashboardStats()
   - Triggers dashboard reload

3. **Storage Event Fires**
   - All tabs receive storage update
   - All pages update activeSchoolYear variable
   - Reports component reinitialized

4. **Report Data Reloads**
   - Fetches new stats from API (filtered by active year)
   - Clears old chart instances
   - Recreates charts with new data
   - Tables refresh with new values

### Performance Optimization
- Charts are destroyed before recreation (prevents memory leaks)
- Data fetched once per year change (not per chart)
- Cached in enrollmentDataStore
- Charts built from cache (fast rendering)

## Exporting Reports for Active School Year

### Print Report
1. Click 🖨️ Print button on any report
2. Report includes active school year info
3. Browser print dialog opens
4. Select printer and configure
5. Print document with active year data

### Export to Excel
1. Click 📥 Excel button
2. Data exported for active year
3. File downloads with suggested name
4. Open in Excel/Google Sheets
5. Data includes all active year statistics

### Suggested File Names
The export should use format:
- `Enrollment_Report_2025-2026.xlsx`
- `Demographics_2025-2026.xlsx`
- `Disability_Report_2025-2026.xlsx`

## Query Examples

### Example 1: Get Demographics for Active Year
```sql
SELECT 
  gender,
  COUNT(*) as count
FROM enrollments e
JOIN students s ON e.student_id = s.id
WHERE 
  e.status = 'Approved'
  AND e.school_year_id = (
    SELECT id FROM school_years WHERE is_active = true
  )
GROUP BY gender;
```

### Example 2: Get Grade Distribution
```sql
SELECT 
  enrollment_data->>'grade_level' as grade,
  COUNT(*) as count
FROM enrollments e
WHERE 
  e.status = 'Approved'
  AND e.school_year_id = (
    SELECT id FROM school_years WHERE is_active = true
  )
GROUP BY grade_level
ORDER BY grade_level;
```

### Example 3: Get Track Enrollment
```sql
SELECT 
  enrollment_data->>'track' as track,
  COUNT(*) as count
FROM enrollments e
WHERE 
  e.status = 'Approved'
  AND e.school_year_id = (
    SELECT id FROM school_years WHERE is_active = true
  )
GROUP BY track;
```

## Troubleshooting Reports

### Charts Not Updating After School Year Change?
1. Refresh the page (Ctrl+R)
2. Check browser console for errors (F12)
3. Verify active school year is set (check green card)
4. Check that new year has approved enrollments

### Export Not Working?
1. Verify you have active year set
2. Check internet connection (API call required)
3. Try different browser
4. Check that enrollments exist for year

### Numbers Don't Match Between Dashboard and Reports?
- Dashboard stats may include pending/rejected
- Reports only show approved
- Check enrollment status in detail view

### Report Shows Wrong School Year?
1. Check active school year in School Years section
2. Activate correct year
3. Refresh reports page
4. Data should update within seconds

## Administrative Considerations

### Year-End Process
1. **Before switching years:**
   - Verify all enrollments approved/rejected
   - Archive previous year data (optional)
   - Create next year in system

2. **During activation:**
   - Switch to new year
   - Verify dashboard stats update
   - Check reports reflect new year

3. **After switching:**
   - All new enrollments go to new year
   - Old year data still accessible (for history)
   - Reports update automatically

### Keeping Historical Data
- Old school years remain in database
- Can be reactivated if needed (for reference)
- Delete only if absolutely necessary
- Better to keep for auditing

### Report Reliability
- All report data comes from database (source of truth)
- Filtered at API level (secure)
- No client-side filtering (ensures consistency)
- Charts built from vetted data

## Testing Reports with Multiple Years

### Test Scenario
1. Create school year 2024-2025
2. Create school year 2025-2026
3. Activate 2024-2025
4. Check reports show 2024-2025 data
5. Activate 2025-2026
6. Check reports update to 2025-2026 data
7. Switch back to 2024-2025
8. Verify reports show correct historical data

### Data Validation
- Totals should match dashboard stats
- Grade sum should equal total students
- Gender sum should equal total students
- Track sum should equal total students

---

**Reports update automatically with active school year changes. No manual intervention needed.**

