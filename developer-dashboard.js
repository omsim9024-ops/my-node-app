const state = {
    payload: null,
    responseTimes: [],
    healthMiniChart: null,
    analyticsChart: null,
    responseChart: null,
    endpointChart: null,
    sidebarCollapsed: false,
    lightTheme: false,
    mobileSidebarOpen: false,
    selectedSchoolId: null,
    tenantCreateMode: false,
    schoolSearchQuery: '',
    pendingLogoData: null,
    tenantDeleteInProgress: false,
    tenantCreateInProgress: false
};

const STORAGE_KEYS = {
    sidebarCollapsed: 'developerDashboard.sidebarCollapsed',
    lightTheme: 'developerDashboard.lightTheme'
};

const TENANT_LOGO_MAX_BYTES = 1024 * 1024;

function formatDate(value) {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleString();
}

function formatMinutes(value) {
    const minutes = Number(value);
    if (!Number.isFinite(minutes) || minutes <= 0) return '0m';
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    if (!hours) return `${remainingMinutes}m`;
    return `${hours}h ${remainingMinutes}m`;
}

function setActionResult(payload) {
    const target = document.getElementById('action-result');
    target.textContent = JSON.stringify(payload, null, 2);
}

function setTenantFeedback(message = '', type = 'success') {
    const banner = document.getElementById('tenant-feedback');
    if (!banner) return;

    const text = String(message || '').trim();
    banner.classList.remove('show', 'success', 'error');

    if (!text) {
        banner.textContent = '';
        return;
    }

    banner.textContent = text;
    banner.classList.add('show', type === 'error' ? 'error' : 'success');
}

function setTenantDeleteProgress(percent = 0, message = '') {
    const container = document.getElementById('tenant-delete-progress');
    const label = document.getElementById('tenant-delete-progress-label');
    const percentLabel = document.getElementById('tenant-delete-progress-percent');
    const fill = document.getElementById('tenant-delete-progress-fill');
    const track = container ? container.querySelector('.tenant-delete-progress-track') : null;
    if (!container || !label || !percentLabel || !fill || !track) return;

    const hasMessage = String(message || '').trim().length > 0;
    if (!hasMessage) {
        container.classList.remove('show');
        container.setAttribute('aria-hidden', 'true');
        label.textContent = 'Processing school deletion…';
        percentLabel.textContent = '0%';
        fill.style.width = '0%';
        track.setAttribute('aria-valuenow', '0');
        return;
    }

    const value = Math.max(0, Math.min(100, Number(percent) || 0));
    const rounded = Math.round(value);
    container.classList.add('show');
    container.setAttribute('aria-hidden', 'false');
    label.textContent = String(message);
    percentLabel.textContent = `${rounded}%`;
    fill.style.width = `${value}%`;
    track.setAttribute('aria-valuenow', String(rounded));
}

function setTenantCreateProgress(percent = 0, message = '') {
    const container = document.getElementById('tenant-create-progress');
    const label = document.getElementById('tenant-create-progress-label');
    const percentLabel = document.getElementById('tenant-create-progress-percent');
    const fill = document.getElementById('tenant-create-progress-fill');
    const track = container ? container.querySelector('.tenant-create-progress-track') : null;
    if (!container || !label || !percentLabel || !fill || !track) return;

    const hasMessage = String(message || '').trim().length > 0;
    if (!hasMessage) {
        container.classList.remove('show');
        container.setAttribute('aria-hidden', 'true');
        label.textContent = 'Creating school tenant…';
        percentLabel.textContent = '0%';
        fill.style.width = '0%';
        track.setAttribute('aria-valuenow', '0');
        return;
    }

    const value = Math.max(0, Math.min(100, Number(percent) || 0));
    const rounded = Math.round(value);
    container.classList.add('show');
    container.setAttribute('aria-hidden', 'false');
    label.textContent = String(message);
    percentLabel.textContent = `${rounded}%`;
    fill.style.width = `${value}%`;
    track.setAttribute('aria-valuenow', String(rounded));
}

function parseJsonInput(raw, fallback = {}) {
    const value = String(raw || '').trim();
    if (!value) return fallback;
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch (_err) {
        return fallback;
    }
}

function updateToggleButtonLabels() {
    const sidebarBtn = document.getElementById('sidebar-toggle-btn');
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (sidebarBtn) {
        sidebarBtn.textContent = state.sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar';
    }
    if (themeBtn) {
        themeBtn.textContent = state.lightTheme ? 'Dark Theme' : 'Light Theme';
    }
}

function applySidebarState(collapsed) {
    state.sidebarCollapsed = !!collapsed;
    const shell = document.querySelector('.dashboard-shell');
    if (!shell) return;
    shell.classList.toggle('sidebar-collapsed', state.sidebarCollapsed);
    updateToggleButtonLabels();
}

function setMobileSidebarOpen(open) {
    state.mobileSidebarOpen = !!open;
    const shell = document.querySelector('.dashboard-shell');
    if (!shell) return;
    shell.classList.toggle('mobile-sidebar-open', state.mobileSidebarOpen);
}

function isMobileViewport() {
    return window.matchMedia('(max-width: 980px)').matches;
}

function applyThemeState(lightTheme) {
    state.lightTheme = !!lightTheme;
    document.body.classList.toggle('light-theme', state.lightTheme);
    updateToggleButtonLabels();
}

function applyStatusChip(id, label, healthy) {
    const chip = document.getElementById(id);
    if (!chip) return;
    chip.classList.toggle('healthy', !!healthy);
    chip.classList.toggle('error', !healthy);
    chip.innerHTML = `<i></i>${label}`;
}

function loadUiPreferences() {
    const savedCollapsed = localStorage.getItem(STORAGE_KEYS.sidebarCollapsed);
    const savedTheme = localStorage.getItem(STORAGE_KEYS.lightTheme);

    applySidebarState(savedCollapsed === 'true');
    applyThemeState(savedTheme === 'true');
}

function createMetricCard(label, value, status = null) {
    const dot = status ? `<span class="status-dot ${status === 'healthy' ? 'status-healthy' : 'status-error'}"></span>` : '';
    const numericClass = typeof value === 'number' ? 'metric-number' : '';
    const target = typeof value === 'number' ? ` data-target="${value}"` : '';
    const finalValue = typeof value === 'number' ? '0' : value;
    return `<article class="metric-card"><span>${dot}${label}</span><strong class="${numericClass}"${target}>${finalValue}</strong></article>`;
}

