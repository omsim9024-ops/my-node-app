// Visualization module (separate from admin-dashboard.js)
// Uses Chart.js (loaded by admin-dashboard.html)

const vizCharts = {
    gender: null,
    grade: null,
    disability: null,
    indigenous: null,
    fourPs: null,
    motherTongue: null,
    track: null,
    electives: null
};

const vizEnrollmentCache = {
    schoolCode: '',
    approvedEnrollments: [],
    fetchedAt: 0
};

// if the datalabels plugin is loaded we register it globally so charts
// can display numeric labels on top of bars. the plugin is added via
// CDN tag in admin-dashboard.html.
if (typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined') {
    try {
        Chart.register(ChartDataLabels);
    } catch (e) {
        console.warn('Visualization: failed to register ChartDataLabels', e);
    }
}

function isDarkModeActive() {
    return document.body.classList.contains('dark-mode') || document.documentElement.classList.contains('dark-mode');
}

function getChartThemeTokens() {
    const style = getComputedStyle(document.body);
    const fallback = isDarkModeActive()
        ? {
            text: '#e5e7eb',
            tick: '#cbd5e1',
            grid: 'rgba(148, 163, 184, 0.22)',
            border: 'rgba(148, 163, 184, 0.38)',
            tooltipBg: 'rgba(15, 23, 42, 0.95)',
            tooltipText: '#f8fafc'
        }
        : {
            text: '#334155',
            tick: '#475569',
            grid: 'rgba(15, 23, 42, 0.12)',
            border: 'rgba(15, 23, 42, 0.22)',
            tooltipBg: 'rgba(255, 255, 255, 0.96)',
            tooltipText: '#0f172a'
        };

    return {
        text: style.getPropertyValue('--text-primary').trim() || fallback.text,
        tick: style.getPropertyValue('--chart-tick').trim() || fallback.tick,
        grid: style.getPropertyValue('--chart-grid').trim() || fallback.grid,
        border: style.getPropertyValue('--chart-border').trim() || fallback.border,
        tooltipBg: style.getPropertyValue('--chart-tooltip-bg').trim() || fallback.tooltipBg,
        tooltipText: style.getPropertyValue('--chart-tooltip-text').trim() || fallback.tooltipText
    };
}

function applyThemeToChartOptions(options) {
    const themedOptions = { ...(options || {}) };
    const tokens = getChartThemeTokens();

    themedOptions.plugins = {
        ...(themedOptions.plugins || {}),
        legend: {
            ...(themedOptions.plugins?.legend || {}),
            labels: {
                ...(themedOptions.plugins?.legend?.labels || {}),
                color: tokens.text,
                usePointStyle: true,
                boxWidth: 10
            }
        },
        tooltip: {
            ...(themedOptions.plugins?.tooltip || {}),
            backgroundColor: tokens.tooltipBg,
            titleColor: tokens.tooltipText,
            bodyColor: tokens.tooltipText,
            borderColor: tokens.border,
            borderWidth: 1
        }
    };

    if (themedOptions.scales) {
        Object.keys(themedOptions.scales).forEach((axisKey) => {
            const axis = themedOptions.scales[axisKey] || {};
            themedOptions.scales[axisKey] = {
                ...axis,
                ticks: {
                    ...(axis.ticks || {}),
                    color: tokens.tick
                },
                grid: {
                    ...(axis.grid || {}),
                    color: tokens.grid
                },
                border: {
                    ...(axis.border || {}),
                    color: tokens.border
                }
            };
        });
    }

    return themedOptions;
}

function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeGender(value) {
    const gender = String(value || '').trim().toLowerCase();
    if (gender === 'm' || gender === 'male') return 'male';
    if (gender === 'masculine') return 'male';
    if (gender === 'f' || gender === 'female') return 'female';
    if (gender === 'feminine') return 'female';
    return '';
}

