/**
 * Guidance Dashboard JavaScript v2
 * Enhanced with sidebar navigation and section management
 */

const API_BASE = window.location.origin;
let currentCounselorId = null;
let allRequests = [];
let allRiskFlags = [];
let counselorName = 'Counselor';
let activeSchoolCode = '';

function detectSchoolCode() {
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
    } catch (_e) {}

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

function withSchoolParam(path) {
    if (!activeSchoolCode) return path;
    try {
        const url = new URL(path, window.location.origin);
        url.searchParams.set('school', activeSchoolCode);
        return `${url.pathname}${url.search}${url.hash || ''}`;
    } catch (_err) {
        return path;
    }
}

function appendSchoolParamToLinks(code) {
    if (!code) return;
    const anchors = document.querySelectorAll('a[href$=".html"], a[href*=".html?"]');
    anchors.forEach((anchor) => {
        const href = anchor.getAttribute('href') || '';
        if (!href || href.startsWith('#')) return;
        anchor.setAttribute('href', withSchoolParam(href));
    });
}

function applySchoolTheme(branding) {
    const theme = branding && typeof branding === 'object' ? branding : {};
    const root = document.documentElement;
    const primary = String(theme.primary || theme.brand700 || '').trim();
    const secondary = String(theme.secondary || theme.brand600 || '').trim();
    if (primary) root.style.setProperty('--primary-green', primary);
    if (secondary) root.style.setProperty('--primary-dark-green', secondary);
}

function setSchoolFavicon(logoValue, schoolCode) {
    const fallback = 'logo.png';
    const raw = String(logoValue || '').trim();
    const isDataUrl = /^data:/i.test(raw);
    const cacheSuffix = `school=${encodeURIComponent(String(schoolCode || 'default').toLowerCase())}&t=${Date.now()}`;
    const finalHref = raw
        ? (isDataUrl ? raw : `${raw}${raw.includes('?') ? '&' : '?'}${cacheSuffix}`)
        : `${fallback}?${cacheSuffix}`;

    const ensureLink = (relValue) => {
        let link = document.querySelector(`link[rel="${relValue}"]`);
        if (!link) {
            link = document.createElement('link');
            link.setAttribute('rel', relValue);
            document.head.appendChild(link);
        }
        link.setAttribute('href', finalHref);
        link.setAttribute('type', 'image/png');
    };

    ensureLink('icon');
    ensureLink('shortcut icon');
}

async function bootstrapSchoolBranding() {
    const detected = detectSchoolCode();
    activeSchoolCode = detected;

    const endpoint = detected
        ? `/api/system-health/schools/resolve?code=${encodeURIComponent(detected)}`
        : '/api/system-health/schools/resolve';

    try {
        const response = await fetch(endpoint);
        if (!response.ok) return;
        const payload = await response.json();
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
        const schoolLogo = String(school.logoData || '').trim();

        document.title = `${schoolName} - Guidance Dashboard`;

        const schoolNameNode = document.getElementById('schoolName');
        if (schoolNameNode) schoolNameNode.textContent = schoolName;

        const schoolSubtitleNode = document.getElementById('schoolSubtitle');
        if (schoolSubtitleNode) {
            schoolSubtitleNode.textContent = String(school.schoolId || school.code || 'School Management System');
        }

        const schoolLogoNode = document.getElementById('schoolLogo');
        if (schoolLogoNode && schoolLogo) schoolLogoNode.setAttribute('src', schoolLogo);

        setSchoolFavicon(schoolLogo || '', activeSchoolCode);
        applySchoolTheme(school.branding || {});
        appendSchoolParamToLinks(activeSchoolCode);
    } catch (_err) {
        // keep defaults if school resolver is unavailable
    }
}

