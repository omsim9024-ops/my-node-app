// Admin Dashboard - Section Assignment
// Handles student assignment to sections with smart validation

console.log('[Section Assignment] Initializing...');

// State management
const assignmentState = {
    currentLevel: 'JHS',
    allStudents: [],
    allSections: [],
    filteredStudents: [],
    selectedStudents: new Set(),
    selectedSection: null,
    assignedStudents: [],
    adminName: 'Admin' // Will be updated from user data
};

// Electives data (shared with enrollment form and sections)
// Use the shared global mapping on window to avoid duplicate declarations
function loadAllStudents_Fresh(callback) {
    const apiBase = window.API_BASE || '';
    console.log('[Section Assignment] Loading fresh student data from API');

    // Use enrollments as the source of truth for students
    fetch(`${apiBase}/api/enrollments`)
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then(enrollments => {
            if (!Array.isArray(enrollments)) {
                console.warn('[Section Assignment] No enrollments returned from API');
                enrollments = [];
            }

            console.log('[Section Assignment] Fresh load: Total enrollments from API:', enrollments.length);

            const students = (enrollments || [])
                .filter(e => {
                    const assigned = (e.section_id !== undefined && e.section_id !== null && String(e.section_id).trim() !== '') ||
                                     (e.class_id !== undefined && e.class_id !== null && String(e.class_id).trim() !== '');
                    return !assigned;
                })
                .map(e => {
                    const dataRaw = e.enrollment_data || {};
                    let data = dataRaw;
                    try {
                        if (typeof dataRaw === 'string' && dataRaw.trim()) data = JSON.parse(dataRaw);
                    } catch (parseErr) {
                        data = dataRaw || {};
                    }

                    const first = (data.firstName || data.firstname || '').toString().trim();
                    const last = (data.lastName || data.lastname || '').toString().trim();
                    const name = e.student_name || `${first} ${last}`.trim() || (data.fullName || data.name) || '';

                    const gradeStr = (data.gradeLevel || data.grade || e.grade || e.grade_level || '').toString();
                    const gradeNum = Number.isFinite(Number(gradeStr)) ? Number(gradeStr) : null;

                    const studentIdDisplay = data.studentID || data.studentId || data.lrn || e.student_id || (data.email || '').toString();

                    const rawId = (e.student_id !== undefined && e.student_id !== null) ? e.student_id : e.id;
                    const normalizedId = Number.isFinite(Number(rawId)) ? Number(rawId) : rawId;

                    return {
                        id: normalizedId,
                        student_id: studentIdDisplay || String(e.id || ''),
                        name: name || 'Unnamed Student',
                        first_name: first || '',
                        last_name: last || '',
                        grade_level: gradeStr || '',
                        grade: gradeNum,
                        level: (gradeNum && gradeNum >= 11) ? 'SHS' : 'JHS',
                        class_id: e.class_id || null,
                        account_status: e.account_status || 'active',
                        registration_date: e.enrollment_date || e.created_at || null,
                        gender: (data.sex || data.gender || e.gender || '').toString(),
                        track: (data.track || e.track || '').toString(),
                        elective: (data.elective || e.elective || '').toString(),
                        enrollment_status: (e.status || '').toString(),
                    };
                });

            assignmentState.allStudents = students;
            console.log(`[Section Assignment] Fresh load: ${assignmentState.allStudents.length} students loaded for level ${assignmentState.currentLevel}`);

            // Call callback for further processing (e.g., loadAssignedStudents)
            if (typeof callback === 'function') callback();
        })
        .catch(err => {
            console.error('[Section Assignment] Error loading fresh enrollments:', err);
            assignmentState.allStudents = [];
            if (typeof callback === 'function') callback();
        });
}

/**
 * Load all students from API
 */
function loadAllStudents() {
    const apiBase = window.API_BASE || '';
    console.log('[Section Assignment] Loading students (via enrollments) from:', apiBase);

    // Use enrollments as the source of truth for students (per request)
    fetch(`${apiBase}/api/enrollments`)
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then(enrollments => {
            if (!Array.isArray(enrollments)) {
                console.warn('[Section Assignment] No enrollments returned from API');
                enrollments = [];
            }

            console.log('[Section Assignment] Total enrollments from API:', enrollments.length);
            if (enrollments.length > 0) console.log('[Section Assignment] First enrollment sample:', enrollments[0]);

            // Build candidates solely from enrollments and exclude enrollments
            // already assigned (have section_id or class_id). Do not consult
            // Do not consult /api/students; build candidates from enrollments only.
            const students = (enrollments || [])
                .filter(e => {
                    const assigned = (e.section_id !== undefined && e.section_id !== null && String(e.section_id).trim() !== '') ||
                                     (e.class_id !== undefined && e.class_id !== null && String(e.class_id).trim() !== '');
                    return !assigned;
                })
                .map(e => {
                            const dataRaw = e.enrollment_data || {};
                            let data = dataRaw;
                            try {
                                if (typeof dataRaw === 'string' && dataRaw.trim()) data = JSON.parse(dataRaw);
                            } catch (parseErr) {
                                data = dataRaw || {};
                            }

                const first = (data.firstName || data.firstname || '').toString().trim();
                const last = (data.lastName || data.lastname || '').toString().trim();
                const name = e.student_name || `${first} ${last}`.trim() || (data.fullName || data.name) || '';

                const gradeStr = (data.gradeLevel || data.grade || e.grade || e.grade_level || '').toString();
                const gradeNum = Number.isFinite(Number(gradeStr)) ? Number(gradeStr) : null;

                const studentIdDisplay = data.studentID || data.studentId || data.lrn || e.student_id || (data.email || '').toString();

                // Normalize id to number when possible to match section ids and other lookups
                const rawId = (e.student_id !== undefined && e.student_id !== null) ? e.student_id : e.id;
                const normalizedId = Number.isFinite(Number(rawId)) ? Number(rawId) : rawId;

                return {
                    // Prefer numeric student table id when available
                    id: normalizedId,
                    student_id: studentIdDisplay || String(e.id || ''),
                    name: name || 'Unnamed Student',
                    first_name: first || '',
                    last_name: last || '',
                    grade_level: gradeStr || '',
                    grade: gradeNum,
                    level: (gradeNum && gradeNum >= 11) ? 'SHS' : 'JHS',
                    class_id: e.class_id || null,
                    account_status: e.account_status || 'active',
                    registration_date: e.enrollment_date || e.created_at || null,
                    gender: (data.sex || data.gender || e.gender || '').toString(),
                    track: (data.track || e.track || '').toString(),
                    elective: (data.elective || e.elective || '').toString(),
                    enrollment_status: (e.status || '').toString(),
                };
            });

                    assignmentState.allStudents = students;

                    console.log(`[Section Assignment] Loaded ${assignmentState.allStudents.length} students (from enrollments) for assignment`);

            // Defensive UI: populate list immediately then apply filters safely
            try {
                assignmentState.filteredStudents = assignmentState.allStudents.slice();
                displayStudentList();
                updateFilteredCount();
            } catch (uiErr) {
                console.error('[Section Assignment] Error populating student list (pre-filter):', uiErr);
            }

            try {
                populateElectiveFilterOptions();
            } catch (electiveErr) {
                console.error('[Section Assignment] Error populating elective filter:', electiveErr);
            }

            try {
                applyFilters();
            } catch (filterErr) {
                console.error('[Section Assignment] applyFilters threw an error:', filterErr);
                assignmentState.filteredStudents = assignmentState.allStudents.slice();
                displayStudentList();
                updateFilteredCount();
            }
        })
        .catch(err => {
            console.error('[Section Assignment] Error loading enrollments:', err);
            showAssignmentMessage('error', '❌ Failed to load enrollments. Please refresh the page.');
            assignmentState.allStudents = [];
            displayStudentList();
        });
}

/**
 * Load all sections from API
 */
