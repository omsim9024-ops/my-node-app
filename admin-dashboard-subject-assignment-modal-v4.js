(function subjectAssignmentModalV4() {
  const state = {
    teacher: null,
    sections: [],
    allowedGrades: ['7', '8', '9', '10'],
    saving: false
  };

  const SHS_CORE_SUBJECTS = [
    'Effective Communication / Mabisang Komunikasyon',
    'Life Skills',
    'Pag-aaral ng Kasaysayan at Lipunang Pilipino',
    'General Mathematics',
    'General Science'
  ];

  const JHS_SUBJECTS = ['Mathematics', 'Science', 'English', 'Filipino', 'Araling Panlipunan', 'MAPEH', 'TLE', 'ESP'];

  function notify(message, type) {
    if (typeof window.showNotification === 'function') {
      window.showNotification(message, type || 'info');
      return;
    }
    console.log('[SubjectModalV4]', type || 'info', message);
  }

  function resolveSchoolCode() {
    try {
      const params = new URLSearchParams(window.location.search || '');
      const fromQuery = String(params.get('school') || params.get('tenant') || params.get('code') || '').trim().toLowerCase();
      if (fromQuery) return fromQuery;
    } catch (_err) {}

    try {
      return String(localStorage.getItem('sms.selectedSchoolCode') || localStorage.getItem('sms.selectedTenantCode') || '').trim().toLowerCase();
    } catch (_err) {
      return '';
    }
  }

  async function requestApi(path, options) {
    const requestOptions = options || {};
    if (typeof window.apiFetch === 'function') {
      try {
        return await window.apiFetch(path, requestOptions);
      } catch (_err) {
        // fallback to direct fetch below
      }
    }

    const schoolCode = resolveSchoolCode();
    const token = String(localStorage.getItem('adminAuthToken') || '').trim();
    const url = new URL(path, window.location.origin);
    if (schoolCode) {
      url.searchParams.set('school', schoolCode);
    }

    const headers = {
      ...(requestOptions.headers || {}),
      ...(schoolCode ? { 'x-tenant-code': schoolCode } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    return fetch(`${url.pathname}${url.search}`, {
      credentials: 'include',
      ...requestOptions,
      headers
    });
  }

  function normalizeTeacherLevel(teacher) {
    if (typeof window.detectTeacherLevel === 'function') {
      try {
        const level = String(window.detectTeacherLevel(teacher) || '').toLowerCase();
        if (level.includes('shs') || level.includes('senior')) return 'shs';
        if (level.includes('jhs') || level.includes('junior')) return 'jhs';
      } catch (_err) {}
    }

    const department = String(teacher?.department || '').toLowerCase();
    if (department.includes('senior') || department.includes('shs')) return 'shs';
    return 'jhs';
  }

  function findTeacher(rawTeacherId) {
    const id = String(rawTeacherId || '').trim();
    const teachers = Array.isArray(window.allTeachers) ? window.allTeachers : [];
    return teachers.find(function (teacher) {
      const teacherId = String(teacher?.id ?? teacher?.teacher_id ?? teacher?.user_id ?? '').trim();
      return teacherId && teacherId === id;
    }) || null;
  }

  function normalizeSections(sections) {
    return (Array.isArray(sections) ? sections : []).map(function (section) {
      const id = Number(section?.id ?? section?.section_id ?? section?.sectionId);
      const gradeRaw = section?.grade_level ?? section?.gradeLevel ?? section?.grade ?? section?.year_level ?? section?.level ?? '';
      const gradeText = String(gradeRaw || '').trim();
      const gradeMatch = gradeText.match(/(\d{1,2})/);
      const grade = gradeMatch ? gradeMatch[1] : gradeText;

      let electives = section?.electives ?? section?.elective_subjects ?? section?.electiveSubjects ?? [];
      if (typeof electives === 'string') {
        electives = electives.split(',').map(function (value) { return String(value || '').trim(); }).filter(Boolean);
      }
      if (!Array.isArray(electives)) electives = [];

      return {
        id,
        grade,
        name: String(section?.section_name || section?.name || section?.section_code || ('Section ' + id)),
        code: String(section?.section_code || section?.section_name || ''),
        electives
      };
    }).filter(function (item) {
      return Number.isFinite(item.id) && item.id > 0;
    });
  }

  function extractSectionsFromPayload(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.sections)) return payload.sections;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.rows)) return payload.rows;
    return [];
  }

  async function ensureSections() {
    const cached = normalizeSections(window._sectionsCache || window.allSectionsForAdvisory || []);
    if (cached.length > 0) {
      state.sections = cached;
      return cached;
    }

    try {
      if (typeof window.loadSectionsForAssignment === 'function') {
        const loaded = await window.loadSectionsForAssignment();
        const normalized = normalizeSections(extractSectionsFromPayload(loaded).length ? extractSectionsFromPayload(loaded) : (window._sectionsCache || []));
        if (normalized.length > 0) {
          state.sections = normalized;
          return normalized;
        }
      }
    } catch (_err) {}

    try {
      const schoolYearId = await resolveSchoolYearId();
      // if we have an active year then only load sections for that year; do not fall
      // back to the global endpoint since it may return sections from other years.
      if (schoolYearId) {
        try {
          const response = await requestApi('/api/sections/by-school-year/' + Number(schoolYearId));
          if (response.ok) {
            const payload = await response.json();
            const normalized = normalizeSections(extractSectionsFromPayload(payload));
            state.sections = normalized;
            return normalized;
          }
        } catch (_innerErr) {
          // if the year-specific request fails, we still prefer to return empty
          // rather than showing unrelated sections
          state.sections = [];
          return [];
        }
      } else {
        // no active school year; fall back to global list
        const response = await requestApi('/api/sections');
        if (response.ok) {
          const payload = await response.json();
          const normalized = normalizeSections(extractSectionsFromPayload(payload));
          state.sections = normalized;
          return normalized;
        }
      }
    } catch (_err) {}

    return [];
  }

  async function resolveSchoolYearId() {
    const existing = Number(window.activeSchoolYearId || 0);
    if (existing > 0) return existing;

    try {
      if (typeof window.loadActiveSchoolYearForAssignment === 'function') {
        await window.loadActiveSchoolYearForAssignment();
        const loaded = Number(window.activeSchoolYearId || 0);
        if (loaded > 0) return loaded;
      }
    } catch (_err) {}

    try {
      const response = await requestApi('/api/school-years/active');
      if (!response.ok) return null;
      const payload = await response.json();
      const active = payload?.active || payload;
      const resolved = Number(active?.id || active?.school_year_id || active?.schoolYearId || 0);
      if (resolved > 0) {
        window.activeSchoolYearId = resolved;
        return resolved;
      }
    } catch (_err) {}

    return null;
  }

  function modalElements() {
    return {
      modal: document.getElementById('subjectAssignmentModal'),
      form: document.getElementById('subjectAssignmentForm'),
      teacherId: document.getElementById('subjectAssignTeacherId'),
      teacherName: document.getElementById('subjectAssignTeacherName'),
      teacherEmail: document.getElementById('subjectAssignTeacherEmail'),
      addRow: document.getElementById('subjectAddRowBtn'),
      cancel: document.getElementById('subjectAssignCancelBtn'),
      save: document.getElementById('subjectAssignSaveBtn'),
      close: document.getElementById('closeSubjectAssignmentModal'),
      container: document.getElementById('subjectModalSubjectLoadsContainer')
    };
  }

  function setModalVisible(open) {
    const els = modalElements();
    if (!els.modal) return;
    els.modal.setAttribute('aria-hidden', open ? 'false' : 'true');
    els.modal.style.display = open ? 'flex' : 'none';
    els.modal.style.pointerEvents = open ? 'auto' : 'none';
  }

  function setSaving(isSaving) {
    state.saving = !!isSaving;
    const els = modalElements();
    if (!els.save) return;
    els.save.disabled = !!isSaving;
    els.save.textContent = isSaving ? 'Saving...' : 'Save';
  }

  function filteredSectionsForGrade(grade) {
    const normalizedGrade = String(grade || '').trim();
    const allowed = state.allowedGrades;

    let list = state.sections.slice();
    if (normalizedGrade) {
      list = list.filter(function (section) { return String(section.grade) === normalizedGrade; });
      if (!list.length) {
        list = state.sections.slice();
      }
    } else if (Array.isArray(allowed) && allowed.length > 0) {
      list = list.filter(function (section) {
        return !section.grade || allowed.includes(String(section.grade));
      });
      if (!list.length) {
        list = state.sections.slice();
      }
    }

    return list;
  }

  async function buildSubjectsForSelection(grade, sectionId) {
    const numericGrade = Number(String(grade || '').trim());
    const isShs = numericGrade >= 11;

    if (!isShs) {
      return Array.from(new Set(JHS_SUBJECTS)).sort();
    }

    let electives = [];
    const section = state.sections.find(function (entry) {
      return Number(entry.id) === Number(sectionId);
    });
    if (section && Array.isArray(section.electives)) {
      electives = section.electives.slice();
    }

    if (Number(sectionId) > 0) {
      try {
        const response = await window.apiFetch('/api/electives/section/' + Number(sectionId));
        if (response.ok) {
          const payload = await response.json();
          const list = Array.isArray(payload)
            ? payload
            : (Array.isArray(payload?.electives) ? payload.electives : []);
          const fromApi = list.map(function (item) {
            return String(item?.subject_name || item?.name || item?.subject || '').trim();
          }).filter(Boolean);
          if (fromApi.length > 0) electives = fromApi;
        }
      } catch (_err) {}
    }

    return Array.from(new Set([].concat(SHS_CORE_SUBJECTS, electives))).filter(Boolean).sort();
  }

  function createSelect(className, minWidth) {
    const select = document.createElement('select');
    select.className = className;
    select.style.padding = '10px';
    select.style.border = '1px solid rgba(148,163,184,.4)';
    select.style.borderRadius = '8px';
    select.style.minWidth = minWidth;
    select.style.background = 'rgba(15,23,42,.35)';
    select.style.color = '#fff';
    return select;
  }

  function addOption(select, label, value) {
    const opt = new Option(label, value);
    select.appendChild(opt);
  }

  function createSubjectRow(initial) {
    const els = modalElements();
    if (!els.container) return null;

    const row = document.createElement('div');
    row.className = 'ta-subject-row';
    row.style.display = 'grid';
    row.style.gridTemplateColumns = '140px 1fr 1fr auto';
    row.style.gap = '10px';
    row.style.alignItems = 'center';
    row.style.marginBottom = '10px';

    const gradeSelect = createSelect('ta-subject-grade', '120px');
    addOption(gradeSelect, '-- Grade --', '');
    state.allowedGrades.forEach(function (grade) {
      addOption(gradeSelect, 'Grade ' + grade, grade);
    });

    const sectionSelect = createSelect('ta-subject-sections', '220px');
    addOption(sectionSelect, '-- Section --', '');

    const subjectSelect = createSelect('ta-subject-subject', '220px');
    addOption(subjectSelect, '-- Subject --', '');

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn btn-secondary';
    removeBtn.textContent = 'Remove';
    removeBtn.style.minWidth = '92px';

    const fillSections = function (grade, preferredSection) {
      sectionSelect.innerHTML = '';
      addOption(sectionSelect, '-- Section --', '');
      const list = filteredSectionsForGrade(grade);
      list.forEach(function (section) {
        addOption(sectionSelect, section.name, String(section.id));
      });
      if (preferredSection && list.some(function (section) { return String(section.id) === String(preferredSection); })) {
        sectionSelect.value = String(preferredSection);
      }
    };

    const fillSubjects = async function (grade, sectionId, preferredSubject) {
      subjectSelect.innerHTML = '';
      addOption(subjectSelect, '-- Subject --', '');
      const list = await buildSubjectsForSelection(grade, sectionId);
      list.forEach(function (subject) {
        addOption(subjectSelect, subject, subject);
      });
      if (preferredSubject && list.includes(preferredSubject)) {
        subjectSelect.value = preferredSubject;
      }
    };

    gradeSelect.addEventListener('change', async function () {
      fillSections(gradeSelect.value, '');
      await fillSubjects(gradeSelect.value, '', '');
    });

    sectionSelect.addEventListener('change', async function () {
      await fillSubjects(gradeSelect.value, sectionSelect.value, subjectSelect.value || '');
    });

    removeBtn.addEventListener('click', function () {
      row.remove();
      if (!els.container.querySelector('.ta-subject-row')) {
        els.container.innerHTML = '<p class="no-data">No subject rows added. Click "+ Add Subject Row" to begin.</p>';
      }
    });

    row.appendChild(gradeSelect);
    row.appendChild(sectionSelect);
    row.appendChild(subjectSelect);
    row.appendChild(removeBtn);

    els.container.appendChild(row);

    const initialGrade = String(initial?.grade || '').match(/(\d{1,2})/)?.[1] || '';
    const initialSection = Number(initial?.section_id || initial?.sectionId || (Array.isArray(initial?.sections) ? initial.sections[0] : 0)) || '';
    const initialSubject = String(initial?.subject || '').trim();

    if (initialGrade) gradeSelect.value = initialGrade;
    fillSections(gradeSelect.value || initialGrade || '', initialSection);
    fillSubjects(gradeSelect.value || initialGrade || '', sectionSelect.value || initialSection, initialSubject);

    return row;
  }

  function collectRows() {
    const els = modalElements();
    if (!els.container) return [];
    const rows = Array.from(els.container.querySelectorAll('.ta-subject-row'));
    const loads = [];

    rows.forEach(function (row) {
      const grade = row.querySelector('.ta-subject-grade')?.value || '';
      const sectionRaw = row.querySelector('.ta-subject-sections')?.value || '';
      const subject = String(row.querySelector('.ta-subject-subject')?.value || '').trim();
      const sectionId = Number(sectionRaw);

      if (!grade || !subject || !Number.isFinite(sectionId) || sectionId <= 0) return;
      loads.push({ subject: subject, sections: [sectionId] });
    });

    return loads;
  }

  async function loadExistingAssignments(teacherId, schoolYearId) {
    const response = await requestApi('/api/teacher-auth/subject-assignments/' + teacherId);
    if (!response.ok) return [];

    const payload = await response.json();
    const assignments = Array.isArray(payload?.assignments) ? payload.assignments : [];
    const targetYear = Number(schoolYearId || 0);

    if (!targetYear) return assignments;
    return assignments.filter(function (assignment) {
      return Number(assignment?.school_year_id || 0) === targetYear;
    });
  }

  function countSubmittedPairs(loads) {
    const set = new Set();
    (Array.isArray(loads) ? loads : []).forEach(function (load) {
      const subject = String(load?.subject || '').trim().toLowerCase();
      const sections = Array.isArray(load?.sections) ? load.sections : [];
      sections.forEach(function (sid) {
        const sectionId = Number(sid);
        if (subject && sectionId > 0) set.add(subject + '::' + sectionId);
      });
    });
    return set.size;
  }

  async function saveAssignments() {
    if (state.saving) return;

    const els = modalElements();
    const teacherId = Number(els.teacherId?.value || 0);
    if (!teacherId) {
      notify('No teacher selected', 'error');
      return;
    }

    const schoolYearId = await resolveSchoolYearId();
    if (!schoolYearId) {
      notify('No active school year found. Please activate a school year first.', 'error');
      return;
    }

    const loads = collectRows();
    if (!loads.length) {
      notify('Please add at least one valid subject assignment row.', 'error');
      return;
    }

    const role = String(state.teacher?.role || 'Subject Teacher');
    const payload = {
      teacher_id: teacherId,
      role,
      sections: [],
      subject_loads: loads,
      school_year_id: Number(schoolYearId)
    };

    setSaving(true);
    try {
      const response = await requestApi('/api/teacher-auth/assign-role', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(function () { return {}; });
        throw new Error(errorPayload?.error || ('Failed to save (HTTP ' + response.status + ')'));
      }

      const responseData = await response.json().catch(function () { return {}; });

      let savedAssignments = Array.isArray(responseData?.subject_assignments)
        ? responseData.subject_assignments
        : [];

      if (!savedAssignments.length) {
        savedAssignments = await loadExistingAssignments(teacherId, schoolYearId);
      }

      const storedCountFromApi = Number(responseData?.subject_assignments_saved || 0);
      const storedCount = storedCountFromApi > 0 ? storedCountFromApi : savedAssignments.length;
      const expectedCount = countSubmittedPairs(loads);

      if (expectedCount > 0 && storedCount === 0) {
        throw new Error('Save failed: no assignments were stored in the database.');
      }

      notify('Saved successfully. Verified ' + storedCount + ' stored assignment' + (storedCount === 1 ? '' : 's') + '.', 'success');
      if (storedCount !== expectedCount) {
        notify('Verification mismatch: submitted ' + expectedCount + ', stored ' + storedCount + '.', 'warning');
      }

      try {
        if (typeof window.__ta2ApplyAssignments === 'function') {
          window.__ta2ApplyAssignments(teacherId, savedAssignments);
        }
      } catch (_err) {}

      if (typeof window.loadTeachersForAdmin === 'function') {
        await window.loadTeachersForAdmin();
      }
      if (typeof window.loadTeachingAssignmentsV2 === 'function') {
        await window.loadTeachingAssignmentsV2();
      }
      if (typeof window.renderTeachingAssignmentsTeacherTables === 'function') {
        try { window.renderTeachingAssignmentsTeacherTables(); } catch (_err) {}
      }

      setModalVisible(false);
    } catch (err) {
      notify(err?.message || 'Failed to save assignments', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function openModal(teacherId) {
    const teacher = findTeacher(teacherId);
    if (!teacher) {
      notify('Teacher not found', 'error');
      return;
    }

    state.teacher = teacher;
    state.allowedGrades = normalizeTeacherLevel(teacher) === 'shs' ? ['11', '12'] : ['7', '8', '9', '10'];

    await ensureSections();
    if ((!state.sections || !state.sections.length) && Array.isArray(teacher?.assigned_sections) && teacher.assigned_sections.length > 0) {
      const fromTeacher = normalizeSections(teacher.assigned_sections);
      if (fromTeacher.length > 0) {
        state.sections = fromTeacher;
      }
    }
    const schoolYearId = await resolveSchoolYearId();

    const els = modalElements();
    if (!els.modal || !els.container) {
      notify('Assign Subjects modal is not available.', 'error');
      return;
    }

    if (els.teacherId) els.teacherId.value = String(teacher.id ?? teacher.teacher_id ?? teacherId);
    if (els.teacherName) els.teacherName.textContent = String(teacher.name || teacher.full_name || '--');
    if (els.teacherEmail) els.teacherEmail.textContent = String(teacher.email || '--');

    els.container.innerHTML = '<p class="no-data">Loading assignments...</p>';

    let assignments = [];
    try {
      assignments = await loadExistingAssignments(teacher.id ?? teacher.teacher_id ?? teacherId, schoolYearId);
    } catch (_err) {
      assignments = [];
    }

    els.container.innerHTML = '';
    if (!state.sections.length) {
      els.container.innerHTML = '<p class="no-data">No sections available for this school. Please create sections first.</p>';
      setModalVisible(true);
      return;
    }

    if (!assignments.length) {
      createSubjectRow({ grade: state.allowedGrades[0] });
    } else {
      assignments.forEach(function (assignment) {
        createSubjectRow({
          grade: assignment.grade || assignment.grade_level,
          section_id: assignment.section_id,
          subject: assignment.subject
        });
      });
    }

    setModalVisible(true);
  }

  function enhanceModalUx() {
    const els = modalElements();
    if (!els.modal) return;

    els.modal.classList.add('subject-modal-v4');
    const content = els.modal.querySelector('.modal-content');
    if (content) {
      content.style.maxWidth = '860px';
      content.style.width = '95%';
      content.style.borderRadius = '16px';
    }

    const styleId = 'subject-modal-v4-style';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .subject-modal-v4 .modal-content { box-shadow: 0 20px 55px rgba(2,6,23,.55); }
      .subject-modal-v4 .modal-header h2 { font-size: 28px; font-weight: 700; }
      .subject-modal-v4 .modal-body { padding-top: 14px; }
      .subject-modal-v4 .form-actions { justify-content: flex-end; gap: 10px; }
      .subject-modal-v4 #subjectModalSubjectLoadsContainer { max-height: 46vh; overflow: auto; padding-right: 6px; }
      .subject-modal-v4 .ta-subject-row { padding: 6px 2px; border-bottom: 1px solid rgba(148,163,184,.18); }
      .subject-modal-v4 .ta-subject-row:last-child { border-bottom: 0; }
      @media (max-width: 860px) {
        .subject-modal-v4 .ta-subject-row { grid-template-columns: 1fr; }
      }
    `;
    document.head.appendChild(style);
  }

  function bindControls() {
    const els = modalElements();
    if (!els.modal) return;

    const addRowHandler = function (event) {
      event.preventDefault();
      const container = modalElements().container;
      if (container && container.querySelector('.no-data')) container.innerHTML = '';
      createSubjectRow({ grade: state.allowedGrades[0] });
    };

    const closeHandler = function (event) {
      if (event) event.preventDefault();
      setModalVisible(false);
    };

    const saveHandler = function (event) {
      if (event) event.preventDefault();
      saveAssignments();
    };

    if (els.addRow) {
      els.addRow.onclick = addRowHandler;
    }
    if (els.cancel) {
      els.cancel.onclick = closeHandler;
    }
    if (els.close) {
      els.close.onclick = closeHandler;
    }
    if (els.form) {
      els.form.onsubmit = saveHandler;
    }
    if (els.save) {
      els.save.onclick = saveHandler;
    }
  }

  function bindHardSaveInterceptors() {
    if (window.__subjectModalV4HardSaveBound) return;
    window.__subjectModalV4HardSaveBound = true;

    document.addEventListener('click', function (event) {
      const saveBtn = event.target && typeof event.target.closest === 'function'
        ? event.target.closest('#subjectAssignSaveBtn, #subjectAssignSaveBtnSHS')
        : null;
      if (!saveBtn) return;

      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
      saveAssignments();
    }, true);

    document.addEventListener('submit', function (event) {
      const form = event.target;
      if (!form || !form.id) return;
      if (form.id !== 'subjectAssignmentForm' && form.id !== 'subjectAssignmentFormSHS') return;

      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
      saveAssignments();
    }, true);
  }

  function bootstrap() {
    const primaryModal = document.getElementById('subjectAssignmentModal');
    if (!primaryModal) return;

    enhanceModalUx();
    bindControls();
    bindHardSaveInterceptors();

    window.openSubjectAssignmentModal = function (teacherId) {
      return openModal(teacherId);
    };
    window.openSubjectAssignmentModalJHS = function (teacherId) {
      return openModal(teacherId);
    };
    window.openSubjectAssignmentModalSHS = function (teacherId) {
      return openModal(teacherId);
    };
    window.submitSubjectAssignmentsModal = function () {
      return saveAssignments();
    };
    window.submitSubjectAssignmentsModalSHS = function () {
      return saveAssignments();
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();



