// ================= CONFIG =================
const BACKEND_ORIGIN = window.location.origin;
let API_BASE = BACKEND_ORIGIN;
let _apiBaseProbeResult = null;
let activeSchoolCode = '';

async function probeApiBase(timeout = 2000) {
  if (_apiBaseProbeResult !== null) return _apiBaseProbeResult;

  const candidates = [];
  const host = window.location.hostname;
  const proto = window.location.protocol || 'http:';
  const currentPort = window.location.port;

  if (host) {
    if (BACKEND_ORIGIN) candidates.push(BACKEND_ORIGIN);
    candidates.push(`${proto}//${host}:3000`);
    candidates.push(`${proto}//${host}:3001`);
    candidates.push(`${proto}//${host}:3002`);
    if (currentPort !== '3000' && BACKEND_ORIGIN) candidates.push(BACKEND_ORIGIN);
  }
  if (BACKEND_ORIGIN && !candidates.includes(BACKEND_ORIGIN)) candidates.push(BACKEND_ORIGIN);
  candidates.push('');

  async function probe(url) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const endpoint = url === '' ? '/api/health' : `${url.replace(/\/$/, '')}/api/health`;
      const res = await fetch(endpoint, { signal: controller.signal });
      clearTimeout(id);
      return res.ok;
    } catch (_err) {
      clearTimeout(id);
      return false;
    }
  }

  for (const candidate of candidates) {
    const ok = await probe(candidate);
    if (ok) {
      API_BASE = candidate === '' ? '' : candidate;
      _apiBaseProbeResult = API_BASE;
      return API_BASE;
    }
  }

  _apiBaseProbeResult = null;
  throw new Error('No reachable API endpoint');
}

// ================= TOAST =================
function showToast(message, type = 'error') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 50);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ================= INPUTS =================
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const rememberMeInput = document.getElementById('rememberMe');
const otpGroup = document.getElementById('otpGroup');
const otpInput = document.getElementById('otpCode');
const otpVerifyBtn = document.getElementById('otpVerifyBtn');
const loginBtn = document.querySelector('.btn-login');

let pendingOtpEmail = null;
let pendingRememberMe = false;

function storeAdminSession(adminData, token, rememberMe) {
  const payload = {
    id: adminData?.id,
    email: adminData?.email,
    name: adminData?.name,
    role: adminData?.role,
    token,
    loginTime: new Date().toISOString()
  };

  if (typeof sessionManager !== 'undefined' && sessionManager.loginTab) {
    sessionManager.loginTab(payload, 'admin');
  }

  localStorage.setItem('adminData', JSON.stringify(payload));
  localStorage.setItem('adminAuthToken', String(token || ''));
  if (rememberMe) localStorage.setItem('rememberAdmin', 'true');
}