function animateCounters(scope = document) {
    const elements = scope.querySelectorAll('.metric-number[data-target]');
    elements.forEach((element) => {
        const target = Number(element.getAttribute('data-target'));
        if (!Number.isFinite(target)) return;

        const start = performance.now();
        const duration = 600;

        const step = (current) => {
            const progress = Math.min((current - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const value = Math.round(target * eased);
            element.textContent = String(value);
            if (progress < 1) requestAnimationFrame(step);
        };

        requestAnimationFrame(step);
    });
}

function renderSystemHealth(data) {
    const health = data.systemHealth || {};
    const cpu = health.cpuUsage || {};
    const memory = health.memory || {};
    const serverOnline = String(health.serverStatus || '').toLowerCase() === 'online';
    const dbOnline = String(health.databaseStatus || '').toLowerCase() === 'online';

    applyStatusChip('nav-server-chip', `Server: ${health.serverStatus || 'Unknown'}`, serverOnline);
    applyStatusChip('nav-db-chip', `DB: ${health.databaseStatus || 'Unknown'}`, dbOnline);

    document.getElementById('system-health-grid').innerHTML = [
        createMetricCard('Server Status', health.serverStatus || 'N/A', serverOnline ? 'healthy' : 'error'),
        createMetricCard('Database Connection', health.databaseStatus || 'N/A', dbOnline ? 'healthy' : 'error'),
        createMetricCard('API Health', health.apiHealth || 'N/A', String(health.apiHealth || '').toLowerCase().includes('healthy') ? 'healthy' : 'error'),
        createMetricCard('Memory RSS (MB)', memory.rssMb ?? 'N/A'),
        createMetricCard('Memory Heap Used (MB)', memory.heapUsedMb ?? 'N/A'),
        createMetricCard('CPU Load (1m)', cpu.oneMinute ?? 'N/A'),
        createMetricCard('CPU Load (5m)', cpu.fiveMinute ?? 'N/A'),
        createMetricCard('Uptime Counter', health.uptimeHuman || 'N/A')
    ].join('');

    animateCounters(document.getElementById('system-health-grid'));
}

function renderHealthDetails(data) {
    const health = data.systemHealth || {};
    const analytics = data.realTimeAnalytics || {};
    const failedLogins = Number(analytics.failedLoginAttempts || 0);
    const alerts = [];

    if (String(health.serverStatus || '').toLowerCase() !== 'online') {
        alerts.push('Server is not reporting Online status.');
    }
    if (String(health.databaseStatus || '').toLowerCase() !== 'online') {
        alerts.push('Database connection is degraded or offline.');
    }
    if (!String(health.apiHealth || '').toLowerCase().includes('healthy')) {
        alerts.push('API health check is not healthy.');
    }
    if (failedLogins > 0) {
        alerts.push(`Detected ${failedLogins} failed login attempts.`);
    }
    if (!alerts.length) {
        alerts.push('All critical health checks are currently stable.');
    }

    const alertList = document.getElementById('health-alerts-list');
    if (alertList) {
        alertList.innerHTML = alerts
            .map((message) => `<li class="list-item">${message}</li>`)
            .join('');
    }

    const cpu = health.cpuUsage || {};
    const memory = health.memory || {};
    ensureChart('healthMiniChart', 'health-mini-chart', {
        type: 'line',
        data: {
            labels: ['CPU 1m', 'CPU 5m', 'CPU 15m', 'Memory RSS', 'Heap Used'],
            datasets: [{
                label: 'Health Signal',
                data: [
                    Number(cpu.oneMinute || 0),
                    Number(cpu.fiveMinute || 0),
                    Number(cpu.fifteenMinute || 0),
                    Number(memory.rssMb || 0),
                    Number(memory.heapUsedMb || 0)
                ],
                borderColor: '#22d3ee',
                backgroundColor: 'rgba(34, 211, 238, 0.18)',
                fill: true,
                tension: 0.28,
                pointRadius: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 450 },
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: '#9fb4d7' }, grid: { color: '#1e293b' } },
                y: { beginAtZero: true, ticks: { color: '#9fb4d7' }, grid: { color: '#1e293b' } }
            }
        }
    });
}

function renderRealtimeAnalytics(data) {
    const analytics = data.realTimeAnalytics || {};
    const otp = analytics.otpVerificationStats || {};

    document.getElementById('realtime-analytics-grid').innerHTML = [
        createMetricCard('Active Users (Live)', analytics.activeUsers ?? 0),
        createMetricCard('Logins Today', analytics.loginsToday ?? 0),
        createMetricCard('Failed Login Attempts', analytics.failedLoginAttempts ?? 0),
        createMetricCard('OTP Issued', otp.totalIssued ?? 0),
        createMetricCard('OTP Consumed', otp.consumed ?? 0),
        createMetricCard('OTP Pending', otp.pending ?? 0),
        createMetricCard('Requests Per Minute', analytics.requestsPerMinute ?? 0)
    ].join('');

    animateCounters(document.getElementById('realtime-analytics-grid'));
}

function ensureChart(instanceKey, elementId, config) {
    if (typeof Chart === 'undefined') return null;
    const canvas = document.getElementById(elementId);
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    if (state[instanceKey]) {
        state[instanceKey].destroy();
        state[instanceKey] = null;
    }

    state[instanceKey] = new Chart(ctx, config);
    return state[instanceKey];
}

function renderAnalyticsChart(data) {
    const analytics = data.realTimeAnalytics || {};
    const otp = analytics.otpVerificationStats || {};

    ensureChart('analyticsChart', 'analytics-chart', {
        type: 'bar',
        data: {
            labels: ['Active', 'Logins', 'Failed', 'OTP Issued', 'OTP Consumed', 'OTP Pending', 'Req/Min'],
            datasets: [{
                label: 'Live Analytics',
                data: [
                    analytics.activeUsers ?? 0,
                    analytics.loginsToday ?? 0,
                    analytics.failedLoginAttempts ?? 0,
                    otp.totalIssued ?? 0,
                    otp.consumed ?? 0,
                    otp.pending ?? 0,
                    analytics.requestsPerMinute ?? 0
                ],
                backgroundColor: ['#2563eb', '#22c55e', '#ef4444', '#8b5cf6', '#14b8a6', '#f59e0b', '#38bdf8'],
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 700 },
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: '#cbd5e1' }, grid: { color: '#1e293b' } },
                y: { beginAtZero: true, ticks: { color: '#cbd5e1' }, grid: { color: '#1e293b' } }
            }
        }
    });
}

function renderList(containerId, items, formatter) {
    const container = document.getElementById(containerId);
    const list = Array.isArray(items) ? items : [];
    container.innerHTML = list.length
        ? list.map(formatter).join('')
        : '<li class="list-item">No data</li>';
}

function renderSecurityPanel(data) {
    const security = data.securityPanel || {};
    const monitor = security.tokenSessionMonitoring || {};
    const suspiciousCount = Array.isArray(security.suspiciousActivity)
        ? security.suspiciousActivity.filter((item) => String(item.severity || '').toLowerCase() === 'warning').length
        : 0;
    const uniqueIps = Array.isArray(security.ipAddressTracking) ? security.ipAddressTracking.length : 0;

    const overviewTarget = document.getElementById('security-overview-grid');
    if (overviewTarget) {
        overviewTarget.innerHTML = [
            createMetricCard('Account Lockouts', security.accountLockouts ?? 0),
            createMetricCard('Active Sessions', monitor.activeSessions ?? 0),
            createMetricCard('Recent Sessions', monitor.recentSessions ?? 0),
            createMetricCard('Suspicious Alerts', suspiciousCount),
            createMetricCard('Tracked IPs', uniqueIps),
            createMetricCard('Avg Session Time', formatMinutes(monitor.avgSessionMinutes ?? 0))
        ].join('');
        animateCounters(overviewTarget);
    }

    renderList('login-attempt-logs', security.loginAttemptLogs, (item) => `
        <li class="list-item">
            <strong>${item.email || 'N/A'}</strong><br>
            IP: ${item.ip || 'N/A'}<br>
            Time: ${formatDate(item.time)}
        </li>
    `);

    renderList('suspicious-activity-list', security.suspiciousActivity, (item) => `
        <li class="list-item ${item.severity === 'warning' ? 'status-warning' : ''}">
            ${item.message || 'N/A'}
        </li>
    `);

    renderList('ip-tracking-list', security.ipAddressTracking, (item) => `
        <li class="list-item">${item.ip} · ${item.sessions} sessions</li>
    `);

    document.getElementById('session-monitoring').innerHTML = `
        <div class="session-row"><strong>Account Lockouts</strong><span>${security.accountLockouts ?? 0}</span></div>
        <div class="session-row"><strong>Active Sessions</strong><span>${monitor.activeSessions ?? 0}</span></div>
        <div class="session-row"><strong>Recent Sessions</strong><span>${monitor.recentSessions ?? 0}</span></div>
        <div class="session-row"><strong>Avg Session</strong><span>${formatMinutes(monitor.avgSessionMinutes ?? 0)}</span></div>
    `;

    renderList('role-permission-list', security.rolePermissionOverview, (item) => `
        <li class="list-item">${item.role} · ${item.users} users · ${item.permissionLevel}</li>
    `);
}

