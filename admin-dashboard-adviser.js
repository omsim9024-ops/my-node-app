// Admin Adviser Management Module
console.log('[Admin Adviser Management] Initializing...');

// Use existing API_BASE if available, otherwise create it
if (typeof API_BASE === 'undefined') {
    var API_BASE = window.location.origin;
}

function resolveSchoolCodeForAdviser() {
    try {
        const params = new URLSearchParams(window.location.search || '');
        const fromQuery = String(params.get('school') || params.get('tenant') || params.get('code') || '').trim().toLowerCase();
        if (fromQuery) return fromQuery;
    } catch (_e) { }
    return String(localStorage.getItem('sms.selectedSchoolCode') || localStorage.getItem('sms.selectedTenantCode') || '').trim().toLowerCase();
}

async function adviserApiFetch(pathOrUrl, options = {}) {
    const schoolCode = resolveSchoolCodeForAdviser();
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

// ============================================================================
// INITIALIZE ADVISER MANAGEMENT ON PAGE LOAD
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('[Admin Adviser Management] Page loaded, setting up listeners...');
    
    // Setup event listeners FIRST
    setupAdviserEventListeners();
    
    // Load initial data (non-blocking)
    console.log('[Admin Adviser Management] Loading data...');
    loadAdvisersData().catch(err => console.error('[Admin Adviser Management] Error loading advisers:', err));
    // Also load teachers for the Teachers management tab
    loadTeachersData().catch(err => console.error('[Admin Adviser Management] Error loading teachers:', err));
    loadSectionsForAssignment().catch(err => console.error('[Admin Adviser Management] Error loading sections:', err));
    loadSchoolYearsForAssignment().catch(err => console.error('[Admin Adviser Management] Error loading school years:', err));
});

// ============================================================================
// EVENT LISTENERS
// ============================================================================

function setupAdviserEventListeners() {
    console.log('[Admin Adviser Management] Setting up event listeners...');
    
    // Create adviser button
    // Support legacy 'createAdviserBtn' and new 'createTeacherBtn'
    // Hide legacy create buttons on the Teachers page to prevent the
    // old "Create New Adviser/Teacher" workflow from appearing. The
    // new Teachers table (assign-only) should remain visible.
    const createBtn = document.getElementById('createAdviserBtn') || document.getElementById('createTeacherBtn');
    if (createBtn) {
        try { createBtn.remove(); console.log('[Admin Adviser Management] Removed legacy create button'); } catch (e) {}
    }

    // Adviser search
    // Support either adviserSearch (legacy) or teacherSearch (new)
    const searchInput = document.getElementById('adviserSearch') || document.getElementById('teacherSearch');
    if (searchInput) {
        searchInput.addEventListener('input', filterAdvisers);
    }

    // Assign adviser form
    const assignForm = document.getElementById('assignAdviserForm');
    if (assignForm) {
        assignForm.addEventListener('submit', handleAssignAdviser);
    }

    // Section tab switching
    document.querySelectorAll('.section-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabId = e.target.getAttribute('data-tab');
            switchAdviserTab(tabId);
        });
    });
    
    console.log('[Admin Adviser Management] Event listeners setup complete');
}

// ============================================================================
// LOAD DATA
// ============================================================================

async function loadAdvisersData() {
    try {
        const response = await adviserApiFetch(`${API_BASE}/api/adviser-auth`);
        const data = await response.json();

        if (data.success) {
            displayAdvisersList(data.advisers);
        }
    } catch (error) {
        console.error('[Admin Adviser Management] Error loading advisers:', error);
        showNotification('Error loading advisers', 'error');
    }
}

async function loadSectionsForAssignment() {
    try {
        const response = await adviserApiFetch(`${API_BASE}/api/sections`);
        const data = await response.json();

        const select = document.getElementById('assign_section_id');
        if (!select) {
            console.warn('[Admin Adviser Management] assign_section_id element not found');
            return;
        }

        select.innerHTML = '<option value="">Choose a section...</option>';
        
        if (Array.isArray(data)) {
            data.forEach(section => {
                const option = document.createElement('option');
                option.value = section.id;
                option.textContent = `${section.section_code} - ${section.section_name}`;
                select.appendChild(option);
            });
            console.log('[Admin Adviser Management] Loaded', data.length, 'sections');
        } else {
            console.warn('[Admin Adviser Management] Unexpected response format:', typeof data, data);
        }
    } catch (error) {
        console.error('[Admin Adviser Management] Error loading sections:', error);
    }
}

