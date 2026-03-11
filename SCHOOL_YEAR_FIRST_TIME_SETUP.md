# First-Time Setup: School Year Module

## 🎯 What You Need to Know

The School Year module will be automatically initialized when you start the server. However, you need to **create at least one school year** before the system will work properly.

## ⚡ Quick Setup (5 minutes)

### Step 1: Start Your Server
```bash
npm start
```

The database tables will be created automatically:
- ✓ `school_years` table
- ✓ Columns added to `enrollments`
- ✓ Columns added to `students`
- ✓ Indexes created

You'll see:
```
Database tables initialized successfully!
```

### Step 2: Create Your First School Year
1. Open Admin Dashboard (`http://localhost:3000/admin-dashboard.html`)
2. Navigate to **"📅 School Years"** in sidebar
3. Fill the form:
   - **School Year**: `2025-2026`
   - **Start Date**: June 1, 2025 (or whenever your year starts)
   - **End Date**: March 31, 2026 (or whenever it ends)
4. Click **"➕ Create School Year"**
5. See success message ✓

### Step 3: Activate the School Year
1. In the "All School Years" table, find your new year
2. Click the **"Activate"** button
3. You'll see:
   - Table updates with green "✓ Active" badge
   - Active school year card shows your year
   - Dashboard stats update automatically

### Step 4: Verify It Works
1. Go to **Dashboard** section
2. Check that stats show data:
   - Total Students
   - Pending Enrollments
   - Approved Enrollments
   - Rejected Enrollments
3. All numbers should display (not be empty)

**✅ You're done!** The system is now ready to use.

## 📋 Database Initialization Details

### What Happens Automatically

When you first run the server, `init-db.js` creates:

```sql
-- New table
CREATE TABLE IF NOT EXISTS school_years (
    id SERIAL PRIMARY KEY,
    school_year VARCHAR(50) UNIQUE NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- New columns (won't fail if already exist)
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS school_year_id INTEGER 
    REFERENCES school_years(id);
    
ALTER TABLE students ADD COLUMN IF NOT EXISTS school_year_id INTEGER 
    REFERENCES school_years(id);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_school_years_active ON school_years(is_active);
CREATE INDEX IF NOT EXISTS idx_enrollments_school_year ON enrollments(school_year_id);
CREATE INDEX IF NOT EXISTS idx_students_school_year ON students(school_year_id);
```

### If Tables Already Exist
- No error occurs (uses `IF NOT EXISTS`)
- Safe to run multiple times
- Won't duplicate columns or indexes
- Fully backward compatible

## 🔧 Troubleshooting Initial Setup

### Problem: "Failed to create school year"
**Solution:**
1. Refresh the page
2. Check that you entered dates correctly
3. Make sure school year format is valid (e.g., "2025-2026")
4. Check browser console (F12) for detailed error

### Problem: Database tables not created
**Solution:**
1. Check server logs for errors
2. Verify database exists: `psql -U <user> -d <database> -c "SELECT version();"`
3. Restart server: `npm start`
4. Check console for "Database tables initialized successfully!"

### Problem: Can't see School Years menu
**Solution:**
1. Hard refresh admin dashboard (Ctrl+Shift+R)
2. Clear browser cache
3. Verify admin-dashboard.html loaded properly
4. Check admin-dashboard-school-years.js loaded (F12 → Network tab)

### Problem: Active school year not showing data
**Solution:**
1. Make sure year is actually activated (look for green badge in table)
2. Try creating some test enrollments first
3. Refresh dashboard (F5)
4. Check database directly:
   ```sql
   SELECT * FROM school_years WHERE is_active = true;
   ```

## 📊 Sample Data (Optional)

If you want to test the system with sample data, you can add test enrollments:

### Option 1: Via Admin Dashboard
1. Go to Enrollment section
2. Wait for enrollments to load
3. If none exist, test by approving some first

### Option 2: Via SQL (Advanced)
```sql
-- First create a school year (replace dates as needed)
INSERT INTO school_years (school_year, start_date, end_date, is_active)
VALUES ('2025-2026', '2025-06-01', '2026-03-31', true);

-- Check it was created
SELECT * FROM school_years;

-- Get the ID (should be 1)
SELECT id FROM school_years WHERE school_year = '2025-2026';
```

