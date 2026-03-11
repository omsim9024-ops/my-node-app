// Admin Dashboard - Section Assignment & Class List (v2)
// Comprehensive implementation with both tabs

console.log('[SectionAssignment-v2] Initializing...');

// Global State Management
const sectionAssignmentState = {
    // Section Assignment
    currentLevel: 'JHS',
    allStudents: [],
    filteredStudents: [],
    selectedStudents: new Set(),
    selectedSection: null,
    selectedGrade: null,
    selectedTrack: null,
    selectedElectives: new Set(),
    
    // Class List
    allSections: [],
    classListFilters: {
        grade: null,
        section: null,
        track: null,
        elective: null
    },
    classListSourceData: [],
    classListData: []
};

function safeParseEnrollmentData(raw) {
    if (!raw) return {};
    if (typeof raw === 'object') return raw;
    if (typeof raw !== 'string') return {};
    try {
        return JSON.parse(raw || '{}');
    } catch (err) {
        console.warn('[SectionAssignment-v2] Failed to parse enrollment_data JSON:', err);
        return {};
    }
}

function resolveApiBaseCandidates() {
    const forcedBase = (typeof window !== 'undefined' && window.__FORCED_API_BASE__) ? String(window.__FORCED_API_BASE__) : '';
    const configuredBase = (typeof window !== 'undefined' && window.API_BASE) ? String(window.API_BASE) : '';
    const sameOriginBase = (typeof window !== 'undefined' && window.location && window.location.origin) ? String(window.location.origin) : '';

    return [forcedBase, configuredBase, sameOriginBase, '']
        .map(base => String(base || '').trim())
        .filter((base, index, arr) => arr.indexOf(base) === index);
}

async function sectionAssignmentRequest(path, options = {}) {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const candidates = resolveApiBaseCandidates();
    let lastError = null;

    const tenantCode = (() => {
        try {
            const params = new URLSearchParams(window.location.search || '');
            const fromQuery = String(params.get('school') || params.get('tenant') || params.get('code') || '').trim().toLowerCase();
            if (fromQuery) return fromQuery;
        } catch (_e) { }
        return String(localStorage.getItem('sms.selectedSchoolCode') || localStorage.getItem('sms.selectedTenantCode') || '').trim().toLowerCase();
    })();

    for (const base of candidates) {
        const urlObj = new URL(base ? `${base.replace(/\/$/, '')}${normalizedPath}` : normalizedPath, window.location.origin);
        if (tenantCode) {
            urlObj.searchParams.set('school', tenantCode);
        }

        const requestOptions = {
            ...options,
            credentials: options.credentials || 'include',
            headers: {
                ...(options.headers || {}),
                ...(tenantCode ? { 'x-tenant-code': tenantCode } : {})
            }
        };
        try {
            const response = await fetch(urlObj.toString(), requestOptions);
            if (!response.ok) {
                const errText = await response.text().catch(() => '');
                throw new Error(`HTTP ${response.status}: ${errText || response.statusText}`);
            }
            return response.json();
        } catch (err) {
            lastError = err;
        }
    }

    throw lastError || new Error('Unable to reach section assignment API');
}

function updateClassListFilterVisibility() {
    const gradeValue = String(document.getElementById('clGradeSelect')?.value || '').trim();
    const gradeNumber = Number(gradeValue);
    const isShs = Number.isFinite(gradeNumber) && gradeNumber >= 11;

    const trackGroup = document.getElementById('clTrackGroup');
    const electiveGroup = document.getElementById('clElectiveGroup');
    const trackSelect = document.getElementById('clTrackSelect');
    const electiveSelect = document.getElementById('clElectiveSelect');

    if (trackGroup) trackGroup.style.display = isShs ? 'block' : 'none';
    if (electiveGroup) electiveGroup.style.display = isShs ? 'block' : 'none';

    if (!isShs) {
        sectionAssignmentState.classListFilters.track = null;
        sectionAssignmentState.classListFilters.elective = null;
        if (trackSelect) trackSelect.value = '';
        if (electiveSelect) electiveSelect.value = '';
    }
}

function extractSectionAssignmentFromEnrollment(enrollmentRecord) {
    const data = safeParseEnrollmentData(enrollmentRecord?.enrollment_data);

    const sectionId =
        enrollmentRecord?.section_id
        ?? enrollmentRecord?.class_id
        ?? data.section_id
        ?? data.sectionId
        ?? null;

    const sectionCode =
        enrollmentRecord?.section_code
        ?? data.section_code
        ?? data.sectionCode
        ?? null;

    const sectionName =
        enrollmentRecord?.section_name
        ?? data.section_name
        ?? data.sectionName
        ?? null;

    const hasAssignedSection =
        sectionId !== null && sectionId !== undefined && String(sectionId).trim() !== ''
        || (sectionCode !== null && sectionCode !== undefined && String(sectionCode).trim() !== '')
        || (sectionName !== null && sectionName !== undefined && String(sectionName).trim() !== '');

    return {
        sectionId,
        sectionCode,
        sectionName,
        hasAssignedSection
    };
}

function sectionMatchesActiveYear(section, activeYearKey) {
    if (!activeYearKey) return true;

    const sectionYearId = section && section.school_year_id;
    const sectionYear = section && section.school_year;

    const hasIdMetadata = sectionYearId !== undefined && sectionYearId !== null && String(sectionYearId).trim() !== '';
    const hasStringMetadata = typeof sectionYear === 'string' && String(sectionYear).trim() !== '';
    const hasObjectMetadata = sectionYear && typeof sectionYear === 'object'
        && (String(sectionYear.id || '').trim() !== '' || String(sectionYear.school_year || '').trim() !== '');

    const hasAnyMetadata = hasIdMetadata || hasStringMetadata || hasObjectMetadata;

    // Legacy/tenant data may not have school-year fields set (shows N/A in sections list).
    // In that case, do not block the section from selection.
    if (!hasAnyMetadata) return true;

    const matchesId = hasIdMetadata && String(sectionYearId) === String(activeYearKey);
    const matchesString = hasStringMetadata && String(sectionYear) === String(activeYearKey);
    const matchesObject = hasObjectMetadata
        && (String(sectionYear.id || '') === String(activeYearKey)
            || String(sectionYear.school_year || '') === String(activeYearKey));

    return matchesId || matchesString || matchesObject;
}

// Initialize Section Assignment when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('[SectionAssignment-v2] DOM loaded, initializing...');
    
    // Generate HTML for both tabs
    generateSectionAssignmentHTML();
    generateClassListHTML();
    
    // Load initial data
    loadSectionAssignmentData();
    loadClassListData();
    
    // Setup event listeners
    setupSectionAssignmentListeners();
    setupClassListListeners();
    
    // Setup tab switching
    setupTabSwitching();
    
    console.log('[SectionAssignment-v2] Initialization complete');

    // Listen for enrollment updates from other parts of the app (approve/reject/track change)
    window.addEventListener('storage', (e) => {
        if (!e || !e.key) return;
        if (e.key === 'enrollmentUpdate' || e.key === 'students' || e.key === 'enrollments') {
            console.log('[SectionAssignment-v2] storage event detected:', e.key, '— reloading section assignment data and class list');
            try { 
                loadSectionAssignmentData(); // Reload unassigned students (picks up track changes, section clears, etc.)
            } catch (err) { console.warn('[SectionAssignment-v2] loadSectionAssignmentData failed on storage event', err); }
            try { 
                displayClassList(); // Refresh class list as well
            } catch (err) { console.warn('[SectionAssignment-v2] displayClassList failed on storage event', err); }
        }
    });
});

/**
 * Setup tab switching
 */
function setupTabSwitching() {
    const tabButtons = document.querySelectorAll('.section-tab-btn');
    const tabContents = document.querySelectorAll('.section-tab-content');
    
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.getAttribute('data-tab');
            
            // Remove active from all
            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Add active to clicked
            btn.classList.add('active');
            document.getElementById(tabName).classList.add('active');
            
            // Load data if switching to class list
            if (tabName === 'class-list-tab') {
                loadClassListData();
            }
            
            console.log('[SectionAssignment-v2] Switched to tab:', tabName);
        });
    });
}

/**
 * Generate Section Assignment HTML
 */
