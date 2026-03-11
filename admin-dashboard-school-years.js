// School Years Management Module
// Handles creation, activation, and display of school years in the admin dashboard

const SY_BACKEND_ORIGIN = window.location.origin;
const SY_API_BASE = SY_BACKEND_ORIGIN;

function resolveSchoolCodeForSchoolYears() {
    try {
        const params = new URLSearchParams(window.location.search || '');
        const fromQuery = String(params.get('school') || params.get('tenant') || params.get('code') || '').trim().toLowerCase();
        if (fromQuery) return fromQuery;
    } catch (_e) { }

    return String(localStorage.getItem('sms.selectedSchoolCode') || localStorage.getItem('sms.selectedTenantCode') || '').trim().toLowerCase();
}

async function schoolYearsFetch(path, options = {}) {
    const schoolCode = resolveSchoolCodeForSchoolYears();
    const url = new URL(path, SY_API_BASE || window.location.origin);
    if (schoolCode) {
        url.searchParams.set('school', schoolCode);
    }

    const mergedHeaders = {
        ...(options.headers || {}),
        ...(schoolCode ? { 'x-tenant-code': schoolCode } : {})
    };

    return fetch(url.toString(), {
        credentials: 'include',
        ...options,
        headers: mergedHeaders
    });
}

// Global variable to store active school year
window.activeSchoolYear = null;

function updateSidebarActiveSchoolYear(schoolYear) {
    const topBannerEl = document.getElementById('topActiveSchoolYearBanner');

    const yearLabel = schoolYear && schoolYear.school_year
        ? String(schoolYear.school_year).trim()
        : '';

    if (topBannerEl) {
        topBannerEl.textContent = yearLabel ? `Active School Year: ${yearLabel}` : 'Active School Year: --';
        topBannerEl.title = yearLabel ? `Active School Year: ${yearLabel}` : 'No active school year';
    }
}

/**
 * Initialize school years module
 */
function initializeSchoolYears() {
    console.log('[School Years] Initializing...');

    setupSchoolYearsTableActions();
    
    // Load active school year (async, non-blocking)
    // Use immediate call and also schedule for later to catch race conditions
    loadActiveSchoolYear().catch(err => {
        console.error('[School Years] Error loading active school year on init:', err);
    });
    
    // Load all school years (async, non-blocking)
    loadSchoolYears().catch(err => {
        console.error('[School Years] Error loading school years on init:', err);
    });
    
    // Setup form submission
    setupSchoolYearForm();
    
    // Add auto-refresh interval every 5 seconds to catch updates
    setInterval(() => {
        console.log('[School Years] Auto-checking for active school year...');
        loadActiveSchoolYear().catch(err => {
            console.error('[School Years] Error in auto-check:', err);
        });
    }, 5000);
    
    // Schedule a delayed refresh to handle any DOM readiness issues
    setTimeout(() => {
        console.log('[School Years] Running delayed initialization check...');
        const display = document.getElementById('activeSchoolYearDisplay');
        if (display && display.innerHTML.includes('No active school year')) {
            console.log('[School Years] Display shows empty state, attempting reload...');
            loadActiveSchoolYear().catch(err => {
                console.error('[School Years] Error in delayed check:', err);
            });
        }
    }, 1500);
}

/**
 * Load the active school year and display it (with retry and fallback)
 */
