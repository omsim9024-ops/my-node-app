// --- UTILITIES ---
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// Toast Notification System
function showToast(message, type = 'info') {
    const container = $('#toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconPath = '';
    if (type === 'success') iconPath = '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>';
    else if (type === 'error') iconPath = '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>';
    else iconPath = '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>';

    toast.innerHTML = `
        <svg class="toast-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${iconPath}</svg>
        <div class="toast-msg">${message}</div>
    `;

    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Toggle Password Visibility
window.togglePassword = function(inputId, btn) {
    const input = $(`#${inputId}`);
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    
    btn.innerHTML = isPassword 
        ? '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>'
        : '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
}

function setButtonLoading(btn, isLoading) {
    const spinner = btn.querySelector('.spinner');
    if (isLoading) {
        btn.classList.add('btn-loading');
        if(spinner) spinner.classList.remove('hidden');
        btn.disabled = true;
    } else {
        btn.classList.remove('btn-loading');
        if(spinner) spinner.classList.add('hidden');
        btn.disabled = false;
    }
}

// --- CORE LOGIC ---
let activeSchoolCode = '';
let selectedRole = 'student';
const BACKEND_ORIGIN = window.location.origin;
const API_BASE = BACKEND_ORIGIN;

function detectSchoolCode() {
    // ensure the URL always contains a school query param; if missing,
    // derive from storage or hostname and default to "default-school".
    try {
        const existing = new URLSearchParams(window.location.search || '');
        // treat numeric-only values (e.g. coming from IP address parsing) as if the
        // parameter were absent so we can override with default-school
        let existingSchool = String(existing.get('school') || '').trim().toLowerCase();
        if (/^\d+$/.test(existingSchool)) {
            existingSchool = '';
            existing.delete('school');
        }
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
    } catch (_e) { /* ignore */ }

    const params = new URLSearchParams(window.location.search || '');
    const fromQuery = (params.get('school') || params.get('tenant') || params.get('code') || '').trim().toLowerCase();
    if (fromQuery) return fromQuery;
    const fromStorage = String(localStorage.getItem('sms.selectedSchoolCode') || localStorage.getItem('sms.selectedTenantCode') || '').trim().toLowerCase();
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
    } catch (_err) { return path; }
}

function appendSchoolParamToLinks(code) {
    if (!code) return;
    $$('a[href$=".html"], a[href*=".html?"]').forEach((anchor) => {
        const href = anchor.getAttribute('href') || '';
        if (!href || href.startsWith('#')) return;
        anchor.setAttribute('href', withSchoolParam(href));
    });
}

function applySchoolTheme(branding) {
    const theme = branding && typeof branding === 'object' ? branding : {};
    const primary = String(theme.primary || theme.brand700 || '').trim();
    if (primary) document.documentElement.style.setProperty('--primary', primary);
}

function setSchoolFavicon(logoValue, schoolCode) {
    const baseFallback = 'logo.png';
    const raw = String(logoValue || '').trim();
    const isDataUrl = /^data:/i.test(raw);
    const cacheSuffix = `school=${encodeURIComponent(String(schoolCode || 'default').toLowerCase())}&t=${Date.now()}`;
    const finalHref = raw ? (isDataUrl ? raw : `${raw}${raw.includes('?') ? '&' : '?'}${cacheSuffix}`) : `${baseFallback}?${cacheSuffix}`;

    const ensureLink = (relValue) => {
        let link = $(`link[rel="${relValue}"]`);
        if (!link) { link = document.createElement('link'); link.setAttribute('rel', relValue); document.head.appendChild(link); }
        link.setAttribute('href', finalHref);
        link.setAttribute('type', 'image/png');
    };
    ensureLink('icon');
    ensureLink('shortcut icon');
}

async function bootstrapSchoolBranding() {
    const detected = detectSchoolCode();
    activeSchoolCode = detected;
    // store whatever was detected explicitly – if it's default-school we want
    // that preference saved so missing query strings later still honor it
    if (detected) {
        localStorage.setItem('sms.selectedSchoolCode', detected);
        localStorage.setItem('sms.selectedTenantCode', detected);
    }
    const endpoint = detected ? `/api/system-health/schools/resolve?code=${encodeURIComponent(detected)}` : '/api/system-health/schools/resolve';
    try {
        const response = await fetch(endpoint);
        if (!response.ok) return;
        const payload = await response.json();
        if (!payload || !payload.success || !payload.school) return;
        const school = payload.school;
        // if detected was not default-school, use resolved code in case it
        // normalizes (e.g. numeric id). otherwise keep the explicit string.
        if (detected !== 'default-school') {
            activeSchoolCode = String(school.code || detected || '').trim().toLowerCase();
            if (activeSchoolCode) {
                localStorage.setItem('sms.selectedSchoolCode', activeSchoolCode);
                localStorage.setItem('sms.selectedTenantCode', activeSchoolCode);
            }
        }
        if (school.id) { localStorage.setItem('sms.selectedSchoolId', String(school.id)); localStorage.setItem('sms.selectedTenantId', String(school.id)); }

        const schoolName = String(school.name || 'School Management System');
        const logo = String(school.logoData || '').trim();
        document.title = `${schoolName} - Authentication`;

        $('#schoolName').textContent = schoolName;
        
        const tagline = String((school.branding && school.branding.pageContent && school.branding.pageContent.heroTagline) || '').trim();
        if (tagline) $('#schoolTagline').textContent = tagline;

        const schoolLogoNode = $('#schoolLogo');
        schoolLogoNode.setAttribute('alt', `${schoolName} Logo`);
        schoolLogoNode.setAttribute('src', logo || 'logo.png');
        schoolLogoNode.onerror = () => { schoolLogoNode.onerror = null; schoolLogoNode.setAttribute('src', 'logo.png'); };
        
        setSchoolFavicon(logo || '', activeSchoolCode);
        applySchoolTheme(school.branding || {});
        appendSchoolParamToLinks(activeSchoolCode);
    } catch (_err) {}
}

// Fetch Interceptor
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
            const headers = { ...(options.headers || {}), 'x-tenant-code': activeSchoolCode };
            return nativeFetch(parsed.toString(), { ...options, headers });
        }
    } catch (_err) {}
    return nativeFetch(resource, options);
};