function renderDatabaseManagement(data) {
    const db = data.databaseManagement || {};
    const tables = db.recordCountPerTable || [];
    const totalRecords = tables.reduce((sum, row) => sum + Number(row.count || 0), 0);

    const overview = document.getElementById('db-overview-grid');
    if (overview) {
        overview.innerHTML = [
            createMetricCard('Tables Tracked', tables.length),
            createMetricCard('Total Records', totalRecords),
            createMetricCard('Backup Enabled', db.backup && db.backup.enabled ? 'Yes' : 'No'),
            createMetricCard('Restore Mode', db.restore && db.restore.safeModeOnly ? 'Safe Preview' : 'Standard'),
            createMetricCard('Query Mode', db.queryRunner && db.queryRunner.restrictedSafeMode ? 'Restricted' : 'Open')
        ].join('');
        animateCounters(overview);
    }

    document.getElementById('db-table-body').innerHTML = tables.length
        ? tables.map((row) => `
            <tr>
                <td>${row.table}</td>
                <td>${row.count}</td>
                <td><button type="button" data-table-view="${row.table}">View</button></td>
            </tr>
        `).join('')
        : '<tr><td colspan="3">No table data available</td></tr>';

    document.querySelectorAll('[data-table-view]').forEach((button) => {
        button.addEventListener('click', async () => {
            const table = button.getAttribute('data-table-view');
            try {
                const response = await authFetch(`/api/system-health/db/table/${encodeURIComponent(table)}?limit=25`);
                const payload = await response.json();
                setActionResult(payload);
            } catch (err) {
                setActionResult({ success: false, error: err.message });
            }
        });
    });
}

function renderErrorDebugConsole(data) {
    const debugData = data.errorDebugConsole || {};
    const systemLogCount = Array.isArray(debugData.systemErrorLogs) ? debugData.systemErrorLogs.length : 0;
    const consoleLines = Array.isArray(debugData.consoleOutputViewer) ? debugData.consoleOutputViewer.length : 0;
    const stackTraceCount = Array.isArray(debugData.stackTraceViewer) ? debugData.stackTraceViewer.length : 0;
    const failedRequests = Number(debugData.failedApiRequests || 0);

    const overview = document.getElementById('debug-overview-grid');
    if (overview) {
        overview.innerHTML = [
            createMetricCard('System Error Logs', systemLogCount),
            createMetricCard('Failed API Requests', failedRequests),
            createMetricCard('Console Entries', consoleLines),
            createMetricCard('Stack Traces', stackTraceCount),
            createMetricCard('Viewer Mode', 'Developer')
        ].join('');
        animateCounters(overview);
    }

    renderList('error-log-list', debugData.systemErrorLogs, (item) => `
        <li class="list-item">
            <strong>${item.title || item.type || 'Error'}</strong><br>
            ${item.message || 'No message'}<br>
            <small>${formatDate(item.created_at)}</small>
        </li>
    `);

    document.getElementById('console-output').textContent = JSON.stringify(debugData.consoleOutputViewer || [], null, 2);
    document.getElementById('stack-trace-output').textContent = JSON.stringify(debugData.stackTraceViewer || [], null, 2);
}

