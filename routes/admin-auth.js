const express = require('express');
const pool = require('../db');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { resolveTenantForRequest } = require('../middleware/tenant-context');
const controlPool = require('../db-control');
const { getTenantDataPool, getTenantById } = require('../services/tenant-db-manager');

const router = express.Router();

const SESSION_COOKIE_NAME = 'admin_session';
const OTP_EXPIRY_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 5;
const OTP_MAX_REQUESTS_PER_WINDOW = 3;
const OTP_REQUEST_WINDOW_MINUTES = 15;
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LOCK_MS = 15 * 60 * 1000;
const JWT_EXPIRY_HOURS = 8;
const JWT_REMEMBER_DAYS = 14;

const loginAttemptStore = new Map();

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function isValidGmail(email) {
    return /^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(String(email || '').trim());
}

function parseCookies(req) {
    const header = req.headers.cookie || '';
    const cookies = {};
    header.split(';').forEach((pair) => {
        const idx = pair.indexOf('=');
        if (idx === -1) return;
        const key = pair.slice(0, idx).trim();
        const value = pair.slice(idx + 1).trim();
        if (!key) return;
        cookies[key] = decodeURIComponent(value);
    });
    return cookies;
}

function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) return String(forwarded).split(',')[0].trim();
    return req.ip || req.connection?.remoteAddress || '';
}

function hashValue(raw) {
    return crypto.createHash('sha256').update(String(raw || '')).digest('hex');
}

function safeCompare(a, b) {
    const left = Buffer.from(String(a || ''));
    const right = Buffer.from(String(b || ''));
    if (left.length !== right.length) return false;
    return crypto.timingSafeEqual(left, right);
}

function getLockKey(email, ip) {
    return `${normalizeEmail(email)}|${String(ip || '')}`;
}

function registerFailedLoginAttempt(email, ip) {
    const key = getLockKey(email, ip);
    const now = Date.now();
    const existing = loginAttemptStore.get(key);
    if (!existing || now - existing.firstAt > LOGIN_WINDOW_MS) {
        loginAttemptStore.set(key, {
            count: 1,
            firstAt: now,
            lockedUntil: null
        });
        return;
    }

    existing.count += 1;
    if (existing.count >= LOGIN_MAX_ATTEMPTS) {
        existing.lockedUntil = now + LOGIN_LOCK_MS;
    }
    loginAttemptStore.set(key, existing);
}

function clearFailedLoginAttempts(email, ip) {
    loginAttemptStore.delete(getLockKey(email, ip));
}

function getLoginLockState(email, ip) {
    const record = loginAttemptStore.get(getLockKey(email, ip));
    if (!record) return { locked: false };

    const now = Date.now();
    if (record.lockedUntil && now < record.lockedUntil) {
        return { locked: true, retryAfterMs: record.lockedUntil - now };
    }

    if (record.lockedUntil && now >= record.lockedUntil) {
        loginAttemptStore.delete(getLockKey(email, ip));
    }

    return { locked: false };
}

async function getTableColumns(tableName, dbPool = pool) {
    const [rows] = await dbPool.query(
        `SELECT COLUMN_NAME
         FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = ?`,
        [tableName]
    );
    return new Set((rows || []).map((r) => String(r.COLUMN_NAME || '').toLowerCase()));
}

function hasExplicitTenantHint(req) {
    const tenantIdHint = req.headers['x-tenant-id']
        || req.query?.tenantId
        || req.query?.tenant_id
        || req.body?.tenantId
        || req.body?.tenant_id
        || null;

    const tenantCodeHint = req.headers['x-tenant-code']
        || req.query?.school
        || req.query?.tenant
        || req.query?.code
        || req.query?.tenantCode
        || req.query?.tenant_code
        || req.body?.school
        || req.body?.tenant
        || req.body?.code
        || req.body?.tenantCode
        || req.body?.tenant_code
        || null;

    return !!(tenantIdHint || tenantCodeHint);
}

async function resolveTenantForAdminRequest(req, options = {}) {
    const { requireExplicit = false } = options;

    if (requireExplicit && !hasExplicitTenantHint(req)) {
        return null;
    }

    return resolveTenantForRequest(req, {
        allowDefault: !requireExplicit,
        requireActive: true
    });
}

function isDatabasePerTenantTenant(tenant) {
    return String(tenant?.isolationMode || '').trim().toLowerCase() === 'database-per-tenant';
}

function isTenantProvisioned(tenant) {
    return String(tenant?.provisioningStatus || '').trim().toLowerCase() === 'provisioned';
}