async function apiFetch(path, options = {}) {
    let requestPath = String(path || '');
    const isAbsolute = /^https?:\/\//i.test(requestPath);
    const isApiPath = !isAbsolute && requestPath.startsWith('/api/');

    if (isApiPath && activeSchoolCode) {
        try {
            const urlObj = new URL(requestPath, window.location.origin);
            urlObj.searchParams.set('school', activeSchoolCode);
            requestPath = `${urlObj.pathname}${urlObj.search}`;
        } catch (_err) {}
    }

    const headers = {
        ...(options.headers || {}),
        ...(isApiPath && activeSchoolCode ? { 'x-tenant-code': activeSchoolCode } : {})
    };

    const requestUrl = isAbsolute ? requestPath : `${API_BASE}${requestPath}`;
    return fetch(requestUrl, { ...options, headers });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[Guidance Dashboard v2] Initializing...');
    await bootstrapSchoolBranding();
    
    // ✅ FIX: Check for tab-scoped session first
    let adminData = null;
    
    if (typeof sessionManager !== 'undefined' && sessionManager.getTabSession) {
        const tabScopedData = sessionManager.getTabSession('adminData');
        if (tabScopedData) {
            console.log('[Guidance Dashboard v2] Using tab-scoped session (Tab ID:', sessionManager.getTabId(), ')');
            adminData = tabScopedData;
        }
    }
    
    // Fallback to localStorage if no tab-scoped session
    if (!adminData) {
        const adminDataStr = localStorage.getItem('adminData');
        if (!adminDataStr) {
            console.error('[Guidance Dashboard v2] No admin data found - redirecting to login');
            window.location.href = withSchoolParam('auth.html?role=admin');
            return;
        }
        adminData = JSON.parse(adminDataStr);
        console.log('[Guidance Dashboard v2] Using localStorage data (Note: other tabs may have changed role)');
    }
    
    // Role-based access control: Only Guidance users can access this dashboard
    if (!adminData.role || adminData.role.toLowerCase() !== 'guidance') {
        console.error('[Guidance Dashboard v2] ❌ Access denied - user is not a guidance counselor');
        console.log('[Guidance Dashboard v2] 🔄 Redirecting to Admin Dashboard...');
        window.location.href = withSchoolParam('admin-dashboard.html');
        return;
    }

    currentCounselorId = adminData.id;
    counselorName = adminData.name || 'Counselor';
    
    // Set counselor name in header
    document.getElementById('counselorName').textContent = counselorName;
    
    console.log('[Guidance Dashboard v2] ✅ Authorized as guidance counselor:', counselorName);

    // Setup event listeners
    setupHeaderEvents();
    
    // Load initial data
    await loadDashboardData();
    
    // Auto-refresh every 30 seconds
    setInterval(loadDashboardData, 30000);
    
    // Refresh on window focus (user switched tabs and came back)
    window.addEventListener('focus', async () => {
        console.log('[Guidance Dashboard v2] Window focused - validating role');
        // Re-validate role is still 'guidance' in case admin changed it
        await loadDashboardData();
    });
    
    // ✅ FIX: Monitor for role changes from other tabs (tab visibility change)
    // Only redirect if role definitively changed to something other than guidance
    if (typeof onTabVisible !== 'undefined') {
        onTabVisible(() => {
            // When tab becomes visible after being hidden, validate role is still correct
            const currentUser = typeof sessionManager !== 'undefined' ? 
                sessionManager.getTabSession('adminData') : 
                JSON.parse(localStorage.getItem('adminData') || 'null');
            
            // Only redirect if role is definitely NOT guidance (not if currentUser is null)
            // A null user at this point would be handled by DOMContentLoaded
            if (currentUser && currentUser.role && currentUser.role.toLowerCase() !== 'guidance') {
                console.warn('[Guidance Dashboard v2] ⚠️ Role changed from guidance to', currentUser.role, '- redirecting');
                // If role changed to admin, go to admin dashboard; otherwise go to login
                if (currentUser.role.toLowerCase() === 'admin') {
                    window.location.href = withSchoolParam('admin-dashboard.html');
                } else {
                    window.location.href = withSchoolParam('auth.html?role=admin');
                }
            }
        });
    }
});

// ============================================
// HEADER EVENTS
// ============================================

