let activeSchoolCode = '';

function detectSchoolCode() {
    try {
        const existing = new URLSearchParams(window.location.search || '');
        let existingSchool = String(existing.get('school') || '').trim().toLowerCase();
        if (/^\d+$/.test(existingSchool)) { existingSchool = ''; existing.delete('school'); }
        if (!existingSchool) {
          let derived = existingSchool;
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
    if (!activeSchoolCode) return path;
    try {
        const url = new URL(path, window.location.origin);
        url.searchParams.set('school', activeSchoolCode);
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

function applySchoolTheme(branding) {
    const theme = branding && typeof branding === 'object' ? branding : {};
    const root = document.documentElement;
    const primary = String(theme.primary || theme.brand700 || '').trim();
    const secondary = String(theme.secondary || theme.brand600 || '').trim();
    if (primary) root.style.setProperty('--primary-green', primary);
    if (secondary) root.style.setProperty('--primary-dark-green', secondary);
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
            if (activeSchoolCode) {
                localStorage.setItem('sms.selectedSchoolCode', activeSchoolCode);
                localStorage.setItem('sms.selectedTenantCode', activeSchoolCode);
            }
        } else {
            activeSchoolCode = detected;
        }
        if (school.id) {
            localStorage.setItem('sms.selectedSchoolId', String(school.id));
            localStorage.setItem('sms.selectedTenantId', String(school.id));
        }

        const schoolName = String(school.name || 'School Management System');
        const logo = String(school.logoData || '').trim();

        document.title = `${schoolName} - Student Login`;

        const schoolNameNode = document.getElementById('schoolName');
        if (schoolNameNode) schoolNameNode.textContent = schoolName;

        const schoolTaglineNode = document.getElementById('schoolTagline');
        if (schoolTaglineNode) {
            const tagline = String((school.branding && school.branding.pageContent && school.branding.pageContent.heroTagline) || '').trim();
            if (tagline) schoolTaglineNode.textContent = tagline;
        }

        const schoolLogoNode = document.getElementById('schoolLogo');
        if (schoolLogoNode) {
            schoolLogoNode.setAttribute('alt', `${schoolName} Logo`);
            schoolLogoNode.setAttribute('src', logo || 'logo.png');
            schoolLogoNode.onerror = () => {
                schoolLogoNode.onerror = null;
                schoolLogoNode.setAttribute('src', 'logo.png');
            };
        }

        const copyrightNode = document.getElementById('schoolCopyright');
        if (copyrightNode) {
            const year = new Date().getFullYear();
            copyrightNode.textContent = `© ${year} ${schoolName}. All rights reserved.`;
        }

        setSchoolFavicon(logo || '', activeSchoolCode);
        applySchoolTheme(school.branding || {});
        appendSchoolParamToLinks(activeSchoolCode);
    } catch (_err) {
    }
}

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

// Tab switching functionality
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;
        
        // Remove active class from all tabs and forms
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        
        // Add active class to clicked tab and corresponding form
        btn.classList.add('active');
        document.getElementById(tabName + 'Form').classList.add('active');
    });
});

// Toggle between login and register via links
document.querySelectorAll('.toggle-form').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const tabName = link.dataset.tab;
        const tabBtn = document.querySelector(`[data-tab="${tabName}"]`);
        tabBtn.click();
    });
});

// Backend origin (where Express API runs)
// Dynamically use the current origin (hostname:port) where the page is served
const BACKEND_ORIGIN = window.location.origin;
// Base API URL: use backend origin
const API_BASE = BACKEND_ORIGIN;

function showLoginFormMessage(message) {
    const loginForm = document.getElementById('loginForm');
    if (!loginForm) return;

    let messageNode = loginForm.querySelector('[data-role="login-status-message"]');
    if (!messageNode) {
        messageNode = document.createElement('p');
        messageNode.className = 'form-subtitle';
        messageNode.setAttribute('data-role', 'login-status-message');

        const subtitle = loginForm.querySelector('.form-subtitle');
        if (subtitle) {
            subtitle.insertAdjacentElement('afterend', messageNode);
        } else {
            loginForm.prepend(messageNode);
        }
    }

    messageNode.textContent = message;
}