// ============================================================================
// LOAD TEACHERS (from teacher-signup)
// ============================================================================
async function loadTeachersData() {
    try {
        const res = await adviserApiFetch(`${API_BASE}/api/teachers`);
        if (!res.ok) {
            console.warn('[Admin Adviser Management] Failed to fetch teachers', res.status);
            return;
        }
        const teachers = await res.json();
        displayTeachersList(teachers || []);
    } catch (err) {
        console.error('[Admin Adviser Management] Error loading teachers:', err);
    }
}

function displayTeachersList(teachers) {
    const containerPrimary = document.getElementById('teacherListContent');
    const containerFallback = document.getElementById('adviserListContent');
    const container = containerPrimary || containerFallback;
    if (!container) {
        console.warn('[Admin Adviser Management] teacherListContent container missing');
        return;
    }

    if (!teachers || teachers.length === 0) {
        container.innerHTML = '<p class="no-data">No teachers found.</p>';
        return;
    }

    // Use fixed table layout and explicit column widths for consistent alignment
    let html = `
        <table class="data-table" style="table-layout:fixed;width:100%;text-transform:uppercase;border-collapse:collapse;">
            <colgroup>
                <col style="width:10%" />
                <col style="width:20%" />
                <col style="width:15%" />
                <col style="width:25%" />
                <col style="width:18%" />
                <col style="width:7%" />
            </colgroup>
            <thead>
                <tr>
                    <th style="text-align:left;padding:12px 16px;vertical-align:middle;">Teacher ID</th>
                    <th style="text-align:left;padding:12px 16px;vertical-align:middle;">Name</th>
                    <th style="text-align:left;padding:12px 16px;vertical-align:middle;">Department</th>
                    <th style="text-align:left;padding:12px 16px;vertical-align:middle;">Email</th>
                    <th style="text-align:left;padding:12px 16px;vertical-align:middle;">Created</th>
                    <th style="text-align:center;padding:12px 16px;vertical-align:middle;">Actions</th>
                </tr>
            </thead>
            <tbody>
    `;

    teachers.forEach(t => {
        const created = t.created_at ? new Date(t.created_at).toLocaleDateString() : '-';
        const tid = (t.teacher_id || '-').toString().toUpperCase();
        const name = (t.name || '-').toString().toUpperCase();
        const dept = (t.department || '-').toString().toUpperCase();
        const email = (t.email || '-').toString().toLowerCase();

        html += `
            <tr>
                <td style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:12px 16px;">${tid}</td>
                <td style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:12px 16px;">${name}</td>
                <td style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:12px 16px;">${dept}</td>
                <td style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:12px 16px;">${email}</td>
                <td style="white-space:nowrap;padding:12px 16px;">${created.toString().toUpperCase()}</td>
                <td style="text-align:center;padding:12px 8px;"><button class="btn btn-sm btn-assign" onclick="openAssignRoleModal(${t.id})" aria-label="Assign role to teacher ${tid}">🔗 ASSIGN</button></td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
    `;

    // Render only into the new Teachers container to avoid the old Adviser UI showing
    if (containerPrimary) {
        containerPrimary.innerHTML = html;
    } else {
        console.warn('[Admin Adviser Management] teacherListContent not found — cannot render teachers table');
    }

    // Enhance the search control and hook debounced filtering
    enhanceTeacherSearch();
}

// simple placeholder to open assign role modal
function openAssignRoleModal(teacherId) {
    // calls the main admin dashboard modal for role assignment
    if (typeof openTeacherAssignmentModal === 'function') {
        openTeacherAssignmentModal(teacherId);
    } else {
        alert('Role assignment modal not available');
    }
}

// Enhance the teacher search input: add debounce, clear button, and improved styling hookup
function enhanceTeacherSearch() {
    const search = document.getElementById('teacherSearch') || document.getElementById('adviserSearch');
    if (!search) return;

    // add a clear button if not present
    if (!document.getElementById('teacherSearchClear')) {
        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        wrapper.className = 'enhanced-search-wrapper';

        search.parentNode.insertBefore(wrapper, search);
        wrapper.appendChild(search);

        const clearBtn = document.createElement('button');
        clearBtn.id = 'teacherSearchClear';
        clearBtn.type = 'button';
        clearBtn.title = 'Clear';
        clearBtn.style.position = 'absolute';
        clearBtn.style.right = '8px';
        clearBtn.style.top = '50%';
        clearBtn.style.transform = 'translateY(-50%)';
        clearBtn.style.border = 'none';
        clearBtn.style.background = 'transparent';
        clearBtn.style.cursor = 'pointer';
        clearBtn.innerHTML = '✕';
        clearBtn.addEventListener('click', () => { search.value = ''; filterAdvisers(); search.focus(); });
        wrapper.appendChild(clearBtn);

        // style input to have padding for clear button
        search.style.paddingRight = '34px';
        // Ensure input is visible on light backgrounds
        search.style.background = '#ffffff';
        search.style.color = '#222222';
        search.style.border = '1px solid #e0e0e0';
        search.style.borderRadius = '6px';
        search.style.padding = '8px 10px';
        search.style.minWidth = '360px';
        search.style.boxSizing = 'border-box';
        search.setAttribute('placeholder', search.getAttribute('placeholder') || 'Search by name, department or email...');
    }

    // debounce input
    let t = null;
    search.removeEventListener('input', debouncedFilter);
    search.addEventListener('input', debouncedFilter);

    function debouncedFilter(e) {
        if (t) clearTimeout(t);
        t = setTimeout(() => { filterAdvisers(); }, 250);
    }
}

async function loadSchoolYearsForAssignment() {
    try {
        const response = await adviserApiFetch(`${API_BASE}/api/school-years`);
        const data = await response.json();

        const years = Array.isArray(data)
            ? data
            : (Array.isArray(data?.school_years) ? data.school_years : []);

        const select = document.getElementById('assign_school_year_id');
        if (select) {
            select.innerHTML = '<option value="">Choose a school year...</option>';
            years.forEach(year => {
                const option = document.createElement('option');
                option.value = year.id;
                option.textContent = year.school_year;
                select.appendChild(option);
            });
        }

        // Also populate adviser select
        refreshAdviserSelect();
    } catch (error) {
        console.error('[Admin Adviser Management] Error loading school years:', error);
    }
}

// ============================================================================
// DISPLAY ADVISERS LIST
// ============================================================================

function displayAdvisersList(advisers) {
    // Support both adviserListContent (legacy) and teacherListContent (new)
    const container = document.getElementById('adviserListContent') || document.getElementById('teacherListContent');

    if (!container) {
        console.warn('[Admin Adviser Management] No container found for advisers/teachers list');
        return;
    }
    // Adviser list UI removed — keep the Teachers list (assign-only) active.
    // Render a neutral message in the legacy container to avoid the old table.
    container.innerHTML = '<p class="no-data">Adviser list has been removed. Use the Teachers view for assignments.</p>';
}

// ============================================================================
// CREATE ADVISER
// ============================================================================

function openCreateAdviserModal() {
    console.log('[Admin Adviser Management] Opening create adviser modal...');
    
    const modal = document.createElement('div');
    modal.id = 'createAdviserModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Create New Adviser</h2>
                <button class="modal-close" onclick="closeAdviserModal()">&times;</button>
            </div>
            <div class="modal-body">
                <form id="createAdviserFormModal">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="adviser_id">Adviser ID *</label>
                            <input type="text" id="adviser_id" placeholder="e.g., ADV001" required />
                        </div>
                        <div class="form-group">
                            <label for="adviser_email">Email *</label>
                            <input type="email" id="adviser_email" placeholder="adviser@cnhs.edu" required />
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="adviser_first_name">First Name *</label>
                            <input type="text" id="adviser_first_name" required />
                        </div>
                        <div class="form-group">
                            <label for="adviser_last_name">Last Name *</label>
                            <input type="text" id="adviser_last_name" required />
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="adviser_password">Password *</label>
                            <input type="password" id="adviser_password" placeholder="Minimum 8 characters" required />
                        </div>
                        <div class="form-group">
                            <label for="adviser_phone">Phone (Optional)</label>
                            <input type="tel" id="adviser_phone" />
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">Create Adviser</button>
                        <button type="button" class="btn btn-secondary" onclick="closeAdviserModal()">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    console.log('[Admin Adviser Management] Modal created, appending to body...');
    document.body.appendChild(modal);
    console.log('[Admin Adviser Management] Adding active class to modal...');
    modal.classList.add('active');

    console.log('[Admin Adviser Management] Setting up form submission listener...');
    // Setup form submission
    const formElement = document.getElementById('createAdviserFormModal');
    if (formElement) {
        formElement.addEventListener('submit', handleCreateAdviser);
        console.log('[Admin Adviser Management] Form listener attached successfully');
    } else {
        console.error('[Admin Adviser Management] Form element not found!');
    }
}

async function handleCreateAdviser(e) {
    e.preventDefault();

    const adviserId = document.getElementById('adviser_id').value;
    const email = document.getElementById('adviser_email').value;
    const firstName = document.getElementById('adviser_first_name').value;
    const lastName = document.getElementById('adviser_last_name').value;
    const password = document.getElementById('adviser_password').value;
    const phone = document.getElementById('adviser_phone').value || null;

    // Validation
    if (password.length < 8) {
        showNotification('Password must be at least 8 characters', 'error');
        return;
    }

    try {
        const response = await adviserApiFetch(`${API_BASE}/api/adviser-auth/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                adviser_id: adviserId,
                email: email,
                first_name: firstName,
                last_name: lastName,
                password: password,
                phone: phone
            })
        });

        const data = await response.json();

        if (data.success) {
            showNotification('Adviser created successfully', 'success');
            closeAdviserModal();
            loadAdvisersData();
            refreshAdviserSelect();
        } else {
            showNotification(data.error || 'Failed to create adviser', 'error');
        }
    } catch (error) {
        console.error('[Admin Adviser Management] Error creating adviser:', error);
        showNotification('Error creating adviser', 'error');
    }
}

// ============================================================================
// EDIT ADVISER
// ============================================================================

function editAdviser(adviserId) {
    showNotification('Edit functionality coming soon', 'info');
}

// ============================================================================
// TOGGLE ADVISER STATUS
// ============================================================================

async function toggleAdviserStatus(adviserId, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const action = currentStatus === 'active' ? 'deactivate' : 'activate';

    if (!confirm(`Are you sure you want to ${action} this adviser?`)) {
        return;
    }

    try {
        const response = await adviserApiFetch(`${API_BASE}/api/adviser-auth/status/${adviserId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                account_status: newStatus
            })
        });

        const data = await response.json();

        if (data.success) {
            showNotification(`Adviser ${action}d successfully`, 'success');
            loadAdvisersData();
        } else {
            showNotification(data.error || `Failed to ${action} adviser`, 'error');
        }
    } catch (error) {
        console.error('[Admin Adviser Management] Error updating adviser status:', error);
        showNotification(`Error ${action}ing adviser`, 'error');
    }
}