function generateSectionAssignmentHTML() {
    const container = document.getElementById('sectionAssignmentContent');
    if (!container) return;
    
    const html = `
        <!-- Messages -->
        <div id="assignmentMessages"></div>
        
        <!-- Section Assignment Content -->
        <div class="content-card">
            <!-- Level Selector (visible at top) -->
            <div class="level-selector">
                <h3>Select School Level</h3>
                <div class="level-buttons">
                    <button class="level-btn active" data-level="JHS">
                        🎒 Junior High School (Grades 7-10)
                    </button>
                    <button class="level-btn" data-level="SHS">
                        📚 Senior High School (Grades 11-12)
                    </button>
                </div>
            </div>
        </div>
        
        <!-- JHS Assignment Form -->
        <div id="jhsAssignmentForm" class="content-card assignment-form">
            <div class="card-header">
                <h3>JHS Student Section Assignment</h3>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="jhsGradeSelect">Grade Level *</label>
                    <select id="jhsGradeSelect" required>
                        <option value="">Select Grade Level</option>
                        <option value="7">Grade 7</option>
                        <option value="8">Grade 8</option>
                        <option value="9">Grade 9</option>
                        <option value="10">Grade 10</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="jhsSectionSelect">Section *</label>
                    <select id="jhsSectionSelect" required>
                        <option value="">Select Section</option>
                    </select>
                </div>
            </div>
            
            <!-- Students Table -->
            <div class="students-section">
                <h4>Unassigned Students</h4>
                
                <div class="search-filter">
                    <input type="text" id="jhsStudentSearch" placeholder="Search by name or LRN...">
                </div>
                
                <div class="table-container">
                    <table class="students-table">
                        <thead>
                            <tr>
                                <th style="width: 50px;">
                                    <input type="checkbox" id="jhsSelectAll">
                                </th>
                                <th>Student Name</th>
                                <th>LRN</th>
                                <th>Gender</th>
                                <th style="width: 150px;">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="jhsStudentsTableBody">
                            <tr><td colspan="5" class="no-data">Select a grade level and section to see students</td></tr>
                        </tbody>
                    </table>
                </div>
                
                <div class="selection-info">
                    <span id="jhsSelectedCount">0 students selected</span>
                </div>
            </div>
            
            <!-- Assignment Actions -->
            <div class="action-buttons">
                <button id="jhsPreviewBtn" class="btn btn-primary" disabled>
                    👁️ Preview Section Assignment
                </button>
                <button id="jhsResetBtn" class="btn btn-secondary">
                    🔄 Reset
                </button>
            </div>
        </div>
        
        <!-- SHS Assignment Form -->
        <div id="shsAssignmentForm" class="content-card assignment-form" style="display: none;">
            <div class="card-header">
                <h3>SHS Student Section Assignment</h3>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="shsGradeSelect">Grade Level *</label>
                    <select id="shsGradeSelect" required>
                        <option value="">Select Grade Level</option>
                        <option value="11">Grade 11</option>
                        <option value="12">Grade 12</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="shsTrackSelect">Track *</label>
                    <select id="shsTrackSelect" required style="display: none;">
                        <option value="">Select Track</option>
                        <option value="Academic">Academic</option>
                        <option value="TechPro">TechPro</option>
                        <option value="Doorway">Doorway</option>
                    </select>
                </div>
            </div>
            
            <!-- Electives Selection -->
            <div id="electivesSection" style="display: none;">
                <div class="form-group">
                    <label>Electives (Select one or more) *</label>
                    <div style="margin-bottom: 15px;">
                        <input 
                            type="text" 
                            id="electivesSearchBar" 
                            placeholder="🔍 Search electives..." 
                            style="width: 100%; padding: 10px 15px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;"
                        />
                    </div>
                    <div id="electivesContainer" class="electives-grid">
                        <!-- Electives will be populated here -->
                    </div>
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="shsSectionSelect">Section *</label>
                    <select id="shsSectionSelect" required>
                        <option value="">Select Section</option>
                    </select>
                </div>
            </div>
            
            <!-- Students Table -->
            <div class="students-section">
                <h4>Unassigned Students</h4>
                
                <div class="search-filter">
                    <input type="text" id="shsStudentSearch" placeholder="Search by name or LRN...">
                </div>
                
                <div class="table-container">
                    <table class="students-table">
                        <thead>
                            <tr>
                                <th style="width: 50px;">
                                    <input type="checkbox" id="shsSelectAll">
                                </th>
                                <th>Student Name</th>
                                <th>LRN</th>
                                <th>Track</th>
                                <th>Elective</th>
                                <th>Gender</th>
                                <th style="width: 150px;">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="shsStudentsTableBody">
                            <tr><td colspan="7" class="no-data">Select grade, track, and electives to see students</td></tr>
                        </tbody>
                    </table>
                </div>
                
                <div class="selection-info">
                    <span id="shsSelectedCount">0 students selected</span>
                </div>
            </div>
            
            <!-- Assignment Actions -->
            <div class="action-buttons">
                <button id="shsPreviewBtn" class="btn btn-primary" disabled>
                    👁️ Preview Section Assignment
                </button>
                <button id="shsResetBtn" class="btn btn-secondary">
                    🔄 Reset
                </button>
            </div>
        </div>
        
        <!-- Preview Modal -->
        <div id="assignmentPreviewModal" class="modal" style="display: none;">
            <div class="modal-content modal-lg">
                <div class="modal-header">
                    <h2>Preview Assignment</h2>
                    <button class="modal-close" id="closePreviewModal">&times;</button>
                </div>
                <div class="modal-body" id="previewModalBody">
                    <!-- Preview content will be populated here -->
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" id="cancelPreviewBtn">Cancel</button>
                    <button class="btn btn-primary" id="confirmAssignmentBtn">Confirm Assignment</button>
                </div>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

/**
 * Generate Class List HTML
 */
function generateClassListHTML() {
    const container = document.getElementById('classListContent');
    if (!container) return;
    
    const html = `
        <div class="content-card">
            <div class="card-header">
                <h3>Class List</h3>
                <p>View, print, and export class lists</p>
            </div>
            
            <!-- Filters -->
            <div class="class-list-filters">
                <div class="form-row">
                    <div class="form-group">
                        <label for="clGradeSelect">Grade Level</label>
                        <select id="clGradeSelect">
                            <option value="">All Grades</option>
                            <option value="7">Grade 7</option>
                            <option value="8">Grade 8</option>
                            <option value="9">Grade 9</option>
                            <option value="10">Grade 10</option>
                            <option value="11">Grade 11 (SHS)</option>
                            <option value="12">Grade 12 (SHS)</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="clSectionSelect">Section</label>
                        <select id="clSectionSelect">
                            <option value="">All Sections</option>
                        </select>
                    </div>
                </div>
                
                <div class="filter-actions">
                    <button class="btn btn-primary" id="clApplyFiltersBtn">Apply Filters</button>
                    <button class="btn btn-secondary" id="clResetFiltersBtn">Reset</button>
                </div>
            </div>
            
            <!-- Class List Display -->
            <div class="class-list-display">
                <div class="list-header">
                    <h4 id="classListTitle">Class List</h4>
                    <div class="list-actions">
                        <button class="btn btn-sm" id="clPrintBtn" title="Print class list">🖨️ Print</button>
                        <button class="btn btn-sm" id="clExportPDFBtn" title="Export as PDF">📄 PDF</button>
                        <button class="btn btn-sm" id="clExportExcelBtn" title="Export as Excel">📊 Excel</button>
                    </div>
                </div>
                
                <div class="table-container">
                    <table class="class-list-table">
                        <thead>
                            <tr>
                                <th style="width:48px;">#</th>
                                <th>Student Name</th>
                                <th>LRN</th>
                                <th style="width:120px;">Status</th>
                            </tr>
                        </thead>
                        <tbody id="classListTableBody">
                            <tr><td colspan="4" class="no-data">Select filters to view class list</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        
        <!-- Print Options Modal -->
        <div id="printOptionsModal" class="modal" style="display:none;">
            <div class="modal-content" style="max-width:520px;padding:18px;">
                <div class="modal-header">
                    <h3>Print Options</h3>
                    <button class="modal-close" id="closePrintOptions">&times;</button>
                </div>
                <div class="modal-body">
                    <div style="margin-bottom:12px;">
                        <label><input type="checkbox" id="optIncludeLRN" checked> Include LRN column</label>
                    </div>
                    <div style="margin-bottom:12px;">
                        <label><input type="checkbox" id="optGroupByGender" checked> Group by gender (Male / Female)</label>
                    </div>
                    <div style="margin-bottom:12px;">
                        <label><input type="checkbox" id="optIncludeHeader" checked> Include header (school name)</label>
                    </div>
                    <div style="margin-bottom:6px;">Orientation:</div>
                    <div style="display:flex;gap:12px;margin-bottom:8px;">
                        <label><input type="radio" name="optOrientation" value="portrait" checked> Portrait</label>
                        <label><input type="radio" name="optOrientation" value="landscape"> Landscape</label>
                    </div>
                </div>
                <div class="modal-footer" style="text-align:right;margin-top:10px;">
                    <button class="btn btn-secondary" id="cancelPrintOptions">Cancel</button>
                    <button class="btn btn-primary" id="applyPrintOptions">Print</button>
                </div>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

/**
 * Load all data needed for section assignment
 */
function loadSectionAssignmentData() {
    console.log('[SectionAssignment-v2] loadSectionAssignmentData: Starting to fetch students and sections');
    
    // Load students
    sectionAssignmentRequest('/api/enrollments')
        .then(enrollments => {
            console.log('[SectionAssignment-v2] loadSectionAssignmentData: Fetched', enrollments.length, 'total enrollments');
            
            const unassigned = (enrollments || [])
                .filter(e => {
                    const status = (e.status || '').toLowerCase();
                    const sectionState = extractSectionAssignmentFromEnrollment(e);
                    const hasSection = sectionState.hasAssignedSection;
                    const isApproved = status === 'approved';
                    const isUnassigned = !hasSection;
                    
                    console.log(`[SectionAssignment-v2] Enrollment check: ${e.first_name || e.student_name || 'Unknown'} - Status: ${e.status} (lower: ${status}) - Approved: ${isApproved} - Has Section: ${hasSection} - Unassigned: ${isUnassigned} - INCLUDE: ${isApproved && isUnassigned}`);
                    
                    return isApproved && isUnassigned;
                });
            
            console.log('[SectionAssignment-v2] loadSectionAssignmentData: Found', unassigned.length, 'unassigned approved enrollments');
            
            if (unassigned.length > 0) {
                console.log('[SectionAssignment-v2] SAMPLE ENROLLMENT RECORD (full):');
                console.log(JSON.stringify(unassigned[0], null, 2));
                console.log('[SectionAssignment-v2] SAMPLE ENROLLMENT RECORD (keys):', Object.keys(unassigned[0]).join(', '));
                console.log('[SectionAssignment-v2] SAMPLE ENROLLMENT enrollment_data:', unassigned[0].enrollment_data);
                if (unassigned[0].enrollment_files) {
                    console.log('[SectionAssignment-v2] SAMPLE ENROLLMENT enrollment_files:', unassigned[0].enrollment_files);
                }
            }
            
            sectionAssignmentState.allStudents = unassigned.map(e => {
                const data = safeParseEnrollmentData(e.enrollment_data);
                
                // Extract name from enrollment_data first (official enrolled name),
                // then fall back to enrollment top-level fields, then account fields.
                const sanitizePart = (v) => {
                    if (!v && v !== 0) return '';
                    const str = String(v).trim();
                    if (str === '--' || str === '-' || str === '–') return '';
                    return str;
                };

                const enrolledFirst = sanitizePart(data.firstName || data.firstname || data.first_name || data.first || '');
                const enrolledMiddle = sanitizePart(data.middleName || data.middlename || data.middle_name || data.middle || '');
                const enrolledLast = sanitizePart(data.lastName || data.lastname || data.last_name || data.last || '');
                const enrolledFull = data.fullName || data.full_name || ((enrolledFirst || enrolledMiddle || enrolledLast) ? `${enrolledFirst} ${enrolledMiddle ? enrolledMiddle + ' ' : ''}${enrolledLast}`.trim() : '');

                const name = (enrolledFull && enrolledFull.trim() !== '') ? enrolledFull
                    : (data.studentName || data.student_name || '')
                    || e.student_name
                    || (e.first_name && e.last_name ? `${e.first_name} ${e.last_name}` : '')
                    || e.first_name
                    || 'Unknown';
                
                // Extract grade from multiple sources, default to parsing from enrollment_data
                const grade = parseInt(
                    e.grade 
                    || data.gradeLevel 
                    || data.currentGrade 
                    || 0
                );
                
                // Extract elective(s) from multiple possible sources and shapes.
                // Support: string, comma-separated string, array of strings,
                // array of objects [{name: '...'}], nested properties, and flexible keys.
                const electiveCandidates = [];

                // DEBUG: Log the full data structure just once per 5 students to understand the shape
                if (Math.random() < 0.2 && !window.__electiveDebugLogged) {
                    window.__electiveDebugLogged = true;
                    console.log('[SectionAssignment-v2] ===== SAMPLE ENROLLMENT DATA STRUCTURE =====');
                    console.log('[SectionAssignment-v2] Full enrollment object keys:', Object.keys(e).join(', '));
                    console.log('[SectionAssignment-v2] Full enrollment object:', JSON.stringify(e, null, 2));
                    console.log('[SectionAssignment-v2] Parsed enrollment_data keys:', Object.keys(data).join(', '));
                    console.log('[SectionAssignment-v2] Parsed enrollment_data:', JSON.stringify(data, null, 2));
                    console.log('[SectionAssignment-v2] ========================================');
                }

                // Add common top-level keys
                electiveCandidates.push(data.elective, data.electives, data.selectedElectives, data.selected_electives, data.elective_choices);
                electiveCandidates.push(e.elective, e.electives);
                
                // Add track-specific elective fields from enrollment form
                electiveCandidates.push(
                    data.academicElectives,
                    data.techproElectives,
                    data.doorwayAcademic,
                    data.doorwayTechPro
                );

                // Add possible nested locations (e.g., data.shs.electives or data.enrollment.shs.electives)
                try {
                    if (data.shs && (data.shs.elective || data.shs.electives)) {
                        electiveCandidates.push(data.shs.elective, data.shs.electives);
                    }
                    if (data.enrollment && (data.enrollment.elective || data.enrollment.electives)) {
                        electiveCandidates.push(data.enrollment.elective, data.enrollment.electives);
                    }
                } catch (err) {
                    // ignore
                }

                // Flatten and normalize into an array of elective strings
                let electiveArray = [];
                for (let cand of electiveCandidates) {
                    if (!cand && cand !== 0) continue;
                    if (typeof cand === 'string') {
                        // If comma-separated, split; else push as single
                        cand.split(',').map(s => s.trim()).filter(Boolean).forEach(s => electiveArray.push(s));
                    } else if (Array.isArray(cand)) {
                        // Array may contain strings or objects
                        cand.forEach(item => {
                            if (!item && item !== 0) return;
                            if (typeof item === 'string') {
                                item.split(',').map(s => s.trim()).filter(Boolean).forEach(s => electiveArray.push(s));
                            } else if (typeof item === 'object') {
                                // Try to extract name-like properties
                                const name = item.name || item.title || item.subject || item.elective || item.value;
                                if (name) {
                                    String(name).split(',').map(s => s.trim()).filter(Boolean).forEach(s => electiveArray.push(s));
                                }
                            }
                        });
                    } else if (typeof cand === 'object') {
                        // Single object with elective-like properties
                        const name = cand.name || cand.title || cand.subject || cand.elective || cand.value;
                        if (name) String(name).split(',').map(s => s.trim()).filter(Boolean).forEach(s => electiveArray.push(s));
                    }
                }

                // Deduplicate and normalize array
                electiveArray = Array.from(new Set(electiveArray.map(s => s.trim()).filter(Boolean)));

                // Create a display string and keep array form for filtering
                const elective = electiveArray.length > 0 ? electiveArray.join(', ') : '';
                
                // DEBUG: Log elective extraction results
                if (grade >= 11) {
                    if (elective) {
                        console.log(`[SectionAssignment-v2] ✅ SHS Student "${name}" (ID: ${e.id}) - Electives: [${elective}]`);
                    } else {
                        console.log(`[SectionAssignment-v2] ⚠️ SHS Student "${name}" (ID: ${e.id}) has NO electives extracted`);
                        console.log(`[SectionAssignment-v2]   Checked candidates: ${electiveCandidates.filter(Boolean).length} non-empty`);
                        console.log(`[SectionAssignment-v2]   data.elective: "${data.elective}"`);
                        console.log(`[SectionAssignment-v2]   data.electives: "${data.electives}"`);
                        console.log(`[SectionAssignment-v2]   data.academicElectives: `, data.academicElectives);
                        console.log(`[SectionAssignment-v2]   data.techproElectives: `, data.techproElectives);
                        console.log(`[SectionAssignment-v2]   data.doorwayAcademic: `, data.doorwayAcademic);
                        console.log(`[SectionAssignment-v2]   data.doorwayTechPro: `, data.doorwayTechPro);
                        console.log(`[SectionAssignment-v2]   e.elective: "${e.elective}"`);
                        console.log(`[SectionAssignment-v2]   e.electives: "${e.electives}"`);
                        if (data.shs) {
                            console.log(`[SectionAssignment-v2]   data.shs.electives: "${data.shs.electives}"`);
                        }
                        // Show all data keys to help identify where electives might be
                        console.log(`[SectionAssignment-v2]   All data keys: ${Object.keys(data).join(', ')}`);
                    }
                }
                
                const studentObj = {
                    id: e.id,
                    student_account_id: e.student_id,
                    name: name,
                    lrn: data.lrn || data.studentID || e.student_id || '',
                    grade: grade,
                    gender: data.sex || data.gender || '',
                    track: data.track || e.track || '',
                    elective: elective,
                    electives: electiveArray,
                    level: grade >= 11 ? 'SHS' : 'JHS',
                    enrollment_id: e.id,
                    status: e.status
                };
                
                // Debug: Log if elective is missing but student has data
                if (!elective && name !== 'Unknown') {
                    console.log(`[SectionAssignment-v2] Student "${name}" (ID: ${e.id}) has no elective. Data:`, {
                        data_elective: data.elective,
                        data_electives: data.electives,
                        e_elective: e.elective,
                        e_electives: e.electives,
                        enrollment_data_keys: Object.keys(data)
                    });
                }
                
                return studentObj;
            });
            
            console.log(`[SectionAssignment-v2] loadSectionAssignmentData: Loaded ${sectionAssignmentState.allStudents.length} unassigned students for section assignment`);
            
            // Debug: Show first 5 students with all their data
            console.log('[SectionAssignment-v2] First 5 loaded students:');
            sectionAssignmentState.allStudents.slice(0, 5).forEach((s, i) => {
                console.log(`  ${i + 1}. ${s.name} (ID:${s.id}) - Grade:${s.grade} Level:${s.level} Track:"${s.track}" Elective:"${s.elective}"`);
            });
        })
        .catch(err => console.error('[SectionAssignment-v2] Error loading students:', err));
    
    // Load sections
    sectionAssignmentRequest('/api/sections')
        .then(sections => {
            sectionAssignmentState.allSections = sections || [];
            console.log(`[SectionAssignment-v2] loadSectionAssignmentData: Loaded ${sectionAssignmentState.allSections.length} sections`);
            if (sectionAssignmentState.allSections.length > 0) {
                console.log('[SectionAssignment-v2] First section object:', JSON.stringify(sectionAssignmentState.allSections[0], null, 2));
            }
        })
        .catch(err => console.error('[SectionAssignment-v2] Error loading sections:', err));
}

/**
 * Setup section assignment event listeners
 */
function setupSectionAssignmentListeners() {
    // Level selector
    document.querySelectorAll('.level-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.level-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const level = btn.getAttribute('data-level');
            sectionAssignmentState.currentLevel = level;
            
            // Show/hide forms
            document.getElementById('jhsAssignmentForm').style.display = level === 'JHS' ? 'block' : 'none';
            document.getElementById('shsAssignmentForm').style.display = level === 'SHS' ? 'block' : 'none';
            
            // Clear selections
            sectionAssignmentState.selectedStudents.clear();
            sectionAssignmentState.selectedSection = null;
            sectionAssignmentState.selectedGrade = null;
            sectionAssignmentState.selectedTrack = null;
            sectionAssignmentState.selectedElectives.clear();
            
            console.log(`[SectionAssignment-v2] Level changed to: ${level}`);
        });
    });
    
    // JHS Grade Select
    document.getElementById('jhsGradeSelect').addEventListener('change', (e) => {
        console.log('[SectionAssignment-v2] JHS Grade Select changed, value:', e.target.value);
        sectionAssignmentState.selectedGrade = e.target.value;
        updateJHSSectionOptions();
        updateJHSStudentsList();
    });
    
    // JHS Section Select
    document.getElementById('jhsSectionSelect').addEventListener('change', (e) => {
        console.log('[SectionAssignment-v2] JHS Section Select changed, value:', e.target.value);
        const sectionId = e.target.value;
        if (sectionId) {
            sectionAssignmentState.selectedSection = sectionAssignmentState.allSections.find(s => String(s.id) === String(sectionId));
            console.log('[SectionAssignment-v2] JHS Selected section:', sectionAssignmentState.selectedSection);
        } else {
            sectionAssignmentState.selectedSection = null;
            console.log('[SectionAssignment-v2] JHS Section cleared');
        }
        updateJHSStudentsList();
    });
    
    // JHS Student Search
    document.getElementById('jhsStudentSearch').addEventListener('input', (e) => {
        updateJHSStudentsList();
    });
    
    // JHS Select All
    document.getElementById('jhsSelectAll').addEventListener('change', (e) => {
        console.log('[SectionAssignment-v2] JHS Select All clicked, checked:', e.target.checked);
        document.querySelectorAll('#jhsStudentsTableBody input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = e.target.checked;
            const studentId = checkbox.getAttribute('data-student-id');
            if (e.target.checked) {
                sectionAssignmentState.selectedStudents.add(studentId);
            } else {
                sectionAssignmentState.selectedStudents.delete(studentId);
            }
        });
        console.log('[SectionAssignment-v2] After JHS Select All, total selected:', sectionAssignmentState.selectedStudents.size);
        updateJHSSelectedCount();
    });
    
    // JHS Preview Button
    document.getElementById('jhsPreviewBtn').addEventListener('click', () => {
        console.log('[SectionAssignment-v2] JHS Preview button clicked');
        console.log('[SectionAssignment-v2] Selected students:', sectionAssignmentState.selectedStudents.size);
        console.log('[SectionAssignment-v2] Selected section:', sectionAssignmentState.selectedSection);
        showAssignmentPreview('JHS');
    });
    
    // JHS Reset Button
    document.getElementById('jhsResetBtn').addEventListener('click', () => {
        document.getElementById('jhsGradeSelect').value = '';
        document.getElementById('jhsSectionSelect').value = '';
        document.getElementById('jhsStudentSearch').value = '';
        document.getElementById('jhsSelectAll').checked = false;
        sectionAssignmentState.selectedStudents.clear();
        sectionAssignmentState.selectedGrade = null;
        sectionAssignmentState.selectedSection = null;
        updateJHSStudentsList();
        updateJHSSelectedCount();
    });
    
    // SHS Grade Select
    document.getElementById('shsGradeSelect').addEventListener('change', (e) => {
        console.log('[SectionAssignment-v2] SHS Grade Select changed, value:', e.target.value);
        sectionAssignmentState.selectedGrade = e.target.value;
        
        // Show track selector
        const trackSelect = document.getElementById('shsTrackSelect');
        trackSelect.style.display = e.target.value ? 'block' : 'none';
        trackSelect.value = '';
        
        // Hide electives and section if grade not selected
        if (!e.target.value) {
            document.getElementById('electivesSection').style.display = 'none';
            document.getElementById('shsSectionSelect').parentElement.style.display = 'none';
        }
        
        // Updated students list WITHOUT clearing selection
        updateSHSStudentsList();
    });
    
    // SHS Track Select
    document.getElementById('shsTrackSelect').addEventListener('change', (e) => {
        sectionAssignmentState.selectedTrack = e.target.value;
        sectionAssignmentState.selectedElectives.clear();
        updateSHSElectivesOptions();
        updateSHSStudentsList();
    });
    
    // SHS Section Select
    document.getElementById('shsSectionSelect').addEventListener('change', (e) => {
        console.log('[SectionAssignment-v2] SHS Section Select changed, value:', e.target.value);
        const sectionId = e.target.value;
        if (sectionId) {
            sectionAssignmentState.selectedSection = sectionAssignmentState.allSections.find(s => String(s.id) === String(sectionId));
            console.log('[SectionAssignment-v2] SHS Selected section:', sectionAssignmentState.selectedSection);
        } else {
            sectionAssignmentState.selectedSection = null;
            console.log('[SectionAssignment-v2] SHS Section cleared');
        }
        updateSHSStudentsList();
    });
    
    // SHS Student Search
    document.getElementById('shsStudentSearch').addEventListener('input', (e) => {
        updateSHSStudentsList();
    });
    
    // SHS Select All
    document.getElementById('shsSelectAll').addEventListener('change', (e) => {
        console.log('[SectionAssignment-v2] SHS Select All clicked, checked:', e.target.checked);
        document.querySelectorAll('#shsStudentsTableBody input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = e.target.checked;
            const studentId = checkbox.getAttribute('data-student-id');
            if (e.target.checked) {
                sectionAssignmentState.selectedStudents.add(studentId);
            } else {
                sectionAssignmentState.selectedStudents.delete(studentId);
            }
        });
        console.log('[SectionAssignment-v2] After SHS Select All, total selected:', sectionAssignmentState.selectedStudents.size);
        updateSHSSelectedCount();
    });
    
    // SHS Preview Button
    document.getElementById('shsPreviewBtn').addEventListener('click', () => {
        console.log('[SectionAssignment-v2] SHS Preview button clicked');
        console.log('[SectionAssignment-v2] Selected students:', sectionAssignmentState.selectedStudents.size);
        console.log('[SectionAssignment-v2] Selected section:', sectionAssignmentState.selectedSection);
        showAssignmentPreview('SHS');
    });
    
    // SHS Reset Button
    document.getElementById('shsResetBtn').addEventListener('click', () => {
        document.getElementById('shsGradeSelect').value = '';
        document.getElementById('shsTrackSelect').value = '';
        document.getElementById('shsStudentSearch').value = '';
        document.getElementById('shsSelectAll').checked = false;
        document.getElementById('electivesSection').style.display = 'none';
        document.getElementById('shsSectionSelect').parentElement.style.display = 'none';
        document.getElementById('shsSectionSelect').value = '';
        
        sectionAssignmentState.selectedStudents.clear();
        sectionAssignmentState.selectedGrade = null;
        sectionAssignmentState.selectedTrack = null;
        sectionAssignmentState.selectedElectives.clear();
        sectionAssignmentState.selectedSection = null;
        updateSHSStudentsList();
        updateSHSSelectedCount();
    });
    
    // Preview Modal Close
    document.getElementById('closePreviewModal')?.addEventListener('click', () => {
        closeAssignmentPreviewModal();
    });
    
    // Preview Modal Cancel
    document.getElementById('cancelPreviewBtn')?.addEventListener('click', () => {
        closeAssignmentPreviewModal();
    });

    // Close preview modal when clicking backdrop
    document.getElementById('assignmentPreviewModal')?.addEventListener('click', (event) => {
        if (event.target && event.target.id === 'assignmentPreviewModal') {
            closeAssignmentPreviewModal();
        }
    });

    // Close preview modal with Escape key
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            const modal = document.getElementById('assignmentPreviewModal');
            if (modal && modal.style.display !== 'none') {
                closeAssignmentPreviewModal();
            }
        }
    });
    
    // Confirm Assignment
    document.getElementById('confirmAssignmentBtn')?.addEventListener('click', () => {
        confirmAssignment();
    });
}

