# How to Start the Compostela National High School SMS Server

## Prerequisites
- Node.js installed (v14 or higher)
- PostgreSQL installed and running
- `.env` file configured with correct database credentials

## Quick Start

### Windows (PowerShell)
```powershell
cd c:\Users\icile\OneDrive\Desktop\SMS
npm start
```

### Windows (Command Prompt)
```cmd
cd c:\Users\icile\OneDrive\Desktop\SMS
npm start
```

### Mac/Linux
```bash
cd ~/path/to/SMS
npm start
```

## Checking if the Server is Running

The server should display:
```
╔════════════════════════════════════════════════════════════════════════════╗
║  Compostela National High School SMS Server Running                        ║
║  Port: 3000                                                                ║
║  Environment: development                                                  ║
║  Frontend: http://localhost:3000                                           ║
║  API: http://localhost:3000/api                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
```

## Troubleshooting

### Error: "Cannot GET /api/enrollments"
This means the backend API is not responding. Check:
1. **Is the server running?** - Look for the "Server Running" message in the terminal
2. **Is PostgreSQL running?** - Check Windows Services or your system's database status
3. **Is the .env file configured?** - Verify `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` are correct

### Error: "EADDRINUSE: address already in use :::3000"
Port 3000 is already in use. Either:
- Kill the existing process using that port
- Change `SERVER_PORT` in `.env` to a different port (e.g., 3001)

### Error: "connection refused" or database errors
PostgreSQL is not running:
- **Windows**: Make sure PostgreSQL service is started
- **Mac**: Start PostgreSQL from System Preferences or Terminal
- **Linux**: Run `sudo systemctl start postgresql`

### After Fixing an Issue
1. Stop the server (Ctrl+C in the terminal)
2. Wait 2-3 seconds
3. Restart the server with `npm start`
4. **Hard refresh your browser** (Ctrl+Shift+R or Cmd+Shift+R) to clear cache

## Database Setup

If you get database errors, run:
```bash
npm run setup-db
```

This will create the database and tables automatically.

## Accessing the Application

Once the server is running:
- **Admin Dashboard**: http://localhost:3000/admin-dashboard.html
- **Enrollment Form**: http://localhost:3000/enrollment-form.html
- **Student Dashboard**: http://localhost:3000/student-dashboard.html
- **Admin Login**: http://localhost:3000/auth.html?role=admin

## For Development

If you want the server to automatically restart when you make changes:
```bash
npm run dev
```

This uses nodemon to watch for file changes.

---

**Note**: If you continue to see errors, check the terminal output of the server for detailed error messages and report them with the error output.