// Role UI Update
function updateRoleUI(role) {
    selectedRole = role;
    localStorage.setItem('auth.selectedRole', role);

    // Update Slider Position
    const slider = $('.role-selector');
    const btns = $$('.role-btn');
    let pos = 1;
    btns.forEach((btn, index) => {
        const isActive = btn.dataset.role === role;
        btn.classList.toggle('active', isActive);
        if (isActive) pos = index + 1;
    });
    slider.setAttribute('data-pos', pos);

    // Adjust Text
    const cap = (role === 'teacher' || role === 'adviser') ? 'Teacher' : (role.charAt(0).toUpperCase() + role.slice(1));
    $('#loginHeading').textContent = `${cap} Login`;
    $('#registerHeading').textContent = `Create ${cap} Account`;
    $('#loginSubtitle').textContent = `Access your ${cap.toLowerCase()} dashboard`;
    $('#registerSubtitle').textContent = `Join as a ${cap.toLowerCase()}`;

    // Visibility
    const groups = {
        lrn: $('#familySchoolGroup'),
        code: $('#regCodeGroup'),
        admin: $('#adminRoleGroup'),
        adviser: $('#adviserIdGroup'),
        dept: $('#departmentGroup')
    };
    
    Object.values(groups).forEach(g => g.classList.add('hidden'));
    
    const registerTab = $('.tab-btn[data-tab="register"]');
    const registerForm = $('#registerForm');

    if (role === 'student') {
        groups.lrn.classList.remove('hidden');
        registerTab.style.display = '';
        registerForm.style.display = '';
    } else if (role === 'teacher' || role === 'adviser') {
        groups.code.classList.remove('hidden');
        groups.adviser.classList.remove('hidden');
        groups.dept.classList.remove('hidden');
        registerTab.style.display = '';
        registerForm.style.display = '';
    } else if (role === 'admin') {
        groups.admin.classList.remove('hidden');
        registerTab.style.display = 'none';
        registerForm.style.display = 'none';
        $('.tab-btn[data-tab="login"]').click();
    }
}