function detectSchoolCode() {
  // enforce existence of school param, fallback to default-school when needed
  try {
    const existing = new URLSearchParams(window.location.search || '');
    let existingSchool = String(existing.get('school') || '').trim().toLowerCase();
    if (/^\d+$/.test(existingSchool)) {
      existingSchool = '';
      existing.delete('school');
    }
    if (!existingSchool) {
      // capture default-school from referrer if available
      try {
        const ref = document.referrer || '';
        const m = /[?&]school=([^&]+)/.exec(ref);
        if (m && m[1]) {
          existingSchool = decodeURIComponent(m[1]).trim().toLowerCase();
          existing.set('school', existingSchool);
          const newUrl = `${window.location.pathname}?${existing.toString()}${window.location.hash||''}`;
          window.history.replaceState(null, '', newUrl);
        }
      } catch (_e) {}
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

function applySchoolTheme(branding) {
  const theme = branding && typeof branding === 'object' ? branding : {};
  const root = document.documentElement;
  const brand900 = String(theme.brand900 || '').trim();
  const brand700 = String(theme.brand700 || theme.primary || '').trim();
  const brand600 = String(theme.brand600 || theme.secondary || '').trim();
  const accent = String(theme.accent || brand700 || '').trim();

  if (brand900) root.style.setProperty('--school-brand-900', brand900);
  if (brand700) root.style.setProperty('--school-brand-700', brand700);
  if (brand600) root.style.setProperty('--school-brand-600', brand600);
  if (accent) root.style.setProperty('--school-accent', accent);
}

async function bootstrapSchoolBranding() {
  try {
    await probeApiBase();
  } catch (_err) {
    return;
  }

  const detected = detectSchoolCode();
  if (!detected) return;
  // preserve explicit school code (even default-school) in storage so
  // later pages without params fallback correctly
  localStorage.setItem('sms.selectedSchoolCode', detected);
  localStorage.setItem('sms.selectedTenantCode', detected);

  const endpoint = detected
    ? `${API_BASE}/api/system-health/schools/resolve?code=${encodeURIComponent(detected)}`
    : `${API_BASE}/api/system-health/schools/resolve`;

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
      // keep explicit query value
      activeSchoolCode = detected;
    }
    if (school.id) {
      localStorage.setItem('sms.selectedSchoolId', String(school.id));
      localStorage.setItem('sms.selectedTenantId', String(school.id));
    }

    const schoolName = String(school.name || 'School Management System');
    const logo = String(school.logoData || '').trim();

    document.title = `Admin Login – ${schoolName}`;

    const schoolNameNode = document.getElementById('schoolName');
    if (schoolNameNode) schoolNameNode.textContent = schoolName;

    const logoNode = document.getElementById('schoolLogo');
    if (logoNode && logo) logoNode.setAttribute('src', logo);

    const favicon = document.getElementById('schoolFavicon');
    if (favicon && logo) favicon.setAttribute('href', logo);

    const signupLink = document.getElementById('signupLink');
    if (signupLink) signupLink.setAttribute('href', withSchoolParam('auth.html?role=admin&tab=register'));

    applySchoolTheme(school.branding || {});
  } catch (_err) {}
}

function redirectByRole(role) {
  if (role && String(role).toLowerCase() === 'guidance') {
    window.location.href = withSchoolParam('guidance-dashboard.html');
    return;
  }
  window.location.href = withSchoolParam('admin-dashboard.html');
}

async function handleLoginSubmit(e) {
  e.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const rememberMe = !!rememberMeInput.checked;

  if (!email || !password) {
    showToast('Please fill in all fields');
    return;
  }

  loginBtn.textContent = 'Signing in...';
  loginBtn.disabled = true;

  try {
    await probeApiBase();

    const schoolCode = String(activeSchoolCode || detectSchoolCode() || '').trim().toLowerCase();
    if (!schoolCode) {
      showToast('Please open login from your selected school first.');
      loginBtn.textContent = 'Sign In';
      loginBtn.disabled = false;
      return;
    }

    const schoolParam = `?school=${encodeURIComponent(schoolCode)}`;
    const response = await fetch(`${API_BASE}/api/admin/login${schoolParam}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-code': schoolCode
      },
      credentials: 'include',
      body: JSON.stringify({ email, password, rememberMe })
    });

    let data = null;
    try { data = await response.json(); } catch (_err) { data = null; }

    if (!response.ok) {
      showToast((data && data.error) || 'Login failed');
      loginBtn.textContent = 'Sign In';
      loginBtn.disabled = false;
      return;
    }

    if (data && data.requiresOtp) {
      const tenantCode = String((data && data.tenantCode) || schoolCode || '').trim().toLowerCase();
      if (tenantCode) {
        activeSchoolCode = tenantCode;
        localStorage.setItem('sms.selectedSchoolCode', tenantCode);
        localStorage.setItem('sms.selectedTenantCode', tenantCode);
      }
      pendingOtpEmail = email;
      pendingRememberMe = rememberMe;
      otpGroup.style.display = 'flex';
      otpVerifyBtn.style.display = 'block';
      otpInput.focus();
      showToast(data.message || 'Verification code sent to your Gmail.', 'success');
      loginBtn.textContent = 'Sign In';
      loginBtn.disabled = false;
      return;
    }

    if (!data || !data.token || !data.admin) {
      showToast('Invalid login response');
      loginBtn.textContent = 'Sign In';
      loginBtn.disabled = false;
      return;
    }

    const tenantCode = String((data && data.tenantCode) || schoolCode || '').trim().toLowerCase();
    if (tenantCode) {
      activeSchoolCode = tenantCode;
      localStorage.setItem('sms.selectedSchoolCode', tenantCode);
      localStorage.setItem('sms.selectedTenantCode', tenantCode);
    }
    if (data && data.tenantId) {
      localStorage.setItem('sms.selectedSchoolId', String(data.tenantId));
      localStorage.setItem('sms.selectedTenantId', String(data.tenantId));
    }

    storeAdminSession(data.admin, data.token, rememberMe);
    showToast('Login successful', 'success');
    setTimeout(() => redirectByRole(data.admin.role), 800);
  } catch (err) {
    console.error(err);
    showToast('Server unreachable');
    loginBtn.textContent = 'Sign In';
    loginBtn.disabled = false;
  }
}

async function handleOtpVerify() {
  const otp = otpInput.value.trim();

  if (!pendingOtpEmail) {
    showToast('Please login first');
    return;
  }

  if (!/^\d{6}$/.test(otp)) {
    showToast('Enter a valid 6-digit code');
    return;
  }

  otpVerifyBtn.disabled = true;
  otpVerifyBtn.textContent = 'Verifying...';

  try {
    await probeApiBase();

    const schoolCode = String(activeSchoolCode || detectSchoolCode() || '').trim().toLowerCase();
    if (!schoolCode) {
      showToast('Please open login from your selected school first.');
      otpVerifyBtn.disabled = false;
      otpVerifyBtn.textContent = 'Verify Code';
      return;
    }

    const schoolParam = `?school=${encodeURIComponent(schoolCode)}`;
    const response = await fetch(`${API_BASE}/api/admin/login/verify-otp${schoolParam}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-code': schoolCode
      },
      credentials: 'include',
      body: JSON.stringify({
        email: pendingOtpEmail,
        otp,
        rememberMe: pendingRememberMe
      })
    });

    let data = null;
    try { data = await response.json(); } catch (_err) { data = null; }

    if (!response.ok) {
      showToast((data && data.error) || 'OTP verification failed');
      otpVerifyBtn.disabled = false;
      otpVerifyBtn.textContent = 'Verify Code';
      return;
    }

    if (!data || !data.token || !data.admin) {
      showToast('Invalid OTP response');
      otpVerifyBtn.disabled = false;
      otpVerifyBtn.textContent = 'Verify Code';
      return;
    }

    const tenantCode = String((data && data.tenantCode) || schoolCode || '').trim().toLowerCase();
    if (tenantCode) {
      activeSchoolCode = tenantCode;
      localStorage.setItem('sms.selectedSchoolCode', tenantCode);
      localStorage.setItem('sms.selectedTenantCode', tenantCode);
    }
    if (data && data.tenantId) {
      localStorage.setItem('sms.selectedSchoolId', String(data.tenantId));
      localStorage.setItem('sms.selectedTenantId', String(data.tenantId));
    }

    storeAdminSession(data.admin, data.token, pendingRememberMe);
    showToast('Login successful', 'success');
    setTimeout(() => redirectByRole(data.admin.role), 800);
  } catch (err) {
    console.error(err);
    showToast('Server error');
    otpVerifyBtn.disabled = false;
    otpVerifyBtn.textContent = 'Verify Code';
  }
}

loginForm.addEventListener('submit', handleLoginSubmit);
if (otpVerifyBtn) {
  otpVerifyBtn.addEventListener('click', handleOtpVerify);
}

bootstrapSchoolBranding();



