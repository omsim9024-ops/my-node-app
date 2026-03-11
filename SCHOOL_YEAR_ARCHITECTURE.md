# School Year Module - System Architecture & Data Flow

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ADMIN DASHBOARD                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Sidebar Menu                                         │  │
│  │ • Dashboard                                          │  │
│  │ • 📅 School Years ← NEW SECTION                     │  │
│  │ • Student Management                                │  │
│  │ • Reports & Analytics                               │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ School Years Section                                 │  │
│  │ ┌────────────────────────────────────────────────┐  │  │
│  │ │ Active School Year Card                        │  │  │
│  │ │ 📅 2025-2026                                   │  │  │
│  │ │ June 1, 2025 — March 31, 2026                  │  │  │
│  │ └────────────────────────────────────────────────┘  │  │
│  │ ┌────────────────────────────────────────────────┐  │  │
│  │ │ Create New School Year Form                    │  │  │
│  │ │ School Year: [2025-2026]                       │  │  │
│  │ │ Start Date: [June 1, 2025]                     │  │  │
│  │ │ End Date: [March 31, 2026]                     │  │  │
│  │ │ [➕ Create School Year]                         │  │  │
│  │ └────────────────────────────────────────────────┘  │  │
│  │ ┌────────────────────────────────────────────────┐  │  │
│  │ │ All School Years Table                         │  │  │
│  │ │ ┌──────┬──────┬──────┬────────┬───────────┐   │  │  │
│  │ │ │Year  │Start │End   │Status  │Actions    │   │  │  │
│  │ │ ├──────┼──────┼──────┼────────┼───────────┤   │  │  │
│  │ │ │2025- │Jun 1 │Mar31 │✓Active │           │   │  │  │
│  │ │ │2026  │2025  │2026  │        │           │   │  │  │
│  │ │ ├──────┼──────┼──────┼────────┼───────────┤   │  │  │
│  │ │ │2026- │Jun 1 │Mar31 │Inactive│[Activate] │   │  │  │
│  │ │ │2027  │2026  │2027  │        │[Delete]   │   │  │  │
│  │ │ └──────┴──────┴──────┴────────┴───────────┘   │  │  │
│  │ └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          ↓
           ┌──────────────────────────────┐
           │ Dashboard Stats Update       │
           │ • Total Students             │
           │ • Pending Enrollments        │
           │ • Approved Enrollments       │
           │ • Rejected Enrollments       │
           └──────────────────────────────┘
                          ↓
           ┌──────────────────────────────┐
           │ All Reports Update           │
           │ • Demographics               │
           │ • Disability                 │
           │ • Indigenous                 │
           │ • 4Ps                        │
           │ • Mother Tongue              │
           │ • Track/Electives            │
           └──────────────────────────────┘
```

## 🔄 Data Flow: Creating & Activating School Year

```
┌─────────────────────────────────────────────────────────────┐
│                     USER ACTION                             │
│            Create School Year in Form                       │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│              CLIENT: admin-dashboard-school-years.js        │
│                                                              │
│  1. Validate form inputs                                    │
│  2. Create request body:                                    │
│     {                                                       │
│       "school_year": "2025-2026",                          │
│       "start_date": "2025-06-01",                          │
│       "end_date": "2026-03-31"                             │
│     }                                                       │
│  3. POST to /api/school-years                              │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│           BACKEND: routes/school-years.js                   │
│                                                              │
│  1. Validate request body                                   │
│  2. Check for duplicates                                    │
│  3. Validate date range (start < end)                       │
│  4. INSERT INTO school_years                                │
│  5. Return success response                                 │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│             DATABASE: PostgreSQL                            │
│                                                              │
│  school_years table:                                        │
│  ┌────┬──────────────┬────────────┬──────────────┬──────┐  │
│  │ id │ school_year  │ start_date │ end_date     │ ...  │  │
│  ├────┼──────────────┼────────────┼──────────────┼──────┤  │
│  │ 1  │ 2025-2026    │ 2025-06-01 │ 2026-03-31   │ ...  │  │
│  └────┴──────────────┴────────────┴──────────────┴──────┘  │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│              CLIENT: Response Received                       │
│                                                              │
│  1. Show success notification                               │
│  2. Clear form                                              │
│  3. Call loadSchoolYears() to refresh table                │
└─────────────────────────────────────────────────────────────┘
                           ↓
                 [TABLE DISPLAYS NEW YEAR]
