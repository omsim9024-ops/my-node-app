// Backend origin and API base URL - dynamically use current origin
if (typeof BACKEND_ORIGIN === 'undefined') {
    var BACKEND_ORIGIN = window.location.origin;
}
if (typeof API_BASE === 'undefined') {
    var API_BASE = BACKEND_ORIGIN;
}

let activeSchoolCode = '';
let activeSchoolName = 'Compostela National High School';
const IS_ENROLLMENT_PAGE = !!document.getElementById('enrollmentForm');
const previousEnrollmentLookupState = {
    rows: [],
    loaded: false,
    loading: false,
    debounceTimer: null,
    schoolYearMap: {},
    schoolYearMapLoaded: false
};

function getEnrollmentAssistContext() {
    try {
        const params = new URLSearchParams(window.location.search || '');
        const mode = String(params.get('mode') || '').trim().toLowerCase();
        const from = String(params.get('from') || '').trim().toLowerCase();
        const teacherAssisted = String(params.get('teacher-assisted') || '').trim().toLowerCase() === 'true';
        const returnTo = String(params.get('return') || '').trim();
        const assisted = mode === 'teacher-assisted' || mode === 'manual-teacher' || from === 'adviser-dashboard' || from === 'subject-teacher-dashboard' || teacherAssisted;
        return {
            assisted,
            mode,
            from,
            returnTo,
            teacherAssisted
        };
    } catch (_err) {
        return {
            assisted: false,
            mode: '',
            from: '',
            returnTo: '',
            teacherAssisted: false
        };
    }
}

const ENROLLMENT_ASSIST_CONTEXT = getEnrollmentAssistContext();

function isTeacherAssistedEnrollment() {
    return !!(ENROLLMENT_ASSIST_CONTEXT && ENROLLMENT_ASSIST_CONTEXT.assisted);
}

