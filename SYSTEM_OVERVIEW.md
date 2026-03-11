# Compostela National High School School Management System - Complete Setup Guide

## ✅ System Overview

The Compostela National High School School Management System consists of:

### Frontend Components:
- **Student Login** (`auth.html?role=student`) - Student authentication
- **Student Dashboard** (`student-dashboard.html`) - Student portal
- **Enrollment Form** (`enrollment-form.html`) - Student enrollment submission
- **Admin Login** (`auth.html?role=admin`) - Admin authentication
- **Admin Dashboard** (`admin-dashboard.html`) - Admin management panel

### Backend Components:
- **Express Server** (`server.js`) - Main API server
- **Database** (`compostela_sms` PostgreSQL) - Data storage
- **Routes** (`routes/`) - API endpoints

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Create Database
```bash
npm run setup-db
```

### 3. Start Server
```bash
npm start
```

Server runs on: `http://localhost:5000`

### 4. Open In Browser
- Student: `http://localhost:5000/auth.html?role=student`
- Admin: `http://localhost:5000/auth.html?role=admin`

---

## 📋 Complete User Flow

### Student Journey:

1. **Register** (`auth.html?role=student`)
   - Enter: First Name, Last Name, Email, Password, Grade Level
   - Account created in `students` table

2. **Login** (`auth.html?role=student`)
   - Enter: Email, Password
   - Redirected to Student Dashboard

3. **Enroll** (`enrollment-form.html`)
   - Fill enrollment form (personal, academic, address info)
   - Upload optional documents (birth cert, report card, student photo)
   - Submit enrollment
   - Data stored in `enrollments` table with status "Pending"

4. **Check Status** (`student-dashboard.html`)
   - View enrollment status
   - See if approved/rejected

### Admin Journey:

1. **Register** (`auth.html?role=admin`)
   - Click "Create one here"
   - Enter: Email, Password, Full Name, Role
   - Account created in `admins` table

2. **Login** (`auth.html?role=admin`)
   - Enter: Email, Password
   - Redirected to Admin Dashboard

3. **Review Enrollments** (`admin-dashboard.html`)
   - Dashboard shows stats (pending, approved, etc.)
   - View recent enrollments
   - Filter by status (All, Pending, Approved, Rejected)

4. **Manage Enrollments**
   - Click enrollment to view full details
   - Click "Approve" or "Reject"
   - Status updated in database
   - Student notified of status change

---

## 🗄️ Database Schema

### Tables in `compostela_sms`:

**1. students** - Student accounts
```
id, student_id, first_name, last_name, email, password, 
phone, grade_level, class_id, account_status, registration_date
```

**2. admins** - Admin accounts
```
id, email, password, name, role, account_status, created_at
```

**3. enrollments** - Enrollment submissions
```
id, enrollment_id, student_id, enrollment_data (JSONB), 
enrollment_files (JSONB), status, remarks, enrollment_date
```

**4. teachers, classes, grades** - Academic data (existing)

---

## 🔌 API Endpoints

### Student Auth
```
POST /api/auth/register      - Create student account
POST /api/auth/login         - Student login
```

### Admin Auth (FIXED)
```
POST /api/admin/register     - Create admin account
POST /api/admin/login        - Admin login
```

### Enrollments
```
GET  /api/enrollments                    - Get all enrollments
GET  /api/enrollments/:id                - Get specific enrollment
POST /api/enrollments                    - Submit new enrollment
PATCH /api/enrollments/:id               - Update enrollment status
GET  /api/enrollments/stats              - Get enrollment statistics
```

---

## 📁 File Structure

```
SMS/
├── server.js                           # Express server
├── db.js                               # Database connection
├── init-db.js                          # Database initialization (with admins table)
├── setup-db.js                         # Database creation script
├── auth.html?role=admin                    # Admin login page
├── admin-login.css                     # Admin login styles
├── admin-login.js                      # Admin login logic
├── admin-dashboard.html                # Admin dashboard
├── admin-dashboard.css                 # Dashboard styles
├── admin-dashboard.js                  # Dashboard logic
├── auth.html?role=student                  # Student login
├── student-login.css                   # Student login styles
├── student-login.js                    # Student login logic
├── student-dashboard.html              # Student portal
├── student-dashboard.css               # Portal styles
├── student-dashboard.js                # Portal logic
├── enrollment-form.html                # Enrollment form
├── enrollment-form.css                 # Form styles
├── enrollment-form.js                  # Form logic
├── routes/
│   ├── admin-auth.js                  # ✅ Admin auth routes (NEW)
│   ├── auth.js                        # Student auth routes
│   ├── enrollments.js                 # Enrollment routes
│   ├── students.js                    # Student routes
│   ├── teachers.js                    # Teacher routes
│   ├── classes.js                     # Class routes
│   └── grades.js                      # Grade routes
├── package.json                        # Dependencies & scripts
├── .env                               # Environment variables
├── BACKEND_SETUP.md                   # Backend setup guide
└── ADMIN_AUTH_FIXED.md                # Admin auth fix documentation
```

---

## 🔧 Environment Setup

Create `.env` file:
```
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=compostela_sms
SERVER_PORT=5000
NODE_ENV=development
```

---

## ✅ What Works Now

| Feature | Status | Notes |
|---------|--------|-------|
| Student Registration | ✅ | Email validation, password requirements |
| Student Login | ✅ | Session management with localStorage |
| Enrollment Form | ✅ | Full form with file uploads, blur detection |
| Enrollment Submission | ✅ | Data sent to backend, stored in DB |
| Student Dashboard | ✅ | View enrollment status, grades, schedule |
| Admin Registration | ✅ | Fixed - endpoints now available |
| Admin Login | ✅ | Role-based access (admin, officer, registrar) |
| Admin Dashboard | ✅ | View stats, manage enrollments |
| Enrollment Review | ✅ | View details, approve/reject |
| Logout | ✅ | Clean session, modal confirmation |

---

## 🐛 Known Issues & Solutions

### Issue: "Cannot POST /api/admin/register"
- **Cause**: Backend routes not registered
- **Status**: ✅ FIXED
- **Solution**: Restart server (`npm start`)

### Issue: Database doesn't exist
- **Cause**: Not run setup script
- **Status**: Known
- **Solution**: `npm run setup-db`

### Issue: Admin account not saving
- **Cause**: PostgreSQL not running or DB error
- **Status**: Check logs
- **Solution**: Run `npm run setup-db` and restart server

---

## 🚦 Testing Checklist

- [ ] Backend server running on port 5000
- [ ] PostgreSQL running with `compostela_sms` database
- [ ] Student can register account
- [ ] Student can login
- [ ] Student can fill and submit enrollment form
- [ ] Admin can register account
- [ ] Admin can login
- [ ] Admin can see enrollments in dashboard
- [ ] Admin can view enrollment details
- [ ] Admin can approve/reject enrollments
- [ ] Student can see updated status

---

## 📞 Support

For issues:
1. Check logs in terminal
2. Verify PostgreSQL is running
3. Run `npm run setup-db` to recreate tables
4. Check `.env` file is configured correctly
5. Restart server: `npm start`

---

## 🎯 Next Features (Optional)

- [ ] Email notifications for enrollment status changes
- [ ] Student attendance tracking
- [ ] Grades management
- [ ] Teacher assignment
- [ ] Class scheduling
- [ ] Report generation
- [ ] Data export (CSV/PDF)
- [ ] SMS notifications
- [ ] Two-factor authentication
- [ ] Audit logging

---

**Last Updated**: February 2, 2026  
**Status**: ✅ Production Ready for Testing