function resolveGender(data, enrollment) {
    const candidateValues = [
        data?.gender,
        data?.sex,
        data?.Gender,
        data?.SEX,
        data?.student?.gender,
        data?.student?.sex,
        data?.studentInfo?.gender,
        data?.studentInfo?.sex,
        enrollment?.gender,
        enrollment?.sex,
        enrollment?.Gender,
        enrollment?.SEX
    ];

    for (const candidate of candidateValues) {
        const normalized = normalizeGender(candidate);
        if (normalized) return normalized;
    }

    return '';
}

function parseList(value) {
    if (!value) return [];
    if (Array.isArray(value)) {
        return value.flatMap(v => parseList(v));
    }
    if (typeof value === 'object') {
        const named = value.name || value.elective || value.title || value.subject || value.subject_name || value.value || '';
        if (named) return [normalizeText(named)].filter(Boolean);
        return Object.values(value).flatMap(v => parseList(v));
    }
    const text = normalizeText(value);
    if (!text) return [];
    if ((text.startsWith('[') && text.endsWith(']')) || (text.startsWith('{') && text.endsWith('}'))) {
        try { return parseList(JSON.parse(text)); } catch (e) { /* ignore */ }
    }

    const bulletSplit = text
        .split(/\r?\n|•|\u2022|\u25CF|\u25E6|\u2219/g)
        .map(v => normalizeText(v))
        .filter(Boolean);
    if (bulletSplit.length > 1) return bulletSplit;

    if (text.includes(';')) {
        const semicolonSplit = text.split(';').map(v => normalizeText(v)).filter(Boolean);
        if (semicolonSplit.length > 1) return semicolonSplit;
    }

    if (text.includes('|')) {
        const pipeSplit = text.split('|').map(v => normalizeText(v)).filter(Boolean);
        if (pipeSplit.length > 1) return pipeSplit;
    }

    return [text];
}

function countChar(text, char) {
    return String(text || '').split(char).length - 1;
}

function normalizeElectiveText(value) {
    let text = normalizeText(value);
    if (!text) return '';

    text = text
        .replace(/\s+,/g, ',')
        .replace(/,\s*/g, ', ')
        .replace(/\s+\)/g, ')')
        .replace(/\(\s+/g, '(')
        .replace(/\s+-\s+/g, ' - ')
        .trim();

    return text;
}

function mergeFragmentedElectiveNames(items) {
    const source = (Array.isArray(items) ? items : [])
        .map(v => normalizeElectiveText(v))
        .filter(Boolean);

    const merged = [];
    let i = 0;

    while (i < source.length) {
        let current = source[i];
        let balance = countChar(current, '(') - countChar(current, ')');

        while (balance > 0 && i + 1 < source.length) {
            i += 1;
            current = `${current}, ${source[i]}`;
            balance = countChar(current, '(') - countChar(current, ')');
        }

        merged.push(normalizeElectiveText(current));
        i += 1;
    }

    return Array.from(new Set(merged.filter(Boolean)));
}

function wrapChartLabel(value, maxCharsPerLine = 34) {
    const text = normalizeText(value);
    if (!text) return '';
    if (text.length <= maxCharsPerLine) return text;

    const words = text.split(' ');
    const lines = [];
    let current = '';

    words.forEach((word) => {
        const candidate = current ? `${current} ${word}` : word;
        if (candidate.length <= maxCharsPerLine) {
            current = candidate;
        } else {
            if (current) lines.push(current);
            current = word;
        }
    });
    if (current) lines.push(current);

    return lines.length ? lines : [text];
}

function adjustElectivesCanvasHeight(labelCount) {
    const canvas = document.getElementById('chartElectives');
    if (!canvas) return;

    const count = Math.max(Number(labelCount) || 0, 1);
    const computedHeight = Math.min(560, Math.max(360, 180 + (count * 14)));
    canvas.style.height = `${computedHeight}px`;
}

function normalizeEnrollmentsPayload(payload) {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== 'object') return [];
    if (Array.isArray(payload.rows)) return payload.rows;
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.enrollments)) return payload.enrollments;
    if (payload.success && Array.isArray(payload.result)) return payload.result;
    return [];
}

