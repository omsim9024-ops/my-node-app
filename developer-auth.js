const DEVELOPER_AUTH_KEYS = {
    session: 'sms.developerSession.v1'
};

const DEVELOPER_SESSION_TTL_MS = 1000 * 60 * 60 * 12;

function readDeveloperJson(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        return parsed ?? fallback;
    } catch (_err) {
        return fallback;
    }
}

function writeDeveloperJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function normalizeDeveloperEmail(email) {
    return String(email || '').trim().toLowerCase();
}

async function developerAuthApi(path, method = 'GET', body) {
    const headers = { 'Content-Type': 'application/json' };
    const existing = getDeveloperSession();
    if (existing && existing.token) {
        headers.Authorization = `Bearer ${existing.token}`;
    }

    const response = await fetch(path, {
        method,
        headers,
        ...(body ? { body: JSON.stringify(body) } : {})
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload.error || `HTTP ${response.status}`);
    }

    return payload;
}

function buildDeveloperRedirectTarget(fallback = 'developer-dashboard.html') {
    try {
        const params = new URLSearchParams(window.location.search || '');
        const next = String(params.get('next') || '').trim();
        if (!next) return fallback;
        if (/^https?:\/\//i.test(next)) return fallback;
        if (next.startsWith('//')) return fallback;
        return next;
    } catch (_err) {
        return fallback;
    }
}

function getDeveloperSession() {
    const session = readDeveloperJson(DEVELOPER_AUTH_KEYS.session, null);
    if (!session || typeof session !== 'object') return null;
    const createdAt = Number(session.createdAt || 0);
    if (!createdAt || Date.now() - createdAt > DEVELOPER_SESSION_TTL_MS) {
        localStorage.removeItem(DEVELOPER_AUTH_KEYS.session);
        return null;
    }
    if (!session.token || !session.developer || !session.developer.email) {
        localStorage.removeItem(DEVELOPER_AUTH_KEYS.session);
        return null;
    }
    return session;
}

function setDeveloperSession(sessionPayload) {
    const normalized = {
        token: String(sessionPayload.token || ''),
        expiresAt: String(sessionPayload.expiresAt || ''),
        developer: {
            id: sessionPayload.developer && sessionPayload.developer.id,
            fullName: sessionPayload.developer && sessionPayload.developer.fullName,
            email: normalizeDeveloperEmail(sessionPayload.developer && sessionPayload.developer.email)
        },
        createdAt: Date.now()
    };
    writeDeveloperJson(DEVELOPER_AUTH_KEYS.session, normalized);
    return normalized;
}

function getDeveloperAuthHeaders() {
    const session = getDeveloperSession();
    if (!session || !session.token) return {};
    return {
        Authorization: `Bearer ${session.token}`
    };
}

async function logoutDeveloper(options = {}) {
    const session = getDeveloperSession();
    if (session && session.token) {
        try {
            await fetch('/api/system-health/developer-auth/signout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.token}`
                }
            });
        } catch (_err) {}
    }

    localStorage.removeItem(DEVELOPER_AUTH_KEYS.session);
    if (options.redirect !== false) {
        window.location.href = String(options.redirectTo || 'developer-signin.html');
    }
}

async function registerDeveloper(input = {}) {
    const fullName = String(input.fullName || '').trim();
    const email = normalizeDeveloperEmail(input.email);
    const password = String(input.password || '');

    if (!fullName) return { success: false, error: 'Full name is required.' };
    if (!email || !email.includes('@')) return { success: false, error: 'Valid email is required.' };
    if (password.length < 8) return { success: false, error: 'Password must be at least 8 characters.' };

    try {
        const payload = await developerAuthApi('/api/system-health/developer-auth/signup', 'POST', {
            fullName,
            email,
            password
        });

        setDeveloperSession(payload);
        return {
            success: true,
            session: getDeveloperSession(),
            account: payload.developer
        };
    } catch (err) {
        return { success: false, error: String(err.message || err) };
    }
}

async function signInDeveloper(input = {}) {
    const email = normalizeDeveloperEmail(input.email);
    const password = String(input.password || '');

    if (!email || !password) {
        return { success: false, error: 'Email and password are required.' };
    }

    try {
        const payload = await developerAuthApi('/api/system-health/developer-auth/signin', 'POST', {
            email,
            password
        });
        setDeveloperSession(payload);
        return {
            success: true,
            session: getDeveloperSession(),
            account: payload.developer
        };
    } catch (err) {
        return { success: false, error: String(err.message || err) };
    }
}

function requireDeveloperAuth(options = {}) {
    const session = getDeveloperSession();
    if (session) return true;

    const redirectTo = String(options.redirectTo || 'developer-signin.html');
    const next = `${window.location.pathname.split('/').pop() || 'developer-dashboard.html'}${window.location.search || ''}${window.location.hash || ''}`;
    const url = `${redirectTo}?next=${encodeURIComponent(next)}`;
    window.location.replace(url);
    return false;
}

window.DEVELOPER_AUTH_KEYS = DEVELOPER_AUTH_KEYS;
window.buildDeveloperRedirectTarget = buildDeveloperRedirectTarget;
window.getDeveloperSession = getDeveloperSession;
window.getDeveloperAuthHeaders = getDeveloperAuthHeaders;
window.logoutDeveloper = logoutDeveloper;
window.registerDeveloper = registerDeveloper;
window.signInDeveloper = signInDeveloper;
window.requireDeveloperAuth = requireDeveloperAuth;

