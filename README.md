# Compostela National High School - School Management System

A complete School Management System for managing students, teachers, classes, and grades with a Node.js/Express backend and PostgreSQL database.

## Project Structure

```
SMS/
├── index.html              # Main frontend HTML
├── index.css               # Frontend styles
├── index.js                # Frontend JavaScript with API integration
├── server.js               # Express server entry point
├── db.js                   # PostgreSQL connection
├── init-db.js              # Database initialization script
├── package.json            # Dependencies
├── .env                    # Environment variables (configure these)
├── .gitignore              # Git ignore rules
└── routes/
    ├── teachers.js         # Teacher API routes
    ├── students.js         # Student API routes
    ├── classes.js          # Class API routes
    └── grades.js           # Grade API routes
```

## Prerequisites

- **Node.js** (v14 or higher)
- **PostgreSQL** (v12 or higher)
- **npm** (comes with Node.js)

## Installation & Setup

### 1. Install Dependencies

```bash
npm install
```

This will install all required packages:
- express (web framework)
- pg (PostgreSQL driver)
- cors (Cross-Origin Resource Sharing)
- dotenv (environment variables)
- body-parser (request body parsing)
- nodemon (development auto-reload)

### 2. Configure PostgreSQL

#### Windows Setup:
1. Download and install PostgreSQL from https://www.postgresql.org/download/windows/
2. During installation, remember the password you set for the `postgres` user
3. Start PostgreSQL (it runs as a service)
4. Open pgAdmin (comes with PostgreSQL) to verify installation

#### Create Database User (Optional):
Open PostgreSQL command line and run:
```sql
CREATE USER sms_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE compostela_sms TO sms_user;
```

### 3. Configure Environment Variables

Edit the `.env` file in the SMS folder.  The values depend on which database you're using:

```env
# Database Connection Configuration
DB_CLIENT=postgres      # set to "mysql" (or "mysql2") when using AMPPS
DB_HOST=localhost
# PostgreSQL default port:
DB_PORT=5432            # use 3306 for MySQL
DB_NAME=compostela_sms  # use ratings for the AMPPS MySQL database
DB_USER=postgres        # use root (or your MySQL user) for MySQL
DB_PASSWORD=your_password_here  # PostgreSQL password or MySQL root password

# Server Configuration
SERVER_PORT=5000
NODE_ENV=development

# Admin authentication (required for /api/admin/* JWT verification)
JWT_SECRET=replace_with_a_long_random_secret
# Optional dev-only fallback if JWT_SECRET is intentionally blank
JWT_DEV_SECRET=replace_with_dev_fallback_secret
# Optional OTP hash pepper
OTP_PEPPER=replace_with_otp_pepper
```

The code checks `DB_CLIENT` and skips the PG DDL if you specify a MySQL client.
If you switch to MySQL, remember to install `mysql2` and update `db.js` accordingly (see developer notes below).  You can run `npm install mysql2`.

**Important:** Update `DB_USER` and `DB_PASSWORD` with your actual PostgreSQL credentials.

### 4. Start the Server

