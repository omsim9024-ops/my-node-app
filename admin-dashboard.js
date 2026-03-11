// Enable IP stat card and IP Group table click to show students
document.addEventListener('DOMContentLoaded', function() {
    // Stat cards for each report tab
    // Demographics
    document.querySelectorAll('#report-demographics .stat-item.clickable').forEach(function(card) {
        card.replaceWith(card.cloneNode(true));
    });
    // Disability
    document.querySelectorAll('#report-disability .stat-item.clickable').forEach(function(card) {
        card.replaceWith(card.cloneNode(true));
    });
    // Indigenous
    document.querySelectorAll('#report-indigenous .stat-item.clickable').forEach(function(card) {
        card.replaceWith(card.cloneNode(true));
    });
    // 4Ps
    document.querySelectorAll('#report-4ps .stat-item.clickable').forEach(function(card) {
        card.replaceWith(card.cloneNode(true));
    });
    // Mother Tongue
    document.querySelectorAll('#report-mothertongue .stat-item.clickable').forEach(function(card) {
        card.replaceWith(card.cloneNode(true));
    });
    // Track
    document.querySelectorAll('#report-track .stat-item.clickable').forEach(function(card) {
        card.replaceWith(card.cloneNode(true));
    });
    // Electives
    document.querySelectorAll('#report-electives .stat-item.clickable').forEach(function(card) {
        card.replaceWith(card.cloneNode(true));
    });
    // IP Group table
    const ipTable = document.querySelector('.ip-group-table');
    if (ipTable) {
        ipTable.addEventListener('click', function(e) {
            let target = e.target;
            // Only allow clicks on IP group cells
            if (target.tagName === 'TD' && target.cellIndex === 0) {
                const ipGroup = target.textContent.trim();
                window.showStatModal('ip-group', ipGroup);
            }
        });
    }
});
// Enable Disability Type click to show students with section
document.addEventListener('DOMContentLoaded', function() {
    const disabilityTable = document.querySelector('.disability-table');
    if (disabilityTable) {
        disabilityTable.addEventListener('click', function(e) {
            let target = e.target;
            // Only allow clicks on disability type cells
            if (target.tagName === 'TD' && target.cellIndex === 0) {
                const disabilityType = target.textContent.trim();
                window.showStatModal('disability', disabilityType);
            }
        });
    }
});
// Enable grade column click to filter students by grade
document.addEventListener('DOMContentLoaded', function() {
    const genderTableBody = document.getElementById('genderTableBody');
    if (genderTableBody) {
        genderTableBody.addEventListener('click', function(e) {
            let target = e.target;
            // Find the row
            while (target && target.tagName !== 'TR') {
                target = target.parentElement;
            }
            if (!target || target.classList.contains('no-data')) return;
            // Get grade from first cell
            const gradeCell = target.querySelector('td');
            if (!gradeCell) return;
            const gradeText = gradeCell.textContent.trim();
            // Only allow clicks on valid grade rows
            if (/^Grade \d+$/.test(gradeText)) {
                window.showStatModal('grade', gradeText);
            }
        });
    }
});
// Admin Dashboard API Base
// Ensure enrollments are fetched and rendered on page load
// document.addEventListener('DOMContentLoaded', function() {
//     if (typeof window.showStatModal === 'function') {
//         window.showStatModal('all', 'All Students');
//     }
// });
// Dynamically use the current origin (hostname:port) where the page is served
if (typeof BACKEND_ORIGIN === 'undefined') {
    var BACKEND_ORIGIN = window.location.origin;
}
// If your backend is running on a different host/port, set FORCED_API_BASE
// to that full origin (e.g. 'http://192.168.110.12:3000').
// Set to empty string ('') to disable forcing and use automatic discovery.
// Server is configured to run on port 3000 by default.
// Update this to match the server port if it changes.
const FORCED_API_BASE = (typeof window !== 'undefined' && window.__FORCED_API_BASE__) ? window.__FORCED_API_BASE__ : '';
if (typeof API_BASE === 'undefined') {
    var API_BASE = (typeof FORCED_API_BASE !== 'undefined' && FORCED_API_BASE !== null && FORCED_API_BASE !== '') ? FORCED_API_BASE : BACKEND_ORIGIN;
} else {
    // Update existing API_BASE if FORCED_API_BASE is set
    if (typeof FORCED_API_BASE !== 'undefined' && FORCED_API_BASE !== null && FORCED_API_BASE !== '') {
        API_BASE = FORCED_API_BASE;
    }
}

let activeSchoolCode = '';

function detectSchoolCode() {
    // ensure ?school= parameter exists in the URL (fall back to default-school)
    try {
        const existing = new URLSearchParams(window.location.search || '');
        let existingSchool = String(existing.get('school') || '').trim().toLowerCase();
        if (/^\d+$/.test(existingSchool)) { existingSchool = ''; existing.delete('school'); }
        if (!existingSchool) {
            let derived = existingSchool;
            if (!derived) {
                derived = String(localStorage.getItem('sms.selectedSchoolCode') || localStorage.getItem('sms.selectedTenantCode') || '').trim().toLowerCase();
            }
            if (!derived) {
                const h = String(window.location.hostname || '').trim().toLowerCase();
                const localHosts = new Set(['localhost','127.0.0.1','::1']);
                if (!localHosts.has(h)) {
                    const parts = h.split('.').filter(Boolean);
                    if (parts.length >= 3) derived = String(parts[0] || '').toLowerCase();
                }
            }
            if (!derived) derived = 'default-school';
            existing.set('school', derived);
            const newUrl = `${window.location.pathname}?${existing.toString()}${window.location.hash || ''}`;
            window.history.replaceState(null, '', newUrl);
        }
    } catch (_){ }

    const params = new URLSearchParams(window.location.search || '');
    const fromQuery = (params.get('school') || params.get('tenant') || params.get('code') || '').trim().toLowerCase();
    if (fromQuery) return fromQuery;

    const fromStorage = String(
        localStorage.getItem('sms.selectedSchoolCode') || localStorage.getItem('sms.selectedTenantCode') || ''
    ).trim().toLowerCase();
    if (fromStorage) return fromStorage;

    const host = String(window.location.hostname || '').trim().toLowerCase();
    const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
    if (localHosts.has(host)) return '';

    const parts = host.split('.').filter(Boolean);
    if (parts.length >= 3) return String(parts[0] || '').toLowerCase();
    return '';
}

try {
    activeSchoolCode = detectSchoolCode();
} catch (_) {
    activeSchoolCode = '';
}

function withSchoolParam(path) {
    let code = activeSchoolCode || detectSchoolCode();
    if (!code) return path;
    try {
        const url = new URL(path, window.location.origin);
        url.searchParams.set('school', code);
        return `${url.pathname}${url.search}${url.hash || ''}`;
    } catch (_err) {
        return path;
    }
}

function applySchoolTheme(branding) {
    const theme = branding && typeof branding === 'object' ? branding : {};
    const root = document.documentElement;
    const primary = String(theme.primary || theme.brand700 || '').trim();
    const secondary = String(theme.secondary || theme.brand600 || '').trim();
    if (primary) root.style.setProperty('--primary-green', primary);
    if (secondary) root.style.setProperty('--primary-dark-green', secondary);
}

async function bootstrapSchoolBranding() {
    const detected = detectSchoolCode();
    const endpoint = detected
        ? `/api/system-health/schools/resolve?code=${encodeURIComponent(detected)}`
        : '/api/system-health/schools/resolve';

    try {
        const res = await fetch(endpoint);
        if (!res.ok) return;
        const payload = await res.json();
        if (!payload || !payload.success || !payload.school) return;

        const school = payload.school;
        if (detected !== 'default-school') {
            activeSchoolCode = String(school.code || detected || '').trim().toLowerCase();
            if (activeSchoolCode) {
                localStorage.setItem('sms.selectedSchoolCode', activeSchoolCode);
                localStorage.setItem('sms.selectedTenantCode', activeSchoolCode);
            }
        } else {
            activeSchoolCode = detected;
        }
        if (school.id) {
            localStorage.setItem('sms.selectedSchoolId', String(school.id));
            localStorage.setItem('sms.selectedTenantId', String(school.id));
        }

        const schoolName = String(school.name || 'School Management System');
        const logo = String(school.logoData || '').trim();

        document.title = `${schoolName} - Admin Dashboard`;

        const schoolNameNode = document.getElementById('schoolName');
        if (schoolNameNode) schoolNameNode.textContent = schoolName;

        const logoNode = document.getElementById('schoolLogo');
        if (logoNode && logo) logoNode.setAttribute('src', logo);

        const favicon = document.getElementById('schoolFavicon');
        if (favicon && logo) favicon.setAttribute('href', logo);

        applySchoolTheme(school.branding || {});
    } catch (_err) {}
}

// SHS Subject Definitions - Core, Academic Electives, and TechPro Electives
window.SHS_CORE_SUBJECTS = [
    'Effective Communication / Mabisang Komunikasyon',
    'Life Skills',
    'Pag-aaral ng Kasaysayan at Lipunang Pilipino',
    'General Mathematics',
    'General Science'
];

window.SHS_ACADEMIC_ELECTIVES = {
    'Arts, Social Sciences, & Humanities': [
        'Citizenship and Civic Engagement',
        'Creative Industries (Visual, Media, Applied, and Traditional Art)',
        'Creative Industries (Music, Dance, Theater)',
        'Creative Writing',
        'Cultivating Filipino Identity Through the Arts',
        'Filipino sa Isports',
        'Filipino sa Sining at Disenyo',
        'Filipino sa Teknikal-Propesyonal',
        'Introduction to the Philosophy of the Human Person',
        'Leadership and Management in the Arts',
        'Malikhaing Pagsulat',
        'Philippine Politics and Governance',
        'The Social Sciences in Theory and Practice',
        'Wika at Komunikasyon sa Akademikong Filipino'
    ],
    'Business & Entrepreneurship': [
        'Basic Accounting',
        'Business Finance and Income Taxation',
        'Contemporary Marketing and Business Economics',
        'Entrepreneurship',
        'Introduction to Organization and Management'
    ],
    'Sports, Health, & Wellness': [
        'Exercise and Sports Programming',
        'Introduction to Human Movement',
        'Physical Education (Fitness and Recreation)',
        'Physical Education (Sports and Dance)',
        'Safety and First Aid',
        'Sports Coaching',
        'Sports Officiating',
        'Sports Activity Management'
    ],
    'Science, Technology, Engineering, & Mathematics': [
        'Advanced Mathematics 1-2',
        'Biology 1-2',
        'Biology 3-4',
        'Chemistry 1-2',
        'Chemistry 3-4',
        'Database Management',
        'Earth and Space Science 1-2',
        'Earth and Space Science 3-4',
        'Empowerment Technologies',
        'Finite Mathematics',
        'Fundamentals of Data Analytics and Management'
    ],
};


// Display Student Modal (fixed: filter as parameter)
function displayStudentModal(students, title, filter) {
    // Add summary for elective filters
    let summaryHtml = '';
    let maleCount = 0, femaleCount = 0;
    if (Array.isArray(students)) {
        maleCount = students.filter(s => s.gender === 'male').length;
        femaleCount = students.filter(s => s.gender === 'female').length;
    }
    if (filter && filter.startsWith('elective-single-')) {
        summaryHtml = `
            <div class="enrollment-summary" style="margin-bottom: 20px; padding: 15px; background-color: #f5f5f5; border-radius: 6px; border-left: 4px solid #1e5631;">
                <div style="display: flex; gap: 30px; align-items: center;">
                    <div>
                        <div style="font-size: 12px; color: #666; margin-bottom: 5px;">Male</div>
                        <div style="font-size: 22px; font-weight: 700; color: #1e5631;">${maleCount}</div>
                    </div>
                    <div>
                        <div style="font-size: 12px; color: #666; margin-bottom: 5px;">Female</div>
                        <div style="font-size: 22px; font-weight: 700; color: #1e5631;">${femaleCount}</div>
                    </div>
                    <div>
                        <div style="font-size: 12px; color: #666; margin-bottom: 5px;">Total Students</div>
                        <div style="font-size: 22px; font-weight: 700; color: #1e5631;">${students.length}</div>
                    </div>
                </div>
            </div>
        `;
    }
    let html = `
        ${summaryHtml}
        <div class="student-list-container">
            <table class="report-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Grade Level</th>
                        <th>Gender</th>
                        <th>Section</th>
                    </tr>
                </thead>
                <tbody>
    `;
    // Map section_id to section name using all available section caches
    const allSectionSources = [
        ...(Array.isArray(window._sectionsCache) ? window._sectionsCache : []),
        ...(Array.isArray(window.allSections) ? window.allSections : []),
        ...(Array.isArray(window.allSectionsForAdvisory) ? window.allSectionsForAdvisory : [])
    ];
    const sectionMap = Object.fromEntries(
        allSectionSources.map(sec => [String(sec.id || sec.section_id || ''), sec.section_name || sec.name || '']).filter(([k, v]) => k && v)
    );

    // Build quick enrollment lookup for extra fallback when section isn't present in student object
    const enrollmentByStudentKey = new Map();
    if (Array.isArray(window.allEnrollments)) {
        window.allEnrollments.forEach(enrollment => {
            let data = enrollment.enrollment_data || {};
            if (typeof data === 'string') {
                try { data = JSON.parse(data); } catch (e) { data = {}; }
            }
            const sid = enrollment.student_id || data.studentID || data.studentId || '';
            const lrn = data.lrn || data.LRN || enrollment.lrn || enrollment.student_lrn || '';
            const nameKey = `${String(data.firstName || data.firstname || '').trim().toLowerCase()}|${String(data.lastName || data.lastname || '').trim().toLowerCase()}`;
            if (sid) enrollmentByStudentKey.set(`sid:${sid}`, enrollment);
            if (lrn) enrollmentByStudentKey.set(`lrn:${lrn}`, enrollment);
            if (nameKey !== '|') enrollmentByStudentKey.set(`name:${nameKey}`, enrollment);
        });
    }
    
    if (students.length === 0) {
        html += `<tr><td colspan="4" class="no-data">No students found for this category.</td></tr>`;
    } else {
        // Remove duplicate students by unique id or name
        const seen = new Set();
        students.forEach((student, idx) => {
            const uniqueKey = student.id || `${student.first_name || student.firstName || ''} ${student.last_name || student.lastName || ''}`;
            if (seen.has(uniqueKey)) return;
            seen.add(uniqueKey);
            const fullName = `${student.first_name || student.firstName || ''} ${student.last_name || student.lastName || ''}`.trim() || '--';
            const grade = student.grade_level || student.grade ? (`Grade ${student.grade_level || student.grade}`) : '--';
            const gender = student.gender ? student.gender.charAt(0).toUpperCase() + student.gender.slice(1).toLowerCase() : '--';
            
            // Try multiple approaches to get section name
            let section = '--';
            
            // First, check if student already has section field populated (and it's not just a placeholder)
            if (student.section && student.section !== '--' && student.section.trim().length > 0) {
                section = student.section;
            }
            // Then try mapping section_id using sectionMap
            else if ((student.section_id || student.sectionId) && sectionMap[String(student.section_id || student.sectionId)]) {
                section = sectionMap[String(student.section_id || student.sectionId)];
            }
            // Then, try to locate matching enrollment record and resolve assigned section
            else {
                const nameKey = `${String(student.first_name || student.firstName || '').trim().toLowerCase()}|${String(student.last_name || student.lastName || '').trim().toLowerCase()}`;
                const enrollmentMatch =
                    enrollmentByStudentKey.get(`sid:${student.id || ''}`) ||
                    enrollmentByStudentKey.get(`lrn:${student.lrn || student.student_lrn || ''}`) ||
                    enrollmentByStudentKey.get(`name:${nameKey}`);

                if (enrollmentMatch) {
                    let data = enrollmentMatch.enrollment_data || {};
                    if (typeof data === 'string') {
                        try { data = JSON.parse(data); } catch (e) { data = {}; }
                    }

                    const enrollmentSectionId = enrollmentMatch.section_id || data.section_id || data.sectionId;
                    if (enrollmentSectionId && sectionMap[String(enrollmentSectionId)]) {
                        section = sectionMap[String(enrollmentSectionId)];
                    } else if (enrollmentMatch.section_name) {
                        section = enrollmentMatch.section_name;
                    } else if (data.section || data.sectionSelected || data.selectedSection || data.section_name) {
                        section = data.section || data.sectionSelected || data.selectedSection || data.section_name;
                    }
                }
            }

            // Finally, try to find it in student.enrollment_data if section is still unresolved
            if ((section === '--' || !section) && student.enrollment_data) {
                let data = student.enrollment_data;
                if (typeof data === 'string') {
                    try { data = JSON.parse(data); } catch (err) { }
                }
                if (data && typeof data === 'object') {
                    const dataSectionId = data.section_id || data.sectionId;
                    section = data.section || data.sectionSelected || data.selectedSection || data.section_name || (dataSectionId ? sectionMap[String(dataSectionId)] : '') || '--';
                }
            }
            
            html += `
                <tr>
                    <td><strong>${fullName}</strong></td>
                    <td>${grade}</td>
                    <td>${gender}</td>
                    <td>${section}</td>
                </tr>
            `;
        });
    }
    html += `
                </tbody>
            </table>
        </div>
    `;
    // Modal elements
    const modal = document.getElementById('statModalContainer');
    const modalBody = document.getElementById('statModalBody');
    const modalTitle = document.getElementById('statModalTitle');
    if (modal && modalBody) {
        modalBody.innerHTML = html;
        if (modalTitle) {
            modalTitle.textContent = title || 'Student List';
        }
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        console.log('✅ Modal displayed with students');
    } else {
        console.error('Modal or modal body not found!');
    }
}
            
 

// ===== REAL-TIME EVENT SYSTEM FOR DASHBOARD UPDATES =====
// This system enables real-time communication between modules without page reloads
// Uses BroadcastChannel API (for same-origin tabs) + localStorage fallback

window.DashboardEvents = {
    listeners: {},
    broadcastChannel: null,
    
    // Initialize the event system
    init() {
        console.log('[DashboardEvents] Initializing real-time event system...');
        
        // Try to use BroadcastChannel for better performance (cross-tab communication)
        try {
            if (typeof BroadcastChannel !== 'undefined') {
                this.broadcastChannel = new BroadcastChannel('admin_dashboard_events');
                this.broadcastChannel.addEventListener('message', (event) => {
                    const { type, data, source } = event.data;
                    if (source !== 'dashboard') return; // Ignore own messages
                    this.emit(type, data);
                });
                console.log('[DashboardEvents] BroadcastChannel initialized');
            }
        } catch (e) {
            console.warn('[DashboardEvents] BroadcastChannel not available, using localStorage fallback', e.message);
        }
        
        // Setup storage event listener for fallback (works across tabs)
        window.addEventListener('storage', (event) => {
            if (event.key && event.key.startsWith('dashboard_event_')) {
                try {
                    const data = JSON.parse(event.newValue);
                    if (data && data.type) {
                        console.log('[DashboardEvents] Storage event received:', data.type);
                        this.emit(data.type, data.data);
                    }
                } catch (e) {
                    console.warn('[DashboardEvents] Failed to parse storage event', e);
                }
            }
        });
    },
    
    // Subscribe to an event
    on(eventType, callback) {
        if (!this.listeners[eventType]) {
            this.listeners[eventType] = [];
        }
        this.listeners[eventType].push(callback);
        console.log(`[DashboardEvents] Listener registered for "${eventType}"`, { totalListeners: this.listeners[eventType].length });
    },
    
    // Unsubscribe from an event
    off(eventType, callback) {
        if (this.listeners[eventType]) {
            this.listeners[eventType] = this.listeners[eventType].filter(cb => cb !== callback);
        }
    },
    
    // Emit an event (internal - triggers all local listeners)
    emit(eventType, data) {
        console.log(`[DashboardEvents] Emitting event: "${eventType}"`, data);
        if (this.listeners[eventType]) {
            this.listeners[eventType].forEach(callback => {
                try {
                    callback(data);
                } catch (e) {
                    console.error(`[DashboardEvents] Error in listener for "${eventType}":`, e);
                }
            });
        }
    },
    
    // Broadcast an event to all listeners (same page + other tabs)
    broadcast(eventType, data) {
        console.log(`[DashboardEvents] Broadcasting event: "${eventType}"`, data);
        
        // Emit locally first
        this.emit(eventType, data);
        
        // Broadcast to other tabs via BroadcastChannel
        if (this.broadcastChannel) {
            try {
                this.broadcastChannel.postMessage({
                    type: eventType,
                    data: data,
                    source: 'dashboard',
                    timestamp: Date.now()
                });
            } catch (e) {
                console.warn('[DashboardEvents] BroadcastChannel failed, using localStorage fallback', e.message);
                this.broadcastViaStorage(eventType, data);
            }
        } else {
            // Fallback to localStorage
            this.broadcastViaStorage(eventType, data);
        }
    },
    
    // Fallback: Broadcast via localStorage
    broadcastViaStorage(eventType, data) {
        try {
            const timestamp = Date.now();
            localStorage.setItem(`dashboard_event_${eventType}_${timestamp}`, JSON.stringify({
                type: eventType,
                data: data,
                timestamp: timestamp
            }));
            // Clean up old events after 1 second
            setTimeout(() => {
                localStorage.removeItem(`dashboard_event_${eventType}_${timestamp}`);
            }, 1000);
        } catch (e) {
            console.warn('[DashboardEvents] Failed to broadcast via localStorage', e.message);
        }
    },
    
    // Destroy the system
    destroy() {
        if (this.broadcastChannel) {
            this.broadcastChannel.close();
        }
        this.listeners = {};
    }
};

// Initialize the event system
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { window.DashboardEvents.init(); });
} else {
    window.DashboardEvents.init();
}

// ===== REAL-TIME UPDATE UTILITIES =====
// These utilities enable all dashboard features to update in real-time without page reloads

window.DashboardRealtimeUtils = {
    // Update a student in all visible lists/tables
    updateStudentInUI(studentId, updates) {
        console.log('[DashboardRealtimeUtils] Updating student in UI:', studentId, updates);
        
        const selectors = [
            `[data-student-id="${studentId}"]`,
            `[data-id="${studentId}"]`,
            `tr[data-student="${studentId}"]`,
            `.student-row[data-student-id="${studentId}"]`
        ];
        
        let updated = false;
        for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                // Update visible fields
                if (updates.name) {
                    const nameEl = el.querySelector('[data-field="name"]') || el.querySelector('.student-name');
                    if (nameEl) nameEl.textContent = updates.name;
                }
                if (updates.section) {
                    const sectionEl = el.querySelector('[data-field="section"]') || el.querySelector('.student-section');
                    if (sectionEl) sectionEl.textContent = updates.section || '---';
                }
                if (updates.track) {
                    const trackEl = el.querySelector('[data-field="track"]') || el.querySelector('.student-track');
                    if (trackEl) trackEl.textContent = updates.track;
                }
                if (updates.electives) {
                    const electivesEl = el.querySelector('[data-field="electives"]') || el.querySelector('.student-electives');
                    if (electivesEl) electivesEl.textContent = Array.isArray(updates.electives) ? updates.electives.join(', ') : updates.electives;
                }
                
                // Update data attributes
                if (updates.section_id !== undefined) {
                    el.dataset.sectionId = updates.section_id || '';
                }
                
                updated = true;
            });
        }
        
        return updated;
    },
    
    // Remove a student row from all visible tables
    removeStudentFromUI(studentId) {
        console.log('[DashboardRealtimeUtils] Removing student from UI:', studentId);
        
        const selectors = [
            `[data-student-id="${studentId}"]`,
            `[data-id="${studentId}"]`,
            `tr[data-student="${studentId}"]`,
            `.student-row[data-student-id="${studentId}"]`
        ];
        
        let removed = 0;
        for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                // Fade out animation
                el.style.opacity = '0.5';
                el.style.transition = 'opacity 0.3s ease';
                
                setTimeout(() => {
                    el.remove();
                    removed++;
                    console.log('[DashboardRealtimeUtils] Removed element, total:', removed);
                }, 300);
            });
        }
        
        return removed;
    },
    
    // Refresh a specific table/section without full page reload
    refreshTableSection(sectionId) {
        console.log('[DashboardRealtimeUtils] Refreshing table section:', sectionId);
        
        const section = document.getElementById(sectionId);
        if (!section) return false;
        
        // Trigger refresh based on section ID
        if (sectionId.includes('students') && typeof renderStudentTable === 'function') {
            renderStudentTable();
            return true;
        } else if (sectionId.includes('section') && typeof displayStudentList === 'function') {
            displayStudentList();
            return true;
        } else if (sectionId.includes('enrollment') && typeof loadEnrollments === 'function') {
            loadEnrollments(window.currentFilter || 'all');
            return true;
        }
        
        return false;
    },
    
    // Update dashboard statistics in real-time
    updateDashboardStats(stats) {
        console.log('[DashboardRealtimeUtils] Updating dashboard stats:', stats);
        
        const statElements = {
            'totalStudents': '#statsStudents, [data-stat="students"]',
            'enrolledStudents': '#statsEnrolled, [data-stat="enrolled"]',
            'unassignedStudents': '#statsUnassigned, [data-stat="unassigned"]',
            'totalSections': '#statsSections, [data-stat="sections"]'
        };
        
        Object.entries(stats).forEach(([key, value]) => {
            const selector = statElements[key];
            if (selector) {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => {
                    el.textContent = value;
                    // Flash animation
                    el.style.backgroundColor = '#fff3cd';
                    setTimeout(() => {
                        el.style.backgroundColor = 'transparent';
                    }, 300);
                });
            }
        });
    },
    
    // Highlight a newly updated element
    highlightElement(element) {
        if (!element) return;
        element.style.backgroundColor = '#d4edda';
        element.style.transition = 'background-color 0.5s ease';
        
        setTimeout(() => {
            element.style.backgroundColor = 'transparent';
        }, 1000);
    },
    
    // Batch update multiple students
    batchUpdateStudents(updates) {
        let updateCount = 0;
        updates.forEach(update => {
            if (this.updateStudentInUI(update.id, update.changes)) {
                updateCount++;
            }
        });
        
        return updateCount;
    }
};

// Global teacher lists (ensure defined)
if (typeof allTeachers === 'undefined') window.allTeachers = [];
if (typeof filteredTeachers === 'undefined') window.filteredTeachers = [];

// Global school year variables (ensure defined)
if (typeof activeSchoolYearId === 'undefined') window.activeSchoolYearId = null;
if (typeof activeSchoolYearLabel === 'undefined') window.activeSchoolYearLabel = null;

// Fallback loader to avoid timing issues where the main `loadTeachersForAdmin`
// may be defined later in the file. This lightweight version uses `fetch`
// and will populate `allTeachers` so the UI can render without throwing.
async function loadTeachersForAdminFallback() {
    try {
        console.log('[loadTeachersForAdminFallback] Attempting to fetch teachers via /api/teacher-auth/list');
        try {
            const res = await apiFetch('/api/teacher-auth/list');
            if (!res.ok) { console.warn('[loadTeachersForAdminFallback] HTTP', res.status); return; }
            var data = await res.json();
        } catch (err) {
            console.error('[loadTeachersForAdminFallback] apiFetch failed:', err);
            return;
        }
        // Accept multiple shapes
        let teachers = [];
        if (data && Array.isArray(data.teachers) && data.teachers.length > 0) teachers = data.teachers;
        else if (data && Array.isArray(data.rows) && data.rows.length > 0) teachers = data.rows;
        else if (Array.isArray(data) && data.length > 0) teachers = data;
        else teachers = (data && Array.isArray(data.teachers)) ? data.teachers : [];
        window.allTeachers = teachers || [];
        console.log('[loadTeachersForAdminFallback] Loaded', window.allTeachers.length, 'teachers');
        try { if (typeof filterTeachers === 'function') filterTeachers(); } catch (e) { console.warn('[loadTeachersForAdminFallback] filterTeachers missing', e); }
        try { if (typeof renderTeachingAssignmentsTeacherTables === 'function') renderTeachingAssignmentsTeacherTables(); } catch (e) { console.warn('[loadTeachersForAdminFallback] renderTeachingAssignmentsTeacherTables missing', e); }
        // Try to load section and subject assignments if the functions exist
        if (typeof loadSectionAssignmentsForTeachers === 'function') {
            try { await loadSectionAssignmentsForTeachers(); } catch(e){console.warn('[loadTeachersForAdminFallback] loadSectionAssignmentsForTeachers failed', e);}    
        }
        if (typeof loadSubjectAssignmentsForTeachers === 'function') {
            try { await loadSubjectAssignmentsForTeachers(); } catch(e){console.warn('[loadTeachersForAdminFallback] loadSubjectAssignmentsForTeachers failed', e);}    
        }
    } catch (err) {
        console.error('[loadTeachersForAdminFallback] Error fetching teachers:', err);
    }
}

// Expose fallback under the canonical name so early callers won't error.
if (typeof loadTeachersForAdmin === 'undefined') {
    window.loadTeachersForAdmin = loadTeachersForAdminFallback;
}

// Collect subject loads from rows: [{ subject: 'Math', sections: [1,2] }, ...]
    function collectSubjectLoads() {
        const rows = document.querySelectorAll('.subject-load-row');
        const loads = [];
        rows.forEach(row => {
            const subj = row.querySelector('.subject-load-subject');
            const secs = row.querySelector('.subject-load-sections');
            if (!subj || !secs) return;
            const subjectVal = subj.value || '';
            const selectedSecIds = Array.from(secs.selectedOptions || []).map(o => o.value).filter(v => v !== '');
            if (subjectVal && selectedSecIds.length > 0) {
                loads.push({ subject: subjectVal, sections: selectedSecIds.map(id => parseInt(id)) });
            }
        });
        return loads;
    }

    // --- Teaching Assignments UI helpers ---
    function populateTeachingTeacherSelect() {
        const sel = document.getElementById('taTeacherSelect');
        if (!sel) return;
        sel.innerHTML = '';
        sel.appendChild(new Option('-- Select Teacher --', ''));
        (allTeachers || []).forEach(t => {
            const name = t.name || t.teacher_id || t.email || ('Teacher ' + t.id);
            const opt = new Option(`${name} (${t.teacher_id || ''})`, t.id);
            sel.appendChild(opt);
        });
    }

    // Render teacher lists separated into JHS and SHS tables inside Teaching Assignments
    function renderTeachingAssignmentsTeacherTables() {
        try {
            const jhsBody = document.getElementById('taTeachersJHSBody');
            const shsBody = document.getElementById('taTeachersSHSBody');
            if (!jhsBody || !shsBody) return;

            const jhs = [];
            const shs = [];

            const searchTerm = (document.getElementById('taTableSearch')?.value || '').toLowerCase().trim();
            const roleFilter = (document.getElementById('taTableRoleFilter')?.value || '').toLowerCase();

            (allTeachers || []).forEach(teacher => {
                const lvl = detectTeacherLevel(teacher);
                let target = 'jhs';
                if (lvl === 'shs' || lvl === 'senior' || lvl === 'senior_high') {
                    target = 'shs';
                } else if (lvl === 'jhs' || lvl === 'junior' || lvl === 'junior_high') {
                    target = 'jhs';
                } else {
                    // try to infer from assigned sections' grades
                    const assigned = teacher.assigned_sections || [];
                    const grades = assigned.map(s => {
                        // try cache lookup
                        const sec = (window._sectionsCache || []).find(x => String(x.id) === String(s.section_id) || String(x.section_id) === String(s.section_id));
                        const g = sec ? (sec.grade_level || sec.grade || sec.year_level || sec.level) : (s.grade || s.grade_level || null);
                        return normalizeGradeLevel(g);
                    }).filter(Boolean);
                    if (grades.some(g => g >= 11)) target = 'shs';
                    else if (grades.some(g => g >= 7 && g <= 10)) target = 'jhs';
                    else target = 'jhs';
                }

                // Apply table-level filters (search + role)
                let matchesSearch = true;
                if (searchTerm) {
                    const hay = `${teacher.name || ''} ${teacher.email || ''} ${teacher.department || ''} ${teacher.teacher_id || ''}`.toLowerCase();
                    matchesSearch = hay.includes(searchTerm);
                }

                let matchesRole = true;
                if (roleFilter) {
                    if (roleFilter === 'unassigned') matchesRole = !teacher.role;
                    else matchesRole = (teacher.role || '').toLowerCase() === roleFilter;
                }

                if (!(matchesSearch && matchesRole)) return;

                if (target === 'shs') shs.push(teacher); else jhs.push(teacher);
            });

            // helper: ask backend for a section's label and update any chips on the page
            const fetchSectionLabel = async (secId) => {
                try {
                    const base = (typeof API_BASE === 'string' && API_BASE) ? API_BASE : window.location.origin;
                    const resp = await fetch(`${base}/api/sections/${encodeURIComponent(secId)}`);
                    if (!resp.ok) return null;
                    const sec = await resp.json();
                    let label = sec.section_name || sec.section_code || sec.name || `Section ${secId}`;
                    if (!sec.section_name && !sec.section_code && !sec.name) {
                        label += ' (deleted)';
                    }
                    const grade = sec.grade_level || sec.grade || sec.level;
                    if (grade) label = `Grade ${grade} – ${label}`;
                    return label;
                } catch (_){ return null; }
            };

            const rowHtml = (teacher) => {
                const role = teacher.role ? escapeHtml(teacher.role) : '<span style="color:#999;">Not Assigned</span>';
                const sectionsHtml = (teacher.assigned_sections && teacher.assigned_sections.length > 0) ?
                    teacher.assigned_sections.map(s => {
                        const id = s.section_id || s.id || '';
                        let label = s.section_name || s.section_code || '';
                        if (!label && id) label = `Section ${id}`;
                        // schedule async refresh if placeholder
                        if (id && /^Section(\s|$)/.test(label)) {
                            fetchSectionLabel(id).then(newLabel => {
                                if (newLabel) {
                                    document.querySelectorAll(`.ta-section-chip[data-section-id="${id}"]`).forEach(c => { if (c.textContent !== newLabel) c.textContent = newLabel; });
                                }
                            });
                        }
                        return `<span class="ta-section-chip" data-section-id="${escapeHtml(id)}">${escapeHtml(label)}</span>`;
                    }).join('')
                    : '<span style="color:#999;">--</span>';

                    const teachingHtml = (teacher.subject_assignments && teacher.subject_assignments.length > 0) ?
                        teacher.subject_assignments.map(a => {
                            const secId = a.section_id || a.section || '';
                            let secLabel = a.section_name || a.section_code || '';
                            if (!secLabel && secId) secLabel = `Section ${secId}`;
                            if (secId && /^Section(\s|$)/.test(secLabel)) {
                                fetchSectionLabel(secId).then(newLabel => {
                                    if (newLabel) {
                                        document.querySelectorAll(`.ta-assignment-chip[data-section-id="${secId}"]`).forEach(c=>{ if(c.textContent!==newLabel) c.textContent=newLabel; });
                                    }
                                });
                            }
                            return `<div style="font-size:12px;margin-bottom:4px;"><strong style="font-weight:600;">${escapeHtml(a.subject||a.subject_name||a.subjects||'Unknown')}</strong><div style="color:#666;font-size:11px;"><span class=\"ta-assignment-chip\" data-section-id=\"${escapeHtml(secId)}\">${escapeHtml(secLabel)}</span></div></div>`;
                        }).join('')
                        : '<span style="color:#999;">--</span>';

                const actions = [`<button class="btn btn-sm btn-outline-primary" onclick="openSubjectAssignmentModal(${teacher.id})" title="Assign Subjects">Assign Subjects</button>`, `<button class="btn btn-sm btn-primary" onclick="openTeacherAssignmentModal(${teacher.id})" title="Assign Role">Assign Role</button>`];
                if (teacher.role && String(teacher.role).toLowerCase() === 'adviser' && teacher.assigned_sections && teacher.assigned_sections.length > 0) {
                    actions.push(`<button class="btn btn-sm btn-secondary" onclick="openTeacherEditSectionsModal(${teacher.id})">✏ Edit</button>`);
                }

                                return `
                                        <tr>
                                            <td>${escapeHtml(teacher.teacher_id || '')}</td>
                                            <td>${escapeHtml(teacher.name || '')}</td>
                                            <td title="${escapeHtml(teacher.email || '')}">${escapeHtml(teacher.email || '')}</td>
                                            <td>${escapeHtml(teacher.department || '--')}</td>
                                            <td>${role}</td>
                                            <td>${sectionsHtml}</td>
                                            <td>${teachingHtml}</td>
                                            <td style="display:flex;gap:6px;flex-wrap:wrap;">${actions.join('')}</td>
                                        </tr>
                                `;
            };

            jhsBody.innerHTML = jhs.length ? jhs.map(rowHtml).join('') : '<tr><td colspan="8" class="no-data">No teachers found</td></tr>';
            shsBody.innerHTML = shs.length ? shs.map(rowHtml).join('') : '<tr><td colspan="8" class="no-data">No teachers found</td></tr>';

            // update count
            try { document.getElementById('taTableCount').textContent = `${jhs.length + shs.length} teachers`; } catch(e){}
        } catch (err) {
            console.error('[renderTeachingAssignmentsTeacherTables] Error:', err);
        }
    }

    function addTeachingSubjectRow(initial, containerId, subjectOptions, allowedGrades) {
        const container = document.getElementById(containerId || 'taSubjectLoadsContainer');
        if (!container) return null;
        if (container.querySelector('.no-data')) container.innerHTML = '';

        const rowId = genSubjectLoadId();
        const row = document.createElement('div');
        row.className = 'ta-subject-row';
        row.id = rowId;
        row.style.display = 'flex';
        row.style.gap = '8px';
        row.style.alignItems = 'center';
        row.style.marginBottom = '10px';

        const gradeSelect = document.createElement('select');
        gradeSelect.className = 'ta-subject-grade';
        gradeSelect.style.padding = '8px';
        gradeSelect.style.border = '1px solid #ddd';
        gradeSelect.style.borderRadius = '6px';
        gradeSelect.style.minWidth = '140px';
        gradeSelect.appendChild(new Option('-- Grade --', ''));
        const grades = Array.isArray(allowedGrades) && allowedGrades.length ? allowedGrades : ['7','8','9','10','11','12'];
        grades.forEach(g => gradeSelect.appendChild(new Option('Grade ' + g, g)));

        const secSelect = document.createElement('select');
        secSelect.className = 'ta-subject-sections';
        secSelect.style.padding = '8px';
        secSelect.style.border = '1px solid #ddd';
        secSelect.style.borderRadius = '6px';
        secSelect.style.minWidth = '220px';
        secSelect.appendChild(new Option('-- Section --', ''));
        filterSectionsIntoSelect(secSelect, null, (window._allowedGradesForModal || allowedGrades));

        const subjSelect = document.createElement('select');
        subjSelect.className = 'ta-subject-subject';
        subjSelect.style.padding = '8px';
        subjSelect.style.border = '1px solid #ddd';
        subjSelect.style.borderRadius = '6px';
        subjSelect.style.minWidth = '240px';
        subjSelect.appendChild(new Option('-- Select Subject --', ''));
        subjSelect.disabled = true;

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn btn-sm btn-danger';
        removeBtn.textContent = 'Remove';
        removeBtn.onclick = () => { row.remove(); if (!container.children.length) container.innerHTML = '<p class="no-data">No subject rows added. Click "Add Subject Row" to begin.</p>'; };

        const fallbackSubjects = Array.isArray(subjectOptions) && subjectOptions.length
            ? subjectOptions
            : (Array.isArray(window.AVAILABLE_SUBJECTS) ? window.AVAILABLE_SUBJECTS : []);

        const normalizeGradeValue = (value) => {
            if (value === null || value === undefined) return '';
            const str = String(value).trim();
            const match = str.match(/(\d{1,2})/);
            return match ? match[1] : str;
        };

        const resolveSectionById = (sectionId) => {
            const allSections = window.allSectionsForAdvisory || window._sectionsCache || [];
            return allSections.find(section => String(section.id ?? section.section_id ?? section.sectionId) === String(sectionId));
        };

        const populateSubjectsForSelectedSection = async (sectionId, preferredSubject) => {
            subjSelect.innerHTML = '<option value="">-- Select Subject --</option>';
            subjSelect.disabled = true;
            if (!sectionId) return;

            const selectedSection = resolveSectionById(sectionId);
            const sectionGradeRaw = selectedSection
                ? (selectedSection.grade_level || selectedSection.gradeLevel || selectedSection.grade || selectedSection.year_level || selectedSection.level || gradeSelect.value || '')
                : gradeSelect.value;
            const sectionGrade = normalizeGradeValue(sectionGradeRaw);
            const isShsGrade = sectionGrade === '11' || sectionGrade === '12';

            let finalSubjects = [];

            if (isShsGrade) {
                const coreSubjects = [
                    'Effective Communication / Mabisang Komunikasyon',
                    'Life Skills',
                    'Pag-aaral ng Kasaysayan at Lipunang Pilipino',
                    'General Mathematics',
                    'General Science'
                ];

                let sectionElectives = [];
                const electivesRaw = selectedSection ? (selectedSection.electives || selectedSection.elective_subjects || '') : '';
                if (Array.isArray(electivesRaw)) {
                    sectionElectives = electivesRaw.map(value => String(value || '').trim()).filter(Boolean);
                } else if (typeof electivesRaw === 'string' && electivesRaw.trim()) {
                    sectionElectives = electivesRaw
                        .split(',')
                        .map(value => value.trim())
                        .filter(Boolean);
                }

                if (!sectionElectives.length) {
                    try {
                        const res = await apiFetch(`/api/electives/section/${sectionId}`);
                        if (res.ok) {
                            const data = await res.json();
                            if (Array.isArray(data)) {
                                sectionElectives = data.map(e => e.subject_name || e.name || e.subject || '').filter(Boolean);
                            } else if (data && Array.isArray(data.electives)) {
                                sectionElectives = data.electives.map(e => e.subject_name || e.name || e.subject || '').filter(Boolean);
                            }
                        }
                    } catch (e) {
                        console.warn('[addTeachingSubjectRow] Error fetching section electives:', e);
                    }
                }

                finalSubjects = Array.from(new Set([...coreSubjects, ...sectionElectives])).sort();
            } else {
                finalSubjects = Array.from(new Set(fallbackSubjects)).sort();
            }

            if (!finalSubjects.length) {
                subjSelect.appendChild(new Option('-- No subjects available --', ''));
                subjSelect.disabled = true;
                return;
            }

            finalSubjects.forEach(subject => subjSelect.appendChild(new Option(subject, subject)));
            subjSelect.disabled = false;
            if (preferredSubject && finalSubjects.includes(preferredSubject)) {
                subjSelect.value = preferredSubject;
            }
        };

        gradeSelect.addEventListener('change', () => {
            filterSectionsIntoSelect(secSelect, gradeSelect.value, (window._allowedGradesForModal || allowedGrades));
            subjSelect.innerHTML = '<option value="">-- Select Subject --</option>';
            subjSelect.disabled = true;
        });

        secSelect.addEventListener('change', async () => {
            await populateSubjectsForSelectedSection(secSelect.value);
        });

        if (initial && initial.grade) gradeSelect.value = initial.grade;
        filterSectionsIntoSelect(secSelect, gradeSelect.value || null, (window._allowedGradesForModal || allowedGrades));
        if (initial && initial.sections && initial.sections.length > 0) {
            secSelect.value = initial.sections[0];
            populateSubjectsForSelectedSection(initial.sections[0], initial.subject || '');
        }

        row.appendChild(gradeSelect);
        row.appendChild(secSelect);
        row.appendChild(subjSelect);
        row.appendChild(removeBtn);
        container.appendChild(row);
        return row;
    }

    // Populate a sections <select> element. If cache is empty, show loading and fetch sections.
    function populateSectionsSelect(selectEl, gradeFilter, allowedGrades) {
        if (!selectEl) return;
        selectEl.innerHTML = '';
        const sectionsCache = window._sectionsCache || [];
        const grades = Array.isArray(allowedGrades) && allowedGrades.length ? allowedGrades : ['7','8','9','10','11','12'];

        const applyOptions = (sections) => {
            const filtered = (sections || []).filter(s => {
                const g = (s.grade_level || s.grade || s.level || '').toString();
                if (gradeFilter) return (g === gradeFilter) || String(s.section_code||'').includes(gradeFilter) || String(s.section_name||'').includes('Grade ' + gradeFilter);
                // if allowedGrades provided, only show those grades
                if (Array.isArray(grades) && grades.length) return grades.includes(g) || grades.includes(String(g));
                return true;
            });
            if (filtered.length === 0) {
                // fallback: show a helpful placeholder and then all sections so admin can still choose
                selectEl.appendChild(new Option('-- No sections for selected grade; showing all --', ''));
                (sections || []).forEach(s => selectEl.appendChild(new Option((s.section_name || s.section_code || ('Section ' + s.id)) + ' (Grade ' + (s.grade_level || s.grade || s.level || '') + ')', s.id)));
                console.warn('[populateSectionsSelect] No filtered sections found for gradeFilter=', gradeFilter, '— displayed all sections as fallback');
                return;
            }
            filtered.forEach(s => selectEl.appendChild(new Option(s.section_name || s.section_code || ('Section ' + s.id), s.id)));
            console.log('[populateSectionsSelect] Populated', filtered.length, 'sections for gradeFilter=', gradeFilter);
        };

        if (sectionsCache && sectionsCache.length > 0) {
            applyOptions(sectionsCache);
            return;
        }

        // show placeholder while loading
        selectEl.appendChild(new Option('-- Loading sections --', ''));
        // attempt to fetch sections for active school year
        loadSectionsForAssignment().then(() => {
            const updated = window._sectionsCache || [];
            selectEl.innerHTML = '';
            applyOptions(updated);
        }).catch(err => {
            selectEl.innerHTML = '';
            selectEl.appendChild(new Option('-- Unable to load sections --', ''));
            console.warn('[populateSectionsSelect] failed to load sections', err);
        });
    }

    // Filter and populate a sections <select> using the site's cached sections (mirror of filterSectionsByGradeLevel)
    function filterSectionsIntoSelect(selectEl, gradeFilter, allowedGrades) {
        if (!selectEl) return;
        selectEl.innerHTML = '';
        const sections = (window.allSectionsForAdvisory || window._sectionsCache || []).map(section => ({
            ...section,
            id: section.id ?? section.section_id ?? section.sectionId,
            grade_level: section.grade_level ?? section.gradeLevel ?? section.grade ?? section.year_level ?? section.level ?? ''
        })).filter(section => section.id !== null && section.id !== undefined);
        if (!sections || sections.length === 0) {
            const alreadyRetried = selectEl.dataset.sectionRetry === '1';
            if (alreadyRetried) {
                selectEl.appendChild(new Option('-- No sections --', ''));
                return;
            }
            selectEl.dataset.sectionRetry = '1';
            selectEl.appendChild(new Option('-- Loading sections --', ''));
            loadSectionsForAssignment()
                .then(() => filterSectionsIntoSelect(selectEl, gradeFilter, allowedGrades))
                .catch(() => {
                    selectEl.innerHTML = '';
                    selectEl.appendChild(new Option('-- No sections --', ''));
                });
            return;
        }
        delete selectEl.dataset.sectionRetry;

        const grades = Array.isArray(allowedGrades) && allowedGrades.length ? allowedGrades : null;
        const normalizeGrade = (value) => {
            if (value === null || value === undefined) return '';
            const str = String(value).trim();
            const match = str.match(/(\d{1,2})/);
            return match ? match[1] : str;
        };

        const normalizedFilter = gradeFilter ? normalizeGrade(gradeFilter) : '';
        const normalizedAllowed = grades ? grades.map(g => normalizeGrade(g)) : null;

        const filtered = sections.filter(s => {
            const sectionGrade = s.grade_level || s.gradeLevel || s.grade || s.year_level || s.level;
            const g = normalizeGrade(sectionGrade);
            if (normalizedFilter) return g === normalizedFilter;
            if (normalizedAllowed) return !g || normalizedAllowed.includes(g);
            return true;
        });

        if (!filtered || filtered.length === 0) {
            selectEl.appendChild(new Option('-- No sections for selected grade; showing all --', ''));
            sections.forEach(s => selectEl.appendChild(new Option((s.section_name || s.section_code || ('Section ' + s.id)) + ' (Grade ' + (s.grade_level || s.grade || s.level || '') + ')', s.id)));
            console.warn('[filterSectionsIntoSelect] No sections matched gradeFilter=', gradeFilter);
            return;
        }

        filtered.forEach(s => selectEl.appendChild(new Option(s.section_name || s.section_code || ('Section ' + s.id), s.id)));
    }

    function collectTeachingSubjectLoads(containerId) {
        const container = document.getElementById(containerId || 'taSubjectLoadsContainer');
        if (!container) return [];
        const rows = container.querySelectorAll('.ta-subject-row');
        const loads = [];

        const resolveSectionId = (rawValue) => {
            const direct = Number(rawValue);
            if (Number.isFinite(direct) && direct > 0) return direct;

            const raw = String(rawValue || '').trim().toLowerCase();
            if (!raw) return null;

            const sections = (window.allSectionsForAdvisory || window._sectionsCache || []);
            const match = sections.find(section => {
                const sid = String(section.id ?? section.section_id ?? section.sectionId ?? '').trim().toLowerCase();
                const code = String(section.section_code || '').trim().toLowerCase();
                const name = String(section.section_name || '').trim().toLowerCase();
                return raw === sid || raw === code || raw === name;
            });

            const mapped = Number(match && (match.id ?? match.section_id ?? match.sectionId));
            return Number.isFinite(mapped) && mapped > 0 ? mapped : null;
        };

        rows.forEach(r => {
            const subjSelect = r.querySelector('.ta-subject-subject');
            const secSelect = r.querySelector('.ta-subject-sections');
            if (!subjSelect || !secSelect) return;
            const subject = subjSelect.value || '';
            const sectionId = secSelect.value;  // Single value, not multi-select
            const resolvedSectionId = resolveSectionId(sectionId);
            const sections = resolvedSectionId ? [resolvedSectionId] : [];
            if (subject && sections.length > 0) {
                loads.push({ subject: subject, sections: sections });
            }
        });
        return loads;
    }

    function countSubmittedSubjectAssignmentPairs(loads) {
        if (!Array.isArray(loads)) return 0;
        const uniquePairs = new Set();
        loads.forEach(load => {
            const subjectKey = String(load?.subject || '').trim().toLowerCase();
            const sections = Array.isArray(load?.sections) ? load.sections : [];
            sections.forEach(sectionId => {
                const numericSectionId = Number(sectionId);
                if (subjectKey && Number.isFinite(numericSectionId) && numericSectionId > 0) {
                    uniquePairs.add(`${subjectKey}::${numericSectionId}`);
                }
            });
        });
        return uniquePairs.size;
    }

    async function verifyStoredSubjectAssignmentsCount(teacherId, schoolYearId) {
        const response = await apiFetch(`/api/teacher-auth/subject-assignments/${teacherId}`);
        if (!response.ok) {
            throw new Error(`Verification failed (HTTP ${response.status})`);
        }

        const data = await response.json();
        const assignments = Array.isArray(data?.assignments) ? data.assignments : [];
        const numericSchoolYearId = Number(schoolYearId);

        if (!Number.isFinite(numericSchoolYearId) || numericSchoolYearId <= 0) {
            return assignments.length;
        }

        return assignments.filter(assignment => Number(assignment?.school_year_id) === numericSchoolYearId).length;
    }

    async function loadTeacherSubjectAssignments(teacherId, containerId, subjectOptions, allowedGrades) {
        try {
            const resp = await apiFetch(`/api/teacher-auth/subject-assignments/${teacherId}`);
            const container = document.getElementById(containerId || 'taSubjectLoadsContainer');
            if (!container) return;
            if (!resp.ok) {
                console.warn('[loadTeacherSubjectAssignments] API returned status', resp.status);
                container.innerHTML = '<p class="no-data">No subject assignments found for this teacher.</p>';
                return;
            }

            const ct = resp.headers.get('content-type') || '';
            if (!ct.includes('application/json')) {
                const text = await resp.text();
                console.warn('[loadTeacherSubjectAssignments] Non-JSON response from API:', text.substring(0,200));
                container.innerHTML = '<p class="no-data">No subject assignments found for this teacher.</p>';
                return;
            }

            let data = null;
            try {
                data = await resp.json();
            } catch (e) {
                console.error('[loadTeacherSubjectAssignments] JSON parse error:', e);
                container.innerHTML = '<p class="no-data">No subject assignments found for this teacher.</p>';
                return;
            }

            container.innerHTML = '';
            if (!data || !data.assignments || data.assignments.length === 0) {
                container.innerHTML = '<p class="no-data">No subject assignments found for this teacher.</p>';
                return;
            }
            
            // Create one row per assignment (subject + section combination)
            // Since each row now has a single section instead of multiple, we need to iterate through each assignment
            data.assignments.forEach(assignment => {
                const subject = assignment.subject || 'Unknown';
                const sectionId = assignment.section_id || assignment.id;
                const grade = assignment.grade || assignment.grade_level || assignment.school_year;
                
                if (sectionId) {
                    addTeachingSubjectRow(
                        { subject: subject, sections: [sectionId], grade: grade }, 
                        containerId, 
                        subjectOptions, 
                        allowedGrades
                    );
                }
            });
        } catch (err) {
            console.error('[loadTeacherSubjectAssignments] Error:', err);
        }
    }

    async function saveTeachingAssignments() {
        try {
            const tid = document.getElementById('taTeacherSelect')?.value;
            const role = document.getElementById('taRoleSelect')?.value;
            if (!tid || !role) { showNotification('Please select a teacher and role', 'error'); return; }
            const loads = collectTeachingSubjectLoads();
            console.log('[saveTeachingAssignments] Collected loads:', loads);
            if (!loads || loads.length === 0) { showNotification('Please add at least one subject assignment', 'error'); return; }
            
            const payload = {
                teacher_id: parseInt(tid),
                role,
                sections: [],  // For subject assignments, don't populate sections array - sections are within subject_loads
                subject_loads: loads,  // Subject assignments with embedded section IDs
                school_year_id: activeSchoolYearId
            };
            
            console.log('[saveTeachingAssignments] Sending payload:', JSON.stringify(payload, null, 2));

            const res = await apiFetch('/api/teacher-auth/assign-role', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
            if (!res.ok) { const err = await res.json(); showNotification(err.error || 'Failed to save assignments', 'error'); return; }
            const data = await res.json();
            console.log('[saveTeachingAssignments] Response:', data);

            const expectedCount = countSubmittedSubjectAssignmentPairs(loads);
            try {
                const storedCount = await verifyStoredSubjectAssignmentsCount(parseInt(tid, 10), Number(activeSchoolYearId));
                showNotification(`Assignments saved. Verified ${storedCount} stored subject assignment${storedCount === 1 ? '' : 's'}.`, 'success');
                if (storedCount !== expectedCount) {
                    showNotification(`Verification mismatch: submitted ${expectedCount}, stored ${storedCount}.`, 'warning');
                }
            } catch (verificationError) {
                console.warn('[saveTeachingAssignments] Verification error:', verificationError);
                showNotification('Assignments saved, but verification count could not be confirmed.', 'info');
            }

            // Refresh local teachers/assignments
            await loadTeachersForAdmin();
            // reload subject assignments for this teacher
            await loadTeacherSubjectAssignments(tid);
        } catch (err) { console.error('[saveTeachingAssignments] Error:', err); showNotification('Error saving assignments', 'error'); }
    }

    // Load teachers from API (canonical single definition)
    // Load section assignments for advisers
    async function loadSectionAssignmentsForTeachers() {
        try {
            console.log('[loadSectionAssignmentsForTeachers] Loading section assignments for', allTeachers.length, 'teachers');
            console.log('[loadSectionAssignmentsForTeachers] Teacher IDs:', allTeachers.map(t => ({ id: t.id, name: t.name, role: t.role })));
            try {
                const promises = allTeachers.map(async (teacher) => {
                    try {
                        const res = await apiFetch(`/api/teacher-auth/sections/${teacher.id}`);
                        if (!res.ok) {
                            console.warn(`[loadSectionAssignmentsForTeachers] HTTP ${res.status} for teacher ${teacher.id}`);
                            return { teacher_id: teacher.id, assignments: [] };
                        }
                        try {
                            const contentType = res.headers && res.headers.get ? res.headers.get('content-type') : '';
                            if (contentType && contentType.indexOf('application/json') === -1) {
                                const txt = await res.text();
                                console.warn(`[loadSubjectAssignmentsForTeachers] Expected JSON but got ${contentType} for teacher ${teacher.id}; response snippet: ` + txt.substring(0,500));
                                return { teacher_id: teacher.id, assignments: [] };
                            }
                            const data = await res.json();
                            return { teacher_id: teacher.id, assignments: data.assignments || [] };
                        } catch (err) {
                            try {
                                const txt = await res.text();
                                console.error(`[loadSubjectAssignmentsForTeachers] JSON parse failed for teacher ${teacher.id}; response snippet: ` + txt.substring(0,500));
                            } catch (re) {
                                console.error('[loadSubjectAssignmentsForTeachers] Unable to read response text', re);
                            }
                            return { teacher_id: teacher.id, assignments: [] };
                        }
                    } catch (err) {
                        console.error(`[loadSectionAssignmentsForTeachers] Error fetching sections for teacher ${teacher.id}:`, err);
                        return { teacher_id: teacher.id, assignments: [] };
                    }
                });

                const results = await Promise.all(promises);
                console.log('[loadSectionAssignmentsForTeachers] Received assignment results for all teachers. Sample:', results.slice(0,6));

                results.forEach(result => {
                    const teacher = allTeachers.find(t => String(t.id) === String(result.teacher_id));
                    if (!teacher) {
                        console.warn('[loadSectionAssignmentsForTeachers] Could not find teacher for result:', result.teacher_id);
                        return;
                    }
                    const assigns = Array.isArray(result.assignments) ? result.assignments : [];
                    if (assigns.length > 0) {
                        // Normalize possible field names for section objects
                        teacher.assigned_sections = assigns.map(a => {
                            const section_id = a.section_id || a.sectionId || a.id || a.sid || null;
                            const section_code = a.section_code || a.sectionCode || a.code || a.section_code || a.section_code || null;
                            const section_name = a.section_name || a.sectionName || a.name || a.section_name || null;
                            const school_year = a.school_year || a.schoolYear || a.year || null;
                            return {
                                section_id,
                                section_code,
                                section_name,
                                school_year
                            };
                        }).filter(s => s.section_id || s.section_code || s.section_name);
                        console.log(`[loadSectionAssignmentsForTeachers] ${teacher.name} assigned to ${teacher.assigned_sections.length} section(s):`, teacher.assigned_sections.map(s => s.section_code || s.section_name || s.section_id).join(', '));
                    } else {
                        teacher.assigned_sections = [];
                        console.log(`[loadSectionAssignmentsForTeachers] ${teacher.name} has no assignments`);
                    }
                });

                const countWith = allTeachers.filter(t => t.assigned_sections && t.assigned_sections.length > 0).length;
                console.log('[loadSectionAssignmentsForTeachers] Teachers with assignments:', countWith, '/', allTeachers.length);
            } catch (err) {
                console.error('[loadSectionAssignmentsForTeachers] Error:', err);
            }
        } catch (err) {
            console.error('[loadSectionAssignmentsForTeachers] Error:', err);
        }
    }

    // Load subject assignments for all teachers
    async function loadSubjectAssignmentsForTeachers() {
        try {
            console.log('[loadSubjectAssignmentsForTeachers] Loading subject assignments for', allTeachers.length, 'teachers');
            try {
                const promises = allTeachers.map(async (teacher) => {
                    try {
                        const res = await apiFetch(`/api/teacher-auth/subject-assignments/${teacher.id}`);
                        if (!res.ok) {
                            console.warn(`[loadSubjectAssignmentsForTeachers] HTTP ${res.status} for teacher ${teacher.id}`);
                            return { teacher_id: teacher.id, assignments: [] };
                        }
                        try {
                            const contentType = res.headers && res.headers.get ? res.headers.get('content-type') : '';
                            if (contentType && contentType.indexOf('application/json') === -1) {
                                const txt = await res.text();
                                console.warn(`[loadSectionAssignmentsForTeachers] Expected JSON but got ${contentType} for teacher ${teacher.id}; response snippet: ` + txt.substring(0,500));
                                return { teacher_id: teacher.id, assignments: [] };
                            }
                            const data = await res.json();
                            return { teacher_id: teacher.id, assignments: data.assignments || [] };
                        } catch (err) {
                            try {
                                const txt = await res.text();
                                console.error(`[loadSectionAssignmentsForTeachers] JSON parse failed for teacher ${teacher.id}; response snippet: ` + txt.substring(0,500));
                            } catch (re) {
                                console.error('[loadSectionAssignmentsForTeachers] Unable to read response text', re);
                            }
                            return { teacher_id: teacher.id, assignments: [] };
                        }
                    } catch (err) {
                        console.error(`[loadSubjectAssignmentsForTeachers] Error fetching subject assignments for teacher ${teacher.id}:`, err);
                        return { teacher_id: teacher.id, assignments: [] };
                    }
                });

                const results = await Promise.all(promises);
                console.log('[loadSubjectAssignmentsForTeachers] Received assignment results for all teachers');

                results.forEach(result => {
                    const teacher = allTeachers.find(t => String(t.id) === String(result.teacher_id));
                    if (!teacher) return;
                    if (result.assignments && result.assignments.length > 0) {
                        teacher.subject_assignments = result.assignments.map(a => ({
                            subject: a.subject,
                            subject_name: a.subject,
                            section_id: a.section_id,
                            section_name: a.section_name,
                            section_code: a.section_code,
                            grade: a.school_year,
                            school_year: a.school_year
                        }));
                        console.log(`[loadSubjectAssignmentsForTeachers] ${teacher.name} has ${result.assignments.length} subject assignment(s)`);
                    } else {
                        teacher.subject_assignments = [];
                        console.log(`[loadSubjectAssignmentsForTeachers] ${teacher.name} has no subject assignments`);
                    }
                });
            } catch (err) {
                console.error('[loadSubjectAssignmentsForTeachers] Error:', err);
            }
        } catch (err) {
            console.error('[loadSubjectAssignmentsForTeachers] Error:', err);
        }
    }

    // Filter and display teachers
    function filterTeachers() {
        const searchTerm = (document.getElementById('teacherSearchInput')?.value || '').toLowerCase();
        const roleFilter = document.getElementById('teacherRoleFilter')?.value || '';
        const sortBy = document.getElementById('teacherSortBy')?.value || 'created_at';

        console.log('[filterTeachers] Filters applied:', { searchTerm, roleFilter, sortBy, totalTeachers: allTeachers.length });

        let filtered = allTeachers.filter(teacher => {
            // Search filter
            const matchesSearch = !searchTerm ||
                (teacher.name && teacher.name.toLowerCase().includes(searchTerm)) ||
                (teacher.email && teacher.email.toLowerCase().includes(searchTerm)) ||
                (teacher.department && teacher.department.toLowerCase().includes(searchTerm)) ||
                (teacher.teacher_id && teacher.teacher_id.toLowerCase().includes(searchTerm));

            // Role filter
            let matchesRole = true;
            if (roleFilter === 'unassigned') {
                matchesRole = !teacher.role;
            } else if (roleFilter) {
                matchesRole = teacher.role && teacher.role.toLowerCase() === roleFilter.toLowerCase();
            }

            return matchesSearch && matchesRole;
        });

        // Sort
        switch (sortBy) {
            case 'created_at':
                filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                break;
            case 'created_at_desc':
                filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
                break;
            case 'name':
                filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                break;
            case 'email':
                filtered.sort((a, b) => (a.email || '').localeCompare(b.email || ''));
                break;
        }

        filteredTeachers = filtered;
        console.log('[filterTeachers] After filtering:', {
            totalFiltered: filtered.length,
            advisers: filtered.filter(t => t.role === 'Adviser').length,
            withSections: filtered.filter(t => t.assigned_sections && t.assigned_sections.length > 0).length
        });
        displayTeachersTable();
    }

    // Display teachers in table
    function displayTeachersTable() {
        const tbody = document.getElementById('teachersTableBody');
        const resultsInfo = document.getElementById('teacherResultsInfo');
        const resultsCount = document.getElementById('teacherResultsCount');

        if (!tbody) return;

        if (filteredTeachers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="no-data">No teachers found</td></tr>';
            if (resultsInfo) resultsInfo.style.display = 'none';
            return;
        }

        tbody.innerHTML = filteredTeachers.map(teacher => {
            const createdDate = new Date(teacher.created_at).toLocaleDateString();

            console.log(`[displayTeachersTable] Rendering ${teacher.name}: role="${teacher.role}", assigned_sections=${JSON.stringify(teacher.assigned_sections)}`);

            // Format role with proper badge styling
            let roleHtml = '<span style="color: #999;">Not Assigned</span>';
            if (teacher.role) {
                const isAdviserRole = teacher.role.toLowerCase() === 'adviser';
                const roleBgColor = isAdviserRole ? '#e8f5e9' : '#f3e5f5';
                const roleTextColor = isAdviserRole ? '#2e7d32' : '#6a1b9a';
                const displayRole = isAdviserRole ? 'Adviser' : teacher.role;
                roleHtml = `<span style="background: ${roleBgColor}; color: ${roleTextColor}; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600;">${escapeHtml(displayRole)}</span>`;
            }

            // Format assigned sections (support for multiple sections)
            let sectionHtml = '<span style="color: #999;">--</span>';
            const isAdviser = teacher.role && teacher.role.toLowerCase() === 'adviser';

            if (isAdviser && teacher.assigned_sections && teacher.assigned_sections.length > 0) {
                // Display all assigned sections as badges
                const sectionBadges = teacher.assigned_sections.map(section => {
                    const sectionDisplay = section.section_name || section.section_code || `Section ${section.section_id}`;
                    return `<span class="ta-section-chip">${escapeHtml(sectionDisplay)}</span>`;
                }).join('');
                sectionHtml = sectionBadges;
                console.log(`[displayTeachersTable] ${teacher.name} (Adviser): ${teacher.assigned_sections.map(s => s.section_code).join(', ')}`);
            } else if (isAdviser) {
                sectionHtml = '<span style="color: #d32f2f; font-weight: 600;">Not assigned</span>';
                console.log(`[displayTeachersTable] ${teacher.name} (Adviser): No sections assigned`);
            }

            return `
                <tr>
                    <td>${escapeHtml(teacher.teacher_id)}</td>
                    <td>${escapeHtml(teacher.name)}</td>
                    <td title="${escapeHtml(teacher.email)}">${escapeHtml(teacher.email)}</td>
                    <td>${escapeHtml(teacher.department || '--')}</td>
                    <td>${escapeHtml(teacher.phone || '--')}</td>
                    <td>${roleHtml}</td>
                    <td>${sectionHtml}</td>
                    <td>${createdDate}</td>
                    <td style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                            <button class="btn btn-sm btn-primary" onclick="openTeacherAssignmentModal(${teacher.id})" title="Assign Role">
                                Assign Role
                            </button>
                        ${isAdviser && teacher.assigned_sections && teacher.assigned_sections.length > 0 ? `
                        <button class="btn btn-sm btn-secondary" onclick="openTeacherEditSectionsModal(${teacher.id})" title="Edit section assignments">
                            ✏ Edit
                        </button>
                        ` : ''}
                    </td>
                </tr>
            `;
        }).join('');

        if (resultsCount) resultsCount.textContent = filteredTeachers.length;
        if (resultsInfo) resultsInfo.style.display = 'block';
    }

    // Load sections for assignment dropdown
    // Filter sections by grade level for adviser assignment
    function filterSectionsByGradeLevel() {
        try {
            const gradeSelect = document.getElementById('advisoryGradeLevel');
            const advisorySelect = document.getElementById('assignAdvisorySection');
            
            if (!gradeSelect || !advisorySelect) {
                console.warn('[filterSectionsByGradeLevel] Missing dropdown elements');
                return;
            }

            const selectedGrade = gradeSelect.value;
            console.log('[filterSectionsByGradeLevel] Grade level selected:', selectedGrade);
            console.log('[filterSectionsByGradeLevel] All sections available:', window.allSectionsForAdvisory?.length || 0);

            // Clear advisory select
            advisorySelect.innerHTML = '';
            const makeOption = (value, text) => {
                const o = document.createElement('option');
                o.value = value;
                o.text = text;
                return o;
            };

            advisorySelect.appendChild(makeOption('', '-- Select Sections --'));

            if (!selectedGrade) {
                console.log('[filterSectionsByGradeLevel] No grade level selected - showing default option only');
                return;
            }

            if (!window.allSectionsForAdvisory || window.allSectionsForAdvisory.length === 0) {
                console.warn('[filterSectionsByGradeLevel] No sections data available');
                return;
            }

            // Filter sections by grade level - check multiple possible field names
            const filteredSections = window.allSectionsForAdvisory.filter(s => {
                const sectionGrade = s.grade_level || s.gradeLevel || s.grade || s.year_level || s.level;
                const matches = sectionGrade && sectionGrade.toString() === selectedGrade;
                if (matches) {
                    console.log('[filterSectionsByGradeLevel] Match found - Section:', s.section_code || s.section_name, 'Grade:', sectionGrade);
                }
                return matches;
            });

            console.log('[filterSectionsByGradeLevel] Found', filteredSections.length, 'sections for grade', selectedGrade);

            if (filteredSections.length === 0) {
                console.warn('[filterSectionsByGradeLevel] No sections found for grade', selectedGrade);
                console.log('[filterSectionsByGradeLevel] Available section grades:', window.allSectionsForAdvisory.map(s => ({ code: s.section_code, grade: s.grade_level || s.gradeLevel || s.grade || s.year_level || s.level })));
            }

            // Populate advisory select with filtered sections
            filteredSections.forEach(s => {
                const display = (s.section_name || s.section_code || ('Section ' + s.id));
                advisorySelect.appendChild(makeOption(s.id, display));
                console.log('[filterSectionsByGradeLevel] Added section:', s.id, display);
            });

        } catch (err) {
            console.error('[filterSectionsByGradeLevel] ERROR:', err);
        }
    }

    // Add selected adviser sections from current grade level
    function addAdviserSections() {
        try {
            const gradeSelect = document.getElementById('advisoryGradeLevel');
            const sectionsSelect = document.getElementById('assignAdvisorySection');
            const selectedIdsInput = document.getElementById('selectedAdviserSectionIds');
            const listContainer = document.getElementById('selectedAdviserSectionsList');
            const containerDiv = document.getElementById('selectedAdviserSectionsContainer');

            const selectedGrade = gradeSelect.value;
            const selectedOptions = Array.from(sectionsSelect.selectedOptions || []);

            if (!selectedGrade) {
                showNotification('Please select a grade level first', 'error');
                return;
            }

            if (selectedOptions.length === 0) {
                showNotification('Please select at least one section', 'error');
                return;
            }

            // Get existing selections
            let existingIds = selectedIdsInput.value ? JSON.parse(selectedIdsInput.value) : [];

            // Add new sections with their grade level
                    const conflicts = [];
                    selectedOptions.forEach(option => {
                        const sectionId = option.value;
                        const sectionDisplay = option.text;

                        // Detect existing adviser for this section from cached sections
                        try {
                            const all = window._sectionsCache || window.allSectionsForAdvisory || [];
                            const found = all.find(s => String(s.id) === String(sectionId) || String(s.section_id) === String(sectionId));
                            if (found) {
                                // possible adviser identifier fields
                                const assignedAdviserId = found.adviser_id || found.assigned_adviser_id || found.assigned_teacher_id || found.teacher_id || (found.adviser && (found.adviser.id || found.adviser.adviser_id)) || null;
                                const assignedAdviserName = found.adviser_name || (found.adviser && (found.adviser.first_name ? `${found.adviser.first_name} ${found.adviser.last_name || ''}` : found.adviser.name)) || found.assigned_to_name || found.assigned_adviser || null;
                                const currentTeacherId = document.getElementById('assignTeacherId') ? document.getElementById('assignTeacherId').value : null;
                                if (assignedAdviserId && String(assignedAdviserId) !== String(currentTeacherId)) {
                                    conflicts.push({ section: sectionDisplay, adviser: assignedAdviserName || (`#${assignedAdviserId}`) });
                                }
                            }
                        } catch (err) {
                            console.warn('[addAdviserSections] conflict detection error', err);
                        }

                        // Check if already added
                        if (!existingIds.find(item => item.id === sectionId)) {
                            existingIds.push({
                                id: sectionId,
                                name: sectionDisplay,
                                grade: selectedGrade
                            });
                        }
                    });

            // Save to hidden input
            selectedIdsInput.value = JSON.stringify(existingIds);

            // Display selected sections as badges
            listContainer.innerHTML = '';
            existingIds.forEach((item, idx) => {
                const badge = document.createElement('div');
                badge.style = 'display:inline-flex; align-items:center; gap:6px; background:#e3f2fd; color:#1565c0; padding:6px 12px; border-radius:4px; font-size:12px; font-weight:500;';
                badge.innerHTML = `
                    <span>${item.name} (Grade ${item.grade})</span>
                    <button type="button" class="remove-section-badge" data-index="${idx}" style="background:none; border:none; color:#1565c0; cursor:pointer; font-weight:bold; padding:0; width:16px; height:16px; display:flex; align-items:center; justify-content:center;">×</button>
                `;
                badge.querySelector('.remove-section-badge').addEventListener('click', () => removeAdviserSection(idx));
                listContainer.appendChild(badge);
            });

            // Show container if there are items
            if (existingIds.length > 0) {
                containerDiv.style.display = 'block';
            }

            // Show conflict warning if any
            try {
                const warn = document.getElementById('adviserConflictWarning');
                const warnList = document.getElementById('adviserConflictList');
                if (warn && warnList) {
                    if (conflicts.length > 0) {
                        warnList.innerHTML = '';
                        conflicts.forEach(c => {
                            const li = document.createElement('li');
                            li.textContent = `${c.section} — currently assigned to ${c.adviser}`;
                            warnList.appendChild(li);
                        });
                        warn.style.display = 'block';
                    } else {
                        warn.style.display = 'none';
                        warnList.innerHTML = '';
                    }
                }
            } catch (err) { console.warn('[addAdviserSections] warning update error', err); }

            // Clear selection
            sectionsSelect.value = '';
            gradeSelect.value = '';

            console.log('[addAdviserSections] Added sections. Total:', existingIds.length);
        } catch (err) {
            console.error('[addAdviserSections] ERROR:', err);
        }
    }

    // Remove a section from the adviser selection
    function removeAdviserSection(index) {
        try {
            const selectedIdsInput = document.getElementById('selectedAdviserSectionIds');
            const listContainer = document.getElementById('selectedAdviserSectionsList');
            const containerDiv = document.getElementById('selectedAdviserSectionsContainer');

            let existingIds = selectedIdsInput.value ? JSON.parse(selectedIdsInput.value) : [];
            existingIds.splice(index, 1);
            selectedIdsInput.value = JSON.stringify(existingIds);

            // Refresh display
            listContainer.innerHTML = '';
            existingIds.forEach((item, idx) => {
                const badge = document.createElement('div');
                badge.style = 'display:inline-flex; align-items:center; gap:6px; background:#e3f2fd; color:#1565c0; padding:6px 12px; border-radius:4px; font-size:12px; font-weight:500;';
                badge.innerHTML = `
                    <span>${item.name} (Grade ${item.grade})</span>
                    <button type="button" class="remove-section-badge" data-index="${idx}" style="background:none; border:none; color:#1565c0; cursor:pointer; font-weight:bold; padding:0; width:16px; height:16px; display:flex; align-items:center; justify-content:center;">×</button>
                `;
                badge.querySelector('.remove-section-badge').addEventListener('click', () => removeAdviserSection(idx));
                listContainer.appendChild(badge);
            });

            // Update conflict warning after removal
            try {
                const warn = document.getElementById('adviserConflictWarning');
                const warnList = document.getElementById('adviserConflictList');
                if (warn && warnList) {
                    // Re-evaluate conflicts against cached sections
                    const all = window._sectionsCache || window.allSectionsForAdvisory || [];
                    const currentTeacherId = document.getElementById('assignTeacherId') ? document.getElementById('assignTeacherId').value : null;
                    const remainingIds = existingIds.map(i => String(i.id));
                    const newConflicts = [];
                    remainingIds.forEach(rid => {
                        const found = all.find(s => String(s.id) === String(rid) || String(s.section_id) === String(rid));
                        if (found) {
                            const assignedAdviserId = found.adviser_id || found.assigned_adviser_id || found.assigned_teacher_id || found.teacher_id || (found.adviser && (found.adviser.id || found.adviser.adviser_id)) || null;
                            const assignedAdviserName = found.adviser_name || (found.adviser && (found.adviser.first_name ? `${found.adviser.first_name} ${found.adviser.last_name || ''}` : found.adviser.name)) || found.assigned_to_name || found.assigned_adviser || null;
                            if (assignedAdviserId && String(assignedAdviserId) !== String(currentTeacherId)) {
                                newConflicts.push({ section: found.section_name || found.section_code || (`Section ${found.id}`), adviser: assignedAdviserName || (`#${assignedAdviserId}`) });
                            }
                        }
                    });

                    if (newConflicts.length > 0) {
                        warnList.innerHTML = '';
                        newConflicts.forEach(c => {
                            const li = document.createElement('li');
                            li.textContent = `${c.section} — currently assigned to ${c.adviser}`;
                            warnList.appendChild(li);
                        });
                        warn.style.display = 'block';
                    } else {
                        warn.style.display = 'none';
                        warnList.innerHTML = '';
                    }
                }
            } catch (err) { console.warn('[removeAdviserSection] warning update error', err); }

            // Hide container if empty
            if (existingIds.length === 0) {
                containerDiv.style.display = 'none';
                selectedIdsInput.value = '';
            }

            console.log('[removeAdviserSection] Removed section. Remaining:', existingIds.length);
        } catch (err) {
            console.error('[removeAdviserSection] ERROR:', err);
        }
    }


// Helper: generate unique id for subject load rows
function genSubjectLoadId() {
    return 'subjectLoad_' + Math.random().toString(36).slice(2, 9);
}

// Add a subject load row (subject dropdown + sections multi-select)
function addSubjectLoadRow(initialSubject) {
    const container = document.getElementById('subjectLoadsContainer');
    if (!container) return;

    const id = genSubjectLoadId();
    const row = document.createElement('div');
    row.className = 'subject-load-row';
    row.id = id;
    row.style = 'display:flex;gap:8px;align-items:flex-start;margin-bottom:8px;';

    // Subject select
    const subjSelect = document.createElement('select');
    subjSelect.className = 'subject-load-subject';
    subjSelect.style = 'min-width:160px;';
    subjSelect.appendChild(new Option('-- Select Subject --', ''));
    // Use AVAILABLE_SUBJECTS (populated per teacher). If empty, trigger a load and populate later.
    if (Array.isArray(AVAILABLE_SUBJECTS) && AVAILABLE_SUBJECTS.length > 0) {
        AVAILABLE_SUBJECTS.forEach(s => subjSelect.appendChild(new Option(s, s)));
    } else if (typeof loadAvailableSubjectsForTeacher === 'function') {
        loadAvailableSubjectsForTeacher(window.teacherToAssign || null).then(list => {
            if (Array.isArray(list)) {
                const sel = document.querySelector('#' + id + ' .subject-load-subject') || subjSelect;
                list.forEach(s => sel.appendChild(new Option(s, s)));
            }
        }).catch(err => console.error('Failed to load available subjects:', err));
    }
    if (initialSubject) subjSelect.value = initialSubject;

    // Sections multi-select for this subject load
    const secSelect = document.createElement('select');
    secSelect.className = 'subject-load-sections';
    secSelect.multiple = true;
    secSelect.size = 4;
    secSelect.style = 'min-width:260px;';
    secSelect.appendChild(new Option('-- Select Sections (hold Ctrl/Cmd) --', ''));

    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn btn-sm btn-danger';
    removeBtn.textContent = 'Remove';
    removeBtn.onclick = () => { container.removeChild(row); };

    row.appendChild(subjSelect);
    // Populate sections for this subject-load using filtered cache
    filterSectionsIntoSelect(secSelect, null, null);
    row.appendChild(secSelect);
    row.appendChild(removeBtn);
    container.appendChild(row);

    // Populate sections into this row's sections select
    const masterTeaching = document.getElementById('assignTeachingSections');
    if (masterTeaching && masterTeaching.options && masterTeaching.options.length > 0) {
        Array.from(masterTeaching.options).forEach(opt => {
            const clone = new Option(opt.text, opt.value);
            secSelect.appendChild(clone);
        });
    } else {
        loadSectionsForAssignment().then(() => {
            const master = document.getElementById('assignTeachingSections');
            if (master) Array.from(master.options).forEach(opt => secSelect.appendChild(new Option(opt.text, opt.value)));
        }).catch(err => console.error('Error populating subject load sections:', err));
    }

    return id;
}

// Collect subject loads from rows: [{ subject: 'Math', sections: [1,2] }, ...]
function collectSubjectLoads() {
    const rows = document.querySelectorAll('.subject-load-row');
    const loads = [];
    rows.forEach(row => {
        const subj = row.querySelector('.subject-load-subject');
        const secs = row.querySelector('.subject-load-sections');
        if (!subj || !secs) return;
        const subjectVal = subj.value || '';
        const selectedSecIds = Array.from(secs.selectedOptions || []).map(o => o.value).filter(v => v !== '');
        if (subjectVal && selectedSecIds.length > 0) {
            loads.push({ subject: subjectVal, sections: selectedSecIds.map(id => parseInt(id)) });
        }
    });
    return loads;
}

// Load teachers from API
// Load section assignments for advisers
async function loadSectionAssignmentsForTeachers() {
    try {
        console.log('[loadSectionAssignmentsForTeachers] Loading section assignments for', allTeachers.length, 'teachers');
        console.log('[loadSectionAssignmentsForTeachers] Teacher IDs:', allTeachers.map(t => ({ id: t.id, name: t.name, role: t.role })));
        try {
            // For robustness, handle multiple response shapes and try fallbacks only when necessary.
            const results = [];
            for (const teacher of allTeachers) {
                try {
                    // If teacher object already contains assigned sections from the list API, use it.
                    if (teacher.assigned_sections && Array.isArray(teacher.assigned_sections) && teacher.assigned_sections.length > 0) {
                        results.push({ teacher_id: teacher.id, assignments: teacher.assigned_sections });
                        console.log(`[loadSectionAssignmentsForTeachers] Using preloaded assigned_sections for teacher ${teacher.id}`);
                        continue;
                    }

                    const endpoints = [
                        `/api/teacher-auth/sections/${teacher.id}`,
                        `/api/teacher-auth/sections-by-teacher/${teacher.id}`,
                        `/api/teacher-auth/assignments/${teacher.id}`,
                        `/api/teacher-auth/sections?teacher_id=${teacher.id}`
                    ];

                    let found = false;
                    for (const ep of endpoints) {
                        try {
                            const resp = await apiFetch(ep, { cache: 'no-store' });
                            if (!resp.ok) { continue; }
                            let data = null;
                            try { data = await resp.json(); } catch (e) { data = null; }
                            if (!data) continue;

                            // Normalize possible shapes
                            let assignments = [];
                            if (Array.isArray(data)) assignments = data;
                            else if (Array.isArray(data.assignments)) assignments = data.assignments;
                            else if (Array.isArray(data.sections)) assignments = data.sections;
                            else if (Array.isArray(data.data)) assignments = data.data;
                            else if (Array.isArray(data.result)) assignments = data.result;

                            if (assignments && assignments.length > 0) {
                                results.push({ teacher_id: teacher.id, assignments });
                                found = true;
                                console.log(`[loadSectionAssignmentsForTeachers] Fetched ${assignments.length} assignments for teacher ${teacher.id} from ${ep}`);
                                break;
                            }
                        } catch (e) {
                            console.warn('[loadSectionAssignmentsForTeachers] fetch error for', ep, e);
                            continue;
                        }
                    }

                    if (!found) {
                        // Nothing found; push empty assignments
                        results.push({ teacher_id: teacher.id, assignments: [] });
                    }
                } catch (e) {
                    console.error(`[loadSectionAssignmentsForTeachers] Error processing teacher ${teacher.id}:`, e);
                    results.push({ teacher_id: teacher.id, assignments: [] });
                }
            }

            console.log('[loadSectionAssignmentsForTeachers] Received assignment results for all teachers');

            results.forEach(result => {
                const teacher = allTeachers.find(t => String(t.id) === String(result.teacher_id));
                if (!teacher) return;
                const arr = result.assignments || [];
                if (arr && arr.length > 0) {
                    teacher.assigned_sections = arr.map(a => ({
                        section_id: a.section_id || a.id || a.sectionId || a.section_id || (a.section && a.section.id) || null,
                        section_code: a.section_code || a.code || a.section_code || (a.section && a.section.code) || null,
                        section_name: a.section_name || a.name || a.section_name || (a.section && a.section.name) || null,
                        school_year: a.school_year || a.school_year_id || (a.section && a.section.school_year) || null
                    }));
                    console.log(`[loadSectionAssignmentsForTeachers] ${teacher.name} assigned to ${teacher.assigned_sections.length} section(s): ${teacher.assigned_sections.map(a => a.section_code || a.section_name).join(', ')}`);
                } else {
                    teacher.assigned_sections = [];
                    console.log(`[loadSectionAssignmentsForTeachers] ${teacher.name} has no assignments`);
                }
            });
        } catch (err) {
            console.error('[loadSectionAssignmentsForTeachers] Error:', err);
        }
    } catch (err) {
        console.error('[loadSectionAssignmentsForTeachers] Error:', err);
    }
}

// Filter and display teachers
function filterTeachers() {
    const searchTerm = (document.getElementById('teacherSearchInput')?.value || '').toLowerCase();
    const roleFilter = document.getElementById('teacherRoleFilter')?.value || '';
    const sortBy = document.getElementById('teacherSortBy')?.value || 'created_at';

    console.log('[filterTeachers] Filters applied:', { searchTerm, roleFilter, sortBy, totalTeachers: allTeachers.length });

    let filtered = allTeachers.filter(teacher => {
        const matchesSearch = !searchTerm ||
            (teacher.name && teacher.name.toLowerCase().includes(searchTerm)) ||
            (teacher.email && teacher.email.toLowerCase().includes(searchTerm)) ||
            (teacher.department && teacher.department.toLowerCase().includes(searchTerm)) ||
            (teacher.teacher_id && teacher.teacher_id.toLowerCase().includes(searchTerm));

        let matchesRole = true;
        if (roleFilter === 'unassigned') {
            matchesRole = !teacher.role;
        } else if (roleFilter) {
            matchesRole = teacher.role && teacher.role.toLowerCase() === roleFilter.toLowerCase();
        }

        return matchesSearch && matchesRole;
    });

    switch (sortBy) {
        case 'created_at':
            filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            break;
        case 'created_at_desc':
            filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            break;
        case 'name':
            filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            break;
        case 'email':
            filtered.sort((a, b) => (a.email || '').localeCompare(b.email || ''));
            break;
    }

    filteredTeachers = filtered;
    console.log('[filterTeachers] After filtering:', {
        totalFiltered: filtered.length,
        advisers: filtered.filter(t => t.role === 'Adviser').length,
        withSections: filtered.filter(t => t.assigned_sections && t.assigned_sections.length > 0).length
    });
    displayTeachersTable();
}

// Display teachers in table
function displayTeachersTable() {
    const tbody = document.getElementById('teachersTableBody');
    const resultsInfo = document.getElementById('teacherResultsInfo');
    const resultsCount = document.getElementById('teacherResultsCount');

    if (!tbody) return;

    if (filteredTeachers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="no-data">No teachers found</td></tr>';
        if (resultsInfo) resultsInfo.style.display = 'none';
        return;
    }

    tbody.innerHTML = filteredTeachers.map(teacher => {
        const createdDate = new Date(teacher.created_at).toLocaleDateString();
        
        console.log(`[displayTeachersTable] Rendering ${teacher.name}: role="${teacher.role}", assigned_sections=${JSON.stringify(teacher.assigned_sections)}`);
        
        let roleHtml = '<span style="color: #999;">Not Assigned</span>';
        if (teacher.role) {
            const isAdviserRole = teacher.role.toLowerCase() === 'adviser';
            const roleBgColor = isAdviserRole ? '#e8f5e9' : '#f3e5f5';
            const roleTextColor = isAdviserRole ? '#2e7d32' : '#6a1b9a';
            const displayRole = isAdviserRole ? 'Adviser' : teacher.role;
            roleHtml = `<span style="background: ${roleBgColor}; color: ${roleTextColor}; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600;">${escapeHtml(displayRole)}</span>`;
        }

        let sectionHtml = '<span style="color: #999;">--</span>';
        const isAdviser = teacher.role && teacher.role.toLowerCase() === 'adviser';
        
        if (isAdviser && teacher.assigned_sections && teacher.assigned_sections.length > 0) {
            const sectionBadges = teacher.assigned_sections.map(section => {
                const sectionDisplay = section.section_name || section.section_code || `Section ${section.section_id}`;
                return `<span class="ta-section-chip">${escapeHtml(sectionDisplay)}</span>`;
            }).join('');
            sectionHtml = sectionBadges;
            console.log(`[displayTeachersTable] ${teacher.name} (Adviser): ${teacher.assigned_sections.map(s => s.section_code).join(', ')}`);
        } else if (isAdviser) {
            sectionHtml = '<span style="color: #d32f2f; font-weight: 600;">Not assigned</span>';
            console.log(`[displayTeachersTable] ${teacher.name} (Adviser): No sections assigned`);
        }
        
        return `
            <tr>
                <td>${escapeHtml(teacher.teacher_id)}</td>
                <td>${escapeHtml(teacher.name)}</td>
                <td title="${escapeHtml(teacher.email)}">${escapeHtml(teacher.email)}</td>
                <td>${escapeHtml(teacher.department || '--')}</td>
                <td>${escapeHtml(teacher.phone || '--')}</td>
                <td>${roleHtml}</td>
                <td>${sectionHtml}</td>
                <td>${createdDate}</td>
                <td style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                    <button class="btn btn-sm btn-primary" onclick="openTeacherAssignmentModal(${teacher.id})" title="Assign roles to this teacher">
                        Assign Role
                    </button>
                    ${isAdviser && teacher.assigned_sections && teacher.assigned_sections.length > 0 ? `
                    <button class="btn btn-sm btn-secondary" onclick="openTeacherEditSectionsModal(${teacher.id})" title="Edit section assignments">
                        ✏ Edit
                    </button>
                    ` : ''}
                </td>
            </tr>
        `;
    }).join('');

    if (resultsCount) resultsCount.textContent = filteredTeachers.length;
    if (resultsInfo) resultsInfo.style.display = 'block';
}

// Load sections for assignment dropdown
// Load active school year and display it in modal (no manual selection)
async function loadActiveSchoolYearForAssignment() {
    try {
        const res = await apiFetch('/api/school-years');
        const years = await res.json();
        
        const active = Array.isArray(years) ? years.find(y => y.is_active) : null;
        if (active) {
            activeSchoolYearId = active.id;
            activeSchoolYearLabel = active.school_year + ' (Active)';
        } else {
            activeSchoolYearId = null;
            activeSchoolYearLabel = '--';
        }

        const disp = document.getElementById('assignSchoolYearDisplay');
        if (disp) disp.textContent = activeSchoolYearLabel;

        console.log('[loadActiveSchoolYearForAssignment] Active school year:', activeSchoolYearId);
    } catch (err) {
        console.error('[loadActiveSchoolYearForAssignment] Error loading school year:', err);
        activeSchoolYearId = null;
        activeSchoolYearLabel = '--';
    }
}

// Open teacher assignment modal
async function openTeacherAssignmentModal(teacherId) {
    const resolvedId = (teacherId && typeof teacherId === 'object')
        ? (teacherId.id ?? teacherId.teacher_id ?? teacherId.user_id)
        : teacherId;

    const numericId = Number(resolvedId);
    const teacherSource = (Array.isArray(allTeachers) && allTeachers.length > 0)
        ? allTeachers
        : ((Array.isArray(window.allTeachers) && window.allTeachers.length > 0) ? window.allTeachers : []);

    const teacher = teacherSource.find(t => {
        const candidate = t.id ?? t.teacher_id ?? t.user_id;
        if (Number.isFinite(numericId)) {
            return Number(candidate) === numericId;
        }
        return String(candidate) === String(resolvedId);
    });

    if (!teacher) {
        showNotification('Teacher not found', 'error');
        return;
    }

    teacherToAssign = teacher;

    document.getElementById('assignTeacherId').value = teacher.id;
    document.getElementById('assignTeacherName').textContent = teacher.name;
    document.getElementById('assignTeacherEmail').textContent = teacher.email;
    document.getElementById('assignTeacherDept').textContent = teacher.department || '--';
    document.getElementById('assignTeacherId2').textContent = teacher.teacher_id;

    document.getElementById('assignRole').value = '';
    const advisoryGroup = document.getElementById('advisorySectionGroup');
    const teachingGroup = document.getElementById('teachingSectionsGroup');
    if (advisoryGroup) advisoryGroup.style.display = 'none';
    if (teachingGroup) teachingGroup.style.display = 'none';
    const advSelect = document.getElementById('assignAdvisorySection');
    const gradeSelect = document.getElementById('advisoryGradeLevel');
    const teachSelect = document.getElementById('assignTeachingSections');
    const selectedIdsInput = document.getElementById('selectedAdviserSectionIds');
    const selectedSectionsContainer = document.getElementById('selectedAdviserSectionsContainer');
    if (advSelect) { advSelect.innerHTML = '<option value="">-- Select Sections --</option>'; }
    if (gradeSelect) { gradeSelect.value = ''; }
    if (teachSelect) { teachSelect.innerHTML = '<option value="">-- Select Teaching Sections (hold Ctrl/Cmd) --</option>'; }
    if (selectedIdsInput) { selectedIdsInput.value = ''; }
    if (selectedSectionsContainer) { selectedSectionsContainer.style.display = 'none'; }

    await loadActiveSchoolYearForAssignment();
    await loadSectionsForAssignment();

    try {
        await loadAvailableSubjectsForTeacher(teacher);
    } catch (err) {
        console.error('Error loading available subjects for teacher:', err);
    }

    try {
        const levelEl = document.getElementById('assignTeacherLevel');
        if (levelEl) {
            const lvl = detectTeacherLevel(teacher);
            if (lvl === 'junior') { levelEl.style.display = 'block'; levelEl.textContent = 'Junior High (Adviser / Subject assignments will show Junior-only subjects)'; }
            else if (lvl === 'senior') { levelEl.style.display = 'block'; levelEl.textContent = 'Senior High (Adviser / Subject assignments will show Senior-only subjects)'; }
            else { levelEl.style.display = 'none'; levelEl.textContent = ''; }
        }
    } catch (err) { console.error('Error setting teacher level display:', err); }

    const modal = document.getElementById('teacherAssignmentModal');
    if (modal) {
        modal.setAttribute('aria-hidden', 'false');
        modal.style.display = 'flex';
        try {
            // Ensure modal and its interactive children are interactive (recover from overlay neutralizer)
            modal.style.pointerEvents = 'auto';
            modal.querySelectorAll('select, button, input, textarea').forEach(el => { el.style.pointerEvents = 'auto'; el.disabled = el.disabled; });
        } catch (e) { /* ignore */ }
    }

    // Apply role UI state (hide/show advisory/teaching groups)
    try { handleAssignRoleChange(document.getElementById('assignRole').value || ''); } catch (e) {}

    // Ensure grade level filter event listener is wired
    try {
        const gradeElem = document.getElementById('advisoryGradeLevel');
        if (gradeElem) {
            // Remove any existing listeners to prevent duplicates
            gradeElem.replaceWith(gradeElem.cloneNode(true));
            const newGradeElem = document.getElementById('advisoryGradeLevel');
            if (newGradeElem) {
                newGradeElem.addEventListener('change', () => filterSectionsByGradeLevel());
                console.log('[openTeacherAssignmentModal] Grade level event listener wired');
            }
        }
    } catch (e) { console.warn('[openTeacherAssignmentModal] Error wiring grade level listener:', e); }

    try {
        const advisorySelect = document.getElementById('assignAdvisorySection');
        const teachingSelect = document.getElementById('assignTeachingSections');
        const advisoryCount = advisorySelect ? advisorySelect.options.length : 0;
        const teachingCount = teachingSelect ? teachingSelect.options.length : 0;
        console.log('[openTeacherAssignmentModal] options after initial load - advisory:', advisoryCount, 'teaching:', teachingCount);

        if ((advisoryCount <= 1) && (teachingCount <= 1)) {
            console.warn('[openTeacherAssignmentModal] Dropdowns still empty; running fallback populate');
            try {
                const endpoint = activeSchoolYearId ? `/api/sections/by-school-year/${activeSchoolYearId}` : '/api/sections';
                const resp = await apiFetch(endpoint);
                if (resp.ok) {
                    const sections = await resp.json();
                    if (Array.isArray(sections) && sections.length) {
                        // Store sections for grade level filtering
                        window.allSectionsForAdvisory = sections;
                        console.log('[openTeacherAssignmentModal] Fallback stored', sections.length, 'sections for filtering');
                    } else {
                        console.warn('[openTeacherAssignmentModal] Fallback: no sections returned from API');
                    }
                } else {
                    console.error('[openTeacherAssignmentModal] Fallback fetch failed:', resp.status);
                }
            } catch (err) {
                console.error('[openTeacherAssignmentModal] Fallback error:', err);
            }
        }

        if (advisorySelect) { advisorySelect.disabled = false; advisorySelect.style.visibility = 'visible'; }
        if (teachingSelect) { teachingSelect.disabled = false; teachingSelect.style.visibility = 'visible'; }
    } catch (err) {
        console.error('[openTeacherAssignmentModal] Post-show verification error:', err);
    }
}

// Close teacher assignment modal
function closeTeacherAssignmentModal() {
    const modal = document.getElementById('teacherAssignmentModal');
    if (modal) {
        modal.setAttribute('aria-hidden', 'true');
        modal.style.display = 'none';
    }
    teacherToAssign = null;
}

    // Open subject assignment modal (separate modal for assigning subjects & sections)
    async function openSubjectAssignmentModal(teacherId) {
        const teacher = allTeachers.find(t => t.id === teacherId);
        if (!teacher) { showNotification('Teacher not found', 'error'); return; }

        // Determine teacher level to decide which modal to open
        const lvl = (typeof detectTeacherLevel === 'function') ? detectTeacherLevel(teacher) : null;
        const isSHS = lvl === 'shs' || lvl === 'senior' || lvl === 'senior_high';

        // Ensure active school year and sections are loaded
        await loadActiveSchoolYearForAssignment();
        let loadedSections = await loadSectionsForAssignment();
        if ((!Array.isArray(loadedSections) || loadedSections.length === 0) && Array.isArray(teacher.assigned_sections) && teacher.assigned_sections.length > 0) {
            const fallbackSections = teacher.assigned_sections
                .map(s => ({
                    id: s.id ?? s.section_id ?? s.sectionId,
                    section_name: s.section_name ?? s.name ?? s.section_code ?? '',
                    section_code: s.section_code ?? s.section_name ?? '',
                    grade_level: s.grade_level ?? s.grade ?? s.level ?? ''
                }))
                .filter(s => s.id !== null && s.id !== undefined);
            if (fallbackSections.length > 0) {
                window._sectionsCache = fallbackSections;
                window.allSectionsForAdvisory = fallbackSections;
                console.warn('[openSubjectAssignmentModal] Using teacher-assigned sections fallback:', fallbackSections.length);
            }
        }
        try { await loadAvailableSubjectsForTeacher(teacher); } catch(e){}

        if (isSHS) {
            // Open SHS Modal with cascade filtering
            await openSubjectAssignmentModalSHS(teacherId);
        } else {
            // Open JHS Modal (original simple modal)
            await openSubjectAssignmentModalJHS(teacherId);
        }
    }

    // Open SHS Subject Assignment Modal with Grade/Section/Subject cascade
    async function openSubjectAssignmentModalSHS(teacherId) {
        const teacher = allTeachers.find(t => t.id === teacherId);
        if (!teacher) { showNotification('Teacher not found', 'error'); return; }
        window.teacherToAssign = teacher;

        const btnIdInput = document.getElementById('subjectAssignTeacherIdSHS');
        const nameEl = document.getElementById('subjectAssignTeacherNameSHS');
        const emailEl = document.getElementById('subjectAssignTeacherEmailSHS');
        if (btnIdInput) btnIdInput.value = teacher.id;
        if (nameEl) nameEl.textContent = teacher.name || '--';
        if (emailEl) emailEl.textContent = teacher.email || '--';

        // SHS uses grades 11-12 only
        window._subjectOptionsForModal = Array.isArray(window.AVAILABLE_SUBJECTS) && window.AVAILABLE_SUBJECTS.length ? window.AVAILABLE_SUBJECTS : [];
        window._allowedGradesForModal = ['11','12'];

        // Clear modal container and load existing assignments for this teacher
        try { document.getElementById('subjectModalSubjectLoadsContainerSHS').innerHTML = '<p class="no-data">Loading...</p>'; } catch(e){}
        await loadTeacherSubjectAssignments(teacherId, 'subjectModalSubjectLoadsContainerSHS', window._subjectOptionsForModal, ['11','12']);
        
        // If no assignments were loaded, add an empty row pre-populated with allowed subjects/grades
        try {
            const c = document.getElementById('subjectModalSubjectLoadsContainerSHS');
            if (c && c.querySelectorAll('.ta-subject-row').length === 0) {
                addTeachingSubjectRow(null, 'subjectModalSubjectLoadsContainerSHS', window._subjectOptionsForModal, ['11','12']);
            }
        } catch (e) {
            console.warn('[openSubjectAssignmentModalSHS] Error ensuring subject rows:', e);
        }

        const modal = document.getElementById('subjectAssignmentModalSHS');
        if (modal) { modal.setAttribute('aria-hidden','false'); modal.style.display = 'flex'; modal.style.pointerEvents = 'auto'; }
        
        console.log('[openSubjectAssignmentModalSHS] SHS Modal opened for teacher:', teacher.name);
    }

    // Open JHS Subject Assignment Modal (original simple version, grades 7-10)
    async function openSubjectAssignmentModalJHS(teacherId) {
        const teacher = allTeachers.find(t => t.id === teacherId);
        if (!teacher) { showNotification('Teacher not found', 'error'); return; }
        window.teacherToAssign = teacher;

        const btnIdInput = document.getElementById('subjectAssignTeacherId');
        const nameEl = document.getElementById('subjectAssignTeacherName');
        const emailEl = document.getElementById('subjectAssignTeacherEmail');
        if (btnIdInput) btnIdInput.value = teacher.id;
        if (nameEl) nameEl.textContent = teacher.name || '--';
        if (emailEl) emailEl.textContent = teacher.email || '--';

        // JHS subjects and grades
        const jhsSubjects = ['Mathematics','Science','English','Filipino','Araling Panlipunan','MAPEH','TLE','ESP'];
        const subjectOptions = jhsSubjects;
        const allowedGrades = ['7','8','9','10'];
        
        // Expose for the Add Row button to use
        window._subjectOptionsForModal = subjectOptions;
        window._allowedGradesForModal = allowedGrades;

        // Clear modal container and load existing assignments for this teacher (pass subject/grade constraints)
        try { document.getElementById('subjectModalSubjectLoadsContainer').innerHTML = '<p class="no-data">Loading...</p>'; } catch(e){}
        await loadTeacherSubjectAssignments(teacherId, 'subjectModalSubjectLoadsContainer', subjectOptions, allowedGrades);
        
        // If no assignments were loaded, add an empty row pre-populated with allowed subjects/grades
        try {
            const c = document.getElementById('subjectModalSubjectLoadsContainer');
            if (c && c.querySelectorAll('.ta-subject-row').length === 0) {
                addTeachingSubjectRow(null, 'subjectModalSubjectLoadsContainer', subjectOptions, allowedGrades);
            }
        } catch (e) {
            console.warn('[openSubjectAssignmentModalJHS] Error ensuring subject rows:', e);
        }

        const modal = document.getElementById('subjectAssignmentModal');
        if (modal) { modal.setAttribute('aria-hidden','false'); modal.style.display = 'flex'; modal.style.pointerEvents = 'auto'; }
        
        console.log('[openSubjectAssignmentModalJHS] JHS Modal opened for teacher:', teacher.name);
    }

    try {
        window.openTeacherAssignmentModal = openTeacherAssignmentModal;
        window.closeTeacherAssignmentModal = closeTeacherAssignmentModal;
        window.openSubjectAssignmentModal = openSubjectAssignmentModal;
        window.openSubjectAssignmentModalSHS = openSubjectAssignmentModalSHS;
        window.openSubjectAssignmentModalJHS = openSubjectAssignmentModalJHS;
    } catch (_err) {}

    // Submit subject assignments from modal

    // === CASCADE LISTENERS FOR MODAL-LEVEL DROPDOWNS (REMOVED) ===
    // The Grade Level, Section, and Subject dropdowns in the SHS modal header have been removed.
    // Cascade filtering now happens on a per-row basis in addTeachingSubjectRow() instead.
    // The following functions are kept for reference but no longer called.

    /*
    function wireSHSCascadeListeners() {
        const gradeSelect = document.getElementById('shsGradeLevel');
        const sectionSelect = document.getElementById('shsSection');
        const subjectSelect = document.getElementById('shsSubject');

        if (gradeSelect) {
            gradeSelect.removeEventListener('change', shsGradeChangedHandler);
            gradeSelect.addEventListener('change', shsGradeChangedHandler);
        }
        if (sectionSelect) {
            sectionSelect.removeEventListener('change', shsSectionChangedHandler);
            sectionSelect.addEventListener('change', shsSectionChangedHandler);
        }
        console.log('[wireSHSCascadeListeners] Event listeners wired for SHS cascade filtering');
    }

    // Handler for grade level change - populate sections dropdown
    async function shsGradeChangedHandler() {
        const gradeSelect = document.getElementById('shsGradeLevel');
        const sectionSelect = document.getElementById('shsSection');
        const subjectSelect = document.getElementById('shsSubject');
        
        const selectedGrade = gradeSelect?.value;
        
        // Clear section and subject dropdowns
        if (sectionSelect) sectionSelect.innerHTML = '<option value="">-- Select Section --</option>';
        if (subjectSelect) subjectSelect.innerHTML = '<option value="">-- Select Subject --</option>';
        
        if (!selectedGrade) return;
        
        // Get all sections and filter by selected grade
        const sections = window.allSectionsForAdvisory || window._sectionsCache || [];
        const filtered = sections.filter(s => {
            const sGrade = (s.grade_level || s.grade || s.gradeLevel || s.level || '').toString();
            return sGrade === selectedGrade;
        });
        
        if (sectionSelect) {
            filtered.forEach(s => {
                const option = new Option(s.section_name || s.section_code || ('Section ' + s.id), s.id);
                sectionSelect.appendChild(option);
            });
        }
        
        console.log('[shsGradeChangedHandler] Grade selected:', selectedGrade, '- Found sections:', filtered.length);
    }

    // Handler for section change - populate subjects dropdown with ONLY core subjects + section-specific electives
    async function shsSectionChangedHandler() {
        const sectionSelect = document.getElementById('shsSection');
        const subjectSelect = document.getElementById('shsSubject');
        
        const selectedSectionId = sectionSelect?.value;
        const selectedSectionText = sectionSelect?.options[sectionSelect.selectedIndex]?.text || 'unknown';
        
        if (subjectSelect) subjectSelect.innerHTML = '<option value="">-- Select Subject --</option>';
        
        console.log('[shsSectionChangedHandler] Section selected:', selectedSectionId, 'Text:', selectedSectionText);
        
        if (!selectedSectionId) {
            console.log('[shsSectionChangedHandler] No section ID, returning early');
            return;
        }
        
        // Always include core subjects
        const coreSubjects = window.SHS_CORE_SUBJECTS || [
            'Effective Communication / Mabisang Komunikasyon',
            'Life Skills',
            'Pag-aaral ng Kasaysayan at Lipunang Pilipino',
            'General Mathematics',
            'General Science'
        ];
        
        // Fetch ONLY section-specific electives assigned to this section
        let sectionElectives = [];
        try {
            console.log('[shsSectionChangedHandler] Fetching from /api/electives/section/' + selectedSectionId);
            const res = await apiFetch(`/api/electives/section/${selectedSectionId}`);
            console.log('[shsSectionChangedHandler] API response status:', res.status);
            if (res.ok) {
                const data = await res.json();
                console.log('[shsSectionChangedHandler] API response data:', data);
                if (Array.isArray(data)) {
                    sectionElectives = data.map(e => e.subject_name || e.name || e.subject || '').filter(Boolean);
                } else if (data.electives && Array.isArray(data.electives)) {
                    sectionElectives = data.electives.map(e => e.subject_name || e.name || e.subject || '').filter(Boolean);
                }
            } else {
                console.warn('[shsSectionChangedHandler] API returned status', res.status);
            }
        } catch (e) {
            console.warn('[shsSectionChangedHandler] Error fetching section electives from API:', e);
        }
        
        // Combine ONLY core subjects + section-specific electives (remove duplicates)
        const allSubjects = Array.from(new Set([
            ...coreSubjects,
            ...sectionElectives
        ])).sort();
        
        console.log('[shsSectionChangedHandler] Final subjects:', allSubjects);
        
        if (subjectSelect) {
            allSubjects.forEach(subj => {
                const option = new Option(subj, subj);
                subjectSelect.appendChild(option);
            });
        }
        
        console.log('[shsSectionChangedHandler] Display: Section=' + selectedSectionText + ' ID=' + selectedSectionId + ' | Core:' + coreSubjects.length + ' Electives:' + sectionElectives.length + ' Total:' + allSubjects.length);
    }
    */


    async function submitSubjectAssignmentsModal() {
        try {
            async function resolveEffectiveSchoolYearId() {
                if (activeSchoolYearId) return activeSchoolYearId;

                try {
                    if (typeof loadActiveSchoolYearForAssignment === 'function') {
                        await loadActiveSchoolYearForAssignment();
                        if (activeSchoolYearId) return activeSchoolYearId;
                    }
                } catch (_err) {}

                try {
                    const response = await apiFetch('/api/school-years/active');
                    if (!response.ok) return null;
                    const payload = await response.json();
                    const active = payload && payload.active ? payload.active : payload;
                    const resolvedId = Number(active && (active.id || active.school_year_id || active.schoolYearId));
                    if (Number.isFinite(resolvedId) && resolvedId > 0) {
                        activeSchoolYearId = resolvedId;
                        return resolvedId;
                    }
                } catch (_err) {}

                return null;
            }

            const tid = document.getElementById('subjectAssignTeacherId')?.value;
            if (!tid) { showNotification('No teacher selected', 'error'); return; }
            const loads = collectTeachingSubjectLoads('subjectModalSubjectLoadsContainer');
            console.log('[submitSubjectAssignmentsModal] Collected loads:', loads);
            if (!loads || loads.length === 0) { showNotification('Please add at least one subject assignment', 'error'); return; }

            const schoolYearId = await resolveEffectiveSchoolYearId();
            if (!schoolYearId) {
                showNotification('No active school year found. Please activate a school year first.', 'error');
                return;
            }
            
            const payload = {
                teacher_id: parseInt(tid),
                role: (allTeachers.find(t=>String(t.id)===String(tid))||{}).role || 'Subject Teacher',
                sections: [],  // For subject assignments, don't populate sections array - sections are within subject_loads
                subject_loads: loads,  // Subject assignments with embedded section IDs
                school_year_id: schoolYearId
            };
            
            console.log('[submitSubjectAssignmentsModal] Saving subject assignments:', JSON.stringify(payload, null, 2));
            
            const res = await apiFetch('/api/teacher-auth/assign-role', {
                method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)
            });
            if (!res.ok) { const err = await res.json(); showNotification(err.error||'Failed to save', 'error'); return; }
            const data = await res.json();
            console.log('[submitSubjectAssignmentsModal] Response:', data);

            const expectedCount = countSubmittedSubjectAssignmentPairs(loads);
            try {
                const storedCount = await verifyStoredSubjectAssignmentsCount(parseInt(tid, 10), Number(schoolYearId));
                showNotification(`Subject assignments saved. Verified ${storedCount} stored assignment${storedCount === 1 ? '' : 's'}.`, 'success');
                if (storedCount !== expectedCount) {
                    showNotification(`Verification mismatch: submitted ${expectedCount}, stored ${storedCount}.`, 'warning');
                }
            } catch (verificationError) {
                console.warn('[submitSubjectAssignmentsModal] Verification error:', verificationError);
                showNotification('Subject assignments saved, but verification count could not be confirmed.', 'info');
            }

            // close and refresh
            const modal = document.getElementById('subjectAssignmentModal'); if (modal) { modal.setAttribute('aria-hidden','true'); modal.style.display='none'; }
            await loadTeachersForAdmin();
            try { renderTeachingAssignmentsTeacherTables(); } catch(e){}
            try { if (typeof window.loadTeachingAssignmentsV2 === 'function') await window.loadTeachingAssignmentsV2(); } catch(e){}
        } catch (err) { console.error('[submitSubjectAssignmentsModal] Error:', err); showNotification('Error saving assignments', 'error'); }
    }

    // Submit SHS subject assignments from modal
    async function submitSubjectAssignmentsModalSHS() {
        try {
            async function resolveEffectiveSchoolYearId() {
                if (activeSchoolYearId) return activeSchoolYearId;

                try {
                    if (typeof loadActiveSchoolYearForAssignment === 'function') {
                        await loadActiveSchoolYearForAssignment();
                        if (activeSchoolYearId) return activeSchoolYearId;
                    }
                } catch (_err) {}

                try {
                    const response = await apiFetch('/api/school-years/active');
                    if (!response.ok) return null;
                    const payload = await response.json();
                    const active = payload && payload.active ? payload.active : payload;
                    const resolvedId = Number(active && (active.id || active.school_year_id || active.schoolYearId));
                    if (Number.isFinite(resolvedId) && resolvedId > 0) {
                        activeSchoolYearId = resolvedId;
                        return resolvedId;
                    }
                } catch (_err) {}

                return null;
            }

            const tid = document.getElementById('subjectAssignTeacherIdSHS')?.value;
            if (!tid) { showNotification('No teacher selected', 'error'); return; }
            const loads = collectTeachingSubjectLoads('subjectModalSubjectLoadsContainerSHS');
            console.log('[submitSubjectAssignmentsModalSHS] Collected loads:', loads);
            if (!loads || loads.length === 0) { showNotification('Please add at least one subject assignment', 'error'); return; }

            const schoolYearId = await resolveEffectiveSchoolYearId();
            if (!schoolYearId) {
                showNotification('No active school year found. Please activate a school year first.', 'error');
                return;
            }
            
            const payload = {
                teacher_id: parseInt(tid),
                role: (allTeachers.find(t=>String(t.id)===String(tid))||{}).role || 'Subject Teacher',
                sections: [],  // For subject assignments, don't populate sections array - sections are within subject_loads
                subject_loads: loads,  // Subject assignments with embedded section IDs
                school_year_id: schoolYearId
            };
            
            console.log('[submitSubjectAssignmentsModalSHS] Saving SHS subject assignments:', JSON.stringify(payload, null, 2));
            
            const res = await apiFetch('/api/teacher-auth/assign-role', {
                method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)
            });
            if (!res.ok) { const err = await res.json(); showNotification(err.error||'Failed to save', 'error'); return; }
            const data = await res.json();
            console.log('[submitSubjectAssignmentsModalSHS] Response:', data);

            const expectedCount = countSubmittedSubjectAssignmentPairs(loads);
            try {
                const storedCount = await verifyStoredSubjectAssignmentsCount(parseInt(tid, 10), Number(schoolYearId));
                showNotification(`SHS subject assignments saved. Verified ${storedCount} stored assignment${storedCount === 1 ? '' : 's'}.`, 'success');
                if (storedCount !== expectedCount) {
                    showNotification(`Verification mismatch: submitted ${expectedCount}, stored ${storedCount}.`, 'warning');
                }
            } catch (verificationError) {
                console.warn('[submitSubjectAssignmentsModalSHS] Verification error:', verificationError);
                showNotification('SHS assignments saved, but verification count could not be confirmed.', 'info');
            }

            // close and refresh
            const modal = document.getElementById('subjectAssignmentModalSHS'); if (modal) { modal.setAttribute('aria-hidden','true'); modal.style.display='none'; }
            await loadTeachersForAdmin();
            try { renderTeachingAssignmentsTeacherTables(); } catch(e){}
            try { if (typeof window.loadTeachingAssignmentsV2 === 'function') await window.loadTeachingAssignmentsV2(); } catch(e){}
        } catch (err) { console.error('[submitSubjectAssignmentsModalSHS] Error:', err); showNotification('Error saving SHS assignments', 'error'); }
    }

    try {
        window.addTeachingSubjectRow = addTeachingSubjectRow;
        window.collectTeachingSubjectLoads = collectTeachingSubjectLoads;
        window.submitSubjectAssignmentsModal = submitSubjectAssignmentsModal;
        window.submitSubjectAssignmentsModalSHS = submitSubjectAssignmentsModalSHS;
    } catch (_err) {}

// Submit teacher role assignment
async function submitTeacherRoleAssignment() {
    try {
        const teacherId = document.getElementById('assignTeacherId').value;
        const role = document.getElementById('assignRole').value;
        const selectedIdsInput = document.getElementById('selectedAdviserSectionIds');

        // Collect advisory section(s) from stored selections
        let advisoryIds = [];
        if (role === 'Adviser' && selectedIdsInput && selectedIdsInput.value) {
            try {
                const selections = JSON.parse(selectedIdsInput.value);
                advisoryIds = selections.map(s => s.id);
                console.log('[submitTeacherRoleAssignment] Loaded advisory sections from storage:', advisoryIds);
            } catch (e) {
                console.warn('[submitTeacherRoleAssignment] Error parsing selected sections:', e);
            }
        }

        if (!teacherId || !role) {
            showNotification('Please fill all required fields', 'error');
            return;
        }

        const schoolYearId = activeSchoolYearId;
        if (!schoolYearId) {
            showNotification('No active school year is set. Please activate a school year in the School Years tab before assigning advisers.', 'error');
            return;
        }

        if (role === 'Adviser') {
            // require at least one advisory section
            if (!advisoryIds || advisoryIds.length === 0) {
                showNotification('Please select at least one advisory section for Adviser role', 'error');
                return;
            }
        }

        console.log('[submitTeacherRoleAssignment] Submitting assignment...', {
            teacher_id: teacherId,
            role,
            advisory_section_ids: advisoryIds.map(s => parseInt(s)),
            school_year_id: schoolYearId
        });

        // Build payload for multiple advisory sections
        const payload = {
            teacher_id: parseInt(teacherId),
            role,
            // API expects `sections` array and `school_year_id` when assigning adviser sections
            sections: advisoryIds.length ? advisoryIds.map(v => parseInt(v)) : [],
            advisory_section_id: advisoryIds.length ? parseInt(advisoryIds[0]) : null,
            advisory_section_ids: advisoryIds.length ? advisoryIds.map(v => parseInt(v)) : undefined,
            teaching_sections: [],
            subject_loads: [],
            school_year_id: parseInt(schoolYearId)
        };

        const res = await apiFetch('/api/teacher-auth/assign-role', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errData = await res.json();
            showNotification(errData.error || 'Failed to assign role', 'error');
            return;
        }

        const data = await res.json();
        console.log('[submitTeacherRoleAssignment] Success:', data);

        showNotification(`${role} role assigned successfully to ${data.teacher.name}`, 'success');
        closeTeacherAssignmentModal();

        // Try to update the in-memory teacher and refresh the table immediately
        try {
            const updated = data.teacher || data;
            const tId = parseInt(updated.id || updated.teacher_id || teacherId, 10);
            const teacherIndex = allTeachers.findIndex(t => parseInt(t.id, 10) === tId);
            if (teacherIndex !== -1) {
                // Merge basic fields
                const existing = allTeachers[teacherIndex];
                existing.role = updated.role || existing.role;
                existing.name = updated.name || existing.name;
                existing.email = updated.email || existing.email;

                // If API returned assigned sections, normalize and set them
                if (updated.assigned_sections && Array.isArray(updated.assigned_sections)) {
                    existing.assigned_sections = updated.assigned_sections.map(a => ({
                        section_id: a.section_id || a.id || a.sectionId,
                        section_code: a.section_code || a.section_code || a.section_code,
                        section_name: a.section_name || a.section_name || a.section_name,
                        school_year: a.school_year || a.school_year
                    }));
                } else if (updated.assignments && Array.isArray(updated.assignments)) {
                    existing.assigned_sections = updated.assignments.map(a => ({
                        section_id: a.section_id || a.id,
                        section_code: a.section_code || a.section_code,
                        section_name: a.section_name || a.section_name,
                        school_year: a.school_year || a.school_year
                    }));
                } else if (advisoryIds && advisoryIds.length) {
                    // Fall back: build assigned_sections from advisoryIds and cached sections
                    const cache = window._sectionsCache || [];
                    existing.assigned_sections = advisoryIds.map(id => {
                        const s = cache.find(c => String(c.id) === String(id) || String(c.section_id) === String(id));
                        return {
                            section_id: s ? (s.id || s.section_id) : id,
                            section_code: s ? (s.section_code || s.section_name) : null,
                            section_name: s ? (s.section_name || s.section_code) : null,
                            school_year: activeSchoolYearLabel || null
                        };
                    });
                }

                console.log('[submitTeacherRoleAssignment] Updated in-memory teacher:', existing);
                // Refresh table view and update role cell immediately
                try { refreshTeacherRoleInTable(existing.id, existing.role); } catch(e){}
                filterTeachers();
                try { renderTeachingAssignmentsTeacherTables(); } catch (e) { console.warn('[submitTeacherRoleAssignment] render TA tables failed', e); }
            } else {
                // If teacher not found, fallback to full reload for consistency
                console.warn('[submitTeacherRoleAssignment] Updated teacher not found in memory; reloading full list');
                await loadTeachersForAdmin();
            }
        } catch (err) {
            console.error('[submitTeacherRoleAssignment] Error updating local teacher record:', err);
            // fallback: still reload
            await loadTeachersForAdmin();
        }
    } catch (err) {
        console.error('[submitTeacherRoleAssignment] Error:', err);
        showNotification('Error assigning role: ' + err.message, 'error');
    }
}

// Handle teacher role changes in edit modal
function handleTeacherRoleChange() {
    const roleSelect = document.getElementById('editTeacherRole');
    const sectionSelect = document.getElementById('editSectionSelect');
    
    if (!roleSelect || !sectionSelect) return;
    
    const originalRole = roleSelect.getAttribute('data-original-role');
    const newRole = roleSelect.value;
    
    console.log('[handleTeacherRoleChange] Role changed from', originalRole, 'to', newRole);
    
    // Adviser → Subject Teacher: automatically clear section assignments
    if (originalRole === 'Adviser' && newRole === 'Subject Teacher') {
        console.log('[handleTeacherRoleChange] Adviser → Subject Teacher: clearing section assignments');
        Array.from(sectionSelect.options).forEach(opt => {
            if (opt.value !== '') opt.selected = false;
        });
        showNotification('✓ Sections cleared - Subject Teachers do not require section assignments', 'info');
    }
    // Subject Teacher → Adviser: enable section selection
    else if (originalRole === 'Subject Teacher' && newRole === 'Adviser') {
        console.log('[handleTeacherRoleChange] Subject Teacher → Adviser: enabling section selection');
        // Clear current selections to allow fresh assignment
        Array.from(sectionSelect.options).forEach(opt => {
            if (opt.value !== '') opt.selected = false;
        });
        showNotification('✓ Sections cleared - You can now assign sections to this adviser', 'info');
    }
}

try { window.submitTeacherRoleAssignment = submitTeacherRoleAssignment; } catch (_err) {}

// Open teacher edit sections modal
async function openTeacherEditSectionsModal(teacherId) {
    try {
        const teacher = allTeachers.find(t => t.id === teacherId);
        if (!teacher) {
            showNotification('Teacher not found', 'error');
            return;
        }

        if (!teacher.assigned_sections || teacher.assigned_sections.length === 0) {
            showNotification('This teacher has no assigned sections yet. Use the Assign button to add sections.', 'error');
            return;
        }

        // Ensure active school year is loaded first
        console.log('[openTeacherEditSectionsModal] Ensuring school year is loaded...');
        if (!activeSchoolYearId || !activeSchoolYearLabel) {
            await loadActiveSchoolYearForAssignment();
        }

        // Populate teacher info
        document.getElementById('editTeacherId').value = teacher.id;
        document.getElementById('editTeacherName').textContent = teacher.name || '--';
        document.getElementById('editTeacherEmail').textContent = teacher.email || '--';
        
        // Set role dropdown value and store original for change detection
        const roleSelect = document.getElementById('editTeacherRole');
        const sectionSelect = document.getElementById('editSectionSelect');
        if (roleSelect) {
            const originalRole = teacher.role || 'Subject Teacher';
            roleSelect.value = originalRole;
            roleSelect.setAttribute('data-original-role', originalRole);
            // Also store on section select for submit handler
            if (sectionSelect) {
                sectionSelect.setAttribute('data-original-role', originalRole);
            }
            
            // Remove any existing listener and attach new one
            roleSelect.removeEventListener('change', handleTeacherRoleChange);
            roleSelect.addEventListener('change', handleTeacherRoleChange);
            console.log('[openTeacherEditSectionsModal] Role listener attached. Original role:', originalRole);
        }
        
        document.getElementById('editSchoolYearDisplay').textContent = activeSchoolYearLabel || '--';
        
        console.log('[openTeacherEditSectionsModal] School year loaded:', activeSchoolYearLabel);

        // Load and populate sections with pre-selection
        console.log('[openTeacherEditSectionsModal] Loading sections for teacher:', teacher.name);
        await loadSectionsForEdit(teacher);

        // Show modal
        const modal = document.getElementById('editSectionsModal');
        if (modal) {
            modal.setAttribute('aria-hidden', 'false');
            modal.style.display = 'flex';
            console.log('[openTeacherEditSectionsModal] Modal opened successfully');
        }
    } catch (err) {
        console.error('[openTeacherEditSectionsModal] Error:', err);
        showNotification('Error opening edit modal: ' + err.message, 'error');
    }
}

// Load sections for edit modal with pre-selection
async function loadSectionsForEdit(teacher) {
    try {
        const select = document.getElementById('editSectionSelect');
        if (!select) {
            console.error('[loadSectionsForEdit] editSectionSelect element not found');
            showNotification('Section select element not found', 'error');
            return;
        }

        console.log('[loadSectionsForEdit] Loading sections for teacher:', teacher.name);
        console.log('[loadSectionsForEdit] Teacher assigned_sections:', teacher.assigned_sections);

        // Get assigned section IDs - handle both section_id and id fields
        const assignedIds = new Set();
        teacher.assigned_sections.forEach(s => {
            const id = s.section_id || s.id;
            if (id) assignedIds.add(String(id)); // Store as string for comparison
        });
        console.log('[loadSectionsForEdit] Assigned IDs set:', Array.from(assignedIds));

        // Choose endpoint based on active school year
        let endpoint = '/api/sections';
        if (activeSchoolYearId) {
            endpoint = `/api/sections/by-school-year/${activeSchoolYearId}`;
        }

        console.log('[loadSectionsForEdit] Fetching from:', endpoint);
        let response = await apiFetch(endpoint);
        
        // Fallback to default endpoint if school year endpoint fails
        if (!response.ok && activeSchoolYearId) {
            console.warn('[loadSectionsForEdit] School year endpoint failed, trying default /api/sections');
            response = await apiFetch('/api/sections');
        }
        
        if (!response.ok) throw new Error('HTTP ' + response.status);

        const data = await response.json();
        if (!Array.isArray(data)) throw new Error('API did not return array');

        console.log('[loadSectionsForEdit] Loaded ' + data.length + ' sections');

        // Clear select and add blank option
        select.innerHTML = '';
        
        const opt0 = document.createElement('option');
        opt0.value = '';
        opt0.text = '-- Select Sections (hold Ctrl/Cmd to select) --';
        select.appendChild(opt0);

        // Add all sections and pre-select assigned ones
        let preSelectedCount = 0;
        for (let i = 0; i < data.length; i++) {
            const s = data[i];
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.text = (s.section_name || s.section_code || ('Section ' + s.id));
            
            // Check if this section is assigned to the teacher (compare as strings)
            if (assignedIds.has(String(s.id))) {
                opt.selected = true;
                preSelectedCount++;
                console.log('[loadSectionsForEdit] Pre-selected: ' + opt.text + ' (ID: ' + s.id + ')');
            }
            
            select.appendChild(opt);
        }

        console.log('[loadSectionsForEdit] SUCCESS - Total options: ' + select.options.length + ', Pre-selected: ' + preSelectedCount);
    } catch (err) {
        console.error('[loadSectionsForEdit] ERROR:', err);
        showNotification('Error loading sections: ' + err.message, 'error');
    }
}

// Close edit sections modal
function closeTeacherEditSectionsModal() {
    const modal = document.getElementById('editSectionsModal');
    if (modal) {
        modal.setAttribute('aria-hidden', 'true');
        modal.style.display = 'none';
    }
}

// Submit teacher section assignments edit
async function submitTeacherEditSections() {
    try {
        const teacherId = document.getElementById('editTeacherId').value;
        const selectElement = document.getElementById('editSectionSelect');
        const roleSelect = document.getElementById('editTeacherRole');
        
        if (!teacherId) {
            showNotification('Teacher ID not found in form', 'error');
            console.warn('[submitTeacherEditSections] Missing teacherId');
            return;
        }

        if (!selectElement) {
            showNotification('Section select element not found', 'error');
            console.warn('[submitTeacherEditSections] Missing editSectionSelect');
            return;
        }

        const selectedSections = Array.from(selectElement.selectedOptions || [])
            .map(opt => opt.value)
            .filter(val => val !== '');

        const newRole = roleSelect ? roleSelect.value : null;
        const originalRole = selectElement.dataset.originalRole || null;

        // Auto-clear sections if switching from Adviser to Subject Teacher
        let clearedSections = false;
        if (originalRole === 'Adviser' && newRole === 'Subject Teacher') {
            if (selectedSections.length > 0) {
                console.log('[submitTeacherEditSections] Role change detected: Adviser → Subject Teacher. Auto-clearing sections.');
                showNotification('Role changed to Subject Teacher. Automatically clearing section assignments.', 'info');
                selectElement.value = '';
                selectedSections.length = 0;
                clearedSections = true;
            }
        }

        // Auto-enable section selection if switching from Subject Teacher to Adviser
        if (originalRole === 'Subject Teacher' && newRole === 'Adviser' && selectedSections.length === 0) {
            showNotification('Role changed to Adviser. Please select at least one advisory section.', 'info');
        }

        // Validation: Subject Teachers should not have section assignments
        if (newRole === 'Subject Teacher' && selectedSections.length > 0) {
            showNotification('Subject Teachers cannot have section assignments. Please clear selections or change role to Adviser.', 'error');
            console.warn('[submitTeacherEditSections] Validation failed: Subject Teacher with section assignments');
            return;
        }

        // Validation: Advisers must have at least one section
        if (newRole === 'Adviser' && selectedSections.length === 0) {
            showNotification('Advisers must have at least one section assigned. Please select sections.', 'error');
            console.warn('[submitTeacherEditSections] Validation failed: Adviser with no sections');
            return;
        }

        const schoolYearId = activeSchoolYearId;
        if (!schoolYearId) {
            showNotification('No active school year is set. Please set an active school year in School Years tab.', 'error');
            return;
        }

        console.log('[submitTeacherEditSections] Updating sections and role...', {
            teacher_id: teacherId,
            sections: selectedSections.map(s => parseInt(s)),
            role: newRole,
            school_year_id: schoolYearId
        });

        const res = await apiFetch('/api/teacher-auth/update-sections', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                teacher_id: parseInt(teacherId),
                sections: selectedSections.map(s => parseInt(s)),
                role: newRole,
                school_year_id: parseInt(schoolYearId)
            })
        });

        if (!res.ok) {
            let errMsg = 'Failed to update sections';
            try {
                const errData = await res.json();
                errMsg = errData.error || errMsg;
            } catch (e) {
                errMsg += ` (HTTP ${res.status})`;
            }
            showNotification(errMsg, 'error');
            console.error('[submitTeacherEditSections] API error:', errMsg);
            return;
        }

        const data = await res.json();
        console.log('[submitTeacherEditSections] Success:', data);

        showNotification(`Section assignments updated successfully for ${data.teacher.name}`, 'success');
        closeTeacherEditSectionsModal();
        
        // Update in-memory teacher (if returned) and refresh role cell immediately
        try {
            const updated = data.teacher || data;
            const tId = parseInt(updated.id || updated.teacher_id || teacherId, 10);
            const teacherIndex = allTeachers.findIndex(t => parseInt(t.id, 10) === tId);
            if (teacherIndex !== -1) {
                const existing = allTeachers[teacherIndex];
                existing.role = updated.role || existing.role;
                // normalize assigned sections if provided
                if (updated.assigned_sections && Array.isArray(updated.assigned_sections)) {
                    existing.assigned_sections = updated.assigned_sections.map(a => ({
                        section_id: a.section_id || a.id || a.sectionId,
                        section_code: a.section_code || a.section_code || a.section_code,
                        section_name: a.section_name || a.section_name || a.section_name,
                        school_year: a.school_year || a.school_year
                    }));
                }
                try { refreshTeacherRoleInTable(existing.id, existing.role); } catch(e){}
                try { renderTeachingAssignmentsTeacherTables(); } catch(e){}
            }
        } catch (e) {
            console.warn('[submitTeacherEditSections] Could not update in-memory teacher after sections update', e);
        }

        console.log('[submitTeacherEditSections] Waiting 500ms before reloading teachers...');
        await new Promise(resolve => setTimeout(resolve, 500));
        await loadTeachersForAdmin();
    } catch (err) {
        console.error('[submitTeacherEditSections] Exception:', err);
        showNotification('Error updating sections: ' + (err.message || String(err)), 'error');
    }
}

// Helper function to escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Update the Role column for a single teacher row in the Teaching Assignments tables
function refreshTeacherRoleInTable(teacherId, newRole) {
    try {
        // update JHS table rows
        ['taTeachersJHSBody','taTeachersSHSBody'].forEach(bodyId => {
            const tbody = document.getElementById(bodyId);
            if (!tbody) return;
            // find the row that contains the teacher id in the first cell
            for (let r = 0; r < tbody.rows.length; r++) {
                const row = tbody.rows[r];
                if (!row) continue;
                const idCell = row.cells[0];
                if (!idCell) continue;
                // compare by text content matching teacher.teacher_id or empty
                const cellText = (idCell.textContent || '').trim();
                // some tables show teacher.teacher_id in first column; match numeric id or teacher id
                if (String(cellText) === String(teacherId) || String(row.getAttribute('data-teacher-id')) === String(teacherId)) {
                    // Role is in the 5th cell (index 4) per renderTeachingAssignmentsTeacherTables
                    const roleCell = row.cells[4];
                    if (roleCell) {
                        roleCell.innerHTML = newRole ? escapeHtml(newRole) : '<span style="color:#999;">Not Assigned</span>';
                    }
                    return;
                }
            }
        });
    } catch (e) {
        console.warn('[refreshTeacherRoleInTable] failed', e);
    }
}

// Detect overlay elements that may block UI interactions and make them non-interactive
function detectBlockingOverlays() {
    try {
        // Conservative overlay neutralizer: only target full-viewport opaque backdrops
        const candidates = [];
        // common backdrop selectors
        ['.modal-backdrop', '.overlay', '.blocking-overlay', '.backdrop'].forEach(sel => {
            document.querySelectorAll(sel).forEach(el => candidates.push(el));
        });

        // add high z-index fixed/absolute elements as candidates
        document.querySelectorAll('body *').forEach(el => {
            try {
                const cs = getComputedStyle(el);
                if (!cs) return;
                const z = parseInt(cs.zIndex) || 0;
                if ((cs.position === 'fixed' || cs.position === 'absolute') && z >= 500 && cs.display !== 'none' && cs.visibility !== 'hidden') {
                    candidates.push(el);
                }
            } catch (e) {}
        });

        const handled = new Set();
        candidates.forEach(el => {
            if (!el || handled.has(el)) return;
            handled.add(el);
            try {
                // Skip actual modals or dialog elements to avoid disabling interaction
                const role = el.getAttribute && el.getAttribute('role');
                const id = el.id || '';
                const cls = el.className || '';
                if (role === 'dialog' || /modal/i.test(id) || /modal/i.test(cls) || el.closest && el.closest('.modal') ) {
                    return;
                }

                const rect = el.getBoundingClientRect();
                const coversViewport = rect.width >= window.innerWidth * 0.9 && rect.height >= window.innerHeight * 0.9 && rect.top <= 5 && rect.left <= 5;
                const cs = getComputedStyle(el);
                const opacity = parseFloat(cs.opacity || '1');

                // Only neutralize elements that visibly cover most of the viewport and are opaque/backdrop-like
                if (coversViewport && opacity > 0.1) {
                    el.style.pointerEvents = 'none';
                    el.setAttribute('data-detectBlockingOverlays', 'true');
                    console.warn('[detectBlockingOverlays] neutralized overlay element', el);
                }
            } catch (e) {
                console.warn('[detectBlockingOverlays] error modifying candidate', e);
            }
        });

        return handled.size > 0;
    } catch (err) {
        console.warn('[detectBlockingOverlays] error', err);
        return false;
    }
}

function forceInteractiveRecovery() {
    try {
        document.body.classList.remove('modal-open');
        if (window.innerWidth > 768) {
            document.body.classList.remove('sidebar-open');
        }
        document.body.style.overflow = '';

        document.querySelectorAll('.modal').forEach((modal) => {
            const isOpen = modal.classList.contains('active') || modal.getAttribute('aria-hidden') === 'false';
            if (!isOpen) {
                modal.classList.remove('active');
                modal.setAttribute('aria-hidden', 'true');
                modal.style.display = 'none';
                modal.style.pointerEvents = 'none';
            } else {
                modal.style.pointerEvents = 'auto';
            }
        });

        const chatPanel = document.getElementById('chatPanel');
        if (chatPanel && chatPanel.getAttribute('aria-hidden') !== 'false') {
            chatPanel.style.display = 'none';
            chatPanel.style.pointerEvents = 'none';
        }

        detectBlockingOverlays();
    } catch (err) {
        console.warn('[forceInteractiveRecovery] error', err);
    }
}

function setupSidebarNavigationFallback() {
    try {
        if (window.__sidebarFallbackBound) return;
        const sidebarMenu = document.querySelector('.sidebar-menu');
        if (!sidebarMenu) return;

        const showSection = (sectionId) => {
            if (!sectionId) return;
            const normalizedSectionId = sectionId === 'teaching-assignments' ? 'teacher-registration' : sectionId;
            const target = document.getElementById(normalizedSectionId);
            if (!target) return;
            document.querySelectorAll('.section').forEach((section) => section.classList.remove('active'));
            target.classList.add('active');

            try {
                if (sectionId === 'teacher-registration' || sectionId === 'teaching-assignments') {
                    if (typeof loadTeachersForAdmin === 'function') {
                        loadTeachersForAdmin();
                    }
                    if (sectionId === 'teaching-assignments') {
                        if (typeof window.switchTeachersMainTab === 'function') {
                            try { window.switchTeachersMainTab('assignments'); } catch (_err) {}
                        } else if (typeof window.loadTeachingAssignmentsV2 === 'function') {
                            setTimeout(() => {
                                try { window.loadTeachingAssignmentsV2(); } catch (_err) {}
                            }, 250);
                        }
                    }
                }
            } catch (_err) {}
        };

        sidebarMenu.addEventListener('click', (event) => {
            const toggle = event.target.closest('.menu-toggle');
            if (toggle) {
                event.preventDefault();
                event.stopPropagation();
                const group = toggle.closest('.menu-group');
                if (!group) return;
                const expanded = group.classList.toggle('expanded');
                toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
                const submenu = group.querySelector('.submenu');
                if (submenu) submenu.setAttribute('aria-hidden', expanded ? 'false' : 'true');
                return;
            }

            const menuItem = event.target.closest('.menu-item[data-section]');
            if (!menuItem) return;

            event.preventDefault();
            event.stopPropagation();

            document.querySelectorAll('.sidebar-menu .menu-item').forEach((node) => node.classList.remove('active'));
            menuItem.classList.add('active');
            showSection(menuItem.getAttribute('data-section'));
        }, true);

        window.__sidebarFallbackBound = true;
    } catch (err) {
        console.warn('[setupSidebarNavigationFallback] error', err);
    }
}

// Check admin is logged in
// Initialize teacher registration tab handlers and trigger initial load
function initTeacherRegistrationTab() {
    try {
        const searchInput = document.getElementById('teacherSearchInput');
        const roleFilter = document.getElementById('teacherRoleFilter');
        const sortBy = document.getElementById('teacherSortBy');
        const refreshBtn = document.getElementById('teacherRefreshBtn') || document.getElementById('refreshTeachersBtn') || document.getElementById('refreshBtn');

        if (searchInput) {
            searchInput.addEventListener('input', () => filterTeachers());
            searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') filterTeachers(); });
        }
        if (roleFilter) roleFilter.addEventListener('change', () => filterTeachers());
        if (sortBy) sortBy.addEventListener('change', () => filterTeachers());
        if (refreshBtn) refreshBtn.addEventListener('click', () => loadTeachersForAdmin());

        // Ensure initial filter state is neutral so teachers show by default
        try {
            if (searchInput) searchInput.value = '';
            if (roleFilter) roleFilter.value = '';
            if (sortBy) sortBy.value = 'created_at';
            console.log('[initTeacherRegistrationTab] Cleared teacher search and role filter to default');
        } catch (e) { console.warn('[initTeacherRegistrationTab] Could not reset filters', e); }

        // Role select change handler for Assign modal
        const assignRoleEl = document.getElementById('assignRole');
        if (assignRoleEl) {
            assignRoleEl.addEventListener('change', () => handleAssignRoleChange(assignRoleEl.value));
        }

        // Grade level filter for advisory sections
        const advisoryGradeEl = document.getElementById('advisoryGradeLevel');
        if (advisoryGradeEl) {
            advisoryGradeEl.addEventListener('change', () => filterSectionsByGradeLevel());
        }

        // Add adviser sections button
        const addAdviserSectionsBtn = document.getElementById('addAdviserSectionsBtn');
        if (addAdviserSectionsBtn) {
            addAdviserSectionsBtn.addEventListener('click', () => addAdviserSections());
        }

        // Attempt to load teachers once API is available; fall back to immediate call
        try {
            ensureApiAvailable().then(() => {
                if (typeof loadTeachersForAdmin === 'function') {
                    loadTeachersForAdmin();
                } else {
                    console.warn('[initTeacherRegistrationTab] loadTeachersForAdmin not defined yet; will retry shortly');
                    setTimeout(() => { if (typeof loadTeachersForAdmin === 'function') loadTeachersForAdmin(); else console.error('[initTeacherRegistrationTab] loadTeachersForAdmin still not defined'); }, 500);
                }
            }).catch(() => {
                if (typeof loadTeachersForAdmin === 'function') {
                    loadTeachersForAdmin();
                } else {
                    console.warn('[initTeacherRegistrationTab] loadTeachersForAdmin not defined in catch; retrying shortly');
                    setTimeout(() => { if (typeof loadTeachersForAdmin === 'function') loadTeachersForAdmin(); else console.error('[initTeacherRegistrationTab] loadTeachersForAdmin still not defined (catch)'); }, 500);
                }
            });
        } catch (e) {
            // ensureApiAvailable might not be defined yet; call load directly if available
            if (typeof loadTeachersForAdmin === 'function') {
                try { loadTeachersForAdmin(); } catch (err) { console.warn('Failed to auto-load teachers', err); }
            } else {
                console.warn('[initTeacherRegistrationTab] ensureApiAvailable threw and loadTeachersForAdmin is not defined');
            }
        }
    } catch (err) {
        console.error('[initTeacherRegistrationTab] Error initializing handlers', err);
    }
}

// Handle showing/hiding advisory fields when role selection changes
function handleAssignRoleChange(role) {
    try {
        const advisoryGroup = document.getElementById('advisorySectionGroup');
        if (!advisoryGroup) return;

        if (role === 'Adviser') {
            advisoryGroup.style.display = 'block';
        } else {
            advisoryGroup.style.display = 'none';
            // hide any previous conflict warnings when not assigning adviser
            try {
                const warn = document.getElementById('adviserConflictWarning');
                if (warn) { warn.style.display = 'none'; }
            } catch (e) { }
        }
    } catch (err) { console.warn('[handleAssignRoleChange] error', err); }
}

// Ensure advisory rows container exists and has at least one row
function ensureAdvisoryRowsInitialized() {
    const advisoryGroup = document.getElementById('advisorySectionGroup');
    if (!advisoryGroup) return;
    let container = document.getElementById('advisoryRowsContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'advisoryRowsContainer';
        container.style.display = 'block';
        advisoryGroup.innerHTML = '';
        // add label
        const label = document.createElement('label');
        label.textContent = 'Advisory Sections (select grade then section)';
        advisoryGroup.appendChild(label);
        advisoryGroup.appendChild(container);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-sm btn-outline';
        btn.style = 'margin-top:8px;';
        btn.textContent = 'Add Advisory Section';
        btn.onclick = () => addAdvisoryRow();
        advisoryGroup.appendChild(btn);
    }
    // ensure at least one row
    if (container.children.length === 0) addAdvisoryRow();
}

function addAdvisoryRow(initialGrade, initialSection) {
    const container = document.getElementById('advisoryRowsContainer');
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'advisory-row';
    row.style = 'display:flex;gap:8px;align-items:center;margin-top:8px;';

    const gradeSelect = document.createElement('select');
    gradeSelect.className = 'assignGradeSelect';
    gradeSelect.appendChild(new Option('-- Grade Level --', ''));
    // populate grade options from cached sections
    const grades = Object.keys(window._sectionsByGrade || {}).filter(g => g !== 'Unknown').sort((a,b)=> parseInt(a)-parseInt(b));
    grades.forEach(g => gradeSelect.appendChild(new Option('Grade ' + g, g)));
    if (initialGrade) gradeSelect.value = initialGrade;

    const secSelect = document.createElement('select');
    secSelect.className = 'assignAdvisorySectionSelect';
    secSelect.appendChild(new Option('-- Select Section --', ''));
    if (initialSection) secSelect.appendChild(new Option(initialSection.display || initialSection, initialSection.id || initialSection));

    gradeSelect.addEventListener('change', () => {
        const g = gradeSelect.value;
        // populate secSelect
        secSelect.innerHTML = '';
        secSelect.appendChild(new Option('-- Select Section --', ''));
        const secs = (window._sectionsByGrade && window._sectionsByGrade[g]) ? window._sectionsByGrade[g] : [];
        secs.forEach(s => secSelect.appendChild(new Option((s.section_name||s.section_code||('Section '+s.id)), s.id)));
    });

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn btn-sm btn-danger';
    removeBtn.textContent = 'Remove';
    removeBtn.onclick = () => { container.removeChild(row); };

    row.appendChild(gradeSelect);
    row.appendChild(secSelect);
    row.appendChild(removeBtn);
    container.appendChild(row);

    return row;
}
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[Admin Dashboard] DOMContentLoaded event fired');
    forceInteractiveRecovery();
    setupSidebarNavigationFallback();
    await bootstrapSchoolBranding();
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
        let adminDataStr = null;
        try {
            adminDataStr = localStorage.getItem('adminData');
        } catch (e) {
            console.error('[Admin Dashboard] Error reading localStorage for adminData:', e);
        }
        if (!adminDataStr) {
            console.warn('[Admin Dashboard] No admin data found, redirecting to login');
            window.location.href = withSchoolParam('auth.html?role=admin');
            return;
        }
        try {
            admin = JSON.parse(adminDataStr);
            console.log('[Admin Dashboard] ⚠️ Using localStorage (Note: other tabs may have changed role)');
        } catch (e) {
            console.error('[Admin Dashboard] Failed to parse adminData from localStorage, clearing invalid value', e);
            try { localStorage.removeItem('adminData'); } catch {}
            // redirect to login since we no longer have valid credentials
            window.location.href = withSchoolParam('auth.html?role=admin');
            return;
        }
    }

    // ensure we actually have an admin-role user; accidental adviser/teacher
    if (admin && admin.role && String(admin.role).toLowerCase() !== 'admin') {
        console.warn('[Admin Dashboard] Non-admin user detected:', admin.role);
        // if it's a teacher/adviser, forward them to the correct dashboard
        const r = String(admin.role).toLowerCase();
        if (r === 'adviser' || r === 'teacher') {
            window.location.href = withSchoolParam('adviser-dashboard.html');
            return;
        }
        // unknown role - send to login
        window.location.href = withSchoolParam('auth.html?role=admin');
        return;
    }
    
    if (!admin) {
        console.warn('[Admin Dashboard] Failed to load admin data, redirecting to login');
        window.location.href = withSchoolParam('auth.html?role=admin');
        return;
    }
    
    document.getElementById('adminName').textContent = admin.name || 'Admin';

    // Role-based access control: Redirect Guidance users to their dashboard
    // ONLY if this tab's session shows guidance role
    if (admin.role && admin.role.toLowerCase() === 'guidance') {
        console.log('[Admin Dashboard] 🔄 Redirecting Guidance counselor to Guidance Dashboard:', admin.name);
        window.location.href = withSchoolParam('guidance-dashboard.html');
        return;
    }

    console.log('[Admin Dashboard] Initializing dashboard...');
    // global error listener to catch uncaught exceptions and display notification
    window.addEventListener('error', (event) => {
        console.error('[Global Error]', event.error || event.message, event);
        showNotification('⚠️ An unexpected error occurred. Check console for details.', 'error');
    });
    window.addEventListener('unhandledrejection', (ev) => {
        console.error('[Unhandled Rejection]', ev.reason);
        showNotification('⚠️ An unexpected error occurred (promise rejection).', 'error');
    });
    // Ensure API is reachable (try multiple fallbacks) before initializing
    ensureApiAvailable().then(async () => {
        console.log('[Admin Dashboard] Using API_BASE =', API_BASE);
        // Check whether an active school year exists; if not, we'll fall back when fetching enrollments/stats
        try {
            await checkActiveSchoolYear();
        } catch (e) {
            console.warn('[Admin Dashboard] Failed to determine active school year:', e);
        }
        initializeDashboard();
    }).catch(err => {
        console.error('[Admin Dashboard] API health check failed:', err);
        // Still attempt to initialize; loadDashboardStats will show an error notice
        initializeDashboard();
    });
    setupNavigation();
    setupInteractionFeedback();
    // Wire up modal close buttons and overlay behavior for better UX
    try {
        const closeAssignBtn = document.getElementById('closeTeacherAssignmentModal');
        if (closeAssignBtn) closeAssignBtn.addEventListener('click', closeTeacherAssignmentModal);

        const assignCancel = document.getElementById('assignTeacherCancelBtn');
        if (assignCancel) assignCancel.addEventListener('click', closeTeacherAssignmentModal);

        const assignModal = document.getElementById('teacherAssignmentModal');
        if (assignModal) {
            assignModal.addEventListener('click', (ev) => { if (ev.target === assignModal) closeTeacherAssignmentModal(); });
        }

        // Edit sections modal close wiring (graceful fallback)
        const closeEditBtn = document.getElementById('closeEditSectionsModal');
        if (closeEditBtn) closeEditBtn.addEventListener('click', () => {
            const m = document.getElementById('editSectionsModal'); if (m) { m.setAttribute('aria-hidden','true'); m.style.display = 'none'; }
        });
        const editCancel = document.getElementById('editSectionsCancelBtn');
        if (editCancel) editCancel.addEventListener('click', () => {
            const m = document.getElementById('editSectionsModal'); if (m) { m.setAttribute('aria-hidden','true'); m.style.display = 'none'; }
        });
        
        // Edit sections form submission wiring
        const editSectionsForm = document.getElementById('editSectionsForm');
        if (editSectionsForm) {
            editSectionsForm.addEventListener('submit', (ev) => { ev.preventDefault(); submitTeacherEditSections(); });
        }
        // Fallback: bind save button if present
        const editSaveBtn = document.getElementById('editSectionsSaveBtn');
        if (editSaveBtn) {
            editSaveBtn.addEventListener('click', (e) => { e.preventDefault(); submitTeacherEditSections(); });
        }
        
        // Bind overlay click to close
        const editSectionsModal = document.getElementById('editSectionsModal');
        if (editSectionsModal) {
            editSectionsModal.addEventListener('click', (ev) => { if (ev.target === editSectionsModal) closeTeacherEditSectionsModal(); });
        }

        // Escape key closes any open modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' || e.key === 'Esc') {
                const openModal = document.querySelector('.modal[aria-hidden="false"]');
                if (openModal) { openModal.setAttribute('aria-hidden','true'); openModal.style.display = 'none'; }
            }
        });
        // Bind submit handler for teacher assignment form
        const assignForm = document.getElementById('teacherAssignmentForm');
        if (assignForm) {
            assignForm.addEventListener('submit', (ev) => { ev.preventDefault(); submitTeacherRoleAssignment(); });
        }
        // Fallback: bind save button if present
        const saveBtn = document.getElementById('assignTeacherSaveBtn');
        if (saveBtn) saveBtn.addEventListener('click', (e) => { e.preventDefault(); submitTeacherRoleAssignment(); });
        // Subject Assignment modal wiring (JHS)
        const closeSubjectBtn = document.getElementById('closeSubjectAssignmentModal');
        if (closeSubjectBtn) closeSubjectBtn.addEventListener('click', () => { const m = document.getElementById('subjectAssignmentModal'); if (m) { m.setAttribute('aria-hidden','true'); m.style.display='none'; } });
        const subjCancel = document.getElementById('subjectAssignCancelBtn');
        if (subjCancel) subjCancel.addEventListener('click', () => { const m = document.getElementById('subjectAssignmentModal'); if (m) { m.setAttribute('aria-hidden','true'); m.style.display='none'; } });
        const subjForm = document.getElementById('subjectAssignmentForm');
        if (subjForm) subjForm.addEventListener('submit', (ev) => { ev.preventDefault(); submitSubjectAssignmentsModal(); });
        const subjAddBtn = document.getElementById('subjectAddRowBtn');
        if (subjAddBtn) subjAddBtn.addEventListener('click', (e) => {
            e.preventDefault();
            addTeachingSubjectRow(null, 'subjectModalSubjectLoadsContainer', window._subjectOptionsForModal, window._allowedGradesForModal);
        });
        const subjSaveBtn = document.getElementById('subjectAssignSaveBtn');
        if (subjSaveBtn) subjSaveBtn.addEventListener('click', (e) => { e.preventDefault(); submitSubjectAssignmentsModal(); });

        // Subject Assignment modal wiring (SHS - with cascade filtering)
        const closeSubjectBtnSHS = document.getElementById('closeSubjectAssignmentModalSHS');
        if (closeSubjectBtnSHS) closeSubjectBtnSHS.addEventListener('click', () => { const m = document.getElementById('subjectAssignmentModalSHS'); if (m) { m.setAttribute('aria-hidden','true'); m.style.display='none'; } });
        const subjCancelSHS = document.getElementById('subjectAssignCancelBtnSHS');
        if (subjCancelSHS) subjCancelSHS.addEventListener('click', () => { const m = document.getElementById('subjectAssignmentModalSHS'); if (m) { m.setAttribute('aria-hidden','true'); m.style.display='none'; } });
        const subjFormSHS = document.getElementById('subjectAssignmentFormSHS');
        if (subjFormSHS) subjFormSHS.addEventListener('submit', (ev) => { ev.preventDefault(); submitSubjectAssignmentsModalSHS(); });
        const subjAddBtnSHS = document.getElementById('subjectAddRowBtnSHS');
        if (subjAddBtnSHS) subjAddBtnSHS.addEventListener('click', (e) => {
            e.preventDefault();
            addTeachingSubjectRow(null, 'subjectModalSubjectLoadsContainerSHS', window._subjectOptionsForModal, window._allowedGradesForModal);
        });
        const subjSaveBtnSHS = document.getElementById('subjectAssignSaveBtnSHS');
        if (subjSaveBtnSHS) subjSaveBtnSHS.addEventListener('click', (e) => { e.preventDefault(); submitSubjectAssignmentsModalSHS(); });
    } catch (err) { console.warn('[Modal Wiring] error:', err); }
    // Teaching Assignments: wire buttons
    try {
        const taAdd = document.getElementById('taAddSubjectBtn');
        if (taAdd) taAdd.addEventListener('click', (e) => { e.preventDefault(); addTeachingSubjectRow(); });
        const taSave = document.getElementById('taSaveAssignmentsBtn');
        if (taSave) taSave.addEventListener('click', (e) => { e.preventDefault(); saveTeachingAssignments(); });
        const taTeacherSel = document.getElementById('taTeacherSelect');
        if (taTeacherSel) taTeacherSel.addEventListener('change', (e) => { const v = e.target.value; if (v) loadTeacherSubjectAssignments(v); });
        // Tab buttons for JHS/SHS teacher tables
        const taJhsBtn = document.getElementById('taTabJHSTableBtn');
        const taShsBtn = document.getElementById('taTabSHSTableBtn');
        if (taJhsBtn && taShsBtn) {
            taJhsBtn.addEventListener('click', () => {
                taJhsBtn.classList.add('active'); taShsBtn.classList.remove('active');
                document.getElementById('taTabContentJHS').style.display = 'block';
                document.getElementById('taTabContentSHS').style.display = 'none';
            });
            taShsBtn.addEventListener('click', () => {
                taShsBtn.classList.add('active'); taJhsBtn.classList.remove('active');
                document.getElementById('taTabContentJHS').style.display = 'none';
                document.getElementById('taTabContentSHS').style.display = 'block';
            });
        }
        // initial populate when teachers load
        setTimeout(() => { populateTeachingTeacherSelect(); try { renderTeachingAssignmentsTeacherTables(); } catch(e){} }, 500);

        // Wire search/filter controls for TA tables
        try {
            const searchEl = document.getElementById('taTableSearch');
            const roleEl = document.getElementById('taTableRoleFilter');
            const refreshBtn = document.getElementById('taTableRefreshBtn');
            if (searchEl) searchEl.addEventListener('input', () => renderTeachingAssignmentsTeacherTables());
            if (roleEl) roleEl.addEventListener('change', () => renderTeachingAssignmentsTeacherTables());
            if (refreshBtn) refreshBtn.addEventListener('click', () => { loadTeachersForAdmin(); renderTeachingAssignmentsTeacherTables(); });
        } catch (e) { console.warn('[TeachingAssignments] control wiring error', e); }
    } catch (e) { console.warn('[TeachingAssignments] wiring error', e); }
    try { setupProfile(); } catch (e) { console.warn('[Admin Dashboard] setupProfile failed', e); }
    try { setupNotificationCenter(); } catch (e) { console.warn('[Admin Dashboard] setupNotificationCenter failed', e); }
    try { setupAdminSettingsPanel(); } catch (e) { console.warn('[Admin Dashboard] setupAdminSettingsPanel failed', e); }
    try { setupAdminSettingsEmergencyBackupHandlers(); } catch (e) { console.warn('[Admin Dashboard] setupAdminSettingsEmergencyBackupHandlers failed', e); }
    try { bindRecentEnrollmentRowClicks(); } catch (e) { console.warn('[Admin Dashboard] bindRecentEnrollmentRowClicks failed', e); }
    setupFilterButtons();
    setupRealtimeUpdates();
    setupReportTabs();
    setupExportButtons();
    initTeacherRegistrationTab();
    loadEnrollments();
    // Safety: re-run dashboard data load shortly after init to avoid race conditions
    setTimeout(() => {
        try {
            loadDashboardStats();
            loadRecentEnrollments();
        } catch (e) {
            console.warn('[Admin Dashboard] delayed reload failed', e);
        }
    }, 500);

    setTimeout(forceInteractiveRecovery, 250);
    setTimeout(forceInteractiveRecovery, 1200);
    setTimeout(forceInteractiveRecovery, 3000);
});

// Try multiple API hosts and pick the first that responds to /api/health
async function ensureApiAvailable(timeout = 2500) {
    const candidates = [];
    // current computed candidate (may be empty string meaning same origin)
    if (API_BASE) candidates.push(API_BASE);
    // include the current computed origin as a fallback
    if (BACKEND_ORIGIN) candidates.push(BACKEND_ORIGIN);

    // Deduplicate preserving order
    const seen = new Set();
    const unique = candidates.filter(c => {
        if (!c) return false;
        if (seen.has(c)) return false;
        seen.add(c);
        return true;
    });

    async function probe(url) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        try {
            const res = await fetch(`${url.replace(/\/$/, '')}/api/health`, { signal: controller.signal });
            clearTimeout(id);
            return res.ok;
        } catch (err) {
            clearTimeout(id);
            return false;
        }
    }

    for (const candidate of unique) {
        try {
            console.log('[ensureApiAvailable] probing', candidate + '/api/health');
            const ok = await probe(candidate);
            if (ok) {
                API_BASE = candidate;
                console.log('[ensureApiAvailable] selected API_BASE:', API_BASE);
                return API_BASE;
            }
        } catch (err) {
            console.warn('[ensureApiAvailable] probe failed for', candidate, err);
        }
    }

    // last attempt: try same-origin relative API (if server is served from same origin:port)
    try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        const res = await apiFetch('/api/health', { signal: controller.signal });
        clearTimeout(id);
        if (res.ok) {
            API_BASE = '';
            console.log('[ensureApiAvailable] using same-origin /api');
            return API_BASE;
        }
    } catch (err) {
        // ignore
    }

    throw new Error('No reachable API endpoint found');
}

// Check whether there is an active school year; set a global flag
async function checkActiveSchoolYear() {
    try {
        const res = await apiFetch('/api/school-years/active');
        if (!res.ok) {
            window.activeSchoolYearExists = false;
            return false;
        }
        const data = await res.json();
        window.activeSchoolYearExists = !!data;
        return window.activeSchoolYearExists;
    } catch (err) {
        console.warn('[checkActiveSchoolYear] error', err);
        window.activeSchoolYearExists = false;
        return false;
    }
}

function toPositiveNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function getResolvedActiveSchoolYearId() {
    const direct = toPositiveNumber(window.activeSchoolYearId || activeSchoolYearId);
    if (direct) return direct;

    const fromObject = toPositiveNumber(window.activeSchoolYear && (window.activeSchoolYear.id || window.activeSchoolYear.school_year_id));
    if (fromObject) return fromObject;

    try {
        const stored = JSON.parse(localStorage.getItem('activeSchoolYear') || 'null');
        const fromStorage = toPositiveNumber(stored && (stored.id || stored.school_year_id || stored.schoolYearId));
        if (fromStorage) return fromStorage;
    } catch (_e) {
        // ignore storage parse issues
    }

    return null;
}

function normalizeEnrollmentRowsPayload(payload) {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== 'object') return [];
    if (Array.isArray(payload.rows)) return payload.rows;
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.enrollments)) return payload.enrollments;
    return [];
}

function resolveEnrollmentSchoolYearId(enrollment) {
    if (!enrollment || typeof enrollment !== 'object') return null;

    let data = enrollment.enrollment_data || {};
    if (typeof data === 'string') {
        try {
            data = JSON.parse(data);
        } catch (_e) {
            data = {};
        }
    }

    const directCandidates = [
        enrollment.school_year_id,
        enrollment.schoolYearId,
        enrollment.schoolyear_id,
        enrollment.sy_id,
        enrollment.academic_year_id,
        enrollment.current_school_year_id,
        enrollment.active_school_year_id,
        enrollment.section_school_year_id,
        enrollment.section && enrollment.section.school_year_id,
        enrollment.section && enrollment.section.schoolYearId,
        data.school_year_id,
        data.schoolYearId,
        data.schoolyear_id,
        data.sy_id,
        data.currentSchoolYearId,
        data.activeSchoolYearId,
        data.section_school_year_id,
        data.section && data.section.school_year_id,
        data.section && data.section.schoolYearId,
        enrollment.school_year,
        data.school_year
    ];

    for (const candidate of directCandidates) {
        const resolved = toPositiveNumber(candidate);
        if (resolved) return resolved;
    }

    return null;
}

function filterEnrollmentsByActiveSchoolYear(enrollments) {
    const rows = Array.isArray(enrollments) ? enrollments : [];
    const activeYearId = getResolvedActiveSchoolYearId();
    if (!activeYearId) return rows;

    const resolvedYearRows = rows
        .map(row => ({ row, schoolYearId: resolveEnrollmentSchoolYearId(row) }))
        .filter(item => !!item.schoolYearId);

    if (!resolvedYearRows.length) {
        // If payload does not expose school year identifiers, keep original rows.
        return rows;
    }

    return resolvedYearRows
        .filter(item => item.schoolYearId === activeYearId)
        .map(item => item.row);
}

function buildActiveSchoolYearEnrollmentsPath(path, extraParams = {}) {
    try {
        const url = new URL(String(path || '/api/enrollments'), window.location.origin);
        const activeYearId = getResolvedActiveSchoolYearId();

        if (!url.searchParams.has('activeYear')) {
            url.searchParams.set('activeYear', 'true');
        }

        if (activeYearId) {
            if (!url.searchParams.has('school_year_id')) {
                url.searchParams.set('school_year_id', String(activeYearId));
            }
            if (!url.searchParams.has('schoolYearId')) {
                url.searchParams.set('schoolYearId', String(activeYearId));
            }
        }

        Object.entries(extraParams || {}).forEach(([key, value]) => {
            if (value === undefined || value === null || value === '') return;
            url.searchParams.set(String(key), String(value));
        });

        return `${url.pathname}${url.search}`;
    } catch (_err) {
        return path;
    }
}

window.getResolvedActiveSchoolYearId = getResolvedActiveSchoolYearId;
window.filterEnrollmentsByActiveSchoolYear = filterEnrollmentsByActiveSchoolYear;

async function refreshDashboardForActiveSchoolYear(activeSchoolYearData = null) {
    try {
        const resolved = activeSchoolYearData
            || (typeof window.activeSchoolYear === 'object' ? window.activeSchoolYear : null)
            || (() => {
                try {
                    return JSON.parse(localStorage.getItem('activeSchoolYear') || 'null');
                } catch (_e) {
                    return null;
                }
            })();

        if (resolved && resolved.id) {
            window.activeSchoolYear = resolved;
            window.activeSchoolYearId = Number(resolved.id) || null;
            window.activeSchoolYearLabel = resolved.school_year ? `${resolved.school_year} (Active)` : '--';
            try { activeSchoolYearId = window.activeSchoolYearId; } catch (_e) {}
            try { activeSchoolYearLabel = window.activeSchoolYearLabel; } catch (_e) {}
        }

        await checkActiveSchoolYear();
        loadDashboardStats();
        loadRecentEnrollments();

        const activeEnrollmentSection = document.querySelector('.filter-btn.active');
        const filter = activeEnrollmentSection ? activeEnrollmentSection.getAttribute('data-filter') : (window.currentFilter || 'all');
        loadEnrollments(filter || 'all');

        if (typeof loadTeachersForAdmin === 'function') {
            loadTeachersForAdmin();
        }
        if (typeof renderTeachingAssignmentsTeacherTables === 'function') {
            renderTeachingAssignmentsTeacherTables();
        }

        if (typeof loadStudents === 'function') {
            try { await Promise.resolve(loadStudents()); } catch (_e) {}
        }

        if (typeof getActiveSchoolYear === 'function') {
            try { await Promise.resolve(getActiveSchoolYear()); } catch (_e) {}
        }
        if (typeof loadExistingSections === 'function') {
            try { await Promise.resolve(loadExistingSections()); } catch (_e) {}
        }

        if (window.__standardReportsV2 && typeof window.__standardReportsV2.reload === 'function') {
            try { await Promise.resolve(window.__standardReportsV2.reload()); } catch (_e) {}
        } else if (typeof window.loadReportData === 'function') {
            try { await Promise.resolve(window.loadReportData()); } catch (_e) {}
        }

        try {
            window.dispatchEvent(new CustomEvent('dashboard:school-year-changed', {
                detail: {
                    activeSchoolYear: window.activeSchoolYear || null,
                    activeSchoolYearId: window.activeSchoolYearId || null,
                    activeSchoolYearLabel: window.activeSchoolYearLabel || '--'
                }
            }));
        } catch (_e) {}
    } catch (err) {
        console.warn('[refreshDashboardForActiveSchoolYear] failed:', err);
    }
}

window.refreshDashboardForActiveSchoolYear = refreshDashboardForActiveSchoolYear;
window.addEventListener('schoolYearActivated', (event) => {
    refreshDashboardForActiveSchoolYear((event && event.detail) ? event.detail : null);
});

// Setup realtime updates: listen to storage events and poll backend
function setupRealtimeUpdates(pollInterval = 8000) {
    // Listen for other tabs updating enrollments/students
    window.addEventListener('storage', (e) => {
        if (!e.key) return;
        if (e.key === 'activeSchoolYear' || e.key === 'activeSchoolYearChangedAt') {
            refreshDashboardForActiveSchoolYear();
            return;
        }

        if (e.key === 'enrollments' || e.key === 'enrollmentCreated' || e.key === 'enrollmentUpdate' || e.key === 'students') {
            // Refresh dashboard data
            loadDashboardStats();
            loadRecentEnrollments();
            // If currently on enrollment page, reload list
            const enrollmentSection = document.getElementById('enrollment');
            if (enrollmentSection && enrollmentSection.classList.contains('active')) {
                const activeEnrollmentSection = document.querySelector('.filter-btn.active');
                const filter = activeEnrollmentSection ? activeEnrollmentSection.getAttribute('data-filter') : 'all';
                loadEnrollments(filter);
            }
        }
    });

    // Poll backend periodically as a fallback for real-time
    const dashboardSection = document.getElementById('dashboard');
    const intervalId = setInterval(() => {
        loadDashboardStats();
        // Update recent enrollments only when dashboard visible
        if (dashboardSection && dashboardSection.classList.contains('active')) {
            loadRecentEnrollments();
        }
    }, pollInterval);

    // Clear on unload
    window.addEventListener('beforeunload', () => clearInterval(intervalId));
}

// Note: setupRealtimeUpdates() is now called from DOMContentLoaded, not here

function forceDashboardDataBootstrap() {
    try {
        const totalStudentsNode = document.getElementById('totalStudents');
        const recentEnrollmentsNode = document.getElementById('recentEnrollments');

        const statsStillPlaceholder = !!totalStudentsNode && String(totalStudentsNode.textContent || '').trim() === '--';
        const recentStillLoading = !!recentEnrollmentsNode && /Loading enrollments/i.test(String(recentEnrollmentsNode.textContent || ''));

        if (!statsStillPlaceholder && !recentStillLoading) return;

        console.warn('[Admin Dashboard] Fallback data bootstrap triggered', {
            statsStillPlaceholder,
            recentStillLoading
        });

        loadDashboardStats();
        loadRecentEnrollments();
        if (typeof loadEnrollments === 'function') {
            loadEnrollments(window.currentFilter || 'all');
        }
    } catch (err) {
        console.warn('[Admin Dashboard] Fallback data bootstrap failed:', err);
    }
}

function forceEnrollmentTabBootstrap() {
    try {
        const enrollmentSection = document.getElementById('enrollment');
        const enrollmentTable = document.getElementById('enrollmentsTable');
        if (!enrollmentSection || !enrollmentTable) return;

        const sectionActive = enrollmentSection.classList.contains('active');
        if (!sectionActive) return;

        const text = String(enrollmentTable.textContent || '').trim();
        const stuckOnLoading = /Loading enrollments/i.test(text);
        const looksEmpty = !text || text === '--';
        if (!stuckOnLoading && !looksEmpty) return;

        const activeFilterButton = document.querySelector('.filter-btn.active');
        const filter = activeFilterButton ? String(activeFilterButton.getAttribute('data-filter') || 'all') : 'all';
        loadEnrollments(filter);
    } catch (err) {
        console.warn('[Admin Dashboard] Enrollment fallback bootstrap failed:', err);
    }
}

window.addEventListener('load', () => {
    setTimeout(forceDashboardDataBootstrap, 150);
    setTimeout(forceDashboardDataBootstrap, 1000);
    setTimeout(forceDashboardDataBootstrap, 2500);
    setTimeout(forceEnrollmentTabBootstrap, 200);
    setTimeout(forceEnrollmentTabBootstrap, 1000);
    setTimeout(forceEnrollmentTabBootstrap, 2500);
    setTimeout(forceEnrollmentTabBootstrap, 5000);
});

// Initialize dashboard
function initializeDashboard() {
    loadDashboardStats();
    loadRecentEnrollments();
}

// Load dashboard statistics
async function loadDashboardStats() {
    try {
        const enrollmentCandidates = [
            buildActiveSchoolYearEnrollmentsPath('/api/enrollments?view=dashboard&sort=recent'),
            buildActiveSchoolYearEnrollmentsPath('/api/enrollments?sort=recent'),
            buildActiveSchoolYearEnrollmentsPath('/api/enrollments')
        ];
        let scopedEnrollments = [];

        for (const endpoint of enrollmentCandidates) {
            const response = await apiFetch(endpoint, { cache: 'no-store' }, 15000);
            if (!response || !response.ok) continue;

            const payload = await response.json().catch(() => []);
            const rows = normalizeEnrollmentRowsPayload(payload);
            if (!Array.isArray(rows)) continue;

            scopedEnrollments = filterEnrollmentsByActiveSchoolYear(rows);
            break;
        }

        if (!Array.isArray(scopedEnrollments) || scopedEnrollments.length === 0) {
            window.dashboardEnrollmentsCache = [];
            window.dashboardTotalEnrollments = 0;
            document.getElementById('totalStudents').textContent = '0';
            document.getElementById('pendingEnrollments').textContent = '0';
            document.getElementById('approvedEnrollments').textContent = '0';
            document.getElementById('rejectedEnrollments').textContent = '0';
            return;
        }

        window.dashboardEnrollmentsCache = scopedEnrollments;

        let pendingCount = 0;
        let approvedCount = 0;
        let rejectedCount = 0;

        scopedEnrollments.forEach(enrollment => {
            const status = String(enrollment && (enrollment.status || enrollment.enrollment_status) || '')
                .trim()
                .toLowerCase();
            if (status === 'pending') pendingCount += 1;
            else if (status === 'approved') approvedCount += 1;
            else if (status === 'rejected') rejectedCount += 1;
        });

        window.dashboardTotalEnrollments = scopedEnrollments.length;
        const totalStudentsDisplay = pendingCount + approvedCount;

        document.getElementById('totalStudents').textContent = String(totalStudentsDisplay);
        document.getElementById('pendingEnrollments').textContent = String(pendingCount);
        document.getElementById('approvedEnrollments').textContent = String(approvedCount);
        document.getElementById('rejectedEnrollments').textContent = String(rejectedCount);

    } catch (err) {
        console.error('Error loading stats:', err);
        // Set default values on error
        document.getElementById('totalStudents').textContent = '0';
        document.getElementById('pendingEnrollments').textContent = '0';
        document.getElementById('approvedEnrollments').textContent = '0';
        document.getElementById('rejectedEnrollments').textContent = '0';
        showNotification('⚠️ Unable to load dashboard statistics. Please refresh the page or check if the server is running.', 'warning');
    }
}

let recentEnrollmentsExpanded = false;
let recentEnrollmentsSectionMap = {};
let recentEnrollmentsToggleBusy = false;
let recentEnrollmentsGlobalClickBound = false;

function ensureRecentEnrollmentsGlobalToggleBinding() {
    if (recentEnrollmentsGlobalClickBound) return;
    recentEnrollmentsGlobalClickBound = true;

    document.addEventListener('click', async (event) => {
        const toggle = event.target && typeof event.target.closest === 'function'
            ? event.target.closest('#recentEnrollmentsToggle')
            : null;

        if (!toggle) return;

        event.preventDefault();
        event.stopPropagation();

        if (recentEnrollmentsToggleBusy) return;
        recentEnrollmentsToggleBusy = true;

        try {
            await toggleRecentEnrollmentsView();
        } finally {
            recentEnrollmentsToggleBusy = false;
        }
    }, true);
}

ensureRecentEnrollmentsGlobalToggleBinding();

function getRecentEnrollmentsDataSource() {
    const rows = Array.isArray(window.dashboardEnrollmentsCache) ? window.dashboardEnrollmentsCache : [];
    if (!rows.length) return [];
    return rows.slice().sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
}

function updateRecentEnrollmentsToggle(totalRows = 0) {
    const toggle = document.getElementById('recentEnrollmentsToggle');
    if (!toggle) return;

    const effectiveTotal = Math.max(Number(totalRows) || 0, Number(window.dashboardTotalEnrollments || 0));
    const hasOverflow = effectiveTotal > 5;
    toggle.style.visibility = hasOverflow ? 'visible' : 'hidden';
    toggle.textContent = recentEnrollmentsExpanded ? 'Show Less →' : 'View All →';
}

function normalizeRecentText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function parseRecentList(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.flatMap(item => parseRecentList(item));
    if (typeof value === 'object') {
        const named = value.name || value.elective || value.title || value.subject || value.subject_name || value.value || '';
        if (named) return [normalizeRecentText(named)].filter(Boolean);
        return Object.values(value).flatMap(item => parseRecentList(item));
    }

    const text = normalizeRecentText(value);
    if (!text) return [];

    if ((text.startsWith('[') && text.endsWith(']')) || (text.startsWith('{') && text.endsWith('}'))) {
        try { return parseRecentList(JSON.parse(text)); } catch (_e) { }
    }

    const splitByBullets = text
        .split(/\r?\n|•|\u2022|\u25CF|\u25E6|\u2219/g)
        .map(v => normalizeRecentText(v))
        .filter(Boolean);
    if (splitByBullets.length > 1) return splitByBullets;

    if (text.includes(';')) {
        const semicolonSplit = text.split(';').map(v => normalizeRecentText(v)).filter(Boolean);
        if (semicolonSplit.length > 1) return semicolonSplit;
    }

    if (text.includes('|')) {
        const pipeSplit = text.split('|').map(v => normalizeRecentText(v)).filter(Boolean);
        if (pipeSplit.length > 1) return pipeSplit;
    }

    return [text];
}

function countRecentChar(text, char) {
    return String(text || '').split(char).length - 1;
}

function mergeRecentElectiveFragments(items) {
    const source = (Array.isArray(items) ? items : [])
        .map(item => normalizeRecentText(item))
        .filter(Boolean);

    const merged = [];
    let index = 0;

    while (index < source.length) {
        let current = source[index];
        let balance = countRecentChar(current, '(') - countRecentChar(current, ')');

        while (balance > 0 && index + 1 < source.length) {
            index += 1;
            current = `${current}, ${source[index]}`;
            balance = countRecentChar(current, '(') - countRecentChar(current, ')');
        }

        merged.push(normalizeRecentText(current));
        index += 1;
    }

    return Array.from(new Set(merged.filter(Boolean)));
}

function resolveRecentGradeNumber(data, enrollment) {
    const candidate = data.gradeLevel || data.grade || data.grade_level || enrollment.grade_to_enroll_id || enrollment.grade_level;
    const match = String(candidate || '').match(/(\d{1,2})/);
    return match ? Number(match[1]) : null;
}

function resolveRecentElectivesText(data, enrollment) {
    const gradeNumber = resolveRecentGradeNumber(data, enrollment);
    if (gradeNumber !== 11 && gradeNumber !== 12) return '--';

    const raw = [
        ...parseRecentList(data.academicElectives),
        ...parseRecentList(data.techproElectives),
        ...parseRecentList(data.doorwayAcademic),
        ...parseRecentList(data.doorwayTechPro),
        ...parseRecentList(data.doorwayTechpro),
        ...parseRecentList(data.selectedElectives),
        ...parseRecentList(data.electives),
        ...parseRecentList(data.shs && data.shs.electives),
        ...parseRecentList(data.interest)
    ];

    const merged = mergeRecentElectiveFragments(raw);
    if (!merged.length) return '--';

    return merged.join(', ');
}

function renderRecentEnrollmentsTable(enrollments = []) {
    const container = document.getElementById('recentEnrollments');
    if (!container) return;

    if (!enrollments || enrollments.length === 0) {
        container.innerHTML = '<tr><td colspan="8" style="padding: 40px; text-align: center; color: #999;">No enrollments yet.</td></tr>';
        updateRecentEnrollmentsToggle(0);
        return;
    }

    const sourceRows = recentEnrollmentsExpanded ? enrollments : enrollments.slice(0, 5);

    let html = '';
    sourceRows.forEach(enrollment => {
        let data = {};
        try {
            data = typeof enrollment.enrollment_data === 'string'
                ? JSON.parse(enrollment.enrollment_data)
                : (enrollment.enrollment_data || {});
        } catch (_parseErr) {
            data = {};
        }

        const studentName = ((data.firstName || '') + ' ' + (data.lastName || '')).trim() || `${enrollment.firstname || ''} ${enrollment.lastname || ''}`.trim() || 'N/A';
        const status = enrollment.status || 'Pending';
        const statusClass = status.toLowerCase();
        const statusStyles = {
            'approved': 'background: #d4edda; color: #155724;',
            'pending': 'background: #fff3cd; color: #856404;',
            'rejected': 'background: #f8d7da; color: #721c24;'
        };
        const statusStyle = statusStyles[statusClass] || 'background: #e2e3e5; color: #383d41;';
        const dateSubmitted = enrollment.enrollment_date ? new Date(enrollment.enrollment_date).toLocaleDateString() : '-';
        const electivesText = resolveRecentElectivesText(data, enrollment);

        let displaySection = '--';
        const resolvedSectionId = enrollment.section_id || enrollment.sectionId || data.section_id || data.sectionId;
        const resolvedSectionCode = enrollment.section_code || enrollment.sectionCode || data.section_code || data.sectionCode;

        if (resolvedSectionId && recentEnrollmentsSectionMap[String(resolvedSectionId)]) {
            displaySection = recentEnrollmentsSectionMap[String(resolvedSectionId)];
        } else if (enrollment.section_name) {
            displaySection = enrollment.section_name;
        } else if (data.section_name) {
            displaySection = data.section_name;
        } else if (resolvedSectionCode && recentEnrollmentsSectionMap[String(resolvedSectionCode)]) {
            displaySection = recentEnrollmentsSectionMap[String(resolvedSectionCode)];
        } else if (data.section && data.section.trim()) {
            displaySection = data.section;
        } else if (data.sectionCode) {
            displaySection = data.sectionCode;
        }

        html += `
            <tr class="recent-enrollment-row" data-enrollment-id="${enrollment.id}" style="border-bottom: 1px solid #dee2e6; cursor: pointer; transition: background 0.3s;" onmouseover="this.style.background='#f8f9fa'" onmouseout="this.style.background='white'">
                <td style="padding: 12px; border-bottom: 1px solid #dee2e6;">${data.studentLRN || data.lrn || enrollment.lrn_no || '-'}</td>
                <td style="padding: 12px; border-bottom: 1px solid #dee2e6;">${studentName}</td>
                <td style="padding: 12px; border-bottom: 1px solid #dee2e6;">${data.gradeLevel || enrollment.grade_to_enroll_id || '-'}</td>
                <td style="padding: 12px; border-bottom: 1px solid #dee2e6;">${displaySection}</td>
                <td style="padding: 12px; border-bottom: 1px solid #dee2e6;">${data.track || enrollment.track || '-'}</td>
                <td style="padding: 12px; border-bottom: 1px solid #dee2e6; max-width: 260px; white-space: normal; line-height: 1.35;">${escapeHtml(electivesText)}</td>
                <td style="padding: 12px; border-bottom: 1px solid #dee2e6;">
                    <span style="padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; ${statusStyle}">
                        ${status}
                    </span>
                </td>
                <td style="padding: 12px; border-bottom: 1px solid #dee2e6;">${dateSubmitted}</td>
            </tr>
        `;
    });

    container.innerHTML = html;
    updateRecentEnrollmentsToggle(enrollments.length);
}

async function toggleRecentEnrollmentsView() {
    const willExpand = !recentEnrollmentsExpanded;

    if (willExpand) {
        const currentRows = Array.isArray(window.dashboardEnrollmentsCache) ? window.dashboardEnrollmentsCache.length : 0;
        const expectedTotal = Number(window.dashboardTotalEnrollments || 0);

        if (expectedTotal > currentRows) {
            const safeLimit = Math.min(200, Math.max(25, expectedTotal || 0));
            const requestCandidates = [
                buildActiveSchoolYearEnrollmentsPath(`/api/enrollments?sort=recent&view=dashboard&limit=${safeLimit}`),
                buildActiveSchoolYearEnrollmentsPath(`/api/enrollments?sort=recent&limit=${safeLimit}`),
                buildActiveSchoolYearEnrollmentsPath('/api/enrollments?sort=recent'),
                buildActiveSchoolYearEnrollmentsPath('/api/enrollments')
            ];

            try {
                let expandedRows = null;

                for (const endpoint of requestCandidates) {
                    const response = await apiFetch(endpoint, { cache: 'no-store' }, 25000);
                    if (!response || !response.ok) continue;

                    const payload = await response.json().catch(() => []);
                    const rows = filterEnrollmentsByActiveSchoolYear(normalizeEnrollmentRowsPayload(payload));
                    if (!Array.isArray(rows) || rows.length === 0) continue;

                    expandedRows = rows;
                    if (rows.length > currentRows) break;
                }

                if (Array.isArray(expandedRows) && expandedRows.length > 0) {
                    window.dashboardEnrollmentsCache = expandedRows;
                } else {
                    console.warn('[toggleRecentEnrollmentsView] No expanded rows returned from candidates');
                    if (typeof showNotification === 'function') {
                        showNotification('Unable to load additional enrollments right now.', 'warning');
                    }
                }
            } catch (fetchErr) {
                console.warn('[toggleRecentEnrollmentsView] Failed to fetch full list:', fetchErr);
                if (typeof showNotification === 'function') {
                    showNotification('Unable to load full enrollment list right now.', 'warning');
                }
            }
        }
    }

    recentEnrollmentsExpanded = willExpand;
    renderRecentEnrollmentsTable(getRecentEnrollmentsDataSource());
}

// Load recent enrollments
async function loadRecentEnrollments() {
    try {
        const safeExpandedLimit = Math.min(200, Math.max(25, Number(window.dashboardTotalEnrollments || 0) || 0));
        const requestedLimit = recentEnrollmentsExpanded
            ? (safeExpandedLimit > 0 ? `&limit=${safeExpandedLimit}` : '')
            : '&limit=5';

        const urlCandidates = [
            buildActiveSchoolYearEnrollmentsPath(`/api/enrollments?sort=recent&view=dashboard${requestedLimit}`),
            buildActiveSchoolYearEnrollmentsPath(`/api/enrollments?sort=recent${requestedLimit}`),
            buildActiveSchoolYearEnrollmentsPath('/api/enrollments?sort=recent&view=dashboard'),
            buildActiveSchoolYearEnrollmentsPath('/api/enrollments?sort=recent')
        ];
        console.log('[loadRecentEnrollments] Fetch candidates:', urlCandidates);

        let enrollmentsResp = null;
        for (const candidate of urlCandidates) {
            const candidateResp = await apiFetch(candidate, { cache: 'no-store' }, 15000);
            if (!candidateResp || !candidateResp.ok) continue;

            const candidatePayload = await candidateResp.clone().json().catch(() => []);
            const candidateRows = filterEnrollmentsByActiveSchoolYear(normalizeEnrollmentRowsPayload(candidatePayload));
            if (!Array.isArray(candidateRows)) continue;

            enrollmentsResp = candidateResp;
            break;
        }

        if (!enrollmentsResp || !enrollmentsResp.ok) {
            throw new Error('No recent-enrollment endpoint returned usable data');
        }
        
        // Fetch enrollments and sections in parallel
        const [, sectionsResp] = await Promise.all([
            Promise.resolve(enrollmentsResp),
            apiFetch('/api/sections', {}, 10000)
        ]);

        const payload = await enrollmentsResp.json().catch(() => []);
        const enrollments = filterEnrollmentsByActiveSchoolYear(normalizeEnrollmentRowsPayload(payload));
        if (Array.isArray(enrollments)) {
            window.dashboardEnrollmentsCache = enrollments;
        }
        const sections = await sectionsResp.json();
        
        // Create section map
        const sectionMap = {};
        const sectionCodeMap = {};
        if (Array.isArray(sections)) {
            sections.forEach(sec => {
                const sectionId = sec.id ?? sec.section_id ?? sec.sectionId;
                const sectionName = sec.section_name || sec.name || '';
                const sectionCode = sec.section_code || sec.code || '';
                if (sectionId && sectionName) {
                    sectionMap[String(sectionId)] = sectionName;
                }
                if (sectionCode && sectionName) {
                    sectionCodeMap[String(sectionCode)] = sectionName;
                }
            });
        }
        recentEnrollmentsSectionMap = { ...sectionMap, ...sectionCodeMap };
        console.log('[loadRecentEnrollments] Section map:', sectionMap);

        bindRecentEnrollmentRowClicks();
        renderRecentEnrollmentsTable(getRecentEnrollmentsDataSource());
    } catch (err) {
        console.error('Error loading enrollments:', err);
        let errorMsg = 'Error loading enrollments.';
        if (err.message.includes('HTTP')) {
            errorMsg += ' The server may not be responding.';
        }
        document.getElementById('recentEnrollments').innerHTML = `<tr><td colspan="8" style="padding: 40px; text-align: center; color: #999;">${errorMsg}</td></tr>`;
    }
}

function bindRecentEnrollmentRowClicks() {
    const container = document.getElementById('recentEnrollments');
    if (!container || container.dataset.rowClickBound === '1') return;
    container.dataset.rowClickBound = '1';

    container.addEventListener('click', (event) => {
        const row = event.target.closest('tr[data-enrollment-id]');
        if (!row) return;
        const enrollmentId = String(row.getAttribute('data-enrollment-id') || '').trim();
        if (!enrollmentId) return;
        try {
            if (typeof window.debugRecentProfileFlow === 'function') {
                window.debugRecentProfileFlow('row-click', enrollmentId);
            }
        } catch (_e) {}
        window.openEnrollmentDetailSafely(enrollmentId);
    });
}

if (typeof window.__recentProfileDebug === 'undefined') {
    window.__recentProfileDebug = true;
}

window.debugRecentProfileFlow = function(step, detail) {
    try {
        if (window.__recentProfileDebug !== true) return;
        const message = `[RecentDebug] ${String(step || '').trim()}${detail ? `: ${String(detail).trim()}` : ''}`;
        console.log(message);
        if (typeof showNotification === 'function') {
            showNotification(message, 'success');
        }
    } catch (_e) {}
};

// Load all enrollments
async function loadEnrollments(filter = 'all') {
    try {
        // Build query parameters for status and active school year
        const params = [];
        if (filter !== 'all') {
            params.push(`status=${filter.charAt(0).toUpperCase() + filter.slice(1)}`);
        }
        const basePath = `/api/enrollments${params.length ? ('?' + params.join('&')) : ''}`;
        const path = buildActiveSchoolYearEnrollmentsPath(basePath);
        console.log('[loadEnrollments] Fetching from:', path);
        const response = await apiFetch(path, { cache: 'no-store' });
        
        if (!response.ok) {
            console.error('[loadEnrollments] HTTP error:', response.status, response.statusText);
            const text = await response.text();
            console.error('[loadEnrollments] Response text:', text.substring(0, 500));
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const payload = await response.json().catch(() => []);
        const enrollments = filterEnrollmentsByActiveSchoolYear(normalizeEnrollmentRowsPayload(payload));

        console.log('[loadEnrollments] fetched enrollments count:', Array.isArray(enrollments) ? enrollments.length : 'not-array');
        if (Array.isArray(enrollments) && enrollments.length > 0) console.log('[loadEnrollments] first enrollment:', enrollments[0]);

        const container = document.getElementById('enrollmentsTable');
        
        if (!enrollments || enrollments.length === 0) {
            container.innerHTML = `<p class="no-data">No enrollments found. (fetched from: ${path})<br><small>Ensure backend is running and enrollments are associated with the active school year.</small></p>`;
            return;
        }

        // Store enrollments for searching
        window.allEnrollments = enrollments;
        window.currentFilter = filter;

        let html = '<div class="enrollments-list">';
        enrollments.forEach(enrollment => {
            let data = {};
            try {
                data = typeof enrollment.enrollment_data === 'string'
                    ? JSON.parse(enrollment.enrollment_data)
                    : (enrollment.enrollment_data || {});
            } catch (parseErr) {
                console.warn('[loadEnrollments] Failed to parse enrollment_data for id', enrollment.id, parseErr);
                data = {};
            }
            
            const studentName = data.firstName + ' ' + (data.lastName || '');
            const status = enrollment.status || 'Pending';
            const statusClass = status.toLowerCase();
            
            html += `
                <div class="enrollment-item" onclick="openEnrollmentDetailSafely('${enrollment.id}')">
                    <div class="enrollment-item-header">
                        <div style="flex: 1;">
                            <span class="enrollment-student">${studentName}</span>
                            <span class="enrollment-status ${statusClass}">${status}</span>
                        </div>
                        <button class="btn btn-delete" onclick="deleteEnrollment(event, '${enrollment.id}', '${studentName}')" title="Delete enrollment">🗑️ Delete</button>
                    </div>
                    <div class="enrollment-info">
                        Grade: ${data.gradeLevel} | Submitted: ${new Date(enrollment.enrollment_date).toLocaleDateString()}
                    </div>
                </div>
            `;
        });
        html += '</div>';
        
        container.innerHTML = html;
        setupEnrollmentSearchHandlers();
    } catch (err) {
        console.error('Error loading enrollments:', err);
        let errorMsg = 'Failed to load enrollments.';
        if (err.message.includes('HTTP')) {
            errorMsg += ' The server may not be running.';
        }
        document.getElementById('enrollmentsTable').innerHTML = `<p class="no-data">${errorMsg} <br><small>Ensure the backend server is running, then refresh the page.</small></p>`;
    }
}

// Load rejected enrollments
async function loadRejectedEnrollments() {
    try {
        const response = await apiFetch(
            buildActiveSchoolYearEnrollmentsPath('/api/enrollments?status=Rejected'),
            { cache: 'no-store' }
        );
        const payload = await response.json().catch(() => []);
        const enrollments = filterEnrollmentsByActiveSchoolYear(normalizeEnrollmentRowsPayload(payload));

        const container = document.getElementById('rejectedEnrollments');
        
        if (!enrollments || enrollments.length === 0) {
            container.innerHTML = '<p class="no-data">No rejected enrollments found.</p>';
            return;
        }

        let html = '<div class="enrollments-list">';
        enrollments.forEach(enrollment => {
            const data = typeof enrollment.enrollment_data === 'string' 
                ? JSON.parse(enrollment.enrollment_data) 
                : enrollment.enrollment_data;
            
            const studentName = data.firstName + ' ' + (data.lastName || '');
            const status = enrollment.status || 'Rejected';
            const statusClass = status.toLowerCase();
            
            html += `
                <div class="enrollment-item" onclick="openEnrollmentDetailSafely('${enrollment.id}')">
                    <div class="enrollment-item-header">
                        <div style="flex: 1;">
                            <span class="enrollment-student">${studentName}</span>
                            <span class="enrollment-status ${statusClass}">${status}</span>
                        </div>
                        <button class="btn btn-delete" onclick="deleteEnrollment(event, '${enrollment.id}', '${studentName}')" title="Delete enrollment">🗑️ Delete</button>
                    </div>
                    <div class="enrollment-info">
                        Grade: ${data.gradeLevel} | Submitted: ${new Date(enrollment.enrollment_date).toLocaleDateString()}
                    </div>
                </div>
            `;
        });
        html += '</div>';
        
        container.innerHTML = html;
    } catch (err) {
        console.error('Error loading rejected enrollments:', err);
        document.getElementById('rejectedEnrollments').innerHTML = '<p class="no-data">Error loading rejected enrollments.</p>';
    }
}

// Setup search handlers
function setupEnrollmentSearchHandlers() {
    const searchBtn = document.getElementById('searchBtn');
    const clearBtn = document.getElementById('clearSearchBtn');
    const searchInput = document.getElementById('enrollmentSearchInput');

    if (searchBtn) {
        searchBtn.addEventListener('click', searchEnrollments);
    }
    if (clearBtn) {
        clearBtn.addEventListener('click', clearEnrollmentSearch);
    }
    if (searchInput) {
        // Live search as user types
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            if (searchTerm.length > 0) {
                searchEnrollments();
            } else if (searchTerm.length === 0 && window.allEnrollments) {
                // If search is cleared, reload all enrollments
                loadEnrollments(window.currentFilter || 'all');
            }
        });
        
        // Also support Enter key
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchEnrollments();
        });
    }
}

// Search enrollments
function searchEnrollments() {
    const searchTerm = document.getElementById('enrollmentSearchInput').value.toLowerCase().trim();
    const container = document.getElementById('enrollmentsTable');

    if (!searchTerm) {
        return;
    }

    const filtered = window.allEnrollments.filter(enrollment => {
        const data = typeof enrollment.enrollment_data === 'string' 
            ? JSON.parse(enrollment.enrollment_data) 
            : enrollment.enrollment_data;
        
        const studentName = (data.firstName + ' ' + (data.lastName || '')).toLowerCase();
        const email = (data.email || '').toLowerCase();

        return studentName.includes(searchTerm) || email.includes(searchTerm);
    });

    if (filtered.length === 0) {
        container.innerHTML = '<p class="no-data">No matching enrollments found.</p>';
        return;
    }

    let html = '<div class="enrollments-list">';
    filtered.forEach(enrollment => {
        const data = typeof enrollment.enrollment_data === 'string' 
            ? JSON.parse(enrollment.enrollment_data) 
            : enrollment.enrollment_data;
        
        const studentName = data.firstName + ' ' + (data.lastName || '');
        const status = enrollment.status || 'Pending';
        const statusClass = status.toLowerCase();
        
        html += `
            <div class="enrollment-item" onclick="openEnrollmentDetailSafely('${enrollment.id}')">
                <div class="enrollment-item-header">
                    <div style="flex: 1;">
                        <span class="enrollment-student">${studentName}</span>
                        <span class="enrollment-status ${statusClass}">${status}</span>
                    </div>
                    <button class="btn btn-delete" onclick="deleteEnrollment(event, '${enrollment.id}', '${studentName}')" title="Delete enrollment">🗑️ Delete</button>
                </div>
                <div class="enrollment-info">
                    Grade: ${data.gradeLevel} | Submitted: ${new Date(enrollment.enrollment_date).toLocaleDateString()}
                </div>
            </div>
        `;
    });
    html += '</div>';
    
    container.innerHTML = html;
}

// Clear search
function clearEnrollmentSearch() {
    document.getElementById('enrollmentSearchInput').value = '';
    loadEnrollments(window.currentFilter || 'all');
}

// Delete enrollment
async function deleteEnrollment(event, enrollmentId, studentName) {
    event.stopPropagation();
    
    if (!confirm(`Are you sure you want to delete the enrollment for ${studentName}? This action cannot be undone.`)) {
        return;
    }

    try {
        const response = await apiFetch(`/api/enrollments/${enrollmentId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showNotification(`Enrollment for ${studentName} deleted successfully`, 'success');
            loadEnrollments(window.currentFilter || 'all');
            loadDashboardStats();
        } else {
            showNotification('Failed to delete enrollment', 'error');
        }
    } catch (err) {
        console.error('Error deleting enrollment:', err);
        showNotification('Error deleting enrollment', 'error');
    }
}

// Show enrollment detail in modal
// Wrapper function for safe enrollment detail opening with error handling
window.openEnrollmentDetailSafely = function(enrollmentId) {
    try {
        console.log('[openEnrollmentDetailSafely] Wrapper called with ID:', enrollmentId);
        if (typeof window.debugRecentProfileFlow === 'function') {
            window.debugRecentProfileFlow('wrapper-called', enrollmentId);
        }
        if (typeof window.openStudentProfileFromEnrollment === 'function') {
            if (typeof window.debugRecentProfileFlow === 'function') {
                window.debugRecentProfileFlow('using-student-profile-bridge', enrollmentId);
            }
            Promise.resolve(window.openStudentProfileFromEnrollment(enrollmentId)).catch((err) => {
                console.warn('[openEnrollmentDetailSafely] Student Profile bridge failed, falling back to detail modal:', err && err.message ? err.message : err);
                if (typeof window.debugRecentProfileFlow === 'function') {
                    window.debugRecentProfileFlow('bridge-failed-fallback-detail', err && err.message ? err.message : 'unknown-error');
                }
                showEnrollmentDetail(enrollmentId);
            });
            return;
        }
        if (typeof window.debugRecentProfileFlow === 'function') {
            window.debugRecentProfileFlow('bridge-missing-fallback-detail', enrollmentId);
        }
        showEnrollmentDetail(enrollmentId);
    } catch (err) {
        console.error('[openEnrollmentDetailSafely] Caught error:', err);
        console.error('[openEnrollmentDetailSafely] Stack:', err.stack);
        showNotification('Error opening enrollment details: ' + err.message, 'error');
    }
};

async function showEnrollmentDetail(enrollmentId) {
    try {
        console.log('[showEnrollmentDetail] Opening modal for enrollment:', enrollmentId);
        
        // Verify modal element exists
        const modal = document.getElementById('enrollmentDetailModal');
        if (!modal) {
            console.error('[showEnrollmentDetail] Modal element not found!');
            showNotification('Error: Modal element not found', 'error');
            return;
        }
        console.log('[showEnrollmentDetail] Modal element found:', !!modal);
        
        // Fetch enrollment data
        const response = await apiFetch(`/api/enrollments/${enrollmentId}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const enrollment = await response.json();
        console.log('[showEnrollmentDetail] Enrollment data fetched:', enrollment.id);

        // Cache this enrollment in the in-memory store so reports can
        // use recently viewed/loaded enrollment objects without refetching.
        try { addEnrollmentToStore(enrollment); } catch (e) { /* ignore */ }

        let enrollmentData = {};
        try {
            if (typeof enrollment.enrollment_data === 'string') {
                enrollmentData = JSON.parse(enrollment.enrollment_data || '{}') || {};
            } else {
                enrollmentData = enrollment.enrollment_data || {};
            }
        } catch (e) {
            console.warn('[showEnrollmentDetail] Failed to parse enrollment.enrollment_data, falling back to empty object', e);
            enrollmentData = {};
        }

        let files = {};
        try {
            if (typeof enrollment.enrollment_files === 'string') {
                files = JSON.parse(enrollment.enrollment_files || '{}') || {};
            } else {
                files = enrollment.enrollment_files || {};
            }
        } catch (e) {
            console.warn('[showEnrollmentDetail] Failed to parse enrollment.enrollment_files, falling back to empty object', e);
            files = {};
        }

        // Extract data from enrollment object - fields are at top level
        const sanitizeNamePart = (value) => {
            const text = String(value || '').trim();
            if (!text) return '';
            if (text === '-' || text === '--' || text === '–') return '';
            if (text.toLowerCase() === 'null' || text.toLowerCase() === 'undefined') return '';
            return text;
        };
        const firstName = sanitizeNamePart(enrollment.firstname || enrollmentData.firstName);
        const lastName = sanitizeNamePart(enrollment.lastname || enrollmentData.lastName);
        const middleName = sanitizeNamePart(enrollment.middle_name || enrollmentData.middleName);
        const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ').trim() || '--';
        
        const email = enrollmentData.email || enrollment.email || '--';
        const phone = enrollment.phone || '--'; // Phone may not exist in current schema
        const birthdate = enrollment.birthdate ? new Date(enrollment.birthdate).toLocaleDateString() : '--';
        const sex = enrollment.sex || '--';
        const placeOfBirth = enrollment.place_of_birth || '--';
        const pickValue = (...values) => {
            for (const value of values) {
                if (value === undefined || value === null) continue;
                const text = String(value).trim();
                if (!text || text.toLowerCase() === 'null' || text.toLowerCase() === 'undefined') continue;
                return text;
            }
            return '';
        };
        const formatAddressPart = (value) => {
            const text = pickValue(value);
            return text || '--';
        };
        const normalizeYesNo = (...values) => {
            for (const value of values) {
                if (value === undefined || value === null) continue;
                const text = String(value).trim().toLowerCase();
                if (!text) continue;
                if (['yes', 'y', 'true', '1'].includes(text)) return 'Yes';
                if (['no', 'n', 'false', '0'].includes(text)) return 'No';
            }
            return 'No';
        };

        // Resolve mother tongue from multiple possible locations (top-level or enrollment_data)
        const motherTongueRaw = pickValue(
            enrollment.mother_tongue,
            enrollment.motherTongue,
            enrollmentData && (enrollmentData.mother_tongue || enrollmentData.motherTongue || enrollmentData.language)
        );
        const motherTongueOther = pickValue(
            enrollment.mother_tongue_other,
            enrollment.motherTongueOther,
            enrollmentData && (enrollmentData.mother_tongue_other || enrollmentData.motherTongueOther || enrollmentData.motherTongueOtherText)
        );
        const motherTongue = motherTongueRaw
            ? (motherTongueRaw.toLowerCase() === 'other' && motherTongueOther ? `Other - ${motherTongueOther}` : motherTongueRaw)
            : '--';
        const lrn = enrollmentData.lrn || enrollment.lrn_no || '--';
        
        // Academic fields
        const gradeLevel = enrollmentData.gradeLevel || enrollment.grade_to_enroll_id || '--';
        const track = enrollmentData.track || enrollment.track || '--';
        const semester = enrollment.semester || '--';

        const parseElectiveList = (value) => {
            if (Array.isArray(value)) {
                return value
                    .map(v => String(v || '').trim())
                    .filter(v => v && !['-', '--', 'null', 'undefined', 'n/a', 'na'].includes(v.toLowerCase()));
            }
            if (typeof value !== 'string') return [];
            const cleaned = value.trim();
            if (!cleaned || ['-', '--', 'null', 'undefined', 'n/a', 'na'].includes(cleaned.toLowerCase())) return [];
            const raw = cleaned
                .replace(/^\[|\]$/g, '')
                .replace(/^"|"$/g, '');
            return raw
                .split(/[,\n;|]+/)
                .map(v => v.replace(/^"|"$/g, '').trim())
                .filter(v => v && !['-', '--', 'null', 'undefined', 'n/a', 'na'].includes(v.toLowerCase()));
        };

        const electives = Array.from(new Set([
            ...parseElectiveList(enrollmentData.academicElectives),
            ...parseElectiveList(enrollmentData.techproElectives),
            ...parseElectiveList(enrollmentData.doorwayAcademic),
            ...parseElectiveList(enrollmentData.doorwayTechpro),
            ...parseElectiveList(enrollmentData.electives),
            ...parseElectiveList(enrollment.subjects),
            ...parseElectiveList(enrollment.interest)
        ]));
        const electivesDisplay = electives.length ? electives.join(', ') : '--';
        
        // Learning modality - check multiple modal fields
        let learningModality = '--';
        if (enrollment.modality_online === 1) learningModality = 'Online';
        else if (enrollment.modality_modular_print === 1) learningModality = 'Modular (Print)';
        else if (enrollment.modality_modular_digital === 1) learningModality = 'Modular (Digital)';
        else if (enrollment.modality_blended === 1) learningModality = 'Blended';
        else if (enrollment.modality_tv === 1) learningModality = 'TV';
        else if (enrollment.modality_rbi === 1) learningModality = 'RBI';
        else if (enrollment.modality_homeschooling === 1) learningModality = 'Homeschooling';
        
        // Address fields - current address
        const currentSitio = pickValue(
            enrollment.cu_address_sitio_street,
            enrollment.currentSitio,
            enrollmentData && (enrollmentData.currentSitio || enrollmentData.current_sitio || enrollmentData.currentAddressSitio)
        );
        const currentBarangay = pickValue(
            enrollment.currentBarangay,
            enrollmentData && (enrollmentData.currentBarangay || enrollmentData.current_barangay_name || enrollmentData.currentBarangayName || enrollmentData.barangay),
            enrollment.cu_address_barangay_name,
            enrollment.cu_address_barangay_id
        );
        const currentMunicipality = pickValue(
            enrollment.currentMunicipality,
            enrollmentData && (enrollmentData.currentMunicipality || enrollmentData.current_municipality_name || enrollmentData.currentMunicipalityName || enrollmentData.municipality),
            enrollment.cu_address_municipality_name,
            enrollment.cu_address_municipality_id
        );
        const currentProvince = pickValue(
            enrollment.currentProvince,
            enrollmentData && (enrollmentData.currentProvince || enrollmentData.current_province_name || enrollmentData.currentProvinceName || enrollmentData.province),
            enrollment.cu_address_province_name,
            enrollment.cu_address_province_id
        );
        const currentCountry = pickValue(
            enrollment.currentCountry,
            enrollmentData && (enrollmentData.currentCountry || enrollmentData.country)
        );
        const currentZipCode = pickValue(
            enrollment.cu_address_zip,
            enrollment.currentZipCode,
            enrollmentData && (enrollmentData.currentZipCode || enrollmentData.current_zip)
        );
        const currentAddress = [currentSitio, currentBarangay, currentMunicipality, currentProvince, currentCountry, currentZipCode]
            .filter(x => x && x.toString().trim() !== '')
            .join(', ') || '--';

        // Address fields - permanent address
        const permanentSitio = pickValue(
            enrollment.pe_address_sitio_street,
            enrollment.permanentSitio,
            enrollmentData && (enrollmentData.permanentSitio || enrollmentData.permanent_sitio || enrollmentData.permanentAddressSitio)
        );
        const permanentBarangay = pickValue(
            enrollment.permanentBarangay,
            enrollmentData && (enrollmentData.permanentBarangay || enrollmentData.permanent_barangay_name || enrollmentData.permanentBarangayName),
            enrollment.pe_address_barangay_name,
            enrollment.pe_address_barangay_id
        );
        const permanentMunicipality = pickValue(
            enrollment.permanentMunicipality,
            enrollmentData && (enrollmentData.permanentMunicipality || enrollmentData.permanent_municipality_name || enrollmentData.permanentMunicipalityName),
            enrollment.pe_address_municipality_name,
            enrollment.pe_address_municipality_id
        );
        const permanentProvince = pickValue(
            enrollment.permanentProvince,
            enrollmentData && (enrollmentData.permanentProvince || enrollmentData.permanent_province_name || enrollmentData.permanentProvinceName),
            enrollment.pe_address_province_name,
            enrollment.pe_address_province_id
        );
        const permanentCountry = pickValue(
            enrollment.permanentCountry,
            enrollmentData && (enrollmentData.permanentCountry || enrollmentData.country)
        );
        const permanentZipCode = pickValue(
            enrollment.pe_address_zip,
            enrollment.permanentZipCode,
            enrollmentData && (enrollmentData.permanentZipCode || enrollmentData.permanent_zip)
        );
        const sameAsCurrentAddress = ['yes', 'true', '1'].includes(
            String(
                pickValue(
                    enrollmentData && enrollmentData.sameAsCurrentAddress,
                    enrollment.address_permanent_current
                ) || ''
            ).toLowerCase()
        );

        const resolvedPermanentSitio = sameAsCurrentAddress ? (permanentSitio || currentSitio) : permanentSitio;
        const resolvedPermanentBarangay = sameAsCurrentAddress ? (permanentBarangay || currentBarangay) : permanentBarangay;
        const resolvedPermanentMunicipality = sameAsCurrentAddress ? (permanentMunicipality || currentMunicipality) : permanentMunicipality;
        const resolvedPermanentProvince = sameAsCurrentAddress ? (permanentProvince || currentProvince) : permanentProvince;
        const resolvedPermanentCountry = sameAsCurrentAddress ? (permanentCountry || currentCountry) : permanentCountry;
        const resolvedPermanentZipCode = sameAsCurrentAddress ? (permanentZipCode || currentZipCode) : permanentZipCode;

        const permanentAddress = [resolvedPermanentSitio, resolvedPermanentBarangay, resolvedPermanentMunicipality, resolvedPermanentProvince, resolvedPermanentCountry, resolvedPermanentZipCode]
            .filter(x => x && x.toString().trim() !== '')
            .join(', ') || '--';
        
        // Additional info
        const isIP = normalizeYesNo(enrollmentData.isIP, enrollmentData.ipStatus, enrollmentData.ip, enrollment.is_ip_member);
        const ipGroup = pickValue(enrollmentData.ipGroup, enrollmentData.ip_group, enrollment.ip_group);

        const is4Ps = normalizeYesNo(enrollmentData.is4Ps, enrollmentData.four_ps, enrollmentData.fourPs, enrollment.four_p_beneficiary);
        const householdID = pickValue(enrollmentData.householdID, enrollmentData.householdId, enrollmentData.household_no, enrollmentData.fourPsHouseholdNo);

        const isPWD = normalizeYesNo(enrollmentData.hasPWD, enrollmentData.isPWD, enrollment.learner_has_disability);
        const pwdFromArray = Array.isArray(enrollmentData.disabilities)
            ? enrollmentData.disabilities.map(d => String(d || '').trim()).filter(Boolean)
            : [];
        const pwdFromFlags = [];
        const disabilityMap = {
            disability_vi_blind: 'Blind',
            disability_vi_low: 'Low Vision',
            disability_hi: 'Hearing Impairment',
            disability_asd: 'Autism Spectrum Disorder',
            disability_sld: 'Speech/Language Disorder',
            disability_ld: 'Learning Disability',
            disability_ebd: 'Emotional/Behavioral Disorder',
            disability_cp: 'Cerebral Palsy',
            disability_intel: 'Intellectual Disability',
            disability_oph: 'Orthopedic Handicap',
            disability_hsp: 'Special Health Problem',
            disability_shp_cancer: 'Cancer',
            disability_multiple: 'Multiple Disability',
            disability_unsure: 'Unsure',
            disability_other: 'Other'
        };
        Object.keys(disabilityMap).forEach((key) => {
            const value = enrollment[key];
            const normalized = String(value === undefined || value === null ? '' : value).toLowerCase();
            if (normalized === '1' || normalized === 'yes' || normalized === 'true') {
                pwdFromFlags.push(disabilityMap[key]);
            }
        });
        const pwdSpecificList = Array.from(new Set([...pwdFromArray, ...pwdFromFlags]));
        const pwdSpecific = pwdSpecificList.length > 0 ? pwdSpecificList.join(', ') : '--';

        const isReturning = normalizeYesNo(enrollmentData.returningLearner, enrollment.returning);
        const returningLastGrade = pickValue(enrollmentData.lastGradeLevel, enrollmentData.last_grade_level, enrollment.last_grade_level_id);
        const returningLastSY = pickValue(enrollmentData.lastSchoolYear, enrollmentData.last_school_year, enrollment.last_school_year_id);
        const returningLastSchool = pickValue(enrollmentData.lastSchoolAttended, enrollmentData.last_school_attended, enrollment.last_school);
        
        // Update header info
        const headerElement = document.querySelector('.enrollment-header-subtitle');
        if (headerElement) {
            headerElement.textContent = fullName || 'Student Information';
        }

        let detailHTML = `
            <!-- Personal Information Tab -->
            <div class="enrollment-detail-section active" data-section="personal">
                <h3 class="section-title">👤 Personal Information</h3>
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="detail-label">Full Name</span>
                        <span class="detail-value">${fullName}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Email</span>
                        <span class="detail-value">${email}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Phone</span>
                        <span class="detail-value">${phone}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Birthdate</span>
                        <span class="detail-value">${birthdate}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Sex</span>
                        <span class="detail-value">${sex ? (sex.charAt(0).toUpperCase() + sex.slice(1)) : '--'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Place of Birth</span>
                        <span class="detail-value">${placeOfBirth}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Mother Tongue</span>
                        <span class="detail-value">${motherTongue}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">LRN</span>
                        <span class="detail-value">${lrn}</span>
                    </div>
                </div>
            </div>

            <!-- Academic Information Tab -->
            <div class="enrollment-detail-section" data-section="academic">
                <h3 class="section-title">🎓 Academic Information</h3>
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="detail-label">Grade Level</span>
                        <span class="detail-value">${gradeLevel && gradeLevel !== '--' ? 'Grade ' + gradeLevel : '--'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Track</span>
                        <span class="detail-value">${track && track !== '--' ? track.toUpperCase() : '--'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Semester</span>
                        <span class="detail-value">${semester && semester !== '--' ? semester.toUpperCase() : '--'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Electives</span>
                        <span class="detail-value">${electivesDisplay}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Learning Modality</span>
                        <span class="detail-value">${learningModality}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">School Year</span>
                        <span class="detail-value">2026-2027</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Status</span>
                        <span class="detail-value">
                            <span class="detail-status-badge ${enrollment.status.toLowerCase()}">${enrollment.status}</span>
                        </span>
                    </div>
                </div>
            </div>

            <!-- Address Information Tab -->
            <div class="enrollment-detail-section" data-section="address">
                <h3 class="section-title">📍 Current Address</h3>
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="detail-label">Province</span>
                        <span class="detail-value">${formatAddressPart(currentProvince)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Municipality</span>
                        <span class="detail-value">${formatAddressPart(currentMunicipality)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Barangay</span>
                        <span class="detail-value">${formatAddressPart(currentBarangay)}</span>
                    </div>
                    <div class="detail-item full-width">
                        <span class="detail-label">Full Address</span>
                        <span class="detail-value">${currentAddress}</span>
                    </div>
                </div>

                <h3 class="section-title" style="margin-top: 20px;">📍 Permanent Address</h3>
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="detail-label">Province</span>
                        <span class="detail-value">${formatAddressPart(resolvedPermanentProvince)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Municipality</span>
                        <span class="detail-value">${formatAddressPart(resolvedPermanentMunicipality)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Barangay</span>
                        <span class="detail-value">${formatAddressPart(resolvedPermanentBarangay)}</span>
                    </div>
                    <div class="detail-item full-width">
                        <span class="detail-label">Full Address</span>
                        <span class="detail-value">${permanentAddress}</span>
                    </div>
                </div>

                <h3 class="section-title" style="margin-top: 20px;">ℹ️ Additional Information</h3>
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="detail-label">IP Member</span>
                        <span class="detail-value">${isIP === 'Yes' && ipGroup ? `Yes - ${ipGroup}` : isIP}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">4Ps Beneficiary</span>
                        <span class="detail-value">${is4Ps === 'Yes' && householdID ? `Yes - Household ID: ${householdID}` : is4Ps}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">PWD</span>
                        <span class="detail-value">${isPWD}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Specific PWD</span>
                        <span class="detail-value">${isPWD === 'Yes' ? pwdSpecific : '--'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Returning Learner</span>
                        <span class="detail-value">${isReturning}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Last Grade Level</span>
                        <span class="detail-value">${isReturning === 'Yes' ? (returningLastGrade || '--') : '--'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Last School Year</span>
                        <span class="detail-value">${isReturning === 'Yes' ? (returningLastSY || '--') : '--'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Last School Attended</span>
                        <span class="detail-value">${isReturning === 'Yes' ? (returningLastSchool || '--') : '--'}</span>
                    </div>
                </div>
            </div>

            <!-- Documents Tab -->
            <div class="enrollment-detail-section" data-section="documents">
                <h3 class="section-title">📄 Submitted Documents</h3>
                <div class="document-grid">
                    ${files && Object.keys(files).length > 0 ? Object.entries(files).map(([key, dataUrl]) => {
                        const docLabel = key === 'psaBirthCert' ? 'PSA Birth Cert' : key === 'reportCard' ? 'Report Card' : key === 'studentImage' ? 'Photo' : key;
                        // Check if it's an image data URL
                        const isImage = dataUrl && typeof dataUrl === 'string' && dataUrl.startsWith('data:image');
                        if (!isImage) return '';
                        // Use data-src and a simple onclick that reads dataset to avoid complex escaping
                        return '<div class="document-preview-container">' +
                            '<img src="' + dataUrl + '" alt="' + escapeHtml(docLabel) + '" class="document-preview-image" data-src="' + escapeHtml(dataUrl) + '" onclick="viewDocument(this.dataset.src)">' +
                            '<div class="document-label">' + escapeHtml(docLabel) + '</div>' +
                        '</div>';
                    }).join('') : '<div class="no-documents">No documents submitted</div>'}
                </div>
            </div>
        `;

        // Update detail content
        const detailContainer = document.getElementById('enrollmentDetail');
        if (!detailContainer) {
            console.error('[showEnrollmentDetail] enrollmentDetail container not found!');
            showNotification('Error: Detail container not found', 'error');
            return;
        }
        detailContainer.innerHTML = detailHTML;
        console.log('[showEnrollmentDetail] Detail HTML inserted');
        
        // Update footer status
        const submittedDate = new Date(enrollment.enrollment_date).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        const footerStatus = document.getElementById('footerStatus');
        if (footerStatus) {
            footerStatus.textContent = `Submitted: ${submittedDate}`;
        }

        // CRITICAL: Ensure modal is visible before setting up tabs
        console.log('[showEnrollmentDetail] Making modal active - before:', modal.classList.contains('active'));
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        modal.style.display = 'flex';  // Force display
        console.log('[showEnrollmentDetail] Modal active - after:', modal.classList.contains('active'), 'display:', window.getComputedStyle(modal).display);

        // Setup tab switching - wrapped in try-catch to prevent modal from breaking
        try {
            console.log('[showEnrollmentDetail] Setting up tabs');
            setupEnrollmentTabs();
            console.log('[showEnrollmentDetail] Tabs setup complete');
        } catch (err) {
            console.error('[showEnrollmentDetail] Error setting up tabs:', err);
        }

        // Set enrollment ID for approve/reject actions
        const approveBtn = document.getElementById('approveBtn');
        const rejectBtn = document.getElementById('rejectBtn');
        if (approveBtn) approveBtn.onclick = () => updateEnrollmentStatus(enrollmentId, 'Approved');
        if (rejectBtn) rejectBtn.onclick = () => updateEnrollmentStatus(enrollmentId, 'Rejected');
        
        console.log('[showEnrollmentDetail] Modal fully loaded and visible');
    } catch (err) {
        console.error('[showEnrollmentDetail] Error loading enrollment detail:', err);
        console.error('[showEnrollmentDetail] Error stack:', err.stack);
        showNotification('Error loading enrollment details: ' + err.message, 'error');
    }
}

// Setup tab switching functionality - using event delegation to avoid listener accumulation
function setupEnrollmentTabs() {
    console.log('[setupEnrollmentTabs] Starting tab setup');
    
    const tabContainer = document.querySelector('.enrollment-modal-tabs');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const sections = document.querySelectorAll('.enrollment-detail-section');
    
    console.log('[setupEnrollmentTabs] Found', tabBtns.length, 'tab buttons and', sections.length, 'sections');
    
    // Ensure first section is active by default
    if (sections.length > 0) {
        sections.forEach((s, idx) => {
            if (idx === 0) {
                s.classList.add('active');
                console.log('[setupEnrollmentTabs] Set first section active:', s.getAttribute('data-section'));
            } else {
                s.classList.remove('active');
            }
        });
    }
    
    // Ensure first tab button is active by default
    if (tabBtns.length > 0) {
        tabBtns.forEach((b, idx) => {
            if (idx === 0) {
                b.classList.add('active');
                console.log('[setupEnrollmentTabs] Set first tab active:', b.getAttribute('data-tab'));
            } else {
                b.classList.remove('active');
            }
        });
    }
    
    // Remove old listener if it exists (avoid accumulation)
    if (tabContainer && tabContainer._tabListenerAttached) {
        console.log('[setupEnrollmentTabs] Removing old tab listener');
        tabContainer.removeEventListener('click', tabContainer._tabClickHandler);
    }
    
    // Create a single delegated listener for all tab buttons
    const tabClickHandler = (e) => {
        const btn = e.target.closest('.tab-btn');
        if (!btn) return;
        
        const tabName = btn.getAttribute('data-tab');
        console.log('[setupEnrollmentTabs] Tab clicked:', tabName);
        
        const tabBtns = document.querySelectorAll('.tab-btn');
        const sections = document.querySelectorAll('.enrollment-detail-section');
        
        // Remove active class from all tabs and sections
        tabBtns.forEach(b => {
            b.classList.remove('active');
        });
        sections.forEach(s => {
            s.classList.remove('active');
        });
        
        // Add active class to clicked tab and corresponding section
        btn.classList.add('active');
        const sectionEl = document.querySelector(`[data-section="${tabName}"]`);
        if (sectionEl) {
            sectionEl.classList.add('active');
            console.log('[setupEnrollmentTabs] Activated section:', tabName);
        } else {
            console.warn('[setupEnrollmentTabs] Section not found for tab:', tabName);
        }
    };
    
    // Attach the delegated listener
    if (tabContainer) {
        tabContainer.addEventListener('click', tabClickHandler);
        tabContainer._tabClickHandler = tabClickHandler;
        tabContainer._tabListenerAttached = true;
        console.log('[setupEnrollmentTabs] Tab listener attached');
    } else {
        console.warn('[setupEnrollmentTabs] Tab container not found');
    }
    
    console.log('[setupEnrollmentTabs] Tab setup complete');
}

// View document in zoom modal
function viewDocument(dataUrl) {
    const modal = document.getElementById('dashboardDocumentZoomModal') || createDocumentZoomModal();
    const img = modal.querySelector('img');
    img.src = dataUrl;
    modal.classList.add('active');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

// Create document zoom modal if it doesn't exist
function createDocumentZoomModal() {
    const modal = document.createElement('div');
    modal.id = 'dashboardDocumentZoomModal';
    modal.className = 'document-zoom-modal';
    modal.innerHTML = `
        <button class="zoom-close" aria-label="Close zoom">&times;</button>
        <div class="zoom-container">
            <img src="" alt="Document">
        </div>
    `;
    
    // Add close button functionality
    const closeBtn = modal.querySelector('.zoom-close');
    closeBtn.addEventListener('click', () => {
        modal.classList.remove('active');
        modal.style.display = 'none';
        document.body.style.overflow = '';
    });
    
    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }
    });
    
    // Close on Escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            modal.classList.remove('active');
            modal.style.display = 'none';
            document.body.style.overflow = '';
            document.removeEventListener('keydown', handleEscape);
        }
    };
    modal.addEventListener('keydown', handleEscape);
    
    document.body.appendChild(modal);
    return modal;
}

// Update enrollment status
async function updateEnrollmentStatus(enrollmentId, status) {
    try {
        // First, fetch the enrollment to get student_id
        const enrollResponse = await apiFetch(`/api/enrollments/${enrollmentId}`);
        if (!enrollResponse.ok) {
            throw new Error('Failed to fetch enrollment');
        }
        const enrollment = await enrollResponse.json();
        const studentId = enrollment.student_id;

        // Update the enrollment status
        const response = await apiFetch(`/api/enrollments/${enrollmentId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });

        if (!response.ok) {
            throw new Error('Failed to update enrollment');
        }

        // Create notification for the student
        try {
            console.log('[updateEnrollmentStatus] Creating notification for enrollment:', enrollmentId, 'student:', studentId);
            console.log('[updateEnrollmentStatus] Student ID type:', typeof studentId);
            const notificationTitle = status === 'Approved' ? '✅ Enrollment Approved' : '❌ Enrollment Rejected';
            const notificationMessage = status === 'Approved' 
                ? 'Your enrollment has been approved! Check the student dashboard for more details.'
                : 'Unfortunately, your enrollment was not approved. Please contact the school office for more information.';

            const notificationPayload = {
                student_id: studentId,
                type: 'enrollment_' + status.toLowerCase(),
                title: notificationTitle,
                message: notificationMessage,
                related_data: {
                    enrollment_id: enrollmentId,
                    status: status
                }
            };
            console.log('[updateEnrollmentStatus] Notification payload:', JSON.stringify(notificationPayload, null, 2));
            console.log('[updateEnrollmentStatus] API URL:', API_BASE + '/api/notifications');
            const notifResp = await apiFetch('/api/notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(notificationPayload)
            });
            console.log('[updateEnrollmentStatus] Notification response status:', notifResp.status);
            if (!notifResp.ok) {
                const errText = await notifResp.text();
                console.warn('[updateEnrollmentStatus] Notification creation failed:', errText);
            } else {
                const notifData = await notifResp.json();
                console.log('[updateEnrollmentStatus] Notification created successfully:', notifData);
            }
        } catch (notifErr) {
            console.warn('[updateEnrollmentStatus] Failed to create notification:', notifErr);
            // Don't fail the enrollment update if notification fails
        }

        try {
            await createAdminNotification(
                'enrollment_' + status.toLowerCase(),
                `Enrollment ${status}`,
                `Enrollment #${enrollmentId} was marked as ${status}.`,
                { enrollment_id: enrollmentId, status }
            );
        } catch (adminNotifErr) {
            console.warn('[updateEnrollmentStatus] Failed to create admin notification:', adminNotifErr);
        }

        showNotification(`✅ Enrollment ${status}!`, 'success');
        closeEnrollmentModal();
        loadEnrollments();
        loadRecentEnrollments();
        loadDashboardStats();
        // Notify other tabs/windows about the update
        try {
            localStorage.setItem('enrollmentUpdate', JSON.stringify({ id: enrollmentId, status, ts: Date.now() }));
        } catch (e) {
            // ignore
        }
    } catch (err) {
        console.error('Error updating enrollment:', err);
        showNotification('Failed to update enrollment', 'error');
    }
}

// Setup navigation
function setupNavigation() {
    const sections = document.querySelectorAll('.section');

    ensureRecentEnrollmentsGlobalToggleBinding();

    const recentToggle = document.getElementById('recentEnrollmentsToggle');
    if (recentToggle && !recentToggle.dataset.boundToggle) {
        recentToggle.dataset.boundToggle = '1';
        recentToggle.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
                await toggleRecentEnrollmentsView();
            } catch (toggleErr) {
                console.warn('[RecentEnrollments] toggle click failed:', toggleErr);
                if (typeof showNotification === 'function') {
                    showNotification('Unable to expand recent enrollments right now.', 'warning');
                }
            }
        });
    }

    // Handle top-level links (e.g., Dashboard)
    const topLinks = document.querySelectorAll('.sidebar-menu > .menu-item[data-section]');
    topLinks.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = item.getAttribute('data-section');

            // Clear active states on all menu items and submenu items
            document.querySelectorAll('.sidebar-menu .menu-item').forEach(i => i.classList.remove('active'));
            // Also collapse groups
            document.querySelectorAll('.menu-group').forEach(g => g.classList.remove('expanded'));

            item.classList.add('active');
            sections.forEach(s => s.classList.remove('active'));
            document.getElementById(sectionId).classList.add('active');

            // Close sidebar on mobile
            const sidebar = document.getElementById('sidebar');
            if (sidebar.classList.contains('active')) {
                sidebar.classList.remove('active');
                document.getElementById('hamburgerBtn').classList.remove('active');
                document.body.classList.remove('sidebar-open');
                document.body.style.overflow = '';
            }

            if (sectionId === 'enrollment') {
                loadEnrollments();
                setTimeout(forceEnrollmentTabBootstrap, 150);
                setTimeout(forceEnrollmentTabBootstrap, 800);
            }
        });
    });

    // Handle menu group toggles
    const toggles = document.querySelectorAll('.menu-toggle');
    toggles.forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation(); // Prevent event from bubbling to other handlers
            const group = toggle.closest('.menu-group');
            const expanded = group.classList.toggle('expanded');
            toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
            group.querySelector('.submenu').setAttribute('aria-hidden', expanded ? 'false' : 'true');
        });
    });

    // Handle submenu link clicks
    const submenuLinks = document.querySelectorAll('.submenu-item');
    submenuLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const sectionId = link.getAttribute('data-section');
            const normalizedSectionId = sectionId === 'teaching-assignments' ? 'teacher-registration' : sectionId;

            // Clear active states
            document.querySelectorAll('.sidebar-menu .menu-item').forEach(i => i.classList.remove('active'));

            // Mark link active and its parent group active
            link.classList.add('active');
            const parentGroup = link.closest('.menu-group');
            if (parentGroup) parentGroup.classList.add('expanded');
            const toggleBtn = parentGroup ? parentGroup.querySelector('.menu-toggle') : null;
            if (toggleBtn) toggleBtn.classList.add('active');

            // Show section
            sections.forEach(s => s.classList.remove('active'));
            const targetSection = document.getElementById(normalizedSectionId);
            if (!targetSection) return;
            targetSection.classList.add('active');

            // Close sidebar on mobile
            const sidebar = document.getElementById('sidebar');
            if (window.innerWidth <= 768 && sidebar.classList.contains('active')) {
                sidebar.classList.remove('active');
                document.getElementById('hamburgerBtn').classList.remove('active');
                document.body.classList.remove('sidebar-open');
                document.body.style.overflow = '';
            }

            if (sectionId === 'enrollment') {
                loadEnrollments();
                setTimeout(forceEnrollmentTabBootstrap, 150);
                setTimeout(forceEnrollmentTabBootstrap, 800);
            }
            if (sectionId === 'teacher-registration' && typeof window.switchTeachersMainTab === 'function') {
                window.switchTeachersMainTab('registration');
            }
            if (sectionId === 'teaching-assignments' && typeof window.switchTeachersMainTab === 'function') {
                window.switchTeachersMainTab('assignments');
            }
            if (sectionId === 'rejected') loadRejectedEnrollments();
            if (sectionId === 'directory') typeof loadStudents === 'function' && loadStudents();
            if (sectionId === 'sections') typeof loadExistingSections === 'function' && loadExistingSections();
        });
    });
}

// Setup profile dropdown
function setupProfile() {
    const profileBtn = document.getElementById('profileBtn');
    const dropdownMenu = document.getElementById('dropdownMenu');
    const logoutBtn = document.getElementById('logoutBtn');

    profileBtn.addEventListener('click', () => {
        dropdownMenu.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.profile-dropdown')) {
            dropdownMenu.classList.remove('active');
        }
    });

    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('adminData');
        localStorage.removeItem('rememberAdmin');
        showNotification('Logged out', 'success');
        setTimeout(() => {
            window.location.href = withSchoolParam('auth.html?role=admin');
        }, 800);
    });
}

const ADMIN_SETTINGS_STORAGE_KEY_BASE = 'adminDashboardSettingsV1';
const ADMIN_PORTAL_CONTENT_STORAGE_KEY_BASE = 'adminPortalPageContentV1';
// backup scope selection removed; backups always include entire database

function getSchoolScopedStorageKey(baseKey) {
    const school = String(activeSchoolCode || detectSchoolCode() || '').trim().toLowerCase();
    return school ? `${baseKey}:${school}` : baseKey;
}

function getStorageWithSchoolFallback(baseKey) {
    const scopedKey = getSchoolScopedStorageKey(baseKey);
    const scopedValue = localStorage.getItem(scopedKey);
    if (scopedValue && String(scopedValue).trim()) return scopedValue;
    return localStorage.getItem(baseKey);
}

function setStorageForCurrentSchool(baseKey, value) {
    const scopedKey = getSchoolScopedStorageKey(baseKey);
    localStorage.setItem(scopedKey, value);
}

const DEFAULT_PORTAL_PAGE_CONTENT = {
    heroTagline: '',
    aboutTitle: '',
    aboutCardsHtml: '',
    schoolInfoTitle: '',
    schoolInfoCardsHtml: '',
    footerTagline: '',
    contactHtml: '',
    copyrightText: ''
};

function getCurrentAdminId() {
    const school = String(activeSchoolCode || detectSchoolCode() || '').trim().toLowerCase();
    const scopedKey = school ? `adminData:${school}` : 'adminData';
    try {
        const raw = sessionStorage.getItem(scopedKey)
            || localStorage.getItem(scopedKey)
            || sessionStorage.getItem('adminData')
            || localStorage.getItem('adminData');
        if (!raw) return null;
        const admin = JSON.parse(raw);
        const id = admin?.id || admin?.admin_id;
        return id ? parseInt(id, 10) : null;
    } catch (_) {
        return null;
    }
}

function decodeJwtPayload(token) {
    try {
        const raw = String(token || '').trim();
        if (!raw || raw.split('.').length < 2) return null;
        const base64Url = raw.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
        const json = atob(padded);
        return JSON.parse(json);
    } catch (_) {
        return null;
    }
}

function getAdminIdFromToken() {
    try {
        const payload = decodeJwtPayload(localStorage.getItem('adminAuthToken')) || {};
        const id = Number(payload.uid || payload.adminId || payload.admin_id || payload.sub || 0);
        return id > 0 ? id : null;
    } catch (_) {
        return null;
    }
}

async function resolveCurrentAdminId() {
    const school = String(activeSchoolCode || detectSchoolCode() || '').trim().toLowerCase();
    const scopedKey = school ? `adminData:${school}` : 'adminData';

    try {
        const response = await apiFetch('/api/admin/me', { method: 'GET' });
        if (!response.ok) {
            const localId = getCurrentAdminId();
            return localId || null;
        }
        const data = await response.json().catch(() => null);
        const admin = data?.admin;
        const id = admin?.id || admin?.admin_id;
        if (!id) {
            const localId = getCurrentAdminId();
            return localId || null;
        }

        const normalizedAdmin = {
            id: Number(id),
            email: admin?.email || '',
            name: admin?.name || 'Admin',
            role: admin?.role || 'admin',
            loginTime: new Date().toISOString()
        };
        sessionStorage.setItem(scopedKey, JSON.stringify(normalizedAdmin));
        localStorage.setItem(scopedKey, JSON.stringify(normalizedAdmin));
        localStorage.setItem('adminData', JSON.stringify(normalizedAdmin));
        return Number(id);
    } catch (_) {
        const localId = getCurrentAdminId();
        if (localId) return localId;
        return getAdminIdFromToken();
    }
}

function getDefaultAdminSettings() {
    let adminName = 'Admin';
    let adminEmail = '';
    try {
        const raw = localStorage.getItem('adminData');
        if (raw) {
            const admin = JSON.parse(raw);
            adminName = admin?.name || adminName;
            adminEmail = admin?.email || '';
        }
    } catch (_) {}

    return {
        account: {
            name: adminName,
            email: adminEmail
        },
        notifications: {
            inApp: true,
            sound: false,
            enrollment: true,
            section: true,
            teacher: true
        },
        security: {
            sessionTimeout: '30',
            reauthDestructive: true
        }
    };
}

function loadAdminSettings() {
    const defaults = getDefaultAdminSettings();
    try {
        const raw = getStorageWithSchoolFallback(ADMIN_SETTINGS_STORAGE_KEY_BASE);
        if (!raw) return defaults;
        const saved = JSON.parse(raw);
        return {
            account: { ...defaults.account, ...(saved.account || {}) },
            notifications: { ...defaults.notifications, ...(saved.notifications || {}) },
            security: { ...defaults.security, ...(saved.security || {}) }
        };
    } catch (_) {
        return defaults;
    }
}

function saveAdminSettings(settings) {
    setStorageForCurrentSchool(ADMIN_SETTINGS_STORAGE_KEY_BASE, JSON.stringify(settings));
}

function normalizePortalPageContent(candidate) {
    const src = candidate && typeof candidate === 'object' ? candidate : {};
    return {
        heroTagline: String(src.heroTagline || ''),
        aboutTitle: String(src.aboutTitle || ''),
        aboutCardsHtml: String(src.aboutCardsHtml || ''),
        schoolInfoTitle: String(src.schoolInfoTitle || ''),
        schoolInfoCardsHtml: String(src.schoolInfoCardsHtml || ''),
        footerTagline: String(src.footerTagline || ''),
        contactHtml: String(src.contactHtml || ''),
        copyrightText: String(src.copyrightText || '')
    };
}

function loadPortalPageContentLocal() {
    try {
        const raw = getStorageWithSchoolFallback(ADMIN_PORTAL_CONTENT_STORAGE_KEY_BASE);
        if (!raw) return { ...DEFAULT_PORTAL_PAGE_CONTENT };
        const parsed = JSON.parse(raw);
        return normalizePortalPageContent({ ...DEFAULT_PORTAL_PAGE_CONTENT, ...(parsed || {}) });
    } catch (_) {
        return { ...DEFAULT_PORTAL_PAGE_CONTENT };
    }
}

function savePortalPageContentLocal(content) {
    const normalized = normalizePortalPageContent(content);
    setStorageForCurrentSchool(ADMIN_PORTAL_CONTENT_STORAGE_KEY_BASE, JSON.stringify(normalized));
}

async function loadAdminSettingsFromServer(adminId) {
    if (!adminId) return null;
    const response = await apiFetch(`/api/admin/${adminId}/settings`);
    if (!response.ok) return null;
    const data = await response.json();
    if (!data || !data.settings || typeof data.settings !== 'object') return null;
    return data.settings;
}

async function saveAdminSettingsToServer(adminId, settings) {
    if (!adminId) return false;
    const response = await apiFetch(`/api/admin/${adminId}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings })
    });
    return response.ok;
}

async function loadPortalPageContentFromServer() {
    const response = await apiFetch('/api/admin/portal-page-content');
    if (!response.ok) return null;
    const data = await response.json();
    if (!data || !data.success || !data.content || typeof data.content !== 'object') return null;
    return normalizePortalPageContent(data.content);
}

async function savePortalPageContentToServer(content) {
    const response = await apiFetch('/api/admin/portal-page-content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: normalizePortalPageContent(content) })
    });
    return response.ok;
}

function populateAdminSettingsForm(settings) {
    const nameInput = document.getElementById('settingsAdminName');
    const emailInput = document.getElementById('settingsAdminEmail');
    const notifInApp = document.getElementById('settingsNotifInApp');
    const notifSound = document.getElementById('settingsNotifSound');
    const notifEnrollment = document.getElementById('settingsNotifEnrollment');
    const notifSection = document.getElementById('settingsNotifSection');
    const notifTeacher = document.getElementById('settingsNotifTeacher');
    const sessionTimeout = document.getElementById('settingsSessionTimeout');
    const reauthDestructive = document.getElementById('settingsReauthDestructive');

    if (nameInput) nameInput.value = settings.account.name || '';
    if (emailInput) emailInput.value = settings.account.email || '';
    if (notifInApp) notifInApp.checked = !!settings.notifications.inApp;
    if (notifSound) notifSound.checked = !!settings.notifications.sound;
    if (notifEnrollment) notifEnrollment.checked = !!settings.notifications.enrollment;
    if (notifSection) notifSection.checked = !!settings.notifications.section;
    if (notifTeacher) notifTeacher.checked = !!settings.notifications.teacher;
    if (sessionTimeout) sessionTimeout.value = String(settings.security.sessionTimeout || '30');
    if (reauthDestructive) reauthDestructive.checked = !!settings.security.reauthDestructive;
}

function populatePortalContentForm(content) {
    const normalized = normalizePortalPageContent(content);
    const bind = (id, value) => {
        const element = document.getElementById(id);
        if (element) element.value = value || '';
    };

    bind('settingsPortalHeroTagline', normalized.heroTagline);
    bind('settingsPortalAboutTitle', normalized.aboutTitle);
    bind('settingsPortalAboutHtml', normalized.aboutCardsHtml);
    bind('settingsPortalInfoTitle', normalized.schoolInfoTitle);
    bind('settingsPortalInfoHtml', normalized.schoolInfoCardsHtml);
    bind('settingsPortalFooterTagline', normalized.footerTagline);
    bind('settingsPortalContactHtml', normalized.contactHtml);
    bind('settingsPortalCopyright', normalized.copyrightText);
}

function collectAdminSettingsForm() {
    return {
        account: {
            name: (document.getElementById('settingsAdminName')?.value || '').trim() || 'Admin',
            email: (document.getElementById('settingsAdminEmail')?.value || '').trim()
        },
        notifications: {
            inApp: !!document.getElementById('settingsNotifInApp')?.checked,
            sound: !!document.getElementById('settingsNotifSound')?.checked,
            enrollment: !!document.getElementById('settingsNotifEnrollment')?.checked,
            section: !!document.getElementById('settingsNotifSection')?.checked,
            teacher: !!document.getElementById('settingsNotifTeacher')?.checked
        },
        security: {
            sessionTimeout: String(document.getElementById('settingsSessionTimeout')?.value || '30'),
            reauthDestructive: !!document.getElementById('settingsReauthDestructive')?.checked
        }
    };
}

function collectPortalContentForm() {
    const getValue = (id) => String(document.getElementById(id)?.value || '');
    return normalizePortalPageContent({
        heroTagline: getValue('settingsPortalHeroTagline'),
        aboutTitle: getValue('settingsPortalAboutTitle'),
        aboutCardsHtml: getValue('settingsPortalAboutHtml'),
        schoolInfoTitle: getValue('settingsPortalInfoTitle'),
        schoolInfoCardsHtml: getValue('settingsPortalInfoHtml'),
        footerTagline: getValue('settingsPortalFooterTagline'),
        contactHtml: getValue('settingsPortalContactHtml'),
        copyrightText: getValue('settingsPortalCopyright')
    });
}

function applyAdminSettings(settings) {
    const adminNameEl = document.getElementById('adminName');
    if (adminNameEl) adminNameEl.textContent = settings.account.name || 'Admin';

    const notificationBadge = document.getElementById('notificationBadge');
    if (notificationBadge) {
        notificationBadge.style.display = settings.notifications.inApp ? 'inline-flex' : 'none';
    }

    document.body.dataset.adminSessionTimeout = String(settings.security.sessionTimeout || '30');
    document.body.dataset.adminReauthDestructive = settings.security.reauthDestructive ? 'true' : 'false';

    try {
        const raw = localStorage.getItem('adminData');
        if (raw) {
            const admin = JSON.parse(raw);
            admin.name = settings.account.name || admin.name || 'Admin';
            if (settings.account.email) admin.email = settings.account.email;
            localStorage.setItem('adminData', JSON.stringify(admin));
        }
    } catch (_) {}
}

function setActiveAdminSettingsTab(tabName) {
    const tabButtons = document.querySelectorAll('.admin-settings-tab-btn');
    const tabPanels = document.querySelectorAll('.admin-settings-tab-content');
    tabButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.settingsTab === tabName);
    });
    tabPanels.forEach(panel => {
        panel.classList.toggle('active', panel.dataset.settingsPanel === tabName);
    });
}

function openAdminSettingsPanel() {
    const overlay = document.getElementById('adminSettingsOverlay');
    if (!overlay) return;
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
}

function closeAdminSettingsPanel() {
    const overlay = document.getElementById('adminSettingsOverlay');
    if (!overlay) return;
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
}

async function createAdminNotification(type, title, message, relatedData = {}) {
    const adminId = getCurrentAdminId();
    if (!adminId) return;
    try {
        await apiFetch('/api/notifications/admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                admin_id: adminId,
                type,
                title,
                message,
                related_data: relatedData
            })
        });
    } catch (err) {
        console.warn('[NotificationCenter] Failed to create admin notification:', err?.message || err);
    }
}

function setupNotificationCenter() {
    const bellBtn = document.getElementById('adminNotificationBtn') || document.querySelector('.notification-btn');
    const overlay = document.getElementById('adminNotificationOverlay');
    const backdrop = document.getElementById('adminNotificationBackdrop');
    const closeBtn = document.getElementById('adminNotificationClose');
    const listEl = document.getElementById('adminNotifList');
    const markAllReadBtn = document.getElementById('adminNotifMarkAllRead');
    const refreshBtn = document.getElementById('adminNotifRefresh');
    const tabButtons = document.querySelectorAll('.admin-notif-tab-btn');
    const badgeEl = document.getElementById('notificationBadge');

    if (!bellBtn || !overlay || !listEl) return;

    let notifications = [];
    let activeFilter = 'all';

    const parseRelatedData = (value) => {
        if (!value) return {};
        if (typeof value === 'object') return value;
        try { return JSON.parse(value); } catch (_) { return {}; }
    };

    const formatDate = (value) => {
        if (!value) return '--';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '--';
        return date.toLocaleString();
    };

    const inferCategory = (type = '') => {
        const normalized = String(type).toLowerCase();
        if (normalized.includes('enrollment')) return 'enrollment';
        if (normalized.includes('section')) return 'section';
        if (normalized.includes('teacher')) return 'teacher';
        return 'system';
    };

    const applyFilter = (items) => {
        if (activeFilter === 'all') return items;
        if (activeFilter === 'unread') return items.filter(item => !item.is_read);
        return items.filter(item => inferCategory(item.type) === activeFilter);
    };

    const setBadgeCount = async () => {
        const adminId = getCurrentAdminId();
        if (!adminId || !badgeEl) return;
        try {
            const response = await apiFetch(`/api/notifications/admin/${adminId}/unread-count`);
            if (!response.ok) return;
            const data = await response.json();
            const count = Number(data?.unread_count || 0);
            badgeEl.textContent = String(count);
            badgeEl.style.display = count > 0 ? 'inline-flex' : 'none';
        } catch (err) {
            console.warn('[NotificationCenter] Failed to update unread count:', err?.message || err);
        }
    };

    const goToNotificationContext = (notification) => {
        const related = parseRelatedData(notification.related_data);
        const type = inferCategory(notification.type);

        if (type === 'enrollment') {
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            document.getElementById('enrollment')?.classList.add('active');
            if (related.enrollment_id && typeof openEnrollmentDetailSafely === 'function') {
                openEnrollmentDetailSafely(related.enrollment_id);
            } else if (typeof loadEnrollments === 'function') {
                loadEnrollments();
            }
        } else if (type === 'section') {
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            document.getElementById('sections')?.classList.add('active');
            if (typeof loadExistingSections === 'function') loadExistingSections();
        } else if (type === 'teacher') {
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            document.getElementById('teacher-registration')?.classList.add('active');
            if (typeof window.switchTeachersMainTab === 'function') {
                window.switchTeachersMainTab('assignments');
            } else if (typeof window.loadTeachingAssignmentsV2 === 'function') {
                window.loadTeachingAssignmentsV2();
            }
        }

        overlay.classList.remove('active');
        overlay.setAttribute('aria-hidden', 'true');
    };

    const markNotificationRead = async (notificationId) => {
        const adminId = getCurrentAdminId();
        if (!adminId) return;
        const response = await apiFetch(`/api/notifications/admin/${adminId}/${notificationId}/read`, { method: 'PUT' });
        if (!response.ok) throw new Error('Failed to mark as read');
    };

    const deleteNotification = async (notificationId) => {
        const adminId = getCurrentAdminId();
        if (!adminId) return;
        const response = await apiFetch(`/api/notifications/admin/${adminId}/${notificationId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete notification');
    };

    const renderNotifications = () => {
        const filtered = applyFilter(notifications);
        if (!filtered.length) {
            listEl.innerHTML = '<p class="no-data">No notifications found for this filter.</p>';
            return;
        }

        listEl.innerHTML = filtered.map(item => {
            const isUnread = !item.is_read;
            return `
                <div class="admin-notif-item ${isUnread ? 'unread' : ''}" data-id="${item.id}">
                    <div class="admin-notif-title">${escapeHtml(item.title || 'Notification')}</div>
                    <div class="admin-notif-message">${escapeHtml(item.message || '--')}</div>
                    <div class="admin-notif-meta">${escapeHtml(item.type || 'system')} • ${escapeHtml(formatDate(item.created_at))}</div>
                    <div class="admin-notif-controls">
                        ${isUnread ? '<button type="button" class="btn btn-secondary admin-notif-read">Mark read</button>' : ''}
                        <button type="button" class="btn btn-secondary admin-notif-open">Open</button>
                        <button type="button" class="btn btn-secondary admin-notif-delete">Delete</button>
                    </div>
                </div>
            `;
        }).join('');

        listEl.querySelectorAll('.admin-notif-item').forEach(itemEl => {
            const id = parseInt(itemEl.dataset.id, 10);
            const notification = notifications.find(n => Number(n.id) === id);
            if (!notification) return;

            const readBtn = itemEl.querySelector('.admin-notif-read');
            const openBtn = itemEl.querySelector('.admin-notif-open');
            const deleteBtn = itemEl.querySelector('.admin-notif-delete');

            if (readBtn) {
                readBtn.addEventListener('click', async () => {
                    try {
                        await markNotificationRead(id);
                        notification.is_read = 1;
                        renderNotifications();
                        await setBadgeCount();
                    } catch (err) {
                        showNotification(err?.message || 'Failed to mark notification as read', 'error');
                    }
                });
            }

            if (openBtn) {
                openBtn.addEventListener('click', async () => {
                    try {
                        if (!notification.is_read) {
                            await markNotificationRead(id);
                            notification.is_read = 1;
                            await setBadgeCount();
                        }
                    } catch (_) {}
                    goToNotificationContext(notification);
                });
            }

            if (deleteBtn) {
                deleteBtn.addEventListener('click', async () => {
                    try {
                        await deleteNotification(id);
                        notifications = notifications.filter(n => Number(n.id) !== id);
                        renderNotifications();
                        await setBadgeCount();
                    } catch (err) {
                        showNotification(err?.message || 'Failed to delete notification', 'error');
                    }
                });
            }
        });
    };

    const loadNotifications = async () => {
        const adminId = getCurrentAdminId();
        if (!adminId) {
            listEl.innerHTML = '<p class="no-data">Admin session not found.</p>';
            return;
        }

        try {
            const response = await apiFetch(`/api/notifications/admin/${adminId}?limit=100`);
            if (!response.ok) throw new Error('Unable to load notifications');
            notifications = await response.json();
            if (!Array.isArray(notifications)) notifications = [];
            renderNotifications();
            await setBadgeCount();
        } catch (err) {
            listEl.innerHTML = '<p class="no-data">Failed to load notifications.</p>';
            console.warn('[NotificationCenter] Load error:', err?.message || err);
        }
    };

    bellBtn.addEventListener('click', async () => {
        overlay.classList.add('active');
        overlay.setAttribute('aria-hidden', 'false');
        await loadNotifications();
    });

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            overlay.classList.remove('active');
            overlay.setAttribute('aria-hidden', 'true');
        });
    }

    if (backdrop) {
        backdrop.addEventListener('click', () => {
            overlay.classList.remove('active');
            overlay.setAttribute('aria-hidden', 'true');
        });
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            await loadNotifications();
            showNotification('Notifications refreshed', 'info');
        });
    }

    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', async () => {
            const adminId = getCurrentAdminId();
            if (!adminId) return;
            try {
                const response = await apiFetch(`/api/notifications/admin/${adminId}/read-all`, { method: 'PUT' });
                if (!response.ok) throw new Error('Failed to mark all as read');
                notifications = notifications.map(n => ({ ...n, is_read: 1 }));
                renderNotifications();
                await setBadgeCount();
                showNotification('All notifications marked as read', 'success');
            } catch (err) {
                showNotification(err?.message || 'Failed to mark all as read', 'error');
            }
        });
    }

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            activeFilter = btn.dataset.notifFilter || 'all';
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderNotifications();
        });
    });

    setBadgeCount();
    setInterval(() => { setBadgeCount(); }, 15000);
}

function setupAdminSettingsPanel() {
    if (window.__adminSettingsPanelBound) return;
    const settingsBtn = document.getElementById('adminSettingsBtn') || document.querySelector('.settings-btn');
    const closeBtn = document.getElementById('adminSettingsClose');
    const backdrop = document.getElementById('adminSettingsBackdrop');
    const saveBtn = document.getElementById('adminSettingsSave');
    const resetBtn = document.getElementById('adminSettingsReset');
    const tabButtons = document.querySelectorAll('.admin-settings-tab-btn');

    const backupEnabledEl = document.getElementById('settingsBackupEnabled');
    const backupIntervalEl = document.getElementById('settingsBackupInterval');
    // scope controls removed so we don't query them any more
    const backupSavePolicyBtn = document.getElementById('settingsSaveBackupPolicy');
    const backupNowBtn = document.getElementById('settingsBackupNow');
    const backupRefreshBtn = document.getElementById('settingsRefreshBackupHistory');
    const backupHistoryBody = document.getElementById('settingsBackupHistoryBody');
    const backupMetaEl = document.getElementById('settingsBackupMeta');
    const portalPreviewBtn = document.getElementById('settingsPortalPreview');

    if (!settingsBtn) return;

    const bindTabHandlers = () => {
        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                try {
                    setActiveAdminSettingsTab(btn.dataset.settingsTab);
                } catch (err) {
                    console.warn('[AdminSettings] tab switch failed', err);
                }
            });
        });
    };

    bindTabHandlers();

    if (closeBtn) closeBtn.addEventListener('click', closeAdminSettingsPanel);
    if (backdrop) backdrop.addEventListener('click', closeAdminSettingsPanel);

    const mergeWithDefaults = (candidate) => {
        const defaults = getDefaultAdminSettings();
        return {
            account: { ...defaults.account, ...(candidate?.account || {}) },
            notifications: { ...defaults.notifications, ...(candidate?.notifications || {}) },
            security: { ...defaults.security, ...(candidate?.security || {}) }
        };
    };

    const hasLocalAdminSettings = () => {
        try {
            const raw = getStorageWithSchoolFallback(ADMIN_SETTINGS_STORAGE_KEY_BASE);
            return !!(raw && String(raw).trim());
        } catch (_) {
            return false;
        }
    };

    const hasLocalPortalContent = () => {
        try {
            const raw = getStorageWithSchoolFallback(ADMIN_PORTAL_CONTENT_STORAGE_KEY_BASE);
            return !!(raw && String(raw).trim());
        } catch (_) {
            return false;
        }
    };

    const hydrateSettingsFromServer = async () => {
        const adminId = getCurrentAdminId();
        if (!adminId) return;
        try {
            const [serverSettings, portalContent] = await Promise.all([
                loadAdminSettingsFromServer(adminId),
                loadPortalPageContentFromServer()
            ]);
            const canApplyServerSettings = !hasLocalAdminSettings();
            const canApplyServerPortal = !hasLocalPortalContent();

            if (serverSettings && canApplyServerSettings) {
                const merged = mergeWithDefaults(serverSettings);
                saveAdminSettings(merged);
                populateAdminSettingsForm(merged);
                applyAdminSettings(merged);
            }

            if (portalContent && canApplyServerPortal) {
                savePortalPageContentLocal(portalContent);
                populatePortalContentForm(portalContent);
            }
        } catch (err) {
            console.warn('[AdminSettings] Failed to load server settings:', err?.message || err);
        }
    };

    const getSelectedBackupScope = () => {
        // scope selection no longer used. return empty array for compatibility.
    return [];
    };

    const setSelectedBackupScope = (scope) => {
        // nothing to restore since the UI no longer shows scopes
    };

    const formatBackupDate = (value) => {
        if (!value) return '--';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '--';
        return date.toLocaleString();
    };

    const formatFileSize = (bytes) => {
        const size = Number(bytes || 0);
        if (!size) return '--';
        if (size < 1024) return `${size} B`;
        if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
        return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    };

    const resetBackupControlsToDefaults = () => {
        if (backupEnabledEl) backupEnabledEl.checked = false;
        if (backupIntervalEl) backupIntervalEl.value = '24';
        // scope controls removed; nothing to reset
        if (backupMetaEl) {
            backupMetaEl.textContent = 'Last backup: -- | Next scheduled backup: --';
        }
    };

    const collectBackupPolicyPayload = () => ({
        enabled: !!backupEnabledEl?.checked,
        interval_hours: Number(backupIntervalEl?.value || 24)
    });

    const saveBackupPolicyToServer = async (adminId, payload) => {
        if (!adminId) return false;
        try {
            const response = await apiFetch(`/api/backups/policy/${adminId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload || collectBackupPolicyPayload())
            });
            return !!response.ok;
        } catch (_) {
            return false;
        }
    };

    const renderBackupHistory = (history, adminId) => {
        if (!backupHistoryBody) return;
        if (!Array.isArray(history) || history.length === 0) {
            backupHistoryBody.innerHTML = '<tr><td colspan="5">No backups yet</td></tr>';
            return;
        }

        const schoolQuery = activeSchoolCode
            ? `?school=${encodeURIComponent(activeSchoolCode)}`
            : '';

        backupHistoryBody.innerHTML = history.map(item => {
            const action = item.status === 'success'
                ? `<a href="/api/backups/download/${adminId}/${item.id}${schoolQuery}" class="btn btn-secondary" style="padding:6px 8px;font-size:11px;">Download</a>`
                : '--';

            return `
                <tr>
                    <td>${escapeHtml(formatBackupDate(item.created_at))}</td>
                    <td>${escapeHtml(String(item.trigger_type || '--'))}</td>
                    <td>${escapeHtml(String(item.status || '--'))}</td>
                    <td>${escapeHtml(formatFileSize(item.file_size))}</td>
                    <td>${action}</td>
                </tr>
            `;
        }).join('');
    };

    const loadBackupPolicyAndHistory = async (adminId) => {
        if (!adminId) return;
        try {
            const [policyResp, historyResp] = await Promise.all([
                apiFetch(`/api/backups/policy/${adminId}`),
                apiFetch(`/api/backups/history/${adminId}?limit=30`)
            ]);

            if (policyResp.ok) {
                const policyData = await policyResp.json();
                const policy = policyData?.policy || {};
                if (backupEnabledEl) backupEnabledEl.checked = !!policy.enabled;
                if (backupIntervalEl) backupIntervalEl.value = String(policy.interval_hours || 24);
                setSelectedBackupScope(policy.scope || BACKUP_SCOPE_DEFAULTS);
                if (backupMetaEl) {
                    backupMetaEl.textContent = `Last backup: ${formatBackupDate(policy.last_run_at)} | Next scheduled backup: ${formatBackupDate(policy.next_run_at)}`;
                }
            }

            if (historyResp.ok) {
                const historyData = await historyResp.json();
                renderBackupHistory(historyData?.history || [], adminId);
            }
        } catch (err) {
            console.warn('[AdminSettings] Failed to load backup policy/history:', err?.message || err);
        }
    };

    let currentSettings = getDefaultAdminSettings();
    try {
        currentSettings = loadAdminSettings();
        populateAdminSettingsForm(currentSettings);
        applyAdminSettings(currentSettings);
        populatePortalContentForm(loadPortalPageContentLocal());
        hydrateSettingsFromServer();
    } catch (err) {
        console.warn('[AdminSettings] initial hydration failed:', err?.message || err);
    }

    const openAdminSettingsWithData = async () => {
        try {
            const resolvedAdminId = await resolveCurrentAdminId();
            if (!resolvedAdminId) {
                showNotification('Admin session not found. Please log in again.', 'error');
                return;
            }
            await hydrateSettingsFromServer();
            currentSettings = loadAdminSettings();
            populateAdminSettingsForm(currentSettings);
            const adminId = resolvedAdminId;
            await loadBackupPolicyAndHistory(adminId);
        } catch (err) {
            console.warn('[AdminSettings] open refresh failed:', err?.message || err);
        }
        setActiveAdminSettingsTab('account');
        openAdminSettingsPanel();
    };

    settingsBtn.addEventListener('click', openAdminSettingsWithData);
    window.__openAdminSettingsWithData = openAdminSettingsWithData;

    if (saveBtn) {
        saveBtn.dataset.handlerBound = '1';
        saveBtn.addEventListener('click', async () => {
            try {
                const nextSettings = collectAdminSettingsForm();
                const portalContent = collectPortalContentForm();
                const backupPayload = collectBackupPolicyPayload();
                saveAdminSettings(nextSettings);
                applyAdminSettings(nextSettings);
                savePortalPageContentLocal(portalContent);

                const adminId = await resolveCurrentAdminId();
                let savedSettingsToServer = false;
                let savedPortalToServer = false;
                let savedBackupPolicyToServer = false;
                try {
                    [savedSettingsToServer, savedPortalToServer] = await Promise.all([
                        saveAdminSettingsToServer(adminId, nextSettings),
                        savePortalPageContentToServer(portalContent)
                    ]);
                    savedBackupPolicyToServer = await saveBackupPolicyToServer(adminId, backupPayload);
                } catch (err) {
                    console.warn('[AdminSettings] Failed to save settings to server:', err?.message || err);
                }

                if (savedBackupPolicyToServer && adminId) {
                    await loadBackupPolicyAndHistory(adminId);
                }

                if (savedSettingsToServer && savedPortalToServer && savedBackupPolicyToServer) {
                    showNotification('All settings saved successfully', 'success');
                } else if (savedSettingsToServer || savedPortalToServer || savedBackupPolicyToServer) {
                    showNotification('Saved partially to server. Remaining changes are local only.', 'info');
                } else {
                    showNotification('Settings saved locally (server unavailable)', 'info');
                }
                closeAdminSettingsPanel();
            } catch (err) {
                console.error('[AdminSettings] Save click handler failed:', err);
                showNotification(err?.message || 'Failed to save settings', 'error');
            }
        });
    }

    if (portalPreviewBtn) {
        portalPreviewBtn.addEventListener('click', () => {
            try {
                const draft = collectPortalContentForm();
                localStorage.setItem('sms.portalPreviewDraft', JSON.stringify(normalizePortalPageContent(draft)));

                const schoolCode = String(
                    localStorage.getItem('sms.selectedSchoolCode') ||
                    localStorage.getItem('sms.selectedTenantCode') ||
                    ''
                ).trim().toLowerCase();

                const url = schoolCode
                    ? `index.html?school=${encodeURIComponent(schoolCode)}&preview=1`
                    : 'index.html?preview=1';

                window.open(url, '_blank', 'noopener,noreferrer');
                showNotification('Preview opened in a new tab', 'success');
            } catch (err) {
                console.error('[AdminSettings] Failed to open portal preview:', err);
                showNotification('Failed to open portal preview', 'error');
            }
        });
    }

    if (resetBtn) {
        resetBtn.dataset.handlerBound = '1';
        resetBtn.addEventListener('click', async () => {
            try {
                const defaults = getDefaultAdminSettings();
                const defaultPortal = { ...DEFAULT_PORTAL_PAGE_CONTENT };
                const defaultBackupPolicy = {
                    enabled: false,
                    interval_hours: 24,
                    scope: BACKUP_SCOPE_DEFAULTS
                };

                populateAdminSettingsForm(defaults);
                populatePortalContentForm(defaultPortal);
                resetBackupControlsToDefaults();

                saveAdminSettings(defaults);
                applyAdminSettings(defaults);
                savePortalPageContentLocal(defaultPortal);

                const adminId = await resolveCurrentAdminId();
                let savedSettingsToServer = false;
                let savedPortalToServer = false;
                let savedBackupPolicyToServer = false;
                if (adminId) {
                    try {
                        [savedSettingsToServer, savedPortalToServer] = await Promise.all([
                            saveAdminSettingsToServer(adminId, defaults),
                            savePortalPageContentToServer(defaultPortal)
                        ]);
                    } catch (err) {
                        console.warn('[AdminSettings] Failed to reset account/portal on server:', err?.message || err);
                    }
                    savedBackupPolicyToServer = await saveBackupPolicyToServer(adminId, defaultBackupPolicy);
                    await loadBackupPolicyAndHistory(adminId);
                }

                setActiveAdminSettingsTab('account');

                if (savedSettingsToServer || savedPortalToServer || savedBackupPolicyToServer) {
                    showNotification('All settings reset. Server sync applied where available.', 'info');
                } else {
                    showNotification('All settings reset locally to defaults', 'info');
                }
            } catch (err) {
                console.error('[AdminSettings] Reset click handler failed:', err);
                showNotification(err?.message || 'Failed to reset settings', 'error');
            }
        });
    }

    if (backupSavePolicyBtn) {
        backupSavePolicyBtn.dataset.handlerBound = '1';
        backupSavePolicyBtn.addEventListener('click', async () => {
            const adminId = await resolveCurrentAdminId();
            if (!adminId) {
                showNotification('Admin session not found', 'error');
                return;
            }

            try {
                const payload = collectBackupPolicyPayload();
                const ok = await saveBackupPolicyToServer(adminId, payload);
                if (!ok) throw new Error('Failed to save backup policy');

                await loadBackupPolicyAndHistory(adminId);
                showNotification('Backup policy saved', 'success');
            } catch (err) {
                showNotification(err?.message || 'Failed to save backup policy', 'error');
            }
        });
    }

    if (backupNowBtn) {
        backupNowBtn.dataset.handlerBound = '1';
        backupNowBtn.addEventListener('click', async () => {
            const adminId = await resolveCurrentAdminId();
            if (!adminId) {
                showNotification('Admin session not found', 'error');
                return;
            }

            try {
                const response = await apiFetch(`/api/backups/run/${adminId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data?.error || 'Backup failed');
                }

                await loadBackupPolicyAndHistory(adminId);
                showNotification('Backup completed successfully', 'success');
            } catch (err) {
                showNotification(err?.message || 'Backup failed', 'error');
            }
        });
    }

    if (backupRefreshBtn) {
        backupRefreshBtn.dataset.handlerBound = '1';
        backupRefreshBtn.addEventListener('click', async () => {
            const adminId = await resolveCurrentAdminId();
            if (!adminId) return;
            await loadBackupPolicyAndHistory(adminId);
            showNotification('Backup history refreshed', 'info');
        });
    }

    backupScopeEls.forEach(el => {
        el.addEventListener('change', () => {
            const checkedCount = Array.from(backupScopeEls).filter(node => node.checked).length;
            if (checkedCount === 0) {
                el.checked = true;
                showNotification('At least one backup scope must remain selected', 'info');
            }
        });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const overlay = document.getElementById('adminSettingsOverlay');
            if (overlay?.classList.contains('active')) closeAdminSettingsPanel();
        }
    });

    window.__adminSettingsPanelBound = true;
    window.__adminSettingsPrimaryHandlersReady = true;
}

function setupAdminSettingsEmergencyBackupHandlers() {
    if (window.__adminSettingsEmergencyBackupHandlersBound) return;
    window.__adminSettingsEmergencyBackupHandlersBound = true;

    const formatDate = (value) => {
        if (!value) return '--';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? '--' : date.toLocaleString();
    };

    const formatSize = (bytes) => {
        const size = Number(bytes || 0);
        if (!size) return '--';
        if (size < 1024) return `${size} B`;
        if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
        return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    };

    const getSelectedScope = () => {
        // scopes no longer configurable; always return empty
        return [];
    };

    const refreshBackupUi = async (adminId) => {
        if (!adminId) return;

        const [policyResp, historyResp] = await Promise.all([
            apiFetch(`/api/backups/policy/${adminId}`),
            apiFetch(`/api/backups/history/${adminId}?limit=30`)
        ]);

        if (policyResp.ok) {
            const policyData = await policyResp.json().catch(() => ({}));
            const policy = policyData?.policy || {};
            const backupMetaEl = document.getElementById('settingsBackupMeta');
            if (backupMetaEl) {
                backupMetaEl.textContent = `Last backup: ${formatDate(policy.last_run_at)} | Next scheduled backup: ${formatDate(policy.next_run_at)}`;
            }
        }

        if (!historyResp.ok) return;
        const historyData = await historyResp.json().catch(() => ({}));
        const history = Array.isArray(historyData?.history) ? historyData.history : [];
        const backupHistoryBody = document.getElementById('settingsBackupHistoryBody');
        if (!backupHistoryBody) return;

        if (!history.length) {
            backupHistoryBody.innerHTML = '<tr><td colspan="5">No backups yet</td></tr>';
            return;
        }

        const schoolQuery = activeSchoolCode
            ? `?school=${encodeURIComponent(activeSchoolCode)}`
            : '';

        backupHistoryBody.innerHTML = history.map((item) => {
            const action = item.status === 'success'
                ? `<a href="/api/backups/download/${adminId}/${item.id}${schoolQuery}" class="btn btn-secondary" style="padding:6px 8px;font-size:11px;">Download</a>`
                : '--';

            return `
                <tr>
                    <td>${escapeHtml(formatDate(item.created_at))}</td>
                    <td>${escapeHtml(String(item.trigger_type || '--'))}</td>
                    <td>${escapeHtml(String(item.status || '--'))}</td>
                    <td>${escapeHtml(formatSize(item.file_size))}</td>
                    <td>${action}</td>
                </tr>
            `;
        }).join('');
    };

    document.addEventListener('click', async (event) => {
        const runBtn = event.target.closest('#settingsBackupNow');
        const saveBtn = event.target.closest('#settingsSaveBackupPolicy');
        const refreshBtn = event.target.closest('#settingsRefreshBackupHistory');
        const resetBtn = event.target.closest('#adminSettingsReset');
        const saveSettingsBtn = event.target.closest('#adminSettingsSave');
        const backupTargetBtn = runBtn || saveBtn || refreshBtn;
        const settingsTargetBtn = resetBtn || saveSettingsBtn;

        if (!backupTargetBtn && !settingsTargetBtn) return;

        if (settingsTargetBtn) {
            event.preventDefault();
            event.stopPropagation();
            if (typeof event.stopImmediatePropagation === 'function') {
                event.stopImmediatePropagation();
            }

            if (resetBtn) {
                try {
                    const defaults = getDefaultAdminSettings();
                    const defaultPortal = { ...DEFAULT_PORTAL_PAGE_CONTENT };

                    populateAdminSettingsForm(defaults);
                    populatePortalContentForm(defaultPortal);
                    saveAdminSettings(defaults);
                    applyAdminSettings(defaults);
                    savePortalPageContentLocal(defaultPortal);

                    const backupEnabledEl = document.getElementById('settingsBackupEnabled');
                    const backupIntervalEl = document.getElementById('settingsBackupInterval');
                    const backupMetaEl = document.getElementById('settingsBackupMeta');
                    const backupHistoryBody = document.getElementById('settingsBackupHistoryBody');
                    if (backupEnabledEl) backupEnabledEl.checked = false;
                    if (backupIntervalEl) backupIntervalEl.value = '24';
                    if (backupMetaEl) backupMetaEl.textContent = 'Last backup: -- | Next scheduled backup: --';
                    if (backupHistoryBody) backupHistoryBody.innerHTML = '<tr><td colspan="5">No backups yet</td></tr>';

                    const adminId = await resolveCurrentAdminId();
                    if (adminId) {
                        try {
                            await Promise.all([
                                saveAdminSettingsToServer(adminId, defaults),
                                savePortalPageContentToServer(defaultPortal),
                                apiFetch(`/api/backups/policy/${adminId}`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        enabled: false,
                                        interval_hours: 24
                                    })
                                })
                            ]);
                            await refreshBackupUi(adminId);
                        } catch (err) {
                            console.warn('[AdminSettingsEmergency] reset server sync failed:', err?.message || err);
                        }
                    }

                    setActiveAdminSettingsTab('account');
                    showNotification('All settings reset to defaults', 'info');
                } catch (err) {
                    showNotification(err?.message || 'Failed to reset settings', 'error');
                }
                return;
            }

            if (saveSettingsBtn) {
                try {
                    const nextSettings = collectAdminSettingsForm();
                    const portalContent = collectPortalContentForm();
                    const backupEnabledEl = document.getElementById('settingsBackupEnabled');
                    const backupIntervalEl = document.getElementById('settingsBackupInterval');
                    const backupPayload = {
                        enabled: !!backupEnabledEl?.checked,
                        interval_hours: Number(backupIntervalEl?.value || 24),
                        scope: getSelectedScope()
                    };

                    saveAdminSettings(nextSettings);
                    applyAdminSettings(nextSettings);
                    savePortalPageContentLocal(portalContent);

                    const adminId = await resolveCurrentAdminId();
                    let savedSettingsToServer = false;
                    let savedPortalToServer = false;
                    let savedBackupPolicyToServer = false;
                    if (adminId) {
                        try {
                            [savedSettingsToServer, savedPortalToServer] = await Promise.all([
                                saveAdminSettingsToServer(adminId, nextSettings),
                                savePortalPageContentToServer(portalContent)
                            ]);
                            const backupResp = await apiFetch(`/api/backups/policy/${adminId}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(backupPayload)
                            });
                            savedBackupPolicyToServer = !!backupResp.ok;
                            if (savedBackupPolicyToServer) {
                                await refreshBackupUi(adminId);
                            }
                        } catch (err) {
                            console.warn('[AdminSettingsEmergency] save to server failed:', err?.message || err);
                        }
                    }

                    if (savedSettingsToServer && savedPortalToServer && savedBackupPolicyToServer) {
                        showNotification('All settings saved successfully', 'success');
                    } else if (savedSettingsToServer || savedPortalToServer || savedBackupPolicyToServer) {
                        showNotification('Saved partially to server. Remaining changes are local only.', 'info');
                    } else {
                        showNotification('Settings saved locally (server unavailable)', 'info');
                    }

                    closeAdminSettingsPanel();
                } catch (err) {
                    showNotification(err?.message || 'Failed to save settings', 'error');
                }
            }
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === 'function') {
            event.stopImmediatePropagation();
        }

        const adminId = await resolveCurrentAdminId();
        if (!adminId) {
            showNotification('Admin session not found', 'error');
            return;
        }

        try {
            if (runBtn) {
                const response = await apiFetch(`/api/backups/run/${adminId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ scope: getSelectedScope() })
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(data?.error || 'Backup failed');
                await refreshBackupUi(adminId);
                showNotification('Backup completed successfully', 'success');
                return;
            }

            if (saveBtn) {
                const backupEnabledEl = document.getElementById('settingsBackupEnabled');
                const backupIntervalEl = document.getElementById('settingsBackupInterval');
                const response = await apiFetch(`/api/backups/policy/${adminId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        enabled: !!backupEnabledEl?.checked,
                        interval_hours: Number(backupIntervalEl?.value || 24),
                        scope: getSelectedScope()
                    })
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(data?.error || 'Failed to save backup policy');
                await refreshBackupUi(adminId);
                showNotification('Backup policy saved', 'success');
                return;
            }

            if (refreshBtn) {
                await refreshBackupUi(adminId);
                showNotification('Backup history refreshed', 'info');
            }
        } catch (err) {
            showNotification(err?.message || 'Backup action failed', 'error');
        }
    }, true);
}

// Setup filter buttons
function setupFilterButtons() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    console.log('Setting up filter buttons:', filterBtns.length, 'buttons found');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            console.log('Filter button clicked:', btn.getAttribute('data-filter'));
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const filter = btn.getAttribute('data-filter');
            console.log('Loading enrollments with filter:', filter);
            loadEnrollments(filter);
        });
    });
}

function setupInteractionFeedback() {
    if (document.body?.dataset?.interactionFeedbackReady === 'true') return;
    if (document.body) document.body.dataset.interactionFeedbackReady = 'true';

    const interactiveSelector = [
        'button',
        '.btn',
        'a.menu-item',
        'a.submenu-item',
        '.tab-btn',
        '.section-tab-btn',
        '.report-tab',
        '.filter-btn',
        '.level-btn',
        '.action-card',
        '.stat-item.clickable',
        '.header-icon',
        '.profile-btn',
        '.viz-card',
        '.viz-wide',
        'canvas',
        '[role="button"]',
        '[onclick]'
    ].join(', ');

    const pulse = (element) => {
        if (!element) return;
        try {
            if (element._feedbackTimer) clearTimeout(element._feedbackTimer);
            element.classList.remove('click-feedback-active');
            void element.offsetWidth;
            element.classList.add('click-feedback-active');
            element._feedbackTimer = setTimeout(() => {
                element.classList.remove('click-feedback-active');
            }, 520);
        } catch (_) {
            // no-op
        }
    };

    document.addEventListener('click', (event) => {
        const target = event.target?.closest?.(interactiveSelector);
        if (!target) return;
        pulse(target);
    }, true);

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const active = document.activeElement;
        const target = active?.closest?.(interactiveSelector);
        if (!target) return;
        pulse(target);
    }, true);
}

// Close enrollment detail modal
function closeEnrollmentModal() {
    console.log('[closeEnrollmentModal] Closing modal');
    const modal = document.getElementById('enrollmentDetailModal');
    if (modal) {
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        modal.style.display = '';  // Reset to CSS default
        console.log('[closeEnrollmentModal] Modal classes removed, display reset');
        
        // Clear content to ensure clean state
        const detailContainer = document.getElementById('enrollmentDetail');
        if (detailContainer) {
            detailContainer.innerHTML = '';
            console.log('[closeEnrollmentModal] Detail content cleared');
        }
        
        // Reset body overflow
        document.body.style.overflow = '';
        console.log('[closeEnrollmentModal] Body overflow reset');
    } else {
        console.error('[closeEnrollmentModal] Modal element not found!');
    }
}

document.getElementById('closeDetailModal')?.addEventListener('click', closeEnrollmentModal);
document.getElementById('closeDetailBtn')?.addEventListener('click', closeEnrollmentModal);

document.getElementById('enrollmentDetailModal')?.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'enrollmentDetailModal') {
        closeEnrollmentModal();
    }
});

// Stat Modal Functions
window.showStatModal = function showStatModal(filter, title) {
                    // Robustly attach click handlers for all stat cards on DOMContentLoaded
                    document.addEventListener('DOMContentLoaded', function() {
                        document.querySelectorAll('.stat-item.clickable').forEach(function(card) {
                            // Remove any existing click listeners to avoid duplicates
                            card.removeEventListener('click', card._statModalHandler);
                            // Parse filter and title from inline attribute if present
                            let handler = function(e) {
                                // Prevent double firing if inline onclick exists
                                if (e && e.detail !== 0) e.preventDefault();
                                let attr = card.getAttribute('onclick');
                                if (attr && attr.startsWith('showStatModal')) {
                                    // Extract arguments from inline handler
                                    let args = attr.match(/showStatModal\(([^)]*)\)/);
                                    if (args && args[1]) {
                                        let [filter, title] = args[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
                                        window.showStatModal(filter, title);
                                    }
                                }
                            };
                            card._statModalHandler = handler;
                            card.addEventListener('click', handler);
                        });
                    });
    // If a filtered students array is passed, use it directly
    if (arguments.length === 3 && Array.isArray(arguments[2])) {
        displayStudentModal(arguments[2], title, filter);
        return;
    }
    try {
        // Map demographics stat card titles to filters
        let mappedFilter = filter;
        if (filter === 'demographics') {
            // Use strict match for stat card titles
            if (title.trim().toLowerCase() === 'total male students') {
                mappedFilter = 'male';
            } else if (title.trim().toLowerCase() === 'total female students') {
                mappedFilter = 'female';
            } else if (title.trim().toLowerCase() === 'total overall students') {
                mappedFilter = 'all';
            }
        } else if (filter === 'grade') {
            // Grade filter: title is like 'Grade 7', 'Grade 8', etc.
            mappedFilter = 'grade';
        } else if (filter === 'ip-group') {
            mappedFilter = 'ip-group';
        }

        // Track selected demographics filter for print output
        if (filter === 'demographics') {
            window.currentDemographicsFilter = {
                type: mappedFilter,
                label: title || 'Total Overall Students'
            };
        } else if (filter === 'grade') {
            const gradeMatch = String(title || '').match(/Grade\s*(\d+)/i);
            window.currentDemographicsFilter = {
                type: 'grade',
                grade: gradeMatch ? gradeMatch[1] : '',
                label: title || 'Grade Filter'
            };
        }

        console.log('🔴 showStatModal CALLED with filter:', mappedFilter, 'title:', title);
        // Fetch ALL approved enrollments directly
        Promise.all([
            // Use apiFetch which will try multiple candidate origins (works across ports)
            apiFetch('/api/enrollments?status=Approved').then(r => {
                if (!r.ok) throw new Error('Failed to fetch enrollments: ' + r.status);
                return r.json();
            }),
            apiFetch('/api/sections').then(r => {
                if (!r.ok) throw new Error('Failed to fetch sections: ' + r.status);
                return r.json();
            })
        ])
        .then(([enrollments, sections]) => {
            // ...existing code...
            const sectionMap = {};
            if (Array.isArray(sections)) {
                sections.forEach(sec => {
                    if (sec.id && sec.section_name) {
                        sectionMap[sec.id] = sec.section_name;
                    }
                });
            }
            const students = [];
            enrollments.forEach((enrollment) => {
                try {
                    let data = enrollment.enrollment_data || {};
                    if (typeof data === 'string') {
                        try { data = JSON.parse(data); } catch (err) { }
                    }
                    const allElectives = [];
                    if (Array.isArray(data.academicElectives)) allElectives.push(...data.academicElectives);
                    if (Array.isArray(data.techproElectives)) allElectives.push(...data.techproElectives);
                    if (Array.isArray(data.doorwayAcademic)) allElectives.push(...data.doorwayAcademic);
                    if (Array.isArray(data.doorwayTechPro)) allElectives.push(...data.doorwayTechPro);
                    let sectionName = null;
                    // Always prefer mapping from sectionMap using section_id
                    if (enrollment.section_id && sectionMap[enrollment.section_id]) {
                        sectionName = sectionMap[enrollment.section_id];
                    } else if (enrollment.section_id && typeof enrollment.section_id === 'string') {
                        sectionName = sectionMap[enrollment.section_id] || enrollment.section_id;
                    } else if (enrollment.section_name) {
                        sectionName = enrollment.section_name;
                    } else if (data.section_id && sectionMap[data.section_id]) {
                        sectionName = sectionMap[data.section_id];
                    } else if (data.section || data.sectionSelected) {
                        sectionName = data.section || data.sectionSelected;
                    } else if (data && typeof data === 'object') {
                        // Fallback: try to find section info in enrollment_data
                        sectionName = data.section || data.sectionSelected || '--';
                    } else {
                        sectionName = '--';
                    }
                    let genderRaw = (
                        data.gender || data.sex || enrollment.gender || enrollment.sex || enrollment.GENDER || ''
                    ).toString().trim().toLowerCase();
                    let gender = '';
                    if (genderRaw === 'm' || genderRaw === 'male') gender = 'male';
                    else if (genderRaw === 'f' || genderRaw === 'female') gender = 'female';
                    else if (genderRaw === 'feminine') gender = 'female';
                    else if (genderRaw === 'masculine') gender = 'male';
                    else if (genderRaw) gender = genderRaw;
                    let ip_group = (data.ip_group || data.ip || data.ip_status || data.indigenous || data.ipStatus || data.isIP || '').toString().trim().toLowerCase().replace(/\s+/g, ' ');
                    const studentObj = {
                        id: enrollment.student_id,
                        first_name: data.firstName || data.firstname || enrollment.first_name || '',
                        last_name: data.lastName || data.lastname || enrollment.last_name || '',
                        gender: gender,
                        grade_level: (data.grade_level || data.grade || data.gradeLevel || '').toString(),
                        section: sectionName || '--',
                        section_id: enrollment.section_id || data.section_id || null,
                        electives: allElectives,
                        disability: data.disability || data.disabilityType || '',
                        disabilities: data.disabilities || data.disability || [],
                        disability_status: data.disability_status || '',
                        ip_group: ip_group,
                        four_ps: data.is4Ps || data.four_ps || data.fourPs || data.four_ps_status || data['4ps'] || '',
                        mother_tongue: data.mother_tongue || data.motherTongue || data.language || '',
                        track: data.track || data.program || data.track_program || ''
                    };
                    students.push(studentObj);
                } catch (err) {
                    console.warn('Failed to parse enrollment:', err);
                }
            });
            let filteredStudents = [];
            if (mappedFilter === 'male') {
                filteredStudents = students.filter(s => s.gender === 'male');
            } else if (mappedFilter === 'female') {
                filteredStudents = students.filter(s => s.gender === 'female');
            } else if (mappedFilter === 'all') {
                filteredStudents = students;
            } else if (mappedFilter === 'grade') {
                const gradeNum = title.match(/Grade\s*(\d+)/);
                if (gradeNum) {
                    filteredStudents = students.filter(s => String(s.grade_level) === gradeNum[1]);
                } else {
                    filteredStudents = students;
                }
            } else if (mappedFilter === 'demographics') {
                filteredStudents = students;
            } else if (mappedFilter === '4ps') {
                filteredStudents = students.filter(s => {
                    const fourPs = (s.four_ps || '').toString().trim().toLowerCase();
                    return fourPs === 'yes' || fourPs === 'true' || fourPs === '1';
                });
            } else if (mappedFilter === 'mother-tongue') {
                filteredStudents = students.filter(s => {
                    const mt = (s.mother_tongue || '').toString().trim().toLowerCase();
                    return mt && mt !== '' && mt !== 'none';
                });
            } else if (mappedFilter === 'track') {
                let trackFilter = '';
                if (title.toLowerCase().includes('academic')) trackFilter = 'academic';
                else if (title.toLowerCase().includes('techpro')) trackFilter = 'techpro';
                else if (title.toLowerCase().includes('doorway')) trackFilter = 'doorway';
                if (trackFilter) {
                    filteredStudents = students.filter(s => (s.track || '').toString().trim().toLowerCase().includes(trackFilter));
                } else {
                    filteredStudents = students.filter(s => {
                        const tr = (s.track || '').toString().trim().toLowerCase();
                        return tr && tr !== '' && tr !== 'none';
                    });
                }
            } else if (mappedFilter === 'ip') {
                const lowerTitle = title.trim().toLowerCase();
                // Filter students who have an IP group (Indigenous People)
                const isIPStudent = s => {
                    const ipGroup = (s.ip_group || '').toString().trim().toLowerCase();
                    return ipGroup && ipGroup !== '' && ipGroup !== 'none' && ipGroup !== 'no';
                };
                
                if (lowerTitle === 'male ip students') {
                    filteredStudents = students.filter(s => isIPStudent(s) && s.gender === 'male');
                } else if (lowerTitle === 'female ip students') {
                    filteredStudents = students.filter(s => isIPStudent(s) && s.gender === 'female');
                } else if (lowerTitle === 'total ip students (overall)') {
                    filteredStudents = students.filter(s => isIPStudent(s));
                } else {
                    filteredStudents = students.filter(s => isIPStudent(s));
                }
            } else if (mappedFilter === 'ip-group') {
                // Normalize for comparison
                const normalize = str => (str || '').toString().trim().toLowerCase().replace(/\s+/g, ' ');
                filteredStudents = students.filter(s => normalize(s.ip_group) === normalize(title));
            } else if (mappedFilter === 'disability') {
                filteredStudents = students.filter(s => {
                    let disabilityTypes = [];
                    if (Array.isArray(s.disabilities) && s.disabilities.length > 0) {
                        disabilityTypes = s.disabilities.map(d => d.toString().trim().toLowerCase());
                    } else if (s.disability_status) {
                        const disStatus = (s.disability_status || '').toString().trim().toLowerCase();
                        if (disStatus && disStatus.length > 0 && disStatus !== 'none' && disStatus !== 'no') {
                            disabilityTypes = disStatus.split(',').map(d => d.trim().toLowerCase());
                        }
                    }
                    return disabilityTypes.length > 0;
                });
            } else if (mappedFilter.startsWith('elective-')) {
                // Elective stat card: filter by elective category using mapping
                const categoryKey = mappedFilter.replace('elective-', '').replace(/-/g, ' ').toLowerCase();
                let electivesList = [];
                // Combine all elective mappings
                const allElectiveMaps = [
                    window.SHS_ACADEMIC_ELECTIVES || {},
                    window.SHS_TECHPRO_ELECTIVES || {}
                ];
                for (const electiveMap of allElectiveMaps) {
                    for (const [cat, electives] of Object.entries(electiveMap)) {
                        if (cat.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/^-|-$/g, '').trim() === categoryKey) {
                            electivesList = electives.map(e => e.toLowerCase().trim());
                            break;
                        }
                    }
                    if (electivesList.length > 0) break;
                }
                filteredStudents = students.filter(s => {
                    if (!Array.isArray(s.electives) || electivesList.length === 0) return false;
                    return s.electives.some(elective => electivesList.includes(elective.toLowerCase().trim()));
                });
            } else if (mappedFilter === 'electives') {
                filteredStudents = students.filter(s => Array.isArray(s.electives) && s.electives.length > 0);
            } else if (mappedFilter.startsWith('elective-single-')) {
                // Elective table row: filter by specific elective name
                const electiveName = title.replace('Students: ', '').trim().toLowerCase();
                filteredStudents = students.filter(s => {
                    if (!Array.isArray(s.electives)) return false;
                    return s.electives.some(e => e.trim().toLowerCase() === electiveName);
                });
            } else {
                filteredStudents = students;
            }
            displayStudentModal(filteredStudents, title, mappedFilter);
        })
        .catch((err) => {
            console.error('Error displaying modal:', err);
            showNotification('Error: ' + err.message, 'error');
        });
    } catch (err) {
        console.error('Error displaying modal:', err);
        showNotification('Error: ' + err.message, 'error');
    }
}

function closeStatModal() {
    try {
        console.log('[closeStatModal] Closing modal');
        const modal = document.getElementById('statModalContainer');
        if (modal) {
            modal.classList.remove('active');
            modal.setAttribute('aria-hidden', 'true');
            modal.style.display = '';
            document.body.style.overflow = '';
            console.log('[closeStatModal] Modal closed');
            // Restore full electives table when modal closes
            restoreFullElectiveTable();
        }
    } catch (err) {
        console.error('[closeStatModal] Error:', err);
    }
}

// Stat modal event listeners
document.getElementById('closeStatModal')?.addEventListener('click', closeStatModal);
document.getElementById('closeStatModalBtn')?.addEventListener('click', closeStatModal);

document.getElementById('statModalContainer')?.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'statModalContainer') {
        closeStatModal();
    }
});

// Show notification
function showNotification(message, type = 'error') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type}`;
    
    setTimeout(() => {
        notification.classList.remove('success', 'error');
    }, 4000);
}

// Mobile hamburger menu - Wrapped in DOMContentLoaded for proper timing
document.addEventListener('DOMContentLoaded', function() {
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const sidebar = document.getElementById('sidebar');

    if (!hamburgerBtn || !sidebar) {
        console.error('[Hamburger Menu] Error: Elements not found', {
            hamburger: !!hamburgerBtn,
            sidebar: !!sidebar
        });
        return;
    }

    console.log('[Hamburger Menu] Initialized - Elements found');

    const setSidebarOpen = (open) => {
        sidebar.classList.toggle('active', !!open);
        hamburgerBtn.classList.toggle('active', !!open);
        hamburgerBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        document.body.classList.toggle('sidebar-open', !!open);
        document.body.style.overflow = open ? 'hidden' : '';
    };

    // Toggle sidebar on hamburger click
    hamburgerBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const isActive = sidebar.classList.contains('active');
        console.log('[Hamburger Click] Toggling sidebar - Before:', isActive, 'After:', !isActive);

        setSidebarOpen(!isActive);
        console.log(sidebar.classList.contains('active') ? '[Hamburger] Sidebar opened' : '[Hamburger] Sidebar closed');
    });

    // Close sidebar when clicking on actual submenu items (links only, not toggles)
    // Only close when clicking on actual page navigation links, not menu toggles
    document.querySelectorAll('.submenu-item').forEach(item => {
        item.addEventListener('click', function(e) {
            if (window.innerWidth <= 768 && sidebar.classList.contains('active')) {
                console.log('[Submenu Item] Closing sidebar');
                setSidebarOpen(false);
            }
        });
    });

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', function(e) {
        // Only on mobile and only if sidebar is active
        if (window.innerWidth <= 768 && sidebar.classList.contains('active')) {
            // Don't close if clicking on hamburger or inside sidebar
            if (!sidebar.contains(e.target) && !hamburgerBtn.contains(e.target)) {
                console.log('[Outside Click] Closing sidebar');
                setSidebarOpen(false);
            }
        }
    });

    // Close sidebar on window resize if resized to desktop
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768 && sidebar.classList.contains('active')) {
            console.log('[Resize] Closing sidebar - switched to desktop');
            setSidebarOpen(false);
        }
    });
}, { once: false });
// Report functions are initialized from the main DOMContentLoaded handler above

// Setup report tab switching
function setupReportTabs() {
    if (window.__reportsTabsBound) return;
    window.__reportsTabsBound = true;

    const reportTabs = document.querySelectorAll('.report-tab');
    const reportContents = document.querySelectorAll('.report-content');

    reportTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const reportId = tab.getAttribute('data-report');

            // Update active tab
            reportTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Show corresponding content
            reportContents.forEach(content => content.classList.remove('active'));
            const activeContent = document.getElementById(`report-${reportId}`);
            if (activeContent) {
                activeContent.classList.add('active');
                // Load report data when tab is clicked
                loadReportData(reportId);
            }
        });
    });

    // Load the first report by default
    if (reportTabs.length > 0) {
        reportTabs[0].click();
    }
}

function normalizeEnrollmentsPayload(payload) {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== 'object') return [];

    if (Array.isArray(payload.rows)) return payload.rows;
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.enrollments)) return payload.enrollments;
    if (payload.success && Array.isArray(payload.result)) return payload.result;

    return [];
}

function isApprovedEnrollmentRecord(enrollment) {
    if (!enrollment || typeof enrollment !== 'object') return false;
    const status = String(enrollment.status || enrollment.enrollment_status || '').trim().toLowerCase();
    return status === 'approved';
}

async function fetchApprovedEnrollmentsForReports() {
    const requestCandidates = [
        '/api/enrollments?status=Approved',
        '/api/enrollments?status=approved',
        '/api/enrollments'
    ];

    let bestApproved = [];
    let bestSource = 'none';
    let firstNonEmptyFallback = [];

    const dedupeEnrollments = (items) => {
        const map = new Map();
        (Array.isArray(items) ? items : []).forEach((row, index) => {
            const key = String(
                row?.id
                || `${row?.student_id || ''}|${row?.created_at || ''}|${row?.enrollment_date || ''}|${index}`
            );
            if (!map.has(key)) {
                map.set(key, row);
            }
        });
        return Array.from(map.values());
    };

    for (const endpoint of requestCandidates) {
        try {
            const response = await apiFetch(endpoint);
            if (!response || !response.ok) continue;

            const payload = await response.json().catch(() => []);
            const enrollments = normalizeEnrollmentsPayload(payload);
            if (!Array.isArray(enrollments) || enrollments.length === 0) continue;

            const approved = dedupeEnrollments(enrollments.filter(isApprovedEnrollmentRecord));
            if (approved.length > bestApproved.length) {
                bestApproved = approved;
                bestSource = endpoint;
            }

            if (firstNonEmptyFallback.length === 0) {
                firstNonEmptyFallback = enrollments;
            }
        } catch (_err) {
            // Try next endpoint variant
        }
    }

    if (bestApproved.length > 0) {
        return {
            enrollments: bestApproved,
            source: bestSource || 'best-approved'
        };
    }

    if (firstNonEmptyFallback.length > 0) {
        return {
            enrollments: dedupeEnrollments(firstNonEmptyFallback.filter(isApprovedEnrollmentRecord)),
            source: 'fallback-filter'
        };
    }

    return { enrollments: [], source: 'none' };
}

// Load report data based on report type
async function loadReportData(reportType) {
    try {
        let enrollments = [];
        let dataSource = 'none';

        const fromServer = await fetchApprovedEnrollmentsForReports();
        enrollments = Array.isArray(fromServer.enrollments) ? fromServer.enrollments.slice() : [];
        dataSource = fromServer.source || 'none';

        if (enrollments.length === 0) {
            try {
                const cachedApproved = typeof getStoredEnrollments === 'function'
                    ? getStoredEnrollments('approved')
                    : [];
                if (Array.isArray(cachedApproved) && cachedApproved.length > 0) {
                    enrollments = cachedApproved.slice();
                    dataSource = 'cache-approved';
                }
            } catch (_e) {
                // Ignore cache errors and continue
            }
        }

        if (enrollments.length === 0 && Array.isArray(window.allEnrollments) && window.allEnrollments.length > 0) {
            enrollments = window.allEnrollments.filter(isApprovedEnrollmentRecord);
            if (enrollments.length > 0) {
                dataSource = 'window-allEnrollments';
            }
        }

        console.info('[Reports] Data source:', dataSource, 'Approved enrollments:', enrollments.length);

        // Build student-like objects from enrollments (use submitted enrollment_data)
        const students = [];
        
        enrollments.forEach((enrollment, idx) => {
            try {
                if (!enrollment || typeof enrollment !== 'object') return;
                let data = enrollment.enrollment_data || {};
                if (typeof data === 'string') {
                    try { data = JSON.parse(data); } catch (err) { /* ignore parse errors */ }
                }

                // Map common form fields to the internal student fields expected by reports
                // Collect all electives into a single array (robust to multiple payload formats)
                const parseElectiveList = (value) => {
                    if (!value) return [];
                    if (Array.isArray(value)) {
                        return value
                            .map(item => {
                                if (typeof item === 'string') return item;
                                if (typeof item === 'object') {
                                    return item.name || item.elective || item.title || item.subject || item.subject_name || '';
                                }
                                return '';
                            })
                            .map(v => String(v || '').trim())
                            .filter(Boolean);
                    }
                    if (typeof value === 'object') {
                        const collected = [];
                        Object.values(value).forEach(v => {
                            collected.push(...parseElectiveList(v));
                        });
                        return collected;
                    }
                    const text = String(value || '').trim();
                    if (!text) return [];
                    try {
                        const parsed = JSON.parse(text);
                        return parseElectiveList(parsed);
                    } catch (e) {
                        return text.split(',').map(v => String(v || '').trim()).filter(Boolean);
                    }
                };

                const allElectives = [];
                
                allElectives.push(
                    ...parseElectiveList(data.academicElectives),
                    ...parseElectiveList(data.techproElectives),
                    ...parseElectiveList(data.doorwayAcademic),
                    ...parseElectiveList(data.doorwayTechPro),
                    ...parseElectiveList(data.doorwayTechpro),
                    ...parseElectiveList(data.electives),
                    ...parseElectiveList(data.selectedElectives),
                    ...parseElectiveList(data.subjects),
                    ...parseElectiveList(data.interest),
                    ...parseElectiveList(data.selectedSubjects),
                    ...parseElectiveList(data.shs?.electives)
                );

                const uniqueElectives = Array.from(new Set(allElectives.map(v => String(v || '').trim()).filter(Boolean)));

                const sectionId = enrollment.section_id || data.section_id || data.sectionId || null;
                const sectionCaches = [
                    ...(Array.isArray(window._sectionsCache) ? window._sectionsCache : []),
                    ...(Array.isArray(window.allSections) ? window.allSections : []),
                    ...(Array.isArray(window.allSectionsForAdvisory) ? window.allSectionsForAdvisory : [])
                ];
                const sectionFromCache = sectionCaches.find(sec =>
                    String(sec.id || sec.section_id || '') === String(sectionId || '')
                );

                const resolvedSectionName = (
                    data.section ||
                    data.sectionSelected ||
                    data.selectedSection ||
                    enrollment.section_name ||
                    enrollment.section ||
                    sectionFromCache?.section_name ||
                    sectionFromCache?.name ||
                    ''
                ).toString();

                const studentObj = {
                    id: enrollment.student_id || data.studentID || data.studentId || data.lrn || data.email || `${(data.firstName||data.firstname||'').toString()} ${(data.lastName||data.lastname||'').toString()}`.trim(),
                    lrn: data.lrn || data.LRN || data.student_lrn || enrollment.lrn || enrollment.student_lrn || '',
                    first_name: data.firstName || data.firstname || '',
                    last_name: data.lastName || data.lastname || '',
                    email: data.email || '',
                    gender: (data.gender || data.sex || data.Gender || '').toString(),
                    grade_level: (data.grade_level || data.grade || data.gradeLevel || data['Grade'] || '').toString(),
                    section: resolvedSectionName,
                    section_id: sectionId,
                    disability_status: (data.disability || data.disability_status || data.disabilityType || '').toString(),
                    disabilities: Array.isArray(data.disabilities) ? data.disabilities : (Array.isArray(data.disability) ? data.disability : []),
                    ip_status: (data.isIP || data.ip || data.ip_status || data.indigenous || '').toString(),
                    ip_group: (data.ipGroup || data.ip_group || data.ipgroup || '').toString(),
                    four_ps_status: (data.is4Ps || data.four_ps || data.fourPs || data.four_ps_status || data['4ps'] || '').toString(),
                    mother_tongue: (data.mother_tongue || data.motherTongue || data.language || '').toString(),
                    track: (data.track || data.program || data.track_program || '').toString(),
                    electives: uniqueElectives
                };

                students.push(studentObj);
            } catch (err) {
                console.warn('Failed to parse enrollment data for report:', err);
            }
        });

        console.info('[Reports] Processed students:', students.length, 'for report type:', reportType);

        if (reportType === 'demographics') {
            loadDemographicsReport(students);
        } else if (reportType === 'disability') {
            loadDisabilityReport(students);
        } else if (reportType === 'indigenous') {
            loadIndigenousReport(students);
        } else if (reportType === '4ps') {
            load4PsReport(students);
        } else if (reportType === 'mothertongue') {
            loadMotherTongueReport(students);
        } else if (reportType === 'track') {
            loadTrackReport(students);
        } else if (reportType === 'electives') {
            loadElectivesReport(students);
        }
    } catch (error) {
        console.error('Error loading report data:', error);
        showNotification('Failed to load report data', 'error');
    }
}

window.setupReportTabs = setupReportTabs;
window.loadReportData = loadReportData;

// Demographics Report
function loadDemographicsReport(students) {
    // Store students globally for stat modal access
    window.currentReportStudents = students;
    if (!window.currentDemographicsFilter) {
        window.currentDemographicsFilter = { type: 'all', label: 'Total Overall Students' };
    }
    
    const grades = ['7', '8', '9', '10', '11', '12'];
    const genderData = {};
    const gradeData = {};

    // Initialize grade data
    grades.forEach(grade => {
        gradeData[grade] = { male: 0, female: 0, total: 0 };
        genderData[grade] = { male: 0, female: 0, total: 0 };
    });

    let totalMale = 0, totalFemale = 0;

    // Process students
    students.forEach(student => {
        const gender = student.gender ? student.gender.toLowerCase() : '';
        const grade = student.grade_level ? String(student.grade_level) : '';

        if (gender === 'male' || gender === 'm') totalMale++;
        if (gender === 'female' || gender === 'f') totalFemale++;

        if (gradeData[grade]) {
            if (gender === 'male' || gender === 'm') {
                gradeData[grade].male++;
                genderData[grade].male++;
            } else if (gender === 'female' || gender === 'f') {
                gradeData[grade].female++;
                genderData[grade].female++;
            }
            gradeData[grade].total++;
            genderData[grade].total++;
        }
    });

    // Update stats
    document.getElementById('totalMale').textContent = totalMale;
    document.getElementById('totalFemale').textContent = totalFemale;
    document.getElementById('totalGenderStudents').textContent = totalMale + totalFemale;

    // Update gender table
    const genderTableBody = document.getElementById('genderTableBody');
    genderTableBody.innerHTML = '';
    grades.forEach(grade => {
        const data = genderData[grade];
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>Grade ${grade}</td>
            <td>${data.male}</td>
            <td>${data.female}</td>
            <td>${data.total}</td>
        `;
        genderTableBody.appendChild(row);
    });
}

// Disability Report
function loadDisabilityReport(students) {
    // Map specific disability values to human-readable labels
    const disabilityMapping = {
        'blind': 'Blind',
        'low-vision': 'Low Vision',
        'deaf': 'Deaf',
        'hard-of-hearing': 'Hard of Hearing',
        'autism-spectrum': 'Autism Spectrum Disorder',
        'speech-language': 'Speech/Language Disorder',
        'emotional-behavioral': 'Emotional-Behavioral Disorder',
        'cerebral-palsy': 'Cerebral Palsy',
        'orthopedic-handicap': 'Orthopedic/Physical Handicap',
        'special-health': 'Special Health Problem/Chronic Disease',
        'cancer': 'Cancer',
        'intellectual-disability': 'Intellectual Disability'
    };

    const disabilityData = {};

    let totalWithDisability = 0;

    students.forEach(student => {
        const gender = student.gender ? student.gender.toLowerCase() : '';

        // Check if student has disability array (from form checkboxes)
        let disabilityTypes = [];
        if (Array.isArray(student.disabilities) && student.disabilities.length > 0) {
            disabilityTypes = student.disabilities;
        } else if (student.disability_status) {
            // Fallback: parse string format
            const disStatus = String(student.disability_status).trim();
            if (disStatus && disStatus.length > 0 && disStatus !== 'None' && disStatus !== 'none' && disStatus !== 'no') {
                // Try to extract individual disability types
                disabilityTypes = disStatus.split(',').map(d => d.trim().toLowerCase());
            }
        }

        // Process each disability type for this student
        disabilityTypes.forEach(disType => {
            if (disType && disType.length > 0) {
                totalWithDisability++;

                // Map to human-readable label
                const label = disabilityMapping[disType.toLowerCase()] || disType.charAt(0).toUpperCase() + disType.slice(1);

                if (!disabilityData[label]) {
                    disabilityData[label] = { male: 0, female: 0, total: 0 };
                }

                if (gender === 'male' || gender === 'm') disabilityData[label].male++;
                if (gender === 'female' || gender === 'f') disabilityData[label].female++;
                disabilityData[label].total++;
            }
        });
    });

    const totalStudents = students.length || 1;
    const disabilityPercentage = ((totalWithDisability / totalStudents) * 100).toFixed(1);

    document.getElementById('totalDisability').textContent = totalWithDisability;
    document.getElementById('disabilityPercentage').textContent = disabilityPercentage + '%';

    // Update disability table
    const disabilityTableBody = document.getElementById('disabilityTableBody');
    disabilityTableBody.innerHTML = '';
    
    Object.keys(disabilityData).sort().forEach(type => {
        const data = disabilityData[type];
        if (data.total > 0) {
            const row = document.createElement('tr');
            row.classList.add('clickable');
            row.innerHTML = `
                <td>${type}</td>
                <td>${data.male}</td>
                <td>${data.female}</td>
                <td>${data.total}</td>
            `;
            row.addEventListener('click', function() {
                // Filter students by this disability type
                const filtered = students.filter(student => {
                    let disabilityTypes = [];
                    if (Array.isArray(student.disabilities) && student.disabilities.length > 0) {
                        disabilityTypes = student.disabilities.map(d => d.toLowerCase());
                    } else if (student.disability_status) {
                        const disStatus = String(student.disability_status).trim();
                        if (disStatus && disStatus.length > 0 && disStatus !== 'None' && disStatus !== 'none' && disStatus !== 'no') {
                            disabilityTypes = disStatus.split(',').map(d => d.trim().toLowerCase());
                        }
                    }
                    return disabilityTypes.some(dt => {
                        // Match against mapped label or original
                        return (disabilityMapping[dt] || dt.charAt(0).toUpperCase() + dt.slice(1)) === type;
                    });
                });
                showStatModal('disability-type-' + type, 'Students with Disability: ' + type, filtered);
            });
            disabilityTableBody.appendChild(row);
        }
    });

    if (disabilityTableBody.children.length === 0) {
        disabilityTableBody.innerHTML = '<tr><td colspan="4" class="no-data">No disability data available</td></tr>';
    }
}

// Indigenous People Report
function loadIndigenousReport(students) {
    window.currentReportStudents = students;

    // Map IP group values to human-readable labels
    const ipGroupMapping = {
        'aeta': 'Aeta',
        'agta': 'Agta',
        'ati': 'Ati',
        'bugkalot': 'Bugkalot (Ilongot)',
        'dumagat': 'Dumagat',
        'remontado': 'Remontado',
        'ifugao': 'Ifugao',
        'kalinga': 'Kalinga',
        'kankanaey': 'Kankanaey',
        'ibaloi': 'Ibaloi',
        'bontoc': 'Bontoc',
        'isneg': 'Isneg (Apayao)',
        'tinggian': 'Tinggian',
        'karao': 'Karao',
        'hanunoo': 'Hanunoo',
        'iraya-manobo': 'Iraya Manobo',
        'panay-bukidnon': 'Panay Bukidnon',
        'suludnon': 'Suludnon',
        'tagbanua': 'Tagbanua',
        'maranao': 'Maranao',
        'maguindanao': 'Maguindanao',
        'tausug': 'Tausug',
        'sama-bajau': 'Sama-Bajau',
        'yakan': 'Yakan',
        'manobo': 'Manobo',
        'bagobo': 'Bagobo',
        'bukidnon': 'Bukidnon',
        'magsaysay': 'Magsaysay',
        'mandaya': 'Mandaya',
        'mansaka': 'Mansaka',
        'maragusan': 'Maragusan',
        'tboli': 'T\'boli'
    };

    const ipData = {};

    let totalIP = 0;

    students.forEach(student => {
        const gender = student.gender ? student.gender.toLowerCase() : '';

        // Get IP group value
        let ipGroup = student.ip_group ? String(student.ip_group).trim().toLowerCase() : '';

        // Only count if IP group is specified and not empty
        if (ipGroup && ipGroup.length > 0 && ipGroup !== 'none' && ipGroup !== '') {
            totalIP++;

            // Map to human-readable label
            const label = ipGroupMapping[ipGroup] || ipGroup.charAt(0).toUpperCase() + ipGroup.slice(1);

            if (!ipData[label]) {
                ipData[label] = { male: 0, female: 0, total: 0 };
            }

            if (gender === 'male' || gender === 'm') ipData[label].male++;
            if (gender === 'female' || gender === 'f') ipData[label].female++;
            ipData[label].total++;
        }
    });

    // Calculate male and female counts
    let maleIP = 0, femaleIP = 0;
    
    students.forEach(student => {
        const gender = student.gender ? student.gender.toLowerCase() : '';
        let ipGroup = student.ip_group ? String(student.ip_group).trim().toLowerCase() : '';
        
        if (ipGroup && ipGroup.length > 0 && ipGroup !== 'none' && ipGroup !== '') {
            if (gender === 'male' || gender === 'm') maleIP++;
            if (gender === 'female' || gender === 'f') femaleIP++;
        }
    });

    console.info('Indigenous report: processed totalIP=', totalIP, 'maleIP=', maleIP, 'femaleIP=', femaleIP, 'groups=', Object.keys(ipData).length);

    document.getElementById('maleIP').textContent = maleIP;
    document.getElementById('femaleIP').textContent = femaleIP;
    document.getElementById('totalIP').textContent = totalIP;

    // Update IP table
    const ipTableBody = document.getElementById('ipTableBody');
    ipTableBody.innerHTML = '';
    
    Object.keys(ipData).sort().forEach(group => {
        const data = ipData[group];
        if (data.total > 0) {
            const row = document.createElement('tr');
            row.classList.add('clickable');
            row.innerHTML = `
                <td>${group}</td>
                <td>${data.male}</td>
                <td>${data.female}</td>
                <td>${data.total}</td>
            `;
            row.addEventListener('click', function() {
                // Filter students by this IP group
                const filtered = students.filter(student => {
                    let ipGroup = student.ip_group ? String(student.ip_group).trim().toLowerCase() : '';
                    // Map to human-readable label
                    const label = ipGroupMapping[ipGroup] || ipGroup.charAt(0).toUpperCase() + ipGroup.slice(1);
                    return label === group;
                });
                showStatModal('ip-group-' + group, 'Students in IP Group: ' + group, filtered);
            });
            ipTableBody.appendChild(row);
        }
    });

    if (ipTableBody.children.length === 0) {
        ipTableBody.innerHTML = '<tr><td colspan="4" class="no-data">No indigenous people data available</td></tr>';
    }

    // Helper: robustly get ip group value from a student record
    const getIpGroup = (s) => {
        const raw = s && (s.ip_group || s.ip || s.ip_status || s.indigenous || s.ipStatus || s.isIP);
        if (!raw && raw !== 0) return '';
        return String(raw).trim();
    };

    const getGender = (s) => {
        const raw = s && (s.gender || s.sex);
        if (!raw && raw !== 0) return '';
        return String(raw).trim().toLowerCase();
    };

    // Fetch latest enrollments from server and normalize into student-like objects
    async function fetchReportStudentsFromServer() {
        const base = (typeof API_BASE !== 'undefined' && API_BASE) ? API_BASE : window.location.origin;
        try {
            const approvedPath = '/api/enrollments?status=Approved';
            console.log('[fetchReportStudentsFromServer] requesting', approvedPath);
            let resp = await apiFetch(approvedPath);

            // fallback to fetch all if approved query returns nothing or fails
            if (!resp.ok) {
                const fallbackPath = '/api/enrollments';
                console.warn('[fetchReportStudentsFromServer] approved fetch failed, trying', fallbackPath, 'status=', resp.status);
                resp = await apiFetch(fallbackPath);
            }

            let data = [];
            try { data = resp.ok ? await resp.json() : []; } catch (parseErr) { console.warn('[fetchReportStudentsFromServer] failed to parse JSON', parseErr); }

            console.log('[fetchReportStudentsFromServer] received', Array.isArray(data) ? data.length : typeof data, 'records');
            if (!Array.isArray(data)) return [];

            // show one example to help map fields
            if (data.length > 0) console.log('[fetchReportStudentsFromServer] sample record:', data[0]);

            return data.map(d => {
                const ipGroupVal = (d.ipGroup || d.ip_group || d.ipgroup || d.ip || d.ip_status || d.indigenous || d.isIP || '').toString();
                const genderVal = (d.gender || d.sex || d.Gender || '').toString();
                return {
                    id: d.student_id || d.id || d.studentId || d.lrn || d.email || '',
                    lrn: d.lrn || d.LRN || d.student_lrn || '',
                    firstName: d.firstName || d.firstname || d.first_name || '',
                    lastName: d.lastName || d.lastname || d.last_name || '',
                    fullName: d.fullName || d.full_name || ((d.firstName || d.firstname || '') + ' ' + (d.lastName || d.lastname || '')).trim(),
                    gender: genderVal,
                    grade: d.grade || d.grade_level || d.gradeLevel || '',
                    ip_group: ipGroupVal,
                    raw: d
                };
            });
        } catch (e) {
            console.warn('[fetchReportStudentsFromServer] failed to fetch enrollments', e);
            return [];
        }
    }

    // Helper: open stat modal showing a list of students
    const openStatModalWithStudents = (title, list) => {
        const modal = document.getElementById('statModalContainer');
        const body = document.getElementById('statModalBody');
        const titleEl = document.getElementById('statModalTitle');
        if (titleEl) titleEl.textContent = title || 'Student List';
        if (body) {
            if (!list || list.length === 0) {
                body.innerHTML = '<div class="no-data">No students found in this category</div>';
            } else {
                const rows = list.map((s, idx) => {
                    const lrn = s.lrn || s.student_lrn || '--';
                    const name = (s.fullName || s.full_name || `${s.firstName || s.firstname || ''} ${s.lastName || s.lastname || ''}`).trim() || '--';
                    const grade = s.grade || s.grade_level || s.gradeLevel || '--';
                    const group = getIpGroup(s) || '--';
                    return `<tr data-student-id="${escapeHtml(String(s.id || s.studentId || s.student_id || ''))}"><td>${idx+1}</td><td>${escapeHtml(lrn)}</td><td>${escapeHtml(name)}</td><td>${escapeHtml(grade)}</td><td>${escapeHtml(group)}</td></tr>`;
                }).join('');
                body.innerHTML = `
                    <div class="report-students-list">
                        <table class="table">
                            <thead><tr><th>#</th><th>LRN</th><th>Name</th><th>Grade</th><th>IP Group</th></tr></thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                `;

                // Add click-to-view behavior for rows (delegated)
                body.querySelectorAll('tbody tr').forEach(tr => {
                    tr.style.cursor = 'pointer';
                    tr.addEventListener('click', () => {
                        const sid = tr.dataset.studentId;
                        if (!sid) return;
                        // Attempt to open the enrollment/profile modal for this student if available
                        try { showEnrollmentDetails && showEnrollmentDetails(sid); } catch (e) { /* noop */ }
                    });
                });
            }
        }
        if (modal) { modal.setAttribute('aria-hidden','false'); modal.style.display = 'flex'; modal.style.pointerEvents = 'auto'; }
    };

    // Wire stat card clicks to open modal with corresponding filtered students
    try {
        const maleEl = document.getElementById('maleIP');
        const femaleEl = document.getElementById('femaleIP');
        const totalEl = document.getElementById('totalIP');

        if (maleEl) {
            maleEl.style.cursor = 'pointer';
            maleEl.removeEventListener('click', maleEl._ipClickHandler);
            maleEl._ipClickHandler = async () => {
                const live = await fetchReportStudentsFromServer();
                const list = live.filter(s => {
                    const ipGroup = (s.ip_group || '').toString().trim().toLowerCase();
                    const gender = (s.gender || '').toString().trim().toLowerCase();
                    return ipGroup && ipGroup !== 'none' && (gender === 'male' || gender === 'm');
                });
                console.log('[loadIndigenousReport] maleIP clicked, fetched', live.length, 'records, matched', list.length);
                openStatModalWithStudents('Male IP Students', list);
            };
            maleEl.addEventListener('click', maleEl._ipClickHandler);
        }

        if (femaleEl) {
            femaleEl.style.cursor = 'pointer';
            femaleEl.removeEventListener('click', femaleEl._ipClickHandler);
            femaleEl._ipClickHandler = async () => {
                const live = await fetchReportStudentsFromServer();
                const list = live.filter(s => {
                    const ipGroup = (s.ip_group || '').toString().trim().toLowerCase();
                    const gender = (s.gender || '').toString().trim().toLowerCase();
                    return ipGroup && ipGroup !== 'none' && (gender === 'female' || gender === 'f');
                });
                console.log('[loadIndigenousReport] femaleIP clicked, fetched', live.length, 'records, matched', list.length);
                openStatModalWithStudents('Female IP Students', list);
            };
            femaleEl.addEventListener('click', femaleEl._ipClickHandler);
        }

        if (totalEl) {
            totalEl.style.cursor = 'pointer';
            totalEl.removeEventListener('click', totalEl._ipClickHandler);
            totalEl._ipClickHandler = async () => {
                const live = await fetchReportStudentsFromServer();
                const list = live.filter(s => {
                    const ipGroup = (s.ip_group || '').toString().trim().toLowerCase();
                    return ipGroup && ipGroup !== 'none';
                });
                console.log('[loadIndigenousReport] totalIP clicked, fetched', live.length, 'records, matched', list.length);
                openStatModalWithStudents('All IP Students', list);
            };
            totalEl.addEventListener('click', totalEl._ipClickHandler);
        }
    } catch (e) { console.warn('[loadIndigenousReport] Failed to wire stat click handlers', e); }
}

// 4Ps Report
function load4PsReport(students) {
    window.currentReportStudents = students;

    const grades = ['7', '8', '9', '10', '11', '12'];
    const _4psData = {};

    grades.forEach(grade => {
        _4psData[grade] = { male: 0, female: 0, total: 0, students: [] };
    });

    let male4Ps = 0, female4Ps = 0, total4Ps = 0;

    students.forEach(student => {
        const _4psStatus = student.four_ps_status ? String(student.four_ps_status).trim().toLowerCase() : '';
        const gender = student.gender ? student.gender.toLowerCase() : '';
        const grade = student.grade_level ? String(student.grade_level) : '';

        if (_4psStatus === 'yes' || _4psStatus === 'true' || _4psStatus === '1') {
            total4Ps++;
            if (gender === 'male' || gender === 'm') male4Ps++;
            if (gender === 'female' || gender === 'f') female4Ps++;

            if (_4psData[grade]) {
                if (gender === 'male' || gender === 'm') _4psData[grade].male++;
                if (gender === 'female' || gender === 'f') _4psData[grade].female++;
                _4psData[grade].total++;
                _4psData[grade].students.push(student);
            }
        }
    });

    document.getElementById('male4Ps').textContent = male4Ps;
    document.getElementById('female4Ps').textContent = female4Ps;
    document.getElementById('total4Ps').textContent = total4Ps;

    // Update 4Ps table
    const _4psTableBody = document.getElementById('4psTableBody');
    _4psTableBody.innerHTML = '';
    
    grades.forEach(grade => {
        const data = _4psData[grade];
        const row = document.createElement('tr');
        row.classList.add('clickable');
        row.innerHTML = `
            <td>Grade ${grade}</td>
            <td>${data.male}</td>
            <td>${data.female}</td>
            <td>${data.total}</td>
        `;
        row.addEventListener('click', function() {
            // Show students in modal for this grade level
            showStatModal('4ps', 'Grade ' + grade + ' - 4Ps Beneficiaries', data.students);
        });
        _4psTableBody.appendChild(row);
    });
}

// Mother Tongue Report
function loadMotherTongueReport(students) {
    window.currentReportStudents = students;

    // Comprehensive mapping of mother tongue form values to display names
    const motherTongueMapping = {
        'tagalog': 'Tagalog',
        'cebuano': 'Cebuano',
        'ilocano': 'Ilocano',
        'hiligaynon': 'Hiligaynon/Ilonggo',
        'bicolano': 'Bicolano',
        'pangasinan': 'Pangasinan',
        'kapampangan': 'Kapampangan',
        'maranao': 'Maranao',
        'maguindanao': 'Maguindanao',
        'tausug': 'Tausug',
        'waray': 'Waray',
        'masbateno': 'Masbateno',
        'aklanon': 'Aklanon',
        'capiznon': 'Capiznon',
        'romblomanon': 'Romblomanon',
        'antique': 'Antique',
        'sama-bajau': 'Sama-Bajau',
        'maranao-lanao': 'Maranao (Lanao)',
        'maguindanao-cotabato': 'Maguindanao (Cotabato)',
        'subanon': 'Subanon',
        'tiruray': 'Tiruray',
        'subanen': 'Subanen',
        'bukidnon': 'Bukidnon',
        'manobo': 'Manobo',
        'magsaysay': 'Magsaysay',
        'ifugao': 'Ifugao',
        'kalinga': 'Kalinga',
        'kankanaey': 'Kankanaey',
        'ibaloi': 'Ibaloi',
        'bontoc': 'Bontoc',
        'isneg': 'Isneg',
        'tinggian': 'Tinggian',
        'karao': 'Karao',
        'hanunoo': 'Hanunoo',
        'tagbanua': 'Tagbanua',
        'palawano': 'Palawano',
        'batak': 'Batak',
        'molbog': 'Molbog',
        'aeta': 'Aeta',
        'agta': 'Agta',
        'english': 'English',
        'spanish': 'Spanish',
        'chinese': 'Chinese',
        'japanese': 'Japanese',
        'korean': 'Korean',
        'arabic': 'Arabic'
    };

    const mtData = {};

    students.forEach(student => {
        const mtValue = student.mother_tongue ? String(student.mother_tongue).trim().toLowerCase() : '';
        const gender = student.gender ? student.gender.toLowerCase() : '';

        if (mtValue && mtValue.length > 0) {
            // Map the value to display name, or use the value as-is if custom "other"
            let displayName = motherTongueMapping[mtValue] || (mtValue === 'other' ? 'Other (Not Listed)' : mtValue);
            
            if (!mtData[displayName]) {
                mtData[displayName] = { male: 0, female: 0, total: 0, students: [] };
            }

            if (gender === 'male' || gender === 'm') mtData[displayName].male++;
            if (gender === 'female' || gender === 'f') mtData[displayName].female++;
            mtData[displayName].total++;
            mtData[displayName].students.push(student);
        }
    });

    // Update Mother Tongue table
    const mtTableBody = document.getElementById('motherTongueTableBody');
    mtTableBody.innerHTML = '';
    
    // Sort by total count descending, then by name
    Object.keys(mtData).sort((a, b) => {
        if (mtData[b].total !== mtData[a].total) {
            return mtData[b].total - mtData[a].total;
        }
        return a.localeCompare(b);
    }).forEach(mt => {
        const data = mtData[mt];
        if (data.total > 0) {
            const row = document.createElement('tr');
            row.classList.add('clickable');
            row.innerHTML = `
                <td>${mt}</td>
                <td>${data.male}</td>
                <td>${data.female}</td>
                <td>${data.total}</td>
            `;
            row.addEventListener('click', function() {
                // Show students in modal for this mother tongue
                showStatModal('mother-tongue', 'Mother Tongue: ' + mt, data.students);
            });
            mtTableBody.appendChild(row);
        }
    });

    if (mtTableBody.children.length === 0) {
        mtTableBody.innerHTML = '<tr><td colspan="4" class="no-data">No data available</td></tr>';
    }

    console.info('Mother Tongue report: processed total languages=', Object.keys(mtData).length);
}

// Track Report
function loadTrackReport(students) {
    window.currentReportStudents = students;

    const tracks = ['Academic', 'TechPro', 'Doorway'];
    const trackData = {};

    tracks.forEach(track => {
        trackData[track] = { male: 0, female: 0, total: 0 };
    });

    students.forEach(student => {
        const track = student.track ? String(student.track).trim() : '';
        const gender = student.gender ? student.gender.toLowerCase() : '';

        if (track && track.length > 0) {
            let matchedTrack = tracks.find(t => track.toLowerCase().includes(t.toLowerCase())) || 'Academic';
            
            if (!trackData[matchedTrack]) {
                trackData[matchedTrack] = { male: 0, female: 0, total: 0 };
            }

            if (gender === 'male' || gender === 'm') trackData[matchedTrack].male++;
            if (gender === 'female' || gender === 'f') trackData[matchedTrack].female++;
            trackData[matchedTrack].total++;
        }
    });

    // Update stat items with gender breakdown
    document.getElementById('maleAcademic').textContent = trackData['Academic'].male;
    document.getElementById('femaleAcademic').textContent = trackData['Academic'].female;
    document.getElementById('academicTotal').textContent = trackData['Academic'].total;

    document.getElementById('maleTechpro').textContent = trackData['TechPro'].male;
    document.getElementById('femaleTechpro').textContent = trackData['TechPro'].female;
    document.getElementById('techproTotal').textContent = trackData['TechPro'].total;

    document.getElementById('maleDoorway').textContent = trackData['Doorway'].male;
    document.getElementById('femaleDoorway').textContent = trackData['Doorway'].female;
    document.getElementById('doorwayTotal').textContent = trackData['Doorway'].total;

    // Update Track table
    const trackTableBody = document.getElementById('trackTableBody');
    trackTableBody.innerHTML = '';
    
    tracks.forEach(track => {
        const data = trackData[track];
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${track}</td>
            <td>${data.male}</td>
            <td>${data.female}</td>
            <td>${data.total}</td>
        `;
        trackTableBody.appendChild(row);
    });
}

// Electives Report
function loadElectivesReport(students) {
    window.currentReportStudents = Array.isArray(students) ? students : [];

    const normalizeText = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const normalizeKey = (value) => normalizeText(value).toLowerCase();
    const normalizeGender = (value) => {
        const gender = String(value || '').trim().toLowerCase();
        if (gender === 'male' || gender === 'm') return 'male';
        if (gender === 'female' || gender === 'f') return 'female';
        return '';
    };
    const getStudentName = (student) => {
        const firstName = (student.first_name || student.firstName || '').toString().trim();
        const lastName = (student.last_name || student.lastName || '').toString().trim();
        const fullName = `${lastName}, ${firstName}`.replace(/^,\s*|,\s*$/g, '').trim();
        return fullName || (student.fullName || student.full_name || '--').toString().trim();
    };
    const sanitizeKey = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const fallbackElectiveCategories = {
        'Arts, Social Sciences & Humanities': ['Citizenship and Civic Engagement', 'Creative Industries (Visual, Media, Applied, and Traditional Art)', 'Creative Industries (Music, Dance, Theater)', 'Creative Writing', 'Cultivating Filipino Identity Through the Arts', 'Filipino sa Isports', 'Filipino sa Sining at Disenyo', 'Filipino sa Teknikal-Propesyonal', 'Introduction to the Philosophy of the Human Person', 'Leadership and Management in the Arts', 'Malikhaing Pagsulat', 'Philippine Politics and Governance', 'The Social Sciences in Theory and Practice', 'Wika at Komunikasyon sa Akademikong Filipino'],
        'Business & Entrepreneurship': ['Basic Accounting', 'Business Finance and Income Taxation', 'Contemporary Marketing and Business Economics', 'Entrepreneurship', 'Introduction to Organization and Management'],
        'Sports, Health & Wellness': ['Exercise and Sports Programming', 'Introduction to Human Movement', 'Physical Education (Fitness and Recreation)', 'Physical Education (Sports and Dance)', 'Safety and First Aid', 'Sports Coaching', 'Sports Officiating', 'Sports Activity Management'],
        'Science, Technology, Engineering & Mathematics': ['Advanced Mathematics 1-2', 'Biology 1-2', 'Biology 3-4', 'Chemistry 1-2', 'Chemistry 3-4', 'Database Management', 'Earth and Space Science 1-2', 'Earth and Space Science 3-4', 'Empowerment Technologies', 'Finite Mathematics', 'Fundamentals of Data Analytics and Management', 'General Science (Physical Science)', 'General Science (Earth and Life Science)', 'Pre-Calculus 1-2', 'Physics 1-2', 'Physics 3-4', 'Trigonometry 1-2'],
        'Field Experience': ['Arts Apprenticeship - Theater Arts', 'Arts Apprenticeship - Dance', 'Arts Apprenticeship - Music', 'Arts Apprenticeship - Literary Arts', 'Arts Apprenticeship - Visual, Media, Applied, and Traditional Art', 'Creative Production and Presentation', 'Design and Innovation Research Methods', 'Field Exposure (In-Campus)', 'Field Exposure (Off-Campus)', 'Work Immersion'],
        'Information & Computer Technology': ['Animation (NC II)', 'Broadband Installation (Fixed Wireless Systems) (NC II)', 'Computer Programming (Java) (NC III)', 'Computer Programming (Oracle Database) (NC III)', 'Computer Systems Servicing (NC II)', 'Contact Center Services (NC II)', 'Illustration (NC II)', 'Programming (.NET Technology) (NC III)', 'Visual Graphic Design (NC III)'],
        'Industrial Arts': ['Automotive Servicing (Engine and Chassis) (NC II)', 'Automotive Servicing (Electrical) (NC II)', 'Carpentry (NC I and NC II)', 'Construction Operations (Masonry NC I and Tiles Plumbing NC II)', 'Commercial Air-Conditioning Installation and Servicing (NC III)', 'Domestic Refrigeration and Air-Conditioning Servicing (NC II)', 'Driving and Automotive Servicing (Driving NC II and Automotive Servicing NC I)', 'Electrical Installation Maintenance (NC II)', 'Electronics Product and Assembly Servicing (NC II)', 'Manual Metal Arc Welding (NC II)', 'Mechatronics (NC II)', 'Motorcycle and Small Engine Servicing (NC II)', 'Photovoltaic System Installation (NC II)', 'Technical Drafting (NC II)'],
        'Agriculture & Fishery Arts': ['Agricultural Crops Production (NC II)', 'Agro-Entrepreneurship (NC II)', 'Aquaculture (NC II)', 'Fish Capture Operation (NC II)', 'Food Processing (NC II)', 'Organic Agriculture Production (NC II)', 'Poultry Production - Chicken (NC II)', 'Ruminants Production (NC II)', 'Swine Production (NC II)'],
        'Family & Consumer Science': ['Aesthetic Services (Beauty Care) (NC II)', 'Bakery Operations (NC II)', 'Caregiving (Adult Care) (NC II)', 'Caregiving (Child Care) (NC II)', 'Events Management Services (NC III)', 'Food and Beverages Operations (NC II)', 'Garments Artisanry (NC II)', 'Hairdressing Services (NC II)', 'Handicraft (Weaving) (NC II)', 'Hotel Operations (Front Office Services) (NC II)', 'Hotel Operations (Housekeeping Services) (NC II)', 'Kitchen Operations (NC II)', 'Tourism Services (NC II)'],
        'Maritime': ['Marine Engineering at the Support Level (Non-NC)', 'Marine Transportation at the Support Level (Non-NC)', 'Ships Catering Services (NC I)']
    };

    const sourceMaps = [window.SHS_ACADEMIC_ELECTIVES || {}, window.SHS_TECHPRO_ELECTIVES || {}];

    const normalizeCategoryKey = (value) => String(value || '')
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

    const canonicalCategoryByKey = {};
    Object.keys(fallbackElectiveCategories).forEach(category => {
        canonicalCategoryByKey[normalizeCategoryKey(category)] = category;
    });

    // Always start with full Academic + TechPro category list so all cards render.
    const categoryToElectives = {};
    Object.entries(fallbackElectiveCategories).forEach(([category, electiveList]) => {
        categoryToElectives[category] = electiveList.map(normalizeText).filter(Boolean);
    });

    // Merge runtime definitions into canonical category buckets.
    sourceMaps.forEach(mapObj => {
        Object.entries(mapObj).forEach(([category, electiveList]) => {
            if (!Array.isArray(electiveList)) return;
            const canonicalCategory = canonicalCategoryByKey[normalizeCategoryKey(category)] || category;
            if (!categoryToElectives[canonicalCategory]) categoryToElectives[canonicalCategory] = [];
            categoryToElectives[canonicalCategory].push(...electiveList.map(normalizeText).filter(Boolean));
        });
    });

    Object.keys(categoryToElectives).forEach(category => {
        categoryToElectives[category] = Array.from(new Set(categoryToElectives[category]));
    });

    const electiveToCategory = new Map();
    Object.entries(categoryToElectives).forEach(([category, electiveList]) => {
        electiveList.forEach(elective => {
            electiveToCategory.set(normalizeKey(elective), category);
        });
    });

    const electiveData = {};
    const categoryData = {};
    const categoryStudents = {};
    const studentElectiveRows = [];
    let totalParticipation = 0;

    Object.keys(categoryToElectives).forEach(category => {
        categoryData[category] = { male: 0, female: 0, total: 0 };
        categoryStudents[category] = [];
    });

    const extractElectiveNames = (input) => {
        if (!input) return [];
        if (Array.isArray(input)) {
            return input.flatMap(item => extractElectiveNames(item));
        }
        if (typeof input === 'object') {
            const named = input.name || input.elective || input.title || input.subject || input.subject_name;
            if (named) return [normalizeText(named)].filter(Boolean);
            return Object.values(input).flatMap(item => extractElectiveNames(item));
        }

        const text = String(input || '').trim();
        if (!text) return [];
        if ((text.startsWith('[') && text.endsWith(']')) || (text.startsWith('{') && text.endsWith('}'))) {
            try {
                return extractElectiveNames(JSON.parse(text));
            } catch (e) {
                return [normalizeText(text)].filter(Boolean);
            }
        }

        if (text.includes(',')) {
            return text.split(',').map(v => normalizeText(v)).filter(Boolean);
        }

        return [normalizeText(text)].filter(Boolean);
    };

    window.currentReportStudents.forEach(student => {
        const gender = normalizeGender(student.gender);
        const studentName = getStudentName(student);
        const lrn = (student.lrn || student.student_lrn || student.id || '--').toString().trim();
        const parsedElectives = Array.from(new Set(extractElectiveNames(student.electives)));

        parsedElectives.forEach(electiveName => {
            if (!electiveName) return;

            totalParticipation++;
            const normalizedElectiveKey = normalizeKey(electiveName);
            const category = electiveToCategory.get(normalizedElectiveKey) || 'Uncategorized';

            if (!categoryData[category]) {
                categoryData[category] = { male: 0, female: 0, total: 0 };
                categoryStudents[category] = [];
            }

            if (!electiveData[electiveName]) {
                electiveData[electiveName] = { male: 0, female: 0, total: 0, students: [] };
            }

            if (gender === 'male') {
                electiveData[electiveName].male++;
                categoryData[category].male++;
            }
            if (gender === 'female') {
                electiveData[electiveName].female++;
                categoryData[category].female++;
            }

            electiveData[electiveName].total++;
            categoryData[category].total++;
            electiveData[electiveName].students.push(student);
            categoryStudents[category].push(student);

            studentElectiveRows.push({
                studentName,
                lrn,
                gender,
                elective: electiveName,
                category
            });
        });
    });

    window.electiveDataGlobal = electiveData;
    window.electiveStudentRows = studentElectiveRows;
    window.electiveCategoryData = categoryData;
    window.electiveCategoryStudents = categoryStudents;
    window.electiveNameMapping = {};

    Object.keys(electiveData).forEach(elName => {
        window.electiveNameMapping[sanitizeKey(elName)] = elName;
    });

    const overallEl = document.getElementById('overallElectiveParticipation');
    if (overallEl) overallEl.textContent = totalParticipation;

    const catSummary = document.getElementById('electiveCategorySummary');
    if (catSummary) {
        catSummary.innerHTML = '';
        const categoryOrder = Object.keys(categoryToElectives);
        if (categoryData['Uncategorized'] && categoryData['Uncategorized'].total > 0) {
            categoryOrder.push('Uncategorized');
        }

        categoryOrder.forEach(category => {
            const data = categoryData[category] || { male: 0, female: 0, total: 0 };
            const sanitizedKey = sanitizeKey(category);
            const item = document.createElement('div');
            item.className = 'stat-item clickable';
            item.style.position = 'relative';
            item.style.textAlign = 'center';
            item.innerHTML = `
                <span class="stat-label">${category}</span>
                <div style="display: flex; justify-content: center; gap: 15px; margin-top: 10px; font-size: 12px;">
                    <div style="flex: 1;">
                        <div style="color: #666; font-size: 11px; margin-bottom: 3px;">Male</div>
                        <div style="font-size: 18px; font-weight: 700; color: #1e5631;">${data.male}</div>
                    </div>
                    <div style="flex: 1;">
                        <div style="color: #666; font-size: 11px; margin-bottom: 3px;">Female</div>
                        <div style="font-size: 18px; font-weight: 700; color: #1e5631;">${data.female}</div>
                    </div>
                    <div style="flex: 1;">
                        <div style="color: #666; font-size: 11px; margin-bottom: 3px;">Total</div>
                        <div style="font-size: 18px; font-weight: 700; color: #1e5631;">${data.total}</div>
                    </div>
                </div>
            `;

            item.onclick = () => {
                filterElectiveTableByCategory(category);
                const uniqueStudents = [];
                const seen = new Set();
                (categoryStudents[category] || []).forEach(student => {
                    const key = `${student.lrn || student.student_lrn || student.id || ''}-${getStudentName(student)}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        uniqueStudents.push(student);
                    }
                });
                showStatModal('elective-' + sanitizedKey, `${category} Students`, uniqueStudents);
            };

            catSummary.appendChild(item);
        });
    }

    restoreFullElectiveTable();
    console.info('Electives report: processed totalParticipation=', totalParticipation, 'uniqueElectives=', Object.keys(electiveData).length, 'rowCount=', studentElectiveRows.length);
}

function restoreFullElectiveTable() {
    renderElectiveSummaryTable(window.electiveDataGlobal || {}, null);
}

function filterElectiveTableByCategory(category) {
    renderElectiveSummaryTable(window.electiveDataGlobal || {}, category);
}

function renderElectiveSummaryTable(electiveData, categoryFilter = null) {
    const electivesTableBody = document.getElementById('electivesTableBody');
    if (!electivesTableBody) return;

    const normalizeText = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const normalizeKey = (value) => normalizeText(value).toLowerCase();
    const getStudentName = (student) => {
        const firstName = (student.first_name || student.firstName || '').toString().trim();
        const lastName = (student.last_name || student.lastName || '').toString().trim();
        const fullName = `${lastName}, ${firstName}`.replace(/^,\s*|,\s*$/g, '').trim();
        return fullName || (student.fullName || student.full_name || '--').toString().trim();
    };

    const sourceMaps = [window.SHS_ACADEMIC_ELECTIVES || {}, window.SHS_TECHPRO_ELECTIVES || {}];
    const categoryLookup = new Map();
    sourceMaps.forEach(mapObj => {
        Object.entries(mapObj).forEach(([category, electiveList]) => {
            if (!Array.isArray(electiveList)) return;
            electiveList.forEach(elective => {
                categoryLookup.set(normalizeKey(elective), category);
            });
        });
    });

    electivesTableBody.innerHTML = '';

    const entries = Object.entries(electiveData || {}).filter(([electiveName, data]) => {
        if (!data || data.total <= 0) return false;
        if (!categoryFilter) return true;
        const category = categoryLookup.get(normalizeKey(electiveName)) || 'Uncategorized';
        return category === categoryFilter;
    }).sort((a, b) => {
        if ((b[1].total || 0) !== (a[1].total || 0)) return (b[1].total || 0) - (a[1].total || 0);
        return a[0].localeCompare(b[0]);
    });

    if (entries.length === 0) {
        electivesTableBody.innerHTML = '<tr><td colspan="4" class="no-data">No data available</td></tr>';
        return;
    }

    entries.forEach(([electiveName, data]) => {
        const row = document.createElement('tr');
        row.classList.add('clickable');

        const uniqueStudents = [];
        const seen = new Set();
        (data.students || []).forEach(student => {
            const key = `${student.lrn || student.student_lrn || student.id || ''}-${getStudentName(student)}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueStudents.push(student);
            }
        });

        const sanitizedElective = electiveName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        row.innerHTML = `
            <td>${electiveName || '--'}</td>
            <td>${data.male || 0}</td>
            <td>${data.female || 0}</td>
            <td>${data.total || 0}</td>
        `;

        const openModal = () => {
            showStatModal(`elective-single-${sanitizedElective}`, `Students: ${electiveName}`, uniqueStudents);
        };

        row.addEventListener('click', openModal);
        electivesTableBody.appendChild(row);
    });
}

// Setup export buttons
function setupExportButtons() {
    // Demographics print
    document.getElementById('printDemo')?.addEventListener('click', async () => {
        const selectedFilter = await selectDemographicsPrintFilter();
        if (!selectedFilter) return;
        printReport('demographics', selectedFilter);
    });
    document.getElementById('exportDemoExcel')?.addEventListener('click', async () => {
        const selectedFilter = await selectDemographicsPrintFilter();
        if (!selectedFilter) return;
        exportReportAsExcel('demographics', selectedFilter);
    });

    // Disability print
    document.getElementById('printDisability')?.addEventListener('click', async () => {
        const selectedFilter = await selectDisabilityPrintFilter();
        if (!selectedFilter) return;
        printReport('disability', selectedFilter);
    });
    document.getElementById('exportDisabilityExcel')?.addEventListener('click', async () => {
        const selectedFilter = await selectDisabilityPrintFilter();
        if (!selectedFilter) return;
        exportReportAsExcel('disability', selectedFilter);
    });

    // Indigenous print
    document.getElementById('printIP')?.addEventListener('click', async () => {
        const selectedFilter = await selectIndigenousPrintFilter();
        if (!selectedFilter) return;
        printReport('indigenous', selectedFilter);
    });
    document.getElementById('exportIPExcel')?.addEventListener('click', async () => {
        const selectedFilter = await selectIndigenousPrintFilter();
        if (!selectedFilter) return;
        exportReportAsExcel('indigenous', selectedFilter);
    });

    // 4Ps print
    document.getElementById('print4Ps')?.addEventListener('click', async () => {
        const selectedFilter = await selectFourPsPrintFilter();
        if (!selectedFilter) return;
        printReport('4ps', selectedFilter);
    });
    document.getElementById('export4PsExcel')?.addEventListener('click', async () => {
        const selectedFilter = await selectFourPsPrintFilter();
        if (!selectedFilter) return;
        exportReportAsExcel('4ps', selectedFilter);
    });

    // Mother Tongue print
    document.getElementById('printMTong')?.addEventListener('click', async () => {
        const selectedFilter = await selectMotherTonguePrintFilter();
        if (!selectedFilter) return;
        printReport('mothertongue', selectedFilter);
    });
    document.getElementById('exportMTongExcel')?.addEventListener('click', async () => {
        const selectedFilter = await selectMotherTonguePrintFilter();
        if (!selectedFilter) return;
        exportReportAsExcel('mothertongue', selectedFilter);
    });

    // Track print
    document.getElementById('printTrack')?.addEventListener('click', async () => {
        const selectedFilter = await selectTrackPrintFilter();
        if (!selectedFilter) return;
        printReport('track', selectedFilter);
    });
    document.getElementById('exportTrackExcel')?.addEventListener('click', async () => {
        const selectedFilter = await selectTrackPrintFilter();
        if (!selectedFilter) return;
        exportReportAsExcel('track', selectedFilter);
    });

    // Electives print
    document.getElementById('printElectives')?.addEventListener('click', async () => {
        const selectedFilter = await selectElectivesPrintFilter();
        if (!selectedFilter) return;
        printReport('electives', selectedFilter);
    });
    document.getElementById('exportElectivesExcel')?.addEventListener('click', async () => {
        const selectedFilter = await selectElectivesPrintFilter();
        if (!selectedFilter) return;
        exportReportAsExcel('electives', selectedFilter);
    });

    // Setup customization panel
    setupReportCustomization();
}

function selectDisabilityPrintFilter() {
    const modal = document.getElementById('disabilityPrintModal');
    const closeBtn = document.getElementById('closeDisabilityPrintModal');
    const cancelBtn = document.getElementById('cancelDisabilityPrintBtn');
    const confirmBtn = document.getElementById('confirmDisabilityPrintBtn');
    const typeGroup = document.getElementById('disabilityPrintTypeGroup');
    const typeCheckboxesContainer = document.getElementById('disabilityTypeCheckboxes');
    const maleCheckbox = document.getElementById('disPrintMale');
    const femaleCheckbox = document.getElementById('disPrintFemale');
    const overallCheckbox = document.getElementById('disPrintOverall');

    if (!modal || !closeBtn || !cancelBtn || !confirmBtn || !typeGroup || !typeCheckboxesContainer || !maleCheckbox || !femaleCheckbox || !overallCheckbox) {
        showNotification('Disability print filter modal is not available.', 'error');
        return Promise.resolve(null);
    }

    const disabilityMapping = {
        'blind': 'Blind',
        'low-vision': 'Low Vision',
        'deaf': 'Hearing Impairment',
        'hard-of-hearing': 'Hearing Impairment',
        'autism-spectrum': 'Autism Spectrum Disorder',
        'speech-language': 'Speech/Language Disorder',
        'emotional-behavioral': 'Emotional-Behavioral Disorder',
        'cerebral-palsy': 'Cerebral Palsy',
        'orthopedic-handicap': 'Orthopedic/Physical Handicap',
        'special-health': 'Special Health Problem/Chronic Disease',
        'cancer': 'Cancer',
        'intellectual-disability': 'Intellectual Disability'
    };

    const extractDisabilityTypes = (student) => {
        let disabilityTypes = [];
        if (Array.isArray(student.disabilities) && student.disabilities.length > 0) {
            disabilityTypes = student.disabilities.map(d => String(d || '').trim().toLowerCase()).filter(Boolean);
        } else if (student.disability_status) {
            const disStatus = String(student.disability_status).trim();
            if (disStatus && disStatus.length > 0 && disStatus.toLowerCase() !== 'none' && disStatus.toLowerCase() !== 'no') {
                disabilityTypes = disStatus.split(',').map(d => String(d || '').trim().toLowerCase()).filter(Boolean);
            }
        }
        return disabilityTypes.map(disType => disabilityMapping[disType] || disType.charAt(0).toUpperCase() + disType.slice(1));
    };

    const students = Array.isArray(window.currentReportStudents) ? window.currentReportStudents : [];
    const uniqueTypes = new Set();
    students.forEach(student => {
        extractDisabilityTypes(student).forEach(t => uniqueTypes.add(t));
    });

    const preferredTypeOrder = [
        'Blind',
        'Hearing Impairment',
        'Low Vision'
    ];

    const sortedTypes = Array.from(uniqueTypes).sort((a, b) => {
        const aIndex = preferredTypeOrder.indexOf(a);
        const bIndex = preferredTypeOrder.indexOf(b);
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return a.localeCompare(b);
    });

    typeCheckboxesContainer.innerHTML = '';
    if (sortedTypes.length === 0) {
        typeCheckboxesContainer.innerHTML = '<div class="no-data">No disability types available</div>';
    } else {
        sortedTypes.forEach(type => {
            const label = document.createElement('label');
            label.style.display = 'flex';
            label.style.alignItems = 'center';
            label.style.gap = '8px';
            label.innerHTML = `<input type="checkbox" class="disPrintType" value="${type.replace(/"/g, '&quot;')}" /> ${type}`;
            typeCheckboxesContainer.appendChild(label);
        });
    }

    maleCheckbox.checked = false;
    femaleCheckbox.checked = false;
    overallCheckbox.checked = true;
    typeGroup.style.display = 'block';

    return new Promise((resolve) => {
        const syncOverallWithGender = () => {
            if (maleCheckbox.checked || femaleCheckbox.checked) {
                overallCheckbox.checked = false;
            }
        };

        const syncGenderWithOverall = () => {
            if (overallCheckbox.checked) {
                maleCheckbox.checked = false;
                femaleCheckbox.checked = false;
            }
        };

        const closeModal = () => {
            modal.classList.remove('active');
            modal.setAttribute('aria-hidden', 'true');
            modal.style.display = 'none';
            document.body.style.overflow = '';
        };

        const cleanup = () => {
            maleCheckbox.removeEventListener('change', syncOverallWithGender);
            femaleCheckbox.removeEventListener('change', syncOverallWithGender);
            overallCheckbox.removeEventListener('change', syncGenderWithOverall);
            closeBtn.removeEventListener('click', onCancel);
            cancelBtn.removeEventListener('click', onCancel);
            confirmBtn.removeEventListener('click', onConfirm);
            modal.removeEventListener('click', onBackdropClick);
        };

        const finish = (result) => {
            cleanup();
            closeModal();
            resolve(result);
        };

        const onCancel = () => finish(null);

        const onBackdropClick = (event) => {
            if (event.target === modal) finish(null);
        };

        const onConfirm = () => {
            const selectedTypeCheckboxes = Array.from(typeCheckboxesContainer.querySelectorAll('.disPrintType:checked'));
            const selectedTypes = selectedTypeCheckboxes.map(cb => String(cb.value || '').trim()).filter(Boolean);

            const maleChecked = !!maleCheckbox.checked;
            const femaleChecked = !!femaleCheckbox.checked;
            const overallChecked = !!overallCheckbox.checked;

            let genders = [];
            let restrictGender = false;
            if (overallChecked || (!maleChecked && !femaleChecked)) {
                genders = ['male', 'female'];
                restrictGender = false;
            } else {
                if (maleChecked) genders.push('male');
                if (femaleChecked) genders.push('female');
                restrictGender = genders.length > 0;
            }

            const genderLabel = overallChecked
                ? 'Overall'
                : (maleChecked && femaleChecked)
                    ? 'Male + Female'
                    : maleChecked
                        ? 'Male Only'
                        : femaleChecked
                            ? 'Female Only'
                            : 'All Genders';

            const typeLabel = selectedTypes.length > 0
                ? selectedTypes.join(', ')
                : 'All Disability Types';

            finish({
                type: 'combined',
                genders,
                restrictGender,
                disabilityTypes: selectedTypes,
                restrictType: selectedTypes.length > 0,
                label: `${genderLabel} + ${typeLabel}`
            });
        };

        maleCheckbox.addEventListener('change', syncOverallWithGender);
        femaleCheckbox.addEventListener('change', syncOverallWithGender);
        overallCheckbox.addEventListener('change', syncGenderWithOverall);
        closeBtn.addEventListener('click', onCancel);
        cancelBtn.addEventListener('click', onCancel);
        confirmBtn.addEventListener('click', onConfirm);
        modal.addEventListener('click', onBackdropClick);

        modal.setAttribute('aria-hidden', 'false');
        modal.classList.add('active');
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    });
}

function selectDemographicsPrintFilter() {
    const modal = document.getElementById('demographicsPrintModal');
    const closeBtn = document.getElementById('closeDemographicsPrintModal');
    const cancelBtn = document.getElementById('cancelDemographicsPrintBtn');
    const confirmBtn = document.getElementById('confirmDemographicsPrintBtn');
    const maleCheckbox = document.getElementById('demPrintMale');
    const femaleCheckbox = document.getElementById('demPrintFemale');
    const overallCheckbox = document.getElementById('demPrintOverall');
    const gradeCheckboxes = Array.from(document.querySelectorAll('.demPrintGrade'));

    if (!modal || !closeBtn || !cancelBtn || !confirmBtn || !maleCheckbox || !femaleCheckbox || !overallCheckbox || gradeCheckboxes.length === 0) {
        showNotification('Print filter modal is not available.', 'error');
        return Promise.resolve(null);
    }

    maleCheckbox.checked = false;
    femaleCheckbox.checked = false;
    overallCheckbox.checked = true;
    gradeCheckboxes.forEach(cb => { cb.checked = false; });

    return new Promise((resolve) => {
        const syncOverallWithGender = () => {
            if (maleCheckbox.checked || femaleCheckbox.checked) {
                overallCheckbox.checked = false;
            }
        };

        const syncGenderWithOverall = () => {
            if (overallCheckbox.checked) {
                maleCheckbox.checked = false;
                femaleCheckbox.checked = false;
            }
        };

        const closeModal = () => {
            modal.classList.remove('active');
            modal.setAttribute('aria-hidden', 'true');
            modal.style.display = 'none';
            document.body.style.overflow = '';
        };

        const cleanup = () => {
            maleCheckbox.removeEventListener('change', syncOverallWithGender);
            femaleCheckbox.removeEventListener('change', syncOverallWithGender);
            overallCheckbox.removeEventListener('change', syncGenderWithOverall);
            closeBtn.removeEventListener('click', onCancel);
            cancelBtn.removeEventListener('click', onCancel);
            confirmBtn.removeEventListener('click', onConfirm);
            modal.removeEventListener('click', onBackdropClick);
        };

        const finish = (result) => {
            cleanup();
            closeModal();
            resolve(result);
        };

        const onCancel = () => finish(null);

        const onBackdropClick = (event) => {
            if (event.target === modal) finish(null);
        };

        const onConfirm = () => {
            const selectedGrades = gradeCheckboxes
                .filter(cb => cb.checked)
                .map(cb => String(cb.value))
                .filter(v => /^(7|8|9|10|11|12)$/.test(v))
                .sort((a, b) => Number(a) - Number(b));

            const maleChecked = !!maleCheckbox.checked;
            const femaleChecked = !!femaleCheckbox.checked;
            const overallChecked = !!overallCheckbox.checked;

            if (!maleChecked && !femaleChecked && !overallChecked && selectedGrades.length === 0) {
                showNotification('Please select at least one filter option.', 'error');
                return;
            }

            let genders = [];
            let restrictGender = false;

            if (overallChecked || (!maleChecked && !femaleChecked)) {
                genders = ['male', 'female'];
                restrictGender = false;
            } else {
                if (maleChecked) genders.push('male');
                if (femaleChecked) genders.push('female');
                restrictGender = genders.length > 0;
            }

            const restrictGrade = selectedGrades.length > 0;

            const genderLabel = overallChecked
                ? 'Overall'
                : (maleChecked && femaleChecked)
                    ? 'Male + Female'
                    : maleChecked
                        ? 'Male Only'
                        : femaleChecked
                            ? 'Female Only'
                            : 'All Genders';

            const gradeLabel = restrictGrade
                ? `Grade ${selectedGrades.join(', Grade ')}`
                : 'All Grades';

            finish({
                type: 'combined',
                genders,
                grades: selectedGrades,
                restrictGender,
                restrictGrade,
                overall: overallChecked,
                label: `${genderLabel} + ${gradeLabel}`
            });
        };

        maleCheckbox.addEventListener('change', syncOverallWithGender);
        femaleCheckbox.addEventListener('change', syncOverallWithGender);
        overallCheckbox.addEventListener('change', syncGenderWithOverall);
        closeBtn.addEventListener('click', onCancel);
        cancelBtn.addEventListener('click', onCancel);
        confirmBtn.addEventListener('click', onConfirm);
        modal.addEventListener('click', onBackdropClick);

        modal.setAttribute('aria-hidden', 'false');
        modal.classList.add('active');
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    });
}

function selectIndigenousPrintFilter() {
    const modal = document.getElementById('indigenousPrintModal');
    const closeBtn = document.getElementById('closeIndigenousPrintModal');
    const cancelBtn = document.getElementById('cancelIndigenousPrintBtn');
    const confirmBtn = document.getElementById('confirmIndigenousPrintBtn');
    const ipGroupContainer = document.getElementById('ipGroupCheckboxes');
    const maleCheckbox = document.getElementById('ipPrintMale');
    const femaleCheckbox = document.getElementById('ipPrintFemale');
    const overallCheckbox = document.getElementById('ipPrintOverall');

    if (!modal || !closeBtn || !cancelBtn || !confirmBtn || !ipGroupContainer || !maleCheckbox || !femaleCheckbox || !overallCheckbox) {
        showNotification('Indigenous print filter modal is not available.', 'error');
        return Promise.resolve(null);
    }

    const ipGroupMapping = {
        'aeta': 'Aeta',
        'agta': 'Agta',
        'ati': 'Ati',
        'bugkalot': 'Bugkalot (Ilongot)',
        'dumagat': 'Dumagat',
        'remontado': 'Remontado',
        'ifugao': 'Ifugao',
        'kalinga': 'Kalinga',
        'kankanaey': 'Kankanaey',
        'ibaloi': 'Ibaloi',
        'bontoc': 'Bontoc',
        'isneg': 'Isneg (Apayao)',
        'tinggian': 'Tinggian',
        'karao': 'Karao',
        'hanunoo': 'Hanunoo',
        'iraya-manobo': 'Iraya Manobo',
        'panay-bukidnon': 'Panay Bukidnon',
        'suludnon': 'Suludnon',
        'tagbanua': 'Tagbanua',
        'maranao': 'Maranao',
        'maguindanao': 'Maguindanao',
        'tausug': 'Tausug',
        'sama-bajau': 'Sama-Bajau',
        'yakan': 'Yakan',
        'manobo': 'Manobo',
        'bagobo': 'Bagobo',
        'bukidnon': 'Bukidnon',
        'magsaysay': 'Magsaysay',
        'mandaya': 'Mandaya',
        'mansaka': 'Mansaka',
        'maragusan': 'Maragusan',
        'tboli': 'T\'boli'
    };

    const normalizeIpGroup = (value) => {
        const raw = String(value || '').trim().toLowerCase();
        if (!raw || raw === 'none') return '';
        return ipGroupMapping[raw] || raw.charAt(0).toUpperCase() + raw.slice(1);
    };

    const students = Array.isArray(window.currentReportStudents) ? window.currentReportStudents : [];
    const uniqueGroups = new Set();
    students.forEach(student => {
        const label = normalizeIpGroup(student.ip_group || student.ip || student.ip_status || student.indigenous || student.isIP);
        if (label) uniqueGroups.add(label);
    });

    const preferredGroups = ['Dumagat', 'Mandaya', 'Tinggian'];
    const sortedGroups = Array.from(uniqueGroups).sort((a, b) => {
        const aIndex = preferredGroups.indexOf(a);
        const bIndex = preferredGroups.indexOf(b);
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return a.localeCompare(b);
    });

    ipGroupContainer.innerHTML = '';
    if (sortedGroups.length === 0) {
        ipGroupContainer.innerHTML = '<div class="no-data">No IP groups available</div>';
    } else {
        sortedGroups.forEach(group => {
            const label = document.createElement('label');
            label.style.display = 'flex';
            label.style.alignItems = 'center';
            label.style.gap = '8px';
            label.innerHTML = `<input type="checkbox" class="ipPrintGroup" value="${group.replace(/"/g, '&quot;')}" /> ${group}`;
            ipGroupContainer.appendChild(label);
        });
    }

    maleCheckbox.checked = false;
    femaleCheckbox.checked = false;
    overallCheckbox.checked = true;

    return new Promise((resolve) => {
        const syncOverallWithGender = () => {
            if (maleCheckbox.checked || femaleCheckbox.checked) {
                overallCheckbox.checked = false;
            }
        };

        const syncGenderWithOverall = () => {
            if (overallCheckbox.checked) {
                maleCheckbox.checked = false;
                femaleCheckbox.checked = false;
            }
        };

        const closeModal = () => {
            modal.classList.remove('active');
            modal.setAttribute('aria-hidden', 'true');
            modal.style.display = 'none';
            document.body.style.overflow = '';
        };

        const cleanup = () => {
            maleCheckbox.removeEventListener('change', syncOverallWithGender);
            femaleCheckbox.removeEventListener('change', syncOverallWithGender);
            overallCheckbox.removeEventListener('change', syncGenderWithOverall);
            closeBtn.removeEventListener('click', onCancel);
            cancelBtn.removeEventListener('click', onCancel);
            confirmBtn.removeEventListener('click', onConfirm);
            modal.removeEventListener('click', onBackdropClick);
        };

        const finish = (result) => {
            cleanup();
            closeModal();
            resolve(result);
        };

        const onCancel = () => finish(null);

        const onBackdropClick = (event) => {
            if (event.target === modal) finish(null);
        };

        const onConfirm = () => {
            const selectedGroups = Array.from(ipGroupContainer.querySelectorAll('.ipPrintGroup:checked'))
                .map(cb => String(cb.value || '').trim())
                .filter(Boolean);

            const maleChecked = !!maleCheckbox.checked;
            const femaleChecked = !!femaleCheckbox.checked;
            const overallChecked = !!overallCheckbox.checked;

            let genders = [];
            let restrictGender = false;
            if (overallChecked || (!maleChecked && !femaleChecked)) {
                genders = ['male', 'female'];
                restrictGender = false;
            } else {
                if (maleChecked) genders.push('male');
                if (femaleChecked) genders.push('female');
                restrictGender = genders.length > 0;
            }

            const genderLabel = overallChecked
                ? 'Overall'
                : (maleChecked && femaleChecked)
                    ? 'Male + Female'
                    : maleChecked
                        ? 'Male Only'
                        : femaleChecked
                            ? 'Female Only'
                            : 'All Genders';

            const groupLabel = selectedGroups.length > 0
                ? selectedGroups.join(', ')
                : 'All IP Groups';

            finish({
                type: 'combined',
                genders,
                restrictGender,
                ipGroups: selectedGroups,
                restrictGroup: selectedGroups.length > 0,
                label: `${genderLabel} + ${groupLabel}`
            });
        };

        maleCheckbox.addEventListener('change', syncOverallWithGender);
        femaleCheckbox.addEventListener('change', syncOverallWithGender);
        overallCheckbox.addEventListener('change', syncGenderWithOverall);
        closeBtn.addEventListener('click', onCancel);
        cancelBtn.addEventListener('click', onCancel);
        confirmBtn.addEventListener('click', onConfirm);
        modal.addEventListener('click', onBackdropClick);

        modal.setAttribute('aria-hidden', 'false');
        modal.classList.add('active');
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    });
}

function selectFourPsPrintFilter() {
    const modal = document.getElementById('fourPsPrintModal');
    const closeBtn = document.getElementById('closeFourPsPrintModal');
    const cancelBtn = document.getElementById('cancelFourPsPrintBtn');
    const confirmBtn = document.getElementById('confirmFourPsPrintBtn');
    const maleCheckbox = document.getElementById('fourPsPrintMale');
    const femaleCheckbox = document.getElementById('fourPsPrintFemale');
    const overallCheckbox = document.getElementById('fourPsPrintOverall');
    const gradeCheckboxes = Array.from(document.querySelectorAll('.fourPsPrintGrade'));

    if (!modal || !closeBtn || !cancelBtn || !confirmBtn || !maleCheckbox || !femaleCheckbox || !overallCheckbox || gradeCheckboxes.length === 0) {
        showNotification('4Ps print filter modal is not available.', 'error');
        return Promise.resolve(null);
    }

    maleCheckbox.checked = false;
    femaleCheckbox.checked = false;
    overallCheckbox.checked = true;
    gradeCheckboxes.forEach(cb => { cb.checked = false; });

    return new Promise((resolve) => {
        const syncOverallWithGender = () => {
            if (maleCheckbox.checked || femaleCheckbox.checked) {
                overallCheckbox.checked = false;
            }
        };

        const syncGenderWithOverall = () => {
            if (overallCheckbox.checked) {
                maleCheckbox.checked = false;
                femaleCheckbox.checked = false;
            }
        };

        const closeModal = () => {
            modal.classList.remove('active');
            modal.setAttribute('aria-hidden', 'true');
            modal.style.display = 'none';
            document.body.style.overflow = '';
        };

        const cleanup = () => {
            maleCheckbox.removeEventListener('change', syncOverallWithGender);
            femaleCheckbox.removeEventListener('change', syncOverallWithGender);
            overallCheckbox.removeEventListener('change', syncGenderWithOverall);
            closeBtn.removeEventListener('click', onCancel);
            cancelBtn.removeEventListener('click', onCancel);
            confirmBtn.removeEventListener('click', onConfirm);
            modal.removeEventListener('click', onBackdropClick);
        };

        const finish = (result) => {
            cleanup();
            closeModal();
            resolve(result);
        };

        const onCancel = () => finish(null);

        const onBackdropClick = (event) => {
            if (event.target === modal) finish(null);
        };

        const onConfirm = () => {
            const selectedGrades = gradeCheckboxes
                .filter(cb => cb.checked)
                .map(cb => String(cb.value || ''))
                .filter(v => /^(7|8|9|10|11|12)$/.test(v))
                .sort((a, b) => Number(a) - Number(b));

            const maleChecked = !!maleCheckbox.checked;
            const femaleChecked = !!femaleCheckbox.checked;
            const overallChecked = !!overallCheckbox.checked;

            let genders = [];
            let restrictGender = false;
            if (overallChecked || (!maleChecked && !femaleChecked)) {
                genders = ['male', 'female'];
                restrictGender = false;
            } else {
                if (maleChecked) genders.push('male');
                if (femaleChecked) genders.push('female');
                restrictGender = genders.length > 0;
            }

            const genderLabel = overallChecked
                ? 'Overall'
                : (maleChecked && femaleChecked)
                    ? 'Male + Female'
                    : maleChecked
                        ? 'Male Only'
                        : femaleChecked
                            ? 'Female Only'
                            : 'All Genders';

            const gradeLabel = selectedGrades.length > 0
                ? `Grade ${selectedGrades.join(', Grade ')}`
                : 'All Grades';

            finish({
                type: 'combined',
                genders,
                grades: selectedGrades,
                restrictGender,
                restrictGrade: selectedGrades.length > 0,
                label: `${genderLabel} + ${gradeLabel}`
            });
        };

        maleCheckbox.addEventListener('change', syncOverallWithGender);
        femaleCheckbox.addEventListener('change', syncOverallWithGender);
        overallCheckbox.addEventListener('change', syncGenderWithOverall);
        closeBtn.addEventListener('click', onCancel);
        cancelBtn.addEventListener('click', onCancel);
        confirmBtn.addEventListener('click', onConfirm);
        modal.addEventListener('click', onBackdropClick);

        modal.setAttribute('aria-hidden', 'false');
        modal.classList.add('active');
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    });
}

function selectMotherTonguePrintFilter() {
    const modal = document.getElementById('motherTonguePrintModal');
    const closeBtn = document.getElementById('closeMotherTonguePrintModal');
    const cancelBtn = document.getElementById('cancelMotherTonguePrintBtn');
    const confirmBtn = document.getElementById('confirmMotherTonguePrintBtn');
    const typeContainer = document.getElementById('motherTongueCheckboxes');
    const maleCheckbox = document.getElementById('mtPrintMale');
    const femaleCheckbox = document.getElementById('mtPrintFemale');
    const overallCheckbox = document.getElementById('mtPrintOverall');

    if (!modal || !closeBtn || !cancelBtn || !confirmBtn || !typeContainer || !maleCheckbox || !femaleCheckbox || !overallCheckbox) {
        showNotification('Mother Tongue print filter modal is not available.', 'error');
        return Promise.resolve(null);
    }

    const motherTongueMapping = {
        'tagalog': 'Tagalog',
        'cebuano': 'Cebuano',
        'ilocano': 'Ilocano',
        'hiligaynon': 'Hiligaynon/Ilonggo',
        'bicolano': 'Bicolano',
        'pangasinan': 'Pangasinan',
        'kapampangan': 'Kapampangan',
        'maranao': 'Maranao',
        'maguindanao': 'Maguindanao',
        'tausug': 'Tausug',
        'waray': 'Waray',
        'masbateno': 'Masbateno',
        'aklanon': 'Aklanon',
        'capiznon': 'Capiznon',
        'romblomanon': 'Romblomanon',
        'antique': 'Antique',
        'sama-bajau': 'Sama-Bajau',
        'maranao-lanao': 'Maranao (Lanao)',
        'maguindanao-cotabato': 'Maguindanao (Cotabato)',
        'subanon': 'Subanon',
        'tiruray': 'Tiruray',
        'subanen': 'Subanen',
        'bukidnon': 'Bukidnon',
        'manobo': 'Manobo',
        'magsaysay': 'Magsaysay',
        'ifugao': 'Ifugao',
        'kalinga': 'Kalinga',
        'kankanaey': 'Kankanaey',
        'ibaloi': 'Ibaloi',
        'bontoc': 'Bontoc',
        'isneg': 'Isneg',
        'tinggian': 'Tinggian',
        'karao': 'Karao',
        'hanunoo': 'Hanunoo',
        'tagbanua': 'Tagbanua',
        'palawano': 'Palawano',
        'batak': 'Batak',
        'molbog': 'Molbog',
        'aeta': 'Aeta',
        'agta': 'Agta',
        'english': 'English',
        'spanish': 'Spanish',
        'chinese': 'Chinese',
        'japanese': 'Japanese',
        'korean': 'Korean',
        'arabic': 'Arabic'
    };

    const normalizeMotherTongue = (value) => {
        const raw = String(value || '').trim().toLowerCase();
        if (!raw || raw === 'none') return '';
        if (raw === 'other') return 'Other (Not Listed)';
        return motherTongueMapping[raw] || raw.charAt(0).toUpperCase() + raw.slice(1);
    };

    const students = Array.isArray(window.currentReportStudents) ? window.currentReportStudents : [];
    const uniqueTypes = new Set();
    students.forEach(student => {
        const normalized = normalizeMotherTongue(student.mother_tongue || student.motherTongue || student.language);
        if (normalized) uniqueTypes.add(normalized);
    });

    const sortedTypes = Array.from(uniqueTypes).sort((a, b) => a.localeCompare(b));
    typeContainer.innerHTML = '';
    if (sortedTypes.length === 0) {
        typeContainer.innerHTML = '<div class="no-data">No mother tongue data available</div>';
    } else {
        sortedTypes.forEach(type => {
            const label = document.createElement('label');
            label.style.display = 'flex';
            label.style.alignItems = 'center';
            label.style.gap = '8px';
            label.innerHTML = `<input type="checkbox" class="mtPrintType" value="${type.replace(/"/g, '&quot;')}" /> ${type}`;
            typeContainer.appendChild(label);
        });
    }

    maleCheckbox.checked = false;
    femaleCheckbox.checked = false;
    overallCheckbox.checked = true;

    return new Promise((resolve) => {
        const syncOverallWithGender = () => {
            if (maleCheckbox.checked || femaleCheckbox.checked) {
                overallCheckbox.checked = false;
            }
        };

        const syncGenderWithOverall = () => {
            if (overallCheckbox.checked) {
                maleCheckbox.checked = false;
                femaleCheckbox.checked = false;
            }
        };

        const closeModal = () => {
            modal.classList.remove('active');
            modal.setAttribute('aria-hidden', 'true');
            modal.style.display = 'none';
            document.body.style.overflow = '';
        };

        const cleanup = () => {
            maleCheckbox.removeEventListener('change', syncOverallWithGender);
            femaleCheckbox.removeEventListener('change', syncOverallWithGender);
            overallCheckbox.removeEventListener('change', syncGenderWithOverall);
            closeBtn.removeEventListener('click', onCancel);
            cancelBtn.removeEventListener('click', onCancel);
            confirmBtn.removeEventListener('click', onConfirm);
            modal.removeEventListener('click', onBackdropClick);
        };

        const finish = (result) => {
            cleanup();
            closeModal();
            resolve(result);
        };

        const onCancel = () => finish(null);

        const onBackdropClick = (event) => {
            if (event.target === modal) finish(null);
        };

        const onConfirm = () => {
            const selectedTypes = Array.from(typeContainer.querySelectorAll('.mtPrintType:checked'))
                .map(cb => String(cb.value || '').trim())
                .filter(Boolean);

            const maleChecked = !!maleCheckbox.checked;
            const femaleChecked = !!femaleCheckbox.checked;
            const overallChecked = !!overallCheckbox.checked;

            let genders = [];
            let restrictGender = false;
            if (overallChecked || (!maleChecked && !femaleChecked)) {
                genders = ['male', 'female'];
                restrictGender = false;
            } else {
                if (maleChecked) genders.push('male');
                if (femaleChecked) genders.push('female');
                restrictGender = genders.length > 0;
            }

            const genderLabel = overallChecked
                ? 'Overall'
                : (maleChecked && femaleChecked)
                    ? 'Male + Female'
                    : maleChecked
                        ? 'Male Only'
                        : femaleChecked
                            ? 'Female Only'
                            : 'All Genders';

            const typeLabel = selectedTypes.length > 0
                ? selectedTypes.join(', ')
                : 'All Mother Tongues';

            finish({
                type: 'combined',
                genders,
                restrictGender,
                motherTongues: selectedTypes,
                restrictType: selectedTypes.length > 0,
                label: `${genderLabel} + ${typeLabel}`
            });
        };

        maleCheckbox.addEventListener('change', syncOverallWithGender);
        femaleCheckbox.addEventListener('change', syncOverallWithGender);
        overallCheckbox.addEventListener('change', syncGenderWithOverall);
        closeBtn.addEventListener('click', onCancel);
        cancelBtn.addEventListener('click', onCancel);
        confirmBtn.addEventListener('click', onConfirm);
        modal.addEventListener('click', onBackdropClick);

        modal.setAttribute('aria-hidden', 'false');
        modal.classList.add('active');
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    });
}

function selectTrackPrintFilter() {
    const modal = document.getElementById('trackPrintModal');
    const closeBtn = document.getElementById('closeTrackPrintModal');
    const cancelBtn = document.getElementById('cancelTrackPrintBtn');
    const confirmBtn = document.getElementById('confirmTrackPrintBtn');
    const typeContainer = document.getElementById('trackTypeCheckboxes');
    const maleCheckbox = document.getElementById('trackPrintMale');
    const femaleCheckbox = document.getElementById('trackPrintFemale');
    const overallCheckbox = document.getElementById('trackPrintOverall');

    if (!modal || !closeBtn || !cancelBtn || !confirmBtn || !typeContainer || !maleCheckbox || !femaleCheckbox || !overallCheckbox) {
        showNotification('Track print filter modal is not available.', 'error');
        return Promise.resolve(null);
    }

    const normalizeTrack = (value) => {
        const raw = String(value || '').trim().toLowerCase();
        if (!raw || raw === 'none') return '';
        if (raw.includes('academic')) return 'Academic';
        if (raw.includes('techpro')) return 'TechPro';
        if (raw.includes('doorway')) return 'Doorway';
        return raw.charAt(0).toUpperCase() + raw.slice(1);
    };

    const students = Array.isArray(window.currentReportStudents) ? window.currentReportStudents : [];
    const uniqueTypes = new Set();
    students.forEach(student => {
        const normalized = normalizeTrack(student.track || student.program || student.track_program);
        if (normalized) uniqueTypes.add(normalized);
    });

    const preferredTypeOrder = ['Academic', 'TechPro', 'Doorway'];
    const sortedTypes = Array.from(uniqueTypes).sort((a, b) => {
        const aIndex = preferredTypeOrder.indexOf(a);
        const bIndex = preferredTypeOrder.indexOf(b);
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return a.localeCompare(b);
    });

    typeContainer.innerHTML = '';
    if (sortedTypes.length === 0) {
        typeContainer.innerHTML = '<div class="no-data">No tracks available</div>';
    } else {
        sortedTypes.forEach(type => {
            const label = document.createElement('label');
            label.style.display = 'flex';
            label.style.alignItems = 'center';
            label.style.gap = '8px';
            label.innerHTML = `<input type="checkbox" class="trackPrintType" value="${type.replace(/"/g, '&quot;')}" /> ${type}`;
            typeContainer.appendChild(label);
        });
    }

    maleCheckbox.checked = false;
    femaleCheckbox.checked = false;
    overallCheckbox.checked = true;

    return new Promise((resolve) => {
        const syncOverallWithGender = () => {
            if (maleCheckbox.checked || femaleCheckbox.checked) {
                overallCheckbox.checked = false;
            }
        };

        const syncGenderWithOverall = () => {
            if (overallCheckbox.checked) {
                maleCheckbox.checked = false;
                femaleCheckbox.checked = false;
            }
        };

        const closeModal = () => {
            modal.classList.remove('active');
            modal.setAttribute('aria-hidden', 'true');
            modal.style.display = 'none';
            document.body.style.overflow = '';
        };

        const cleanup = () => {
            maleCheckbox.removeEventListener('change', syncOverallWithGender);
            femaleCheckbox.removeEventListener('change', syncOverallWithGender);
            overallCheckbox.removeEventListener('change', syncGenderWithOverall);
            closeBtn.removeEventListener('click', onCancel);
            cancelBtn.removeEventListener('click', onCancel);
            confirmBtn.removeEventListener('click', onConfirm);
            modal.removeEventListener('click', onBackdropClick);
        };

        const finish = (result) => {
            cleanup();
            closeModal();
            resolve(result);
        };

        const onCancel = () => finish(null);

        const onBackdropClick = (event) => {
            if (event.target === modal) finish(null);
        };

        const onConfirm = () => {
            const selectedTypes = Array.from(typeContainer.querySelectorAll('.trackPrintType:checked'))
                .map(cb => String(cb.value || '').trim())
                .filter(Boolean);

            const maleChecked = !!maleCheckbox.checked;
            const femaleChecked = !!femaleCheckbox.checked;
            const overallChecked = !!overallCheckbox.checked;

            let genders = [];
            let restrictGender = false;
            if (overallChecked || (!maleChecked && !femaleChecked)) {
                genders = ['male', 'female'];
                restrictGender = false;
            } else {
                if (maleChecked) genders.push('male');
                if (femaleChecked) genders.push('female');
                restrictGender = genders.length > 0;
            }

            const genderLabel = overallChecked
                ? 'Overall'
                : (maleChecked && femaleChecked)
                    ? 'Male + Female'
                    : maleChecked
                        ? 'Male Only'
                        : femaleChecked
                            ? 'Female Only'
                            : 'All Genders';

            const typeLabel = selectedTypes.length > 0
                ? selectedTypes.join(', ')
                : 'All Tracks';

            finish({
                type: 'combined',
                genders,
                restrictGender,
                tracks: selectedTypes,
                restrictType: selectedTypes.length > 0,
                label: `${genderLabel} + ${typeLabel}`
            });
        };

        maleCheckbox.addEventListener('change', syncOverallWithGender);
        femaleCheckbox.addEventListener('change', syncOverallWithGender);
        overallCheckbox.addEventListener('change', syncGenderWithOverall);
        closeBtn.addEventListener('click', onCancel);
        cancelBtn.addEventListener('click', onCancel);
        confirmBtn.addEventListener('click', onConfirm);
        modal.addEventListener('click', onBackdropClick);

        modal.setAttribute('aria-hidden', 'false');
        modal.classList.add('active');
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    });
}

function selectElectivesPrintFilter() {
    const modal = document.getElementById('electivesPrintModal');
    const closeBtn = document.getElementById('closeElectivesPrintModal');
    const cancelBtn = document.getElementById('cancelElectivesPrintBtn');
    const confirmBtn = document.getElementById('confirmElectivesPrintBtn');
    const typeContainer = document.getElementById('electiveTypeCheckboxes');
    const maleCheckbox = document.getElementById('electivePrintMale');
    const femaleCheckbox = document.getElementById('electivePrintFemale');
    const overallCheckbox = document.getElementById('electivePrintOverall');

    if (!modal || !closeBtn || !cancelBtn || !confirmBtn || !typeContainer || !maleCheckbox || !femaleCheckbox || !overallCheckbox) {
        showNotification('Electives print filter modal is not available.', 'error');
        return Promise.resolve(null);
    }

    const students = Array.isArray(window.currentReportStudents) ? window.currentReportStudents : [];
    const uniqueTypes = new Set();
    students.forEach(student => {
        const electives = Array.isArray(student.electives) ? student.electives : [];
        electives.forEach(elective => {
            const normalized = String(elective || '').trim();
            if (normalized) uniqueTypes.add(normalized);
        });
    });

    const sortedTypes = Array.from(uniqueTypes).sort((a, b) => a.localeCompare(b));

    typeContainer.innerHTML = '';
    if (sortedTypes.length === 0) {
        typeContainer.innerHTML = '<div class="no-data">No electives available</div>';
    } else {
        sortedTypes.forEach(type => {
            const label = document.createElement('label');
            label.style.display = 'flex';
            label.style.alignItems = 'center';
            label.style.gap = '8px';
            label.innerHTML = `<input type="checkbox" class="electivePrintType" value="${type.replace(/"/g, '&quot;')}" /> ${type}`;
            typeContainer.appendChild(label);
        });
    }

    maleCheckbox.checked = false;
    femaleCheckbox.checked = false;
    overallCheckbox.checked = true;

    return new Promise((resolve) => {
        const syncOverallWithGender = () => {
            if (maleCheckbox.checked || femaleCheckbox.checked) {
                overallCheckbox.checked = false;
            }
        };

        const syncGenderWithOverall = () => {
            if (overallCheckbox.checked) {
                maleCheckbox.checked = false;
                femaleCheckbox.checked = false;
            }
        };

        const closeModal = () => {
            modal.classList.remove('active');
            modal.setAttribute('aria-hidden', 'true');
            modal.style.display = 'none';
            document.body.style.overflow = '';
        };

        const cleanup = () => {
            maleCheckbox.removeEventListener('change', syncOverallWithGender);
            femaleCheckbox.removeEventListener('change', syncOverallWithGender);
            overallCheckbox.removeEventListener('change', syncGenderWithOverall);
            closeBtn.removeEventListener('click', onCancel);
            cancelBtn.removeEventListener('click', onCancel);
            confirmBtn.removeEventListener('click', onConfirm);
            modal.removeEventListener('click', onBackdropClick);
        };

        const finish = (result) => {
            cleanup();
            closeModal();
            resolve(result);
        };

        const onCancel = () => finish(null);

        const onBackdropClick = (event) => {
            if (event.target === modal) finish(null);
        };

        const onConfirm = () => {
            const selectedTypes = Array.from(typeContainer.querySelectorAll('.electivePrintType:checked'))
                .map(cb => String(cb.value || '').trim())
                .filter(Boolean);

            const maleChecked = !!maleCheckbox.checked;
            const femaleChecked = !!femaleCheckbox.checked;
            const overallChecked = !!overallCheckbox.checked;

            let genders = [];
            let restrictGender = false;
            if (overallChecked || (!maleChecked && !femaleChecked)) {
                genders = ['male', 'female'];
                restrictGender = false;
            } else {
                if (maleChecked) genders.push('male');
                if (femaleChecked) genders.push('female');
                restrictGender = genders.length > 0;
            }

            const genderLabel = overallChecked
                ? 'Overall'
                : (maleChecked && femaleChecked)
                    ? 'Male + Female'
                    : maleChecked
                        ? 'Male Only'
                        : femaleChecked
                            ? 'Female Only'
                            : 'All Genders';

            const typeLabel = selectedTypes.length > 0
                ? selectedTypes.join(', ')
                : 'All Electives';

            finish({
                type: 'combined',
                genders,
                restrictGender,
                electives: selectedTypes,
                restrictType: selectedTypes.length > 0,
                label: `${genderLabel} + ${typeLabel}`
            });
        };

        maleCheckbox.addEventListener('change', syncOverallWithGender);
        femaleCheckbox.addEventListener('change', syncOverallWithGender);
        overallCheckbox.addEventListener('change', syncGenderWithOverall);
        closeBtn.addEventListener('click', onCancel);
        cancelBtn.addEventListener('click', onCancel);
        confirmBtn.addEventListener('click', onConfirm);
        modal.addEventListener('click', onBackdropClick);

        modal.setAttribute('aria-hidden', 'false');
        modal.classList.add('active');
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    });
}

// Get default report customization settings
function getDefaultReportSettings() {
    return {
        schoolName: 'Compostela National High School',
        schoolAddress: 'Compostela, Davao de Oro, Philippines',
        reportTitle: 'Official School Report',
        footerText: 'Official Document - Confidential',
        includeDate: true,
        includeSchoolLogo: true,
        showPageNumbers: true
    };
}

// Setup report customization panel
function setupReportCustomization() {
    const toggleBtn = document.getElementById('toggleCustomization');
    const customizationPanel = document.getElementById('customizationOptions');
    const applyBtn = document.getElementById('applyCustomization');
    const resetBtn = document.getElementById('resetCustomization');
    
    if (!toggleBtn) return;
    
    // Load saved settings
    const savedSettings = JSON.parse(sessionStorage.getItem('reportCustomization'));
    if (savedSettings) {
        applySettingsToUI(savedSettings);
    }
    
    // Toggle customization panel
    toggleBtn.addEventListener('click', () => {
        if (customizationPanel.style.display === 'none') {
            customizationPanel.style.display = 'block';
            toggleBtn.classList.add('active');
        } else {
            customizationPanel.style.display = 'none';
            toggleBtn.classList.remove('active');
        }
    });
    
    // Apply settings
    applyBtn?.addEventListener('click', () => {
        const settings = {
            schoolName: document.getElementById('schoolName').value,
            schoolAddress: document.getElementById('schoolAddress').value,
            reportTitle: document.getElementById('reportTitle').value,
            footerText: document.getElementById('footerText').value,
            includeDate: document.getElementById('reportDate').checked,
            includeSchoolLogo: document.getElementById('includeSchoolLogo').checked,
            showPageNumbers: document.getElementById('showPageNumbers').checked
        };
        
        sessionStorage.setItem('reportCustomization', JSON.stringify(settings));
        showNotification('Report settings saved successfully', 'success');
    });
    
    // Reset to defaults
    resetBtn?.addEventListener('click', () => {
        const defaults = getDefaultReportSettings();
        applySettingsToUI(defaults);
        sessionStorage.setItem('reportCustomization', JSON.stringify(defaults));
        showNotification('Report settings reset to defaults', 'success');
    });
}

// Apply settings to UI form
function applySettingsToUI(settings) {
    const schoolName = document.getElementById('schoolName');
    const schoolAddress = document.getElementById('schoolAddress');
    const reportTitle = document.getElementById('reportTitle');
    const footerText = document.getElementById('footerText');
    const reportDate = document.getElementById('reportDate');
    const includeSchoolLogo = document.getElementById('includeSchoolLogo');
    const showPageNumbers = document.getElementById('showPageNumbers');
    
    if (schoolName) schoolName.value = settings.schoolName;
    if (schoolAddress) schoolAddress.value = settings.schoolAddress;
    if (reportTitle) reportTitle.value = settings.reportTitle;
    if (footerText) footerText.value = settings.footerText;
    if (reportDate) reportDate.checked = settings.includeDate;
    if (includeSchoolLogo) includeSchoolLogo.checked = settings.includeSchoolLogo;
    if (showPageNumbers) showPageNumbers.checked = settings.showPageNumbers;
}

// Print report with formal header and footer
function printReport(reportType, selectedPrintFilter = null) {
    const reportContent = document.getElementById(`report-${reportType}`);
    if (!reportContent) {
        showNotification('Report not found', 'error');
        return;
    }

    let printableReportHtml = reportContent.innerHTML;

    if (reportType === 'demographics') {
        const allStudents = Array.isArray(window.currentReportStudents) ? window.currentReportStudents : [];
        const selectedFilter = selectedPrintFilter || window.currentDemographicsFilter || { type: 'all', label: 'Total Overall Students' };

        const normalizeGender = (value) => {
            const gender = String(value || '').trim().toLowerCase();
            if (gender === 'male' || gender === 'm') return 'male';
            if (gender === 'female' || gender === 'f') return 'female';
            return '';
        };

        const getStudentName = (student) => {
            const firstName = (student.first_name || student.firstName || '').toString().trim();
            const lastName = (student.last_name || student.lastName || '').toString().trim();
            const fullName = `${lastName}, ${firstName}`.replace(/^,\s*|,\s*$/g, '').trim();
            return fullName || (student.fullName || student.full_name || '--').toString().trim();
        };

        const escape = (value) => String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

        const filteredStudents = allStudents.filter(student => {
            const gender = normalizeGender(student.gender);
            const gradeLevel = String(student.grade_level || student.grade || '').trim();
            const numericGrade = parseInt(gradeLevel, 10);
            if (selectedFilter.type === 'combined') {
                const selectedGenders = Array.isArray(selectedFilter.genders) ? selectedFilter.genders : [];
                const selectedGrades = Array.isArray(selectedFilter.grades) ? selectedFilter.grades.map(String) : [];
                const passGender = selectedFilter.restrictGender ? selectedGenders.includes(gender) : true;
                const passGrade = selectedFilter.restrictGrade ? selectedGrades.includes(gradeLevel) : true;
                return passGender && passGrade;
            }
            if (selectedFilter.type === 'male') return gender === 'male';
            if (selectedFilter.type === 'female') return gender === 'female';
            if (selectedFilter.type === 'grade') return selectedFilter.grade ? gradeLevel === String(selectedFilter.grade) : true;
            if (selectedFilter.type === 'gradeRange') {
                if (Number.isNaN(numericGrade)) return false;
                return numericGrade >= Number(selectedFilter.minGrade || 8) && numericGrade <= Number(selectedFilter.maxGrade || 12);
            }
            return true;
        });

        const sortedStudents = filteredStudents
            .map(student => ({
                ...student,
                _normalizedGender: normalizeGender(student.gender),
                _printName: getStudentName(student)
            }))
            .sort((a, b) => a._printName.localeCompare(b._printName));

        const maleStudents = sortedStudents.filter(s => s._normalizedGender === 'male');
        const femaleStudents = sortedStudents.filter(s => s._normalizedGender === 'female');

        const renderGroupTable = (label, students) => {
            const rows = students.map((student, index) => {
                const lrn = student.lrn || student.student_lrn || student.id || '--';
                return `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${escape(lrn)}</td>
                        <td>${escape(student._printName)}</td>
                    </tr>
                `;
            }).join('');

            return `
                <h3>${escape(label)} (${students.length})</h3>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 60px;">#</th>
                            <th style="width: 180px;">LRN</th>
                            <th>Student Name</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows || '<tr><td colspan="3" class="no-data">No students found</td></tr>'}
                    </tbody>
                </table>
            `;
        };

        const sections = [];
        sections.push(`<h2>Student Demographics - ${escape(selectedFilter.label || 'Total Overall Students')}</h2>`);
        sections.push(`<div style="margin-bottom: 14px; font-size: 12px; color: #666;">Total Students: <strong>${sortedStudents.length}</strong></div>`);

        const showMaleGroup = selectedFilter.type === 'combined'
            ? (!selectedFilter.restrictGender || (Array.isArray(selectedFilter.genders) && selectedFilter.genders.includes('male')))
            : selectedFilter.type !== 'female';
        const showFemaleGroup = selectedFilter.type === 'combined'
            ? (!selectedFilter.restrictGender || (Array.isArray(selectedFilter.genders) && selectedFilter.genders.includes('female')))
            : selectedFilter.type !== 'male';

        if (selectedFilter.type === 'male') {
            sections.push(renderGroupTable('Male Students', maleStudents));
        } else if (selectedFilter.type === 'female') {
            sections.push(renderGroupTable('Female Students', femaleStudents));
        } else {
            if (showMaleGroup) sections.push(renderGroupTable('Male Students', maleStudents));
            if (showFemaleGroup) sections.push(renderGroupTable('Female Students', femaleStudents));
        }

        sections.push(`
            <div style="margin-top: 14px; font-size: 12px;">
                <strong>Totals:</strong>
                Male: ${maleStudents.length} | Female: ${femaleStudents.length} | Overall: ${sortedStudents.length}
            </div>
        `);

        printableReportHtml = sections.join('');
    }

    if (reportType === 'disability') {
        const allStudents = Array.isArray(window.currentReportStudents) ? window.currentReportStudents : [];
        const selectedFilter = selectedPrintFilter || { type: 'overall', label: 'Overall (Students with Disability)' };

        const disabilityMapping = {
            'blind': 'Blind',
            'low-vision': 'Low Vision',
            'deaf': 'Hearing Impairment',
            'hard-of-hearing': 'Hearing Impairment',
            'autism-spectrum': 'Autism Spectrum Disorder',
            'speech-language': 'Speech/Language Disorder',
            'emotional-behavioral': 'Emotional-Behavioral Disorder',
            'cerebral-palsy': 'Cerebral Palsy',
            'orthopedic-handicap': 'Orthopedic/Physical Handicap',
            'special-health': 'Special Health Problem/Chronic Disease',
            'cancer': 'Cancer',
            'intellectual-disability': 'Intellectual Disability'
        };

        const normalizeGender = (value) => {
            const gender = String(value || '').trim().toLowerCase();
            if (gender === 'male' || gender === 'm') return 'male';
            if (gender === 'female' || gender === 'f') return 'female';
            return '';
        };

        const getStudentName = (student) => {
            const firstName = (student.first_name || student.firstName || '').toString().trim();
            const lastName = (student.last_name || student.lastName || '').toString().trim();
            const fullName = `${lastName}, ${firstName}`.replace(/^,\s*|,\s*$/g, '').trim();
            return fullName || (student.fullName || student.full_name || '--').toString().trim();
        };

        const escape = (value) => String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

        const getDisabilityLabels = (student) => {
            let disabilityTypes = [];
            if (Array.isArray(student.disabilities) && student.disabilities.length > 0) {
                disabilityTypes = student.disabilities.map(d => String(d || '').trim().toLowerCase()).filter(Boolean);
            } else if (student.disability_status) {
                const disStatus = String(student.disability_status).trim();
                if (disStatus && disStatus.length > 0 && disStatus.toLowerCase() !== 'none' && disStatus.toLowerCase() !== 'no') {
                    disabilityTypes = disStatus.split(',').map(d => String(d || '').trim().toLowerCase()).filter(Boolean);
                }
            }
            return disabilityTypes.map(disType => disabilityMapping[disType] || disType.charAt(0).toUpperCase() + disType.slice(1));
        };

        const studentsWithDisability = allStudents.map(student => ({
            ...student,
            _gender: normalizeGender(student.gender),
            _printName: getStudentName(student),
            _disabilityLabels: getDisabilityLabels(student)
        })).filter(student => student._disabilityLabels.length > 0);

        const filteredStudents = studentsWithDisability.filter(student => {
            if (selectedFilter.type === 'combined') {
                const selectedGenders = Array.isArray(selectedFilter.genders) ? selectedFilter.genders : [];
                const selectedTypes = Array.isArray(selectedFilter.disabilityTypes) ? selectedFilter.disabilityTypes : [];
                const passGender = selectedFilter.restrictGender ? selectedGenders.includes(student._gender) : true;
                const passType = selectedFilter.restrictType
                    ? selectedTypes.some(type => student._disabilityLabels.includes(type))
                    : true;
                return passGender && passType;
            }
            if (selectedFilter.type === 'male') return student._gender === 'male';
            if (selectedFilter.type === 'female') return student._gender === 'female';
            if (selectedFilter.type === 'disabilityType') {
                const wanted = String(selectedFilter.disabilityType || '').trim();
                return wanted ? student._disabilityLabels.includes(wanted) : true;
            }
            return true;
        }).sort((a, b) => a._printName.localeCompare(b._printName));

        const maleCount = filteredStudents.filter(s => s._gender === 'male').length;
        const femaleCount = filteredStudents.filter(s => s._gender === 'female').length;

        const rows = filteredStudents.map((student, index) => {
            const lrn = student.lrn || student.student_lrn || student.id || '--';
            const grade = student.grade_level || student.grade || '--';
            const genderLabel = student._gender ? student._gender.charAt(0).toUpperCase() + student._gender.slice(1) : '--';
            return `
                <tr>
                    <td>${index + 1}</td>
                    <td>${escape(lrn)}</td>
                    <td>${escape(student._printName)}</td>
                    <td>${escape(genderLabel)}</td>
                    <td>${escape(grade)}</td>
                    <td>${escape(student._disabilityLabels.join(', '))}</td>
                </tr>
            `;
        }).join('');

        printableReportHtml = `
            <h2>Disability Report - ${escape(selectedFilter.label || 'Overall (Students with Disability)')}</h2>
            <div style="margin-bottom: 12px; font-size: 12px; color: #666;">
                Total Students: <strong>${filteredStudents.length}</strong>
                &nbsp;|&nbsp; Male: <strong>${maleCount}</strong>
                &nbsp;|&nbsp; Female: <strong>${femaleCount}</strong>
            </div>
            <table>
                <thead>
                    <tr>
                        <th style="width: 60px;">#</th>
                        <th style="width: 160px;">LRN</th>
                        <th>Student Name</th>
                        <th style="width: 100px;">Gender</th>
                        <th style="width: 100px;">Grade</th>
                        <th>Disability Type</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows || '<tr><td colspan="6" class="no-data">No students found for selected filter</td></tr>'}
                </tbody>
            </table>
        `;
    }

    if (reportType === 'indigenous') {
        const allStudents = Array.isArray(window.currentReportStudents) ? window.currentReportStudents : [];
        const selectedFilter = selectedPrintFilter || { type: 'combined', label: 'Overall + All IP Groups', genders: ['male', 'female'], restrictGender: false, ipGroups: [], restrictGroup: false };

        const ipGroupMapping = {
            'aeta': 'Aeta',
            'agta': 'Agta',
            'ati': 'Ati',
            'bugkalot': 'Bugkalot (Ilongot)',
            'dumagat': 'Dumagat',
            'remontado': 'Remontado',
            'ifugao': 'Ifugao',
            'kalinga': 'Kalinga',
            'kankanaey': 'Kankanaey',
            'ibaloi': 'Ibaloi',
            'bontoc': 'Bontoc',
            'isneg': 'Isneg (Apayao)',
            'tinggian': 'Tinggian',
            'karao': 'Karao',
            'hanunoo': 'Hanunoo',
            'iraya-manobo': 'Iraya Manobo',
            'panay-bukidnon': 'Panay Bukidnon',
            'suludnon': 'Suludnon',
            'tagbanua': 'Tagbanua',
            'maranao': 'Maranao',
            'maguindanao': 'Maguindanao',
            'tausug': 'Tausug',
            'sama-bajau': 'Sama-Bajau',
            'yakan': 'Yakan',
            'manobo': 'Manobo',
            'bagobo': 'Bagobo',
            'bukidnon': 'Bukidnon',
            'magsaysay': 'Magsaysay',
            'mandaya': 'Mandaya',
            'mansaka': 'Mansaka',
            'maragusan': 'Maragusan',
            'tboli': 'T\'boli'
        };

        const normalizeGender = (value) => {
            const gender = String(value || '').trim().toLowerCase();
            if (gender === 'male' || gender === 'm') return 'male';
            if (gender === 'female' || gender === 'f') return 'female';
            return '';
        };

        const normalizeIpGroup = (value) => {
            const raw = String(value || '').trim().toLowerCase();
            if (!raw || raw === 'none') return '';
            return ipGroupMapping[raw] || raw.charAt(0).toUpperCase() + raw.slice(1);
        };

        const getStudentName = (student) => {
            const firstName = (student.first_name || student.firstName || '').toString().trim();
            const lastName = (student.last_name || student.lastName || '').toString().trim();
            const fullName = `${lastName}, ${firstName}`.replace(/^,\s*|,\s*$/g, '').trim();
            return fullName || (student.fullName || student.full_name || '--').toString().trim();
        };

        const escape = (value) => String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

        const studentsWithIP = allStudents.map(student => ({
            ...student,
            _gender: normalizeGender(student.gender),
            _ipGroup: normalizeIpGroup(student.ip_group || student.ip || student.ip_status || student.indigenous || student.isIP),
            _printName: getStudentName(student)
        })).filter(student => !!student._ipGroup);

        const filteredStudents = studentsWithIP.filter(student => {
            const selectedGenders = Array.isArray(selectedFilter.genders) ? selectedFilter.genders : [];
            const selectedGroups = Array.isArray(selectedFilter.ipGroups) ? selectedFilter.ipGroups : [];
            const passGender = selectedFilter.restrictGender ? selectedGenders.includes(student._gender) : true;
            const passGroup = selectedFilter.restrictGroup ? selectedGroups.includes(student._ipGroup) : true;
            return passGender && passGroup;
        }).sort((a, b) => a._printName.localeCompare(b._printName));

        const maleStudents = filteredStudents.filter(s => s._gender === 'male');
        const femaleStudents = filteredStudents.filter(s => s._gender === 'female');

        const renderGroupTable = (label, students) => {
            const rows = students.map((student, index) => {
                const lrn = student.lrn || student.student_lrn || student.id || '--';
                return `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${escape(lrn)}</td>
                        <td>${escape(student._printName)}</td>
                    </tr>
                `;
            }).join('');

            return `
                <h3>${escape(label)} (${students.length})</h3>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 60px;">#</th>
                            <th style="width: 180px;">LRN</th>
                            <th>Student Name</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows || '<tr><td colspan="3" class="no-data">No students found</td></tr>'}
                    </tbody>
                </table>
            `;
        };

        const showMaleGroup = !selectedFilter.restrictGender || (Array.isArray(selectedFilter.genders) && selectedFilter.genders.includes('male'));
        const showFemaleGroup = !selectedFilter.restrictGender || (Array.isArray(selectedFilter.genders) && selectedFilter.genders.includes('female'));

        const groupLabel = selectedFilter.restrictGroup && Array.isArray(selectedFilter.ipGroups) && selectedFilter.ipGroups.length > 0
            ? selectedFilter.ipGroups.join(', ')
            : 'All IP Groups';

        const sections = [];
        sections.push(`<h2>Indigenous Report - ${escape(selectedFilter.label || `Overall + ${groupLabel}`)}</h2>`);
        sections.push(`<div style="margin-bottom: 14px; font-size: 12px; color: #666;">Total Students: <strong>${filteredStudents.length}</strong> | IP Groups: <strong>${escape(groupLabel)}</strong></div>`);

        if (showMaleGroup) sections.push(renderGroupTable('Male Students', maleStudents));
        if (showFemaleGroup) sections.push(renderGroupTable('Female Students', femaleStudents));

        sections.push(`
            <div style="margin-top: 14px; font-size: 12px;">
                <strong>Totals:</strong>
                Male: ${maleStudents.length} | Female: ${femaleStudents.length} | Overall: ${filteredStudents.length}
            </div>
        `);

        printableReportHtml = sections.join('');
    }

    if (reportType === '4ps') {
        const allStudents = Array.isArray(window.currentReportStudents) ? window.currentReportStudents : [];
        const selectedFilter = selectedPrintFilter || { type: 'combined', label: 'Overall + All Grades', genders: ['male', 'female'], grades: [], restrictGender: false, restrictGrade: false };

        const normalizeGender = (value) => {
            const gender = String(value || '').trim().toLowerCase();
            if (gender === 'male' || gender === 'm') return 'male';
            if (gender === 'female' || gender === 'f') return 'female';
            return '';
        };

        const has4Ps = (student) => {
            const value = String(student.four_ps_status || student['4ps'] || '').trim().toLowerCase();
            return value === 'yes' || value === 'true' || value === '1';
        };

        const getStudentName = (student) => {
            const firstName = (student.first_name || student.firstName || '').toString().trim();
            const lastName = (student.last_name || student.lastName || '').toString().trim();
            const fullName = `${lastName}, ${firstName}`.replace(/^,\s*|,\s*$/g, '').trim();
            return fullName || (student.fullName || student.full_name || '--').toString().trim();
        };

        const escape = (value) => String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

        const studentsWith4Ps = allStudents.map(student => ({
            ...student,
            _gender: normalizeGender(student.gender),
            _grade: String(student.grade_level || student.grade || '').trim(),
            _printName: getStudentName(student)
        })).filter(student => has4Ps(student));

        const filteredStudents = studentsWith4Ps.filter(student => {
            const selectedGenders = Array.isArray(selectedFilter.genders) ? selectedFilter.genders : [];
            const selectedGrades = Array.isArray(selectedFilter.grades) ? selectedFilter.grades : [];
            const passGender = selectedFilter.restrictGender ? selectedGenders.includes(student._gender) : true;
            const passGrade = selectedFilter.restrictGrade ? selectedGrades.includes(student._grade) : true;
            return passGender && passGrade;
        }).sort((a, b) => a._printName.localeCompare(b._printName));

        const maleStudents = filteredStudents.filter(s => s._gender === 'male');
        const femaleStudents = filteredStudents.filter(s => s._gender === 'female');

        const renderGroupTable = (label, students) => {
            const rows = students.map((student, index) => {
                const lrn = student.lrn || student.student_lrn || student.id || '--';
                return `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${escape(lrn)}</td>
                        <td>${escape(student._printName)}</td>
                    </tr>
                `;
            }).join('');

            return `
                <h3>${escape(label)} (${students.length})</h3>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 60px;">#</th>
                            <th style="width: 180px;">LRN</th>
                            <th>Student Name</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows || '<tr><td colspan="3" class="no-data">No students found</td></tr>'}
                    </tbody>
                </table>
            `;
        };

        const gradeLabel = selectedFilter.restrictGrade && Array.isArray(selectedFilter.grades) && selectedFilter.grades.length > 0
            ? `Grade ${selectedFilter.grades.join(', Grade ')}`
            : 'All Grades';

        const showMaleGroup = !selectedFilter.restrictGender || (Array.isArray(selectedFilter.genders) && selectedFilter.genders.includes('male'));
        const showFemaleGroup = !selectedFilter.restrictGender || (Array.isArray(selectedFilter.genders) && selectedFilter.genders.includes('female'));

        const sections = [];
        sections.push(`<h2>4Ps Report - ${escape(selectedFilter.label || `Overall + ${gradeLabel}`)}</h2>`);
        sections.push(`<div style="margin-bottom: 14px; font-size: 12px; color: #666;">Total Students: <strong>${filteredStudents.length}</strong> | Grade Scope: <strong>${escape(gradeLabel)}</strong></div>`);

        if (showMaleGroup) sections.push(renderGroupTable('Male Students', maleStudents));
        if (showFemaleGroup) sections.push(renderGroupTable('Female Students', femaleStudents));

        sections.push(`
            <div style="margin-top: 14px; font-size: 12px;">
                <strong>Totals:</strong>
                Male: ${maleStudents.length} | Female: ${femaleStudents.length} | Overall: ${filteredStudents.length}
            </div>
        `);

        printableReportHtml = sections.join('');
    }

    if (reportType === 'mothertongue') {
        const allStudents = Array.isArray(window.currentReportStudents) ? window.currentReportStudents : [];
        const selectedFilter = selectedPrintFilter || { type: 'combined', label: 'Overall + All Mother Tongues', genders: ['male', 'female'], motherTongues: [], restrictGender: false, restrictType: false };

        const motherTongueMapping = {
            'tagalog': 'Tagalog',
            'cebuano': 'Cebuano',
            'ilocano': 'Ilocano',
            'hiligaynon': 'Hiligaynon/Ilonggo',
            'bicolano': 'Bicolano',
            'pangasinan': 'Pangasinan',
            'kapampangan': 'Kapampangan',
            'maranao': 'Maranao',
            'maguindanao': 'Maguindanao',
            'tausug': 'Tausug',
            'waray': 'Waray',
            'masbateno': 'Masbateno',
            'aklanon': 'Aklanon',
            'capiznon': 'Capiznon',
            'romblomanon': 'Romblomanon',
            'antique': 'Antique',
            'sama-bajau': 'Sama-Bajau',
            'maranao-lanao': 'Maranao (Lanao)',
            'maguindanao-cotabato': 'Maguindanao (Cotabato)',
            'subanon': 'Subanon',
            'tiruray': 'Tiruray',
            'subanen': 'Subanen',
            'bukidnon': 'Bukidnon',
            'manobo': 'Manobo',
            'magsaysay': 'Magsaysay',
            'ifugao': 'Ifugao',
            'kalinga': 'Kalinga',
            'kankanaey': 'Kankanaey',
            'ibaloi': 'Ibaloi',
            'bontoc': 'Bontoc',
            'isneg': 'Isneg',
            'tinggian': 'Tinggian',
            'karao': 'Karao',
            'hanunoo': 'Hanunoo',
            'tagbanua': 'Tagbanua',
            'palawano': 'Palawano',
            'batak': 'Batak',
            'molbog': 'Molbog',
            'aeta': 'Aeta',
            'agta': 'Agta',
            'english': 'English',
            'spanish': 'Spanish',
            'chinese': 'Chinese',
            'japanese': 'Japanese',
            'korean': 'Korean',
            'arabic': 'Arabic'
        };

        const normalizeGender = (value) => {
            const gender = String(value || '').trim().toLowerCase();
            if (gender === 'male' || gender === 'm') return 'male';
            if (gender === 'female' || gender === 'f') return 'female';
            return '';
        };

        const normalizeMotherTongue = (value) => {
            const raw = String(value || '').trim().toLowerCase();
            if (!raw || raw === 'none') return '';
            if (raw === 'other') return 'Other (Not Listed)';
            return motherTongueMapping[raw] || raw.charAt(0).toUpperCase() + raw.slice(1);
        };

        const getStudentName = (student) => {
            const firstName = (student.first_name || student.firstName || '').toString().trim();
            const lastName = (student.last_name || student.lastName || '').toString().trim();
            const fullName = `${lastName}, ${firstName}`.replace(/^,\s*|,\s*$/g, '').trim();
            return fullName || (student.fullName || student.full_name || '--').toString().trim();
        };

        const escape = (value) => String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

        const studentsWithMotherTongue = allStudents.map(student => ({
            ...student,
            _gender: normalizeGender(student.gender),
            _motherTongue: normalizeMotherTongue(student.mother_tongue || student.motherTongue || student.language),
            _printName: getStudentName(student)
        })).filter(student => !!student._motherTongue);

        const filteredStudents = studentsWithMotherTongue.filter(student => {
            const selectedGenders = Array.isArray(selectedFilter.genders) ? selectedFilter.genders : [];
            const selectedTypes = Array.isArray(selectedFilter.motherTongues) ? selectedFilter.motherTongues : [];
            const passGender = selectedFilter.restrictGender ? selectedGenders.includes(student._gender) : true;
            const passType = selectedFilter.restrictType ? selectedTypes.includes(student._motherTongue) : true;
            return passGender && passType;
        }).sort((a, b) => a._printName.localeCompare(b._printName));

        const maleStudents = filteredStudents.filter(s => s._gender === 'male');
        const femaleStudents = filteredStudents.filter(s => s._gender === 'female');

        const renderGroupTable = (label, students) => {
            const rows = students.map((student, index) => {
                const lrn = student.lrn || student.student_lrn || student.id || '--';
                return `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${escape(lrn)}</td>
                        <td>${escape(student._printName)}</td>
                    </tr>
                `;
            }).join('');

            return `
                <h3>${escape(label)} (${students.length})</h3>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 60px;">#</th>
                            <th style="width: 180px;">LRN</th>
                            <th>Student Name</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows || '<tr><td colspan="3" class="no-data">No students found</td></tr>'}
                    </tbody>
                </table>
            `;
        };

        const typeLabel = selectedFilter.restrictType && Array.isArray(selectedFilter.motherTongues) && selectedFilter.motherTongues.length > 0
            ? selectedFilter.motherTongues.join(', ')
            : 'All Mother Tongues';

        const showMaleGroup = !selectedFilter.restrictGender || (Array.isArray(selectedFilter.genders) && selectedFilter.genders.includes('male'));
        const showFemaleGroup = !selectedFilter.restrictGender || (Array.isArray(selectedFilter.genders) && selectedFilter.genders.includes('female'));

        const sections = [];
        sections.push(`<h2>Mother Tongue Report - ${escape(selectedFilter.label || `Overall + ${typeLabel}`)}</h2>`);
        sections.push(`<div style="margin-bottom: 14px; font-size: 12px; color: #666;">Total Students: <strong>${filteredStudents.length}</strong> | Mother Tongue Scope: <strong>${escape(typeLabel)}</strong></div>`);

        if (showMaleGroup) sections.push(renderGroupTable('Male Students', maleStudents));
        if (showFemaleGroup) sections.push(renderGroupTable('Female Students', femaleStudents));

        sections.push(`
            <div style="margin-top: 14px; font-size: 12px;">
                <strong>Totals:</strong>
                Male: ${maleStudents.length} | Female: ${femaleStudents.length} | Overall: ${filteredStudents.length}
            </div>
        `);

        printableReportHtml = sections.join('');
    }

    if (reportType === 'track') {
        const allStudents = Array.isArray(window.currentReportStudents) ? window.currentReportStudents : [];
        const selectedFilter = selectedPrintFilter || { type: 'combined', label: 'Overall + All Tracks', genders: ['male', 'female'], tracks: [], restrictGender: false, restrictType: false };

        const normalizeGender = (value) => {
            const gender = String(value || '').trim().toLowerCase();
            if (gender === 'male' || gender === 'm') return 'male';
            if (gender === 'female' || gender === 'f') return 'female';
            return '';
        };

        const normalizeTrack = (value) => {
            const raw = String(value || '').trim().toLowerCase();
            if (!raw || raw === 'none') return '';
            if (raw.includes('academic')) return 'Academic';
            if (raw.includes('techpro')) return 'TechPro';
            if (raw.includes('doorway')) return 'Doorway';
            return raw.charAt(0).toUpperCase() + raw.slice(1);
        };

        const getStudentName = (student) => {
            const firstName = (student.first_name || student.firstName || '').toString().trim();
            const lastName = (student.last_name || student.lastName || '').toString().trim();
            const fullName = `${lastName}, ${firstName}`.replace(/^,\s*|,\s*$/g, '').trim();
            return fullName || (student.fullName || student.full_name || '--').toString().trim();
        };

        const escape = (value) => String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

        const studentsWithTrack = allStudents.map(student => ({
            ...student,
            _gender: normalizeGender(student.gender),
            _track: normalizeTrack(student.track || student.program || student.track_program),
            _printName: getStudentName(student)
        })).filter(student => !!student._track);

        const filteredStudents = studentsWithTrack.filter(student => {
            const selectedGenders = Array.isArray(selectedFilter.genders) ? selectedFilter.genders : [];
            const selectedTypes = Array.isArray(selectedFilter.tracks) ? selectedFilter.tracks : [];
            const passGender = selectedFilter.restrictGender ? selectedGenders.includes(student._gender) : true;
            const passType = selectedFilter.restrictType ? selectedTypes.includes(student._track) : true;
            return passGender && passType;
        }).sort((a, b) => a._printName.localeCompare(b._printName));

        const maleStudents = filteredStudents.filter(s => s._gender === 'male');
        const femaleStudents = filteredStudents.filter(s => s._gender === 'female');

        const renderGroupTable = (label, students) => {
            const rows = students.map((student, index) => {
                const lrn = student.lrn || student.student_lrn || student.id || '--';
                return `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${escape(lrn)}</td>
                        <td>${escape(student._printName)}</td>
                    </tr>
                `;
            }).join('');

            return `
                <h3>${escape(label)} (${students.length})</h3>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 60px;">#</th>
                            <th style="width: 180px;">LRN</th>
                            <th>Student Name</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows || '<tr><td colspan="3" class="no-data">No students found</td></tr>'}
                    </tbody>
                </table>
            `;
        };

        const typeLabel = selectedFilter.restrictType && Array.isArray(selectedFilter.tracks) && selectedFilter.tracks.length > 0
            ? selectedFilter.tracks.join(', ')
            : 'All Tracks';

        const showMaleGroup = !selectedFilter.restrictGender || (Array.isArray(selectedFilter.genders) && selectedFilter.genders.includes('male'));
        const showFemaleGroup = !selectedFilter.restrictGender || (Array.isArray(selectedFilter.genders) && selectedFilter.genders.includes('female'));

        const sections = [];
        sections.push(`<h2>Track Report - ${escape(selectedFilter.label || `Overall + ${typeLabel}`)}</h2>`);
        sections.push(`<div style="margin-bottom: 14px; font-size: 12px; color: #666;">Total Students: <strong>${filteredStudents.length}</strong> | Track Scope: <strong>${escape(typeLabel)}</strong></div>`);

        if (showMaleGroup) sections.push(renderGroupTable('Male Students', maleStudents));
        if (showFemaleGroup) sections.push(renderGroupTable('Female Students', femaleStudents));

        sections.push(`
            <div style="margin-top: 14px; font-size: 12px;">
                <strong>Totals:</strong>
                Male: ${maleStudents.length} | Female: ${femaleStudents.length} | Overall: ${filteredStudents.length}
            </div>
        `);

        printableReportHtml = sections.join('');
    }

    if (reportType === 'electives') {
        const allStudents = Array.isArray(window.currentReportStudents) ? window.currentReportStudents : [];
        const selectedFilter = selectedPrintFilter || { type: 'combined', label: 'Overall + All Electives', genders: ['male', 'female'], electives: [], restrictGender: false, restrictType: false };

        const normalizeGender = (value) => {
            const gender = String(value || '').trim().toLowerCase();
            if (gender === 'male' || gender === 'm') return 'male';
            if (gender === 'female' || gender === 'f') return 'female';
            return '';
        };

        const getStudentName = (student) => {
            const firstName = (student.first_name || student.firstName || '').toString().trim();
            const lastName = (student.last_name || student.lastName || '').toString().trim();
            const fullName = `${lastName}, ${firstName}`.replace(/^,\s*|,\s*$/g, '').trim();
            return fullName || (student.fullName || student.full_name || '--').toString().trim();
        };

        const escape = (value) => String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

        const selectedTypeKeys = Array.isArray(selectedFilter.electives)
            ? selectedFilter.electives.map(type => String(type || '').trim().toLowerCase()).filter(Boolean)
            : [];

        const studentsWithElectives = allStudents.map(student => {
            const electiveList = Array.isArray(student.electives)
                ? student.electives.map(elective => String(elective || '').trim()).filter(Boolean)
                : [];
            return {
                ...student,
                _gender: normalizeGender(student.gender),
                _printName: getStudentName(student),
                _electives: electiveList,
                _electiveKeys: electiveList.map(elective => elective.toLowerCase())
            };
        }).filter(student => student._electives.length > 0);

        const filteredStudents = studentsWithElectives.filter(student => {
            const selectedGenders = Array.isArray(selectedFilter.genders) ? selectedFilter.genders : [];
            const passGender = selectedFilter.restrictGender ? selectedGenders.includes(student._gender) : true;
            const passType = selectedFilter.restrictType
                ? student._electiveKeys.some(elective => selectedTypeKeys.includes(elective))
                : true;
            return passGender && passType;
        }).sort((a, b) => a._printName.localeCompare(b._printName));

        const maleStudents = filteredStudents.filter(s => s._gender === 'male');
        const femaleStudents = filteredStudents.filter(s => s._gender === 'female');

        const renderGroupTable = (label, students) => {
            const rows = students.map((student, index) => {
                const lrn = student.lrn || student.student_lrn || student.id || '--';
                const electives = student._electives.join(', ');
                return `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${escape(lrn)}</td>
                        <td>${escape(student._printName)}</td>
                        <td>${escape(electives)}</td>
                    </tr>
                `;
            }).join('');

            return `
                <h3>${escape(label)} (${students.length})</h3>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 60px;">#</th>
                            <th style="width: 180px;">LRN</th>
                            <th>Student Name</th>
                            <th>Electives</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows || '<tr><td colspan="4" class="no-data">No students found</td></tr>'}
                    </tbody>
                </table>
            `;
        };

        const typeLabel = selectedFilter.restrictType && Array.isArray(selectedFilter.electives) && selectedFilter.electives.length > 0
            ? selectedFilter.electives.join(', ')
            : 'All Electives';

        const showMaleGroup = !selectedFilter.restrictGender || (Array.isArray(selectedFilter.genders) && selectedFilter.genders.includes('male'));
        const showFemaleGroup = !selectedFilter.restrictGender || (Array.isArray(selectedFilter.genders) && selectedFilter.genders.includes('female'));

        const sections = [];
        sections.push(`<h2>Electives Report - ${escape(selectedFilter.label || `Overall + ${typeLabel}`)}</h2>`);
        sections.push(`<div style="margin-bottom: 14px; font-size: 12px; color: #666;">Total Students: <strong>${filteredStudents.length}</strong> | Elective Scope: <strong>${escape(typeLabel)}</strong></div>`);

        if (showMaleGroup) sections.push(renderGroupTable('Male Students', maleStudents));
        if (showFemaleGroup) sections.push(renderGroupTable('Female Students', femaleStudents));

        sections.push(`
            <div style="margin-top: 14px; font-size: 12px;">
                <strong>Totals:</strong>
                Male: ${maleStudents.length} | Female: ${femaleStudents.length} | Overall: ${filteredStudents.length}
            </div>
        `);

        printableReportHtml = sections.join('');
    }

    // Get customization settings from session storage
    const settings = JSON.parse(sessionStorage.getItem('reportCustomization')) || getDefaultReportSettings();

    // Create a print window
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${reportType.toUpperCase()} Report</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                color: #333;
                line-height: 1.6;
            }
            
            @page {
                margin: 1.5in 1in;
                @bottom-center {
                    content: "Page " counter(page) " of " counter(pages);
                    font-size: 12px;
                }
            }
            
            @media print {
                body { margin: 0; padding: 0; }
                .print-header { page-break-after: avoid; }
                .report-section { page-break-inside: avoid; }
                table { page-break-inside: avoid; }
            }
            
            /* Header Styles */
            .print-header {
                border-bottom: 3px solid #1a73e8;
                padding-bottom: 20px;
                margin-bottom: 30px;
                display: flex;
                align-items: center;
                gap: 20px;
            }
            
            .school-logo {
                width: 80px;
                height: 80px;
                background: #f0f0f0;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 48px;
            }
            
            .school-info {
                flex: 1;
            }
            
            .school-name {
                font-size: 24px;
                font-weight: bold;
                color: #1a1a1a;
                margin-bottom: 5px;
            }
            
            .school-address {
                font-size: 12px;
                color: #666;
                margin-bottom: 10px;
            }
            
            .report-title {
                font-size: 20px;
                font-weight: 600;
                color: #1a73e8;
                margin-bottom: 5px;
            }
            
            .report-date {
                font-size: 11px;
                color: #999;
            }
            
            /* Content Styles */
            .report-content {
                margin: 20px 0;
            }
            
            h2 {
                font-size: 18px;
                color: #1a1a1a;
                margin-bottom: 15px;
                border-bottom: 2px solid #1a73e8;
                padding-bottom: 10px;
            }
            
            h3 {
                font-size: 14px;
                color: #333;
                margin-top: 15px;
                margin-bottom: 10px;
                font-weight: 600;
            }
            
            .report-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 15px;
                margin-bottom: 20px;
            }
            
            .stat-item {
                border: 1px solid #e0e0e0;
                padding: 15px;
                border-radius: 4px;
                text-align: center;
            }
            
            .stat-label {
                display: block;
                font-size: 12px;
                color: #666;
                margin-bottom: 8px;
            }
            
            .stat-value {
                display: block;
                font-size: 28px;
                font-weight: bold;
                color: #1a73e8;
            }
            
            /* Table Styles */
            table {
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
                background: white;
            }
            
            thead {
                background: #1a73e8;
                color: white;
            }
            
            th {
                padding: 12px;
                text-align: left;
                font-weight: 600;
                font-size: 12px;
            }
            
            td {
                padding: 10px 12px;
                border-bottom: 1px solid #e0e0e0;
                font-size: 12px;
            }
            
            tbody tr:nth-child(even) {
                background-color: #f9f9f9;
            }
            
            tbody tr:hover {
                background-color: #f0f7ff;
            }
            
            /* Footer Styles */
            .print-footer {
                margin-top: 40px;
                padding-top: 20px;
                border-top: 2px solid #ddd;
                text-align: center;
                font-size: 11px;
                color: #999;
            }
            
            .official-stamp {
                display: inline-block;
                padding: 10px 20px;
                border: 2px solid #ddd;
                border-radius: 4px;
                margin-top: 20px;
                font-size: 10px;
                color: #666;
            }
            
            .no-data {
                text-align: center;
                padding: 20px;
                color: #999;
            }
        </style>
    </head>
    <body>
        <!-- Header with School Information -->
        <div class="print-header">
            ${settings.includeSchoolLogo ? '<div class="school-logo">🎓</div>' : ''}
            <div class="school-info">
                <div class="school-name">${settings.schoolName}</div>
                ${settings.schoolAddress ? `<div class="school-address">${settings.schoolAddress}</div>` : ''}
                <div class="report-title">${settings.reportTitle}</div>
                ${settings.includeDate ? `<div class="report-date">Generated: ${new Date().toLocaleString()}</div>` : ''}
            </div>
        </div>
        
        <!-- Report Content -->
        <div class="report-content">
            ${printableReportHtml}
        </div>
        
        <!-- Footer -->
        <div class="print-footer">
            <div>${settings.footerText}</div>
            ${settings.showPageNumbers ? '<div style="margin-top: 10px;">Page numbers will appear in print preview</div>' : ''}
            <div class="official-stamp">This is an official document from ${settings.schoolName}</div>
        </div>
    </body>
    </html>
    `);
    
    printWindow.document.close();
    
    // Wait for content to load, then print
    setTimeout(() => {
        printWindow.print();
    }, 250);
}

// Export report as Excel
function exportReportAsExcel(reportType, selectedPrintFilter = null) {
    const reportContent = document.getElementById(`report-${reportType}`);
    if (!reportContent) return;

    const csvEscape = (value) => {
        const text = String(value ?? '').replace(/\r?\n/g, ' ').trim();
        return /[",]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };

    const normalizeGender = (value) => {
        const gender = String(value || '').trim().toLowerCase();
        if (gender === 'male' || gender === 'm') return 'male';
        if (gender === 'female' || gender === 'f') return 'female';
        return '';
    };

    const getStudentName = (student) => {
        const firstName = (student.first_name || student.firstName || '').toString().trim();
        const lastName = (student.last_name || student.lastName || '').toString().trim();
        const fullName = `${lastName}, ${firstName}`.replace(/^,\s*|,\s*$/g, '').trim();
        return fullName || (student.fullName || student.full_name || '--').toString().trim();
    };

    const appendGroupRows = (rows, students, columnsBuilder) => {
        students.forEach((student, index) => {
            const lrn = student.lrn || student.student_lrn || student.id || '--';
            rows.push([index + 1, lrn, student._printName, ...columnsBuilder(student)]);
        });
    };

    const buildFilteredRows = () => {
        const allStudents = Array.isArray(window.currentReportStudents) ? window.currentReportStudents : [];

        if (reportType === 'demographics') {
            const selectedFilter = selectedPrintFilter || window.currentDemographicsFilter || { type: 'all', label: 'Total Overall Students' };
            const filteredStudents = allStudents.filter(student => {
                const gender = normalizeGender(student.gender);
                const gradeLevel = String(student.grade_level || student.grade || '').trim();
                const numericGrade = parseInt(gradeLevel, 10);
                if (selectedFilter.type === 'combined') {
                    const selectedGenders = Array.isArray(selectedFilter.genders) ? selectedFilter.genders : [];
                    const selectedGrades = Array.isArray(selectedFilter.grades) ? selectedFilter.grades.map(String) : [];
                    const passGender = selectedFilter.restrictGender ? selectedGenders.includes(gender) : true;
                    const passGrade = selectedFilter.restrictGrade ? selectedGrades.includes(gradeLevel) : true;
                    return passGender && passGrade;
                }
                if (selectedFilter.type === 'male') return gender === 'male';
                if (selectedFilter.type === 'female') return gender === 'female';
                if (selectedFilter.type === 'grade') return selectedFilter.grade ? gradeLevel === String(selectedFilter.grade) : true;
                if (selectedFilter.type === 'gradeRange') {
                    if (Number.isNaN(numericGrade)) return false;
                    return numericGrade >= Number(selectedFilter.minGrade || 8) && numericGrade <= Number(selectedFilter.maxGrade || 12);
                }
                return true;
            }).map(student => ({
                ...student,
                _gender: normalizeGender(student.gender),
                _grade: String(student.grade_level || student.grade || '').trim(),
                _printName: getStudentName(student)
            })).sort((a, b) => a._printName.localeCompare(b._printName));

            const maleStudents = filteredStudents.filter(s => s._gender === 'male');
            const femaleStudents = filteredStudents.filter(s => s._gender === 'female');
            const showMaleGroup = selectedFilter.type === 'combined'
                ? (!selectedFilter.restrictGender || (Array.isArray(selectedFilter.genders) && selectedFilter.genders.includes('male')))
                : selectedFilter.type !== 'female';
            const showFemaleGroup = selectedFilter.type === 'combined'
                ? (!selectedFilter.restrictGender || (Array.isArray(selectedFilter.genders) && selectedFilter.genders.includes('female')))
                : selectedFilter.type !== 'male';

            const sections = [];
            if (showMaleGroup) sections.push({ label: 'Male Students', students: maleStudents });
            if (showFemaleGroup) sections.push({ label: 'Female Students', students: femaleStudents });

            return { label: selectedFilter.label || 'Total Overall Students', sections, extraHeaders: ['Grade'] };
        }

        if (reportType === 'disability') {
            const selectedFilter = selectedPrintFilter || { type: 'overall', label: 'Overall (Students with Disability)' };
            const disabilityMapping = {
                'blind': 'Blind',
                'low-vision': 'Low Vision',
                'deaf': 'Hearing Impairment',
                'hard-of-hearing': 'Hearing Impairment',
                'autism-spectrum': 'Autism Spectrum Disorder',
                'speech-language': 'Speech/Language Disorder',
                'emotional-behavioral': 'Emotional-Behavioral Disorder',
                'cerebral-palsy': 'Cerebral Palsy',
                'orthopedic-handicap': 'Orthopedic/Physical Handicap',
                'special-health': 'Special Health Problem/Chronic Disease',
                'cancer': 'Cancer',
                'intellectual-disability': 'Intellectual Disability'
            };

            const getDisabilityLabels = (student) => {
                let disabilityTypes = [];
                if (Array.isArray(student.disabilities) && student.disabilities.length > 0) {
                    disabilityTypes = student.disabilities.map(d => String(d || '').trim().toLowerCase()).filter(Boolean);
                } else if (student.disability_status) {
                    const disStatus = String(student.disability_status).trim();
                    if (disStatus && disStatus.length > 0 && disStatus.toLowerCase() !== 'none' && disStatus.toLowerCase() !== 'no') {
                        disabilityTypes = disStatus.split(',').map(d => String(d || '').trim().toLowerCase()).filter(Boolean);
                    }
                }
                return disabilityTypes.map(disType => disabilityMapping[disType] || disType.charAt(0).toUpperCase() + disType.slice(1));
            };

            const studentsWithDisability = allStudents.map(student => ({
                ...student,
                _gender: normalizeGender(student.gender),
                _printName: getStudentName(student),
                _disabilityLabels: getDisabilityLabels(student)
            })).filter(student => student._disabilityLabels.length > 0);

            const filteredStudents = studentsWithDisability.filter(student => {
                if (selectedFilter.type === 'combined') {
                    const selectedGenders = Array.isArray(selectedFilter.genders) ? selectedFilter.genders : [];
                    const selectedTypes = Array.isArray(selectedFilter.disabilityTypes) ? selectedFilter.disabilityTypes : [];
                    const passGender = selectedFilter.restrictGender ? selectedGenders.includes(student._gender) : true;
                    const passType = selectedFilter.restrictType
                        ? selectedTypes.some(type => student._disabilityLabels.includes(type))
                        : true;
                    return passGender && passType;
                }
                if (selectedFilter.type === 'male') return student._gender === 'male';
                if (selectedFilter.type === 'female') return student._gender === 'female';
                if (selectedFilter.type === 'disabilityType') {
                    const wanted = String(selectedFilter.disabilityType || '').trim();
                    return wanted ? student._disabilityLabels.includes(wanted) : true;
                }
                return true;
            }).sort((a, b) => a._printName.localeCompare(b._printName));

            return {
                label: selectedFilter.label || 'Overall (Students with Disability)',
                sections: [{ label: 'Students', students: filteredStudents }],
                extraHeaders: ['Disability Type'],
                extraBuilder: student => [student._disabilityLabels.join('; ')]
            };
        }

        if (reportType === 'indigenous') {
            const selectedFilter = selectedPrintFilter || { type: 'combined', label: 'Overall + All IP Groups', genders: ['male', 'female'], ipGroups: [], restrictGender: false, restrictGroup: false };
            const ipGroupMapping = {
                'aeta': 'Aeta',
                'agta': 'Agta',
                'ati': 'Ati',
                'bugkalot': 'Bugkalot (Ilongot)',
                'dumagat': 'Dumagat',
                'remontado': 'Remontado',
                'ifugao': 'Ifugao',
                'kalinga': 'Kalinga',
                'kankanaey': 'Kankanaey',
                'ibaloi': 'Ibaloi',
                'bontoc': 'Bontoc',
                'isneg': 'Isneg (Apayao)',
                'tinggian': 'Tinggian',
                'karao': 'Karao',
                'hanunoo': 'Hanunoo',
                'iraya-manobo': 'Iraya Manobo',
                'panay-bukidnon': 'Panay Bukidnon',
                'suludnon': 'Suludnon',
                'tagbanua': 'Tagbanua',
                'maranao': 'Maranao',
                'maguindanao': 'Maguindanao',
                'tausug': 'Tausug',
                'sama-bajau': 'Sama-Bajau',
                'yakan': 'Yakan',
                'manobo': 'Manobo',
                'bagobo': 'Bagobo',
                'bukidnon': 'Bukidnon',
                'magsaysay': 'Magsaysay',
                'mandaya': 'Mandaya',
                'mansaka': 'Mansaka',
                'maragusan': 'Maragusan',
                'tboli': 'T\'boli'
            };

            const normalizeIpGroup = (value) => {
                const raw = String(value || '').trim().toLowerCase();
                if (!raw || raw === 'none') return '';
                return ipGroupMapping[raw] || raw.charAt(0).toUpperCase() + raw.slice(1);
            };

            const studentsWithIP = allStudents.map(student => ({
                ...student,
                _gender: normalizeGender(student.gender),
                _ipGroup: normalizeIpGroup(student.ip_group || student.ip || student.ip_status || student.indigenous || student.isIP),
                _printName: getStudentName(student)
            })).filter(student => !!student._ipGroup);

            const filteredStudents = studentsWithIP.filter(student => {
                const selectedGenders = Array.isArray(selectedFilter.genders) ? selectedFilter.genders : [];
                const selectedGroups = Array.isArray(selectedFilter.ipGroups) ? selectedFilter.ipGroups : [];
                const passGender = selectedFilter.restrictGender ? selectedGenders.includes(student._gender) : true;
                const passGroup = selectedFilter.restrictGroup ? selectedGroups.includes(student._ipGroup) : true;
                return passGender && passGroup;
            }).sort((a, b) => a._printName.localeCompare(b._printName));

            const maleStudents = filteredStudents.filter(s => s._gender === 'male');
            const femaleStudents = filteredStudents.filter(s => s._gender === 'female');
            const showMaleGroup = !selectedFilter.restrictGender || (Array.isArray(selectedFilter.genders) && selectedFilter.genders.includes('male'));
            const showFemaleGroup = !selectedFilter.restrictGender || (Array.isArray(selectedFilter.genders) && selectedFilter.genders.includes('female'));

            const sections = [];
            if (showMaleGroup) sections.push({ label: 'Male Students', students: maleStudents });
            if (showFemaleGroup) sections.push({ label: 'Female Students', students: femaleStudents });

            return { label: selectedFilter.label || 'Overall + All IP Groups', sections, extraHeaders: ['IP Group'], extraBuilder: student => [student._ipGroup] };
        }

        if (reportType === '4ps') {
            const selectedFilter = selectedPrintFilter || { type: 'combined', label: 'Overall + All Grades', genders: ['male', 'female'], grades: [], restrictGender: false, restrictGrade: false };
            const has4Ps = (student) => {
                const value = String(student.four_ps_status || student['4ps'] || '').trim().toLowerCase();
                return value === 'yes' || value === 'true' || value === '1';
            };

            const studentsWith4Ps = allStudents.map(student => ({
                ...student,
                _gender: normalizeGender(student.gender),
                _grade: String(student.grade_level || student.grade || '').trim(),
                _printName: getStudentName(student)
            })).filter(student => has4Ps(student));

            const filteredStudents = studentsWith4Ps.filter(student => {
                const selectedGenders = Array.isArray(selectedFilter.genders) ? selectedFilter.genders : [];
                const selectedGrades = Array.isArray(selectedFilter.grades) ? selectedFilter.grades : [];
                const passGender = selectedFilter.restrictGender ? selectedGenders.includes(student._gender) : true;
                const passGrade = selectedFilter.restrictGrade ? selectedGrades.includes(student._grade) : true;
                return passGender && passGrade;
            }).sort((a, b) => a._printName.localeCompare(b._printName));

            const maleStudents = filteredStudents.filter(s => s._gender === 'male');
            const femaleStudents = filteredStudents.filter(s => s._gender === 'female');
            const showMaleGroup = !selectedFilter.restrictGender || (Array.isArray(selectedFilter.genders) && selectedFilter.genders.includes('male'));
            const showFemaleGroup = !selectedFilter.restrictGender || (Array.isArray(selectedFilter.genders) && selectedFilter.genders.includes('female'));

            const sections = [];
            if (showMaleGroup) sections.push({ label: 'Male Students', students: maleStudents });
            if (showFemaleGroup) sections.push({ label: 'Female Students', students: femaleStudents });

            return { label: selectedFilter.label || 'Overall + All Grades', sections, extraHeaders: ['Grade'], extraBuilder: student => [student._grade] };
        }

        if (reportType === 'mothertongue') {
            const selectedFilter = selectedPrintFilter || { type: 'combined', label: 'Overall + All Mother Tongues', genders: ['male', 'female'], motherTongues: [], restrictGender: false, restrictType: false };
            const motherTongueMapping = {
                'tagalog': 'Tagalog',
                'cebuano': 'Cebuano',
                'ilocano': 'Ilocano',
                'hiligaynon': 'Hiligaynon/Ilonggo',
                'bicolano': 'Bicolano',
                'pangasinan': 'Pangasinan',
                'kapampangan': 'Kapampangan',
                'maranao': 'Maranao',
                'maguindanao': 'Maguindanao',
                'tausug': 'Tausug',
                'waray': 'Waray',
                'masbateno': 'Masbateno',
                'aklanon': 'Aklanon',
                'capiznon': 'Capiznon',
                'romblomanon': 'Romblomanon',
                'antique': 'Antique',
                'sama-bajau': 'Sama-Bajau',
                'maranao-lanao': 'Maranao (Lanao)',
                'maguindanao-cotabato': 'Maguindanao (Cotabato)',
                'subanon': 'Subanon',
                'tiruray': 'Tiruray',
                'subanen': 'Subanen',
                'bukidnon': 'Bukidnon',
                'manobo': 'Manobo',
                'magsaysay': 'Magsaysay',
                'ifugao': 'Ifugao',
                'kalinga': 'Kalinga',
                'kankanaey': 'Kankanaey',
                'ibaloi': 'Ibaloi',
                'bontoc': 'Bontoc',
                'isneg': 'Isneg',
                'tinggian': 'Tinggian',
                'karao': 'Karao',
                'hanunoo': 'Hanunoo',
                'tagbanua': 'Tagbanua',
                'palawano': 'Palawano',
                'batak': 'Batak',
                'molbog': 'Molbog',
                'aeta': 'Aeta',
                'agta': 'Agta',
                'english': 'English',
                'spanish': 'Spanish',
                'chinese': 'Chinese',
                'japanese': 'Japanese',
                'korean': 'Korean',
                'arabic': 'Arabic'
            };

            const normalizeMotherTongue = (value) => {
                const raw = String(value || '').trim().toLowerCase();
                if (!raw || raw === 'none') return '';
                if (raw === 'other') return 'Other (Not Listed)';
                return motherTongueMapping[raw] || raw.charAt(0).toUpperCase() + raw.slice(1);
            };

            const studentsWithMotherTongue = allStudents.map(student => ({
                ...student,
                _gender: normalizeGender(student.gender),
                _motherTongue: normalizeMotherTongue(student.mother_tongue || student.motherTongue || student.language),
                _printName: getStudentName(student)
            })).filter(student => !!student._motherTongue);

            const filteredStudents = studentsWithMotherTongue.filter(student => {
                const selectedGenders = Array.isArray(selectedFilter.genders) ? selectedFilter.genders : [];
                const selectedTypes = Array.isArray(selectedFilter.motherTongues) ? selectedFilter.motherTongues : [];
                const passGender = selectedFilter.restrictGender ? selectedGenders.includes(student._gender) : true;
                const passType = selectedFilter.restrictType ? selectedTypes.includes(student._motherTongue) : true;
                return passGender && passType;
            }).sort((a, b) => a._printName.localeCompare(b._printName));

            const maleStudents = filteredStudents.filter(s => s._gender === 'male');
            const femaleStudents = filteredStudents.filter(s => s._gender === 'female');
            const showMaleGroup = !selectedFilter.restrictGender || (Array.isArray(selectedFilter.genders) && selectedFilter.genders.includes('male'));
            const showFemaleGroup = !selectedFilter.restrictGender || (Array.isArray(selectedFilter.genders) && selectedFilter.genders.includes('female'));

            const sections = [];
            if (showMaleGroup) sections.push({ label: 'Male Students', students: maleStudents });
            if (showFemaleGroup) sections.push({ label: 'Female Students', students: femaleStudents });

            return { label: selectedFilter.label || 'Overall + All Mother Tongues', sections, extraHeaders: ['Mother Tongue'], extraBuilder: student => [student._motherTongue] };
        }

        if (reportType === 'track') {
            const selectedFilter = selectedPrintFilter || { type: 'combined', label: 'Overall + All Tracks', genders: ['male', 'female'], tracks: [], restrictGender: false, restrictType: false };
            const normalizeTrack = (value) => {
                const raw = String(value || '').trim().toLowerCase();
                if (!raw || raw === 'none') return '';
                if (raw.includes('academic')) return 'Academic';
                if (raw.includes('techpro')) return 'TechPro';
                if (raw.includes('doorway')) return 'Doorway';
                return raw.charAt(0).toUpperCase() + raw.slice(1);
            };

            const studentsWithTrack = allStudents.map(student => ({
                ...student,
                _gender: normalizeGender(student.gender),
                _track: normalizeTrack(student.track || student.program || student.track_program),
                _printName: getStudentName(student)
            })).filter(student => !!student._track);

            const filteredStudents = studentsWithTrack.filter(student => {
                const selectedGenders = Array.isArray(selectedFilter.genders) ? selectedFilter.genders : [];
                const selectedTypes = Array.isArray(selectedFilter.tracks) ? selectedFilter.tracks : [];
                const passGender = selectedFilter.restrictGender ? selectedGenders.includes(student._gender) : true;
                const passType = selectedFilter.restrictType ? selectedTypes.includes(student._track) : true;
                return passGender && passType;
            }).sort((a, b) => a._printName.localeCompare(b._printName));

            const maleStudents = filteredStudents.filter(s => s._gender === 'male');
            const femaleStudents = filteredStudents.filter(s => s._gender === 'female');
            const showMaleGroup = !selectedFilter.restrictGender || (Array.isArray(selectedFilter.genders) && selectedFilter.genders.includes('male'));
            const showFemaleGroup = !selectedFilter.restrictGender || (Array.isArray(selectedFilter.genders) && selectedFilter.genders.includes('female'));

            const sections = [];
            if (showMaleGroup) sections.push({ label: 'Male Students', students: maleStudents });
            if (showFemaleGroup) sections.push({ label: 'Female Students', students: femaleStudents });

            return { label: selectedFilter.label || 'Overall + All Tracks', sections, extraHeaders: ['Track'], extraBuilder: student => [student._track] };
        }

        if (reportType === 'electives') {
            const selectedFilter = selectedPrintFilter || { type: 'combined', label: 'Overall + All Electives', genders: ['male', 'female'], electives: [], restrictGender: false, restrictType: false };
            const selectedTypeKeys = Array.isArray(selectedFilter.electives)
                ? selectedFilter.electives.map(type => String(type || '').trim().toLowerCase()).filter(Boolean)
                : [];

            const studentsWithElectives = allStudents.map(student => {
                const electiveList = Array.isArray(student.electives)
                    ? student.electives.map(elective => String(elective || '').trim()).filter(Boolean)
                    : [];
                return {
                    ...student,
                    _gender: normalizeGender(student.gender),
                    _printName: getStudentName(student),
                    _electives: electiveList,
                    _electiveKeys: electiveList.map(elective => elective.toLowerCase())
                };
            }).filter(student => student._electives.length > 0);

            const filteredStudents = studentsWithElectives.filter(student => {
                const selectedGenders = Array.isArray(selectedFilter.genders) ? selectedFilter.genders : [];
                const passGender = selectedFilter.restrictGender ? selectedGenders.includes(student._gender) : true;
                const passType = selectedFilter.restrictType
                    ? student._electiveKeys.some(elective => selectedTypeKeys.includes(elective))
                    : true;
                return passGender && passType;
            }).sort((a, b) => a._printName.localeCompare(b._printName));

            const maleStudents = filteredStudents.filter(s => s._gender === 'male');
            const femaleStudents = filteredStudents.filter(s => s._gender === 'female');
            const showMaleGroup = !selectedFilter.restrictGender || (Array.isArray(selectedFilter.genders) && selectedFilter.genders.includes('male'));
            const showFemaleGroup = !selectedFilter.restrictGender || (Array.isArray(selectedFilter.genders) && selectedFilter.genders.includes('female'));

            const sections = [];
            if (showMaleGroup) sections.push({ label: 'Male Students', students: maleStudents });
            if (showFemaleGroup) sections.push({ label: 'Female Students', students: femaleStudents });

            return { label: selectedFilter.label || 'Overall + All Electives', sections, extraHeaders: ['Electives'], extraBuilder: student => [student._electives.join('; ')] };
        }

        return null;
    };

    const filteredModel = buildFilteredRows();

    if (filteredModel) {
        const rows = [];
        rows.push([`Report: ${reportType}`]);
        rows.push([`Generated: ${new Date().toLocaleString()}`]);
        rows.push([`Filter: ${filteredModel.label || 'All'}`]);
        rows.push([]);

        const headers = ['#', 'LRN', 'Student Name', ...(filteredModel.extraHeaders || [])];
        const extraBuilder = typeof filteredModel.extraBuilder === 'function' ? filteredModel.extraBuilder : (() => []);
        let overallCount = 0;

        (filteredModel.sections || []).forEach((section, sectionIndex) => {
            if (sectionIndex > 0) rows.push([]);
            rows.push([section.label]);
            rows.push(headers);
            appendGroupRows(rows, section.students || [], extraBuilder);
            if (!section.students || section.students.length === 0) {
                rows.push(['', '', 'No students found']);
            }
            rows.push(['', '', `Total: ${(section.students || []).length}`]);
            overallCount += (section.students || []).length;
        });

        rows.push([]);
        rows.push(['Overall Total', overallCount]);

        const csv = rows.map(row => row.map(csvEscape).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${reportType}-report.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showNotification('Report exported as Excel CSV', 'success');
        return;
    }

    const tables = reportContent.querySelectorAll('table');
    
    // Simple CSV export
    let csv = `Report: ${reportType}\nGenerated: ${new Date().toLocaleString()}\n\n`;
    
    tables.forEach((table, index) => {
        if (index > 0) csv += '\n\n';
        
        table.querySelectorAll('tr').forEach(row => {
            const cells = row.querySelectorAll('td, th');
            csv += Array.from(cells).map(cell => {
                const text = cell.textContent.trim();
                return csvEscape(text);
            }).join(',') + '\n';
        });
    });

    // Create download link
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportType}-report.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    showNotification('Report exported as Excel CSV', 'success');
}

// Resilient fetch: try several API base candidates until one succeeds
async function apiFetch(path, opts = {}, timeout = 4000) {
    let requestPath = String(path || '');
    const isApiPath = requestPath.startsWith('/api/');
    const effectiveSchoolCode = (() => {
        const current = String(activeSchoolCode || '').trim().toLowerCase();
        if (current) return current;
        try {
            const detected = String(detectSchoolCode() || '').trim().toLowerCase();
            if (detected) {
                activeSchoolCode = detected;
                localStorage.setItem('sms.selectedSchoolCode', detected);
                localStorage.setItem('sms.selectedTenantCode', detected);
            }
            return detected;
        } catch (_err) {
            return '';
        }
    })();

    if (isApiPath && effectiveSchoolCode) {
        try {
            const urlObj = new URL(requestPath, window.location.origin);
            urlObj.searchParams.set('school', effectiveSchoolCode);
            requestPath = `${urlObj.pathname}${urlObj.search}`;
        } catch (_err) {}
    }

    const token = (() => {
        try {
            return String(localStorage.getItem('adminAuthToken') || '').trim();
        } catch (_err) {
            return '';
        }
    })();

    const mergedHeaders = {
        ...(opts.headers || {}),
        ...(isApiPath && effectiveSchoolCode ? { 'x-tenant-code': effectiveSchoolCode } : {}),
        ...(!opts.headers || !opts.headers.Authorization ? (token ? { Authorization: `Bearer ${token}` } : {}) : {})
    };

    const baseOpts = Object.assign({ credentials: 'include' }, opts, { headers: mergedHeaders });

    const candidates = ['']; // same-origin first (prevents stale-port cross-server calls)
    if (API_BASE) candidates.push(API_BASE);
    if (BACKEND_ORIGIN) candidates.push(BACKEND_ORIGIN);

    const unique = [];
    const seen = new Set();
    for (const c of candidates) {
        if (!c && c !== '') continue;
        const key = c === '' ? 'REL' : c;
        if (!seen.has(key)) { seen.add(key); unique.push(c); }
    }

    async function tryFetch(url) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        try {
            const res = await fetch(url, Object.assign({}, baseOpts, { signal: controller.signal }));
            clearTimeout(id);
            return res;
        } catch (err) {
            clearTimeout(id);
            throw err;
        }
    }

    for (const base of unique) {
        try {
            const url = (base === '' || base === undefined) ? requestPath : `${base.replace(/\/$/, '')}${requestPath.startsWith('/') ? requestPath : '/' + requestPath}`;
            console.log('[apiFetch] Trying', url);
            const res = await tryFetch(url);
            if (isApiPath) {
                const contentType = String(res.headers.get('content-type') || '').toLowerCase();
                const looksLikeHtmlFallback = res.status === 200 && contentType.includes('text/html');
                if (looksLikeHtmlFallback) {
                    throw new Error('Received HTML fallback for API path');
                }
            }
            // Return on any HTTP response (caller will inspect res.ok if needed)
            API_BASE = base === undefined ? API_BASE : base; // update API_BASE to working base
            return res;
        } catch (err) {
            console.warn('[apiFetch] candidate failed:', base, err && err.message ? err.message : err);
            continue;
        }
    }

    // Final attempt: try relative path
    try {
        const res = await tryFetch(requestPath.startsWith('/') ? requestPath : '/' + requestPath);
        return res;
    } catch (err) {
        throw new Error('All apiFetch candidates failed');
    }
}
var activeSchoolYearLabel = '--';

// Available subjects will be built from enrollments and filtered per teacher
let AVAILABLE_SUBJECTS = [];

// Determine teacher level from department or name hints
function detectTeacherLevel(teacher) {
    if (!teacher || !teacher.department) return 'unknown';
    const d = (teacher.department || '').toString().toLowerCase();
    if (d.includes('junior') || d.includes('jhs') || d.includes('junior high')) return 'junior';
    if (d.includes('senior') || d.includes('shs') || d.includes('senior high')) return 'senior';
    return 'unknown';
}

// Normalize grade level strings to numeric (e.g., 'Grade 11' -> 11)
function normalizeGradeLevel(g) {
    if (!g && g !== 0) return null;
    const s = String(g).toLowerCase();
    const m = s.match(/(\d{1,2})/);
    if (m) return parseInt(m[1], 10);
    if (s.includes('grade 11') || s.includes('grade11') || s.includes('11')) return 11;
    if (s.includes('grade 12') || s.includes('grade12') || s.includes('12')) return 12;
    return null;
}

// Build subject candidates from enrollment records. Returns {core:Set, academic:Set, techpro:Set, grade11Intersect:Set, grade12Intersect:Set}
async function buildSubjectsFromEnrollments() {
    try {
        let enrollments = Array.isArray(window.allEnrollments) && window.allEnrollments.length ? window.allEnrollments : null;
        if (!enrollments) {
            const resp = await apiFetch('/api/enrollments');
            if (!resp.ok) return null;
            enrollments = await resp.json();
        }

        const core = new Set();
        const academic = new Set();
        const techpro = new Set();

        const grade11SubjectsPerStudent = [];
        const grade12SubjectsPerStudent = [];

        enrollments.forEach(e => {
            let data = e.enrollment_data;
            try { if (typeof data === 'string') data = JSON.parse(data); } catch (er) { /* ignore */ }
            data = data || {};

            // gather subjects from common keys
            const found = new Set();
            const pushIf = v => { if (!v) return; if (Array.isArray(v)) v.forEach(x => x && found.add(String(x).trim())); else found.add(String(v).trim()); };

            pushIf(data.subjects || data.selectedSubjects || data.subjectList || data.academicSubjects);
            pushIf(data.electives || data.elective || data.shs && data.shs.electives);
            pushIf(data.techpro || data.techproSubjects || data.track && data.track.subjects);
            // fallback: scan enrollment_data values for strings that look like subjects (heuristic)
            Object.values(data).forEach(v => {
                if (typeof v === 'string' && v.length > 2 && /[A-Za-z]/.test(v)) {
                    // heuristics: common subject names
                    const low = v.toLowerCase();
                    if (/math|science|english|social|physical|pe|lab|elective|subject|commercial|tech|pro/.test(low)) {
                        found.add(String(v).trim());
                    }
                } else if (Array.isArray(v)) {
                    v.forEach(x => { if (typeof x === 'string') found.add(String(x).trim()); });
                }
            });

            // naive categorization: if enrollment has 'techpro' key, mark those as techpro; if electives field exists mark as academic
            if (data.techpro || (data.track && String(data.track).toLowerCase().includes('techpro'))) {
                found.forEach(s => techpro.add(s));
            } else if (data.electives || data.elective || data.shs || (data.track && String(data.track).toLowerCase().includes('academic'))) {
                found.forEach(s => academic.add(s));
            } else {
                found.forEach(s => core.add(s));
            }

            const grade = normalizeGradeLevel(data.gradeLevel || data.grade || e.grade_level || e.grade);
            const studentSubjects = Array.from(found);
            if (grade === 11) grade11SubjectsPerStudent.push(new Set(studentSubjects));
            if (grade === 12) grade12SubjectsPerStudent.push(new Set(studentSubjects));
        });

        // compute intersection across students for grade 11 and 12
        function intersectSets(arr) {
            if (!arr || arr.length === 0) return new Set();
            const result = new Set(arr[0]);
            for (let i = 1; i < arr.length; i++) {
                for (let v of Array.from(result)) if (!arr[i].has(v)) result.delete(v);
            }
            return result;
        }

        const grade11Intersect = intersectSets(grade11SubjectsPerStudent);
        const grade12Intersect = intersectSets(grade12SubjectsPerStudent);

        return { core, academic, techpro, grade11Intersect, grade12Intersect };
    } catch (err) {
        console.error('buildSubjectsFromEnrollments error', err);
        return null;
    }
}

// Load available subjects tailored to a teacher: applies department and grade-level rules
async function loadAvailableSubjectsForTeacher(teacher) {
    const sets = await buildSubjectsFromEnrollments();
    if (!sets) return [];

    // Start with core subjects and include academic/techpro only if they appear in grade11 or grade12 intersections
    const subjects = new Set();
    sets.core.forEach(s => subjects.add(s));

    // Include academic/techpro that are present in all Grade11 or all Grade12 students (intersection)
    sets.academic.forEach(s => { if (sets.grade11Intersect.has(s) || sets.grade12Intersect.has(s)) subjects.add(s); });
    sets.techpro.forEach(s => { if (sets.grade11Intersect.has(s) || sets.grade12Intersect.has(s)) subjects.add(s); });

    // Filter by teacher department if provided
    const dept = (teacher && teacher.department) ? String(teacher.department).toLowerCase() : '';
    if (dept) {
        // department tokens
        const tokens = dept.split(/[^a-z0-9]+/).filter(Boolean);
        const filtered = new Set();
        subjects.forEach(s => {
            const ls = (s || '').toLowerCase();
            // allow if any token matches subject name (math -> mathematics), or tokens include 'junior'/'senior' (skip)
            let ok = tokens.some(t => ls.includes(t) || (t === 'math' && ls.includes('math')) || (t === 'science' && ls.includes('science')) || (t === 'english' && ls.includes('english')));
            if (ok) filtered.add(s);
        });
        // if department tokens didn't match any subject, fallback to full list
        AVAILABLE_SUBJECTS = filtered.size ? Array.from(filtered) : Array.from(subjects);
    } else {
        AVAILABLE_SUBJECTS = Array.from(subjects);
    }

    // Enforce Junior High rule: Math, Science, English only displayed for Junior High advisers
    const level = detectTeacherLevel(teacher);
    if (level !== 'junior') {
        AVAILABLE_SUBJECTS = AVAILABLE_SUBJECTS.filter(s => {
            const low = (s || '').toLowerCase();
            if (low.includes('math') || low.includes('science') || low.includes('english')) return false;
            return true;
        });
    }

    // Sort alphabetically
    AVAILABLE_SUBJECTS.sort((a,b) => a.localeCompare(b));
    return AVAILABLE_SUBJECTS;
}

// Helper: generate unique id for subject load rows
function genSubjectLoadId() {
    return 'subjectLoad_' + Math.random().toString(36).slice(2, 9);
}

// Add a subject load row (subject dropdown + sections multi-select)
function addSubjectLoadRow(initialSubject) {
    const container = document.getElementById('subjectLoadsContainer');
    if (!container) return;

    const id = genSubjectLoadId();
    const row = document.createElement('div');
    row.className = 'subject-load-row';
    row.id = id;
    row.style = 'display:flex;gap:8px;align-items:flex-start;margin-bottom:8px;';

    // Subject select
    const subjSelect = document.createElement('select');
    subjSelect.className = 'subject-load-subject';
    subjSelect.style = 'min-width:160px;';
    subjSelect.appendChild(new Option('-- Select Subject --', ''));
    // Use AVAILABLE_SUBJECTS (populated per teacher). If empty, trigger a load and populate later.
    if (Array.isArray(AVAILABLE_SUBJECTS) && AVAILABLE_SUBJECTS.length > 0) {
        AVAILABLE_SUBJECTS.forEach(s => subjSelect.appendChild(new Option(s, s)));
    } else {
        // temporary: try to load for current teacher in background
        if (typeof loadAvailableSubjectsForTeacher === 'function') {
            loadAvailableSubjectsForTeacher(window.teacherToAssign || null).then(list => {
                if (Array.isArray(list)) {
                    // find the select inside the row again and populate
                    const sel = document.querySelector('#' + id + ' .subject-load-subject') || subjSelect;
                    list.forEach(s => sel.appendChild(new Option(s, s)));
                }
            }).catch(err => console.error('Failed to load available subjects:', err));
    }
    if (initialSubject) subjSelect.value = initialSubject;

    // Sections multi-select for this subject load
    const secSelect = document.createElement('select');
    secSelect.className = 'subject-load-sections';
    secSelect.multiple = true;
    secSelect.size = 4;
    secSelect.style = 'min-width:260px;';
    secSelect.appendChild(new Option('-- Select Sections (hold Ctrl/Cmd) --', ''));

    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn btn-sm btn-danger';
    removeBtn.textContent = 'Remove';
    removeBtn.onclick = () => { container.removeChild(row); };

    row.appendChild(subjSelect);
    row.appendChild(secSelect);
    row.appendChild(removeBtn);
    container.appendChild(row);

    // Populate sections into this row's sections select
    // Reuse existing loaded section options if available
    const masterTeaching = document.getElementById('assignTeachingSections');
    if (masterTeaching && masterTeaching.options && masterTeaching.options.length > 0) {
        // Clone options
        Array.from(masterTeaching.options).forEach(opt => {
            const clone = new Option(opt.text, opt.value);
            secSelect.appendChild(clone);
        });
    } else {
        // If master not populated yet, trigger a load (async)
        loadSectionsForAssignment().then(() => {
            const master = document.getElementById('assignTeachingSections');
            if (master) Array.from(master.options).forEach(opt => secSelect.appendChild(new Option(opt.text, opt.value)));
        }).catch(err => console.error('Error populating subject load sections:', err));
    }

    return id;
}

// Collect subject loads from rows: [{ subject: 'Math', sections: [1,2] }, ...]
function collectSubjectLoads() {
    const rows = document.querySelectorAll('.subject-load-row');
    const loads = [];
    rows.forEach(row => {
        const subj = row.querySelector('.subject-load-subject');
        const secs = row.querySelector('.subject-load-sections');
        if (!subj || !secs) return;
        const subjectVal = subj.value || '';
        const selectedSecIds = Array.from(secs.selectedOptions || []).map(o => o.value).filter(v => v !== '');
        if (subjectVal && selectedSecIds.length > 0) {
            loads.push({ subject: subjectVal, sections: selectedSecIds.map(id => parseInt(id)) });
        }
    });
    return loads;
}

// Load teachers from API
async function loadTeachersForAdmin() {
    if (typeof window.loadTeachersForAdminV2 === 'function') {
        return window.loadTeachersForAdminV2(false);
    }

    try {
        const debugDiv = document.getElementById('teacherDebugInfo');
        const debugText = document.getElementById('teacherDebugText');
        
        const updateDebug = (msg) => {
            console.log('[loadTeachersForAdmin]', msg);
            if (debugText) debugText.textContent = msg;
            if (debugDiv) debugDiv.style.display = 'block';
        };
        
        updateDebug(`Fetching from API_BASE: ${API_BASE}`);
        
        const tbody = document.getElementById('teachersTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="9" class="no-data">Loading teachers...</td></tr>';
        }
        
        console.log('[loadTeachersForAdmin] STARTING - API_BASE:', API_BASE);
        console.log('[loadTeachersForAdmin] Fetching from /api/teacher-auth/list...');
        
        const res = await apiFetch('/api/teacher-auth/list');
        
        console.log('[loadTeachersForAdmin] API response received:', { ok: res.ok, status: res.status });
        updateDebug(`API response: ${res.status} ${res.statusText}`);
        
        if (!res.ok) {
            const errText = await res.text();
            console.error('[loadTeachersForAdmin] API error:', errText);
            updateDebug(`API Error: ${res.status} ${res.statusText} - ${errText}`);
            if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="no-data" style="color: red;">Error: ${res.status} ${res.statusText}</td></tr>`;
            showNotification(`Failed to load teachers: ${res.status}`, 'error');
            return;
        }

        const data = await res.json();
        console.log('[loadTeachersForAdmin] API response data:', data);
        updateDebug(`Received data: ${JSON.stringify(data).substring(0, 100)}...`);
        
            // Accept multiple possible response shapes: { teachers: [...] }, { rows: [...] }, or plain array
            if (data && Array.isArray(data.teachers) && data.teachers.length > 0) {
                allTeachers = data.teachers;
            } else if (data && Array.isArray(data.rows) && data.rows.length > 0) {
                allTeachers = data.rows;
            } else if (Array.isArray(data) && data.length > 0) {
                allTeachers = data;
            } else {
                allTeachers = (data && Array.isArray(data.teachers)) ? data.teachers : [];
            }
            console.log('[loadTeachersForAdmin] Loaded', allTeachers.length, 'teachers. Sample:', allTeachers.slice(0,5).map(t => ({ id: t.id, name: t.name, email: t.email })));
            if (!allTeachers || allTeachers.length === 0) {
                console.warn('[loadTeachersForAdmin] API returned no teachers. Full response payload:', data);
            }
        updateDebug(`Parsed ${allTeachers.length} teachers from response`);
        
        if (allTeachers.length === 0) {
            console.warn('[loadTeachersForAdmin] No teachers in response');
            updateDebug('No teachers found - showing empty state');
            if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="no-data">No teachers found</td></tr>';
        }
        
        console.log('[loadTeachersForAdmin] Filtering teachers...');
        updateDebug('Displaying teachers...');
        // Clear UI filters to ensure results are visible on initial load
        try {
            const searchEl = document.getElementById('teacherSearchInput');
            const roleEl = document.getElementById('teacherRoleFilter');
            const sortEl = document.getElementById('teacherSortBy');
            if (searchEl) searchEl.value = '';
            if (roleEl) roleEl.value = '';
            if (sortEl) sortEl.value = 'created_at';
            console.log('[loadTeachersForAdmin] Cleared search/role/sort UI filters before rendering');
        } catch (e) { console.warn('[loadTeachersForAdmin] Could not reset UI filters', e); }
        const preFilterCount = allTeachers ? allTeachers.length : 0;
        console.log('[loadTeachersForAdmin] Teachers before filter:', preFilterCount);
        filterTeachers();
        console.log('[loadTeachersForAdmin] Teachers after filter:', (filteredTeachers || []).length);
        try { renderTeachingAssignmentsTeacherTables(); } catch (e) { console.warn('[loadTeachersForAdmin] render TA tables failed', e); }

        // Enrich teacher rows asynchronously so the table doesn't stay stuck on loading.
        Promise.resolve().then(async () => {
            try {
                console.log('[loadTeachersForAdmin] Loading section assignments (background)...');
                updateDebug('Loading section assignments...');
                await loadSectionAssignmentsForTeachers();
            } catch (e) {
                console.warn('[loadTeachersForAdmin] loadSectionAssignmentsForTeachers failed', e);
            }

            try {
                console.log('[loadTeachersForAdmin] Loading subject assignments (background)...');
                await loadSubjectAssignmentsForTeachers();
            } catch (e) {
                console.warn('[loadTeachersForAdmin] loadSubjectAssignmentsForTeachers failed', e);
            }

            try {
                updateDebug('Refreshing teachers with assignments...');
                filterTeachers();
                renderTeachingAssignmentsTeacherTables();
            } catch (e) {
                console.warn('[loadTeachersForAdmin] Background re-render failed', e);
            }
        });
        
        // Hide debug info after successful load
        setTimeout(() => {
            if (debugDiv) debugDiv.style.display = 'none';
        }, 3000);
        
        console.log('[loadTeachersForAdmin] COMPLETE');
    } catch (err) {
        console.error('[loadTeachersForAdmin] EXCEPTION:', err);
        const debugDiv = document.getElementById('teacherDebugInfo');
        const debugText = document.getElementById('teacherDebugText');
        const errMsg = err.message || err.toString();
        if (debugText) debugText.textContent = `Error: ${errMsg}`;
        if (debugDiv) debugDiv.style.display = 'block';
        
        const tbody = document.getElementById('teachersTableBody');
        if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="no-data" style="color: red;">Error loading teachers</td></tr>`;
        showNotification('Error loading teachers: ' + errMsg, 'error');
    }
}

// Load section assignments for advisers
async function loadSectionAssignmentsForTeachers() {
    try {
        console.log('[loadSectionAssignmentsForTeachers] Loading section assignments for', allTeachers.length, 'teachers');
        console.log('[loadSectionAssignmentsForTeachers] Teacher IDs:', allTeachers.map(t => ({ id: t.id, name: t.name, role: t.role })));
        // Fetch teacher assignments (teacher_section_assignments) for each teacher in parallel
        try {
            const promises = allTeachers.map(teacher =>
                apiFetch(`/api/teacher-auth/sections/${teacher.id}`)
                    .then(res => res.ok ? res.json() : { assignments: [] })
                    .then(data => ({ teacher_id: teacher.id, assignments: data.assignments || [] }))
                    .catch(err => {
                        console.error(`[loadSectionAssignmentsForTeachers] Error fetching sections for teacher ${teacher.id}:`, err);
                        return { teacher_id: teacher.id, assignments: [] };
                    })
            );

            const results = await Promise.all(promises);
            console.log('[loadSectionAssignmentsForTeachers] Received assignment results for all teachers');

            results.forEach(result => {
                const teacher = allTeachers.find(t => t.id === result.teacher_id);
                if (!teacher) return;
                if (result.assignments && result.assignments.length > 0) {
                    // Store ALL assignments (not just the first one) for multi-section support
                    teacher.assigned_sections = result.assignments.map(a => ({
                        section_id: a.section_id,
                        section_code: a.section_code,
                        section_name: a.section_name,
                        school_year: a.school_year
                    }));
                    console.log(`[loadSectionAssignmentsForTeachers] ${teacher.name} assigned to ${result.assignments.length} section(s): ${result.assignments.map(a => a.section_code).join(', ')}`);
                } else {
                    teacher.assigned_sections = [];
                    console.log(`[loadSectionAssignmentsForTeachers] ${teacher.name} has no assignments`);
                }
            });
        } catch (err) {
            console.error('[loadSectionAssignmentsForTeachers] Error:', err);
        }
    } catch (err) {
        console.error('[loadSectionAssignmentsForTeachers] Error:', err);
    }
}

// Filter and display teachers
function filterTeachers() {
    const searchTerm = (document.getElementById('teacherSearchInput')?.value || '').toLowerCase();
    const roleFilter = document.getElementById('teacherRoleFilter')?.value || '';
    const sortBy = document.getElementById('teacherSortBy')?.value || 'created_at';

    console.log('[filterTeachers] Filters applied:', { searchTerm, roleFilter, sortBy, totalTeachers: allTeachers.length });

    let filtered = allTeachers.filter(teacher => {
        // Search filter
        const matchesSearch = !searchTerm ||
            (teacher.name && teacher.name.toLowerCase().includes(searchTerm)) ||
            (teacher.email && teacher.email.toLowerCase().includes(searchTerm)) ||
            (teacher.department && teacher.department.toLowerCase().includes(searchTerm)) ||
            (teacher.teacher_id && teacher.teacher_id.toLowerCase().includes(searchTerm));

        // Role filter
        let matchesRole = true;
        if (roleFilter === 'unassigned') {
            matchesRole = !teacher.role;
        } else if (roleFilter) {
            matchesRole = teacher.role && teacher.role.toLowerCase() === roleFilter.toLowerCase();
        }

        return matchesSearch && matchesRole;
    });

    // Sort
    switch (sortBy) {
        case 'created_at':
            filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            break;
        case 'created_at_desc':
            filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            break;
        case 'name':
            filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            break;
        case 'email':
            filtered.sort((a, b) => (a.email || '').localeCompare(b.email || ''));
            break;
    }

    filteredTeachers = filtered;
    console.log('[filterTeachers] After filtering:', {
        totalFiltered: filtered.length,
        advisers: filtered.filter(t => t.role === 'Adviser').length,
        withSections: filtered.filter(t => t.assigned_sections && t.assigned_sections.length > 0).length
    });
    displayTeachersTable();
}

// Display teachers in table
function displayTeachersTable() {
    const tbody = document.getElementById('teachersTableBody');
    const resultsInfo = document.getElementById('teacherResultsInfo');
    const resultsCount = document.getElementById('teacherResultsCount');

    if (!tbody) return;

    if (filteredTeachers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="no-data">No teachers found</td></tr>';
        if (resultsInfo) resultsInfo.style.display = 'none';
        return;
    }

    tbody.innerHTML = filteredTeachers.map(teacher => {
        const createdDate = new Date(teacher.created_at).toLocaleDateString();
        
        console.log(`[displayTeachersTable] Rendering ${teacher.name}: role="${teacher.role}", assigned_sections=${JSON.stringify(teacher.assigned_sections)}`);
        
        // Format role with proper badge styling
        let roleHtml = '<span style="color: #999;">Not Assigned</span>';
        if (teacher.role) {
            const isAdviserRole = teacher.role.toLowerCase() === 'adviser';
            const roleBgColor = isAdviserRole ? '#e8f5e9' : '#f3e5f5';
            const roleTextColor = isAdviserRole ? '#2e7d32' : '#6a1b9a';
            const displayRole = isAdviserRole ? 'Adviser' : teacher.role;
            roleHtml = `<span style="background: ${roleBgColor}; color: ${roleTextColor}; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600;">${escapeHtml(displayRole)}</span>`;
        }

        // Format assigned sections (support for multiple sections)
        let sectionHtml = '<span style="color: #999;">--</span>';
        const isAdviser = teacher.role && teacher.role.toLowerCase() === 'adviser';
        
        if (isAdviser && teacher.assigned_sections && teacher.assigned_sections.length > 0) {
            // Display all assigned sections as badges
            const sectionBadges = teacher.assigned_sections.map(section => {
                const sectionDisplay = section.section_name || section.section_code || `Section ${section.section_id}`;
                return `<span class="ta-section-chip">${escapeHtml(sectionDisplay)}</span>`;
            }).join('');
            sectionHtml = sectionBadges;
            console.log(`[displayTeachersTable] ${teacher.name} (Adviser): ${teacher.assigned_sections.map(s => s.section_code).join(', ')}`);
        } else if (isAdviser) {
            sectionHtml = '<span style="color: #d32f2f; font-weight: 600;">Not assigned</span>';
            console.log(`[displayTeachersTable] ${teacher.name} (Adviser): No sections assigned`);
        }
        
        return `
            <tr>
                <td>${escapeHtml(teacher.teacher_id)}</td>
                <td>${escapeHtml(teacher.name)}</td>
                <td title="${escapeHtml(teacher.email)}">${escapeHtml(teacher.email)}</td>
                <td>${escapeHtml(teacher.department || '--')}</td>
                <td>${escapeHtml(teacher.phone || '--')}</td>
                <td>${roleHtml}</td>
                <td>${sectionHtml}</td>
                <td>${createdDate}</td>
                <td style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                    <button class="btn btn-sm btn-primary" onclick="openTeacherAssignmentModal(${teacher.id})" title="Assign roles to this teacher">
                        Teaching Assignments
                    </button>
                    ${isAdviser && teacher.assigned_sections && teacher.assigned_sections.length > 0 ? `
                    <button class="btn btn-sm btn-secondary" onclick="openTeacherEditSectionsModal(${teacher.id})" title="Edit section assignments">
                        ✏ Edit
                    </button>
                    ` : ''}
                </td>
            </tr>
        `;
    }).join('');

    if (resultsCount) resultsCount.textContent = filteredTeachers.length;
    if (resultsInfo) resultsInfo.style.display = 'block';
}

// Load sections for assignment dropdown
async function loadSectionsForAssignment() {
    try {
        const advisorySelect = document.getElementById('assignAdvisorySection');
        const teachingSelect = document.getElementById('assignTeachingSections');

        console.log('[loadSectionsForAssignment] Starting - Advisory select present:', !!advisorySelect, '- Teaching select present:', !!teachingSelect);

        if (!activeSchoolYearId) {
            try { await loadActiveSchoolYearForAssignment(); } catch (e) {}
        }

        const endpointsToTry = [];
        if (activeSchoolYearId) endpointsToTry.push(`/api/sections/by-school-year/${activeSchoolYearId}`);
        endpointsToTry.push('/api/sections');

        const parseSectionsPayload = (payload) => {
            if (Array.isArray(payload)) return payload;
            if (Array.isArray(payload?.rows)) return payload.rows;
            if (Array.isArray(payload?.sections)) return payload.sections;
            if (Array.isArray(payload?.data)) return payload.data;
            if (Array.isArray(payload?.result)) return payload.result;
            return [];
        };

        const fetchSectionsFromEndpoint = async (endpoint) => {
            const baseCandidates = [];
            if (API_BASE) baseCandidates.push(API_BASE);
            if (BACKEND_ORIGIN) baseCandidates.push(BACKEND_ORIGIN);
            baseCandidates.push(''); // same-origin

            const tenantCode = String(activeSchoolCode || detectSchoolCode() || '').trim().toLowerCase();

            const seen = new Set();
            const uniqueBases = baseCandidates.filter(base => {
                const key = base || 'REL';
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });

            for (const base of uniqueBases) {
                const url = new URL(
                    base
                        ? `${base.replace(/\/$/, '')}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`
                        : endpoint,
                    window.location.origin
                );
                if (tenantCode) {
                    url.searchParams.set('school', tenantCode);
                }
                try {
                    const res = await fetch(url.toString(), {
                        credentials: 'include',
                        headers: tenantCode ? { 'x-tenant-code': tenantCode } : {}
                    });
                    if (!res.ok) continue;

                    const contentType = (res.headers.get('content-type') || '').toLowerCase();
                    const looksJson = contentType.includes('application/json') || contentType.includes('+json');
                    if (!looksJson) {
                        const bodyText = await res.text();
                        const trimmed = (bodyText || '').trim();
                        if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) {
                            continue;
                        }
                        try {
                            const payload = JSON.parse(trimmed);
                            const parsed = parseSectionsPayload(payload);
                            API_BASE = base || API_BASE;
                            return parsed;
                        } catch (_e) {
                            continue;
                        }
                    }

                    const payload = await res.json();
                    const parsed = parseSectionsPayload(payload);
                    API_BASE = base || API_BASE;
                    return parsed;
                } catch (_err) {
                    continue;
                }
            }
            return [];
        };

        let data = [];
        let lastHttpStatus = null;
        for (const endpoint of endpointsToTry) {
            console.log('[loadSectionsForAssignment] Fetching from endpoint:', endpoint);
            let response = null;
            try {
                response = await apiFetch(endpoint);
            } catch (err) {
                console.warn('[loadSectionsForAssignment] apiFetch failed for', endpoint, '- trying direct fetch:', err && err.message ? err.message : err);
            }

            if (!response || !response.ok) {
                response = await apiFetch(endpoint, { credentials: 'include' });
            }

            if (!response.ok) {
                lastHttpStatus = response.status;
                const directData = await fetchSectionsFromEndpoint(endpoint);
                if (Array.isArray(directData) && directData.length > 0) {
                    data = directData;
                    break;
                }
                continue;
            }

            let parsed = [];
            try {
                const contentType = (response.headers?.get?.('content-type') || '').toLowerCase();
                if (!contentType.includes('application/json') && !contentType.includes('+json')) {
                    const txt = await response.text();
                    const trimmed = (txt || '').trim();
                    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                        parsed = parseSectionsPayload(JSON.parse(trimmed));
                    } else {
                        parsed = [];
                    }
                } else {
                    const payload = await response.json();
                    parsed = parseSectionsPayload(payload);
                }
            } catch (_e) {
                parsed = [];
            }

            if ((!Array.isArray(parsed) || parsed.length === 0)) {
                const directData = await fetchSectionsFromEndpoint(endpoint);
                if (Array.isArray(directData) && directData.length > 0) {
                    data = directData;
                    break;
                }
            }

            if (Array.isArray(parsed) && parsed.length > 0) {
                data = parsed;
                break;
            }

            if (Array.isArray(parsed) && parsed.length === 0) {
                data = parsed;
            }
        }

        if (!Array.isArray(data)) throw new Error('API did not return array');
        if (data.length === 0 && lastHttpStatus) {
            console.warn('[loadSectionsForAssignment] No sections from endpoints. Last HTTP status:', lastHttpStatus);
        }

        data = data.map(section => ({
            ...section,
            id: section.id ?? section.section_id ?? section.sectionId,
            grade_level: section.grade_level ?? section.gradeLevel ?? section.grade ?? section.year_level ?? section.level ?? ''
        })).filter(section => section.id !== null && section.id !== undefined);

        console.log('[loadSectionsForAssignment] Fetched ' + data.length + ' sections');

        window.allSectionsForAdvisory = data;
        window._sectionsCache = data;
        console.log('[loadSectionsForAssignment] Cached', (window._sectionsCache||[]).length, 'sections globally');

        const makeOption = (value, text) => {
            const o = document.createElement('option');
            o.value = value;
            o.text = text;
            return o;
        };

        if (advisorySelect) {
            advisorySelect.innerHTML = '';
            advisorySelect.appendChild(makeOption('', '-- Select Advisory Section --'));
            data.forEach(s => {
                const display = (s.section_name || s.section_code || ('Section ' + s.id));
                advisorySelect.appendChild(makeOption(s.id, display));
            });
            console.log('[loadSectionsForAssignment] Populated advisory select with', data.length, 'sections');
        }

        if (teachingSelect) {
            teachingSelect.innerHTML = '';
            teachingSelect.appendChild(makeOption('', '-- Select Teaching Sections (hold Ctrl/Cmd) --'));
            data.forEach(s => {
                const display = (s.section_name || s.section_code || ('Section ' + s.id));
                teachingSelect.appendChild(makeOption(s.id, display));
            });
            console.log('[loadSectionsForAssignment] Populated teaching select with', data.length, 'sections');
        }

        const advisoryCount = advisorySelect ? advisorySelect.options.length : 0;
        const teachingCount = teachingSelect ? teachingSelect.options.length : 0;
        console.log('[loadSectionsForAssignment] SUCCESS - Advisory options:', advisoryCount, 'Teaching options:', teachingCount, '; cached', (window._sectionsCache||[]).length, 'sections');
        return data;

    } catch (err) {
        console.error('[loadSectionsForAssignment] ERROR:', err);
        return [];
    }
}


// Load active school year and display it in modal (no manual selection)
async function loadActiveSchoolYearForAssignment() {
    try {
        const res = await apiFetch('/api/school-years');
        const years = await res.json();
        
        const active = Array.isArray(years) ? years.find(y => y.is_active) : null;
        if (active) {
            activeSchoolYearId = active.id;
            activeSchoolYearLabel = active.school_year + ' (Active)';
        } else {
            activeSchoolYearId = null;
            activeSchoolYearLabel = '--';
        }

        const disp = document.getElementById('assignSchoolYearDisplay');
        if (disp) disp.textContent = activeSchoolYearLabel;

        console.log('[loadActiveSchoolYearForAssignment] Active school year:', activeSchoolYearId);
    } catch (err) {
        console.error('[loadActiveSchoolYearForAssignment] Error loading school year:', err);
        activeSchoolYearId = null;
        activeSchoolYearLabel = '--';
    }
}

// Open teacher assignment modal
async function openTeacherAssignmentModal(teacherId) {
    const resolvedId = (teacherId && typeof teacherId === 'object')
        ? (teacherId.id ?? teacherId.teacher_id ?? teacherId.user_id)
        : teacherId;

    const numericId = Number(resolvedId);
    const teacherSource = (Array.isArray(allTeachers) && allTeachers.length > 0)
        ? allTeachers
        : ((Array.isArray(window.allTeachers) && window.allTeachers.length > 0) ? window.allTeachers : []);

    const teacher = teacherSource.find(t => {
        const candidate = t.id ?? t.teacher_id ?? t.user_id;
        if (Number.isFinite(numericId)) {
            return Number(candidate) === numericId;
        }
        return String(candidate) === String(resolvedId);
    });

    if (!teacher) {
        showNotification('Teacher not found', 'error');
        return;
    }

    teacherToAssign = teacher;

    // Populate form with teacher info
    document.getElementById('assignTeacherId').value = teacher.id;
    document.getElementById('assignTeacherName').textContent = teacher.name;
    document.getElementById('assignTeacherEmail').textContent = teacher.email;
    document.getElementById('assignTeacherDept').textContent = teacher.department || '--';
    document.getElementById('assignTeacherId2').textContent = teacher.teacher_id;

    // Reset role selection and hide assignment groups
    document.getElementById('assignRole').value = '';
    const advisoryGroup = document.getElementById('advisorySectionGroup');
    const teachingGroup = document.getElementById('teachingSectionsGroup');
    if (advisoryGroup) advisoryGroup.style.display = 'none';
    if (teachingGroup) teachingGroup.style.display = 'none';
    // Clear previous selection values
    const advSelect = document.getElementById('assignAdvisorySection');
    const teachSelect = document.getElementById('assignTeachingSections');
    if (advSelect) { advSelect.innerHTML = '<option value="">-- Select Advisory Section --</option>'; }
    if (teachSelect) { teachSelect.innerHTML = '<option value="">-- Select Teaching Sections (hold Ctrl/Cmd) --</option>'; }

    // hide any previous adviser conflict warnings
    try { const warn = document.getElementById('adviserConflictWarning'); if (warn) warn.style.display = 'none'; } catch (e) {}

    // Load active school year first
    await loadActiveSchoolYearForAssignment();

    // Attempt to load sections (primary path)
    await loadSectionsForAssignment();

    // Load available subjects for this teacher (builds AVAILABLE_SUBJECTS)
    try {
        await loadAvailableSubjectsForTeacher(teacher);
    } catch (err) {
        console.error('Error loading available subjects for teacher:', err);
    }

    // Initialize advisory rows UI and pre-fill any existing assignments
    try {
        ensureAdvisoryRowsInitialized();
        const container = document.getElementById('advisoryRowsContainer');
        if (container) container.innerHTML = '';
        if (Array.isArray(teacher.assigned_sections) && teacher.assigned_sections.length > 0) {
            teacher.assigned_sections.forEach(a => {
                const sid = a.section_id || a.sectionId || a.id;
                const s = (window._sectionsCache || []).find(x => (x.id == sid || x.section_id == sid));
                const grade = s ? (s.grade_level || s.gradeLevel || s.grade || s.year_level || s.level || (function(){ const m = ( (s.section_name||s.section_code||'').match(/(\d{1,2})/)); return m?m[1]:'Unknown';})()) : 'Unknown';
                addAdvisoryRow(grade, { id: sid, display: (a.section_name || a.section_code || ('Section ' + sid)) });
            });
        } else {
            // ensure at least one empty row
            ensureAdvisoryRowsInitialized();
        }
    } catch (e) { console.warn('[openTeacherAssignmentModal] advisory prefill error', e); }

    // Show teacher level (Junior / Senior) prominently in modal
    try {
        const levelEl = document.getElementById('assignTeacherLevel');
        if (levelEl) {
            const lvl = detectTeacherLevel(teacher);
            if (lvl === 'junior') { levelEl.style.display = 'block'; levelEl.textContent = 'Junior High (Adviser / Subject assignments will show Junior-only subjects)'; }
            else if (lvl === 'senior') { levelEl.style.display = 'block'; levelEl.textContent = 'Senior High (Adviser / Subject assignments will show Senior-only subjects)'; }
            else { levelEl.style.display = 'none'; levelEl.textContent = ''; }
        }
    } catch (err) { console.error('Error setting teacher level display:', err); }

    // Show modal
    const modal = document.getElementById('teacherAssignmentModal');
    if (modal) {
        modal.setAttribute('aria-hidden', 'false');
        modal.style.display = 'flex';
        try {
            // Ensure modal and its interactive children are interactive (recover from overlay neutralizer)
            modal.style.pointerEvents = 'auto';
            modal.querySelectorAll('select, button, input, textarea').forEach(el => { el.style.pointerEvents = 'auto'; el.disabled = el.disabled; });
        } catch (e) { /* ignore */ }
    }

    // Apply role UI state (hide/show advisory/teaching groups)
    try { handleAssignRoleChange(document.getElementById('assignRole').value || ''); } catch (e) {}

    // Post-show verification: ensure advisory/teaching selects have options in the live DOM
    try {
        const advisorySelect = document.getElementById('assignAdvisorySection');
        const teachingSelect = document.getElementById('assignTeachingSections');

        const advisoryCount = advisorySelect ? advisorySelect.options.length : 0;
        const teachingCount = teachingSelect ? teachingSelect.options.length : 0;

        console.log('[openTeacherAssignmentModal] options after initial load - advisory:', advisoryCount, 'teaching:', teachingCount);

        // If both selects only contain placeholder, attempt fallback populate
        if ((advisoryCount <= 1) && (teachingCount <= 1)) {
            console.warn('[openTeacherAssignmentModal] Dropdowns still empty; running fallback populate');

            try {
                const endpoint = activeSchoolYearId ? `/api/sections/by-school-year/${activeSchoolYearId}` : '/api/sections';
                const resp = await apiFetch(endpoint);
                if (resp.ok) {
                    const sections = await resp.json();
                    if (Array.isArray(sections) && sections.length) {
                        // Clear and add placeholders
                        if (advisorySelect) { advisorySelect.innerHTML = ''; advisorySelect.add(new Option('-- Select Advisory Section --', ''), 0); }
                        if (teachingSelect) { teachingSelect.innerHTML = ''; teachingSelect.add(new Option('-- Select Teaching Sections (hold Ctrl/Cmd) --', ''), 0); }

                        sections.forEach((s, idx) => {
                            const display = (s.section_name || s.section_code || ('Section ' + s.id));
                            const optA = new Option(display, s.id);
                            const optT = new Option(display, s.id);
                            try { if (advisorySelect) advisorySelect.add(optA); } catch (e) { if (advisorySelect) advisorySelect.appendChild(optA); }
                            try { if (teachingSelect) teachingSelect.add(optT); } catch (e) { if (teachingSelect) teachingSelect.appendChild(optT); }
                            console.log('[openTeacherAssignmentModal] Fallback added', idx + 1, display);
                        });

                        console.log('[openTeacherAssignmentModal] Fallback total options - advisory:', (advisorySelect?advisorySelect.options.length:0), 'teaching:', (teachingSelect?teachingSelect.options.length:0));
                    } else {
                        console.warn('[openTeacherAssignmentModal] Fallback: no sections returned from API');
                    }
                } else {
                    console.error('[openTeacherAssignmentModal] Fallback fetch failed:', resp.status);
                }
            } catch (err) {
                console.error('[openTeacherAssignmentModal] Fallback error:', err);
            }
        }

        // Ensure selects are enabled and visible
        if (advisorySelect) { advisorySelect.disabled = false; advisorySelect.style.visibility = 'visible'; }
        if (teachingSelect) { teachingSelect.disabled = false; teachingSelect.style.visibility = 'visible'; }
    } catch (err) {
        console.error('[openTeacherAssignmentModal] Post-show verification error:', err);
    }
}

// Close teacher assignment modal
function closeTeacherAssignmentModal() {
    const modal = document.getElementById('teacherAssignmentModal');
    if (modal) {
        modal.setAttribute('aria-hidden', 'true');
        modal.style.display = 'none';
    }
    teacherToAssign = null;
}

// Submit teacher role assignment
async function submitTeacherRoleAssignment() {
    const saveBtn = document.getElementById('assignTeacherSaveBtn');
    try {
        if (saveBtn) {
            saveBtn.dataset.trv2Saving = 'true';
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';
        }

        const teacherId = document.getElementById('assignTeacherId').value;
        const role = document.getElementById('assignRole').value;
        const advisorySelect = document.getElementById('assignAdvisorySection');
        const selectedIdsInput = document.getElementById('selectedAdviserSectionIds');

        if (!teacherId || !role) {
            showNotification('Please fill all required fields', 'error');
            return;
        }

        // Collect adviser section IDs from modal state first, then fallback to current select value(s)
        let adviserSectionIds = [];
        if (selectedIdsInput && selectedIdsInput.value) {
            try {
                const parsed = JSON.parse(selectedIdsInput.value);
                if (Array.isArray(parsed)) {
                    adviserSectionIds = parsed
                        .map(item => Number(item && item.id))
                        .filter(id => Number.isFinite(id) && id > 0);
                }
            } catch (parseErr) {
                console.warn('[submitTeacherRoleAssignment] Could not parse selected adviser sections JSON:', parseErr);
            }
        }

        if ((!adviserSectionIds || adviserSectionIds.length === 0) && advisorySelect) {
            adviserSectionIds = Array.from(advisorySelect.selectedOptions || [])
                .map(opt => Number(opt.value))
                .filter(id => Number.isFinite(id) && id > 0);

            if (adviserSectionIds.length === 0) {
                const singleId = Number(advisorySelect.value || '');
                if (Number.isFinite(singleId) && singleId > 0) {
                    adviserSectionIds = [singleId];
                }
            }
        }

        // Use active school year when needed (adviser/section assignments or subject loads)
        const schoolYearId = activeSchoolYearId;
        const subjectLoads = (typeof collectSubjectLoads === 'function') ? collectSubjectLoads() : [];
        const needsSchoolYear = role === 'Adviser' || (Array.isArray(subjectLoads) && subjectLoads.length > 0);
        if (needsSchoolYear && !schoolYearId) {
            showNotification('No active school year is set. Please activate a school year in the School Years tab before assigning advisers.', 'error');
            return;
        }

        // Validation rules per role
        if (role === 'Adviser') {
            if (!adviserSectionIds || adviserSectionIds.length === 0) {
                showNotification('Please select at least one advisory section for Adviser role', 'error');
                return;
            }
        }

        console.log('[submitTeacherRoleAssignment] Submitting assignment...', {
            teacher_id: teacherId,
            role,
            sections: adviserSectionIds,
            school_year_id: schoolYearId
        });

        const roleSections = role === 'Adviser' ? adviserSectionIds : [];

        const payload = {
            teacher_id: parseInt(teacherId),
            role,
            sections: roleSections,
            advisory_section_id: roleSections.length ? roleSections[0] : null,
            advisory_section_ids: roleSections,
            teaching_sections: roleSections,
            subject_loads: Array.isArray(subjectLoads) ? subjectLoads : [],
            school_year_id: schoolYearId ? parseInt(schoolYearId) : null
        };

        const res = await apiFetch('/api/teacher-auth/assign-role', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errData = await res.json();
            showNotification(errData.error || 'Failed to assign role', 'error');
            return;
        }

        const data = await res.json();
        console.log('[submitTeacherRoleAssignment] Success:', data);

        showNotification(`${role} role assigned successfully to ${data.teacher.name}`, 'success');

        try {
            const updatedTeacherId = parseInt(teacherId, 10);
            const normalizedRole = String(role || '').toLowerCase().includes('adviser') ? 'adviser'
                : (String(role || '').toLowerCase().includes('subject') ? 'subject_teacher' : role);
            const teacherStores = [];
            if (Array.isArray(window.allTeachers)) teacherStores.push(window.allTeachers);
            if (typeof allTeachers !== 'undefined' && Array.isArray(allTeachers) && allTeachers !== window.allTeachers) teacherStores.push(allTeachers);

            teacherStores.forEach(store => {
                const idx = store.findIndex(t => Number(t.id || t.teacher_id || t.user_id) === updatedTeacherId);
                if (idx >= 0) {
                    store[idx].role = normalizedRole;
                }
            });

            if (typeof window.trv2RefreshTeacherTable === 'function') {
                window.trv2RefreshTeacherTable();
            }
        } catch (updateErr) {
            console.warn('[submitTeacherRoleAssignment] Failed optimistic role update:', updateErr);
        }

        closeTeacherAssignmentModal();

        try {
            const teacherSection = document.getElementById('teacher-registration');
            if (teacherSection) {
                document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));
                teacherSection.classList.add('active');
            }
            const teacherMenuItem = document.querySelector('.menu-item[data-section="teacher-registration"]');
            if (teacherMenuItem) {
                document.querySelectorAll('.sidebar-menu .menu-item').forEach(node => node.classList.remove('active'));
                teacherMenuItem.classList.add('active');
            }
        } catch (_navErr) {}

        // Wait briefly to ensure DB writes are visible to subsequent list fetch
        await new Promise(resolve => setTimeout(resolve, 350));

        // Prefer v2 refresh path; fallback to legacy loader
        if (typeof window.loadTeachersForAdminV2 === 'function') {
            await window.loadTeachersForAdminV2(true);
        } else if (typeof loadTeachersForAdmin === 'function') {
            await loadTeachersForAdmin();
        }
    } catch (err) {
        console.error('[submitTeacherRoleAssignment] Error:', err);
        showNotification('Error assigning role: ' + err.message, 'error');
    } finally {
        if (saveBtn) {
            saveBtn.dataset.trv2Saving = 'false';
            saveBtn.disabled = false;
            saveBtn.textContent = 'Confirm Assignment';
        }
        if (typeof window.trv2UpdateAssignmentModalState === 'function') {
            try { window.trv2UpdateAssignmentModalState(); } catch (_err) {}
        }
    }
}

// Open teacher edit sections modal
async function openTeacherEditSectionsModal(teacherId) {
    const teacher = allTeachers.find(t => t.id === teacherId);
    if (!teacher) {
        showNotification('Teacher not found', 'error');
        return;
    }

    if (!teacher.assigned_sections || teacher.assigned_sections.length === 0) {
        showNotification('This teacher has no assigned sections yet. Use the Assign button to add sections.', 'error');
        return;
    }

    // Populate form with teacher info
    document.getElementById('editTeacherId').value = teacher.id;
    document.getElementById('editTeacherName').textContent = teacher.name;
    document.getElementById('editTeacherEmail').textContent = teacher.email;
    
    // Set role dropdown value and store original for change detection
    const roleSelect = document.getElementById('editTeacherRole');
    const sectionSelect = document.getElementById('editSectionSelect');
    if (roleSelect) {
        const originalRole = teacher.role || 'Subject Teacher';
        roleSelect.value = originalRole;
        roleSelect.setAttribute('data-original-role', originalRole);
        // Also store on section select for submit handler
        if (sectionSelect) {
            sectionSelect.setAttribute('data-original-role', originalRole);
        }
        
        // Remove any existing listener and attach new one
        roleSelect.removeEventListener('change', handleTeacherRoleChange);
        roleSelect.addEventListener('change', handleTeacherRoleChange);
        console.log('[openTeacherEditSectionsModal] Role listener attached. Original role:', originalRole);
    }
    
    document.getElementById('editSchoolYearDisplay').textContent = activeSchoolYearLabel;

    // Load sections and pre-select currently assigned ones
    await loadSectionsForEdit(teacher);

    // Show modal
    const modal = document.getElementById('editSectionsModal');
    if (modal) {
        modal.setAttribute('aria-hidden', 'false');
        modal.style.display = 'flex';
    }
}

// Load sections for edit modal with pre-selection
async function loadSectionsForEdit(teacher) {
    try {
        const select = document.getElementById('editSectionSelect');
        if (!select) {
            console.error('ERROR: editSectionSelect element not found');
            return;
        }

        // Get current assigned section IDs for pre-selection
        const assignedIds = new Set(teacher.assigned_sections.map(s => s.section_id));

        // Fetch sections
        let endpoint = '/api/sections';
        if (activeSchoolYearId) {
            endpoint = `/api/sections/by-school-year/${activeSchoolYearId}`;
        }

        const response = await apiFetch(endpoint);
        if (!response.ok) throw new Error('HTTP ' + response.status);

        const data = await response.json();
        if (!Array.isArray(data)) throw new Error('API did not return array');

        console.log('[loadSectionsForEdit] Loaded ' + data.length + ' sections');

        // Clear and rebuild options
        select.innerHTML = '';
        
        // Add default placeholder
        const opt0 = document.createElement('option');
        opt0.value = '';
        opt0.text = '-- Select Sections (hold Ctrl/Cmd to select) --';
        select.appendChild(opt0);

        // Add each section and pre-select if already assigned
        for (let i = 0; i < data.length; i++) {
            const s = data[i];
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.text = (s.section_name || s.section_code || ('Section ' + s.id));
            
            // Pre-select if teacher is already assigned to this section
            if (assignedIds.has(s.id)) {
                opt.selected = true;
                console.log('[loadSectionsForEdit] Pre-selected: ' + opt.text);
            }
            
            select.appendChild(opt);
        }

        console.log('[loadSectionsForEdit] SUCCESS - Total options: ' + select.options.length);
    } catch (err) {
        console.error('[loadSectionsForEdit] ERROR:', err);
    }
}

// Close edit sections modal
function closeTeacherEditSectionsModal() {
    const modal = document.getElementById('editSectionsModal');
    if (modal) {
        modal.setAttribute('aria-hidden', 'true');
        modal.style.display = 'none';
    }
}

// Submit teacher section assignments edit
async function submitTeacherEditSections() {
    try {
        const teacherId = document.getElementById('editTeacherId').value;
        const selectElement = document.getElementById('editSectionSelect');
        const roleSelect = document.getElementById('editTeacherRole');
        
        // Get all selected section IDs
        const selectedSections = Array.from(selectElement.selectedOptions || [])
            .map(opt => opt.value)
            .filter(val => val !== '');

        if (!teacherId) {
            showNotification('Teacher not found', 'error');
            return;
        }

        // Get the new role if it's editable
        const newRole = roleSelect ? roleSelect.value : null;
        const originalRole = selectElement.dataset.originalRole || null;

        // Auto-clear sections if switching from Adviser to Subject Teacher
        let clearedSections = false;
        if (originalRole === 'Adviser' && newRole === 'Subject Teacher') {
            if (selectedSections.length > 0) {
                console.log('[submitTeacherEditSections] Role change detected: Adviser → Subject Teacher. Auto-clearing sections.');
                showNotification('Role changed to Subject Teacher. Automatically clearing section assignments.', 'info');
                selectElement.value = '';
                selectedSections.length = 0;
                clearedSections = true;
            }
        }

        // Auto-enable section selection if switching from Subject Teacher to Adviser
        if (originalRole === 'Subject Teacher' && newRole === 'Adviser' && selectedSections.length === 0) {
            showNotification('Role changed to Adviser. Please select at least one advisory section.', 'info');
        }

        // Validation: Subject Teachers should not have section assignments
        if (newRole === 'Subject Teacher' && selectedSections.length > 0) {
            showNotification('Subject Teachers cannot have section assignments. Please clear selections or change role to Adviser.', 'error');
            console.warn('[submitTeacherEditSections] Validation failed: Subject Teacher with section assignments');
            return;
        }

        // Validation: Advisers must have at least one section
        if (newRole === 'Adviser' && selectedSections.length === 0) {
            showNotification('Advisers must have at least one section assigned. Please select sections.', 'error');
            console.warn('[submitTeacherEditSections] Validation failed: Adviser with no sections');
            return;
        }

        const schoolYearId = activeSchoolYearId;
        if (!schoolYearId) {
            showNotification('No active school year is set', 'error');
            return;
        }

        console.log('[submitTeacherEditSections] Updating sections and role...', {
            teacher_id: teacherId,
            sections: selectedSections.map(s => parseInt(s)),
            role: newRole,
            school_year_id: schoolYearId
        });

        // Call the update-sections endpoint (deletes old, adds new, updates role)
        const res = await apiFetch('/api/teacher-auth/update-sections', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                teacher_id: parseInt(teacherId),
                sections: selectedSections.map(s => parseInt(s)),
                role: newRole,
                school_year_id: parseInt(schoolYearId)
            })
        });

        if (!res.ok) {
            const errData = await res.json();
            showNotification(errData.error || 'Failed to update sections', 'error');
            return;
        }

        const data = await res.json();
        console.log('[submitTeacherEditSections] Success:', data);

        showNotification(`Section assignments updated successfully for ${data.teacher.name}`, 'success');
        closeTeacherEditSectionsModal();
        
        // Wait and reload teachers list
        console.log('[submitTeacherEditSections] Waiting 500ms before reloading...');
        await new Promise(resolve => setTimeout(resolve, 500));
        await loadTeachersForAdmin();
    } catch (err) {
        console.error('[submitTeacherEditSections] Error:', err);
        showNotification('Error updating sections: ' + err.message, 'error');
    }
}

// Helper function to escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
}

// End of file (no trailing stubs)