async function loadActiveSchoolYear(retryCount = 0, maxRetries = 3) {
    try {
        console.log('[loadActiveSchoolYear] Fetching from:', `${SY_API_BASE}/api/school-years/active`);
        
        // Check if element exists (critical for display)
        const display = document.getElementById('activeSchoolYearDisplay');
        if (!display) {
            console.warn('[loadActiveSchoolYear] Element "activeSchoolYearDisplay" not found in DOM');
            // Retry if element might not be ready yet
            if (retryCount < maxRetries) {
                console.log(`[loadActiveSchoolYear] Retrying in 300ms (attempt ${retryCount + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, 300));
                return loadActiveSchoolYear(retryCount + 1, maxRetries);
            }
            return;
        }
        
        const response = await schoolYearsFetch('/api/school-years/active');
        
        console.log('[loadActiveSchoolYear] Response status:', response.status);
        
        if (!response.ok) {
            console.warn('[loadActiveSchoolYear] API returned', response.status);
            display.innerHTML = '<div class="no-data">No active school year set. Create and activate one below.</div>';
            updateSidebarActiveSchoolYear(null);
            return;
        }
        
        const schoolYear = await response.json();
        console.log('[loadActiveSchoolYear] Received data:', schoolYear);
        
        if (!schoolYear) {
            console.log('[loadActiveSchoolYear] API returned null/empty response');
            display.innerHTML = '<div class="no-data">No active school year set. Create and activate one below.</div>';
            updateSidebarActiveSchoolYear(null);
            return;
        }
        
        window.activeSchoolYear = schoolYear;
        
        displayActiveSchoolYear(schoolYear);
        
        // Store in localStorage for access from other pages
        if (schoolYear && schoolYear.school_year) {
            localStorage.setItem('activeSchoolYear', JSON.stringify(schoolYear));
            console.log('[loadActiveSchoolYear] Saved to localStorage:', schoolYear.school_year);
        }
    } catch (err) {
        console.error('[loadActiveSchoolYear] Error:', err);
        const display = document.getElementById('activeSchoolYearDisplay');
        if (display) {
            display.innerHTML = '<div class="no-data">Error loading school year. Please refresh the page.</div>';
        }
        updateSidebarActiveSchoolYear(null);
    }
}

/**
 * Display the active school year in the UI
 */
function displayActiveSchoolYear(schoolYear) {
    const display = document.getElementById('activeSchoolYearDisplay');
    updateSidebarActiveSchoolYear(schoolYear);
    
    if (!display) {
        console.warn('[displayActiveSchoolYear] Element not found');
        return;
    }
    
    console.log('[displayActiveSchoolYear] Displaying:', schoolYear);
    
    if (!schoolYear || !schoolYear.school_year) {
        console.log('[displayActiveSchoolYear] No active year, showing empty state');
        display.classList.remove('active');
        display.innerHTML = '<div class="no-data">No active school year set. Create and activate one below.</div>';
        return;
    }
    
    try {
        const startDate = new Date(schoolYear.start_date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        const endDate = new Date(schoolYear.end_date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        display.classList.add('active');
        display.innerHTML = `
            <div class="active-year-info">
                <p style="color: #666; margin-bottom: 10px;">Currently Active</p>
                <div class="active-year-value">${schoolYear.school_year}</div>
                <div class="active-year-dates">
                    ${startDate} — ${endDate}
                </div>
            </div>
        `;
        console.log('[displayActiveSchoolYear] Successfully displayed:', schoolYear.school_year);
    } catch (err) {
        console.error('[displayActiveSchoolYear] Error formatting dates:', err);
        display.classList.add('active');
        display.innerHTML = `
            <div class="active-year-info">
                <p style="color: #666; margin-bottom: 10px;">Currently Active</p>
                <div class="active-year-value">${schoolYear.school_year}</div>
            </div>
        `;
    }
}

/**
 * Setup school year form submission
 */
function setupSchoolYearForm() {
    const form = document.getElementById('schoolYearForm');
    
    if (!form) {
        console.warn('[School Years] Form not found');
        return;
    }
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const schoolYear = document.getElementById('schoolYearName').value.trim();
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        
        // Validate
        if (!schoolYear || !startDate || !endDate) {
            showNotification('Please fill in all fields', 'error');
            return;
        }
        
        const startDateObj = new Date(startDate);
        const endDateObj = new Date(endDate);
        
        if (startDateObj >= endDateObj) {
            showNotification('Start date must be before end date', 'error');
            return;
        }
        
        try {
            const response = await schoolYearsFetch('/api/school-years', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    school_year: schoolYear,
                    start_date: startDate,
                    end_date: endDate
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                showNotification(data.error || 'Failed to create school year', 'error');
                return;
            }
            
            showNotification(`School year ${schoolYear} created successfully!`, 'success');
            
            // Reset form
            form.reset();
            
            // Reload school years list
            loadSchoolYears();
            
        } catch (err) {
            console.error('Error creating school year:', err);
            showNotification('Error creating school year', 'error');
        }
    });
}

/**
 * Load and display all school years
 */
async function loadSchoolYears() {
    try {
        const response = await schoolYearsFetch('/api/school-years');
        if (!response.ok) {
            throw new Error('Failed to fetch school years');
        }
        
        const schoolYears = await response.json();
        displaySchoolYears(schoolYears);
        
    } catch (err) {
        console.error('Error loading school years:', err);
        const tbody = document.getElementById('schoolYearsTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="5" class="no-data">Failed to load school years</td></tr>';
        }
    }
}

/**
 * Display school years in the table
 */
function displaySchoolYears(schoolYears) {
    const tbody = document.getElementById('schoolYearsTableBody');
    
    if (!tbody) {
        console.warn('[School Years] Table body not found');
        return;
    }
    
    if (!schoolYears || schoolYears.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="no-data">No school years created yet</td></tr>';
        return;
    }
    
    tbody.innerHTML = schoolYears.map(year => {
        const startDate = new Date(year.start_date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        
        const endDate = new Date(year.end_date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        
        const statusBadge = year.is_active 
            ? '<span class="year-status active">✓ Active</span>'
            : '<span class="year-status inactive">Inactive</span>';
        
        const activateBtn = year.is_active
            ? ''
            : `<button class="btn-activate" type="button" data-school-year-action="activate" data-school-year-id="${year.id}">Activate</button>`;

        const deleteBtn = year.is_active
            ? ''
            : `<button class="btn-delete" type="button" data-school-year-action="delete" data-school-year-id="${year.id}">Delete</button>`;
        
        return `
            <tr>
                <td><strong>${year.school_year}</strong></td>
                <td>${startDate}</td>
                <td>${endDate}</td>
                <td>${statusBadge}</td>
                <td>
                    <div class="year-actions">
                        ${activateBtn}
                        ${deleteBtn}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function setupSchoolYearsTableActions() {
    const tbody = document.getElementById('schoolYearsTableBody');

    if (!tbody) {
        console.warn('[School Years] Table body not found for action binding');
        return;
    }

    if (tbody.dataset.actionsBound === '1') {
        return;
    }

    tbody.dataset.actionsBound = '1';

    tbody.addEventListener('click', async (event) => {
        const actionButton = event.target.closest('button[data-school-year-action][data-school-year-id]');
        if (!actionButton) return;

        const schoolYearId = Number(actionButton.getAttribute('data-school-year-id'));
        if (!Number.isFinite(schoolYearId) || schoolYearId <= 0) {
            showNotification('Invalid school year ID', 'error');
            return;
        }

        const action = actionButton.getAttribute('data-school-year-action');

        if (action === 'activate') {
            await window.activateSchoolYear(schoolYearId);
            return;
        }

        if (action === 'delete') {
            await window.deleteSchoolYear(schoolYearId);
        }
    });
}

/**
 * Activate a school year (GLOBAL FUNCTION - can be called from inline onclick)
 */
window.activateSchoolYear = async function(schoolYearId) {
    console.log('[activateSchoolYear] Called with ID:', schoolYearId, typeof schoolYearId);
    
    if (!schoolYearId) {
        console.error('[activateSchoolYear] No ID provided!');
        showNotification('Invalid school year ID', 'error');
        return;
    }
    
    try {
        console.log('[activateSchoolYear] Activating school year ID:', schoolYearId);
        
        const response = await schoolYearsFetch(`/api/school-years/${schoolYearId}/activate`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        console.log('[activateSchoolYear] Response status:', response.status);
        console.log('[activateSchoolYear] Response data:', data);
        
        if (!response.ok) {
            showNotification(data.error || 'Failed to activate school year', 'error');
            return;
        }
        
        showNotification(`School year activated successfully!`, 'success');
        
        // Update the active school year immediately with the returned data
        if (data.data) {
            window.activeSchoolYear = data.data;
            window.activeSchoolYearId = Number(data.data.id) || null;
            window.activeSchoolYearLabel = data.data.school_year ? `${data.data.school_year} (Active)` : '--';
            displayActiveSchoolYear(data.data);
            localStorage.setItem('activeSchoolYear', JSON.stringify(data.data));
            localStorage.setItem('activeSchoolYearChangedAt', JSON.stringify({
                id: data.data.id,
                school_year: data.data.school_year,
                ts: Date.now()
            }));

            try {
                window.dispatchEvent(new CustomEvent('schoolYearActivated', { detail: data.data }));
            } catch (_e) {}

            if (typeof window.refreshDashboardForActiveSchoolYear === 'function') {
                await window.refreshDashboardForActiveSchoolYear(data.data);
            }
        }
        
        // Reload school-year UI data immediately
        await loadSchoolYears();
        await loadActiveSchoolYear();
        
    } catch (err) {
        console.error('[activateSchoolYear] Error:', err);
        showNotification('Error activating school year', 'error');
    }
};

/**
 * Delete a school year (GLOBAL FUNCTION - can be called from inline onclick)
 */
window.deleteSchoolYear = async function(schoolYearId) {
    console.log('[deleteSchoolYear] Called with ID:', schoolYearId, typeof schoolYearId);
    
    if (!schoolYearId) {
        console.error('[deleteSchoolYear] No ID provided!');
        showNotification('Invalid school year ID', 'error');
        return;
    }
    
    if (!confirm('Are you sure you want to delete this school year?')) {
        console.log('[deleteSchoolYear] User cancelled delete');
        return;
    }
    
    try {
        const response = await schoolYearsFetch(`/api/school-years/${schoolYearId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        console.log('[deleteSchoolYear] Response status:', response.status);
        console.log('[deleteSchoolYear] Response data:', data);
        
        if (!response.ok) {
            showNotification(data.error || 'Failed to delete school year', 'error');
            return;
        }
        
        showNotification('School year deleted successfully!', 'success');
        
        // Reload school years list and active year state
        await loadSchoolYears();
        await loadActiveSchoolYear();
    } catch (err) {
        console.error('[deleteSchoolYear] Error:', err);
        showNotification('Error deleting school year', 'error');
    }
};

/**
 * Show notification (uses existing notification system)
 */
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    if (!notification) return;
    
    notification.textContent = message;
    notification.className = `notification show ${type}`;
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    console.log('[School Years] DOM still loading, waiting for DOMContentLoaded...');
    document.addEventListener('DOMContentLoaded', () => {
        console.log('[School Years] DOM loaded, initializing...');
        initializeSchoolYears();
    });
} else {
    console.log('[School Years] DOM already loaded, initializing immediately...');
    initializeSchoolYears();
}



