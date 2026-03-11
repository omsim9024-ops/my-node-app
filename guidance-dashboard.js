/**
 * Guidance Dashboard JavaScript
 * Handles guidance requests, messages, risk flags, and student management
 */

const API_BASE = window.location.origin;
let currentCounselorId = null;
let allGuidanceRequests = [];
let currentRequestId = null;

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

    currentCounselorId = adminData.id;
    console.log('[Guidance Dashboard] ✅ Authorized as guidance counselor:', adminData.name);

    await loadDashboardStats();
    await loadGuidanceRequests();
});

// ============================================
// DASHBOARD STATS
// ============================================

async function loadDashboardStats() {
    try {
        const response = await fetch(
            `${API_BASE}/api/guidance/dashboard/stats?counselor_id=${currentCounselorId}`
        );
        const stats = await response.json();

        document.getElementById('totalCases').textContent = stats.totalActiveCases || 0;
        document.getElementById('pendingCount').textContent = stats.pendingRequests || 0;
        document.getElementById('riskCount').textContent = stats.atRiskStudents || 0;
        document.getElementById('sessionCount').textContent = stats.sessionsToday || 0;

        console.log('[Guidance Dashboard] ✅ Dashboard stats loaded:', stats);
    } catch (err) {
        console.error('[Guidance Dashboard] Error loading stats:', err);
    }
}

// ============================================
// GUIDANCE REQUESTS
// ============================================

async function loadGuidanceRequests() {
    try {
        const response = await fetch(
            `${API_BASE}/api/guidance/requests?counselor_id=${currentCounselorId}`
        );
        allGuidanceRequests = await response.json();

        applyFilters();
        console.log('[Guidance Dashboard] ✅ Guidance requests loaded:', allGuidanceRequests.length);
    } catch (err) {
        console.error('[Guidance Dashboard] Error loading requests:', err);
        document.getElementById('requestsTableBody').innerHTML = `
            <tr><td colspan="6" style="text-align: center; color: #d32f2f;">Error loading requests</td></tr>
        `;
    }
}

function applyFilters() {
    const statusFilter = document.getElementById('statusFilter')?.value || '';
    const reasonFilter = document.getElementById('reasonFilter')?.value || '';

    let filtered = allGuidanceRequests;

    if (statusFilter) {
        filtered = filtered.filter(r => r.status === statusFilter);
    }
    if (reasonFilter) {
        filtered = filtered.filter(r => r.reason === reasonFilter);
    }

    renderRequests(filtered);
}

function filterRequests(status) {
    document.getElementById('statusFilter').value = status === 'all' ? '' : status;
    applyFilters();
}

