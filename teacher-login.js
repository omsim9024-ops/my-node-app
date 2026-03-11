function showToast(message, type = "error") {
  let toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 50);
  setTimeout(() => { toast.classList.remove("show"); setTimeout(() => toast.remove(), 300); }, 3500);
}

function normalizeTeacherRole(roleValue) {
  const raw = String(roleValue || '').toLowerCase().trim();
  if (!raw) return '';
  if (raw === 'adviser' || raw === 'advisor') return 'adviser';
  if (raw === 'subject teacher' || raw === 'subject_teacher' || raw === 'subject') return 'subject_teacher';
  return raw;
}

let activeSchoolCode = detectSchoolCode();

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
  if (!activeSchoolCode) return path;
  try {
    const url = new URL(path, window.location.origin);
    url.searchParams.set('school', activeSchoolCode);
    return `${url.pathname}${url.search}${url.hash || ''}`;
  } catch (_err) {
    return path;
  }
}

function applySchoolTheme(branding) {
  const theme = branding && typeof branding === 'object' ? branding : {};
  const root = document.documentElement;
  const brand900 = String(theme.brand900 || '').trim();
  const brand700 = String(theme.brand700 || theme.primary || '').trim();
  const brand600 = String(theme.brand600 || theme.secondary || '').trim();

  if (brand900) root.style.setProperty('--school-brand-900', brand900);
  if (brand700) root.style.setProperty('--school-brand-700', brand700);
  if (brand600) root.style.setProperty('--school-brand-600', brand600);
}

async function bootstrapSchoolBranding() {
  const detected = detectSchoolCode();
  if (detected) {
    activeSchoolCode = detected;
  }

  const signupLink = document.getElementById('signupLink');
  if (signupLink) signupLink.setAttribute('href', withSchoolParam('teacher-signup.html'));

  const endpoint = detected
    ? `/api/system-health/schools/resolve?code=${encodeURIComponent(detected)}`
    : '/api/system-health/schools/resolve';

  try {
    const res = await fetch(endpoint);
    if (!res.ok) return;
    const payload = await res.json();
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

    document.title = `Teacher Login – ${schoolName}`;

    const schoolNameNode = document.getElementById('schoolName');
    if (schoolNameNode) schoolNameNode.textContent = `${schoolName}`;

    const logoNode = document.getElementById('schoolLogo');
    if (logoNode && logo) logoNode.setAttribute('src', logo);

    const favicon = document.getElementById('schoolFavicon');
    if (favicon && logo) favicon.setAttribute('href', logo);

    if (signupLink) signupLink.setAttribute('href', withSchoolParam('teacher-signup.html'));

    applySchoolTheme(school.branding || {});
  } catch (_err) {
    // Keep fallback school code from URL/storage so tenant-scoped auth still works.
  }
}

document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  if (!email || !password) { showToast('Fill all fields'); return; }

  try {
    console.log('[Teacher Login] Logging in with email:', email);
    const schoolParam = activeSchoolCode ? `?school=${encodeURIComponent(activeSchoolCode)}` : '';
    const res = await fetch(`/api/teacher-auth/login${schoolParam}`, {
      method: 'POST',
      headers: {
        'Content-Type':'application/json',
        ...(activeSchoolCode ? { 'x-tenant-code': activeSchoolCode } : {})
      },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || 'Login failed'); return; }

    console.log('[Teacher Login] Login successful. Teacher data:', data.teacher);

    // Store teacher data in session storage
    if (data.teacher) {
      const teacherData = {
        id: data.teacher.id,
        teacher_id: data.teacher.teacher_id,
        name: data.teacher.name,
        email: data.teacher.email,
        role: normalizeTeacherRole(data.teacher.role),
        type: 'teacher'
      };
      
      // ✅ FIX: Use tab-scoped session storage
      // Each tab now maintains its own independent session
      if (typeof sessionManager !== 'undefined' && sessionManager.loginTab) {
        console.log('[Teacher Login] Storing session in tab-scoped storage (Tab ID:', sessionManager.getTabId(), ')');
        sessionManager.loginTab(teacherData, 'teacher');
      }
      
      sessionStorage.setItem('teacherData', JSON.stringify(teacherData));
      localStorage.setItem('loggedInUser', JSON.stringify(teacherData));
      console.log('[Teacher Login] Stored teacher data in localStorage:', teacherData);
    }

    // role-based redirect
    const role = normalizeTeacherRole(data.teacher && data.teacher.role);
    console.log('[Teacher Login] Teacher role:', role);
    
    // Set flag to indicate we just logged in (prevents immediate redirect loop in destination pages)
    sessionStorage.setItem('_justLoggedIn', 'true');
    
    if (!role) {
      console.log('[Teacher Login] No role assigned, redirecting to teacher-dashboard.html');
      window.location.href = withSchoolParam('teacher-dashboard.html');
    } else if (role === 'adviser') {
      console.log('[Teacher Login] Adviser role detected, redirecting to adviser-dashboard.html');
      window.location.href = withSchoolParam('adviser-dashboard.html');
    } else if (role === 'subject_teacher') {
      console.log('[Teacher Login] Subject teacher role detected, redirecting to subject-teacher-dashboard.html');
      window.location.href = withSchoolParam('subject-teacher-dashboard.html');
    } else {
      console.log('[Teacher Login] Unknown role:', role, 'redirecting to teacher-dashboard.html');
      window.location.href = withSchoolParam('teacher-dashboard.html');
    }
  } catch (err) { console.error('[Teacher Login] Error:', err); showToast('Server error'); }
});

bootstrapSchoolBranding();

