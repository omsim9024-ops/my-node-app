/**
 * Role Change Detector
 * Monitors teacher's role for changes and redirects to appropriate dashboard
 * Used by both teacher-dashboard.html and adviser-dashboard.html
 */

class RoleChangeDetector {
    constructor(options = {}) {
        this.email = options.email;
        this.currentRole = options.currentRole;
        this.checkInterval = options.checkInterval || 5000; // Check every 5 seconds
        this.onRoleChange = options.onRoleChange || null;
        this.isActive = false;
        this.apiBase = window.location.origin;
        this.lastCheckTime = null;
        this.failureCount = 0;
        this.maxFailures = 3;
    }

    /**
     * Start monitoring for role changes
     */
    start() {
        if (this.isActive) {
            console.warn('[RoleChangeDetector] Already running');
            return;
        }

        if (!this.email) {
            console.error('[RoleChangeDetector] Email is required to start monitoring');
            return;
        }

        this.isActive = true;
        console.log('[RoleChangeDetector] Started monitoring for role changes...');
        this.checkRoleLoop();
    }

    /**
     * Stop monitoring
     */
    stop() {
        this.isActive = false;
        console.log('[RoleChangeDetector] Stopped monitoring');
    }

    /**
     * Periodic role check loop
     */
    checkRoleLoop() {
        if (!this.isActive) return;

        this.checkRole().then(() => {
            setTimeout(() => this.checkRoleLoop(), this.checkInterval);
        }).catch(error => {
            console.error('[RoleChangeDetector] Check loop error:', error);
            setTimeout(() => this.checkRoleLoop(), this.checkInterval);
        });
    }

    /**
     * Check current role from the server
     */
    async checkRole() {
        try {
            const response = await fetch(`${this.apiBase}/api/teacher-auth/current-role/${encodeURIComponent(this.email)}`);

            if (!response.ok) {
                this.failureCount++;
                if (this.failureCount >= this.maxFailures) {
                    console.warn('[RoleChangeDetector] Multiple check failures, reducing frequency');
                    // Reduce frequency if server is having issues
                }
                return;
            }

            this.failureCount = 0;
            const data = await response.json();

            if (data.success && data.teacher) {
                this.lastCheckTime = Date.now();
                this.handleRoleCheck(data.teacher);
            }
        } catch (error) {
            this.failureCount++;
            console.warn('[RoleChangeDetector] Error checking role:', error.message);
        }
    }

    /**
     * Handle role check result
     */
    handleRoleCheck(teacher) {
        const newRole = teacher.role || null;

        // Check if role changed
        if (newRole !== this.currentRole) {
            console.log(`[RoleChangeDetector] Role changed from "${this.currentRole}" to "${newRole}"`);

            // Update current role
            const oldRole = this.currentRole;
            this.currentRole = newRole;

            // Trigger callback if provided
            if (this.onRoleChange) {
                this.onRoleChange({
                    oldRole,
                    newRole,
                    teacher
                });
            } else {
                // Default behavior: redirect to appropriate dashboard
                this.redirectToDashboard(newRole);
            }
        }
    }

    /**
     * Redirect to appropriate dashboard based on role
     */
    redirectToDashboard(role) {
        const currentPath = window.location.pathname;

        if (role === 'adviser') {
            // Redirect to adviser dashboard
            if (!currentPath.includes('adviser-dashboard')) {
                console.log('[RoleChangeDetector] Redirecting to adviser-dashboard.html');
                window.location.href = 'adviser-dashboard.html';
            }
        } else if (role === 'subject_teacher' || role === 'subject') {
            // Redirect to subject teacher dashboard
            if (!currentPath.includes('subject-teacher-dashboard')) {
                console.log('[RoleChangeDetector] Redirecting to subject-teacher-dashboard.html');
                window.location.href = 'subject-teacher-dashboard.html';
            }
        } else {
            // Redirect to default teacher dashboard
            if (!currentPath.includes('teacher-dashboard')) {
                console.log('[RoleChangeDetector] Redirecting to teacher-dashboard.html');
                window.location.href = 'teacher-dashboard.html';
            }
        }
    }

    /**
     * Get status information
     */
    getStatus() {
        return {
            isActive: this.isActive,
            email: this.email,
            currentRole: this.currentRole,
            lastCheckTime: this.lastCheckTime,
            failureCount: this.failureCount
        };
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RoleChangeDetector;
}