function isApprovedEnrollmentRecord(enrollment) {
    if (!enrollment || typeof enrollment !== 'object') return false;
    const status = String(enrollment.status || enrollment.enrollment_status || '').trim().toLowerCase();
    return status === 'approved' || status.startsWith('approved');
}

function dedupeEnrollments(rows) {
    const map = new Map();
    (Array.isArray(rows) ? rows : []).forEach((row, index) => {
        const key = String(
            row?.id
            || row?.enrollment_id
            || `${row?.student_id || ''}|${row?.created_at || row?.enrollment_date || ''}|${index}`
        );
        if (!map.has(key)) map.set(key, row);
    });
    return Array.from(map.values());
}

function resolveVisualizationSchoolCode() {
    try {
        const params = new URLSearchParams(window.location.search || '');
        const fromQuery = String(params.get('school') || params.get('tenant') || params.get('code') || '').trim().toLowerCase();
        if (fromQuery) return fromQuery;
    } catch (_e) { }
    return String(localStorage.getItem('sms.selectedSchoolCode') || localStorage.getItem('sms.selectedTenantCode') || '').trim().toLowerCase();
}

function toPositiveYearId(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function resolveVisualizationActiveSchoolYearId() {
    const direct = toPositiveYearId(window.activeSchoolYearId);
    if (direct) return direct;

    const fromObject = toPositiveYearId(window.activeSchoolYear && (window.activeSchoolYear.id || window.activeSchoolYear.school_year_id));
    if (fromObject) return fromObject;

    try {
        const stored = JSON.parse(localStorage.getItem('activeSchoolYear') || 'null');
        const fromStorage = toPositiveYearId(stored && (stored.id || stored.school_year_id || stored.schoolYearId));
        if (fromStorage) return fromStorage;
    } catch (_e) {
        // ignore
    }

    return null;
}

function getActiveYearFromScopedCache(schoolCode) {
    const matchesScope = (value) => {
        const normalized = String(value || '').trim().toLowerCase();
        if (!schoolCode) return true;
        if (!normalized) return true;
        return normalized === schoolCode;
    };

    const cacheSources = [];
    if (Array.isArray(window.allEnrollments) && window.allEnrollments.length && matchesScope(window.__allEnrollmentsSchoolCode)) {
        cacheSources.push(...window.allEnrollments);
    }
    if (Array.isArray(window.enrollmentDataStore) && window.enrollmentDataStore.length && matchesScope(window.__enrollmentDataStoreSchoolCode)) {
        cacheSources.push(...window.enrollmentDataStore);
    }

    const activeYearRows = dedupeEnrollments(cacheSources);
    if (typeof window.filterEnrollmentsByActiveSchoolYear === 'function') {
        try {
            return window.filterEnrollmentsByActiveSchoolYear(activeYearRows);
        } catch (_e) {
            return activeYearRows;
        }
    }
    return activeYearRows;
}

async function fetchActiveYearEnrollmentsForVisualization(schoolCode) {
    const endpoints = [
        '/api/enrollments?activeYear=true',
        '/api/enrollments?status=Approved&activeYear=true',
        '/api/enrollments?status=approved&activeYear=true',
        '/api/enrollments?status=Pending&activeYear=true',
        '/api/enrollments?status=pending&activeYear=true'
    ];

    let bestRows = [];

    for (const endpoint of endpoints) {
        try {
            const endpointUrl = new URL(endpoint, window.location.origin);
            endpointUrl.searchParams.set('activeYear', 'true');
            if (schoolCode) {
                endpointUrl.searchParams.set('school', schoolCode);
            }
            const scopedEndpoint = `${endpointUrl.pathname}${endpointUrl.search}`;

            const res = (typeof window.apiFetch === 'function')
                ? await window.apiFetch(scopedEndpoint, { cache: 'no-store' })
                : await fetch(scopedEndpoint, {
                    credentials: 'include',
                    cache: 'no-store',
                    headers: schoolCode ? { 'x-tenant-code': schoolCode } : {}
                });

            if (!res || !res.ok) continue;

            const payload = await res.json().catch(() => []);
            const enrollments = normalizeEnrollmentsPayload(payload);
            if (!Array.isArray(enrollments) || enrollments.length === 0) continue;

            let activeYearRows = dedupeEnrollments(enrollments);
            if (typeof window.filterEnrollmentsByActiveSchoolYear === 'function') {
                try {
                    activeYearRows = window.filterEnrollmentsByActiveSchoolYear(activeYearRows);
                } catch (_e) {}
            }
            if (activeYearRows.length > bestRows.length) {
                bestRows = activeYearRows;
            }
        } catch (_err) {
        }
    }

    return bestRows;
}

function resolveYearValue(enrollment, data) {
    const candidates = [
        data.school_year,
        data.schoolYear,
        data.selectedSchoolYear,
        enrollment.school_year,
        enrollment.schoolYear,
        enrollment.school_year_name,
        enrollment.school_year_label
    ].map(v => normalizeText(v)).filter(Boolean);

    const explicit = candidates.find(v => /\d{4}\s*[-/]\s*\d{4}/.test(v));
    if (explicit) return explicit.replace(/\s+/g, '');
    if (candidates.length > 0) return candidates[0];

    const created = enrollment.created_at || enrollment.createdAt || '';
    const d = new Date(created);
    if (!Number.isNaN(d.getTime())) return String(d.getFullYear());
    return 'Unknown';
}

function buildStudentsFromEnrollments(enrollments) {
    const students = [];
    enrollments.forEach(enrollment => {
        try {
            let data = enrollment.enrollment_data || {};
            if (typeof data === 'string') {
                try { data = JSON.parse(data); } catch (e) { /* ignore */ }
            }

            const rawElectives = [
                ...parseList(data.academicElectives),
                ...parseList(data.techproElectives),
                ...parseList(data.doorwayAcademic),
                ...parseList(data.doorwayTechPro),
                ...parseList(data.doorwayTechpro),
                ...parseList(data.electives),
                ...parseList(data.selectedElectives),
                ...parseList(data.subjects),
                ...parseList(data.selectedSubjects),
                ...parseList(data.interest),
                ...parseList(data.shs?.electives)
            ];

            const allElectives = mergeFragmentedElectiveNames(rawElectives);

            const disabilities = Array.from(new Set([
                ...parseList(data.disabilities),
                ...parseList(data.disability),
                ...parseList(data.disability_status),
                ...parseList(data.disabilityType)
            ].map(v => normalizeText(v)).filter(v => v && v.toLowerCase() !== 'none' && v.toLowerCase() !== 'no')));

            const ipGroup = normalizeText(data.ipGroup || data.ip_group || data.ipgroup || data.indigenousGroup || '');
            const fourPsRaw = normalizeText(data.is4Ps || data.four_ps || data.fourPs || data.four_ps_status || data['4ps'] || '');
            const motherTongue = normalizeText(data.mother_tongue || data.motherTongue || data.language || '');

            const s = {
                id: enrollment.student_id || data.studentID || data.studentId || data.lrn || data.email || `${(data.firstName||data.firstname||'').toString()} ${(data.lastName||data.lastname||'').toString()}`.trim(),
                gender: resolveGender(data, enrollment),
                grade: (data.grade_level || data.grade || data.gradeLevel || data['Grade'] || '').toString(),
                disabilities,
                ip_group: ipGroup,
                four_ps: fourPsRaw,
                mother_tongue: motherTongue,
                track: (data.track || data.program || data.track_program || '').toString(),
                electives: allElectives,
                school_year: resolveYearValue(enrollment, data)
            };
            students.push(s);
        } catch (err) {
            console.warn('Visualization: failed mapping enrollment', err);
        }
    });
    return students;
}

async function loadVisualizationEnrollments(forceReload = false) {
    const schoolCode = resolveVisualizationSchoolCode();
    const hasFreshCache = (
        !forceReload
        && vizEnrollmentCache.schoolCode === schoolCode
        && Array.isArray(vizEnrollmentCache.approvedEnrollments)
        && vizEnrollmentCache.approvedEnrollments.length > 0
    );

    if (hasFreshCache) {
        return buildStudentsFromEnrollments(vizEnrollmentCache.approvedEnrollments);
    }

    let activeYearEnrollments = [];
    try {
        activeYearEnrollments = await fetchActiveYearEnrollmentsForVisualization(schoolCode);
    } catch (err) {
        console.error('Visualization: failed to fetch active-year enrollments', err);
    }

    if (!Array.isArray(activeYearEnrollments) || activeYearEnrollments.length === 0) {
        activeYearEnrollments = getActiveYearFromScopedCache(schoolCode);
    }

    vizEnrollmentCache.schoolCode = schoolCode;
    vizEnrollmentCache.approvedEnrollments = Array.isArray(activeYearEnrollments) ? activeYearEnrollments : [];
    vizEnrollmentCache.fetchedAt = Date.now();

    return buildStudentsFromEnrollments(vizEnrollmentCache.approvedEnrollments);
}

function populateYearFilter(students) {
    const yearSelect = document.getElementById('vizFilterYear');
    if (!yearSelect) return;

    const previous = yearSelect.value || 'all';
    const years = Array.from(new Set((students || []).map(s => normalizeText(s.school_year)).filter(Boolean)));
    years.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

    yearSelect.innerHTML = '<option value="all">All</option>';
    years.forEach(y => {
        const option = document.createElement('option');
        option.value = y;
        option.textContent = y;
        yearSelect.appendChild(option);
    });

    yearSelect.value = years.includes(previous) ? previous : 'all';
}

function createOrUpdateChart(key, canvasId, type, data, options) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const themedOptions = applyThemeToChartOptions(options || {});
    if (vizCharts[key]) {
        vizCharts[key].data = data;
        vizCharts[key].options = themedOptions;
        vizCharts[key].update();
        return;
    }
    vizCharts[key] = new Chart(canvas, { type, data, options: themedOptions });
}

