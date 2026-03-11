
// Ensure required globals
if (typeof API_BASE === 'undefined') {
    var API_BASE = window.location.origin;
}
var currentTeacher = window.currentTeacher || null;
var teachingAssignments = window.teachingAssignments || [];
var allStudents = window.allStudents || [];

// --- BEGIN: tenantFetch implementation ---
function resolveSchoolCode() {
    // ensure school query param persists in URL
    try {
        const existing = new URLSearchParams(window.location.search || '');
        if (!existing.has('school')) {
            let derived = String(existing.get('school') || '').trim().toLowerCase();
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
    } catch (_e) {}
    
    try {
        const params = new URLSearchParams(window.location.search || '');
        const fromQuery = String(params.get('school') || params.get('tenant') || params.get('code') || '').trim().toLowerCase();
        if (fromQuery) return fromQuery;
    } catch (_e) { }
    return String(localStorage.getItem('sms.selectedSchoolCode') || localStorage.getItem('sms.selectedTenantCode') || '').trim().toLowerCase();
}

async function tenantFetch(pathOrUrl, options = {}) {
    const schoolCode = resolveSchoolCode();
    const url = new URL(pathOrUrl, API_BASE || window.location.origin);
    if (schoolCode) {
        url.searchParams.set('school', schoolCode);
    }
    const headers = {
        ...(options.headers || {}),
        ...(schoolCode ? { 'x-tenant-code': schoolCode } : {})
    };
    return fetch(url.toString(), {
        credentials: 'include',
        ...options,
        headers
    });
}
// --- END: tenantFetch implementation ---

async function fetchDashboardData() {
    // Get current teacher from session storage first
    try {
        const teacherDataRaw = sessionStorage.getItem('teacherData') || localStorage.getItem('loggedInUser');
        if (teacherDataRaw) {
            const teacherData = JSON.parse(teacherDataRaw);
            if (teacherData && teacherData.id) {
                currentTeacher = teacherData;
                window.currentTeacher = currentTeacher;
                console.log('[Dashboard] Using teacher from storage:', currentTeacher);
            }
        }
    } catch (e) {
        console.warn('[Dashboard] Error reading teacher data from storage:', e);
    }
    
    // If no teacher in storage, try to fetch from profile API
    if (!currentTeacher) {
        try {
            const profileResp = await tenantFetch('/api/teacher-auth/profile');
            if (profileResp.ok) {
                const profileData = await profileResp.json();
                if (profileData.teacher) {
                    currentTeacher = profileData.teacher;
                    window.currentTeacher = currentTeacher;
                    console.log('[Dashboard] Fetched teacher from profile API:', currentTeacher);
                }
            }
        } catch (e) {
            console.warn('[Dashboard] Profile API failed:', e);
        }
    }
    
    // Fetch teaching assignments if we have a teacher
    if (currentTeacher && currentTeacher.id) {
        if (!Array.isArray(teachingAssignments) || teachingAssignments.length === 0) {
            try {
                const assignResp = await tenantFetch(`/api/teacher-auth/subject-assignments/${currentTeacher.id}`);
                if (assignResp.ok) {
                    const data = await assignResp.json();
                    teachingAssignments = data.assignments || [];
                    window.teachingAssignments = teachingAssignments;
                    console.log('[Dashboard] Teaching assignments loaded:', teachingAssignments);
                }
            } catch (e) {
                console.warn('[Dashboard] Teaching assignments failed:', e);
                teachingAssignments = [];
            }
        }
    }
    
    // Fetch students from enrollments
    if (!Array.isArray(allStudents) || allStudents.length === 0) {
        try {
            const studentsResp = await tenantFetch('/api/enrollments');
            if (studentsResp.ok) {
                const enrollments = await studentsResp.json();
                // Convert enrollments to student format
                allStudents = enrollments.map(enrollment => ({
                    id: enrollment.id,
                    lrn_no: enrollment.lrn_no,
                    lastname: enrollment.lastname,
                    firstname: enrollment.firstname,
                    middle_name: enrollment.middle_name,
                    grade: enrollment.grade_level,
                    section: enrollment.section,
                    full_name: `${enrollment.lastname}, ${enrollment.firstname} ${enrollment.middle_name || ''}`.trim()
                }));
                window.allStudents = allStudents;
                console.log('[Dashboard] Students loaded:', allStudents.length);
            }
        } catch (e) {
            console.warn('[Dashboard] Students failed:', e);
            allStudents = [];
        }
    }
}

// Unified robust dashboard initialization
async function initializeDashboard() {
    try {
        const initialSection = normalizeHashSection(window.location.hash);
        const initialMenuItem = document.querySelector(`.sidebar .menu-item[data-section="${initialSection}"]`);
        if (initialMenuItem) { initialMenuItem.click(); }
        window.addEventListener('hashchange', () => {
            const sectionFromHash = normalizeHashSection(window.location.hash);
            const menuItem = document.querySelector(`.sidebar .menu-item[data-section="${sectionFromHash}"]`);
            if (menuItem && !menuItem.classList.contains('active')) { menuItem.click(); }
        });
        // Load data with debug output
        try {
            await loadTeachingAssignments();
            console.log('[Dashboard] Teaching assignments loaded:', teachingAssignments);
        } catch (e) {
            showDebugInfo('Teaching assignments failed to load.');
            console.error('[Dashboard] Teaching assignments error:', e);
        }
        try {
            await loadAllStudents();
            console.log('[Dashboard] Students loaded:', allStudents);
        } catch (e) {
            showDebugInfo('All students failed to load.');
            console.error('[Dashboard] Students load error:', e);
        }
        try {
            await populateDashboardCards();
        } catch (e) {
            showDebugInfo('Dashboard cards failed to populate.');
            console.error('[Dashboard] Card population error:', e);
        }
        await refreshTeacherNotificationBadge(false);
        setInterval(() => { refreshTeacherNotificationBadge(false).catch(() => {}); }, 15000);
        startRolePollingForSubjectDashboard();
    } catch (error) {
        let debugPanel = document.getElementById('dashboardDebugPanel');
        if (!debugPanel) {
            debugPanel = document.createElement('div');
            debugPanel.id = 'dashboardDebugPanel';
            debugPanel.style = 'background: #fff3cd; color: #856404; border: 1px solid #ffeeba; padding: 12px; margin: 18px 0; border-radius: 8px; font-size: 15px;';
            const sectionList = document.querySelector('#subject-teacher-dashboard .section-list');
            if (sectionList) sectionList.appendChild(debugPanel);
        }
        debugPanel.textContent = 'Dashboard error: ' + (error?.message || error);
        window.location.href = withSchoolParam('teacher-login.html');
    }
}

// Entry point
document.addEventListener('DOMContentLoaded', () => {
    initializeDashboard();
});

// Missing utility functions
function withSchoolParam(url) {
    const schoolCode = resolveSchoolCode();
    if (schoolCode && !url.includes('school=')) {
        const separator = url.includes('?') ? '&' : '?';
        return url + separator + 'school=' + encodeURIComponent(schoolCode);
    }
    return url;
}

function normalizeHashSection(hash) {
    if (!hash || typeof hash !== 'string') return 'subject-teacher-dashboard';
    const clean = hash.replace('#', '').trim();
    return clean || 'subject-teacher-dashboard';
}

function showDebugInfo(message) {
    console.log('[Dashboard Debug]', message);
}

function getCurrentTeacherId() {
    return currentTeacher?.id || null;
}

var rolePollingHandle = null;
var roleSwitchInProgress = false;
var activeSchoolCode = null;
var teacherNotificationCenterReady = false;
var currentSubjectViewing = null;
var lastDisplayedStudents = [];

function detectSchoolCode() {
    return resolveSchoolCode();
}

// Missing applyTeacherInfoToDom function
function applyTeacherInfoToDom() {
    try {
        if (!currentTeacher) {
            console.warn('[Dashboard] No current teacher data available');
            return;
        }

        // Update teacher name display
        const teacherNameDisplay = document.getElementById('teacherNameDisplay');
        if (teacherNameDisplay) {
            teacherNameDisplay.textContent = currentTeacher.name || 'Unknown Teacher';
        }

        // Update teacher role display
        const teacherRoleDisplay = document.getElementById('teacherRoleDisplay');
        if (teacherRoleDisplay) {
            teacherRoleDisplay.textContent = 'Subject Teacher';
        }

        // Update profile name in header
        const teacherProfileName = document.getElementById('teacherProfileName');
        if (teacherProfileName) {
            teacherProfileName.textContent = currentTeacher.name || 'Teacher';
        }

        // Update settings fields if they exist
        const settingsName = document.getElementById('settingsName');
        if (settingsName) {
            settingsName.value = currentTeacher.name || '';
        }

        const settingsEmail = document.getElementById('settingsEmail');
        if (settingsEmail) {
            settingsEmail.value = currentTeacher.email || '';
        }

        const settingsEmployeeId = document.getElementById('settingsEmployeeId');
        if (settingsEmployeeId) {
            settingsEmployeeId.value = currentTeacher.teacher_id || currentTeacher.employee_id || '';
        }

        console.log('[Dashboard] ✅ Teacher info applied to DOM:', currentTeacher.name);
    } catch (error) {
        console.error('[Dashboard] Error applying teacher info to DOM:', error);
    }
}

// Missing notification functions
async function markTeacherNotificationRead(notificationId) {
    const teacherId = getCurrentTeacherId();
    if (!teacherId) throw new Error('Teacher ID not found');
    
    const resp = await tenantFetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST'
    });
    if (!resp.ok) throw new Error('Failed to mark notification as read');
    return resp.json();
}

async function deleteTeacherNotification(notificationId) {
    const teacherId = getCurrentTeacherId();
    if (!teacherId) throw new Error('Teacher ID not found');
    
    const resp = await tenantFetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE'
    });
    if (!resp.ok) throw new Error('Failed to delete notification');
    return resp.json();
}

async function markAllTeacherNotificationsRead() {
    const teacherId = getCurrentTeacherId();
    if (!teacherId) throw new Error('Teacher ID not found');
    
    const resp = await tenantFetch(`/api/notifications/teacher/${teacherId}/read-all`, {
        method: 'POST'
    });
    if (!resp.ok) throw new Error('Failed to mark all notifications as read');
    return resp.json();
}

async function refreshTeacherNotificationBadge(showLoading = true) {
    const badge = document.getElementById('notificationBadge');
    if (!badge) return;
    
    if (showLoading) {
        badge.textContent = '...';
    }
    
    try {
        const teacherId = getCurrentTeacherId();
        if (!teacherId) {
            badge.textContent = '0';
            return;
        }
        
        const resp = await tenantFetch(`/api/notifications/teacher/${teacherId}/unread-count`);
        if (resp.ok) {
            const data = await resp.json();
            const count = data.unreadCount || 0;
            badge.textContent = count;
            badge.style.display = count > 0 ? 'inline-block' : 'none';
        } else {
            badge.textContent = '0';
            badge.style.display = 'none';
        }
    } catch (err) {
        console.error('Error refreshing notification badge:', err);
        badge.textContent = '0';
        badge.style.display = 'none';
    }
}

function showInlineToast(message, type = 'info') {
    // Simple toast implementation
    const toast = document.createElement('div');
    toast.className = `inline-toast inline-toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'};
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        z-index: 10000;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    
    document.body.appendChild(toast);
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 3000);
}

function ensureTeacherNotificationCenterUi() {
    if (teacherNotificationCenterReady) return;
    
    const root = document.createElement('div');
    root.id = 'teacherNotifOverlay';
    root.className = 'teacher-notif-overlay';
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML = `
        <div class="teacher-notif-backdrop" id="teacherNotifBackdrop"></div>
        <div class="teacher-notif-panel" role="dialog" aria-modal="true" aria-labelledby="teacherNotifTitle">
            <div class="teacher-notif-header">
                <div class="teacher-notif-title" id="teacherNotifTitle">Notifications</div>
                <button class="teacher-notif-close" id="teacherNotifClose" aria-label="Close">✕</button>
            </div>
            <div class="teacher-notif-actions">
                <button type="button" class="btn btn-secondary" id="teacherNotifRefresh">Refresh</button>
                <button type="button" class="btn btn-secondary" id="teacherNotifReadAll">Mark all read</button>
            </div>
            <div class="teacher-notif-list" id="teacherNotifList">
                <div class="teacher-notif-empty">Loading notifications...</div>
            </div>
        </div>
    `;
    document.body.appendChild(root);

    teacherNotificationCenterReady = true;
}

// Missing utility functions
function resolveTeacherIdentifiers() {
    const identifiers = { ids: [], emails: [] };
    
    if (currentTeacher) {
        if (currentTeacher.id) identifiers.ids.push(String(currentTeacher.id));
        if (currentTeacher.email) identifiers.emails.push(String(currentTeacher.email));
        if (currentTeacher.employee_id) identifiers.ids.push(String(currentTeacher.employee_id));
    }
    
    // Try to get from storage as fallback
    try {
        const stored = sessionStorage.getItem('teacherData') || localStorage.getItem('loggedInUser');
        if (stored) {
            const user = JSON.parse(stored);
            if (user.id && !identifiers.ids.includes(String(user.id))) {
                identifiers.ids.push(String(user.id));
            }
            if (user.email && !identifiers.emails.includes(user.email)) {
                identifiers.emails.push(user.email);
            }
            if (user.employee_id && !identifiers.ids.includes(String(user.employee_id))) {
                identifiers.ids.push(String(user.employee_id));
            }
        }
    } catch (e) {
        console.warn('Error parsing stored teacher data:', e);
    }
    
    return identifiers;
}

function updateHashForSection(section) {
    const newHash = section === 'subject-teacher-dashboard' ? '' : `#${section}`;
    if (window.location.hash !== newHash) {
        window.location.hash = newHash;
    }
}

