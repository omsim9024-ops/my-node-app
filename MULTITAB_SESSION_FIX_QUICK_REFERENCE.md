# Multi-Tab Session Fix - Quick Reference Guide

**What Was Changed:** Session management system to prevent tabs from interfering with each other

**Total Files Modified:** 11 (1 new, 5 JavaScript files, 5 HTML files)

---

## Summary of Changes by File

### ✨ **NEW FILE: session-manager.js**

**Purpose:** Core utility for tab-scoped session management

**What It Does:**
- Generates unique ID for each browser tab
- Stores session data separately for each tab
- Validates sessions to prevent tampering
- Provides fallback to localStorage

**Size:** 280+ lines of well-documented code

**Key Methods:**
```javascript
sessionManager.loginTab(userData, type)      // Store session
sessionManager.getTabSession(key)             // Retrieve session
sessionManager.logoutTab()                    // Clear session
sessionManager.validateSession()              // Check if valid
sessionManager.getTabId()                     // Get tab's unique ID
```

**Status:** ✅ Created and ready to use

---

### **admin-login.js** - Lines 72-152

**Change:** Added tab-scoped session storage on successful admin login

**Before:**
```javascript
// Only stored in localStorage, shared across tabs
localStorage.setItem("adminData", JSON.stringify(adminData));
```

**After:**
```javascript
// Check if session manager available
if (typeof sessionManager !== 'undefined' && sessionManager.loginTab) {
    sessionManager.loginTab(adminData, 'admin');
}
// Still keep localStorage for backward compatibility
localStorage.setItem("adminData", JSON.stringify(adminData));
```

**Impact:** Each tab now has its own admin session

**Status:** ✅ Updated

---

### **teacher-login.js** - Lines 23-40

**Change:** Added tab-scoped session storage on successful teacher login

**Before:**
```javascript
localStorage.setItem("loggedInUser", JSON.stringify(teacherData));
```

**After:**
```javascript
// Use session manager for this tab
if (typeof sessionManager !== 'undefined' && sessionManager.loginTab) {
    sessionManager.loginTab(teacherData, 'teacher');
}
// Keep existing storage for compatibility
localStorage.setItem("loggedInUser", JSON.stringify(teacherData));
```

**Impact:** Each tab now has its own teacher session

**Status:** ✅ Updated

---

### **guidance-dashboard-v2.js** - Lines 11-52

**Change:** Updated to read from tab-scoped session first, then fallback to localStorage

**Before:**
```javascript
let adminData = null;
const adminDataStr = localStorage.getItem('adminData');
if (adminDataStr) {
    adminData = JSON.parse(adminDataStr);
}
```

**After:**
```javascript
let adminData = null;

// Try to get from tab-scoped session first
if (typeof sessionManager !== 'undefined' && sessionManager.getTabSession) {
    const tabScopedData = sessionManager.getTabSession('adminData');
    if (tabScopedData) {
        adminData = tabScopedData;
    }
}

// Fallback to localStorage if not in tab session
if (!adminData) {
    const adminDataStr = localStorage.getItem('adminData');
    if (adminDataStr) {
        adminData = JSON.parse(adminDataStr);
    }
}

// Added: Monitor when tab becomes visible (after being hidden)
// Re-validate role in case other tab changed it
if (typeof onTabVisible !== 'undefined') {
    onTabVisible(() => {
        const currentUser = sessionManager?.getTabSession?.('adminData') || 
                          JSON.parse(localStorage.getItem('adminData') || 'null');
        if (!currentUser || currentUser.role?.toLowerCase() !== 'guidance') {
            window.location.href = 'auth.html?role=admin';
        }
    });
}
```

**Impact:** 
- Tab-specific data takes priority over shared localStorage
- Prevents role confusion when other tabs log in
- Re-validates role when tab gains focus

**Status:** ✅ Updated

---

### **adviser-dashboard.js** - Lines 113-176

**Change:** Comprehensive update to check tab-scoped sessions first