function renderUserActivity(data) {
    const activity = data.userActivityTracker || {};
    const duration = activity.userSessionDuration || {};
    const mostActive = Array.isArray(activity.mostActiveUsers) ? activity.mostActiveUsers : [];
    const topUser = mostActive.length ? mostActive[0] : null;
    const browsers = activity.deviceAndBrowserDetection && Array.isArray(activity.deviceAndBrowserDetection.browsers)
        ? activity.deviceAndBrowserDetection.browsers
        : [];
    const devices = activity.deviceAndBrowserDetection && Array.isArray(activity.deviceAndBrowserDetection.devices)
        ? activity.deviceAndBrowserDetection.devices
        : [];

    const activityOverview = document.getElementById('activity-overview-grid');
    if (activityOverview) {
        activityOverview.innerHTML = [
            createMetricCard('Users With Login Data', Array.isArray(activity.lastLoginPerUser) ? activity.lastLoginPerUser.length : 0),
            createMetricCard('Avg Session', formatMinutes(duration.averageMinutes ?? 0)),
            createMetricCard('Session Sample Size', duration.sampleSize ?? 0),
            createMetricCard('Detected Browsers', browsers.length),
            createMetricCard('Detected Devices', devices.length),
            createMetricCard('Top Active User', topUser ? `${topUser.user_label}` : 'N/A')
        ].join('');
        animateCounters(activityOverview);
    }

    renderList('last-login-list', activity.lastLoginPerUser, (item) => `
        <li class="list-item">
            <strong>${item.name || item.email || `Admin #${item.id}`}</strong><br>
            Role: ${item.role || 'N/A'}<br>
            Last Login: ${formatDate(item.last_login_at)}
        </li>
    `);

    document.getElementById('session-duration-box').innerHTML = `
        <div><strong>Average Session Duration:</strong> ${duration.averageMinutes ?? 0} min</div>
        <div><strong>Sample Size:</strong> ${duration.sampleSize ?? 0}</div>
    `;

    const deviceInfo = activity.deviceAndBrowserDetection || {};
    const browserItems = (deviceInfo.browsers || []).map((b) => ({ label: `Browser: ${b.browser}`, count: b.count }));
    const deviceItems = (deviceInfo.devices || []).map((d) => ({ label: `Device: ${d.device}`, count: d.count }));

    renderList('device-browser-list', [...browserItems, ...deviceItems], (item) => `
        <li class="list-item">${item.label} · ${item.count}</li>
    `);

    renderList('most-active-users-list', activity.mostActiveUsers, (item) => `
        <li class="list-item">${item.user_label} · ${item.session_count} sessions</li>
    `);
}

function renderFeatureFlags(flags) {
    const container = document.getElementById('feature-flags');
    const entries = Object.entries(flags || {});

    container.innerHTML = entries.length
        ? entries.map(([key, value]) => `
            <label class="flag-item">
                <input type="checkbox" data-flag="${key}" ${value ? 'checked' : ''}>
                <span>${key}</span>
            </label>
        `).join('')
        : '<div class="info-box">No feature flags available</div>';
}

function renderSystemControls(data) {
    const controls = data.systemControls || {};
    const maintenanceBtn = document.getElementById('maintenance-toggle-btn');
    maintenanceBtn.textContent = controls.maintenanceMode
        ? 'Disable Maintenance Mode'
        : 'Enable Maintenance Mode';

    const features = controls.features || {};
    const flagsTotal = Object.keys(features).length;
    const flagsEnabled = Object.values(features).filter(Boolean).length;

    const controlsOverview = document.getElementById('controls-overview-grid');
    if (controlsOverview) {
        controlsOverview.innerHTML = [
            createMetricCard('Maintenance Mode', controls.maintenanceMode ? 'Enabled' : 'Disabled'),
            createMetricCard('Feature Flags Total', flagsTotal),
            createMetricCard('Feature Flags Enabled', flagsEnabled),
            createMetricCard('Feature Flags Disabled', Math.max(flagsTotal - flagsEnabled, 0)),
            createMetricCard('Control Actions', 4)
        ].join('');
        animateCounters(controlsOverview);
    }

    const statusBox = document.getElementById('controls-status-box');
    if (statusBox) {
        statusBox.innerHTML = `
            <div><strong>Maintenance:</strong> ${controls.maintenanceMode ? 'Enabled' : 'Disabled'}</div>
            <div><strong>Flags Enabled:</strong> ${flagsEnabled}/${flagsTotal}</div>
            <div><strong>Safety Mode:</strong> Administrative action controls active</div>
        `;
    }

    renderFeatureFlags(features);
}

function renderResponseGraph() {
    const points = state.responseTimes.slice(-24);

    ensureChart('responseChart', 'response-chart', {
        type: 'line',
        data: {
            labels: points.map((_item, index) => `${index + 1}`),
            datasets: [{
                label: 'Response Time (ms)',
                data: points,
                borderColor: '#38bdf8',
                backgroundColor: 'rgba(56, 189, 248, 0.2)',
                tension: 0.28,
                fill: true,
                pointRadius: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 500 },
            plugins: { legend: { labels: { color: '#cbd5e1' } } },
            scales: {
                x: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } },
                y: { beginAtZero: true, ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } }
            }
        }
    });
}

function renderEndpointChart(items) {
    const chartItems = (items || []).slice(0, 8);
    ensureChart('endpointChart', 'endpoint-chart', {
        type: 'bar',
        data: {
            labels: chartItems.map((item) => String(item.endpoint || '').slice(0, 24)),
            datasets: [{
                label: 'Endpoint Hits',
                data: chartItems.map((item) => item.count || 0),
                backgroundColor: '#1d4ed8',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 700 },
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } },
                y: { beginAtZero: true, ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } }
            }
        }
    });
}

function renderApiMonitoring(data) {
    const api = data.apiMonitoring || {};
    const summary = api.successVsFailedRequests || {};

    document.getElementById('api-monitor-summary').innerHTML = `
        <div><strong>Success Requests:</strong> ${summary.success ?? 0}</div>
        <div><strong>Failed Requests:</strong> ${summary.failed ?? 0}</div>
    `;

    renderList('endpoint-usage-list', api.endpointUsageBreakdown, (item) => `
        <li class="list-item">${item.endpoint} · ${item.count} hits</li>
    `);

    renderResponseGraph();
    renderEndpointChart(api.endpointUsageBreakdown || []);
}

function renderPerformanceInsights(data) {
    const perf = data.performanceInsights || {};
    const slow = perf.slowQueryDetection || {};
    const load = perf.loadTimeMonitoring || {};
    const growth = perf.growthTracking || {};
    const storage = perf.storageUsageStatistics || [];

    const topStorage = storage.length
        ? `${storage[0].table_name || storage[0].table}: ${storage[0].size_mb} MB`
        : 'N/A';

    document.getElementById('performance-grid').innerHTML = [
        createMetricCard('Slow Queries Detected', slow.detectedCount ?? 0),
        createMetricCard('Slow Query Mode', slow.note || 'N/A'),
        createMetricCard('Requests/Minute', load.requestsPerMinute ?? 0),
        createMetricCard('Sampled Requests', load.sampledRequests ?? 0),
        createMetricCard('Top Storage Usage', topStorage),
        createMetricCard('Tables Tracked', growth.totalTablesTracked ?? 0),
        createMetricCard('Records Tracked', growth.totalRecordsTracked ?? 0)
    ].join('');
}

function renderTenantManagement(data) {
    const tenantData = data.tenantManagement || {};
    const tenants = Array.isArray(tenantData.tenants) ? tenantData.tenants : [];
    if (!state.tenantCreateMode && !state.selectedSchoolId) {
        state.selectedSchoolId = Number(tenantData.currentTenant && tenantData.currentTenant.id) || (tenants[0] && Number(tenants[0].id)) || null;
    }
    const current = state.tenantCreateMode
        ? null
        : (tenants.find((item) => Number(item.id) === Number(state.selectedSchoolId)) || tenantData.currentTenant || null);

    const overview = document.getElementById('tenant-overview-grid');
    if (overview) {
        overview.innerHTML = [
            createMetricCard('Total Tenants', tenantData.totalTenants ?? tenants.length),
            createMetricCard('Active Tenants', tenantData.activeTenants ?? tenants.filter((item) => String(item.status || '').toLowerCase() === 'active').length),
            createMetricCard('Inactive Tenants', tenantData.inactiveTenants ?? tenants.filter((item) => String(item.status || '').toLowerCase() !== 'active').length),
            createMetricCard('Current Tenant', current ? `${current.code}` : 'N/A')
        ].join('');
        animateCounters(overview);
    }

    const filteredSchools = tenants.filter((school) => {
        const hay = `${school.name || ''} ${school.location || ''} ${school.status || ''} ${school.code || ''}`.toLowerCase();
        return !state.schoolSearchQuery || hay.includes(state.schoolSearchQuery.toLowerCase());
    });

    const openSchoolPortal = (school) => {
        if (!school) {
            setActionResult({ success: false, error: 'School not found' });
            return;
        }
        const code = String(school.code || '').trim().toLowerCase();
        if (!code) {
            setActionResult({ success: false, error: 'Selected school has no code. Add a school code first.' });
            return;
        }
        const url = `index.html?school=${encodeURIComponent(code)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
        setActionResult({ success: true, message: `Opened school portal: ${url}` });
    };

    const schoolList = document.getElementById('school-list');
    if (schoolList) {
        schoolList.innerHTML = filteredSchools.length
            ? filteredSchools.map((school) => `
                <li class="list-item school-item ${!state.tenantCreateMode && Number(school.id) === Number(state.selectedSchoolId) ? 'active' : ''}" data-school-select="${school.id}">
                    <div class="school-item-top">
                        <strong>${school.name || school.code}</strong>
                        <button type="button" class="school-open-btn" data-school-open="${school.id}">Open Portal</button>
                    </div>
                    <div>${school.location || 'No location'} · ${school.status || 'unknown'} · <code>${school.code || 'no-code'}</code></div>
                </li>
            `).join('')
            : '<li class="list-item">No schools match the current filter.</li>';

        schoolList.querySelectorAll('[data-school-select]').forEach((node) => {
            node.addEventListener('click', () => {
                state.selectedSchoolId = Number(node.getAttribute('data-school-select')) || null;
                state.tenantCreateMode = false;
                renderTenantManagement(state.payload || data);
            });
        });

        schoolList.querySelectorAll('[data-school-open]').forEach((node) => {
            node.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                const schoolId = Number(node.getAttribute('data-school-open')) || 0;
                const school = tenants.find((item) => Number(item.id) === schoolId) || null;
                openSchoolPortal(school);
            });
        });
    }

    const currentBox = document.getElementById('tenant-current-box');
    if (currentBox) {
        currentBox.innerHTML = current
            ? `<div><strong>Selected:</strong> ${current.name} (${current.code})</div><div><strong>School ID:</strong> ${current.schoolId || 'N/A'}</div><div><strong>Location:</strong> ${current.location || 'N/A'}</div><div><strong>Status:</strong> ${current.status}</div><div><strong>Default:</strong> ${current.isDefault ? 'Yes' : 'No'}</div>`
            : '<div>No school selected. Choose one from the list, or fill out the form and create a new school.</div>';
    }

    const selectionHint = document.getElementById('tenant-selection-hint');
    if (selectionHint) {
        selectionHint.textContent = state.tenantCreateMode
            ? 'Create mode is active. Enter school details, then click Create New School.'
            : current
            ? `Editing "${current.name || current.code}". Update fields and click Save Changes, or use Delete School carefully.`
            : 'Select a school from the left to edit, or enter details below to create a new school.';
    }

    const monitoringBody = document.getElementById('school-monitoring-body');
    if (monitoringBody) {
        monitoringBody.innerHTML = tenants.length
            ? tenants.map((school) => {
                const alerts = Array.isArray(school.monitoring && school.monitoring.alerts) ? school.monitoring.alerts : [];
                const alertText = alerts.length ? alerts.map((alert) => alert.message).join(' | ') : 'No alerts';
                return `
                    <tr>
                        <td>${school.name || school.code}</td>
                        <td>${school.status || 'inactive'}</td>
                        <td>${alertText}</td>
                    </tr>
                `;
            }).join('')
            : '<tr><td colspan="3">No schools available</td></tr>';
    }

    const modulesGrid = document.getElementById('school-modules-grid');
    const modules = {
        enrollment: true,
        reports: true,
        messaging: true,
        ...(current && current.modules ? current.modules : {})
    };
    if (modulesGrid) {
        modulesGrid.innerHTML = Object.entries(modules).map(([key, enabled]) => `
            <label class="flag-item">
                <input type="checkbox" data-school-module="${key}" ${enabled ? 'checked' : ''}>
                <span>${key}</span>
            </label>
        `).join('');
    }

    const adminsBody = document.getElementById('school-admins-body');
    const schoolAdmins = Array.isArray(current && current.admins) ? current.admins : [];
    if (adminsBody) {
        adminsBody.innerHTML = schoolAdmins.length
            ? schoolAdmins.map((admin) => `
                <tr>
                    <td>${admin.name || `Admin #${admin.adminId}`}</td>
                    <td>${admin.email || 'N/A'}</td>
                    <td>${admin.role || 'admin'}</td>
                    <td>${formatDate(admin.lastLoginAt)}</td>
                    <td><button type="button" data-remove-school-admin="${admin.adminId}">Remove</button></td>
                </tr>
            `).join('')
            : '<tr><td colspan="5">No admins assigned</td></tr>';

        adminsBody.querySelectorAll('[data-remove-school-admin]').forEach((button) => {
            button.addEventListener('click', async () => {
                const adminId = Number(button.getAttribute('data-remove-school-admin')) || 0;
                if (!adminId || !current || !current.id) return;
                try {
                    await authFetch(`/api/system-health/schools/${current.id}/admins/${adminId}`, { method: 'DELETE' });
                    await loadDashboard();
                } catch (err) {
                    setActionResult({ success: false, error: err.message });
                }
            });
        });
    }

    // no longer use a dropdown: admins are created on the fly via input fields
    // we keep the table of existing school admins above but we do not populate any
    // "available" list for selection.

    const analyticsGrid = document.getElementById('school-analytics-grid');
    const analytics = current && current.analytics ? current.analytics : {};
    if (analyticsGrid) {
        analyticsGrid.innerHTML = [
            createMetricCard('Students', analytics.totalStudents ?? 0),
            createMetricCard('Active Users', analytics.activeUsers ?? 0),
            createMetricCard('Active Users / Day', analytics.activeUsersDaily ?? 0),
            createMetricCard('Active Users / Week', analytics.activeUsersWeekly ?? 0),
            createMetricCard('Failed Logins', analytics.failedLoginAttempts ?? 0),
            createMetricCard('Storage (MB)', analytics.estimatedStorageMb ?? 0)
        ].join('');
        animateCounters(analyticsGrid);
    }

    const securityBox = document.getElementById('school-security-box');
    const security = current && current.security ? current.security : {};
    if (securityBox) {
        securityBox.innerHTML = `
            <div><strong>Isolation Mode:</strong> ${security.dataIsolationMode || 'N/A'}</div>
            <div><strong>Cross-School Access:</strong> ${security.usersCrossSchoolAccessible === false ? 'Blocked' : 'Unknown'}</div>
            <div><strong>OTP Tracking:</strong> ${security.otpTrackingPerSchool ? 'Per School' : 'Shared'}</div>
            <div><strong>Session Tracking:</strong> ${security.sessionTrackingPerSchool ? 'Per School' : 'Shared'}</div>
        `;
    }

    const bindValue = (id, value) => {
        const element = document.getElementById(id);
        if (!element) return;
        element.value = value || '';
    };

    bindValue('tenant-code-input', current ? current.code : '');
    bindValue('tenant-school-id-input', current ? current.schoolId : '');
    bindValue('tenant-name-input', current ? current.name : '');
    bindValue('tenant-domain-input', current ? current.domain : '');
    bindValue('tenant-location-input', current ? current.location : '');
    bindValue('tenant-branding-input', current ? JSON.stringify(current.branding || {}) : '{}');
    const statusSelect = document.getElementById('tenant-status-select');
    if (statusSelect) statusSelect.value = current ? (current.status || 'active') : 'active';

    // clear admin creation fields when switching school
    const clearAdminFields = () => {
        const nameEl = document.getElementById('school-admin-name-input');
        const emailEl = document.getElementById('school-admin-email-input');
        const passEl = document.getElementById('school-admin-password-input');
        const permEl = document.getElementById('school-admin-permissions-input');
        if (nameEl) nameEl.value = '';
        if (emailEl) emailEl.value = '';
        if (passEl) passEl.value = '';
        if (permEl) permEl.value = '';
    };
    clearAdminFields();

    const updateBtn = document.getElementById('tenant-update-btn');
    if (updateBtn) {
        updateBtn.disabled = !current;
        updateBtn.title = current ? `Save updates to ${current.name || current.code}` : 'Select a school first to save updates';
    }

    const createBtn = document.getElementById('tenant-create-btn');
    if (createBtn) {
        createBtn.disabled = state.tenantCreateInProgress || state.tenantDeleteInProgress;
        createBtn.title = state.tenantCreateInProgress
            ? 'Create in progress...'
            : 'Create a new school from the form details';
    }

    const deleteBtn = document.getElementById('tenant-delete-btn');
    if (deleteBtn) {
        deleteBtn.disabled = !current || state.tenantDeleteInProgress;
        deleteBtn.title = state.tenantDeleteInProgress
            ? 'Delete in progress...'
            : (current ? `Delete ${current.name || current.code}` : 'Select a school first to delete');
    }
}

function renderVersionControl(data) {
    const version = data.versionControlPanel || {};
    document.getElementById('version-box').innerHTML = `
        <div><strong>Current System Version:</strong> ${version.currentVersion || 'N/A'}</div>
        <div><strong>Update Checker:</strong> ${version.updateAvailable ? `Update available (${version.latestVersion})` : 'Up to date'}</div>
        <div><strong>Rollback Option:</strong> ${version.rollbackAvailable ? 'Available' : 'Unavailable'}</div>
    `;

    renderList('patch-notes-list', version.patchNotes, (item) => `
        <li class="list-item">${item}</li>
    `);
}

function renderDashboard(data) {
    state.payload = data;
    document.getElementById('last-updated').textContent = `Updated: ${formatDate(data.generatedAt)}`;

    renderSystemHealth(data);
    renderHealthDetails(data);
    renderRealtimeAnalytics(data);
    renderAnalyticsChart(data);
    renderSecurityPanel(data);
    renderDatabaseManagement(data);
    renderErrorDebugConsole(data);
    renderUserActivity(data);
    renderSystemControls(data);
    renderApiMonitoring(data);
    renderPerformanceInsights(data);
    renderTenantManagement(data);
    renderVersionControl(data);
}

async function authFetch(url, options = {}) {
    const headers = {
        ...(options.headers || {})
    };

    if (typeof window.getDeveloperAuthHeaders === 'function') {
        Object.assign(headers, window.getDeveloperAuthHeaders());
    }

    const response = await fetch(url, {
        ...options,
        headers
    });

    if (response.status === 401 && typeof window.logoutDeveloper === 'function') {
        await window.logoutDeveloper({ redirectTo: 'developer-signin.html' });
        throw new Error('Developer session expired. Please sign in again.');
    }

    return response;
}

async function loadDashboard() {
    const response = await authFetch('/api/system-health');
    const payload = await response.json();
    if (!response.ok) {
        throw new Error(payload.error || `HTTP ${response.status}`);
    }
    renderDashboard(payload);
    setActionResult({ success: true, message: 'Dashboard loaded' });
}

async function postJson(url, body = {}) {
    const response = await authFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    const payload = await response.json();
    if (!response.ok) {
        throw new Error(payload.error || `HTTP ${response.status}`);
    }
    setActionResult(payload);
    return payload;
}

async function sampleApiResponseTime() {
    const start = performance.now();
    try {
        const response = await fetch('/api/health');
        const elapsed = Math.round(performance.now() - start);
        if (response.ok) {
            state.responseTimes.push(elapsed);
            if (state.responseTimes.length > 100) state.responseTimes.shift();
            renderResponseGraph();
        }
    } catch (_err) {
        state.responseTimes.push(0);
        if (state.responseTimes.length > 100) state.responseTimes.shift();
        renderResponseGraph();
    }
}

function collectFeatureFlagsFromUI() {
    const flags = {};
    document.querySelectorAll('[data-flag]').forEach((input) => {
        flags[input.getAttribute('data-flag')] = input.checked;
    });
    return flags;
}

function setActiveSidebarLink(hash) {
    document.querySelectorAll('.sidebar-link').forEach((link) => {
        const isActive = link.getAttribute('href') === hash;
        link.classList.toggle('active', isActive);
    });
}

function showSectionByHash(hash) {
    const sections = Array.from(document.querySelectorAll('.dashboard-section'));
    if (!sections.length) return;

    let targetHash = hash;
    if (!targetHash || !String(targetHash).startsWith('#')) {
        targetHash = `#${sections[0].id}`;
    }

    let found = false;
    sections.forEach((section) => {
        const isMatch = `#${section.id}` === targetHash;
        section.classList.toggle('active', isMatch);
        if (isMatch) found = true;
    });

    if (!found) {
        sections[0].classList.add('active');
        targetHash = `#${sections[0].id}`;
    }

    setActiveSidebarLink(targetHash);
    history.replaceState(null, '', targetHash);
}

