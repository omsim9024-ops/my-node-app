# Redirect Loop Fix - Code Changes Reference

**Quick lookup for the 3 files that were modified**

---

## 1. admin-dashboard.js - Lines 2815-2849

### BEFORE (⚠️ PROBLEMATIC)
```javascript
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Admin Dashboard] DOMContentLoaded event fired');
    // Run overlay detection to help diagnose blocked UI interactions
    detectBlockingOverlays();
    const adminData = localStorage.getItem('adminData');  // ❌ WRONG: Only checks shared storage
    if (!adminData) {
        console.warn('[Admin Dashboard] No admin data found, redirecting to login');
        window.location.href = 'auth.html?role=admin';
        return;
    }

    const admin = JSON.parse(adminData);
    document.getElementById('adminName').textContent = admin.name || 'Admin';

    // Role-based access control: Redirect Guidance users to their dashboard
    if (admin.role && admin.role.toLowerCase() === 'guidance') {
        console.log('[Admin Dashboard] 🔄 Redirecting Guidance counselor to Guidance Dashboard:', admin.name);
        window.location.href = 'guidance-dashboard.html';
        return;
    }
```

### AFTER (✅ FIXED)
```javascript
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Admin Dashboard] DOMContentLoaded event fired');
    // Run overlay detection to help diagnose blocked UI interactions
    detectBlockingOverlays();
    
    // ✅ FIX: Check for tab-scoped session FIRST (prevents cross-tab session conflicts)
    let admin = null;
    
    // Priority 1: Check tab-scoped session storage (this tab's session)
    if (typeof sessionManager !== 'undefined' && sessionManager.getTabSession) {
        const tabScopedData = sessionManager.getTabSession('adminData');
        if (tabScopedData) {
            console.log('[Admin Dashboard] ✅ Using tab-scoped session (Tab ID:', sessionManager.getTabId(), ')');
            admin = tabScopedData;
        }
    }
    
    // Priority 2: Fall back to localStorage if no tab-scoped session
    if (!admin) {
        const adminDataStr = localStorage.getItem('adminData');
        if (!adminDataStr) {
            console.warn('[Admin Dashboard] No admin data found, redirecting to login');
            window.location.href = 'auth.html?role=admin';
            return;
        }
        admin = JSON.parse(adminDataStr);
        console.log('[Admin Dashboard] ⚠️ Using localStorage (Note: other tabs may have changed role)');
    }
    
    if (!admin) {
        console.warn('[Admin Dashboard] Failed to load admin data, redirecting to login');
        window.location.href = 'auth.html?role=admin';
        return;
    }
    
    document.getElementById('adminName').textContent = admin.name || 'Admin';

    // Role-based access control: Redirect Guidance users to their dashboard
    // ONLY if this tab's session shows guidance role
    if (admin.role && admin.role.toLowerCase() === 'guidance') {
        console.log('[Admin Dashboard] 🔄 Redirecting Guidance counselor to Guidance Dashboard:', admin.name);
        window.location.href = 'guidance-dashboard.html';
        return;
    }
```

**Key Changes:**
- ✅ Check `sessionManager.getTabSession()` FIRST
- ✅ Fall back to `localStorage` only if needed
- ✅ Add console logs showing which storage is being used
- ✅ Change variable from `const` to `let` so we can assign from different sources

---

## 2. guidance-dashboard.js - Lines 12-40

### BEFORE (⚠️ PROBLEMATIC)
```javascript
// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[Guidance Dashboard] Initializing...');
    
    // Get admin data from localStorage
    const adminDataStr = localStorage.getItem('adminData');  // ❌ WRONG: Only checks shared storage
    if (!adminDataStr) {
        console.error('[Guidance Dashboard] No admin data found - redirecting to login');
        window.location.href = 'auth.html?role=admin';
        return;
    }

    const adminData = JSON.parse(adminDataStr);
    
    // Role-based access control: Only Guidance users can access this dashboard
    if (!adminData.role || adminData.role.toLowerCase() !== 'guidance') {
        console.error('[Guidance Dashboard] ❌ Access denied - user is not a guidance counselor');
        console.log('[Guidance Dashboard] 🔄 Redirecting to Admin Dashboard...');
        window.location.href = 'admin-dashboard.html';
        return;
    }
```

### AFTER (✅ FIXED)
```javascript
// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[Guidance Dashboard] Initializing...');
    
    // ✅ FIX: Check for tab-scoped session FIRST (prevents cross-tab session conflicts)
    let adminData = null;
    
    // Priority 1: Check tab-scoped session storage (this tab's session)
    if (typeof sessionManager !== 'undefined' && sessionManager.getTabSession) {
        const tabScopedData = sessionManager.getTabSession('adminData');
        if (tabScopedData) {
            console.log('[Guidance Dashboard] ✅ Using tab-scoped session (Tab ID:', sessionManager.getTabId(), ')');
            adminData = tabScopedData;
        }
    }
    
    // Priority 2: Fall back to localStorage if no tab-scoped session
    if (!adminData) {
        const adminDataStr = localStorage.getItem('adminData');
        if (!adminDataStr) {
            console.error('[Guidance Dashboard] No admin data found - redirecting to login');
            window.location.href = 'auth.html?role=admin';
            return;
        }
        adminData = JSON.parse(adminDataStr);
        console.log('[Guidance Dashboard] ⚠️ Using localStorage (Note: other tabs may have changed role)');
    }
    
    // Role-based access control: Only Guidance users can access this dashboard
    if (!adminData.role || adminData.role.toLowerCase() !== 'guidance') {
        console.error('[Guidance Dashboard] ❌ Access denied - user is not a guidance counselor');
        console.log('[Guidance Dashboard] 🔄 Redirecting to Admin Dashboard...');
        window.location.href = 'admin-dashboard.html';
        return;
    }
```