function buildManualStudentIdentifier(formData = {}) {
    const normalizedLrn = String(formData.lrn || '').trim();
    if (normalizedLrn) {
        return `lrn-${normalizedLrn}`;
    }

    const first = String(formData.firstName || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const last = String(formData.lastName || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const seed = `${last || 'student'}${first || 'manual'}`.slice(0, 24);
    return `manual-${seed}-${Date.now()}`;
}

function detectSchoolCode() {
    try {
        const existing = new URLSearchParams(window.location.search || '');
        let existingSchool = String(existing.get('school') || '').trim().toLowerCase();
        if (/^\d+$/.test(existingSchool)) { existingSchool = ''; existing.delete('school'); }
        if (!existingSchool) {
            let derived = existingSchool;
            if (!derived) {
                derived = String(localStorage.getItem('sms.selectedSchoolCode') || localStorage.getItem('sms.selectedTenantCode') || '').trim().toLowerCase();
            }
            if (!derived) {
                const h = String(window.location.hostname || '').trim().toLowerCase();
                const localHosts = new Set(['localhost','127.0.0.1','::1']);
                if (!localHosts.has(h)) {
                    const parts = h.split('.').filter(Boolean);
                    if (parts.length >= 3) derived = String(parts[0] || '').toLowerCase();
                }
            }
            if (!derived) derived = 'default-school';
            existing.set('school', derived);
            const newUrl = `${window.location.pathname}?${existing.toString()}${window.location.hash || ''}`;
            window.history.replaceState(null, '', newUrl);
        }
    } catch (_e) {}

    const params = new URLSearchParams(window.location.search || '');
    const fromQuery = (params.get('school') || params.get('tenant') || params.get('code') || '').trim().toLowerCase();
    if (fromQuery) return fromQuery;

    const fromStorage = String(
        localStorage.getItem('sms.selectedSchoolCode') || localStorage.getItem('sms.selectedTenantCode') || ''
    ).trim().toLowerCase();
    if (fromStorage) return fromStorage;

    const host = String(window.location.hostname || '').trim().toLowerCase();
    const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
    if (localHosts.has(host)) return '';

    const parts = host.split('.').filter(Boolean);
    if (parts.length >= 3) return String(parts[0] || '').toLowerCase();
    return '';
}

function withSchoolParam(path) {
    let code = activeSchoolCode || detectSchoolCode();
    if (!code) return path;
    try {
        const url = new URL(path, window.location.origin);
        url.searchParams.set('school', code);
        return `${url.pathname}${url.search}${url.hash || ''}`;
    } catch (_err) {
        return path;
    }
}

function appendSchoolParamToLinks(code) {
    if (!code) return;
    document.querySelectorAll('a[href$=".html"], a[href*=".html?"]').forEach((anchor) => {
        const href = anchor.getAttribute('href') || '';
        if (!href || href.startsWith('#')) return;
        anchor.setAttribute('href', withSchoolParam(href));
    });
}

function setSchoolFavicon(logoValue, schoolCode) {
    const baseFallback = 'logo.png';
    const raw = String(logoValue || '').trim();
    const isDataUrl = /^data:/i.test(raw);
    const cacheSuffix = `school=${encodeURIComponent(String(schoolCode || 'default').toLowerCase())}&t=${Date.now()}`;
    const finalHref = raw
        ? (isDataUrl ? raw : `${raw}${raw.includes('?') ? '&' : '?'}${cacheSuffix}`)
        : `${baseFallback}?${cacheSuffix}`;

    const ensureLink = (relValue) => {
        let link = document.querySelector(`link[rel="${relValue}"]`);
        if (!link) {
            link = document.createElement('link');
            link.setAttribute('rel', relValue);
            document.head.appendChild(link);
        }
        link.setAttribute('href', finalHref);
        link.setAttribute('type', 'image/png');
    };

    ensureLink('icon');
    ensureLink('shortcut icon');
}

async function bootstrapSchoolBranding() {
    const detected = detectSchoolCode();
    activeSchoolCode = detected;
    const endpoint = detected
        ? `/api/system-health/schools/resolve?code=${encodeURIComponent(detected)}`
        : '/api/system-health/schools/resolve';

    try {
        const response = await fetch(endpoint);
        if (!response.ok) return;
        const payload = await response.json();
        if (!payload || !payload.success || !payload.school) return;

        const school = payload.school;
        if (detected !== 'default-school') {
            activeSchoolCode = String(school.code || detected || '').trim().toLowerCase();
        } else {
            activeSchoolCode = detected;
        }
        activeSchoolName = String(school.name || activeSchoolName);
        if (activeSchoolCode && detected !== 'default-school') {
            localStorage.setItem('sms.selectedSchoolCode', activeSchoolCode);
            localStorage.setItem('sms.selectedTenantCode', activeSchoolCode);
        }
        if (school.id) {
            localStorage.setItem('sms.selectedSchoolId', String(school.id));
            localStorage.setItem('sms.selectedTenantId', String(school.id));
        }

        const logo = String(school.logoData || '').trim();
        const shortName = String(school.schoolId || school.code || school.name || 'SMS').slice(0, 24);

        document.title = `${activeSchoolName} - Enrollment Form`;

        const shortNameNode = document.getElementById('schoolShortName');
        if (shortNameNode) shortNameNode.textContent = shortName;

        const logoNode = document.getElementById('schoolLogo');
        if (logoNode && logo) logoNode.setAttribute('src', logo);

        setSchoolFavicon(logo || '', activeSchoolCode);
        appendSchoolParamToLinks(activeSchoolCode);
    } catch (_err) {
    }
}

function getActiveStudentId() {
    try {
        const student = JSON.parse(localStorage.getItem('studentData') || '{}');
        return student && student.id ? String(student.id) : 'guest';
    } catch (_err) {
        return 'guest';
    }
}

function getStudentThemeStorageKey() {
    return `student_theme_settings_${getActiveStudentId()}`;
}

function getStudentSettingsStorageKey() {
    return `student_settings_${getActiveStudentId()}`;
}

function normalizeHexColor(value) {
    const raw = String(value || '').trim();
    if (!/^#([0-9a-f]{6})$/i.test(raw)) return null;
    return raw.toLowerCase();
}

function hexToRgbString(hex) {
    const normalized = normalizeHexColor(hex) || '#6366f1';
    const value = normalized.replace('#', '');
    const red = parseInt(value.slice(0, 2), 16);
    const green = parseInt(value.slice(2, 4), 16);
    const blue = parseInt(value.slice(4, 6), 16);
    return `${red}, ${green}, ${blue}`;
}

function shiftHexColor(hex, amount) {
    const normalized = normalizeHexColor(hex) || '#6366f1';
    const value = normalized.replace('#', '');
    const factor = Math.max(-1, Math.min(1, Number(amount) || 0));

    const convert = (component) => {
        const base = parseInt(component, 16);
        const shifted = factor >= 0
            ? Math.round(base + (255 - base) * factor)
            : Math.round(base * (1 + factor));
        return Math.max(0, Math.min(255, shifted));
    };

    const r = convert(value.slice(0, 2));
    const g = convert(value.slice(2, 4));
    const b = convert(value.slice(4, 6));
    return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

function getSavedStudentThemeSettings() {
    const defaults = {
        mode: localStorage.getItem('student_theme') === 'dark' ? 'dark' : 'light',
        accent: '#1e5631'
    };

    try {
        const raw = localStorage.getItem(getStudentThemeStorageKey());
        if (!raw) return defaults;
        const parsed = JSON.parse(raw);
        return {
            ...defaults,
            ...parsed,
            accent: normalizeHexColor(parsed.accent) || defaults.accent
        };
    } catch (_err) {
        return defaults;
    }
}

function getSavedStudentSettings() {
    const defaults = {
        accessibility: {
            highContrast: false,
            reducedMotion: false,
            largeText: false
        }
    };

    try {
        const raw = localStorage.getItem(getStudentSettingsStorageKey());
        if (!raw) return defaults;
        const parsed = JSON.parse(raw);
        return {
            ...defaults,
            ...parsed,
            accessibility: {
                ...defaults.accessibility,
                ...(parsed && parsed.accessibility ? parsed.accessibility : {})
            }
        };
    } catch (_err) {
        return defaults;
    }
}

function applyEnrollmentThemeFromStudent() {
    const root = document.documentElement;
    const body = document.body;
    const theme = getSavedStudentThemeSettings();
    const settings = getSavedStudentSettings();
    const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const effectiveMode = theme.mode === 'auto' ? (systemDark ? 'dark' : 'light') : (theme.mode === 'dark' ? 'dark' : 'light');

    const accent = normalizeHexColor(theme.accent) || '#1e5631';
    const accentDark = shiftHexColor(accent, -0.28);
    const accentLight = shiftHexColor(accent, 0.82);
    const accentRgb = hexToRgbString(accent);

    root.style.setProperty('--enroll-accent', accent);
    root.style.setProperty('--enroll-accent-dark', accentDark);
    root.style.setProperty('--enroll-accent-light', accentLight);
    root.style.setProperty('--enroll-accent-rgb', accentRgb);

    if (effectiveMode === 'dark') {
        root.style.setProperty('--enroll-bg-start', '#0f172a');
        root.style.setProperty('--enroll-bg-end', '#111827');
        root.style.setProperty('--enroll-text', '#e5e7eb');
        root.style.setProperty('--enroll-surface', '#111827');
        root.style.setProperty('--enroll-surface-muted', '#1f2937');
        root.style.setProperty('--enroll-border', '#374151');
        root.style.setProperty('--enroll-muted', '#9ca3af');
    } else {
        root.style.setProperty('--enroll-bg-start', '#f5f5f5');
        root.style.setProperty('--enroll-bg-end', '#e8e8e8');
        root.style.setProperty('--enroll-text', '#333333');
        root.style.setProperty('--enroll-surface', '#ffffff');
        root.style.setProperty('--enroll-surface-muted', '#f7f7f7');
        root.style.setProperty('--enroll-border', '#e0e0e0');
        root.style.setProperty('--enroll-muted', '#666666');
    }

    body.classList.toggle('dark-mode', effectiveMode === 'dark');

    const accessibility = settings.accessibility || {};
    body.classList.toggle('settings-high-contrast', Boolean(accessibility.highContrast));
    body.classList.toggle('settings-reduced-motion', Boolean(accessibility.reducedMotion));
    body.classList.toggle('settings-large-text', Boolean(accessibility.largeText));
}

if (IS_ENROLLMENT_PAGE) {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (resource, options = {}) => {
        let urlString = typeof resource === 'string' ? resource : (resource && resource.url ? resource.url : '');
        if (!urlString) return nativeFetch(resource, options);

        try {
            const parsed = new URL(urlString, window.location.origin);
            const isApiPath = parsed.pathname.startsWith('/api/');
            const isSameOrigin = parsed.origin === window.location.origin;
            if (isApiPath && isSameOrigin && activeSchoolCode) {
                parsed.searchParams.set('school', activeSchoolCode);
                const headers = {
                    ...(options.headers || {}),
                    'x-tenant-code': activeSchoolCode
                };
                return nativeFetch(parsed.toString(), { ...options, headers });
            }
        } catch (_err) {
        }

        return nativeFetch(resource, options);
    };
}

// Global variable to store active school year
window.activeSchoolYear = null;

// Address Data Structure - Cascading Dropdowns
const ADDRESS_DATA = {
    "Philippines": {
        "Davao de Oro": {
            "Compostela": ["Aurora", "Bagongon", "Gabi", "Lagab", "Mangayon", "Mapaca", "Maparat", "New Alegria", "Ngan", "Osmeña", "Panansalan", "Poblacion", "San Jose", "San Miguel", "Siocon", "Tamia"],
            "Laak": [],
            "Mabini": [],
            "Maco": [],
            "Maragusan": [],
            "Mawab": [],
            "Monkayo": [],
            "Montevista": [],
            "Nabunturan": [],
            "New Bataan": [],
            "Pantukan": []
        }
    },
    "United States": {
        "California": {
            "Los Angeles": ["Los Angeles", "Santa Monica", "Long Beach"],
            "San Francisco": ["San Francisco", "Oakland", "Berkeley"],
            "San Diego": ["San Diego", "La Jolla", "Ocean Beach"]
        },
        "New York": {
            "New York City": ["Manhattan", "Brooklyn", "Queens"],
            "Buffalo": ["Buffalo", "Cheektowaga"]
        },
        "Texas": {
            "Houston": ["Houston", "Spring"],
            "Dallas": ["Dallas", "Arlington"]
        }
    },
    "Canada": {
        "Ontario": {
            "Toronto": ["Toronto", "Mississauga"],
            "Ottawa": ["Ottawa", "Gatineau"]
        },
        "British Columbia": {
            "Vancouver": ["Vancouver", "Burnaby"],
            "Victoria": ["Victoria", "Sidney"]
        }
    }
};

// Electives Data Structure
// Made global so other modules (like sections management) can use it
window.ELECTIVES = {
    academic: {
        "Arts, Social Sciences, & Humanities": [
            "Citizenship and Civic Engagement",
            "Creative Industries (Visual, Media, Applied, and Traditional Art)",
            "Creative Industries (Music, Dance, Theater)",
            "Creative Writing",
            "Cultivating Filipino Identity Through the Arts",
            "Filipino sa Isports",
            "Filipino sa Sining at Disenyo",
            "Filipino sa Teknikal-Propesyonal",
            "Introduction to the Philosophy of the Human Person",
            "Leadership and Management in the Arts",
            "Malikhaing Pagsulat",
            "Philippine Politics and Governance",
            "The Social Sciences in Theory and Practice",
            "Wika at Komunikasyon sa Akademikong Filipino"
        ],
        "Business & Entrepreneurship": [
            "Basic Accounting",
            "Business Finance and Income Taxation",
            "Contemporary Marketing and Business Economics",
            "Entrepreneurship",
            "Introduction to Organization and Management"
        ],
        "Sports, Health, & Wellness": [
            "Exercise and Sports Programming",
            "Introduction to Human Movement",
            "Physical Education (Fitness and Recreation)",
            "Physical Education (Sports and Dance)",
            "Safety and First Aid",
            "Sports Coaching",
            "Sports Officiating",
            "Sports Activity Management"
        ],
        "Science, Technology, Engineering, & Mathematics": [
            "Advanced Mathematics 1-2",
            "Biology 1-2",
            "Biology 3-4",
            "Chemistry 1-2",
            "Chemistry 3-4",
            "Database Management",
            "Earth and Space Science 1-2",
            "Earth and Space Science 3-4",
            "Empowerment Technologies",
            "Finite Mathematics",
            "Fundamentals of Data Analytics and Management",
            "General Science (Physical Science)",
            "General Science (Earth and Life Science)",
            "Pre-Calculus 1-2",
            "Physics 1-2",
            "Physics 3-4",
            "Trigonometry 1-2"
        ],
        "Field Experience": [
            "Arts Apprenticeship - Theater Arts",
            "Arts Apprenticeship - Dance",
            "Arts Apprenticeship - Music",
            "Arts Apprenticeship - Literary Arts",
            "Arts Apprenticeship - Visual, Media, Applied, and Traditional Art",
            "Creative Production and Presentation",
            "Design and Innovation Research Methods",
            "Field Exposure (In-Campus)",
            "Field Exposure (Off-Campus)",
            "Work Immersion"
        ]
    },
    techpro: {
        "Information & Computer Technology": [
            "Animation (NC II)",
            "Broadband Installation (Fixed Wireless Systems) (NC II)",
            "Computer Programming (Java) (NC III)",
            "Computer Programming (Oracle Database) (NC III)",
            "Computer Systems Servicing (NC II)",
            "Contact Center Services (NC II)",
            "Illustration (NC II)",
            "Programming (.NET Technology) (NC III)",
            "Visual Graphic Design (NC III)"
        ],
        "Industrial Arts": [
            "Automotive Servicing (Engine and Chassis) (NC II)",
            "Automotive Servicing (Electrical) (NC II)",
            "Carpentry (NC I and NC II)",
            "Construction Operations (Masonry NC I and Tiles Plumbing NC II)",
            "Commercial Air-Conditioning Installation and Servicing (NC III)",
            "Domestic Refrigeration and Air-Conditioning Servicing (NC II)",
            "Driving and Automotive Servicing (Driving NC II and Automotive Servicing NC I)",
            "Electrical Installation Maintenance (NC II)",
            "Electronics Product and Assembly Servicing (NC II)",
            "Manual Metal Arc Welding (NC II)",
            "Mechatronics (NC II)",
            "Motorcycle and Small Engine Servicing (NC II)",
            "Photovoltaic System Installation (NC II)",
            "Technical Drafting (NC II)"
        ],
        "Agriculture & Fishery Arts": [
            "Agricultural Crops Production (NC II)",
            "Agro-Entrepreneurship (NC II)",
            "Aquaculture (NC II)",
            "Fish Capture Operation (NC II)",
            "Food Processing (NC II)",
            "Organic Agriculture Production (NC II)",
            "Poultry Production - Chicken (NC II)",
            "Ruminants Production (NC II)",
            "Swine Production (NC II)"
        ],
        "Family & Consumer Science": [
            "Aesthetic Services (Beauty Care) (NC II)",
            "Bakery Operations (NC II)",
            "Caregiving (Adult Care) (NC II)",
            "Caregiving (Child Care) (NC II)",
            "Events Management Services (NC III)",
            "Food and Beverages Operations (NC II)",
            "Garments Artisanry (NC II)",
            "Hairdressing Services (NC II)",
            "Handicraft (Weaving) (NC II)",
            "Hotel Operations (Front Office Services) (NC II)",
            "Hotel Operations (Housekeeping Services) (NC II)",
            "Kitchen Operations (NC II)",
            "Tourism Services (NC II)"
        ],
        "Maritime": [
            "Marine Engineering at the Support Level (Non-NC)",
            "Marine Transportation at the Support Level (Non-NC)",
            "Ships Catering Services (NC I)"
        ]
    }
};

// Initialize form on page load
document.addEventListener('DOMContentLoaded', async () => {
    if (!IS_ENROLLMENT_PAGE) return;

    await bootstrapSchoolBranding();
    applyTeacherAssistedUiMode();
    applyEnrollmentThemeFromStudent();
    autofillLearnerNameFromStudentData();
    setupAutoUppercaseForEnrollmentForm();

    // Load active school year from localStorage or API
    loadActiveSchoolYear();
    
    setupConditionalFields();
    setupFormValidation();
    setupModal();
});

function applyTeacherAssistedUiMode() {
    const assisted = isTeacherAssistedEnrollment();
    const badge = document.getElementById('teacherAssistedBadge');
    if (badge) {
        badge.style.display = assisted ? 'inline-flex' : 'none';
    }

    const homeLink = document.getElementById('homeLink');
    if (homeLink) {
        if (assisted) {
            if (homeLink.hasAttribute('href')) {
                homeLink.dataset.originalHref = homeLink.getAttribute('href') || '';
                homeLink.removeAttribute('href');
            }
            homeLink.classList.add('is-disabled');
            homeLink.setAttribute('aria-disabled', 'true');
            homeLink.setAttribute('tabindex', '-1');
            homeLink.setAttribute('title', 'Home is disabled during teacher-assisted enrollment');
        } else {
            if (!homeLink.hasAttribute('href') && homeLink.dataset.originalHref) {
                homeLink.setAttribute('href', homeLink.dataset.originalHref);
            }
            homeLink.classList.remove('is-disabled');
            homeLink.removeAttribute('aria-disabled');
            homeLink.removeAttribute('tabindex');
            homeLink.setAttribute('title', 'Go to Home');
        }
    }
}

function autofillLearnerNameFromStudentData() {
    if (isTeacherAssistedEnrollment()) {
        return;
    }

    const firstNameInput = document.getElementById('firstName');
    const lastNameInput = document.getElementById('lastName');
    if (!firstNameInput || !lastNameInput) return;

    let studentData = {};
    try {
        studentData = JSON.parse(localStorage.getItem('studentData') || '{}');
    } catch (_err) {
        studentData = {};
    }

    const firstName = String(studentData.firstName || studentData.first_name || '').trim();
    const lastName = String(studentData.lastName || studentData.last_name || '').trim();

    if (!firstNameInput.value && firstName) {
        firstNameInput.value = firstName;
    }

    if (!lastNameInput.value && lastName) {
        lastNameInput.value = lastName;
    }
}

function shouldAutoUppercaseField(field) {
    if (!field || field.readOnly || field.disabled) return false;
    if (String(field.dataset.allowLowercase || '').toLowerCase() === 'true') return false;

    const tag = String(field.tagName || '').toUpperCase();
    if (tag === 'TEXTAREA') return true;
    if (tag !== 'INPUT') return false;

    const type = String(field.type || 'text').toLowerCase();
    const excludedTypes = new Set([
        'email',
        'password',
        'url',
        'number',
        'date',
        'datetime-local',
        'month',
        'week',
        'time',
        'tel',
        'file',
        'hidden',
        'checkbox',
        'radio',
        'range',
        'color'
    ]);

    return !excludedTypes.has(type);
}

function forceFieldUppercase(field) {
    if (!shouldAutoUppercaseField(field)) return;

    const currentValue = String(field.value || '');
    const upperValue = currentValue.toUpperCase();
    if (currentValue === upperValue) return;

    const hasSelection = typeof field.selectionStart === 'number' && typeof field.selectionEnd === 'number';
    const selectionStart = hasSelection ? field.selectionStart : null;
    const selectionEnd = hasSelection ? field.selectionEnd : null;

    field.value = upperValue;

    if (hasSelection && selectionStart !== null && selectionEnd !== null) {
        try {
            field.setSelectionRange(selectionStart, selectionEnd);
        } catch (_err) {
            // ignore selection restore issues for unsupported input types
        }
    }
}

function setupAutoUppercaseForEnrollmentForm() {
    const form = document.getElementById('enrollmentForm');
    if (!form) return;

    const targets = Array.from(form.querySelectorAll('input, textarea')).filter(shouldAutoUppercaseField);

    targets.forEach((field) => {
        field.style.textTransform = 'uppercase';
        forceFieldUppercase(field);
        field.addEventListener('input', () => forceFieldUppercase(field));
        field.addEventListener('blur', () => forceFieldUppercase(field));
    });
}

// Load active school year from API first, then fallback to localStorage
async function loadActiveSchoolYear() {
    try {
        const response = await fetch(`${API_BASE}/api/school-years/active`, {
            cache: 'no-store',
            headers: {
                'Cache-Control': 'no-cache'
            }
        });
        if (response.ok) {
            const schoolYear = await response.json();
            window.activeSchoolYear = schoolYear;
            if (schoolYear) {
                localStorage.setItem('activeSchoolYear', JSON.stringify(schoolYear));
            }
            console.log('[Enrollment Form] Active school year loaded from API:', window.activeSchoolYear);
            updateSchoolYearDisplay();
            return schoolYear;
        }
    } catch (err) {
        console.warn('Failed to load active school year:', err);
    }

    const storedSchoolYear = localStorage.getItem('activeSchoolYear');
    if (storedSchoolYear) {
        try {
            window.activeSchoolYear = JSON.parse(storedSchoolYear);
            console.log('[Enrollment Form] Active school year loaded from localStorage fallback:', window.activeSchoolYear);
            updateSchoolYearDisplay();
            return window.activeSchoolYear;
        } catch (err) {
            console.warn('Failed to parse stored school year:', err);
        }
    }

    return null;
}

/**
 * Update the school year display in the form header
 */
function updateSchoolYearDisplay() {
    const schoolYearElement = document.getElementById('activeSchoolYearText');
    const footerSchoolYearElement = document.getElementById('footerSchoolYearText');
    if (!schoolYearElement && !footerSchoolYearElement) return;
    
    if (window.activeSchoolYear && window.activeSchoolYear.school_year) {
        const schoolYearText = `${activeSchoolName} - School Year ${window.activeSchoolYear.school_year}`;
        if (schoolYearElement) {
            schoolYearElement.textContent = schoolYearText;
        }
        if (footerSchoolYearElement) {
            footerSchoolYearElement.textContent = schoolYearText;
        }
        console.log('[Enrollment Form] Updated school year display to:', window.activeSchoolYear.school_year);
    } else {
        console.warn('[Enrollment Form] No active school year to display');
    }
}

// LRN validator (moved to top-level so it can be called from validateAndSubmit)
function validateLRN() {
    const lrnInput = document.getElementById('lrnNumber');
    const lrnError = document.getElementById('lrnError');
    if (!lrnInput || !lrnError) return true;

    const lrnValue = lrnInput.value.trim();
    const hasLRNYes = document.querySelector('input[name="hasLRN"][value="yes"]:checked');

    // Only validate if "Yes" is selected and field is not empty
    if (!hasLRNYes) {
        lrnError.style.display = 'none';
        lrnInput.style.borderColor = '';
        return true;
    }

    if (lrnValue === '') {
        lrnError.style.display = 'none';
        lrnInput.style.borderColor = '';
        return true;
    }

    // Check if contains only digits
    if (!/^\d+$/.test(lrnValue)) {
        lrnError.textContent = '⚠️ LRN must contain only numbers (0-9)';
        lrnError.style.display = 'block';
        lrnInput.style.borderColor = '#dc3545';
        return false;
    }

    // Check if exactly 12 digits
    if (lrnValue.length !== 12) {
        lrnError.textContent = `⚠️ LRN must be exactly 12 digits (currently ${lrnValue.length} digits)`;
        lrnError.style.display = 'block';
        lrnInput.style.borderColor = '#dc3545';
        return false;
    }

    // Valid
    lrnError.style.display = 'none';
    lrnInput.style.borderColor = '#28a745';
    return true;
}

// Setup all conditional field logic
function setupConditionalFields() {
    // LRN field
    document.querySelectorAll('input[name="hasLRN"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const lrnField = document.getElementById('lrnField');
            if (radio.value === 'yes') {
                lrnField.classList.remove('hidden');
            } else {
                lrnField.classList.add('hidden');
            }
        });
    });

    // LRN Validation
    const lrnInput = document.getElementById('lrnNumber');
    const lrnError = document.getElementById('lrnError');

    if (lrnInput) {
        // Real-time validation as user types
        lrnInput.addEventListener('input', () => {
            validateLRN();
        });

        // Validation on blur
        lrnInput.addEventListener('blur', () => {
            validateLRN();
        });
    }

    // Returning Learner fields
    document.querySelectorAll('input[name="returningLearner"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const fields = document.getElementById('returningLearnerFields');
            if (radio.value === 'yes') {
                fields.classList.remove('hidden');
            } else {
                fields.classList.add('hidden');
            }
        });
    });

    // IP fields
    document.querySelectorAll('input[name="isIP"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const fields = document.getElementById('ipFields');
            if (radio.value === 'yes') {
                fields.classList.remove('hidden');
            } else {
                fields.classList.add('hidden');
            }
        });
    });

    // IP Group - show other field
    const ipGroupEl = document.getElementById('ipGroup');
    if (ipGroupEl) {
        ipGroupEl.addEventListener('change', function() {
            const otherField = document.getElementById('ipOtherField');
            if (this.value === 'other') {
                otherField.classList.remove('hidden');
            } else {
                otherField.classList.add('hidden');
            }
        });
    }

    // 4Ps fields
    document.querySelectorAll('input[name="is4Ps"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const fields = document.getElementById('fpsFields');
            if (radio.value === 'yes') {
                fields.classList.remove('hidden');
            } else {
                fields.classList.add('hidden');
            }
        });
    });

    // Disability fields
    document.querySelectorAll('input[name="hasPWD"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const fields = document.getElementById('disabilityFields');
            if (radio.value === 'yes') {
                fields.classList.remove('hidden');
            } else {
                fields.classList.add('hidden');
            }
        });
    });

    // Birthdate -> auto-calc age
    const birthdateEl = document.getElementById('birthdate');
    if (birthdateEl) {
        birthdateEl.addEventListener('change', () => {
            const ageInput = document.getElementById('age');
            const dob = new Date(birthdateEl.value);
            if (!isNaN(dob.getTime())) {
                const today = new Date();
                let age = today.getFullYear() - dob.getFullYear();
                const m = today.getMonth() - dob.getMonth();
                if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
                    age--;
                }
                ageInput.value = age >= 0 ? age : '';
            }
        });
    }

    // Mother tongue -> show other input
    const mt = document.getElementById('motherTongue');
    if (mt) {
        mt.addEventListener('change', function() {
            const other = document.getElementById('motherTongueOther');
            if (this.value === 'other') other.classList.remove('hidden'); else other.classList.add('hidden');
        });
    }

    // Grade Level and Senior High fields (also update electives when grade changes)
    const gradeEl = document.getElementById('gradeLevel');
    if (gradeEl) {
        gradeEl.addEventListener('change', function() {
            const seniorHighFields = document.getElementById('seniorHighFields');
            if (this.value === '11' || this.value === '12') {
                seniorHighFields.classList.remove('hidden');
            } else {
                seniorHighFields.classList.add('hidden');
            }
            handlePreviousEnrollmentLookupVisibility();
            updateElectives();
        });
    }

    // Track/semester selection - show/update electives
    const trackEl = document.getElementById('track');
    if (trackEl) trackEl.addEventListener('change', updateElectives);
    const semEl = document.getElementById('semester');
    if (semEl) semEl.addEventListener('change', updateElectives);

    // Permanent Address checkbox
    const sameAddr = document.getElementById('sameAsCurrentAddress');
    if (sameAddr) {
        sameAddr.addEventListener('change', function() {
            if (this.checked) copyCurrentToPermanentAddress();
        });
    }

    // Initialize address cascading dropdowns
    initAddressCascade();

    // Previous enrollment lookup + autofill
    setupPreviousEnrollmentLookup();
}

