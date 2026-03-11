/**
 * Tab-Scoped Session Manager
 * 
 * Ensures each browser tab maintains its own independent session context
 * without being affected by login/logout events in other tabs.
 * 
 * Problem Solved:
 * - When logging in as Admin in tab A and Guidance in tab B,
 *   reloading tab A no longer switches it to Guidance role
 * - Each tab maintains its own independent session
 * 
 * How It Works:
 * 1. Generates a unique tab ID (stored in sessionStorage)
 * 2. Stores tab-scoped session data in sessionStorage (per-tab)
 * 3. Uses a "session key" that includes the tab ID
 * 4. Ignores localStorage changes from other tabs
 */

class SessionManager {
    constructor() {
        this.tabId = null;
        this.sessionKeyPrefix = 'session_';
        this.init();
    }

    /**
     * Initialize session manager - generate or retrieve tab ID
     */
    init() {
        // Check if this tab already has a session ID
        let tabId = sessionStorage.getItem('_tabId');
        
        if (!tabId) {
            // Generate unique tab ID (timestamp + random)
            tabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            sessionStorage.setItem('_tabId', tabId);
            console.log('[SessionManager] Generated new tab ID:', tabId);
        } else {
            console.log('[SessionManager] Using existing tab ID:', tabId);
        }
        
        this.tabId = tabId;
    }

    /**
     * Generate tab-scoped storage key
     * @param {string} key - Base key name
     * @returns {string} Tab-scoped key
     */
    getScopedKey(key) {
        return `${this.sessionKeyPrefix}${this.tabId}_${key}`;
    }

    /**
     * Store data in tab-scoped sessionStorage
     * @param {string} key - Key name
     * @param {any} value - Value to store (will be JSON stringified)
     */
    setTabSession(key, value) {
        const scopedKey = this.getScopedKey(key);
        const data = typeof value === 'string' ? value : JSON.stringify(value);
        sessionStorage.setItem(scopedKey, data);
        console.log('[SessionManager] Stored tab session:', key, '→', scopedKey);
    }

    /**
     * Retrieve data from tab-scoped sessionStorage
     * @param {string} key - Key name
     * @returns {any} Parsed value or null
     */
    getTabSession(key) {
        const scopedKey = this.getScopedKey(key);
        const data = sessionStorage.getItem(scopedKey);
        
        if (!data) {
            return null;
        }
        
        try {
            return JSON.parse(data);
        } catch (e) {
            return data;
        }
    }

    /**
     * Clear tab-scoped session data
     * @param {string} key - Key name, or null to clear all
     */
    clearTabSession(key = null) {
        if (key) {
            const scopedKey = this.getScopedKey(key);
            sessionStorage.removeItem(scopedKey);
            console.log('[SessionManager] Cleared tab session:', key);
        } else {
            // Clear all tab-scoped keys
            const keys = Object.keys(sessionStorage);
            keys.forEach(k => {
                if (k.startsWith(this.sessionKeyPrefix + this.tabId)) {
                    sessionStorage.removeItem(k);
                }
            });
            console.log('[SessionManager] Cleared all tab sessions');
        }
    }

    /**
     * Safe login: Store session in tab-scoped storage
     * Prevents other tabs from interfering with this tab's session
     * 
     * @param {object} userData - User data to store
     * @param {string} storageType - 'admin', 'teacher', 'student', etc.
     */
    loginTab(userData, storageType = 'admin') {
        // Store in tab-scoped sessionStorage
        this.setTabSession(storageType + 'Data', userData);
        
        // Also store a session marker for validation
        this.setTabSession('sessionUser', {
            id: userData.id,
            email: userData.email,
            type: storageType,
            loginTime: new Date().toISOString()
        });
        
        console.log(`[SessionManager] User logged in (${storageType}) in this tab:`, userData.id);
    }

