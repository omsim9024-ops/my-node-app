(function teacherRegistrationV3Bootstrap() {
  const STATE = {
    initialized: false,
    loading: false,
    teachers: [],
    filtered: [],
    roleRequests: [],
    loadingRoleRequests: false,
    loadCounter: 0
  };

  const REQUEST_TIMEOUT_MS = 8000;

  function detectSchoolCode() {
    try {
      const params = new URLSearchParams(window.location.search || '');
      const fromQuery = String(params.get('school') || params.get('tenant') || params.get('code') || '').trim().toLowerCase();
      if (fromQuery) return fromQuery;
    } catch (_err) {}

    try {
      const fromStorage = String(
        localStorage.getItem('sms.selectedSchoolCode') ||
        localStorage.getItem('sms.selectedTenantCode') ||
        localStorage.getItem('schoolCode') ||
        localStorage.getItem('tenantCode') ||
        ''
      ).trim().toLowerCase();
      if (fromStorage) return fromStorage;
    } catch (_err) {}

    try {
      const fromTenant = String((window.CURRENT_TENANT && window.CURRENT_TENANT.code) || '').trim().toLowerCase();
      if (fromTenant) return fromTenant;
    } catch (_err) {}

    return '';
  }

  function buildHeaders() {
    const headers = { Accept: 'application/json' };
    const school = detectSchoolCode();
    if (school) {
      headers['X-Tenant-Code'] = school;
      headers['X-School-Code'] = school;
    }

    try {
      const token = String(localStorage.getItem('adminAuthToken') || '').trim();
      if (token) headers.Authorization = `Bearer ${token}`;
    } catch (_err) {}

    return headers;
  }

  function withSchool(path) {
    const school = detectSchoolCode();
    if (!school) return path;
    const joiner = path.includes('?') ? '&' : '?';
    return `${path}${joiner}school=${encodeURIComponent(school)}`;
  }

  async function fetchJsonWithTimeout(path, timeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(function () {
      controller.abort();
    }, timeoutMs || REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(path, {
        method: 'GET',
        headers: buildHeaders(),
        credentials: 'include',
        cache: 'no-store',
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      return payload;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function requestJson(path, options, timeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(function () {
      controller.abort();
    }, timeoutMs || REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(path, {
        method: 'GET',
        headers: buildHeaders(),
        credentials: 'include',
        cache: 'no-store',
        signal: controller.signal,
        ...(options || {})
      });

      let payload = null;
      try { payload = await response.json(); } catch (_err) { payload = null; }
      if (!response.ok) {
        throw new Error((payload && payload.error) || `HTTP ${response.status}`);
      }

      return payload;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  function normalizeTeachers(payload) {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.teachers)) return payload.teachers;
    if (payload.success && Array.isArray(payload.data)) return payload.data;
    if (payload.success && payload.data && Array.isArray(payload.data.teachers)) return payload.data.teachers;
    return [];
  }

  function normalizeRole(role) {
    const raw = String(role || '').trim().toLowerCase();
    if (!raw) return 'unassigned';
    if (raw.includes('adviser')) return 'adviser';
    if (raw.includes('subject')) return 'subject_teacher';
    if (raw === 'teacher') return 'subject_teacher';
    if (raw.includes('admin')) return 'administrator';
    return raw.replace(/\s+/g, '_');
  }

  function roleLabel(role) {
    const normalized = normalizeRole(role);
    if (normalized === 'adviser') return 'Adviser';
    if (normalized === 'subject_teacher') return 'Subject Teacher';
    if (normalized === 'administrator') return 'Administrator';
    if (normalized === 'unassigned') return 'Unassigned';
    return String(normalized).replace(/_/g, ' ').replace(/\b\w/g, function (char) { return char.toUpperCase(); });
  }

  function requestStatusLabel(status) {
    const value = String(status || '').toLowerCase().trim();
    if (value === 'approved') return 'Approved';
    if (value === 'rejected') return 'Rejected';
    return 'Pending';
  }

  function requestRoleLabel(role) {
    const normalized = normalizeRole(role);
    if (normalized === 'subject_teacher') return 'Subject Teacher';
    if (normalized === 'adviser') return 'Adviser';
    return roleLabel(role);
  }

  function formatDate(value) {
    const date = new Date(value || 0);
    if (Number.isNaN(date.getTime())) return '--';
    return date.toLocaleString();
  }

  function teacherName(teacher) {
    const full = String(teacher.full_name || teacher.fullName || teacher.name || '').trim();
    if (full) return full;

    const first = String(teacher.first_name || teacher.firstName || '').trim();
    const last = String(teacher.last_name || teacher.lastName || '').trim();
    const combined = `${first} ${last}`.trim();
    if (combined) return combined;

    return String(teacher.username || teacher.email || 'Unknown Teacher');
  }

  function assignedText(teacher) {
    const sections = Array.isArray(teacher.assigned_sections) ? teacher.assigned_sections.length : 0;
    const subjects = Array.isArray(teacher.subject_assignments)
      ? teacher.subject_assignments.length
      : (Array.isArray(teacher.assigned_subjects) ? teacher.assigned_subjects.length : 0);

    if (!sections && !subjects) return 'No assignments';
    if (sections && subjects) return `${sections} section${sections > 1 ? 's' : ''}, ${subjects} subject${subjects > 1 ? 's' : ''}`;
    if (sections) return `${sections} section${sections > 1 ? 's' : ''}`;
    return `${subjects} subject${subjects > 1 ? 's' : ''}`;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function renderShell() {
    const section = document.getElementById('teacher-registration');
    if (!section) return;

    section.innerHTML = `
      <div class="section-header">
        <h2>Teachers</h2>
        <p>Manage teacher registration and teaching assignments</p>
      </div>

      <div class="section-tabs">
        <button id="tr3MainTabRegistration" class="section-tab-btn active" data-teachers-tab="registration" type="button">
          📝 Teacher Registration
        </button>
        <button id="tr3MainTabAssignments" class="section-tab-btn" data-teachers-tab="assignments" type="button">
          📚 Teacher Assignments
        </button>
      </div>

      <div id="tr3TabRegistration" class="section-tab-content active">
        <div class="content-card" style="padding:16px;">
          <div style="display:grid;grid-template-columns:1fr 220px 180px auto;gap:12px;margin-bottom:16px;">
            <input id="tr3-search" class="form-control" type="text" placeholder="Search by name, email, username...">
            <select id="tr3-role" class="form-control">
              <option value="all">All Roles</option>
              <option value="adviser">Adviser</option>
              <option value="subject_teacher">Subject Teacher</option>
              <option value="administrator">Administrator</option>
              <option value="unassigned">Unassigned</option>
            </select>
            <select id="tr3-sort" class="form-control">
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="name">Name A-Z</option>
              <option value="role">Role</option>
            </select>
            <button id="tr3-refresh" class="btn btn-primary" type="button">Refresh</button>
          </div>

          <div id="tr3-status" style="font-size:13px;color:#64748b;margin-bottom:10px;"></div>

          <div class="table-container" style="overflow:auto;">
            <table class="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Assignments</th>
                  <th style="text-align:right;">Actions</th>
                </tr>
              </thead>
              <tbody id="tr3-body">
                <tr><td colspan="6" class="no-data">Loading teachers...</td></tr>
              </tbody>
            </table>
          </div>

          <div style="margin-top:20px;border-top:1px solid #e2e8f0;padding-top:16px;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px;">
              <h3 style="margin:0;font-size:16px;color:#0f172a;">Role Assignment Requests</h3>
              <button id="tr3-requests-refresh" class="btn btn-secondary" type="button">Refresh Requests</button>
            </div>
            <div id="tr3-requests-status" style="font-size:12px;color:#64748b;margin-bottom:8px;"></div>
            <div class="table-container" style="overflow:auto;">
              <table class="table">
                <thead>
                  <tr>
                    <th>Teacher</th>
                    <th>Requested Role</th>
                    <th>Preferences</th>
                    <th>Status</th>
                    <th>Updated</th>
                    <th style="text-align:right;">Actions</th>
                  </tr>
                </thead>
                <tbody id="tr3-requests-body">
                  <tr><td colspan="6" class="no-data">Loading requests...</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div id="tr3TabAssignments" class="section-tab-content">
        <div id="teachingAssignmentsV2Root"></div>
      </div>
    `;
  }

  function switchTeachersMainTab(tabName) {
    const target = tabName === 'assignments' ? 'assignments' : 'registration';
    const registrationBtn = document.getElementById('tr3MainTabRegistration');
    const assignmentsBtn = document.getElementById('tr3MainTabAssignments');
    const registrationPanel = document.getElementById('tr3TabRegistration');
    const assignmentsPanel = document.getElementById('tr3TabAssignments');

    if (registrationBtn) registrationBtn.classList.toggle('active', target === 'registration');
    if (assignmentsBtn) assignmentsBtn.classList.toggle('active', target === 'assignments');
    if (registrationPanel) registrationPanel.classList.toggle('active', target === 'registration');
    if (assignmentsPanel) assignmentsPanel.classList.toggle('active', target === 'assignments');

    if (target === 'assignments') {
      if (typeof window.loadTeachingAssignmentsV2 === 'function') {
        setTimeout(function () {
          try { window.loadTeachingAssignmentsV2(); } catch (_err) {}
        }, 0);
      } else if (typeof window.renderTeachingAssignmentsTeacherTables === 'function') {
        setTimeout(function () {
          try { window.renderTeachingAssignmentsTeacherTables(); } catch (_err) {}
        }, 0);
      }
    }
  }

  function bindTeachersMainTabs() {
    const registrationBtn = document.getElementById('tr3MainTabRegistration');
    const assignmentsBtn = document.getElementById('tr3MainTabAssignments');

    if (registrationBtn) {
      registrationBtn.addEventListener('click', function () {
        switchTeachersMainTab('registration');
      });
    }

    if (assignmentsBtn) {
      assignmentsBtn.addEventListener('click', function () {
        switchTeachersMainTab('assignments');
      });
    }
  }

  function setStatus(message, isError) {
    const node = document.getElementById('tr3-status');
    if (!node) return;
    node.textContent = String(message || '');
    node.style.color = isError ? '#ef4444' : '#64748b';
  }

  function applyFilters() {
    const searchNode = document.getElementById('tr3-search');
    const roleNode = document.getElementById('tr3-role');
    const sortNode = document.getElementById('tr3-sort');

    const query = String(searchNode && searchNode.value || '').trim().toLowerCase();
    const roleFilter = normalizeRole(roleNode && roleNode.value || 'all');
    const sortBy = String(sortNode && sortNode.value || 'newest');

    const list = (STATE.teachers || []).filter(function (teacher) {
      const name = teacherName(teacher).toLowerCase();
      const email = String(teacher.email || '').toLowerCase();
      const username = String(teacher.username || '').toLowerCase();
      const role = normalizeRole(teacher.role);

      const queryMatch = !query || name.includes(query) || email.includes(query) || username.includes(query);
      const roleMatch = roleFilter === 'all' || role === roleFilter;

      return queryMatch && roleMatch;
    });

    list.sort(function (a, b) {
      if (sortBy === 'name') return teacherName(a).localeCompare(teacherName(b));
      if (sortBy === 'role') return normalizeRole(a.role).localeCompare(normalizeRole(b.role));

      const aDate = new Date(a.created_at || a.createdAt || 0).getTime();
      const bDate = new Date(b.created_at || b.createdAt || 0).getTime();
      if (sortBy === 'oldest') return aDate - bDate;
      return bDate - aDate;
    });

    STATE.filtered = list;

    try {
      window.allTeachers = STATE.teachers.slice();
      window.filteredTeachers = STATE.filtered.slice();
    } catch (_err) {}

    renderRows();
  }

  function renderRows() {
    const tbody = document.getElementById('tr3-body');
    if (!tbody) return;

    if (STATE.loading) {
      tbody.innerHTML = '<tr><td colspan="6" class="no-data">Loading teachers...</td></tr>';
      return;
    }

    if (!STATE.filtered.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="no-data">No teachers found.</td></tr>';
      return;
    }

    tbody.innerHTML = STATE.filtered.map(function (teacher) {
      const teacherId = teacher.id || teacher.teacher_id || teacher.user_id || '';
      return `
        <tr>
          <td>${escapeHtml(teacherName(teacher))}</td>
          <td>${escapeHtml(teacher.email || '-')}</td>
          <td>${escapeHtml(teacher.username || '-')}</td>
          <td>${escapeHtml(roleLabel(teacher.role))}</td>
          <td>${escapeHtml(assignedText(teacher))}</td>
          <td style="text-align:right;">
            <button class="btn btn-secondary" type="button" data-tr3-assign="${escapeHtml(String(teacherId))}">Assign</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  function setRequestsStatus(message, isError) {
    const node = document.getElementById('tr3-requests-status');
    if (!node) return;
    node.textContent = String(message || '');
    node.style.color = isError ? '#ef4444' : '#64748b';
  }

  function renderRoleRequestRows() {
    const tbody = document.getElementById('tr3-requests-body');
    if (!tbody) return;

    if (STATE.loadingRoleRequests) {
      tbody.innerHTML = '<tr><td colspan="6" class="no-data">Loading role requests...</td></tr>';
      return;
    }

    if (!Array.isArray(STATE.roleRequests) || !STATE.roleRequests.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="no-data">No role requests found.</td></tr>';
      return;
    }

    tbody.innerHTML = STATE.roleRequests.map(function (req) {
      const status = String(req.status || 'pending').toLowerCase();
      const statusColor = status === 'approved' ? '#166534' : (status === 'rejected' ? '#b91c1c' : '#9a6700');
      const teacher = escapeHtml(req.teacher_name || req.teacher_email || (`Teacher #${req.teacher_id}`));
      const preferences = [
        req.preferred_subject ? `Subject: ${escapeHtml(req.preferred_subject)}` : null,
        req.preferred_section ? `Section: ${escapeHtml(req.preferred_section)}` : null,
        req.notes ? `Note: ${escapeHtml(String(req.notes).slice(0, 80))}${String(req.notes).length > 80 ? '…' : ''}` : null
      ].filter(Boolean).join('<br>') || '-';

      const canReview = status === 'pending';

      return `
        <tr>
          <td>${teacher}</td>
          <td>${escapeHtml(requestRoleLabel(req.requested_role))}</td>
          <td style="font-size:12px;line-height:1.4;">${preferences}</td>
          <td><span style="font-weight:600;color:${statusColor};">${escapeHtml(requestStatusLabel(status))}</span></td>
          <td>${escapeHtml(formatDate(req.updated_at || req.created_at))}</td>
          <td style="text-align:right;">
            ${canReview
              ? `<button class="btn btn-primary" type="button" data-tr3-req-action="approve" data-tr3-req-id="${escapeHtml(String(req.id))}">Approve</button>
                 <button class="btn btn-secondary" type="button" data-tr3-req-action="reject" data-tr3-req-id="${escapeHtml(String(req.id))}" style="margin-left:6px;">Reject</button>`
              : `<span style="color:#64748b;font-size:12px;">Reviewed</span>`}
          </td>
        </tr>
      `;
    }).join('');
  }

  async function loadRoleRequests(force) {
    STATE.loadingRoleRequests = true;
    renderRoleRequestRows();
    setRequestsStatus('Loading role requests...', false);

    try {
      const payload = await fetchJsonWithTimeout(withSchool('/api/teacher-auth/role-requests?status=all&limit=100'), REQUEST_TIMEOUT_MS);
      const requests = Array.isArray(payload && payload.requests) ? payload.requests : (Array.isArray(payload) ? payload : []);
      STATE.roleRequests = requests;
      STATE.loadingRoleRequests = false;
      renderRoleRequestRows();
      setRequestsStatus(`Loaded ${requests.length} request${requests.length === 1 ? '' : 's'}.`, false);

      if (force && typeof window.showNotification === 'function') {
        window.showNotification('Role requests refreshed.', 'success');
      }
    } catch (err) {
      STATE.loadingRoleRequests = false;
      STATE.roleRequests = [];
      renderRoleRequestRows();
      setRequestsStatus(`Failed to load role requests${err && err.message ? `: ${err.message}` : ''}`, true);
    }
  }

  async function reviewRoleRequest(requestId, decision) {
    const id = Number(requestId || 0);
    const status = String(decision || '').toLowerCase();
    if (!id || (status !== 'approved' && status !== 'rejected')) return;

    let adminMessage = '';
    if (status === 'rejected') {
      const prompted = window.prompt('Optional message for teacher (reason/guidance):', '');
      if (prompted === null) return;
      adminMessage = String(prompted || '').trim();
    }

    try {
      await requestJson(withSchool(`/api/teacher-auth/role-request/${id}/review`), {
        method: 'PUT',
        headers: Object.assign({}, buildHeaders(), { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          status,
          admin_message: adminMessage
        })
      }, REQUEST_TIMEOUT_MS);

      if (typeof window.showNotification === 'function') {
        window.showNotification(`Role request ${status}.`, 'success');
      }

      await loadRoleRequests(false);
      await loadTeachers(false);
    } catch (err) {
      if (typeof window.showNotification === 'function') {
        window.showNotification(`Failed to review request${err && err.message ? `: ${err.message}` : ''}`, 'error');
      }
    }
  }

  function getTeacherById(rawTeacherId) {
    const id = String(rawTeacherId || '');
    if (!id) return null;

    const fromState = (STATE.teachers || []).find(function (item) {
      return String(item.id || item.teacher_id || item.user_id || '') === id;
    });
    if (fromState) return fromState;

    const fromWindow = (Array.isArray(window.allTeachers) ? window.allTeachers : []).find(function (item) {
      return String(item.id || item.teacher_id || item.user_id || '') === id;
    });
    return fromWindow || null;
  }

  function isAssignmentModalVisible() {
    const modal = document.getElementById('teacherAssignmentModal');
    if (!modal) return false;
    const style = window.getComputedStyle(modal);
    const byDisplay = style.display !== 'none' && modal.style.display !== 'none';
    const byAria = modal.getAttribute('aria-hidden') !== 'true';
    return byDisplay && byAria;
  }

  async function ensureActiveSchoolYearForModal() {
    if (typeof window.loadActiveSchoolYearForAssignment === 'function') {
      try {
        await Promise.resolve(window.loadActiveSchoolYearForAssignment());
      } catch (_err) {}
    }

    const display = document.getElementById('assignSchoolYearDisplay');
    const existing = Number(window.activeSchoolYearId || 0);
    if (existing > 0) {
      if (display && (!display.textContent || display.textContent.trim() === '--')) {
        display.textContent = String(window.activeSchoolYearLabel || `ID ${existing}`);
      }
      return existing;
    }

    try {
      const payload = await fetchJsonWithTimeout(withSchool('/api/school-years'), REQUEST_TIMEOUT_MS);
      const years = Array.isArray(payload) ? payload : (Array.isArray(payload && payload.data) ? payload.data : []);
      const active = years.find(function (item) { return !!item.is_active; }) || null;
      if (!active) return null;

      const id = Number(active.id || 0) || null;
      const label = String(active.school_year || active.name || '').trim() || '--';
      window.activeSchoolYearId = id;
      window.activeSchoolYearLabel = label;
      if (display) display.textContent = label;
      return id;
    } catch (_err) {
      return null;
    }
  }

  async function ensureSectionsForAssignmentModal() {
    if (typeof window.loadSectionsForAssignment === 'function') {
      try {
        await Promise.resolve(window.loadSectionsForAssignment());
      } catch (_err) {}
    }

    const cached = Array.isArray(window._sectionsCache)
      ? window._sectionsCache
      : (Array.isArray(window.allSectionsForAdvisory) ? window.allSectionsForAdvisory : []);
    if (cached.length > 0) return cached;

    const schoolYearId = Number(window.activeSchoolYearId || 0);
    const endpoints = schoolYearId
      ? [withSchool(`/api/sections/by-school-year/${schoolYearId}`), withSchool('/api/sections'), '/api/sections']
      : [withSchool('/api/sections'), '/api/sections'];

    for (const endpoint of endpoints) {
      try {
        const payload = await fetchJsonWithTimeout(endpoint, REQUEST_TIMEOUT_MS);
        const rows = Array.isArray(payload)
          ? payload
          : (Array.isArray(payload && payload.sections) ? payload.sections : (Array.isArray(payload && payload.data) ? payload.data : []));
        if (!Array.isArray(rows) || rows.length === 0) continue;

        const normalized = rows
          .map(function (section) {
            return Object.assign({}, section, {
              id: section.id ?? section.section_id ?? section.sectionId,
              grade_level: section.grade_level ?? section.gradeLevel ?? section.grade ?? section.year_level ?? section.level ?? ''
            });
          })
          .filter(function (section) { return section.id !== null && section.id !== undefined; });

        window._sectionsCache = normalized;
        window.allSectionsForAdvisory = normalized;
        return normalized;
      } catch (_err) {
        continue;
      }
    }

    return [];
  }

  function getSectionsCache() {
    const cached = Array.isArray(window._sectionsCache)
      ? window._sectionsCache
      : (Array.isArray(window.allSectionsForAdvisory) ? window.allSectionsForAdvisory : []);
    return cached;
  }

  function renderSelectedAdviserSections(selectedItems) {
    const container = document.getElementById('selectedAdviserSectionsContainer');
    const list = document.getElementById('selectedAdviserSectionsList');
    const hidden = document.getElementById('selectedAdviserSectionIds');
    if (!container || !list || !hidden) return;

    hidden.value = JSON.stringify(selectedItems || []);
    list.innerHTML = '';

    if (!Array.isArray(selectedItems) || selectedItems.length === 0) {
      container.style.display = 'none';
      return;
    }

    selectedItems.forEach(function (item, index) {
      const chip = document.createElement('div');
      chip.style = 'display:inline-flex; align-items:center; gap:6px; background:#e3f2fd; color:#1565c0; padding:6px 12px; border-radius:4px; font-size:12px; font-weight:500;';
      chip.innerHTML = `<span>${escapeHtml(item.name)} (Grade ${escapeHtml(item.grade)})</span><button type="button" data-tr3-remove-index="${index}" style="background:none;border:none;color:#1565c0;cursor:pointer;font-weight:bold;padding:0;width:16px;height:16px;display:flex;align-items:center;justify-content:center;">×</button>`;
      list.appendChild(chip);
    });

    container.style.display = 'block';
  }

  function getSelectedAdviserSections() {
    const hidden = document.getElementById('selectedAdviserSectionIds');
    if (!hidden || !hidden.value) return [];
    try {
      const parsed = JSON.parse(hidden.value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_err) {
      return [];
    }
  }

  function refreshAdvisorySelectByGrade() {
    const gradeSelect = document.getElementById('advisoryGradeLevel');
    const sectionSelect = document.getElementById('assignAdvisorySection');
    if (!gradeSelect || !sectionSelect) return;

    const selectedGrade = String(gradeSelect.value || '').trim();
    const sections = getSectionsCache();

    sectionSelect.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.text = '-- Select Sections --';
    sectionSelect.appendChild(placeholder);

    if (!selectedGrade || !sections.length) return;

    sections
      .filter(function (section) {
        const grade = String(section.grade_level ?? section.gradeLevel ?? section.grade ?? section.year_level ?? section.level ?? '').trim();
        return grade === selectedGrade;
      })
      .forEach(function (section) {
        const option = document.createElement('option');
        option.value = String(section.id);
        option.text = String(section.section_name || section.section_code || (`Section ${section.id}`));
        sectionSelect.appendChild(option);
      });
  }

  function addCurrentAdviserSectionSelections() {
    const gradeSelect = document.getElementById('advisoryGradeLevel');
    const sectionSelect = document.getElementById('assignAdvisorySection');
    if (!gradeSelect || !sectionSelect) return;

    const grade = String(gradeSelect.value || '').trim();
    if (!grade) {
      if (typeof window.showNotification === 'function') window.showNotification('Please select a grade level first.', 'error');
      return;
    }

    const selectedOptions = Array.from(sectionSelect.selectedOptions || []).filter(function (opt) {
      return String(opt.value || '').trim() !== '';
    });

    if (selectedOptions.length === 0) {
      if (typeof window.showNotification === 'function') window.showNotification('Please select at least one section.', 'error');
      return;
    }

    const existing = getSelectedAdviserSections();
    const byId = new Map(existing.map(function (item) { return [String(item.id), item]; }));

    selectedOptions.forEach(function (opt) {
      const id = String(opt.value || '').trim();
      if (!id) return;
      if (!byId.has(id)) {
        byId.set(id, { id, name: String(opt.text || `Section ${id}`), grade });
      }
    });

    renderSelectedAdviserSections(Array.from(byId.values()));
    sectionSelect.value = '';
  }

  function bindSelectedAdviserSectionRemoval() {
    const list = document.getElementById('selectedAdviserSectionsList');
    if (!list || list.dataset.tr3Bound === 'true') return;
    list.dataset.tr3Bound = 'true';

    list.addEventListener('click', function (event) {
      const btn = event.target && event.target.closest ? event.target.closest('[data-tr3-remove-index]') : null;
      if (!btn) return;

      const index = Number(btn.getAttribute('data-tr3-remove-index') || '-1');
      if (!Number.isFinite(index) || index < 0) return;

      const selected = getSelectedAdviserSections();
      if (index >= selected.length) return;
      selected.splice(index, 1);
      renderSelectedAdviserSections(selected);
    });
  }

  async function updateAssignmentRoleUi(selectedRole) {
    const role = String(selectedRole || '').trim();
    const advisoryGroup = document.getElementById('advisorySectionGroup');
    if (!advisoryGroup) return;

    const isAdviser = role.toLowerCase() === 'adviser';
    advisoryGroup.style.display = isAdviser ? 'block' : 'none';

    if (!isAdviser) {
      renderSelectedAdviserSections([]);
      return;
    }

    await ensureActiveSchoolYearForModal();
    await ensureSectionsForAssignmentModal();
    refreshAdvisorySelectByGrade();
  }

  function ensureAssignmentUxBindings() {
    const roleSelect = document.getElementById('assignRole');
    const gradeSelect = document.getElementById('advisoryGradeLevel');
    const addButton = document.getElementById('addAdviserSectionsBtn');

    if (roleSelect && roleSelect.dataset.tr3Bound !== 'true') {
      roleSelect.dataset.tr3Bound = 'true';
      roleSelect.addEventListener('change', function () {
        updateAssignmentRoleUi(roleSelect.value || '');
      });
    }

    if (gradeSelect && gradeSelect.dataset.tr3Bound !== 'true') {
      gradeSelect.dataset.tr3Bound = 'true';
      gradeSelect.addEventListener('change', refreshAdvisorySelectByGrade);
    }

    if (addButton && addButton.dataset.tr3Bound !== 'true') {
      addButton.dataset.tr3Bound = 'true';
      addButton.addEventListener('click', addCurrentAdviserSectionSelections);
    }

    bindSelectedAdviserSectionRemoval();
  }

  function forceOpenAssignmentModal(teacher) {
    if (!teacher) return false;
    const modal = document.getElementById('teacherAssignmentModal');
    if (!modal) return false;

    const teacherId = teacher.id || teacher.teacher_id || teacher.user_id || '';
    const setValue = function (id, value) {
      const node = document.getElementById(id);
      if (node) node.value = value == null ? '' : String(value);
    };
    const setText = function (id, value) {
      const node = document.getElementById(id);
      if (node) node.textContent = value == null ? '--' : String(value);
    };

    setValue('assignTeacherId', teacherId);
    setText('assignTeacherName', teacherName(teacher));
    setText('assignTeacherEmail', teacher.email || '--');
    setText('assignTeacherDept', teacher.department || '--');
    setText('assignTeacherId2', teacher.teacher_id || teacherId || '--');
    setValue('assignRole', '');
    renderSelectedAdviserSections([]);

    try { window.teacherToAssign = teacher; } catch (_err) {}

    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('active');
    modal.style.setProperty('display', 'flex', 'important');
    modal.style.setProperty('visibility', 'visible', 'important');
    modal.style.setProperty('opacity', '1', 'important');
    modal.style.setProperty('pointer-events', 'auto', 'important');
    modal.style.setProperty('z-index', '12000', 'important');

    try {
      if (typeof window.loadActiveSchoolYearForAssignment === 'function') {
        window.loadActiveSchoolYearForAssignment();
      }
      if (typeof window.loadSectionsForAssignment === 'function') {
        window.loadSectionsForAssignment();
      }
      if (typeof window.handleAssignRoleChange === 'function') {
        window.handleAssignRoleChange('');
      }
    } catch (_err) {}

    ensureAssignmentUxBindings();
    updateAssignmentRoleUi('');

    ensureAssignmentSubmitBindings();

    return true;
  }

  function resolveLegacySubmitHandler() {
    const direct = (typeof window.submitTeacherRoleAssignment === 'function') ? window.submitTeacherRoleAssignment : null;
    if (direct && !direct.__tr3Fallback) return direct;

    const globalDirect = (typeof globalThis.submitTeacherRoleAssignment === 'function') ? globalThis.submitTeacherRoleAssignment : null;
    if (globalDirect && !globalDirect.__tr3Fallback) return globalDirect;

    return null;
  }

  function collectSelectedAdviserSectionIds() {
    const selectedIdsInput = document.getElementById('selectedAdviserSectionIds');
    if (selectedIdsInput && selectedIdsInput.value) {
      try {
        const parsed = JSON.parse(selectedIdsInput.value);
        if (Array.isArray(parsed)) {
          return parsed
            .map(function (item) { return Number(item && item.id); })
            .filter(function (id) { return Number.isFinite(id) && id > 0; });
        }
      } catch (_err) {}
    }

    const advisorySelect = document.getElementById('assignAdvisorySection');
    if (!advisorySelect) return [];

    const fromMulti = Array.from(advisorySelect.selectedOptions || [])
      .map(function (opt) { return Number(opt.value); })
      .filter(function (id) { return Number.isFinite(id) && id > 0; });
    if (fromMulti.length) return fromMulti;

    const single = Number(advisorySelect.value || '');
    return Number.isFinite(single) && single > 0 ? [single] : [];
  }

  function closeAssignmentModalSafe() {
    const closeFn =
      (typeof window.trv2CloseAssignmentModal === 'function' && window.trv2CloseAssignmentModal) ||
      (typeof window.closeTeacherAssignmentModal === 'function' && window.closeTeacherAssignmentModal) ||
      null;

    if (closeFn) {
      closeFn();
      return;
    }

    const modal = document.getElementById('teacherAssignmentModal');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
    modal.classList.remove('active');
    modal.style.display = 'none';
    modal.style.visibility = 'hidden';
  }

  async function submitTeacherRoleAssignmentFallback() {
    const teacherId = Number(document.getElementById('assignTeacherId')?.value || '0');
    const role = String(document.getElementById('assignRole')?.value || '').trim();

    if (!teacherId || !role) {
      if (typeof window.showNotification === 'function') {
        window.showNotification('Please fill all required fields.', 'error');
      }
      return;
    }

    const adviserSectionIds = collectSelectedAdviserSectionIds();
    const schoolYearId = Number(window.activeSchoolYearId || 0) || null;

    if (role === 'Adviser' && adviserSectionIds.length === 0) {
      if (typeof window.showNotification === 'function') {
        window.showNotification('Please select at least one advisory section for Adviser role.', 'error');
      }
      return;
    }

    if (role === 'Adviser' && !schoolYearId) {
      if (typeof window.showNotification === 'function') {
        window.showNotification('No active school year is set. Activate one in School Years first.', 'error');
      }
      return;
    }

    const saveBtn = document.getElementById('assignTeacherSaveBtn');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
    }

    try {
      const payload = {
        teacher_id: teacherId,
        role,
        sections: role === 'Adviser' ? adviserSectionIds : [],
        advisory_section_id: role === 'Adviser' && adviserSectionIds.length ? adviserSectionIds[0] : null,
        advisory_section_ids: role === 'Adviser' ? adviserSectionIds : [],
        teaching_sections: role === 'Adviser' ? adviserSectionIds : [],
        school_year_id: schoolYearId
      };

      const response = await fetch(withSchool('/api/teacher-auth/assign-role'), {
        method: 'PUT',
        headers: Object.assign({}, buildHeaders(), { 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      let body = null;
      try { body = await response.json(); } catch (_err) { body = null; }

      if (!response.ok) {
        throw new Error((body && body.error) || `HTTP ${response.status}`);
      }

      if (typeof window.showNotification === 'function') {
        const teacher = body && body.teacher && body.teacher.name ? body.teacher.name : 'teacher';
        window.showNotification(`${role} role assigned successfully to ${teacher}.`, 'success');
      }

      closeAssignmentModalSafe();
      await loadTeachers(true);
    } catch (err) {
      if (typeof window.showNotification === 'function') {
        window.showNotification(`Error assigning role: ${err.message}`, 'error');
      }
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Confirm Assignment';
      }
    }
  }

  function ensureAssignmentSubmitBindings() {
    const form = document.getElementById('teacherAssignmentForm');
    const saveBtn = document.getElementById('assignTeacherSaveBtn');
    if (!form || !saveBtn) return;
    if (form.dataset.tr3SubmitBound === 'true') return;

    form.dataset.tr3SubmitBound = 'true';

    const submitReliable = async function () {
      const legacySubmit = resolveLegacySubmitHandler();
      if (legacySubmit) {
        await Promise.resolve(legacySubmit());
        return;
      }

      await submitTeacherRoleAssignmentFallback();
    };

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      event.stopPropagation();
      submitReliable();
    });

    saveBtn.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      submitReliable();
    });
  }

  async function openAssignmentModalReliable(rawTeacherId) {
    const teacher = getTeacherById(rawTeacherId);
    const numericId = Number(rawTeacherId);

    const legacyOpen =
      (typeof window.openTeacherAssignmentModal === 'function' && window.openTeacherAssignmentModal) ||
      (typeof globalThis.openTeacherAssignmentModal === 'function' && globalThis.openTeacherAssignmentModal) ||
      null;

    if (legacyOpen) {
      try {
        await Promise.resolve(legacyOpen(Number.isFinite(numericId) ? numericId : rawTeacherId));
      } catch (_err) {}
    }

    if (isAssignmentModalVisible()) {
      ensureAssignmentUxBindings();
      return true;
    }
    return forceOpenAssignmentModal(teacher);
  }

  async function loadTeachers(force) {
    const section = document.getElementById('teacher-registration');
    if (!section) return;

    if (!STATE.initialized) {
      renderShell();
      bindControls();
      STATE.initialized = true;
    }

    const loadId = ++STATE.loadCounter;
    STATE.loading = true;
    renderRows();
    setStatus('Loading teachers...', false);

    const candidates = [
      withSchool('/api/teachers'),
      withSchool('/api/teacher-auth/list'),
      '/api/teachers',
      '/api/teacher-auth/list'
    ];

    let lastError = null;
    let loaded = null;

    for (const path of candidates) {
      try {
        const payload = await fetchJsonWithTimeout(path, REQUEST_TIMEOUT_MS);
        const teachers = normalizeTeachers(payload);
        if (Array.isArray(teachers)) {
          loaded = teachers;
          break;
        }
      } catch (err) {
        lastError = err;
      }
    }

    if (loadId !== STATE.loadCounter) {
      return;
    }

    if (!loaded) {
      STATE.teachers = [];
      STATE.filtered = [];
      STATE.loading = false;
      renderRows();
      setStatus(`Failed to load teachers${lastError && lastError.message ? `: ${lastError.message}` : ''}`, true);

      if (typeof window.showNotification === 'function') {
        window.showNotification('Failed to load teachers.', 'error');
      }
      return;
    }

    STATE.teachers = loaded.map(function (teacher) {
      const normalized = Object.assign({}, teacher);
      normalized.role = normalizeRole(teacher.role);
      return normalized;
    });

    STATE.loading = false;
    applyFilters();
    setStatus(`Loaded ${STATE.teachers.length} teacher${STATE.teachers.length === 1 ? '' : 's'}.`, false);

    try {
      if (typeof window.populateTeachingTeacherSelect === 'function') {
        window.populateTeachingTeacherSelect();
      }
      if (typeof window.renderTeachingAssignmentsTeacherTables === 'function') {
        window.renderTeachingAssignmentsTeacherTables();
      }
    } catch (_err) {}

    try {
      if (typeof window.loadSectionAssignmentsForTeachers === 'function') {
        await window.loadSectionAssignmentsForTeachers();
      }
      if (typeof window.loadSubjectAssignmentsForTeachers === 'function') {
        await window.loadSubjectAssignmentsForTeachers();
      }
      if (typeof window.renderTeachingAssignmentsTeacherTables === 'function') {
        window.renderTeachingAssignmentsTeacherTables();
      }
    } catch (_err) {}

    if (force && typeof window.showNotification === 'function') {
      window.showNotification('Teachers refreshed successfully.', 'success');
    }

    await loadRoleRequests(false);
  }

  function bindControls() {
    const search = document.getElementById('tr3-search');
    const role = document.getElementById('tr3-role');
    const sort = document.getElementById('tr3-sort');
    const refresh = document.getElementById('tr3-refresh');
    const tbody = document.getElementById('tr3-body');
    const requestsRefresh = document.getElementById('tr3-requests-refresh');
    const requestsBody = document.getElementById('tr3-requests-body');

    if (search) search.addEventListener('input', applyFilters);
    if (role) role.addEventListener('change', applyFilters);
    if (sort) sort.addEventListener('change', applyFilters);
    if (refresh) refresh.addEventListener('click', function () { loadTeachers(true); });
    if (requestsRefresh) requestsRefresh.addEventListener('click', function () { loadRoleRequests(true); });

    if (tbody) {
      tbody.addEventListener('click', async function (event) {
        const button = event.target && event.target.closest ? event.target.closest('[data-tr3-assign]') : null;
        if (!button) return;

        const teacherId = button.getAttribute('data-tr3-assign');
        if (!teacherId) return;

        const opened = await openAssignmentModalReliable(teacherId);
        if (!opened && typeof window.showNotification === 'function') {
          window.showNotification('Assignment modal could not be opened. Please refresh and try again.', 'error');
        }
      });
    }

    if (requestsBody) {
      requestsBody.addEventListener('click', function (event) {
        const actionButton = event.target && event.target.closest ? event.target.closest('[data-tr3-req-action][data-tr3-req-id]') : null;
        if (!actionButton) return;

        const requestId = actionButton.getAttribute('data-tr3-req-id');
        const action = String(actionButton.getAttribute('data-tr3-req-action') || '').toLowerCase();
        if (!requestId || !action) return;

        const decision = action === 'approve' ? 'approved' : (action === 'reject' ? 'rejected' : '');
        if (!decision) return;

        reviewRoleRequest(requestId, decision);
      });
    }

    bindTeachersMainTabs();
  }

  function installHooks() {
    window.loadTeachersForAdminV3 = function (force) {
      return loadTeachers(!!force);
    };

    window.loadTeachersForAdmin = function () {
      return loadTeachers(false);
    };

    window.filterTeachers = function () {
      applyFilters();
    };

    window.renderTeachersTable = function () {
      renderRows();
    };

    if (typeof window.submitTeacherRoleAssignment !== 'function') {
      window.submitTeacherRoleAssignment = submitTeacherRoleAssignmentFallback;
      window.submitTeacherRoleAssignment.__tr3Fallback = true;
    }

    window.trv2CloseAssignmentModal = function () {
      const closeFn =
        (typeof window.closeTeacherAssignmentModal === 'function' && window.closeTeacherAssignmentModal) ||
        (typeof globalThis.closeTeacherAssignmentModal === 'function' && globalThis.closeTeacherAssignmentModal) ||
        null;

      if (closeFn) {
        closeFn();
        return;
      }

      const modal = document.getElementById('teacherAssignmentModal');
      if (!modal) return;
      modal.setAttribute('aria-hidden', 'true');
      modal.classList.remove('active');
      modal.style.display = 'none';
      modal.style.visibility = 'hidden';
    };

    document.addEventListener('click', function (event) {
      const trigger = event.target && event.target.closest
        ? event.target.closest('[data-section="teacher-registration"], [data-section="teaching-assignments"], #teacherRegistrationLink, #teacher-registration-link')
        : null;
      if (!trigger) return;

      setTimeout(function () {
        loadTeachers(false);
      }, 0);
    });

    window.switchTeachersMainTab = switchTeachersMainTab;
  }

  function bootstrap() {
    installHooks();
    ensureAssignmentSubmitBindings();
    ensureAssignmentUxBindings();

    const section = document.getElementById('teacher-registration');
    if (!section) return;

    if (section.classList.contains('active')) {
      loadTeachers(false);
      loadRoleRequests(false);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();