async function getAdminAuthPoolForTenant(tenant) {
    if (!tenant || !tenant.id) return controlPool;
    if (!isDatabasePerTenantTenant(tenant)) return controlPool;
    if (!isTenantProvisioned(tenant)) {
        throw new Error('Tenant database is not provisioned yet');
    }

    const tenantPool = await getTenantDataPool(tenant);
    return tenantPool || controlPool;
}

async function getAdminAuthPoolByTenantId(tenantId) {
    const parsedTenantId = Number(tenantId || 0);
    if (!parsedTenantId) return controlPool;

    const tenant = await getTenantById(parsedTenantId);
    if (!tenant || !tenant.id) return controlPool;

    return getAdminAuthPoolForTenant(tenant);
}

async function ensureAdminAuthSchema(dbPool = pool) {
    await dbPool.query(`
        CREATE TABLE IF NOT EXISTS admin_sessions (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            admin_id INT NOT NULL,
            tenant_id INT NULL,
            token_hash VARCHAR(64) NOT NULL,
            remember_me TINYINT(1) DEFAULT 0,
            user_agent VARCHAR(512) NULL,
            ip_address VARCHAR(100) NULL,
            expires_at DATETIME NOT NULL,
            revoked_at DATETIME NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_admin_sessions_admin (admin_id),
            INDEX idx_admin_sessions_tenant (tenant_id),
            INDEX idx_admin_sessions_token (token_hash),
            INDEX idx_admin_sessions_expires (expires_at),
            CONSTRAINT fk_admin_sessions_admin
                FOREIGN KEY (admin_id) REFERENCES admins(id)
                ON DELETE CASCADE
        )
    `);

    await dbPool.query(`
        CREATE TABLE IF NOT EXISTS admin_login_otps (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            admin_id INT NOT NULL,
            code_hash VARCHAR(64) NOT NULL,
            expires_at DATETIME NOT NULL,
            attempts_left INT NOT NULL DEFAULT 5,
            remember_me TINYINT(1) DEFAULT 0,
            sent_to_email VARCHAR(255) NOT NULL,
            consumed_at DATETIME NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_admin_login_otps_admin (admin_id),
            INDEX idx_admin_login_otps_expires (expires_at),
            CONSTRAINT fk_admin_login_otps_admin
                FOREIGN KEY (admin_id) REFERENCES admins(id)
                ON DELETE CASCADE
        )
    `);

    const adminColumns = await getTableColumns('admins', dbPool);
    const adminSessionColumns = await getTableColumns('admin_sessions', dbPool);

    if (!adminColumns.has('password_hash')) {
        await dbPool.query('ALTER TABLE admins ADD COLUMN password_hash VARCHAR(255) NULL');
    }

    if (!adminColumns.has('tenant_id')) {
        await dbPool.query('ALTER TABLE admins ADD COLUMN tenant_id INT NULL');
    }

    if (!adminColumns.has('last_login_at')) {
        await dbPool.query('ALTER TABLE admins ADD COLUMN last_login_at DATETIME NULL');
    }

    if (!adminColumns.has('updated_at')) {
        await dbPool.query('ALTER TABLE admins ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
    }

    if (!adminSessionColumns.has('tenant_id')) {
        await dbPool.query('ALTER TABLE admin_sessions ADD COLUMN tenant_id INT NULL');
    }
}

async function ensureAdminSettingsTable(dbPool = pool) {
    await dbPool.query(`
        CREATE TABLE IF NOT EXISTS admin_settings (
            admin_id INT PRIMARY KEY,
            settings_json LONGTEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_admin_settings_admin
                FOREIGN KEY (admin_id) REFERENCES admins(id)
                ON DELETE CASCADE
        )
    `);
}

let resolvedJwtSecret = null;
let warnedAboutJwtFallback = false;

function getJwtSecret() {
    if (resolvedJwtSecret) return resolvedJwtSecret;

    const secret = String(process.env.JWT_SECRET || '').trim();
    if (secret) {
        resolvedJwtSecret = secret;
        return resolvedJwtSecret;
    }

    if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
        throw new Error('JWT_SECRET is required in production');
    }

    const devSecret = String(process.env.JWT_DEV_SECRET || 'dev-insecure-jwt-secret-change-me').trim();
    if (!warnedAboutJwtFallback) {
        console.warn('[Admin Auth] JWT_SECRET is not set. Using development fallback secret.');
        warnedAboutJwtFallback = true;
    }
    resolvedJwtSecret = devSecret;
    return resolvedJwtSecret;
}