function baseChartOptions() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { labels: { usePointStyle: true, boxWidth: 10 } },
            tooltip: { mode: 'index', intersect: false }
        }
    };
}

async function updateVisualizations(options = {}) {
    const forceReload = !!options.forceReload;
    const genderFilter = document.getElementById('vizFilterGender')?.value || 'all';
    const gradeFilter = document.getElementById('vizFilterGrade')?.value || 'all';
    const yearFilter = document.getElementById('vizFilterYear')?.value || 'all';

    const students = await loadVisualizationEnrollments(forceReload);
    populateYearFilter(students);

    const filtered = students.filter(s => {
        if (genderFilter !== 'all' && normalizeGender(s.gender) !== genderFilter) return false;
        if (gradeFilter !== 'all' && String(s.grade) !== String(gradeFilter)) return false;
        if (yearFilter !== 'all' && normalizeText(s.school_year) !== yearFilter) return false;
        return true;
    });

    renderGenderChart(filtered);
    renderGradeChart(filtered);
    renderDisabilityChart(filtered);
    renderIndigenousChart(filtered);
    render4PsChart(filtered);
    renderMotherTongueChart(filtered);
    renderTrackChart(filtered);
    renderElectivesChart(filtered);
    renderTrackElectiveCharts(filtered);
}

