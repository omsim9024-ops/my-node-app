(function () {
  'use strict';

  window.__useNotificationCenterV2 = true;

  function detectSchoolCode() {
    try {
      const params = new URLSearchParams(window.location.search || '');
      const fromQuery = String(params.get('school') || params.get('tenant') || '').trim().toLowerCase();
      if (fromQuery) return fromQuery;
    } catch (_) {}
    return String(localStorage.getItem('sms.selectedSchoolCode') || localStorage.getItem('sms.selectedTenantCode') || '').trim().toLowerCase();
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

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(value) {
    if (!value) return '--';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '--';
    return date.toLocaleString();
  }

  function inferCategory(type) {
    const normalized = String(type || '').toLowerCase();
    if (normalized.includes('enrollment')) return 'enrollment';
    if (normalized.includes('section')) return 'section';
    if (normalized.includes('teacher')) return 'teacher';
    return 'system';
  }

  function parseRelatedData(value) {
    if (!value) return {};
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(value);
    } catch (_) {
      return {};
    }
  }

  async function resolveAdminId() {
    try {
      if (typeof window.getCurrentAdminId === 'function') {
        const id = Number(window.getCurrentAdminId() || 0);
        if (id > 0) return id;
      }
    } catch (_) {}

    try {
      if (typeof sessionManager !== 'undefined' && sessionManager.getTabSession) {
        const tabData = sessionManager.getTabSession('adminData');
        const tabId = Number(tabData?.id || tabData?.admin_id || 0);
        if (tabId > 0) return tabId;
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

    try {
      if (typeof window.resolveCurrentAdminId === 'function') {
        const id = await window.resolveCurrentAdminId();
        if (id) return Number(id);
      }
    } catch (_) {}

    return null;
  }

  async function apiCall(path, method, body) {
    if (typeof window.apiFetch === 'function') {
      const response = await window.apiFetch(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {})
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || data?.message || `Request failed (${response.status})`);
      }
      return data;
    }

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
    if (document.getElementById('qnc2-style')) return;
    const style = document.createElement('style');
    style.id = 'qnc2-style';
    style.textContent = `
      .qnc2-overlay{position:fixed;inset:0;display:none;z-index:1410}
      .qnc2-overlay.active{display:block}
      .qnc2-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.5)}
      .qnc2-panel{position:absolute;top:0;right:0;height:100%;width:min(460px,96vw);display:flex;flex-direction:column;background:var(--modal-bg,#fff);color:var(--text-primary,#111);border-left:1px solid var(--border-primary,#ddd)}
      .qnc2-header{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid var(--border-primary,#ddd)}
      .qnc2-title{font-size:32px;font-weight:700;font-size:18px}
      .qnc2-close{width:34px;height:34px;border-radius:8px;border:1px solid var(--border-primary,#ddd);background:var(--bg-secondary,#f5f6f8);color:inherit;cursor:pointer}
      .qnc2-actions{padding:10px 16px;border-bottom:1px solid var(--border-primary,#ddd);display:flex;gap:8px}
      .qnc2-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:10px 16px;border-bottom:1px solid var(--border-primary,#ddd)}
      .qnc2-tab{border:1px solid var(--border-primary,#ddd);border-radius:8px;background:var(--bg-secondary,#f5f6f8);padding:8px 10px;font-size:12px;font-weight:600;cursor:pointer}
      .qnc2-tab.active{background:var(--primary-green,#1e5631);color:#fff;border-color:var(--primary-dark-green,#174527)}
      .qnc2-list{flex:1;overflow:auto;padding:12px 16px;display:flex;flex-direction:column;gap:10px}
      .qnc2-item{border:1px solid var(--border-primary,#ddd);border-radius:10px;padding:10px;background:var(--bg-secondary,#f5f6f8)}
      .qnc2-item.unread{border-color:var(--primary-green,#1e5631);box-shadow:0 0 0 1px rgba(30,86,49,.2) inset}
      .qnc2-item-title{font-size:13px;font-weight:700;margin-bottom:4px}
      .qnc2-item-message{font-size:12px;margin-bottom:6px;color:var(--text-secondary,#475467)}
      .qnc2-item-meta{font-size:11px;color:var(--text-light,#667085);margin-bottom:8px}
      .qnc2-item-controls{display:flex;gap:6px;flex-wrap:wrap}
      .qnc2-empty{padding:40px 0;text-align:center;color:var(--text-secondary,#667085)}
    `;
    document.head.appendChild(style);
  }

  function createPanel() {
    if (document.getElementById('qnc2Overlay')) return;

    const legacy = document.getElementById('adminNotificationOverlay');
    if (legacy) legacy.remove();

    const overlay = document.createElement('div');
    overlay.id = 'qnc2Overlay';
    overlay.className = 'qnc2-overlay';
    overlay.innerHTML = `
      <div class="qnc2-backdrop" id="qnc2Backdrop"></div>
      <aside class="qnc2-panel" role="dialog" aria-modal="true" aria-labelledby="qnc2Title">
        <div class="qnc2-header">
          <h3 class="qnc2-title" id="qnc2Title">Notification Center</h3>
          <button type="button" id="qnc2Close" class="qnc2-close" aria-label="Close notifications">✕</button>
        </div>
        <div class="qnc2-actions">
          <button type="button" class="btn btn-secondary" id="qnc2MarkAllRead">Mark all read</button>
          <button type="button" class="btn btn-secondary" id="qnc2Refresh">Refresh</button>
        </div>
        <div class="qnc2-tabs" role="tablist" aria-label="Notification filters">
          <button type="button" class="qnc2-tab active" data-qnc2-filter="all">All</button>
          <button type="button" class="qnc2-tab" data-qnc2-filter="unread">Unread</button>
          <button type="button" class="qnc2-tab" data-qnc2-filter="enrollment">Enrollments</button>
          <button type="button" class="qnc2-tab" data-qnc2-filter="section">Sections</button>
          <button type="button" class="qnc2-tab" data-qnc2-filter="teacher">Teachers</button>
          <button type="button" class="qnc2-tab" data-qnc2-filter="system">System</button>
        </div>
        <div id="qnc2List" class="qnc2-list"><p class="qnc2-empty">No notifications yet.</p></div>
      </aside>
    `;

    document.body.appendChild(overlay);
  }

  function goToContext(notification) {
    const related = parseRelatedData(notification.related_data);
    const type = inferCategory(notification.type);

    if (type === 'enrollment') {
      document.querySelectorAll('.section').forEach((s) => s.classList.remove('active'));
      document.getElementById('enrollment')?.classList.add('active');
      if (related.enrollment_id && typeof window.openEnrollmentDetailSafely === 'function') {
        window.openEnrollmentDetailSafely(related.enrollment_id);
      } else if (typeof window.loadEnrollments === 'function') {
        window.loadEnrollments();
      }
    } else if (type === 'section') {
      document.querySelectorAll('.section').forEach((s) => s.classList.remove('active'));
      document.getElementById('sections')?.classList.add('active');
      if (typeof window.loadExistingSections === 'function') window.loadExistingSections();
    } else if (type === 'teacher') {
      document.querySelectorAll('.section').forEach((s) => s.classList.remove('active'));
      document.getElementById('teaching-assignments')?.classList.add('active');
      if (typeof window.renderTeachingAssignmentsTeacherTables === 'function') window.renderTeachingAssignmentsTeacherTables();
    }
  }

  function init() {
    injectStyles();
    createPanel();

    const bellBtn = document.getElementById('adminNotificationBtn') || document.querySelector('.notification-btn');
    const badgeEl = document.getElementById('notificationBadge');
    const overlay = document.getElementById('qnc2Overlay');
    const backdrop = document.getElementById('qnc2Backdrop');
    const closeBtn = document.getElementById('qnc2Close');
    const listEl = document.getElementById('qnc2List');
    const markAllBtn = document.getElementById('qnc2MarkAllRead');
    const refreshBtn = document.getElementById('qnc2Refresh');

    if (!bellBtn || !overlay || !listEl) return;

    let activeFilter = 'all';
    let notifications = [];

    const openPanel = () => overlay.classList.add('active');
    const closePanel = () => overlay.classList.remove('active');

    const applyFilter = (items) => {
      if (activeFilter === 'all') return items;
      if (activeFilter === 'unread') return items.filter((item) => !item.is_read);
      return items.filter((item) => inferCategory(item.type) === activeFilter);
    };

    const updateBadge = async () => {
      try {
        const adminId = await resolveAdminId();
        if (!adminId || !badgeEl) return;
        const data = await apiCall(`/api/notifications/admin/${adminId}/unread-count`, 'GET');
        const count = Number(data?.unread_count || 0);
        badgeEl.textContent = String(count);
        badgeEl.style.display = count > 0 ? 'inline-flex' : 'none';
      } catch (_) {}
    };

    const markNotificationRead = async (id) => {
      const adminId = await resolveAdminId();
      if (!adminId) return;
      await apiCall(`/api/notifications/admin/${adminId}/${id}/read`, 'PUT');
    };

    const deleteNotification = async (id) => {
      const adminId = await resolveAdminId();
      if (!adminId) return;
      await apiCall(`/api/notifications/admin/${adminId}/${id}`, 'DELETE');
    };

    const render = () => {
      const filtered = applyFilter(notifications);
      if (!filtered.length) {
        listEl.innerHTML = '<p class="qnc2-empty">No notifications found for this filter.</p>';
        return;
      }

      listEl.innerHTML = filtered.map((item) => {
        const isUnread = !item.is_read;
        return `
          <div class="qnc2-item ${isUnread ? 'unread' : ''}" data-id="${item.id}">
            <div class="qnc2-item-title">${escapeHtml(item.title || 'Notification')}</div>
            <div class="qnc2-item-message">${escapeHtml(item.message || '--')}</div>
            <div class="qnc2-item-meta">${escapeHtml(item.type || 'system')} • ${escapeHtml(formatDate(item.created_at))}</div>
            <div class="qnc2-item-controls">
              ${isUnread ? '<button type="button" class="btn btn-secondary qnc2-read">Mark read</button>' : ''}
              <button type="button" class="btn btn-secondary qnc2-open">Open</button>
              <button type="button" class="btn btn-secondary qnc2-delete">Delete</button>
            </div>
          </div>
        `;
      }).join('');

      listEl.querySelectorAll('.qnc2-item').forEach((itemEl) => {
        const id = Number(itemEl.dataset.id || 0);
        const notification = notifications.find((n) => Number(n.id) === id);
        if (!notification) return;

        const readBtn = itemEl.querySelector('.qnc2-read');
        const openBtn = itemEl.querySelector('.qnc2-open');
        const deleteBtn = itemEl.querySelector('.qnc2-delete');

        if (readBtn) {
          readBtn.addEventListener('click', async () => {
            try {
              await markNotificationRead(id);
              notification.is_read = 1;
              render();
              await updateBadge();
            } catch (err) {
              notify(err?.message || 'Failed to mark notification as read', 'error');
            }
          });
        }

        if (openBtn) {
          openBtn.addEventListener('click', async () => {
            try {
              if (!notification.is_read) {
                await markNotificationRead(id);
                notification.is_read = 1;
                await updateBadge();
              }
            } catch (_) {}
            goToContext(notification);
            closePanel();
          });
        }

        if (deleteBtn) {
          deleteBtn.addEventListener('click', async () => {
            try {
              await deleteNotification(id);
              notifications = notifications.filter((n) => Number(n.id) !== id);
              render();
              await updateBadge();
            } catch (err) {
              notify(err?.message || 'Failed to delete notification', 'error');
            }
          });
        }
      });
    };

    const loadNotifications = async () => {
      const adminId = await resolveAdminId();
      if (!adminId) {
        listEl.innerHTML = '<p class="qnc2-empty">Admin session not found.</p>';
        return;
      }

      try {
        const data = await apiCall(`/api/notifications/admin/${adminId}?limit=100`, 'GET');
        notifications = Array.isArray(data) ? data : [];
        render();
        await updateBadge();
      } catch (err) {
        listEl.innerHTML = '<p class="qnc2-empty">Failed to load notifications.</p>';
        notify(err?.message || 'Failed to load notifications', 'error');
      }
    };

    bellBtn.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
      openPanel();
      await loadNotifications();
    }, true);

    if (closeBtn) closeBtn.addEventListener('click', closePanel);
    if (backdrop) backdrop.addEventListener('click', closePanel);

    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        await loadNotifications();
        notify('Notifications refreshed', 'info');
      });
    }

    if (markAllBtn) {
      markAllBtn.addEventListener('click', async () => {
        const adminId = await resolveAdminId();
        if (!adminId) return;
        try {
          await apiCall(`/api/notifications/admin/${adminId}/read-all`, 'PUT');
          notifications = notifications.map((n) => ({ ...n, is_read: 1 }));
          render();
          await updateBadge();
          notify('All notifications marked as read', 'success');
        } catch (err) {
          notify(err?.message || 'Failed to mark all as read', 'error');
        }
      });
    }

    document.querySelectorAll('.qnc2-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeFilter = btn.getAttribute('data-qnc2-filter') || 'all';
        document.querySelectorAll('.qnc2-tab').forEach((node) => node.classList.toggle('active', node === btn));
        render();
      });
    });

    setInterval(() => { updateBadge(); }, 15000);
    updateBadge();

    window.__openNotificationCenterV2 = async function () {
      openPanel();
      await loadNotifications();
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

