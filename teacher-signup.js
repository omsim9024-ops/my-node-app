const BACKEND_ORIGIN = window.location.origin;
let API_BASE = BACKEND_ORIGIN;

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

  try {
    const params = new URLSearchParams(window.location.search || '');
    const fromQuery = String(params.get('school') || params.get('tenant') || params.get('code') || '').trim().toLowerCase();
    if (fromQuery) return fromQuery;
  } catch (_e) {}

  try {
    const fromStorage = String(localStorage.getItem('sms.selectedSchoolCode') || localStorage.getItem('sms.selectedTenantCode') || '').trim().toLowerCase();
    if (fromStorage) return fromStorage;
  } catch (_e) {}

  return '';
}

function withSchool(path, schoolCode) {
  if (!schoolCode) return path;
  try {
    const url = new URL(path, window.location.origin);
    url.searchParams.set('school', schoolCode);
    return `${url.pathname}${url.search}`;
  } catch (_e) {
    const joiner = String(path).includes('?') ? '&' : '?';
    return `${path}${joiner}school=${encodeURIComponent(schoolCode)}`;
  }
}

function tenantHeaders(schoolCode, extra = {}) {
  return {
    'Content-Type': 'application/json',
    ...(schoolCode ? { 'x-tenant-code': schoolCode } : {}),
    ...extra
  };
}

async function probeApiBase(timeout = 2000) {
  return API_BASE; // keep simple for frontend
}

function showToast(message, type = "error") {
  let toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;

  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add("show"), 50);

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

document.getElementById("signupForm").addEventListener("submit", async e => {
  e.preventDefault();

  let schoolCode = detectSchoolCode();
  if (!schoolCode) {
    schoolCode = localStorage.getItem('sms.selectedSchoolCode') || 'default-school';
    localStorage.setItem('sms.selectedSchoolCode', schoolCode);
    localStorage.setItem('sms.selectedTenantCode', schoolCode);
    console.log('[teacher-signup] fallback schoolCode ->', schoolCode);
  }

  const registrationCode = document.getElementById('registrationCode').value.trim();
  const teacher_id = document.getElementById('teacherId').value.trim();
  const name = document.getElementById('teacherName').value.trim();
  const department = document.getElementById('department').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  const confirm = document.getElementById('signupConfirm').value;

  // debug
  console.log('[teacher-signup] submit clicked', { schoolCode, registrationCode, teacher_id, name, department, email });
  alert('Signup attempt: school=' + schoolCode + ' code=' + registrationCode);

  // Validate all required fields (teacher_id is optional)
  if (!registrationCode || !name || !department || !email || !password || !confirm) {
    showToast('Fill all required fields and registration code');
    return;
  }
  
  if (password !== confirm) { 
    showToast('Passwords do not match'); 
    return; 
  }
  
  if (password.length < 8) { 
    showToast('Minimum 8 characters for password'); 
    return; 
  }

  if (!schoolCode) {
    alert('No school code, cannot register');
    return;
  }

  try {
    // First, validate the registration code
    console.log('[Teacher Signup] Validating registration code...');
    const validateRes = await fetch(withSchool(`/api/registration-codes/validate`, schoolCode), {
      method: 'POST',
      headers: tenantHeaders(schoolCode),
      credentials: 'include',
      body: JSON.stringify({ code: registrationCode })
    });
    
    const validateData = await validateRes.json();
    
    if (!validateRes.ok) {
      showToast(validateData.error || 'Invalid registration code');
      return;
    }
    
    console.log('[Teacher Signup] Code validated successfully');
    
    // Code is valid, proceed with registration
    console.log('[Teacher Signup] Creating teacher account...');
    // include teacher_id only when provided
    const payload = {
        name,
        department,
        email,
        password,
        registration_code: registrationCode
    };
    if (teacher_id) payload.teacher_id = teacher_id;

    const res = await fetch(withSchool(`/api/teacher-auth/register`, schoolCode), {
      method: 'POST',
      headers: tenantHeaders(schoolCode),
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    
    const data = await res.json();
    
    if (!res.ok) { 
      alert('registration error: ' + (data.error || res.status));
      showToast(data.error || 'Registration failed'); 
      return; 
    }
    
    console.log('[Teacher Signup] Account created successfully');
    alert('teacher account created, redirecting');
    showToast('Account created successfully', 'success');
    setTimeout(() => { window.location.href = withSchool('teacher-login.html', schoolCode); }, 900);
  } catch (err) {
    console.error('[Teacher Signup] Error:', err); 
    showToast('Server error: ' + err.message);
  }
});

(function keepSchoolOnSignInLink() {
  const schoolCode = detectSchoolCode();
  const signInLink = document.querySelector('.signup a[href="teacher-login.html"]');
  if (signInLink && schoolCode) {
    signInLink.href = withSchool('teacher-login.html', schoolCode);
  }
})();