```

### Activation Flow

```
USER CLICKS "Activate" BUTTON
         ↓
CLIENT SENDS: PUT /api/school-years/1/activate
         ↓
DATABASE TRANSACTION:
  BEGIN
  ├─ UPDATE school_years SET is_active=false 
  │  WHERE id != 1
  └─ UPDATE school_years SET is_active=true 
     WHERE id = 1
  COMMIT
         ↓
DATABASE UPDATED:
  school_years table:
  ┌────┬──────────────┬────────────┬──────────────┬───────────┐
  │ id │ school_year  │ start_date │ end_date     │ is_active │
  ├────┼──────────────┼────────────┼──────────────┼───────────┤
  │ 1  │ 2025-2026    │ 2025-06-01 │ 2026-03-31   │ true  ✓   │
  ├────┼──────────────┼────────────┼──────────────┼───────────┤
  │ 2  │ 2026-2027    │ 2026-06-01 │ 2027-03-31   │ false     │
  └────┴──────────────┴────────────┴──────────────┴───────────┘
         ↓
CLIENT RECEIVES SUCCESS:
  1. Update localStorage.activeSchoolYear
  2. Trigger storage event (cross-tab sync)
  3. Refresh tables
  4. Reload dashboard stats
         ↓
DASHBOARD UPDATES AUTOMATICALLY:
  • Stats refresh (filtered by active year)
  • Recent enrollments refresh
  • Reports refresh
  • Charts refresh
```

## 🔐 Database Schema

```
┌──────────────────────────────────────────────────────────┐
│                     school_years                         │
├────────────────────────────────────────────────────────┤
│ Column Name    │ Type        │ Constraints              │
├────────────────────────────────────────────────────────┤
│ id             │ SERIAL      │ PRIMARY KEY              │
│ school_year    │ VARCHAR(50) │ UNIQUE NOT NULL          │
│ start_date     │ DATE        │ NOT NULL                 │
│ end_date       │ DATE        │ NOT NULL                 │
│ is_active      │ BOOLEAN     │ DEFAULT false            │
│ created_at     │ TIMESTAMP   │ DEFAULT CURRENT_TIMESTAMP│
│ updated_at     │ TIMESTAMP   │ DEFAULT CURRENT_TIMESTAMP│
└──────────────────────────────────────────────────────────┘
              ↑                        ↑
              │ FOREIGN KEY            │ FOREIGN KEY
              │                        │
    ┌─────────┴─────────┐    ┌────────┴─────────┐
    │                   │    │                  │
    │  enrollments      │    │   students       │
    │  (school_year_id) │    │ (school_year_id) │
    │                   │    │                  │
    └───────────────────┘    └──────────────────┘


Indexes Created:
├─ idx_school_years_active
│  → Fast lookup: WHERE is_active = true
├─ idx_enrollments_school_year
│  → Fast filtering: WHERE school_year_id = X
└─ idx_students_school_year
   → Fast filtering: WHERE school_year_id = X
```

## 📡 API Request/Response Cycle

```
CLIENT REQUEST
├─ Method: POST
├─ Endpoint: /api/school-years
├─ Headers: Content-Type: application/json
└─ Body:
   {
     "school_year": "2025-2026",
     "start_date": "2025-06-01",
     "end_date": "2026-03-31"
   }
         ↓
SERVER VALIDATION
├─ Required fields present?
├─ Unique school_year?
├─ Valid date format?
└─ Start date < end date?
         ↓
