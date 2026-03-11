# Message Sender Attribution Fix - Testing Guide

## Problem Fixed
When an adviser received a message from the admin, it was appearing under the adviser's own profile instead of the admin's profile.

## Root Cause
The adviser's `window.CURRENT_USER.id` was either:
- Set to a hardcoded  value ("adviser-1") that didn't match any real teacher ID
- Or not being resolved from the API and remaining `null`

When receiving messages, the client checks `if (m.from === window.CURRENT_USER.id)` to determine if the message is from the current user. If this check incorrectly evaluated to true, messages appeared as self-sent.

## Changes Made

### 1. Dashboard HTML Updates
- **[admin-dashboard.html](admin-dashboard.html#L2310)** and **[adviser-dashboard.html](adviser-dashboard.html#L780)**
  - Changed hardcoded user IDs from static values to `null`
  - IDs are now resolved dynamically from API/database at runtime

### 2. Enhanced User ID Resolution (`messaging.js`)
- **Function: `resolveCurrentUser()`**
  - Now tries multiple auth endpoints in order:
    - `/api/teacher-auth/profile`, `/api/teacher-auth/me`, `/api/teacher-auth/session`, `/api/teacher-auth/whoami`
    - `/api/adviser-auth/me`, `/api/adviser-auth/profile`, `/api/adviser-auth/session`
    - `/api/admin-auth/me`, `/api/admin-auth/profile`
  - Falls back to name matching: matches visible profile name (e.g., "NANIL") against loaded teacher list
  - Final fallback: generates a pseudo-ID (e.g., "user:nanil") to ensure ID is never null

### 3. WebSocket Connection Guard (`messaging.js`)
- **Function: `ensureWs()`**
  - Now waits for `window.CURRENT_USER.id` to be resolved before attempting connection
  - Prevents connecting with an unresolved (null) ID
  - Added detailed logging to show authenticated user ID at connection time

### 4. Enhanced Logging
- **Client side (`messaging.js`)**:
  - Logs user ID resolution at each stage
  - Logs message rendering decisions ("mine" vs "them")
  - Logs WebSocket connection details
  
- **Server side (`messaging-server.js`)**:
  - Logs message routing: from, to, delivery status

## Testing Steps

### Part 1: Verify ID Resolution
1. Open the adviser dashboard in browser
2. Open Developer Tools console (F12 → Console tab)
3. Reload the page
4. Look for console logs like:
   ```
   Resolved current user from /api/adviser-auth/me: id=123, name=NANIL
   ```
   OR
   ```
   Resolved current user by name match: id=456, name=NANIL
   ```
   OR
   ```
   Could not resolve user ID from API/DB, using pseudo-ID: user:nanil
   ```
5. Note the resolved ID

### Part 2: Send and Receive Messages
1. **In adviser dashboard**:
   - Open the chat sidebar
   - Select a teacher/contact
   - Note the adviser is logged in with their resolved ID

2. **In admin dashboard** (separate browser or window):
   - Open the chat sidebar
   - Find the adviser in the contacts list
   - Send a test message like "Test from admin"

3. **Back in adviser dashboard**:
   - Wait for the message to arrive
   - Check the message bubble styling:
     - If the message has the bubble on the LEFT and is NOT signed with the adviser's name → **CORRECT** (message is from admin)
     - If the message has the bubble on the RIGHT or is signed with adviser's name → **INCORRECT** (still has the bug)

### Part 3: Check Console Logs
In the adviser dashboard console, you should see lines like:
```
Message: from=<admin-id>, to=<adviser-id>, currentUser=<adviser-id>, isMine=false
```

The `isMine=false` indicates the message is correctly identified as not being from the current user.

## Debug Information

### Accessing Debug Data
In the browser console, you can inspect:
```javascript
// Current user info
window.CURRENT_USER

// List of loaded teachers
window.Messaging.conversations

// Conversations with messages
Object.entries(window.Messaging.conversations).map(([id, conv]) => ({
  peerId: id,
  lastMessage: conv.lastMessage,
  messageCount: conv.msgs.length
}))
```

## Server Output
The messaging server should show logs like:
```
Messaging server running on ws://localhost:3012
auth <user-id> (when someone connects)
Message: from=<sender-id> to=<recipient-id> (when messages are sent)
Sending message to recipient <recipient-id>
Echoing message to sender <sender-id>
```

## Verification Checklist
- [ ] Adviser dashboard resolves user ID (check console logs)
- [ ] Admin dashboard resolves user ID
- [ ] Message from admin appears on LEFT side in adviser's chat
- [ ] Message is NOT signed with adviser's name
- [ ] Console logs show `isMine=false` for received messages from admin
- [ ] Adviser can still send messages that appear on RIGHT side

## If Issue Persists
1. Check browser console for errors or warnings
2. Verify `/api/teachers` endpoint returns adviser with a `role` field
3. Verify auth endpoints (`/api/adviser-auth/me`, `/api/teacher-auth/me`, etc.) are working
4. Check messaging server logs for message routing issues
5. Verify both admin and adviser have different resolved IDs