function openAssignmentPreviewModal() {
    const modal = document.getElementById('assignmentPreviewModal');
    if (!modal) return;
    modal.classList.add('active');
    modal.style.display = 'flex';
    modal.style.pointerEvents = 'auto';
    modal.setAttribute('aria-hidden', 'false');
}

function closeAssignmentPreviewModal() {
    const modal = document.getElementById('assignmentPreviewModal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.style.display = 'none';
    modal.style.pointerEvents = 'none';
    modal.setAttribute('aria-hidden', 'true');
}

/**
 * Setup class list event listeners
 */
function setupClassListListeners() {
    document.getElementById('clGradeSelect').addEventListener('change', (e) => {
        sectionAssignmentState.classListFilters.grade = e.target.value;
        updateClassListFilterVisibility();
        updateClassListSectionOptions();
    });
    
    document.getElementById('clSectionSelect').addEventListener('change', (e) => {
        sectionAssignmentState.classListFilters.section = e.target.value;
    });
    
    document.getElementById('clApplyFiltersBtn').addEventListener('click', () => {
        displayClassList();
    });
    
    document.getElementById('clResetFiltersBtn').addEventListener('click', () => {
        document.getElementById('clGradeSelect').value = '';
        document.getElementById('clSectionSelect').value = '';
        sectionAssignmentState.classListFilters = {
            grade: null,
            section: null,
            track: null,
            elective: null
        };
        updateClassListFilterVisibility();
        updateClassListSectionOptions();
        displayClassList();
    });
    
    document.getElementById('clPrintBtn').addEventListener('click', () => {
        openPrintOptionsModal();
    });
    
    document.getElementById('clExportPDFBtn').addEventListener('click', () => {
        exportClassListPDF();
    });
    
    document.getElementById('clExportExcelBtn').addEventListener('click', () => {
        exportClassListExcel();
    });

    // Print options modal actions
    document.getElementById('closePrintOptions')?.addEventListener('click', () => {
        closePrintOptionsModal();
    });
    document.getElementById('cancelPrintOptions')?.addEventListener('click', () => {
        closePrintOptionsModal();
    });
    document.getElementById('applyPrintOptions')?.addEventListener('click', () => {
        // Collect options
        const includeLRN = !!document.getElementById('optIncludeLRN')?.checked;
        const groupByGender = !!document.getElementById('optGroupByGender')?.checked;
        const includeHeader = !!document.getElementById('optIncludeHeader')?.checked;
        const orientationEl = document.querySelector('input[name="optOrientation"]:checked');
        const orientation = orientationEl ? orientationEl.value : 'portrait';

        closePrintOptionsModal();

        printClassList({ includeLRN, groupByGender, includeHeader, orientation });
    });

    // Close print options modal when clicking backdrop
    document.getElementById('printOptionsModal')?.addEventListener('click', (event) => {
        if (event.target && event.target.id === 'printOptionsModal') {
            closePrintOptionsModal();
        }
    });

    // Close print options modal with Escape key
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            const modal = document.getElementById('printOptionsModal');
            if (modal && modal.style.display !== 'none') {
                closePrintOptionsModal();
            }
        }
    });
}

/**
 * Update JHS section options based on selected grade
 */