function renderGenderChart(students) {
    const male = students.filter(s => normalizeGender(s.gender) === 'male').length;
    const female = students.filter(s => normalizeGender(s.gender) === 'female').length;

    const data = {
        labels: ['Male', 'Female'],
        datasets: [{ data: [male, female], backgroundColor: ['#2E8B57', '#6A5ACD'] }]
    };

    const options = {
        ...baseChartOptions(),
        plugins: {
            ...baseChartOptions().plugins,
            tooltip: {
                mode: 'nearest',
                intersect: true,
                callbacks: {
                    footer: () => [`Male: ${male}`, `Female: ${female}`]
                }
            }
        }
    };

    createOrUpdateChart('gender', 'chartGender', 'pie', data, options);
}

function renderGradeChart(students) {
    const grades = ['7','8','9','10','11','12'];
    const maleCounts = grades.map(g => students.filter(s => String(s.grade)===g && normalizeGender(s.gender)==='male').length);
    const femaleCounts = grades.map(g => students.filter(s => String(s.grade)===g && normalizeGender(s.gender)==='female').length);

    const data = { labels: grades, datasets: [ { label: 'Male', data: maleCounts, backgroundColor: '#2E8B57' }, { label: 'Female', data: femaleCounts, backgroundColor: '#6A5ACD' } ] };
    const options = { ...baseChartOptions(), scales: { x: { stacked: false }, y: { beginAtZero: true, ticks: { precision: 0 } } } };
    createOrUpdateChart('grade', 'chartGrade', 'bar', data, options);
}

