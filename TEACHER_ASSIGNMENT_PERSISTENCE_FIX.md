# Teacher Section Assignment Persistence Fix

## Problem
When an admin dashboard user:
1. Selects an adviser
2. Selects grade level and section from the "Assign Teacher Role" modal
3. Confirms the assignment

The assigned section displays correctly in the table immediately, but **disappears after page reload** showing "Not assigned" instead.

## Root Cause
The bug was in the backend `/api/teacher-auth/list` endpoint:

- ✅ The assignment was **correctly saved** to the `teacher_section_assignments` table
- ❌ But the `/list` endpoint only returned basic teacher fields (id, name, email, role, etc.)
- ❌ It did **NOT include** the `assigned_sections` data

When the page reloaded and called `/list`, the teachers were fetched without their section assignments, so the frontend displayed "Not assigned" even though the data existed in the database.

## Solution
**Updated** [routes/teacher-auth.js](routes/teacher-auth.js#L104) `/list` endpoint to:
- Use a LEFT JOIN with `teacher_section_assignments` table
- Use `json_agg()` to aggregate all assigned sections into an `assigned_sections` JSON array
- Include section details: `section_id`, `section_code`, `section_name`, `grade_level`, `school_year`, `assigned_date`
- Handle NULL cases with COALESCE to return empty array `'[]'` when no assignments exist

### New Query Structure
```sql
SELECT 
    t.id, t.teacher_id, t.name, t.department, t.email, t.phone, 
    t.role, t.account_status, t.created_at,
    COALESCE(
        json_agg(
            json_build_object(
                'section_id', tsa.section_id,
                'section_code', s.section_code,
                'section_name', s.section_name,
                'grade_level', s.grade_level,
                'assigned_date', tsa.assigned_date,
                'school_year_id', tsa.school_year_id,
                'school_year', sy.school_year
            ) ORDER BY s.grade_level, s.section_code
        ) FILTER (WHERE tsa.section_id IS NOT NULL),
        '[]'::json
    ) as assigned_sections
FROM teachers t
LEFT JOIN teacher_section_assignments tsa ON t.id = tsa.teacher_id
LEFT JOIN sections s ON s.id = tsa.section_id
LEFT JOIN school_years sy ON sy.id = tsa.school_year_id
GROUP BY t.id, t.teacher_id, t.name, ...
```

## Frontend Integration
The frontend code in [admin-dashboard.js](admin-dashboard.js#L676) already properly handles this:
- Checks `if (isAdviser && teacher.assigned_sections && teacher.assigned_sections.length > 0)`
- Renders section badges for each assigned section
- Falls back to "Not assigned" text if none exist

## Testing the Fix

1. **Restart the backend server** to load the updated code
2. **Go to Manage Teachers** in the admin dashboard
3. **Click "Assign" on an adviser** to open the modal
4. **Select grade level and sections**, then confirm
5. **Verify** the sections display as badges in the table
6. **Refresh the page** (F5 or Ctrl+R)
7. **Expected result**: The assigned sections should still display ✅

## Related Code Paths
- Backend assignment: [routes/teacher-auth.js](routes/teacher-auth.js#L147) - `PUT /assign-role`
- Frontend modal: [admin-dashboard.html](admin-dashboard.html#L1960) - `teacherAssignmentModal`
- Frontend submission: [admin-dashboard.js](admin-dashboard.js#L1429) - `submitTeacherRoleAssignment()`
- Table rendering: [admin-dashboard.js](admin-dashboard.js#L660) - `displayTeachersTable()`