function updateJHSSectionOptions() {
    const gradeSelect = document.getElementById('jhsGradeSelect');
    const sectionSelect = document.getElementById('jhsSectionSelect');
    const selectedGrade = gradeSelect.value;
    
    console.log('[SectionAssignment-v2] updateJHSSectionOptions called. Grade:', selectedGrade);
    
    sectionSelect.innerHTML = '<option value="">Select Section</option>';
    
    if (!selectedGrade) {
        console.log('[SectionAssignment-v2] No grade selected, returning early');
        return;
    }
    
    // Ensure sections are available; if not, fetch them and then retry
    if (!Array.isArray(sectionAssignmentState.allSections) || sectionAssignmentState.allSections.length === 0) {
        console.log('[SectionAssignment-v2] No sections loaded yet, fetching...');
        sectionAssignmentRequest('/api/sections')
            .then(sections => {
                sectionAssignmentState.allSections = sections || [];
                console.log('[SectionAssignment-v2] Sections fetched on-demand:', sectionAssignmentState.allSections.length);
                if (sectionAssignmentState.allSections.length > 0) {
                    console.log('[SectionAssignment-v2] First section:', JSON.stringify(sectionAssignmentState.allSections[0], null, 2));
                }
                // Re-run population after loading
                updateJHSSectionOptions();
            })
            .catch(err => {
                console.error('[SectionAssignment-v2] Failed to load sections for JHS dropdown:', err);
                sectionSelect.innerHTML = '';
                const option = document.createElement('option');
                option.disabled = true;
                option.textContent = 'Failed to load sections';
                sectionSelect.appendChild(option);
            });
        return;
    }
    
    // Log all loaded sections
    console.log('[SectionAssignment-v2] Total sections loaded:', sectionAssignmentState.allSections.length);
    if (sectionAssignmentState.allSections.length > 0) {
        console.log('[SectionAssignment-v2] Sample section:', JSON.stringify(sectionAssignmentState.allSections[0], null, 2));
    }
    
    // Determine active school year (object) from window or localStorage
    const activeYearObj = window.activeSchoolYear || (function(){ try { return JSON.parse(localStorage.getItem('activeSchoolYear') || 'null'); } catch(e){ return null; } })();
    const activeYearKey = activeYearObj ? (activeYearObj.id || activeYearObj.school_year) : null;
    
    console.log('[SectionAssignment-v2] Active year object:', activeYearObj);
    console.log('[SectionAssignment-v2] Active year key (to match):', activeYearKey);

    const sections = sectionAssignmentState.allSections.filter(s => {
        const grade = String(s.grade_level || s.grade || '');
        const gradeMatcher = (grade === selectedGrade || String(grade) === String(selectedGrade));
        
        console.log(`[SectionAssignment-v2] Section "${s.section_name}" - grade_level:"${s.grade_level}" grade:"${s.grade}" combined:"${grade}" selected:"${selectedGrade}" matches:${gradeMatcher}`);
        console.log(`[SectionAssignment-v2]   All fields:`, Object.keys(s).join(', '));
        
        // Must match grade
        if (!gradeMatcher) {
            console.log(`[SectionAssignment-v2]   → Rejected: grade mismatch`);
            return false;
        }

        // If active school year is set, match when metadata exists; allow sections with no year metadata.
        if (activeYearKey) {
            const yearMatch = sectionMatchesActiveYear(s, activeYearKey);
            console.log(`[SectionAssignment-v2]   school_year_id:"${s.school_year_id}" school_year:"${s.school_year}" yearMatch:${yearMatch}`);
            if (yearMatch) {
                console.log(`[SectionAssignment-v2]   → Accepted: school year compatible`);
                return true;
            }
            console.log(`[SectionAssignment-v2]   → Rejected: school year mismatch`);
            return false;
        }
        
        console.log(`[SectionAssignment-v2]   → Accepted: no year filter (activeYearKey is null/undefined)`);
        return true;
    });
    
    console.log('[SectionAssignment-v2] Final filtered sections count:', sections.length);
    
    sections.forEach(s => {
        const option = document.createElement('option');
        option.value = s.id;
        option.textContent = `${s.section_name} (${s.section_code || ''})`;
        sectionSelect.appendChild(option);
    });
    
    if (sections.length === 0) {
        const option = document.createElement('option');
        option.disabled = true;
        option.textContent = 'No sections available';
        sectionSelect.appendChild(option);
    }
}

/**
 * Update JHS students list based on filters
 */