**Key Changes:**
- ✅ Check `sessionManager.getTabSession()` FIRST
- ✅ Fall back to `localStorage` only if needed
- ✅ Add console logs showing which storage is being used
- ✅ Change variable from `const` to `let`

---

## 3. guidance-dashboard-v2.js - Lines 72-89

### BEFORE (⚠️ TOO AGGRESSIVE)
```javascript
    // ✅ FIX: Monitor for role changes from other tabs
    if (typeof onTabVisible !== 'undefined') {
        onTabVisible(() => {
            // When tab becomes visible after being hidden, validate role is still correct
            const currentUser = typeof sessionManager !== 'undefined' ? 
                sessionManager.getTabSession('adminData') : 
                JSON.parse(localStorage.getItem('adminData') || 'null');
            
            if (!currentUser || currentUser.role?.toLowerCase() !== 'guidance') {
                console.warn('[Guidance Dashboard v2] Role changed or lost - redirecting');
                window.location.href = 'auth.html?role=admin';  // ❌ Always redirects to login
            }
        });
    }
```

### AFTER (✅ IMPROVED)
```javascript
    // ✅ FIX: Monitor for role changes from other tabs (tab visibility change)
    // Only redirect if role definitively changed to something other than guidance
    if (typeof onTabVisible !== 'undefined') {
        onTabVisible(() => {
            // When tab becomes visible after being hidden, validate role is still correct
            const currentUser = typeof sessionManager !== 'undefined' ? 
                sessionManager.getTabSession('adminData') : 
                JSON.parse(localStorage.getItem('adminData') || 'null');
            
            // Only redirect if role DEFINITELY changed (not just if currentUser is null)
            // A null user at this point would be handled by DOMContentLoaded
            if (currentUser && currentUser.role && currentUser.role.toLowerCase() !== 'guidance') {
                console.warn('[Guidance Dashboard v2] ⚠️ Role changed from guidance to', currentUser.role, '- redirecting');
                // If role changed to admin, go to admin dashboard; otherwise go to login
                if (currentUser.role.toLowerCase() === 'admin') {
                    window.location.href = 'admin-dashboard.html';  // ✅ Go to admin dashboard
                } else {
                    window.location.href = 'auth.html?role=admin';
                }
            }
        });
    }
```

**Key Changes:**
- ✅ Check if `currentUser` exists before redirecting (avoid false positives)
- ✅ Check if `currentUser.role` exists (safer property access)
- ✅ Redirect to `admin-dashboard.html` if role changed to admin (not login)
- ✅ Better logging showing what role it changed to

---

## Verification Checklist

### To verify the fix is applied correctly:

**Admin Dashboard (admin-dashboard.js):**
- [ ] Lines 2815-2849 contain `sessionManager.getTabSession()` check
- [ ] Check includes fallback to `localStorage`
- [ ] Console logs show "Using tab-scoped session" or "Using localStorage"
- [ ] Priority 1 is sessionManager, Priority 2 is localStorage

**Guidance Dashboard (guidance-dashboard.js):**
- [ ] Lines 12-40 contain `sessionManager.getTabSession()` check
- [ ] Check includes fallback to `localStorage`
- [ ] Console logs show "Using tab-scoped session" or "Using localStorage"
- [ ] Same priority order as admin-dashboard.js

**Guidance Dashboard v2 (guidance-dashboard-v2.js):**
- [ ] Lines 72-89 have improved onTabVisible callback
- [ ] Check for `currentUser && currentUser.role` before redirecting
- [ ] Redirect to `admin-dashboard.html` if role is 'admin'
- [ ] Redirect to `auth.html?role=admin` for other roles

---

## Quick Diff Summary

| File | Change Type | Lines | Purpose |
|------|------------|-------|---------|
| admin-dashboard.js | Update | 2815-2849 | Check tab-scoped sessions first |
| guidance-dashboard.js | Update | 12-40 | Check tab-scoped sessions first |
| guidance-dashboard-v2.js | Update | 72-89 | Improve tab visibility callback |

**Total lines changed:** ~50 lines across 3 files

**Breaking changes:** None (backward compatible)

**Database changes:** None

---

## Testing These Changes

### To test the fix works:

1. **Verify script loads:** Open DevTools console and check:
   ```javascript
   typeof sessionManager  // Should be "object"
   sessionManager.getTabId()  // Should return unique ID
   ```

2. **Verify session reading:** Check console for messages like:
   ```javascript
   "[Admin Dashboard] ✅ Using tab-scoped session (Tab ID: tab_...)"
   ```

3. **Verify no loops:** Follow test steps in REDIRECT_LOOP_FIX_TESTING.md

---

## Rollback Instructions

If you need to revert these changes:

```bash
# Using git
git diff admin-dashboard.js
git diff guidance-dashboard.js  
git diff guidance-dashboard-v2.js

# If reverting needed
git checkout admin-dashboard.js guidance-dashboard.js guidance-dashboard-v2.js
```

Or manually revert lines:
1. **admin-dashboard.js**: Lines 2815-2849 → revert to original localStorage-only code
2. **guidance-dashboard.js**: Lines 12-40 → revert to original localStorage-only code
3. **guidance-dashboard-v2.js**: Lines 72-89 → revert to original onTabVisible code

---

## Code Style Verification

All changes follow existing code style:
- ✅ 4-space indentation
- ✅ JavaScript/ES6 syntax
- ✅ console.log() for debugging
- ✅ Comments explaining changes
- ✅ Defensive `typeof` checks for sessionManager
- ✅ Fallback chains for data retrieval

---

**All changes are minimal, focused, and backward compatible.**  
**Ready for deployment after testing passes. ✓**