## 🔍 Verification Checklist

After setup, verify everything works:

- [ ] Server starts without errors
- [ ] Database shows "Database tables initialized successfully!"
- [ ] Can access admin dashboard
- [ ] Can navigate to School Years section
- [ ] Can create a new school year
- [ ] Can activate the school year
- [ ] Active year card displays the year
- [ ] Dashboard stats show numbers
- [ ] Reports page works
- [ ] Student dashboard loads without errors

## 📈 What Gets Populated First?

After creating your first school year:

1. **school_years table**
   - Your first year record

2. **enrollments table**
   - No changes (you haven't created enrollments yet with this year)
   - Existing enrollments won't have school_year_id (null is okay)

3. **students table**
   - No changes initially
   - Will be populated as enrollments are created

## ⚙️ Configuration (If Needed)

### Default Settings
The system comes with defaults:
- No mandatory configuration changes needed
- Uses existing database connection
- API base is automatic (`http://localhost:3000`)

### Optional: Different School Year Format
The system uses format "YYYY-YYYY" (e.g., "2025-2026").
If you want different format:
1. Edit form validation in `admin-dashboard-school-years.js`
2. Change regex pattern: `pattern="^\d{4}-\d{4}$"`
3. Example: `pattern="^\d{4}-\d{1,2}$"` for "2025-6"

## 📝 Important Notes

### About NULL school_year_id
- Old enrollments won't have school_year_id
- This is **normal and safe**
- They're filtered out of active year queries (NULL ≠ active year id)
- Can manually update if needed:
  ```sql
  UPDATE enrollments SET school_year_id = 1 
  WHERE school_year_id IS NULL;
  ```

### Database Consistency
- Foreign keys enforce referential integrity
- Can't delete a school year that has enrollments
- Can only delete **inactive** years
- Is **safe and reliable**

### Backward Compatibility
- All changes use `IF NOT EXISTS`
- Existing data is preserved
- No deletion of columns or data
- Safe to deploy to production

## 🎓 Learning Path

If you're new to the system:

1. **First**: Create and activate a school year (this guide)
2. **Then**: Read SCHOOL_YEAR_QUICK_START.md
3. **Next**: Try creating/approving enrollments
4. **Finally**: Check all reports update correctly

## 🚀 Next Steps

After initial setup:

1. **Create multiple test years**
   - 2024-2025 (to test switching)
   - 2025-2026 (current)
   - 2026-2027 (future)

2. **Test activation**
   - Activate 2024-2025 → check dashboard
   - Activate 2025-2026 → check dashboard
   - Data should change

3. **Create test enrollments**
   - Submit enrollments (tagged to current year)
   - Approve some → see in reports
   - Check they appear in statistics

4. **Test student view**
   - Login as student
   - Student dashboard shows active year

5. **Test enrollment form**
   - New enrollments use active year

## 💡 Pro Tips

### Tip 1: Naming Convention
Use clear names:
- ❌ "2025" (unclear)
- ✅ "2025-2026" (clear, academic year format)
- ✅ "AY2025-2026" (extra clear)
- ✅ "School Year 2025-2026"

### Tip 2: Date Selection
- Start date: Usually June 1 (for Philippine schools)
- End date: Usually March 31
- But can adjust to your school's calendar

### Tip 3: Testing Years
- Create and activate a "TEST" year to experiment
- Keep it separate from real data
- Delete after testing

### Tip 4: Maintenance
- Keep old years in database for history
- Just don't activate them
- Helps with auditing and reference

## 🆘 Still Need Help?

### Check These Files
1. SCHOOL_YEAR_QUICK_START.md - User guide
2. SCHOOL_YEAR_MANAGEMENT.md - Technical reference
3. console.log output - Developer debugging
4. Database logs - SQL errors

### Common Log Messages
```
[School Years] DOM loaded, initializing...        → Good
[School Years] Active school year loaded...       → Good
Error loading active school year                   → Check database
Failed to create school year                       → Check input validation
```

---

**You're all set! Create your first school year and start using the system.** 🎉