function renderDisabilityChart(students) {
    const map = {};
    students.forEach(s => {
        (Array.isArray(s.disabilities)?s.disabilities:[]).forEach(d => {
            const key = normalizeText(d || 'Other');
            if (!map[key]) map[key] = { male:0, female:0 };
            if (normalizeGender(s.gender)==='male') map[key].male++;
            if (normalizeGender(s.gender)==='female') map[key].female++;
        });
    });

    const labels = Object.keys(map).sort((a,b) => (map[b].male + map[b].female) - (map[a].male + map[a].female)).slice(0, 12);
    const maleData = labels.map(l => map[l].male);
    const femaleData = labels.map(l => map[l].female);

    const data = { labels, datasets: [ { label:'Male', data: maleData, backgroundColor:'#2E8B57' }, { label:'Female', data: femaleData, backgroundColor:'#6A5ACD' } ] };
    const options = { ...baseChartOptions(), scales:{ x:{ stacked:true }, y:{ beginAtZero:true, stacked:true, ticks:{ precision: 0 } } } };
    createOrUpdateChart('disability', 'chartDisability', 'bar', data, options);
}

function renderIndigenousChart(students) {
    const map = {};
    students.forEach(s => {
        const group = normalizeText(s.ip_group);
        if (!group || group.toLowerCase() === 'none' || group.toLowerCase() === 'no') return;
        const key = group;
        if (!map[key]) map[key] = 0;
        map[key]++;
    });

    const entries = Object.entries(map).sort((a,b) => b[1]-a[1]).slice(0, 12);
    const labels = entries.map(([k]) => k);
    const values = entries.map(([,v]) => v);
    const data = { labels, datasets: [ { label:'Students', data: values, backgroundColor:'#16a34a' } ] };

    const options = {
        ...baseChartOptions(),
        indexAxis: 'y',
        interaction: {
            mode: 'nearest',
            axis: 'y',
            intersect: true
        },
        plugins: {
            ...baseChartOptions().plugins,
            tooltip: {
                mode: 'nearest',
                axis: 'y',
                intersect: true
            }
        },
        scales: { x:{ beginAtZero:true, ticks:{ precision: 0 } } }
    };

    createOrUpdateChart('indigenous', 'chartIndigenous', 'bar', data, options);
}

function render4PsChart(students) {
    const counts = { male: 0, female: 0 };
    students.forEach(s => {
        const raw = String(s.four_ps || '').trim().toLowerCase();
        const isBeneficiary = raw === 'yes' || raw === 'true' || raw === '1';
        if (!isBeneficiary) return;
        const gender = normalizeGender(s.gender);
        if (gender === 'male') counts.male++;
        if (gender === 'female') counts.female++;
    });

    const data = {
        labels: ['4Ps Beneficiaries'],
        datasets: [
            { label: 'Male', data: [counts.male], backgroundColor: '#2E8B57' },
            { label: 'Female', data: [counts.female], backgroundColor: '#6A5ACD' }
        ]
    };
    const options = { ...baseChartOptions(), scales:{ x:{ stacked:true }, y:{ beginAtZero:true, stacked:true, ticks:{ precision: 0 } } } };
    createOrUpdateChart('fourPs', 'chart4Ps', 'bar', data, options);
}

