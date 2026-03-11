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
      const u = url === '' ? '/api/health' : `${url.replace(/\/$/, '')}/api/health`;
      const res = await fetch(u, { signal: controller.signal });
      clearTimeout(id);
      return res.ok;
    } catch (_err) {
      clearTimeout(id);
      return false;
    }
  }

  for (const c of candidates) {
    const ok = await probe(c);
    if (ok) {
      API_BASE = c === '' ? '' : c;
      _apiBaseProbeResult = API_BASE;
      return API_BASE;
    }
  }

  _apiBaseProbeResult = null;
  throw new Error('No reachable API endpoint');
}

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

function isValidGmail(email) {
  return /^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(String(email || '').trim());
}

function detectSchoolCode() {
  // ensure school parameter exists in URL
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
  try {
    await probeApiBase();
  } catch (_err) {
    return;
  }

  const detected = detectSchoolCode();
  if (!detected) return;

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
      activeSchoolCode = detected;
    }
    if (school.id) {
      localStorage.setItem('sms.selectedSchoolId', String(school.id));
      localStorage.setItem('sms.selectedTenantId', String(school.id));
    }

    const schoolName = String(school.name || 'School Management System');
    const logo = String(school.logoData || '').trim();

    document.title = `Create Admin – ${schoolName}`;

    const schoolNameNode = document.getElementById('schoolName');
    if (schoolNameNode) schoolNameNode.textContent = `Create Admin`;

    const subtitleNode = document.getElementById('schoolSubtitle');
    if (subtitleNode) subtitleNode.textContent = `${schoolName} System`;

    const logoNode = document.getElementById('schoolLogo');
    if (logoNode && logo) logoNode.setAttribute('src', logo);

    const favicon = document.getElementById('schoolFavicon');
    if (favicon && logo) favicon.setAttribute('href', logo);

    const signInLink = document.getElementById('signinLink');
    if (signInLink) signInLink.setAttribute('href', withSchoolParam('auth.html?role=admin'));

    applySchoolTheme(school.branding || {});
  } catch (_err) {}
}

document.getElementById('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = adminName.value.trim();
  const email = signupEmail.value.trim();
  const password = signupPassword.value;
  const confirm = signupConfirm.value;
  const role = adminRole.value;

  if (!name || !email || !password || !confirm || !role) {
    showToast('Fill all fields');
    return;
  }

  if (!isValidGmail(email)) {
    showToast('Please use a valid Gmail address');
    return;
  }

  if (password !== confirm) {
    showToast('Passwords do not match');
    return;
  }

  if (password.length < 8) {
    showToast('Minimum 8 characters');
    return;
  }

  try {
    await probeApiBase();

    const schoolCode = String(activeSchoolCode || detectSchoolCode() || '').trim().toLowerCase();
    if (!schoolCode) {
      showToast('Please open signup from your selected school first.');
      return;
    }

    const schoolParam = `?school=${encodeURIComponent(schoolCode)}`;
    const res = await fetch(`${API_BASE}/api/admin/register${schoolParam}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-code': schoolCode
      },
      credentials: 'include',
      body: JSON.stringify({ name, email, password, role })
    });

    let data;
    try { data = await res.json(); } catch (_e) { data = null; }

    if (!res.ok) {
      const msg = (data && data.error) ? data.error : `Registration failed (HTTP ${res.status})`;
      showToast(msg);
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

    showToast('Account created', 'success');
    setTimeout(() => {
      window.location.href = withSchoolParam('auth.html?role=admin');
    }, 1000);
  } catch (err) {
    console.error(err);
    showToast('Server error');
  }
});

bootstrapSchoolBranding();



