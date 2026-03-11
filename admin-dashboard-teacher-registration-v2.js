(function teacherRegistrationV2Bootstrap() {
  const STATE = {
    initialized: false,
    loading: false,
    allTeachers: [],
    filteredTeachers: []
  };

  const REQUEST_TIMEOUT_MS = 10000;

  const ENDPOINT_CANDIDATES = [
    '/api/teachers',
    '/api/teacher-auth/list'
  ];

  function promiseWithTimeout(promise, timeoutMs, message) {
    let timerId = null;
    const timeoutPromise = new Promise(function (_resolve, reject) {
      timerId = setTimeout(function () {
        reject(new Error(message || 'Request timed out'));
      }, timeoutMs || REQUEST_TIMEOUT_MS);
    });

    return Promise.race([promise, timeoutPromise]).finally(function () {
      if (timerId) clearTimeout(timerId);
    });
  }

  async function fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const timeout = setTimeout(function () {
      controller.abort();
    }, timeoutMs || REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, Object.assign({}, options || {}, { signal: controller.signal }));
      return response;
    } finally {
      clearTimeout(timeout);
    }
  }

  function syncLegacyTeacherStores() {
    try {
      if (typeof allTeachers !== 'undefined') {
        allTeachers = Array.isArray(STATE.allTeachers) ? STATE.allTeachers : [];
      }
    } catch (_error) {}

    try {
      if (typeof filteredTeachers !== 'undefined') {
        filteredTeachers = Array.isArray(STATE.filteredTeachers) ? STATE.filteredTeachers : [];
      }
    } catch (_error) {}

    window.allTeachers = Array.isArray(STATE.allTeachers) ? STATE.allTeachers : [];
    window.filteredTeachers = Array.isArray(STATE.filteredTeachers) ? STATE.filteredTeachers : [];
  }

  function getTenantCode() {
    const fromWindow = (window.CURRENT_TENANT && window.CURRENT_TENANT.code) ||
      window.currentTenant ||
      window.tenantCode ||
      null;

    if (fromWindow) return String(fromWindow).trim();

    try {
      const fromStorage =
        localStorage.getItem('sms.selectedSchoolCode') ||
        localStorage.getItem('sms.selectedTenantCode') ||
        localStorage.getItem('tenantCode') ||
        localStorage.getItem('schoolCode');
      if (fromStorage) return String(fromStorage).trim();
    } catch (error) {
      console.warn('[TeacherRegistrationV2] Unable to read tenant from storage:', error);
    }

    return null;
  }

  function getSchoolCodeFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search || '');
      return String(params.get('school') || params.get('tenant') || params.get('code') || '').trim();
    } catch (_error) {
      return '';
    }
  }

  function buildHeaders() {
    const headers = {
      Accept: 'application/json'
    };

    const tenant = getTenantCode();
    if (tenant) {
      headers['X-Tenant-Code'] = tenant;
      headers['X-School-Code'] = tenant;
    }

    return headers;
  }

  async function fetchTeachers() {
    const headers = buildHeaders();
    const schoolCodeFromUrl = getSchoolCodeFromUrl();
    const tenantCode = getTenantCode();

    const schoolVariants = Array.from(new Set(
      [schoolCodeFromUrl, tenantCode, ''].map(function (value) {
        return String(value || '').trim();
      })
    ));

    for (const endpoint of ENDPOINT_CANDIDATES) {
      for (const schoolCode of schoolVariants) {
        try {
          let requestPath = endpoint;
          if (schoolCode) {
            const delimiter = endpoint.includes('?') ? '&' : '?';
            requestPath = `${endpoint}${delimiter}school=${encodeURIComponent(schoolCode)}`;
          }

          const tryMethods = ['direct', 'apiFetch'];
          for (const method of tryMethods) {
            let response;

            if (method === 'apiFetch' && typeof window.apiFetch === 'function') {
              response = await promiseWithTimeout(window.apiFetch(requestPath, {
                method: 'GET',
                headers
              }, REQUEST_TIMEOUT_MS), REQUEST_TIMEOUT_MS + 1500, 'apiFetch timeout');
            } else if (method === 'direct') {
              response = await fetchWithTimeout(requestPath, {
                method: 'GET',
                headers,
                credentials: 'include'
              }, REQUEST_TIMEOUT_MS);
            } else {
              continue;
            }

            if (!response || !response.ok) {
              continue;
            }

            const payload = await response.json();
            const normalized = normalizeTeachersPayload(payload);
            if (Array.isArray(normalized)) {
              return normalized;
            }
          }
        } catch (error) {
          console.warn(`[TeacherRegistrationV2] Failed endpoint ${endpoint} (school=${schoolCode || 'none'}):`, error);
        }
      }
    }

    throw new Error('Unable to load teachers from available endpoints');
  }

  async function fetchTeachersEmergency() {
    const headers = buildHeaders();
    const schoolCode = getSchoolCodeFromUrl() || getTenantCode() || '';

    const paths = [
      schoolCode ? `/api/teachers?school=${encodeURIComponent(schoolCode)}` : '/api/teachers',
      schoolCode ? `/api/teacher-auth/list?school=${encodeURIComponent(schoolCode)}` : '/api/teacher-auth/list'
    ];

    for (const path of paths) {
      try {
        const response = await fetchWithTimeout(path, {
          method: 'GET',
          headers,
          credentials: 'include'
        }, REQUEST_TIMEOUT_MS);

        if (!response.ok) continue;
        const payload = await response.json();
        const normalized = normalizeTeachersPayload(payload);
        if (Array.isArray(normalized)) return normalized;
      } catch (_err) {
        continue;
      }
    }

    throw new Error('Emergency teacher fetch failed');
  }

  function normalizeTeachersPayload(payload) {
    if (!payload) return [];

    if (Array.isArray(payload)) return payload;

    if (Array.isArray(payload.teachers)) return payload.teachers;

    if (payload.success && Array.isArray(payload.data)) return payload.data;

    if (payload.success && payload.data && Array.isArray(payload.data.teachers)) {
      return payload.data.teachers;
    }

    return [];
  }

  function normalizeRole(role) {
    const raw = String(role || '').toLowerCase().trim();
    if (!raw) return 'unassigned';
    if (raw.includes('adviser')) return 'adviser';
    if (raw.includes('subject')) return 'subject_teacher';
    if (raw.includes('teacher')) return 'subject_teacher';
    if (raw.includes('admin')) return 'administrator';
    return raw.replace(/\s+/g, '_');
  }

  function roleLabel(role) {
    switch (normalizeRole(role)) {
      case 'adviser': return 'Adviser';
      case 'subject_teacher': return 'Subject Teacher';
      case 'administrator': return 'Administrator';
      case 'unassigned': return 'Unassigned';
      default:
        return String(role || 'Unassigned')
          .replace(/_/g, ' ')
          .replace(/\b\w/g, function (char) { return char.toUpperCase(); });
    }
  }

  function getTeacherName(teacher) {
    if (!teacher) return 'Unknown Teacher';

    const fullName = teacher.full_name || teacher.fullName || teacher.name;
    if (fullName && String(fullName).trim()) return String(fullName).trim();

    const first = String(teacher.first_name || teacher.firstName || '').trim();
    const last = String(teacher.last_name || teacher.lastName || '').trim();
    const combined = `${first} ${last}`.trim();
    if (combined) return combined;

    return teacher.username || teacher.email || 'Unknown Teacher';
  }

  function getAssignedSummary(teacher) {
    const sections = Array.isArray(teacher.assigned_sections) ? teacher.assigned_sections : [];
    const subjects = Array.isArray(teacher.assigned_subjects)
      ? teacher.assigned_subjects
      : (Array.isArray(teacher.subject_assignments) ? teacher.subject_assignments : []);

    const sectionCount = sections.length;
    const subjectCount = subjects.length;

    if (!sectionCount && !subjectCount) {
      return 'No assignments';
    }

    if (sectionCount && subjectCount) {
      return `${sectionCount} section${sectionCount > 1 ? 's' : ''}, ${subjectCount} subject${subjectCount > 1 ? 's' : ''}`;
    }

    if (sectionCount) {
      return `${sectionCount} section${sectionCount > 1 ? 's' : ''}`;
    }

    return `${subjectCount} subject${subjectCount > 1 ? 's' : ''}`;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function ensureStyles() {
    if (document.getElementById('teacherRegistrationV2Styles')) return;

    const style = document.createElement('style');
    style.id = 'teacherRegistrationV2Styles';
    style.textContent = `
      .trv2-card { background: var(--surface-color, #fff); border: 1px solid var(--border-color, #e5e7eb); border-radius: 12px; }
      .trv2-controls { display: grid; grid-template-columns: 1fr 220px 180px auto; gap: 12px; margin: 16px 0; }
      .trv2-empty, .trv2-error, .trv2-loading { padding: 16px; text-align: center; color: var(--text-secondary, #6b7280); }
      .trv2-role-badge { display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; border: 1px solid var(--border-color, #e5e7eb); }
      .trv2-actions { display: flex; gap: 8px; justify-content: flex-end; }
      .trv2-action-btn { padding: 6px 10px; border-radius: 8px; border: 1px solid var(--border-color, #e5e7eb); background: var(--surface-color, #fff); cursor: pointer; font-size: 12px; }
      .trv2-action-btn:hover { opacity: 0.9; }
      #teacherAssignmentModal { z-index: 12000 !important; pointer-events: auto !important; }
      #teacherAssignmentModal .modal-content { position: relative; z-index: 12001; pointer-events: auto !important; }
      #teacherAssignmentModal .modal-close,
      #teacherAssignmentModal #assignTeacherCancelBtn,
      #teacherAssignmentModal #assignTeacherSaveBtn {
        position: relative;
        z-index: 12002;
        pointer-events: auto !important;
      }
      #teacherAssignmentModal .trv2-assign-hint {
        margin-top: 10px;
        font-size: 12px;
        color: var(--text-secondary, #6b7280);
      }
      #teacherAssignmentModal .trv2-assign-hint.error {
        color: #d32f2f;
      }
      @media (max-width: 1080px) {
        .trv2-controls { grid-template-columns: 1fr; }
      }
    `;

    document.head.appendChild(style);
  }

  function renderTeacherRegistrationShell() {
    const section = document.getElementById('teacher-registration');
    if (!section) return;

    ensureStyles();

    section.innerHTML = `
      <div class="section-header">
        <h2><i class="fas fa-chalkboard-teacher"></i> Teacher Registration</h2>
        <p>Manage registered teachers and assignments</p>
      </div>

      <div class="trv2-card" style="padding:16px;">
        <div class="trv2-controls">
          <input id="teacherSearchInput" class="form-control" type="text" placeholder="Search by name, email, username...">
          <select id="teacherRoleFilter" class="form-control">
            <option value="all">All Roles</option>
            <option value="adviser">Adviser</option>
            <option value="subject_teacher">Subject Teacher</option>
            <option value="administrator">Administrator</option>
            <option value="unassigned">Unassigned</option>
          </select>
          <select id="teacherSortBy" class="form-control">
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="name">Name A-Z</option>
            <option value="role">Role</option>
          </select>
          <button id="teacherRefreshBtn" class="btn btn-primary" type="button">Refresh</button>
        </div>

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
            <tbody id="teachersTableBody">
              <tr><td colspan="6" class="trv2-loading">Loading teachers...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function getControlValue(id, fallback) {
    const element = document.getElementById(id);
    return element ? element.value : fallback;
  }

  function applyFiltersAndRender() {
    const search = String(getControlValue('teacherSearchInput', '') || '').toLowerCase().trim();
    const roleFilter = normalizeRole(getControlValue('teacherRoleFilter', 'all'));
    const sortBy = getControlValue('teacherSortBy', 'newest');

    const filtered = STATE.allTeachers.filter(function (teacher) {
      const name = getTeacherName(teacher).toLowerCase();
      const email = String(teacher.email || '').toLowerCase();
      const username = String(teacher.username || '').toLowerCase();
      const role = normalizeRole(teacher.role);

      const matchesSearch = !search || name.includes(search) || email.includes(search) || username.includes(search);
      const matchesRole = roleFilter === 'all' || role === roleFilter;

      return matchesSearch && matchesRole;
    });

    filtered.sort(function (a, b) {
      if (sortBy === 'name') {
        return getTeacherName(a).localeCompare(getTeacherName(b));
      }

      if (sortBy === 'role') {
        return normalizeRole(a.role).localeCompare(normalizeRole(b.role));
      }

      const aDate = new Date(a.created_at || a.createdAt || 0).getTime();
      const bDate = new Date(b.created_at || b.createdAt || 0).getTime();

      if (sortBy === 'oldest') {
        return aDate - bDate;
      }

      return bDate - aDate;
    });

    STATE.filteredTeachers = filtered;
    syncLegacyTeacherStores();

    renderTeacherRows();
  }

  function renderTeacherRows() {
    const tbody = document.getElementById('teachersTableBody');
    if (!tbody) return;

    if (STATE.loading && !STATE.filteredTeachers.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="trv2-loading">Loading teachers...</td></tr>';
      return;
    }

    if (!STATE.filteredTeachers.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="trv2-empty">No teachers found.</td></tr>';
      return;
    }

    tbody.innerHTML = STATE.filteredTeachers.map(function (teacher) {
      const teacherId = teacher.id || teacher.teacher_id || teacher.user_id;
      const name = escapeHtml(getTeacherName(teacher));
      const email = escapeHtml(teacher.email || '-');
      const username = escapeHtml(teacher.username || '-');
      const role = roleLabel(teacher.role);
      const assignments = escapeHtml(getAssignedSummary(teacher));

      return `
        <tr>
          <td>${name}</td>
          <td>${email}</td>
          <td>${username}</td>
          <td><span class="trv2-role-badge">${escapeHtml(role)}</span></td>
          <td>${assignments}</td>
          <td>
            <div class="trv2-actions">
              <button class="trv2-action-btn" type="button" data-action="assign" data-id="${escapeHtml(teacherId)}" onclick="window.trv2OpenAssignFromId && window.trv2OpenAssignFromId(this.getAttribute('data-id'))">Assign</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function showError(message) {
    const tbody = document.getElementById('teachersTableBody');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="6" class="trv2-error">${escapeHtml(message || 'Unable to load teachers')}</td></tr>`;
  }

  function bindActionHandlers() {
    const tbody = document.getElementById('teachersTableBody');
    if (!tbody || tbody.dataset.trv2Bound === 'true') return;

    tbody.dataset.trv2Bound = 'true';
    tbody.addEventListener('click', function (event) {
      const button = event.target && event.target.closest ? event.target.closest('button[data-action]') : null;
      if (!button) return;

      const action = button.getAttribute('data-action');
      const teacherId = button.getAttribute('data-id');
      const teacher = STATE.allTeachers.find(function (item) {
        return String(item.id || item.teacher_id || item.user_id) === String(teacherId);
      });

      if (!teacher) return;

      if (action === 'assign') {
        openAssignFromId(teacherId);
      }
    });
  }

  function isAssignmentModalVisible() {
    const modal = document.getElementById('teacherAssignmentModal');
    if (!modal) return false;
    const style = window.getComputedStyle(modal);
    const visibleByDisplay = style.display !== 'none' && modal.style.display !== 'none';
    const visibleByAria = modal.getAttribute('aria-hidden') !== 'true';
    return visibleByDisplay && visibleByAria;
  }

  function forceOpenAssignmentModal(teacher) {
    const modal = document.getElementById('teacherAssignmentModal');
    if (!modal) {
      if (typeof window.showNotification === 'function') {
        window.showNotification('Assignment modal element is missing.', 'error');
      }
      return;
    }

    const teacherId = teacher && (teacher.id || teacher.teacher_id || teacher.user_id || '');
    const teacherName = getTeacherName(teacher);

    const setValue = function (id, value) {
      const node = document.getElementById(id);
      if (node) node.value = value == null ? '' : String(value);
    };

    const setText = function (id, value) {
      const node = document.getElementById(id);
      if (node) node.textContent = value == null ? '--' : String(value);
    };

    setValue('assignTeacherId', teacherId);
    setText('assignTeacherName', teacherName);
    setText('assignTeacherEmail', teacher && teacher.email ? teacher.email : '--');
    setText('assignTeacherDept', teacher && teacher.department ? teacher.department : '--');
    setText('assignTeacherId2', teacher && teacher.teacher_id ? teacher.teacher_id : teacherId || '--');
    setValue('assignRole', '');

    try {
      window.teacherToAssign = teacher;
    } catch (_error) {}

    modal.setAttribute('aria-hidden', 'false');
    modal.style.setProperty('display', 'flex', 'important');
    modal.style.setProperty('visibility', 'visible', 'important');
    modal.style.setProperty('opacity', '1', 'important');
    modal.style.setProperty('pointer-events', 'auto', 'important');
    modal.style.setProperty('z-index', '10000', 'important');

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
    } catch (_error) {}

    ensureAssignmentModalBindings();
    updateAssignmentModalUXState();
  }

  function closeAssignmentModalHard() {
    const modal = document.getElementById('teacherAssignmentModal');
    if (!modal) return;

    modal.setAttribute('aria-hidden', 'true');
    modal.style.display = 'none';
    modal.style.visibility = 'hidden';

    const saveBtn = document.getElementById('assignTeacherSaveBtn');
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.dataset.trv2Saving = 'false';
      saveBtn.textContent = 'Confirm Assignment';
    }

    if (typeof window.closeTeacherAssignmentModal === 'function') {
      try { window.closeTeacherAssignmentModal(); } catch (_err) {}
    }
  }

  function parseSelectedAdviserCount() {
    const selectedIdsInput = document.getElementById('selectedAdviserSectionIds');
    if (selectedIdsInput && selectedIdsInput.value) {
      try {
        const parsed = JSON.parse(selectedIdsInput.value);
        if (Array.isArray(parsed)) return parsed.length;
      } catch (_error) {}
    }

    const advisorySelect = document.getElementById('assignAdvisorySection');
    if (!advisorySelect) return 0;

    const selectedOptions = Array.from(advisorySelect.selectedOptions || []).filter(function (opt) {
      return String(opt.value || '').trim() !== '';
    });

    if (selectedOptions.length > 0) return selectedOptions.length;
    return advisorySelect.value ? 1 : 0;
  }

  function ensureAssignHintNode() {
    let hint = document.getElementById('trv2AssignHint');
    if (hint) return hint;

    const form = document.getElementById('teacherAssignmentForm');
    if (!form) return null;

    hint = document.createElement('div');
    hint.id = 'trv2AssignHint';
    hint.className = 'trv2-assign-hint';
    hint.textContent = 'Choose role, then complete required fields before confirming.';

    const actionRow = form.querySelector('button#assignTeacherSaveBtn')
      ? document.getElementById('assignTeacherSaveBtn').closest('div')
      : null;

    if (actionRow && actionRow.parentElement) {
      actionRow.parentElement.insertBefore(hint, actionRow);
    } else {
      form.appendChild(hint);
    }

    return hint;
  }

  function updateAssignmentModalUXState() {
    const roleNode = document.getElementById('assignRole');
    const saveBtn = document.getElementById('assignTeacherSaveBtn');
    const hint = ensureAssignHintNode();
    if (!roleNode || !saveBtn) return;

    const role = String(roleNode.value || '').trim();
    const adviserCount = parseSelectedAdviserCount();

    let canSubmit = false;
    let message = 'Choose role, then complete required fields before confirming.';
    let isError = false;

    if (!role) {
      canSubmit = false;
      message = 'Role is required.';
      isError = true;
    } else if (role === 'Adviser') {
      canSubmit = adviserCount > 0;
      message = canSubmit
        ? `Ready to assign Adviser role (${adviserCount} section${adviserCount > 1 ? 's' : ''} selected).`
        : 'Select at least one advisory section for Adviser role.';
      isError = !canSubmit;
    } else if (role === 'Subject Teacher') {
      canSubmit = true;
      message = 'Ready to assign Subject Teacher role.';
      isError = false;
    } else {
      canSubmit = true;
      message = 'Ready to submit assignment.';
      isError = false;
    }

    if (saveBtn.dataset.trv2Saving === 'true') {
      saveBtn.disabled = true;
      if (hint) {
        hint.textContent = 'Saving assignment...';
        hint.classList.remove('error');
      }
      return;
    }

    saveBtn.disabled = !canSubmit;
    if (hint) {
      hint.textContent = message;
      if (isError) hint.classList.add('error');
      else hint.classList.remove('error');
    }
  }

  function ensureAssignmentModalBindings() {
    const modal = document.getElementById('teacherAssignmentModal');
    if (!modal) return;
    if (modal.dataset.trv2ModalBound === 'true') return;

    modal.dataset.trv2ModalBound = 'true';

    const closeBtn = document.getElementById('closeTeacherAssignmentModal');
    const cancelBtn = document.getElementById('assignTeacherCancelBtn');
    const form = document.getElementById('teacherAssignmentForm');
    const roleNode = document.getElementById('assignRole');
    const advisorySelect = document.getElementById('assignAdvisorySection');
    const selectedIdsInput = document.getElementById('selectedAdviserSectionIds');
    const saveBtn = document.getElementById('assignTeacherSaveBtn');

    if (closeBtn) {
      closeBtn.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        closeAssignmentModalHard();
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        closeAssignmentModalHard();
      });
    }

    modal.addEventListener('click', function (event) {
      if (event.target === modal) {
        closeAssignmentModalHard();
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && isAssignmentModalVisible()) {
        closeAssignmentModalHard();
      }
    });

    if (roleNode) {
      roleNode.addEventListener('change', updateAssignmentModalUXState);
    }

    if (advisorySelect) {
      advisorySelect.addEventListener('change', updateAssignmentModalUXState);
    }

    if (selectedIdsInput) {
      selectedIdsInput.addEventListener('input', updateAssignmentModalUXState);
      selectedIdsInput.addEventListener('change', updateAssignmentModalUXState);
    }

    if (form && saveBtn && form.dataset.trv2SubmitBound !== 'true') {
      form.dataset.trv2SubmitBound = 'true';
      const resetSavingState = function () {
        saveBtn.dataset.trv2Saving = 'false';
        saveBtn.disabled = false;
        saveBtn.textContent = 'Confirm Assignment';
        updateAssignmentModalUXState();
      };

      const resolveSubmitHandler = function () {
        if (typeof window.submitTeacherRoleAssignment === 'function') {
          return window.submitTeacherRoleAssignment;
        }
        if (typeof globalThis.submitTeacherRoleAssignment === 'function') {
          return globalThis.submitTeacherRoleAssignment;
        }
        return null;
      };

      form.addEventListener('submit', function (event) {
        event.preventDefault();
        event.stopPropagation();

        if (saveBtn.dataset.trv2Saving === 'true') {
          return;
        }

        saveBtn.dataset.trv2Saving = 'true';
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
        updateAssignmentModalUXState();

        const submitHandler = resolveSubmitHandler();
        if (!submitHandler) {
          if (typeof window.showNotification === 'function') {
            window.showNotification('Assignment submit handler is unavailable. Please refresh.', 'error');
          }
          resetSavingState();
          return;
        }

        let watchdog = null;
        try {
          watchdog = setTimeout(function () {
            if (saveBtn.dataset.trv2Saving === 'true') {
              if (typeof window.showNotification === 'function') {
                window.showNotification('Assignment request timed out. Please try again.', 'error');
              }
              resetSavingState();
            }
          }, 15000);

          Promise.resolve(submitHandler())
            .catch(function (err) {
              console.error('[TeacherRegistrationV2] submitTeacherRoleAssignment failed:', err);
              if (typeof window.showNotification === 'function') {
                window.showNotification('Failed to submit assignment.', 'error');
              }
              resetSavingState();
            })
            .finally(function () {
              if (watchdog) clearTimeout(watchdog);
              if (saveBtn.dataset.trv2Saving === 'true') {
                resetSavingState();
              }
            });
        } catch (err) {
          console.error('[TeacherRegistrationV2] submit handler execution error:', err);
          if (watchdog) clearTimeout(watchdog);
          resetSavingState();
        }
      });

      if (saveBtn.dataset.trv2ClickBound !== 'true') {
        saveBtn.dataset.trv2ClickBound = 'true';
        saveBtn.addEventListener('click', function (event) {
          event.preventDefault();
          event.stopPropagation();
          if (saveBtn.dataset.trv2Saving === 'true') return;
          form.requestSubmit();
        });
      }
    }

    updateAssignmentModalUXState();
  }

  function openAssignFromId(rawTeacherId) {
    if (rawTeacherId == null || rawTeacherId === '') return;

    syncLegacyTeacherStores();

    const teacher = STATE.allTeachers.find(function (item) {
      return String(item.id || item.teacher_id || item.user_id) === String(rawTeacherId);
    }) || (window.allTeachers || []).find(function (item) {
      return String(item.id || item.teacher_id || item.user_id) === String(rawTeacherId);
    });

    if (typeof window.openTeacherAssignmentModal !== 'function') {
      if (teacher) {
        forceOpenAssignmentModal(teacher);
        return;
      }

      if (typeof window.showNotification === 'function') {
        window.showNotification('Assignment modal is not ready yet.', 'warning');
      }
      return;
    }

    try {
      const normalizedId = Number(rawTeacherId);
      if (Number.isFinite(normalizedId)) {
        window.openTeacherAssignmentModal(normalizedId);
      } else {
        window.openTeacherAssignmentModal(rawTeacherId);
      }
    } catch (_error) {
      if (teacher) {
        forceOpenAssignmentModal(teacher);
      }
      return;
    }

    if (!isAssignmentModalVisible() && teacher) {
      forceOpenAssignmentModal(teacher);
    }

    setTimeout(function () {
      ensureAssignmentModalBindings();
      updateAssignmentModalUXState();
    }, 0);
  }

  function bindControls() {
    const searchInput = document.getElementById('teacherSearchInput');
    const roleFilter = document.getElementById('teacherRoleFilter');
    const sortBy = document.getElementById('teacherSortBy');
    const refreshBtn = document.getElementById('teacherRefreshBtn');

    if (searchInput && searchInput.dataset.trv2Bound !== 'true') {
      searchInput.dataset.trv2Bound = 'true';
      searchInput.addEventListener('input', applyFiltersAndRender);
    }

    if (roleFilter && roleFilter.dataset.trv2Bound !== 'true') {
      roleFilter.dataset.trv2Bound = 'true';
      roleFilter.addEventListener('change', applyFiltersAndRender);
    }

    if (sortBy && sortBy.dataset.trv2Bound !== 'true') {
      sortBy.dataset.trv2Bound = 'true';
      sortBy.addEventListener('change', applyFiltersAndRender);
    }

    if (refreshBtn && refreshBtn.dataset.trv2Bound !== 'true') {
      refreshBtn.dataset.trv2Bound = 'true';
      refreshBtn.addEventListener('click', function () {
        loadTeachersForAdminV2(true);
      });
    }

    bindActionHandlers();
  }

  async function loadTeachersForAdminV2(force) {
    const section = document.getElementById('teacher-registration');
    if (!section) return;

    if (!STATE.initialized || force) {
      renderTeacherRegistrationShell();
      bindControls();
      STATE.initialized = true;
    }

    STATE.loading = true;
    renderTeacherRows();

    try {
      let teachers;
      try {
        teachers = await promiseWithTimeout(fetchTeachers(), REQUEST_TIMEOUT_MS + 3000, 'Teacher loader timed out');
      } catch (primaryErr) {
        console.warn('[TeacherRegistrationV2] Primary fetch path failed, trying emergency path:', primaryErr);
        teachers = await fetchTeachersEmergency();
      }

      STATE.allTeachers = teachers.map(function (teacher) {
        const normalized = Object.assign({}, teacher);
        normalized.role = normalizeRole(teacher.role);
        return normalized;
      });
      syncLegacyTeacherStores();

      applyFiltersAndRender();

      if (typeof window.showNotification === 'function' && force) {
        window.showNotification('Teachers refreshed successfully.', 'success');
      }
    } catch (error) {
      console.error('[TeacherRegistrationV2] Load failed:', error);
      STATE.allTeachers = [];
      STATE.filteredTeachers = [];
      syncLegacyTeacherStores();
      showError('Failed to load teachers. Please try again.');

      if (typeof window.showNotification === 'function') {
        window.showNotification('Failed to load teachers.', 'error');
      }
    } finally {
      STATE.loading = false;
    }
  }

  function activateIfTeacherSectionVisible() {
    const section = document.getElementById('teacher-registration');
    if (!section) return;

    const isVisible = !section.classList.contains('hidden') || section.style.display === 'block';
    if (isVisible) {
      loadTeachersForAdminV2(false);
    }
  }

  function installSectionActivationHooks() {
    if (document.body.dataset.trv2NavHooked === 'true') return;
    document.body.dataset.trv2NavHooked = 'true';

    document.addEventListener('click', function (event) {
      const trigger = event.target && event.target.closest
        ? event.target.closest('[data-section="teacher-registration"], #teacherRegistrationLink, #teacher-registration-link')
        : null;

      if (!trigger) return;

      setTimeout(function () {
        loadTeachersForAdminV2(false);
      }, 0);
    });
  }

  function installGlobalOverrides() {
    window.loadTeachersForAdminV2 = loadTeachersForAdminV2;
    window.trv2OpenAssignFromId = openAssignFromId;
    window.trv2RefreshTeacherTable = function () {
      applyFiltersAndRender();
    };

    window.loadTeachersForAdmin = function () {
      return loadTeachersForAdminV2(false);
    };

    window.filterTeachers = function () {
      applyFiltersAndRender();
    };

    window.renderTeachersTable = function () {
      renderTeacherRows();
    };

    window.trv2CloseAssignmentModal = closeAssignmentModalHard;
    window.trv2UpdateAssignmentModalState = updateAssignmentModalUXState;
  }

  function bootstrap() {
    installGlobalOverrides();
    installSectionActivationHooks();
    ensureAssignmentModalBindings();
    updateAssignmentModalUXState();
    activateIfTeacherSectionVisible();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();