    /**
     * Safe logout: Clear this tab's session
     * Doesn't affect other tabs
     */
    logoutTab() {
        this.clearTabSession();
        console.log('[SessionManager] User logged out from this tab');
    }

    /**
     * Get current user data (only from this tab's session)
     * @param {string} storageType - 'admin', 'teacher', 'student'
     * @returns {object|null} User data or null if not logged in
     */
    getCurrentUser(storageType = 'admin') {
        return this.getTabSession(storageType + 'Data');
    }

    /**
     * Validate that the current session is still valid
     * Prevents a reload from switching to another tab's role
     * @returns {boolean} True if session is valid and unchanged
     */
    validateSession() {
        const sessionUser = this.getTabSession('sessionUser');
        
        if (!sessionUser) {
            console.warn('[SessionManager] No session marker found - session invalid');
            return false;
        }
        
        // Check if session data is still in tab-scoped storage
        const keysToCheck = ['adminData', 'teacherData', 'studentData'];
        for (let key of keysToCheck) {
            const data = this.getTabSession(key);
            if (data) {
                console.log('[SessionManager] Session valid - found', key);
                return true;
            }
        }
        
        console.warn('[SessionManager] Session data not found - session invalid');
        return false;
    }

    /**
     * Get tab ID (for debugging/logging)
     */
    getTabId() {
        return this.tabId;
    }
}

// Create global instance
const sessionManager = new SessionManager();

/**
 * Helper: Get user data considering both tab-scoped AND fallback to localStorage
 * Use this when you need to support both old and new session management
 * 
 * @param {string} storageType - 'admin', 'teacher', 'student'
 * @returns {object} User data from either tab-scoped or fallback storage
 */
function getUser(storageType = 'admin') {
    const storageKey = storageType + 'Data';
    
    // First, try tab-scoped session
    let user = sessionManager.getTabSession(storageKey);
    if (user) {
        console.log('[SessionManager] Using tab-scoped user data');
        return user;
    }
    
    // Fallback to localStorage (for backward compatibility)
    // Note: This may be from another tab, but at least we're explicit about it
    const fallbackKey = storageType === 'admin' ? 'adminData' : 
                       storageType === 'teacher' ? 'loggedInUser' :
                       storageType === 'student' ? 'studentData' : null;
    
    if (fallbackKey) {
        user = JSON.parse(localStorage.getItem(fallbackKey) || 'null');
        if (user) {
            console.log('[SessionManager] Using localStorage (fallback), be aware other tabs may have same data');
            return user;
        }
    }
    
    return null;
}

/**
 * Helper: Check if current tab's session matches expected role
 * Use this to prevent role switching when reloading
 * 
 * @param {string} expectedRole - 'admin', 'guidance', 'teacher', 'adviser', etc.
 * @returns {boolean} True if user in this tab has the expected role
 */
function validateTabRole(expectedRole) {
    const sessionUser = sessionManager.getTabSession('sessionUser');
    
    if (!sessionUser) {
        console.warn('[SessionManager] No session user found');
        return false;
    }
    
    // Get the user data based on session type
    const user = sessionManager.getTabSession(sessionUser.type + 'Data');
    
    if (!user) {
        console.warn('[SessionManager] User data not found for type:', sessionUser.type);
        return false;
    }
    
    const userRole = (user.role || '').toString().toLowerCase().trim();
    const expectedRoleLower = expectedRole.toLowerCase().trim();
    
    const isValid = userRole === expectedRoleLower;
    console.log(`[SessionManager] Role validation: "${userRole}" vs expected "${expectedRoleLower}" = ${isValid}`);
    
    return isValid;
}

/**
 * Helper: Listen for tab visibility changes
 * Useful for re-validating session when tab becomes active
 */
function onTabVisible(callback) {
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            console.log('[SessionManager] Tab became visible - validating session');
            callback();
        }
    });
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SessionManager, sessionManager, getUser, validateTabRole, onTabVisible };
}