DATABASE OPERATION
├─ INSERT INTO school_years
└─ RETURNING *
         ↓
SERVER RESPONSE
├─ Status: 201 Created
├─ Headers: Content-Type: application/json
└─ Body:
   {
     "success": true,
     "message": "School year created successfully",
     "data": {
       "id": 1,
       "school_year": "2025-2026",
       "start_date": "2025-06-01",
       "end_date": "2026-03-31",
       "is_active": false,
       "created_at": "2024-02-04T10:00:00Z"
     }
   }
         ↓
CLIENT PROCESSING
├─ Show success notification
├─ Reset form
└─ Refresh table
```

## 🗂️ File Organization

```
SMS Project
│
├─ Backend
│  ├─ server.js                    [Modified: Add school-years route]
│  ├─ init-db.js                   [Modified: Add table & indexes]
│  ├─ db.js                        [Unchanged]
│  └─ routes/
│     ├─ school-years.js           [NEW: API endpoints]
│     ├─ enrollments.js            [Modified: Add school_year filtering]
│     └─ ...
│
├─ Frontend
│  ├─ admin-dashboard.html         [Modified: Add School Years section]
│  ├─ admin-dashboard.css          [Modified: Add styling]
│  ├─ admin-dashboard.js           [Unchanged]
│  ├─ admin-dashboard-school-years.js
│  │                               [NEW: Management module]
│  ├─ student-dashboard.js         [Modified: Load active year]
│  ├─ student-dashboard.html       [Unchanged]
│  ├─ enrollment-form.js           [Modified: Load active year]
│  ├─ enrollment-form.html         [Unchanged]
│  └─ ...
│
└─ Documentation
   ├─ SCHOOL_YEAR_MANAGEMENT.md
   │                               [Technical reference]
   ├─ SCHOOL_YEAR_QUICK_START.md
   │                               [User guide]
   ├─ SCHOOL_YEAR_FIRST_TIME_SETUP.md
   │                               [Initial setup]
   ├─ SCHOOL_YEAR_REPORTS_INTEGRATION.md
   │                               [Reports guide]
   └─ SCHOOL_YEAR_IMPLEMENTATION_COMPLETE.md
                                   [Implementation summary]
```

## 🔄 Cross-Tab Synchronization

```
┌─────────────────────────────┐       ┌─────────────────────────────┐
│   TAB 1: Admin Dashboard    │       │  TAB 2: Admin Dashboard     │
│                             │       │                             │
│ 1. Click "Activate" button  │       │ (Waiting for updates)       │
└──────────────┬──────────────┘       └──────────────┬──────────────┘
               ↓                                      ↓
        PUT /api/school-years/1/activate      Listening for storage event
               ↓                                      ↓
        localStorage.activeSchoolYear = {...}       ✓ Storage event received
               ↓                                      ↓
        Storage Event Fired                  Update window.activeSchoolYear
               ↓                                      ↓
        Tab 1 reloads dashboard              Tab 2 reloads dashboard
               ↓                                      ↓
        Shows new active year                Shows new active year
        Stats updated                        Stats updated
        ✅ In sync                           ✅ In sync
```

## 📊 Data Filtering Architecture

```
ADMIN REQUESTS ENROLLMENT LIST
        ↓
GET /api/enrollments?activeYear=true&status=pending
        ↓
BACKEND QUERY BUILDER
    ├─ Start with: SELECT * FROM enrollments
    ├─ Check activeYear parameter (default: true)
    ├─ Add WHERE clause:
    │  WHERE school_year_id = (
    │    SELECT id FROM school_years WHERE is_active = true
    │  )
    ├─ Add status filter if provided:
    │  AND status = 'Pending'
    └─ ORDER BY enrollment_date DESC
        ↓
DATABASE EXECUTION
    ├─ Find active school year ID
    ├─ Filter enrollments
    ├─ Use indexes for performance
    └─ Return only matching rows
        ↓