function redirectToManualEnrollment() {
    // Add teacher-assisted parameter to indicate teacher is enrolling the student
    const baseUrl = withSchoolParam('enrollment-form.html');
    const separator = baseUrl.includes('?') ? '&' : '?';
    window.location.href = baseUrl + separator + 'teacher-assisted=true';
}

function printTeachingClassList() {
    if (!currentSubjectViewing) {
        alert('No teaching assignment selected');
        return;
    }
    window.print();
}

function exportTeachingToExcel() {
    if (!currentSubjectViewing) {
        alert('No teaching assignment selected');
        return;
    }
    showInlineToast('Excel export feature coming soon', 'info');
}

function getTeachingSectionStudentsForPrint() {
    if (!currentSubjectViewing) return [];
    
    const sectionId = currentSubjectViewing.sectionId;
    const sectionCode = currentSubjectViewing.sectionCode;
    const sectionName = currentSubjectViewing.sectionName;
    
    return getStudentsForSection(sectionId, sectionCode);
}

function formatTeacherNotificationDate(value) {
    if (!value) return '--';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '--';
    return date.toLocaleString();
}

function openTeacherNotificationCenter() {
    ensureTeacherNotificationCenterUi();
    const overlay = document.getElementById('teacherNotifOverlay');
    if (!overlay) return;
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
}

function closeTeacherNotificationCenter() {
    const overlay = document.getElementById('teacherNotifOverlay');
    if (!overlay) return;
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
}