function updateJHSStudentsList() {
    const grade = document.getElementById('jhsGradeSelect').value;
    const search = document.getElementById('jhsStudentSearch').value.toLowerCase();
    const sectionId = document.getElementById('jhsSectionSelect').value;
    
    let students = sectionAssignmentState.allStudents.filter(s => 
        s.level === 'JHS' && String(s.grade) === grade
    );
    
    if (search) {
        students = students.filter(s =>
            (s.name || '').toLowerCase().includes(search) ||
            (s.lrn || '').toLowerCase().includes(search)
        );
    }
    
    const tbody = document.getElementById('jhsStudentsTableBody');
    tbody.innerHTML = '';
    
    if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="no-data">No students found</td></tr>';
        return;
    }
    
    students.forEach(student => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <input type="checkbox" data-student-id="${student.id}" class="student-checkbox">
            </td>
            <td>${student.name}</td>
            <td>${student.lrn}</td>
            <td>${student.gender}</td>
            <td>
                <button class="btn btn-sm btn-info" onclick="viewStudentDetails('${student.lrn}')">
                    👁️ View
                </button>
            </td>
        `;
        tbody.appendChild(tr);
        
        // Set checkbox state if student is already selected
        const checkbox = tr.querySelector('input[type="checkbox"]');
        if (sectionAssignmentState.selectedStudents.has(student.id)) {
            checkbox.checked = true;
            console.log('[SectionAssignment-v2] Showing student as checked:', student.name, 'ID:', student.id);
        }
        
        // Add checkbox listener
        checkbox.addEventListener('change', (e) => {
            console.log('[SectionAssignment-v2] Student checkbox changed:', student.name, 'checked:', e.target.checked);
            if (e.target.checked) {
                sectionAssignmentState.selectedStudents.add(student.id);
                console.log('[SectionAssignment-v2] Added student to selection:', student.id, 'total selected:', sectionAssignmentState.selectedStudents.size);
            } else {
                sectionAssignmentState.selectedStudents.delete(student.id);
                console.log('[SectionAssignment-v2] Removed student from selection:', student.id, 'total selected:', sectionAssignmentState.selectedStudents.size);
                document.getElementById('jhsSelectAll').checked = false;
            }
            updateJHSSelectedCount();
        });
    });
    
    // Update Select All checkbox state
    const allTableCheckboxes = document.querySelectorAll('#jhsStudentsTableBody input[type="checkbox"]');
    const allSelected = allTableCheckboxes.length > 0 && Array.from(allTableCheckboxes).every(cb => cb.checked);
    document.getElementById('jhsSelectAll').checked = allSelected;
    console.log('[SectionAssignment-v2] JHS Select All checkbox updated:', allSelected, 'visible:', allTableCheckboxes.length);
    
    updateJHSSelectedCount();
}

/**
 * Update JHS selected count
 */
function updateJHSSelectedCount() {
    const count = sectionAssignmentState.selectedStudents.size;
    const isDisabled = count === 0 || !sectionAssignmentState.selectedSection;
    console.log('[SectionAssignment-v2] updateJHSSelectedCount - count:', count, 'section:', !!sectionAssignmentState.selectedSection, 'disabled:', isDisabled);
    document.getElementById('jhsSelectedCount').textContent = `${count} student${count !== 1 ? 's' : ''} selected`;
    document.getElementById('jhsPreviewBtn').disabled = isDisabled;
}

/**
 * Update SHS electives options - organized by category
 */
function updateSHSElectivesOptions() {
    const track = sectionAssignmentState.selectedTrack;
    const electivesSection = document.getElementById('electivesSection');
    const container = document.getElementById('electivesContainer');
    
    if (!track) {
        electivesSection.style.display = 'none';
        return;
    }
    
    electivesSection.style.display = 'block';
    container.innerHTML = '';
    
    console.log('[SectionAssignment-v2] Rendering electives for track:', track);
    
    // Get electives by category for this track
    const electivesByCategory = getElectivesByTrackAndCategory(track);
    
    if (!electivesByCategory || Object.keys(electivesByCategory).length === 0) {
        container.innerHTML = '<p class="no-data">No electives available for this track</p>';
        return;
    }
    
    // Create wrapper for categories grid
    const categoriesWrapper = document.createElement('div');
    categoriesWrapper.className = 'electives-categories-wrapper';
    
    // Display electives organized by category in columns
    Object.entries(electivesByCategory).forEach(([category, electives]) => {
        // Create category column container
        const categoryColumn = document.createElement('div');
        categoryColumn.className = 'electives-category';
        
        // Create category header
        const categoryHeader = document.createElement('div');
        categoryHeader.className = 'electives-category-header';
        categoryHeader.innerHTML = `<h4>${category}</h4>`;
        categoryColumn.appendChild(categoryHeader);
        
        // Create checkboxes container for category items
        const categoryContainer = document.createElement('div');
        categoryContainer.className = 'electives-category-items';
        
        electives.forEach(elective => {
            const label = document.createElement('label');
            label.className = 'elective-checkbox';
            label.innerHTML = `
                <input type="checkbox" value="${elective}" data-elective="${elective}" data-category="${category}">
                <span>${elective}</span>
            `;
            label.querySelector('input').addEventListener('change', (e) => {
                if (e.target.checked) {
                    sectionAssignmentState.selectedElectives.add(elective);
                    console.log('[SectionAssignment-v2] Selected elective:', elective);
                } else {
                    sectionAssignmentState.selectedElectives.delete(elective);
                    console.log('[SectionAssignment-v2] Deselected elective:', elective);
                }
                updateSHSSectionOptions();
                updateSHSStudentsList();
            });
            categoryContainer.appendChild(label);
        });
        
        categoryColumn.appendChild(categoryContainer);
        categoriesWrapper.appendChild(categoryColumn);
    });
    
    container.appendChild(categoriesWrapper);
    
    // Setup electives search functionality
    setupElectivesSearch();
    
    // Show section selector
    document.getElementById('shsSectionSelect').parentElement.style.display = 'block';
    updateSHSSectionOptions();
}

/**
 * Setup search functionality for electives
 */
function setupElectivesSearch() {
    const searchBar = document.getElementById('electivesSearchBar');
    if (!searchBar) return;
    
    searchBar.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        const container = document.getElementById('electivesContainer');
        const categories = container.querySelectorAll('.electives-category');
        let visibleCount = 0;
        
        categories.forEach(category => {
            const categoryItems = category.querySelectorAll('.elective-checkbox');
            let categoryHasVisible = false;
            
            categoryItems.forEach(item => {
                const electiveText = item.textContent.toLowerCase().trim();
                if (searchTerm === '' || electiveText.includes(searchTerm)) {
                    item.style.display = '';
                    categoryHasVisible = true;
                    visibleCount++;
                } else {
                    item.style.display = 'none';
                }
            });
            
            // Show or hide the category if it has visible items
            if (categoryHasVisible) {
                category.style.display = '';
            } else {
                category.style.display = 'none';
            }
        });
        
        // Show message if no matches found
        if (visibleCount === 0 && searchTerm !== '') {
            const noResultsMsg = container.querySelector('.no-search-results');
            if (noResultsMsg) {
                noResultsMsg.style.display = 'block';
            } else {
                const msg = document.createElement('p');
                msg.className = 'no-search-results';
                msg.textContent = `No electives found matching "${searchTerm}"`;
                msg.style.cssText = 'text-align: center; color: #999; padding: 20px; grid-column: 1 / -1;';
                container.appendChild(msg);
            }
        } else {
            const noResultsMsg = container.querySelector('.no-search-results');
            if (noResultsMsg) {
                noResultsMsg.style.display = 'none';
            }
        }
    });
}

/**
 * Get electives by category for a specific track
 */
function getElectivesByTrackAndCategory(track) {
    // Prefer structured categories from window.ELECTIVES (accept flexible key casing)
    const E = window.ELECTIVES || null;
    const map = window.electivesMap || null;

    // Helper to safely get academic/techpro keys with flexible casing
    const getAcad = () => (E && (E.academic || E.Academic || E.ACADEMIC)) || null;
    const getTech = () => (E && (E.techpro || E.TechPro || E.TECHPRO)) || null;

    // Normalize data: if array return as-is, if object expect it to have categories
    const normalizeToCategories = (data) => {
        if (!data) return {};
        if (Array.isArray(data)) return { 'Electives': data };
        return data; // assume it's an object { categoryName: [...] }
    };

    // Try window.ELECTIVES first
    if (E) {
        const acad = getAcad();
        const tech = getTech();

        if (track === 'Academic') {
            return normalizeToCategories(acad);
        }
        if (track === 'TechPro') {
            return normalizeToCategories(tech);
        }
        if (track === 'Doorway') {
            // Merge both tracks' categories with prefixes for clarity in UI
            const result = {};
            const acadNorm = normalizeToCategories(acad);
            const techNorm = normalizeToCategories(tech);

            Object.entries(acadNorm).forEach(([cat, items]) => {
                result[`Academic - ${cat}`] = items;
            });
            Object.entries(techNorm).forEach(([cat, items]) => {
                result[`TechPro - ${cat}`] = items;
            });

            return result;
        }
    }

    // Fallback: use electivesMap - handle both flat arrays and category objects
    if (map) {
        const acadData = map['Academic'] || map['academic'] || null;
        const techData = map['TechPro'] || map['techpro'] || null;

        const acadNorm = normalizeToCategories(acadData);
        const techNorm = normalizeToCategories(techData);

        if (track === 'Academic') {
            return acadNorm;
        }
        if (track === 'TechPro') {
            return techNorm;
        }
        if (track === 'Doorway') {
            // Merge both with track prefixes
            const result = {};
            Object.entries(acadNorm).forEach(([cat, items]) => {
                result[`Academic - ${cat}`] = items;
            });
            Object.entries(techNorm).forEach(([cat, items]) => {
                result[`TechPro - ${cat}`] = items;
            });
            return result;
        }
    }

    console.warn('[SectionAssignment-v2] No electives found for track:', track);
    return {};
}

/**
 * Update SHS section options - filter by grade, track, and optionally by selected electives
 */
function updateSHSSectionOptions() {
    const gradeSelect = document.getElementById('shsGradeSelect');
    const sectionSelect = document.getElementById('shsSectionSelect');
    const track = sectionAssignmentState.selectedTrack;
    const selectedElectives = Array.from(sectionAssignmentState.selectedElectives);
    const grade = gradeSelect.value;
    
    sectionSelect.innerHTML = '<option value="">Select Section</option>';
    
    console.log('[SectionAssignment-v2] updateSHSSectionOptions called');
    console.log('[SectionAssignment-v2] Grade:', grade);
    console.log('[SectionAssignment-v2] Track:', track);
    console.log('[SectionAssignment-v2] Selected electives:', selectedElectives);
    
    // MUST have grade and track to proceed
    if (!grade || !track) {
        console.log('[SectionAssignment-v2] No grade or track selected, cannot show sections');
        return;
    }
    
    // Determine active school year (object) from window or localStorage
    const activeYearObj = window.activeSchoolYear || (function(){ 
        try { 
            return JSON.parse(localStorage.getItem('activeSchoolYear') || 'null'); 
        } catch(e){ 
            return null; 
        } 
    })();
    const activeYearKey = activeYearObj ? (activeYearObj.id || activeYearObj.school_year) : null;

    const sections = sectionAssignmentState.allSections.filter(s => {
        // Must match grade and track
        const matchGrade = String(s.grade_level || s.grade) === String(grade);
        const matchTrack = String((s.track || '')).toLowerCase() === String(track || '').toLowerCase();
        
        if (!matchGrade || !matchTrack) {
            return false;
        }
        
        // If electives are selected, filter by them (optional)
        if (selectedElectives.length > 0) {
            let sectionElectives = [];
            if (typeof s.electives === 'string' && s.electives.trim()) {
                sectionElectives = s.electives.split(',').map(e => e.trim());
            } else if (Array.isArray(s.electives)) {
                sectionElectives = s.electives;
            }
            
            // Check if any selected elective matches any section elective
            const matchElective = selectedElectives.some(e => sectionElectives.some(se => 
                se.toLowerCase().trim() === e.toLowerCase().trim()
            ));
            
            if (!matchElective) {
                console.log('[SectionAssignment-v2] Section electives mismatch:', sectionElectives, 'vs', selectedElectives);
                return false;
            }
        }

        // Check school year if active year is set (allow sections lacking school-year metadata)
        if (activeYearKey) {
            return sectionMatchesActiveYear(s, activeYearKey);
        }

        return true;
    });
    
    console.log('[SectionAssignment-v2] Filtered sections count:', sections.length);
    console.log('[SectionAssignment-v2] All sections count:', sectionAssignmentState.allSections.length);
    if (sectionAssignmentState.allSections.length > 0) {
        console.log('[SectionAssignment-v2] Sample section:', JSON.stringify(sectionAssignmentState.allSections[0], null, 2));
    }
    
    sections.forEach(s => {
        const option = document.createElement('option');
        option.value = s.id;
        const sectionLabel = `${s.section_name || 'Section'} (${s.section_code || s.id})`;
        option.textContent = sectionLabel;
        sectionSelect.appendChild(option);
        console.log('[SectionAssignment-v2] Added section option:', sectionLabel, 'Track:', s.track, 'Grade:', s.grade_level);
    });
    
    if (sections.length === 0) {
        const option = document.createElement('option');
        option.disabled = true;
        option.textContent = selectedElectives.length > 0 
            ? 'No sections available for selected track and electives' 
            : 'No sections available for selected track (try selecting electives)';
        sectionSelect.appendChild(option);
        console.log('[SectionAssignment-v2] No sections available for this combination');
    }
}

/**
 * Update SHS students list
 */
function updateSHSStudentsList() {
    const grade = parseInt(document.getElementById('shsGradeSelect').value) || 0;
    const track = sectionAssignmentState.selectedTrack;
    const selectedElectives = Array.from(sectionAssignmentState.selectedElectives);
    const search = document.getElementById('shsStudentSearch').value.toLowerCase();
    
    console.log('[SectionAssignment-v2] updateSHSStudentsList called');
    console.log('[SectionAssignment-v2] Grade:', grade);
    console.log('[SectionAssignment-v2] Track:', track);
    console.log('[SectionAssignment-v2] Selected electives:', selectedElectives);
    console.log('[SectionAssignment-v2] Search term:', search);
    console.log('[SectionAssignment-v2] Total available students:', sectionAssignmentState.allStudents.length);
    
    // DEBUG: Show all student grades and levels
    const grades = sectionAssignmentState.allStudents.map(s => `${s.name}:G${s.grade}:${s.level}:T"${s.track}"`);
    console.log('[SectionAssignment-v2] All students (name:grade:level:track):', grades.join(', '));
    
    let students = sectionAssignmentState.allStudents.filter(s =>
        s.level === 'SHS' && s.grade === grade
    );
    
    console.log('[SectionAssignment-v2] Students after grade filter:', students.length);
    
    if (track) {
        // Filter by track - show students with matching track or no track assigned yet
        // Case-insensitive comparison
        const trackLower = track.toLowerCase().trim();
        students = students.filter(s => {
            const studentTrackLower = (s.track || '').toLowerCase().trim();
            // Include if: track matches OR student has no track data yet
            return studentTrackLower === trackLower || studentTrackLower === '';
        });
        console.log('[SectionAssignment-v2] Students after track filter:', students.length);
        console.log('[SectionAssignment-v2] Track filter applied:', track);
        console.log('[SectionAssignment-v2] Sample student tracks:', students.slice(0, 3).map(s => ({ name: s.name, track: s.track })));
    }
    
    if (selectedElectives.length > 0) {
        const selectedNorm = selectedElectives.map(e => String(e).toLowerCase().trim()).filter(Boolean);
        students = students.filter(s => {
            // Student may have array `electives` (preferred) or string `elective`
            let studentElectiveArray = [];
            if (Array.isArray(s.electives) && s.electives.length > 0) {
                studentElectiveArray = s.electives.map(x => String(x).toLowerCase().trim()).filter(Boolean);
            } else if (s.elective && String(s.elective).trim()) {
                studentElectiveArray = String(s.elective).split(',').map(x => x.toLowerCase().trim()).filter(Boolean);
            }

            // If student has no elective info, include them (admin may want to assign)
            if (studentElectiveArray.length === 0) return true;

            // Check if any selected elective matches any of student's electives
            return selectedNorm.some(sel => studentElectiveArray.some(se => se === sel));
        });
        console.log('[SectionAssignment-v2] Students after elective filter:', students.length);
        console.log('[SectionAssignment-v2] Electives filter applied:', selectedElectives);
    }
    
    if (search) {
        students = students.filter(s =>
            (s.name || '').toLowerCase().includes(search) ||
            (s.lrn || '').toLowerCase().includes(search)
        );
        console.log('[SectionAssignment-v2] Students after search filter:', students.length);
    }
    
    const tbody = document.getElementById('shsStudentsTableBody');
    tbody.innerHTML = '';
    
    if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="no-data">No students found</td></tr>';
        console.log('[SectionAssignment-v2] Empty student list after all filters');
        return;
    }
    
    students.forEach(student => {
        const tr = document.createElement('tr');
        const electiveDisplay = student.elective || '(Not Selected)';
        tr.innerHTML = `
            <td>
                <input type="checkbox" data-student-id="${student.id}" class="student-checkbox">
            </td>
            <td>${student.name}</td>
            <td>${student.lrn}</td>
            <td>${student.track}</td>
            <td>${electiveDisplay}</td>
            <td>${student.gender}</td>
            <td>
                <button class="btn btn-sm btn-info" onclick="viewStudentDetails('${student.lrn}')">
                    👁️ View
                </button>
            </td>
        `;
        tbody.appendChild(tr);
        
        // Set checkbox state if student is already selected
        const checkbox = tr.querySelector('input[type="checkbox"]');
        if (sectionAssignmentState.selectedStudents.has(student.id)) {
            checkbox.checked = true;
            console.log('[SectionAssignment-v2] Showing SHS student as checked:', student.name, 'ID:', student.id);
        }
        
        // Add checkbox listener
        checkbox.addEventListener('change', (e) => {
            console.log('[SectionAssignment-v2] SHS Student checkbox changed:', student.name, 'checked:', e.target.checked);
            if (e.target.checked) {
                sectionAssignmentState.selectedStudents.add(student.id);
                console.log('[SectionAssignment-v2] Added SHS student to selection:', student.id, 'total selected:', sectionAssignmentState.selectedStudents.size);
            } else {
                sectionAssignmentState.selectedStudents.delete(student.id);
                console.log('[SectionAssignment-v2] Removed SHS student from selection:', student.id, 'total selected:', sectionAssignmentState.selectedStudents.size);
                document.getElementById('shsSelectAll').checked = false;
            }
            updateSHSSelectedCount();
        });
    });
    
    // Update Select All checkbox state
    const allTableCheckboxes = document.querySelectorAll('#shsStudentsTableBody input[type="checkbox"]');
    const allSelected = allTableCheckboxes.length > 0 && Array.from(allTableCheckboxes).every(cb => cb.checked);
    document.getElementById('shsSelectAll').checked = allSelected;
    console.log('[SectionAssignment-v2] SHS Select All checkbox updated:', allSelected, 'visible:', allTableCheckboxes.length);
    
    updateSHSSelectedCount();
}

/**
 * Update SHS selected count
 */
function updateSHSSelectedCount() {
    const count = sectionAssignmentState.selectedStudents.size;
    document.getElementById('shsSelectedCount').textContent = `${count} student${count !== 1 ? 's' : ''} selected`;
    document.getElementById('shsPreviewBtn').disabled = count === 0 || !sectionAssignmentState.selectedSection;
}

/**
 * Show assignment preview modal
 */
function showAssignmentPreview(level) {
    console.log('[SectionAssignment-v2] showAssignmentPreview called with level:', level);
    console.log('[SectionAssignment-v2] allStudents count:', sectionAssignmentState.allStudents.length);
    console.log('[SectionAssignment-v2] selectedStudents set size:', sectionAssignmentState.selectedStudents.size);
    console.log('[SectionAssignment-v2] selectedStudents content:', Array.from(sectionAssignmentState.selectedStudents));
    
    // Filter with flexible ID matching (handles both string and numeric IDs)
    const students = sectionAssignmentState.allStudents.filter(s => {
        const selected = sectionAssignmentState.selectedStudents.has(s.id);
        const selectedAsString = sectionAssignmentState.selectedStudents.has(String(s.id));
        const match = selected || selectedAsString;
        if (match) {
            console.log('[SectionAssignment-v2] Student matched:', s.name, 'ID:', s.id, 'as string:', String(s.id));
        }
        return match;
    });
    
    console.log('[SectionAssignment-v2] Filtered students count:', students.length);
    console.log('[SectionAssignment-v2] Selected section:', sectionAssignmentState.selectedSection);
    
    if (students.length === 0) {
        console.log('[SectionAssignment-v2] Preview validation failed - no students selected');
        console.log('[SectionAssignment-v2] allStudents sample IDs:', sectionAssignmentState.allStudents.slice(0, 3).map(s => ({ name: s.name, id: s.id, idType: typeof s.id })));
        console.log('[SectionAssignment-v2] selectedStudents sample:', Array.from(sectionAssignmentState.selectedStudents).slice(0, 3));
        showMessage('error', '❌ Please select students (none found in selection)');
        return;
    }
    
    if (!sectionAssignmentState.selectedSection) {
        console.log('[SectionAssignment-v2] Preview validation failed - no section selected');
        showMessage('error', '❌ Please select a section');
        return;
    }
    
    const section = sectionAssignmentState.selectedSection;
    const modalBody = document.getElementById('previewModalBody');
    
    console.log('[SectionAssignment-v2] Modal body element:', modalBody);
    console.log('[SectionAssignment-v2] Section object all fields:', Object.keys(section), section);
    
    if (!modalBody) {
        console.error('[SectionAssignment-v2] previewModalBody element not found!');
        return;
    }
    
    // Determine grade level from section object
    const gradeLevel = section.grade_level || section.grade || 'Unknown';
    
    let previewHTML = `
        <div class="preview-content">
            <div class="preview-section-info">
                <h3>📋 Assignment Details</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <label>Section:</label>
                        <strong>${section.section_name}</strong>
                    </div>
                    <div class="info-item">
                        <label>Grade Level:</label>
                        <strong>Grade ${gradeLevel}</strong>
                    </div>
    `;
    
    if (level === 'SHS') {
        previewHTML += `
                    <div class="info-item">
                        <label>Track:</label>
                        <strong>${section.track}</strong>
                    </div>
                    <div class="info-item">
                        <label>Electives:</label>
                        <strong>${Array.isArray(section.electives) ? section.electives.join(', ') : section.electives}</strong>
                    </div>
        `;
    }
    
    previewHTML += `
                </div>
            </div>
            
            <div class="preview-students">
                <h3>👥 Students to Assign (${students.length})</h3>
                <div class="students-preview-list">
    `;
    
    students.forEach((s, idx) => {
        previewHTML += `
                    <div class="student-preview-item">
                        <span class="student-number">${idx + 1}</span>
                        <span class="student-name">${s.name}</span>
                        <span class="student-lrn">${s.lrn}</span>
                    </div>
        `;
    });
    
    previewHTML += `
                </div>
            </div>
        </div>
    `;
    
    console.log('[SectionAssignment-v2] Setting modal body innerHTML');
    modalBody.innerHTML = previewHTML;

    openAssignmentPreviewModal();
}

/**
 * Confirm and execute assignment
 */
function confirmAssignment() {
    const students = Array.from(sectionAssignmentState.selectedStudents)
        .map(id => String(id || '').trim())
        .filter(id => id.length > 0);
    const sectionId = sectionAssignmentState.selectedSection?.id;
    const apiCandidates = resolveApiBaseCandidates();
    
    console.log('[SectionAssignment-v2] confirmAssignment starting');
    console.log('[SectionAssignment-v2] API candidates:', apiCandidates);
    console.log('[SectionAssignment-v2] Section ID:', sectionId);
    console.log('[SectionAssignment-v2] Student IDs to assign:', students);
    console.log('[SectionAssignment-v2] Student count:', students.length);
    
    if (!students.length || !sectionId) {
        showMessage('error', '❌ Invalid assignment data');
        return;
    }
    
    const confirmBtn = document.getElementById('confirmAssignmentBtn');
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '⏳ Assigning...';
    
    const requestBody = { student_ids: students };

    console.log('[SectionAssignment-v2] Making POST request to:', `/api/sections/${sectionId}/assign-students`);
    console.log('[SectionAssignment-v2] Request body:', JSON.stringify(requestBody));

    sectionAssignmentRequest(`/api/sections/${sectionId}/assign-students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    })
    .then(data => {
        console.log('[SectionAssignment-v2] Assignment successful. Response:', data);
        showMessage('success', '✅ Students successfully assigned to the section!');
        
        // Create notifications for each assigned student
        const sectionName = sectionAssignmentState.selectedSection?.section_name || 'Section';
        console.log('[SectionAssignment-v2] Creating notifications for', students.length, 'students');
        students.forEach(studentId => {
            const student = sectionAssignmentState.allStudents.find(s => String(s.id || s.lrn) === String(studentId));
            console.log('[SectionAssignment-v2] Processing student:', studentId);
            console.log('[SectionAssignment-v2] Found student object:', student ? JSON.stringify(student, null, 2) : 'NOT FOUND');
            const notificationStudentId = student && (student.student_account_id || student.student_id || null);
            if (notificationStudentId) {
                const notificationPayload = {
                    student_id: notificationStudentId,
                    type: 'section_assigned',
                    title: '📍 Section Assignment',
                    message: `You have been assigned to ${sectionName}. Check the dashboard for your schedule and class details.`,
                    related_data: {
                        section_id: sectionId,
                        section_name: sectionName,
                        assigned_at: new Date().toISOString()
                    }
                };
                console.log('[SectionAssignment-v2] Sending notification payload:', JSON.stringify(notificationPayload, null, 2));
                sectionAssignmentRequest('/api/notifications', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(notificationPayload)
                }).then(notificationResult => {
                    console.log('[SectionAssignment-v2] Notification created:', notificationResult);
                }).catch(err => {
                    console.warn('[SectionAssignment-v2] Failed to create notification for student:', studentId, err);
                    // Don't fail the assignment if notification fails
                });
            } else {
                console.warn('[SectionAssignment-v2] Cannot create notification - student account ID missing for enrollment ID:', studentId);
            }
        });
        console.log('[SectionAssignment-v2] Notification requests sent for', students.length, 'students');
        
        if ((data && typeof data.assigned_count === 'number' && data.assigned_count <= 0) || data?.success === false) {
            showMessage('warning', '⚠️ No students were assigned. Please verify the selected section and students.');
            return;
        }

        closeAssignmentPreviewModal();
        
        // Reset forms and reload data
        if (sectionAssignmentState.currentLevel === 'JHS') {
            document.getElementById('jhsResetBtn').click();
        } else {
            document.getElementById('shsResetBtn').click();
        }
        
        console.log('[SectionAssignment-v2] Reloading section assignment data');
        loadSectionAssignmentData();
        
        console.log('[SectionAssignment-v2] Reloading class list data');
        loadClassListData();
        
        // Auto-display class list if it's switched to that tab
        setTimeout(() => {
            console.log('[SectionAssignment-v2] Calling displayClassList');
            displayClassList();
        }, 500);
    })
    .catch(err => {
        console.error('[SectionAssignment-v2] Assignment failed:', err);
        console.error('[SectionAssignment-v2] Error stack:', err.stack);
        showMessage('error', `❌ Error: ${err.message}`);
    })
    .finally(() => {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = 'Confirm Assignment';
    });
}

