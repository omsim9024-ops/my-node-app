# Admin Authentication System - Fixed ✅

## What Was Fixed

The error **"Cannot POST /api/admin/register"** was caused by missing backend routes for admin authentication.

### Changes Made:

1. **Created Admin Table** in `init-db.js`
   - Stores admin credentials (email, password, name, role)
  - Automatically created in `compostela_sms` database on server start

2. **Created Admin Auth Routes** (`routes/admin-auth.js`)
   - `POST /api/admin/register` - Create new admin account
   - `POST /api/admin/login` - Admin login with email/password

3. **Registered Routes in Server** (`server.js`)
   - Added `const adminAuthRouter = require('./routes/admin-auth');`
   - Registered with `app.use('/api/admin', adminAuthRouter);`

---

## How to Use

### Step 1: Set Up Database
If you haven't created the `compostela_sms` database yet:

```bash
npm run setup-db
```

### Step 2: Start the Server
```bash
npm start
```

Or with auto-reload:
```bash
npm run dev
```

You should see:
```
╔════════════════════════════════════════════════════════════════════════════╗
║  Compostela National High School SMS Server Running                        ║
║  Port: 5000                                                                ║
║  Environment: development                                                  ║
║  Frontend: http://localhost:5000                                           ║
║  API: http://localhost:5000/api                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
```

### Step 3: Create Admin Account
Open `auth.html?role=admin` in your browser and:
1. Click **"Create one here"** link
2. Fill in the signup form with:
  - Email: `admin@cnhs.edu.ph`
   - Password: `password123` (or your choice)
   - Full Name: `Admin Name`
   - Role: `Admin` (or Enrollment Officer/Registrar)
3. Click **"Create Account"**

You should see: `✅ Account created! Please login.`

### Step 4: Login as Admin
Use the created email and password to login. You'll be redirected to the admin dashboard.

---

## Admin Dashboard Features

Once logged in, admins can:

✅ **View Dashboard Statistics**
- Total Students
- Pending Enrollments
- Approved Enrollments
- Attendance Rate

✅ **Manage Enrollments**
- View all student enrollments
- Filter by status (Pending, Approved, Rejected)
- Click enrollment to view full details
- Approve or Reject enrollments

✅ **Navigation Menu**
- Dashboard (home)
- Student Management
- Student Directory
- Enrollment
- Attendance
- Academic Records

✅ **Profile Management**
- View admin name and email
- Settings
- Logout

---

## Database Structure

### Admins Table (compostela_sms database)
```
id              SERIAL PRIMARY KEY
email           VARCHAR(100) UNIQUE NOT NULL
password        VARCHAR(255) NOT NULL
name            VARCHAR(100) NOT NULL
role            VARCHAR(50) NOT NULL
account_status  VARCHAR(20) DEFAULT 'active'
created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

### Enrollments Table (stores all student data)
```
id                 SERIAL PRIMARY KEY
enrollment_id      VARCHAR(50) UNIQUE NOT NULL
student_id         INTEGER REFERENCES students(id)
enrollment_data    JSONB NOT NULL (complete form data)
enrollment_files   JSONB (file data URLs)
status            VARCHAR(20) DEFAULT 'Pending'
remarks           TEXT
enrollment_date   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

---

## Testing the System

### 1. Create Student Account
- Go to `auth.html?role=student`
- Create a new student account
- Login

### 2. Submit Enrollment
- Click "Enroll Now" button
- Fill out the enrollment form
- Click "Review and Submit Enrollment"
- Confirm submission

### 3. Login as Admin
- Go to `auth.html?role=admin`
- Use admin credentials
- View the new enrollment in the dashboard
- Click enrollment to view details
- Approve or Reject it

---

## API Examples

### Admin Registration
```bash
curl -X POST http://localhost:5000/api/admin/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@cnhs.edu.ph",
    "password": "password123",
    "name": "Admin User",
    "role": "admin"
  }'
```

### Admin Login
```bash
curl -X POST http://localhost:5000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@cnhs.edu.ph",
    "password": "password123"
  }'
```

### Get All Enrollments
```bash
curl http://localhost:5000/api/enrollments
```

### Update Enrollment Status
```bash
curl -X PATCH http://localhost:5000/api/enrollments/1 \
  -H "Content-Type: application/json" \
  -d '{"status": "approved"}'
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Cannot POST /api/admin/register" | Restart server: `npm start` |
| Database doesn't exist | Run: `npm run setup-db` |
| Port 5000 already in use | Change `SERVER_PORT` in `.env` |
| Admin account not saving | Check PostgreSQL is running, verify database tables with `npm run setup-db` |

---

## File Changes Summary

| File | Change |
|------|--------|
| `init-db.js` | Added `admins` table creation |
| `server.js` | Added admin auth route import and registration |
| `routes/admin-auth.js` | **NEW** - Admin register/login endpoints |
| `BACKEND_SETUP.md` | **NEW** - Backend setup documentation |

---

## Next Steps

The system is now ready for:
- ✅ Student enrollment submissions
- ✅ Admin account creation and login
- ✅ Enrollment review and approval
- ⏳ Student attendance tracking (can be implemented)
- ⏳ Academic records management (can be implemented)

All data is stored in the `compostela_sms` PostgreSQL database.