function renderTeacherNotificationList(notifications) {
    const listEl = document.getElementById('teacherNotifList');
    if (!listEl) return;

    const items = Array.isArray(notifications) ? notifications : [];
    if (!items.length) {
        listEl.innerHTML = '<div class="teacher-notif-empty">No notifications yet.</div>';
        return;
    }

    listEl.innerHTML = items.map((item) => {
        const unread = !item.is_read;
        return `
            <div class="teacher-notif-item ${unread ? 'unread' : ''}" data-notif-id="${escapeHtml(String(item.id || ''))}">
                <div class="teacher-notif-item-title">${escapeHtml(String(item.title || 'Notification'))}</div>
                <div class="teacher-notif-item-meta">${escapeHtml(String(item.type || 'system'))} • ${escapeHtml(formatTeacherNotificationDate(item.created_at))}</div>
                <div class="teacher-notif-item-msg">${escapeHtml(String(item.message || '--'))}</div>
                <div class="teacher-notif-item-controls">
                    ${unread ? '<button type="button" class="btn btn-secondary" data-action="read">Mark read</button>' : ''}
                    <button type="button" class="btn btn-secondary" data-action="delete">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

async function loadTeacherNotifications() {
    ensureTeacherNotificationCenterUi();
    const teacherId = getCurrentTeacherId();
    const listEl = document.getElementById('teacherNotifList');
    if (!teacherId || !listEl) return;

    try {
        const resp = await tenantFetch(`/api/notifications/teacher/${teacherId}`);
        if (resp.ok) {
            const data = await resp.json();
            renderTeacherNotificationList(data.notifications || []);
        } else {
            listEl.innerHTML = '<div class="teacher-notif-empty">Failed to load notifications.</div>';
        }
    } catch (err) {
        console.error('Error loading teacher notifications:', err);
        listEl.innerHTML = '<div class="teacher-notif-empty">Error loading notifications.</div>';
    }

    // Bind event listeners for notification controls
    const refreshBtn = document.getElementById('teacherNotifRefresh');
    const readAllBtn = document.getElementById('teacherNotifReadAll');

    if (refreshBtn && refreshBtn.dataset.bound !== '1') {
        refreshBtn.dataset.bound = '1';
        refreshBtn.addEventListener('click', async () => {
            await loadTeacherNotifications();
            showInlineToast('Notifications refreshed', 'success');
        });
    }

    if (readAllBtn && readAllBtn.dataset.bound !== '1') {
        readAllBtn.dataset.bound = '1';
        readAllBtn.addEventListener('click', async () => {
            try {
                await markAllTeacherNotificationsRead();
                await loadTeacherNotifications();
                showInlineToast('All notifications marked as read', 'success');
            } catch (err) {
                showInlineToast(err?.message || 'Failed to mark all notifications as read', 'error');
            }
        });
    }

    if (listEl && listEl.dataset.bound !== '1') {
        listEl.dataset.bound = '1';
        listEl.addEventListener('click', async (event) => {
            const button = event.target.closest('button[data-action]');
            if (!button) return;

            const item = event.target.closest('.teacher-notif-item');
            const notificationId = Number(item?.getAttribute('data-notif-id') || 0);
            if (!notificationId) return;

            const action = button.getAttribute('data-action');
            try {
                if (action === 'read') {
                    await markTeacherNotificationRead(notificationId);
                } else if (action === 'delete') {
                    await deleteTeacherNotification(notificationId);
                }
                await loadTeacherNotifications();
            } catch (err) {
                showInlineToast(err?.message || 'Notification action failed', 'error');
            }
        });
    }
}

function applySchoolTheme(branding) {
    const theme = branding && typeof branding === 'object' ? branding : {};
    const root = document.documentElement;
    const accent = String(theme.accent || theme.brand700 || theme.primary || '').trim();
    const accentLight = String(theme.accentLight || theme.brand600 || theme.secondary || '').trim();

    if (accent) root.style.setProperty('--accent', accent);
    if (accentLight) root.style.setProperty('--accent-light', accentLight);
}

async function bootstrapSchoolBranding() {
    const detected = detectSchoolCode();
    if (detected) {
        activeSchoolCode = detected;
    }
    const endpoint = detected
        ? `/api/system-health/schools/resolve?code=${encodeURIComponent(detected)}`
        : '/api/system-health/schools/resolve';

    try {
        const res = await tenantFetch(endpoint, { cache: 'no-store' });
        if (!res.ok) return;
        const payload = await res.json();
        if (!payload || !payload.success || !payload.school) return;

        const school = payload.school;
        activeSchoolCode = String(school.code || detected || '').trim().toLowerCase();
        if (activeSchoolCode) {
            localStorage.setItem('sms.selectedSchoolCode', activeSchoolCode);
            localStorage.setItem('sms.selectedTenantCode', activeSchoolCode);
        }
        if (school.id) {
            localStorage.setItem('sms.selectedSchoolId', String(school.id));
            localStorage.setItem('sms.selectedTenantId', String(school.id));
        }

        const schoolName = String(school.name || 'School Management System');
        const logo = String(school.logoData || '').trim();

        document.title = `${schoolName} - Subject Teacher Dashboard`;

        const nameNode = document.getElementById('schoolName');
        if (nameNode) nameNode.textContent = schoolName;

        const logoNode = document.getElementById('schoolLogo');
        if (logoNode && logo) logoNode.setAttribute('src', logo);

        const favicon = document.getElementById('schoolFavicon');
        if (favicon && logo) favicon.setAttribute('href', logo);

        applySchoolTheme(school.branding || {});
    } catch (_err) {}
}

// Utility: escape HTML to prevent injection
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function normalizeTeacherRoleValue(roleValue) {
    const raw = String(roleValue || '').toLowerCase().trim();
    if (!raw) return '';
    if (raw === 'adviser' || raw === 'advisor') return 'adviser';
    if (raw === 'subject teacher' || raw === 'subject_teacher' || raw === 'subject') return 'subject_teacher';
    return raw;
}

function syncTeacherRoleInStorage(normalizedRole) {
    try {
        const teacherDataRaw = sessionStorage.getItem('teacherData');
        if (teacherDataRaw) {
            const teacherData = JSON.parse(teacherDataRaw);
            teacherData.role = normalizedRole;
            sessionStorage.setItem('teacherData', JSON.stringify(teacherData));
        }
    } catch (_) {}

    try {
        const loggedInRaw = localStorage.getItem('loggedInUser');
        if (loggedInRaw) {
            const loggedInUser = JSON.parse(loggedInRaw);
            loggedInUser.role = normalizedRole;
            localStorage.setItem('loggedInUser', JSON.stringify(loggedInUser));
        }
    } catch (_) {}
}

function redirectByNormalizedRole(normalizedRole) {
    if (roleSwitchInProgress) return;
    const currentPath = window.location.pathname || '';

    if (normalizedRole === 'subject_teacher') {
        return;
    }

    roleSwitchInProgress = true;
    if (rolePollingHandle) {
        clearInterval(rolePollingHandle);
        rolePollingHandle = null;
    }

    if (normalizedRole === 'adviser') {
        if (!currentPath.includes('adviser-dashboard')) {
            window.location.href = withSchoolParam('adviser-dashboard.html');
        }
        return;
    }

    if (!currentPath.includes('teacher-dashboard')) {
        window.location.href = withSchoolParam('teacher-dashboard.html');
    }
}

function startRolePollingForSubjectDashboard() {
    if (rolePollingHandle) clearInterval(rolePollingHandle);
    const userEmail = currentTeacher && currentTeacher.email;
    if (!userEmail) return;

    const poll = async () => {
        try {
            const res = await tenantFetch(`/api/teacher-auth/current-role/${encodeURIComponent(userEmail)}`);
            if (!res.ok) return;
            const payload = await res.json();
            if (!payload || !payload.success || !payload.teacher) return;

            const latestRole = normalizeTeacherRoleValue(payload.teacher.role);
            const currentRole = normalizeTeacherRoleValue(currentTeacher && currentTeacher.role);

            if (latestRole && latestRole !== currentRole) {
                currentTeacher.role = latestRole;
                syncTeacherRoleInStorage(latestRole);
                redirectByNormalizedRole(latestRole);
            }
        } catch (_) {}
    };

    poll();
    rolePollingHandle = setInterval(poll, 5000);
}

/**
 * Normalize grade level for comparison
 */
function normalizeGrade(grade) {
    if (!grade) return '';
    const g = String(grade).toLowerCase().trim();
    if (g.match(/^g?ra?de?\.?\s*7$/i)) return '7';
    if (g.match(/^g?ra?de?\.?\s*8$/i)) return '8';
    if (g.match(/^g?ra?de?\.?\s*9$/i)) return '9';
    if (g.match(/^g?ra?de?\.?\s*10$/i)) return '10';
    if (g.match(/^g?ra?de?\.?\s*11$/i)) return '11';
    if (g.match(/^g?ra?de?\.?\s*12$/i)) return '12';
    return g;
}

/**
 * Fetch fresh role from API (don't rely on stale sessionStorage)
 */
async function fetchFreshRole() {
    console.log('[Subject Teacher Dashboard] === FETCHING FRESH ROLE FROM API ===');
    
    // Get email from storage
    let email = null;
    try {
        const stored = sessionStorage.getItem('teacherData') || localStorage.getItem('loggedInUser');
        if (stored) {
            const user = JSON.parse(stored);
            email = user.email;
        }
    } catch (e) {
        console.warn('[Subject Teacher Dashboard] Could not get email from storage:', e.message);
    }
    
    // Try to fetch fresh role
    if (email) {
        try {
            const res = await tenantFetch(`/api/teacher-auth/current-role/${encodeURIComponent(email)}`);
            if (res.ok) {
                const payload = await res.json();
                if (payload.teacher && payload.teacher.role) {
                    const role = payload.teacher.role;
                    console.log('[Subject Teacher Dashboard] ✅ Fresh role from API:', role);
                    return role;
                }
            }
        } catch (e) {
            console.warn('[Subject Teacher Dashboard] Error fetching fresh role:', e.message);
        }
    }
    
    // Fallback: Try profile endpoint
    try {
        const res = await tenantFetch('/api/teacher-auth/profile');
        if (res.ok) {
            const payload = await res.json();
            let role = null;
            if (payload.teacher && payload.teacher.role) {
                role = payload.teacher.role;
            } else if (payload.role) {
                role = payload.role;
            }
            if (role) {
                console.log('[Subject Teacher Dashboard] ✅ Fresh role from profile endpoint:', role);
                return role;
            }
        }
    } catch (e) {
        console.warn('[Subject Teacher Dashboard] Error with profile endpoint:', e.message);
    }
    
    console.warn('[Subject Teacher Dashboard] ❌ Could not fetch fresh role from API');
    return null;
}

/**
 * Initialize dashboard on page load
 */
    document.addEventListener('DOMContentLoaded', async () => {
        // Ensure globals
        if (typeof currentTeacher === 'undefined' || !currentTeacher) currentTeacher = null;
        if (typeof teachingAssignments === 'undefined' || !teachingAssignments) teachingAssignments = [];
        if (typeof allStudents === 'undefined' || !allStudents) allStudents = [];
    try {
        await bootstrapSchoolBranding();
        console.log('[Subject Teacher Dashboard] ========== PAGE LOAD ==========');

        // Get teacher info from sessionStorage or localStorage
        const teacherData = sessionStorage.getItem('teacherData') || localStorage.getItem('loggedInUser');
        sessionStorage.removeItem('_justLoggedIn');

        // Debug info panel
        function showDebugInfo(message) {
            let debugPanel = document.getElementById('dashboardDebugPanel');
            if (!debugPanel) {
                debugPanel = document.createElement('div');
                debugPanel.id = 'dashboardDebugPanel';
                debugPanel.style = 'background: #fff3cd; color: #856404; border: 1px solid #ffeeba; padding: 12px; margin: 18px 0; border-radius: 8px; font-size: 15px;';
                const sectionList = document.querySelector('#subject-teacher-dashboard .section-list');
                if (sectionList) sectionList.appendChild(debugPanel);
            }
            debugPanel.textContent = message;
        }

        if (!teacherData) {
            showDebugInfo('No teacher data found in sessionStorage/localStorage. Please log in again.');
            setTimeout(() => {
                window.location.href = withSchoolParam('teacher-login.html');
            }, 2000);
            return;
        }

        let teacherObj = null;
        try {
            teacherObj = JSON.parse(teacherData);
        } catch (e) {
            showDebugInfo('Corrupted teacher data in storage. Please log in again.');
            setTimeout(() => {
                window.location.href = withSchoolParam('teacher-login.html');
            }, 2000);
            return;
        }
        if (!teacherObj || !teacherObj.id || !teacherObj.name) {
            showDebugInfo('Teacher data missing required fields (id, name). Please log in again.');
            setTimeout(() => {
                window.location.href = withSchoolParam('teacher-login.html');
            }, 2000);
            return;
        }

        currentTeacher = teacherObj;
        window.currentTeacher = currentTeacher;
        console.log('[Subject Teacher Dashboard] Current teacher:', currentTeacher);
        console.log('[Subject Teacher Dashboard] Teacher name:', currentTeacher.name);
        console.log('[Subject Teacher Dashboard] Teacher ID:', currentTeacher.id);

        if (window.CURRENT_USER && typeof window.CURRENT_USER === 'object') {
            window.CURRENT_USER.id = String(currentTeacher.id || currentTeacher.teacher_id || '');
            window.CURRENT_USER.name = currentTeacher.name || 'Teacher';
            window.CURRENT_USER.role = 'subject_teacher';
        }

        applyTeacherInfoToDom();
        // Defensive: ensure dashboard cards show loading if not yet populated
        document.getElementById('teacherNameDisplay').textContent = currentTeacher.name || 'Loading...';
        document.getElementById('schoolYearDisplay').textContent = 'Loading...';
        document.getElementById('subjectsCountDisplay').textContent = 'Loading...';
        document.getElementById('studentsCountDisplay').textContent = 'Loading...';

        // **CRITICAL**: Fetch fresh role from API instead of relying on stale sessionStorage
        console.log('[Subject Teacher Dashboard] === VALIDATING ROLE ===');
        const freshRole = await fetchFreshRole();

        if (!freshRole) {
            showDebugInfo('Could not determine teacher role from API. Please check backend or login again.');
            // Fallback to sessionStorage role
            const storedRole = normalizeTeacherRoleValue(currentTeacher.role);
            currentTeacher.role = storedRole;
            syncTeacherRoleInStorage(storedRole);
            if (storedRole !== 'subject_teacher') {
                showDebugInfo('Stored role is not subject_teacher. Redirecting...');
                setTimeout(() => {
                    redirectByNormalizedRole(storedRole);
                }, 2000);
                return;
            }
        } else {
            const normalizedFreshRole = normalizeTeacherRoleValue(freshRole);
            console.log('[Subject Teacher Dashboard] Fresh role normalized:', normalizedFreshRole);
            currentTeacher.role = normalizedFreshRole;
            syncTeacherRoleInStorage(normalizedFreshRole);

            // Check if fresh role matches subject teacher
            if (normalizedFreshRole !== 'subject_teacher') {
                showDebugInfo('Fresh role is NOT subject_teacher. Redirecting...');
                setTimeout(() => {
                    redirectByNormalizedRole(normalizedFreshRole);
                }, 2000);
                return;
            }

            console.log('[Subject Teacher Dashboard] ✅ Fresh role is subject teacher - confirmed valid');
        }

        applyTeacherInfoToDom();

        // Setup sidebar navigation
        document.querySelectorAll('.sidebar .menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.getAttribute('data-section');

                document.querySelectorAll('.sidebar .menu-item').forEach(mi => mi.classList.remove('active'));
                item.classList.add('active');

                // Hide all main sections and reset their display style
                document.querySelectorAll('.section').forEach(s => {
                    s.classList.remove('active');
                    s.style.display = '';
                });

                // Show the target section
                const targetSection = document.getElementById(section);
                if (targetSection) {
                    targetSection.classList.add('active');
                    targetSection.style.display = 'block';
                }

                // Always hide teaching-section-students when navigating via sidebar
                const teachingSection = document.getElementById('teaching-section-students');
                if (teachingSection) {
                    teachingSection.style.display = 'none';
                }

                if (section === 'subject-teacher-dashboard') {
                    populateDashboardCards();
                } else if (section === 'my-subjects') {
                    loadTeachingAssignments();
                } else if (section === 'students') {
                    currentSubjectViewing = null;
                    document.getElementById('studentSearchInput').value = '';
                    document.getElementById('studentGradeFilter').value = '';
                    loadAllStudents();
                }

                updateHashForSection(section);
            });
        });

        // Setup filter events
        const studentGradeFilter = document.getElementById('studentGradeFilter');
        const studentSearchInput = document.getElementById('studentSearchInput');
        const resetStudentFilters = document.getElementById('resetStudentFilters');

        if (studentSearchInput) {
            studentSearchInput.addEventListener('keyup', () => {
                filterStudents();
            });
        }
        if (studentGradeFilter) {
            studentGradeFilter.addEventListener('change', () => {
                filterStudents();
            });
        }
        if (resetStudentFilters) {
            resetStudentFilters.addEventListener('click', () => {
                resetFilters();
            });
        }

        document.getElementById('logoutBtn')?.addEventListener('click', logout);
        document.getElementById('logoutBtnTop')?.addEventListener('click', logout);

        setupHeaderInteractions();

        const initialSection = normalizeHashSection(window.location.hash);
        const initialMenuItem = document.querySelector(`.sidebar .menu-item[data-section="${initialSection}"]`);
        if (initialMenuItem) {
            initialMenuItem.click();
        }

        window.addEventListener('hashchange', () => {
            const sectionFromHash = normalizeHashSection(window.location.hash);
            const menuItem = document.querySelector(`.sidebar .menu-item[data-section="${sectionFromHash}"]`);
            if (menuItem && !menuItem.classList.contains('active')) {
                menuItem.click();
            }
        });

        // Load initial data
        try {
            await loadTeachingAssignments();
        } catch (e) {
            showDebugInfo('Teaching assignments failed to load.');
        }
        try {
            await loadAllStudents();
        } catch (e) {
            showDebugInfo('All students failed to load.');
        }
        try {
            await populateDashboardCards();
        } catch (e) {
            showDebugInfo('Dashboard cards failed to populate.');
        }

        await refreshTeacherNotificationBadge(false);
        setInterval(() => {
            refreshTeacherNotificationBadge(false).catch(() => {});
        }, 15000);

        startRolePollingForSubjectDashboard();

    } catch (error) {
        showDebugInfo('Error initializing dashboard: ' + (error?.message || error));
        setTimeout(() => {
            window.location.href = withSchoolParam('teacher-login.html');
        }, 2000);
    }
});

/**
 * Populate dashboard overview cards
 */
async function populateDashboardCards() {
    try {
        const teacherNameDisplay = document.getElementById('teacherNameDisplay');
        const schoolYearDisplay = document.getElementById('schoolYearDisplay');
        const subjectsCountDisplay = document.getElementById('subjectsCountDisplay');
        const studentsCountDisplay = document.getElementById('studentsCountDisplay');
        let errorMsg = '';

        // Teacher name
        if (!currentTeacher || !currentTeacher.name) {
            teacherNameDisplay.textContent = 'No data found';
            errorMsg += 'Teacher name missing. ';
            // Force redirect to login if teacher data is missing/corrupted
            setTimeout(() => {
                window.location.href = withSchoolParam('teacher-login.html');
            }, 1500);
        } else {
            teacherNameDisplay.textContent = currentTeacher.name;
        }
        document.getElementById('teacherRoleDisplay').textContent = 'Subject Teacher';

        // School year
        let schoolYear = 'Not Set';
        try {
            const syResp = await tenantFetch('/api/school-years/active');
            if (syResp.ok) {
                const active = await syResp.json();
                if (active && active.school_year) {
                    schoolYear = active.school_year;
                } else {
                    errorMsg += 'API /api/school-years/active returned no school_year. ';
                }
            } else {
                errorMsg += 'API /api/school-years/active failed: ' + syResp.status + '. ';
            }
        } catch (e) {
            schoolYear = 'No data found';
            errorMsg += 'School year missing. ' + (e?.message || e) + ' ';
        }
        schoolYearDisplay.textContent = schoolYear;

        // Subjects and students
        let subjectCount = 0;
        let studentCount = 0;
        if (Array.isArray(teachingAssignments)) {
            if (teachingAssignments.length > 0) {
                const uniqueSubjects = new Set();
                teachingAssignments.forEach(a => {
                    if (a.subject) uniqueSubjects.add(a.subject);
                });
                subjectCount = uniqueSubjects.size;
            } else {
                // teacher currently has no subject assignments; show zero but not error
                subjectCount = 0;
            }
        } else {
            subjectCount = 'No data found';
            errorMsg += 'No subjects assigned. ';
        }
        if (Array.isArray(allStudents)) {
            if (allStudents.length > 0) {
                const uniqueStudents = new Set();
                allStudents.forEach(s => {
                    if (s.id) uniqueStudents.add(s.id);
                });
                studentCount = uniqueStudents.size;
            } else {
                studentCount = 0;
            }
        } else {
            studentCount = 'No data found';
            errorMsg += 'No students found. ';
        }
        subjectsCountDisplay.textContent = subjectCount;
        studentsCountDisplay.textContent = studentCount;

        // Add Retry button and error message if any data is missing
        const sectionList = document.querySelector('#subject-teacher-dashboard .section-list');
        let retryBtn = document.getElementById('dashboardRetryBtn');
        let errorPanel = document.getElementById('dashboardErrorPanel');
        if (teacherNameDisplay.textContent === 'No data found' || schoolYear === 'No data found' || subjectCount === 'No data found' || studentCount === 'No data found') {
            if (!errorPanel) {
                errorPanel = document.createElement('div');
                errorPanel.id = 'dashboardErrorPanel';
                errorPanel.style = 'background: #ffe0e0; color: #a94442; border: 1px solid #f5c6cb; padding: 12px; margin: 18px 0; border-radius: 8px; font-size: 15px;';
                errorPanel.textContent = 'Some dashboard data failed to load. ' + errorMsg;
                sectionList.appendChild(errorPanel);
            } else {
                errorPanel.textContent = 'Some dashboard data failed to load. ' + errorMsg;
            }
            if (!retryBtn) {
                retryBtn = document.createElement('button');
                retryBtn.id = 'dashboardRetryBtn';
                retryBtn.className = 'btn';
                retryBtn.textContent = 'Retry';
                retryBtn.style = 'background: #f093fb; color: white; padding: 10px 15px; margin-top: 18px;';
                retryBtn.onclick = async () => {
                    teacherNameDisplay.textContent = 'Loading...';
                    schoolYearDisplay.textContent = 'Loading...';
                    subjectsCountDisplay.textContent = 'Loading...';
                    studentsCountDisplay.textContent = 'Loading...';
                    if (errorPanel) errorPanel.textContent = '';
                    await populateDashboardCards();
                };
                sectionList.appendChild(retryBtn);
            }
        } else {
            if (retryBtn) retryBtn.remove();
            if (errorPanel) errorPanel.remove();
        }
    } catch (error) {
        console.error('[Dashboard] Error populating cards:', error);
        const sectionList = document.querySelector('#subject-teacher-dashboard .section-list');
        let errorPanel = document.getElementById('dashboardErrorPanel');
        if (!errorPanel) {
            errorPanel = document.createElement('div');
            errorPanel.id = 'dashboardErrorPanel';
            errorPanel.style = 'background: #ffe0e0; color: #a94442; border: 1px solid #f5c6cb; padding: 12px; margin: 18px 0; border-radius: 8px; font-size: 15px;';
            errorPanel.textContent = 'Dashboard error: ' + (error?.message || error);
            sectionList.appendChild(errorPanel);
        } else {
            errorPanel.textContent = 'Dashboard error: ' + (error?.message || error);
        }
        let retryBtn = document.getElementById('dashboardRetryBtn');
        if (!retryBtn) {
            retryBtn = document.createElement('button');
            retryBtn.id = 'dashboardRetryBtn';
            retryBtn.className = 'btn';
            retryBtn.textContent = 'Retry';
            retryBtn.style = 'background: #f093fb; color: white; padding: 10px 15px; margin-top: 18px;';
            retryBtn.onclick = async () => {
                document.getElementById('teacherNameDisplay').textContent = 'Loading...';
                document.getElementById('schoolYearDisplay').textContent = 'Loading...';
                document.getElementById('subjectsCountDisplay').textContent = 'Loading...';
                document.getElementById('studentsCountDisplay').textContent = 'Loading...';
                if (errorPanel) errorPanel.textContent = '';
                await populateDashboardCards();
            };
            sectionList.appendChild(retryBtn);
        }
    }
}

/**
 * Load teaching assignments for this subject teacher
 */
async function loadTeachingAssignments() {
    try {
        const container = document.getElementById('teachingAssignmentsCard');
        if (!container) {
            console.log('[Subject Teacher] Container not found, skipping');
            return;
        }

        container.innerHTML = '<p class="loading">Loading teaching assignments...</p>';
        console.log('[Subject Teacher] ===== LOADING ASSIGNMENTS =====');
        console.log('[Subject Teacher] Current teacher:', currentTeacher);
        console.log('[Subject Teacher] Teacher ID:', currentTeacher?.id);

        // Try the adviser endpoint first (known to work)
        const identifiers = resolveTeacherIdentifiers();
        const endpoints = [];
        identifiers.ids.forEach((idValue) => {
            endpoints.push(`/api/adviser-auth/teaching-assignments/${encodeURIComponent(idValue)}`);
            endpoints.push(`/api/teacher-auth/subject-assignments/${encodeURIComponent(idValue)}`);
        });

        if (!endpoints.length) {
            container.innerHTML = '<p class="no-data">Missing teacher identifier. Please sign in again.</p>';
            teachingAssignments = [];
            return;
        }

        let resp = null;
        let usedUrl = null;
        
        for (const url of endpoints) {
            console.log('[Subject Teacher] 🔄 Trying endpoint:', url);
            try {
                resp = await tenantFetch(url);
                console.log('[Subject Teacher] Response status:', resp.status, resp.statusText);
                
                if (resp.ok) {
                    usedUrl = url;
                    console.log('[Subject Teacher] ✅ SUCCESS with:', url);
                    break;
                } else {
                    console.warn('[Subject Teacher] ❌ Failed:', url, 'Status:', resp.status);
                }
            } catch (e) {
                console.warn('[Subject Teacher] ❌ Exception:', url, e.message);
                continue;
            }
        }

        if (!resp || !resp.ok) {
            console.warn('[Subject Teacher] ❌ All endpoints failed');
            container.innerHTML = '<p class="no-data">No teaching assignments found</p>';
            teachingAssignments = [];
            return;
        }

        let data;
        try {
            const contentType = resp.headers.get('content-type');
            console.log('[Subject Teacher] Content-Type:', contentType);
            
            if (contentType && contentType.includes('application/json')) {
                data = await resp.json();
                console.log('[Subject Teacher] ✅ Parsed JSON successfully');
            } else {
                console.warn('[Subject Teacher] ❌ Response is not JSON, got:', contentType);
                container.innerHTML = '<p class="no-data">No teaching assignments found</p>';
                teachingAssignments = [];
                return;
            }
        } catch (parseError) {
            console.warn('[Subject Teacher] ❌ Failed to parse JSON response:', parseError);
            container.innerHTML = '<p class="no-data">No teaching assignments found</p>';
            teachingAssignments = [];
            return;
        }
        
        // Extract assignments from response - try various possible formats
        console.log('[Subject Teacher] Raw API response:', data);
        
        let assignments = [];
        if (Array.isArray(data)) {
            console.log('[Subject Teacher] Response is direct array');
            assignments = data;
        } else if (data && data.assignments && Array.isArray(data.assignments)) {
            console.log('[Subject Teacher] Response has .assignments array');
            assignments = data.assignments;
        } else if (data && data.data && Array.isArray(data.data)) {
            console.log('[Subject Teacher] Response has .data array');
            assignments = data.data;
        } else if (data && typeof data === 'object') {
            console.log('[Subject Teacher] Response is object with keys:', Object.keys(data));
            assignments = [];
        }
        
        // restrict to active school year if known (same logic as adviser dashboard)
        const activeYear = Number(window.activeSchoolYearId || 0) || null;
        if (activeYear) {
            assignments = assignments.filter(a => Number(a.school_year_id || a.schoolYearId || 0) === activeYear);
        }

        teachingAssignments = assignments;
        console.log('[Subject Teacher] ✅ Teaching assignments loaded:', teachingAssignments.length);

        if (!teachingAssignments || teachingAssignments.length === 0) {
            console.warn('[Subject Teacher] No assignments in data');
            container.innerHTML = '<p class="no-data">No teaching assignments found</p>';
            return;
        }

        // Fetch students first so we can display them with each assignment
        if (!allStudents || allStudents.length === 0) {
            await loadAllStudents();
        }

        // Render each teaching assignment
        container.innerHTML = teachingAssignments.map((a, index) => {
            const subj = a.subject || a.subject_name || 'Unknown';
            const sid = a.section_id || a.sectionId || a.section || '';
            const sname = a.section_code || a.section_name || ('Section ' + sid);
            const grade = a.grade || '';

            return `
                <div class="teaching-assignment" onclick="viewSubjectStudentsByIndex(${index})">
                    <div class="teaching-subject">${escapeHtml(String(subj))}</div>
                    <div class="teaching-meta">Grade: ${escapeHtml(String(grade||'—'))} • Section: ${escapeHtml(String(sname||'—'))}</div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('[Subject Teacher] Error loading assignments:', error);
        const container = document.getElementById('teachingAssignmentsCard');
        if (container) {
            container.innerHTML = '<p class="error-message">Error loading assignments</p>';
        }
    }
}

/**
 * Helper function to get students for a specific section
 */
function getStudentsForSection(sectionId, sectionCode) {
    if (!allStudents || allStudents.length === 0) return [];

    return allStudents.filter(student => doesStudentMatchSection(student, {
        sectionId,
        sectionCode
    }));
}

function normalizeSectionKey(value) {
    return String(value || '').trim().toLowerCase();
}

function collectSectionKeysFromContext(sectionContext = {}) {
    const keys = new Set();
    [
        sectionContext.sectionId,
        sectionContext.sectionCode,
        sectionContext.sectionName,
        sectionContext.section
    ].forEach((value) => {
        const key = normalizeSectionKey(value);
        if (key) keys.add(key);
    });
    return keys;
}

function collectSectionKeysFromStudent(student = {}) {
    const keys = new Set();
    [
        student.section,
        student.section_code,
        student.section_id,
        student.section_name
    ].forEach((value) => {
        const key = normalizeSectionKey(value);
        if (key) keys.add(key);
    });
    return keys;
}

function doesStudentMatchSection(student, sectionContext) {
    const contextKeys = collectSectionKeysFromContext(sectionContext);
    if (!contextKeys.size) return false;

    const studentKeys = collectSectionKeysFromStudent(student);
    if (!studentKeys.size) return false;

    for (const key of studentKeys) {
        if (contextKeys.has(key)) return true;
    }
    return false;
}

function viewSubjectStudentsByIndex(index) {
    const idx = Number(index);
    if (!Number.isInteger(idx) || idx < 0 || idx >= (teachingAssignments || []).length) return;

    const assignment = teachingAssignments[idx] || {};
    const sectionId = assignment.section_id || assignment.sectionId || assignment.section || '';
    const sectionCode = assignment.section_code || assignment.sectionCode || '';
    const sectionName = assignment.section_name || assignment.sectionName || sectionCode || sectionId;
    const subjectName = assignment.subject || assignment.subject_name || 'Subject';

    viewSubjectStudents(sectionId, subjectName, sectionCode, sectionName);
}

/**
 * View students for a specific subject/section (shows separate student list view)
 */
function viewSubjectStudents(sectionId, subjectName, sectionCode = '', sectionName = '') {
    console.log('[Subject Teacher] Viewing students for section:', sectionId, 'subject:', subjectName, 'sectionCode:', sectionCode);
    
    // Store the section context
    currentSubjectViewing = { sectionId, sectionCode, sectionName, subject: subjectName };
    const sectionLabel = sectionName || sectionCode || sectionId || 'N/A';
    
    // Update the teaching section header
    document.getElementById('teachingAssignmentTitle').textContent = `Students - ${subjectName}`;
    document.getElementById('teachingAssignmentSubtitle').textContent = `Students assigned to ${subjectName} (Section: ${sectionLabel})`;
    
    // Hide all main sections (but don't use inline style to allow sidebar to re-show them)
    document.querySelectorAll('.section').forEach(s => s.style.display = 'none');
    
    // Show the teaching section students view
    const teachingSection = document.getElementById('teaching-section-students');
    if (teachingSection) {
        teachingSection.style.display = 'block';
    }
    
    // Remove active state from all sidebar items
    document.querySelectorAll('.sidebar .menu-item').forEach(mi => mi.classList.remove('active'));
    
    // Filter and display students for this section
    displayTeachingAssignmentStudents();
}

/**
 * Display students for the current teaching assignment
 */
function displayTeachingAssignmentStudents() {
    if (!currentSubjectViewing || (!currentSubjectViewing.sectionId && !currentSubjectViewing.sectionCode && !currentSubjectViewing.sectionName)) {
        return;
    }

    // Filter students for this section
    const sectionStudents = allStudents.filter(student => {
        return doesStudentMatchSection(student, currentSubjectViewing);
    });

    console.log('[Subject Teacher] Displaying', sectionStudents.length, 'students for section context:', currentSubjectViewing);
    
    const tbody = document.getElementById('teachingStudentsTableBody');
    if (!tbody) return;
    
    if (!sectionStudents || sectionStudents.length === 0) {
        document.getElementById('noTeachingStudentsMessage')?.style.setProperty('display', 'block');
        document.getElementById('teachingStudentResultsInfo')?.style.setProperty('display', 'none');
        tbody.innerHTML = '';
        return;
    }
    
    // Show results info
    const resultsInfo = document.getElementById('teachingStudentResultsInfo');
    if (resultsInfo) {
        resultsInfo.style.display = 'block';
        const resultsCount = document.getElementById('teachingStudentResultsCount');
        if (resultsCount) {
            resultsCount.textContent = sectionStudents.length;
        }
    }
    
    document.getElementById('noTeachingStudentsMessage')?.style.setProperty('display', 'none');
    
    tbody.innerHTML = sectionStudents.map(student => `
        <tr style="border-bottom: 1px solid #dee2e6;">
            <td style="padding: 12px; color: #333;">${escapeHtml(student.lrn || '-')}</td>
            <td style="padding: 12px; color: #333;">${escapeHtml(student.fullName || '-')}</td>
            <td style="padding: 12px; color: #333;">Grade ${escapeHtml(student.grade_level || '-')}</td>
            <td style="padding: 12px; color: #333;">${escapeHtml(student.section || '-')}</td>
            <td style="padding: 12px;">
                <button class="btn btn-sm" style="background: #007bff; color: white; padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">View</button>
            </td>
        </tr>
    `).join('');
}

/**
 * Go back to My Subjects view from teaching assignment student list
 */
function backToTeachingAssignments() {
    currentSubjectViewing = null;
    
    // Hide teaching section
    document.getElementById('teaching-section-students').style.display = 'none';
    
    // Show my-subjects section
    document.getElementById('my-subjects').style.display = 'block';
    
    // Activate My Subjects menu item
    document.querySelectorAll('.sidebar .menu-item').forEach(mi => mi.classList.remove('active'));
    document.querySelector('[data-section="my-subjects"]')?.classList.add('active');
    updateHashForSection('my-subjects');
}

function buildEnrollmentFullName(enrollment, enrollmentData) {
    const e = enrollmentData && typeof enrollmentData === 'object' ? enrollmentData : {};

    const explicitEnrollmentName = String(
        e.full_name || e.fullName || e.student_full_name || e.studentFullName || ''
    ).trim();
    if (explicitEnrollmentName) return explicitEnrollmentName;

    const first = String(e.first_name || e.firstName || e.firstname || enrollment.first_name || '').trim();
    const middle = String(e.middle_name || e.middleName || e.middlename || '').trim();
    const last = String(e.last_name || e.lastName || e.lastname || enrollment.last_name || '').trim();
    const suffix = String(e.suffix || e.name_suffix || '').trim();

    const combined = [first, middle, last, suffix].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    if (combined) return combined;

    const enrollmentTableName = String(enrollment.full_name || enrollment.fullName || '').trim();
    if (enrollmentTableName) return enrollmentTableName;

    return 'Unknown';
}

/**
 * Load all students from enrollments
 */
async function loadAllStudents() {
    try {
        console.log('[Subject Teacher] Loading all students');
        const response = await tenantFetch('/api/enrollments');
        
        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }
        
        const data = await response.json();
        let enrollments = Array.isArray(data) ? data : (data.enrollments || data.data || []);

        if (enrollments && enrollments.length > 0) {
            allStudents = enrollments.map(enrollment => {
                let eData = enrollment.enrollment_data || enrollment.data || {};
                if (typeof eData === 'string') {
                    try { eData = JSON.parse(eData); } catch (e) { eData = {}; }
                }

                const first = enrollment.first_name || eData.firstName || eData.firstname || eData.first_name || '';
                const last = enrollment.last_name || eData.lastName || eData.lastname || eData.last_name || '';
                const fullName = buildEnrollmentFullName(enrollment, eData);

                const lrn = (eData.lrn || eData.LRN || eData.lrnNumber || enrollment.lrn || enrollment.student_lrn || enrollment.studentLRN || '').toString();
                const gradeLevel = normalizeGrade(eData.grade_level || eData.gradeLevel || eData.grade || enrollment.grade_level || enrollment.grade || '');

                const sectionId = enrollment.section_id || eData.section_id || eData.sectionId || enrollment.class_id || null;
                const sectionCode = enrollment.section_code || enrollment.sectionCode || eData.section_code || eData.sectionCode || '';
                const sectionName = enrollment.section_name || enrollment.sectionName || eData.section_name || eData.sectionName || '';

                let section = '';
                if (sectionName) section = sectionName;
                if (!section && sectionCode) section = sectionCode;
                if (!section && sectionId) section = sectionId;
                if (!section && (enrollment.section || eData.section)) section = enrollment.section || eData.section;

                return {
                    id: enrollment.id || enrollment.student_id || enrollment.studentId || null,
                    lrn: lrn || '-',
                    student_id: enrollment.student_id || null,
                    first_name: first,
                    last_name: last,
                    fullName: fullName,
                    grade_level: gradeLevel,
                    section: section,
                    section_id: sectionId,
                    section_code: sectionCode || section,
                    section_name: sectionName || section,
                    status: enrollment.status || 'active'
                };
            });

            console.log('[Subject Teacher] Loaded', allStudents.length, 'students');
        }
        
        // Always display/filter students after loading
        filterStudents();
        
    } catch (error) {
        console.error('[Subject Teacher] Error loading students:', error);
        const tbody = document.getElementById('studentsTableBody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="4" style="padding: 40px; text-align: center; color: #999;">Error loading students</td></tr>`;
        }
    }
}

