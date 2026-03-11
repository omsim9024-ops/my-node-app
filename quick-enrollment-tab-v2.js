(function () {
  'use strict';

  window.__useEnrollmentTabV2 = true;

  const state = {
    filter: 'all',
    search: '',
    enrollments: [],
    loading: false,
    workingBase: null,
    schoolCode: ''
  };

  function detectSchoolCode() {
    try {
      const params = new URLSearchParams(window.location.search || '');
      const fromQuery = String(params.get('school') || params.get('tenant') || params.get('code') || '').trim().toLowerCase();
      if (fromQuery) return fromQuery;
    } catch (_e) {}

    return String(localStorage.getItem('sms.selectedSchoolCode') || localStorage.getItem('sms.selectedTenantCode') || '').trim().toLowerCase();
  }

  function getCandidateBases() {
    const bases = [];
    const push = (value) => {
      const normalized = String(value || '').trim();
      if (!normalized) return;
      if (!bases.includes(normalized)) bases.push(normalized);
    };

    push(window.location.origin);
    push(typeof window.API_BASE !== 'undefined' ? window.API_BASE : '');
    push(typeof window.BACKEND_ORIGIN !== 'undefined' ? window.BACKEND_ORIGIN : '');

    const host = String(window.location.hostname || '').trim().toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1') {
      [3000, 3001, 3002, 3003, 3004, 3005].forEach((port) => {
        push(`http://${host}:${port}`);
      });
    }

    if (state.workingBase) {
      bases.unshift(state.workingBase);
    }

    return bases.filter((base, index, arr) => arr.indexOf(base) === index);
  }

  async function fetchWithFallback(path, options = {}) {
    const schoolCode = state.schoolCode || detectSchoolCode();
    state.schoolCode = schoolCode;
    const token = String(localStorage.getItem('adminAuthToken') || '').trim();

    const candidates = getCandidateBases();
    let lastError = null;

    for (const base of candidates) {
      try {
        const url = new URL(path, base);
        if (schoolCode) {
          url.searchParams.set('school', schoolCode);
        }

        const headers = {
          ...(options.headers || {}),
          ...(schoolCode ? { 'x-tenant-code': schoolCode } : {}),
          ...(token && !(options.headers && options.headers.Authorization) ? { Authorization: `Bearer ${token}` } : {})
        };

        const response = await fetch(url.toString(), {
          credentials: 'include',
          ...options,
          headers
        });

        const isApiPath = String(path || '').startsWith('/api/');
        const contentType = String(response.headers.get('content-type') || '').toLowerCase();
        if (isApiPath && response.status === 200 && contentType.includes('text/html')) {
          throw new Error('Received HTML fallback for API endpoint');
        }

        state.workingBase = base;
        return response;
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError || new Error('All API endpoints are unreachable');
  }

  async function apiGet(path) {
    const response = await fetchWithFallback(path, { method: 'GET' });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error((payload && (payload.error || payload.message)) || `HTTP ${response.status}`);
    }
    return payload;
  }

  async function apiSend(path, method, body) {
    const response = await fetchWithFallback(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error((payload && (payload.error || payload.message)) || `HTTP ${response.status}`);
    }
    return payload;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getStatusClass(status) {
    const normalized = String(status || 'pending').toLowerCase();
    if (normalized === 'approved') return 'approved';
    if (normalized === 'rejected') return 'rejected';
    return 'pending';
  }

  function normalizeFilter(filter) {
    const normalized = String(filter || 'all').toLowerCase();
    if (normalized === 'approved' || normalized === 'rejected' || normalized === 'pending') return normalized;
    return 'all';
  }

  function toPositiveNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
  }

  function resolveActiveSchoolYearId() {
    const direct = toPositiveNumber(window.activeSchoolYearId);
    if (direct) return direct;

    const fromObject = toPositiveNumber(window.activeSchoolYear && (window.activeSchoolYear.id || window.activeSchoolYear.school_year_id));
    if (fromObject) return fromObject;

    try {
      const stored = JSON.parse(localStorage.getItem('activeSchoolYear') || 'null');
      const fromStorage = toPositiveNumber(stored && (stored.id || stored.school_year_id || stored.schoolYearId));
      if (fromStorage) return fromStorage;
    } catch (_e) {
      // ignore parse errors
    }

    return null;
  }

  function parseEnrollmentData(enrollment) {
    const raw = enrollment && enrollment.enrollment_data;
    if (!raw) return {};
    if (typeof raw === 'object') return raw;
    try {
      return JSON.parse(raw);
    } catch (_e) {
      return {};
    }
  }

  function pickStudentName(enrollment, data) {
    const first = String(data.firstName || data.firstname || enrollment.first_name || '').trim();
    const last = String(data.lastName || data.lastname || enrollment.last_name || '').trim();
    const full = `${first} ${last}`.trim();
    return full || String(enrollment.student_name || '').trim() || 'Unknown Student';
  }

  function injectStyles() {
    if (document.getElementById('qet2-style')) return;
    const style = document.createElement('style');
    style.id = 'qet2-style';
    style.textContent = `
      .qet2-toolbar{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:14px}
      .qet2-search{flex:1;min-width:260px;padding:10px 12px;border:1px solid var(--border-primary);border-radius:10px;background:var(--bg-primary);color:var(--text-primary)}
      .qet2-filters{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
      .qet2-filter{border:1px solid var(--border-primary);background:var(--bg-secondary);color:var(--text-primary);padding:8px 12px;border-radius:10px;cursor:pointer;font-weight:600}
      .qet2-filter.active{background:var(--primary-green);color:var(--text-inverse);border-color:var(--primary-green)}
      .qet2-list{display:grid;grid-template-columns:1fr;gap:10px}
      .qet2-item{border:1px solid var(--border-primary);border-radius:12px;padding:12px;background:var(--bg-primary);cursor:pointer;transition:border-color .15s ease,box-shadow .15s ease,transform .12s ease}
      .qet2-item:hover{border-color:var(--primary-green);box-shadow:0 6px 16px rgba(15,23,42,.08);transform:translateY(-1px)}
      .qet2-item:focus-visible{outline:none;border-color:var(--primary-green);box-shadow:0 0 0 3px rgba(34,197,94,.22)}
      .qet2-row{display:flex;justify-content:space-between;gap:8px;align-items:center}
      .qet2-name{font-weight:700}
      .qet2-meta{font-size:12px;opacity:.9;margin-top:6px}
      .qet2-actions{display:flex;gap:8px}
      .qet2-status{font-size:11px;font-weight:700;padding:4px 8px;border-radius:999px;text-transform:uppercase}
      .qet2-status.pending{background:var(--warning-light);color:var(--warning-color)}
      .qet2-status.approved{background:var(--success-light);color:var(--success-color)}
      .qet2-status.rejected{background:var(--error-light);color:var(--error-color)}
      .qet2-muted{text-align:center;color:var(--text-secondary);padding:24px 12px}
      .qet2-btn{border:1px solid var(--border-primary);background:var(--bg-secondary);color:var(--text-primary);padding:7px 10px;border-radius:8px;cursor:pointer}
      .qet2-btn.primary{background:var(--primary-green);color:var(--text-inverse);border-color:var(--primary-green)}
      .qet2-btn.warn{background:var(--error-color);color:var(--text-inverse);border-color:var(--error-color)}
      .qet2-modal{position:fixed;inset:0;z-index:1500;display:none}
      .qet2-modal.active{display:flex;align-items:center;justify-content:center}
      .qet2-modal-backdrop{position:absolute;inset:0;background:var(--modal-backdrop)}
      .qet2-modal-card{position:relative;width:min(860px,94vw);max-height:90vh;overflow:auto;background:var(--modal-bg);color:var(--text-primary);border-radius:14px;border:1px solid var(--border-primary);padding:16px}
      .qet2-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px}
      .qet2-cell{border:1px solid var(--border-primary);border-radius:10px;padding:8px}
      .qet2-label{font-size:11px;opacity:.8;text-transform:uppercase}
      .qet2-value{font-size:14px;font-weight:600;margin-top:4px;word-break:break-word}
      @media (max-width:700px){.qet2-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function ensureMarkup() {
    const section = document.getElementById('enrollment');
    if (!section) return null;

    const card = section.querySelector('.content-card');
    if (!card) return null;

    card.innerHTML = `
      <div class="qet2-toolbar">
        <input id="qet2Search" class="qet2-search" placeholder="Search by student name, LRN, or email..." />
        <button id="qet2Clear" class="qet2-btn" type="button">Clear</button>
      </div>
      <div class="qet2-filters">
        <button class="qet2-filter active" data-filter="all" type="button">All</button>
        <button class="qet2-filter" data-filter="pending" type="button">Pending</button>
        <button class="qet2-filter" data-filter="approved" type="button">Approved</button>
        <button class="qet2-filter" data-filter="rejected" type="button">Rejected</button>
      </div>
      <div id="qet2List" class="qet2-list"><div class="qet2-muted">Loading enrollments...</div></div>
    `;

    if (!document.getElementById('qet2Modal')) {
      const modal = document.createElement('div');
      modal.id = 'qet2Modal';
      modal.className = 'qet2-modal';
      modal.innerHTML = `
        <div class="qet2-modal-backdrop" data-close="1"></div>
        <div class="qet2-modal-card">
          <div class="qet2-row">
            <h3 id="qet2ModalTitle">Enrollment Details</h3>
            <button id="qet2ModalClose" class="qet2-btn" type="button">Close</button>
          </div>
          <div id="qet2ModalBody"></div>
          <div class="qet2-row" style="margin-top:14px;justify-content:flex-end;gap:8px">
            <button id="qet2Approve" class="qet2-btn primary" type="button">Approve</button>
            <button id="qet2Reject" class="qet2-btn" type="button">Reject</button>
            <button id="qet2Delete" class="qet2-btn warn" type="button">Delete</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    return section;
  }

  function renderList() {
    const list = document.getElementById('qet2List');
    if (!list) return;

    const needle = String(state.search || '').trim().toLowerCase();
    const filtered = (state.enrollments || []).filter((enrollment) => {
      if (state.filter !== 'all' && String(enrollment.status || '').toLowerCase() !== state.filter) return false;
      if (!needle) return true;

      const data = parseEnrollmentData(enrollment);
      const name = pickStudentName(enrollment, data).toLowerCase();
      const lrn = String(data.studentLRN || data.lrn || enrollment.lrn_no || '').toLowerCase();
      const email = String(data.email || enrollment.email || '').toLowerCase();
      return name.includes(needle) || lrn.includes(needle) || email.includes(needle);
    });

    if (!filtered.length) {
      list.innerHTML = `<div class="qet2-muted">${state.loading ? 'Loading enrollments...' : 'No enrollments found.'}</div>`;
      return;
    }

    list.innerHTML = filtered.map((enrollment) => {
      const data = parseEnrollmentData(enrollment);
      const name = pickStudentName(enrollment, data);
      const lrn = String(data.studentLRN || data.lrn || enrollment.lrn_no || '--');
      const grade = String(data.gradeLevel || data.grade || '--');
      const track = String(enrollment.track || data.track || '--');
      const status = String(enrollment.status || 'Pending');
      const dateText = enrollment.enrollment_date ? new Date(enrollment.enrollment_date).toLocaleString() : '--';

      return `
        <div class="qet2-item" data-id="${escapeHtml(enrollment.id)}" tabindex="0" role="button" aria-label="Open profile for ${escapeHtml(name)}">
          <div class="qet2-row">
            <div>
              <div class="qet2-name">${escapeHtml(name)}</div>
              <div class="qet2-meta">LRN: ${escapeHtml(lrn)} · Grade: ${escapeHtml(grade)} · Track: ${escapeHtml(track)}</div>
              <div class="qet2-meta">Submitted: ${escapeHtml(dateText)}</div>
            </div>
            <div class="qet2-actions">
              <span class="qet2-status ${getStatusClass(status)}">${escapeHtml(status)}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('.qet2-item[data-id]').forEach((item) => {
      const id = item.getAttribute('data-id');
      if (!id) return;

      item.addEventListener('click', (event) => {
        if (event.target && event.target.closest('button[data-action]')) return;
        openStudentProfileFromEnrollment(id);
      });

      item.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openStudentProfileFromEnrollment(id);
      });
    });

  }

  async function load(filter = state.filter || 'all') {
    state.filter = normalizeFilter(filter);
    state.loading = true;
    renderList();

    try {
      const query = new URLSearchParams();
      query.set('activeYear', 'true');
      const activeSchoolYearId = resolveActiveSchoolYearId();
      if (activeSchoolYearId) {
        query.set('school_year_id', String(activeSchoolYearId));
        query.set('schoolYearId', String(activeSchoolYearId));
      }
      if (state.filter !== 'all') {
        query.set('status', state.filter.charAt(0).toUpperCase() + state.filter.slice(1));
      }
      const payload = await apiGet(`/api/enrollments?${query.toString()}`);
      state.enrollments = Array.isArray(payload) ? payload : [];
    } catch (err) {
      state.enrollments = [];
      const list = document.getElementById('qet2List');
      if (list) {
        list.innerHTML = `<div class="qet2-muted">Failed to load enrollments: ${escapeHtml(err.message || 'Unknown error')}</div>`;
      }
      state.loading = false;
      return;
    }

    state.loading = false;
    renderList();
  }

  function findEnrollment(enrollmentId) {
    return (state.enrollments || []).find((item) => String(item.id) === String(enrollmentId));
  }

  function parseEnrollmentFiles(enrollment) {
    const raw = enrollment && enrollment.enrollment_files;
    if (!raw) return {};
    if (typeof raw === 'object') return raw;
    try {
      return JSON.parse(raw);
    } catch (_e) {
      return {};
    }
  }

  function openProfileModalFromEnrollment(enrollment) {
    const data = parseEnrollmentData(enrollment || {});
    const files = parseEnrollmentFiles(enrollment || {});
    const modal = document.getElementById('studentProfileModal');
    if (!modal) return false;

    const getText = (value, fallback = '--') => {
      if (value === undefined || value === null) return fallback;
      const text = String(value).trim();
      return text || fallback;
    };

    const asArray = (value) => {
      if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
      const text = String(value || '').trim();
      return text ? [text] : [];
    };

    const firstName = getText(data.firstName || data.firstname || enrollment.first_name || '', '');
    const lastName = getText(data.lastName || data.lastname || enrollment.last_name || '', '');
    const fullName = `${firstName} ${lastName}`.trim() || getText(enrollment.student_name, 'Student Profile');

    const setText = (id, value, fallback = '--') => {
      const node = document.getElementById(id);
      if (node) node.textContent = getText(value, fallback);
    };

    setText('profileStudentName', fullName, 'Student Profile');
    setText('infoFullName', fullName);
    setText('infoStudentID', data.studentLRN || data.lrn || enrollment.lrn_no);
    setText('infoGender', data.sex || data.gender);
    setText('infoBirthdate', data.birthdate || data.dateOfBirth);
    setText('infoPlaceOfBirth', data.placeOfBirth || data.place_birth);
    setText('infoMotherTongue', data.motherTongue || data.mother_tongue);
    setText('infoAddress', data.currentAddress || data.address);
    setText('infoPermanentAddress', data.permanentAddress || data.address);
    setText('infoGrade', data.gradeLevel || data.grade);
    setText('infoTrack', enrollment.track || data.track);
    setText('infoEnrollmentStatus', enrollment.status || 'Pending');

    const electives = asArray(data.electives || data.elective || data.selectedElectives);
    setText('infoElectives', electives.length ? electives.join(', ') : 'None', 'None');

    const disabilities = asArray(data.disability || data.disabilities);
    setText('infoDisability', disabilities.length ? disabilities.join(', ') : 'None', 'None');
    setText('infoIPGroup', data.ip_group || data.ipGroup || data.indigenousGroup || 'Not an IP member', 'Not an IP member');
    setText('info4Ps', data.four_ps || data.is4ps || data.fourPs ? 'Yes' : 'No');

    const historyContent = document.getElementById('historyContent');
    if (historyContent) {
      const submittedAt = enrollment.enrollment_date ? new Date(enrollment.enrollment_date) : null;
      historyContent.innerHTML = `<p>Enrolled: ${submittedAt && !isNaN(submittedAt.getTime()) ? submittedAt.toLocaleDateString() : '--'}</p>`;
    }

    const documentsPane = document.getElementById('tab-documents');
    if (documentsPane) {
      const documentKeys = Object.keys(files || {});
      if (!documentKeys.length) {
        documentsPane.innerHTML = '<p class="no-data">No documents submitted.</p>';
      } else {
        documentsPane.innerHTML = '<div id="documentsContainer"><p class="no-data">Documents available in enrollment record.</p></div>';
      }
    }

    const tabButtons = document.querySelectorAll('.profile-tabs .tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    tabButtons.forEach((btn) => btn.classList.remove('active'));
    tabPanes.forEach((pane) => pane.classList.remove('active'));
    const personalBtn = document.querySelector('.profile-tabs .tab-btn[data-tab="personal"]');
    const personalPane = document.getElementById('tab-personal');
    if (personalBtn) personalBtn.classList.add('active');
    if (personalPane) personalPane.classList.add('active');

    modal.classList.add('active');
    modal.style.display = 'flex';
    modal.style.pointerEvents = 'auto';
    modal.setAttribute('aria-hidden', 'false');
    return true;
  }

  async function openStudentProfileFromEnrollment(enrollmentId) {
    try {
      if (typeof window.debugRecentProfileFlow === 'function') {
        window.debugRecentProfileFlow('bridge-entry', enrollmentId);
      }
    } catch (_e) {}

    let enrollment = findEnrollment(enrollmentId);
    if (!enrollment) {
      try {
        enrollment = await apiGet(`/api/enrollments/${encodeURIComponent(enrollmentId)}`);
      } catch (err) {
        try {
          if (typeof window.debugRecentProfileFlow === 'function') {
            window.debugRecentProfileFlow('bridge-fetch-failed', err && err.message ? err.message : 'fetch-failed');
          }
        } catch (_e) {}
        if (typeof window.showNotification === 'function') window.showNotification('Failed to load enrollment details', 'error');
        return;
      }
    }

    if (!enrollment) {
      try {
        if (typeof window.debugRecentProfileFlow === 'function') {
          window.debugRecentProfileFlow('bridge-no-enrollment', enrollmentId);
        }
      } catch (_e) {}
      return;
    }

    const data = parseEnrollmentData(enrollment);
    const candidates = [
      enrollment.student_id,
      enrollment.studentId,
      data.student_id,
      data.studentId,
      data.studentLRN,
      data.lrn,
      enrollment.lrn_no
    ]
      .map((value) => String(value || '').trim())
      .filter(Boolean);

    const profileModal = document.getElementById('studentProfileModal');
    const isProfileOpen = () => {
      if (!profileModal) return false;
      const display = String(profileModal.style.display || '').toLowerCase();
      return profileModal.classList.contains('active') && display !== 'none';
    };

    const tryOpenById = () => {
      if (typeof window.openStudentProfile !== 'function') return false;
      for (const candidateId of candidates) {
        try {
          window.openStudentProfile(candidateId);
          if (isProfileOpen()) return true;
        } catch (_err) {
          // try next candidate
        }
      }
      return false;
    };

    if (tryOpenById()) {
      try {
        if (typeof window.debugRecentProfileFlow === 'function') {
          window.debugRecentProfileFlow('bridge-opened-by-student-id', enrollmentId);
        }
      } catch (_e) {}
      return;
    }

    if (typeof window.loadStudents === 'function') {
      try {
        await window.loadStudents();
        if (tryOpenById()) {
          try {
            if (typeof window.debugRecentProfileFlow === 'function') {
              window.debugRecentProfileFlow('bridge-opened-after-student-reload', enrollmentId);
            }
          } catch (_e) {}
          return;
        }
      } catch (_err) {
        // fallback below
      }
    }

    if (openProfileModalFromEnrollment(enrollment)) {
      try {
        if (typeof window.debugRecentProfileFlow === 'function') {
          window.debugRecentProfileFlow('bridge-opened-fallback-populate', enrollmentId);
        }
      } catch (_e) {}
      return;
    }

    try {
      if (typeof window.debugRecentProfileFlow === 'function') {
        window.debugRecentProfileFlow('bridge-open-failed', enrollmentId);
      }
    } catch (_e) {}
    if (typeof window.showNotification === 'function') {
      window.showNotification('Unable to open Student Profile right now', 'error');
    }
  }

  window.openStudentProfileFromEnrollment = function (enrollmentId) {
    return openStudentProfileFromEnrollment(enrollmentId);
  };

  async function openDetails(enrollmentId) {
    let enrollment = findEnrollment(enrollmentId);
    if (!enrollment) {
      try {
        enrollment = await apiGet(`/api/enrollments/${encodeURIComponent(enrollmentId)}`);
      } catch (err) {
        if (typeof window.showNotification === 'function') window.showNotification('Failed to load enrollment details', 'error');
        return;
      }
    }

    if (!enrollment) return;

    const data = parseEnrollmentData(enrollment);
    const modal = document.getElementById('qet2Modal');
    const body = document.getElementById('qet2ModalBody');
    const title = document.getElementById('qet2ModalTitle');
    if (!modal || !body || !title) return;

    const name = pickStudentName(enrollment, data);
    title.textContent = `Enrollment: ${name}`;

    const fields = [
      ['Status', enrollment.status || 'Pending'],
      ['LRN', data.studentLRN || data.lrn || enrollment.lrn_no || '--'],
      ['Grade', data.gradeLevel || data.grade || '--'],
      ['Track', enrollment.track || data.track || '--'],
      ['Email', data.email || enrollment.email || '--'],
      ['Phone', data.phone || '--'],
      ['Submitted', enrollment.enrollment_date ? new Date(enrollment.enrollment_date).toLocaleString() : '--'],
      ['Birthdate', data.birthdate || '--'],
      ['Sex', data.sex || data.gender || '--'],
      ['Address', data.currentAddress || '--']
    ];

    body.innerHTML = `<div class="qet2-grid">${fields.map(([label, value]) => `<div class="qet2-cell"><div class="qet2-label">${escapeHtml(label)}</div><div class="qet2-value">${escapeHtml(value)}</div></div>`).join('')}</div>`;

    const approveBtn = document.getElementById('qet2Approve');
    const rejectBtn = document.getElementById('qet2Reject');
    const deleteBtn = document.getElementById('qet2Delete');

    if (approveBtn) approveBtn.onclick = async () => {
      try {
        await apiSend(`/api/enrollments/${encodeURIComponent(enrollment.id)}`, 'PUT', { status: 'Approved' });
        if (typeof window.showNotification === 'function') window.showNotification('Enrollment approved', 'success');
        modal.classList.remove('active');
        await load(state.filter);
        if (typeof window.loadRecentEnrollments === 'function') window.loadRecentEnrollments();
        if (typeof window.loadDashboardStats === 'function') window.loadDashboardStats();
      } catch (err) {
        if (typeof window.showNotification === 'function') window.showNotification(`Approve failed: ${err.message}`, 'error');
      }
    };

    if (rejectBtn) rejectBtn.onclick = async () => {
      try {
        await apiSend(`/api/enrollments/${encodeURIComponent(enrollment.id)}`, 'PUT', { status: 'Rejected' });
        if (typeof window.showNotification === 'function') window.showNotification('Enrollment rejected', 'success');
        modal.classList.remove('active');
        await load(state.filter);
        if (typeof window.loadRecentEnrollments === 'function') window.loadRecentEnrollments();
        if (typeof window.loadDashboardStats === 'function') window.loadDashboardStats();
      } catch (err) {
        if (typeof window.showNotification === 'function') window.showNotification(`Reject failed: ${err.message}`, 'error');
      }
    };

    if (deleteBtn) deleteBtn.onclick = async () => {
      const confirmDelete = window.confirm('Delete this enrollment permanently?');
      if (!confirmDelete) return;
      try {
        await apiSend(`/api/enrollments/${encodeURIComponent(enrollment.id)}`, 'DELETE');
        if (typeof window.showNotification === 'function') window.showNotification('Enrollment deleted', 'success');
        modal.classList.remove('active');
        await load(state.filter);
        if (typeof window.loadRecentEnrollments === 'function') window.loadRecentEnrollments();
        if (typeof window.loadDashboardStats === 'function') window.loadDashboardStats();
      } catch (err) {
        if (typeof window.showNotification === 'function') window.showNotification(`Delete failed: ${err.message}`, 'error');
      }
    };

    modal.classList.add('active');
  }

  function bindEvents() {
    const search = document.getElementById('qet2Search');
    const clear = document.getElementById('qet2Clear');
    const modal = document.getElementById('qet2Modal');

    if (search) {
      search.addEventListener('input', () => {
        state.search = String(search.value || '').trim();
        renderList();
      });
    }

    if (clear) {
      clear.addEventListener('click', () => {
        state.search = '';
        if (search) search.value = '';
        renderList();
      });
    }

    document.querySelectorAll('.qet2-filter').forEach((button) => {
      button.addEventListener('click', async () => {
        document.querySelectorAll('.qet2-filter').forEach((item) => item.classList.remove('active'));
        button.classList.add('active');
        const nextFilter = normalizeFilter(button.getAttribute('data-filter') || 'all');
        await load(nextFilter);
      });
    });

    if (modal) {
      modal.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (target.getAttribute('data-close') === '1' || target.id === 'qet2ModalClose') {
          modal.classList.remove('active');
        }
      });
    }
  }

  function installGlobalOverrides() {
    window.loadEnrollments = async function (filter) {
      await load(normalizeFilter(filter || state.filter || 'all'));
    };

    window.loadRejectedEnrollments = async function () {
      await load('rejected');
    };

    window.searchEnrollments = function () {
      const searchInput = document.getElementById('qet2Search');
      state.search = String(searchInput ? searchInput.value : state.search || '').trim();
      renderList();
    };

    window.clearEnrollmentSearch = function () {
      const searchInput = document.getElementById('qet2Search');
      if (searchInput) searchInput.value = '';
      state.search = '';
      renderList();
    };

    window.deleteEnrollment = async function (_event, enrollmentId) {
      if (!enrollmentId) return;
      await openDetails(enrollmentId);
    };

    window.openEnrollmentDetailSafely = function (enrollmentId) {
      openStudentProfileFromEnrollment(enrollmentId).catch(() => {});
    };
  }

  function watchSectionActivation() {
    const section = document.getElementById('enrollment');
    if (!section) return;

    const observer = new MutationObserver(() => {
      if (section.classList.contains('active')) {
        load(state.filter || 'all').catch(() => {});
      }
    });

    observer.observe(section, { attributes: true, attributeFilter: ['class'] });
  }

  async function init() {
    injectStyles();
    const section = ensureMarkup();
    if (!section) return;
    bindEvents();
    installGlobalOverrides();
    watchSectionActivation();

    if (section.classList.contains('active')) {
      await load('all');
    }

    window.addEventListener('schoolYearActivated', () => {
      load(state.filter || 'all').catch(() => {});
    });

    window.addEventListener('dashboard:school-year-changed', () => {
      load(state.filter || 'all').catch(() => {});
    });

    window.addEventListener('storage', (event) => {
      if (!event || !event.key) return;
      if (event.key === 'activeSchoolYear' || event.key === 'activeSchoolYearChangedAt') {
        load(state.filter || 'all').catch(() => {});
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { init().catch(() => {}); });
  } else {
    init().catch(() => {});
  }
})();

