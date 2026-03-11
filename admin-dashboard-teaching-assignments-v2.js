(function teachingAssignmentsV2Module() {
  const state = {
    initialized: false,
    loading: false,
    teachers: [],
    activeTab: 'jhs',
    search: '',
    role: 'all'
  };

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
        ''
      ).trim().toLowerCase();
      if (fromStorage) return fromStorage;
    } catch (_err) {}

    return '';
  }

  function withSchool(path) {
    const schoolCode = detectSchoolCode();
    if (!schoolCode) return path;
    const joiner = path.includes('?') ? '&' : '?';
    return `${path}${joiner}school=${encodeURIComponent(schoolCode)}`;
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
    return normalized.replace(/_/g, ' ').replace(/\b\w/g, function (char) { return char.toUpperCase(); });
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalizeTeachers(payload) {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.teachers)) return payload.teachers;
    if (payload.success && Array.isArray(payload.data)) return payload.data;
    if (payload.success && payload.data && Array.isArray(payload.data.teachers)) return payload.data.teachers;
    return [];
  }

  async function fetchTeachers() {
    const candidates = [
      withSchool('/api/teacher-auth/list'),
      withSchool('/api/teachers'),
      '/api/teacher-auth/list',
      '/api/teachers'
    ];

    let lastErr = null;
    for (const endpoint of candidates) {
      try {
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          credentials: 'include',
          cache: 'no-store'
        });
        if (!response.ok) {
          lastErr = new Error(`HTTP ${response.status}`);
          continue;
        }
        const payload = await response.json();
        const teachers = normalizeTeachers(payload);
        if (Array.isArray(teachers)) return teachers;
      } catch (err) {
        lastErr = err;
      }
    }

    throw lastErr || new Error('Unable to fetch teachers');
  }

  function detectTeacherLevel(teacher) {
    const sections = Array.isArray(teacher.assigned_sections) ? teacher.assigned_sections : [];
    const subjects = Array.isArray(teacher.subject_assignments) ? teacher.subject_assignments : [];
    const merged = sections.concat(subjects);

    let sawJhs = false;
    let sawShs = false;

    merged.forEach(function (entry) {
      const gradeRaw = String(entry.grade || entry.grade_level || '').trim();
      const gradeMatch = gradeRaw.match(/(\d{1,2})/);
      const grade = gradeMatch ? Number(gradeMatch[1]) : null;
      if (grade && grade >= 11) sawShs = true;
      if (grade && grade >= 7 && grade <= 10) sawJhs = true;

      const sectionCode = String(entry.section_code || '').toUpperCase();
      if (sectionCode.startsWith('SHS-')) sawShs = true;
      if (sectionCode.startsWith('JHS-')) sawJhs = true;
    });

    if (sawShs && !sawJhs) return 'shs';
    if (sawJhs && !sawShs) return 'jhs';
    if (sawShs && sawJhs) return 'both';

    const department = String(teacher.department || '').toLowerCase();
    if (department.includes('senior') || department.includes('shs')) return 'shs';
    return 'jhs';
  }

  function ensureShell() {
    const root = document.getElementById('teachingAssignmentsV2Root');
    if (!root || state.initialized) return;

    root.innerHTML = `
      <div class="content-card">
        <div style="display:flex;gap:8px;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <input id="ta2Search" type="search" placeholder="Search teachers (name, email, dept)" style="padding:8px 10px;border:1px solid #ddd;border-radius:6px;min-width:260px;" />
            <select id="ta2RoleFilter" style="padding:8px;border:1px solid #ddd;border-radius:6px;">
              <option value="all">All Roles</option>
              <option value="adviser">Adviser</option>
              <option value="subject_teacher">Subject Teacher</option>
              <option value="administrator">Administrator</option>
              <option value="unassigned">Unassigned</option>
            </select>
            <button id="ta2Refresh" class="btn btn-secondary">Refresh</button>
          </div>

          <div style="display:flex;gap:8px;align-items:center;">
            <button id="ta2TabJhs" class="btn btn-tertiary active">Junior High</button>
            <button id="ta2TabShs" class="btn btn-tertiary">Senior High</button>
            <span id="ta2Count" style="font-weight:600;color:#666;">0 teachers</span>
          </div>
        </div>

        <div id="ta2Status" style="font-size:13px;color:#64748b;margin-bottom:10px;"></div>

        <div class="table-container" style="overflow:auto;">
          <table class="table">
            <thead>
              <tr>
                <th>Teacher ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Department</th>
                <th>Role</th>
                <th>Assigned Sections</th>
                <th>Teaching Assignments</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="ta2Body">
              <tr><td colspan="8" class="no-data">Loading teachers...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    bindControls();
    state.initialized = true;
  }

  function buildAssignmentsHtml(teacher) {
    const assignments = Array.isArray(teacher.subject_assignments) ? teacher.subject_assignments : [];
    if (!assignments.length) return '<span style="color:#999;">--</span>';

    // prepare cache for fallback
    const cached = (window._sectionsCache || []).map(function(s){
      return {
        id: String(s.id || s.section_id || s.sectionId || ''),
        name: s.section_name || s.name || s.section_code || '',
        grade: String(s.grade_level || s.grade || s.level || '')
      };
    });

    return assignments.map(function (entry) {
      const subject = escapeHtml(entry.subject || entry.subject_name || 'Unknown');
      let sectionText = '';

      // try direct fields first
      if (entry.section_name) sectionText = entry.section_name;
      if (!sectionText && entry.section_code) sectionText = entry.section_code;

      // if still empty and we have an id, attempt cache lookup
      if (entry.section_id) {
        const found = cached.find(s => s.id === String(entry.section_id));
        if (found) {
          sectionText = found.name || '';
          if (found.grade) sectionText = `Grade ${found.grade} – ${sectionText}`;
        }
      }

      // final generic fallback if nothing else
      if (!sectionText) sectionText = 'Section';

      // if we're still using a placeholder, fire off async fetch to get real label
      if (entry.section_id && /^Section(\s|$)/.test(sectionText)) {
        (async function fetchAndUpdate(secId, currentText){
            try {
                const base = (typeof API_BASE === 'string' && API_BASE) ? API_BASE : window.location.origin;
                const resp = await fetch(`${base}/api/sections/${encodeURIComponent(secId)}`);
                if (resp.ok) {
                    const sec = await resp.json();
                    let label = sec.section_name || sec.section_code || sec.name || `Section ${secId}`;
                    if (!sec.section_name && !sec.section_code && !sec.name) {
                        label += ' (deleted)';
                    }
                    const grade = sec.grade_level || sec.grade || sec.level;
                    if (grade) label = `Grade ${grade} – ${label}`;
                    if (label && label !== currentText) {
                      const cells = document.querySelectorAll(`.ta-assignment-chip[data-section-id="${secId}"]`);
                      cells.forEach(cell => { if (cell.textContent !== label) cell.textContent = label; });
                    }
                }
            } catch (_){ }
        })(entry.section_id, sectionText);
      }

      sectionText = escapeHtml(sectionText);
      return `<div style="font-size:12px;margin-bottom:4px;"><strong>${subject}</strong><div style="color:#666;font-size:11px;"><span class=\"ta-assignment-chip\" data-section-id=\"${escapeHtml(entry.section_id||entry.section||'')}\">${sectionText}</span></div></div>`;
    }).join('');
  }

  function buildSectionsHtml(teacher) {
    // some payloads use different property names
    let sections = [];
    if (Array.isArray(teacher.assigned_sections)) sections = teacher.assigned_sections;
    else if (Array.isArray(teacher.sections)) sections = teacher.sections;
    else if (Array.isArray(teacher.teaching_sections)) sections = teacher.teaching_sections;
    if (!sections.length) return '<span style="color:#999;">--</span>';

    // use cached (raw) list to resolve names when needed; normalize here
    const cached = (window._sectionsCache || []).map(function(s){
      return {
        id: String(s.id || s.section_id || s.sectionId || ''),
        name: s.section_name || s.name || s.section_code || '' ,
        grade: String(s.grade_level || s.grade || s.level || '')
      };
    });

    return sections.map(function (entry) {
      let idVal = '';
      let text = '';

      // determine id first
      if (entry && typeof entry === 'object') {
        if (entry.section_id) idVal = String(entry.section_id);
        if (entry.section_name) text = entry.section_name;
        if (entry.section_code && !text) text = entry.section_code;
      } else {
        // primitive value (number/string)
        idVal = String(entry);
      }

      // try to resolve via cache when we don't already have a human-readable label
      if (!text && idVal) {
        const found = cached.find(s => s.id === idVal);
        if (found) {
          text = found.name || `Section ${found.id}`;
          if (found.grade) text = `Grade ${found.grade} – ${text}`;
        }
      }

      // only fall back to generic placeholder as last resort
      if (!text && idVal) {
        text = `Section ${idVal}`;
      }

      // if we still have nothing, show empty state
      if (!text) text = '--';

      // trigger async fetch whenever the label is still a generic "Section" placeholder
      if (idVal && /^Section(\s|$)/.test(text)) {
        (async function fetchAndUpdate(rowId, secId){
            try {
                const base = (typeof API_BASE === 'string' && API_BASE) ? API_BASE : window.location.origin;
                const resp = await fetch(`${base}/api/sections/${encodeURIComponent(secId)}`);
                if (resp.ok) {
                    const sec = await resp.json();
                    let label = sec.section_name || sec.section_code || sec.name || `Section ${secId}`;
                    if (!sec.section_name && !sec.section_code && !sec.name) {
                        label += ' (deleted)';
                    }
                    const grade = sec.grade_level || sec.grade || sec.level;
                    if (grade) label = `Grade ${grade} – ${label}`;
                    const cell = document.querySelector(`.ta-section-chip[data-section-id="${secId}"]`);
                    if (cell && cell.textContent && cell.textContent !== label) cell.textContent = label;
                }
            } catch (_){ }
        })({}, idVal);
      }

      return `<span class="ta-section-chip" data-section-id="${escapeHtml(idVal)}">${escapeHtml(text)}</span>`;
    }).join('');
  }

  function filteredTeachersForActiveTab() {
    const query = state.search.toLowerCase().trim();
    const roleFilter = state.role;

    const list = (state.teachers || []).filter(function (teacher) {
      const name = String(teacher.name || '').toLowerCase();
      const email = String(teacher.email || '').toLowerCase();
      const dept = String(teacher.department || '').toLowerCase();
      const teacherId = String(teacher.teacher_id || '').toLowerCase();
      const role = normalizeRole(teacher.role);

      const matchesQuery = !query || `${name} ${email} ${dept} ${teacherId}`.includes(query);
      const matchesRole = roleFilter === 'all' || role === roleFilter;

      if (!matchesQuery || !matchesRole) return false;

      const level = detectTeacherLevel(teacher);
      if (state.activeTab === 'jhs') return level === 'jhs' || level === 'both';
      return level === 'shs' || level === 'both';
    });

    return list;
  }

  function renderRows() {
    const body = document.getElementById('ta2Body');
    const count = document.getElementById('ta2Count');
    if (!body) return;

    if (state.loading) {
      body.innerHTML = '<tr><td colspan="8" class="no-data">Loading teachers...</td></tr>';
      if (count) count.textContent = '0 teachers';
      return;
    }

    const teachers = filteredTeachersForActiveTab();
    if (count) count.textContent = `${teachers.length} teacher${teachers.length === 1 ? '' : 's'}`;
    // debug: log first few teachers' assigned_sections shapes
    if (teachers && teachers.length) {
        console.log('[TA2] sample assigned_sections:', teachers.slice(0,3).map(t=>({id:t.id,assigned: t.assigned_sections})));
    }

    if (!teachers.length) {
      body.innerHTML = '<tr><td colspan="8" class="no-data">No teachers found</td></tr>';
      return;
    }

    body.innerHTML = teachers.map(function (teacher) {
      const role = roleLabel(teacher.role);
      return `
        <tr>
          <td>${escapeHtml(teacher.teacher_id || '')}</td>
          <td>${escapeHtml(teacher.name || '')}</td>
          <td>${escapeHtml(teacher.email || '')}</td>
          <td>${escapeHtml(teacher.department || '--')}</td>
          <td>${escapeHtml(role)}</td>
          <td>${buildSectionsHtml(teacher)}</td>
          <td>${buildAssignmentsHtml(teacher)}</td>
          <td style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn btn-sm btn-outline-primary" data-ta2-action="subjects" data-teacher-id="${escapeHtml(teacher.id)}">Assign Subjects</button>
            <button class="btn btn-sm btn-primary" data-ta2-action="role" data-teacher-id="${escapeHtml(teacher.id)}">Assign Role</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  function setStatus(message, isError) {
    const node = document.getElementById('ta2Status');
    if (!node) return;
    node.textContent = String(message || '');
    node.style.color = isError ? '#ef4444' : '#64748b';
  }

  async function loadTeachers() {
    ensureShell();
    state.loading = true;
    setStatus('Loading teachers...', false);
    renderRows();

    try {
      const teachers = await fetchTeachers();
      // make sure we have section cache for lookups
      await ensureSectionsCache();

      state.teachers = (teachers || []).map(function (teacher) {
        const normalized = Object.assign({}, teacher);
        normalized.assigned_sections = Array.isArray(teacher.assigned_sections) ? teacher.assigned_sections
            : Array.isArray(teacher.sections) ? teacher.sections
            : Array.isArray(teacher.teaching_sections) ? teacher.teaching_sections
            : [];
        normalized.subject_assignments = Array.isArray(teacher.subject_assignments) ? teacher.subject_assignments : [];
        return normalized;
      });

      state.loading = false;
      renderRows();
      setStatus(`Loaded ${state.teachers.length} teachers.`, false);
    } catch (err) {
      state.loading = false;
      state.teachers = [];
      renderRows();
      setStatus(`Failed to load teachers${err && err.message ? ': ' + err.message : ''}`, true);
      if (typeof window.showNotification === 'function') {
        window.showNotification('Failed to load Teaching Assignments data.', 'error');
      }
    }
  }

  function openAssignRole(teacherId) {
    if (typeof window.openTeacherAssignmentModal === 'function') {
      window.openTeacherAssignmentModal(Number(teacherId));
      setTimeout(loadTeachers, 1500);
      return;
    }
    alert('Assign Role modal is not available yet.');
  }

  function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
    modal.style.display = 'none';
  }

  function normalizeSections(payload) {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.sections)) return payload.sections;
    if (Array.isArray(payload.data)) return payload.data;
    return [];
  }

  async function ensureSectionsCache() {
    const existing = (window.allSectionsForAdvisory || window._sectionsCache || []).map(function (section) {
      return {
        id: section.id ?? section.section_id ?? section.sectionId,
        section_name: section.section_name || section.name || section.section_code || '',
        section_code: section.section_code || '',
        grade: String(section.grade_level || section.grade || section.level || '').trim()
      };
    }).filter(function (section) { return section.id !== undefined && section.id !== null; });

    // do NOT bail out early; we want to refresh the cache so that inactive-year
    // sections (or any changes) are picked up. we'll merge later if needed.
    // if you really want to avoid a network call, you could check a flag here,
    // but in practice the requests are cheap and this function is called only
    // once per page load.
    // if (existing.length > 0) return existing;

    // request all sections (not just active year) so cache covers historic assignments
    const endpoints = [
      withSchool('/api/sections?activeYear=false'),
      '/api/sections?activeYear=false',
      withSchool('/api/sections'),
      '/api/sections'
    ];
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          credentials: 'include',
          cache: 'no-store'
        });
        if (!response.ok) continue;
        const payload = await response.json();
        const sections = normalizeSections(payload).map(function (section) {
          return {
            id: section.id ?? section.section_id ?? section.sectionId,
            section_name: section.section_name || section.name || section.section_code || '',
            section_code: section.section_code || '',
            grade: String(section.grade_level || section.grade || section.level || '').trim(),
            raw: section
          };
        }).filter(function (section) { return section.id !== undefined && section.id !== null; });

        if (sections.length > 0) {
          const raw = sections.map(function (entry) { return entry.raw || entry; });
          window._sectionsCache = raw;
          window.allSectionsForAdvisory = raw;
          return sections;
        }
      } catch (_err) {}
    }

    return [];
  }

  function buildFallbackSubjectRow(containerId, allowedGrades, subjectOptions, sectionsData) {
    const container = document.getElementById(containerId);
    if (!container) return null;

    if (container.querySelector('.no-data') || container.querySelector('.no-assignments-state')) {
      container.innerHTML = '';
    }

    const row = document.createElement('div');
    row.className = 'ta-subject-row';
    row.style.display = 'flex';
    row.style.gap = '8px';
    row.style.alignItems = 'center';
    row.style.marginBottom = '10px';

    const gradeSelect = document.createElement('select');
    gradeSelect.className = 'ta-subject-grade';
    gradeSelect.style.padding = '8px';
    gradeSelect.style.border = '1px solid #ddd';
    gradeSelect.style.borderRadius = '6px';
    gradeSelect.style.minWidth = '140px';
    gradeSelect.appendChild(new Option('-- Grade --', ''));
    (allowedGrades || []).forEach(function (grade) {
      gradeSelect.appendChild(new Option(`Grade ${grade}`, String(grade)));
    });

    const sectionSelect = document.createElement('select');
    sectionSelect.className = 'ta-subject-sections';
    sectionSelect.style.padding = '8px';
    sectionSelect.style.border = '1px solid #ddd';
    sectionSelect.style.borderRadius = '6px';
    sectionSelect.style.minWidth = '220px';
    sectionSelect.appendChild(new Option('-- Section --', ''));

    const cachedSections = Array.isArray(sectionsData) ? sectionsData : [];

    const normalizedAllowedGrades = (allowedGrades || []).map(function (value) {
      return String(value || '').trim();
    }).filter(Boolean);

    function populateSectionOptions(selectedGrade) {
      sectionSelect.innerHTML = '';
      sectionSelect.appendChild(new Option('-- Section --', ''));

      // convert both sides to simple numbers for matching
      const normalizedGrade = String(selectedGrade || '').trim().replace(/[^0-9]/g, '');
      let candidates = cachedSections;

      if (normalizedGrade) {
        candidates = cachedSections.filter(function (section) {
          const sectGrade = String(section.grade || '').trim().replace(/[^0-9]/g, '');
          return sectGrade === normalizedGrade;
        });
      } else if (normalizedAllowedGrades.length) {
        candidates = cachedSections.filter(function (section) {
          const grade = String(section.grade || '').trim().replace(/[^0-9]/g, '');
          return !grade || normalizedAllowedGrades.includes(grade);
        });
      }

      // only show fallback when no grade selected at all
      if (!normalizedGrade && !candidates.length && cachedSections.length) {
        sectionSelect.appendChild(new Option('-- No sections available --', ''));
        candidates = cachedSections;
      }

      // disable if a grade is selected but there are no matching sections
      if (normalizedGrade && candidates.length === 0) {
        sectionSelect.disabled = true;
        sectionSelect.appendChild(new Option('-- no sections for grade --', ''));
        return;
      } else {
        sectionSelect.disabled = false;
      }

      candidates.forEach(function (section) {
        const label = section.section_name || section.section_code || `Section ${section.id}`;
        sectionSelect.appendChild(new Option(label, String(section.id)));
      });
    }

    populateSectionOptions('');

    const subjectSelect = document.createElement('select');
    subjectSelect.className = 'ta-subject-subject';
    subjectSelect.style.padding = '8px';
    subjectSelect.style.border = '1px solid #ddd';
    subjectSelect.style.borderRadius = '6px';
    subjectSelect.style.minWidth = '240px';
    subjectSelect.appendChild(new Option('-- Select Subject --', ''));

    const subjects = Array.isArray(subjectOptions) ? subjectOptions : [];
    subjects.forEach(function (subject) {
      const value = String(subject || '').trim();
      if (!value) return;
      subjectSelect.appendChild(new Option(value, value));
    });

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn btn-sm btn-danger';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', function () {
      row.remove();
      if (!container.querySelector('.ta-subject-row')) {
        container.innerHTML = '<p class="no-data">No subject rows added. Click "+ Add Subject Row" to begin.</p>';
      }
    });

    row.appendChild(gradeSelect);
    row.appendChild(sectionSelect);
    row.appendChild(subjectSelect);
    row.appendChild(removeBtn);

    gradeSelect.addEventListener('change', function () {
      populateSectionOptions(gradeSelect.value);
    });

    container.appendChild(row);
    return row;
  }

  async function ensureSubjectRowVisible(containerId, allowedGrades, subjectOptions) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const before = container.querySelectorAll('.ta-subject-row').length;

    const sectionsData = await ensureSectionsCache();

    if (typeof window.addTeachingSubjectRow === 'function') {
      try {
        window.addTeachingSubjectRow(null, containerId, subjectOptions, allowedGrades);
      } catch (_err) {}
    }

    const after = container.querySelectorAll('.ta-subject-row').length;
    if (after <= before) {
      buildFallbackSubjectRow(containerId, allowedGrades, subjectOptions, sectionsData);
    }
  }

  function ensureSubjectModalBindings() {
    const addJhs = document.getElementById('subjectAddRowBtn');
    const cancelJhs = document.getElementById('subjectAssignCancelBtn');
    const saveJhs = document.getElementById('subjectAssignSaveBtn');
    const formJhs = document.getElementById('subjectAssignmentForm');

    if (addJhs) {
      addJhs.onclick = async function (event) {
        event.preventDefault();
        const jhsSubjects = ['Mathematics','Science','English','Filipino','Araling Panlipunan','MAPEH','TLE','ESP'];
        const subjectOptions = Array.isArray(window._subjectOptionsForModal) && window._subjectOptionsForModal.length
          ? window._subjectOptionsForModal
          : jhsSubjects;
        const allowedGrades = ['7','8','9','10'];
        await ensureSubjectRowVisible('subjectModalSubjectLoadsContainer', allowedGrades, subjectOptions);
      };
    }

    if (cancelJhs) {
      cancelJhs.onclick = function (event) {
        event.preventDefault();
        hideModal('subjectAssignmentModal');
      };
    }

    if (formJhs) {
      formJhs.onsubmit = function (event) {
        event.preventDefault();
        if (typeof window.submitSubjectAssignmentsModal === 'function') {
          window.submitSubjectAssignmentsModal();
        }
      };
    }

    if (saveJhs) {
      saveJhs.onclick = function (event) {
        event.preventDefault();
        if (typeof window.submitSubjectAssignmentsModal === 'function') {
          window.submitSubjectAssignmentsModal();
          return;
        }
        if (formJhs) formJhs.requestSubmit();
      };
    }

    const addShs = document.getElementById('subjectAddRowBtnSHS');
    const cancelShs = document.getElementById('subjectAssignCancelBtnSHS');
    const saveShs = document.getElementById('subjectAssignSaveBtnSHS');
    const formShs = document.getElementById('subjectAssignmentFormSHS');

    if (addShs) {
      addShs.onclick = async function (event) {
        event.preventDefault();
        const subjectOptions = Array.isArray(window._subjectOptionsForModal) && window._subjectOptionsForModal.length
          ? window._subjectOptionsForModal
          : (Array.isArray(window.AVAILABLE_SUBJECTS) ? window.AVAILABLE_SUBJECTS : []);
        const allowedGrades = ['11','12'];
        await ensureSubjectRowVisible('subjectModalSubjectLoadsContainerSHS', allowedGrades, subjectOptions);
      };
    }

    if (cancelShs) {
      cancelShs.onclick = function (event) {
        event.preventDefault();
        hideModal('subjectAssignmentModalSHS');
      };
    }

    if (formShs) {
      formShs.onsubmit = function (event) {
        event.preventDefault();
        if (typeof window.submitSubjectAssignmentsModalSHS === 'function') {
          window.submitSubjectAssignmentsModalSHS();
        }
      };
    }

    if (saveShs) {
      saveShs.onclick = function (event) {
        event.preventDefault();
        if (typeof window.submitSubjectAssignmentsModalSHS === 'function') {
          window.submitSubjectAssignmentsModalSHS();
          return;
        }
        if (formShs) formShs.requestSubmit();
      };
    }
  }

  function openAssignSubjects(teacherId) {
    ensureSubjectModalBindings();
    const numericTeacherId = Number(teacherId);
    const teacher = (state.teachers || []).find(function (entry) {
      return String(entry.id) === String(teacherId);
    }) || null;

    const level = detectTeacherLevel(teacher || {});
    const isShs = level === 'shs';

    const openers = [
      window.openSubjectAssignmentModal,
      globalThis.openSubjectAssignmentModal,
      isShs ? window.openSubjectAssignmentModalSHS : window.openSubjectAssignmentModalJHS,
      isShs ? globalThis.openSubjectAssignmentModalSHS : globalThis.openSubjectAssignmentModalJHS
    ].filter(function (fn) {
      return typeof fn === 'function';
    });

    if (openers.length > 0) {
      Promise.resolve(openers[0](Number.isFinite(numericTeacherId) ? numericTeacherId : teacherId))
        .then(function () { ensureSubjectModalBindings(); setTimeout(loadTeachers, 1500); })
        .catch(function () { ensureSubjectModalBindings(); setTimeout(loadTeachers, 1500); });
      return;
    }

    const modalId = isShs ? 'subjectAssignmentModalSHS' : 'subjectAssignmentModal';
    const hiddenId = isShs ? 'subjectAssignTeacherIdSHS' : 'subjectAssignTeacherId';
    const nameId = isShs ? 'subjectAssignTeacherNameSHS' : 'subjectAssignTeacherName';
    const emailId = isShs ? 'subjectAssignTeacherEmailSHS' : 'subjectAssignTeacherEmail';
    const modal = document.getElementById(modalId);

    if (modal) {
      const hiddenInput = document.getElementById(hiddenId);
      const nameNode = document.getElementById(nameId);
      const emailNode = document.getElementById(emailId);
      if (hiddenInput) hiddenInput.value = String(teacherId);
      if (nameNode && teacher) nameNode.textContent = teacher.name || '--';
      if (emailNode && teacher) emailNode.textContent = teacher.email || '--';
      modal.setAttribute('aria-hidden', 'false');
      modal.style.display = 'flex';
      modal.style.pointerEvents = 'auto';
      ensureSubjectModalBindings();
      setTimeout(loadTeachers, 1500);
      return;
    }

    alert('Assign Subjects modal is not available yet.');
  }

  function bindControls() {
    const search = document.getElementById('ta2Search');
    const role = document.getElementById('ta2RoleFilter');
    const refresh = document.getElementById('ta2Refresh');
    const tabJhs = document.getElementById('ta2TabJhs');
    const tabShs = document.getElementById('ta2TabShs');
    const body = document.getElementById('ta2Body');

    if (search) {
      search.addEventListener('input', function (event) {
        state.search = String(event.target.value || '');
        renderRows();
      });
    }

    if (role) {
      role.addEventListener('change', function (event) {
        state.role = String(event.target.value || 'all');
        renderRows();
      });
    }

    if (refresh) {
      refresh.addEventListener('click', function () {
        loadTeachers();
      });
    }

    if (tabJhs && tabShs) {
      tabJhs.addEventListener('click', function () {
        state.activeTab = 'jhs';
        tabJhs.classList.add('active');
        tabShs.classList.remove('active');
        renderRows();
      });

      tabShs.addEventListener('click', function () {
        state.activeTab = 'shs';
        tabShs.classList.add('active');
        tabJhs.classList.remove('active');
        renderRows();
      });
    }

    if (body) {
      body.addEventListener('click', function (event) {
        const trigger = event.target && event.target.closest ? event.target.closest('[data-ta2-action]') : null;
        if (!trigger) return;

        const action = trigger.getAttribute('data-ta2-action');
        const teacherId = trigger.getAttribute('data-teacher-id');
        if (!teacherId) return;

        if (action === 'role') openAssignRole(teacherId);
        if (action === 'subjects') openAssignSubjects(teacherId);
      });
    }
  }

  function sectionIsActive() {
    const section = document.getElementById('teacher-registration');
    const assignmentsPanel = document.getElementById('tr3TabAssignments');
    const panelActive = !assignmentsPanel || assignmentsPanel.classList.contains('active');
    return !!(section && section.classList.contains('active') && panelActive);
  }

  function setupSectionObserver() {
    const section = document.getElementById('teacher-registration');
    if (!section) return;

    const observer = new MutationObserver(function () {
      if (sectionIsActive()) {
        loadTeachers();
      }
    });

    observer.observe(section, { attributes: true, attributeFilter: ['class'], subtree: true });
  }

  function bootstrap() {
    ensureShell();
    setupSectionObserver();

    if (sectionIsActive()) {
      loadTeachers();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

  window.__ta2ApplyAssignments = function (teacherId, assignments) {
    const targetId = String(teacherId || '').trim();
    if (!targetId) return;

    const normalizedAssignments = Array.isArray(assignments) ? assignments : [];
    state.teachers = (state.teachers || []).map(function (teacher) {
      const rowId = String(teacher?.id ?? '').trim();
      if (rowId !== targetId) return teacher;
      return Object.assign({}, teacher, {
        subject_assignments: normalizedAssignments
      });
    });

    renderRows();
  };

  window.loadTeachingAssignmentsV2 = loadTeachers;
})();