function setupTabs() {
    $$('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            $$('.tab-btn').forEach(b => b.classList.remove('active'));
            $$('.auth-form').forEach(f => f.classList.remove('active'));
            btn.classList.add('active');
            $(`#${tabName}Form`).classList.add('active');
        });
    });

    $$('.toggle-form').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            $(`.tab-btn[data-tab="${link.dataset.tab}"]`).click();
        });
    });
}

async function loginAsRole(email, password, rememberMe) {
    let path = '';
    let body = { email, password };

    if (selectedRole === 'student') {
        path = '/api/auth/login';
    } else if (selectedRole === 'teacher' || selectedRole === 'adviser') {
        // use teacher endpoint for both generic teacher logins and adviser role
        path = '/api/teacher-auth/login';
    } else if (selectedRole === 'admin') {
        path = '/api/admin/login';
        body = { email, password, rememberMe };
    }

    let response = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: selectedRole === 'admin' ? 'include' : 'same-origin',
        body: JSON.stringify(body)
    });
    let data = await response.json();

    // if user selected adviser and the adviser-specific login failed,
    // try the teacher login endpoint instead (handles plain teachers).
    if (selectedRole === 'adviser' && !response.ok && response.status === 401) {
        const fallback = await fetch(`${API_BASE}/api/teacher-auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ email, password })
        });
        const fallbackData = await fallback.json();
        if (fallback.ok) {
            data = fallbackData;
            response = fallback;
        }
    }

    return { ok: response.ok, data };
}


// normalize raw role string into one of 'teacher','adviser','subject_teacher'
function normalizeTeacherRole(raw) {
    if (!raw) return '';
    const r = String(raw).toLowerCase().trim();
    if (r === 'adviser' || r === 'advisor') return 'adviser';
    if (r === 'subject teacher' || r === 'subject_teacher' || r === 'subject') return 'subject_teacher';
    return 'teacher';
}

async function fetchCurrentTeacherRole(email) {
    // returns object { role: normalizedRole, teacher: { ... } } or null
    if (!email) return null;
    console.log('[Auth] fetching current role for', email);
    try {
        const res = await fetch(`${API_BASE}/api/teacher-auth/current-role/${encodeURIComponent(email)}`, {credentials: 'same-origin'});
        console.log('[Auth] current-role response status', res.status);
        if (res.ok) {
            const payload = await res.json();
            console.log('[Auth] current-role payload', payload);
            if (payload && payload.teacher) {
                const norm = normalizeTeacherRole(payload.teacher.role);
                return { role: norm, teacher: payload.teacher };
            }
        }
    } catch (err) {
        console.warn('[Auth] current-role fetch error', err);
    }
    // fallback: try profile endpoint
    try {
        const res = await fetch(`${API_BASE}/api/teacher-auth/profile`, {credentials: 'same-origin'});
        console.log('[Auth] profile endpoint status', res.status);
        if (res.ok) {
            const payload = await res.json();
            console.log('[Auth] profile payload', payload);
            if (payload) {
                const raw = payload.teacher?.role || payload.role || '';
                const norm = normalizeTeacherRole(raw);
                if (payload.teacher) {
                    return { role: norm, teacher: payload.teacher };
                } else if (norm && norm !== 'teacher') {
                    return { role: norm, teacher: null };
                }
            }
        }
    } catch (err) {
        console.warn('[Auth] profile fetch error', err);
    }
    return null;
}

function storeSession(role, dataObj, token) {
    // convert adviser/subject_teacher into teacher for storage so the dashboard
    // scripts continue to find their user data under the familiar keys.
    let effectiveRole = role;
    if (role === 'adviser' || role === 'subject_teacher') {
        effectiveRole = 'teacher';
    }
    // remove any stale admin data when logging in as someone else
    if (effectiveRole !== 'admin') {
        try { localStorage.removeItem('adminData'); } catch (_) {}
    }
    let payload = { ...dataObj, role: role, loginTime: new Date().toISOString() };
    // if the server returned nested adviser object, flatten it for easier dashboard logic
    if (effectiveRole === 'teacher' && dataObj && dataObj.adviser) {
        const a = dataObj.adviser;
        // prefer explicit name property but fall back to first/last combination
        const adviserName = a.name || ((a.first_name || '') + (a.last_name ? ' ' + a.last_name : '')).trim();
        payload = Object.assign({}, payload, {
            id: String(a.id || a.adviser_id || ''),
            name: adviserName
        });
    }
    if (typeof sessionManager !== 'undefined' && sessionManager.loginTab) sessionManager.loginTab(payload, effectiveRole);
    
    if (effectiveRole === 'student') {
        localStorage.setItem('studentData', JSON.stringify(payload));
        if (token) localStorage.setItem('authToken', token);
    } else if (effectiveRole === 'teacher') {
        // store teacher (and/or adviser) session
        sessionStorage.setItem('teacherData', JSON.stringify(payload));
        localStorage.setItem('loggedInUser', JSON.stringify(payload));
        // if this payload actually represents an adviser, keep adviserData key too
        if (role === 'adviser') {
            sessionStorage.setItem('adviserData', JSON.stringify(payload));
        }
    } else if (effectiveRole === 'admin') {
        localStorage.setItem('adminData', JSON.stringify(payload));
        if (token) localStorage.setItem('adminAuthToken', token);
    }
}

function redirectAfterLogin(role, data) {
    if (role === 'student') {
        window.location.href = withSchoolParam('student-dashboard.html?refresh=' + Date.now());
    } else if (role === 'teacher') {
        window.location.href = withSchoolParam('teacher-dashboard.html');
    } else if (role === 'adviser') {
        // advisors should land on their dedicated dashboard
        window.location.href = withSchoolParam('adviser-dashboard.html');
    } else if (role === 'subject_teacher') {
        window.location.href = withSchoolParam('subject-teacher-dashboard.html');
    } else if (role === 'admin') {
        const r = (data && data.admin && data.admin.role) ? data.admin.role : 'admin';
        if (r === 'guidance') window.location.href = withSchoolParam('guidance-dashboard.html');
        else window.location.href = withSchoolParam('admin-dashboard.html');
    }
}

async function validateRegistrationCode(code) {
    if (!code) return { valid: false, error: 'Code is required' };
    try {
        const res = await fetch(`${API_BASE}/api/registration-codes/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });
        return await res.json();
    } catch (err) { return { valid: false, error: 'Validation failed' }; }
}