// ============================================================================
// FILTER ADVISERS
// ============================================================================

function filterAdvisers() {
    const searchInput = document.getElementById('adviserSearch') || document.getElementById('teacherSearch');
    const searchValue = (searchInput && searchInput.value) ? searchInput.value.toLowerCase().trim() : '';

    const container = document.getElementById('teacherListContent') || document.getElementById('adviserListContent');
    if (!container) return;

    const rows = container.querySelectorAll('table tbody tr');
    rows.forEach(row => {
        const cells = Array.from(row.querySelectorAll('td'));
        const name = (cells[1] && cells[1].textContent) ? cells[1].textContent.toLowerCase() : '';
        const dept = (cells[2] && cells[2].textContent) ? cells[2].textContent.toLowerCase() : '';
        const email = (cells[3] && cells[3].textContent) ? cells[3].textContent.toLowerCase() : '';
        const combined = `${name} ${dept} ${email}`;

        row.style.display = searchValue === '' || combined.includes(searchValue) ? '' : 'none';
    });
}

// ============================================================================
// ASSIGN ADVISER TO SECTION
// ============================================================================

async function handleAssignAdviser(e) {
    e.preventDefault();

    const adviserId = document.getElementById('assign_adviser_id').value;
    const sectionId = document.getElementById('assign_section_id').value;
    const schoolYearId = document.getElementById('assign_school_year_id').value;

    if (!adviserId || !sectionId || !schoolYearId) {
        showNotification('Please select adviser, section, and school year', 'error');
        return;
    }

    try {
        const response = await adviserApiFetch(`${API_BASE}/api/adviser-auth/assign-section`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                adviser_id: adviserId,
                section_id: sectionId,
                school_year_id: schoolYearId
            })
        });

        const data = await response.json();

        if (data.success) {
            showNotification('Section assigned to adviser successfully', 'success');
            document.getElementById('assignAdviserForm').reset();
            loadAdviserAssignments();
        } else {
            showNotification(data.error || 'Failed to assign section', 'error');
        }
    } catch (error) {
        console.error('[Admin Adviser Management] Error assigning section:', error);
        showNotification('Error assigning section', 'error');
    }
}