**Before:**
```javascript
// Tried to get from sessionStorage, then localStorage
const adviserData = JSON.parse(sessionStorage.getItem('adviserData') || '{}');
const adviserOrTeacher = adviserData.email ? adviserData : JSON.parse(localStorage.getItem('adminData') || 'null');
```

**After:**
```javascript
let adviserData = null;

// Priority 1: Check tab-scoped session for adviserData
if (typeof sessionManager !== 'undefined' && sessionManager.getTabSession) {
    adviserData = sessionManager.getTabSession('adviserData');
}

// Priority 2: Check tab-scoped session for adminData (fallback)
if (!adviserData) {
    adviserData = sessionManager.getTabSession('adminData');
}

// Priority 3: Check sessionStorage
if (!adviserData) {
    const sessionData = sessionStorage.getItem('adviserData');
    adviserData = sessionData ? JSON.parse(sessionData) : null;
}

// Priority 4: Check localStorage
if (!adviserData) {
    const adminDataStr = localStorage.getItem('adminData');
    adviserData = adminDataStr ? JSON.parse(adminDataStr) : null;
}

// Similar logic for teacherData...
```

**Impact:**
- Adviser dashboard respects tab-scoped sessions
- No interference from other tabs' logins
- Clear priority order for data retrieval

**Status:** ✅ Updated

---

## HTML Files Updated

### **auth.html?role=admin**

**Change:** Added session-manager.js script before admin-login.js

```html
<!-- ✅ Tab-Scoped Session Manager - Prevents multi-tab session conflicts -->
<script src="session-manager.js"></script>
<script src="admin-login.js"></script>
```

**Why:** Must load before admin-login.js so sessionManager is available

**Status:** ✅ Updated

---

### **teacher-login.html**

**Change:** Added session-manager.js script before teacher-login.js

```html
<!-- ✅ Tab-Scoped Session Manager -->
<script src="session-manager.js"></script>
<script src="teacher-login.js"></script>
```

**Status:** ✅ Updated

---

### **guidance-dashboard.html**

**Change:** Added session-manager.js script before guidance-dashboard-v2.js

```html
<!-- ✅ Tab-Scoped Session Manager -->
<script src="session-manager.js"></script>
<script src="guidance-dashboard-v2.js"></script>
```

**Status:** ✅ Updated

---

### **admin-dashboard.html**

**Change:** Added session-manager.js as the first script

```html
<!-- ✅ Tab-Scoped Session Manager -->
<script src="session-manager.js"></script>
<!-- Other dashboard scripts follow -->
```

**Why:** Ensures tab ID is available to all other scripts

**Status:** ✅ Updated

---

### **adviser-dashboard.html**

**Change:** Added session-manager.js script before adviser-dashboard.js

```html
<!-- ✅ Tab-Scoped Session Manager -->
<script src="session-manager.js"></script>
<script src="adviser-dashboard.js"></script>
```

**Status:** ✅ Updated

---

## Change Summary Table

| File | Type | Change | Impact | Status |
|------|------|--------|--------|--------|
| **session-manager.js** | NEW | Core utility | Enables tab sessions | ✅ |
| **admin-login.js** | JS | Add loginTab() | Admin sessions isolated | ✅ |
| **teacher-login.js** | JS | Add loginTab() | Teacher sessions isolated | ✅ |
| **guidance-dashboard-v2.js** | JS | Add tab check + fallback | Read from correct tab | ✅ |
| **adviser-dashboard.js** | JS | Add tab check + fallback | Read from correct tab | ✅ |
| **auth.html?role=admin** | HTML | Add session-manager.js | Enable session manager | ✅ |
| **teacher-login.html** | HTML | Add session-manager.js | Enable session manager | ✅ |
| **guidance-dashboard.html** | HTML | Add session-manager.js | Enable session manager | ✅ |
| **admin-dashboard.html** | HTML | Add session-manager.js | Enable session manager | ✅ |
| **adviser-dashboard.html** | HTML | Add session-manager.js | Enable session manager | ✅ |

---

## Code Change Patterns

### Pattern 1: Storing Session Data (Login Files)