/**
 * Load class list data
 */
function loadClassListData() {
    console.log('[SectionAssignment-v2] loadClassListData starting');

    sectionAssignmentRequest('/api/sections')
        .then(sections => {
            sectionAssignmentState.allSections = sections || [];
            console.log('[SectionAssignment-v2] loadClassListData: Loaded', sectionAssignmentState.allSections.length, 'sections');
            updateClassListFilterVisibility();
            updateClassListSectionOptions();
            updateClassListElectiveOptions();
        })
        .catch(err => console.error('[SectionAssignment-v2] Error loading sections for class list:', err));
}

/**
 * Update class list section options
 */
function updateClassListSectionOptions() {
    const sectionSelect = document.getElementById('clSectionSelect');
    const gradeFilter = document.getElementById('clGradeSelect').value;
    
    console.log('[SectionAssignment-v2] updateClassListSectionOptions called with grade:', gradeFilter);
    console.log('[SectionAssignment-v2] Available sections:', sectionAssignmentState.allSections.length);
    
    sectionSelect.innerHTML = '<option value="">Select Section</option>';

    // If no grade selected, leave the default option
    if (!gradeFilter) return;

    // Helper to determine if a section's grade matches the selected grade
    function matchesGrade(section, gradeValue) {
        // Try multiple possible property names and formats
        const candidates = [section.grade_level, section.grade, section.gradeLevel, section.level];
        for (let c of candidates) {
            if (c === undefined || c === null) continue;
            const s = String(c).trim();
            if (!s) continue;

            // Exact string match
            if (s === gradeValue) return true;

            // Numeric match: extract first number
            const m = s.match(/(\d{1,2})/);
            if (m && String(m[1]) === String(gradeValue)) return true;
        }

        return false;
    }

    // Ensure sections are available; if not, fetch them and then retry
    if (!Array.isArray(sectionAssignmentState.allSections) || sectionAssignmentState.allSections.length === 0) {
        sectionAssignmentRequest('/api/sections')
            .then(sections => {
                sectionAssignmentState.allSections = sections || [];
                console.log('[SectionAssignment-v2] Sections loaded for class list dropdown:', sectionAssignmentState.allSections.length);
                // Re-run population after loading
                updateClassListSectionOptions();
            })
            .catch(err => {
                console.error('[SectionAssignment-v2] Failed to load sections for class list dropdown:', err);
                sectionSelect.innerHTML = '';
                const option = document.createElement('option');
                option.disabled = true;
                option.textContent = 'Failed to load sections';
                sectionSelect.appendChild(option);
            });
        return;
    }

    // Determine active school year (object) from window or localStorage
    const activeYearObj = window.activeSchoolYear || (function(){ try { return JSON.parse(localStorage.getItem('activeSchoolYear') || 'null'); } catch(e){ return null; } })();
    const activeYearKey = activeYearObj ? (activeYearObj.id || activeYearObj.school_year) : null;

    const sections = sectionAssignmentState.allSections.filter(s => {
        // Must match grade
        if (!matchesGrade(s, gradeFilter)) return false;

        // If active school year is set, match when metadata exists; allow sections with no year metadata
        if (activeYearKey) {
            return sectionMatchesActiveYear(s, activeYearKey);
        }
        return true;
    });

    console.log('[SectionAssignment-v2] Filtered sections for grade', gradeFilter, ':', sections.length);
    
    sections.forEach(s => {
        const option = document.createElement('option');
        option.value = s.id;
        option.textContent = `${s.section_name || s.name || 'Section'}${s.section_code ? ` (${s.section_code})` : ''}`;
        sectionSelect.appendChild(option);
        console.log('[SectionAssignment-v2] Added section option:', option.textContent);
    });

    if (sections.length === 0) {
        const option = document.createElement('option');
        option.disabled = true;
        option.textContent = 'No sections available';
        sectionSelect.appendChild(option);
    }
}

/**
 * Update class list elective options based on grade filter
 */
function updateClassListElectiveOptions() {
    const gradeFilter = document.getElementById('clGradeSelect').value;
    const selectEl = document.getElementById('clElectiveSelect');
    if (!selectEl) return;
    const electives = new Set();
    const sourceStudents = Array.isArray(sectionAssignmentState.classListSourceData)
        ? sectionAssignmentState.classListSourceData
        : [];
    
    let options = '<option value="">All Electives</option>';
    
    sourceStudents.forEach(s => {
        if (!gradeFilter || String(s.grade) === String(gradeFilter)) {
            if (Array.isArray(s.electives) && s.electives.length > 0) {
                s.electives.forEach(e => {
                    if (e) electives.add(String(e));
                });
            } else if (s.elective) {
                String(s.elective)
                    .split(',')
                    .map(x => x.trim())
                    .filter(Boolean)
                    .forEach(x => electives.add(x));
            }
        }
    });
    
    Array.from(electives).sort().forEach(e => {
        options += `<option value="${e}">${e}</option>`;
    });
    
    selectEl.innerHTML = options;
    console.log('[SectionAssignment-v2] Updated elective options for grade', gradeFilter, '- found', electives.size, 'electives');
}

/**
 * Display class list based on filters
 */
function displayClassList() {
    const filters = sectionAssignmentState.classListFilters;
    
    console.log('[SectionAssignment-v2] displayClassList called with filters:', filters);
    
    // Fetch enrollments and filter assigned students
    sectionAssignmentRequest('/api/enrollments')
        .then(enrollments => {
            console.log('[SectionAssignment-v2] displayClassList: Fetched', enrollments.length, 'total enrollments');
            
            // Filter only assigned enrollments and only approved status
            let students = (enrollments || [])
                .filter(e => {
                    const sectionState = extractSectionAssignmentFromEnrollment(e);
                    return sectionState.hasAssignedSection && String(e.status || '').toLowerCase() === 'approved';
                })
                .map(e => {
                    const data = safeParseEnrollmentData(e.enrollment_data);
                    const sectionState = extractSectionAssignmentFromEnrollment(e);

                    // Construct full name from multiple possible fields in enrollment data
                    const first = (data.firstName || data.firstname || data.first_name || data.first || '').toString().trim();
                    const middle = (data.middleName || data.middlename || data.middle_name || data.middle || '').toString().trim();
                    const last = (data.lastName || data.lastname || data.last_name || data.last || '').toString().trim();
                    const fallback = (e.student_name || data.student_name || data.name || '').toString().trim();
                    const isValidNamePart = (value) => {
                        const text = String(value || '').trim();
                        return !!text && text !== '-' && text !== '--' && text !== '–' && text.toLowerCase() !== 'null' && text.toLowerCase() !== 'undefined';
                    };
                    const fullNameParts = [];
                    if (isValidNamePart(first)) fullNameParts.push(first);
                    if (isValidNamePart(middle)) fullNameParts.push(middle);
                    if (isValidNamePart(last)) fullNameParts.push(last);
                    const fullName = (fullNameParts.join(' ').trim()) || fallback || 'Unknown';

                    const electiveValues = [];
                    [
                        data.elective,
                        data.electives,
                        data.selectedElectives,
                        data.selected_electives,
                        data.elective_choices,
                        e.elective,
                        e.electives
                    ].forEach(entry => {
                        if (!entry && entry !== 0) return;
                        if (Array.isArray(entry)) {
                            entry.forEach(item => {
                                if (!item && item !== 0) return;
                                const value = typeof item === 'object'
                                    ? (item.name || item.title || item.subject || item.elective || item.value)
                                    : item;
                                if (value) {
                                    String(value).split(',').map(x => x.trim()).filter(Boolean).forEach(x => electiveValues.push(x));
                                }
                            });
                        } else {
                            String(entry).split(',').map(x => x.trim()).filter(Boolean).forEach(x => electiveValues.push(x));
                        }
                    });
                    const normalizedElectives = Array.from(new Set(electiveValues.map(x => String(x).trim()).filter(Boolean)));

                    return {
                        id: e.id,
                        student_name: fullName,
                        student_id: data.lrn || data.studentID || e.student_id || '',
                        grade_level: e.grade || data.gradeLevel || '',
                        grade: parseInt(e.grade || data.gradeLevel || 0),
                        gender: (data.sex || data.gender || '').toString().toLowerCase(),
                        track: data.track || e.track || '',
                        elective: normalizedElectives.join(', '),
                        electives: normalizedElectives,
                        status: e.status,
                        enrollment_data: data,
                        section_id: sectionState.sectionId,
                        class_id: e.class_id,
                        section_code: sectionState.sectionCode,
                        section_name: sectionState.sectionName
                    };
                });

            sectionAssignmentState.classListSourceData = students;
            updateClassListElectiveOptions();
            
            console.log('[SectionAssignment-v2] displayClassList: Found', students.length, 'assigned students');
            if (students.length > 0) {
                console.log('[SectionAssignment-v2] displayClassList: Sample assigned student:', JSON.stringify(students[0], null, 2));
            }
            
            let filtered = students;
            
            // Apply filters
            if (filters.grade) {
                const beforeCount = filtered.length;
                filtered = filtered.filter(s => String(s.grade) === filters.grade);
                console.log('[SectionAssignment-v2] displayClassList: After grade filter', filters.grade, ':', beforeCount, '->', filtered.length);
            }
            if (filters.section) {
                const beforeCount = filtered.length;
                filtered = filtered.filter(s => String(s.section_id) === filters.section);
                console.log('[SectionAssignment-v2] displayClassList: After section filter', filters.section, ':', beforeCount, '->', filtered.length);
            }
            if (filters.track) {
                const beforeCount = filtered.length;
                filtered = filtered.filter(s => String(s.track || '').toLowerCase() === String(filters.track || '').toLowerCase());
                console.log('[SectionAssignment-v2] displayClassList: After track filter', filters.track, ':', beforeCount, '->', filtered.length);
            }
            if (filters.elective) {
                const beforeCount = filtered.length;
                filtered = filtered.filter(s => {
                    const normalizedSelected = String(filters.elective || '').toLowerCase().trim();
                    if (!normalizedSelected) return true;
                    if (Array.isArray(s.electives) && s.electives.length > 0) {
                        return s.electives.some(value => String(value || '').toLowerCase().trim() === normalizedSelected);
                    }
                    return String(s.elective || '').toLowerCase().split(',').map(x => x.trim()).includes(normalizedSelected);
                });
                console.log('[SectionAssignment-v2] displayClassList: After elective filter', filters.elective, ':', beforeCount, '->', filtered.length);
            }
            
            renderClassListTable(filtered);
            
            // Update title
            let titleParts = [];
            if (filters.section) {
                const section = sectionAssignmentState.allSections.find(s => String(s.id) === filters.section);
                if (section) titleParts.push(section.section_name);
            }
            if (filters.grade) titleParts.push(`Grade ${filters.grade}`);
            if (filters.track) titleParts.push(filters.track);
            
            document.getElementById('classListTitle').textContent = titleParts.length > 0
                ? `Class List - ${titleParts.join(', ')}`
                : 'Class List';
        })
        .catch(err => console.error('[SectionAssignment-v2] Error loading class list:', err));
}