function normalizePortalPageContent(input = {}) {
    const src = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    const asString = (value) => String(value || '').trim();
    return {
        heroTagline: asString(src.heroTagline),
        aboutTitle: asString(src.aboutTitle),
        aboutCardsHtml: String(src.aboutCardsHtml || ''),
        schoolInfoTitle: asString(src.schoolInfoTitle),
        schoolInfoCardsHtml: String(src.schoolInfoCardsHtml || ''),
        footerTagline: asString(src.footerTagline),
        contactHtml: String(src.contactHtml || ''),
        copyrightText: asString(src.copyrightText)
    };
}

function getBcryptRounds() {
    const parsed = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
    if (Number.isNaN(parsed)) return 12;
    return Math.max(10, Math.min(parsed, 15));
}

function createOtpCode() {
    const value = crypto.randomInt(0, 1000000);
    return String(value).padStart(6, '0');
}

function getOtpHash(email, otpCode) {
    const pepper = String(process.env.OTP_PEPPER || process.env.JWT_SECRET || 'otp-fallback-pepper');
    return hashValue(`${normalizeEmail(email)}|${String(otpCode || '')}|${pepper}`);
}

function setSessionCookie(req, res, token, rememberMe) {
    const secure = req.secure || String(req.headers['x-forwarded-proto'] || '').includes('https');
    const maxAge = rememberMe ? JWT_REMEMBER_DAYS * 24 * 60 * 60 * 1000 : JWT_EXPIRY_HOURS * 60 * 60 * 1000;
    res.cookie(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        secure,
        sameSite: 'lax',
        path: '/',
        maxAge
    });
}

function clearSessionCookie(req, res) {
    const secure = req.secure || String(req.headers['x-forwarded-proto'] || '').includes('https');
    res.clearCookie(SESSION_COOKIE_NAME, {
        httpOnly: true,
        secure,
        sameSite: 'lax',
        path: '/'
    });
}

function extractBearerToken(req) {
    const authHeader = String(req.headers.authorization || '').trim();
    if (authHeader.startsWith('Bearer ')) {
        return authHeader.slice(7).trim();
    }
    const cookies = parseCookies(req);
    const cookieToken = cookies[SESSION_COOKIE_NAME];
    if (cookieToken) return String(cookieToken).trim();
    return null;
}