```bash
npm start
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

### 5. Open the Application

Open your browser and navigate to: **http://localhost:5000**

## Features

### Dashboard
- View statistics (total students, classes, teachers)
- Track average grades
- Activity log of recent actions

### Student Management
- Add/view/delete students
- Assign students to classes
- Search students by name or ID
- Store email and phone contact info

### Class Management
- Create classes for each grade level
- Assign class advisers (teachers)
- Set class capacity
- View enrollment status

### Grade Management
- Record grades by subject and quarter
- View all recorded grades
- Search grades by student or subject
- Calculate average grades across the system

### Teacher Management
- Add/view/delete teachers
- Assign to departments
- Store contact information
- Use as class advisers

## API Endpoints

### Teachers
- `GET /api/teachers` - Get all teachers
- `GET /api/teachers/:id` - Get specific teacher
- `POST /api/teachers` - Create new teacher
- `PUT /api/teachers/:id` - Update teacher
- `DELETE /api/teachers/:id` - Delete teacher

### Students
- `GET /api/students` - Get all students
- `GET /api/students/:id` - Get specific student
- `POST /api/students` - Create new student
- `PUT /api/students/:id` - Update student
- `DELETE /api/students/:id` - Delete student

### Classes
- `GET /api/classes` - Get all classes
- `GET /api/classes/:id` - Get specific class
- `POST /api/classes` - Create new class
- `PUT /api/classes/:id` - Update class
- `DELETE /api/classes/:id` - Delete class

### Grades
- `GET /api/grades` - Get all grades
- `GET /api/grades/:id` - Get specific grade
- `GET /api/grades/student/:student_id` - Get grades for a student
- `POST /api/grades` - Create new grade record
- `PUT /api/grades/:id` - Update grade
- `DELETE /api/grades/:id` - Delete grade
- `GET /api/grades/stats/average` - Get average grade

## Database Schema

### Teachers Table
- id (Primary Key)
- teacher_id (Unique)
- name
- department
- email (Unique)
- phone

### Students Table
- id (Primary Key)
- student_id (Unique)
- name
- grade_level
- email (Unique)
- phone
- class_id (Foreign Key)

### Classes Table
- id (Primary Key)
- class_name
- grade_level
- teacher_id (Foreign Key)
- capacity
- enrollment

### Grades Table
- id (Primary Key)
- student_id (Foreign Key)
- subject
- grade_value (0-100)
- quarter
- recorded_date

## Development

### Using Nodemon (Auto-reload)

For development with automatic server restart on file changes:

```bash
npm run dev
```

### Troubleshooting

**Issue: "Cannot connect to database"**
- If you're using PostgreSQL, make sure the service is running.
- If you're using AMPPS/MySQL:
  1. Open the AMPPS control panel and start the MySQL service.
  2. Visit http://localhost/phpmyadmin to verify the server is accepting connections.
  3. Confirm that `DB_HOST`, `DB_PORT`, `DB_USER`, and `DB_PASSWORD` in `.env` match the AMPPS configuration (default port 3306, user `root`).
  4. Run the included `sanity-check.js` script to test connectivity.
- If you see `ECONNREFUSED`, the server is not listening or the port is incorrect.

**Issue: "Port 5000 already in use" (or another port listed during startup)**
- Change `SERVER_PORT` in `.env` to a free port (e.g., 3002).
- Or kill the process currently occupying the port. On Windows:
  ```bat
  netstat -ano | find "3000"
  taskkill /PID <pid> /F
  ```

**MySQL-specific notes**
- When using the AMPPS database, the startup log may show `Error ensuring guidance tables exist:` or `Error initializing database:`; these messages usually mean the application attempted to connect before MySQL was running. Start the MySQL service and restart the server.
- The app gracefully skips its internal PostgreSQL schema logic when `DB_CLIENT` is set to `mysql`.

**Issue: "Module not found"**
- Run `npm install` again
- Delete node_modules folder and package-lock.json, then run `npm install`

**Issue: "CORS errors"**
- Ensure server is running on the correct port
- Check API_URL in index.js matches your server configuration

## Security Considerations

⚠️ **Important for Production:**
- Use environment variables for all sensitive data
- Implement authentication/authorization
- Use HTTPS instead of HTTP
- Add input validation on both frontend and backend
- Implement rate limiting
- Use prepared statements (already done in this implementation)
- Add proper error handling and logging

## Next Steps

1. Add user authentication (login system)
2. Implement role-based access control (Admin, Teacher, Student)
3. Add more advanced reporting and analytics
4. Implement data export functionality (PDF, Excel)
5. Add email notifications
6. Create mobile app version

## Support

For issues or questions, refer to the code comments and database schema documentation.

## License

This project is for educational use at Compostela National High School.