async function handleLoginSubmit(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    setButtonLoading(btn, true);

    const email = $('#loginEmail').value.trim();
    const password = $('#loginPassword').value;
    const rememberMe = $('input[name="remember"]').checked;

    if (!email || !password) {
        showToast('Please fill in all fields', 'error');
        setButtonLoading(btn, false);
        return;
    }

    if (rememberMe) try { localStorage.setItem('studentEmail', email); } catch (e) {}

    try {
        const { ok, data } = await loginAsRole(email, password, rememberMe);
        if (!ok) {
            showToast(data.error || 'Login failed', 'error');
            setButtonLoading(btn, false);
            return;
        }

        if (data && data.requiresOtp) {
            $('#otpGroup').classList.remove('hidden');
            $('#otpVerifyBtn').classList.remove('hidden');
            setButtonLoading(btn, false);
            if (data.debugOtp) {
                showToast('DEV OTP: ' + data.debugOtp, 'info');
                $('#otpCode').value = data.debugOtp;
            }
            return;
        }

        // if the server returned a different role than the one we requested,
        // override selectedRole so the rest of the logic and redirect are correct.
        let actualRole = selectedRole;
        // advisers should always take precedence over admin when both flags are present
        if (data.adviser && selectedRole !== 'adviser') {
            console.warn('[Auth] Role mismatch: logged in as adviser but selected', selectedRole);
            actualRole = 'adviser';
            showToast('Logged in as Adviser – redirecting to adviser dashboard', 'info');
        } else if (data.admin && selectedRole !== 'admin') {
            console.warn('[Auth] Role mismatch: logged in as admin but selected', selectedRole);
            actualRole = 'admin';
            showToast('Logged in as Admin – redirecting to admin dashboard', 'info');
        } else if (data.student && selectedRole !== 'student') {
            console.warn('[Auth] Role mismatch: logged in as student but selected', selectedRole);
            actualRole = 'student';
        } else if (data.teacher) {
            // teacher login response from /api/teacher-auth/login – normalize role value
            const rawRole = String(data.teacher.role || '').toLowerCase().trim();
            let teacherRole = '';
            if (rawRole === 'adviser' || rawRole === 'advisor') teacherRole = 'adviser';
            else if (rawRole === 'subject teacher' || rawRole === 'subject_teacher' || rawRole === 'subject') teacherRole = 'subject_teacher';

            if (teacherRole === 'adviser') {
                actualRole = 'adviser';
                // copy teacher object into adviser slot so payload is populated later
                if (!data.adviser && data.teacher) {
                    data.adviser = { ...data.teacher };
                }
                showToast('Logged in as Adviser – redirecting to adviser dashboard', 'info');
            } else if (teacherRole === 'subject_teacher') {
                actualRole = 'subject_teacher';
                showToast('Logged in as Subject Teacher – redirecting to subject teacher dashboard', 'info');
            } else {
                actualRole = 'teacher';
                if (selectedRole !== 'adviser' && selectedRole !== 'student') {
                    console.warn('[Auth] Logged in as teacher (no special role)');
                }
            }
        }
        
        // NOTE: we intentionally removed the unconditional "selectedRole === 'adviser'"
        // override that previously forced every adviser-tab login into an adviser role;
        // that behaviour prevented a plain teacher account from landing on the
        // teacher dashboard.  Role assignment now follows whatever the server tells
        // us (with the above normalization), which aligns with the desired logic.

        // After login, always check current-role endpoint to ensure we have the
        // latest role and teacher/adviser info.  This covers both cases where the
        // response earlier already indicated 'adviser' and where it returned a
        // generic teacher record that may have been promoted.
        const roleInfo = await fetchCurrentTeacherRole(email);
        if (roleInfo && roleInfo.role) {
            if (roleInfo.role !== actualRole) {
                actualRole = roleInfo.role;
                showToast(`Logged in as ${roleInfo.role.replace('_',' ')} – redirecting`, 'info');
            }
            if (roleInfo.teacher) {
                if (actualRole === 'adviser') {
                    data.adviser = data.adviser || {};
                    Object.assign(data.adviser, roleInfo.teacher);
                } else if (actualRole === 'subject_teacher' || actualRole === 'teacher') {
                    data.teacher = data.teacher || {};
                    Object.assign(data.teacher, roleInfo.teacher);
                }
            }
        }
        // if role is adviser, make a best-effort fetch of full adviser profile to
        // obtain first/last name and other fields not present on the teacher table
        if (actualRole === 'adviser') {
            let needProfile = false;
            if (!data.adviser) {
                data.adviser = {};
                needProfile = true;
            } else if (!data.adviser.name || data.adviser.name.trim() === '') {
                needProfile = true;
            }
            if (needProfile) {
                try {
                    const advResp = await fetch(`${API_BASE}/api/adviser-auth/profile`, {credentials: 'same-origin'});
                    if (advResp.ok) {
                        const advData = await advResp.json();
                        if (advData && advData.adviser) {
                            Object.assign(data.adviser, advData.adviser);
                        }
                    }
                } catch (_e) {
                    console.warn('[Auth] failed to fetch adviser profile for name sync');
                }
            }
        }

        let payload;
        if (actualRole === 'student' && data.student) {
            payload = { id: data.student.id, email: data.student.email, firstName: data.student.firstName, lastName: data.student.lastName, studentID: data.student.student_id, gradeLevel: data.student.gradeLevel, lrn: data.student.lrn || null, role: 'student' };
        } else if ((actualRole === 'teacher' || actualRole === 'subject_teacher') && data.teacher) {
            const t = data.teacher;
            payload = {
                id: t.id,
                teacherId: t.teacher_id || t.id,
                name: t.name || '',
                email: t.email,
                role: actualRole === 'subject_teacher' ? 'subject_teacher' : (t.role || '')
            };
        } else if (actualRole === 'adviser' && (data.adviser || data.teacher)) {
            const a = data.adviser || data.teacher;
            const first = a.first_name || a.firstName || '';
            const last = a.last_name || a.lastName || '';
            const full = a.name || `${first}${last ? ' ' + last : ''}`.trim();
            payload = {
                id: a.id,
                adviserId: a.adviser_id || a.teacher_id || a.id,
                firstName: first,
                lastName: last,
                name: full,
                email: a.email,
                role: 'adviser'
            };
        } else if (actualRole === 'admin' && data.admin) {
            payload = { id: data.admin.id, email: data.admin.email, name: data.admin.name, role: data.admin.role };
        }
        console.log('[Auth] final actualRole', actualRole, 'payload', payload);

        storeSession(actualRole, payload, data.token);
        redirectAfterLogin(actualRole, data);
    } catch (err) {
        showToast('Network error. Please try again.', 'error');
        setButtonLoading(btn, false);
    }
}