function setupHeaderEvents() {
    // Setup logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }

    // Setup profile dropdown toggle
    const profileBtn = document.getElementById('profileBtn');
    const dropdownMenu = document.getElementById('dropdownMenu');
    if (profileBtn && dropdownMenu) {
        profileBtn.addEventListener('click', (e) => {
            e.preventDefault();
            dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.profile-dropdown')) {
                dropdownMenu.style.display = 'none';
            }
        });
    }

    // Setup hamburger menu (if needed for sidebar)
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    if (hamburgerBtn) {
        hamburgerBtn.addEventListener('click', () => {
            const sidebar = document.getElementById('sidebar');
            if (sidebar) {
                sidebar.style.display = sidebar.style.display === 'none' ? 'block' : 'none';
            }
        });
    }
}

// ============================================
// SIDEBAR NAVIGATION
// ============================================

function toggleSubmenu(button) {
    // Prevent event propagation
    event?.preventDefault();
    event?.stopPropagation();
    
    const submenu = button?.nextElementSibling;
    if (!submenu) {
        console.warn('[Guidance Dashboard v2] ⚠️ No submenu found after button');
        return;
    }
    
    const chevron = button?.querySelector('.chevron');
    if (!chevron) {
        console.warn('[Guidance Dashboard v2] ⚠️ No chevron icon found in button');
        return;
    }
    
    // Determine if submenu is currently shown
    const isShown = submenu.style.display === 'block' || submenu.classList.contains('show');
    
    // Close all OTHER submenus (but not the current one)
    document.querySelectorAll('.submenu').forEach(menu => {
        if (menu !== submenu) {
            menu.style.display = 'none';
            menu.classList.remove('show');
            
            // Close the chevron for other menus
            const otherChevron = menu.previousElementSibling?.querySelector?.('.chevron');
            if (otherChevron) {
                otherChevron.style.transform = 'rotate(0deg)';
            }
        }
    });
    
    // Toggle current submenu
    if (isShown) {
        // Close the submenu
        submenu.style.display = 'none';
        submenu.classList.remove('show');
        chevron.style.transform = 'rotate(0deg)';
        console.log('[Guidance Dashboard v2] 📋 Submenu closed');
    } else {
        // Open the submenu  
        submenu.style.display = 'block';
        submenu.classList.add('show');
        chevron.style.transform = 'rotate(90deg)';
        console.log('[Guidance Dashboard v2] 📋 Submenu opened');
    }
}

function showSection(sectionId) {
    // Prevent default link behavior
    event?.preventDefault();
    
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show target section
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // Update menu items
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active-menu');
    });
    
    // Mark current menu item as active
    const activeMenuItem = event?.target?.closest('.menu-item');
    if (activeMenuItem) {
        activeMenuItem.classList.add('active-menu');
    }
    
    // Load section-specific data
    switch(sectionId) {
        case 'all-requests':
            loadGuidanceRequests();
            break;
        case 'pending-requests':
            loadPendingRequests();
            break;
        case 'completed-requests':
            loadCompletedRequests();
            break;
        case 'risk-students':
            loadRiskStudents();
            break;
        case 'dashboard':
            loadDashboardData();
            break;
    }
    
    console.log('[Guidance Dashboard v2] 📄 Switched to section:', sectionId);
}

// ============================================
// DASHBOARD DATA
// ============================================

async function loadDashboardData() {
    try {
        // Load stats
        const statsResponse = await apiFetch(`/api/guidance/dashboard/stats?counselorId=${encodeURIComponent(currentCounselorId)}`);
        const stats = await statsResponse.json();
        
        document.getElementById('totalCases').textContent = stats.totalCases || 0;
        document.getElementById('pendingCount').textContent = stats.pendingRequests || 0;
        document.getElementById('riskCount').textContent = stats.atRiskStudents || 0;
        document.getElementById('sessionCount').textContent = stats.sessionsToday || 0;
        
        // Load recent requests
        await loadRecentRequests();
        
        console.log('[Guidance Dashboard v2] ✅ Dashboard data loaded:', stats);
    } catch (error) {
        console.error('[Guidance Dashboard v2] Error loading dashboard data:', error);
    }
}