/**
 * Display students in table
 */
function displayStudents(students) {
    const tbody = document.getElementById('studentsTableBody');
    if (!tbody) return;
    lastDisplayedStudents = Array.isArray(students) ? students.slice() : [];

    if (!students || students.length === 0) {
        // Hide results info when no students
        const resultsInfo = document.getElementById('studentResultsInfo');
        if (resultsInfo) {
            resultsInfo.style.display = 'none';
        }
        document.getElementById('noStudentsMessage')?.style.setProperty('display', 'block');
        tbody.innerHTML = '';
        return;
    }

    // Show "X student(s) found" when there are results
    const resultsInfo = document.getElementById('studentResultsInfo');
    if (resultsInfo) {
        resultsInfo.style.display = 'block';
        const resultsCount = document.getElementById('studentResultsCount');
        if (resultsCount) {
            resultsCount.textContent = students.length;
        }
    }
    
    document.getElementById('noStudentsMessage')?.style.setProperty('display', 'none');
    
    tbody.innerHTML = students.map(student => `
        <tr style="border-bottom: 1px solid #dee2e6;">
            <td style="padding: 12px; color: #333;">${escapeHtml(student.lrn || '-')}</td>
            <td style="padding: 12px; color: #333;">${escapeHtml(student.fullName || '-')}</td>
            <td style="padding: 12px; color: #333;">Grade ${escapeHtml(student.grade_level || '-')}</td>
            <td style="padding: 12px; color: #333;">${escapeHtml(student.section || '-')}</td>
        </tr>
    `).join('');
}