function ensureSuccessModal() {
    let overlay = document.getElementById('registrationSuccessModal');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'registrationSuccessModal';
    overlay.className = 'success-modal-overlay';
    overlay.innerHTML = `
        <div class="success-modal" role="dialog" aria-modal="true" aria-labelledby="successModalTitle">
            <div class="success-modal-header" id="successModalTitle">Success</div>
            <div class="success-modal-body" data-role="success-modal-message"></div>
            <div class="success-modal-actions">
                <button type="button" class="btn btn-primary" data-role="success-modal-ok">OK</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
}

function showSuccessModal(message) {
    const overlay = ensureSuccessModal();
    const messageNode = overlay.querySelector('[data-role="success-modal-message"]');
    const okButton = overlay.querySelector('[data-role="success-modal-ok"]');
    if (messageNode) messageNode.textContent = message;

    return new Promise((resolve) => {
        const closeModal = () => {
            overlay.classList.remove('is-open');
            overlay.removeEventListener('click', onOverlayClick);
            document.removeEventListener('keydown', onKeyDown);
            if (okButton) okButton.removeEventListener('click', closeModal);
            resolve();
        };

        const onOverlayClick = (event) => {
            if (event.target === overlay) closeModal();
        };

        const onKeyDown = (event) => {
            if (event.key === 'Escape' || event.key === 'Enter') closeModal();
        };

        overlay.addEventListener('click', onOverlayClick);
        document.addEventListener('keydown', onKeyDown);
        if (okButton) okButton.addEventListener('click', closeModal);
        overlay.classList.add('is-open');

        setTimeout(() => {
            if (okButton) okButton.focus();
        }, 0);
    });
}

// Login Form Submission
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const rememberMe = document.querySelector('input[name="remember"]').checked;
    
    // Basic validation
    if (!email || !password) {
        alert('Please fill in all fields');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || 'Login failed');
            return;
        }

        // Clear enrollment-related caches from previous sessions/users
        localStorage.removeItem('enrollments');
        localStorage.removeItem('studentGrades');
        localStorage.removeItem('studentSchedule');
        localStorage.removeItem('studentAnnouncements');
        localStorage.removeItem('studentTasks');

        // Store student data in localStorage
        const studentData = {
            id: data.student.id,
            email: data.student.email,
            firstName: data.student.firstName,
            lastName: data.student.lastName,
            studentID: data.student.student_id,            lrn: data.student.lrn || null,            gradeLevel: data.student.gradeLevel,
            phone: data.student.phone,
            birthdate: data.student.birthdate,
            gender: data.student.gender,
            address: data.student.address,
            placeOfBirth: data.student.placeOfBirth,
            role: 'student',
            loginTime: new Date().toISOString()
        };

        localStorage.setItem('studentData', JSON.stringify(studentData));

        if (rememberMe) {
            localStorage.setItem('studentEmail', email);
        }

        // Redirect to dashboard
        window.location.href = withSchoolParam('student-dashboard.html?refresh=' + Date.now());
    } catch (err) {
        console.error('Login error:', err);
        alert('Login failed. Please try again.');
    }
});

// Registration Form Submission
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const firstName = document.getElementById('regFirstName').value;
    const lastName = document.getElementById('regLastName').value;
    const email = document.getElementById('regEmail').value;
    const studentIDRaw = document.getElementById('regStudentID').value;
    const studentID = String(studentIDRaw || '').trim();
    const gradeLevel = 'Unspecified';
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;
    const agreeTerms = document.querySelector('input[name="agreeTerms"]').checked;
    
    // Validation
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
        alert('Please fill in all required fields');
        return;
    }
    
    if (password.length < 8) {
        alert('Password must be at least 8 characters');
        return;
    }
    
    if (password !== confirmPassword) {
        alert('Passwords do not match');
        return;
    }
    
    if (!agreeTerms) {
        alert('Please agree to the terms and conditions');
        return;
    }

    // LRN is optional, but if provided it must be exactly 12 digits
    if (studentID && !/^\d{12}$/.test(studentID)) {
        alert('LRN must be exactly 12 digits (numbers only).');
        return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        alert('Please enter a valid email address');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                firstName,
                lastName,
                email,
                password,
                gradeLevel,
                studentID: studentID || undefined
            })
        });

        // Read raw text first to avoid "body stream already read" errors
        const raw = await response.text();
        let data;
        try {
            data = raw ? JSON.parse(raw) : {};
        } catch (parseErr) {
            console.error('Non-JSON response from /api/auth/register:', response.status, response.statusText, raw);
            alert(`Registration failed: ${response.status} ${response.statusText} - ${raw}`);
            return;
        }

        if (!response.ok) {
            alert((data && data.error) ? data.error : `Registration failed: ${response.status} ${response.statusText}`);
            return;
        }

        // Clear old enrollment data
        localStorage.removeItem('enrollments');
        localStorage.removeItem('studentGrades');
        localStorage.removeItem('studentSchedule');
        localStorage.removeItem('studentAnnouncements');
        localStorage.removeItem('studentTasks');
        
        // Store new student data in localStorage
        const studentData = {
            id: data.student.id,
            email: data.student.email,
            firstName: data.student.firstName,
            lastName: data.student.lastName,
            studentID: data.student.student_id,
            gradeLevel: data.student.gradeLevel,
            role: 'student',
            registrationTime: new Date().toISOString(),
            accountStatus: 'active'
        };
        
        localStorage.setItem('studentData', JSON.stringify(studentData));
        // Notify other tabs that a new student account was created
        try {
            localStorage.setItem('studentCreated', JSON.stringify({ id: data.student.id, ts: Date.now() }));
        } catch (e) {
            // ignore
        }
        
        await showSuccessModal('Account created successfully. Please log in using your credentials.');

        // Return to login form instead of redirecting to dashboard
        const loginTabBtn = document.querySelector('.tab-btn[data-tab="login"]');
        if (loginTabBtn) loginTabBtn.click();

        showLoginFormMessage('Account created successfully. Please log in using your credentials.');

        // Prepare login form with the newly registered email
        const loginEmailInput = document.getElementById('loginEmail');
        const loginPasswordInput = document.getElementById('loginPassword');
        if (loginEmailInput) loginEmailInput.value = '';
        if (loginPasswordInput) loginPasswordInput.value = '';

        // Clear registration form fields
        e.target.reset();
    } catch (err) {
        console.error('Registration error:', err);
        alert('Registration failed. ' + (err.message || 'Please try again.'));
    }
});

// Load remembered email if exists
document.addEventListener('DOMContentLoaded', () => {
    bootstrapSchoolBranding();

    const rememberedEmail = localStorage.getItem('studentEmail');
    if (rememberedEmail) {
        document.getElementById('loginEmail').value = rememberedEmail;
        document.querySelector('input[name="remember"]').checked = true;
    }
});

// Forgot password handler
document.querySelector('.forgot-password').addEventListener('click', (e) => {
    e.preventDefault();
    alert('Password reset feature will be implemented soon. Please contact the admin at info@cnhs.edu.ph');
});