function loadAllSections() {
    const apiBase = window.API_BASE || '';
    console.log('[Section Assignment] Loading sections from:', apiBase);
    
    fetch(`${apiBase}/api/sections`)
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then(sections => {
            if (!sections) {
                console.warn('[Section Assignment] No sections returned from API');
                sections = [];
            }
            
            assignmentState.allSections = sections || [];
            console.log(`[Section Assignment] Loaded ${assignmentState.allSections.length} sections`);
            
            // Populate the section selector dropdown
            populateSectionSelector();
        })
        .catch(err => {
            console.error('[Section Assignment] Error loading sections:', err);
            showAssignmentMessage('error', '❌ Failed to load sections. Please refresh the page.');
            assignmentState.allSections = [];
            populateSectionSelector();
        });
}

/**
 * Load electives from enrollment form
 */
function loadElectivesData() {
    // Electives are pre-defined or loaded from enrollment form
    if (typeof window.ELECTIVES !== 'undefined') {
        try {
            // Merge provided electives into the shared window.electivesMap
            Object.keys(window.ELECTIVES).forEach(key => {
                window.electivesMap[key] = window.ELECTIVES[key];
            });
        } catch (err) {
            console.error('[Section Assignment] Failed to merge window.ELECTIVES:', err);
        }
    }
}

/**
 * Setup level selector (JHS/SHS toggle)
 */
function setupLevelSelector() {
    const levelBtns = document.querySelectorAll('.level-btn');
    
    levelBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all
            levelBtns.forEach(b => b.classList.remove('active'));
            // Add active to clicked
            btn.classList.add('active');
            
            // Update state and filters
            assignmentState.currentLevel = btn.getAttribute('data-level');
            assignmentState.selectedStudents.clear();
            assignmentState.selectedSection = null;
            
            // Reset filter inputs when level changes
            const searchInput = document.getElementById('studentSearchInput');
            if (searchInput) searchInput.value = '';
            
            const gradeFilter = document.getElementById('assignGradeFilter');
            if (gradeFilter) gradeFilter.value = '';
            
            const trackFilter = document.getElementById('assignTrackFilter');
            if (trackFilter) trackFilter.value = '';
            
            const genderFilter = document.getElementById('assignGenderFilter');
            if (genderFilter) genderFilter.value = '';
            
            const electiveFilter = document.getElementById('assignElectiveFilter');
            if (electiveFilter) electiveFilter.value = '';
            
            // Reset UI
            updateStudentChecks();
            updateSelectedCount();
            updateSectionSelector();
            
            // Repopulate elective filter based on new level
            try {
                populateElectiveFilterOptions();
            } catch (e) {
                console.error('[Section Assignment] Error repopulating electives:', e);
            }
            
            applyFilters();
            
            // Show/hide level-specific filters
            updateFiltersForLevel();
            
            console.log(`[Section Assignment] Level changed to: ${assignmentState.currentLevel}`);
        });
    });
}

/**
 * Update filters visibility based on level
 */
function updateFiltersForLevel() {
    const trackGroup = document.getElementById('trackFilterGroup');
    const electiveGroup = document.getElementById('electiveFilterGroup');
    
    if (assignmentState.currentLevel === 'SHS') {
        if (trackGroup) trackGroup.style.display = 'block';
        if (electiveGroup) electiveGroup.style.display = 'block';
    } else {
        if (trackGroup) trackGroup.style.display = 'none';
        if (electiveGroup) electiveGroup.style.display = 'none';
    }
}

/**
 * Setup filter event listeners
 */
function setupFilters() {
    const searchInput = document.getElementById('studentSearchInput');
    const gradeFilter = document.getElementById('assignGradeFilter');
    const trackFilter = document.getElementById('assignTrackFilter');
    const genderFilter = document.getElementById('assignGenderFilter');
    const electiveFilter = document.getElementById('assignElectiveFilter');
    const resetBtn = document.getElementById('resetAssignmentFilters');
    
    console.log('[Section Assignment] setupFilters - Found elements:', {
        searchInput: !!searchInput,
        gradeFilter: !!gradeFilter,
        trackFilter: !!trackFilter,
        genderFilter: !!genderFilter,
        electiveFilter: !!electiveFilter,
        resetBtn: !!resetBtn
    });
    
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            console.log('[Section Assignment] Search input changed:', searchInput.value);
            // Clear select all when search input changes
            const selectAllBtn = document.getElementById('selectAllStudents');
            if (selectAllBtn) selectAllBtn.checked = false;
            applyFilters();
        });
    }
    if (gradeFilter) {
        gradeFilter.addEventListener('change', () => {
            console.log('[Section Assignment] Grade filter changed:', gradeFilter.value);
            // Clear select all when filter changes
            const selectAllBtn = document.getElementById('selectAllStudents');
            if (selectAllBtn) selectAllBtn.checked = false;
            applyFilters();
        });
    }
    if (trackFilter) {
        trackFilter.addEventListener('change', () => {
            console.log('[Section Assignment] Track filter changed:', trackFilter.value);
            // Clear select all when filter changes
            const selectAllBtn = document.getElementById('selectAllStudents');
            if (selectAllBtn) selectAllBtn.checked = false;
            applyFilters();
        });
    }
    if (genderFilter) {
        genderFilter.addEventListener('change', () => {
            console.log('[Section Assignment] Gender filter changed:', genderFilter.value);
            // Clear select all when filter changes
            const selectAllBtn = document.getElementById('selectAllStudents');
            if (selectAllBtn) selectAllBtn.checked = false;
            applyFilters();
        });
    }
    if (electiveFilter) {
        electiveFilter.addEventListener('change', () => {
            console.log('[Section Assignment] Elective filter changed:', electiveFilter.value);
            // Clear select all when filter changes
            const selectAllBtn = document.getElementById('selectAllStudents');
            if (selectAllBtn) selectAllBtn.checked = false;
            applyFilters();
        });
    }
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            console.log('[Section Assignment] Reset filters clicked');
            resetAllFilters();
        });
    }
}

/**
 * Apply all active filters
 */
function applyFilters() {
    const searchTerm = (document.getElementById('studentSearchInput') || {}).value || '';
    const gradeFilter = (document.getElementById('assignGradeFilter') || {}).value || '';
    const trackFilter = (document.getElementById('assignTrackFilter') || {}).value || '';
    const genderFilter = (document.getElementById('assignGenderFilter') || {}).value || '';
    const electiveFilter = (document.getElementById('assignElectiveFilter') || {}).value || '';
    
    let filtered = [...assignmentState.allStudents];
    
    console.log(`[Section Assignment] Applying filters. Starting with ${filtered.length} students`);
    console.log(`[Section Assignment] Current level filter: ${assignmentState.currentLevel}`);
    console.log(`[Section Assignment] Active filters:`, {
        search: searchTerm,
        grade: gradeFilter,
        track: trackFilter,
        gender: genderFilter,
        elective: electiveFilter
    });
    
    // Filter by level - handle different possible field names
    filtered = filtered.filter(s => {
        let studentLevel = null;
        
        // Try different field names to determine level - check 'level' first (pre-computed)
        if (s.level) {
            studentLevel = s.level;
        } else if (s.type) {
            studentLevel = s.type;
        } else if (s.grade) {
            // Fallback: infer from grade number
            const gradeNum = parseInt(s.grade);
            studentLevel = (gradeNum >= 11) ? 'SHS' : 'JHS';
        } else if (s.grade_level) {
            // Last resort: try to extract grade from grade_level string
            const gradeNum = parseInt(s.grade_level);
            studentLevel = (gradeNum >= 11) ? 'SHS' : 'JHS';
        }
        
        // Normalize level to uppercase for comparison
        if (studentLevel) {
            studentLevel = String(studentLevel).toUpperCase();
        }
        
        const matches = studentLevel === assignmentState.currentLevel;
        
        if (s.student_id === assignmentState.allStudents[0]?.student_id) {
            console.log('[Section Assignment] First student level detection:', {
                student_id: s.student_id,
                name: s.name,
                grade: s.grade,
                grade_level: s.grade_level,
                level: s.level,
                type: s.type,
                calculateLevel: studentLevel,
                matches: matches
            });
        }
        
        return matches;
    });
    
    console.log(`[Section Assignment] After level filter: ${filtered.length} students`);
    
    // Filter by search term
    if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(s => 
            (s.name || '').toLowerCase().includes(term) ||
            (s.student_id || '').toLowerCase().includes(term)
        );
        console.log(`[Section Assignment] After search filter (term="${searchTerm}"): ${filtered.length} students`);
    }
    
    // Filter by grade
    if (gradeFilter) {
        filtered = filtered.filter(s => String(s.grade || '') === gradeFilter);
        console.log(`[Section Assignment] After grade filter (grade=${gradeFilter}): ${filtered.length} students`);
    }
    
    // Filter by gender (case-insensitive, handle empty/null values safely)
    if (genderFilter) {
        const genderLower = genderFilter.toLowerCase().trim();
        filtered = filtered.filter(s => {
            const studentGender = (s.gender || '').toLowerCase().trim();
            return studentGender === genderLower;
        });
        console.log(`[Section Assignment] After gender filter (gender=${genderFilter}): ${filtered.length} students`);
    }
    
    // Filter by track (SHS only, case-insensitive)
    if (trackFilter && assignmentState.currentLevel === 'SHS') {
        const trackLower = trackFilter.toLowerCase().trim();
        filtered = filtered.filter(s => {
            const studentTrack = (s.track || '').toLowerCase().trim();
            return studentTrack === trackLower;
        });
        console.log(`[Section Assignment] After track filter (track=${trackFilter}): ${filtered.length} students`);
    }
    
    // Filter by elective (SHS only, case-insensitive)
    if (electiveFilter && assignmentState.currentLevel === 'SHS') {
        const electiveLower = electiveFilter.toLowerCase().trim();
        filtered = filtered.filter(s => {
            const studentElective = (s.elective || '').toLowerCase().trim();
            return studentElective === electiveLower;
        });
        console.log(`[Section Assignment] After elective filter (elective=${electiveFilter}): ${filtered.length} students`);
    }
    
    // Students are already filtered for approval in loadAllStudents()
    
    assignmentState.filteredStudents = filtered;
    console.log(`[Section Assignment] Final filtered list: ${filtered.length} students`);
    console.log(`[Section Assignment] filteredStudents IDs after applyFilters:`, filtered.slice(0, 10).map(s => ({ id: s.id, name: s.name })));
    
    displayStudentList();
    updateFilteredCount();
    updateSelectedCount();
}