RESPONSE TO CLIENT
    ├─ Only active year enrollments
    ├─ Only pending status
    └─ Newest first
        ↓
CLIENT RENDERS
    ├─ Table with filtered data
    ├─ Show correct count
    └─ Enable/disable actions
```

## 🎯 Integration Points

```
┌──────────────────────────────────────────────────────────────┐
│                     ADMIN DASHBOARD                          │
│                                                               │
│  ┌────────────────────┐         ┌─────────────────────────┐ │
│  │ Dashboard Section  │         │ School Years Section    │ │
│  │                    │         │ (NEW)                   │ │
│  │ Stats:             │         │                         │ │
│  │ Total Students ──┐ │         │ Create/Activate/Delete  │ │
│  │ Enrollments ──┐  │ │         │                         │ │
│  │               │  │ │         │ Manages active year ──┐ │ │
│  │ ┌─────────────┴──┴─┼────┐    │                       │ │ │
│  │ │ Filters by       │    │    │ └─────────────────┬───┘ │ │
│  │ │ school_year_id   │    │    │                   │     │ │
│  │ └──────────────────┘    │    │                   │     │ │
│  └────────────────────┬────┘    └─────────────────┬─┘     │
│                        │                          │        │
└────────────────────────┼──────────────────────────┼────────┘
                         │                          │
                         ↓                          ↓
                  ┌─────────────────────────────┐
                  │   localStorage               │
                  │                             │
                  │ activeSchoolYear:           │
                  │ {                           │
                  │   id: 1,                    │
                  │   school_year: "2025-2026" │
                  │   is_active: true           │
                  │ }                           │
                  └────────────┬────────────────┘
                               │
                ┌──────────────┼──────────────┐
                ↓              ↓              ↓
            ┌────────────┐ ┌────────────┐ ┌────────────┐
            │   Student  │ │ Enrollment │ │    API     │
            │ Dashboard  │ │    Form    │ │ Endpoints  │
            │            │ │            │ │            │
            │ Loads &    │ │ Loads &    │ │ Filter by  │
            │ displays   │ │ uses for   │ │ active     │
            │ active     │ │ new        │ │ school     │
            │ year data  │ │ enrollments│ │ year       │
            └────────────┘ └────────────┘ └────────────┘
```

## 🚀 Performance Optimization

```
TRADITIONAL APPROACH (Slow)
┌────────────────────────────────────────────────┐
│ 1. Client GET /api/enrollments (all data)      │
│ 2. Backend returns 10,000 rows                 │
│ 3. Client filters in JavaScript                │
│ 4. Only 250 rows for active year shown         │
│ Network waste: 10,000 - 250 = 9,750 unused    │
└────────────────────────────────────────────────┘
                    ↓↓↓ SLOW ↓↓↓

NEW APPROACH (Fast)
┌────────────────────────────────────────────────┐
│ 1. Client GET /api/enrollments?activeYear=true│
│ 2. Backend filters at database level           │
│ 3. Returns only 250 rows for active year       │
│ 4. Client uses all data (no waste)             │
│ Network waste: 0 unnecessary rows              │
└────────────────────────────────────────────────┘
                    ↓↓↓ FAST ↓↓↓

Performance Gains:
├─ 97.5% less network bandwidth (in this example)
├─ Faster database query (uses indexes)
├─ Less memory on client
└─ Better response times
```

---

## Summary

The School Year module integrates seamlessly into the existing SMS system:

1. **Database Layer**: New table with foreign keys to enrollments/students
2. **API Layer**: 6 new endpoints for CRUD operations
3. **UI Layer**: New section in admin dashboard for management
4. **Data Flow**: Automatic filtering at every level
5. **Sync**: localStorage-based cross-tab communication
6. **Performance**: Database-level filtering with indexes

This architecture ensures data integrity, performance, and user experience across the entire system.