/**
 * Filter students by grade and search
 */
function filterStudents() {
    const searchText = (document.getElementById('studentSearchInput')?.value || '').toLowerCase();
    const gradeFilter = document.getElementById('studentGradeFilter')?.value || '';

    let filtered = allStudents.filter(student => {
        const matchesSearch = !searchText || 
            (student.lrn && student.lrn.toLowerCase().includes(searchText)) ||
            (student.fullName && student.fullName.toLowerCase().includes(searchText));
        
        const matchesGrade = !gradeFilter || normalizeGrade(student.grade_level) === gradeFilter;

        // If viewing a specific subject, also filter by section
        if (currentSubjectViewing && (currentSubjectViewing.sectionId || currentSubjectViewing.sectionCode || currentSubjectViewing.sectionName)) {
            const matchesSection = doesStudentMatchSection(student, currentSubjectViewing);
            return matchesSearch && matchesGrade && matchesSection;
        }

        return matchesSearch && matchesGrade;
    });

    const resultsInfo = document.getElementById('studentResultsInfo');
    if (resultsInfo) {
        resultsInfo.style.display = filtered.length > 0 ? 'block' : 'none';
        const resultsCount = document.getElementById('studentResultsCount');
        if (resultsCount) {
            resultsCount.textContent = filtered.length;
        }
    }

    displayStudents(filtered);
}

/**
 * Reset filters
 */
function resetFilters() {
    document.getElementById('studentSearchInput').value = '';
    document.getElementById('studentGradeFilter').value = '';
    currentSubjectViewing = null;  // Clear section filter to show all students

    filterStudents();
}

/**
 * Logout handler
 */
function logout() {
    if (rolePollingHandle) {
        clearInterval(rolePollingHandle);
        rolePollingHandle = null;
    }
    sessionStorage.removeItem('teacherData');
    localStorage.removeItem('loggedInUser');
    window.location.href = withSchoolParam('teacher-login.html');
}

/**
 * Placeholder functions for future features
 */