// ============================================================================
// LOAD ADVISER ASSIGNMENTS
// ============================================================================

async function loadAdviserAssignments() {
    try {
        // Since we don't have an endpoint to list all assignments yet,
        // we'll fetch advisers and their sections
        const response = await adviserApiFetch(`${API_BASE}/api/adviser-auth`);
        const data = await response.json();

        if (data.success) {
            displayAdviserAssignments(data.advisers);
        }
    } catch (error) {
        console.error('[Admin Adviser Management] Error loading assignments:', error);
    }
}

async function loadAdviserAssignments() {
    try {
        const response = await adviserApiFetch(`${API_BASE}/api/adviser-auth/all-assignments/list`);
        const data = await response.json();

        if (data.success) {
            displayAdviserAssignments(data.assignments);
        }
    } catch (error) {
        console.error('[Admin Adviser Management] Error loading assignments:', error);
    }
}

function displayAdviserAssignments(assignments) {
    const container = document.getElementById('adviserAssignmentsContent');

    if (!assignments || assignments.length === 0) {
        container.innerHTML = '<p class="no-data">No assignments found</p>';
        return;
    }

    // Group assignments by adviser
    const adviserMap = {};
    assignments.forEach(assignment => {
        const adviserId = assignment.adviser_id;
        if (!adviserMap[adviserId]) {
            adviserMap[adviserId] = {
                adviser_id: assignment.adviser_id,
                first_name: assignment.first_name,
                last_name: assignment.last_name,
                sections: []
            };
        }
        adviserMap[adviserId].sections.push(assignment);
    });

    // Build HTML
    let html = '<div class="adviser-assignments-list">';

    Object.values(adviserMap).forEach(adviser => {
        html += `
            <div class="adviser-assignment-card">
                <div class="card-header">
                    <h3>${adviser.first_name} ${adviser.last_name}</h3>
                    <span class="adviser-id">${adviser.adviser_id}</span>
                </div>
                <div class="card-body">
                    <div class="sections-list">
        `;
        
        adviser.sections.forEach(section => {
            html += `
                        <div class="section-item">
                            <strong>${section.section_code}</strong> - ${section.section_name}
                            <br><small>Grade ${section.grade} | ${section.track || 'Track TBD'} | ${section.school_year}</small>
                        </div>
            `;
        });

        html += `
                    </div>
                </div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
}

// ============================================================================
// SWITCH TABS
// ============================================================================

function switchAdviserTab(tabId) {
    // Hide all tabs
    document.querySelectorAll('[id$="-tab"]').forEach(tab => {
        if (tab.id.includes('adviser')) {
            tab.classList.remove('active');
        }
    });

    // Remove active from buttons
    document.querySelectorAll('.section-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected tab
    const tab = document.getElementById(tabId);
    if (tab) {
        tab.classList.add('active');
    }

    // Mark button as active
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');

    // Load data if needed
    if (tabId === 'adviser-assignments-list-tab') {
        loadAdviserAssignments();
    }
}

// ============================================================================
// REFRESH ADVISER SELECT
// ============================================================================

async function refreshAdviserSelect() {
    try {
        const response = await adviserApiFetch(`${API_BASE}/api/adviser-auth`);
        const data = await response.json();

        if (data.success) {
                const select = document.getElementById('assign_adviser_id');
                if (select) {
                    select.innerHTML = '<option value="">Choose an adviser...</option>';
                    data.advisers.forEach(adviser => {
                        const option = document.createElement('option');
                        option.value = adviser.id;
                        option.textContent = `${adviser.first_name} ${adviser.last_name} (${adviser.adviser_id})`;
                        select.appendChild(option);
                    });
                } else {
                    console.warn('[Admin Adviser Management] assign_adviser_id select not found');
                }
        }
    } catch (error) {
        console.error('[Admin Adviser Management] Error loading advisers:', error);
    }
}

// ============================================================================
// MODAL HELPERS
// ============================================================================

function closeAdviserModal() {
    const modal = document.getElementById('createAdviserModal');
    if (modal) {
        modal.remove();
    }
}

// ============================================================================
// NOTIFICATION HELPER
// ============================================================================

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    if (notification) {
        notification.textContent = message;
        notification.className = `notification notification-${type}`;
        notification.style.display = 'block';

        setTimeout(() => {
            notification.style.display = 'none';
        }, 4000);
    }
}

console.log('[Admin Adviser Management] Module loaded successfully');