function renderMotherTongueChart(students) {
    const map = {};
    students.forEach(s => {
        const tongue = normalizeText(s.mother_tongue);
        if (!tongue || tongue.toLowerCase() === 'none') return;
        if (!map[tongue]) map[tongue] = 0;
        map[tongue]++;
    });

    const entries = Object.entries(map).sort((a,b) => b[1]-a[1]).slice(0, 12);
    const labels = entries.map(([k]) => k);
    const values = entries.map(([,v]) => v);
    const data = { labels, datasets: [ { label:'Students', data: values, backgroundColor:'#0ea5e9' } ] };

    const options = {
        ...baseChartOptions(),
        indexAxis: 'y',
        interaction: {
            mode: 'nearest',
            axis: 'y',
            intersect: true
        },
        plugins: {
            ...baseChartOptions().plugins,
            tooltip: {
                mode: 'nearest',
                axis: 'y',
                intersect: true
            }
        },
        scales: { x:{ beginAtZero:true, ticks:{ precision: 0 } } }
    };

    createOrUpdateChart('motherTongue', 'chartMotherTongue', 'bar', data, options);
}

function renderTrackChart(students) {
    const tracks = ['Academic','TechPro','Doorway'];
    const male = tracks.map(t => students.filter(s => String(s.track).toLowerCase().includes(t.toLowerCase()) && normalizeGender(s.gender)==='male').length);
    const female = tracks.map(t => students.filter(s => String(s.track).toLowerCase().includes(t.toLowerCase()) && normalizeGender(s.gender)==='female').length);

    const data = { labels: tracks, datasets: [ { label:'Male', data: male, backgroundColor:'#2E8B57' }, { label:'Female', data: female, backgroundColor:'#6A5ACD' } ] };
    const options = { ...baseChartOptions(), scales:{ x:{ stacked:false }, y:{ beginAtZero:true, ticks:{ precision: 0 } } } };
    createOrUpdateChart('track', 'chartTrack', 'bar', data, options);
}

function renderElectivesChart(students) {
    const map = {};
    students.forEach(s => {
        (Array.isArray(s.electives)?s.electives:[]).forEach(e => {
            const key = normalizeText(e||'Other');
            if (!map[key]) map[key] = 0;
            map[key]++;
        });
    });
    const entries = Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,15);
    const labels = entries.map(e=>e[0]);
    const values = entries.map(e=>e[1]);

    adjustElectivesCanvasHeight(labels.length);

    const data = { labels, datasets: [ { label:'Students', data: values, backgroundColor: '#3b82f6' } ] };

    const options = {
        ...baseChartOptions(),
        indexAxis: 'y',
        layout: {
            padding: {
                left: 24,
                right: 8,
                top: 8,
                bottom: 8
            }
        },
        interaction: {
            mode: 'nearest',
            axis: 'y',
            intersect: true
        },
        plugins: {
            ...baseChartOptions().plugins,
            tooltip: {
                mode: 'nearest',
                axis: 'y',
                intersect: true,
                callbacks: {
                    title: (items) => {
                        const raw = items?.[0]?.label || '';
                        return normalizeText(raw);
                    }
                }
            }
        },
        scales: {
            x:{ beginAtZero:true, ticks:{ precision: 0 } },
            y:{
                ticks: {
                    autoSkip: false,
                    padding: 10,
                    font: {
                        size: 11
                    },
                    callback: function(value) {
                        const label = this.getLabelForValue(value);
                        return wrapChartLabel(label, 26);
                    }
                }
            }
        }
    };

    createOrUpdateChart('electives', 'chartElectives', 'bar', data, options);
}