/**
 * Check if student is already assigned to a section
 */
function isStudentAlreadyAssigned(studentId) {
    const apiBase = window.API_BASE || '';
    // Note: This is a synchronous check - in production, cache this data
    // For now, we'll assume it's checked server-side during assignment
    return false;
}

/**
 * Display student list
 */
function displayStudentList() {
    const container = document.getElementById('studentListContainer');
    if (!container) return;
    
    console.log(`[Section Assignment] displayStudentList called. filteredStudents: ${assignmentState.filteredStudents.length} students`);
    console.log(`[Section Assignment] filteredStudents IDs:`, assignmentState.filteredStudents.map(s => ({ id: s.id, name: s.name })));
    
    if (assignmentState.filteredStudents.length === 0) {
        container.innerHTML = '<p class="no-data">No students found matching your filters.</p>';
        // Reset select all when no students
        const selectAllBtn = document.getElementById('selectAllStudents');
        if (selectAllBtn) selectAllBtn.checked = false;
        return;
    }
    
    let html = '';
    
    assignmentState.filteredStudents.forEach(student => {
        const sid = String(student.id);
        const isSelected = assignmentState.selectedStudents.has(sid);

        html += `
            <div class="student-item ${isSelected ? 'selected' : ''}" data-student-id="${sid}">
                <input 
                    type="checkbox" 
                    class="student-checkbox" 
                    value="${sid}"
                    ${isSelected ? 'checked' : ''}
                />
                <div class="student-info">
                    <div class="student-name"><a href="#" class="student-name-link" data-student-id="${sid}">${escapeHtml(student.name)}</a></div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    console.log(`[Section Assignment] displayStudentList rendered ${assignmentState.filteredStudents.length} students in DOM`);
    
    // Attach event listeners for checkboxes
    document.querySelectorAll('.student-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const studentId = String(checkbox.value);
            if (checkbox.checked) {
                assignmentState.selectedStudents.add(studentId);
                checkbox.closest('.student-item').classList.add('selected');
            } else {
                assignmentState.selectedStudents.delete(studentId);
                checkbox.closest('.student-item').classList.remove('selected');
            }
            updateSelectedCount();
            updateAssignButtonState();
            updateSelectAllCheckboxState();
        });
    });

    // Attach click listeners to student name links to open Enrollment Details modal
    document.querySelectorAll('.student-name-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const studentId = link.dataset.studentId;
            const apiBase = window.API_BASE || '';
            if (!studentId) return;

            // Fetch enrollments for this student and open the most recent one
            fetch(`${apiBase}/api/enrollments/student/${studentId}`)
                .then(res => {
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    return res.json();
                })
                .then(enrollments => {
                    if (!Array.isArray(enrollments) || enrollments.length === 0) {
                        showAssignmentMessage('info', 'No enrollment record found for this student.');
                        return;
                    }
                    // Open the most recent enrollment record in the existing modal
                    const enrollmentId = enrollments[0].id;
                    if (typeof window.showEnrollmentDetail === 'function') {
                        window.showEnrollmentDetail(enrollmentId);
                    } else {
                        // Fallback: fetch enrollment and populate modal locally
                        fetch(`${apiBase}/api/enrollments/${enrollmentId}`)
                            .then(r => r.json())
                            .then(enrollment => { try { addEnrollmentToStore(enrollment); } catch(e){}; window.showEnrollmentDetail && window.showEnrollmentDetail(enrollmentId); })
                            .catch(err => console.error('Failed to load enrollment:', err));
                    }
                })
                .catch(err => {
                    console.error('[Section Assignment] Error fetching enrollments for student:', err);
                    showAssignmentMessage('error', 'Failed to load student enrollment details.');
                });
        });
    });
}

/**
 * Setup student selection
 */
function setupStudentSelection() {
    const selectAllBtn = document.getElementById('selectAllStudents');
    
    if (selectAllBtn) {
        selectAllBtn.addEventListener('change', () => {
            console.log('[Section Assignment] Select All checkbox changed:', selectAllBtn.checked);
            const checkboxes = document.querySelectorAll('.student-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.checked = selectAllBtn.checked;
                checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            });
        });
    } else {
        console.warn('[Section Assignment] selectAllStudents checkbox not found');
    }
}

/**
 * Update student checkboxes
 */
function updateStudentChecks() {
    const selectAllBtn = document.getElementById('selectAllStudents');
    if (selectAllBtn) selectAllBtn.checked = false;
}

/**
 * Update the "Select All" checkbox state based on individual selections
 */
function updateSelectAllCheckboxState() {
    const selectAllBtn = document.getElementById('selectAllStudents');
    if (!selectAllBtn) return;
    
    // Count how many students are selected
    const numCheckboxes = document.querySelectorAll('.student-checkbox').length;
    const numChecked = document.querySelectorAll('.student-checkbox:checked').length;
    
    // If all visible students are selected, check "Select All"
    // If none are selected, uncheck "Select All"
    // If some are selected, leave it unchecked but maybe show indeterminate state
    if (numCheckboxes > 0 && numChecked === numCheckboxes) {
        selectAllBtn.checked = true;
        selectAllBtn.indeterminate = false;
    } else if (numChecked === 0) {
        selectAllBtn.checked = false;
        selectAllBtn.indeterminate = false;
    } else {
        selectAllBtn.checked = false;
        selectAllBtn.indeterminate = true;
    }
}

/**
 * Populate elective filter dropdown with available electives from loaded students
 */
function populateElectiveFilterOptions() {
    const electiveFilter = document.getElementById('assignElectiveFilter');
    if (!electiveFilter) return;
    
    // Extract unique electives from all students (excluding empty values)
    const uniqueElectives = new Set();
    assignmentState.allStudents.forEach(student => {
        if (student.elective && student.elective.trim()) {
            uniqueElectives.add(student.elective.trim());
        }
    });
    
    // If no electives found, keep just the "All" option
    if (uniqueElectives.size === 0) {
        console.log('[Section Assignment] No electives found in student data');
        return;
    }
    
    // Get current selection to restore it after repopulating
    const currentValue = electiveFilter.value;
    
    // Keep the "All Electives" option and add unique electives
    electiveFilter.innerHTML = '<option value="">All Electives</option>';
    
    // Sort and add elective options
    const sortedElectives = Array.from(uniqueElectives).sort();
    sortedElectives.forEach(elective => {
        const option = document.createElement('option');
        option.value = elective;
        option.textContent = elective;
        electiveFilter.appendChild(option);
    });
    
    // Restore previous selection if it still exists
    if (currentValue && sortedElectives.includes(currentValue)) {
        electiveFilter.value = currentValue;
    }
    
    console.log(`[Section Assignment] Populated elective filter with ${sortedElectives.length} options:`, sortedElectives);
}

/**
 * Update filtered count display
 */
function updateFilteredCount() {
    const element = document.getElementById('filteredCount');
    if (element) element.textContent = assignmentState.filteredStudents.length;
}

/**
 * Update selected count display
 */
function updateSelectedCount() {
    const element = document.getElementById('selectedCount');
    if (element) element.textContent = assignmentState.selectedStudents.size;
    
    const assignBtn = document.getElementById('assignSelectedBtn');
    if (assignBtn) {
        assignBtn.querySelector('span').textContent = assignmentState.selectedStudents.size;
    }
}

/**
 * Populate section selector dropdown
 */
function populateSectionSelector() {
    const select = document.getElementById('targetSectionSelect');
    if (!select) {
        console.warn('[Section Assignment] targetSectionSelect element not found');
        return;
    }
    
    console.log(`[Section Assignment] Populating section selector. Current level: ${assignmentState.currentLevel}`);
    console.log(`[Section Assignment] Available sections: ${assignmentState.allSections.length}`);
    
    // Get sections for current level
    const levelSections = assignmentState.allSections.filter(s => {
        const sectionLevel = s.type || (s.grade >= 11 ? 'SHS' : 'JHS');
        return sectionLevel === assignmentState.currentLevel;
    });
    
    console.log(`[Section Assignment] Sections for ${assignmentState.currentLevel}: ${levelSections.length}`);
    
    let html = '<option value="">-- Choose a Section --</option>';
    
    levelSections.forEach(section => {
        const displayName = `${section.section_code || 'Unknown'} - ${section.section_name || 'Unnamed'}`;
        html += `<option value="${section.id}">${displayName}</option>`;
    });
    
    select.innerHTML = html;
    console.log(`[Section Assignment] Section dropdown populated with ${levelSections.length} sections`);
}

/**
 * Update section selector for current level
 */
function updateSectionSelector() {
    populateSectionSelector();
    
    const select = document.getElementById('targetSectionSelect');
    if (select) {
        select.value = '';
    }
    
    clearSectionDetails();
    clearAssignedStudents();
}

/**
 * Setup section selector
 */
function setupSectionSelector() {
    const select = document.getElementById('targetSectionSelect');
    
    if (select) {
        select.addEventListener('change', () => {
            const sectionId = select.value;
            
            if (!sectionId) {
                assignmentState.selectedSection = null;
                clearSectionDetails();
                clearAssignedStudents();
                return;
            }
            
            // Find section data
            const section = assignmentState.allSections.find(s => s.id == sectionId);
            if (section) {
                console.log('[Section Assignment] Section selected:', section);
                assignmentState.selectedSection = section;
                displaySectionDetails(section);
                loadAssignedStudents(section.id);
                updateAssignButtonState();
            } else {
                console.warn('[Section Assignment] Section not found in data:', sectionId);
                clearSectionDetails();
                clearAssignedStudents();
            }
        });
    }
}

/**
 * Display section details
 */
function displaySectionDetails(section) {
    const gradeEl = document.getElementById('sectionGrade');
    const levelEl = document.getElementById('sectionLevel');
    const trackEl = document.getElementById('sectionTrack');
    const adviserEl = document.getElementById('sectionAdviser');
    
    if (gradeEl) gradeEl.textContent = `Grade ${section.grade || 'N/A'}`;
    if (levelEl) levelEl.textContent = section.type || 'N/A';
    if (trackEl) trackEl.textContent = section.track || 'N/A';
    if (adviserEl) adviserEl.textContent = section.adviser_name || 'N/A';
    
    const detailsBox = document.getElementById('sectionDetails');
    if (detailsBox) {
        detailsBox.style.display = 'block';
    }
}

/**
 * Clear section details
 */
function clearSectionDetails() {
    const detailsBox = document.getElementById('sectionDetails');
    if (detailsBox) detailsBox.style.display = 'none';
}

/**
 * Load assigned students for a section
 */
function loadAssignedStudents(sectionId) {
    const apiBase = window.API_BASE || '';
    console.log(`[Section Assignment] Loading assigned students for section: ${sectionId} (from enrollments)`);

    // Fetch enrollments and filter by section_id so the panel mirrors enrollment records exactly
    fetch(`${apiBase}/api/enrollments`)
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then(enrollments => {
            if (!Array.isArray(enrollments)) enrollments = [];
            
            // Load ALL enrollments first to get fresh student data
            const allEnrollments = enrollments;
            
            // Filter to get only those assigned to the current section
            const assignedEnrollments = allEnrollments.filter(e => String(e.section_id) === String(sectionId));
            
            const students = assignedEnrollments.map(e => {
                const dataRaw = e.enrollment_data || {};
                let data = dataRaw;
                try { if (typeof dataRaw === 'string' && dataRaw.trim()) data = JSON.parse(dataRaw); } catch (parseErr) { data = dataRaw || {}; }
                const first = (data.firstName || data.firstname || '').toString().trim();
                const last = (data.lastName || data.lastname || '').toString().trim();
                const name = e.student_name || (data.fullName || data.name) || `${first} ${last}`.trim() || '';
                return {
                    id: e.student_id || e.id,
                    student_id: e.student_id || String(e.id || ''),
                    name: name,
                    first_name: first,
                    last_name: last,
                    lrn: e.lrn || '',
                    gender: data.gender || data.sex || e.gender || '',
                    grade: data.grade || data.gradeLevel || e.grade || '',
                    grade_level: data.grade || data.gradeLevel || e.grade || '',
                    track: data.track || data.program || e.track || '',
                    program: data.track || data.program || e.track || '',
                    elective: data.elective || e.elective || '',
                    email: data.email || e.email || '',
                    phone: data.phone || e.phone || '',
                    enrollment_id: e.id
                };
            });

            assignmentState.assignedStudents = students || [];
            console.log(`[Section Assignment] Loaded ${assignmentState.assignedStudents.length} assigned students for section ${sectionId}`);

            // Merge with local cache for entries that were recently assigned client-side
            try {
                const cacheKey = `sa_cache_${sectionId}`;
                const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
                const assignedIds = new Set((assignmentState.assignedStudents || []).map(s => String(s.id)));
                // Add cached entries that server hasn't returned yet
                const stillCached = [];
                cached.forEach(c => {
                    if (!assignedIds.has(String(c.id))) {
                        // ensure shape
                        assignmentState.assignedStudents.push(c);
                        stillCached.push(c);
                    }
                });
                // If server now has the cached entries, remove them from cache
                if (stillCached.length !== cached.length) {
                    // write back only those still missing on server
                    localStorage.setItem(cacheKey, JSON.stringify(stillCached));
                }
            } catch (cacheErr) {
                console.error('[Section Assignment] Error merging assigned cache:', cacheErr);
            }

            // Remove assigned students from the left-panel candidate list so they don't appear for reassignment
            try {
                const assignedIds = new Set((assignmentState.assignedStudents || []).map(s => String(s.id)));
                
                console.log(`[Section Assignment] loadAssignedStudents - Assigned IDs to remove:`, Array.from(assignedIds));
                console.log(`[Section Assignment] loadAssignedStudents - allStudents before removal:`, assignmentState.allStudents.length, 'students');
                console.log(`[Section Assignment] loadAssignedStudents - allStudents IDs (first 10):`, assignmentState.allStudents.slice(0, 10).map(s => ({ id: String(s.id), name: s.name })));
                
                // Only keep students that are NOT assigned to this section (compare as strings)
                const candidateStudents = assignmentState.allStudents.filter(s => {
                    const studentIdStr = String(s.id);
                    const isAssigned = assignedIds.has(studentIdStr);
                    if (isAssigned) {
                        console.log(`[Section Assignment] Removing assigned student:`, { id: studentIdStr, name: s.name });
                    }
                    return !isAssigned;
                });
                
                console.log(`[Section Assignment] Before removal: ${assignmentState.allStudents.length} total students`);
                console.log(`[Section Assignment] Assigned to section: ${assignedIds.size} students`);
                console.log(`[Section Assignment] Available for assignment: ${candidateStudents.length} students`);
                
                // Update BOTH allStudents and filteredStudents to remove assigned students
                assignmentState.allStudents = candidateStudents.slice();
                assignmentState.filteredStudents = candidateStudents.slice();
                
                console.log(`[Section Assignment] Updated allStudents to: ${assignmentState.allStudents.length} students`);
                
                // Reapply filters to the new candidate list
                applyFilters();
                updateFilteredCount();
            } catch (remErr) {
                console.error('[Section Assignment] Error removing assigned students from candidate list:', remErr);
            }

            displayAssignedStudents();
            
            // Update the section details count
            const sectionCountEl = document.getElementById('sectionCurrentCount');
            if (sectionCountEl) {
                sectionCountEl.textContent = assignmentState.assignedStudents.length;
            }
        })
        .catch(err => {
            console.error('[Section Assignment] Error loading assigned students:', err);
            assignmentState.assignedStudents = [];
            displayAssignedStudents();
            
            // Update the section details count
            const sectionCountEl = document.getElementById('sectionCurrentCount');
            if (sectionCountEl) {
                sectionCountEl.textContent = '0';
            }
        });
}

/**
 * Display assigned students
 */
function displayAssignedStudents() {
    const container = document.getElementById('assignedStudentsList');
    if (!container) return;
    
    if (assignmentState.assignedStudents.length === 0) {
        container.innerHTML = '<p class="no-data">No students assigned yet.</p>';
        document.getElementById('assignedCount').textContent = '0';
        return;
    }
    
    let html = '';
    
    assignmentState.assignedStudents.forEach(student => {
        // Build display-friendly fields with fallbacks because backend may return different schemas
        const displayName = student.name || ((student.first_name || '') + ' ' + (student.last_name || '')).trim() || student.student_id || 'Unnamed';
        const displayId = student.student_id || student.lrn || student.id || '—';
        const displayGender = student.gender || student.sex || '—';

        let displayMeta = 'Grade —';
        if (assignmentState.currentLevel === 'SHS') {
            const t = student.track || student.program || '';
            const e = student.elective || '';
            displayMeta = `${t || 'Track N/A'}${e ? ' | ' + e : ''}`;
        } else {
            const gradeVal = (student.grade !== undefined && student.grade !== null) ? student.grade : (student.grade_level || '—');
            displayMeta = `Grade ${gradeVal}`;
        }

        html += `
            <div class="assigned-student-item">
                <div class="assigned-student-info">
                    <div class="assigned-student-name">${escapeHtml(displayName)}</div>
                    <div class="assigned-student-meta">${escapeHtml(String(displayId))} • ${escapeHtml(String(displayGender))} • ${escapeHtml(displayMeta)}</div>
                </div>
                <div class="assigned-student-actions">
                    <button class="btn btn-xs btn-danger" onclick="removeStudentFromSection(${student.id}, ${assignmentState.selectedSection ? assignmentState.selectedSection.id : 'null'})">❌</button>
                    <button class="btn btn-xs" onclick="transferStudent(${student.id})">🔄</button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    document.getElementById('assignedCount').textContent = assignmentState.assignedStudents.length;

    // Also proactively remove any left-panel candidate DOM nodes that
    // correspond to students now assigned to this section. This guards
    // against timing issues where the left list may still contain items.
    try {
        const assignedIdStrs = (assignmentState.assignedStudents || []).map(s => String(s.id));
        assignedIdStrs.forEach(idStr => {
            const leftItem = document.querySelector(`#studentListContainer .student-item[data-student-id="${idStr}"]`);
            if (leftItem && leftItem.parentNode) {
                leftItem.parentNode.removeChild(leftItem);
            }
            // Also uncheck any matching checkbox if present
            const checkbox = document.querySelector(`#studentListContainer .student-checkbox[value="${idStr}"]`);
            if (checkbox) {
                checkbox.checked = false;
                checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
        // Update filtered and selected counts after removal
        assignmentState.filteredStudents = (assignmentState.filteredStudents || []).filter(s => !assignedIdStrs.includes(String(s.id)));
        updateFilteredCount();
        updateSelectedCount();
        updateSelectAllCheckboxState();
    } catch (e) {
        console.error('[Section Assignment] Error cleaning up left-panel assigned items:', e);
    }
}

/**
 * Clear assigned students display
 */
function clearAssignedStudents() {
    const container = document.getElementById('assignedStudentsList');
    if (container) container.innerHTML = '<p class="no-data">Select a section to view assigned students</p>';
    document.getElementById('assignedCount').textContent = '0';
    
    // Clear the section current count
    const sectionCountEl = document.getElementById('sectionCurrentCount');
    if (sectionCountEl) {
        sectionCountEl.textContent = '0';
    }
}

/**
 * Setup bulk actions
 */
function setupBulkActions() {
    const assignSelectedBtn = document.getElementById('assignSelectedBtn');
    const bulkAssignBtn = document.getElementById('bulkAssignAllBtn');
    
    if (assignSelectedBtn) {
        assignSelectedBtn.addEventListener('click', scheduleAssignment);
    }
    
    if (bulkAssignBtn) {
        bulkAssignBtn.addEventListener('click', scheduleBulkAssignment);
    }
}

/**
 * Schedule assignment for selected students
 */
function scheduleAssignment() {
    if (assignmentState.selectedStudents.size === 0) {
        showAssignmentMessage('warning', '⚠️ Please select at least one student.');
        return;
    }
    
    if (!assignmentState.selectedSection) {
        showAssignmentMessage('warning', '⚠️ Please select a section.');
        return;
    }
    
    // Validate eligibility
    const ineligibleStudents = validateEligibility(Array.from(assignmentState.selectedStudents));
    
    if (ineligibleStudents.length > 0) {
        showAssignmentMessage('warning', `⚠️ ${ineligibleStudents.length} student(s) don't match section requirements.`);
        return;
    }
    
    // Show summary
    const count = assignmentState.selectedStudents.size;
    const sectionName = assignmentState.selectedSection.section_name;
    const sectionCode = assignmentState.selectedSection.section_code;
    
    showAssignmentSummary(count, `${sectionCode} - ${sectionName}`);
}

/**
 * Schedule bulk assignment for all filtered students
 */
function scheduleBulkAssignment() {
    if (assignmentState.filteredStudents.length === 0) {
        showAssignmentMessage('warning', '⚠️ No students to assign.');
        return;
    }
    
    if (!assignmentState.selectedSection) {
        showAssignmentMessage('warning', '⚠️ Please select a section.');
        return;
    }
    
    // Clear existing selection and select all filtered
    assignmentState.selectedStudents.clear();
    assignmentState.filteredStudents.forEach(student => {
        assignmentState.selectedStudents.add(String(student.id));
    });
    
    // Validate eligibility
    const ineligibleStudents = validateEligibility(Array.from(assignmentState.selectedStudents));
    
    if (ineligibleStudents.length > 0) {
        showAssignmentMessage('warning', `⚠️ ${ineligibleStudents.length} student(s) don't match section requirements.`);
        return;
    }
    
    // Show summary
    const count = assignmentState.selectedStudents.size;
    const sectionName = assignmentState.selectedSection.section_name;
    const sectionCode = assignmentState.selectedSection.section_code;
    
    showAssignmentSummary(count, `${sectionCode} - ${sectionName}`);
}

/**
 * Validate student eligibility for section
 */
function validateEligibility(studentIds) {
    const ineligible = [];
    const section = assignmentState.selectedSection;
    
    studentIds.forEach(studentId => {
        const student = assignmentState.allStudents.find(s => String(s.id) === String(studentId));
        if (!student) return;
        // Check grade match (coerce to numbers when possible)
        const secGrade = (section && section.grade !== undefined && section.grade !== null) ? Number(section.grade) : null;
        const stuGrade = (student && student.grade !== undefined && student.grade !== null) ? Number(student.grade) : null;

        if (secGrade !== null && stuGrade !== null) {
            if (Number.isNaN(secGrade) || Number.isNaN(stuGrade) || secGrade !== stuGrade) {
                ineligible.push(student.id);
                return;
            }
        } else if (secGrade !== null) {
            // Section has grade but student missing grade
            ineligible.push(student.id);
            return;
        }

        // Check SHS track/elective match (case-insensitive, only enforce when section defines them)
        if (assignmentState.currentLevel === 'SHS') {
            const secTrack = (section && section.track) ? String(section.track).toLowerCase().trim() : '';
            const stuTrack = (student && student.track) ? String(student.track).toLowerCase().trim() : '';
            const secElective = (section && section.elective) ? String(section.elective).toLowerCase().trim() : '';
            const stuElective = (student && student.elective) ? String(student.elective).toLowerCase().trim() : '';

            if (secTrack && secTrack !== stuTrack) {
                ineligible.push(student.id);
                return;
            }

            if (secElective && secElective !== stuElective) {
                ineligible.push(student.id);
                return;
            }
        }
    });
    
    return ineligible;
}

/**
 * Show assignment summary and confirmation
 */
function showAssignmentSummary(count, sectionName) {
    const summary = document.getElementById('assignmentSummary');
    const summaryText = document.getElementById('summaryText');
    
    if (summary && summaryText) {
        summaryText.textContent = `You are assigning ${count} student(s) to ${sectionName}.`;
        summary.style.display = 'block';
    }
}

/**
 * Hide assignment summary
 */
function hideAssignmentSummary() {
    const summary = document.getElementById('assignmentSummary');
    if (summary) summary.style.display = 'none';
}

/**
 * Setup assignment confirmation
 */
function setupAssignmentConfirmation() {
    const confirmBtn = document.getElementById('confirmAssignmentBtn');
    const cancelBtn = document.getElementById('cancelAssignmentBtn');
    
    if (confirmBtn) {
        confirmBtn.addEventListener('click', confirmAssignment);
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', hideAssignmentSummary);
    }
}

/**
 * Confirm and execute assignment
 */
function confirmAssignment() {
    const students = Array.from(assignmentState.selectedStudents);
    const sectionId = assignmentState.selectedSection.id;
    
    if (students.length === 0 || !sectionId) return;
    
    const apiBase = window.API_BASE || '';
    
    // Show loading state
    const confirmBtn = document.getElementById('confirmAssignmentBtn');
    const originalHtml = confirmBtn ? confirmBtn.innerHTML : '';
    if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '⏳ Processing...';
    }
    
    fetch(`${apiBase}/api/sections/${sectionId}/assign-students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            student_ids: students
        })
    })
    .then(res => {
        if (!res.ok) {
            return res.json().then(data => {
                throw new Error(data.error || `HTTP ${res.status}`);
            });
        }
        return res.json();
    })
    .then(data => {
        if (data.error) {
            showAssignmentMessage('error', `❌ ${data.error}`);
            return;
        }
        
        hideAssignmentSummary();
        showAssignmentMessage('success', `✅ ${students.length} student(s) assigned successfully!`);
        
        // Preserve filter state
        const searchTerm = (document.getElementById('studentSearchInput') || {}).value || '';
        const gradeFilter = (document.getElementById('assignGradeFilter') || {}).value || '';
        const trackFilter = (document.getElementById('assignTrackFilter') || {}).value || '';
        const genderFilter = (document.getElementById('assignGenderFilter') || {}).value || '';
        const electiveFilter = (document.getElementById('assignElectiveFilter') || {}).value || '';
        
        // Immediately remove assigned students from the UI and update assigned panel
        console.log(`[Section Assignment] Immediately removing ${students.length} assigned students from UI`);
        console.log(`[Section Assignment] Selected student IDs:`, students.map(s => ({ id: s, type: typeof s })));
        console.log(`[Section Assignment] AllStudents before removal:`, assignmentState.allStudents.length, 'students');
        console.log(`[Section Assignment] AllStudents IDs (first 5):`, assignmentState.allStudents.slice(0, 5).map(s => ({ id: s.id, type: typeof s.id, name: s.name })));

        // Capture the records for the newly assigned students from the current pool
        const newlyAssignedRecords = assignmentState.allStudents.filter(s => students.some(st => String(st) === String(s.id)));
        console.log(`[Section Assignment] Captured ${newlyAssignedRecords.length} records to add to assigned students:`, newlyAssignedRecords.map(r => ({ id: r.id, name: r.name })));

        // Remove them from the available pool (compare as strings to be robust)
        const beforeRemovalCount = assignmentState.allStudents.length;
        assignmentState.allStudents = assignmentState.allStudents.filter(s => !students.some(st => String(st) === String(s.id)));
        console.log(`[Section Assignment] AllStudents after removal: ${beforeRemovalCount} -> ${assignmentState.allStudents.length} (removed ${beforeRemovalCount - assignmentState.allStudents.length})`);

        // ALSO remove from the current filtered list and DOM immediately to avoid flicker
        try {
            const assignedIdStrs = students.map(st => String(st));
            // Update filteredStudents array immediately
            assignmentState.filteredStudents = (assignmentState.filteredStudents || []).filter(s => !assignedIdStrs.includes(String(s.id)));

            // Remove DOM nodes for any visible assigned items
            assignedIdStrs.forEach(idStr => {
                const checkbox = document.querySelector(`.student-checkbox[value="${idStr}"]`);
                if (checkbox) {
                    const item = checkbox.closest('.student-item');
                    if (item && item.parentNode) item.parentNode.removeChild(item);
                }
            });

            // Update counts/UI immediately
            updateFilteredCount();
            updateSelectedCount();
            updateAssignButtonState();
            updateSelectAllCheckboxState();
        } catch (domErr) {
            console.error('[Section Assignment] Immediate DOM removal failed:', domErr);
        }

        // Merge into assignedStudents (avoid duplicates) and persist to local cache
        try {
            const existingIds = new Set((assignmentState.assignedStudents || []).map(s => String(s.id)));
            const toAdd = [];
            newlyAssignedRecords.forEach(rec => {
                const rid = String(rec.id);
                if (!existingIds.has(rid)) {
                    // Ensure display fields are available and prefer enrollment-derived name
                    const assignedRec = {
                        id: rec.id,
                        student_id: rec.student_id || String(rec.id || ''),
                        name: rec.name || ((rec.first_name || '') + ' ' + (rec.last_name || '')).trim(),
                        first_name: rec.first_name || '',
                        last_name: rec.last_name || '',
                        lrn: rec.student_id || '',
                        gender: rec.gender || '',
                        grade: rec.grade || rec.grade_level || '',
                        grade_level: rec.grade_level || '',
                        track: rec.track || rec.program || '',
                        elective: rec.elective || '',
                        email: rec.email || '',
                        phone: rec.phone || ''
                    };
                    toAdd.push(assignedRec);
                    existingIds.add(rid);
                }
            });

            assignmentState.assignedStudents = (assignmentState.assignedStudents || []).concat(toAdd);

            // Persist newly added assigned records to localStorage so they survive reloads
            try {
                const sectionIdKey = assignmentState.selectedSection ? assignmentState.selectedSection.id : sectionId;
                const cacheKey = `sa_cache_${sectionIdKey}`;
                const existingCache = JSON.parse(localStorage.getItem(cacheKey) || '[]');
                const cacheIds = new Set(existingCache.map(c => String(c.id)));
                toAdd.forEach(r => {
                    if (!cacheIds.has(String(r.id))) {
                        existingCache.push(r);
                        cacheIds.add(String(r.id));
                    }
                });
                localStorage.setItem(cacheKey, JSON.stringify(existingCache));
            } catch (cacheErr) {
                console.error('[Section Assignment] Failed to persist assigned students cache:', cacheErr);
            }
        } catch (e) {
            console.error('[Section Assignment] Error merging newly assigned students:', e);
        }

        // Reset UI selections
        assignmentState.selectedStudents.clear();
        updateSelectedCount();
        updateStudentChecks();
        updateAssignButtonState();

        // Reapply current filters to update the left-panel display
        console.log(`[Section Assignment] Before applyFilters - allStudents: ${assignmentState.allStudents.length}, filteredStudents: ${assignmentState.filteredStudents.length}`);
        applyFilters();
        console.log(`[Section Assignment] After applyFilters - allStudents: ${assignmentState.allStudents.length}, filteredStudents: ${assignmentState.filteredStudents.length}`);

        // Immediately refresh assigned-students panel with newly added records
        displayAssignedStudents();
        
        // Update the section details count
        const sectionCountEl = document.getElementById('sectionCurrentCount');
        if (sectionCountEl) {
            sectionCountEl.textContent = assignmentState.assignedStudents.length;
        }

        // Background reload for data consistency (refresh unassigned student list and authoritative assigned list)
        console.log('[Section Assignment] Background reload for consistency');
        setTimeout(() => {
            if (assignmentState.selectedSection) {
                loadAllStudents_Fresh(() => {
                    loadAssignedStudents(assignmentState.selectedSection.id);
                });
            }
        }, 800);
    })
    .catch(err => {
        console.error('[Section Assignment] Assignment error:', err);
        showAssignmentMessage('error', `❌ ${err.message || 'Failed to assign students. Please try again.'}`);
    })
    .finally(() => {
        // Restore button state
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = originalHtml;
        }
    });
}

/**
 * Remove student from section
 */
function removeStudentFromSection(studentId, sectionId) {
    if (!confirm('Remove this student from the section?')) return;
    
    const apiBase = window.API_BASE || '';
    
    fetch(`${apiBase}/api/sections/${sectionId}/students/${studentId}`, {
        method: 'DELETE'
    })
    .then(res => {
        if (!res.ok) {
            return res.json().then(data => {
                throw new Error(data.error || `HTTP ${res.status}`);
            });
        }
        return res.json();
    })
    .then(data => {
        if (data.error) {
            showAssignmentMessage('error', `❌ ${data.error}`);
            return;
        }
        
        showAssignmentMessage('success', '✅ Student removed successfully!');

        // Remove from local cache if present, then reload fresh data
        try {
            const cacheKey = `sa_cache_${sectionId}`;
            const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
            const remaining = cached.filter(c => String(c.id) !== String(studentId));
            localStorage.setItem(cacheKey, JSON.stringify(remaining));
        } catch (cacheErr) {
            console.error('[Section Assignment] Error updating cache on removal:', cacheErr);
        }

        // Immediately update UI by reloading fresh student data
        console.log(`[Section Assignment] Removing student ${studentId} from section - reloading data`);
        loadAllStudents_Fresh(() => {
            loadAssignedStudents(sectionId);
        });
    })
    .catch(err => {
        console.error('[Section Assignment] Remove error:', err);
        showAssignmentMessage('error', `❌ ${err.message || 'Failed to remove student.'}`);
    });
}

/**
 * Transfer student to another section
 */
function transferStudent(studentId) {
    alert('Transfer feature coming soon!');
}

/**
 * Reset all filters
 */
function resetAllFilters() {
    console.log('[Section Assignment] Resetting all filters');
    
    // Safely reset each filter with null checks
    const searchInput = document.getElementById('studentSearchInput');
    if (searchInput) searchInput.value = '';
    
    const gradeFilter = document.getElementById('assignGradeFilter');
    if (gradeFilter) gradeFilter.value = '';
    
    const trackFilter = document.getElementById('assignTrackFilter');
    if (trackFilter) trackFilter.value = '';
    
    const genderFilter = document.getElementById('assignGenderFilter');
    if (genderFilter) genderFilter.value = '';
    
    const electiveFilter = document.getElementById('assignElectiveFilter');
    if (electiveFilter) electiveFilter.value = '';
    
    // Also reset the select all checkbox
    const selectAllBtn = document.getElementById('selectAllStudents');
    if (selectAllBtn) selectAllBtn.checked = false;
    
    console.log('[Section Assignment] All filters reset, applying filters...');
    applyFilters();
}

/**
 * Update assign button state
 */
function updateAssignButtonState() {
    const btn = document.getElementById('assignSelectedBtn');
    if (btn) {
        btn.disabled = assignmentState.selectedStudents.size === 0 || !assignmentState.selectedSection;
    }
}

/**
 * Show assignment message
 */
function showAssignmentMessage(type, text) {
    const container = document.getElementById('assignmentMessages');
    if (!container) return;
    
    const messageEl = document.createElement('div');
    messageEl.className = `assignment-message ${type}`;
    messageEl.innerHTML = `<span>${text}</span>`;
    
    container.appendChild(messageEl);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        messageEl.style.animation = 'slideDown 0.3s ease reverse';
        setTimeout(() => messageEl.remove(), 300);
    }, 5000);
}

// Robust initialization: run whether script loads before/after DOMContentLoaded
/**
 * Real-time event handlers for dashboard communication
 */
// Store listener registrations so we can ensure they're always active
let realTimeListenersAttached = false;

function setupRealtimeEventListeners() {
    console.log('[Section Assignment] Setting up real-time event listeners...');
    
    if (!window.DashboardEvents) {
        console.warn('[Section Assignment] ⚠️ DashboardEvents not available - retrying in 100ms');
        setTimeout(setupRealtimeEventListeners, 100);
        return;
    }
    
    if (realTimeListenersAttached) {
        console.log('[Section Assignment] ✓ Real-time listeners already attached');
        return;
    }
    
    realTimeListenersAttached = true;
    
    // Listen for student section cleared events
    window.DashboardEvents.on('student_section_cleared', (eventData) => {
        console.log('[Section Assignment] 🎯 Received student_section_cleared event:', eventData);
        
        const studentId = eventData.student_id;
        const studentName = eventData.student_name;
        const reason = eventData.reason || 'unknown';
        
        console.log(`[Section Assignment] Processing real-time update for: ${studentName} (ID: ${studentId}, Reason: ${reason})`);
        console.log(`[Section Assignment] Current level filter: ${assignmentState.currentLevel}`);
        
        // Reload fresh data from API to ensure we have the latest state
        // This is more reliable than trying to update cached data
        loadAllStudents_Fresh(() => {
            console.log('[Section Assignment] ✓ Fresh student data loaded successfully');
            console.log(`[Section Assignment]   Total students from API: ${assignmentState.allStudents?.length || 0}`);
            
            // Reapply current filters with the fresh data
            try {
                applyFilters();
                console.log(`[Section Assignment] ✓ Filters applied, filtered students: ${assignmentState.filteredStudents?.length || 0}`);
            } catch (filterErr) {
                console.error('[Section Assignment] ❌ Error applying filters after real-time update:', filterErr);
                console.error('[Section Assignment] Filter error stack:', filterErr.stack);
                // Fallback: just display without filters
                assignmentState.filteredStudents = assignmentState.allStudents.slice();
                displayStudentList();
            }
            
            // Verify student is now in the list
            const studentInList = assignmentState.filteredStudents?.find(s => {
                const sIdMatch = String(s.id) === String(studentId);
                const sStudentIdMatch = s.student_id === String(studentId) || s.student_id === studentId;
                const sNameMatch = s.name === studentName;
                return sIdMatch || sStudentIdMatch || sNameMatch;
            });
            
            if (studentInList) {
                console.log(`[Section Assignment] ✅ SUCCESS: Student found in filtered list: ${studentName}`);
                console.log(`[Section Assignment]   Student object:`, { 
                    id: studentInList.id, 
                    student_id: studentInList.student_id,
                    name: studentInList.name,
                    level: studentInList.level,
                    track: studentInList.track
                });
                
                // Highlight the newly added student for visual feedback
                try {
                    const studentElement = document.querySelector(`[data-student-id="${String(studentId)}"]`);
                    if (studentElement && window.DashboardRealtimeUtils) {
                        window.DashboardRealtimeUtils.highlightElement(studentElement);
                        console.log('[Section Assignment] ✓ Student highlighted');
                    } else {
                        if (!studentElement) {
                            console.debug('[Section Assignment] ℹ Student element not found in DOM yet (might render after display)');
                        }
                        if (!window.DashboardRealtimeUtils) {
                            console.debug('[Section Assignment] ℹ DashboardRealtimeUtils not available (highlighting skipped)');
                        }
                    }
                } catch (highlightErr) {
                    console.debug('[Section Assignment] ℹ Highlighting failed (non-critical):', highlightErr.message);
                }
                
                // Update count display with visual feedback
                try {
                    updateStudentCount();
                    console.log('[Section Assignment] ✓ Count updated');
                } catch (countErr) {
                    console.error('[Section Assignment] ❌ Error updating count:', countErr);
                }
            } else {
                console.warn(`[Section Assignment] ⚠️ Student NOT found in filtered list: ${studentName} (ID: ${studentId})`);
                console.warn('[Section Assignment] Debugging info:');
                console.warn('[Section Assignment]   - Looking for ID:', studentId, 'Type:', typeof studentId);
                console.warn('[Section Assignment]   - Looking for name:', studentName);
                console.warn('[Section Assignment]   - Filtered students count:', assignmentState.filteredStudents?.length || 0);
                console.warn('[Section Assignment]   - Current level filter:', assignmentState.currentLevel);
                console.warn('[Section Assignment]   - First 5 filtered students:', 
                    assignmentState.filteredStudents?.slice(0, 5).map(s => ({
                        id: s.id,
                        student_id: s.student_id,
                        name: s.name,
                        level: s.level
                    }))
                );
                
                // Try to find the student in allStudents to understand why they're not in filtered
                const studentInAll = assignmentState.allStudents?.find(s => 
                    String(s.id) === String(studentId) || s.student_id === String(studentId)
                );
                if (studentInAll) {
                    console.warn('[Section Assignment] ⚠️ Student IS in allStudents but NOT in filteredStudents');
                    console.warn('[Section Assignment]   Student details:', {
                        id: studentInAll.id,
                        student_id: studentInAll.student_id,
                        name: studentInAll.name,
                        level: studentInAll.level,
                        track: studentInAll.track
                    });
                    console.warn('[Section Assignment]   Current level filter value:', assignmentState.currentLevel);
                    console.warn('[Section Assignment]   Student level matches current level?', studentInAll.level === assignmentState.currentLevel);
                } else {
                    console.error('[Section Assignment] ❌ Student NOT found in allStudents either');
                    console.error('[Section Assignment]   This means the API did not return the student or section was not cleared on server');
                }
            }
        });
    });
    
    // Listen for general student updates
    window.DashboardEvents.on('student_updated', (eventData) => {
        console.log('[Section Assignment] 📊 Received student_updated event:', eventData);
        
        // If section was cleared, the specific event should have handled it
        if (eventData.section_cleared) {
            console.log('[Section Assignment] ℹ Section was cleared (handled by student_section_cleared listener)');
        }
    });
    
    console.log('[Section Assignment] ✅ Real-time event listeners initialized successfully');
}

/**
 * Add a student to the unassigned list in real-time (without page reload)
 */
function dynamicallyAddStudentToUnassigned(studentData) {
    console.log('[Section Assignment] Adding student to unassigned in real-time:', studentData.name);
    
    if (!assignmentState.filteredStudents) {
        assignmentState.filteredStudents = [];
    }
    
    // Check if student already exists
    const exists = assignmentState.filteredStudents.some(s => String(s.id) === String(studentData.id));
    if (exists) {
        console.log('[Section Assignment] Student already in unassigned list');
        return;
    }
    
    // Prepare student object for unassigned list
    const unassignedStudent = {
        id: studentData.id,
        student_id: studentData.student_id,
        name: studentData.name,
        grade_level: studentData.grade_level,
        grade: studentData.grade,
        level: studentData.level,
        class_id: null,  // Explicitly null
        account_status: studentData.account_status || 'active',
        registration_date: studentData.registration_date,
        gender: studentData.gender,
        track: studentData.track,
        elective: studentData.elective,
        enrollment_status: studentData.enrollment_status
    };
    
    // Add to filtered students
    assignmentState.filteredStudents.push(unassignedStudent);
    
    // Refresh the display with visual indicator
    try {
        // Mark student as newly added for visual effect
        setTimeout(() => {
            const newRow = document.querySelector(`[data-student-id="${unassignedStudent.id}"]`);
            if (newRow) {
                // Highlight animation
                newRow.style.backgroundColor = '#e8f5e9';
                newRow.style.transition = 'background-color 0.6s ease';
                
                setTimeout(() => {
                    newRow.style.backgroundColor = 'transparent';
                }, 1500);
                
                console.log('[Section Assignment] Applied highlight effect to new student');
            }
        }, 100);
        
        displayStudentList();
        updateStudentCount();
        showNotification(`${unassignedStudent.name} needs reassignment`, 'info');
        console.log('[Section Assignment] Real-time added to unassigned successfully');
    } catch (e) {
        console.error('[Section Assignment] Error adding student to unassigned:', e);
    }
}

/**
 * Update student count display in real-time
 */
function updateStudentCount() {
    try {
        const countElement = document.getElementById('unassignedCount') || 
                           document.querySelector('[data-student-count]');
        if (countElement && assignmentState.filteredStudents) {
            const oldCount = countElement.textContent;
            const newCount = assignmentState.filteredStudents.length;
            countElement.textContent = newCount;
            
            // Flash animation if count changed
            if (oldCount !== newCount) {
                countElement.style.backgroundColor = '#fff3cd';
                countElement.style.padding = '2px 6px';
                countElement.style.borderRadius = '4px';
                countElement.style.transition = 'background-color 0.4s ease';
                
                setTimeout(() => {
                    countElement.style.backgroundColor = 'transparent';
                }, 800);
            }
            
            console.log('[Section Assignment] Updated count:', newCount);
        }
    } catch (e) {
        console.warn('[Section Assignment] Failed to update count:', e.message);
    }
}

// Initialize event listeners when this module loads
// Use a more robust approach to ensure DashboardEvents is ready
function initializeRealTimeListeners() {
    console.log('[Section Assignment] Ensuring real-time event listeners are set up...');
    
    if (realTimeListenersAttached) {
        console.log('[Section Assignment] ✓ Real-time listeners already attached');
        return;
    }
    
    if (!window.DashboardEvents || !window.DashboardEvents.listeners) {
        console.warn('[Section Assignment] ⚠️ DashboardEvents not ready yet - retrying in 100ms');
        setTimeout(initializeRealTimeListeners, 100);
        return;
    }
    
    console.log('[Section Assignment] DashboardEvents confirmed ready, initializing listeners');
    setupRealtimeEventListeners();
}

// Attach listeners as soon as possible (don't wait for section DOM)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initializeRealTimeListeners, 10);
    });
} else {
    // DOM already loaded
    setTimeout(initializeRealTimeListeners, 10);
}

function tryInitSectionAssignment() {
    if (window.sectionAssignmentInitialized) return;
    if (document.getElementById('section-assignment')) {
        try {
            // Initialize the Section Assignment module by loading initial data
            console.log('[Section Assignment] ===== INITIALIZING SECTION ASSIGNMENT MODULE =====');
            
            // Setup event listeners first (before loading data)
            setupRealtimeEventListeners();
            
            // Load all students and sections
            loadAllStudents();
            loadAllSections();
            loadElectivesData();
            
            // Setup UI components
            setupLevelToggler();
            setupSectionSelector();
            setupFilters();
            
            console.log('[Section Assignment] Module initialization complete');
        } catch (err) {
            console.error('[Section Assignment] Initialization error:', err);
            console.error('[Section Assignment] Stack:', err.stack);
        }
        window.sectionAssignmentInitialized = true;
    } else {
        console.log('[Section Assignment] section-assignment container not found yet');
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryInitSectionAssignment);
} else {
    // DOM already ready
    tryInitSectionAssignment();
}

// Also initialize when the section-assignment tab is clicked (if loaded lazily)
document.addEventListener('click', (e) => {
    if (e.target && e.target.getAttribute && e.target.getAttribute('data-section') === 'section-assignment') {
        setTimeout(tryInitSectionAssignment, 100);
    }
});