async function loadRecentRequests() {
    try {
        const response = await apiFetch(`/api/guidance/requests?counselorId=${encodeURIComponent(currentCounselorId)}&limit=5`);
        const requests = await response.json();
        
        const tbody = document.getElementById('recentRequestsBody');
        if (!requests || requests.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px; color: #999;">No requests yet</td></tr>';
            return;
        }
        
        tbody.innerHTML = requests.map(request => `
            <tr onclick="openRequestModal(${request.id})">
                <td><strong>${request.student_name || 'N/A'}</strong></td>
                <td>${request.reason || 'N/A'}</td>
                <td><span class="status-badge status-${request.status.toLowerCase()}">${request.status}</span></td>
                <td>${new Date(request.created_at).toLocaleDateString()}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('[Guidance Dashboard v2] Error loading recent requests:', error);
    }
}

// ============================================
// GUIDANCE REQUESTS
// ============================================

async function loadGuidanceRequests() {
    try {
        const response = await apiFetch(`/api/guidance/requests?counselorId=${encodeURIComponent(currentCounselorId)}`);
        allRequests = await response.json();
        displayRequestsTable(allRequests);
        
        console.log('[Guidance Dashboard v2] ✅ Loaded', allRequests.length, 'guidance requests');
    } catch (error) {
        console.error('[Guidance Dashboard v2] Error loading guidance requests:', error);
        const tbody = document.getElementById('requestsTableBody');
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: red; padding: 20px;">Error loading requests</td></tr>`;
    }
}

async function loadPendingRequests() {
    try {
        const response = await apiFetch(`/api/guidance/requests?counselorId=${encodeURIComponent(currentCounselorId)}&status=Pending`);
        const requests = await response.json();
        displayPendingTable(requests);
    } catch (error) {
        console.error('[Guidance Dashboard v2] Error loading pending requests:', error);
    }
}

async function loadCompletedRequests() {
    try {
        const response = await apiFetch(`/api/guidance/requests?counselorId=${encodeURIComponent(currentCounselorId)}&status=Completed`);
        const requests = await response.json();
        displayCompletedTable(requests);
    } catch (error) {
        console.error('[Guidance Dashboard v2] Error loading completed requests:', error);
    }
}

function displayRequestsTable(requests) {
    const tbody = document.getElementById('requestsTableBody');
    if (!requests || requests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 30px; color: #999;">No requests found</td></tr>';
        return;
    }
    
    tbody.innerHTML = requests.map(request => `
        <tr onclick="openRequestModal(${request.id})">
            <td><strong>${request.student_name || 'N/A'}</strong></td>
            <td>${request.grade_level || 'N/A'}</td>
            <td>${request.reason || 'N/A'}</td>
            <td><span class="status-badge status-${request.status.toLowerCase()}">${request.status}</span></td>
            <td>
                <button class="btn btn-secondary" onclick="openRequestModal(${request.id}); event.stopPropagation();">View</button>
            </td>
        </tr>
    `).join('');
}

function displayPendingTable(requests) {
    const tbody = document.getElementById('pendingRequestsBody');
    if (!requests || requests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 30px; color: #999;">No pending requests</td></tr>';
        return;
    }
    
    tbody.innerHTML = requests.map(request => `
        <tr onclick="openRequestModal(${request.id})">
            <td><strong>${request.student_name || 'N/A'}</strong></td>
            <td>${request.grade_level || 'N/A'}</td>
            <td>${request.reason || 'N/A'}</td>
            <td>${new Date(request.created_at).toLocaleDateString()}</td>
            <td>
                <button class="btn btn-secondary" onclick="openRequestModal(${request.id}); event.stopPropagation();">View</button>
            </td>
        </tr>
    `).join('');
}

function displayCompletedTable(requests) {
    const tbody = document.getElementById('completedRequestsBody');
    if (!requests || requests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 30px; color: #999;">No completed requests</td></tr>';
        return;
    }
    
    tbody.innerHTML = requests.map(request => `
        <tr onclick="openRequestModal(${request.id})">
            <td><strong>${request.student_name || 'N/A'}</strong></td>
            <td>${request.reason || 'N/A'}</td>
            <td>${request.completed_date ? new Date(request.completed_date).toLocaleDateString() : 'N/A'}</td>
            <td>
                <button class="btn btn-secondary" onclick="openRequestModal(${request.id}); event.stopPropagation();">View</button>
            </td>
        </tr>
    `).join('');
}

// ============================================
// AT-RISK STUDENTS
// ============================================

async function loadRiskStudents() {
    try {
        const response = await apiFetch(`/api/guidance/risk-flags?counselorId=${encodeURIComponent(currentCounselorId)}`);
        allRiskFlags = await response.json();
        displayRiskStudents(allRiskFlags);
        
        console.log('[Guidance Dashboard v2] ✅ Loaded', allRiskFlags.length, 'at-risk students');
    } catch (error) {
        console.error('[Guidance Dashboard v2] Error loading risk flags:', error);
    }
}

function displayRiskStudents(riskFlags) {
    const tbody = document.getElementById('riskStudentsBody');
    if (!riskFlags || riskFlags.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 30px; color: #999;">No at-risk students</td></tr>';
        return;
    }
    
    tbody.innerHTML = riskFlags.map(flag => `
        <tr>
            <td><strong>${flag.student_name || 'N/A'}</strong></td>
            <td>${flag.grade_level || 'N/A'}</td>
            <td>${flag.flag_type || 'N/A'}</td>
            <td>
                <span class="status-badge" style="background: ${flag.severity === 'High' ? '#FFCDD2' : flag.severity === 'Medium' ? '#FFE0B2' : '#E8F5E9'}; color: ${flag.severity === 'High' ? '#C62828' : flag.severity === 'Medium' ? '#E65100' : '#2E7D32'};">
                    ${flag.severity}
                </span>
            </td>
            <td>
                <button class="btn btn-secondary" onclick="createGuidanceRequest(${flag.student_id});">Create Request</button>
            </td>
        </tr>
    `).join('');
}

// ============================================
// REQUEST MODAL
// ============================================

async function openRequestModal(requestId) {
    try {
        console.log('[Guidance Dashboard v2] 🔍 Opening request modal for ID:', requestId);
        console.log('[Guidance Dashboard v2] 🔍 API_BASE:', API_BASE);
        
        const response = await apiFetch(`/api/guidance/requests/${requestId}`);
        console.log('[Guidance Dashboard v2] 🔍 Response status:', response.status, response.statusText);
        console.log('[Guidance Dashboard v2] 🔍 Content-Type:', response.headers.get('content-type'));
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Guidance Dashboard v2] ❌ API returned error:', errorText.substring(0, 200));
            throw new Error(`Failed to fetch request (${response.status}): ${response.statusText}`);
        }
        
        let request;
        try {
            request = await response.json();
        } catch (jsonError) {
            const textResponse = await response.text();
            console.error('[Guidance Dashboard v2] ❌ Failed to parse JSON response:', textResponse.substring(0, 300));
            throw new Error(`Invalid JSON response from server. Received: ${textResponse.substring(0, 100)}`);
        }
        console.log('[Guidance Dashboard v2] ✅ Request data loaded:', request);
        
        const messagesResponse = await apiFetch(`/api/guidance/messages/${requestId}`);
        let messages = [];
        if (messagesResponse.ok) {
            try {
                messages = await messagesResponse.json();
            } catch (e) {
                console.warn('[Guidance Dashboard v2] ⚠️ Failed to parse messages JSON:', e);
                messages = [];
            }
        }
        console.log('[Guidance Dashboard v2] ✅ Messages loaded:', messages.length, 'messages');
        
        // Build student name from first_name and last_name
        const studentName = request.first_name && request.last_name 
            ? `${request.first_name} ${request.last_name}` 
            : (request.student_name || 'N/A');
        
        let detailsHTML = `
            <div class="form-group">
                <label>Student:</label>
                <div style="padding: 10px; background: #f5f5f5; border-radius: 4px;">${studentName}</div>
            </div>
            <div class="form-group">
                <label>Grade:</label>
                <div style="padding: 10px; background: #f5f5f5; border-radius: 4px;">${request.grade_level || 'N/A'}</div>
            </div>
            <div class="form-group">
                <label>Reason:</label>
                <div style="padding: 10px; background: #f5f5f5; border-radius: 4px;">${request.reason || 'N/A'}</div>
            </div>
            <div class="form-group">
                <label>Message:</label>
                <div style="padding: 10px; background: #f5f5f5; border-radius: 4px; min-height: 60px; word-wrap: break-word;">${request.message || 'N/A'}</div>
            </div>
            <div class="form-group">
                <label>Current Status:</label>
                <select id="statusSelect" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                    <option value="Pending" ${request.status === 'Pending' ? 'selected' : ''}>Pending</option>
                    <option value="Approved" ${request.status === 'Approved' ? 'selected' : ''}>Approved</option>
                    <option value="Completed" ${request.status === 'Completed' ? 'selected' : ''}>Completed</option>
                    <option value="Declined" ${request.status === 'Declined' ? 'selected' : ''}>Declined</option>
                </select>
            </div>
            <div class="form-group">
                <label>Appointment Date (if approved):</label>
                <input type="date" id="appointmentDate" value="${request.appointment_date || ''}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            </div>
        `;
        
        // Add messages section
        if (messages && messages.length > 0) {
            detailsHTML += `
                <div class="form-group">
                    <label>Message History:</label>
                    <div style="background: #f9f9f9; border: 1px solid #ddd; border-radius: 4px; padding: 10px; max-height: 200px; overflow-y: auto;">
                        ${messages.map(msg => `
                            <div style="margin-bottom: 10px; padding: 8px; border-left: 3px solid ${msg.sender_type === 'counselor' ? '#2196F3' : '#4CAF50'}; background: white; border-radius: 3px;">
                                <div style="font-weight: 600; font-size: 12px; color: #666;">${msg.sender_type === 'counselor' ? 'You (Counselor)' : 'Student'}</div>
                                <div style="margin-top: 5px; color: #333; word-wrap: break-word;">${msg.message_content || msg.message || 'N/A'}</div>
                                <div style="font-size: 11px; color: #999; margin-top: 3px;">${new Date(msg.created_at).toLocaleString()}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        // Add reply field
        detailsHTML += `
            <div class="form-group">
                <label>Add Message:</label>
                <textarea id="messageText" placeholder="Type your message..." style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; min-height: 80px; font-family: Arial, sans-serif;"></textarea>
            </div>
            <div class="form-group">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="checkbox" id="visibleToStudent" checked> 
                    <span>Visible to student</span>
                </label>
            </div>
            <div style="display: flex; gap: 10px; margin-top: 20px; flex-wrap: wrap;">
                <button class="btn btn-primary" onclick="updateGuidanceRequest(${requestId});" style="flex: 1; min-width: 100px;">Save Changes</button>
                <button class="btn btn-secondary" onclick="sendMessage(${requestId});" style="flex: 1; min-width: 100px;">Send Message</button>
                <button class="btn btn-danger" onclick="closeModal('requestModal');" style="flex: 1; min-width: 100px;">Close</button>
            </div>
        `;
        
        // Update modal content
        const requestDetailsDiv = document.getElementById('requestDetails');
        if (requestDetailsDiv) {
            requestDetailsDiv.innerHTML = detailsHTML;
        }
        
        // Show modal with proper display handling
        const modal = document.getElementById('requestModal');
        if (modal) {
            modal.classList.add('show');
            modal.style.display = 'block'; // Ensure modal is visible
            console.log('[Guidance Dashboard v2] ✅ Modal displayed for request:', requestId);
        } else {
            console.error('[Guidance Dashboard v2] ❌ Modal element not found');
        }
    } catch (error) {
        console.error('[Guidance Dashboard v2] ❌ Error opening request modal:', error);
        alert('Error loading request details: ' + error.message);
    }
}

