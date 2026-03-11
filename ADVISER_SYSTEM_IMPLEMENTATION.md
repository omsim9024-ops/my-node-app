# Adviser Account Flow & Dashboard Implementation

## 📋 Overview

This document describes the complete Adviser Account Flow and Adviser Dashboard implementation for the Compostela National High School SMS (School Management System).

The Adviser system allows school administrators to manage class advisers while providing advisers with their own dedicated portal to manage assigned students and sections.

---

## 🏗️ Architecture

### Database Tables Created

1. **advisers** - Adviser account and profile information
   - adviser_id (unique)
   - first_name, last_name
   - email (unique, used for login)
   - password
   - phone (optional)
   - account_status (active/inactive)

2. **adviser_section_assignments** - Maps advisers to sections per school year
   - adviser_id (FK)
   - section_id (FK)
   - school_year_id (FK)
   - assigned_date
   - UNIQUE constraint on (adviser_id, section_id, school_year_id)

3. **adviser_notes** - Advising notes and observations per student
   - adviser_id (FK)
   - student_id (FK)
   - note_type (counseling, behavioral, academic, personal)
   - note_content
   - is_confidential (default: true)

4. **adviser_attendance** - Daily attendance tracking by adviser
   - adviser_id (FK)
   - student_id (FK)
   - section_id (FK)
   - school_year_id (FK)
   - attendance_date
   - status (Present, Absent, Late, Excused)
   - remarks (optional)
   - UNIQUE constraint on (student_id, section_id, attendance_date)

5. **adviser_notifications** - Notifications for advisers
   - adviser_id (FK)
   - type
   - title, message
   - related_data (JSONB)
   - is_read boolean

---

## 🔌 Backend API Endpoints

### Authentication Routes (`/api/adviser-auth`)

#### POST `/api/adviser-auth/create`
**Admin only** - Create a new adviser account
```json
{
  "adviser_id": "ADV001",
  "first_name": "John",
  "last_name": "Doe",
  "email": "john.doe@cnhs.edu",
  "password": "Secure123!",
  "phone": "+63-xxx-xxx-xxxx"
}
```

#### POST `/api/adviser-auth/login`
Adviser login endpoint
```json
{
  "email": "john.doe@cnhs.edu",
  "password": "Secure123!"
}
```
**Response includes:** adviser id, name, email

#### POST `/api/adviser-auth/register`
**Public** – Allows teachers/advisers to self‑register using a valid registration code. This mirrors the student registration flow and is consumed by the unified authentication page.
```json
{
  "adviser_id": "ADV123",
  "first_name": "Jane",
  "last_name": "Smith",
  "email": "jane.smith@cnhs.edu",
  "password": "StrongPass1",
  "phone": "+63-xxx-xxx-xxxx",
  "registrationCode": "CODE2025"
}
```
Success response returns the newly created adviser record (without password).


#### GET `/api/adviser-auth/profile/:adviser_id`
Get adviser profile information

#### PUT `/api/adviser-auth/change-password/:adviser_id`
Change adviser password
```json
{
  "old_password": "currentPass123!",
  "new_password": "newPass456!"
}
```

#### GET `/api/adviser-auth/sections/:adviser_id`
Get all sections assigned to an adviser
**Query params:** `school_year_id` (optional)

#### POST `/api/adviser-auth/assign-section`
**Admin only** - Assign a section to an adviser
```json
{
  "adviser_id": 1,
  "section_id": 5,
  "school_year_id": 1
}
```

#### DELETE `/api/adviser-auth/remove-section/:assignment_id`
**Admin only** - Remove section assignment

#### GET `/api/adviser-auth`
**Admin only** - Get all advisers

#### PUT `/api/adviser-auth/status/:adviser_id`
**Admin only** - Update adviser account status
```json
{
  "account_status": "active"
}
```

---

### Dashboard Routes (`/api/adviser-dashboard`)

#### GET `/api/adviser-dashboard/overview/:adviser_id`
Get dashboard overview (total sections, students, notifications)

#### GET `/api/adviser-dashboard/class-list/:section_id`
Get all students in a section

#### GET `/api/adviser-dashboard/student/:student_id`
Get student profile (read-only from adviser perspective)

#### POST `/api/adviser-dashboard/notes`
Add an advising note for a student
```json
{
  "adviser_id": 1,
  "student_id": 5,
  "note_type": "counseling",
  "note_content": "Student showed improvement in math...",
  "is_confidential": true
}
```

#### GET `/api/adviser-dashboard/notes/student/:student_id`
Get all notes for a specific student

#### PUT `/api/adviser-dashboard/notes/:note_id`
Update an existing note

#### DELETE `/api/adviser-dashboard/notes/:note_id`
Delete a note