async function createJwtSession(req, res, admin, tenantId, rememberMe = false, dbPool = pool) {
    const jwtSecret = getJwtSecret();
    const jti = crypto.randomBytes(16).toString('hex');
    const expiresIn = rememberMe ? `${JWT_REMEMBER_DAYS}d` : `${JWT_EXPIRY_HOURS}h`;
    const resolvedTenantId = Number(tenantId || admin.tenant_id || 0) || null;
    const token = jwt.sign(
        {
            sub: String(admin.id),
            email: admin.email,
            role: admin.role,
            type: 'admin',
            tid: resolvedTenantId,
            jti
        },
        jwtSecret,
        { expiresIn }
    );

    const expiresAt = new Date(Date.now() + (rememberMe
        ? JWT_REMEMBER_DAYS * 24 * 60 * 60 * 1000
        : JWT_EXPIRY_HOURS * 60 * 60 * 1000));

    await dbPool.query(
        `INSERT INTO admin_sessions
            (admin_id, tenant_id, token_hash, remember_me, user_agent, ip_address, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            admin.id,
            resolvedTenantId,
            hashValue(jti),
            rememberMe ? 1 : 0,
            String(req.headers['user-agent'] || '').slice(0, 512) || null,
            String(getClientIp(req) || '').slice(0, 100) || null,
            expiresAt
        ]
    );

    setSessionCookie(req, res, token, rememberMe);

    return token;
}

async function sendOtpEmail(recipientEmail, otpCode) {
    const user = String(process.env.GMAIL_USER || '').trim();
    const pass = String(process.env.GMAIL_APP_PASSWORD || '').trim();

    // in development environments we often don't have SMTP credentials; don't
    // fail the entire flow because of that. log the code instead so testers can
    // proceed.
    if (!user || !pass) {
        console.warn('[Admin Auth] OTP email not configured; falling back to console output');
        console.log(`[Admin OTP] to=${recipientEmail} code=${otpCode}`);
        return;
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass }
    });

    await transporter.sendMail({
        from: `"CNHS Admin Auth" <${user}>`,
        to: recipientEmail,
        subject: 'Your CNHS verification code',
        text: `Your verification code is ${otpCode}. It expires in ${OTP_EXPIRY_MINUTES} minutes. If you did not request this, ignore this email.`,
        html: `<p>Your verification code is <strong>${otpCode}</strong>.</p><p>This code expires in ${OTP_EXPIRY_MINUTES} minutes.</p><p>If you did not request this, please ignore this email.</p>`
    });
}

async function canIssueOtp(adminId, dbPool = pool) {
    const [rows] = await dbPool.query(
        `SELECT COUNT(*) AS cnt
         FROM admin_login_otps
         WHERE admin_id = ? AND created_at >= (NOW() - INTERVAL ? MINUTE)`,
        [adminId, OTP_REQUEST_WINDOW_MINUTES]
    );
    const count = Number(rows?.[0]?.cnt || 0);
    return count < OTP_MAX_REQUESTS_PER_WINDOW;
}

async function issueOtp(admin, rememberMe, dbPool = pool) {
    if (!(await canIssueOtp(admin.id, dbPool))) {
        return { ok: false, status: 429, error: 'Too many OTP requests. Please try again later.' };
    }

    const otpCode = createOtpCode();
    const otpHash = getOtpHash(admin.email, otpCode);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await dbPool.query(
        `UPDATE admin_login_otps
         SET consumed_at = NOW()
         WHERE admin_id = ? AND consumed_at IS NULL`,
        [admin.id]
    );

    await dbPool.query(
        `INSERT INTO admin_login_otps
            (admin_id, code_hash, expires_at, attempts_left, remember_me, sent_to_email)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [admin.id, otpHash, expiresAt, OTP_MAX_ATTEMPTS, rememberMe ? 1 : 0, admin.email]
    );

    let result = { ok: true };
    try {
        await sendOtpEmail(admin.email, otpCode);
    } catch (err) {
        console.error('OTP email delivery failed:', err);
        return { ok: false, status: 503, error: 'Verification code could not be sent. Please try again later.' };
    }

    // if sendOtpEmail logged the code (due to missing SMTP) we can surface it
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
        result.otpCode = otpCode;
    }
    return result;
}

async function verifyAndResolveAdminFromToken(req) {
    const token = extractBearerToken(req);
    if (!token) return null;

    let decoded;
    try {
        decoded = jwt.verify(token, getJwtSecret());
    } catch (_err) {
        return null;
    }

    if (!decoded || decoded.type !== 'admin' || !decoded.jti || !decoded.sub) {
        return null;
    }

    const tokenTenantId = Number(decoded.tid || 0) || null;
    const authPool = await getAdminAuthPoolByTenantId(tokenTenantId);

    const [rows] = await authPool.query(
        `SELECT s.id as session_id, s.expires_at, s.revoked_at, s.tenant_id AS session_tenant_id,
                a.id, a.email, a.name, a.role, a.account_status, a.tenant_id AS admin_tenant_id
         FROM admin_sessions s
         JOIN admins a ON a.id = s.admin_id
         WHERE s.token_hash = ? AND s.admin_id = ?
         LIMIT 1`,
        [hashValue(decoded.jti), Number(decoded.sub)]
    );

    if (!rows.length) return null;

    const row = rows[0];
    if (row.revoked_at) return null;
    if (row.account_status !== 'active') return null;
    if (new Date(row.expires_at).getTime() <= Date.now()) {
        await authPool.query('UPDATE admin_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?', [row.session_id]);
        return null;
    }

    const resolvedTenantId = Number(row.session_tenant_id || row.admin_tenant_id || tokenTenantId || req.tenantId || 0) || null;

    if (req.tenantId && resolvedTenantId && Number(req.tenantId) !== Number(resolvedTenantId)) {
        return null;
    }

    return {
        sessionId: row.session_id,
        token,
        authPool,
        admin: {
            id: row.id,
            email: row.email,
            name: row.name,
            role: row.role,
            tenant_id: resolvedTenantId
        },
        tenantId: resolvedTenantId
    };
}

async function requireAdminAuth(req, res, next) {
    try {
        const resolved = await verifyAndResolveAdminFromToken(req);
        if (!resolved) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        req.authAdmin = resolved.admin;
        req.authSessionId = resolved.sessionId;
        req.authToken = resolved.token;
        req.authTenantId = resolved.tenantId;
        req.authDbPool = resolved.authPool || pool;
        return next();
    } catch (err) {
        console.error('Admin auth middleware error:', err);
        return res.status(500).json({ error: 'Authentication check failed' });
    }
}