// produces one bar chart per unique track string encountered in the
// filtered student list; each chart shows counts per elective within that
// track. charts are inserted into #trackElectivesContainer and cached in
// vizCharts under keys prefixed with "trackElectives_".
function renderTrackElectiveCharts(students) {
    const container = document.getElementById('trackElectivesContainer');
    if (!container) return;

    // group students by normalized track name; treat blank values as missing
    const byTrack = {};
    students.forEach(s => {
        const raw = normalizeText(s.track);
        if (!raw) return; // skip rows without a track
        if (!byTrack[raw]) byTrack[raw] = [];
        byTrack[raw].push(s);
    });

    // clear existing DOM nodes for this run; charts will be recreated
    container.innerHTML = '';

    Object.entries(byTrack).forEach(([trackName, trackStudents], idx) => {
        if (!trackName || trackName.toLowerCase() === 'unknown') return; // avoid placeholder group
        // card wrapper
        const card = document.createElement('div');
        card.className = 'track-elective-card';
        const heading = document.createElement('h4');
        heading.textContent = `📈 ${trackName} Electives`;
        card.appendChild(heading);

        const canvas = document.createElement('canvas');
        const canvasId = `chartTrackElectives_${idx}`;
        canvas.id = canvasId;
        canvas.height = 200;
        card.appendChild(canvas);
        container.appendChild(card);

        // compute elective counts for this track
        const map = {};
        trackStudents.forEach(s => {
            (Array.isArray(s.electives)?s.electives:[]).forEach(e => {
                const k = normalizeText(e || 'Other');
                if (!k) return;
                map[k] = (map[k] || 0) + 1;
            });
        });
        const entries = Object.entries(map).sort((a,b)=>b[1]-a[1]);
        if (entries.length === 0) {
            // nothing to display for this track
            return;
        }
        const labels = entries.map(e=>e[0]);
        const values = entries.map(e=>e[1]);

        // adapt canvas height depending on label count
        // note: adjustElectivesCanvasHeight targets chartElectives id; we'll
        // replicate simple sizing logic here
        const computedHeight = Math.min(560, Math.max(360, 180 + (labels.length * 14)));
        canvas.style.height = `${computedHeight}px`;

        const data = {
            labels,
            datasets: [ { label:'Students', data: values, backgroundColor: '#3b82f6' } ]
        };

        const options = {
            ...baseChartOptions(),
            plugins: {
                ...baseChartOptions().plugins,
                tooltip: {
                    mode: 'nearest',
                    intersect: true
                },
                datalabels: {
                    color: '#000',
                    anchor: 'end',
                    align: 'end',
                    formatter: v => v,
                    font: { weight: 'bold' }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0,
                        autoSkip: false,
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: { beginAtZero: true, ticks: { precision: 0 } }
            }
        };

        createOrUpdateChart(`trackElectives_${idx}`, canvasId, 'bar', data, options);
    });
}
function initVisualizations() {
    document.getElementById('vizRefreshBtn')?.addEventListener('click', () => updateVisualizations({ forceReload: true }));
    document.getElementById('vizFilterGender')?.addEventListener('change', () => updateVisualizations());
    document.getElementById('vizFilterGrade')?.addEventListener('change', () => updateVisualizations());
    document.getElementById('vizFilterYear')?.addEventListener('change', () => updateVisualizations());
    // initial load
    updateVisualizations();
}

// Initialize visualizations after DOM ready
document.addEventListener('DOMContentLoaded', () => {
    try { initVisualizations(); } catch (err) { console.warn('Visualizations init failed', err); }
});

window.addEventListener('themeChanged', () => {
    try {
        Object.values(vizCharts).forEach((chartInstance) => {
            if (!chartInstance) return;
            chartInstance.options = applyThemeToChartOptions(chartInstance.options || {});
            chartInstance.update();
        });
    } catch (err) {
        console.warn('Visualization theme refresh failed', err);
    }
});



