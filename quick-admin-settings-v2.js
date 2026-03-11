(function () {
  'use strict';

  window.__useQuickAdminSettingsV2 = true;

  const SETTINGS_KEY_BASE = 'qas2.adminSettings.v1';
  const PORTAL_KEY_BASE = 'qas2.adminPortal.v1';
  const BACKUP_KEY_BASE = 'qas2.backupPolicy.v1';
  const ARCHIVED_STUDENTS_KEY_BASE = 'sms.archivedStudents.v1';
  const LEGACY_SETTINGS_KEY_BASE = 'adminDashboardSettingsV1';
  const LEGACY_PORTAL_KEY_BASE = 'adminPortalPageContentV1';
  const BACKUP_SCOPE_DEFAULTS = ['students', 'enrollments', 'sections', 'school_years', 'teachers', 'teacher_assignments', 'registration_codes', 'notifications'];

  function detectSchoolCode() {
    try {
      const params = new URLSearchParams(window.location.search || '');
      const fromQuery = String(params.get('school') || params.get('tenant') || '').trim().toLowerCase();
      if (fromQuery) return fromQuery;
    } catch (_) {}
    return String(localStorage.getItem('sms.selectedSchoolCode') || localStorage.getItem('sms.selectedTenantCode') || '').trim().toLowerCase();
  }

  function scopedKey(base) {
    const school = detectSchoolCode();
    return school ? `${base}:${school}` : base;
  }

  function readScoped(base, fallbackBase) {
    const scoped = localStorage.getItem(scopedKey(base));
    if (scoped && String(scoped).trim()) return scoped;
    if (fallbackBase) {
      const legacyScoped = localStorage.getItem(scopedKey(fallbackBase));
      if (legacyScoped && String(legacyScoped).trim()) return legacyScoped;
      return localStorage.getItem(fallbackBase);
    }
    return localStorage.getItem(base);
  }

  function writeScoped(base, value, mirrorLegacyBase) {
    localStorage.setItem(scopedKey(base), value);
    if (mirrorLegacyBase) {
      localStorage.setItem(scopedKey(mirrorLegacyBase), value);
    }
  }

  function notify(message, type) {
    if (typeof window.showNotification === 'function') {
      window.showNotification(message, type || 'info');
      return;
    }
    const node = document.getElementById('notification');
    if (!node) return;
    node.textContent = String(message || 'Done');
    node.classList.remove('success', 'error', 'show');
    node.classList.add(type === 'success' ? 'success' : type === 'error' ? 'error' : 'success');
    node.classList.add('show');
    setTimeout(() => node.classList.remove('show'), 2200);
  }

  function readArchivedStudentsLocal() {
    try {
      const raw = localStorage.getItem(scopedKey(ARCHIVED_STUDENTS_KEY_BASE));
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function writeArchivedStudentsLocal(records) {
    const normalized = Array.isArray(records) ? records : [];
    localStorage.setItem(scopedKey(ARCHIVED_STUDENTS_KEY_BASE), JSON.stringify(normalized));
    try {
      window.dispatchEvent(new CustomEvent('sms:archived-students-updated', { detail: { count: normalized.length } }));
    } catch (_) {}
  }

  function defaults() {
    let adminName = 'Admin';
    let adminEmail = '';
    try {
      const raw = localStorage.getItem('adminData');
      if (raw) {
        const parsed = JSON.parse(raw);
        adminName = parsed?.name || adminName;
        adminEmail = parsed?.email || '';
      }
    } catch (_) {}

    return {
      settings: {
        account: { name: adminName, email: adminEmail },
        notifications: { inApp: true, sound: false, enrollment: true, section: true, teacher: true },
        security: { sessionTimeout: '30', reauthDestructive: true }
      },
      portal: {
        heroTagline: '',
        aboutTitle: '',
        aboutCardsHtml: '',
        schoolInfoTitle: '',
        schoolInfoCardsHtml: '',
        footerTagline: '',
        contactHtml: '',
        copyrightText: ''
      },
      backup: {
        enabled: false,
        interval_hours: 24
      }
    };
  }

  function normalizeSettings(candidate) {
    const d = defaults().settings;
    const src = candidate && typeof candidate === 'object' ? candidate : {};
    return {
      account: { ...d.account, ...(src.account || {}) },
      notifications: { ...d.notifications, ...(src.notifications || {}) },
      security: { ...d.security, ...(src.security || {}) }
    };
  }

  function normalizePortal(candidate) {
    const d = defaults().portal;
    const src = candidate && typeof candidate === 'object' ? candidate : {};
    return {
      heroTagline: String(src.heroTagline ?? d.heroTagline ?? ''),
      aboutTitle: String(src.aboutTitle ?? d.aboutTitle ?? ''),
      aboutCardsHtml: String(src.aboutCardsHtml ?? d.aboutCardsHtml ?? ''),
      schoolInfoTitle: String(src.schoolInfoTitle ?? d.schoolInfoTitle ?? ''),
      schoolInfoCardsHtml: String(src.schoolInfoCardsHtml ?? d.schoolInfoCardsHtml ?? ''),
      footerTagline: String(src.footerTagline ?? d.footerTagline ?? ''),
      contactHtml: String(src.contactHtml ?? d.contactHtml ?? ''),
      copyrightText: String(src.copyrightText ?? d.copyrightText ?? '')
    };
  }

  function normalizeBackup(candidate) {
    const d = defaults().backup;
    const src = candidate && typeof candidate === 'object' ? candidate : {};
    return {
      enabled: !!src.enabled,
      interval_hours: Number(src.interval_hours || d.interval_hours || 24)
    };
  }

  function loadLocal() {
    let settings = defaults().settings;
    let portal = defaults().portal;
    let backup = defaults().backup;

    try {
      const rawSettings = readScoped(SETTINGS_KEY_BASE, LEGACY_SETTINGS_KEY_BASE);
      if (rawSettings) settings = normalizeSettings(JSON.parse(rawSettings));
    } catch (_) {}

    try {
      const rawPortal = readScoped(PORTAL_KEY_BASE, LEGACY_PORTAL_KEY_BASE);
      if (rawPortal) portal = normalizePortal(JSON.parse(rawPortal));
    } catch (_) {}

    try {
      const rawBackup = readScoped(BACKUP_KEY_BASE, null);
      if (rawBackup) backup = normalizeBackup(JSON.parse(rawBackup));
    } catch (_) {}

    return { settings, portal, backup };
  }

  function persistLocal(state) {
    writeScoped(SETTINGS_KEY_BASE, JSON.stringify(normalizeSettings(state.settings)), LEGACY_SETTINGS_KEY_BASE);
    writeScoped(PORTAL_KEY_BASE, JSON.stringify(normalizePortal(state.portal)), LEGACY_PORTAL_KEY_BASE);
    writeScoped(BACKUP_KEY_BASE, JSON.stringify(normalizeBackup(state.backup)), null);
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

  function resolveAdminIdFromToken() {
    try {
      const payload = decodeJwtPayload(localStorage.getItem('adminAuthToken')) || {};
      const id = Number(payload.uid || payload.adminId || payload.admin_id || payload.sub || 0);
      return id > 0 ? id : null;
    } catch (_) {
      return null;
    }
  }

  async function resolveAdminId() {
    const school = detectSchoolCode();
    const scopedAdminKey = school ? `adminData:${school}` : 'adminData';

    try {
      const response = await apiCall('/api/admin/me', 'GET');
      const id = Number(response?.admin?.id || response?.admin?.admin_id || 0);
      if (id > 0) {
        const normalizedAdmin = {
          id,
          email: String(response?.admin?.email || ''),
          name: String(response?.admin?.name || 'Admin'),
          role: String(response?.admin?.role || 'admin'),
          loginTime: new Date().toISOString()
        };
        sessionStorage.setItem(scopedAdminKey, JSON.stringify(normalizedAdmin));
        localStorage.setItem(scopedAdminKey, JSON.stringify(normalizedAdmin));
        localStorage.setItem('adminData', JSON.stringify(normalizedAdmin));
        return id;
      }
    } catch (_) {}

    try {
      if (typeof sessionManager !== 'undefined' && sessionManager.getTabSession) {
        const tabData = sessionManager.getTabSession('adminData');
        const id = Number(tabData?.id || tabData?.admin_id || 0);
        if (id > 0) return id;
      }
    } catch (_) {}

    try {
      const scopedRaw = sessionStorage.getItem(scopedAdminKey) || localStorage.getItem(scopedAdminKey);
      if (scopedRaw) {
        const scoped = JSON.parse(scopedRaw);
        const id = Number(scoped?.id || scoped?.admin_id || 0);
        if (id > 0) return id;
      }
    } catch (_) {}

    try {
      const raw = localStorage.getItem('adminData');
      if (raw) {
        const parsed = JSON.parse(raw);
        const id = Number(parsed?.id || parsed?.admin_id || 0);
        if (id > 0) return id;
      }
    } catch (_) {}

    const tokenId = resolveAdminIdFromToken();
    if (tokenId) return tokenId;

    return null;
  }

  async function apiCall(path, method, body) {
    const school = detectSchoolCode();
    const url = new URL(path, window.location.origin);
    if (school) url.searchParams.set('school', school);

    const token = String(localStorage.getItem('adminAuthToken') || '').trim();
    const headers = {
      'Content-Type': 'application/json',
      ...(school ? { 'x-tenant-code': school } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    const response = await fetch(url.pathname + url.search, {
      method,
      credentials: 'include',
      headers,
      ...(body ? { body: JSON.stringify(body) } : {})
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error || data?.message || `Request failed (${response.status})`);
    }
    return data;
  }

  function injectStyles() {
    if (document.getElementById('qas2-style')) return;
    const style = document.createElement('style');
    style.id = 'qas2-style';
    style.textContent = `
      .qas2-overlay{position:fixed;inset:0;display:none;z-index:1400}
      .qas2-overlay.active{display:block}
      .qas2-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.48)}
      .qas2-panel{position:absolute;right:0;top:0;height:100%;width:min(460px,96vw);background:var(--modal-bg,#fff);color:var(--text-primary,#111);display:flex;flex-direction:column;border-left:1px solid var(--border-primary,#ddd)}
      .qas2-header{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid var(--border-primary,#ddd)}
      .qas2-title{font-size:18px;font-weight:700}
      .qas2-close{width:34px;height:34px;border-radius:8px;border:1px solid var(--border-primary,#ddd);background:transparent;cursor:pointer}
      .qas2-tabs{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;padding:12px 16px;border-bottom:1px solid var(--border-primary,#ddd)}
      .qas2-tabs{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;padding:12px 16px;border-bottom:1px solid var(--border-primary,#ddd)}
      .qas2-tab{border:1px solid var(--border-primary,#ddd);border-radius:8px;padding:8px;font-size:12px;font-weight:600;background:var(--bg-secondary,#f6f7f8);cursor:pointer}
      .qas2-tab.active{background:var(--primary-green,#1e5631);color:#fff;border-color:var(--primary-green,#1e5631)}
      .qas2-body{padding:14px 16px;overflow:auto;flex:1}
      .qas2-content{display:none}
      .qas2-content.active{display:block}
      .qas2-field{display:flex;flex-direction:column;gap:6px;margin-bottom:12px}
      .qas2-input,.qas2-select,.qas2-textarea{border:1px solid var(--border-primary,#ddd);border-radius:8px;padding:9px 10px;background:var(--bg-primary,#fff);color:inherit}
      .qas2-check{display:flex;align-items:center;gap:9px;margin-bottom:10px;font-size:14px}
      .qas2-scope{display:grid;grid-template-columns:1fr 1fr;gap:8px 12px}
      .qas2-backup-card{border:1px solid var(--border-primary,#ddd);border-radius:10px;padding:12px;background:var(--bg-secondary,#f6f7f8);margin-top:10px}
      .qas2-backup-retention{font-size:12px;color:var(--text-secondary,#667085);margin:0 0 10px}
      .qas2-backup-actions{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}
      .qas2-backup-meta{font-size:12px;color:var(--text-secondary,#667085);margin-bottom:10px}
      .qas2-backup-table-wrap{border:1px solid var(--border-primary,#ddd);border-radius:8px;overflow:hidden;background:var(--bg-primary,#fff)}
      .qas2-backup-table{width:100%;border-collapse:collapse;font-size:12px}
      .qas2-backup-table th,.qas2-backup-table td{padding:8px;border-bottom:1px solid var(--border-primary,#eee);text-align:left}
      .qas2-backup-table tbody tr:last-child td{border-bottom:none}
      .qas2-footer{display:flex;justify-content:flex-end;gap:10px;padding:12px 16px;border-top:1px solid var(--border-primary,#ddd);background:var(--bg-secondary,#f6f7f8)}
      .qas2-status{font-size:12px;color:var(--text-secondary,#667085);margin:6px 16px 0}
      .qas2-archived-list{display:flex;flex-direction:column;gap:10px}
      .qas2-archived-item{border:1px solid var(--border-primary,#ddd);border-radius:10px;padding:10px;background:var(--bg-primary,#fff)}
      .qas2-archived-row{display:flex;justify-content:space-between;align-items:center;gap:10px}
      .qas2-archived-name{font-size:14px;font-weight:700}
      .qas2-archived-meta{font-size:12px;color:var(--text-secondary,#667085);margin-top:4px}
      .qas2-archived-empty{border:1px dashed var(--border-primary,#ddd);border-radius:10px;padding:16px;text-align:center;color:var(--text-secondary,#667085)}
      .qas2-archived-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:10px}
      @media(max-width:560px){.qas2-tabs{grid-template-columns:1fr}.qas2-scope{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function createPanel() {
    if (document.getElementById('qas2Overlay')) return;

    const legacy = document.getElementById('adminSettingsOverlay');
    if (legacy) legacy.remove();

    const wrap = document.createElement('div');
    wrap.id = 'qas2Overlay';
    wrap.className = 'qas2-overlay';
    wrap.innerHTML = `
      <div class="qas2-backdrop" id="qas2Backdrop"></div>
      <aside class="qas2-panel" role="dialog" aria-modal="true" aria-labelledby="qas2Title">
        <div class="qas2-header">
          <div class="qas2-title" id="qas2Title">Quick Admin Settings</div>
          <button class="qas2-close" id="qas2Close" aria-label="Close">✕</button>
        </div>
        <div class="qas2-tabs">
          <button class="qas2-tab active" data-qas2-tab="account">Account</button>
          <button class="qas2-tab" data-qas2-tab="notifications">Notification</button>
          <button class="qas2-tab" data-qas2-tab="security">Security</button>
          <button class="qas2-tab" data-qas2-tab="portal">Portal</button>
          <button class="qas2-tab" data-qas2-tab="backup">Backup</button>
          <button class="qas2-tab" data-qas2-tab="archived">Archived</button>
        </div>
        <div class="qas2-body">
          <section class="qas2-content active" data-qas2-panel="account">
            <div class="qas2-field"><label>Display Name</label><input id="qas2Name" class="qas2-input" type="text"></div>
            <div class="qas2-field"><label>Email</label><input id="qas2Email" class="qas2-input" type="email"></div>
            <div class="qas2-field" id="qas2RegCodeField">
              <label>Registration Code</label>
              <div style="display:flex;gap:8px;align-items:center;">
                <input id="qas2RegCode" class="qas2-input" type="text" readonly style="flex:1;font-family:monospace;" />
                <button type="button" id="qas2CopyRegCode" class="btn btn-small">Copy</button>
                <button type="button" id="qas2GenRegCode" class="btn btn-secondary">Regenerate</button>
              </div>
              <small>Only one active code is valid. Regenerate to replace it.</small>
            </div>
          </section>
          <section class="qas2-content" data-qas2-panel="notifications">
            <label class="qas2-check"><input id="qas2NotifInApp" type="checkbox"><span>Enable in-app notifications</span></label>
            <label class="qas2-check"><input id="qas2NotifSound" type="checkbox"><span>Enable notification sounds</span></label>
            <label class="qas2-check"><input id="qas2NotifEnrollment" type="checkbox"><span>Enrollment updates</span></label>
            <label class="qas2-check"><input id="qas2NotifSection" type="checkbox"><span>Section updates</span></label>
            <label class="qas2-check"><input id="qas2NotifTeacher" type="checkbox"><span>Teacher assignment updates</span></label>
          </section>
          <section class="qas2-content" data-qas2-panel="security">
            <div class="qas2-field">
              <label>Session Timeout</label>
              <select id="qas2SessionTimeout" class="qas2-select">
                <option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">60 minutes</option><option value="120">120 minutes</option>
              </select>
            </div>
            <label class="qas2-check"><input id="qas2Reauth" type="checkbox"><span>Require re-auth for delete/activate actions</span></label>
          </section>
          <section class="qas2-content" data-qas2-panel="portal">
            <div class="qas2-field"><label>Hero Tagline</label><input id="qas2HeroTagline" class="qas2-input" type="text"></div>
            <div class="qas2-field"><label>About Title</label><input id="qas2AboutTitle" class="qas2-input" type="text"></div>
            <div class="qas2-field"><label>About Cards (HTML)</label><textarea id="qas2AboutHtml" class="qas2-textarea" rows="4"></textarea></div>
            <div class="qas2-field"><label>School Info Title</label><input id="qas2InfoTitle" class="qas2-input" type="text"></div>
            <div class="qas2-field"><label>School Info Cards (HTML)</label><textarea id="qas2InfoHtml" class="qas2-textarea" rows="4"></textarea></div>
            <div class="qas2-field"><label>Footer Tagline</label><input id="qas2FooterTagline" class="qas2-input" type="text"></div>
            <div class="qas2-field"><label>Footer Contact HTML</label><textarea id="qas2ContactHtml" class="qas2-textarea" rows="3"></textarea></div>
            <div class="qas2-field"><label>Footer Copyright</label><input id="qas2Copyright" class="qas2-input" type="text"></div>
          </section>
          <section class="qas2-content" data-qas2-panel="backup">
            <label class="qas2-check"><input id="qas2BackupEnabled" type="checkbox"><span>Enable scheduled backups</span></label>
            <div class="qas2-field"><label>Backup Frequency</label>
              <select id="qas2BackupInterval" class="qas2-select">
                <option value="1">Every 1 hour</option><option value="6">Every 6 hours</option><option value="12">Every 12 hours</option><option value="24">Every 24 hours</option>
              </select>
            </div>
            <div class="qas2-field"><small>Backups now include the <strong>entire database</strong> (all tables, schema, and data); individual table selection is no longer available.</small></div>
            <!-- Backup scope selection removed: system always backs up the full database -->
            <div class="qas2-backup-card">
              <p class="qas2-backup-retention">Retention: Keep the latest 30 backup files. When this limit is exceeded, the oldest backup is automatically deleted.</p>
              <div class="qas2-backup-actions">
                <button type="button" class="btn btn-secondary" id="qas2BackupSavePolicy">Save Backup Policy</button>
                <button type="button" class="btn btn-primary" id="qas2BackupNow">Backup Now</button>
                <button type="button" class="btn btn-secondary" id="qas2BackupRefresh">Refresh History</button>
              </div>
              <div class="qas2-backup-meta" id="qas2BackupMeta">Last backup: -- | Next scheduled backup: --</div>
              <div class="qas2-backup-table-wrap">
                <table class="qas2-backup-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Trigger</th>
                      <th>Status</th>
                      <th>Size</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody id="qas2BackupHistoryBody">
                    <tr><td colspan="5">No backups yet</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>
          <section class="qas2-content" data-qas2-panel="archived">
            <div class="qas2-field">
              <label>Archived Students</label>
              <div id="qas2ArchivedList" class="qas2-archived-list"></div>
              <div class="qas2-archived-actions">
                <button type="button" class="btn btn-secondary" id="qas2RestoreAllBtn">Restore All</button>
              </div>
            </div>
          </section>
        </div>
        <div class="qas2-status" id="qas2Status">Ready</div>
        <div class="qas2-footer">
          <button type="button" class="btn btn-secondary" id="qas2ResetBtn">Reset</button>
          <button type="button" class="btn btn-primary" id="qas2SaveBtn">Save Settings</button>
        </div>
      </aside>
    `;

    document.body.appendChild(wrap);
  }

  function setTab(tab) {
    document.querySelectorAll('.qas2-tab').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.qas2Tab === tab);
    });
    document.querySelectorAll('.qas2-content').forEach((panel) => {
      panel.classList.toggle('active', panel.dataset.qas2Panel === tab);
    });
    if (tab === 'archived') {
      renderArchivedStudentsPanel();
    }
  }

  function formatArchiveDate(value) {
    try {
      const dt = new Date(value || '');
      if (Number.isNaN(dt.getTime())) return '--';
      return dt.toLocaleString();
    } catch (_) {
      return '--';
    }
  }

  function normalizeArchiveId(record) {
    const fallback = Array.isArray(record?.identifiers) && record.identifiers.length ? String(record.identifiers[0] || '').trim() : '';
    return String(record?.archiveId || fallback).trim();
  }

  function renderArchivedStudentsPanel() {
    const container = document.getElementById('qas2ArchivedList');
    if (!container) return;

    const records = (typeof window.__getArchivedStudentsForDirectory === 'function'
      ? window.__getArchivedStudentsForDirectory()
      : readArchivedStudentsLocal()) || [];

    if (!Array.isArray(records) || records.length === 0) {
      container.innerHTML = '<div class="qas2-archived-empty">No archived students.</div>';
      return;
    }

    container.innerHTML = records.map((record) => {
      const archiveId = normalizeArchiveId(record);
      const studentName = String(record?.fullName || 'Unknown Student');
      const lrn = String(record?.lrn || '--');
      const grade = String(record?.grade || '--');
      const track = String(record?.track || '--');
      const archivedAt = formatArchiveDate(record?.archivedAt);
      return `
        <div class="qas2-archived-item" data-archive-id="${archiveId.replace(/"/g, '&quot;')}">
          <div class="qas2-archived-row">
            <div>
              <div class="qas2-archived-name">${studentName.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
              <div class="qas2-archived-meta">LRN: ${lrn.replace(/</g, '&lt;').replace(/>/g, '&gt;')} · Grade: ${grade.replace(/</g, '&lt;').replace(/>/g, '&gt;')} · Track: ${track.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
              <div class="qas2-archived-meta">Archived: ${archivedAt.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
            </div>
            <button type="button" class="btn btn-primary qas2RestoreBtn" data-restore-id="${archiveId.replace(/"/g, '&quot;')}">Restore</button>
          </div>
        </div>
      `;
    }).join('');
  }

  function openPanel() {
    const overlay = document.getElementById('qas2Overlay');
    if (!overlay) return;
    overlay.classList.add('active');
    setTab('account');
  }

  function closePanel() {
    const overlay = document.getElementById('qas2Overlay');
    if (!overlay) return;
    overlay.classList.remove('active');
  }

  function setStatus(text) {
    const node = document.getElementById('qas2Status');
    if (node) node.textContent = text;
  }

  function formatBackupDate(value) {
    if (!value) return '--';
    const dt = new Date(value);
    return Number.isNaN(dt.getTime()) ? '--' : dt.toLocaleString();
  }

  function formatBackupSize(bytes) {
    const size = Number(bytes || 0);
    if (!size) return '--';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  function renderBackupHistory(history, adminId) {
    const body = document.getElementById('qas2BackupHistoryBody');
    if (!body) return;

    if (!Array.isArray(history) || !history.length) {
      body.innerHTML = '<tr><td colspan="5">No backups yet</td></tr>';
      return;
    }

    const school = detectSchoolCode();
    const schoolQuery = school ? `?school=${encodeURIComponent(school)}` : '';
    body.innerHTML = history.map((item) => {
      const action = item.status === 'success'
        ? `<a href="/api/backups/download/${adminId}/${item.id}${schoolQuery}" class="btn btn-secondary" style="padding:4px 8px;font-size:11px;">Download</a>`
        : '--';

      return `
        <tr>
          <td>${String(formatBackupDate(item.created_at)).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
          <td>${String(item.trigger_type || '--').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
          <td>${String(item.status || '--').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
          <td>${String(formatBackupSize(item.file_size)).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
          <td>${action}</td>
        </tr>
      `;
    }).join('');
  }

  async function refreshBackupPanel(adminId, backupState) {
    const meta = document.getElementById('qas2BackupMeta');

    if (!adminId) {
      if (meta) meta.textContent = 'Last backup: -- | Next scheduled backup: --';
      renderBackupHistory([], null);
      return;
    }

    try {
      const [policyResp, historyResp] = await Promise.all([
        apiCall(`/api/backups/policy/${adminId}`, 'GET'),
        apiCall(`/api/backups/history/${adminId}?limit=30`, 'GET')
      ]);

      const policy = normalizeBackup(policyResp?.policy || backupState || defaults().backup);
      if (meta) {
        meta.textContent = `Last backup: ${formatBackupDate(policyResp?.policy?.last_run_at)} | Next scheduled backup: ${formatBackupDate(policyResp?.policy?.next_run_at)}`;
      }

      fillForm({
        settings: collectForm().settings,
        portal: collectForm().portal,
        backup: policy
      });

      renderBackupHistory(Array.isArray(historyResp?.history) ? historyResp.history : [], adminId);
    } catch (_) {
      if (meta) meta.textContent = 'Last backup: -- | Next scheduled backup: --';
      renderBackupHistory([], adminId);
    }
  }

  function fillForm(state) {
    const settings = normalizeSettings(state.settings);
    const portal = normalizePortal(state.portal);
    const backup = normalizeBackup(state.backup);

    const setValue = (id, value) => {
      const node = document.getElementById(id);
      if (node) node.value = value;
    };
    const setChecked = (id, checked) => {
      const node = document.getElementById(id);
      if (node) node.checked = !!checked;
    };

    setValue('qas2Name', settings.account.name || 'Admin');
    setValue('qas2Email', settings.account.email || '');

    setChecked('qas2NotifInApp', settings.notifications.inApp);
    setChecked('qas2NotifSound', settings.notifications.sound);
    setChecked('qas2NotifEnrollment', settings.notifications.enrollment);
    setChecked('qas2NotifSection', settings.notifications.section);
    setChecked('qas2NotifTeacher', settings.notifications.teacher);

    setValue('qas2SessionTimeout', String(settings.security.sessionTimeout || '30'));
    setChecked('qas2Reauth', settings.security.reauthDestructive);

    setValue('qas2HeroTagline', portal.heroTagline);
    setValue('qas2AboutTitle', portal.aboutTitle);
    setValue('qas2AboutHtml', portal.aboutCardsHtml);
    setValue('qas2InfoTitle', portal.schoolInfoTitle);
    setValue('qas2InfoHtml', portal.schoolInfoCardsHtml);
    setValue('qas2FooterTagline', portal.footerTagline);
    setValue('qas2ContactHtml', portal.contactHtml);
    setValue('qas2Copyright', portal.copyrightText);

    setChecked('qas2BackupEnabled', backup.enabled);
    setValue('qas2BackupInterval', String(backup.interval_hours || 24));
    // scope options removed; nothing to set

    // after filling existing settings, load current registration code
    loadRegCode();
  }

  // ------------ registration code helpers ------------
  async function loadRegCode() {
    try {
      const res = await apiCall('/api/registration-codes/list?status=active', 'GET');
      const codes = Array.isArray(res.codes) ? res.codes : [];
      const code = codes[0]?.code || '';
      const input = document.getElementById('qas2RegCode');
      if (input) input.value = code;
    } catch (err) {
      console.error('[qas] loadRegCode failed', err);
    }
  }

  async function regenerateRegCode() {
    try {
      const res = await apiCall('/api/registration-codes/generate', 'POST', { description: '' });
      const code = Array.isArray(res.codes) && res.codes[0] ? res.codes[0].code : '';
      if (code) {
        const input = document.getElementById('qas2RegCode');
        if (input) input.value = code;
      }
      notify('Registration code updated', 'success');
    } catch (err) {
      console.error('[qas] regenerateRegCode failed', err);
      notify('Failed to regenerate code', 'error');
    }
  }

  function copyRegCode() {
    const input = document.getElementById('qas2RegCode');
    if (input && input.value) {
      navigator.clipboard.writeText(input.value).then(() => notify('Code copied', 'success')).catch(() => notify('Copy failed', 'error'));
    }
  }

  // ---------------------------------------------------

  function collectForm() {
    const get = (id) => document.getElementById(id);
    // backups always include entire database; payload does not include a scope field
    const selectedScope = [];

    return {
      settings: normalizeSettings({
        account: {
          name: String(get('qas2Name')?.value || '').trim() || 'Admin',
          email: String(get('qas2Email')?.value || '').trim()
        },
        notifications: {
          inApp: !!get('qas2NotifInApp')?.checked,
          sound: !!get('qas2NotifSound')?.checked,
          enrollment: !!get('qas2NotifEnrollment')?.checked,
          section: !!get('qas2NotifSection')?.checked,
          teacher: !!get('qas2NotifTeacher')?.checked
        },
        security: {
          sessionTimeout: String(get('qas2SessionTimeout')?.value || '30'),
          reauthDestructive: !!get('qas2Reauth')?.checked
        }
      }),
      portal: normalizePortal({
        heroTagline: get('qas2HeroTagline')?.value,
        aboutTitle: get('qas2AboutTitle')?.value,
        aboutCardsHtml: get('qas2AboutHtml')?.value,
        schoolInfoTitle: get('qas2InfoTitle')?.value,
        schoolInfoCardsHtml: get('qas2InfoHtml')?.value,
        footerTagline: get('qas2FooterTagline')?.value,
        contactHtml: get('qas2ContactHtml')?.value,
        copyrightText: get('qas2Copyright')?.value
      }),
      backup: normalizeBackup({
        enabled: !!get('qas2BackupEnabled')?.checked,
        interval_hours: Number(get('qas2BackupInterval')?.value || 24),
        scope: selectedScope.length ? selectedScope : BACKUP_SCOPE_DEFAULTS
      })
    };
  }

  async function loadServerIntoForm() {
    const localState = loadLocal();
    fillForm(localState);
    setStatus('Loaded local settings');

    const adminId = await resolveAdminId();
    if (!adminId) {
      await refreshBackupPanel(null, localState.backup);
      return;
    }

    try {
      const [settingsResp, portalResp, backupResp] = await Promise.allSettled([
        apiCall(`/api/admin/${adminId}/settings`, 'GET'),
        apiCall('/api/admin/portal-page-content', 'GET'),
        apiCall(`/api/backups/policy/${adminId}`, 'GET')
      ]);

      const merged = {
        settings: localState.settings,
        portal: localState.portal,
        backup: localState.backup
      };

      if (settingsResp.status === 'fulfilled' && settingsResp.value?.settings) {
        merged.settings = normalizeSettings(settingsResp.value.settings);
      }
      if (portalResp.status === 'fulfilled' && portalResp.value?.content) {
        merged.portal = normalizePortal(portalResp.value.content);
      }
      if (backupResp.status === 'fulfilled' && backupResp.value?.policy) {
        merged.backup = normalizeBackup(backupResp.value.policy);
      }

      fillForm(merged);
      persistLocal(merged);
      await refreshBackupPanel(adminId, merged.backup);
      setStatus('Loaded server settings');
    } catch (_) {
      await refreshBackupPanel(adminId, localState.backup);
      setStatus('Using local settings');
    }
  }

  async function saveAll() {
    const state = collectForm();
    persistLocal(state);

    try {
      if (typeof window.applyAdminSettings === 'function') {
        window.applyAdminSettings(state.settings);
      } else {
        const adminNameEl = document.getElementById('adminName');
        if (adminNameEl) adminNameEl.textContent = state.settings.account.name || 'Admin';
      }
    } catch (_) {}

    const adminId = await resolveAdminId();
    if (!adminId) {
      notify('Settings saved locally', 'success');
      setStatus('Saved locally');
      closePanel();
      return;
    }

    const [settingsResult, portalResult, backupResult] = await Promise.allSettled([
      apiCall(`/api/admin/${adminId}/settings`, 'PUT', { settings: state.settings }),
      apiCall('/api/admin/portal-page-content', 'PUT', { content: state.portal }),
      apiCall(`/api/backups/policy/${adminId}`, 'PUT', state.backup)
    ]);

    const okCount = [settingsResult, portalResult, backupResult].filter((r) => r.status === 'fulfilled').length;
    if (okCount === 3) {
      notify('All settings saved successfully', 'success');
      setStatus('Saved locally + server');
      closePanel();
      return;
    }
    if (okCount > 0) {
      notify('Saved partially to server. Remaining changes are local.', 'info');
      setStatus('Saved locally + partial server');
      closePanel();
      return;
    }

    notify('Settings saved locally (server unavailable)', 'info');
    setStatus('Saved locally only');
    closePanel();
  }

  async function resetAll() {
    const d = defaults();
    fillForm(d);
    persistLocal(d);
    await saveAll();
  }

  function bindEvents() {
    const settingsBtn = document.getElementById('adminSettingsBtn') || document.querySelector('.settings-btn');
    const overlay = document.getElementById('qas2Overlay');
    const closeBtn = document.getElementById('qas2Close');
    const backdrop = document.getElementById('qas2Backdrop');
    const saveBtn = document.getElementById('qas2SaveBtn');
    const resetBtn = document.getElementById('qas2ResetBtn');
    const backupSaveBtn = document.getElementById('qas2BackupSavePolicy');
    const backupNowBtn = document.getElementById('qas2BackupNow');
    const backupRefreshBtn = document.getElementById('qas2BackupRefresh');
    const archivedList = document.getElementById('qas2ArchivedList');
    const restoreAllBtn = document.getElementById('qas2RestoreAllBtn');

    if (!settingsBtn || !overlay) return;

    if (settingsBtn.dataset.qas2Bound !== '1') {
      settingsBtn.dataset.qas2Bound = '1';
      settingsBtn.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
        await loadServerIntoForm();
        openPanel();
      }, true);
    }

    if (closeBtn && closeBtn.dataset.qas2Bound !== '1') {
      closeBtn.dataset.qas2Bound = '1';
      closeBtn.addEventListener('click', closePanel);
    }

    if (backdrop && backdrop.dataset.qas2Bound !== '1') {
      backdrop.dataset.qas2Bound = '1';
      backdrop.addEventListener('click', closePanel);
    }

    if (saveBtn && saveBtn.dataset.qas2Bound !== '1') {
      saveBtn.dataset.qas2Bound = '1';
      saveBtn.addEventListener('click', async (event) => {
        event.preventDefault();
        await saveAll();
      });
    }

    if (resetBtn && resetBtn.dataset.qas2Bound !== '1') {
      resetBtn.dataset.qas2Bound = '1';
      resetBtn.addEventListener('click', async (event) => {
        event.preventDefault();
        await resetAll();
      });
    }

    // registration code buttons
    const regBtn = document.getElementById('qas2GenRegCode');
    const copyBtn = document.getElementById('qas2CopyRegCode');
    if (regBtn && regBtn.dataset.qas2Bound !== '1') {
      regBtn.dataset.qas2Bound = '1';
      regBtn.addEventListener('click', (e) => { e.preventDefault(); regenerateRegCode(); });
    }
    if (copyBtn && copyBtn.dataset.qas2Bound !== '1') {
      copyBtn.dataset.qas2Bound = '1';
      copyBtn.addEventListener('click', (e) => { e.preventDefault(); copyRegCode(); });
    }

    document.querySelectorAll('.qas2-tab').forEach((btn) => {
      if (btn.dataset.qas2Bound === '1') return;
      btn.dataset.qas2Bound = '1';
      btn.addEventListener('click', () => setTab(btn.dataset.qas2Tab || 'account'));
    });

    // scope checkboxes have been removed; no bindings required

    if (backupSaveBtn && backupSaveBtn.dataset.qas2Bound !== '1') {
      backupSaveBtn.dataset.qas2Bound = '1';
      backupSaveBtn.addEventListener('click', async () => {
        const adminId = await resolveAdminId();
        if (!adminId) {
          notify('Admin session not found', 'error');
          return;
        }

        const payload = collectForm().backup;
        try {
          await apiCall(`/api/backups/policy/${adminId}`, 'PUT', payload);
          const localState = loadLocal();
          persistLocal({ ...localState, backup: payload });
          await refreshBackupPanel(adminId, payload);
          setStatus('Backup policy saved');
          notify('Backup policy saved', 'success');
        } catch (err) {
          setStatus(err && err.message ? err.message : 'Failed to save backup policy');
          notify(err && err.message ? err.message : 'Failed to save backup policy', 'error');
        }
      });
    }

    if (backupNowBtn && backupNowBtn.dataset.qas2Bound !== '1') {
      backupNowBtn.dataset.qas2Bound = '1';
      backupNowBtn.addEventListener('click', async () => {
        const adminId = await resolveAdminId();
        if (!adminId) {
          notify('Admin session not found', 'error');
          return;
        }

        try {
          const state = collectForm();
          // full database backup; no scope information sent
          await apiCall(`/api/backups/run/${adminId}`, 'POST');
          await refreshBackupPanel(adminId, state.backup);
          setStatus('Backup completed successfully');
          notify('Backup completed successfully', 'success');
        } catch (err) {
          setStatus(err && err.message ? err.message : 'Backup failed');
          notify(err && err.message ? err.message : 'Backup failed', 'error');
        }
      });
    }

    if (backupRefreshBtn && backupRefreshBtn.dataset.qas2Bound !== '1') {
      backupRefreshBtn.dataset.qas2Bound = '1';
      backupRefreshBtn.addEventListener('click', async () => {
        const adminId = await resolveAdminId();
        if (!adminId) {
          notify('Admin session not found', 'error');
          return;
        }

        try {
          const state = collectForm();
          await refreshBackupPanel(adminId, state.backup);
          setStatus('Backup history refreshed');
          notify('Backup history refreshed', 'success');
        } catch (err) {
          setStatus(err && err.message ? err.message : 'Failed to refresh backup history');
          notify(err && err.message ? err.message : 'Failed to refresh backup history', 'error');
        }
      });
    }

    if (archivedList && archivedList.dataset.qas2Bound !== '1') {
      archivedList.dataset.qas2Bound = '1';
      archivedList.addEventListener('click', async (event) => {
        const restoreBtn = event.target.closest('.qas2RestoreBtn');
        if (!restoreBtn) return;
        const restoreId = String(restoreBtn.getAttribute('data-restore-id') || '').trim();
        if (!restoreId) return;

        try {
          if (typeof window.__restoreArchivedStudentFromDirectory === 'function') {
            await window.__restoreArchivedStudentFromDirectory(restoreId);
          } else {
            const current = readArchivedStudentsLocal();
            const next = current.filter((record) => normalizeArchiveId(record) !== restoreId);
            writeArchivedStudentsLocal(next);
          }
          renderArchivedStudentsPanel();
        } catch (err) {
          notify(err && err.message ? err.message : 'Failed to restore student', 'error');
        }
      });
    }

    if (restoreAllBtn && restoreAllBtn.dataset.qas2Bound !== '1') {
      restoreAllBtn.dataset.qas2Bound = '1';
      restoreAllBtn.addEventListener('click', async () => {
        try {
          if (typeof window.__restoreAllArchivedStudentsFromDirectory === 'function') {
            await window.__restoreAllArchivedStudentsFromDirectory();
          } else {
            writeArchivedStudentsLocal([]);
          }
          renderArchivedStudentsPanel();
        } catch (err) {
          notify(err && err.message ? err.message : 'Failed to restore all archived students', 'error');
        }
      });
    }

    if (!window.__qas2ArchivedStudentsListenerBound) {
      window.__qas2ArchivedStudentsListenerBound = true;
      window.addEventListener('sms:archived-students-updated', () => {
        const isArchivedTabActive = !!document.querySelector('.qas2-content.active[data-qas2-panel="archived"]');
        if (isArchivedTabActive) {
          renderArchivedStudentsPanel();
        }
      });
    }

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && overlay.classList.contains('active')) closePanel();
    });
  }

  function init() {
    injectStyles();
    createPanel();
    bindEvents();

    window.__openQuickAdminSettingsV2 = async function () {
      await loadServerIntoForm();
      openPanel();
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