router.post('/register', async (req, res) => {
    const { email, password, name, role } = req.body || {};

    if (!email || !password || !name || !role) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!isValidGmail(email)) {
        return res.status(400).json({ error: 'A valid Gmail address is required' });
    }

    if (String(password || '').length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const validRoles = ['admin', 'guidance', 'master'];
    const normalizedRole = String(role || '').toLowerCase().trim();
    if (!validRoles.includes(normalizedRole)) {
        return res.status(400).json({ error: 'Invalid role' });
    }

    try {
        const tenant = await resolveTenantForAdminRequest(req, { requireExplicit: true });
        if (!tenant || !tenant.id) {
            return res.status(400).json({ error: 'School tenant context is required. Please open signup from the selected school.' });
        }
        const tenantId = Number(tenant.id);
        const tenantCode = String(tenant.code || '').trim().toLowerCase();
        const authPool = await getAdminAuthPoolForTenant(tenant);
        await ensureAdminAuthSchema(authPool);

        const normalizedEmail = normalizeEmail(email);
        const [existingAdmins] = await authPool.query(
            'SELECT id FROM admins WHERE email = ? AND (tenant_id = ? OR tenant_id IS NULL) LIMIT 1',
            [normalizedEmail, tenantId]
        );

        if (existingAdmins.length > 0) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        const passwordHash = await bcrypt.hash(String(password || ''), getBcryptRounds());

        const [result] = await authPool.query(
            `INSERT INTO admins
             (email, password, password_hash, name, role, account_status, tenant_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [normalizedEmail, passwordHash, passwordHash, String(name || '').trim(), normalizedRole, 'active', tenantId]
        );

        return res.status(201).json({
            success: true,
            message: 'Admin account created successfully',
            admin: {
                id: result.insertId,
                email: normalizedEmail,
                name: String(name || '').trim(),
                role: normalizedRole,
                tenantId,
                tenantCode
            },
            tenantId,
            tenantCode
        });
    } catch (err) {
        console.error('Admin registration error:', err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Email already exists' });
        }
        return res.status(500).json({ error: 'Registration failed' });
    }
});

router.post('/login', async (req, res) => {
    const { email, password, rememberMe } = req.body || {};

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }

    try {
        const tenant = await resolveTenantForAdminRequest(req, { requireExplicit: true });
        if (!tenant || !tenant.id) {
            return res.status(400).json({ error: 'School tenant context is required. Please open login from the selected school.' });
        }
        const tenantId = Number(tenant.id);
        const tenantCode = String(tenant.code || '').trim().toLowerCase();
        const authPool = await getAdminAuthPoolForTenant(tenant);
        await ensureAdminAuthSchema(authPool);

        const ip = getClientIp(req);
        const lockState = getLoginLockState(email, ip);
        if (lockState.locked) {
            return res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
        }

        // look for the admin record in the control database (ratings) and
        // allow either a tenant-specific entry or a global one.  the original
        // implementation intentionally prevented falling back to a global
        // account when a tenant id was supplied, which meant that manually
        // inserted admins with a NULL tenant_id would never be found.  that
        // was the root cause of the "invalid email or password" message even
        // though the credentials were correct.
        //
        // the query below orders by tenant_id DESC so that a record scoped to
        // the current tenant takes precedence over a NULL (global) row.
        const [rows] = await authPool.query(
            `SELECT id, email, name, role, account_status, password, password_hash, tenant_id
             FROM admins
             WHERE email = ? AND (tenant_id = ? OR tenant_id IS NULL)
             ORDER BY (tenant_id IS NULL), tenant_id DESC
             LIMIT 1`,
            [normalizeEmail(email), tenantId]
        );

        if (rows.length === 0) {
            registerFailedLoginAttempt(email, ip);
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const admin = rows[0];

        if (admin.tenant_id && Number(admin.tenant_id) !== tenantId) {
            return res.status(403).json({ error: 'Account is not assigned to this school tenant' });
        }

        if (!admin.tenant_id) {
            await authPool.query('UPDATE admins SET tenant_id = ? WHERE id = ? AND tenant_id IS NULL', [tenantId, admin.id]);
            admin.tenant_id = tenantId;
        }

        if (admin.account_status !== 'active') {
            return res.status(403).json({ error: 'Account is inactive' });
        }

        const candidateHash = String(admin.password_hash || admin.password || '');
        let passwordValid = false;
        if (candidateHash.startsWith('$2a$') || candidateHash.startsWith('$2b$') || candidateHash.startsWith('$2y$')) {
            passwordValid = await bcrypt.compare(String(password || ''), candidateHash);
        } else {
            passwordValid = String(password || '') === String(admin.password || '');
        }

        if (!passwordValid) {
            registerFailedLoginAttempt(email, ip);
            // disable OTP in development to avoid confusing flows
            if (String(process.env.NODE_ENV || '').toLowerCase() !== 'production') {
                return res.status(401).json({ error: 'Invalid email or password. Please try again.' });
            }
            const issued = await issueOtp(admin, !!rememberMe, authPool);
            if (!issued.ok) {
                return res.status(issued.status).json({ error: issued.error });
            }
            const responsePayload = {
                success: true,
                requiresOtp: true,
                message: 'Verification code has been sent to your Gmail.',
                tenantId,
                tenantCode
            };
            if (issued.otpCode) {
                responsePayload.debugOtp = issued.otpCode;
            }
            return res.status(200).json(responsePayload);
        }

        clearFailedLoginAttempts(email, ip);

        if (!String(admin.password_hash || '').startsWith('$2')) {
            const upgradedHash = await bcrypt.hash(String(password || ''), getBcryptRounds());
            await authPool.query(
                `UPDATE admins
                 SET password_hash = ?, password = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [upgradedHash, upgradedHash, admin.id]
            );
        }

        await authPool.query(
            `UPDATE admin_sessions
             SET revoked_at = CURRENT_TIMESTAMP
             WHERE admin_id = ? AND revoked_at IS NULL AND expires_at > NOW()`,
            [admin.id]
        );

        const token = await createJwtSession(req, res, admin, tenantId, !!rememberMe, authPool);
        await authPool.query('UPDATE admins SET last_login_at = NOW(), updated_at = CURRENT_TIMESTAMP WHERE id = ?', [admin.id]);

        return res.status(200).json({
            success: true,
            message: 'Login successful',
            token,
            admin: {
                id: admin.id,
                email: admin.email,
                name: admin.name,
                role: admin.role,
                tenantId,
                tenantCode
            },
            tenantId,
            tenantCode
        });
    } catch (err) {
        console.error('Admin login error:', err);
        return res.status(500).json({ error: 'Login failed' });
    }
});

