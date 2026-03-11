/**
 * Admin Dashboard - Registration Codes Management
 * Provides functionality for generating, viewing, and managing teacher registration codes
 */

// API_BASE is already declared globally in admin-dashboard.js

const registrationCodesState = {
    listenersAttached: false,
    initialized: false
};

function resolveSchoolCodeForRegistrationCodes() {
    try {
        const params = new URLSearchParams(window.location.search || '');
        const fromQuery = String(params.get('school') || params.get('tenant') || params.get('code') || '').trim().toLowerCase();
        if (fromQuery) return fromQuery;
    } catch (_e) { }
    return String(localStorage.getItem('sms.selectedSchoolCode') || localStorage.getItem('sms.selectedTenantCode') || '').trim().toLowerCase();
}

async function registrationCodesFetch(pathOrUrl, options = {}) {
    const schoolCode = resolveSchoolCodeForRegistrationCodes();
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

/**
 * Generate new registration codes
 */
async function generateRegistrationCodes() {
    // only one code at a time is permitted; ignore any quantity field
    const quantity = 1;
    const description = document.getElementById('codeDescription').value.trim();

    // sanity: no validation needed for quantity anymore

    try {
        const btn = document.getElementById('generateCodesBtn');
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '⏳ Generating...';

        const res = await registrationCodesFetch(`${API_BASE}/api/registration-codes/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantity, description })
        });

        const data = await res.json();

        if (!res.ok) {
            showNotification(data.error || 'Failed to generate codes', 'error');
            return;
        }

        // the API returns an array; should always be length 1
        const generatedCount = Array.isArray(data.codes) ? data.codes.length : 1;
        showNotification(`Generated ${generatedCount} registration code`, 'success');
        // reset description only; quantity field no longer visible
        document.getElementById('codeDescription').value = '';
        document.getElementById('codeDescription').value = '';
        
        // Reload codes list
        loadRegistrationCodes();
        loadCodesStats();
    } catch (err) {
        console.error('Error generating codes:', err);
        showNotification('Server error: ' + err.message, 'error');
    } finally {
        const btn = document.getElementById('generateCodesBtn');
        btn.disabled = false;
        btn.textContent = '✓ Generate Codes';
    }
}

/**
 * Load and display all registration codes
 */
async function loadRegistrationCodes() {
    const statusFilter = document.getElementById('codeStatusFilter').value;
    const usedFilter = document.getElementById('codeUsedFilter').value;
    const searchTerm = document.getElementById('codeSearchInput').value.toLowerCase();

    try {
        let url = `${API_BASE}/api/registration-codes/list`;
        const params = new URLSearchParams();

        if (statusFilter) params.append('status', statusFilter);
        if (usedFilter === 'false') params.append('used', 'false');
        if (usedFilter === 'true') params.append('used', 'true');

        if (params.toString()) url += '?' + params.toString();

        const res = await registrationCodesFetch(url);
        const data = await res.json();

        if (!res.ok) {
            showNotification('Failed to load codes', 'error');
            return;
        }

        let codes = data.codes || [];

        // Apply search filter
        if (searchTerm) {
            codes = codes.filter(code => 
                code.code.toLowerCase().includes(searchTerm) ||
                (code.description && code.description.toLowerCase().includes(searchTerm))
            );
        }

        displayRegistrationCodes(codes);
    } catch (err) {
        console.error('Error loading codes:', err);
        showNotification('Failed to load codes', 'error');
    }
}

/**
 * Display registration codes in table
 */
function displayRegistrationCodes(codes) {
    const tbody = document.getElementById('codesTableBody');
    const noData = document.getElementById('noCodesMessage');

    if (!codes || codes.length === 0) {
        tbody.innerHTML = '';
        if (noData) noData.style.display = 'block';
        return;
    }

    if (noData) noData.style.display = 'none';

    tbody.innerHTML = codes.map(code => {
        const statusBadge = getStatusBadge(code.status);
        const createdDate = new Date(code.created_at).toLocaleDateString();
        const expiresDate = code.expires_at ? new Date(code.expires_at).toLocaleDateString() : 'N/A';
        const usedBy = code.used_by ? `Teacher ID: ${code.used_by}` : '-';
        const isUsed = code.used_at !== null;

        return `
            <tr style="border-bottom: 1px solid #dee2e6;">
                <td style="padding: 12px; border-bottom: 1px solid #dee2e6; font-weight: 600; font-family: monospace;">${code.code}</td>
                <td style="padding: 12px; border-bottom: 1px solid #dee2e6;">${code.description || '-'}</td>
                <td style="padding: 12px; border-bottom: 1px solid #dee2e6;">${statusBadge}</td>
                <td style="padding: 12px; border-bottom: 1px solid #dee2e6;">${createdDate}</td>
                <td style="padding: 12px; border-bottom: 1px solid #dee2e6;">${expiresDate}</td>
                <td style="padding: 12px; border-bottom: 1px solid #dee2e6;">${usedBy}</td>
                <td style="padding: 12px; border-bottom: 1px solid #dee2e6;">
                    ${!isUsed && code.status === 'active' ? `
                        <button onclick="copyToClipboard('${code.code}')" class="btn btn-small" style="background: #0066cc; color: white; padding: 6px 12px; font-size: 12px; margin-right: 5px;">Copy</button>
                        <button onclick="revokeCode(${code.id})" class="btn btn-small" style="background: #dc3545; color: white; padding: 6px 12px; font-size: 12px;">Revoke</button>
                    ` : `
                        <span style="color: #db8a00; font-size: 12px;">${isUsed ? 'Used' : 'Revoked'}</span>
                    `}
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Load and display registration code statistics
 */
async function loadCodesStats() {
    try {
        const res = await registrationCodesFetch(`${API_BASE}/api/registration-codes/stats`);
        const data = await res.json();

        if (!res.ok) {
            console.error('Failed to load stats');
            return;
        }

        const stats = data.stats || {};
        const statsContainer = document.getElementById('codesStatsContainer');

        statsContainer.innerHTML = `
            <div style="padding: 15px; background: #e7f3ff; border-radius: 8px; border-left: 4px solid #0066cc;">
                <div style="font-size: 24px; font-weight: 700; color: #0066cc;">${stats.total || 0}</div>
                <div style="color: #666; font-size: 14px; margin-top: 5px;">Total Codes</div>
            </div>
            <div style="padding: 15px; background: #d4edda; border-radius: 8px; border-left: 4px solid #28a745;">
                <div style="font-size: 24px; font-weight: 700; color: #28a745;">${stats.available || 0}</div>
                <div style="color: #666; font-size: 14px; margin-top: 5px;">Available</div>
            </div>
            <div style="padding: 15px; background: #d1ecf1; border-radius: 8px; border-left: 4px solid #17a2b8;">
                <div style="font-size: 24px; font-weight: 700; color: #17a2b8;">${stats.used || 0}</div>
                <div style="color: #666; font-size: 14px; margin-top: 5px;">Used</div>
            </div>
            <div style="padding: 15px; background: #f8d7da; border-radius: 8px; border-left: 4px solid #dc3545;">
                <div style="font-size: 24px; font-weight: 700; color: #dc3545;">${stats.revoked || 0}</div>
                <div style="color: #666; font-size: 14px; margin-top: 5px;">Revoked</div>
            </div>
        `;
    } catch (err) {
        console.error('Error loading code stats:', err);
    }
}

/**
 * Get status badge HTML
 */
function getStatusBadge(status) {
    const badges = {
        'active': `<span style="background: #d4edda; color: #155724; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">Active</span>`,
        'used': `<span style="background: #d1ecf1; color: #0c5460; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">Used</span>`,
        'revoked': `<span style="background: #f8d7da; color: #721c24; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">Revoked</span>`,
        'expired': `<span style="background: #fff3cd; color: #856404; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">Expired</span>`
    };
    return badges[status] || `<span style="color: #666; font-size: 12px;">${status}</span>`;
}

/**
 * Copy code to clipboard
 */
function copyToClipboard(code) {
    navigator.clipboard.writeText(code).then(() => {
        showNotification(`Code ${code} copied to clipboard`, 'success');
    }).catch(err => {
        console.error('Failed to copy:', err);
        showNotification('Failed to copy to clipboard', 'error');
    });
}

/**
 * Revoke a registration code
 */
async function revokeCode(codeId) {
    if (!confirm('Are you sure you want to revoke this code? It cannot be used anymore.')) {
        return;
    }

    try {
        const res = await registrationCodesFetch(`${API_BASE}/api/registration-codes/revoke/${codeId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await res.json();

        if (!res.ok) {
            showNotification(data.error || 'Failed to revoke code', 'error');
            return;
        }

        showNotification('Code revoked successfully', 'success');
        loadRegistrationCodes();
        loadCodesStats();
    } catch (err) {
        console.error('Error revoking code:', err);
        showNotification('Server error: ' + err.message, 'error');
    }
}

/**
 * Show notification message
 */
function showNotification(message, type = 'info') {
    let notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#0066cc'};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        z-index: 10000;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

/**
 * Initialize registration codes management
 */
function initializeRegistrationCodesManagement() {
    console.log('[Registration Codes] Initializing...');

    // Load initial data
    loadCodesStats();
    loadRegistrationCodes();

    // Setup event listeners
    if (!registrationCodesState.listenersAttached) {
        document.getElementById('generateCodesBtn')?.addEventListener('click', generateRegistrationCodes);
        document.getElementById('refreshCodesBtn')?.addEventListener('click', () => {
            loadRegistrationCodes();
            loadCodesStats();
        });
        document.getElementById('codeStatusFilter')?.addEventListener('change', loadRegistrationCodes);
        document.getElementById('codeUsedFilter')?.addEventListener('change', loadRegistrationCodes);
        document.getElementById('codeSearchInput')?.addEventListener('input', loadRegistrationCodes);
        registrationCodesState.listenersAttached = true;
    }

    registrationCodesState.initialized = true;

    console.log('[Registration Codes] Initialized successfully');
}

// Initialize when section is shown
document.addEventListener('DOMContentLoaded', () => {
    // Check if we're on the registration-codes section
    const initWhenVisible = setInterval(() => {
        const section = document.getElementById('registration-codes');
        if (section && section.classList.contains('active')) {
            clearInterval(initWhenVisible);
            initializeRegistrationCodesManagement();
        }
    }, 100);

    // Also initialize when the menu item is clicked
    const registrationCodesMenu = document.querySelector('[data-section="registration-codes"]');
    if (registrationCodesMenu) {
        registrationCodesMenu.addEventListener('click', () => {
            setTimeout(() => {
                if (!registrationCodesState.initialized) {
                    initializeRegistrationCodesManagement();
                    return;
                }
                loadRegistrationCodes();
                loadCodesStats();
            }, 100);
        });
    }
});