function wireSidebarNavigation() {
    const links = Array.from(document.querySelectorAll('.sidebar-link'));

    links.forEach((link) => {
        link.addEventListener('click', (event) => {
            const targetHash = link.getAttribute('href');
            if (!targetHash || !targetHash.startsWith('#')) return;
            event.preventDefault();
            showSectionByHash(targetHash);
            if (isMobileViewport()) {
                setMobileSidebarOpen(false);
            }
        });
    });

    showSectionByHash(window.location.hash);
}

function wireEvents() {
    document.getElementById('mobile-menu-btn').addEventListener('click', () => {
        setMobileSidebarOpen(!state.mobileSidebarOpen);
    });

    document.getElementById('sidebar-overlay').addEventListener('click', () => {
        setMobileSidebarOpen(false);
    });

    window.addEventListener('resize', () => {
        if (!isMobileViewport()) {
            setMobileSidebarOpen(false);
        }
    });

    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && state.mobileSidebarOpen) {
            setMobileSidebarOpen(false);
        }
    });

    document.getElementById('sidebar-toggle-btn').addEventListener('click', () => {
        const next = !state.sidebarCollapsed;
        applySidebarState(next);
        localStorage.setItem(STORAGE_KEYS.sidebarCollapsed, String(next));
    });

    document.getElementById('theme-toggle-btn').addEventListener('click', () => {
        const next = !state.lightTheme;
        applyThemeState(next);
        localStorage.setItem(STORAGE_KEYS.lightTheme, String(next));
    });

    document.getElementById('refresh-btn').addEventListener('click', async () => {
        try {
            await loadDashboard();
        } catch (err) {
            setActionResult({ success: false, error: err.message });
        }
    });

    const logoutButton = document.getElementById('developerLogoutBtn');
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            if (typeof window.logoutDeveloper === 'function') {
                window.logoutDeveloper({ redirectTo: 'developer-signin.html' });
            }
        });
    }

    document.getElementById('health-refresh-btn').addEventListener('click', async () => {
        try {
            await loadDashboard();
            setActionResult({ success: true, message: 'System health refreshed.' });
        } catch (err) {
            setActionResult({ success: false, error: err.message });
        }
    });

    document.getElementById('health-open-api-btn').addEventListener('click', () => {
        showSectionByHash('#section-api');
    });

    document.getElementById('health-open-debug-btn').addEventListener('click', () => {
        showSectionByHash('#section-debug');
    });

    document.getElementById('run-query-btn').addEventListener('click', async () => {
        const sql = document.getElementById('safe-query-input').value.trim();
        try {
            const payload = await postJson('/api/system-health/db/query', { sql });
            document.getElementById('query-result').textContent = JSON.stringify(payload, null, 2);
        } catch (err) {
            const failure = { success: false, error: err.message };
            document.getElementById('query-result').textContent = JSON.stringify(failure, null, 2);
            setActionResult(failure);
        }
    });

    document.getElementById('backup-db-btn').addEventListener('click', async () => {
        try {
            await postJson('/api/system-health/db/backup');
            await loadDashboard();
        } catch (err) {
            setActionResult({ success: false, error: err.message });
        }
    });

    document.getElementById('restore-db-btn').addEventListener('click', async () => {
        try {
            await postJson('/api/system-health/db/restore', { backupFile: 'latest' });
        } catch (err) {
            setActionResult({ success: false, error: err.message });
        }
    });

    document.getElementById('maintenance-toggle-btn').addEventListener('click', async () => {
        try {
            await postJson('/api/system-health/controls/maintenance', {});
            await loadDashboard();
        } catch (err) {
            setActionResult({ success: false, error: err.message });
        }
    });

    document.getElementById('logout-all-btn').addEventListener('click', async () => {
        try {
            await postJson('/api/system-health/controls/logout-all');
            await loadDashboard();
        } catch (err) {
            setActionResult({ success: false, error: err.message });
        }
    });

    document.getElementById('clear-cache-btn').addEventListener('click', async () => {
        try {
            await postJson('/api/system-health/controls/clear-cache');
            await loadDashboard();
        } catch (err) {
            setActionResult({ success: false, error: err.message });
        }
    });

    document.getElementById('reset-otp-btn').addEventListener('click', async () => {
        try {
            await postJson('/api/system-health/controls/reset-otp');
            await loadDashboard();
        } catch (err) {
            setActionResult({ success: false, error: err.message });
        }
    });

    document.getElementById('save-flags-btn').addEventListener('click', async () => {
        try {
            const features = collectFeatureFlagsFromUI();
            await postJson('/api/system-health/controls/features', { features });
            await loadDashboard();
        } catch (err) {
            setActionResult({ success: false, error: err.message });
        }
    });

    const schoolSearchInput = document.getElementById('school-search-input');
    if (schoolSearchInput) {
        schoolSearchInput.addEventListener('input', () => {
            state.schoolSearchQuery = String(schoolSearchInput.value || '').trim();
            if (state.payload) renderTenantManagement(state.payload);
        });
    }

    const logoInput = document.getElementById('tenant-logo-input');
    if (logoInput) {
        logoInput.addEventListener('change', async () => {
            const file = logoInput.files && logoInput.files[0];
            if (!file) {
                state.pendingLogoData = null;
                return;
            }

            if (file.size > TENANT_LOGO_MAX_BYTES) {
                state.pendingLogoData = null;
                logoInput.value = '';
                setTenantFeedback(`Logo is too large. Maximum allowed size is ${Math.floor(TENANT_LOGO_MAX_BYTES / 1024)} KB.`, 'error');
                setActionResult({
                    success: false,
                    error: `Logo file is too large (${Math.ceil(file.size / 1024)} KB). Max ${Math.floor(TENANT_LOGO_MAX_BYTES / 1024)} KB.`
                });
                return;
            }

            const reader = new FileReader();
            reader.onload = () => {
                state.pendingLogoData = String(reader.result || '');
            };
            reader.onerror = () => {
                state.pendingLogoData = null;
                setActionResult({ success: false, error: 'Failed to read selected logo file' });
            };
            reader.readAsDataURL(file);
        });
    }

    const getCurrentSchool = () => {
        const tenants = state.payload && state.payload.tenantManagement && Array.isArray(state.payload.tenantManagement.tenants)
            ? state.payload.tenantManagement.tenants
            : [];
        return tenants.find((item) => Number(item.id) === Number(state.selectedSchoolId)) || null;
    };

    document.getElementById('tenant-create-btn').addEventListener('click', async () => {
        if (state.tenantCreateInProgress) {
            return;
        }

        const code = String(document.getElementById('tenant-code-input').value || '').trim().toLowerCase();
        const name = String(document.getElementById('tenant-name-input').value || '').trim();
        const schoolId = String(document.getElementById('tenant-school-id-input').value || '').trim();
        const domain = String(document.getElementById('tenant-domain-input').value || '').trim();
        const location = String(document.getElementById('tenant-location-input').value || '').trim();
        const status = String(document.getElementById('tenant-status-select').value || 'active').trim();
        const branding = parseJsonInput(document.getElementById('tenant-branding-input').value || '{}', {});

        if (!code || !name) {
            setTenantFeedback('School Code and School Name are required.', 'error');
            setActionResult({ success: false, error: 'School code and school name are required' });
            return;
        }

        let progressInterval = null;
        try {
            state.tenantCreateInProgress = true;
            if (state.payload) renderTenantManagement(state.payload);
            setTenantCreateProgress(8, 'Validating school details...');
            await new Promise((resolve) => setTimeout(resolve, 120));
            setTenantCreateProgress(22, `Creating ${name || code} tenant...`);
            await new Promise((resolve) => setTimeout(resolve, 150));
            setTenantCreateProgress(34, 'Provisioning school tenant...');

            let progressValue = 34;
            progressInterval = setInterval(() => {
                progressValue = Math.min(progressValue + 5, 90);
                const phaseLabel = progressValue < 65
                    ? 'Provisioning school tenant...'
                    : 'Saving school records...';
                setTenantCreateProgress(progressValue, phaseLabel);
            }, 300);

            const payload = await postJson('/api/system-health/tenants', {
                code,
                name,
                schoolId,
                domain,
                location,
                status,
                branding,
                logoData: state.pendingLogoData || null
            });

            const createdId = Number(payload && payload.currentTenant && payload.currentTenant.id) || 0;
            if (createdId) {
                state.selectedSchoolId = createdId;
            }

            if (progressInterval) {
                clearInterval(progressInterval);
                progressInterval = null;
            }

            state.tenantCreateMode = false;
            state.pendingLogoData = null;
            if (logoInput) logoInput.value = '';
            setTenantCreateProgress(95, 'Finalizing setup and refreshing dashboard...');
            await loadDashboard();
            setTenantCreateProgress(100, `School "${name}" created successfully.`);
            setTenantFeedback(`School "${name}" was created successfully.`, 'success');
            await new Promise((resolve) => setTimeout(resolve, 900));
            setTenantCreateProgress(0, '');
        } catch (err) {
            if (progressInterval) {
                clearInterval(progressInterval);
                progressInterval = null;
            }
            setTenantCreateProgress(100, 'School creation failed.');
            setTenantFeedback(err.message || 'Failed to create school.', 'error');
            setActionResult({ success: false, error: err.message });
            await new Promise((resolve) => setTimeout(resolve, 1100));
            setTenantCreateProgress(0, '');
        } finally {
            state.tenantCreateInProgress = false;
            if (state.payload) renderTenantManagement(state.payload);
        }
    });

    document.getElementById('tenant-new-btn').addEventListener('click', () => {
        state.tenantCreateMode = true;
        state.selectedSchoolId = null;
        state.pendingLogoData = null;
        setTenantFeedback('Create mode enabled. Fill out the form, then click Create New School.', 'success');

        const idsToClear = [
            'tenant-code-input',
            'tenant-school-id-input',
            'tenant-name-input',
            'tenant-domain-input',
            'tenant-location-input'
        ];
        idsToClear.forEach((id) => {
            const element = document.getElementById(id);
            if (element) element.value = '';
        });

        const brandingInput = document.getElementById('tenant-branding-input');
        if (brandingInput) brandingInput.value = '{}';

        const statusSelect = document.getElementById('tenant-status-select');
        if (statusSelect) statusSelect.value = 'active';

        if (logoInput) logoInput.value = '';

        if (state.payload) renderTenantManagement(state.payload);
        const codeInput = document.getElementById('tenant-code-input');
        if (codeInput) codeInput.focus();

        setActionResult({ success: true, message: 'Create mode enabled. Enter details then click Create New School.' });
    });

    document.getElementById('tenant-update-btn').addEventListener('click', async () => {
        const currentSchool = getCurrentSchool();
        if (!currentSchool || !currentSchool.id) {
            setActionResult({ success: false, error: 'Select a school first' });
            return;
        }

        try {
            const updateBody = {
                code: String(document.getElementById('tenant-code-input').value || '').trim().toLowerCase(),
                name: String(document.getElementById('tenant-name-input').value || '').trim(),
                schoolId: String(document.getElementById('tenant-school-id-input').value || '').trim(),
                domain: String(document.getElementById('tenant-domain-input').value || '').trim(),
                location: String(document.getElementById('tenant-location-input').value || '').trim(),
                status: String(document.getElementById('tenant-status-select').value || 'active').trim(),
                branding: parseJsonInput(document.getElementById('tenant-branding-input').value || '{}', {})
            };

            if (state.pendingLogoData) {
                updateBody.logoData = state.pendingLogoData;
            }

            const response = await authFetch(`/api/system-health/tenants/${currentSchool.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateBody)
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
            state.pendingLogoData = null;
            if (logoInput) logoInput.value = '';
            await loadDashboard();
            setTenantFeedback(payload.message || 'School updated successfully.', 'success');
        } catch (err) {
            setTenantFeedback(err.message || 'Failed to update school.', 'error');
            setActionResult({ success: false, error: err.message });
        }
    });

    document.getElementById('tenant-delete-btn').addEventListener('click', async () => {
        if (state.tenantDeleteInProgress) {
            return;
        }

        const currentSchool = getCurrentSchool();
        if (!currentSchool || !currentSchool.id) {
            setActionResult({ success: false, error: 'Select a school first' });
            return;
        }

        const confirmed = window.confirm(`Delete school "${currentSchool.name || currentSchool.code}"? This cannot be undone.`);
        if (!confirmed) {
            setActionResult({ success: false, error: 'Delete cancelled' });
            return;
        }

        let progressInterval = null;
        try {
            state.tenantDeleteInProgress = true;
            if (state.payload) renderTenantManagement(state.payload);
            setTenantDeleteProgress(8, 'Preparing deletion request...');

            await new Promise((resolve) => setTimeout(resolve, 120));
            setTenantDeleteProgress(20, `Starting deletion for ${currentSchool.name || currentSchool.code}...`);
            await new Promise((resolve) => setTimeout(resolve, 140));
            setTenantDeleteProgress(28, 'Deleting tenant database...');

            let progressValue = 28;
            progressInterval = setInterval(() => {
                progressValue = Math.min(progressValue + 4, 88);
                const phaseLabel = progressValue < 60
                    ? 'Deleting tenant database...'
                    : 'Removing school records...';
                setTenantDeleteProgress(progressValue, phaseLabel);
            }, 320);

            const response = await authFetch(`/api/system-health/tenants/${currentSchool.id}`, { method: 'DELETE' });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);

            if (progressInterval) {
                clearInterval(progressInterval);
                progressInterval = null;
            }

            setTenantDeleteProgress(93, 'Finalizing deletion and refreshing dashboard...');
            state.selectedSchoolId = null;
            await loadDashboard();
            setTenantDeleteProgress(100, payload.message || 'School deleted successfully.');
            setTenantFeedback(payload.message || 'School deleted successfully.', 'success');
            await new Promise((resolve) => setTimeout(resolve, 950));
            setTenantDeleteProgress(0, '');
        } catch (err) {
            if (progressInterval) {
                clearInterval(progressInterval);
                progressInterval = null;
            }
            setTenantDeleteProgress(100, 'Deletion failed.');
            setTenantFeedback(err.message || 'Failed to delete school.', 'error');
            setActionResult({ success: false, error: err.message });
            await new Promise((resolve) => setTimeout(resolve, 1200));
            setTenantDeleteProgress(0, '');
        } finally {
            state.tenantDeleteInProgress = false;
            if (state.payload) renderTenantManagement(state.payload);
        }
    });

    document.getElementById('school-admin-assign-btn').addEventListener('click', async () => {
        const currentSchool = getCurrentSchool();
        const name = String(document.getElementById('school-admin-name-input').value || '').trim();
        const email = String(document.getElementById('school-admin-email-input').value || '').trim();
        const password = String(document.getElementById('school-admin-password-input').value || '');
        const role = String(document.getElementById('school-admin-role-select').value || 'admin').trim();
        const permissions = parseJsonInput(document.getElementById('school-admin-permissions-input').value || '{}', {});

        if (!currentSchool || !currentSchool.id) {
            setActionResult({ success: false, error: 'Select a school first' });
            return;
        }
        if (!name || !email || !password) {
            setActionResult({ success: false, error: 'Name, email, and password are required' });
            return;
        }
        if (password.length < 8) {
            setActionResult({ success: false, error: 'Password must be at least 8 characters' });
            return;
        }

        try {
            // first create the admin account using tenant context (school code)
            const schoolCode = currentSchool.code || '';
            const registerUrl = `/api/admin/register${schoolCode ? `?school=${encodeURIComponent(schoolCode)}` : ''}`;
            const regPayload = { name, email, password, role };
            const regResp = await postJson(registerUrl, regPayload);
            const newAdminId = regResp && regResp.admin && regResp.admin.id;

            if (newAdminId) {
                // ensure assignment record exists too
                await postJson(`/api/system-health/schools/${currentSchool.id}/admins`, {
                    adminId: newAdminId,
                    role,
                    permissions
                });
            }

            // clear inputs
            document.getElementById('school-admin-name-input').value = '';
            document.getElementById('school-admin-email-input').value = '';
            document.getElementById('school-admin-password-input').value = '';
            document.getElementById('school-admin-permissions-input').value = '';

            await loadDashboard();
        } catch (err) {
            setActionResult({ success: false, error: err.message });
        }
    });

    document.getElementById('school-save-modules-btn').addEventListener('click', async () => {
        const currentSchool = getCurrentSchool();
        if (!currentSchool || !currentSchool.id) {
            setActionResult({ success: false, error: 'Select a school first' });
            return;
        }

        const modules = {};
        document.querySelectorAll('[data-school-module]').forEach((input) => {
            modules[input.getAttribute('data-school-module')] = !!input.checked;
        });

        try {
            await postJson(`/api/system-health/schools/${currentSchool.id}/modules`, { modules });
            await loadDashboard();
        } catch (err) {
            setActionResult({ success: false, error: err.message });
        }
    });

    document.getElementById('school-switch-btn').addEventListener('click', async () => {
        const currentSchool = getCurrentSchool();
        if (!currentSchool || !currentSchool.id) {
            setActionResult({ success: false, error: 'Select a school first' });
            return;
        }
        try {
            await postJson(`/api/system-health/tenants/${currentSchool.id}/switch`, {});
            await loadDashboard();
        } catch (err) {
            setActionResult({ success: false, error: err.message });
        }
    });

    document.getElementById('school-backup-btn').addEventListener('click', async () => {
        const currentSchool = getCurrentSchool();
        if (!currentSchool || !currentSchool.id) {
            setActionResult({ success: false, error: 'Select a school first' });
            return;
        }
        try {
            await postJson(`/api/system-health/schools/${currentSchool.id}/controls/backup`, {});
        } catch (err) {
            setActionResult({ success: false, error: err.message });
        }
    });

    document.getElementById('school-restore-btn').addEventListener('click', async () => {
        const currentSchool = getCurrentSchool();
        if (!currentSchool || !currentSchool.id) {
            setActionResult({ success: false, error: 'Select a school first' });
            return;
        }
        try {
            await postJson(`/api/system-health/schools/${currentSchool.id}/controls/restore`, {});
        } catch (err) {
            setActionResult({ success: false, error: err.message });
        }
    });

    document.getElementById('school-force-logout-btn').addEventListener('click', async () => {
        const currentSchool = getCurrentSchool();
        if (!currentSchool || !currentSchool.id) {
            setActionResult({ success: false, error: 'Select a school first' });
            return;
        }
        try {
            await postJson(`/api/system-health/schools/${currentSchool.id}/controls/logout`, {});
            await loadDashboard();
        } catch (err) {
            setActionResult({ success: false, error: err.message });
        }
    });

    document.getElementById('school-reset-otp-btn').addEventListener('click', async () => {
        const currentSchool = getCurrentSchool();
        if (!currentSchool || !currentSchool.id) {
            setActionResult({ success: false, error: 'Select a school first' });
            return;
        }
        try {
            await postJson(`/api/system-health/schools/${currentSchool.id}/controls/reset-otp`, {});
            await loadDashboard();
        } catch (err) {
            setActionResult({ success: false, error: err.message });
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    if (typeof window.requireDeveloperAuth === 'function') {
        const allowed = window.requireDeveloperAuth({ redirectTo: 'developer-signin.html' });
        if (!allowed) return;
    }

    loadUiPreferences();
    wireEvents();
    wireSidebarNavigation();

    try {
        await loadDashboard();
    } catch (err) {
        setActionResult({ success: false, error: err.message });
    }

    await sampleApiResponseTime();
    window.setInterval(sampleApiResponseTime, 15000);
    window.setInterval(loadDashboard, 60000);
});


