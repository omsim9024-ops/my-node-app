(function () {
    const STANDARD_REPORTS_KNOWN_ELECTIVES = [
        'Citizenship and Civic Engagement',
        'Creative Industries (Visual, Media, Applied, and Traditional Art)',
        'Creative Industries (Music, Dance, Theater)',
        'Creative Writing',
        'Cultivating Filipino Identity Through the Arts',
        'Filipino sa Isports',
        'Filipino sa Sining at Disenyo',
        'Filipino sa Teknikal-Propesyonal',
        'Introduction to the Philosophy of the Human Person',
        'Leadership and Management in the Arts',
        'Malikhaing Pagsulat',
        'Philippine Politics and Governance',
        'The Social Sciences in Theory and Practice',
        'Wika at Komunikasyon sa Akademikong Filipino',
        'Basic Accounting',
        'Business Finance and Income Taxation',
        'Contemporary Marketing and Business Economics',
        'Entrepreneurship',
        'Introduction to Organization and Management',
        'Exercise and Sports Programming',
        'Introduction to Human Movement',
        'Physical Education (Fitness and Recreation)',
        'Physical Education (Sports and Dance)',
        'Safety and First Aid',
        'Sports Coaching',
        'Sports Officiating',
        'Sports Activity Management',
        'Advanced Mathematics 1-2',
        'Biology 1-2',
        'Biology 3-4',
        'Chemistry 1-2',
        'Chemistry 3-4',
        'Database Management',
        'Earth and Space Science 1-2',
        'Earth and Space Science 3-4',
        'Empowerment Technologies',
        'Finite Mathematics',
        'Fundamentals of Data Analytics and Management',
        'General Science (Physical Science)',
        'General Science (Earth and Life Science)',
        'Pre-Calculus 1-2',
        'Physics 1-2',
        'Physics 3-4',
        'Trigonometry 1-2',
        'Arts Apprenticeship - Theater Arts',
        'Arts Apprenticeship - Dance',
        'Arts Apprenticeship - Music',
        'Arts Apprenticeship - Literary Arts',
        'Arts Apprenticeship - Visual, Media, Applied, and Traditional Art',
        'Creative Production and Presentation',
        'Design and Innovation Research Methods',
        'Field Exposure (In-Campus)',
        'Field Exposure (Off-Campus)',
        'Work Immersion',
        'Animation (NC II)',
        'Broadband Installation (Fixed Wireless Systems) (NC II)',
        'Computer Programming (Java) (NC III)',
        'Computer Programming (Oracle Database) (NC III)',
        'Computer Systems Servicing (NC II)',
        'Contact Center Services (NC II)',
        'Illustration (NC II)',
        'Programming (.NET Technology) (NC III)',
        'Visual Graphic Design (NC III)',
        'Automotive Servicing (Engine and Chassis) (NC II)',
        'Automotive Servicing (Electrical) (NC II)',
        'Carpentry (NC I and NC II)',
        'Construction Operations (Masonry NC I and Tiles Plumbing NC II)',
        'Commercial Air-Conditioning Installation and Servicing (NC III)',
        'Domestic Refrigeration and Air-Conditioning Servicing (NC II)',
        'Driving and Automotive Servicing (Driving NC II and Automotive Servicing NC I)',
        'Electrical Installation Maintenance (NC II)',
        'Electronics Product and Assembly Servicing (NC II)',
        'Manual Metal Arc Welding (NC II)',
        'Mechatronics (NC II)',
        'Motorcycle and Small Engine Servicing (NC II)',
        'Photovoltaic System Installation (NC II)',
        'Technical Drafting (NC II)',
        'Agricultural Crops Production (NC II)',
        'Agro-Entrepreneurship (NC II)',
        'Aquaculture (NC II)',
        'Fish Capture Operation (NC II)',
        'Food Processing (NC II)',
        'Organic Agriculture Production (NC II)',
        'Poultry Production - Chicken (NC II)',
        'Ruminants Production (NC II)',
        'Swine Production (NC II)',
        'Aesthetic Services (Beauty Care) (NC II)',
        'Bakery Operations (NC II)',
        'Caregiving (Adult Care) (NC II)',
        'Caregiving (Child Care) (NC II)',
        'Events Management Services (NC III)',
        'Food and Beverages Operations (NC II)',
        'Garments Artisanry (NC II)',
        'Hairdressing Services (NC II)',
        'Handicraft (Weaving) (NC II)',
        'Hotel Operations (Front Office Services) (NC II)',
        'Hotel Operations (Housekeeping Services) (NC II)',
        'Kitchen Operations (NC II)',
        'Tourism Services (NC II)',
        'Marine Engineering at the Support Level (Non-NC)',
        'Marine Transportation at the Support Level (Non-NC)',
        'Ships Catering Services (NC I)'
    ];

    const normalizeElectiveLookupKey = (value) => String(value || '')
        .toLowerCase()
        .replace(/[’']/g, "'")
        .replace(/\s+/g, ' ')
        .replace(/\s*\-\s*/g, ' - ')
        .trim();

    const KNOWN_ELECTIVE_BY_KEY = new Map(
        STANDARD_REPORTS_KNOWN_ELECTIVES.map(name => [normalizeElectiveLookupKey(name), name])
    );

    const KNOWN_ELECTIVE_KEYS_BY_LENGTH = Array.from(KNOWN_ELECTIVE_BY_KEY.keys())
        .sort((a, b) => b.length - a.length);

    const SR2 = {
        initialized: false,
        activeReport: 'demographics',
        students: [],
        tenantCode: '',
        statModalBound: false,
        dataMode: 'approved'
    };

    function notify(message, type = 'info') {
        if (typeof window.showNotification === 'function') {
            window.showNotification(message, type);
            return;
        }
        console[type === 'error' ? 'error' : 'log']('[StandardReports-v2]', message);
    }

    function resolveTenantCode() {
        try {
            const params = new URLSearchParams(window.location.search || '');
            const q = String(params.get('school') || params.get('tenant') || params.get('code') || '').trim().toLowerCase();
            if (q) return q;
        } catch (_err) {}

        return String(localStorage.getItem('sms.selectedSchoolCode') || localStorage.getItem('sms.selectedTenantCode') || '').trim().toLowerCase();
    }

    function normalizePayload(payload) {
        if (Array.isArray(payload)) return payload;
        if (!payload || typeof payload !== 'object') return [];
        if (Array.isArray(payload.rows)) return payload.rows;
        if (Array.isArray(payload.data)) return payload.data;
        if (Array.isArray(payload.enrollments)) return payload.enrollments;
        if (payload.success && Array.isArray(payload.result)) return payload.result;
        return [];
    }

    function toPositiveYearId(value) {
        const numeric = Number(value);
        return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
    }

    function resolveActiveSchoolYearId() {
        const direct = toPositiveYearId(window.activeSchoolYearId);
        if (direct) return direct;

        const fromObject = toPositiveYearId(window.activeSchoolYear && (window.activeSchoolYear.id || window.activeSchoolYear.school_year_id));
        if (fromObject) return fromObject;

        try {
            const stored = JSON.parse(localStorage.getItem('activeSchoolYear') || 'null');
            const fromStorage = toPositiveYearId(stored && (stored.id || stored.school_year_id || stored.schoolYearId));
            if (fromStorage) return fromStorage;
        } catch (_err) {
            // ignore parse errors
        }

        return null;
    }

    async function apiFetchJson(path) {
        const candidates = [''];
        if (window.API_BASE) candidates.push(String(window.API_BASE));
        if (window.BACKEND_ORIGIN) candidates.push(String(window.BACKEND_ORIGIN));

        const unique = [];
        const seen = new Set();
        for (const value of candidates) {
            const key = value || 'REL';
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(value);
            }
        }

        const tenantCode = SR2.tenantCode || resolveTenantCode();
        SR2.tenantCode = tenantCode;

        const token = String(localStorage.getItem('adminAuthToken') || '').trim();

        for (const base of unique) {
            try {
                const endpoint = new URL(base ? `${base.replace(/\/$/, '')}${path}` : path, window.location.origin);
                if (tenantCode) endpoint.searchParams.set('school', tenantCode);

                const res = await fetch(endpoint.toString(), {
                    credentials: 'include',
                    headers: {
                        ...(tenantCode ? { 'x-tenant-code': tenantCode } : {}),
                        ...(token ? { Authorization: `Bearer ${token}` } : {})
                    }
                });

                if (!res.ok) continue;

                const contentType = String(res.headers.get('content-type') || '').toLowerCase();
                if (contentType.includes('text/html')) continue;

                return await res.json();
            } catch (_err) {
                // try next candidate
            }
        }

        throw new Error('Unable to fetch API data for reports');
    }

    function parseJson(value, fallback = {}) {
        if (!value) return fallback;
        if (typeof value === 'object') return value;
        if (typeof value !== 'string') return fallback;
        try {
            return JSON.parse(value);
        } catch (_err) {
            return fallback;
        }
    }

    function normalizeElectives(rawData, enrollment) {
        const collect = [];

        const parseElectiveText = (value) => {
            const text = String(value || '').trim();
            if (!text) return [];

            // Explicit list delimiters: split safely
            if (/[;\n|]/.test(text)) {
                return text
                    .split(/[;\n|]+/)
                    .map(part => String(part || '').trim())
                    .filter(Boolean);
            }

            // JSON-ish quoted list fallback: "a","b"
            if (text.includes('","')) {
                return text
                    .replace(/^"|"$/g, '')
                    .split('","')
                    .map(part => String(part || '').trim())
                    .filter(Boolean);
            }

            // For comma-separated content, prefer preserving whole title when it matches a known elective.
            if (text.includes(',')) {
                const normalizedWhole = text.replace(/^"|"$/g, '').trim();
                const wholeKey = normalizeElectiveLookupKey(normalizedWhole);
                if (KNOWN_ELECTIVE_BY_KEY.has(wholeKey)) {
                    return [normalizedWhole];
                }

                const parts = normalizedWhole
                    .split(',')
                    .map(part => String(part || '').trim())
                    .filter(Boolean);

                // Only split if each comma-delimited item is a known elective entry.
                if (parts.length > 1 && parts.every(part => KNOWN_ELECTIVE_BY_KEY.has(normalizeElectiveLookupKey(part)))) {
                    return parts;
                }

                return [normalizedWhole];
            }

            return [text];
        };

        const normalizeToken = (value) => String(value || '')
            .replace(/^"+|"+$/g, '')
            .replace(/^'+|'+$/g, '')
            .trim();

        const mergeFragmentedElectives = (tokens) => {
            const source = (Array.isArray(tokens) ? tokens : [])
                .map(normalizeToken)
                .filter(Boolean);

            const output = [];
            let index = 0;

            while (index < source.length) {
                let merged = null;
                let advance = 1;

                for (let size = Math.min(6, source.length - index); size >= 2; size--) {
                    const candidate = source.slice(index, index + size).join(', ');
                    if (KNOWN_ELECTIVE_BY_KEY.has(normalizeElectiveLookupKey(candidate))) {
                        merged = candidate;
                        advance = size;
                        break;
                    }
                }

                if (merged) {
                    output.push(merged);
                } else {
                    output.push(source[index]);
                }

                index += advance;
            }

            return output;
        };

        const push = (value) => {
            if (!value) return;
            if (Array.isArray(value)) {
                value.forEach(item => {
                    if (typeof item === 'string') {
                        const cleaned = item.trim();
                        if (cleaned) collect.push(cleaned);
                        return;
                    }
                    if (item && typeof item === 'object') {
                        const objectName = item.name || item.elective || item.title || item.subject || '';
                        const cleaned = String(objectName || '').trim();
                        if (cleaned) collect.push(cleaned);
                    }
                });
                return;
            }
            if (typeof value === 'object') {
                Object.values(value).forEach(push);
                return;
            }
            const text = String(value).trim();
            if (!text) return;
            try {
                const parsed = JSON.parse(text);
                push(parsed);
            } catch (_err) {
                parseElectiveText(text).forEach(part => {
                    const cleaned = String(part || '').trim();
                    if (cleaned) collect.push(cleaned);
                });
            }
        };

        const data = rawData || {};
        push(data.electives);
        push(data.selectedElectives);
        push(data.academicElectives);
        push(data.techproElectives);
        push(data.doorwayAcademic);
        push(data.doorwayTechPro);
        push(data.doorwayTechpro);
        push(data.shs && data.shs.electives);
        push(data.subjects);
        push(data.interest);
        push(enrollment && enrollment.subjects);
        push(enrollment && enrollment.interest);

        const merged = mergeFragmentedElectives(collect);

        const canonical = [];
        const seen = new Set();

        merged.forEach((rawItem) => {
            const rawText = normalizeToken(rawItem);
            if (!rawText) return;

            const exactKey = normalizeElectiveLookupKey(rawText);
            if (KNOWN_ELECTIVE_BY_KEY.has(exactKey)) {
                const exactName = KNOWN_ELECTIVE_BY_KEY.get(exactKey);
                if (!seen.has(exactName)) {
                    seen.add(exactName);
                    canonical.push(exactName);
                }
                return;
            }

            const normalizedText = normalizeElectiveLookupKey(rawText);
            let matchedAny = false;

            KNOWN_ELECTIVE_KEYS_BY_LENGTH.forEach((knownKey) => {
                if (!normalizedText.includes(knownKey)) return;
                const knownName = KNOWN_ELECTIVE_BY_KEY.get(knownKey);
                if (!knownName || seen.has(knownName)) return;
                seen.add(knownName);
                canonical.push(knownName);
                matchedAny = true;
            });

            if (!matchedAny) {
                // discard unknown/partial/cut electives by design
            }
        });

        return canonical;
    }

    function mapEnrollmentToStudent(enrollment) {
        const data = parseJson(enrollment && enrollment.enrollment_data, {});

        const firstName = String(data.firstName || data.firstname || enrollment.first_name || '').trim();
        const lastName = String(data.lastName || data.lastname || enrollment.last_name || '').trim();
        const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || 'N/A';

        const student = {
            id: enrollment.student_id || data.studentId || data.studentID || data.lrn || fullName,
            lrn: String(data.lrn || data.LRN || data.studentLRN || enrollment.lrn || '').trim(),
            fullName,
            firstName,
            lastName,
            gender: String(data.gender || data.sex || enrollment.sex || '').trim(),
            gradeLevel: String(data.gradeLevel || data.grade_level || data.grade || enrollment.grade_to_enroll_id || '').trim(),
            section: String(data.section || data.sectionName || enrollment.section_name || enrollment.section || '').trim(),
            track: String(data.track || enrollment.track || '').trim(),
            motherTongue: String(data.motherTongue || data.mother_tongue || '').trim(),
            ipStatus: String(data.isIP || data.ip_status || data.ip || data.indigenous || '').trim(),
            ipGroup: String(data.ipGroup || data.ip_group || '').trim(),
            fourPsStatus: String(data.is4Ps || data.four_ps || data.fourPs || data['4ps'] || '').trim(),
            disabilityStatus: String(data.disability || data.disability_status || data.disabilityType || '').trim(),
            disabilities: Array.isArray(data.disabilities) ? data.disabilities : [],
            electives: normalizeElectives(data, enrollment)
        };

        return student;
    }

    function isApproved(enrollment) {
        const status = String((enrollment && (enrollment.status || enrollment.enrollment_status)) || '').trim().toLowerCase();
        return status === 'approved' || status.startsWith('approved');
    }

    async function fetchStudents() {
        const endpoints = [
            '/api/enrollments?activeYear=true',
            '/api/enrollments?status=Approved&activeYear=true',
            '/api/enrollments?status=approved&activeYear=true',
            '/api/enrollments?status=Pending&activeYear=true',
            '/api/enrollments?status=pending&activeYear=true'
        ];

        const dedupe = (items) => {
            const map = new Map();
            (Array.isArray(items) ? items : []).forEach((row, index) => {
                const key = String(
                    row?.id
                    || `${row?.student_id || ''}|${row?.created_at || ''}|${row?.enrollment_date || ''}|${index}`
                );
                if (!map.has(key)) map.set(key, row);
            });
            return Array.from(map.values());
        };

        let bestApproved = [];
        let bestAll = [];

        for (const endpoint of endpoints) {
            try {
                const endpointUrl = new URL(endpoint, window.location.origin);
                endpointUrl.searchParams.set('activeYear', 'true');
                const requestPath = `${endpointUrl.pathname}${endpointUrl.search}`;

                let payload = null;
                if (typeof window.apiFetch === 'function') {
                    const res = await window.apiFetch(requestPath, { cache: 'no-store' });
                    if (res && res.ok) {
                        payload = await res.json().catch(() => null);
                    }
                }

                if (!payload) {
                    payload = await apiFetchJson(requestPath);
                }

                const enrollments = normalizePayload(payload);
                if (!enrollments.length) continue;
                const allRows = dedupe(enrollments);
                if (allRows.length > bestAll.length) {
                    bestAll = allRows;
                }
                const approved = dedupe(enrollments.filter(isApproved));
                if (approved.length > bestApproved.length) {
                    bestApproved = approved;
                }
            } catch (_err) {
                // try next endpoint
            }
        }

        const source = bestApproved.length > 0 ? bestApproved : bestAll;
        SR2.dataMode = bestApproved.length > 0 ? 'approved' : 'all-active-year';
        return source.map(mapEnrollmentToStudent);
    }

    function gradeLabel(gradeValue) {
        const grade = String(gradeValue || '').trim();
        return grade ? `Grade ${grade}` : 'Unspecified';
    }

    function safeGender(gender) {
        const normalized = String(gender || '').trim().toLowerCase();
        if (normalized === 'm' || normalized === 'male') return 'male';
        if (normalized === 'f' || normalized === 'female') return 'female';
        return 'other';
    }

    function parseGradeLevelNumber(value) {
        const text = String(value || '').trim().toLowerCase();
        if (!text) return NaN;
        const match = text.match(/\d{1,2}/);
        if (!match) return NaN;
        return Number.parseInt(match[0], 10);
    }

    function getShsStudents(students) {
        const source = Array.isArray(students) ? students : [];
        return source.filter(student => {
            const gradeNum = parseGradeLevelNumber(student && student.gradeLevel);
            return gradeNum === 11 || gradeNum === 12;
        });
    }

    function clearActiveReport() {
        document.querySelectorAll('.sr2-tab').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.sr2-panel').forEach(panel => panel.classList.remove('active'));
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function normalizeGenderLabel(value) {
        const gender = safeGender(value);
        if (gender === 'male') return 'Male';
        if (gender === 'female') return 'Female';
        return 'Other';
    }

    function closeStatModal() {
        const modal = document.getElementById('statModalContainer');
        if (!modal) return;
        modal.classList.remove('active');
        modal.style.display = 'none';
        modal.style.pointerEvents = 'none';
        modal.setAttribute('aria-hidden', 'true');
    }

    function openStatModal(title, students) {
        const modal = document.getElementById('statModalContainer');
        const titleEl = document.getElementById('statModalTitle');
        const bodyEl = document.getElementById('statModalBody');
        if (!modal || !titleEl || !bodyEl) {
            notify('Student list modal is not available.', 'error');
            return;
        }

        titleEl.textContent = title || 'Student List';

        if (!Array.isArray(students) || students.length === 0) {
            bodyEl.innerHTML = '<p class="no-data" style="padding: 18px 8px;">No students found for this selection.</p>';
        } else {
            const rows = students.map((student, index) => {
                return `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${student.fullName || 'N/A'}</td>
                        <td>${student.lrn || '-'}</td>
                        <td>${normalizeGenderLabel(student.gender)}</td>
                        <td>${gradeLabel(student.gradeLevel)}</td>
                        <td>${student.section || '-'}</td>
                    </tr>
                `;
            }).join('');

            bodyEl.innerHTML = `
                <div class="table-container">
                    <table class="report-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Student Name</th>
                                <th>LRN</th>
                                <th>Gender</th>
                                <th>Grade</th>
                                <th>Section</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            `;
        }

        modal.classList.add('active');
        modal.style.display = 'flex';
        modal.style.pointerEvents = 'auto';
        modal.setAttribute('aria-hidden', 'false');

        // Initialize modal conditional logic for editable fields
        if (typeof window.setupEnrollmentModalConditionals === 'function') {
            window.setupEnrollmentModalConditionals();
        } else if (typeof window.triggerEnrollmentConditionals === 'function') {
            window.triggerEnrollmentConditionals();
        }
        // Age auto-calc, show/hide, validation, etc. now match enrollment form
    }

    function ensureStatModalBindings() {
        if (SR2.statModalBound) return;

        const modal = document.getElementById('statModalContainer');
        if (!modal) return;

        const closeBtn = document.getElementById('closeStatModal');
        const closeFooterBtn = document.getElementById('closeStatModalBtn');

        closeBtn?.addEventListener('click', closeStatModal);
        closeFooterBtn?.addEventListener('click', closeStatModal);

        modal.addEventListener('click', (event) => {
            if (event.target === modal) closeStatModal();
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') {
                closeStatModal();
            }
        });

        SR2.statModalBound = true;
    }

    function switchReport(reportId) {
        SR2.activeReport = reportId;
        clearActiveReport();
        document.querySelector(`.sr2-tab[data-report="${reportId}"]`)?.classList.add('active');
        document.getElementById(`sr2-report-${reportId}`)?.classList.add('active');
        renderReport(reportId);
    }

    function summarizeByGrade(students) {
        const gradeMap = new Map();
        students.forEach(student => {
            const grade = String(student.gradeLevel || '').trim() || 'Unspecified';
            if (!gradeMap.has(grade)) gradeMap.set(grade, { male: 0, female: 0, other: 0, total: 0 });
            const row = gradeMap.get(grade);
            const gender = safeGender(student.gender);
            row[gender] += 1;
            row.total += 1;
        });
        return Array.from(gradeMap.entries()).sort((a, b) => String(a[0]).localeCompare(String(b[0]), undefined, { numeric: true }));
    }

    function renderDemographics() {
        const summary = summarizeByGrade(SR2.students);
        const totals = summary.reduce((acc, [, data]) => {
            acc.male += data.male;
            acc.female += data.female;
            acc.total += data.total;
            return acc;
        }, { male: 0, female: 0, total: 0 });

        const target = document.getElementById('sr2-report-demographics');
        if (!target) return;

        const rows = summary.map(([grade, data]) => `
            <tr class="sr2-click-row" data-grade="${String(grade).replace(/"/g, '&quot;')}">
                <td>${gradeLabel(grade)}</td>
                <td>${data.male}</td>
                <td>${data.female}</td>
                <td>${data.total}</td>
            </tr>
        `).join('');

        target.innerHTML = `
            <div class="sr2-cards">
                <button type="button" class="sr2-card sr2-click-card" data-stat="male">
                    <div class="sr2-label">Total Male</div>
                    <div class="sr2-value">${totals.male}</div>
                </button>
                <button type="button" class="sr2-card sr2-click-card" data-stat="female">
                    <div class="sr2-label">Total Female</div>
                    <div class="sr2-value">${totals.female}</div>
                </button>
                <button type="button" class="sr2-card sr2-click-card" data-stat="overall">
                    <div class="sr2-label">Total Students</div>
                    <div class="sr2-value">${totals.total}</div>
                </button>
            </div>
            <div class="table-container">
                <table class="report-table">
                    <thead><tr><th>Grade</th><th>Male</th><th>Female</th><th>Total</th></tr></thead>
                    <tbody>${rows || '<tr><td colspan="4" class="no-data">No approved students found.</td></tr>'}</tbody>
                </table>
            </div>
        `;

        const byGender = {
            male: SR2.students.filter(student => safeGender(student.gender) === 'male'),
            female: SR2.students.filter(student => safeGender(student.gender) === 'female'),
            overall: SR2.students.slice()
        };

        target.querySelectorAll('.sr2-click-card').forEach(card => {
            card.addEventListener('click', () => {
                const stat = card.getAttribute('data-stat') || 'overall';
                const students = byGender[stat] || [];
                const titleMap = {
                    male: 'Demographics • Total Male Students',
                    female: 'Demographics • Total Female Students',
                    overall: 'Demographics • Total Students'
                };
                openStatModal(titleMap[stat] || 'Demographics', students);
            });
        });

        target.querySelectorAll('.sr2-click-row').forEach(row => {
            row.addEventListener('click', () => {
                const selectedGrade = String(row.getAttribute('data-grade') || '').trim();
                const filtered = SR2.students.filter(student => String(student.gradeLevel || '').trim() === selectedGrade);
                openStatModal(`Demographics • ${gradeLabel(selectedGrade)}`, filtered);
            });
        });
    }

    function renderGroupedReport(options) {
        const {
            panelId,
            keyTitle,
            deriveKey,
            emptyMessage,
            includeGender = true,
            includeSummaryCards = false,
            summaryTitle = keyTitle,
            sourceStudents = SR2.students
        } = options;

        const panel = document.getElementById(panelId);
        if (!panel) return;

        const map = new Map();

        sourceStudents.forEach(student => {
            const key = String(deriveKey(student) || '').trim() || 'Unspecified';
            if (!map.has(key)) map.set(key, { male: 0, female: 0, other: 0, total: 0, students: [] });
            const row = map.get(key);
            const gender = safeGender(student.gender);
            row[gender] += 1;
            row.total += 1;
            row.students.push(student);
        });

        const groupedStudents = [];
        map.forEach(entry => {
            if (Array.isArray(entry.students)) groupedStudents.push(...entry.students);
        });

        const maleStudents = groupedStudents.filter(student => safeGender(student.gender) === 'male');
        const femaleStudents = groupedStudents.filter(student => safeGender(student.gender) === 'female');
        const overallStudents = groupedStudents.slice();

        const rows = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([key, data]) => {
            const safeKey = encodeURIComponent(key);
            const label = escapeHtml(key);
            if (includeGender) {
                return `
                    <tr class="sr2-click-row" data-group-key="${safeKey}">
                        <td>${label}</td>
                        <td>${data.male}</td>
                        <td>${data.female}</td>
                        <td>${data.total}</td>
                    </tr>
                `;
            }

            return `
                <tr class="sr2-click-row" data-group-key="${safeKey}">
                    <td>${label}</td>
                    <td>${data.total}</td>
                </tr>
            `;
        }).join('');

        const summaryHtml = includeSummaryCards
            ? `
                <div class="sr2-cards">
                    <button type="button" class="sr2-card sr2-click-card" data-stat="male">
                        <div class="sr2-label">Total Male</div>
                        <div class="sr2-value">${maleStudents.length}</div>
                    </button>
                    <button type="button" class="sr2-card sr2-click-card" data-stat="female">
                        <div class="sr2-label">Total Female</div>
                        <div class="sr2-value">${femaleStudents.length}</div>
                    </button>
                    <button type="button" class="sr2-card sr2-click-card" data-stat="overall">
                        <div class="sr2-label">Total Students</div>
                        <div class="sr2-value">${overallStudents.length}</div>
                    </button>
                </div>
            `
            : '';

        const tableHtml = includeGender
            ? `
                <div class="table-container">
                    <table class="report-table">
                        <thead><tr><th>${keyTitle}</th><th>Male</th><th>Female</th><th>Total</th></tr></thead>
                        <tbody>${rows || `<tr><td colspan="4" class="no-data">${emptyMessage}</td></tr>`}</tbody>
                    </table>
                </div>
            `
            : `
                <div class="table-container">
                    <table class="report-table">
                        <thead><tr><th>${keyTitle}</th><th>Total</th></tr></thead>
                        <tbody>${rows || `<tr><td colspan="2" class="no-data">${emptyMessage}</td></tr>`}</tbody>
                    </table>
                </div>
            `;

        panel.innerHTML = `${summaryHtml}${tableHtml}`;

        if (includeSummaryCards) {
            const studentsByStat = {
                male: maleStudents,
                female: femaleStudents,
                overall: overallStudents
            };
            const titleByStat = {
                male: `${summaryTitle} • Total Male Students`,
                female: `${summaryTitle} • Total Female Students`,
                overall: `${summaryTitle} • Total Students`
            };

            panel.querySelectorAll('.sr2-click-card').forEach(card => {
                card.addEventListener('click', () => {
                    const stat = card.getAttribute('data-stat') || 'overall';
                    openStatModal(titleByStat[stat] || summaryTitle, studentsByStat[stat] || []);
                });
            });
        }

        panel.querySelectorAll('.sr2-click-row').forEach(row => {
            row.addEventListener('click', () => {
                const encoded = row.getAttribute('data-group-key') || '';
                const key = decodeURIComponent(encoded);
                const data = map.get(key);
                const students = data && Array.isArray(data.students) ? data.students : [];
                openStatModal(`${keyTitle} • ${key}`, students);
            });
        });
    }

    function renderTrack() {
        const shsStudents = getShsStudents(SR2.students);
        renderGroupedReport({
            panelId: 'sr2-report-track',
            keyTitle: 'Track',
            sourceStudents: shsStudents,
            deriveKey: (student) => student.track,
            emptyMessage: 'No Grade 11/12 track data found in approved enrollments.'
        });
    }

    function renderElectives() {
        const panel = document.getElementById('sr2-report-electives');
        if (!panel) return;

        const shsStudents = getShsStudents(SR2.students);

        const map = new Map();
        shsStudents.forEach(student => {
            const electives = Array.isArray(student.electives) ? student.electives : [];
            if (!electives.length) return;
            electives.forEach(elective => {
                const key = String(elective || '').trim();
                if (!key) return;
                if (!map.has(key)) map.set(key, { total: 0, students: [] });
                const entry = map.get(key);
                entry.total += 1;
                entry.students.push(student);
            });
        });

        const rows = Array.from(map.entries())
            .sort((a, b) => b[1].total - a[1].total || a[0].localeCompare(b[0]))
            .map(([name, data]) => {
                const safeKey = encodeURIComponent(name);
                return `<tr class="sr2-click-row" data-group-key="${safeKey}"><td>${escapeHtml(name)}</td><td>${data.total}</td></tr>`;
            })
            .join('');

        panel.innerHTML = `
            <div class="table-container">
                <table class="report-table">
                    <thead><tr><th>Elective</th><th>Total Students</th></tr></thead>
                    <tbody>${rows || '<tr><td colspan="2" class="no-data">No Grade 11/12 electives found in approved enrollments.</td></tr>'}</tbody>
                </table>
            </div>
        `;

        panel.querySelectorAll('.sr2-click-row').forEach(row => {
            row.addEventListener('click', () => {
                const encoded = row.getAttribute('data-group-key') || '';
                const key = decodeURIComponent(encoded);
                const data = map.get(key);
                const students = data && Array.isArray(data.students) ? data.students : [];
                openStatModal(`Elective • ${key}`, students);
            });
        });
    }

    function renderDisability() {
        renderGroupedReport({
            panelId: 'sr2-report-disability',
            keyTitle: 'Disability Type',
            deriveKey: (student) => {
                if (Array.isArray(student.disabilities) && student.disabilities.length) {
                    return student.disabilities.join(', ');
                }
                return student.disabilityStatus;
            },
            emptyMessage: 'No disability records found in approved enrollments.',
            includeSummaryCards: true,
            summaryTitle: 'Disability'
        });
    }

    function renderIndigenous() {
        renderGroupedReport({
            panelId: 'sr2-report-indigenous',
            keyTitle: 'IP Group',
            deriveKey: (student) => student.ipGroup || (String(student.ipStatus || '').toLowerCase() === 'yes' ? 'IP Member' : ''),
            emptyMessage: 'No indigenous records found in approved enrollments.',
            includeSummaryCards: true,
            summaryTitle: 'Indigenous'
        });
    }

    function renderFourPs() {
        renderGroupedReport({
            panelId: 'sr2-report-4ps',
            keyTitle: '4Ps Status',
            deriveKey: (student) => {
                const value = String(student.fourPsStatus || '').trim();
                if (!value) return '';
                const normalized = value.toLowerCase();
                if (normalized === 'yes' || normalized === 'true' || normalized === '1') return '4Ps Beneficiary';
                return value;
            },
            emptyMessage: 'No 4Ps records found in approved enrollments.',
            includeSummaryCards: true,
            summaryTitle: '4Ps'
        });
    }

    function renderMotherTongue() {
        renderGroupedReport({
            panelId: 'sr2-report-mothertongue',
            keyTitle: 'Mother Tongue',
            deriveKey: (student) => student.motherTongue,
            emptyMessage: 'No mother tongue records found in approved enrollments.',
            includeGender: false,
            includeSummaryCards: true,
            summaryTitle: 'Mother Tongue'
        });
    }

    function renderReport(reportId) {
        if (reportId === 'demographics') return renderDemographics();
        if (reportId === 'disability') return renderDisability();
        if (reportId === 'indigenous') return renderIndigenous();
        if (reportId === '4ps') return renderFourPs();
        if (reportId === 'mothertongue') return renderMotherTongue();
        if (reportId === 'track') return renderTrack();
        if (reportId === 'electives') return renderElectives();
    }

    function exportCurrentToCsv() {
        const activePanel = document.getElementById(`sr2-report-${SR2.activeReport}`);
        if (!activePanel) return;
        const table = activePanel.querySelector('table');
        if (!table) {
            notify('No table data available for export.', 'error');
            return;
        }

        const csvEscape = (value) => {
            const text = String(value || '').replace(/\r?\n|\r/g, ' ').trim();
            if (/[",]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
            return text;
        };

        const rows = Array.from(table.querySelectorAll('tr')).map(row => {
            const cells = Array.from(row.querySelectorAll('th, td')).map(cell => csvEscape(cell.textContent || ''));
            return cells.join(',');
        }).join('\n');

        const blob = new Blob([rows], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `standard-reports-${SR2.activeReport}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        notify('Report exported successfully.', 'success');
    }

    function selectDemographicsPrintFilterV2() {
        const modal = document.getElementById('demographicsPrintModal');
        const closeBtn = document.getElementById('closeDemographicsPrintModal');
        const cancelBtn = document.getElementById('cancelDemographicsPrintBtn');
        const confirmBtn = document.getElementById('confirmDemographicsPrintBtn');
        const maleCheckbox = document.getElementById('demPrintMale');
        const femaleCheckbox = document.getElementById('demPrintFemale');
        const overallCheckbox = document.getElementById('demPrintOverall');
        const gradeCheckboxes = Array.from(document.querySelectorAll('.demPrintGrade'));

        if (!modal || !closeBtn || !cancelBtn || !confirmBtn || !maleCheckbox || !femaleCheckbox || !overallCheckbox || gradeCheckboxes.length === 0) {
            notify('Demographics print filter modal is not available.', 'error');
            return Promise.resolve(null);
        }

        maleCheckbox.checked = false;
        femaleCheckbox.checked = false;
        overallCheckbox.checked = true;
        gradeCheckboxes.forEach(cb => { cb.checked = false; });

        return new Promise((resolve) => {
            const syncOverallWithGender = () => {
                if (maleCheckbox.checked || femaleCheckbox.checked) {
                    overallCheckbox.checked = false;
                }
            };

            const syncGenderWithOverall = () => {
                if (overallCheckbox.checked) {
                    maleCheckbox.checked = false;
                    femaleCheckbox.checked = false;
                }
            };

            const closeModal = () => {
                modal.classList.remove('active');
                modal.setAttribute('aria-hidden', 'true');
                modal.style.display = 'none';
                modal.style.pointerEvents = 'none';
                document.body.style.overflow = '';
            };

            const cleanup = () => {
                maleCheckbox.removeEventListener('change', syncOverallWithGender);
                femaleCheckbox.removeEventListener('change', syncOverallWithGender);
                overallCheckbox.removeEventListener('change', syncGenderWithOverall);
                closeBtn.removeEventListener('click', onCancel);
                cancelBtn.removeEventListener('click', onCancel);
                confirmBtn.removeEventListener('click', onConfirm);
                modal.removeEventListener('click', onBackdropClick);
                document.removeEventListener('keydown', onEscape);
            };

            const finish = (result) => {
                cleanup();
                closeModal();
                resolve(result);
            };

            const onCancel = () => finish(null);

            const onBackdropClick = (event) => {
                if (event.target === modal) finish(null);
            };

            const onEscape = (event) => {
                if (event.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') {
                    finish(null);
                }
            };

            const onConfirm = () => {
                const selectedGrades = gradeCheckboxes
                    .filter(cb => cb.checked)
                    .map(cb => String(cb.value))
                    .filter(v => /^(7|8|9|10|11|12)$/.test(v))
                    .sort((a, b) => Number(a) - Number(b));

                const maleChecked = !!maleCheckbox.checked;
                const femaleChecked = !!femaleCheckbox.checked;
                const overallChecked = !!overallCheckbox.checked;

                if (!maleChecked && !femaleChecked && !overallChecked && selectedGrades.length === 0) {
                    notify('Please select at least one filter option.', 'error');
                    return;
                }

                let genders = [];
                let restrictGender = false;

                if (overallChecked || (!maleChecked && !femaleChecked)) {
                    genders = ['male', 'female'];
                    restrictGender = false;
                } else {
                    if (maleChecked) genders.push('male');
                    if (femaleChecked) genders.push('female');
                    restrictGender = genders.length > 0;
                }

                const restrictGrade = selectedGrades.length > 0;

                const genderLabel = overallChecked
                    ? 'Overall'
                    : (maleChecked && femaleChecked)
                        ? 'Male + Female'
                        : maleChecked
                            ? 'Male Only'
                            : femaleChecked
                                ? 'Female Only'
                                : 'All Genders';

                const gradeLabelText = restrictGrade
                    ? `Grade ${selectedGrades.join(', Grade ')}`
                    : 'All Grades';

                finish({
                    type: 'combined',
                    genders,
                    grades: selectedGrades,
                    restrictGender,
                    restrictGrade,
                    overall: overallChecked,
                    label: `${genderLabel} + ${gradeLabelText}`
                });
            };

            maleCheckbox.addEventListener('change', syncOverallWithGender);
            femaleCheckbox.addEventListener('change', syncOverallWithGender);
            overallCheckbox.addEventListener('change', syncGenderWithOverall);
            closeBtn.addEventListener('click', onCancel);
            cancelBtn.addEventListener('click', onCancel);
            confirmBtn.addEventListener('click', onConfirm);
            modal.addEventListener('click', onBackdropClick);
            document.addEventListener('keydown', onEscape);

            modal.setAttribute('aria-hidden', 'false');
            modal.classList.add('active');
            modal.style.display = 'flex';
            modal.style.pointerEvents = 'auto';
            document.body.style.overflow = 'hidden';
        });
    }

    function openCombinedPrintFilterModal(config) {
        const {
            modalId,
            closeId,
            cancelId,
            confirmId,
            maleId,
            femaleId,
            overallId,
            typeContainerId,
            typeCheckboxClass,
            typeOptions = [],
            gradeSelector,
            buildResult
        } = config;

        const modal = document.getElementById(modalId);
        const closeBtn = document.getElementById(closeId);
        const cancelBtn = document.getElementById(cancelId);
        const confirmBtn = document.getElementById(confirmId);
        const maleCheckbox = document.getElementById(maleId);
        const femaleCheckbox = document.getElementById(femaleId);
        const overallCheckbox = document.getElementById(overallId);
        const typeContainer = typeContainerId ? document.getElementById(typeContainerId) : null;
        const gradeCheckboxes = gradeSelector ? Array.from(document.querySelectorAll(gradeSelector)) : [];

        if (!modal || !closeBtn || !cancelBtn || !confirmBtn || !maleCheckbox || !femaleCheckbox || !overallCheckbox) {
            notify('Print filter modal is not available.', 'error');
            return Promise.resolve(null);
        }

        maleCheckbox.checked = false;
        femaleCheckbox.checked = false;
        overallCheckbox.checked = true;

        if (gradeCheckboxes.length) {
            gradeCheckboxes.forEach(cb => { cb.checked = false; });
        }

        if (typeContainer && typeCheckboxClass) {
            typeContainer.innerHTML = '';
            if (!typeOptions.length) {
                typeContainer.innerHTML = '<div class="no-data">No options available</div>';
            } else {
                typeOptions.forEach(option => {
                    const safe = escapeHtml(option);
                    const label = document.createElement('label');
                    label.style.display = 'flex';
                    label.style.alignItems = 'center';
                    label.style.gap = '8px';
                    label.innerHTML = `<input type="checkbox" class="${typeCheckboxClass}" value="${safe}" /> ${safe}`;
                    typeContainer.appendChild(label);
                });
            }
        }

        return new Promise((resolve) => {
            const syncOverallWithGender = () => {
                if (maleCheckbox.checked || femaleCheckbox.checked) overallCheckbox.checked = false;
            };

            const syncGenderWithOverall = () => {
                if (overallCheckbox.checked) {
                    maleCheckbox.checked = false;
                    femaleCheckbox.checked = false;
                }
            };

            const closeModal = () => {
                modal.classList.remove('active');
                modal.setAttribute('aria-hidden', 'true');
                modal.style.display = 'none';
                modal.style.pointerEvents = 'none';
                document.body.style.overflow = '';
            };

            const cleanup = () => {
                maleCheckbox.removeEventListener('change', syncOverallWithGender);
                femaleCheckbox.removeEventListener('change', syncOverallWithGender);
                overallCheckbox.removeEventListener('change', syncGenderWithOverall);
                closeBtn.removeEventListener('click', onCancel);
                cancelBtn.removeEventListener('click', onCancel);
                confirmBtn.removeEventListener('click', onConfirm);
                modal.removeEventListener('click', onBackdrop);
                document.removeEventListener('keydown', onEscape);
            };

            const finish = (result) => {
                cleanup();
                closeModal();
                resolve(result);
            };

            const onCancel = () => finish(null);
            const onBackdrop = (event) => { if (event.target === modal) finish(null); };
            const onEscape = (event) => {
                if (event.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') finish(null);
            };

            const onConfirm = () => {
                const maleChecked = !!maleCheckbox.checked;
                const femaleChecked = !!femaleCheckbox.checked;
                const overallChecked = !!overallCheckbox.checked;

                let genders = [];
                let restrictGender = false;
                if (overallChecked || (!maleChecked && !femaleChecked)) {
                    genders = ['male', 'female'];
                    restrictGender = false;
                } else {
                    if (maleChecked) genders.push('male');
                    if (femaleChecked) genders.push('female');
                    restrictGender = genders.length > 0;
                }

                const selectedTypes = typeContainer && typeCheckboxClass
                    ? Array.from(typeContainer.querySelectorAll(`.${typeCheckboxClass}:checked`)).map(cb => String(cb.value || '').trim()).filter(Boolean)
                    : [];

                const selectedGrades = gradeCheckboxes
                    .filter(cb => cb.checked)
                    .map(cb => String(cb.value || '').trim())
                    .filter(Boolean);

                const result = buildResult({
                    genders,
                    restrictGender,
                    selectedTypes,
                    selectedGrades,
                    maleChecked,
                    femaleChecked,
                    overallChecked
                });

                finish(result);
            };

            maleCheckbox.addEventListener('change', syncOverallWithGender);
            femaleCheckbox.addEventListener('change', syncOverallWithGender);
            overallCheckbox.addEventListener('change', syncGenderWithOverall);
            closeBtn.addEventListener('click', onCancel);
            cancelBtn.addEventListener('click', onCancel);
            confirmBtn.addEventListener('click', onConfirm);
            modal.addEventListener('click', onBackdrop);
            document.addEventListener('keydown', onEscape);

            modal.setAttribute('aria-hidden', 'false');
            modal.classList.add('active');
            modal.style.display = 'flex';
            modal.style.pointerEvents = 'auto';
            document.body.style.overflow = 'hidden';
        });
    }

    function selectDisabilityPrintFilterV2() {
        const optionSet = new Set();
        SR2.students.forEach(student => {
            const values = Array.isArray(student.disabilities) && student.disabilities.length
                ? student.disabilities
                : (String(student.disabilityStatus || '').split(',').map(v => v.trim()).filter(Boolean));
            values.forEach(v => optionSet.add(v));
        });
        const options = Array.from(optionSet).sort((a, b) => a.localeCompare(b));

        return openCombinedPrintFilterModal({
            modalId: 'disabilityPrintModal',
            closeId: 'closeDisabilityPrintModal',
            cancelId: 'cancelDisabilityPrintBtn',
            confirmId: 'confirmDisabilityPrintBtn',
            maleId: 'disPrintMale',
            femaleId: 'disPrintFemale',
            overallId: 'disPrintOverall',
            typeContainerId: 'disabilityTypeCheckboxes',
            typeCheckboxClass: 'sr2DisPrintType',
            typeOptions: options,
            buildResult: ({ genders, restrictGender, selectedTypes, maleChecked, femaleChecked, overallChecked }) => {
                const genderLabel = overallChecked ? 'Overall' : (maleChecked && femaleChecked ? 'Male + Female' : maleChecked ? 'Male Only' : femaleChecked ? 'Female Only' : 'All Genders');
                const typeLabel = selectedTypes.length ? selectedTypes.join(', ') : 'All Disability Types';
                return {
                    type: 'combined',
                    genders,
                    restrictGender,
                    disabilityTypes: selectedTypes,
                    restrictType: selectedTypes.length > 0,
                    label: `${genderLabel} + ${typeLabel}`
                };
            }
        });
    }

    function selectIndigenousPrintFilterV2() {
        const optionSet = new Set();
        SR2.students.forEach(student => {
            const value = String(student.ipGroup || student.ipStatus || '').trim();
            if (value) optionSet.add(value);
        });
        const options = Array.from(optionSet).sort((a, b) => a.localeCompare(b));

        return openCombinedPrintFilterModal({
            modalId: 'indigenousPrintModal',
            closeId: 'closeIndigenousPrintModal',
            cancelId: 'cancelIndigenousPrintBtn',
            confirmId: 'confirmIndigenousPrintBtn',
            maleId: 'ipPrintMale',
            femaleId: 'ipPrintFemale',
            overallId: 'ipPrintOverall',
            typeContainerId: 'ipGroupCheckboxes',
            typeCheckboxClass: 'sr2IpPrintGroup',
            typeOptions: options,
            buildResult: ({ genders, restrictGender, selectedTypes, maleChecked, femaleChecked, overallChecked }) => {
                const genderLabel = overallChecked ? 'Overall' : (maleChecked && femaleChecked ? 'Male + Female' : maleChecked ? 'Male Only' : femaleChecked ? 'Female Only' : 'All Genders');
                const groupLabel = selectedTypes.length ? selectedTypes.join(', ') : 'All IP Groups';
                return {
                    type: 'combined',
                    genders,
                    restrictGender,
                    ipGroups: selectedTypes,
                    restrictGroup: selectedTypes.length > 0,
                    label: `${genderLabel} + ${groupLabel}`
                };
            }
        });
    }

    function selectFourPsPrintFilterV2() {
        return openCombinedPrintFilterModal({
            modalId: 'fourPsPrintModal',
            closeId: 'closeFourPsPrintModal',
            cancelId: 'cancelFourPsPrintBtn',
            confirmId: 'confirmFourPsPrintBtn',
            maleId: 'fourPsPrintMale',
            femaleId: 'fourPsPrintFemale',
            overallId: 'fourPsPrintOverall',
            gradeSelector: '.fourPsPrintGrade',
            buildResult: ({ genders, restrictGender, selectedGrades, maleChecked, femaleChecked, overallChecked }) => {
                const cleanedGrades = selectedGrades.filter(v => /^(7|8|9|10|11|12)$/.test(v)).sort((a, b) => Number(a) - Number(b));
                const genderLabel = overallChecked ? 'Overall' : (maleChecked && femaleChecked ? 'Male + Female' : maleChecked ? 'Male Only' : femaleChecked ? 'Female Only' : 'All Genders');
                const gradeLabel = cleanedGrades.length ? `Grade ${cleanedGrades.join(', Grade ')}` : 'All Grades';
                return {
                    type: 'combined',
                    genders,
                    restrictGender,
                    grades: cleanedGrades,
                    restrictGrade: cleanedGrades.length > 0,
                    label: `${genderLabel} + ${gradeLabel}`
                };
            }
        });
    }

    function selectMotherTonguePrintFilterV2() {
        const optionSet = new Set();
        SR2.students.forEach(student => {
            const value = String(student.motherTongue || '').trim();
            if (value) optionSet.add(value);
        });
        const options = Array.from(optionSet).sort((a, b) => a.localeCompare(b));

        return openCombinedPrintFilterModal({
            modalId: 'motherTonguePrintModal',
            closeId: 'closeMotherTonguePrintModal',
            cancelId: 'cancelMotherTonguePrintBtn',
            confirmId: 'confirmMotherTonguePrintBtn',
            maleId: 'mtPrintMale',
            femaleId: 'mtPrintFemale',
            overallId: 'mtPrintOverall',
            typeContainerId: 'motherTongueCheckboxes',
            typeCheckboxClass: 'sr2MtPrintType',
            typeOptions: options,
            buildResult: ({ genders, restrictGender, selectedTypes, maleChecked, femaleChecked, overallChecked }) => {
                const genderLabel = overallChecked ? 'Overall' : (maleChecked && femaleChecked ? 'Male + Female' : maleChecked ? 'Male Only' : femaleChecked ? 'Female Only' : 'All Genders');
                const typeLabel = selectedTypes.length ? selectedTypes.join(', ') : 'All Mother Tongues';
                return {
                    type: 'combined',
                    genders,
                    restrictGender,
                    motherTongues: selectedTypes,
                    restrictType: selectedTypes.length > 0,
                    label: `${genderLabel} + ${typeLabel}`
                };
            }
        });
    }

    function selectTrackPrintFilterV2() {
        const shsStudents = getShsStudents(SR2.students);
        const optionSet = new Set();
        shsStudents.forEach(student => {
            const raw = String(student.track || '').trim().toLowerCase();
            if (!raw) return;
            if (raw.includes('academic')) optionSet.add('Academic');
            else if (raw.includes('techpro')) optionSet.add('TechPro');
            else if (raw.includes('doorway')) optionSet.add('Doorway');
            else optionSet.add(String(student.track || '').trim());
        });
        const options = Array.from(optionSet).sort((a, b) => a.localeCompare(b));

        return openCombinedPrintFilterModal({
            modalId: 'trackPrintModal',
            closeId: 'closeTrackPrintModal',
            cancelId: 'cancelTrackPrintBtn',
            confirmId: 'confirmTrackPrintBtn',
            maleId: 'trackPrintMale',
            femaleId: 'trackPrintFemale',
            overallId: 'trackPrintOverall',
            typeContainerId: 'trackTypeCheckboxes',
            typeCheckboxClass: 'sr2TrackPrintType',
            typeOptions: options,
            buildResult: ({ genders, restrictGender, selectedTypes, maleChecked, femaleChecked, overallChecked }) => {
                const genderLabel = overallChecked ? 'Overall' : (maleChecked && femaleChecked ? 'Male + Female' : maleChecked ? 'Male Only' : femaleChecked ? 'Female Only' : 'All Genders');
                const typeLabel = selectedTypes.length ? selectedTypes.join(', ') : 'All Tracks';
                return {
                    type: 'combined',
                    genders,
                    restrictGender,
                    tracks: selectedTypes,
                    restrictType: selectedTypes.length > 0,
                    label: `${genderLabel} + ${typeLabel}`
                };
            }
        });
    }

    function selectElectivesPrintFilterV2() {
        const shsStudents = getShsStudents(SR2.students);
        const optionSet = new Set();
        shsStudents.forEach(student => {
            const electives = Array.isArray(student.electives) ? student.electives : [];
            electives.forEach(item => {
                const value = String(item || '').trim();
                if (value) optionSet.add(value);
            });
        });
        const options = Array.from(optionSet).sort((a, b) => a.localeCompare(b));

        return openCombinedPrintFilterModal({
            modalId: 'electivesPrintModal',
            closeId: 'closeElectivesPrintModal',
            cancelId: 'cancelElectivesPrintBtn',
            confirmId: 'confirmElectivesPrintBtn',
            maleId: 'electivePrintMale',
            femaleId: 'electivePrintFemale',
            overallId: 'electivePrintOverall',
            typeContainerId: 'electiveTypeCheckboxes',
            typeCheckboxClass: 'sr2ElectivePrintType',
            typeOptions: options,
            buildResult: ({ genders, restrictGender, selectedTypes, maleChecked, femaleChecked, overallChecked }) => {
                const genderLabel = overallChecked ? 'Overall' : (maleChecked && femaleChecked ? 'Male + Female' : maleChecked ? 'Male Only' : femaleChecked ? 'Female Only' : 'All Genders');
                const typeLabel = selectedTypes.length ? selectedTypes.join(', ') : 'All Electives';
                return {
                    type: 'combined',
                    genders,
                    restrictGender,
                    electives: selectedTypes,
                    restrictType: selectedTypes.length > 0,
                    label: `${genderLabel} + ${typeLabel}`
                };
            }
        });
    }

    async function printCurrentReport() {
        let selectedDemographicsFilter = null;
        let selectedPrintFilter = null;

        if (SR2.activeReport === 'demographics') {
            selectedDemographicsFilter = await selectDemographicsPrintFilterV2();
            if (!selectedDemographicsFilter) return;
        } else {
            const pickerByReport = {
                disability: selectDisabilityPrintFilterV2,
                indigenous: selectIndigenousPrintFilterV2,
                '4ps': selectFourPsPrintFilterV2,
                mothertongue: selectMotherTonguePrintFilterV2,
                track: selectTrackPrintFilterV2,
                electives: selectElectivesPrintFilterV2
            };

            const picker = pickerByReport[SR2.activeReport];
            if (typeof picker !== 'function') {
                notify('Print filter modal is not available for this report.', 'error');
                return;
            }

            selectedPrintFilter = await picker();
            if (!selectedPrintFilter) return;
        }

        const buildColumnsAndRows = () => {
            const reportType = SR2.activeReport;
            const baseColumns = [
                { key: 'fullName', label: 'Student Name' },
                { key: 'lrn', label: 'LRN' },
                { key: 'gender', label: 'Gender' },
                { key: 'gradeLevel', label: 'Grade' },
                { key: 'section', label: 'Section' }
            ];

            const mapGender = (value) => normalizeGenderLabel(value);
            const grade = (value) => gradeLabel(value);
            const applyGenderFilter = (students, filter) => {
                if (!filter || !filter.restrictGender) return students.slice();
                const allowed = Array.isArray(filter.genders)
                    ? filter.genders.map(v => String(v || '').toLowerCase())
                    : [];
                if (!allowed.length) return students.slice();
                return students.filter(student => allowed.includes(safeGender(student.gender)));
            };

            const normalizeTrackName = (value) => {
                const raw = String(value || '').trim().toLowerCase();
                if (!raw || raw === 'none') return '';
                if (raw.includes('academic')) return 'Academic';
                if (raw.includes('techpro')) return 'TechPro';
                if (raw.includes('doorway')) return 'Doorway';
                return raw.charAt(0).toUpperCase() + raw.slice(1);
            };

            const normalizeDisabilityTypes = (student) => {
                if (!student || typeof student !== 'object') return [];
                if (Array.isArray(student.disabilities) && student.disabilities.length > 0) {
                    return student.disabilities
                        .map(item => String(item || '').trim())
                        .filter(Boolean)
                        .map(item => item.charAt(0).toUpperCase() + item.slice(1));
                }
                const text = String(student.disabilityStatus || '').trim();
                if (!text) return [];
                return text
                    .split(',')
                    .map(item => String(item || '').trim())
                    .filter(Boolean)
                    .map(item => item.charAt(0).toUpperCase() + item.slice(1));
            };

            const normalizeIpGroupName = (student) => {
                const raw = String(student?.ipGroup || student?.ipStatus || '').trim();
                if (!raw || raw.toLowerCase() === 'none') return '';
                return raw;
            };

            const normalizeMotherTongueName = (student) => {
                const raw = String(student?.motherTongue || '').trim();
                if (!raw || raw.toLowerCase() === 'none') return '';
                return raw;
            };

            if (reportType === 'track') {
                let shsStudents = getShsStudents(SR2.students);
                shsStudents = applyGenderFilter(shsStudents, selectedPrintFilter);
                if (selectedPrintFilter && selectedPrintFilter.restrictType && Array.isArray(selectedPrintFilter.tracks) && selectedPrintFilter.tracks.length > 0) {
                    const selectedTracks = selectedPrintFilter.tracks.map(v => String(v || '').trim());
                    shsStudents = shsStudents.filter(student => selectedTracks.includes(normalizeTrackName(student.track)));
                }
                return {
                    title: 'Track (SHS Grade 11-12)',
                    columns: [...baseColumns, { key: 'track', label: 'Track' }],
                    filterLabel: selectedPrintFilter && selectedPrintFilter.label
                        ? String(selectedPrintFilter.label)
                        : 'Overall + All Tracks',
                    rows: shsStudents.map(student => ({
                        ...student,
                        gender: mapGender(student.gender),
                        gradeLevel: grade(student.gradeLevel),
                        track: normalizeTrackName(student.track) || 'Unspecified'
                    }))
                };
            }

            if (reportType === 'electives') {
                let shsStudents = getShsStudents(SR2.students);
                shsStudents = applyGenderFilter(shsStudents, selectedPrintFilter);
                if (selectedPrintFilter && selectedPrintFilter.restrictType && Array.isArray(selectedPrintFilter.electives) && selectedPrintFilter.electives.length > 0) {
                    const selectedElectives = selectedPrintFilter.electives.map(v => String(v || '').trim());
                    shsStudents = shsStudents.filter(student => {
                        const electiveList = Array.isArray(student.electives) ? student.electives.map(v => String(v || '').trim()) : [];
                        return electiveList.some(item => selectedElectives.includes(item));
                    });
                }
                return {
                    title: 'Electives (SHS Grade 11-12)',
                    columns: [...baseColumns, { key: 'electives', label: 'Electives' }],
                    filterLabel: selectedPrintFilter && selectedPrintFilter.label
                        ? String(selectedPrintFilter.label)
                        : 'Overall + All Electives',
                    rows: shsStudents.map(student => ({
                        ...student,
                        gender: mapGender(student.gender),
                        gradeLevel: grade(student.gradeLevel),
                        electives: Array.isArray(student.electives) && student.electives.length
                            ? student.electives.join(', ')
                            : 'Unspecified'
                    }))
                };
            }

            if (reportType === 'disability') {
                let filtered = applyGenderFilter(SR2.students, selectedPrintFilter);
                if (selectedPrintFilter && selectedPrintFilter.restrictType && Array.isArray(selectedPrintFilter.disabilityTypes) && selectedPrintFilter.disabilityTypes.length > 0) {
                    const selectedTypes = selectedPrintFilter.disabilityTypes.map(v => String(v || '').trim().toLowerCase());
                    filtered = filtered.filter(student => {
                        const types = normalizeDisabilityTypes(student).map(v => String(v || '').trim().toLowerCase());
                        return types.some(type => selectedTypes.includes(type));
                    });
                }
                return {
                    title: 'Disability',
                    columns: [...baseColumns, { key: 'disability', label: 'Disability Type' }],
                    filterLabel: selectedPrintFilter && selectedPrintFilter.label
                        ? String(selectedPrintFilter.label)
                        : 'Overall + All Disability Types',
                    rows: filtered.map(student => ({
                        ...student,
                        gender: mapGender(student.gender),
                        gradeLevel: grade(student.gradeLevel),
                        disability: (() => {
                            const types = normalizeDisabilityTypes(student);
                            return types.length ? types.join(', ') : 'Unspecified';
                        })()
                    }))
                };
            }

            if (reportType === 'indigenous') {
                let filtered = applyGenderFilter(SR2.students, selectedPrintFilter);
                if (selectedPrintFilter && selectedPrintFilter.restrictGroup && Array.isArray(selectedPrintFilter.ipGroups) && selectedPrintFilter.ipGroups.length > 0) {
                    const selectedGroups = selectedPrintFilter.ipGroups.map(v => String(v || '').trim().toLowerCase());
                    filtered = filtered.filter(student => selectedGroups.includes(normalizeIpGroupName(student).toLowerCase()));
                }
                return {
                    title: 'Indigenous',
                    columns: [...baseColumns, { key: 'ipGroup', label: 'IP Group / Status' }],
                    filterLabel: selectedPrintFilter && selectedPrintFilter.label
                        ? String(selectedPrintFilter.label)
                        : 'Overall + All IP Groups',
                    rows: filtered.map(student => ({
                        ...student,
                        gender: mapGender(student.gender),
                        gradeLevel: grade(student.gradeLevel),
                        ipGroup: normalizeIpGroupName(student) || 'Unspecified'
                    }))
                };
            }

            if (reportType === '4ps') {
                let filtered = applyGenderFilter(SR2.students, selectedPrintFilter);
                if (selectedPrintFilter && selectedPrintFilter.restrictGrade && Array.isArray(selectedPrintFilter.grades) && selectedPrintFilter.grades.length > 0) {
                    const selectedGrades = selectedPrintFilter.grades
                        .map(v => Number.parseInt(String(v || ''), 10))
                        .filter(Number.isFinite);
                    filtered = filtered.filter(student => selectedGrades.includes(parseGradeLevelNumber(student?.gradeLevel)));
                }
                return {
                    title: '4Ps',
                    columns: [...baseColumns, { key: 'fourPsStatus', label: '4Ps Status' }],
                    filterLabel: selectedPrintFilter && selectedPrintFilter.label
                        ? String(selectedPrintFilter.label)
                        : 'Overall + All Grades',
                    rows: filtered.map(student => ({
                        ...student,
                        gender: mapGender(student.gender),
                        gradeLevel: grade(student.gradeLevel),
                        fourPsStatus: student.fourPsStatus || 'Unspecified'
                    }))
                };
            }

            if (reportType === 'mothertongue') {
                let filtered = applyGenderFilter(SR2.students, selectedPrintFilter);
                if (selectedPrintFilter && selectedPrintFilter.restrictType && Array.isArray(selectedPrintFilter.motherTongues) && selectedPrintFilter.motherTongues.length > 0) {
                    const selectedTypes = selectedPrintFilter.motherTongues.map(v => String(v || '').trim().toLowerCase());
                    filtered = filtered.filter(student => selectedTypes.includes(normalizeMotherTongueName(student).toLowerCase()));
                }
                return {
                    title: 'Mother Tongue',
                    columns: [...baseColumns, { key: 'motherTongue', label: 'Mother Tongue' }],
                    filterLabel: selectedPrintFilter && selectedPrintFilter.label
                        ? String(selectedPrintFilter.label)
                        : 'Overall + All Mother Tongues',
                    rows: filtered.map(student => ({
                        ...student,
                        gender: mapGender(student.gender),
                        gradeLevel: grade(student.gradeLevel),
                        motherTongue: normalizeMotherTongueName(student) || 'Unspecified'
                    }))
                };
            }

            let demographicsStudents = SR2.students.slice();

            if (selectedDemographicsFilter && typeof selectedDemographicsFilter === 'object') {
                const allowedGenders = Array.isArray(selectedDemographicsFilter.genders)
                    ? selectedDemographicsFilter.genders.map(g => String(g || '').toLowerCase())
                    : [];

                if (selectedDemographicsFilter.restrictGender && allowedGenders.length > 0) {
                    demographicsStudents = demographicsStudents.filter(student => allowedGenders.includes(safeGender(student.gender)));
                }

                const selectedGrades = Array.isArray(selectedDemographicsFilter.grades)
                    ? selectedDemographicsFilter.grades.map(v => Number.parseInt(String(v || ''), 10)).filter(Number.isFinite)
                    : [];

                if (selectedDemographicsFilter.restrictGrade && selectedGrades.length > 0) {
                    demographicsStudents = demographicsStudents.filter(student => {
                        const gradeNum = parseGradeLevelNumber(student && student.gradeLevel);
                        return selectedGrades.includes(gradeNum);
                    });
                }
            }

            return {
                title: 'Demographics',
                columns: baseColumns,
                filterLabel: selectedDemographicsFilter && selectedDemographicsFilter.label
                    ? String(selectedDemographicsFilter.label)
                    : 'Overall + All Grades',
                rows: demographicsStudents.map(student => ({
                    ...student,
                    gender: mapGender(student.gender),
                    gradeLevel: grade(student.gradeLevel)
                }))
            };
        };

        const printableData = buildColumnsAndRows();
        const rows = Array.isArray(printableData.rows) ? printableData.rows : [];

        if (rows.length === 0) {
            notify('No student records available to print for this report.', 'error');
            return;
        }

        const printable = window.open('', '_blank');
        if (!printable) {
            notify('Pop-up blocked. Please allow pop-ups to print.', 'error');
            return;
        }

        const title = `Standard Report - ${SR2.activeReport.toUpperCase()}`;
        const tableHeaders = printableData.columns.map(column => `<th>${column.label}</th>`).join('');
        const tableRows = rows.map((row, index) => {
            const cells = printableData.columns.map(column => {
                const value = row[column.key];
                const text = String(value === undefined || value === null || value === '' ? '-' : value);
                return `<td>${escapeHtml(text)}</td>`;
            }).join('');
            return `<tr><td>${index + 1}</td>${cells}</tr>`;
        }).join('');

        printable.document.write(`
            <html>
            <head>
                <title>${title}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
                    h1 { margin-bottom: 6px; }
                    p { margin-top: 0; color: #555; }
                    table { width: 100%; border-collapse: collapse; margin-top: 18px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background: #f0f0f0; }
                    .meta { margin: 4px 0; color: #444; font-size: 14px; }
                </style>
            </head>
            <body>
                <h1>${title}</h1>
                <p>Generated on ${new Date().toLocaleString()}</p>
                <div class="meta"><strong>Report:</strong> ${escapeHtml(printableData.title)}</div>
                ${printableData.filterLabel ? `<div class="meta"><strong>Filter:</strong> ${escapeHtml(printableData.filterLabel)}</div>` : ''}
                <div class="meta"><strong>Total Students:</strong> ${rows.length}</div>
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            ${tableHeaders}
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </body>
            </html>
        `);

        printable.document.close();
        printable.focus();
        printable.print();
    }

    async function loadAndRender(reportId) {
        if (reportId) SR2.activeReport = reportId;

        const loadingLabel = document.getElementById('sr2-loading-label');
        if (loadingLabel) loadingLabel.textContent = 'Loading active-year enrollments...';

        try {
            SR2.students = await fetchStudents();
            switchReport(SR2.activeReport);
            if (loadingLabel) {
                const suffix = SR2.dataMode === 'approved'
                    ? 'approved students.'
                    : 'active-year students (no approved records found).';
                loadingLabel.textContent = `Loaded ${SR2.students.length} ${suffix}`;
            }
        } catch (err) {
            console.error('[StandardReports-v2] Load failed:', err);
            if (loadingLabel) loadingLabel.textContent = 'Failed to load report data.';
            notify('Failed to load Standard Reports data.', 'error');
        }
    }

    function injectStyles() {
        if (document.getElementById('sr2-style')) return;
        const style = document.createElement('style');
        style.id = 'sr2-style';
        style.textContent = `
            .sr2-toolbar { display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap; margin-bottom:12px; }
            .sr2-tabs { display:flex; gap:8px; flex-wrap:wrap; margin:12px 0 16px; }
            .sr2-tab { border:1px solid var(--border-primary, #ddd); background:var(--card-bg, #fff); color:var(--text-primary, #111); padding:10px 12px; border-radius:8px; cursor:pointer; }
            .sr2-tab.active { border-color: var(--primary-green, #1e5631); box-shadow: inset 0 0 0 1px var(--primary-green, #1e5631); }
            .sr2-panel { display:none; }
            .sr2-panel.active { display:block; }
            .sr2-cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:10px; margin-bottom:12px; }
            .sr2-card { border:1px solid var(--border-primary, #ddd); border-radius:10px; padding:12px; background:var(--card-bg, #fff); }
            .sr2-click-card { text-align:left; width:100%; cursor:pointer; }
            .sr2-click-card:hover { border-color: var(--primary-green, #1e5631); box-shadow: 0 0 0 1px var(--primary-green, #1e5631); }
            .sr2-click-row { cursor:pointer; }
            .sr2-click-row:hover td { background: var(--bg-hover, rgba(30, 86, 49, 0.08)); }
            .sr2-label { font-size:12px; color:var(--text-secondary, #666); margin-bottom:4px; }
            .sr2-value { font-size:22px; font-weight:700; color:var(--text-primary, #111); }
            .sr2-helper { font-size:12px; color:var(--text-secondary, #666); margin-top:8px; }
        `;
        document.head.appendChild(style);
    }

    function renderShell(section) {
        section.innerHTML = `
            <div class="section-header">
                <h2>📊 Standard Reports</h2>
                <p class="section-subtitle">Approved enrollment reports (v2)</p>
            </div>

            <div class="approval-notice">
                <span class="notice-icon">ℹ️</span>
                <span class="notice-text"><strong>Note:</strong> This module uses <strong>active school year</strong> data and prioritizes approved enrollments.</span>
            </div>

            <div class="content-card">
                <div class="sr2-toolbar">
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <button id="sr2-reload" class="btn btn-primary">🔄 Reload Reports</button>
                        <button id="sr2-print" class="btn btn-secondary">🖨️ Print Current</button>
                        <button id="sr2-export" class="btn btn-secondary">📥 Export CSV</button>
                    </div>
                    <div id="sr2-loading-label" class="sr2-helper">Initializing Standard Reports...</div>
                </div>

                <div class="sr2-tabs report-tabs">
                    <button class="sr2-tab active" data-report="demographics">👥 Demographics</button>
                    <button class="sr2-tab" data-report="disability">♿ Disability</button>
                    <button class="sr2-tab" data-report="indigenous">🌾 Indigenous</button>
                    <button class="sr2-tab" data-report="4ps">🧾 4Ps</button>
                    <button class="sr2-tab" data-report="mothertongue">🗣️ Mother Tongue</button>
                    <button class="sr2-tab" data-report="track">🎓 Track</button>
                    <button class="sr2-tab" data-report="electives">📚 Electives</button>
                </div>

                <div id="sr2-report-demographics" class="sr2-panel active"></div>
                <div id="sr2-report-disability" class="sr2-panel"></div>
                <div id="sr2-report-indigenous" class="sr2-panel"></div>
                <div id="sr2-report-4ps" class="sr2-panel"></div>
                <div id="sr2-report-mothertongue" class="sr2-panel"></div>
                <div id="sr2-report-track" class="sr2-panel"></div>
                <div id="sr2-report-electives" class="sr2-panel"></div>
            </div>
        `;
    }

    function bindEvents(section) {
        section.querySelectorAll('.sr2-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                const reportId = btn.getAttribute('data-report') || 'demographics';
                switchReport(reportId);
            });
        });

        section.querySelector('#sr2-reload')?.addEventListener('click', () => loadAndRender(SR2.activeReport));
        section.querySelector('#sr2-print')?.addEventListener('click', printCurrentReport);
        section.querySelector('#sr2-export')?.addEventListener('click', exportCurrentToCsv);
    }

    function mount() {
        const section = document.getElementById('standard-reports');
        if (!section) return;

        ensureStatModalBindings();
        injectStyles();
        renderShell(section);
        bindEvents(section);

        SR2.initialized = true;
        loadAndRender('demographics');
    }

    function ensureMountedAndLoad(reportType = 'demographics') {
        if (!SR2.initialized || !document.getElementById('sr2-report-demographics')) {
            mount();
        }
        if (reportType) {
            switchReport(reportType);
            renderReport(reportType);
        }
        loadAndRender(reportType || SR2.activeReport);
    }

    window.setupReportTabs = function setupReportTabsV2() {
        ensureMountedAndLoad(SR2.activeReport || 'demographics');
    };

    window.loadReportData = async function loadReportDataV2(reportType) {
        const target = reportType || SR2.activeReport || 'demographics';
        ensureMountedAndLoad(target);
    };

    window.__standardReportsV2 = {
        reload: () => loadAndRender(SR2.activeReport),
        switch: (reportType) => switchReport(reportType)
    };

    function bindSchoolYearRefresh() {
        const reload = () => {
            ensureMountedAndLoad(SR2.activeReport || 'demographics');
        };

        window.addEventListener('schoolYearActivated', reload);
        window.addEventListener('dashboard:school-year-changed', reload);
        window.addEventListener('storage', (event) => {
            if (!event || !event.key) return;
            if (event.key === 'activeSchoolYear' || event.key === 'activeSchoolYearChangedAt') {
                reload();
            }
        });
    }

    bindSchoolYearRefresh();

    document.addEventListener('DOMContentLoaded', () => {
        mount();

        document.addEventListener('click', (event) => {
            const menuItem = event.target.closest('.menu-item[data-section="standard-reports"]');
            if (!menuItem) return;
            setTimeout(() => {
                ensureMountedAndLoad(SR2.activeReport || 'demographics');
            }, 0);
        }, true);
    });
})();



