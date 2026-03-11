# Teacher Adviser Role Auto-Sync - Technical Architecture

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TEACHER ADVISER AUTO-SYNC SYSTEM                   │
└─────────────────────────────────────────────────────────────────────────────┘

                               ┌──────────────────┐
                               │   ADMIN ACTION   │
                               │  Assign Teacher  │
                               │  as Adviser      │
                               └────────┬─────────┘
                                        │
                               ┌────────▼─────────┐
                               │   API REQUEST    │
                               │  PUT /assign-role│
                               │  + school_year   │
                               │  + sections      │
                               └────────┬─────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
         ┌──────────▼──────────┐   ┌────▼────────────┐   ┌─▼──────────────────┐
         │  DB UPDATE          │   │ SUCCESS ALERT   │   │ ADMIN FEEDBACK     │
         │  teacher.role =     │   │ Role assigned   │   │ "Dashboard will    │
         │  'adviser'          │   │ Successfully    │   │  auto-update in    │
         │  create section     │   │ ✓ Adviser       │   │  5 seconds"        │
         │  assignments        │   │ ✓ Sections      │   │                    │
         └──────────┬──────────┘   │ ✓ Auto-sync     │   └────────────────────┘
                    │              └────────────────┘
         ┌──────────▼──────────────────────────────────┐
         │   Role Polling Detects Change               │
         │   (Every 5 seconds)                         │
         │                                             │
         │   GET /current-role/teacher@email.com       │
         │   ↓                                         │
         │   { role: "adviser" } ← Role Changed!       │
         └──────────┬──────────────────────────────────┘
                    │
    ┌───────────────┼───────────────┐
    │               │               │
    ▼               ▼               ▼
┌─────────────┐ ┌─────────────┐ ┌────────────────────┐
│ TEACHER     │ │ ADVISER     │ │ SUBJECT TEACHER    │
│ DASHBOARD   │ │ DASHBOARD   │ │ DASHBOARD          │
│ (Regular)   │ │ (Adviser)   │ │ (Subject Teacher)  │
└─────────────┘ └─────────────┘ └────────────────────┘

Teacher Dashboard                Adviser Dashboard
┌──────────────────────┐        ┌──────────────────────┐
│ Running Polling      │        │ Running Polling      │
│ Every 5 seconds      │        │ Every 5 seconds      │
│                      │        │                      │
│ Check: Is role still │        │ Check: Is role still │
│ "null" (regular)?    │        │ "adviser"?           │
│                      │        │                      │
│ IF Changed to        │        │ IF Changed to        │
│ "adviser" → GO TO    │        │ "regular" → GO TO    │
│ adviser-dashboard.html       │ teacher-dashboard.html
│                      │        │                      │
│ IF Changed to        │        │ IF Changed to        │
│ "subject" → GO TO    │        │ "subject" → GO TO    │
│ subject-dashboard    │        │ subject-dashboard    │
└──────────────────────┘        └──────────────────────┘
```

## Request/Response Flow

### Step 1: Admin Assigns Teacher Role

```
Admin Browser                Server                    Database
    │                          │                          │
    │──P─U─T─/─assign-role───→│                          │
    │  {teacher_id: 5,         │                          │
    │   role: "adviser",       │                          │
    │   sections: [1,2,3],     │                          │
    │   school_year_id: 2}     │                          │
    │                          │──UPDATE teachers────────→│
    │                          │  SET role='adviser'      │
    │                          │                    ┌─────┘
    │                          │                    │
    │                          │──INSERT section───→│
    │                          │  assignments       │
    │                          │              ┌─────┘
    │                          │              │
    │←─────200 OK─────────────│              │
    │ {success: true}          │              │
    │                          │←─ Confirmed ─┘
    │
Display Success Alert
"Role assigned successfully!
 Teacher dashboard will auto-update within 5 seconds"
```

### Step 2: Teacher Dashboard Polls for Role Change

```
Teacher Dashboard            Server              Database
(Running every 5 sec)           │                   │
         │                      │                   │
         │──GET /current-role──→│                   │
         │  /teacher@email.com  │──SELECT role────→│
         │                      │  FROM teachers    │
         │                      │  WHERE email      │
         │                      │              ┌────┘
         │                      │              │
         │←── 200 OK ──────────│←res{role:    │
         │   {success:true,     │"adviser"}───┘
         │    teacher: {         │
         │      role: "adviser"  │
         │    }}                 │
         │
    ROLE CHANGED!
    adviser != null (current role)
         │
         └──→ window.location.href = 
              'adviser-dashboard.html'
              
    PAGE BROWSER REDIRECT TO ADVISER DASHBOARD
```

### Step 3: Adviser Dashboard Loads & Polls

```
Browser Redirect to adviser-dashboard.html
           ↓
Load adviser-dashboard.html
           ↓
DOMContentLoaded Event
           ├─ Get teacher from sessionStorage/localStorage
           ├─ Display: "Welcome, [Teacher Name]"
           ├─ Load overview stats
           ├─ Load assigned sections
           └─ START ROLE POLLING
              │
              every 5 seconds:
              GET /current-role/teacher@email.com
              │
              if role still "adviser" → remain on page
              if role changed → redirect to new dashboard