async function handleRegisterSubmit(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    setButtonLoading(btn, true);

    if (selectedRole === 'admin') {
        showToast('Admin accounts require developer creation.', 'info');
        setButtonLoading(btn, false);
        return;
    }
    if (!['student','teacher','adviser'].includes(selectedRole)) {
        showToast('Cannot create account for this role.', 'error');
        setButtonLoading(btn, false);
        return;
    }

    const firstName = $('#regFirstName').value.trim();
    const lastName = $('#regLastName').value.trim();
    const email = $('#regEmail').value.trim();
    const password = $('#regPassword').value;
    const confirmPassword = $('#regConfirmPassword').value;
    const agreeTerms = $('input[name="agreeTerms"]').checked;
    const regCode = $('#regCode') ? $('#regCode').value.trim() : '';
    const studentID = $('#regStudentID') ? $('#regStudentID').value.trim() : '';
    
    // Validations
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
        showToast('Please complete all fields', 'error');
        if (!firstName) $('#regFirstName').focus();
        else if (!lastName) $('#regLastName').focus();
        else if (!email) $('#regEmail').focus();
        else if (!password) $('#regPassword').focus();
        setButtonLoading(btn, false);
        return;
    }
    if (password !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        $('#regConfirmPassword').focus();
        setButtonLoading(btn, false);
        return;
    }
    if (password.length < 8) {
        showToast('Password must be at least 8 characters', 'error');
        $('#regPassword').focus();
        setButtonLoading(btn, false);
        return;
    }
    if (!agreeTerms) {
        showToast('Please agree to the terms', 'error');
        document.querySelector('input[name="agreeTerms"]').focus();
        setButtonLoading(btn, false);
        return;
    }
    if (selectedRole === 'student' && studentID && !/^\d{12}$/.test(studentID)) {
        showToast('LRN must be 12 digits', 'error');
        $('#regStudentID').focus();
        setButtonLoading(btn, false);
        return;
    }

    if (selectedRole === 'teacher' || selectedRole === 'adviser') {
        // both teacher and adviser signups require a registration code and dept
        if (!regCode) {
            showToast('Registration code required', 'error');
            $('#regCode').focus();
            setButtonLoading(btn, false);
            return;
        }
        const validation = await validateRegistrationCode(regCode);
        if (!validation.valid) {
            showToast(validation.error || 'Invalid code', 'error');
            $('#regCode').focus();
            setButtonLoading(btn, false);
            return;
        }
        const deptVal = $('#regDepartment').value.trim();
        if (!deptVal) {
            showToast('Department is required', 'error');
            $('#regDepartment').focus();
            setButtonLoading(btn, false);
            return;
        }
    }

    try {
        let endpoint = '';
        let body = {};

        if (selectedRole === 'student') {
            endpoint = '/api/auth/register';
            body = { firstName, lastName, email, password, gradeLevel: 'Unspecified', studentID: studentID || undefined };
        } else if (selectedRole === 'teacher' || selectedRole === 'adviser') {
            // both teacher and adviser use the same registration endpoint; they
            // start as generic teachers and may later be elevated to adviser by
            // an admin.  Keeping one route avoids duplicate accounts.
            endpoint = '/api/teacher-auth/register';
            body = {
                teacher_id: $('#regAdviserId').value.trim() || ('T' + Date.now()),
                name: `${firstName} ${lastName}`,
                department: $('#regDepartment').value.trim() || 'Unassigned',
                email,
                password,
                registration_code: regCode
            };
        }

        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(body)
        });

        let raw = await response.text();
        let data;
        try { data = raw ? JSON.parse(raw) : {}; } catch (_e) { data = null; }

        if (!response.ok) {
            showToast(data.error || `Error: ${response.status}`, 'error');
            setButtonLoading(btn, false);
            return;
        }

        showToast('Account created successfully!', 'success');
        
        // Switch to login
        $('.tab-btn[data-tab="login"]').click();
        e.target.reset();

    } catch (err) {
        showToast('Registration failed. Try again.', 'error');
    } finally {
        setButtonLoading(btn, false);
    }
}