// ============================================
// REQUEST OPERATIONS
// ============================================

async function updateGuidanceRequest(requestId) {
    try {
        const status = document.getElementById('statusSelect').value;
        const appointmentDate = document.getElementById('appointmentDate').value;
        
        const response = await apiFetch(`/api/guidance/requests/${requestId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status: status,
                appointment_date: appointmentDate
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('[Guidance Dashboard v2] ✅ Guidance request updated:', result.request.id);
            alert('Request updated successfully');
            closeModal('requestModal');
            loadDashboardData();
        } else {
            const errorText = await response.text();
            console.error('[Guidance Dashboard v2] Error updating request:', errorText);
            alert('Error updating request: ' + errorText);
        }
    } catch (error) {
        console.error('[Guidance Dashboard v2] Error updating request:', error);
        alert('Error updating request: ' + error.message);
    }
}

async function sendMessage(requestId) {
    try {
        const messageText = document.getElementById('messageText').value;
        const visibleToStudent = document.getElementById('visibleToStudent').checked;
        
        if (!messageText.trim()) {
            alert('Please enter a message');
            return;
        }
        
        if (!currentCounselorId) {
            console.warn('[Guidance Dashboard v2] ⚠️ Warning: currentCounselorId not set, sending message with null sender_id');
        }
        
        const response = await apiFetch('/api/guidance/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                guidance_request_id: requestId,
                sender_id: currentCounselorId || null,
                sender_type: 'counselor',
                message_content: messageText,
                is_visible_to_student: visibleToStudent
            })
        });
        
        if (response.ok) {
            document.getElementById('messageText').value = '';
            alert('Message sent successfully');
            openRequestModal(requestId); // Refresh modal
            console.log('[Guidance Dashboard v2] ✅ Message sent');
        } else {
            const errorText = await response.text();
            console.error('[Guidance Dashboard v2] Error sending message:', errorText);
            alert('Error sending message: ' + errorText);
        }
    } catch (error) {
        console.error('[Guidance Dashboard v2] Error sending message:', error);
        alert('Error sending message: ' + error.message);
    }
}

// ============================================
// FILTERING
// ============================================

function applyFilters() {
    const statusFilter = document.getElementById('statusFilter')?.value || '';
    const reasonFilter = document.getElementById('reasonFilter')?.value || '';
    
    let filtered = allRequests;
    
    if (statusFilter) {
        filtered = filtered.filter(req => req.status === statusFilter);
    }
    
    if (reasonFilter) {
        filtered = filtered.filter(req => req.reason === reasonFilter);
    }
    
    displayRequestsTable(filtered);
    console.log('[Guidance Dashboard v2] 🔍 Applied filters - Results:', filtered.length);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
        modal.style.display = 'none'; // Ensure modal is hidden
        console.log('[Guidance Dashboard v2] 🚪 Modal closed:', modalId);
    }
}

function createGuidanceRequest(studentId) {
    alert(`Request creation for student ${studentId} - Feature to be implemented`);
}

function logout() {
    localStorage.removeItem('adminData');
    window.location.href = withSchoolParam('auth.html?role=admin');
    console.log('[Guidance Dashboard v2] 👋 User logged out');
}

// ============================================
// MODAL EVENT HANDLING
// ============================================

// Setup modal listeners when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupModalAndMenuListeners);
} else {
    // DOM already loaded, setup immediately
    setupModalAndMenuListeners();
}

function setupModalAndMenuListeners() {
    // Close modal when clicking outside of the modal-content
    const modal = document.getElementById('requestModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            // Only close if clicking directly on the modal background, not the content
            if (e.target === modal) {
                closeModal('requestModal');
            }
        });
        console.log('[Guidance Dashboard v2] ✅ Modal click listeners setup');
    }
    
    // Setup menu button listeners for better event handling
    document.querySelectorAll('.menu-button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleSubmenu(btn);
        });
    });
    console.log('[Guidance Dashboard v2] ✅ Menu button listeners setup');
}

// Close modal when clicking outside of it
window.addEventListener('click', (event) => {
    const requestModal = document.getElementById('requestModal');
    if (event.target === requestModal) {
        closeModal('requestModal');
    }
});

console.log('[Guidance Dashboard v2] ✅ JavaScript fully loaded and ready');