function ensureAllStudentsPrintModalUi() {
    if (!document.getElementById('allStudentsPrintModalStyle')) {
        const style = document.createElement('style');
        style.id = 'allStudentsPrintModalStyle';
        style.textContent = `
            .all-students-print-modal{position:fixed;inset:0;background:rgba(15,23,42,.55);display:none;align-items:center;justify-content:center;z-index:1600;padding:16px}
            .all-students-print-modal.active{display:flex}
            .all-students-print-panel{width:min(820px,96vw);max-height:90vh;overflow:auto;background:var(--card-bg,#fff);border:1px solid var(--border-primary,#d0d7de);border-radius:12px;box-shadow:0 14px 40px rgba(0,0,0,.25)}
            .all-students-print-header{padding:14px 16px;border-bottom:1px solid var(--border-primary,#d0d7de);display:flex;justify-content:space-between;align-items:center}
            .all-students-print-title{font-size:18px;font-weight:700;color:var(--text-primary,#111827)}
            .all-students-print-close{border:1px solid var(--border-primary,#d0d7de);background:var(--bg-secondary,#f3f4f6);color:var(--text-primary,#111827);border-radius:8px;width:34px;height:34px;cursor:pointer}
            .all-students-print-body{padding:14px 16px;display:grid;gap:14px}
            .all-students-print-group{border:1px solid var(--border-primary,#d0d7de);border-radius:10px;padding:12px;background:var(--bg-secondary,#f8fafc)}
            .all-students-print-group h4{margin:0 0 10px;font-size:14px;color:var(--text-primary,#111827)}
            .all-students-print-mode{display:flex;gap:16px;flex-wrap:wrap}
            .all-students-print-options{display:grid;grid-template-columns:1fr 1fr;gap:12px}
            .all-students-print-list{max-height:220px;overflow:auto;border:1px solid var(--border-primary,#d0d7de);border-radius:8px;padding:8px;background:var(--card-bg,#ffffff)}
            .all-students-print-item{display:flex;align-items:center;gap:8px;padding:4px 2px;font-size:13px;color:var(--text-primary,#111827)}
            .all-students-print-tools{display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap}
            .all-students-print-summary{font-size:12px;color:var(--text-secondary,#475569)}
            .all-students-print-actions{display:flex;justify-content:flex-end;gap:10px;padding:0 16px 16px}
            .dark-theme .all-students-print-list{background:var(--bg-primary,#0f172a);border-color:var(--border-primary,#334155)}
            .dark-theme .all-students-print-group{background:var(--card-bg,#111827);border-color:var(--border-primary,#334155)}
            .dark-theme .all-students-print-item{color:var(--text-primary,#e5e7eb)}
            .dark-theme .all-students-print-summary{color:var(--text-secondary,#94a3b8)}
            @media (max-width: 760px){.all-students-print-options{grid-template-columns:1fr}}
        `;
        document.head.appendChild(style);
    }

    if (!document.getElementById('allStudentsPrintModal')) {
        const modal = document.createElement('div');
        modal.id = 'allStudentsPrintModal';
        modal.className = 'all-students-print-modal';
        modal.setAttribute('aria-hidden', 'true');
        modal.innerHTML = `
            <div class="all-students-print-panel" role="dialog" aria-modal="true" aria-labelledby="allStudentsPrintTitle">
                <div class="all-students-print-header">
                    <div class="all-students-print-title" id="allStudentsPrintTitle">Print Options</div>
                    <button type="button" class="all-students-print-close" id="allStudentsPrintClose" aria-label="Close">x</button>
                </div>
                <div class="all-students-print-body">
                    <div class="all-students-print-group">
                        <h4>Group Report By</h4>
                        <div class="all-students-print-mode">
                            <label class="all-students-print-item"><input type="radio" name="allStudentsPrintMode" value="grade" checked /> Grade Level</label>
                            <label class="all-students-print-item"><input type="radio" name="allStudentsPrintMode" value="section" /> Section</label>
                        </div>
                    </div>
                    <div class="all-students-print-options">
                        <div class="all-students-print-group">
                            <h4>Select Grade Level(s)</h4>
                            <div class="all-students-print-tools">
                                <button type="button" class="btn btn-secondary" id="printGradesSelectAll">Select All</button>
                                <button type="button" class="btn btn-secondary" id="printGradesClearAll">Clear</button>
                            </div>
                            <div class="all-students-print-list" id="printGradesList"></div>
                        </div>
                        <div class="all-students-print-group">
                            <h4>Select Section(s)</h4>
                            <div class="all-students-print-tools">
                                <button type="button" class="btn btn-secondary" id="printSectionsSelectAll">Select All</button>
                                <button type="button" class="btn btn-secondary" id="printSectionsClearAll">Clear</button>
                            </div>
                            <div class="all-students-print-list" id="printSectionsList"></div>
                        </div>
                    </div>
                    <div class="all-students-print-summary" id="allStudentsPrintSummary"></div>
                </div>
                <div class="all-students-print-actions">
                    <button type="button" class="btn btn-secondary" id="allStudentsPrintCancel">Cancel</button>
                    <button type="button" class="btn" id="allStudentsPrintGenerate">Generate Print</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
}

function toggleAllStudentsCheckboxes(selector, checked) {
    document.querySelectorAll(selector).forEach((input) => {
        input.checked = checked;
    });
}

function getSelectedAllStudentsCheckboxValues(selector) {
    return Array.from(document.querySelectorAll(selector))
        .filter((input) => input.checked)
        .map((input) => String(input.value || '').trim())
        .filter(Boolean);
}

function buildGradeLabel(value) {
    const normalized = normalizeGrade(value);
    if (!normalized) return 'Unspecified';
    if (/^\d+$/.test(normalized)) return `Grade ${normalized}`;
    return String(value || normalized);
}

function buildSectionLabel(student) {
    return String(student.section || student.section_code || student.section_name || '-').trim() || '-';
}

function getAllStudentsPrintGroupingData(rows) {
    const list = Array.isArray(rows) ? rows : [];
    const fixedGrades = ['7', '8', '9', '10', '11', '12'];
    const grades = new Set(fixedGrades);
    const sections = new Set();

    list.forEach((student) => {
        const normalizedGrade = normalizeGrade(student.grade_level);
        if (normalizedGrade) grades.add(normalizedGrade);
        const section = buildSectionLabel(student);
        if (section && section !== '-') sections.add(section);
    });

    const gradeOrder = Array.from(grades).sort((a, b) => {
        const na = Number(a);
        const nb = Number(b);
        if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
        return String(a).localeCompare(String(b));
    });
    const sectionOrder = Array.from(sections).sort((a, b) => a.localeCompare(b));

    return { gradeOrder, sectionOrder };
}

function renderAllStudentsPrintOptionLists(rows) {
    ensureAllStudentsPrintModalUi();
    const gradeList = document.getElementById('printGradesList');
    const sectionList = document.getElementById('printSectionsList');
    const summary = document.getElementById('allStudentsPrintSummary');
    if (!gradeList || !sectionList) return;

    const options = getAllStudentsPrintGroupingData(rows);

    gradeList.innerHTML = options.gradeOrder.map((grade) => {
        const label = /^\d+$/.test(grade) ? `Grade ${grade}` : grade;
        return `<label class="all-students-print-item"><input type="checkbox" class="print-grade-option" value="${escapeHtml(grade)}" checked /> ${escapeHtml(label)}</label>`;
    }).join('');

    sectionList.innerHTML = options.sectionOrder.map((section) => {
        return `<label class="all-students-print-item"><input type="checkbox" class="print-section-option" value="${escapeHtml(section)}" checked /> ${escapeHtml(section)}</label>`;
    }).join('');

    if (summary) {
        summary.textContent = `Students ready for print: ${rows.length}. Select one or more grade levels and/or sections.`;
    }
}

function openAllStudentsPrintModal() {
    const rows = getAllStudentsExportRows();
    if (!rows.length) {
        showInlineToast('No students to print', 'error');
        return;
    }

    ensureAllStudentsPrintModalUi();
    renderAllStudentsPrintOptionLists(rows);

    const modal = document.getElementById('allStudentsPrintModal');
    if (!modal) return;
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
}

function closeAllStudentsPrintModal() {
    const modal = document.getElementById('allStudentsPrintModal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
}

function bindAllStudentsPrintModalEvents() {
    ensureAllStudentsPrintModalUi();

    const modal = document.getElementById('allStudentsPrintModal');
    const closeBtn = document.getElementById('allStudentsPrintClose');
    const cancelBtn = document.getElementById('allStudentsPrintCancel');
    const generateBtn = document.getElementById('allStudentsPrintGenerate');
    const gradesSelectAll = document.getElementById('printGradesSelectAll');
    const gradesClearAll = document.getElementById('printGradesClearAll');
    const sectionsSelectAll = document.getElementById('printSectionsSelectAll');
    const sectionsClearAll = document.getElementById('printSectionsClearAll');

    if (closeBtn && closeBtn.dataset.bound !== '1') {
        closeBtn.dataset.bound = '1';
        closeBtn.addEventListener('click', closeAllStudentsPrintModal);
    }
    if (cancelBtn && cancelBtn.dataset.bound !== '1') {
        cancelBtn.dataset.bound = '1';
        cancelBtn.addEventListener('click', closeAllStudentsPrintModal);
    }
    if (modal && modal.dataset.boundBackdrop !== '1') {
        modal.dataset.boundBackdrop = '1';
        modal.addEventListener('click', (event) => {
            if (event.target === modal) closeAllStudentsPrintModal();
        });
    }
    if (gradesSelectAll && gradesSelectAll.dataset.bound !== '1') {
        gradesSelectAll.dataset.bound = '1';
        gradesSelectAll.addEventListener('click', () => toggleAllStudentsCheckboxes('.print-grade-option', true));
    }
    if (gradesClearAll && gradesClearAll.dataset.bound !== '1') {
        gradesClearAll.dataset.bound = '1';
        gradesClearAll.addEventListener('click', () => toggleAllStudentsCheckboxes('.print-grade-option', false));
    }
    if (sectionsSelectAll && sectionsSelectAll.dataset.bound !== '1') {
        sectionsSelectAll.dataset.bound = '1';
        sectionsSelectAll.addEventListener('click', () => toggleAllStudentsCheckboxes('.print-section-option', true));
    }
    if (sectionsClearAll && sectionsClearAll.dataset.bound !== '1') {
        sectionsClearAll.dataset.bound = '1';
        sectionsClearAll.addEventListener('click', () => toggleAllStudentsCheckboxes('.print-section-option', false));
    }
    if (generateBtn && generateBtn.dataset.bound !== '1') {
        generateBtn.dataset.bound = '1';
        generateBtn.addEventListener('click', () => {
            generateAllStudentsPrintFromModal();
        });
    }
}

function groupRowsForAllStudentsPrint(rows, mode) {
    const list = Array.isArray(rows) ? rows : [];
    const groupMode = mode === 'section' ? 'section' : 'grade';
    const grouped = new Map();

    list.forEach((student) => {
        const gradeValue = normalizeGrade(student.grade_level);
        const gradeLabel = buildGradeLabel(gradeValue || student.grade_level);
        const sectionLabel = buildSectionLabel(student);
        const topKey = groupMode === 'section' ? sectionLabel : gradeLabel;
        const childKey = groupMode === 'section' ? gradeLabel : sectionLabel;

        if (!grouped.has(topKey)) grouped.set(topKey, new Map());
        const nested = grouped.get(topKey);
        if (!nested.has(childKey)) nested.set(childKey, []);
        nested.get(childKey).push(student);
    });

    return grouped;
}

function generateAllStudentsPrintHtml(rows, context, mode, selectedGrades, selectedSections) {
    const grouped = groupRowsForAllStudentsPrint(rows, mode);

    const topKeys = Array.from(grouped.keys()).sort((a, b) => {
        if (mode === 'grade') {
            const na = Number(String(a).replace(/[^0-9]/g, ''));
            const nb = Number(String(b).replace(/[^0-9]/g, ''));
            if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
        }
        return String(a).localeCompare(String(b));
    });

    let runningIndex = 1;
    const sectionsHtml = topKeys.map((topKey) => {
        const nested = grouped.get(topKey) || new Map();
        const childKeys = Array.from(nested.keys()).sort((a, b) => String(a).localeCompare(String(b)));

        const childHtml = childKeys.map((childKey) => {
            const students = nested.get(childKey) || [];
            const rowsHtml = students.map((student) => {
                const row = `
                    <tr>
                        <td>${runningIndex++}</td>
                        <td>${escapeHtml(student.lrn || '-')}</td>
                        <td>${escapeHtml(student.fullName || '-')}</td>
                    </tr>`;
                return row;
            }).join('');

            const subHeading = mode === 'grade' ? `Section: ${childKey}` : `Grade: ${childKey}`;
            return `
                <div class="group-sub">${escapeHtml(subHeading)} (${students.length})</div>
                <table>
                    <thead>
                        <tr>
                            <th style="width:48px;">#</th>
                            <th style="width:170px;">LRN</th>
                            <th>Full Name</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            `;
        }).join('');

        const heading = mode === 'grade' ? topKey : `Section: ${topKey}`;
        return `<div class="group-head">${escapeHtml(heading)}</div>${childHtml}`;
    }).join('');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>All Students Class List</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    body { font-family: Arial, sans-serif; color: #111; margin: 0; }
    .title { text-align: center; margin-bottom: 8px; }
    .title h1 { margin: 0; font-size: 22px; }
    .title h2 { margin: 4px 0 0; font-size: 16px; }
    .meta { border: 1px solid #cfd8dc; border-radius: 8px; padding: 10px 12px; margin: 10px 0 12px; font-size: 12px; }
    .meta-row { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 6px; }
    .meta-row:last-child { margin-bottom: 0; }
    .label { font-weight: 700; }
    .group-head { margin: 14px 0 8px; padding: 6px 8px; background: #e2e8f0; border-left: 4px solid #334155; font-weight: 700; font-size: 13px; }
    .group-sub { margin: 8px 0 6px; font-weight: 700; color: #334155; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    th, td { border: 1px solid #b0bec5; padding: 7px; font-size: 12px; text-align: left; }
    th { background: #eceff1; }
    .footer { margin-top: 12px; font-size: 11px; color: #455a64; display:flex; justify-content:space-between; }
  </style>
</head>
<body>
  <div class="title">
    <h1>${escapeHtml(context.schoolName)}</h1>
    <h2>All Students Class List</h2>
  </div>
  <div class="meta">
    <div class="meta-row">
      <div><span class="label">Teacher:</span> ${escapeHtml(context.teacherName)}</div>
      <div><span class="label">School Year:</span> ${escapeHtml(context.schoolYear)}</div>
      <div><span class="label">Group By:</span> ${mode === 'section' ? 'Section' : 'Grade Level'}</div>
      <div><span class="label">Total Students:</span> ${rows.length}</div>
    </div>
    <div class="meta-row">
      <div><span class="label">Selected Grades:</span> ${escapeHtml(selectedGrades.length ? selectedGrades.map((g) => (/^\d+$/.test(g) ? `Grade ${g}` : g)).join(', ') : 'All')}</div>
      <div><span class="label">Selected Sections:</span> ${escapeHtml(selectedSections.length ? selectedSections.join(', ') : 'All')}</div>
    </div>
    <div class="meta-row">
      <div><span class="label">Search Filter:</span> ${escapeHtml(context.searchText || 'None')}</div>
      <div><span class="label">Generated:</span> ${escapeHtml(context.generatedAt)}</div>
    </div>
  </div>
  ${sectionsHtml}
  <div class="footer">
    <span>${escapeHtml(context.schoolName)}</span>
    <span>Subject Teacher Dashboard</span>
  </div>
</body>
</html>`;
}

function generateAllStudentsPrintFromModal() {
    const rows = getAllStudentsExportRows();
    if (!rows.length) {
        showInlineToast('No students to print', 'error');
        return;
    }

    const mode = String(document.querySelector('input[name="allStudentsPrintMode"]:checked')?.value || 'grade');
    const selectedGrades = getSelectedAllStudentsCheckboxValues('.print-grade-option');
    const selectedSections = getSelectedAllStudentsCheckboxValues('.print-section-option');

    const filteredRows = rows.filter((student) => {
        const studentGrade = normalizeGrade(student.grade_level);
        const section = buildSectionLabel(student);
        const gradeOk = selectedGrades.length === 0 ? true : selectedGrades.includes(studentGrade);
        const sectionOk = selectedSections.length === 0 ? true : selectedSections.includes(section);
        return gradeOk && sectionOk;
    });

    if (!filteredRows.length) {
        showInlineToast('No students match the selected print options', 'error');
        return;
    }

    const context = buildAllStudentsExportContext();
    const printHtml = generateAllStudentsPrintHtml(filteredRows, context, mode, selectedGrades, selectedSections);
    closeAllStudentsPrintModal();

    const printWindow = window.open('', '_blank', 'width=1100,height=850');
    if (!printWindow) {
        showInlineToast('Unable to open print preview. Please allow pop-ups.', 'error');
        return;
    }

    printWindow.document.open();
    printWindow.document.write(printHtml);
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => {
        printWindow.print();
    };
}

function printClassList() {
    bindAllStudentsPrintModalEvents();
    openAllStudentsPrintModal();
}

function exportToExcel() {
        const rows = getAllStudentsExportRows();
        if (!rows.length) {
                showInlineToast('No students to export', 'error');
                return;
        }

        const context = buildAllStudentsExportContext();
        exportStudentsToStyledExcel('all-students-report.xls', rows, context);
}

function exportToPDF() {
    window.print();
}

function getTeachingSectionStudentsForPrint() {
    if (!currentSubjectViewing) return [];

    return (Array.isArray(allStudents) ? allStudents : [])
        .filter((student) => doesStudentMatchSection(student, currentSubjectViewing))
        .slice()
        .sort((a, b) => String(a.fullName || '').localeCompare(String(b.fullName || '')));
}

function buildTeachingPrintContext(rows) {
    const list = Array.isArray(rows) ? rows : [];
    const schoolName = String(document.getElementById('schoolName')?.textContent || 'School Management System').trim();
    const teacherName = String(currentTeacher?.name || document.getElementById('teacherProfileName')?.textContent || 'Teacher').trim();
    const schoolYear = String(document.getElementById('schoolYearDisplay')?.textContent || 'Not Set').trim();
    const subjectName = String(currentSubjectViewing?.subject || 'Subject').trim();
    const sectionName = String(
        currentSubjectViewing?.sectionName || currentSubjectViewing?.sectionCode || currentSubjectViewing?.sectionId || 'N/A'
    ).trim();

    const gradeSet = new Set(
        list
            .map((student) => normalizeGrade(student.grade_level))
            .filter(Boolean)
            .map((grade) => `Grade ${grade}`)
    );

    return {
        schoolName,
        teacherName,
        schoolYear,
        subjectName,
        sectionName,
        totalStudents: list.length,
        gradeLevels: Array.from(gradeSet).sort((a, b) => a.localeCompare(b)),
        generatedAt: new Date().toLocaleString()
    };
}

function generateTeachingClassPrintHtml(rows, context) {
    const list = Array.isArray(rows) ? rows : [];
    const meta = context && typeof context === 'object' ? context : buildTeachingPrintContext(list);

    const tableRows = list.map((student, index) => {
        return `
            <tr>
                <td class="col-num">${index + 1}</td>
                <td class="col-lrn">${escapeHtml(student.lrn || '-')}</td>
                <td>${escapeHtml(student.fullName || '-')}</td>
            </tr>
        `;
    }).join('');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Teaching Assignment Class List</title>
    <style>
        @page { size: A4 portrait; margin: 12mm; }
        * { box-sizing: border-box; }
        body { margin: 0; color: #0f172a; font-family: Arial, sans-serif; }
        .print-shell { width: 100%; }
        .report-header { text-align: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 12px; }
        .school-name { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.2px; }
        .report-title { margin: 5px 0 0; font-size: 15px; font-weight: 700; color: #1f2937; text-transform: uppercase; }
        .report-subtitle { margin: 4px 0 0; font-size: 12px; color: #475569; }
        .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin-bottom: 12px; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; background: #f8fafc; }
        .meta-item { font-size: 12px; line-height: 1.4; }
        .meta-label { font-weight: 700; color: #0f172a; }
        table { width: 100%; border-collapse: collapse; border: 1px solid #94a3b8; }
        thead th { background: #e2e8f0; color: #0f172a; font-size: 12px; text-transform: uppercase; letter-spacing: 0.3px; border-bottom: 1px solid #94a3b8; padding: 8px 9px; text-align: left; }
        tbody td { border-top: 1px solid #cbd5e1; padding: 7px 9px; font-size: 12px; vertical-align: top; }
        tbody tr:nth-child(even) { background: #f8fafc; }
        .col-num { width: 44px; text-align: center; }
        .col-lrn { width: 170px; }
        .report-footer { margin-top: 12px; font-size: 11px; color: #475569; display: flex; justify-content: space-between; }
    </style>
</head>
<body>
    <div class="print-shell">
        <div class="report-header">
            <h1 class="school-name">${escapeHtml(meta.schoolName)}</h1>
            <h2 class="report-title">Subject Teacher Class List</h2>
            <p class="report-subtitle">My Subjects - Teaching Assignment Student Report</p>
        </div>

        <div class="meta-grid">
            <div class="meta-item"><span class="meta-label">Teacher:</span> ${escapeHtml(meta.teacherName)}</div>
            <div class="meta-item"><span class="meta-label">School Year:</span> ${escapeHtml(meta.schoolYear)}</div>
            <div class="meta-item"><span class="meta-label">Subject:</span> ${escapeHtml(meta.subjectName)}</div>
            <div class="meta-item"><span class="meta-label">Section:</span> ${escapeHtml(meta.sectionName)}</div>
            <div class="meta-item"><span class="meta-label">Grade Levels:</span> ${escapeHtml(meta.gradeLevels.length ? meta.gradeLevels.join(', ') : 'N/A')}</div>
            <div class="meta-item"><span class="meta-label">Total Students:</span> ${meta.totalStudents}</div>
            <div class="meta-item" style="grid-column: 1 / -1;"><span class="meta-label">Generated:</span> ${escapeHtml(meta.generatedAt)}</div>
        </div>

        <table>
            <thead>
                <tr>
                    <th class="col-num">#</th>
                    <th class="col-lrn">LRN</th>
                    <th>Full Name</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
        </table>

        <div class="report-footer">
            <span>${escapeHtml(meta.schoolName)}</span>
            <span>Subject Teacher Dashboard</span>
        </div>
    </div>
</body>
</html>`;
}

/**
 * Print the teaching class list
 */
function printTeachingClassList() {
    if (!currentSubjectViewing) {
        alert('No teaching assignment selected');
        return;
    }

    const rows = getTeachingSectionStudentsForPrint();
    if (!rows.length) {
        showInlineToast('No students to print', 'error');
        return;
    }

    const context = buildTeachingPrintContext(rows);
    const printHtml = generateTeachingClassPrintHtml(rows, context);
    const printWindow = window.open('', '_blank', 'width=1100,height=850');

    if (!printWindow) {
        showInlineToast('Unable to open print preview. Please allow pop-ups.', 'error');
        return;
    }

    printWindow.document.open();
    printWindow.document.write(printHtml);
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => {
        printWindow.print();
    };
}

/**
 * Export teaching class list to Excel
 */
function exportTeachingToExcel() {
    if (!currentSubjectViewing) {
        alert('No teaching assignment selected');
        return;
    }
    const sectionStudents = getTeachingSectionStudentsForPrint();
    const context = buildTeachingPrintContext(sectionStudents);
    const sectionLabel = String(
        currentSubjectViewing.sectionCode || currentSubjectViewing.sectionName || currentSubjectViewing.sectionId || 'section'
    ).replace(/\s+/g, '-').toLowerCase();
    exportTeachingStudentsToStyledExcel(`students-${sectionLabel}.xls`, sectionStudents, context);
}

function exportTeachingStudentsToStyledExcel(filename, rows, context) {
    const sheetRows = Array.isArray(rows) ? rows : [];
    const meta = context && typeof context === 'object' ? context : buildTeachingPrintContext(sheetRows);

    const bodyRows = sheetRows.map((student, index) => `
        <tr>
            <td class="num">${index + 1}</td>
            <td class="lrn">${escapeHtml(student.lrn || '-')}</td>
            <td>${escapeHtml(student.fullName || '-')}</td>
        </tr>
    `).join('');

    const workbookHtml = `
<html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:x="urn:schemas-microsoft-com:office:excel"
            xmlns="http://www.w3.org/TR/REC-html40">
<head>
    <meta charset="UTF-8">
    <style>
        table { border-collapse: collapse; width: 100%; }
        td, th { border: 1px solid #95a5a6; padding: 6px 8px; font-family: Arial, sans-serif; font-size: 11pt; }
        .title { font-size: 16pt; font-weight: 700; text-align: center; background: #dbeafe; }
        .subtitle { font-size: 12pt; font-weight: 700; text-align: center; background: #eff6ff; }
        .meta { background: #f8fafc; }
        .head { background: #1f3b6e; color: #ffffff; font-weight: 700; }
        .num { text-align: center; }
        .lrn { mso-number-format:"\@"; }
    </style>
</head>
<body>
    <table>
        <tr><td class="title" colspan="3">${escapeHtml(meta.schoolName)}</td></tr>
        <tr><td class="subtitle" colspan="3">Subject Teacher Class List</td></tr>
        <tr><td class="meta" colspan="3"></td></tr>
        <tr>
            <td class="meta"><b>Teacher:</b> ${escapeHtml(meta.teacherName)}</td>
            <td class="meta"><b>School Year:</b> ${escapeHtml(meta.schoolYear)}</td>
            <td class="meta"><b>Total:</b> ${sheetRows.length}</td>
        </tr>
        <tr>
            <td class="meta"><b>Subject:</b> ${escapeHtml(meta.subjectName)}</td>
            <td class="meta"><b>Section:</b> ${escapeHtml(meta.sectionName)}</td>
            <td class="meta"><b>Grade Levels:</b> ${escapeHtml(meta.gradeLevels.length ? meta.gradeLevels.join(', ') : 'N/A')}</td>
        </tr>
        <tr><td class="meta" colspan="3"><b>Generated:</b> ${escapeHtml(meta.generatedAt)}</td></tr>
        <tr>
            <th class="head">#</th>
            <th class="head">LRN</th>
            <th class="head">Full Name</th>
        </tr>
        ${bodyRows}
    </table>
</body>
</html>`;

    const blob = new Blob([workbookHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showInlineToast('Excel exported successfully', 'success');
}

/**
 * Export teaching class list to PDF
 */
function exportTeachingToPDF() {
    if (!currentSubjectViewing) {
        alert('No teaching assignment selected');
        return;
    }
    // Use html2pdf to download the print layout as PDF
    const rows = getTeachingSectionStudentsForPrint();
    if (!rows.length) {
        showInlineToast('No students to export', 'error');
        return;
    }
    const context = buildTeachingPrintContext(rows);
    const printHtml = generateTeachingClassPrintHtml(rows, context);

    // Create a hidden container for html2pdf
    const container = document.createElement('div');
    container.style.display = 'none';
    container.innerHTML = printHtml;
    document.body.appendChild(container);

    // Load html2pdf if not already loaded
    function runHtml2Pdf() {
        html2pdf()
            .set({
                margin: 12,
                filename: 'teaching-class-list.pdf',
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            })
            .from(container)
            .save()
            .then(() => {
                document.body.removeChild(container);
            });
    }

    if (typeof window.html2pdf === 'function') {
        runHtml2Pdf();
    } else {
        const script = document.createElement('script');
        script.src = 'html2pdf.bundle.min.js';
        script.onload = runHtml2Pdf;
        document.body.appendChild(script);
    }
}

function exportStudentsToCsv(filename, rows) {
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) {
        showInlineToast('No students to export', 'error');
        return;
    }

    const header = ['LRN', 'Full Name', 'Grade', 'Section'];
    const body = list.map((student) => [
        String(student.lrn || ''),
        String(student.fullName || ''),
        String(student.grade_level || ''),
        String(student.section || student.section_code || '')
    ]);

    const csv = [header, ...body]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showInlineToast('CSV exported successfully', 'success');
}

function getAllStudentsExportRows() {
        if (Array.isArray(lastDisplayedStudents)) {
                return lastDisplayedStudents.slice();
        }
        return Array.isArray(allStudents) ? allStudents.slice() : [];
}

function buildAllStudentsExportContext() {
        const schoolName = String(document.getElementById('schoolName')?.textContent || 'School Management System').trim();
        const teacherName = String(currentTeacher?.name || document.getElementById('teacherProfileName')?.textContent || 'Teacher').trim();
        const schoolYear = String(document.getElementById('schoolYearDisplay')?.textContent || 'Not Set').trim();
        const searchText = String(document.getElementById('studentSearchInput')?.value || '').trim();
        const gradeFilter = String(document.getElementById('studentGradeFilter')?.value || '').trim();

        return {
                schoolName,
                teacherName,
                schoolYear,
                searchText,
                gradeFilterLabel: gradeFilter ? `Grade ${gradeFilter}` : 'All Grades',
                generatedAt: new Date().toLocaleString()
        };
}

function exportStudentsToStyledExcel(filename, rows, context) {
        const sheetRows = Array.isArray(rows) ? rows : [];
        const exportContext = context && typeof context === 'object' ? context : buildAllStudentsExportContext();

        const bodyRows = sheetRows.map((student, index) => `
                <tr>
                        <td class="num">${index + 1}</td>
                        <td class="lrn">${escapeHtml(student.lrn || '-')}</td>
                        <td>${escapeHtml(student.fullName || '-')}</td>
                        <td>${escapeHtml(student.grade_level || '-')}</td>
                        <td>${escapeHtml(student.section || student.section_code || '-')}</td>
                </tr>
        `).join('');

        const workbookHtml = `
<html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:x="urn:schemas-microsoft-com:office:excel"
            xmlns="http://www.w3.org/TR/REC-html40">
<head>
    <meta charset="UTF-8">
    <style>
        table { border-collapse: collapse; width: 100%; }
        td, th { border: 1px solid #95a5a6; padding: 6px 8px; font-family: Arial, sans-serif; font-size: 11pt; }
        .title { font-size: 16pt; font-weight: 700; text-align: center; background: #dbeafe; }
        .subtitle { font-size: 12pt; font-weight: 700; text-align: center; background: #eff6ff; }
        .meta { background: #f8fafc; }
        .head { background: #1f3b6e; color: #ffffff; font-weight: 700; }
        .num { text-align: center; }
        .lrn { mso-number-format:\"\\@\"; }
    </style>
</head>
<body>
    <table>
        <tr><td class="title" colspan="5">${escapeHtml(exportContext.schoolName)}</td></tr>
        <tr><td class="subtitle" colspan="5">All Students Class List</td></tr>
        <tr><td class="meta" colspan="5"></td></tr>
        <tr>
            <td class="meta" colspan="2"><b>Teacher:</b> ${escapeHtml(exportContext.teacherName)}</td>
            <td class="meta" colspan="2"><b>School Year:</b> ${escapeHtml(exportContext.schoolYear)}</td>
            <td class="meta"><b>Total:</b> ${sheetRows.length}</td>
        </tr>
        <tr>
            <td class="meta" colspan="2"><b>Search Filter:</b> ${escapeHtml(exportContext.searchText || 'None')}</td>
            <td class="meta" colspan="2"><b>Grade Filter:</b> ${escapeHtml(exportContext.gradeFilterLabel || 'All Grades')}</td>
            <td class="meta"><b>Generated:</b> ${escapeHtml(exportContext.generatedAt)}</td>
        </tr>
        <tr><td class="meta" colspan="5"></td></tr>
        <tr>
            <th class="head">#</th>
            <th class="head">LRN</th>
            <th class="head">Full Name</th>
            <th class="head">Grade</th>
            <th class="head">Section</th>
        </tr>
        ${bodyRows}
    </table>
</body>
</html>`;

        const blob = new Blob([workbookHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showInlineToast('Excel exported successfully', 'success');
}

function setupHeaderInteractions() {
    const profileBtn = document.getElementById('profileBtn');
    const dropdownMenu = document.getElementById('dropdownMenu');
    const settingsBtn = document.querySelector('.settings-btn');
    const notificationBtn = document.querySelector('.notification-btn');
    const chatBtn = document.getElementById('chatBtn');
    const chatPanel = document.getElementById('chatPanel');
    const chatCloseBtn = document.getElementById('chatCloseBtn');
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const sidebar = document.getElementById('sidebar');

    const switchToSection = (sectionId) => {
        if (!sectionId) return;
        const menuItem = document.querySelector(`.sidebar .menu-item[data-section="${sectionId}"]`);
        if (menuItem) {
            menuItem.click();
            return;
        }

        document.querySelectorAll('.section').forEach((section) => section.classList.remove('active'));
        document.querySelectorAll('.sidebar .menu-item').forEach((node) => node.classList.remove('active'));
        const target = document.getElementById(sectionId);
        if (target) target.classList.add('active');
    };

    if (profileBtn && dropdownMenu && profileBtn.dataset.bound !== '1') {
        profileBtn.dataset.bound = '1';
        profileBtn.addEventListener('click', (event) => {
            event.preventDefault();
            dropdownMenu.classList.toggle('active');
        });
    }

    const accountLinks = Array.from(document.querySelectorAll('.dropdown-item')).filter((node) => {
        return String(node.textContent || '').trim().toLowerCase() === 'account settings';
    });
    accountLinks.forEach((link) => {
        if (link.dataset.bound === '1') return;
        link.dataset.bound = '1';
        link.addEventListener('click', (event) => {
            event.preventDefault();
            switchToSection('settings');
            if (dropdownMenu) dropdownMenu.classList.remove('active');
        });
    });

    if (settingsBtn && settingsBtn.dataset.bound !== '1') {
        settingsBtn.dataset.bound = '1';
        settingsBtn.addEventListener('click', (event) => {
            event.preventDefault();
            switchToSection('settings');
        });
    }

    if (notificationBtn && notificationBtn.dataset.bound !== '1') {
        notificationBtn.dataset.bound = '1';
        notificationBtn.addEventListener('click', async (event) => {
            event.preventDefault();
            openTeacherNotificationCenter();
            bindTeacherNotificationCenterEvents();
            await loadTeacherNotifications();
        });
    }

    if (chatBtn && chatPanel && chatBtn.dataset.bound !== '1') {
        chatBtn.dataset.bound = '1';
        chatBtn.addEventListener('click', (event) => {
            event.preventDefault();
            chatPanel.style.display = 'flex';
            chatPanel.setAttribute('aria-hidden', 'false');
        });
    }

    if (chatCloseBtn && chatPanel && chatCloseBtn.dataset.bound !== '1') {
        chatCloseBtn.dataset.bound = '1';
        chatCloseBtn.addEventListener('click', () => {
            chatPanel.style.display = 'none';
            chatPanel.setAttribute('aria-hidden', 'true');
        });
    }

    if (hamburgerBtn && sidebar && hamburgerBtn.dataset.bound !== '1') {
        hamburgerBtn.dataset.bound = '1';
        hamburgerBtn.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            hamburgerBtn.classList.toggle('active');
            document.body.classList.toggle('sidebar-open', sidebar.classList.contains('active'));
        });
    }

    document.addEventListener('click', (event) => {
        if (dropdownMenu && profileBtn && !profileBtn.contains(event.target) && !dropdownMenu.contains(event.target)) {
            dropdownMenu.classList.remove('active');
        }

        if (sidebar && sidebar.classList.contains('active')) {
            const clickedSidebar = sidebar.contains(event.target);
            const clickedHamburger = hamburgerBtn && hamburgerBtn.contains(event.target);
            if (!clickedSidebar && !clickedHamburger && window.innerWidth <= 768) {
                sidebar.classList.remove('active');
                if (hamburgerBtn) hamburgerBtn.classList.remove('active');
                document.body.classList.remove('sidebar-open');
            }
        }
    });
}

function getCurrentTeacherId() {
    return Number(currentTeacher?.id || currentTeacher?.teacher_id || 0) || null;
}

async function refreshTeacherNotificationBadge(showMessage = false) {
    const badge = document.getElementById('notificationBadge');
    const teacherId = getCurrentTeacherId();
    if (!badge || !teacherId) return;

    try {
        const data = await tenantFetchJson(`/api/notifications/teacher/${teacherId}/unread-count`);
        const count = Number(data?.unread_count || 0);
        badge.textContent = String(count);
        badge.style.display = count > 0 ? 'inline-flex' : 'none';
        if (showMessage) {
            showInlineToast(count > 0 ? `You have ${count} unread notification(s)` : 'No unread notifications', 'success');
        }
    } catch (_err) {
        if (showMessage) {
            showInlineToast('Unable to load notifications', 'error');
        }
    }
}

/* ==========================
   Theme Customization Logic
   ========================== */

const THEME_KEY = 'subjectTeacherTheme';
const THEME_MODE_KEY = 'subjectTeacherThemeMode';

function getThemeStorageKey() {
    const school = detectSchoolCode();
    return school ? `${THEME_KEY}:${school}` : THEME_KEY;
}

function getThemeModeStorageKey() {
    const school = detectSchoolCode();
    return school ? `${THEME_MODE_KEY}:${school}` : THEME_MODE_KEY;
}

function normalizeThemeObject(theme) {
    const src = theme && typeof theme === 'object' ? theme : {};
    const primary = String(src['--primary-green'] || src['--primary-color'] || '').trim();
    const primaryDark = String(src['--primary-dark-green'] || src['--primary-dark'] || '').trim();
    const secondary = String(src['--secondary-color'] || '').trim();
    const light = String(src['--light'] || '').trim();

    const out = {};
    if (primary) {
        out['--primary-green'] = primary;
        out['--primary-color'] = primary;
    }
    if (primaryDark) {
        out['--primary-dark-green'] = primaryDark;
        out['--primary-dark'] = primaryDark;
    }
    if (secondary) out['--secondary-color'] = secondary;
    if (light) out['--light'] = light;
    return out;
}

function applyThemeObject(theme) {
    const root = document.documentElement;
    if (!theme) return;
    const normalized = normalizeThemeObject(theme);
    Object.keys(normalized).forEach(k => {
        root.style.setProperty(k, normalized[k]);
    });
}

function getDefaultTheme() {
    return {
        '--primary-green': '#1e5631',
        '--primary-dark-green': '#0d3b1f',
        '--secondary-color': '#4facfe',
        '--light': '#f8f9fa'
    };
}

function saveTheme(themeObj) {
    try {
        const mapped = normalizeThemeObject(themeObj);
        const normalized = {};
        Object.keys(mapped).forEach(k=>{
            let v = String(mapped[k] || '').trim();
            if (!v) return;
            if (!v.startsWith('#')) v = rgbToHex(v) || v;
            normalized[k] = v;
        });
        localStorage.setItem(getThemeStorageKey(), JSON.stringify(normalized));
        localStorage.setItem(THEME_KEY, JSON.stringify(normalized));
    } catch (e) {
        console.error('Failed to save theme', e);
    }
}

function loadSavedTheme() {
    const saved = localStorage.getItem(getThemeStorageKey()) || localStorage.getItem(THEME_KEY);
    if (saved) {
        try {
            const obj = normalizeThemeObject(JSON.parse(saved));
            applyThemeObject(obj);
            if (document.getElementById('themePrimary')) {
                document.getElementById('themePrimary').value = rgbToHex(obj['--primary-green'] || obj['--primary-color']);
                document.getElementById('themePrimaryDark').value = rgbToHex(obj['--primary-dark-green'] || obj['--primary-dark']);
                document.getElementById('themeSecondary').value = rgbToHex(obj['--secondary-color']);
                document.getElementById('themeLight').value = rgbToHex(obj['--light']);
            }
        } catch (e) { console.error('Invalid saved theme', e); }
    }
}

function rgbToHex(val) {
    if (!val) return '#000000';
    val = val.trim();
    if (val.startsWith('#')) return val;
    const m = val.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!m) return val;
    const r = parseInt(m[1]).toString(16).padStart(2,'0');
    const g = parseInt(m[2]).toString(16).padStart(2,'0');
    const b = parseInt(m[3]).toString(16).padStart(2,'0');
    return `#${r}${g}${b}`;
}

function openThemeModal() {
    const m = document.getElementById('themeModal');
    if (m) m.classList.add('active');
}

function closeThemeModal() {
    const m = document.getElementById('themeModal');
    if (m) m.classList.remove('active');
}

function setThemeMode(mode, save=true) {
    const root = document.documentElement;
    const body = document.body;
    if (mode === 'dark') {
        root.classList.add('dark-theme');
        if (body) body.classList.add('dark-mode');
        const modeBtn = document.getElementById('modeToggleBtn');
        if (modeBtn) modeBtn.textContent = '☀️';
    } else {
        root.classList.remove('dark-theme');
        if (body) body.classList.remove('dark-mode');
        const modeBtn = document.getElementById('modeToggleBtn');
        if (modeBtn) modeBtn.textContent = '🌙';
    }
    if (save) {
        localStorage.setItem(getThemeModeStorageKey(), mode);
        localStorage.setItem(THEME_MODE_KEY, mode);
    }
}

function toggleThemeMode() {
    const current = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
    setThemeMode(current === 'dark' ? 'light' : 'dark', true);
}

function loadSavedMode() {
    const saved = localStorage.getItem(getThemeModeStorageKey()) || localStorage.getItem(THEME_MODE_KEY);
    if (saved) {
        setThemeMode(saved, false);
    } else {
        try {
            const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            setThemeMode(prefersDark ? 'dark' : 'light', false);
        } catch (e) { setThemeMode('light', false); }
    }
}

function buildPresets() {
    const presets = [
        {name:'Default', primary:'#667eea', primaryDark:'#764ba2', secondary:'#4facfe', light:'#f8f9fa'},
        {name:'Emerald', primary:'#10b981', primaryDark:'#047857', secondary:'#34d399', light:'#f0fdf4'},
        {name:'Sunset', primary:'#ff7a59', primaryDark:'#d9480f', secondary:'#ffb86b', light:'#fff7ed'},
        {name:'Slate', primary:'#334155', primaryDark:'#0f172a', secondary:'#64748b', light:'#f8fafc'}
    ];
    const container = document.getElementById('themePresets');
    if (!container) return;
    container.innerHTML = '';
    presets.forEach(p=>{
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'theme-preset';
        btn.title = p.name;
        btn.innerHTML = `<div class="swatch" style="background: linear-gradient(90deg, ${p.primary} 0%, ${p.primaryDark} 100%);"></div>`;
        btn.addEventListener('click', ()=>{
            document.querySelectorAll('.theme-preset').forEach(x=>x.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('themePrimary').value = p.primary;
            document.getElementById('themePrimaryDark').value = p.primaryDark;
            document.getElementById('themeSecondary').value = p.secondary;
            document.getElementById('themeLight').value = p.light;
            applyThemeFromInputs(false);
        });
        container.appendChild(btn);
    });
}

function applyThemeFromInputs(shouldSave=true) {
    const primary = document.getElementById('themePrimary').value;
    const primaryDark = document.getElementById('themePrimaryDark').value;
    const secondary = document.getElementById('themeSecondary').value;
    const light = document.getElementById('themeLight').value;
    const themeObj = {
        '--primary-green': primary,
        '--primary-dark-green': primaryDark,
        '--secondary-color': secondary,
        '--light': light
    };
    applyThemeObject(themeObj);
    if (shouldSave) saveTheme(themeObj);
}

function resetThemeToDefault() {
    const def = getDefaultTheme();
    applyThemeObject(def);
    saveTheme(def);
    if (document.getElementById('themePrimary')) {
        document.getElementById('themePrimary').value = rgbToHex(def['--primary-green']);
        document.getElementById('themePrimaryDark').value = rgbToHex(def['--primary-dark-green']);
        document.getElementById('themeSecondary').value = rgbToHex(def['--secondary-color']);
        document.getElementById('themeLight').value = rgbToHex(def['--light']);
    }
}

// Missing theme functions
function openThemeModal() {
    const modal = document.getElementById('themeModal');
    if (modal) {
        modal.style.display = 'block';
        modal.setAttribute('aria-hidden', 'false');
    }
}

function closeThemeModal() {
    const modal = document.getElementById('themeModal');
    if (modal) {
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
    }
}

function buildPresets() {
    // Theme presets implementation
    console.log('Building theme presets...');
}

function applyThemeFromInputs(save) {
    // Apply theme from inputs implementation
    console.log('Applying theme from inputs, save:', save);
}

function resetThemeToDefault() {
    // Reset theme to default implementation
    console.log('Resetting theme to default');
}

function toggleThemeMode() {
    // Toggle theme mode implementation
    console.log('Toggling theme mode');
}

function loadSavedTheme() {
    // Load saved theme implementation
    console.log('Loading saved theme');
}

function loadSavedMode() {
    // Load saved mode implementation
    console.log('Loading saved mode');
}

function rgbToHex(rgb) {
    // Convert RGB to hex implementation
    if (typeof rgb !== 'string') return '#000000';
    const match = rgb.match(/\d+/g);
    if (!match || match.length < 3) return '#000000';
    const r = parseInt(match[0]);
    const g = parseInt(match[1]);
    const b = parseInt(match[2]);
    return '#' + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

// Wire up theme modal controls
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('themeBtn');
    const closeBtn = document.getElementById('closeThemeModal');
    const applyBtn = document.getElementById('applyThemeBtn');
    const saveBtn = document.getElementById('saveThemeBtn');
    const resetBtn = document.getElementById('resetThemeBtn');
    const modal = document.getElementById('themeModal');

    if (btn) btn.addEventListener('click', ()=>{ openThemeModal(); buildPresets(); });
    if (closeBtn) closeBtn.addEventListener('click', closeThemeModal);
    if (modal) {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) closeThemeModal();
        });
    }
    if (applyBtn) applyBtn.addEventListener('click', ()=> applyThemeFromInputs(false));
    if (saveBtn) saveBtn.addEventListener('click', ()=>{ applyThemeFromInputs(true); closeThemeModal(); });
    if (resetBtn) resetBtn.addEventListener('click', ()=>{ if(confirm('Reset theme to defaults?')) resetThemeToDefault(); });

    const modeToggle = document.getElementById('modeToggleBtn');
    if (modeToggle) modeToggle.addEventListener('click', toggleThemeMode);

    ['themePrimary','themePrimaryDark','themeSecondary','themeLight'].forEach(id=>{
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', ()=> applyThemeFromInputs(false));
    });

    loadSavedTheme();
    loadSavedMode();
}, { once: true });