function renderRequests(requests) {
    const tbody = document.getElementById('requestsTableBody');

    if (requests.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 30px; color: #999;">
                    No guidance requests found
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = requests.map(req => `
        <tr onclick="openRequestDetails(${req.id})">
            <td><strong>${req.first_name} ${req.last_name}</strong></td>
            <td>${req.grade_level || '-'}</td>
            <td>${req.reason}</td>
            <td>${req.preferred_date || '-'}</td>
            <td>
                <span class="status-badge status-${req.status.toLowerCase()}">
                    ${req.status}
                </span>
            </td>
            <td>
                <button class="btn-secondary" onclick="event.stopPropagation(); openRequestDetails(${req.id})">
                    View
                </button>
            </td>
        </tr>
    `).join('');
}

async function openRequestDetails(requestId) {
    currentRequestId = requestId;
    const request = allGuidanceRequests.find(r => r.id === requestId);

    if (!request) return;

    const messagesResponse = await fetch(
        `${API_BASE}/api/guidance/messages/${requestId}`
    );
    const messages = await messagesResponse.json();

    const detailsHtml = `
        <div style="margin-bottom: 20px;">
            <h3>${request.first_name} ${request.last_name}</h3>
            <p><strong>Grade:</strong> ${request.grade_level || '-'}</p>
            <p><strong>Section:</strong> ${request.section_name || '-'}</p>
            <p><strong>Track:</strong> ${request.track || '-'}</p>
        </div>

        <div style="background: #f5f5f5; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
            <p><strong>Reason:</strong> ${request.reason}</p>
            <p><strong>Student Message:</strong></p>
            <p>${request.message || 'No message provided'}</p>
            <p><strong>Preferred Date:</strong> ${request.preferred_date || '-'}</p>
            <p><strong>Preferred Time:</strong> ${request.preferred_time || '-'}</p>
        </div>

        <div class="form-group">
            <label>Status</label>
            <select id="requestStatus" onchange="updateRequestStatus()">
                <option value="Pending" ${request.status === 'Pending' ? 'selected' : ''}>Pending</option>
                <option value="Approved" ${request.status === 'Approved' ? 'selected' : ''}>Approved</option>
                <option value="Completed" ${request.status === 'Completed' ? 'selected' : ''}>Completed</option>
                <option value="Declined" ${request.status === 'Declined' ? 'selected' : ''}>Declined</option>
            </select>
        </div>

        <div class="form-group">
            <label>Appointment Date</label>
            <input type="date" id="appointmentDate" value="${request.appointment_date || ''}">
        </div>

        <div class="form-group">
            <label>Appointment Time</label>
            <input type="time" id="appointmentTime" value="${request.appointment_time || ''}">
        </div>

        <div class="form-group">
            <label>Internal Notes (Not visible to student)</label>
            <textarea id="internalNotes" placeholder="Add confidential notes..."></textarea>
        </div>

        <div class="messages-container">
            <strong>Message History</strong>
            ${messages.length === 0 ? '<p style="color: #999; margin: 10px 0;">No messages yet</p>' : ''}
            ${messages.map(msg => `
                <div class="message ${msg.sender_type === 'counselor' ? 'counselor' : ''}">
                    <div class="message-sender">${msg.sender_type === 'counselor' ? 'You' : 'Student'}</div>
                    <div class="message-text">${msg.message_content}</div>
                    <div class="message-time">${new Date(msg.created_at).toLocaleString()}</div>
                </div>
            `).join('')}
        </div>

        <div class="form-group">
            <label>Send Message</label>
            <textarea id="messageContent" placeholder="Type message here..." style="margin-bottom: 10px;"></textarea>
            <label style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="visibleToStudent" checked>
                Visible to student
            </label>
        </div>

        <div style="display: flex; gap: 10px;">
            <button class="btn-primary" onclick="sendMessage()">Send Message</button>
            <button class="btn-secondary" onclick="updateRequestStatus()">Save Changes</button>
            <button class="btn-danger" onclick="closeModal('requestModal')">Close</button>
        </div>
    `;

    document.getElementById('requestDetails').innerHTML = detailsHtml;
    document.getElementById('requestModal').style.display = 'block';
}

async function updateRequestStatus() {
    try {
        const status = document.getElementById('requestStatus').value;
        const appointmentDate = document.getElementById('appointmentDate').value;
        const appointmentTime = document.getElementById('appointmentTime').value;
        const internalNotes = document.getElementById('internalNotes').value;

        const response = await fetch(`${API_BASE}/api/guidance/requests/${currentRequestId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status,
                appointment_date: appointmentDate,
                appointment_time: appointmentTime,
                internal_notes: internalNotes,
                guidance_counselor_id: currentCounselorId
            })
        });

        if (!response.ok) throw new Error('Failed to update request');

        console.log('[Guidance Dashboard] ✅ Request updated');
        alert('Request updated successfully');
        await loadGuidanceRequests();
        await loadDashboardStats();
    } catch (err) {
        console.error('[Guidance Dashboard] Error updating request:', err);
        alert('Error updating request: ' + err.message);
    }
}

async function sendMessage() {
    try {
        const content = document.getElementById('messageContent').value;
        const isVisible = document.getElementById('visibleToStudent').checked;

        if (!content.trim()) {
            alert('Please type a message');
            return;
        }

        const response = await fetch(`${API_BASE}/api/guidance/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                guidance_request_id: currentRequestId,
                sender_id: currentCounselorId,
                sender_type: 'counselor',
                message_content: content,
                is_visible_to_student: isVisible
            })
        });

        if (!response.ok) throw new Error('Failed to send message');

        console.log('[Guidance Dashboard] ✅ Message sent');
        document.getElementById('messageContent').value = '';
        await openRequestDetails(currentRequestId);
    } catch (err) {
        console.error('[Guidance Dashboard] Error sending message:', err);
        alert('Error sending message: ' + err.message);
    }
}

// ============================================
// AT-RISK STUDENTS
// ============================================

async function showRiskStudents() {
    try {
        const response = await fetch(`${API_BASE}/api/guidance/risk-flags`);
        const riskStudents = await response.json();

        if (riskStudents.length === 0) {
            document.getElementById('riskStudentsList').innerHTML = `
                <p style="color: #999; text-align: center; padding: 20px;">No at-risk students</p>
            `;
        } else {
            document.getElementById('riskStudentsList').innerHTML = riskStudents.map(risk => `
                <div class="risk-flag ${risk.severity.toLowerCase()}">
                    <strong>${risk.first_name} ${risk.last_name}</strong> (Grade ${risk.grade_level})
                    <br><em>${risk.flag_type}: ${risk.flag_reason}</em>
                    <br><small style="color: #666;">Section: ${risk.section_name || '-'} | Track: ${risk.track || '-'}</small>
                </div>
            `).join('');
        }

        document.getElementById('riskModal').style.display = 'block';
    } catch (err) {
        console.error('[Guidance Dashboard] Error loading risk students:', err);
        alert('Error loading at-risk students');
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function showTodaySessions() {
    alert('Sessions for today feature - coming soon');
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modals = ['requestModal', 'riskModal'];
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
};

// Auto-refresh every 30 seconds
setInterval(() => {
    console.log('[Guidance Dashboard] Auto-refreshing...');
    loadGuidanceRequests();
    loadDashboardStats();
}, 30000);

console.log('[Guidance Dashboard] ✅ JavaScript loaded');