function safeParseObject(value) {
    if (!value) return {};
    if (typeof value === 'object') return value;
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_err) {
        return {};
    }
}

function valueToArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
    if (typeof value === 'string') {
        const text = value.trim();
        if (!text) return [];
        if ((text.startsWith('[') && text.endsWith(']')) || (text.startsWith('{') && text.endsWith('}'))) {
            try {
                const parsed = JSON.parse(text);
                return valueToArray(parsed);
            } catch (_err) {}
        }
        return text.split(/\s*,\s*/).map((item) => item.trim()).filter(Boolean);
    }
    return [String(value).trim()].filter(Boolean);
}

function normalizeToDateInput(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
}

function buildEnrollmentDisplayName(row) {
    const data = safeParseObject(row && row.enrollment_data);
    const first = String(data.firstName || row.firstName || row.first_name || '').trim();
    const middle = String(data.middleName || row.middleName || row.middle_name || '').trim();
    const last = String(data.lastName || row.lastName || row.last_name || '').trim();
    const fallback = String(row.student_name || row.studentName || '').trim();
    return [first, middle, last].filter(Boolean).join(' ').trim() || fallback || 'Unknown Student';
}

function getEnrollmentSearchText(row) {
    const data = safeParseObject(row && row.enrollment_data);
    const fields = [
        row && row.id,
        row && row.enrollment_id,
        row && row.student_id,
        row && row.studentId,
        row && row.lrn_no,
        data.studentLRN,
        data.lrn,
        data.firstName,
        data.middleName,
        data.lastName,
        buildEnrollmentDisplayName(row),
        row && row.status,
        data.gradeLevel,
        data.grade,
        row && row.school_year,
        row && row.school_year_name,
        row && row.school_year_id
    ];
    return fields.map((item) => String(item || '').trim().toLowerCase()).join(' ');
}

function getActiveSchoolYearMeta() {
    let active = window.activeSchoolYear;
    if (!active) {
        try {
            active = JSON.parse(localStorage.getItem('activeSchoolYear') || 'null');
        } catch (_err) {
            active = null;
        }
    }

    const activeId = String(
        (active && (active.id || active.school_year_id || active.schoolYearId || active.activeSchoolYearId)) || ''
    ).trim();
    const activeName = String((active && (active.school_year || active.schoolYear || active.name)) || '').trim().toLowerCase();

    return {
        id: activeId,
        name: activeName
    };
}

function getEnrollmentSchoolYearMeta(row) {
    const data = safeParseObject(row && row.enrollment_data);

    const idCandidates = [
        row && row.school_year_id,
        row && row.schoolYearId,
        row && row.activeSchoolYearId,
        row && row.school_year && row.school_year.id,
        data.school_year_id,
        data.schoolYearId,
        data.activeSchoolYearId,
        data.school_year && data.school_year.id
    ]
        .map((value) => String(value || '').trim())
        .filter(Boolean);

    const nameCandidates = [
        row && row.school_year_name,
        row && row.school_year && row.school_year.school_year,
        row && row.school_year,
        data.school_year_name,
        data.school_year,
        data.schoolYear,
        data.lastSchoolYear,
        row && row.lastSchoolYear
    ]
        .map((value) => String(value || '').trim().toLowerCase())
        .filter(Boolean);

    return {
        ids: new Set(idCandidates),
        names: new Set(nameCandidates)
    };
}

async function ensureSchoolYearLookupMap(headers = {}) {
    if (previousEnrollmentLookupState.schoolYearMapLoaded) {
        return previousEnrollmentLookupState.schoolYearMap;
    }

    const endpointCandidates = [
        '/api/school-years?limit=300',
        '/api/school-years'
    ];

    try {
        for (const endpoint of endpointCandidates) {
            try {
                const fullUrl = new URL(withSchoolParam(endpoint), API_BASE || window.location.origin).toString();
                const response = await fetch(fullUrl, { headers, cache: 'no-store' });
                if (!response.ok) continue;

                const payload = await response.json();
                const rows = Array.isArray(payload)
                    ? payload
                    : (Array.isArray(payload && payload.data) ? payload.data : []);

                if (!rows.length) continue;

                const map = {};
                rows.forEach((row) => {
                    const id = String(row && (row.id || row.school_year_id || row.schoolYearId) || '').trim();
                    const label = String(row && (row.school_year || row.schoolYear || row.name) || '').trim();
                    if (id && label) {
                        map[id] = label;
                    }
                });

                previousEnrollmentLookupState.schoolYearMap = map;
                previousEnrollmentLookupState.schoolYearMapLoaded = true;
                return map;
            } catch (_err) {
                // try next endpoint
            }
        }
    } catch (_err) {
    }

    previousEnrollmentLookupState.schoolYearMapLoaded = true;
    previousEnrollmentLookupState.schoolYearMap = previousEnrollmentLookupState.schoolYearMap || {};
    return previousEnrollmentLookupState.schoolYearMap;
}

function resolveEnrollmentSchoolYearLabel(row) {
    const data = safeParseObject(row && row.enrollment_data);
    const direct = String(
        row && (row.school_year_name || (row.school_year && row.school_year.school_year) || row.school_year) ||
        data.school_year_name || data.school_year || data.schoolYear || row.lastSchoolYear || data.lastSchoolYear || ''
    ).trim();
    if (direct && direct !== '--') return direct;

    const idCandidates = [
        row && row.school_year_id,
        row && row.schoolYearId,
        row && row.activeSchoolYearId,
        row && row.school_year && row.school_year.id,
        data.school_year_id,
        data.schoolYearId,
        data.activeSchoolYearId,
        data.school_year && data.school_year.id
    ]
        .map((value) => String(value || '').trim())
        .filter(Boolean);

    for (const id of idCandidates) {
        const label = previousEnrollmentLookupState.schoolYearMap && previousEnrollmentLookupState.schoolYearMap[id];
        if (label) return String(label).trim();
    }

    return 'Unknown School Year';
}

function isPreviousSchoolYearEnrollment(row) {
    const active = getActiveSchoolYearMeta();
    const schoolYearMeta = getEnrollmentSchoolYearMeta(row);

    const isActiveById = !!(active.id && schoolYearMeta.ids.has(active.id));
    const isActiveByName = !!(active.name && schoolYearMeta.names.has(active.name));

    if (active.id || active.name) {
        return !(isActiveById || isActiveByName);
    }

    return true;
}

function setLookupStatus(message) {
    const statusEl = document.getElementById('previousEnrollmentLookupStatus');
    if (statusEl) statusEl.textContent = String(message || '');
}