#### POST `/api/adviser-dashboard/attendance`
Record/update student attendance
```json
{
  "adviser_id": 1,
  "student_id": 5,
  "section_id": 3,
  "school_year_id": 1,
  "attendance_date": "2024-02-08",
  "status": "Present",
  "remarks": "Arrived on time"
}
```

#### GET `/api/adviser-dashboard/attendance/section/:section_id/:date`
Get attendance records for a section on a specific date

#### GET `/api/adviser-dashboard/attendance/student/:student_id/:section_id`
Get attendance summary for a student in a section

#### GET `/api/adviser-dashboard/notifications/:adviser_id`
Get adviser notifications
**Query params:** `unread_only=true` (optional)

#### PUT `/api/adviser-dashboard/notifications/:notification_id`
Mark a notification as read

---

## 🎨 Frontend Pages

### 1. Adviser Login (`auth.html?role=adviser`)

**Path:** `/auth.html?role=adviser`

Simple login page for advisers with:
- Email input
- Password input
- Login button
- Error message display
- Link back to home page

**Files:**
- `auth.html?role=adviser` - HTML structure
- `adviser-login.css` - Styling (gradient background, centered form)
- `adviser-login.js` - Login logic

**Session Storage Used:**
- `adviser_id` - Adviser identifier
- `adviser_name` - Adviser full name
- `adviser_email` - Adviser email

---

### 2. Adviser Dashboard (`adviser-dashboard.html`)

**Path:** `/adviser-dashboard.html`

Full-featured dashboard with sidebar navigation and multiple sections:

#### Sections:

1. **Overview (Dashboard Home)**
   - Total assigned sections
   - Total students handled
   - Pending notifications count
   - Quick action links

2. **My Sections & Class List**
   - View all assigned sections
   - Filter by school year
   - Select section to view class list
   - View student details with quick profile view

3. **Student Management**
   - View students in selected section
   - Search by name or student ID
   - View student profiles (read-only)
   - Track electives and enrollment status

4. **Attendance Management**
   - Select section and date
   - Mark attendance: Present, Absent, Late, Excused
   - Add optional remarks
   - Bulk save attendance
   - View attendance summaries per student

5. **Advising Notes & Records**
   - Add notes for students with types:
     - Counseling Remarks
     - Behavioral Notes
     - Academic Observations
     - Personal Remarks
   - Mark notes as confidential
   - View all notes for a student
   - Edit/delete notes

6. **Notifications**
   - View all notifications
   - Mark as read
   - Real-time notification badge

7. **Profile & Settings**
   - View adviser information
   - Change password
   - Notification preferences

**Files:**
- `adviser-dashboard.html` - HTML structure with all sections
- `adviser-dashboard.css` - Styling (sidebar layout, cards, tables, modals)
- `adviser-dashboard.js` - All dashboard functionality

---

### 3. Admin Adviser Management (`admin-adviser-management.html`)

**Path:** `/admin-adviser-management.html`

Admin interface for managing advisers with three main tabs:

#### Tab 1: Advisers List
- View all advisers in a table
- Search by name or email
- Edit adviser details
- Change adviser status (active/inactive)
- Delete/deactivate adviser accounts

#### Tab 2: Create Adviser
- Form to create new adviser accounts
- Required fields: adviser_id, email, first/last name, password
- Optional: phone number
- Password validation (minimum 8 characters)

#### Tab 3: Section Assignments
- Assign sections to advisers
- Select adviser, section, and school year
- View current assignments
- Remove assignments

**Files:**
- `admin-adviser-management.html` - Complete HTML with embedded CSS and JavaScript

---

## 📚 Workflow Examples

### Setting Up a New Adviser

1. **Admin creates adviser account**
   - Navigate to `admin-adviser-management.html`
   - Go to "Create Adviser" tab
   - Fill in adviser details (ID, name, email, password)
   - Click "Create Adviser"

2. **Assign sections to adviser**
   - Go to "Section Assignments" tab
   - Select the adviser from dropdown
   - Choose section(s) to assign
   - Select school year
   - Click "Assign Section"

3. **Adviser logs in**
   - Navigate to `auth.html?role=adviser`
   - Enter email and password
   - Redirected to adviser dashboard

4. **Adviser manages their class**
   - View assigned sections in "My Sections"
   - Click "View Class" to see class list
   - Record attendance
   - Add advising notes for students
   - View notifications

---

## 🔐 Security Features

1. **Authentication**
   - Email and password-based login
   - Only active advisers can log in
   - Session storage (not persistent - cleared on browser close)

2. **Authorization**
   - Advisers can only view their assigned sections
   - Advisers can only see and manage notes for their students
   - Admin-only operations protected

