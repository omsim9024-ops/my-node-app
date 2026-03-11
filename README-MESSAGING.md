Realtime Messaging (Admin + Adviser)
=================================

This repository includes a lightweight WebSocket-based messaging system that integrates with both the Admin and Adviser dashboards.

## Features
- Real-time peer-to-peer messaging between Admin and Adviser
- Conversation list with contact details and unread counts
- Message history and delivery status
- Presence indicators (online/offline status)
- Automatically loads contacts from teacher database (`/api/teachers`)
- User ID resolution from auth APIs or teacher database matching
- Light/dark theme awareness (integrated with dashboard themes)

Quick start (development):

1. From the project root run:

```powershell
npm install
```

2a. To run the main app server (unchanged):

```powershell
npm start
```

2b. To run the messaging server (development-only WebSocket relay):

```powershell
npm run messaging
```

If port 3012 is already in use, run on a different port by setting `MESSAGING_PORT` in PowerShell for the session:

```powershell
$env:MESSAGING_PORT = '3013'
npm run messaging
```

Or stop the process currently using port 3012 (example PowerShell commands):

```powershell
netstat -ano | findstr :3012
taskkill /PID <pid> /F
```

3. Open the Admin dashboard (`admin-dashboard.html`) and the Adviser dashboard (`adviser-dashboard.html`) in your browser (file:// or via your local server). Click the chat toggle (💬) in each dashboard to open the panel. The client connects to `ws://localhost:<PORT>` where `<PORT>` is `3012` by default or the value of `MESSAGING_PORT`.

## Recent Updates

### Message Sender Attribution Fix
Fixed an issue where messages from the admin appeared to come from the adviser's own profile. The fix includes:
- Dynamic user ID resolution from auth APIs and teacher database
- Enhanced ID resolution fallbacks for robustness
- Proper message sender attribution in the UI

See [MESSAGE_SENDER_FIX_GUIDE.md](MESSAGE_SENDER_FIX_GUIDE.md) for testing and verification steps.

## Notes
- This is a development-focused, in-memory server for demo and testing only. It does not persist messages or implement authentication.
- For production use, replace `messaging-server.js` with a proper authenticated server, persistent store, and secure WebSockets (wss).
- User IDs are resolved from `/api/teachers`, `/api/adviser-auth/*`, and `/api/teacher-auth/*` endpoints