router.post('/login/verify-otp', async (req, res) => {
    const { email, otp } = req.body || {};
    if (!email || !otp) {
        return res.status(400).json({ error: 'Email and OTP are required' });
    }

    try {
        const tenant = await resolveTenantForAdminRequest(req, { requireExplicit: true });
        if (!tenant || !tenant.id) {
            return res.status(400).json({ error: 'School tenant context is required. Please open login from the selected school.' });
        }
        const tenantId = Number(tenant.id);
        const tenantCode = String(tenant.code || '').trim().toLowerCase();
        const authPool = await getAdminAuthPoolForTenant(tenant);
        await ensureAdminAuthSchema(authPool);

        const [admins] = await authPool.query(
            `SELECT id, email, name, role, account_status, tenant_id
             FROM admins
             WHERE email = ? AND (tenant_id = ? OR tenant_id IS NULL)
             LIMIT 1`,
            [normalizeEmail(email), tenantId]
        );

        if (!admins.length) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const admin = admins[0];
        if (admin.tenant_id && Number(admin.tenant_id) !== tenantId) {
            return res.status(403).json({ error: 'Account is not assigned to this school tenant' });
        }
        if (!admin.tenant_id) {
            await authPool.query('UPDATE admins SET tenant_id = ? WHERE id = ? AND tenant_id IS NULL', [tenantId, admin.id]);
            admin.tenant_id = tenantId;
        }
        if (admin.account_status !== 'active') {
            return res.status(403).json({ error: 'Account is inactive' });
        }

        const [otpRows] = await authPool.query(
            `SELECT id, code_hash, expires_at, attempts_left, remember_me, consumed_at
             FROM admin_login_otps
             WHERE admin_id = ?
             ORDER BY created_at DESC
             LIMIT 1`,
            [admin.id]
        );

        if (!otpRows.length) {
            return res.status(400).json({ error: 'No active verification code. Please try logging in again.' });
        }

        const otpRecord = otpRows[0];

        if (otpRecord.consumed_at) {
            return res.status(400).json({ error: 'Verification code already used. Please try again.' });
        }

        if (new Date(otpRecord.expires_at).getTime() <= Date.now()) {
            await authPool.query('UPDATE admin_login_otps SET consumed_at = NOW() WHERE id = ?', [otpRecord.id]);
            return res.status(400).json({ error: 'Verification code expired. Please login again.' });
        }

        if (Number(otpRecord.attempts_left) <= 0) {
            return res.status(429).json({ error: 'Too many OTP attempts. Please login again.' });
        }

        const incomingHash = getOtpHash(admin.email, String(otp || '').trim());
        const codeValid = safeCompare(incomingHash, otpRecord.code_hash);

        if (!codeValid) {
            await authPool.query(
                'UPDATE admin_login_otps SET attempts_left = GREATEST(attempts_left - 1, 0), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [otpRecord.id]
            );
            return res.status(401).json({ error: 'Invalid verification code' });
        }

        await authPool.query('UPDATE admin_login_otps SET consumed_at = NOW() WHERE id = ?', [otpRecord.id]);

        await authPool.query(
            `UPDATE admin_sessions
             SET revoked_at = CURRENT_TIMESTAMP
             WHERE admin_id = ? AND revoked_at IS NULL AND expires_at > NOW()`,
            [admin.id]
        );

        const token = await createJwtSession(req, res, admin, tenantId, !!otpRecord.remember_me, authPool);
        await authPool.query('UPDATE admins SET last_login_at = NOW(), updated_at = CURRENT_TIMESTAMP WHERE id = ?', [admin.id]);

        return res.status(200).json({
            success: true,
            message: 'Login successful',
            token,
            admin: {
                id: admin.id,
                email: admin.email,
                name: admin.name,
                role: admin.role,
                tenantId,
                tenantCode
            },
            tenantId,
            tenantCode
        });
    } catch (err) {
        console.error('Admin OTP verification error:', err);
        return res.status(500).json({ error: 'OTP verification failed' });
    }
});