/**
 * Render class list table
 */
function renderClassListTable(students) {
    const tbody = document.getElementById('classListTableBody');
    tbody.innerHTML = '';
    
    if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="no-data">No students in this class list</td></tr>';
        return;
    }
    
    students.sort((a, b) => (a.student_name || '').localeCompare(b.student_name || ''));
    
    students.forEach((student, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${idx + 1}</td>
            <td>${student.student_name || 'Unknown'}</td>
            <td>${student.student_id || ''}</td>
            <td><span class="badge badge-success">${student.status || 'Assigned'}</span></td>
        `;
        tbody.appendChild(tr);
    });
    
    sectionAssignmentState.classListData = students;
}

/**
 * Print class list
 */
function printClassList(options = {}) {
    const printWindow = window.open('', '_blank');
    const students = sectionAssignmentState.classListData;
    
    if (students.length === 0) {
        showMessage('warning', '⚠️ No students to print');
        return;
    }

    const cfg = {
        includeLRN: options.includeLRN !== undefined ? !!options.includeLRN : true,
        groupByGender: options.groupByGender !== undefined ? !!options.groupByGender : true,
        includeHeader: options.includeHeader !== undefined ? !!options.includeHeader : true,
        orientation: options.orientation || 'portrait'
    };

    // Determine grouping
    let groups = {};
    if (cfg.groupByGender) {
        groups = { male: [], female: [], other: [] };
        students.forEach(s => {
            const g = (s.gender || '').toString().toLowerCase();
            if (g === 'male' || g === 'm') groups.male.push(s);
            else if (g === 'female' || g === 'f') groups.female.push(s);
            else groups.other.push(s);
        });
    } else {
        groups = { all: students.slice() };
    }

    // Build header info: school name centered, and grade-section label
    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-US') + ' ' + now.toLocaleTimeString('en-US');

    const schoolName = 'Compostela National High School';
    const filters = sectionAssignmentState.classListFilters || {};

    const selectedSection = filters.section
        ? sectionAssignmentState.allSections.find(s => String(s.id) === String(filters.section))
        : null;
    const selectedSectionName = selectedSection
        ? (selectedSection.section_name || selectedSection.name || String(selectedSection.id))
        : '';

    const sectionNamesFromData = Array.from(new Set(
        (students || [])
            .map(s => String(s.section_name || s.section_code || '').trim())
            .filter(Boolean)
    ));

    let resolvedSectionName = selectedSectionName;
    if (!resolvedSectionName && sectionNamesFromData.length === 1) {
        resolvedSectionName = sectionNamesFromData[0];
    } else if (!resolvedSectionName && sectionNamesFromData.length > 1) {
        resolvedSectionName = 'Multiple Sections';
    }

    const labelParts = [];
    if (filters.grade) labelParts.push(`Grade ${filters.grade}`);
    if (resolvedSectionName) labelParts.push(`Section: ${resolvedSectionName}`);
    let gradeSectionLabel = labelParts.join(' • ');

    const renderSection = (label, arr) => {
        if (!arr || arr.length === 0) return '';
        const headerCols = `
            <th style="text-align:left; padding:8px; background:#f7f7f7;">#</th>
            ${cfg.includeLRN ? '<th style="text-align:left; padding:8px; background:#f7f7f7;">LRN</th>' : ''}
            <th style="text-align:left; padding:8px; background:#f7f7f7;">Student Name</th>
        `;

        return `
            <h2 style="margin-top:20px; border-bottom:1px solid #eee; padding-bottom:6px; color:#2c3e50;">${label} (${arr.length})</h2>
            <table style="width:100%; border-collapse:collapse; margin-top:8px;">
                <thead>
                    <tr>
                        ${headerCols}
                    </tr>
                </thead>
                <tbody>
                    ${arr.map((s, i) => `
                        <tr>
                            <td style="padding:6px; border-bottom:1px solid #eee;">${i + 1}</td>
                            ${cfg.includeLRN ? `<td style="padding:6px; border-bottom:1px solid #eee;">${s.student_id || ''}</td>` : ''}
                            <td style="padding:6px; border-bottom:1px solid #eee;">${s.student_name || 'Unknown'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    };

    const pageStyle = cfg.orientation === 'landscape' ? '@page { size: landscape; }' : '';

    const headerHtml = cfg.includeHeader ? `
        <div style="text-align:center; margin-bottom:8px;">
            <div style="font-weight:700; color:#1e5631; font-size:18px;">${schoolName}</div>
            ${gradeSectionLabel ? `<div style="font-size:14px; color:#444; margin-top:6px;">${gradeSectionLabel}</div>` : ''}
        </div>
    ` : '';

    let bodySections = '';
    if (cfg.groupByGender) {
        bodySections += renderSection('Male', groups.male);
        bodySections += renderSection('Female', groups.female);
        if (groups.other && groups.other.length) bodySections += renderSection('Other / Unspecified', groups.other);
    } else {
        bodySections += renderSection('All Students', groups.all);
    }

    const title = `${schoolName}${gradeSectionLabel ? ' - ' + gradeSectionLabel : ''}`;

    const html = `
        <html>
            <head>
                <title>${title}</title>
                <meta name="viewport" content="width=device-width,initial-scale=1" />
                <style>
                    ${pageStyle}
                    @page { margin: 0.5in; }
                    body { font-family: 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color:#222; margin:0.5in; }
                    .brand .school { font-weight:700; color:#1e5631; font-size:18px; }
                    .meta { color:#666; font-size:13px; }
                    table { width:100%; border-collapse:collapse; margin-top:8px; }
                    th, td { text-align:left; }
                    .print-footer { position:fixed; left:0.5in; right:0.5in; bottom:0.5in; text-align:left; color:#666; font-size:12px; }
                </style>
            </head>
            <body>
                ${headerHtml}
                ${bodySections}
                <div class="print-footer">
                    <div>Printed: ${formattedDate}</div>
                    <div>Generated by the Admin Dashboard</div>
                </div>
            </body>
        </html>
    `;

    try {
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    } catch (err) {
        console.error('[SectionAssignment-v2] Failed to write to print window', err);
        showMessage('error', '❌ Unable to open print preview — check popup blocker or browser settings.');
        try { printWindow.close(); } catch(e){}
    }
}

/**
 * Export class list to PDF
 */
function exportClassListPDF() {
    const students = sectionAssignmentState.classListData;
    
    if (students.length === 0) {
        showMessage('warning', '⚠️ No students to export');
        return;
    }

    // Load html2pdf library from CDN if not already loaded
    if (!window.html2pdf) {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        script.onload = () => {
            generateAndDownloadPDF(students);
        };
        script.onerror = () => {
            showMessage('error', '❌ Could not load PDF library. Using print dialog instead.');
            printClassList();
        };
        document.head.appendChild(script);
    } else {
        generateAndDownloadPDF(students);
    }
}

/**
 * Generate PDF and download
 */
function generateAndDownloadPDF(students) {
    const cfg = {
        includeLRN: true,
        groupByGender: true,
        includeHeader: true,
        orientation: 'portrait'
    };

    let groups = { male: [], female: [], other: [] };
    students.forEach(s => {
        const g = (s.gender || '').toString().toLowerCase();
        if (g === 'male' || g === 'm') groups.male.push(s);
        else if (g === 'female' || g === 'f') groups.female.push(s);
        else groups.other.push(s);
    });

    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-US') + ' ' + now.toLocaleTimeString('en-US');
    const schoolName = 'Compostela National High School';
    const filters = sectionAssignmentState.classListFilters || {};
    
    let gradeSectionLabel = '';
    if (filters.grade) {
        gradeSectionLabel = `Grade ${filters.grade}`;
        if (filters.section) {
            const sec = sectionAssignmentState.allSections.find(s => String(s.id) === String(filters.section));
            const sectionName = sec ? (sec.section_name || sec.name || String(sec.id)) : filters.section;
            gradeSectionLabel = `${gradeSectionLabel} - (${sectionName})`;
        }
    } else if (filters.section) {
        const sec = sectionAssignmentState.allSections.find(s => String(s.id) === String(filters.section));
        const sectionName = sec ? (sec.section_name || sec.name || String(sec.id)) : filters.section;
        gradeSectionLabel = `(${sectionName})`;
    }

    const renderSection = (label, arr) => {
        if (!arr || arr.length === 0) return '';
        return `
            <h3 style="margin-top:20px; border-bottom:1px solid #eee; padding-bottom:8px; color:#2c3e50; font-size:14px;">${label} (${arr.length})</h3>
            <table style="width:100%; border-collapse:collapse; margin-top:8px; font-size:11px;">
                <thead>
                    <tr>
                        <th style="text-align:left; padding:6px; background:#f0f0f0; border:1px solid #ddd;">#</th>
                        <th style="text-align:left; padding:6px; background:#f0f0f0; border:1px solid #ddd;">LRN</th>
                        <th style="text-align:left; padding:6px; background:#f0f0f0; border:1px solid #ddd;">Student Name</th>
                    </tr>
                </thead>
                <tbody>
                    ${arr.map((s, i) => `
                        <tr>
                            <td style="padding:4px; border:1px solid #ddd;">${i + 1}</td>
                            <td style="padding:4px; border:1px solid #ddd;">${s.student_id || ''}</td>
                            <td style="padding:4px; border:1px solid #ddd;">${s.student_name || 'Unknown'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    };

    const title = `${schoolName}${gradeSectionLabel ? ' - ' + gradeSectionLabel : ''}`;
    
    // Build filename from grade and section
    let pdfFilename = 'class-list.pdf';
    if (filters.grade && filters.section) {
        const sec = sectionAssignmentState.allSections.find(s => String(s.id) === String(filters.section));
        const sectionName = sec ? (sec.section_name || sec.name || String(sec.id)) : filters.section;
        pdfFilename = `Grade ${filters.grade} - ${sectionName}.pdf`;
    } else if (filters.grade) {
        pdfFilename = `Grade ${filters.grade}.pdf`;
    } else if (filters.section) {
        const sec = sectionAssignmentState.allSections.find(s => String(s.id) === String(filters.section));
        const sectionName = sec ? (sec.section_name || sec.name || String(sec.id)) : filters.section;
        pdfFilename = `${sectionName}.pdf`;
    }

    const html = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; color:#222; max-width:8.5in;">
            <div style="text-align:center; margin-bottom:20px;">
                <div style="font-weight:700; color:#1e5631; font-size:18px;">${schoolName}</div>
                ${gradeSectionLabel ? `<div style="font-size:13px; color:#444; margin-top:6px;">${gradeSectionLabel}</div>` : ''}
            </div>

            ${renderSection('Male', groups.male)}
            ${renderSection('Female', groups.female)}
            ${groups.other.length ? renderSection('Other / Unspecified', groups.other) : ''}

            <div style="margin-top:30px; border-top:1px solid #ddd; padding-top:10px; font-size:11px; color:#666;">
                <div>Printed: ${formattedDate}</div>
                <div>Generated by the Admin Dashboard</div>
            </div>
        </div>
    `;

    const element = document.createElement('div');
    element.innerHTML = html;
    
    try {
        const opt = {
            margin: 0.5,
            filename: pdfFilename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
        };
        window.html2pdf().set(opt).from(element).save();
        showMessage('success', '✅ PDF downloaded successfully');
    } catch (err) {
        console.error('[SectionAssignment-v2] PDF generation failed:', err);
        showMessage('error', '❌ Failed to generate PDF');
    }
}

/**
 * Export class list to Excel
 */
function exportClassListExcel() {
    const students = sectionAssignmentState.classListData;
    
    if (students.length === 0) {
        showMessage('warning', '⚠️ No students to export');
        return;
    }

    // Load SheetJS library from CDN if not already loaded
    if (!window.XLSX) {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.min.js';
        script.onload = () => {
            generateAndDownloadExcel(students);
        };
        script.onerror = () => {
            showMessage('error', '❌ Could not load Excel library. Using CSV instead.');
            fallbackExcel(students);
        };
        document.head.appendChild(script);
    } else {
        generateAndDownloadExcel(students);
    }
}

/**
 * Generate Excel and download with grouped layout
 */
function generateAndDownloadExcel(students) {
    const XLSX = window.XLSX;
    
    const schoolName = 'Compostela National High School';
    const filters = sectionAssignmentState.classListFilters || {};
    
    let gradeSectionLabel = '';
    if (filters.grade) {
        gradeSectionLabel = `Grade ${filters.grade}`;
        if (filters.section) {
            const sec = sectionAssignmentState.allSections.find(s => String(s.id) === String(filters.section));
            const sectionName = sec ? (sec.section_name || sec.name || String(sec.id)) : filters.section;
            gradeSectionLabel = `${gradeSectionLabel} - (${sectionName})`;
        }
    } else if (filters.section) {
        const sec = sectionAssignmentState.allSections.find(s => String(s.id) === String(filters.section));
        const sectionName = sec ? (sec.section_name || sec.name || String(sec.id)) : filters.section;
        gradeSectionLabel = `(${sectionName})`;
    }

    // Group students by gender
    const groups = { male: [], female: [], other: [] };
    students.forEach(s => {
        const g = (s.gender || '').toString().toLowerCase();
        if (g === 'male' || g === 'm') groups.male.push(s);
        else if (g === 'female' || g === 'f') groups.female.push(s);
        else groups.other.push(s);
    });

    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-US') + ' ' + now.toLocaleTimeString('en-US');

    // Build filename from grade and section
    let excelFilename = 'class-list.xlsx';
    if (filters.grade && filters.section) {
        const sec = sectionAssignmentState.allSections.find(s => String(s.id) === String(filters.section));
        const sectionName = sec ? (sec.section_name || sec.name || String(sec.id)) : filters.section;
        excelFilename = `Grade ${filters.grade} - ${sectionName}.xlsx`;
    } else if (filters.grade) {
        excelFilename = `Grade ${filters.grade}.xlsx`;
    } else if (filters.section) {
        const sec = sectionAssignmentState.allSections.find(s => String(s.id) === String(filters.section));
        const sectionName = sec ? (sec.section_name || sec.name || String(sec.id)) : filters.section;
        excelFilename = `${sectionName}.xlsx`;
    }
    
    // Create workbook with a single sheet containing all data
    const wb = XLSX.utils.book_new();
    
    // Build combined data with sections
    const combinedData = [];
    
    // Add header
    combinedData.push([schoolName]);
    combinedData.push([gradeSectionLabel || 'Class List']);
    combinedData.push([]);
    
    // Add male section
    if (groups.male.length > 0) {
        combinedData.push([`MALE (${groups.male.length})`]);
        combinedData.push(['#', 'LRN', 'Student Name']);
        groups.male.forEach((s, i) => {
            combinedData.push([i + 1, s.student_id || '', s.student_name || 'Unknown']);
        });
        combinedData.push([]);
    }
    
    // Add female section
    if (groups.female.length > 0) {
        combinedData.push([`FEMALE (${groups.female.length})`]);
        combinedData.push(['#', 'LRN', 'Student Name']);
        groups.female.forEach((s, i) => {
            combinedData.push([i + 1, s.student_id || '', s.student_name || 'Unknown']);
        });
        combinedData.push([]);
    }
    
    // Add other section
    if (groups.other && groups.other.length > 0) {
        combinedData.push([`OTHER / UNSPECIFIED (${groups.other.length})`]);
        combinedData.push(['#', 'LRN', 'Student Name']);
        groups.other.forEach((s, i) => {
            combinedData.push([i + 1, s.student_id || '', s.student_name || 'Unknown']);
        });
        combinedData.push([]);
    }
    
    // Add footer
    combinedData.push([]);
    combinedData.push([`Printed: ${formattedDate}`]);
    combinedData.push(['Generated by the Admin Dashboard']);

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(combinedData);
    
    // Set column widths
    ws['!cols'] = [
        { wch: 5 },   // #
        { wch: 15 },  // LRN
        { wch: 25 }   // Student Name
    ];
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Class List');
    
    // Download
    try {
        XLSX.writeFile(wb, excelFilename);
        showMessage('success', '✅ Excel file downloaded successfully');
    } catch (err) {
        console.error('[SectionAssignment-v2] Excel generation failed:', err);
        showMessage('error', '❌ Failed to generate Excel file');
    }
}

/**
 * Fallback CSV export matching print layout
 */
function fallbackExcel(students) {
    const schoolName = 'Compostela National High School';
    const filters = sectionAssignmentState.classListFilters || {};
    
    let gradeSectionLabel = '';
    if (filters.grade) {
        gradeSectionLabel = `Grade ${filters.grade}`;
        if (filters.section) {
            const sec = sectionAssignmentState.allSections.find(s => String(s.id) === String(filters.section));
            const sectionName = sec ? (sec.section_name || sec.name || String(sec.id)) : filters.section;
            gradeSectionLabel = `${gradeSectionLabel} - (${sectionName})`;
        }
    }

    const groups = { male: [], female: [], other: [] };
    students.forEach(s => {
        const g = (s.gender || '').toString().toLowerCase();
        if (g === 'male' || g === 'm') groups.male.push(s);
        else if (g === 'female' || g === 'f') groups.female.push(s);
        else groups.other.push(s);
    });

    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-US') + ' ' + now.toLocaleTimeString('en-US');
    
    let csv = `${schoolName}\n${gradeSectionLabel || 'Class List'}\n\n`;
    
    if (groups.male.length > 0) {
        csv += `MALE (${groups.male.length})\n`;
        csv += `No.,LRN,Student Name\n`;
        groups.male.forEach((s, i) => {
            csv += `${i + 1},"${s.student_id || ''}","${s.student_name || 'Unknown'}"\n`;
        });
        csv += '\n';
    }
    
    if (groups.female.length > 0) {
        csv += `FEMALE (${groups.female.length})\n`;
        csv += `No.,LRN,Student Name\n`;
        groups.female.forEach((s, i) => {
            csv += `${i + 1},"${s.student_id || ''}","${s.student_name || 'Unknown'}"\n`;
        });
        csv += '\n';
    }
    
    if (groups.other.length > 0) {
        csv += `OTHER / UNSPECIFIED (${groups.other.length})\n`;
        csv += `No.,LRN,Student Name\n`;
        groups.other.forEach((s, i) => {
            csv += `${i + 1},"${s.student_id || ''}","${s.student_name || 'Unknown'}"\n`;
        });
    }
    
    csv += `\nPrinted: ${formattedDate}\nGenerated by the Admin Dashboard`;
    
    // Build filename from grade and section
    let csvFilename = 'class-list.csv';
    if (filters.grade && filters.section) {
        const sec = sectionAssignmentState.allSections.find(s => String(s.id) === String(filters.section));
        const sectionName = sec ? (sec.section_name || sec.name || String(sec.id)) : filters.section;
        csvFilename = `Grade ${filters.grade} - ${sectionName}.csv`;
    } else if (filters.grade) {
        csvFilename = `Grade ${filters.grade}.csv`;
    } else if (filters.section) {
        const sec = sectionAssignmentState.allSections.find(s => String(s.id) === String(filters.section));
        const sectionName = sec ? (sec.section_name || sec.name || String(sec.id)) : filters.section;
        csvFilename = `${sectionName}.csv`;
    }
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = csvFilename;
    a.click();
    window.URL.revokeObjectURL(url);
    
    showMessage('success', '✅ CSV file downloaded (Excel not available)');
}

/**
 * View student details
 */
function viewStudentDetails(studentIdentifier) {
    console.log(`[SectionAssignment-v2] viewStudentDetails called with: ${studentIdentifier} (type: ${typeof studentIdentifier})`);
    
    // If the global openStudentProfile function exists (from admin-dashboard-students.js), reuse it
    if (typeof openStudentProfile === 'function') {
        try {
            console.log('[SectionAssignment-v2] Calling global openStudentProfile function');
            openStudentProfile(studentIdentifier);
            return;
        } catch (e) {
            console.warn('[SectionAssignment-v2] openStudentProfile threw an error, falling back to local render', e);
        }
    }

    // Fallback: build the profile modal from sectionAssignmentState.allStudents
    console.log('[SectionAssignment-v2] Fallback: looking up in sectionAssignmentState.allStudents');
    console.log('[SectionAssignment-v2] sectionAssignmentState exists:', !!sectionAssignmentState);
    console.log('[SectionAssignment-v2] allStudents count:', sectionAssignmentState?.allStudents?.length);
    
    const normalizedId = String(studentIdentifier || '').trim();
    console.log('[SectionAssignment-v2] Normalized identifier to search for:', normalizedId);
    
    // Log first few students for comparison
    if (sectionAssignmentState?.allStudents?.length > 0) {
        console.log('[SectionAssignment-v2] First 5 students in state:');
        sectionAssignmentState.allStudents.slice(0, 5).forEach((s, i) => {
            console.log(`  ${i+1}. name="${s.name}" lrn="${s.lrn}" id="${s.id}"`);
        });
    }
    
    // Search by LRN first (most reliable), then ID
    const student = (sectionAssignmentState && Array.isArray(sectionAssignmentState.allStudents)) ?
        sectionAssignmentState.allStudents.find(s => {
            const lrnMatch = String(s.lrn) === normalizedId;
            const idMatch = String(s.id) === normalizedId;
            const match = lrnMatch || idMatch;
            if (match) console.log('[SectionAssignment-v2] ✓ Found matching student:', s.name, '(LRN:', s.lrn, ')');
            return match;
        }) : null;

    if (!student) {
        console.warn('[SectionAssignment-v2] ❌ Student not found with identifier:', studentIdentifier);
        console.log('[SectionAssignment-v2] All student LRNs:', sectionAssignmentState?.allStudents?.map(s => s.lrn).join(', '));
        console.log('[SectionAssignment-v2] All student IDs:', sectionAssignmentState?.allStudents?.map(s => s.id).join(', '));
        showMessage('error', 'Student details not found');
        return;
    }

    // Populate modal fields (IDs match admin-dashboard.html student profile modal)
    const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value || '--'; };

    setText('profileStudentName', student.name || student.fullName || '--');
    setText('infoFullName', student.name || student.fullName || '--');
    setText('infoStudentID', student.lrn || '--');
    setText('infoGender', (student.gender || '').charAt(0).toUpperCase() + (student.gender || '').slice(1));
    setText('infoBirthdate', student.birthdate || '--');
    setText('infoPlaceOfBirth', student.placeOfBirth || '--');
    setText('infoMotherTongue', student.mother_tongue || '--');
    setText('infoAddress', student.currentAddress || student.address || '--');

    setText('infoGrade', student.grade || '--');
    setText('infoTrack', student.track || '--');
    setText('infoEnrollmentStatus', student.status || '--');
    setText('infoElectives', (Array.isArray(student.electives) && student.electives.length) ? student.electives.join(', ') : (student.elective || 'None'));

    setText('infoDisability', (Array.isArray(student.disabilities) && student.disabilities.length) ? student.disabilities.join(', ') : 'None');
    setText('infoIPGroup', student.ip_group || 'Not an IP member');
    setText('info4Ps', student.four_ps ? 'Yes' : 'No');

    const historyContent = document.getElementById('historyContent');
    if (historyContent) historyContent.innerHTML = `<p>Enrolled: ${student.enrollmentDate ? new Date(student.enrollmentDate).toLocaleDateString() : '--'}</p>`;

    // Show modal
    const modal = document.getElementById('studentProfileModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');
    }
}

/**
 * Open print options modal
 */
function openPrintOptionsModal() {
    const modal = document.getElementById('printOptionsModal');
    if (!modal) {
        console.warn('[SectionAssignment-v2] Print options modal not found');
        // fallback: directly call print
        printClassList();
        return;
    }
    modal.classList.add('active');
    modal.style.display = 'flex';
    modal.style.pointerEvents = 'auto';
    modal.setAttribute('aria-hidden', 'false');
}

function closePrintOptionsModal() {
    const modal = document.getElementById('printOptionsModal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.style.display = 'none';
    modal.style.pointerEvents = 'none';
    modal.setAttribute('aria-hidden', 'true');
}

/**
 * Show message
 */
function showMessage(type, message) {
    const container = document.getElementById('assignmentMessages');
    if (!container) return;
    
    const msgEl = document.createElement('div');
    msgEl.className = `assignment-message ${type}`;
    msgEl.innerHTML = `<span>${message}</span>`;
    
    container.appendChild(msgEl);
    setTimeout(() => msgEl.remove(), 5000);
}

console.log('[SectionAssignment-v2] Script loaded successfully');