function loadRememberedEmail() {
    const rememberedEmail = localStorage.getItem('studentEmail');
    if (rememberedEmail) {
        $('#loginEmail').value = rememberedEmail;
        $('input[name="remember"]').checked = true;
    }
}

async function init() {
    // wait for branding/school code so redirects have the proper param
    await bootstrapSchoolBranding();
    setupTabs();

    // set initial role based on URL parameter (e.g. ?role=adviser or ?role=teacher)
    try {
        const params = new URLSearchParams(window.location.search || '');
        let urlRole = params.get('role');
        if (urlRole) {
            urlRole = String(urlRole).toLowerCase();
            if (urlRole === 'adviser') urlRole = 'teacher';
            if (['student','teacher','admin'].includes(urlRole)) {
                selectedRole = urlRole;
            }
        }
    } catch (_e) {}

    $('#loginForm').addEventListener('submit', handleLoginSubmit);
    $('#registerForm').addEventListener('submit', handleRegisterSubmit);

    $$('.role-btn').forEach(btn => {
        btn.addEventListener('click', () => updateRoleUI(btn.dataset.role));
    });

    $('.link-forgot').addEventListener('click', (e) => {
        e.preventDefault();
        showToast('Password reset coming soon.', 'info');
    });

    const otpBtn = $('#otpVerifyBtn');
    if (otpBtn) {
        otpBtn.addEventListener('click', async () => {
            const code = $('#otpCode').value.trim();
            const email = $('#loginEmail').value.trim();
            if (!code) {
                showToast('Enter code', 'error');
                return;
            }
            setButtonLoading(otpBtn, true);
            try {
                const res = await fetch(`${API_BASE}/api/admin/login/verify-otp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ email, code })
                });
                const data = await res.json();
                if (!res.ok) {
                    showToast(data.error || 'OTP Failed', 'error');
                    setButtonLoading(otpBtn, false);
                    return;
                }
                storeSession('admin', data.admin, data.token);
                redirectAfterLogin('admin', data);
            } catch (err) {
                showToast('Verification error', 'error');
                setButtonLoading(otpBtn, false);
            }
        });
    }

    // Restore state; URL parameter should override stored value
    let r = localStorage.getItem('auth.selectedRole') || 'student';
    try {
        const params = new URLSearchParams(window.location.search || '');
        let urlRole = params.get('role');
        if (urlRole) {
            urlRole = String(urlRole).toLowerCase();
            if (urlRole === 'adviser') urlRole = 'teacher';
            if (['student','teacher','admin'].includes(urlRole)) {
                r = urlRole;
            }
        }
    } catch (_e) {}
    updateRoleUI(r);
    loadRememberedEmail();
}

window.addEventListener('DOMContentLoaded', () => { init().catch(() => {}); });