router.get('/me', requireAdminAuth, async (req, res) => {
    return res.status(200).json({ success: true, admin: req.authAdmin, tenantId: req.authTenantId || req.authAdmin.tenant_id || null });
});

router.post('/logout', requireAdminAuth, async (req, res) => {
    try {
        const authPool = req.authDbPool || pool;
        await ensureAdminAuthSchema(authPool);
        await authPool.query(
            'UPDATE admin_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = ? AND revoked_at IS NULL',
            [req.authSessionId]
        );
        clearSessionCookie(req, res);
        return res.status(200).json({ success: true, message: 'Logged out' });
    } catch (err) {
        console.error('Admin logout error:', err);
        return res.status(500).json({ error: 'Logout failed' });
    }
});

async function queryAdminContacts(dbPool, tenantId) {
    const [rows] = await dbPool.query(
        `SELECT id, name, email, role
         FROM admins
         WHERE account_status = 'active'
           AND (? IS NULL OR tenant_id = ?)
         ORDER BY created_at DESC`,
        [tenantId, tenantId]
    );

    return (rows || []).map((admin) => ({
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role || 'admin',
        type: 'admin',
        online: false
    }));
}

router.get('/contacts-public', async (req, res) => {
    try {
        const tenant = await resolveTenantForAdminRequest(req, { requireExplicit: true });
        if (!tenant || !tenant.id) {
            return res.status(400).json({ error: 'School tenant context is required' });
        }

        const authPool = await getAdminAuthPoolForTenant(tenant);
        const tenantId = Number(tenant.id || 0) || null;
        const admins = await queryAdminContacts(authPool, tenantId);

        return res.status(200).json({
            success: true,
            admins
        });
    } catch (err) {
        console.error('Error loading public admin contacts:', err);
        return res.status(500).json({ error: 'Failed to load admin contacts' });
    }
});

router.get('/contacts', requireAdminAuth, async (req, res) => {
    try {
        const authPool = req.authDbPool || pool;
        const tenantId = Number(req.authTenantId || req.authAdmin.tenant_id || 0) || null;
        const admins = await queryAdminContacts(authPool, tenantId);

        return res.status(200).json({
            success: true,
            admins
        });
    } catch (err) {
        console.error('Error loading admin contacts:', err);
        return res.status(500).json({ error: 'Failed to load admin contacts' });
    }
});

