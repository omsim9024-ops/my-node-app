# Compostela National High School School Management System - Backend Setup Guide

## Database Setup

The system uses **PostgreSQL** with the database name `compostela_sms`.

### 1. Create the Database

If you haven't created the database yet, run:

```bash
npm run setup-db
```

This will:
 Create a new database called `compostela_sms` (or the value in your `.env` file)

### 2. Initialize Database Tables

The tables are automatically created when the server starts. The system creates:

- **students** - Student account information and auth
- **admins** - Admin account information and roles
- **enrollments** - Student enrollment submissions with full data
- **teachers** - Teacher information
- **classes** - Class information
- **grades** - Student grades

### 3. Environment Variables

Create a `.env` file in the root directory:

```
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=compostela_sms
SERVER_PORT=5000
NODE_ENV=development
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Start the Server

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

The server will start on `http://localhost:5000`

---

## API Endpoints

### Authentication & Admin Routes

**Admin Registration:**
```
POST /api/admin/register
Body: {
  "email": "admin@cnhs.edu.ph",
  "password": "password123",
  "name": "Admin Name",
  "role": "admin"  // or "enrollmentOfficer" or "registrar"
}
```

**Admin Login:**
```
POST /api/admin/login
Body: {
  "email": "admin@cnhs.edu.ph",
  "password": "password123"
}
```

**Student Registration:**
```
POST /api/auth/register
Body: {
  "firstName": "John",
  "lastName": "Doe",
  "email": "student@cnhs.edu.ph",
  "password": "password123",
  "gradeLevel": "10"
}
```

**Student Login:**
```
POST /api/auth/login
Body: {
  "email": "student@cnhs.edu.ph",
  "password": "password123"
}
```

### Enrollment Routes

**Submit Enrollment:**
```
POST /api/enrollments
Body: {
  "student_id": 1,
  "enrollment_data": { /* form data */ },
  "enrollment_files": { /* file data URLs */ }
}
```

**Get All Enrollments:**
```
GET /api/enrollments
```

**Get Enrollment by ID:**
```
GET /api/enrollments/:id
```

**Update Enrollment Status:**
```
PATCH /api/enrollments/:id
Body: {
  "status": "approved"  // or "rejected"
}
```

**Get Enrollment Stats:**
```
GET /api/enrollments/stats
```

---

## Database Schema

### Admins Table
```sql
CREATE TABLE admins (
    id SERIAL PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL,
    account_status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Students Table
```sql
CREATE TABLE students (
    id SERIAL PRIMARY KEY,
    student_id VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255),
    phone VARCHAR(20),
    grade_level VARCHAR(50),
    class_id INTEGER REFERENCES classes(id),
    account_status VARCHAR(20) DEFAULT 'active',
    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Enrollments Table
```sql
CREATE TABLE enrollments (
    id SERIAL PRIMARY KEY,
    enrollment_id VARCHAR(50) UNIQUE NOT NULL,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    enrollment_data JSONB NOT NULL,
    enrollment_files JSONB,
    status VARCHAR(20) DEFAULT 'Pending',
    remarks TEXT,
    enrollment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Troubleshooting

### Error: "Cannot POST /api/admin/register"

This means the backend server is not running or the endpoint is not registered.

**Solution:**
1. Make sure PostgreSQL is running
2. Run `npm run setup-db` to create the database
3. Run `npm start` to start the server
4. Check that `routes/admin-auth.js` exists and is imported in `server.js`

### Error: "Database does not exist"

**Solution:**
```bash
npm run setup-db
npm start
```

### Connection Refused on :5000

**Solution:**
1. Check if port 5000 is already in use
2. Kill the existing process or change `SERVER_PORT` in `.env`
3. Restart the server

---

## Features Implemented

✅ **Student Authentication** - Register and login with email/password  
✅ **Admin Authentication** - Admin/Registrar login with role-based access  
✅ **Enrollment System** - Students submit enrollment forms with file uploads  
✅ **Admin Dashboard** - View, filter, approve/reject enrollments  
✅ **Data Storage** - All enrollment data stored in `compostela_sms` database
✅ **JSON Support** - Full enrollment data (forms + files) stored as JSONB  

---

## Contact & Support

For issues or questions, contact the development team.