function renderPreviousEnrollmentResults(rows) {
    const container = document.getElementById('previousEnrollmentResults');
    if (!container) return;

    if (!Array.isArray(rows) || rows.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = rows.map((row, index) => {
        const data = safeParseObject(row && row.enrollment_data);
        const name = buildEnrollmentDisplayName(row);
        const lrn = String(data.studentLRN || data.lrn || row.lrn_no || '--').trim();
        const grade = String(data.gradeLevel || data.grade || row.grade_level || '--').trim();
        const schoolYear = resolveEnrollmentSchoolYearLabel(row);
        const status = String(row.status || '--').trim();
        const enrollmentId = String(row.id || row.enrollment_id || '--').trim();

        return `
            <button type="button" class="lookup-result-item" data-lookup-index="${index}">
                <div class="lookup-result-main">${name}</div>
                <div class="lookup-result-meta">LRN: ${lrn} · Last Grade: ${grade} · SY: ${schoolYear} · Status: ${status} · ID: ${enrollmentId}</div>
            </button>
        `;
    }).join('');
}

async function fetchPreviousEnrollmentCandidates() {
    if (previousEnrollmentLookupState.loaded || previousEnrollmentLookupState.loading) {
        return previousEnrollmentLookupState.rows;
    }

    previousEnrollmentLookupState.loading = true;
    setLookupStatus('Loading previous enrollments...');

    const token = String(
        localStorage.getItem('adminAuthToken') ||
        localStorage.getItem('studentAuthToken') ||
        localStorage.getItem('authToken') ||
        ''
    ).trim();

    const headers = {
        ...(activeSchoolCode ? { 'x-tenant-code': activeSchoolCode } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    await ensureSchoolYearLookupMap(headers);

    const endpointCandidates = [
        '/api/enrollments?activeYear=false&limit=400&sort=recent',
        '/api/enrollments?activeYear=false&limit=400',
        '/api/enrollments?limit=400&sort=recent',
        '/api/enrollments?limit=400'
    ];

    try {
        let rows = [];
        for (const endpoint of endpointCandidates) {
            try {
                const fullUrl = new URL(withSchoolParam(endpoint), API_BASE || window.location.origin).toString();
                const response = await fetch(fullUrl, { headers, cache: 'no-store' });
                if (!response.ok) continue;
                const payload = await response.json();
                const normalized = normalizeEnrollmentPayload(payload);
                const filteredPreviousOnly = Array.isArray(normalized)
                    ? normalized.filter((entry) => isPreviousSchoolYearEnrollment(entry))
                    : [];

                if (filteredPreviousOnly.length > 0) {
                    rows = filteredPreviousOnly;
                    break;
                }
            } catch (_err) {
                // try next endpoint
            }
        }

        previousEnrollmentLookupState.rows = Array.isArray(rows) ? rows : [];
        previousEnrollmentLookupState.loaded = true;
        return previousEnrollmentLookupState.rows;
    } finally {
        previousEnrollmentLookupState.loading = false;
    }
}

function setRadioGroupValue(name, value) {
    const radios = document.querySelectorAll(`input[type="radio"][name="${name}"]`);
    if (!radios || radios.length === 0) return;
    const normalized = String(value || '').trim().toLowerCase();
    radios.forEach((radio) => {
        radio.checked = String(radio.value || '').trim().toLowerCase() === normalized;
    });
    const selected = Array.from(radios).find((radio) => radio.checked);
    if (selected) {
        selected.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

function setCheckboxGroupValues(name, values) {
    const checkboxes = document.querySelectorAll(`input[type="checkbox"][name="${name}"]`);
    if (!checkboxes || checkboxes.length === 0) return;
    const normalizedSet = new Set(valueToArray(values).map((item) => String(item || '').trim().toLowerCase()));
    checkboxes.forEach((checkbox) => {
        checkbox.checked = normalizedSet.has(String(checkbox.value || '').trim().toLowerCase());
    });
}

function setFieldValue(fieldName, value) {
    const field = document.querySelector(`[name="${fieldName}"]`) || document.getElementById(fieldName);
    if (!field || value == null) return;

    const normalizedValue = String(value);
    const normalizeToken = (input) => String(input || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');

    if (field.tagName === 'SELECT') {
        const directOption = Array.from(field.options || []).find((opt) => String(opt.value) === normalizedValue);
        const looseOption = directOption || Array.from(field.options || []).find((opt) => String(opt.value || '').trim().toLowerCase() === normalizedValue.trim().toLowerCase());
        if (looseOption) {
            field.value = looseOption.value;
        } else {
            const normalizedTarget = normalizeToken(normalizedValue);
            const byTextOrLoose = Array.from(field.options || []).find((opt) => {
                const optionValue = String(opt.value || '').trim();
                const optionText = String(opt.textContent || '').trim();

                const optionValueToken = normalizeToken(optionValue);
                const optionTextToken = normalizeToken(optionText);

                return (
                    optionTextToken === normalizedTarget ||
                    optionValueToken === normalizedTarget ||
                    (normalizedTarget && optionTextToken.includes(normalizedTarget)) ||
                    (normalizedTarget && normalizedTarget.includes(optionTextToken)) ||
                    (normalizedTarget && optionValueToken.includes(normalizedTarget)) ||
                    (normalizedTarget && normalizedTarget.includes(optionValueToken))
                );
            });

            if (byTextOrLoose) {
                field.value = byTextOrLoose.value;
            }
        }
    } else {
        field.value = normalizedValue;
    }

    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
}

function normalizeTrackValue(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return '';
    if (normalized.includes('doorway')) return 'doorway';
    if (normalized.includes('tech')) return 'techpro';
    if (normalized.includes('academic')) return 'academic';
    return normalized;
}

function extractElectiveList(value) {
    if (value == null) return [];
    if (Array.isArray(value)) {
        return value
            .map((item) => String(item || '').trim())
            .filter(Boolean);
    }

    if (typeof value === 'object') {
        const preferredKeys = [
            'academicElectives', 'techproElectives', 'doorwayAcademic', 'doorwayTechPro', 'doorwayTechpro',
            'electives', 'subjects', 'selected', 'values', 'items', 'list', 'academic', 'techpro'
        ];

        let collected = [];
        preferredKeys.forEach((key) => {
            if (Object.prototype.hasOwnProperty.call(value, key) && value[key] != null) {
                collected = collected.concat(extractElectiveList(value[key]));
            }
        });

        if (collected.length > 0) {
            return Array.from(new Set(collected));
        }

        return Object.values(value)
            .flatMap((entry) => extractElectiveList(entry))
            .filter(Boolean);
    }

    return valueToArray(value);
}

function resolveElectivePrefill(merged = {}) {
    const explicitAcademic = valueToArray(merged.academicElectives || merged.academic_electives);
    const explicitTechPro = valueToArray(merged.techproElectives || merged.techpro_electives);
    const explicitDoorwayAcademic = valueToArray(merged.doorwayAcademic || merged.doorway_academic);
    const explicitDoorwayTechPro = valueToArray(merged.doorwayTechPro || merged.doorwayTechpro || merged.doorway_techpro);

    const generic = extractElectiveList(
        merged.electives || merged.selectedElectives || merged.subjects || merged.subject || merged.selectedSubjects
    );

    const track = normalizeTrackValue(merged.track || merged.trackName || merged.programTrack || merged.strand);

    const academicElectives = explicitAcademic.length
        ? explicitAcademic
        : (track === 'academic' ? generic : []);
    const techproElectives = explicitTechPro.length
        ? explicitTechPro
        : (track === 'techpro' ? generic : []);

    const doorwayAcademic = explicitDoorwayAcademic.length
        ? explicitDoorwayAcademic
        : (track === 'doorway' ? generic.slice(0, 1) : []);
    const doorwayTechPro = explicitDoorwayTechPro.length
        ? explicitDoorwayTechPro
        : (track === 'doorway' ? generic.slice(1, 2) : []);

    return {
        academicElectives,
        techproElectives,
        doorwayAcademic,
        doorwayTechPro
    };
}

function applyAddressPrefill(type, payload = {}) {
    const sitio = payload[`${type}Sitio`];
    const country = payload[`${type}Country`];
    const province = payload[`${type}Province`];
    const municipality = payload[`${type}Municipality`];
    const barangay = payload[`${type}Barangay`];
    const zipCode = payload[`${type}ZipCode`];

    setFieldValue(`${type}Sitio`, sitio || '');
    setFieldValue(`${type}ZipCode`, zipCode || '');

    if (!country) return;
    setFieldValue(`${type}Country`, country);
    updateAddressDropdowns(type, country);

    setTimeout(() => {
        if (province) {
            setFieldValue(`${type}Province`, province);
            updateAddressMunicipalities(type, country, province);
        }

        setTimeout(() => {
            if (municipality) {
                setFieldValue(`${type}Municipality`, municipality);
                updateAddressBarangays(type, country, province, municipality);
            }

            setTimeout(() => {
                if (barangay) {
                    setFieldValue(`${type}Barangay`, barangay);
                }
            }, 80);
        }, 80);
    }, 80);
}

function normalizePrefillDataFromEnrollment(enrollment) {
    const enrollmentData = safeParseObject(enrollment && enrollment.enrollment_data);
    const merged = {
        ...(enrollment || {}),
        ...enrollmentData
    };
    const electivePrefill = resolveElectivePrefill(merged);

    const learningModalities = valueToArray(
        merged.learningModalities || merged.learning_modality || merged.learningModality
    );

    return {
        gradeLevel: merged.gradeLevel || merged.grade_level || merged.grade,
        semester: String(merged.semester || '').toLowerCase().startsWith('first') ? 'first' : (String(merged.semester || '').toLowerCase().startsWith('second') ? 'second' : merged.semester),
        track: merged.track,
        returningLearner: merged.returningLearner || (merged.lastGradeLevel || merged.lastSchoolYear || merged.lastSchoolAttended ? 'yes' : 'no'),
        lastGradeLevel: merged.lastGradeLevel,
        lastSchoolYear: merged.lastSchoolYear,
        lastSchoolAttended: merged.lastSchoolAttended,
        schoolID: merged.schoolID || merged.last_school_scid,
        hasLRN: merged.hasLRN || ((merged.lrn || merged.studentLRN || merged.lrn_no) ? 'yes' : 'no'),
        lrn: merged.lrn || merged.studentLRN || merged.lrn_no,
        lastName: merged.lastName || merged.last_name,
        firstName: merged.firstName || merged.first_name,
        middleName: merged.middleName || merged.middle_name,
        extensionName: merged.extensionName || merged.extension_name,
        birthdate: normalizeToDateInput(merged.birthdate || merged.date_of_birth),
        age: merged.age,
        sex: merged.sex || merged.gender,
        placeOfBirth: merged.placeOfBirth || merged.place_of_birth,
        motherTongue: merged.motherTongue || merged.mother_tongue,
        motherTongueOtherText: merged.motherTongueOtherText || merged.mother_tongue_other,
        isIP: merged.isIP,
        ipGroup: merged.ipGroup,
        ipOtherText: merged.ipOtherText,
        is4Ps: merged.is4Ps,
        householdID: merged.householdID,
        hasPWD: merged.hasPWD,
        disabilities: valueToArray(merged.disabilities || merged.disability),
        disabilityDetails: merged.disabilityDetails,
        currentSitio: merged.currentSitio || merged.cu_address_sitio_street,
        currentCountry: merged.currentCountry,
        currentProvince: merged.currentProvince || merged.cu_address_province_id,
        currentMunicipality: merged.currentMunicipality || merged.cu_address_municipality_id,
        currentBarangay:
            merged.currentBarangay ||
            merged.currentBarangayName ||
            merged.current_barangay ||
            merged.current_barangay_name ||
            merged.cu_address_barangay ||
            merged.cu_address_barangay_name ||
            merged.cu_address_barangay_id,
        currentZipCode: merged.currentZipCode || merged.cu_address_zip,
        permanentSitio: merged.permanentSitio || merged.pe_address_sitio_street,
        permanentCountry: merged.permanentCountry,
        permanentProvince: merged.permanentProvince || merged.pe_address_province_id,
        permanentMunicipality: merged.permanentMunicipality || merged.pe_address_municipality_id,
        permanentBarangay:
            merged.permanentBarangay ||
            merged.permanentBarangayName ||
            merged.permanent_barangay ||
            merged.permanent_barangay_name ||
            merged.pe_address_barangay ||
            merged.pe_address_barangay_name ||
            merged.pe_address_barangay_id,
        permanentZipCode: merged.permanentZipCode || merged.pe_address_zip,
        sameAsCurrentAddress: !!merged.sameAsCurrentAddress,
        fatherName: merged.fatherName,
        fatherContact: merged.fatherContact,
        motherMaidenName: merged.motherMaidenName,
        motherContact: merged.motherContact,
        guardianName: merged.guardianName,
        guardianContact: merged.guardianContact,
        learningModalities,
        academicElectives: electivePrefill.academicElectives,
        techproElectives: electivePrefill.techproElectives,
        doorwayAcademic: electivePrefill.doorwayAcademic,
        doorwayTechPro: electivePrefill.doorwayTechPro
    };
}

function applyPreviousEnrollmentPrefill(enrollment) {
    const prefill = normalizePrefillDataFromEnrollment(enrollment);
    const currentSelectedGrade = String((document.getElementById('gradeLevel') || {}).value || '').trim();

    // Preserve user-selected target grade; only use previous grade when empty.
    if (!currentSelectedGrade && prefill.gradeLevel) {
        setFieldValue('gradeLevel', prefill.gradeLevel);
    }

    setRadioGroupValue('returningLearner', prefill.returningLearner || 'yes');
    setRadioGroupValue('hasLRN', prefill.hasLRN || 'no');
    setRadioGroupValue('isIP', prefill.isIP || 'no');
    setRadioGroupValue('is4Ps', prefill.is4Ps || 'no');
    setRadioGroupValue('hasPWD', prefill.hasPWD || 'no');

    [
        'semester', 'track', 'lastGradeLevel', 'lastSchoolYear', 'lastSchoolAttended', 'schoolID', 'lrn',
        'lastName', 'firstName', 'middleName', 'extensionName', 'birthdate', 'age', 'sex', 'placeOfBirth',
        'motherTongue', 'motherTongueOtherText', 'ipGroup', 'ipOtherText', 'householdID', 'disabilityDetails',
        'fatherName', 'fatherContact', 'motherMaidenName', 'motherContact', 'guardianName', 'guardianContact'
    ].forEach((field) => {
        if (prefill[field] != null && String(prefill[field]).trim() !== '') {
            setFieldValue(field, prefill[field]);
        }
    });

    applyAddressPrefill('current', prefill);
    applyAddressPrefill('permanent', prefill);

    const sameAsCurrentAddressEl = document.getElementById('sameAsCurrentAddress');
    if (sameAsCurrentAddressEl) {
        sameAsCurrentAddressEl.checked = !!prefill.sameAsCurrentAddress;
        if (prefill.sameAsCurrentAddress) {
            setTimeout(() => {
                copyCurrentToPermanentAddress();
            }, 220);
            setTimeout(() => {
                copyCurrentToPermanentAddress();
            }, 520);
        }
    }

    setTimeout(() => {
        applyAddressPrefill('current', prefill);
        if (!prefill.sameAsCurrentAddress) {
            applyAddressPrefill('permanent', prefill);
        }
    }, 420);

    const applyCheckboxPrefill = () => {
        setCheckboxGroupValues('disability', prefill.disabilities);
        setCheckboxGroupValues('learningModality', prefill.learningModalities);
        setCheckboxGroupValues('academicElectives', prefill.academicElectives);
        setCheckboxGroupValues('techproElectives', prefill.techproElectives);
        setCheckboxGroupValues('doorwayAcademic', prefill.doorwayAcademic);
        setCheckboxGroupValues('doorwayTechPro', prefill.doorwayTechPro);
        enforceAcademicLimit();
        enforceTechProLimit();
        enforceDoorwayLimits();
    };

    updateElectives();
    applyCheckboxPrefill();
    setTimeout(applyCheckboxPrefill, 180);
    setTimeout(applyCheckboxPrefill, 360);
}

function handlePreviousEnrollmentLookupVisibility() {
    const gradeEl = document.getElementById('gradeLevel');
    const panel = document.getElementById('previousEnrollmentLookup');
    if (!gradeEl || !panel) return;

    const grade = String(gradeEl.value || '').trim();
    if (!grade) {
        panel.classList.add('hidden');
        setLookupStatus('Select grade level to start lookup.');
        renderPreviousEnrollmentResults([]);
        return;
    }

    panel.classList.remove('hidden');
    setLookupStatus('Type a student name, LRN, or enrollment ID then click Search.');
}

async function runPreviousEnrollmentLookup() {
    const searchEl = document.getElementById('previousEnrollmentSearch');
    const gradeEl = document.getElementById('gradeLevel');
    const grade = String((gradeEl && gradeEl.value) || '').trim();
    const query = String((searchEl && searchEl.value) || '').trim().toLowerCase();

    if (!grade) {
        setLookupStatus('Select grade level to start lookup.');
        renderPreviousEnrollmentResults([]);
        return;
    }

    const rows = await fetchPreviousEnrollmentCandidates();
    const filtered = rows
        .filter((row) => isPreviousSchoolYearEnrollment(row))
        .filter((row) => {
            if (!query) return true;
            return getEnrollmentSearchText(row).includes(query);
        })
        .sort((a, b) => {
            const left = new Date(a && (a.enrollment_date || a.created_at || 0)).getTime() || 0;
            const right = new Date(b && (b.enrollment_date || b.created_at || 0)).getTime() || 0;
            return right - left;
        })
        .slice(0, 30);

    previousEnrollmentLookupState.currentFiltered = filtered;
    renderPreviousEnrollmentResults(filtered);
    setLookupStatus(filtered.length
        ? `Found ${filtered.length} previous enrollment record(s). Click one to autofill.`
        : 'No matching previous enrollment records found.');
}

function setupPreviousEnrollmentLookup() {
    const panel = document.getElementById('previousEnrollmentLookup');
    const gradeEl = document.getElementById('gradeLevel');
    const searchEl = document.getElementById('previousEnrollmentSearch');
    const searchBtn = document.getElementById('previousEnrollmentSearchBtn');
    const resultsEl = document.getElementById('previousEnrollmentResults');
    if (!panel || !gradeEl || !searchEl || !searchBtn || !resultsEl) return;

    handlePreviousEnrollmentLookupVisibility();

    searchBtn.addEventListener('click', () => {
        runPreviousEnrollmentLookup().catch(() => {
            setLookupStatus('Unable to load previous enrollments right now.');
        });
    });

    searchEl.addEventListener('input', () => {
        if (previousEnrollmentLookupState.debounceTimer) {
            clearTimeout(previousEnrollmentLookupState.debounceTimer);
        }
        previousEnrollmentLookupState.debounceTimer = setTimeout(() => {
            runPreviousEnrollmentLookup().catch(() => {
                setLookupStatus('Unable to load previous enrollments right now.');
            });
        }, 280);
    });

    resultsEl.addEventListener('click', (event) => {
        const item = event.target && event.target.closest
            ? event.target.closest('.lookup-result-item[data-lookup-index]')
            : null;
        if (!item) return;

        const idx = Number(item.getAttribute('data-lookup-index'));
        const selected = Array.isArray(previousEnrollmentLookupState.currentFiltered)
            ? previousEnrollmentLookupState.currentFiltered[idx]
            : null;
        if (!selected) return;

        applyPreviousEnrollmentPrefill(selected);
        setLookupStatus('Prefilled from selected previous enrollment. Review and edit before submitting.');
        showNotification('Previous enrollment loaded. Review and edit fields before submission.');
    });
}

// Address Cascade Functions
function initAddressCascade() {
    // Initialize countries
    const currentCountryEl = document.getElementById('currentCountry');
    const permanentCountryEl = document.getElementById('permanentCountry');

    // Guard against null elements (may not exist on all pages)
    if (!currentCountryEl || !permanentCountryEl) {
        console.warn('[enrollment-form] Address cascade elements not found, skipping initialization');
        return;
    }

    Object.keys(ADDRESS_DATA).forEach(country => {
        currentCountryEl.innerHTML += `<option value="${country}">${country}</option>`;
        permanentCountryEl.innerHTML += `<option value="${country}">${country}</option>`;
    });

    // Setup current address cascade
    if (currentCountryEl) {
        currentCountryEl.addEventListener('change', function() {
            updateAddressDropdowns('current', this.value);
        });
    }

    const currentProvinceEl = document.getElementById('currentProvince');
    if (currentProvinceEl) {
        currentProvinceEl.addEventListener('change', function() {
            updateAddressMunicipalities('current', document.getElementById('currentCountry').value, this.value);
        });
    }

    const currentMunicipalityEl = document.getElementById('currentMunicipality');
    if (currentMunicipalityEl) {
        currentMunicipalityEl.addEventListener('change', function() {
            updateAddressBarangays('current', document.getElementById('currentCountry').value, document.getElementById('currentProvince').value, this.value);
        });
    }

    // Setup permanent address cascade
    if (permanentCountryEl) {
        permanentCountryEl.addEventListener('change', function() {
            updateAddressDropdowns('permanent', this.value);
        });
    }

    const permanentProvinceEl = document.getElementById('permanentProvince');
    if (permanentProvinceEl) {
        permanentProvinceEl.addEventListener('change', function() {
            updateAddressMunicipalities('permanent', document.getElementById('permanentCountry').value, this.value);
        });
    }

    const permanentMunicipalityEl = document.getElementById('permanentMunicipality');
    if (permanentMunicipalityEl) {
        permanentMunicipalityEl.addEventListener('change', function() {
            updateAddressBarangays('permanent', document.getElementById('permanentCountry').value, document.getElementById('permanentProvince').value, this.value);
        });
    }

    // Set default to Philippines
    currentCountryEl.value = 'Philippines';
    updateAddressDropdowns('current', 'Philippines');
    permanentCountryEl.value = 'Philippines';
    updateAddressDropdowns('permanent', 'Philippines');
}

function updateAddressDropdowns(type, country) {
    const provinceEl = document.getElementById(`${type}Province`);
    const municipalityEl = document.getElementById(`${type}Municipality`);
    const barangayEl = document.getElementById(`${type}Barangay`);

    // Clear and reset provinces
    provinceEl.innerHTML = '<option value="">Select Province</option>';
    municipalityEl.innerHTML = '<option value="">Select Municipality</option>';
    barangayEl.innerHTML = '<option value="">Select Barangay</option>';

    if (ADDRESS_DATA[country]) {
        Object.keys(ADDRESS_DATA[country]).forEach(province => {
            provinceEl.innerHTML += `<option value="${province}">${province}</option>`;
        });
    }
}

function updateAddressMunicipalities(type, country, province) {
    const municipalityEl = document.getElementById(`${type}Municipality`);
    const barangayEl = document.getElementById(`${type}Barangay`);

    // Clear and reset municipalities and barangays
    municipalityEl.innerHTML = '<option value="">Select Municipality</option>';
    barangayEl.innerHTML = '<option value="">Select Barangay</option>';

    if (ADDRESS_DATA[country] && ADDRESS_DATA[country][province]) {
        Object.keys(ADDRESS_DATA[country][province]).forEach(municipality => {
            municipalityEl.innerHTML += `<option value="${municipality}">${municipality}</option>`;
        });
    }
}

function updateAddressBarangays(type, country, province, municipality) {
    const barangayEl = document.getElementById(`${type}Barangay`);

    // Clear and reset barangays
    barangayEl.innerHTML = '<option value="">Select Barangay</option>';

    if (ADDRESS_DATA[country] && ADDRESS_DATA[country][province] && ADDRESS_DATA[country][province][municipality]) {
        ADDRESS_DATA[country][province][municipality].forEach(barangay => {
            barangayEl.innerHTML += `<option value="${barangay}">${barangay}</option>`;
        });
    }
}

// Update electives based on track selection
function updateElectives() {
    const grade = document.getElementById('gradeLevel') ? document.getElementById('gradeLevel').value : '';
    const track = document.getElementById('track').value;
    const electiveSelection = document.getElementById('electiveSelection');
    const electivesList = document.getElementById('electivesList');
    // Only show electives for Grade 11 or 12
    if (!(grade === '11' || grade === '12') || !track) {
        electiveSelection.classList.add('hidden');
        electivesList.innerHTML = '';
        return;
    }

    electiveSelection.classList.remove('hidden');
    electivesList.innerHTML = '';

    if (track === 'academic') {
        renderAcademicElectives();
    } else if (track === 'techpro') {
        renderTechProElectives();
    } else if (track === 'doorway') {
        renderDoorwayElectives();
    }
}

// Render Academic Track electives
// Render Academic Track electives as accordion
function renderAcademicElectives() {
    const electivesList = document.getElementById('electivesList');
    electivesList.innerHTML = '<p class="form-subtitle">Select up to 2 academic electives</p>';

    Object.keys(window.ELECTIVES.academic).forEach(category => {
        const items = window.ELECTIVES.academic[category].map(subject => {
            return `<label class="checkbox-label"><input type="checkbox" name="academicElectives" value="${subject}"><span>${subject}</span></label>`;
        }).join('');

        electivesList.innerHTML += `
            <div class="accordion-item">
                <button type="button" class="accordion-header">${category}</button>
                <div class="accordion-panel">${items}</div>
            </div>
        `;
    });

    initAccordions({ expandAll: true });
    document.querySelectorAll('input[name="academicElectives"]').forEach(cb => cb.addEventListener('change', enforceAcademicLimit));
    enforceAcademicLimit();
}

// Render Tech-Pro Track electives as accordion
function renderTechProElectives() {
    const electivesList = document.getElementById('electivesList');
    electivesList.innerHTML = '<p class="form-subtitle">Select 1 Tech-Pro elective</p>';

    Object.keys(window.ELECTIVES.techpro).forEach(category => {
        const items = window.ELECTIVES.techpro[category].map(subject => {
            return `<label class="checkbox-label"><input type="checkbox" name="techproElectives" value="${subject}"><span>${subject}</span></label>`;
        }).join('');

        electivesList.innerHTML += `
            <div class="accordion-item">
                <button type="button" class="accordion-header">${category}</button>
                <div class="accordion-panel">${items}</div>
            </div>
        `;
    });

    initAccordions({ expandAll: true });
    document.querySelectorAll('input[name="techproElectives"]').forEach(cb => cb.addEventListener('change', enforceTechProLimit));
    enforceTechProLimit();
}

// Render Doorway Track electives - separate sections for academic and tech-pro
function renderDoorwayElectives() {
    const electivesList = document.getElementById('electivesList');
    electivesList.innerHTML = '<p class="form-subtitle">Select 1 Academic and 1 Tech-Pro elective</p>';

    // Academic section
    electivesList.innerHTML += `<h4 style="color:#1e5631; margin-top:8px;">Academic Electives</h4>`;
    Object.keys(window.ELECTIVES.academic).forEach(category => {
        const items = window.ELECTIVES.academic[category].map(subject => {
            return `<label class="checkbox-label"><input type="checkbox" name="doorwayAcademic" value="${subject}"><span>${subject}</span></label>`;
        }).join('');

        electivesList.innerHTML += `
            <div class="accordion-item">
                <button type="button" class="accordion-header">${category}</button>
                <div class="accordion-panel">${items}</div>
            </div>
        `;
    });

    // Tech-Pro section
    electivesList.innerHTML += `<h4 style="color:#1e5631; margin-top:12px;">Tech-Pro Electives</h4>`;
    Object.keys(window.ELECTIVES.techpro).forEach(category => {
        const items = window.ELECTIVES.techpro[category].map(subject => {
            return `<label class="checkbox-label"><input type="checkbox" name="doorwayTechPro" value="${subject}"><span>${subject}</span></label>`;
        }).join('');

        electivesList.innerHTML += `
            <div class="accordion-item">
                <button type="button" class="accordion-header">${category}</button>
                <div class="accordion-panel">${items}</div>
            </div>
        `;
    });

    initAccordions({ expandAll: true });
    document.querySelectorAll('input[name="doorwayAcademic"]').forEach(cb => cb.addEventListener('change', enforceDoorwayLimits));
    document.querySelectorAll('input[name="doorwayTechPro"]').forEach(cb => cb.addEventListener('change', enforceDoorwayLimits));
    enforceDoorwayLimits();
}

// Accordion initializer
function initAccordions(options = {}) {
    const expandAll = options.expandAll !== false;

    document.querySelectorAll('#electivesList .accordion-header').forEach(header => {
        header.removeEventListener('click', header._accordionHandler);
        const item = header.parentElement;
        const panel = header.nextElementSibling;

        if (item && panel) {
            if (expandAll) {
                item.classList.add('open');
                panel.style.maxHeight = panel.scrollHeight + 'px';
            } else {
                item.classList.remove('open');
                panel.style.maxHeight = 0;
            }
        }

        const handler = function() {
            const item = header.parentElement;
            item.classList.toggle('open');
            const panel = header.nextElementSibling;
            if (item.classList.contains('open')) {
                panel.style.maxHeight = panel.scrollHeight + 'px';
            } else {
                panel.style.maxHeight = 0;
            }
        };
        header._accordionHandler = handler;
        header.addEventListener('click', handler);
    });
}

// Enforce limits by disabling unchecked checkboxes when limit reached
function enforceAcademicLimit() {
    const boxes = Array.from(document.querySelectorAll('input[name="academicElectives"]'));
    const checked = boxes.filter(b => b.checked).length;
    if (checked >= 2) {
        boxes.forEach(b => { if (!b.checked) b.disabled = true; });
    } else {
        boxes.forEach(b => b.disabled = false);
    }
}

function enforceTechProLimit() {
    const boxes = Array.from(document.querySelectorAll('input[name="techproElectives"]'));
    const checked = boxes.filter(b => b.checked).length;
    if (checked >= 1) {
        boxes.forEach(b => { if (!b.checked) b.disabled = true; });
    } else {
        boxes.forEach(b => b.disabled = false);
    }
}

function enforceDoorwayLimits() {
    const acadBoxes = Array.from(document.querySelectorAll('input[name="doorwayAcademic"]'));
    const techBoxes = Array.from(document.querySelectorAll('input[name="doorwayTechPro"]'));
    const acadChecked = acadBoxes.filter(b => b.checked).length;
    const techChecked = techBoxes.filter(b => b.checked).length;

    if (acadChecked >= 1) acadBoxes.forEach(b => { if (!b.checked) b.disabled = true; }); else acadBoxes.forEach(b => b.disabled = false);
    if (techChecked >= 1) techBoxes.forEach(b => { if (!b.checked) b.disabled = true; }); else techBoxes.forEach(b => b.disabled = false);
}

// Permanent address sync
function copyCurrentToPermanentAddress() {
    const country = document.getElementById('currentCountry').value;
    const province = document.getElementById('currentProvince').value;
    const municipality = document.getElementById('currentMunicipality').value;
    const barangay = document.getElementById('currentBarangay').value;

    // Copy sitio and zipcode
    document.getElementById('permanentSitio').value = document.getElementById('currentSitio').value;
    document.getElementById('permanentZipCode').value = document.getElementById('currentZipCode').value;

    // Set country dropdown
    document.getElementById('permanentCountry').value = country;
    updateAddressDropdowns('permanent', country);

    // Wait for province to be populated, then set it
    setTimeout(() => {
        document.getElementById('permanentProvince').value = province;
        updateAddressMunicipalities('permanent', country, province);

        // Wait for municipality to be populated, then set it
        setTimeout(() => {
            document.getElementById('permanentMunicipality').value = municipality;
            updateAddressBarangays('permanent', country, province, municipality);

            // Wait for barangay to be populated, then set it
            setTimeout(() => {
                document.getElementById('permanentBarangay').value = barangay;
            }, 50);
        }, 50);
    }, 50);
}

// Form validation
function setupFormValidation() {
    document.getElementById('submitBtn').addEventListener('click', validateAndSubmit);
}

function validateAndSubmit(e) {
    e.preventDefault();
    console.log('[ENROLLMENT] validateAndSubmit called');

    // First, validate all required fields
    const requiredFields = document.querySelectorAll('[required]');
    let hasError = false;
    
    requiredFields.forEach(field => {
        if (field.type === 'checkbox' || field.type === 'radio') {
            // For checkboxes and radios, check if at least one in the group is selected
            const groupName = field.name;
            const isGroupValid = document.querySelector(`input[name="${groupName}"]:checked`);
            if (!isGroupValid) {
                hasError = true;
                field.classList.add('error');
            } else {
                field.classList.remove('error');
            }
        } else {
            // For other input types
            if (!field.value || field.value.trim() === '') {
                hasError = true;
                field.classList.add('error');
                field.style.borderColor = '#dc3545';
            } else {
                field.classList.remove('error');
                field.style.borderColor = '';
            }
        }
    });

    if (hasError) {
        showNotification('Please fill in all required fields');
        return;
    }

    // Check LRN validation if "Yes" is selected
    const hasLRNYes = document.querySelector('input[name="hasLRN"][value="yes"]:checked');
    if (hasLRNYes) {
        const lrnValue = document.getElementById('lrnNumber').value.trim();
        console.log('[ENROLLMENT] hasLRN selected, LRN value:', lrnValue);
        if (!lrnValue) {
            showNotification('Please enter your LRN number');
            return;
        }
        // Validate LRN format
        const lrnValid = validateLRN();
        console.log('[ENROLLMENT] validateLRN result:', lrnValid);
        if (!lrnValid) {
            showNotification('Please correct your LRN. It must be exactly 12 digits with only numbers.');
            return;
        }
    }

    // Check certification
    if (!document.getElementById('certificationCheckbox').checked) {
        showNotification('You must agree to the certification agreement');
        return;
    }

    // Check data privacy
    if (!document.getElementById('dataPrivacyCheckbox').checked) {
        showNotification('You must agree to the data privacy agreement');
        return;
    }

    // Check electives for senior high
    const gradeLevel = document.getElementById('gradeLevel').value;
    if (gradeLevel === '11' || gradeLevel === '12') {
        const track = document.getElementById('track').value;
        if (!track) {
            showNotification('Please select a track');
            return;
        }

        // Validate electives based on track
        if (track === 'academic') {
            const selected = document.querySelectorAll('input[name="academicElectives"]:checked').length;
            if (selected === 0) {
                showNotification('Please select at least 1 academic elective');
                return;
            }
        } else if (track === 'techpro') {
            const selected = document.querySelectorAll('input[name="techproElectives"]:checked').length;
            if (selected === 0) {
                showNotification('Please select 1 Tech-Pro elective');
                return;
            }
        } else if (track === 'doorway') {
            const academicSelected = document.querySelectorAll('input[name="doorwayAcademic"]:checked').length;
            const techProSelected = document.querySelectorAll('input[name="doorwayTechPro"]:checked').length;
            if (academicSelected === 0 || techProSelected === 0) {
                showNotification('Please select 1 academic elective and 1 Tech-Pro elective');
                return;
            }
        }
    }

    // Validate conditional fields
    // IP validation
    const isIPYes = document.querySelector('input[name="isIP"][value="yes"]:checked');
    if (isIPYes) {
        const ipGroup = document.getElementById('ipGroup').value;
        if (!ipGroup) {
            showNotification('Please select your IP group');
            return;
        }
        if (ipGroup === 'other') {
            const ipOtherText = document.getElementById('ipOtherText').value.trim();
            if (!ipOtherText) {
                showNotification('Please specify your IP group');
                return;
            }
        }
    }

    // 4Ps validation
    const is4PsYes = document.querySelector('input[name="is4Ps"][value="yes"]:checked');
    if (is4PsYes) {
        const householdID = document.getElementById('householdID').value.trim();
        if (!householdID) {
            showNotification('Please enter your 4Ps Household ID Number');
            return;
        }
    }

    // PWD (Disability) validation
    const hasPWDYes = document.querySelector('input[name="hasPWD"][value="yes"]:checked');
    if (hasPWDYes) {
        const disabilityChecked = document.querySelectorAll('input[name="disability"]:checked').length;
        if (disabilityChecked === 0) {
            showNotification('Please select at least one disability type');
            return;
        }
    }

    // Returning Learner validation
    const isReturningYes = document.querySelector('input[name="returningLearner"][value="yes"]:checked');
    if (isReturningYes) {
        const lastGradeLevel = document.getElementById('lastGradeLevel').value;
        const lastSchoolYear = (document.getElementById('lastSchoolYear').value || '').trim();
        const lastSchoolAttended = (document.getElementById('lastSchoolAttended').value || '').trim();
        
        if (!lastGradeLevel || lastGradeLevel === '') {
            showNotification('Please select your last grade level');
            return;
        }
        if (!lastSchoolYear) {
            showNotification('Please enter your last school year');
            return;
        }
        if (!lastSchoolAttended) {
            showNotification('Please enter the name of the school you last attended');
            return;
        }
    }

    // Show review modal
    console.log('[ENROLLMENT] Validation passed — calling showReviewModal');
    showReviewModal();
}

// Modal functions
function setupModal() {
    // Select the modal-close button specifically within the reviewModal
    const reviewModalCloseBtn = document.querySelector('#reviewModal .modal-close');
    if (reviewModalCloseBtn) {
        reviewModalCloseBtn.addEventListener('click', closeReviewModal);
    }
    
    const editBtn = document.getElementById('editBtn');
    if (editBtn) {
        editBtn.addEventListener('click', closeReviewModal);
    }
    
    const confirmBtn = document.getElementById('confirmBtn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', submitEnrollment);
    }
}

function showReviewModal() {
    console.log('[ENROLLMENT] showReviewModal called');
    try {
        const formData = collectFormData();
        const summaryHTML = generateSummaryHTML(formData);
        const summaryEl = document.getElementById('enrollmentSummary');
        if (summaryEl) {
            summaryEl.innerHTML = summaryHTML;
        } else {
            console.error('[ENROLLMENT] enrollmentSummary element missing');
        }
    } catch (error) {
        console.error('[ENROLLMENT] Error generating summary:', error);
        const summaryEl = document.getElementById('enrollmentSummary');
        if (summaryEl) summaryEl.innerHTML = '<p>Review modal loaded. Please click Confirm and Submit to continue.</p>';
    }

    // Populate document previews inside the review modal
    try {
        populateReviewDocuments();
    } catch (err) {
        console.error('[ENROLLMENT] populateReviewDocuments error:', err);
    }

    // Try to find and activate the modal. Use fallback to set display if class toggle doesn't work.
    let reviewModal = document.getElementById('reviewModal');
    if (!reviewModal) reviewModal = document.querySelector('#reviewModal');
    console.log('[ENROLLMENT] reviewModal present:', !!reviewModal);
    if (reviewModal) {
        try {
            reviewModal.classList.add('active');
            // Ensure visible even if CSS class is overridden
            reviewModal.style.display = 'flex';
            // Prevent background scroll
            document.body.style.overflow = 'hidden';
        } catch (e) {
            console.error('[ENROLLMENT] Could not activate reviewModal:', e);
        }
    } else {
        console.error('[ENROLLMENT] Review modal element not found');
    }
}

function closeReviewModal() {
    const reviewModal = document.getElementById('reviewModal');
    if (!reviewModal) return;

    // Remove active class and hide the modal (also clear any inline display)
    reviewModal.classList.remove('active');
    try {
        reviewModal.style.display = 'none';
    } catch (e) {}

    // Restore document scroll
    try { document.body.style.overflow = ''; } catch (e) {}

    // Return focus to the first form control for accessibility
    const firstControl = document.querySelector('#enrollmentForm input, #enrollmentForm select, #enrollmentForm textarea');
    if (firstControl) firstControl.focus();
}

function collectFormData() {
    const formData = new FormData(document.getElementById('enrollmentForm'));
    const data = Object.fromEntries(formData);

    // Handle arrays
    data.disabilities = [];
    document.querySelectorAll('input[name="disability"]:checked').forEach(cb => {
        data.disabilities.push(cb.value);
    });

    data.academicElectives = [];
    document.querySelectorAll('input[name="academicElectives"]:checked').forEach(cb => {
        data.academicElectives.push(cb.value);
    });

    data.techproElectives = [];
    document.querySelectorAll('input[name="techproElectives"]:checked').forEach(cb => {
        data.techproElectives.push(cb.value);
    });

    data.doorwayAcademic = [];
    document.querySelectorAll('input[name="doorwayAcademic"]:checked').forEach(cb => {
        data.doorwayAcademic.push(cb.value);
    });

    data.doorwayTechPro = [];
    document.querySelectorAll('input[name="doorwayTechPro"]:checked').forEach(cb => {
        data.doorwayTechPro.push(cb.value);
    });

    data.learningModalities = [];
    document.querySelectorAll('input[name="learningModality"]:checked').forEach(cb => {
        data.learningModalities.push(cb.value);
    });
    data.learningModality = data.learningModalities.length > 0 ? data.learningModalities.join(', ') : null;

    // Capture explicit checkbox states for agreement checkboxes
    const certEl = document.getElementById('certificationCheckbox');
    const privacyEl = document.getElementById('dataPrivacyCheckbox');
    data.certification = certEl ? certEl.checked : false;
    data.dataPrivacy = privacyEl ? privacyEl.checked : false;

    return data;
}

function generateSummaryHTML(data) {
    // Helper to safely uppercase values
    const U = v => (v || '').toString().toUpperCase();
    const Ujoin = arr => (arr && arr.length ? arr.map(x => x.toString().toUpperCase()).join(', ') : 'NOT PROVIDED');
    const formatValue = v => (v && v !== '' ? U(v) : 'NOT PROVIDED');

    let html = '';

    // LRN Information
    html += `<div class="summary-section">
        <h3>LEARNER REFERENCE NUMBER (LRN)</h3>
        <div class="summary-item">
            <span class="summary-item-label">Has LRN:</span>
            <span class="summary-item-value">${U(data.hasLRN)}</span>
        </div>`;
    if (data.hasLRN === 'yes') {
        html += `<div class="summary-item">
            <span class="summary-item-label">LRN NUMBER:</span>
            <span class="summary-item-value">${formatValue(data.lrn)}</span>
        </div>`;
    }
    html += `</div>`;

    // Learner Information
    html += `<div class="summary-section">
        <h3>LEARNER INFORMATION</h3>
        <div class="summary-item">
            <span class="summary-item-label">FULL NAME:</span>
            <span class="summary-item-value">${U(data.firstName)} ${U(data.middleName)} ${U(data.lastName)} ${U(data.extensionName)}</span>
        </div>
        <div class="summary-item">
            <span class="summary-item-label">BIRTHDATE:</span>
            <span class="summary-item-value">${formatValue(data.birthdate)}</span>
        </div>
        <div class="summary-item">
            <span class="summary-item-label">AGE:</span>
            <span class="summary-item-value">${formatValue(data.age)}</span>
        </div>
        <div class="summary-item">
            <span class="summary-item-label">SEX:</span>
            <span class="summary-item-value">${formatValue(data.sex)}</span>
        </div>
        <div class="summary-item">
            <span class="summary-item-label">PLACE OF BIRTH:</span>
            <span class="summary-item-value">${formatValue(data.placeOfBirth)}</span>
        </div>
        <div class="summary-item">
            <span class="summary-item-label">MOTHER TONGUE:</span>
            <span class="summary-item-value">${formatValue(data.motherTongue)}</span>
        </div>`;
    if (data.motherTongue === 'other' && data.motherTongueOtherText) {
        html += `<div class="summary-item">
            <span class="summary-item-label">OTHER LANGUAGE:</span>
            <span class="summary-item-value">${formatValue(data.motherTongueOtherText)}</span>
        </div>`;
    }
    html += `</div>`;

    // IP Information
    html += `<div class="summary-section">
        <h3>INDIGENOUS PEOPLE (IP)</h3>
        <div class="summary-item">
            <span class="summary-item-label">IS INDIGENOUS PERSON:</span>
            <span class="summary-item-value">${U(data.isIP)}</span>
        </div>`;
    if (data.isIP === 'yes') {
        html += `<div class="summary-item">
            <span class="summary-item-label">IP GROUP:</span>
            <span class="summary-item-value">${formatValue(data.ipGroup)}</span>
        </div>`;
        if (data.ipGroup === 'other' && data.ipOtherText) {
            html += `<div class="summary-item">
                <span class="summary-item-label">OTHER GROUP:</span>
                <span class="summary-item-value">${formatValue(data.ipOtherText)}</span>
            </div>`;
        }
    }
    html += `</div>`;

    // 4Ps Information
    html += `<div class="summary-section">
        <h3>4PS BENEFICIARY</h3>
        <div class="summary-item">
            <span class="summary-item-label">IS 4PS BENEFICIARY:</span>
            <span class="summary-item-value">${U(data.is4Ps)}</span>
        </div>`;
    if (data.is4Ps === 'yes' && data.householdID) {
        html += `<div class="summary-item">
            <span class="summary-item-label">HOUSEHOLD ID:</span>
            <span class="summary-item-value">${formatValue(data.householdID)}</span>
        </div>`;
    }
    html += `</div>`;

    // Disability Information
    html += `<div class="summary-section">
        <h3>DISABILITY STATUS</h3>
        <div class="summary-item">
            <span class="summary-item-label">HAS DISABILITY:</span>
            <span class="summary-item-value">${U(data.hasPWD)}</span>
        </div>`;
    if (data.hasPWD === 'yes' && data.disabilities && data.disabilities.length > 0) {
        html += `<div class="summary-item">
            <span class="summary-item-label">DISABILITY TYPES:</span>
            <span class="summary-item-value">${Ujoin(data.disabilities)}</span>
        </div>`;
        if (data.disabilityDetails) {
            html += `<div class="summary-item">
                <span class="summary-item-label">ADDITIONAL DETAILS:</span>
                <span class="summary-item-value">${formatValue(data.disabilityDetails)}</span>
            </div>`;
        }
    }
    html += `</div>`;

    // Returning Learner Information
    html += `<div class="summary-section">
        <h3>RETURNING LEARNER / TRANSFEREE</h3>
        <div class="summary-item">
            <span class="summary-item-label">IS RETURNING LEARNER:</span>
            <span class="summary-item-value">${U(data.returningLearner)}</span>
        </div>`;
    if (data.returningLearner === 'yes') {
        html += `<div class="summary-item">
            <span class="summary-item-label">LAST GRADE LEVEL:</span>
            <span class="summary-item-value">${formatValue(data.lastGradeLevel)}</span>
        </div>
        <div class="summary-item">
            <span class="summary-item-label">LAST SCHOOL YEAR:</span>
            <span class="summary-item-value">${formatValue(data.lastSchoolYear)}</span>
        </div>
        <div class="summary-item">
            <span class="summary-item-label">LAST SCHOOL ATTENDED:</span>
            <span class="summary-item-value">${formatValue(data.lastSchoolAttended)}</span>
        </div>
        <div class="summary-item">
            <span class="summary-item-label">SCHOOL ID:</span>
            <span class="summary-item-value">${formatValue(data.schoolID)}</span>
        </div>`;
    }
    html += `</div>`;

    // Enrollment Details
    html += `<div class="summary-section">
        <h3>ENROLLMENT DETAILS</h3>
        <div class="summary-item">
            <span class="summary-item-label">GRADE LEVEL:</span>
            <span class="summary-item-value">${data.gradeLevel ? ('GRADE ' + U(data.gradeLevel)) : 'NOT PROVIDED'}</span>
        </div>`;

    if (data.gradeLevel === '11' || data.gradeLevel === '12') {
        html += `<div class="summary-item">
            <span class="summary-item-label">SEMESTER:</span>
            <span class="summary-item-value">${formatValue(data.semester)}</span>
        </div>
        <div class="summary-item">
            <span class="summary-item-label">TRACK:</span>
            <span class="summary-item-value">${formatValue(data.track)}</span>
        </div>`;

        if (data.track === 'academic' && data.academicElectives && data.academicElectives.length > 0) {
            html += `<div class="summary-item">
                <span class="summary-item-label">ACADEMIC ELECTIVES:</span>
                <span class="summary-item-value">${Ujoin(data.academicElectives)}</span>
            </div>`;
        } else if (data.track === 'techpro' && data.techproElectives && data.techproElectives.length > 0) {
            html += `<div class="summary-item">
                <span class="summary-item-label">TECH-PRO ELECTIVE:</span>
                <span class="summary-item-value">${Ujoin(data.techproElectives)}</span>
            </div>`;
        } else if (data.track === 'doorway') {
            if (data.doorwayAcademic && data.doorwayAcademic.length > 0) {
                html += `<div class="summary-item">
                    <span class="summary-item-label">ACADEMIC ELECTIVE:</span>
                    <span class="summary-item-value">${Ujoin(data.doorwayAcademic)}</span>
                </div>`;
            }
            if (data.doorwayTechPro && data.doorwayTechPro.length > 0) {
                html += `<div class="summary-item">
                    <span class="summary-item-label">TECH-PRO ELECTIVE:</span>
                    <span class="summary-item-value">${Ujoin(data.doorwayTechPro)}</span>
                </div>`;
            }
        }
    }
    html += `</div>`;

    // Current Address
    html += `<div class="summary-section">
        <h3>CURRENT ADDRESS</h3>
        <div class="summary-item">
            <span class="summary-item-label">STREET/SITIO:</span>
            <span class="summary-item-value">${formatValue(data.currentSitio)}</span>
        </div>
        <div class="summary-item">
            <span class="summary-item-label">COUNTRY:</span>
            <span class="summary-item-value">${formatValue(data.currentCountry)}</span>
        </div>
        <div class="summary-item">
            <span class="summary-item-label">PROVINCE:</span>
            <span class="summary-item-value">${formatValue(data.currentProvince)}</span>
        </div>
        <div class="summary-item">
            <span class="summary-item-label">MUNICIPALITY/CITY:</span>
            <span class="summary-item-value">${formatValue(data.currentMunicipality)}</span>
        </div>
        <div class="summary-item">
            <span class="summary-item-label">BARANGAY:</span>
            <span class="summary-item-value">${formatValue(data.currentBarangay)}</span>
        </div>
        <div class="summary-item">
            <span class="summary-item-label">ZIP CODE:</span>
            <span class="summary-item-value">${formatValue(data.currentZipCode)}</span>
        </div>
    </div>`;

    // Permanent Address
    html += `<div class="summary-section">
        <h3>PERMANENT ADDRESS</h3>
        <div class="summary-item">
            <span class="summary-item-label">SAME AS CURRENT:</span>
            <span class="summary-item-value">${data.sameAsCurrentAddress ? 'YES' : 'NO'}</span>
        </div>`;
    
    if (!data.sameAsCurrentAddress) {
        html += `<div class="summary-item">
            <span class="summary-item-label">STREET/SITIO:</span>
            <span class="summary-item-value">${formatValue(data.permanentSitio)}</span>
        </div>
        <div class="summary-item">
            <span class="summary-item-label">COUNTRY:</span>
            <span class="summary-item-value">${formatValue(data.permanentCountry)}</span>
        </div>
        <div class="summary-item">
            <span class="summary-item-label">PROVINCE:</span>
            <span class="summary-item-value">${formatValue(data.permanentProvince)}</span>
        </div>
        <div class="summary-item">
            <span class="summary-item-label">MUNICIPALITY/CITY:</span>
            <span class="summary-item-value">${formatValue(data.permanentMunicipality)}</span>
        </div>
        <div class="summary-item">
            <span class="summary-item-label">BARANGAY:</span>
            <span class="summary-item-value">${formatValue(data.permanentBarangay)}</span>
        </div>
        <div class="summary-item">
            <span class="summary-item-label">ZIP CODE:</span>
            <span class="summary-item-value">${formatValue(data.permanentZipCode)}</span>
        </div>`;
    }
    html += `</div>`;

    // Parent/Guardian Information
    html += `<div class="summary-section">
        <h3>PARENT/GUARDIAN INFORMATION</h3>`;
    
    if (data.fatherName || data.fatherContact) {
        html += `<div class="summary-item">
            <span class="summary-item-label">FATHER'S NAME:</span>
            <span class="summary-item-value">${formatValue(data.fatherName)}</span>
        </div>`;
        if (data.fatherContact) {
            html += `<div class="summary-item">
                <span class="summary-item-label">FATHER'S CONTACT:</span>
                <span class="summary-item-value">${formatValue(data.fatherContact)}</span>
            </div>`;
        }
    }

    if (data.motherMaidenName || data.motherContact) {
        html += `<div class="summary-item">
            <span class="summary-item-label">MOTHER'S MAIDEN NAME:</span>
            <span class="summary-item-value">${formatValue(data.motherMaidenName)}</span>
        </div>`;
        if (data.motherContact) {
            html += `<div class="summary-item">
                <span class="summary-item-label">MOTHER'S CONTACT:</span>
                <span class="summary-item-value">${formatValue(data.motherContact)}</span>
            </div>`;
        }
    }

    if (data.guardianName || data.guardianContact) {
        html += `<div class="summary-item">
            <span class="summary-item-label">GUARDIAN'S NAME:</span>
            <span class="summary-item-value">${formatValue(data.guardianName)}</span>
        </div>`;
        if (data.guardianContact) {
            html += `<div class="summary-item">
                <span class="summary-item-label">GUARDIAN'S CONTACT:</span>
                <span class="summary-item-value">${formatValue(data.guardianContact)}</span>
            </div>`;
        }
    }
    html += `</div>`;

    // Learning Modality
    html += `<div class="summary-section">
        <h3>LEARNING MODALITY</h3>
        <div class="summary-item">
            <span class="summary-item-label">PREFERRED MODALITY:</span>
            <span class="summary-item-value">${data.learningModalities && data.learningModalities.length ? Ujoin(data.learningModalities) : formatValue(data.learningModality)}</span>
        </div>
    </div>`;

    // Documents
    html += `<div class="summary-section">
        <h3>SUBMITTED DOCUMENTS</h3>
        <div id="reviewDocumentsContainer" class="review-documents"></div>
    </div>`;

    // Agreements
    html += `<div class="summary-section">
        <h3>AGREEMENTS</h3>
        <div class="summary-item">
            <span class="summary-item-label">CERTIFICATION AGREEMENT:</span>
            <span class="summary-item-value">${data.certification ? '✓ AGREED' : '✗ NOT AGREED'}</span>
        </div>
        <div class="summary-item">
            <span class="summary-item-label">DATA PRIVACY AGREEMENT:</span>
            <span class="summary-item-value">${data.dataPrivacy ? '✓ AGREED' : '✗ NOT AGREED'}</span>
        </div>
    </div>`;

    return html;
}

// Populate document previews inside the Review modal
function populateReviewDocuments() {
    const container = document.getElementById('reviewDocumentsContainer');
    if (!container) return;
    container.innerHTML = '';

    const filesToCheck = [
        {id: 'psaBirthCert', label: 'PSA Birth Certificate'},
        {id: 'reportCard', label: 'Report Card'},
        {id: 'studentImage', label: 'Student Image'}
    ];

    filesToCheck.forEach(item => {
        const input = document.getElementById(item.id);
        if (input && input.files && input.files[0]) {
            const file = input.files[0];
            const reader = new FileReader();
            reader.onload = function(e) {
                const wrapper = document.createElement('div');
                wrapper.className = 'document-preview-wrapper review';

                const img = document.createElement('img');
                img.src = e.target.result;
                img.className = 'document-preview-img';
                img.title = item.label + ' (Click to zoom)';
                img.style.cursor = 'pointer';
                img.addEventListener('click', function() {
                    openDocumentZoom(e.target.result, item.label.toUpperCase());
                });

                const label = document.createElement('div');
                label.className = 'review-doc-label';
                label.textContent = item.label.toUpperCase();

                wrapper.appendChild(img);
                wrapper.appendChild(label);
                container.appendChild(wrapper);
            };
            reader.readAsDataURL(file);
        }
    });
}

function submitEnrollment() {
    console.log('[ENROLLMENT] submitEnrollment called');
    const formElement = document.getElementById('enrollmentForm');
    const formData = collectFormData();
    const studentData = JSON.parse(localStorage.getItem('studentData') || '{}') || {};
    const teacherAssisted = isTeacherAssistedEnrollment();

    // When a student is logged in we normally use their id as the
    // enrollment "student_id".  However the stored profile may be stale
    // or belong to a different person (especially if someone else used the
    // same browser earlier).  If the names entered on the enrollment form
    // do not match the session data we fall back to a manual identifier so
    // that the enrollment is not accidentally attributed to the wrong
    // student record.
    let effectiveStudentId;
    if (!teacherAssisted && studentData.id) {
        const savedFirst = String(studentData.firstName || studentData.first_name || '').trim().toLowerCase();
        const savedLast = String(studentData.lastName || studentData.last_name || '').trim().toLowerCase();
        const formFirst = String(formData.firstName || '').trim().toLowerCase();
        const formLast = String(formData.lastName || '').trim().toLowerCase();

        if (formFirst && formLast && (formFirst !== savedFirst || formLast !== savedLast)) {
            // mismatch between form and logged‑in profile; drop the id so
            // backend will treat this as a new/anonymous student instead of
            // reusing a possibly unrelated record.
            effectiveStudentId = buildManualStudentIdentifier(formData);
        } else {
            effectiveStudentId = String(studentData.id);
        }
    } else {
        effectiveStudentId = studentData.id ? String(studentData.id) : buildManualStudentIdentifier(formData);
    }

    // if we are still using a logged‑in student id and the form provided a
    // different name, update the stored session so subsequent enrollments
    // and other pages will reflect the correct name.  this won't change the
    // id itself, we only overwrite the name fields that are shown elsewhere.
    if (studentData.id && formData.firstName && formData.lastName) {
        const existingFirst = String(studentData.firstName || studentData.first_name || '');
        const existingLast = String(studentData.lastName || studentData.last_name || '');
        if (formData.firstName !== existingFirst || formData.lastName !== existingLast) {
            studentData.firstName = formData.firstName;
            studentData.lastName = formData.lastName;
            localStorage.setItem('studentData', JSON.stringify(studentData));
        }
    }

    // Validate student is logged in
    if (!teacherAssisted && !studentData.id) {
        showNotification('Please log in first before submitting enrollment.');
        setTimeout(() => { window.location.href = withSchoolParam('auth.html?role=student'); }, 1500);
        return;
    }

    // Read optional files and convert to data URLs
    const fileInputs = ['psaBirthCert', 'reportCard', 'studentImage'];
    const filesData = {};

    const readFileAsDataURL = (file) => new Promise((resolve) => {
        if (!file) return resolve(null);
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
    });

    const filePromises = fileInputs.map(async id => {
        const input = document.getElementById(id);
        if (input && input.files && input.files[0]) {
            filesData[id] = await readFileAsDataURL(input.files[0]);
        } else {
            filesData[id] = null;
        }
    });

    Promise.all(filePromises).then(async () => {
        try {
            const latestActiveSchoolYear = await loadActiveSchoolYear();
            const activeSchoolYearId = Number(
                (latestActiveSchoolYear && latestActiveSchoolYear.id)
                || (window.activeSchoolYear && window.activeSchoolYear.id)
                || 0
            ) || null;

            // Map form field names to match backend API expectations
            // The backend expects individual field names, not nested enrollment_data object
            // --- PATCH: Ensure correct DB mapping for electives and school ID ---
            let selectedElectives = [];
            if (formData.academicElectives && formData.academicElectives.length) selectedElectives = formData.academicElectives;
            else if (formData.techproElectives && formData.techproElectives.length) selectedElectives = formData.techproElectives;
            else if (formData.doorwayAcademic && formData.doorwayAcademic.length) selectedElectives = formData.doorwayAcademic;
            else if (formData.doorwayTechPro && formData.doorwayTechPro.length) selectedElectives = formData.doorwayTechPro;

            const enrollmentPayload = {
                student_id: effectiveStudentId,
                // Grade & Track
                gradeLevel: formData.gradeLevel || null,
                semester: formData.semester === 'first' ? 'First' : (formData.semester === 'second' ? 'Second' : null),
                track: formData.track || null,
                // PATCH: Store electives in 'subjects' as comma-separated string (or null)
                subjects: selectedElectives.length ? selectedElectives.join(', ') : null,
                // PATCH: Store School ID in 'last_school_scid'
                last_school_scid: formData.schoolID || null,
                // Still include legacy fields for compatibility
                electives: selectedElectives,
                // Returning Learner
                returningLearner: formData.returningLearner || 'no',
                lastGradeLevel: formData.lastGradeLevel || null,
                lastSchoolYear: formData.lastSchoolYear || null,
                lastSchoolAttended: formData.lastSchoolAttended || null,
                schoolID: formData.schoolID || null,
                // LRN
                hasLRN: formData.hasLRN || 'no',
                lrn: formData.lrn || null,
                // Learner Information
                // include the submitted first/last name so the API can record
                // the learner's name directly (some backends ignore these when a
                // student_id is present, hence the earlier id-mismatch check).
                lastName: formData.lastName || '',
                firstName: formData.firstName || '',
                middleName: formData.middleName || '',
                extensionName: formData.extensionName || '',
                birthdate: formData.birthdate || null,
                age: formData.age || null,
                sex: formData.sex || '',
                placeOfBirth: formData.placeOfBirth || null,
                motherTongue: formData.motherTongue || null,
                motherTongueOtherText: formData.motherTongueOtherText || null,
                // Backwards-compatible key expected by admin dashboard/backend
                mother_tongue: formData.motherTongue || null,
                mother_tongue_other: formData.motherTongueOtherText || null,
                // IP Status
                isIP: formData.isIP || 'no',
                ipGroup: formData.ipGroup || null,
                ipOtherText: formData.ipOtherText || null,
                // 4Ps Status
                is4Ps: formData.is4Ps || 'no',
                householdID: formData.householdID || null,
                
                // Disability
                hasPWD: formData.hasPWD || 'no',
                disability: formData.disabilities || [],
                disabilityDetails: formData.disabilityDetails || null,
                
                // Current Address
                currentSitio: formData.currentSitio || null,
                currentCountry: formData.currentCountry || null,
                currentProvince: formData.currentProvince || null,
                currentMunicipality: formData.currentMunicipality || null,
                currentBarangay: formData.currentBarangay || null,
                currentZipCode: formData.currentZipCode || null,
                // Backwards-compatible keys for admin dashboard
                cu_address_sitio_street: formData.currentSitio || null,
                cu_address_barangay_id: formData.currentBarangay || null,
                cu_address_municipality_id: formData.currentMunicipality || null,
                cu_address_province_id: formData.currentProvince || null,
                cu_address_zip: formData.currentZipCode || null,
                
                // Permanent Address
                permanentSitio: formData.permanentSitio || null,
                permanentCountry: formData.permanentCountry || null,
                permanentProvince: formData.permanentProvince || null,
                permanentMunicipality: formData.permanentMunicipality || null,
                permanentBarangay: formData.permanentBarangay || null,
                permanentZipCode: formData.permanentZipCode || null,
                // Backwards-compatible keys for admin dashboard
                pe_address_sitio_street: formData.permanentSitio || null,
                pe_address_barangay_id: formData.permanentBarangay || null,
                pe_address_municipality_id: formData.permanentMunicipality || null,
                pe_address_province_id: formData.permanentProvince || null,
                pe_address_zip: formData.permanentZipCode || null,
                sameAsCurrentAddress: formData.sameAsCurrentAddress === 'on' || formData.sameAsCurrentAddress === 'yes' || false,
                
                // Parent/Guardian Information
                fatherName: formData.fatherName || null,
                fatherContact: formData.fatherContact || null,
                motherMaidenName: formData.motherMaidenName || null,
                motherContact: formData.motherContact || null,
                guardianName: formData.guardianName || null,
                guardianContact: formData.guardianContact || null,
                
                // Learning Modality
                learningModality: formData.learningModality || null,
                learningModalities: Array.isArray(formData.learningModalities) ? formData.learningModalities : [],
                
                // Certification & Data Privacy
                certification: formData.certification || false,
                dataPrivacy: formData.dataPrivacy || false,

                // Active school year context (backend still resolves authoritative active year)
                school_year_id: activeSchoolYearId,
                activeSchoolYearId: activeSchoolYearId,
                
                // File uploads (can be array of data URLs or null)
                enrollmentFiles: filesData
            };

            console.log('[ENROLLMENT] Prepared payload:', enrollmentPayload);

            // Submit to backend API
            const response = await fetch(`${API_BASE}/api/enrollments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(enrollmentPayload)
            });

            console.log('[ENROLLMENT] Response status:', response.status);
            const result = await response.json();
            console.log('[ENROLLMENT] Response body:', result);

            if (!response.ok) {
                const errorMsg = result.details || result.error || 'Unknown error';
                console.error('[ENROLLMENT] Error response:', errorMsg);
                showNotification('Enrollment submission failed: ' + errorMsg);
                return;
            }

            // Success - save to localStorage
            let enrollments = JSON.parse(localStorage.getItem('enrollments')) || [];
            
            const completeEnrollment = {
                enrollment_id: result.enrollment_id,
                student_id: effectiveStudentId,
                studentName: (enrollmentPayload.firstName || '') + ' ' + (enrollmentPayload.lastName || ''),
                status: 'Pending',
                enrollmentDate: new Date().toISOString(),
                submittedData: enrollmentPayload
            };
            
            enrollments.push(completeEnrollment);
            localStorage.setItem('enrollments', JSON.stringify(enrollments));

            // Mark student as having submitted an enrollment (student self-service flow only)
            if (!teacherAssisted) {
                studentData.hasEnrollment = true;
                studentData.enrollmentID = result.enrollment_id;
                localStorage.setItem('studentData', JSON.stringify(studentData));
            }

            // Broadcast creation to other tabs (admin dashboard listens for this key)
            localStorage.setItem('enrollmentCreated', JSON.stringify({
                id: result.enrollment_id,
                timestamp: Date.now()
            }));

            console.log('[ENROLLMENT] Success! Enrollment ID:', result.enrollment_id);
            showNotification('✅ Enrollment submitted successfully! Your enrollment ID is ' + result.enrollment_id);
            
            // Close modal and redirect after a delay
            closeReviewModal();
            setTimeout(() => {
                if (teacherAssisted) {
                    const returnPath = String(ENROLLMENT_ASSIST_CONTEXT.returnTo || '').trim();
                    window.location.href = withSchoolParam(returnPath || 'adviser-dashboard.html');
                } else {
                    window.location.href = withSchoolParam('student-dashboard.html');
                }
            }, 1500);
        } catch (err) {
            console.error('[ENROLLMENT] Submission error:', err);
            showNotification('Failed to submit enrollment: ' + err.message);
        }
    });
}

// Modern notification system
function showNotification(message) {
    const notification = document.getElementById('errorNotification');
    const messageElement = document.getElementById('notificationMessage');
    messageElement.textContent = message;
    notification.style.display = 'flex';
    notification.classList.add('show');
}

function closeNotification() {
    const notification = document.getElementById('errorNotification');
    notification.classList.remove('show');
    setTimeout(() => {
        notification.style.display = 'none';
    }, 300);
}

// Blur detection for student image
document.addEventListener('DOMContentLoaded', function() {
    const studentImageInput = document.getElementById('studentImage');
    const imagePreview = document.getElementById('imagePreview');
    const blurWarning = document.getElementById('blurWarning');

    if (studentImageInput) {
        studentImageInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(event) {
                    const img = new Image();
                    img.onload = function() {
                        // Show preview
                        imagePreview.innerHTML = '';
                        const preview = document.createElement('img');
                        preview.src = event.target.result;
                        preview.style.maxWidth = '200px';
                        preview.style.marginTop = '10px';
                        preview.style.borderRadius = '4px';
                        imagePreview.appendChild(preview);

                        // Detect blur using Laplacian variance
                        const isBlurry = detectBlur(img);
                        
                        if (isBlurry) {
                            blurWarning.style.display = 'block';
                            // Clear the input to force user to select again
                            studentImageInput.value = '';
                        } else {
                            blurWarning.style.display = 'none';
                        }
                    };
                    img.src = event.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }
});

// Laplacian blur detection algorithm
function detectBlur(img) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Convert to grayscale
    const gray = [];
    for (let i = 0; i < data.length; i += 4) {
        gray.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    }

    // Apply Laplacian kernel
    const width = canvas.width;
    const height = canvas.height;
    let laplacianSum = 0;
    let count = 0;

    const laplacianKernel = [
        [0, -1, 0],
        [-1, 4, -1],
        [0, -1, 0]
    ];

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            let sum = 0;
            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    const idx = (y + ky) * width + (x + kx);
                    sum += gray[idx] * laplacianKernel[ky + 1][kx + 1];
                }
            }
            laplacianSum += sum * sum;
            count++;
        }
    }

    // Calculate variance
    const laplacianVariance = laplacianSum / count;
    
    // Threshold for blur detection (lower variance = more blurry)
    // Threshold is set to ~100 - adjust if needed
    const blurThreshold = 100;
    
    return laplacianVariance < blurThreshold;
}

// Zoom functionality for document viewer
let currentZoom = 100;
const maxZoom = 300;
const minZoom = 50;
const zoomStep = 25;

function openDocumentZoom(imageSrc, title) {
    const modal = document.getElementById('documentZoomModal');
    const img = document.getElementById('zoomImage');
    const titleElement = document.getElementById('zoomTitle');
    
    img.src = imageSrc;
    titleElement.textContent = title || 'Document Preview';
    currentZoom = 100;
    updateZoomDisplay();
    
    modal.classList.add('show');
    modal.style.display = 'flex';
}

function closeDocumentZoom() {
    const modal = document.getElementById('documentZoomModal');
    modal.classList.remove('show');
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
}

function zoomIn() {
    if (currentZoom < maxZoom) {
        currentZoom += zoomStep;
        updateZoomDisplay();
    }
}

function zoomOut() {
    if (currentZoom > minZoom) {
        currentZoom -= zoomStep;
        updateZoomDisplay();
    }
}

function resetZoom() {
    currentZoom = 100;
    updateZoomDisplay();
}

function updateZoomDisplay() {
    const img = document.getElementById('zoomImage');
    const percentageSpan = document.getElementById('zoomPercentage');
    
    img.style.transform = `scale(${currentZoom / 100})`;
    percentageSpan.textContent = currentZoom + '%';
}

// Enhanced document preview with zoom capability
document.addEventListener('DOMContentLoaded', function() {
    // Handle all file inputs with document previews
    const fileInputs = document.querySelectorAll('input[type="file"][data-preview-id]');
    
    fileInputs.forEach(input => {
        input.addEventListener('change', function(e) {
            const file = e.target.files[0];
            const previewId = input.getAttribute('data-preview-id');
            const previewContainer = document.getElementById(previewId);
            
            if (file) {
                const reader = new FileReader();
                reader.onload = function(event) {
                    previewContainer.innerHTML = '';
                    
                    const previewWrapper = document.createElement('div');
                    previewWrapper.className = 'document-preview-wrapper';
                    
                    const preview = document.createElement('img');
                    preview.src = event.target.result;
                    preview.className = 'document-preview-img';
                    preview.style.cursor = 'pointer';
                    preview.title = 'Click to zoom';
                    
                    // Open zoom viewer on click
                    preview.addEventListener('click', function() {
                        const label = input.previousElementSibling?.textContent || 'Document';
                        openDocumentZoom(event.target.result, label);
                    });
                    
                    const removeBtn = document.createElement('button');
                    removeBtn.className = 'remove-preview-btn';
                    removeBtn.innerHTML = '✕';
                    removeBtn.type = 'button';
                    removeBtn.title = 'Remove';
                    removeBtn.addEventListener('click', function(e) {
                        e.preventDefault();
                        previewContainer.innerHTML = '';
                        input.value = '';
                    });
                    
                    previewWrapper.appendChild(preview);
                    previewWrapper.appendChild(removeBtn);
                    previewContainer.appendChild(previewWrapper);
                };
                reader.readAsDataURL(file);
            }
        });
    });
    
    // Close modal on ESC key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const modal = document.getElementById('documentZoomModal');
            if (modal.style.display === 'flex') {
                closeDocumentZoom();
            }
        }
    });
    
    // Close modal when clicking outside
    const zoomModal = document.getElementById('documentZoomModal');
    if (zoomModal) {
        zoomModal.addEventListener('click', function(e) {
            if (e.target === zoomModal) {
                closeDocumentZoom();
            }
        });
    }
});

// Prevent duplicate enrollment submissions on form page
function normalizeEnrollmentPayload(payload) {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.data)) return payload.data;
    if (payload && payload.enrollment) return [payload.enrollment];
    if (payload && payload.item) return [payload.item];
    return [];
}

function getStudentIdentitySetForEnrollment(studentData = {}) {
    const identitySet = new Set();
    [
        studentData.id,
        studentData.student_id,
        studentData.studentID,
        studentData.lrn,
        studentData.email
    ].forEach((value) => {
        const normalized = String(value || '').trim();
        if (normalized) identitySet.add(normalized);
    });
    return identitySet;
}

function findEnrollmentForStudent(studentData = {}, enrollments = []) {
    const identitySet = getStudentIdentitySetForEnrollment(studentData);
    const enrollmentId = String(studentData.enrollmentID || studentData.enrollment_id || '').trim();

    return (enrollments || []).find((entry) => {
        const candidateIds = [
            entry && entry.student_id,
            entry && entry.studentID,
            entry && entry.studentId,
            entry && entry.id,
            entry && entry.enrollment_id
        ]
            .map((value) => String(value || '').trim())
            .filter(Boolean);

        const hasStudentMatch = candidateIds.some((candidate) => identitySet.has(candidate));
        const hasEnrollmentIdMatch = enrollmentId && candidateIds.includes(enrollmentId);
        return hasStudentMatch || hasEnrollmentIdMatch;
    }) || null;
}

function getActiveSchoolYearMetaForEnrollmentForm() {
    let active = window.activeSchoolYear;
    if (!active) {
        try {
            active = JSON.parse(localStorage.getItem('activeSchoolYear') || 'null');
        } catch (_err) {
            active = null;
        }
    }

    return {
        id: String((active && (active.id || active.school_year_id || active.schoolYearId || active.activeSchoolYearId)) || '').trim(),
        name: String((active && (active.school_year || active.schoolYear || active.name)) || '').trim().toLowerCase()
    };
}

function getEnrollmentSchoolYearMetaForEnrollmentForm(entry = {}) {
    const data = safeParseObject(entry && entry.enrollment_data);

    const idCandidates = [
        entry && entry.school_year_id,
        entry && entry.schoolYearId,
        entry && entry.activeSchoolYearId,
        entry && entry.school_year && entry.school_year.id,
        data.school_year_id,
        data.schoolYearId,
        data.activeSchoolYearId,
        data.school_year && data.school_year.id
    ]
        .map((value) => String(value || '').trim())
        .filter(Boolean);

    const nameCandidates = [
        entry && entry.school_year_name,
        entry && entry.school_year && entry.school_year.school_year,
        entry && entry.school_year,
        entry && entry.schoolYear,
        data.school_year_name,
        data.school_year,
        data.schoolYear,
        data.lastSchoolYear,
        entry && entry.lastSchoolYear
    ]
        .map((value) => String(value || '').trim().toLowerCase())
        .filter(Boolean);

    return {
        ids: new Set(idCandidates),
        names: new Set(nameCandidates)
    };
}

function isEnrollmentInActiveSchoolYear(entry, activeMeta = null) {
    const active = activeMeta || getActiveSchoolYearMetaForEnrollmentForm();
    if (!active.id && !active.name) return false;

    const enrollmentMeta = getEnrollmentSchoolYearMetaForEnrollmentForm(entry);
    const byId = !!(active.id && enrollmentMeta.ids.has(active.id));
    const byName = !!(active.name && enrollmentMeta.names.has(active.name));
    return byId || byName;
}

async function ensureActiveSchoolYearMetaForEnrollmentForm() {
    let activeMeta = getActiveSchoolYearMetaForEnrollmentForm();
    if (activeMeta.id || activeMeta.name) return activeMeta;

    try {
        const response = await fetch(`${API_BASE}/api/school-years/active`, { cache: 'no-store' });
        if (response.ok) {
            const active = await response.json();
            if (active) {
                window.activeSchoolYear = active;
                localStorage.setItem('activeSchoolYear', JSON.stringify(active));
                activeMeta = getActiveSchoolYearMetaForEnrollmentForm();
            }
        }
    } catch (_err) {
    }

    return activeMeta;
}

async function hasExistingEnrollmentRecord(studentData = {}) {
    const activeMeta = await ensureActiveSchoolYearMetaForEnrollmentForm();

    if (!studentData || !studentData.id) {
        return false;
    }

    try {
        const response = await fetch(`${API_BASE}/api/enrollments/student/${studentData.id}`);
        if (response.ok) {
            const payload = await response.json();
            const enrollments = normalizeEnrollmentPayload(payload);
            const studentEnrollmentRows = Array.isArray(enrollments)
                ? enrollments.filter((entry) => {
                    const candidate = findEnrollmentForStudent(studentData, [entry]);
                    return !!candidate;
                })
                : [];

            const existing = studentEnrollmentRows.find((entry) => isEnrollmentInActiveSchoolYear(entry, activeMeta)) || null;

            if (existing) {
                const nextStudentData = {
                    ...studentData,
                    hasEnrollment: true,
                    enrollmentID: existing.enrollment_id || existing.id || studentData.enrollmentID
                };
                localStorage.setItem('studentData', JSON.stringify(nextStudentData));
                return true;
            }
        }
    } catch (_err) {
    }

    const localEnrollments = JSON.parse(localStorage.getItem('enrollments')) || [];
    const localStudentEnrollmentRows = Array.isArray(localEnrollments)
        ? localEnrollments.filter((entry) => {
            const candidate = findEnrollmentForStudent(studentData, [entry]);
            return !!candidate;
        })
        : [];

    return localStudentEnrollmentRows.some((entry) => isEnrollmentInActiveSchoolYear(entry, activeMeta));
}

document.addEventListener('DOMContentLoaded', async function() {
    const enrollmentForm = document.getElementById('enrollmentForm');
    if (!enrollmentForm) return;

    if (isTeacherAssistedEnrollment()) {
        return;
    }

    const studentData = JSON.parse(localStorage.getItem('studentData')) || {};
    const alreadySubmitted = await hasExistingEnrollmentRecord(studentData);
    if (!alreadySubmitted) return;

    showNotification('You have already submitted an enrollment. Redirecting to Dashboard to view status...');

    const confirmBtn = document.getElementById('confirmBtn');
    if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Already Submitted';
    }

    Array.from(enrollmentForm.elements).forEach(el => {
        if (el.id !== 'editBtn' && el.id !== 'confirmBtn') el.disabled = true;
    });

    setTimeout(() => {
        window.location.href = withSchoolParam('student-dashboard.html');
    }, 900);
});