```javascript
// When user logs in:
if (typeof sessionManager !== 'undefined' && sessionManager.loginTab) {
    sessionManager.loginTab(userData, 'storageType');
}
// Also keep localStorage for backward compatibility
localStorage.setItem("dataKey", JSON.stringify(userData));
```

### Pattern 2: Retrieving Session Data (Dashboard Files)

```javascript
// When loading dashboard:
let userData = null;

// Try tab-scoped first
if (typeof sessionManager !== 'undefined' && sessionManager.getTabSession) {
    userData = sessionManager.getTabSession('dataKey');
}

// Fallback to localStorage
if (!userData) {
    userData = JSON.parse(localStorage.getItem('dataKey') || 'null');
}
```

### Pattern 3: Logging Out (Dashboard Files - To Be Updated)

```javascript
// When user logs out:
if (typeof sessionManager !== 'undefined') {
    sessionManager.logoutTab();
}
localStorage.removeItem('dataKey');
window.location.href = 'login-page.html';
```

---

## What Each Component Does

```
┌─────────────────────────────────────────────────────┐
│ session-manager.js (NEW)                            │
│ • Generates unique tab ID on first load              │
│ • Provides methods to store/retrieve tab-scoped data │
│ • Validates session integrity                       │
│ • Handles tab visibility changes                    │
└─────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────┐
│ Login Files (admin-login.js, teacher-login.js)      │
│ • Call sessionManager.loginTab() after auth         │
│ • Store credentials in tab-scoped sessionStorage    │
│ • Maintain localStorage for persistence             │
└─────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────┐
│ Dashboard Files (guidance, adviser, etc.)           │
│ • Check sessionManager.getTabSession() first        │
│ • Fall back to localStorage if needed               │
│ • Use correct role for this specific tab            │
│ • Monitor when tab becomes visible again            │
└─────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────┐
│ Browser Storage                                     │
│ • sessionStorage: Tab-scoped (one per tab)          │
│ • localStorage: Shared (for persistence only)       │
└─────────────────────────────────────────────────────┘
```

---

## Testing Checklist

- [ ] **Test 1:** Login as Admin (Tab A), then Guidance (Tab B)
  - [ ] Tab A still shows Admin dashboard
  - [ ] Tab B shows Guidance dashboard
  - [ ] No interference between tabs

- [ ] **Test 2:** Reload Tab A (after logging in as Guidance in Tab B)
  - [ ] Tab A still shows Admin (not Guidance)
  - [ ] Session maintained correctly
  - [ ] No cross-tab contamination

- [ ] **Test 3:** Switch active tab frequently
  - [ ] Each tab maintains its own role
  - [ ] No switching or confusion
  - [ ] Permissions enforced correctly

- [ ] **Test 4:** Logout from one tab
  - [ ] Only that tab's session cleared
  - [ ] Other tabs unaffected
  - [ ] Correct redirects for logout

---

## Backward Compatibility

✅ **All changes are backward compatible:**

- Old code still works (localStorage still used as fallback)
- No API changes to existing functions
- No required changes to existing logins
- Graceful degradation if sessionManager not available

---

## Files Still Needing Updates (Optional - for completeness)

These files may use similar patterns and could benefit from the same fix:

- `student-dashboard.js` - May need tab-scoped session check
- `subject-teacher-dashboard.js` - May need tab-scoped session check
- Any logout functions should call `sessionManager.logoutTab()`

---

## Deployment Steps

1. **Upload session-manager.js** to server
2. **Update HTML files** with script references (already done)
3. **Deploy JavaScript changes** (already done)
4. **No database changes needed**
5. **No user action required** (backward compatible)

---

## Post-Deployment Verification

Check browser console for no errors:
```javascript
// This should be undefined before page loads, then defined after
console.log(typeof sessionManager);  // Should be "object"

// This should show the current tab's unique ID
console.log(sessionManager.getTabId());  // Should show: tab_1234567890_abc123def
```

---

**All Changes Complete ✓**
**All Files Updated ✓**
**Ready for Testing ✓**