router.get('/:adminId/settings', requireAdminAuth, async (req, res) => {
    const adminId = parseInt(req.params.adminId, 10);
    if (!adminId || Number.isNaN(adminId)) {
        return res.status(400).json({ error: 'Invalid admin ID' });
    }

    if (req.authAdmin.role !== 'master' && Number(req.authAdmin.id) !== adminId) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    try {
        const authPool = req.authDbPool || pool;
        await ensureAdminSettingsTable(authPool);
        const [rows] = await authPool.query(
            'SELECT settings_json FROM admin_settings WHERE admin_id = ? LIMIT 1',
            [adminId]
        );

        if (!rows.length) {
            return res.status(200).json({ success: true, settings: null });
        }

        let parsed = null;
        try {
            parsed = JSON.parse(rows[0].settings_json || '{}');
        } catch (_err) {
            parsed = null;
        }

        return res.status(200).json({ success: true, settings: parsed });
    } catch (err) {
        console.error('Error loading admin settings:', err);
        return res.status(500).json({ error: 'Failed to load admin settings' });
    }
});

router.get('/portal-page-content', requireAdminAuth, async (req, res) => {
    try {
        const tenantId = Number(req.authTenantId || req.authAdmin.tenant_id || 0) || null;
        if (!tenantId) {
            return res.status(400).json({ error: 'No active tenant found for this admin' });
        }

        const [rows] = await pool.query(
            'SELECT branding_json FROM tenants WHERE id = ? LIMIT 1',
            [tenantId]
        );

        if (!rows.length) {
            return res.status(404).json({ error: 'Tenant not found' });
        }

        let branding = {};
        try {
            branding = JSON.parse(rows[0].branding_json || '{}') || {};
        } catch (_err) {
            branding = {};
        }

        const content = normalizePortalPageContent(branding.pageContent || {});
        return res.status(200).json({ success: true, tenantId, content });
    } catch (err) {
        console.error('Error loading portal page content:', err);
        return res.status(500).json({ error: 'Failed to load portal page content' });
    }
});

router.put('/portal-page-content', requireAdminAuth, async (req, res) => {
    try {
        const tenantId = Number(req.authTenantId || req.authAdmin.tenant_id || 0) || null;
        if (!tenantId) {
            return res.status(400).json({ error: 'No active tenant found for this admin' });
        }

        const body = req.body || {};
        if (!body.content || typeof body.content !== 'object' || Array.isArray(body.content)) {
            return res.status(400).json({ error: 'Invalid content payload' });
        }

        const normalizedContent = normalizePortalPageContent(body.content);

        const [rows] = await pool.query(
            'SELECT branding_json FROM tenants WHERE id = ? LIMIT 1',
            [tenantId]
        );

        if (!rows.length) {
            return res.status(404).json({ error: 'Tenant not found' });
        }

        let branding = {};
        try {
            branding = JSON.parse(rows[0].branding_json || '{}') || {};
        } catch (_err) {
            branding = {};
        }

        branding.pageContent = normalizedContent;

        await pool.query(
            'UPDATE tenants SET branding_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [JSON.stringify(branding), tenantId]
        );

        return res.status(200).json({ success: true, message: 'Portal page content saved', tenantId, content: normalizedContent });
    } catch (err) {
        console.error('Error saving portal page content:', err);
        return res.status(500).json({ error: 'Failed to save portal page content' });
    }
});

router.put('/:adminId/settings', requireAdminAuth, async (req, res) => {
    const adminId = parseInt(req.params.adminId, 10);
    const { settings } = req.body || {};

    if (!adminId || Number.isNaN(adminId)) {
        return res.status(400).json({ error: 'Invalid admin ID' });
    }

    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
        return res.status(400).json({ error: 'Invalid settings payload' });
    }

    if (req.authAdmin.role !== 'master' && Number(req.authAdmin.id) !== adminId) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    try {
        const authPool = req.authDbPool || pool;
        await ensureAdminSettingsTable(authPool);

        const [adminRows] = await authPool.query('SELECT id FROM admins WHERE id = ? LIMIT 1', [adminId]);
        if (!adminRows.length) {
            return res.status(404).json({ error: 'Admin not found' });
        }

        const settingsJson = JSON.stringify(settings);
        await authPool.query(
            `INSERT INTO admin_settings (admin_id, settings_json)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE
                settings_json = VALUES(settings_json),
                updated_at = CURRENT_TIMESTAMP`,
            [adminId, settingsJson]
        );

        return res.status(200).json({ success: true, message: 'Settings saved' });
    } catch (err) {
        console.error('Error saving admin settings:', err);
        return res.status(500).json({ error: 'Failed to save admin settings' });
    }
});

module.exports = router;
module.exports.requireAdminAuth = requireAdminAuth;



