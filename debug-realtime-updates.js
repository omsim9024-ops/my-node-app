// Real-Time Update Debugging Module
// Add this to admin-dashboard.js or run in console to diagnose issues

const DebugRealtimeUpdates = {
    // Track all events that flow through the system
    eventLog: [],
    maxLogSize: 100,
    
    // Initialize debugging
    init() {
        this.logEvent('SYSTEM', 'Debugging system initialized');
        this.setupInterception();
        this.setupWindowMonitoring();
    },
    
    // Log event for debugging
    logEvent(type, message, data = null) {
        const entry = {
            timestamp: new Date().toISOString(),
            type,
            message,
            data
        };
        this.eventLog.push(entry);
        
        // Keep log size manageable
        if (this.eventLog.length > this.maxLogSize) {
            this.eventLog.shift();
        }
        
        console.log(`[DEBUG ${type}] ${message}`, data || '');
    },
    
    // Intercept DashboardEvents broadcast to monitor
    setupInterception() {
        if (!window.DashboardEvents) {
            console.warn('[DEBUG] DashboardEvents not available yet');
            setTimeout(() => this.setupInterception(), 100);
            return;
        }
        
        const originalBroadcast = window.DashboardEvents.broadcast;
        const self = this;
        
        window.DashboardEvents.broadcast = function(eventType, data) {
            self.logEvent('BROADCAST', `Broadcasting: ${eventType}`, data);
            return originalBroadcast.call(this, eventType, data);
        };
        
        const originalEmit = window.DashboardEvents.emit;
        window.DashboardEvents.emit = function(eventType, data) {
            self.logEvent('EMIT', `Emitting: ${eventType}`, data);
            return originalEmit.call(this, eventType, data);
        };
        
        this.logEvent('SYSTEM', 'DashboardEvents interception setup complete');
    },
    
    // Monitor for specific events
    setupWindowMonitoring() {
        // Wrap saveEnrollmentDetailWithData if it exists
        if (typeof saveEnrollmentDetailWithData !== 'undefined') {
            const original = window.saveEnrollmentDetailWithData || saveEnrollmentDetailWithData;
            window.saveEnrollmentDetailWithData = function(...args) {
                DebugRealtimeUpdates.logEvent('SAVE', 'saveEnrollmentDetailWithData called', { args });
                return original.apply(this, args);
            };
        }
    },
    
    // Display status
    status() {
        console.clear();
        console.log("=== REAL-TIME UPDATE DEBUG STATUS ===\n");
        
        // System state
        console.log("SYSTEM STATE:");
        console.log("  DashboardEvents.exists:", typeof window.DashboardEvents !== 'undefined');
        if (window.DashboardEvents) {
            console.log("  DashboardEvents.listeners:", window.DashboardEvents.listeners);
            console.log("  BroadcastChannel available:", window.DashboardEvents.broadcastChannel !== null);
        }
        
        console.log("\nSECTION ASSIGNMENT STATE:");
        if (typeof assignmentState !== 'undefined') {
            console.log("  Current Level:", assignmentState.currentLevel);
            console.log("  All Students:", assignmentState.allStudents?.length || 0);
            console.log("  Filtered Students:", assignmentState.filteredStudents?.length || 0);
            console.log("  Functions exist:");
            console.log("    - loadAllStudents_Fresh:", typeof loadAllStudents_Fresh === 'function');
            console.log("    - applyFilters:", typeof applyFilters === 'function');
            console.log("    - displayStudentList:", typeof displayStudentList === 'function');
        }
        
        console.log("\nRECENT EVENTS (last 20):");
        this.eventLog.slice(-20).forEach(entry => {
            console.log(`  [${entry.timestamp}] ${entry.type}: ${entry.message}`, entry.data || '');
        });
        
        console.log("\nNEXT STEPS:");
        console.log("1. Edit a student and change their track/electives");
        console.log("2. Click Approve");
        console.log("3. Run: DebugRealtimeUpdates.status() again");
        console.log("4. Look for broadcast events in the list");
    },
    
    // Get full event log
    getLog() {
        return this.eventLog;
    },
    
    // Export log as JSON for analysis
    exportLog() {
        return JSON.stringify(this.eventLog, null, 2);
    },
    
    // Clear log
    clearLog() {
        this.eventLog = [];
        this.logEvent('SYSTEM', 'Event log cleared');
    }
};

// Initialize on startup
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        DebugRealtimeUpdates.init();
        console.log('DebugRealtimeUpdates initialized. Use DebugRealtimeUpdates.status() to check status.');
    });
} else {
    setTimeout(() => {
        DebugRealtimeUpdates.init();
        console.log('DebugRealtimeUpdates initialized. Use DebugRealtimeUpdates.status() to check status.');
    }, 100);
}

// Export to window
window.DebugRealtimeUpdates = DebugRealtimeUpdates;