```

## Data Storage Architecture

```
┌──────────────────────────┐
│   Browser Storage        │
├──────────────────────────┤
│                          │
│  localStorage            │
│  ├─ loggedInUser: {      │
│  │   id: 5,             │
│  │   email: "t@e.com"   │
│  │   role: "adviser"    │
│  │   type: "teacher"    │
│  │   name: "John Doe"   │
│  │ }                    │
│  │                      │
│  └─ Other app data      │
│                          │
│  sessionStorage          │
│  ├─ teacherData: {...}  │
│  └─ Other session data  │
│                          │
└──────────────────────────┘
         ↑                    ┌──────────────────┐
         │ Stored at login    │   Role Polling   │
         │                    ├──────────────────┤
         │                  └─→ Retrieves email  │
         │                    │ from localStorage│
         │                    │ to check role    │
         │                    └──────────────────┘
         │
   Uses to: getEmptyFunction() { return ''... }      
   - Redirect on role change
   - Initialize dashboard
   - Monitor for updates
```

## API Endpoint Details

```
NEW ENDPOINT: /api/teacher-auth/current-role/:email

Input:  Teacher email (URL parameter)
Output: Current role and status

Example Request:
─────────────────────────────────────────────────
GET /api/teacher-auth/current-role/teacher%40example.com?cachebust=12345

Example Response:
─────────────────────────────────────────────────
{
  "success": true,
  "teacher": {
    "id": 5,
    "teacher_id": "T001",
    "name": "John Doe",
    "email": "teacher@example.com",
    "role": "adviser",              ← KEY FIELD
    "account_status": "active"
  }
}

Error Response:
─────────────────────────────────────────────────
{
  "error": "Teacher not found"
}
```

## Role Change Detection Logic

```
function checkRoleChange(storedEmail) {
    │
    ├─→ Fetch current role from API
    │   GET /current-role/storedEmail
    │
    ├─→ Parse response
    │   newRole = response.teacher.role
    │
    ├─→ Compare with stored role
    │   if (newRole !== this.currentRole) {
    │       // ROLE CHANGED!
    │       this.currentRole = newRole
    │
    │       ├─ adviser → adviser    → reload()
    │       ├─ adviser → null       → teacher-dashboard.html
    │       ├─ adviser → subject    → subject-teacher-dashboard.html
    │       │
    │       ├─ teacher → adviser    → adviser-dashboard.html
    │       ├─ teacher → null       → teacher-dashboard.html
    │       ├─ teacher → subject    → subject-teacher-dashboard.html
    │       │
    │       └─ Log: "Role changed from X to Y"
    │   }
}
```

## Event Timeline

```
Time     Event                          Dashboard              API Call
─────────────────────────────────────────────────────────────────────────
T+0      Teacher logs in               teacher-dashboard      /login
         ↓                             starts polling
         Role: null → stores role
         
T+0s     Polling starts (interval=5s)
         First check immediate
         
T+0.5s   Check #1                      GET /current-role
         Role returned: "adviser"       ROLE CHANGED!
         ↓                             
         REDIRECT initiated
         
T+0.7s   Browser redirects             adviser-dashboard      /adviser-dashboard.html
         New page loads                 loads
         
T+1.0s   Adviser dashboard ready       adviser-dashboard      /overview-teacher/5
         DOMContentLoaded              /sections-teacher/5
         Polling starts again
         
T+6.0s   Check #2                      GET /current-role
         Role: "adviser" (unchanged)    no action
         
T+11.0s  Check #3                      GET /current-role
         Role: "adviser" (unchanged)    no action
         
         ... (continues every 5 seconds)
         
(IF ADMIN CHANGES ROLE):
T+65s    Admin assigns different role  Database updated       /assign-role
         
T+70s    Check #15                     GET /current-role
         Role changed to "subject"     ROLE CHANGED!
         ↓
         REDIRECT initiated
         
T+71s    Browser redirects             subject-teacher-      /subject-teacher-
         to subject dashboard          dashboard              dashboard.html
```

## Error Handling & Fallbacks

```
Role Check Error Handling:
┌──────────────┐
│ Fetch fails  │
│ or 404       │
└──────┬───────┘
       │
   ┌───▼────────────────────────────┐
   │ Increment failure count        │
   │ (max 3 failures)               │
   │                                │
   │ if failureCount < 3:           │
   │   → Continue polling normally  │
   │     (interval = 5s)            │
   │                                │
   │ if failureCount >= 3:          │
   │   → Reduce frequency           │
   │     (interval = 30s)           │
   │   → Log warning                │
   │   → Continue polling           │
   └────────────────────────────────┘


Fallback Endpoints (if primary fails):
1. /api/teacher-auth/current-role/:email    ← Primary (NEW)
2. /api/teacher-auth/profile                 ← Fallback
3. /api/teacher-auth/me                      ← Fallback
4. /api/teacher-auth/whoami                  ← Fallback
5. /api/teacher-auth/current                 ← Fallback
6. /api/teacher-auth/session                 ← Last resort
```

## Performance Metrics

```
Per Check (every 5 seconds):
─────────────────────────────────────────
Network Overhead:     ~100 bytes
Response Size:        ~200-300 bytes
Processing Time:      ~5-10 ms
CPU Usage:            <1%
Memory Footprint:     ~1 KB (per dashboard)

Over 8 Hours (typical school day):
─────────────────────────────────────────
API Calls:            4,320 calls (8 × 60 ÷ 5 × 60 × 2 dashboards avg)
Network Used:         ~500-700 KB
Server Load:          ~1-2 ms per call
Would scale to:       100 dashboards = negligible impact

Optimization Options:
- Increase interval if needed (currently 5s is good)
- Implement exponential backoff on failures
- Use WebSocket for true real-time (future)
- Cache role for X seconds to reduce calls
```