3. **Data Protection**
   - Confidential notes marked as private
   - Adviser notes not visible to students
   - Password field required for sensitive operations

---

## 🚀 Deployment Steps

### 1. Database Migration
```bash
# The database tables are automatically created on server startup
# Run the server to initialize tables:
npm start
```

### 2. Configure Environment
Ensure `.env` file has correct database configuration:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cnhs_sms
DB_USER=postgres
DB_PASSWORD=your_password
SERVER_PORT=3000
```

### 3. Server Routes
Routes are automatically registered in `server.js`:
- `/api/adviser-auth` → adviser authentication
- `/api/adviser-dashboard` → adviser dashboard operations

### 4. Access the System

**For Students:**
- http://localhost:3000/auth.html?role=student

**For Admins:**
- http://localhost:3000/auth.html?role=admin
- Adviser Management: http://localhost:3000/admin-adviser-management.html

**For Advisers:**
- http://localhost:3000/auth.html?role=adviser

---

## 🧪 Testing Checklist

### Admin Functions
- [ ] Create adviser account
- [ ] View all advisers
- [ ] Edit adviser details
- [ ] Change adviser status
- [ ] Assign sections to adviser
- [ ] Remove section assignment

### Adviser Functions
- [ ] Login with correct credentials
- [ ] Login fails with wrong password
- [ ] View assigned sections
- [ ] View class list
- [ ] View student profile
- [ ] Record attendance
- [ ] Mark student present with one click
- [ ] Bulk save attendance
- [ ] Add advising note
- [ ] Edit advising note
- [ ] Delete advising note
- [ ] View notifications
- [ ] Mark notification as read
- [ ] Change password
- [ ] Logout

### Data Integrity
- [ ] Attendance records are unique per student/section/date
- [ ] Section assignments are unique per adviser/section/school year
- [ ] Only active advisers can login
- [ ] Notes are associated with correct adviser and student

---

## 📊 Database Schema Diagram

```
Advisers
├── adviser_id (PK)
├── first_name
├── last_name
├── email (UNIQUE)
├── password
├── phone
├── account_status
└── timestamps

Adviser_Section_Assignments
├── id (PK)
├── adviser_id (FK → Advisers)
├── section_id (FK → Sections)
├── school_year_id (FK → School_Years)
└── assigned_date

Adviser_Notes
├── id (PK)
├── adviser_id (FK → Advisers)
├── student_id (FK → Students)
├── note_type
├── note_content
├── is_confidential
└── timestamps

Adviser_Attendance
├── id (PK)
├── adviser_id (FK → Advisers)
├── student_id (FK → Students)
├── section_id (FK → Sections)
├── school_year_id (FK → School_Years)
├── attendance_date
├── status
├── remarks
└── timestamps

Adviser_Notifications
├── id (PK)
├── adviser_id (FK → Advisers)
├── type
├── title
├── message
├── related_data (JSONB)
├── is_read
└── timestamps
```

---

## 🔄 Integration Points

### With Existing System
1. **Sections** - Advisers are assigned to existing sections
2. **Students** - Advisers manage existing students in their sections
3. **School Years** - All assignments tied to active school years
4. **Attendance** - Separate from student attendance, adviser-specific

### Future Enhancements
- Push notifications for advisers
- Adviser reports and analytics
- Parent communication integration
- Student feedback system
- Adviser performance metrics

---

## 📞 Support & Troubleshooting

### Common Issues

**"Login Failed" Error**
- Check email spelling
- Verify password is at least 8 characters
- Ensure adviser account status is "active"

**"No Sections Assigned"**
- Admin must assign sections via admin-adviser-management.html
- Verify section exists and is valid for the school year

**Attendance Not Saving**
- Ensure both section and date are selected
- Check that at least one attendance status is selected
- Verify adviser has permission for the section

**Notes Not Appearing**
- Select a student from the dropdown
- Notes only appear for the selected student
- Check if notes are marked as confidential

---

## 📝 Files Summary

| File | Purpose | Type |
|------|---------|------|
| `auth.html?role=adviser` | Adviser login page | HTML |
| `adviser-login.css` | Login page styling | CSS |
| `adviser-login.js` | Login functionality | JavaScript |
| `adviser-dashboard.html` | Main adviser dashboard | HTML |
| `adviser-dashboard.css` | Dashboard styling | CSS |
| `adviser-dashboard.js` | Dashboard functionality | JavaScript |
| `admin-adviser-management.html` | Admin adviser management | HTML |
| `routes/adviser-auth.js` | Authentication API | Node.js |
| `routes/adviser-dashboard.js` | Dashboard API | Node.js |
| `init-db.js` | Database initialization | Node.js |

---

**Implementation Date:** February 8, 2026  
**System:** Compostela National High School SMS  
**Version:** 1.0.0



