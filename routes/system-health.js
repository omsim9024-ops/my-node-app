const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { provisionTenantDatabase, buildTenantDatabaseName, dropTenantDatabase } = require('../services/tenant-provisioning');

const router = express.Router();

const requestLogPath = path.join(__dirname, '..', 'server-requests.log');
const dashboardStatePath = path.join(__dirname, '..', 'developer-dashboard-state.json');
const developerBackupsDir = path.join(__dirname, '..', 'backups', 'developer-dashboard');
const TENANT_LOGO_MAX_BYTES = 1024 * 1024;
const DEFAULT_TENANT_CODE = String(process.env.DEFAULT_TENANT_CODE || process.env.SCHOOL_CODE || 'default-school')
    .trim()
    .toLowerCase();
const CONTROL_DB_NAME = String(process.env.DB_NAME || 'ratings').trim();
const DEVELOPER_JWT_SECRET = String(process.env.DEVELOPER_JWT_SECRET || process.env.JWT_SECRET || '').trim();
const DEVELOPER_JWT_EXPIRES_HOURS = Math.max(1, Number(process.env.DEVELOPER_JWT_EXPIRES_HOURS || 12));
const DEVELOPER_BCRYPT_ROUNDS = 10;

const DEFAULT_STATE = {
    maintenanceMode: false,
    selectedTenantId: null,
    featureFlags: {
        systemHealthMonitoring: true,
        realtimeAnalytics: true,
        securityPanel: true,
        databaseManagement: true,
        errorDebugConsole: true,
        userActivityTracker: true,
        apiMonitoring: true,
        performanceInsights: true,
        versionControlPanel: true
    }
};

function toNumber(value, fallback = 0) {
    const converted = Number(value);
    return Number.isFinite(converted) ? converted : fallback;
}

function formatUptime(totalSeconds) {
    const seconds = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remaining = seconds % 60;
    return `${hours}h ${minutes}m ${remaining}s`;
}

function sanitizeIdentifier(name) {
    if (!/^[a-zA-Z0-9_]+$/.test(String(name || ''))) return null;
    return String(name);
}

function parseUserAgent(agent = '') {
    const ua = String(agent || '').toLowerCase();
    const browser = ua.includes('edg/') ? 'Edge'
        : ua.includes('chrome/') ? 'Chrome'
        : ua.includes('firefox/') ? 'Firefox'
        : ua.includes('safari/') ? 'Safari'
        : ua.includes('postman') ? 'Postman'
        : 'Other';

    const device = ua.includes('mobile') ? 'Mobile'
        : ua.includes('tablet') ? 'Tablet'
        : 'Desktop';

    return { browser, device };
}

function normalizeDeveloperEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function hashToken(value) {
    return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function readBearerToken(req) {
    const authHeader = String(req.headers.authorization || '').trim();
    if (/^Bearer\s+/i.test(authHeader)) {
        return authHeader.replace(/^Bearer\s+/i, '').trim();
    }

    const fallback = String(req.headers['x-developer-token'] || '').trim();
    return fallback || '';
}

async function ensureDeveloperAuthSchema() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS developer_accounts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            full_name VARCHAR(160) NOT NULL,
            email VARCHAR(190) NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_developer_accounts_email (email)
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS developer_sessions (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            developer_id INT NOT NULL,
            token_hash VARCHAR(64) NOT NULL,
            user_agent VARCHAR(512) NULL,
            ip_address VARCHAR(120) NULL,
            expires_at DATETIME NOT NULL,
            revoked_at DATETIME NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_developer_sessions_dev (developer_id),
            INDEX idx_developer_sessions_hash (token_hash),
            INDEX idx_developer_sessions_expires (expires_at),
            CONSTRAINT fk_developer_sessions_account FOREIGN KEY (developer_id) REFERENCES developer_accounts(id) ON DELETE CASCADE
        )
    `);
}

function buildDeveloperJwtPayload(account) {
    return {
        sub: Number(account.id),
        email: normalizeDeveloperEmail(account.email),
        type: 'developer'
    };
}

function signDeveloperToken(account) {
    if (!DEVELOPER_JWT_SECRET) {
        throw new Error('Developer JWT secret is not configured');
    }

    return jwt.sign(buildDeveloperJwtPayload(account), DEVELOPER_JWT_SECRET, {
        expiresIn: `${DEVELOPER_JWT_EXPIRES_HOURS}h`
    });
}

async function createDeveloperSession(account, req) {
    const token = signDeveloperToken(account);
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + DEVELOPER_JWT_EXPIRES_HOURS * 60 * 60 * 1000);
    const userAgent = String(req.headers['user-agent'] || '').slice(0, 500) || null;
    const ipAddress = String((req.headers['x-forwarded-for'] || '').split(',')[0] || req.ip || '').trim() || null;

    await pool.query(
        `INSERT INTO developer_sessions (developer_id, token_hash, user_agent, ip_address, expires_at)
         VALUES (?, ?, ?, ?, ?)`,
        [Number(account.id), tokenHash, userAgent, ipAddress, expiresAt]
    );

    return {
        token,
        expiresAt: expiresAt.toISOString(),
        developer: {
            id: Number(account.id),
            fullName: String(account.full_name || account.fullName || ''),
            email: normalizeDeveloperEmail(account.email)
        }
    };
}

async function resolveDeveloperRequest(req) {
    const token = readBearerToken(req);
    if (!token) return null;

    let decoded;
    try {
        decoded = jwt.verify(token, DEVELOPER_JWT_SECRET);
    } catch (_err) {
        return null;
    }

    if (!decoded || decoded.type !== 'developer') return null;
    const developerId = toNumber(decoded.sub, 0);
    if (!developerId) return null;

    const tokenHash = hashToken(token);
    const rows = await safeQuery(
        `SELECT s.id, s.expires_at, s.revoked_at, d.id AS developer_id, d.full_name, d.email
         FROM developer_sessions s
         JOIN developer_accounts d ON d.id = s.developer_id
         WHERE s.token_hash = ?
           AND s.developer_id = ?
         ORDER BY s.id DESC
         LIMIT 1`,
        [tokenHash, developerId],
        []
    );

    if (!Array.isArray(rows) || !rows.length) return null;
    const session = rows[0];
    if (session.revoked_at) return null;

    const expiresAt = new Date(session.expires_at).getTime();
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;

    return {
        sessionId: Number(session.id),
        token,
        developer: {
            id: Number(session.developer_id),
            fullName: String(session.full_name || ''),
            email: normalizeDeveloperEmail(session.email)
        }
    };
}

async function safeQuery(sql, params = [], fallbackRows = []) {
    try {
        const [rows] = await pool.query(sql, params);
        return rows;
    } catch (err) {
        console.warn('[system-health] query failed:', sql, err && err.message ? err.message : err);
        return fallbackRows;
    }
}

async function safeCount(sql, params = []) {
    const rows = await safeQuery(sql, params, [{ count: 0 }]);
    const first = Array.isArray(rows) && rows.length ? rows[0] : { count: 0 };
    return toNumber(first.count, 0);
}

async function checkDbConnectivity() {
    try {
        await pool.query('SELECT 1 AS ok');
        return 'Online';
    } catch (_err) {
        return 'Offline';
    }
}

async function readDashboardState() {
    try {
        const raw = await fs.readFile(dashboardStatePath, 'utf8');
        const parsed = JSON.parse(raw);
        return {
            maintenanceMode: !!parsed.maintenanceMode,
            selectedTenantId: toNumber(parsed.selectedTenantId, 0) || null,
            featureFlags: {
                ...DEFAULT_STATE.featureFlags,
                ...(parsed.featureFlags || {})
            }
        };
    } catch (_err) {
        return { ...DEFAULT_STATE };
    }
}

function normalizeTenantCode(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return null;
    if (!/^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/.test(normalized)) return null;
    return normalized;
}

function parseSafeJson(value, fallback = {}) {
    if (value === null || value === undefined || value === '') return fallback;
    if (typeof value === 'object') return value;
    try {
        const parsed = JSON.parse(String(value));
        return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch (_err) {
        return fallback;
    }
}

function estimateLogoPayloadBytes(value) {
    const raw = String(value || '').trim();
    if (!raw) return 0;

    const commaIndex = raw.indexOf(',');
    const header = commaIndex >= 0 ? raw.slice(0, commaIndex) : '';
    const body = commaIndex >= 0 ? raw.slice(commaIndex + 1) : raw;

    if (/;base64/i.test(header)) {
        const normalized = body.replace(/\s+/g, '');
        const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
        return Math.max(0, Math.floor((normalized.length * 3) / 4) - padding);
    }

    return Buffer.byteLength(raw, 'utf8');
}

async function tableHasColumn(tableName, columnName) {
    const rows = await safeQuery(
        `SELECT 1
         FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?
         LIMIT 1`,
        [tableName, columnName],
        []
    );
    return Array.isArray(rows) && rows.length > 0;
}

async function ensureColumn(tableName, columnName, ddl) {
    const exists = await tableHasColumn(tableName, columnName);
    if (exists) return;
    await pool.query(`ALTER TABLE \`${tableName}\` ADD COLUMN ${ddl}`);
}

async function ensureTenantSupportSchema() {
    await ensureTenantsTable();
    await ensureColumn('tenants', 'school_id', 'school_id VARCHAR(100) NULL');
    await ensureColumn('tenants', 'domain', 'domain VARCHAR(255) NULL');
    await ensureColumn('tenants', 'location', 'location VARCHAR(255) NULL');
    await ensureColumn('tenants', 'logo_data', 'logo_data LONGTEXT NULL');
    await ensureColumn('tenants', 'branding_json', 'branding_json LONGTEXT NULL');
    await ensureColumn('tenants', 'modules_json', 'modules_json LONGTEXT NULL');
    await ensureColumn('tenants', 'isolation_mode', "isolation_mode VARCHAR(40) NOT NULL DEFAULT 'row-level-tenant-id'");
    await ensureColumn('tenants', 'db_name', 'db_name VARCHAR(128) NULL');
    await ensureColumn('tenants', 'db_host', 'db_host VARCHAR(255) NULL');
    await ensureColumn('tenants', 'db_port', 'db_port INT NULL');
    await ensureColumn('tenants', 'db_user', 'db_user VARCHAR(120) NULL');
    await ensureColumn('tenants', 'db_secret_ref', 'db_secret_ref VARCHAR(255) NULL');
    await ensureColumn('tenants', 'provisioning_status', "provisioning_status VARCHAR(40) NOT NULL DEFAULT 'not-started'");
    await ensureColumn('tenants', 'provisioning_error', 'provisioning_error TEXT NULL');
    await ensureColumn('tenants', 'provisioned_at', 'provisioned_at DATETIME NULL');

    const hasDbNameIndex = await safeQuery(
        `SELECT 1
         FROM information_schema.statistics
         WHERE table_schema = DATABASE()
           AND table_name = 'tenants'
           AND index_name = 'uq_tenants_db_name'
         LIMIT 1`,
        [],
        []
    );
    if (!hasDbNameIndex.length) {
        await pool.query('CREATE UNIQUE INDEX uq_tenants_db_name ON tenants (db_name)');
    }

    await pool.query(
        `UPDATE tenants
         SET isolation_mode = 'database-per-tenant',
             db_name = ?,
             db_host = COALESCE(NULLIF(db_host, ''), ?),
             db_port = COALESCE(db_port, ?),
             db_user = COALESCE(NULLIF(db_user, ''), ?),
             provisioning_status = 'provisioned',
             provisioning_error = NULL,
             provisioned_at = COALESCE(provisioned_at, NOW()),
             status = 'active'
         WHERE LOWER(code) = ?`,
        [
            CONTROL_DB_NAME,
            String(process.env.DB_HOST || 'localhost').trim(),
            toNumber(process.env.DB_PORT, 3306),
            String(process.env.DB_USER || 'root').trim(),
            DEFAULT_TENANT_CODE
        ]
    );

    await pool.query(`
        CREATE TABLE IF NOT EXISTS school_admin_assignments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tenant_id INT NOT NULL,
            admin_id INT NOT NULL,
            role VARCHAR(60) NOT NULL DEFAULT 'admin',
            permissions_json LONGTEXT NULL,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_school_admin (tenant_id, admin_id),
            INDEX idx_school_admin_tenant (tenant_id),
            INDEX idx_school_admin_admin (admin_id)
        )
    `);
}

async function getSchoolMetricsMap(tenantIds = []) {
    const ids = Array.from(new Set((tenantIds || []).map((value) => toNumber(value, 0)).filter((value) => value > 0)));
    if (!ids.length) return {};

    const placeholders = ids.map(() => '?').join(',');

    const [students, activeSessions, dailyUsers, weeklyUsers, failedLogins] = await Promise.all([
        safeQuery(
            `SELECT tenant_id, COUNT(*) AS count
             FROM students
             WHERE tenant_id IN (${placeholders})
             GROUP BY tenant_id`,
            ids,
            []
        ),
        safeQuery(
            `SELECT a.tenant_id, COUNT(*) AS count
             FROM admin_sessions s
             JOIN admins a ON a.id = s.admin_id
             WHERE s.revoked_at IS NULL
               AND s.expires_at > NOW()
               AND a.tenant_id IN (${placeholders})
             GROUP BY a.tenant_id`,
            ids,
            []
        ),
        safeQuery(
            `SELECT a.tenant_id, COUNT(DISTINCT s.admin_id) AS count
             FROM admin_sessions s
             JOIN admins a ON a.id = s.admin_id
             WHERE s.created_at >= (NOW() - INTERVAL 1 DAY)
               AND a.tenant_id IN (${placeholders})
             GROUP BY a.tenant_id`,
            ids,
            []
        ),
        safeQuery(
            `SELECT a.tenant_id, COUNT(DISTINCT s.admin_id) AS count
             FROM admin_sessions s
             JOIN admins a ON a.id = s.admin_id
             WHERE s.created_at >= (NOW() - INTERVAL 7 DAY)
               AND a.tenant_id IN (${placeholders})
             GROUP BY a.tenant_id`,
            ids,
            []
        ),
        safeQuery(
            `SELECT a.tenant_id, COUNT(*) AS count
             FROM admin_login_otps o
             JOIN admins a ON a.id = o.admin_id
             WHERE o.consumed_at IS NULL
               AND o.attempts_left = 0
               AND a.tenant_id IN (${placeholders})
             GROUP BY a.tenant_id`,
            ids,
            []
        )
    ]);

    const map = {};
    ids.forEach((tenantId) => {
        map[tenantId] = {
            totalStudents: 0,
            activeUsers: 0,
            activeUsersDaily: 0,
            activeUsersWeekly: 0,
            failedLoginAttempts: 0,
            estimatedStorageMb: 0
        };
    });

    (students || []).forEach((row) => {
        const tenantId = toNumber(row.tenant_id, 0);
        if (!map[tenantId]) return;
        map[tenantId].totalStudents = toNumber(row.count, 0);
    });
    (activeSessions || []).forEach((row) => {
        const tenantId = toNumber(row.tenant_id, 0);
        if (!map[tenantId]) return;
        map[tenantId].activeUsers = toNumber(row.count, 0);
    });
    (dailyUsers || []).forEach((row) => {
        const tenantId = toNumber(row.tenant_id, 0);
        if (!map[tenantId]) return;
        map[tenantId].activeUsersDaily = toNumber(row.count, 0);
    });
    (weeklyUsers || []).forEach((row) => {
        const tenantId = toNumber(row.tenant_id, 0);
        if (!map[tenantId]) return;
        map[tenantId].activeUsersWeekly = toNumber(row.count, 0);
    });
    (failedLogins || []).forEach((row) => {
        const tenantId = toNumber(row.tenant_id, 0);
        if (!map[tenantId]) return;
        map[tenantId].failedLoginAttempts = toNumber(row.count, 0);
    });

    Object.values(map).forEach((entry) => {
        entry.estimatedStorageMb = Number(((entry.totalStudents * 0.025) + (entry.activeUsers * 0.01) + 1.5).toFixed(2));
    });

    return map;
}

async function ensureTenantsTable() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS tenants (
            id INT AUTO_INCREMENT PRIMARY KEY,
            code VARCHAR(80) NOT NULL UNIQUE,
            name VARCHAR(255) NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'active',
            is_default TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_tenants_status (status),
            INDEX idx_tenants_default (is_default)
        )
    `);
}

async function getTenantDashboardData(preferredTenantId = null) {
    await ensureTenantSupportSchema();
    const rows = await safeQuery(
        `SELECT id, code, name, status, is_default, school_id, domain, location,
            logo_data, branding_json, modules_json,
            isolation_mode, db_name, db_host, db_port, db_user, db_secret_ref,
            provisioning_status, provisioning_error, provisioned_at,
            created_at, updated_at
         FROM tenants
         ORDER BY is_default DESC, name ASC, id ASC`,
        [],
        []
    );

    const tenantIds = (rows || []).map((row) => toNumber(row.id, 0)).filter((value) => value > 0);
    const metricsMap = await getSchoolMetricsMap(tenantIds);

    const assignmentRows = await safeQuery(
        `SELECT saa.tenant_id, saa.admin_id, saa.role, saa.permissions_json, saa.is_active,
                a.name AS admin_name, a.email AS admin_email, a.role AS admin_global_role, a.last_login_at
         FROM school_admin_assignments saa
         LEFT JOIN admins a ON a.id = saa.admin_id
         ORDER BY saa.tenant_id ASC, saa.created_at DESC`,
        [],
        []
    );

    const assignmentsByTenant = {};
    (assignmentRows || []).forEach((row) => {
        const tenantId = toNumber(row.tenant_id, 0);
        if (!tenantId) return;
        assignmentsByTenant[tenantId] = assignmentsByTenant[tenantId] || [];
        assignmentsByTenant[tenantId].push({
            adminId: toNumber(row.admin_id, 0),
            name: row.admin_name || null,
            email: row.admin_email || null,
            role: row.role || row.admin_global_role || 'admin',
            globalRole: row.admin_global_role || null,
            permissions: parseSafeJson(row.permissions_json, {}),
            isActive: toNumber(row.is_active, 1) === 1,
            lastLoginAt: row.last_login_at || null
        });
    });

    const tenants = (rows || []).map((row) => {
        const tenantId = toNumber(row.id, 0);
        const metrics = metricsMap[tenantId] || {
            totalStudents: 0,
            activeUsers: 0,
            activeUsersDaily: 0,
            activeUsersWeekly: 0,
            failedLoginAttempts: 0,
            estimatedStorageMb: 0
        };
        const modules = {
            enrollment: true,
            reports: true,
            messaging: true,
            ...parseSafeJson(row.modules_json, {})
        };
        const admins = assignmentsByTenant[tenantId] || [];
        const alerts = [];
        if (String(row.status || '').toLowerCase() !== 'active') {
            alerts.push({ severity: 'warning', message: 'School is currently inactive' });
        }
        if (metrics.failedLoginAttempts > 0) {
            alerts.push({ severity: 'warning', message: `${metrics.failedLoginAttempts} failed login lockouts detected` });
        }
        if ((metrics.activeUsers || 0) === 0) {
            alerts.push({ severity: 'info', message: 'No active admin sessions at the moment' });
        }

        return {
            id: tenantId,
            code: String(row.code || ''),
            name: String(row.name || ''),
            schoolId: String(row.school_id || row.code || '').trim(),
            domain: String(row.domain || '').trim() || null,
            location: String(row.location || '').trim() || null,
            logoData: row.logo_data || null,
            branding: parseSafeJson(row.branding_json, {}),
            status: String(row.status || 'inactive').toLowerCase(),
            isDefault: toNumber(row.is_default, 0) === 1,
            modules,
            admins,
            security: {
                dataIsolationMode: String(row.isolation_mode || 'row-level-tenant-id').trim() || 'row-level-tenant-id',
                loginTrackingPerSchool: true,
                otpTrackingPerSchool: true,
                failedLoginAttempts: metrics.failedLoginAttempts
            },
            database: {
                name: row.db_name || null,
                host: row.db_host || null,
                port: toNumber(row.db_port, 0) || null,
                user: row.db_user || null,
                secretRef: row.db_secret_ref || null,
                provisioningStatus: String(row.provisioning_status || 'not-started').trim().toLowerCase(),
                provisioningError: row.provisioning_error || null,
                provisionedAt: row.provisioned_at || null
            },
            analytics: {
                totalStudents: metrics.totalStudents,
                activeUsers: metrics.activeUsers,
                activeUsersDaily: metrics.activeUsersDaily,
                activeUsersWeekly: metrics.activeUsersWeekly,
                failedLoginAttempts: metrics.failedLoginAttempts,
                estimatedStorageMb: metrics.estimatedStorageMb
            },
            monitoring: {
                status: String(row.status || 'inactive').toLowerCase() === 'active' ? 'active' : 'inactive',
                alerts
            },
            createdAt: row.created_at || null,
            updatedAt: row.updated_at || null
        };
    });

    const activeTenants = tenants.filter((item) => item.status === 'active');
    const preferredId = toNumber(preferredTenantId, 0);
    let currentTenant = null;

    if (preferredId > 0) {
        currentTenant = tenants.find((item) => item.id === preferredId) || null;
    }

    if (!currentTenant) {
        currentTenant = tenants.find((item) => item.isDefault && item.status === 'active')
            || activeTenants[0]
            || tenants[0]
            || null;
    }

    return {
        totalTenants: tenants.length,
        activeTenants: activeTenants.length,
        inactiveTenants: Math.max(tenants.length - activeTenants.length, 0),
        currentTenant,
        tenants,
        monitoring: tenants.map((school) => ({
            id: school.id,
            code: school.code,
            name: school.name,
            status: school.monitoring.status,
            alerts: school.monitoring.alerts
        }))
    };
}

async function saveDashboardState(nextState) {
    await fs.writeFile(dashboardStatePath, JSON.stringify(nextState, null, 2), 'utf8');
    return nextState;
}

async function readRequestLogLines(limit = 600) {
    try {
        const raw = await fs.readFile(requestLogPath, 'utf8');
        const lines = raw.split('\n').map(line => line.trim()).filter(Boolean);
        return lines.slice(-limit);
    } catch (_err) {
        return [];
    }
}

function parseRequestLogLine(line) {
    const match = String(line || '').match(/^([^\s]+)\s+([A-Z]+)\s+([^\s]+)\s+-\s+(.+)$/);
    if (!match) return null;
    return {
        timestamp: new Date(match[1]),
        method: match[2],
        url: match[3],
        ip: match[4]
    };
}

async function collectTableCounts(maxTables = 30) {
    const tables = await safeQuery(
        `SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'
         ORDER BY table_name ASC`,
        [],
        []
    );

    const selected = (tables || []).slice(0, maxTables);
    const counts = [];

    for (const row of selected) {
        const tableName = sanitizeIdentifier(row.table_name || row.TABLE_NAME);
        if (!tableName) continue;
        const rows = await safeQuery(`SELECT COUNT(*) AS count FROM \`${tableName}\``, [], [{ count: 0 }]);
        counts.push({ table: tableName, count: toNumber(rows?.[0]?.count, 0) });
    }

    return counts;
}

async function buildSnapshotBackup() {
    const tableCounts = await collectTableCounts(18);
    await fs.mkdir(developerBackupsDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `developer-backup-${stamp}.json`;
    const absolute = path.join(developerBackupsDir, fileName);

    const payload = {
        createdAt: new Date().toISOString(),
        type: 'developer-dashboard-snapshot',
        tables: tableCounts
    };

    await fs.writeFile(absolute, JSON.stringify(payload, null, 2), 'utf8');

    return {
        fileName,
        filePath: path.relative(path.join(__dirname, '..'), absolute).replace(/\\/g, '/'),
        tablesIncluded: tableCounts.length
    };
}

async function getVersionInfo() {
    let version = 'Unknown';
    let name = 'SMS';

    try {
        const pkgPath = path.join(__dirname, '..', 'package.json');
        const raw = await fs.readFile(pkgPath, 'utf8');
        const pkg = JSON.parse(raw);
        version = pkg.version || version;
        name = pkg.name || name;
    } catch (_err) {}

    const patchCandidates = [
        'COMPLETION_REPORT.md',
        'ADMIN_DASHBOARD_ENHANCEMENT_COMPLETE.md',
        'MIGRATION_EXECUTIVE_SUMMARY.md',
        'SYSTEM_OVERVIEW.md'
    ];

    const patchNotes = [];
    for (const candidate of patchCandidates) {
        try {
            await fs.access(path.join(__dirname, '..', candidate));
            patchNotes.push(candidate);
        } catch (_err) {}
    }

    return {
        systemName: name,
        currentVersion: version,
        updateAvailable: false,
        latestVersion: version,
        rollbackAvailable: true,
        patchNotes
    };
}

router.post('/developer-auth/signup', async (req, res) => {
    try {
        await ensureDeveloperAuthSchema();

        const fullName = String(req.body?.fullName || '').trim();
        const email = normalizeDeveloperEmail(req.body?.email);
        const password = String(req.body?.password || '');

        if (!fullName) {
            return res.status(400).json({ success: false, error: 'Full name is required' });
        }
        if (!email || !email.includes('@')) {
            return res.status(400).json({ success: false, error: 'Valid email is required' });
        }
        if (password.length < 8) {
            return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
        }

        const existing = await safeQuery(
            'SELECT id FROM developer_accounts WHERE email = ? LIMIT 1',
            [email],
            []
        );
        if (existing.length) {
            return res.status(409).json({ success: false, error: 'Developer account already exists for this email' });
        }

        const passwordHash = await bcrypt.hash(password, DEVELOPER_BCRYPT_ROUNDS);
        const [insertResult] = await pool.query(
            'INSERT INTO developer_accounts (full_name, email, password_hash) VALUES (?, ?, ?)',
            [fullName, email, passwordHash]
        );

        const account = {
            id: toNumber(insertResult.insertId, 0),
            full_name: fullName,
            email
        };

        const auth = await createDeveloperSession(account, req);
        return res.status(201).json({ success: true, ...auth });
    } catch (err) {
        if (err && err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, error: 'Developer account already exists for this email' });
        }
        return res.status(500).json({ success: false, error: String(err.message || err) });
    }
});

router.post('/developer-auth/signin', async (req, res) => {
    try {
        await ensureDeveloperAuthSchema();

        const email = normalizeDeveloperEmail(req.body?.email);
        const password = String(req.body?.password || '');
        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Email and password are required' });
        }

        const accounts = await safeQuery(
            'SELECT id, full_name, email, password_hash FROM developer_accounts WHERE email = ? LIMIT 1',
            [email],
            []
        );

        if (!accounts.length) {
            return res.status(401).json({ success: false, error: 'Invalid developer credentials' });
        }

        const account = accounts[0];
        const ok = await bcrypt.compare(password, String(account.password_hash || ''));
        if (!ok) {
            return res.status(401).json({ success: false, error: 'Invalid developer credentials' });
        }

        const auth = await createDeveloperSession(account, req);
        return res.json({ success: true, ...auth });
    } catch (err) {
        return res.status(500).json({ success: false, error: String(err.message || err) });
    }
});

router.get('/developer-auth/session', async (req, res) => {
    try {
        await ensureDeveloperAuthSchema();
        const resolved = await resolveDeveloperRequest(req);
        if (!resolved) {
            return res.status(401).json({ success: false, error: 'Developer authentication required' });
        }

        return res.json({
            success: true,
            developer: resolved.developer
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: String(err.message || err) });
    }
});

router.post('/developer-auth/signout', async (req, res) => {
    try {
        await ensureDeveloperAuthSchema();
        const token = readBearerToken(req);
        if (token) {
            await pool.query(
                `UPDATE developer_sessions
                 SET revoked_at = NOW()
                 WHERE token_hash = ?
                   AND revoked_at IS NULL`,
                [hashToken(token)]
            );
        }
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ success: false, error: String(err.message || err) });
    }
});

router.use(async (req, res, next) => {
    try {
        await ensureDeveloperAuthSchema();
        const resolved = await resolveDeveloperRequest(req);
        if (!resolved) {
            return res.status(401).json({ success: false, error: 'Developer authentication required' });
        }

        req.developer = resolved.developer;
        req.developerSessionId = resolved.sessionId;
        return next();
    } catch (err) {
        return res.status(500).json({ success: false, error: String(err.message || err) });
    }
});

router.get('/', async (_req, res) => {
    try {
        const now = Date.now();
        const state = await readDashboardState();
        const notificationsHasStatus = await tableHasColumn('notifications', 'status');

        const failedNotificationsCountQuery = notificationsHasStatus
            ? "SELECT COUNT(*) AS count FROM notifications WHERE status IN ('failed', 'error')"
            : "SELECT COUNT(*) AS count FROM notifications WHERE type = 'error'";

        const recentErrorsQuery = notificationsHasStatus
            ? `SELECT id, title, message, type, created_at
               FROM notifications
               WHERE type = 'error' OR status IN ('failed', 'error')
               ORDER BY id DESC
               LIMIT 15`
            : `SELECT id, title, message, type, created_at
               FROM notifications
               WHERE type = 'error'
               ORDER BY id DESC
               LIMIT 15`;

        const [
            dbStatus,
            tableCounts,
            requestLines,
            activeSessions,
            sessionsToday,
            loginToday,
            totalOtp,
            consumedOtp,
            pendingOtp,
            lockoutOtp,
            failedNotifications,
            errorNotifications,
            roleRows,
            recentSessions,
            topSessionUsers,
            storageRows,
            versionControl,
            tenantData
        ] = await Promise.all([
            checkDbConnectivity(),
            collectTableCounts(25),
            readRequestLogLines(800),
            safeCount("SELECT COUNT(*) AS count FROM admin_sessions WHERE revoked_at IS NULL AND expires_at > NOW()"),
            safeCount("SELECT COUNT(*) AS count FROM admin_sessions WHERE DATE(created_at) = CURDATE()"),
            safeCount("SELECT COUNT(*) AS count FROM admins WHERE DATE(last_login_at) = CURDATE()"),
            safeCount('SELECT COUNT(*) AS count FROM admin_login_otps'),
            safeCount('SELECT COUNT(*) AS count FROM admin_login_otps WHERE consumed_at IS NOT NULL'),
            safeCount('SELECT COUNT(*) AS count FROM admin_login_otps WHERE consumed_at IS NULL AND expires_at > NOW()'),
            safeCount('SELECT COUNT(*) AS count FROM admin_login_otps WHERE consumed_at IS NULL AND attempts_left = 0'),
            safeCount(failedNotificationsCountQuery),
            safeCount("SELECT COUNT(*) AS count FROM notifications WHERE type = 'error'"),
            safeQuery('SELECT role, COUNT(*) AS count FROM admins GROUP BY role ORDER BY count DESC', [], []),
            safeQuery(
                `SELECT s.admin_id, a.name, a.email, s.ip_address, s.user_agent, s.created_at, s.expires_at
                 FROM admin_sessions s
                 LEFT JOIN admins a ON a.id = s.admin_id
                 ORDER BY s.created_at DESC
                 LIMIT 25`,
                [],
                []
            ),
            safeQuery(
                `SELECT s.admin_id, COALESCE(a.name, a.email, CONCAT('Admin #', s.admin_id)) AS user_label, COUNT(*) AS session_count
                 FROM admin_sessions s
                 LEFT JOIN admins a ON a.id = s.admin_id
                 GROUP BY s.admin_id, user_label
                 ORDER BY session_count DESC
                 LIMIT 5`,
                [],
                []
            ),
            safeQuery(
                `SELECT table_name, ROUND((data_length + index_length) / 1024 / 1024, 2) AS size_mb
                 FROM information_schema.tables
                 WHERE table_schema = DATABASE()
                 ORDER BY (data_length + index_length) DESC
                 LIMIT 8`,
                [],
                []
            ),
            getVersionInfo(),
            getTenantDashboardData(state.selectedTenantId)
        ]);

        const parsedRequests = requestLines
            .map(parseRequestLogLine)
            .filter(Boolean)
            .filter(item => item.timestamp instanceof Date && !Number.isNaN(item.timestamp.getTime()));

        const lastMinute = parsedRequests.filter(item => now - item.timestamp.getTime() <= 60 * 1000);
        const lastFiveMinutes = parsedRequests.filter(item => now - item.timestamp.getTime() <= 5 * 60 * 1000);

        const endpointUsageMap = {};
        for (const request of lastFiveMinutes) {
            endpointUsageMap[request.url] = (endpointUsageMap[request.url] || 0) + 1;
        }

        const endpointUsage = Object.entries(endpointUsageMap)
            .map(([endpoint, count]) => ({ endpoint, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 12);

        const ipMap = {};
        for (const session of recentSessions) {
            const key = String(session.ip_address || 'unknown');
            ipMap[key] = (ipMap[key] || 0) + 1;
        }

        const ipTracking = Object.entries(ipMap)
            .map(([ip, sessions]) => ({ ip, sessions }))
            .sort((a, b) => b.sessions - a.sessions)
            .slice(0, 10);

        const browserMap = {};
        const deviceMap = {};
        for (const session of recentSessions) {
            const parsed = parseUserAgent(session.user_agent || '');
            browserMap[parsed.browser] = (browserMap[parsed.browser] || 0) + 1;
            deviceMap[parsed.device] = (deviceMap[parsed.device] || 0) + 1;
        }

        const browserStats = Object.entries(browserMap).map(([browser, count]) => ({ browser, count })).sort((a, b) => b.count - a.count);
        const deviceStats = Object.entries(deviceMap).map(([device, count]) => ({ device, count })).sort((a, b) => b.count - a.count);

        const avgSessionMinutes = recentSessions.length
            ? (recentSessions.reduce((sum, row) => {
                const start = new Date(row.created_at).getTime();
                const end = new Date(row.expires_at).getTime();
                if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return sum;
                return sum + ((end - start) / (1000 * 60));
            }, 0) / recentSessions.length)
            : 0;

        const serverStatus = 'Online';
        const apiHealth = 'Healthy';
        const memoryUsage = process.memoryUsage();
        const cpuLoad = os.loadavg();

        const fallbackAdminIdRows = await safeQuery('SELECT id FROM admins ORDER BY id ASC LIMIT 1', [], [{ id: 1 }]);
        const fallbackAdminId = toNumber(fallbackAdminIdRows?.[0]?.id, 1);

        const recentErrors = await safeQuery(recentErrorsQuery, [], []);

        const loginAttemptLogs = recentSessions.slice(0, 10).map((session) => ({
            adminId: session.admin_id,
            email: session.email || 'N/A',
            ip: session.ip_address || 'unknown',
            time: session.created_at,
            userAgent: session.user_agent || 'N/A'
        }));

        const suspiciousActivities = [];
        if (lockoutOtp > 0) {
            suspiciousActivities.push({
                severity: 'warning',
                message: `${lockoutOtp} OTP lockout records detected`
            });
        }
        if (failedNotifications > 0) {
            suspiciousActivities.push({
                severity: 'warning',
                message: `${failedNotifications} failed notification/API records`}
            );
        }
        if (!suspiciousActivities.length) {
            suspiciousActivities.push({ severity: 'info', message: 'No suspicious activity detected in current sample window' });
        }

        const rolePermissionOverview = (roleRows || []).map((row) => ({
            role: row.role || 'unknown',
            users: toNumber(row.count, 0),
            permissionLevel: (row.role || '').toLowerCase() === 'admin' ? 'full' : 'standard'
        }));

        const requestLogTail = requestLines.slice(-30);

        res.json({
            generatedAt: new Date().toISOString(),
            systemHealth: {
                serverStatus,
                databaseStatus: dbStatus,
                apiHealth,
                memory: {
                    rssMb: Number((memoryUsage.rss / 1024 / 1024).toFixed(2)),
                    heapUsedMb: Number((memoryUsage.heapUsed / 1024 / 1024).toFixed(2)),
                    heapTotalMb: Number((memoryUsage.heapTotal / 1024 / 1024).toFixed(2))
                },
                cpuUsage: {
                    oneMinute: Number(cpuLoad[0].toFixed(2)),
                    fiveMinute: Number(cpuLoad[1].toFixed(2)),
                    fifteenMinute: Number(cpuLoad[2].toFixed(2))
                },
                uptimeSeconds: process.uptime(),
                uptimeHuman: formatUptime(process.uptime())
            },
            realTimeAnalytics: {
                activeUsers: activeSessions,
                loginsToday: loginToday,
                failedLoginAttempts: lockoutOtp,
                otpVerificationStats: {
                    totalIssued: totalOtp,
                    consumed: consumedOtp,
                    pending: pendingOtp,
                    locked: lockoutOtp
                },
                requestsPerMinute: lastMinute.length,
                sessionsCreatedToday: sessionsToday
            },
            securityPanel: {
                loginAttemptLogs,
                suspiciousActivity: suspiciousActivities,
                ipAddressTracking: ipTracking,
                accountLockouts: lockoutOtp,
                tokenSessionMonitoring: {
                    activeSessions,
                    recentSessions: recentSessions.length,
                    avgSessionMinutes: Number(avgSessionMinutes.toFixed(2))
                },
                rolePermissionOverview
            },
            databaseManagement: {
                tableViewer: tableCounts,
                recordCountPerTable: tableCounts,
                backup: {
                    enabled: true,
                    suggestedAdminId: fallbackAdminId
                },
                restore: {
                    enabled: true,
                    safeModeOnly: true
                },
                queryRunner: {
                    restrictedSafeMode: true,
                    maxRows: 200,
                    allowedStatements: ['SELECT', 'SHOW', 'DESCRIBE', 'EXPLAIN']
                }
            },
            errorDebugConsole: {
                systemErrorLogs: recentErrors,
                apiErrorLogs: recentErrors,
                consoleOutputViewer: requestLogTail,
                failedApiRequests: failedNotifications,
                stackTraceViewer: recentErrors
                    .map(row => String(row.message || ''))
                    .filter(text => text.toLowerCase().includes('error') || text.toLowerCase().includes('exception'))
                    .slice(0, 10)
            },
            userActivityTracker: {
                lastLoginPerUser: await safeQuery(
                    `SELECT id, name, email, role, last_login_at
                     FROM admins
                     ORDER BY last_login_at DESC
                     LIMIT 20`,
                    [],
                    []
                ),
                userSessionDuration: {
                    averageMinutes: Number(avgSessionMinutes.toFixed(2)),
                    sampleSize: recentSessions.length
                },
                deviceAndBrowserDetection: {
                    browsers: browserStats,
                    devices: deviceStats
                },
                mostActiveUsers: topSessionUsers
            },
            systemControls: {
                maintenanceMode: state.maintenanceMode,
                features: state.featureFlags,
                actions: {
                    forceLogoutAllUsers: true,
                    clearSystemCache: true,
                    resetOtpSystem: true,
                    toggleMaintenanceMode: true,
                    enableDisableFeatures: true
                }
            },
            apiMonitoring: {
                responseTimeGraph: [],
                successVsFailedRequests: {
                    success: Math.max(lastFiveMinutes.length - failedNotifications, 0),
                    failed: failedNotifications
                },
                endpointUsageBreakdown: endpointUsage
            },
            performanceInsights: {
                slowQueryDetection: {
                    detectedCount: 0,
                    note: 'Slow query engine is in safe passive mode for this dashboard build'
                },
                loadTimeMonitoring: {
                    requestsPerMinute: lastMinute.length,
                    sampledRequests: lastFiveMinutes.length
                },
                storageUsageStatistics: storageRows,
                growthTracking: {
                    totalTablesTracked: tableCounts.length,
                    totalRecordsTracked: tableCounts.reduce((sum, item) => sum + toNumber(item.count, 0), 0)
                }
            },
            tenantManagement: {
                totalTenants: tenantData.totalTenants,
                activeTenants: tenantData.activeTenants,
                inactiveTenants: tenantData.inactiveTenants,
                currentTenant: tenantData.currentTenant,
                tenants: tenantData.tenants
            },
            versionControlPanel: versionControl
        });
    } catch (err) {
        console.error('System health API error:', err);
        res.status(500).json({ error: 'Failed to fetch developer dashboard data' });
    }
});

router.get('/tenants/summary', async (_req, res) => {
    try {
        const state = await readDashboardState();
        const data = await getTenantDashboardData(state.selectedTenantId);
        return res.json({
            success: true,
            summary: {
                totalTenants: data.totalTenants,
                activeTenants: data.activeTenants,
                inactiveTenants: data.inactiveTenants,
                currentTenant: data.currentTenant
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: String(err.message || err) });
    }
});

router.get('/tenants', async (_req, res) => {
    try {
        const state = await readDashboardState();
        const data = await getTenantDashboardData(state.selectedTenantId);
        return res.json({
            success: true,
            currentTenant: data.currentTenant,
            tenants: data.tenants
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: String(err.message || err) });
    }
});

router.post('/tenants', async (req, res) => {
    try {
        await ensureTenantSupportSchema();

        const code = normalizeTenantCode(req.body?.code);
        const name = String(req.body?.name || '').trim();
        const schoolId = String(req.body?.schoolId || req.body?.school_id || code || '').trim() || null;
        const domain = String(req.body?.domain || '').trim() || null;
        const location = String(req.body?.location || '').trim() || null;
        const logoData = req.body?.logoData || req.body?.logo_data || null;
        const normalizedLogoData = logoData ? String(logoData) : null;
        if (normalizedLogoData && estimateLogoPayloadBytes(normalizedLogoData) > TENANT_LOGO_MAX_BYTES) {
            return res.status(413).json({
                success: false,
                error: `School logo is too large. Maximum allowed size is ${Math.floor(TENANT_LOGO_MAX_BYTES / 1024)} KB.`
            });
        }
        const branding = req.body?.branding && typeof req.body.branding === 'object' ? req.body.branding : {};
        const modules = req.body?.modules && typeof req.body.modules === 'object'
            ? req.body.modules
            : { enrollment: true, reports: true, messaging: true };
        const status = String(req.body?.status || 'active').trim().toLowerCase() === 'active' ? 'active' : 'inactive';
        const makeDefault = !!req.body?.isDefault;
        const isolationMode = 'database-per-tenant';

        if (!code || !name) {
            return res.status(400).json({ success: false, error: 'code and name are required' });
        }

        let tenantDbConfig = {
            dbName: null,
            dbHost: null,
            dbPort: null,
            dbUser: null,
            dbSecretRef: null,
            provisioningStatus: 'not-started',
            provisioningError: null,
            provisionedAt: null
        };

        if (isolationMode === 'database-per-tenant') {
            const requestedDbName = String(req.body?.databaseName || req.body?.database_name || '').trim() || null;
            const defaultDatabaseName = buildTenantDatabaseName(code);
            const initialDbName = code === DEFAULT_TENANT_CODE
                ? CONTROL_DB_NAME
                : (requestedDbName || defaultDatabaseName);

            if (!initialDbName) {
                return res.status(400).json({ success: false, error: 'Unable to derive tenant database name from school code' });
            }

            try {
                const provisioned = await provisionTenantDatabase({
                    tenantCode: code,
                    databaseName: initialDbName,
                    templateDbName: CONTROL_DB_NAME
                });

                tenantDbConfig = {
                    dbName: provisioned.databaseName,
                    dbHost: provisioned.host,
                    dbPort: toNumber(provisioned.port, 0) || null,
                    dbUser: provisioned.user,
                    dbSecretRef: String(req.body?.dbSecretRef || req.body?.db_secret_ref || '').trim() || null,
                    provisioningStatus: 'provisioned',
                    provisioningError: null,
                    provisionedAt: new Date()
                };
            } catch (provisionErr) {
                return res.status(500).json({
                    success: false,
                    error: `Tenant database provisioning failed: ${String(provisionErr.message || provisionErr)}`
                });
            }
        }

        const [insertResult] = await pool.query(
            `INSERT INTO tenants (
                code, name, school_id, domain, location, logo_data,
                branding_json, modules_json, status, is_default,
                isolation_mode, db_name, db_host, db_port, db_user, db_secret_ref,
                provisioning_status, provisioning_error, provisioned_at
             )
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                code,
                name,
                schoolId,
                domain,
                location,
                normalizedLogoData,
                JSON.stringify(branding),
                JSON.stringify(modules),
                status,
                makeDefault ? 1 : 0,
                isolationMode,
                tenantDbConfig.dbName,
                tenantDbConfig.dbHost,
                tenantDbConfig.dbPort,
                tenantDbConfig.dbUser,
                tenantDbConfig.dbSecretRef,
                tenantDbConfig.provisioningStatus,
                tenantDbConfig.provisioningError,
                tenantDbConfig.provisionedAt
            ]
        );

        if (makeDefault) {
            await pool.query(
                `UPDATE tenants
                 SET is_default = CASE WHEN id = ? THEN 1 ELSE 0 END`,
                [insertResult.insertId]
            );
        }

        const current = await readDashboardState();
        const nextState = {
            ...current,
            selectedTenantId: toNumber(insertResult.insertId, 0) || current.selectedTenantId || null
        };
        await saveDashboardState(nextState);

        const data = await getTenantDashboardData(nextState.selectedTenantId);
        return res.status(201).json({
            success: true,
            message: 'Tenant created successfully',
            currentTenant: data.currentTenant,
            tenants: data.tenants
        });
    } catch (err) {
        if (err && (err.code === 'ER_NET_PACKET_TOO_LARGE' || String(err.message || '').includes('max_allowed_packet'))) {
            return res.status(413).json({
                success: false,
                error: `Request payload is too large for database packet limit. Reduce logo size (max ${Math.floor(TENANT_LOGO_MAX_BYTES / 1024)} KB).`
            });
        }
        if (err && err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, error: 'Tenant code already exists' });
        }
        return res.status(500).json({ success: false, error: String(err.message || err) });
    }
});

router.put('/tenants/:id', async (req, res) => {
    try {
        await ensureTenantSupportSchema();
        const tenantId = toNumber(req.params.id, 0);
        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Invalid tenant id' });
        }

        const code = req.body?.code ? normalizeTenantCode(req.body.code) : null;
        const fields = [];
        const values = [];

        if (code) {
            fields.push('code = ?');
            values.push(code);
        }
        if (typeof req.body?.name === 'string') {
            fields.push('name = ?');
            values.push(String(req.body.name || '').trim());
        }
        if (typeof req.body?.schoolId === 'string' || typeof req.body?.school_id === 'string') {
            fields.push('school_id = ?');
            values.push(String(req.body.schoolId || req.body.school_id || '').trim() || null);
        }
        if (typeof req.body?.domain === 'string') {
            fields.push('domain = ?');
            values.push(String(req.body.domain || '').trim() || null);
        }
        if (typeof req.body?.location === 'string') {
            fields.push('location = ?');
            values.push(String(req.body.location || '').trim() || null);
        }
        if (typeof req.body?.logoData !== 'undefined' || typeof req.body?.logo_data !== 'undefined') {
            const nextLogoData = req.body.logoData ?? req.body.logo_data;
            if (nextLogoData) {
                const estimatedBytes = estimateLogoPayloadBytes(nextLogoData);
                if (estimatedBytes > TENANT_LOGO_MAX_BYTES) {
                    return res.status(413).json({
                        success: false,
                        error: `School logo is too large. Maximum allowed size is ${Math.floor(TENANT_LOGO_MAX_BYTES / 1024)} KB.`
                    });
                }
            }
            fields.push('logo_data = ?');
            values.push(nextLogoData ? String(nextLogoData) : null);
        }
        if (req.body?.branding && typeof req.body.branding === 'object') {
            fields.push('branding_json = ?');
            values.push(JSON.stringify(req.body.branding));
        }
        if (req.body?.modules && typeof req.body.modules === 'object') {
            fields.push('modules_json = ?');
            values.push(JSON.stringify(req.body.modules));
        }
        if (typeof req.body?.status === 'string') {
            fields.push('status = ?');
            values.push(String(req.body.status).trim().toLowerCase() === 'active' ? 'active' : 'inactive');
        }

        if (!fields.length) {
            return res.status(400).json({ success: false, error: 'No updates provided' });
        }

        values.push(tenantId);
        await pool.query(`UPDATE tenants SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, values);

        const state = await readDashboardState();
        const data = await getTenantDashboardData(state.selectedTenantId);
        return res.json({ success: true, message: 'School updated successfully', tenants: data.tenants });
    } catch (err) {
        if (err && (err.code === 'ER_NET_PACKET_TOO_LARGE' || String(err.message || '').includes('max_allowed_packet'))) {
            return res.status(413).json({
                success: false,
                error: `Request payload is too large for database packet limit. Reduce logo size (max ${Math.floor(TENANT_LOGO_MAX_BYTES / 1024)} KB).`
            });
        }
        if (err && err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, error: 'School code already exists' });
        }
        return res.status(500).json({ success: false, error: String(err.message || err) });
    }
});

router.delete('/tenants/:id', async (req, res) => {
    try {
        await ensureTenantSupportSchema();
        const tenantId = toNumber(req.params.id, 0);
        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Invalid tenant id' });
        }

        const [tenantRows] = await pool.query(
            `SELECT id, code, db_name
             FROM tenants
             WHERE id = ?
             LIMIT 1`,
            [tenantId]
        );

        const tenant = Array.isArray(tenantRows) && tenantRows.length ? tenantRows[0] : null;
        if (!tenant) {
            return res.status(404).json({ success: false, error: 'School not found' });
        }

        const tenantCode = String(tenant.code || '').trim().toLowerCase();
        if (tenantCode === DEFAULT_TENANT_CODE) {
            return res.status(400).json({ success: false, error: 'Default school cannot be removed' });
        }

        const [studentRows, sectionRows, enrollmentRows] = await Promise.all([
            safeQuery('SELECT COUNT(*) AS count FROM students WHERE tenant_id = ?', [tenantId], [{ count: 0 }]),
            safeQuery('SELECT COUNT(*) AS count FROM sections WHERE tenant_id = ?', [tenantId], [{ count: 0 }]),
            safeQuery('SELECT COUNT(*) AS count FROM enrollments WHERE tenant_id = ?', [tenantId], [{ count: 0 }])
        ]);

        const linkedRows = toNumber(studentRows[0]?.count, 0) + toNumber(sectionRows[0]?.count, 0) + toNumber(enrollmentRows[0]?.count, 0);

        let cleanedRows = 0;
        try {
            const tenantTables = await safeQuery(
                `SELECT DISTINCT table_name AS tableName
                 FROM information_schema.columns
                 WHERE table_schema = DATABASE()
                   AND column_name = 'tenant_id'`,
                [],
                []
            );

            await pool.query('SET FOREIGN_KEY_CHECKS = 0');
            try {
                for (const row of tenantTables) {
                    const tableName = sanitizeIdentifier(row.tableName || row.TABLE_NAME || '');
                    if (!tableName || tableName === 'tenants') continue;
                    const [deleteResult] = await pool.query(`DELETE FROM \`${tableName}\` WHERE tenant_id = ?`, [tenantId]);
                    cleanedRows += toNumber(deleteResult && deleteResult.affectedRows, 0);
                }
            } finally {
                await pool.query('SET FOREIGN_KEY_CHECKS = 1');
            }
        } catch (cleanupErr) {
            return res.status(500).json({
                success: false,
                error: `Failed to cleanup linked school records: ${String(cleanupErr.message || cleanupErr)}`
            });
        }

        const dbName = sanitizeIdentifier(tenant.db_name);
        if (dbName) {
            try {
                await dropTenantDatabase({ tenantCode, databaseName: dbName });
            } catch (dropErr) {
                return res.status(500).json({
                    success: false,
                    error: `Failed to remove tenant database: ${String(dropErr.message || dropErr)}`
                });
            }
        }

        await pool.query('DELETE FROM school_admin_assignments WHERE tenant_id = ?', [tenantId]);
        const [result] = await pool.query('DELETE FROM tenants WHERE id = ?', [tenantId]);
        if (!result || toNumber(result.affectedRows, 0) === 0) {
            return res.status(404).json({ success: false, error: 'School not found' });
        }

        const current = await readDashboardState();
        const data = await getTenantDashboardData(current.selectedTenantId);
        const cleanupNote = linkedRows > 0 || cleanedRows > 0
            ? ` Removed ${cleanedRows} linked records.`
            : '';
        return res.json({ success: true, message: `School removed successfully.${cleanupNote}`, tenants: data.tenants, currentTenant: data.currentTenant });
    } catch (err) {
        return res.status(500).json({ success: false, error: String(err.message || err) });
    }
});

router.get('/schools', async (_req, res) => {
    try {
        const state = await readDashboardState();
        const data = await getTenantDashboardData(state.selectedTenantId);
        return res.json({ success: true, currentSchool: data.currentTenant, schools: data.tenants, monitoring: data.monitoring });
    } catch (err) {
        return res.status(500).json({ success: false, error: String(err.message || err) });
    }
});

router.get('/schools/resolve', async (req, res) => {
    try {
        const state = await readDashboardState();
        const data = await getTenantDashboardData(state.selectedTenantId);
        const schools = Array.isArray(data.tenants) ? data.tenants : [];

        const requestedCode = String(req.query.code || req.query.school || '').trim().toLowerCase();
        const host = String(req.headers.host || '').trim().toLowerCase().split(':')[0];

        const knownLocalHosts = new Set(['localhost', '127.0.0.1', '::1']);
        const hostParts = host.split('.').filter(Boolean);
        const inferredSubdomainCode = (!knownLocalHosts.has(host) && hostParts.length >= 3)
            ? hostParts[0].toLowerCase()
            : '';

        let school = null;
        if (requestedCode) {
            school = schools.find((item) => String(item.code || '').toLowerCase() === requestedCode)
                || schools.find((item) => String(item.schoolId || '').toLowerCase() === requestedCode)
                || schools.find((item) => String(item.domain || '').toLowerCase() === requestedCode)
                || null;
        }

        if (!school && inferredSubdomainCode) {
            school = schools.find((item) => String(item.code || '').toLowerCase() === inferredSubdomainCode)
                || schools.find((item) => {
                    const domain = String(item.domain || '').trim().toLowerCase();
                    return domain && (domain === host || domain === `${inferredSubdomainCode}.${hostParts.slice(1).join('.')}`);
                })
                || null;
        }

        if (!school) {
            school = data.currentTenant || schools.find((item) => item.isDefault) || schools[0] || null;
        }

        if (!school) {
            return res.status(404).json({ success: false, error: 'No school is configured' });
        }

        return res.json({
            success: true,
            school: {
                id: school.id,
                code: school.code,
                schoolId: school.schoolId || school.code,
                name: school.name,
                domain: school.domain || null,
                location: school.location || null,
                logoData: school.logoData || null,
                branding: school.branding || {},
                modules: school.modules || {},
                status: school.status || 'active'
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: String(err.message || err) });
    }
});

router.get('/schools/:id', async (req, res) => {
    try {
        const state = await readDashboardState();
        const data = await getTenantDashboardData(state.selectedTenantId);
        const schoolId = toNumber(req.params.id, 0);
        const school = data.tenants.find((item) => item.id === schoolId);
        if (!school) {
            return res.status(404).json({ success: false, error: 'School not found' });
        }
        return res.json({ success: true, school });
    } catch (err) {
        return res.status(500).json({ success: false, error: String(err.message || err) });
    }
});

router.get('/schools/:id/admins', async (req, res) => {
    try {
        await ensureTenantSupportSchema();
        const schoolId = toNumber(req.params.id, 0);
        if (!schoolId) {
            return res.status(400).json({ success: false, error: 'Invalid school id' });
        }

        const assigned = await safeQuery(
            `SELECT saa.admin_id, saa.role, saa.permissions_json, saa.is_active,
                    a.name, a.email, a.role AS global_role, a.last_login_at
             FROM school_admin_assignments saa
             LEFT JOIN admins a ON a.id = saa.admin_id
             WHERE saa.tenant_id = ?
             ORDER BY saa.created_at DESC`,
            [schoolId],
            []
        );

        const available = await safeQuery(
            `SELECT id, name, email, role, tenant_id
             FROM admins
             WHERE account_status = 'active'
               AND (tenant_id IS NULL OR tenant_id = ?)
             ORDER BY name ASC, id ASC`,
            [schoolId],
            []
        );

        return res.json({
            success: true,
            assignedAdmins: (assigned || []).map((row) => ({
                adminId: toNumber(row.admin_id, 0),
                name: row.name || null,
                email: row.email || null,
                role: row.role || 'admin',
                permissions: parseSafeJson(row.permissions_json, {}),
                isActive: toNumber(row.is_active, 1) === 1,
                globalRole: row.global_role || null,
                lastLoginAt: row.last_login_at || null
            })),
            availableAdmins: (available || []).map((row) => ({
                id: toNumber(row.id, 0),
                name: row.name || `Admin #${row.id}`,
                email: row.email || null,
                role: row.role || 'admin'
            }))
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: String(err.message || err) });
    }
});

router.post('/schools/:id/admins', async (req, res) => {
    try {
        await ensureTenantSupportSchema();
        const schoolId = toNumber(req.params.id, 0);
        const adminId = toNumber(req.body?.adminId, 0);
        const role = String(req.body?.role || 'admin').trim() || 'admin';
        const permissions = req.body?.permissions && typeof req.body.permissions === 'object' ? req.body.permissions : {};

        if (!schoolId || !adminId) {
            return res.status(400).json({ success: false, error: 'school id and adminId are required' });
        }

        const adminRows = await safeQuery('SELECT id, tenant_id FROM admins WHERE id = ? LIMIT 1', [adminId], []);
        if (!adminRows.length) {
            return res.status(404).json({ success: false, error: 'Admin not found' });
        }

        const adminTenantId = toNumber(adminRows[0].tenant_id, 0);
        if (adminTenantId > 0 && adminTenantId !== schoolId) {
            return res.status(400).json({ success: false, error: 'Admin already assigned to a different school' });
        }

        await pool.query('UPDATE admins SET tenant_id = ? WHERE id = ? AND (tenant_id IS NULL OR tenant_id = ?)', [schoolId, adminId, schoolId]);
        await pool.query(
            `INSERT INTO school_admin_assignments (tenant_id, admin_id, role, permissions_json, is_active)
             VALUES (?, ?, ?, ?, 1)
             ON DUPLICATE KEY UPDATE role = VALUES(role), permissions_json = VALUES(permissions_json), is_active = 1, updated_at = CURRENT_TIMESTAMP`,
            [schoolId, adminId, role, JSON.stringify(permissions)]
        );

        return res.json({ success: true, message: 'School admin assigned successfully' });
    } catch (err) {
        return res.status(500).json({ success: false, error: String(err.message || err) });
    }
});

router.put('/schools/:id/admins/:adminId', async (req, res) => {
    try {
        await ensureTenantSupportSchema();
        const schoolId = toNumber(req.params.id, 0);
        const adminId = toNumber(req.params.adminId, 0);
        const role = String(req.body?.role || 'admin').trim() || 'admin';
        const permissions = req.body?.permissions && typeof req.body.permissions === 'object' ? req.body.permissions : {};
        const isActive = req.body?.isActive === false ? 0 : 1;

        if (!schoolId || !adminId) {
            return res.status(400).json({ success: false, error: 'Invalid school/admin id' });
        }

        await pool.query(
            `UPDATE school_admin_assignments
             SET role = ?, permissions_json = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
             WHERE tenant_id = ? AND admin_id = ?`,
            [role, JSON.stringify(permissions), isActive, schoolId, adminId]
        );
        return res.json({ success: true, message: 'School admin updated successfully' });
    } catch (err) {
        return res.status(500).json({ success: false, error: String(err.message || err) });
    }
});

router.delete('/schools/:id/admins/:adminId', async (req, res) => {
    try {
        await ensureTenantSupportSchema();
        const schoolId = toNumber(req.params.id, 0);
        const adminId = toNumber(req.params.adminId, 0);
        if (!schoolId || !adminId) {
            return res.status(400).json({ success: false, error: 'Invalid school/admin id' });
        }

        await pool.query('DELETE FROM school_admin_assignments WHERE tenant_id = ? AND admin_id = ?', [schoolId, adminId]);
        await pool.query('UPDATE admins SET tenant_id = NULL WHERE id = ? AND tenant_id = ?', [adminId, schoolId]);
        return res.json({ success: true, message: 'School admin removed successfully' });
    } catch (err) {
        return res.status(500).json({ success: false, error: String(err.message || err) });
    }
});

router.get('/schools/:id/analytics', async (req, res) => {
    try {
        const schoolId = toNumber(req.params.id, 0);
        if (!schoolId) {
            return res.status(400).json({ success: false, error: 'Invalid school id' });
        }
        const metricsMap = await getSchoolMetricsMap([schoolId]);
        return res.json({ success: true, analytics: metricsMap[schoolId] || {} });
    } catch (err) {
        return res.status(500).json({ success: false, error: String(err.message || err) });
    }
});

router.get('/schools/:id/security', async (req, res) => {
    try {
        const schoolId = toNumber(req.params.id, 0);
        if (!schoolId) {
            return res.status(400).json({ success: false, error: 'Invalid school id' });
        }

        const failedRows = await safeQuery(
            `SELECT COUNT(*) AS count
             FROM admin_login_otps o
             JOIN admins a ON a.id = o.admin_id
             WHERE a.tenant_id = ?
               AND o.consumed_at IS NULL
               AND o.attempts_left = 0`,
            [schoolId],
            [{ count: 0 }]
        );

        return res.json({
            success: true,
            security: {
                dataIsolationMode: 'row-level-tenant-id',
                usersCrossSchoolAccessible: false,
                otpTrackingPerSchool: true,
                sessionTrackingPerSchool: true,
                failedLoginAttempts: toNumber(failedRows?.[0]?.count, 0)
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: String(err.message || err) });
    }
});

router.post('/schools/:id/modules', async (req, res) => {
    try {
        await ensureTenantSupportSchema();
        const schoolId = toNumber(req.params.id, 0);
        if (!schoolId) {
            return res.status(400).json({ success: false, error: 'Invalid school id' });
        }

        const modules = req.body?.modules && typeof req.body.modules === 'object'
            ? req.body.modules
            : null;
        if (!modules) {
            return res.status(400).json({ success: false, error: 'modules payload is required' });
        }

        await pool.query('UPDATE tenants SET modules_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [JSON.stringify(modules), schoolId]);
        return res.json({ success: true, message: 'School modules updated successfully', modules });
    } catch (err) {
        return res.status(500).json({ success: false, error: String(err.message || err) });
    }
});

router.post('/schools/:id/controls/logout', async (req, res) => {
    try {
        const schoolId = toNumber(req.params.id, 0);
        if (!schoolId) {
            return res.status(400).json({ success: false, error: 'Invalid school id' });
        }

        await pool.query(
            `UPDATE admin_sessions
             SET revoked_at = NOW()
             WHERE admin_id IN (SELECT id FROM admins WHERE tenant_id = ?)
               AND revoked_at IS NULL`,
            [schoolId]
        );
        return res.json({ success: true, message: 'Forced logout executed for selected school' });
    } catch (err) {
        return res.status(500).json({ success: false, error: String(err.message || err) });
    }
});

router.post('/schools/:id/controls/reset-otp', async (req, res) => {
    try {
        const schoolId = toNumber(req.params.id, 0);
        if (!schoolId) {
            return res.status(400).json({ success: false, error: 'Invalid school id' });
        }

        await pool.query(
            `UPDATE admin_login_otps
             SET consumed_at = NOW()
             WHERE admin_id IN (SELECT id FROM admins WHERE tenant_id = ?)
               AND consumed_at IS NULL`,
            [schoolId]
        );
        return res.json({ success: true, message: 'OTP reset executed for selected school' });
    } catch (err) {
        return res.status(500).json({ success: false, error: String(err.message || err) });
    }
});

router.post('/schools/:id/controls/backup', async (req, res) => {
    try {
        const schoolId = toNumber(req.params.id, 0);
        if (!schoolId) {
            return res.status(400).json({ success: false, error: 'Invalid school id' });
        }

        const [studentRows, sectionRows, enrollmentRows] = await Promise.all([
            safeQuery('SELECT COUNT(*) AS count FROM students WHERE tenant_id = ?', [schoolId], [{ count: 0 }]),
            safeQuery('SELECT COUNT(*) AS count FROM sections WHERE tenant_id = ?', [schoolId], [{ count: 0 }]),
            safeQuery('SELECT COUNT(*) AS count FROM enrollments WHERE tenant_id = ?', [schoolId], [{ count: 0 }])
        ]);

        const backup = {
            schoolId,
            createdAt: new Date().toISOString(),
            rows: {
                students: toNumber(studentRows[0]?.count, 0),
                sections: toNumber(sectionRows[0]?.count, 0),
                enrollments: toNumber(enrollmentRows[0]?.count, 0)
            }
        };

        return res.json({ success: true, message: 'School backup snapshot generated', backup });
    } catch (err) {
        return res.status(500).json({ success: false, error: String(err.message || err) });
    }
});

router.post('/schools/:id/controls/restore', async (req, res) => {
    const schoolId = toNumber(req.params.id, 0);
    if (!schoolId) {
        return res.status(400).json({ success: false, error: 'Invalid school id' });
    }

    return res.json({
        success: true,
        safeMode: true,
        restored: false,
        schoolId,
        message: 'Per-school restore is available in safe preview mode only in this environment.'
    });
});

router.post('/tenants/:id/switch', async (req, res) => {
    try {
        await ensureTenantsTable();
        const tenantId = toNumber(req.params.id, 0);
        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Invalid tenant id' });
        }

        const tenantRows = await safeQuery(
            `SELECT id, status FROM tenants WHERE id = ? LIMIT 1`,
            [tenantId],
            []
        );

        if (!tenantRows.length) {
            return res.status(404).json({ success: false, error: 'Tenant not found' });
        }

        if (String(tenantRows[0].status || '').toLowerCase() !== 'active') {
            return res.status(400).json({ success: false, error: 'Only active tenants can be selected' });
        }

        const current = await readDashboardState();
        const nextState = {
            ...current,
            selectedTenantId: tenantId
        };
        await saveDashboardState(nextState);

        const data = await getTenantDashboardData(tenantId);
        return res.json({
            success: true,
            message: 'Tenant switched successfully',
            currentTenant: data.currentTenant
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: String(err.message || err) });
    }
});

router.post('/db/query', async (req, res) => {
    try {
        const rawSql = String(req.body?.sql || '').trim();
        if (!rawSql) {
            return res.status(400).json({ success: false, error: 'SQL is required' });
        }

        const normalized = rawSql.replace(/\s+/g, ' ').trim();
        const safeStart = /^(SELECT|SHOW|DESCRIBE|EXPLAIN)\b/i.test(normalized);
        const forbidden = /(UPDATE|DELETE|INSERT|DROP|ALTER|TRUNCATE|CREATE|REPLACE|GRANT|REVOKE|;)/i.test(normalized);

        if (!safeStart || forbidden) {
            return res.status(400).json({
                success: false,
                error: 'Only single-statement read-only queries are allowed in safe mode'
            });
        }

        const limitedSql = /\bLIMIT\b/i.test(normalized) ? normalized : `${normalized} LIMIT 200`;
        const [rows] = await pool.query(limitedSql);

        return res.json({
            success: true,
            mode: 'safe-readonly',
            rowCount: Array.isArray(rows) ? rows.length : 0,
            rows: Array.isArray(rows) ? rows : []
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: String(err.message || err) });
    }
});

router.get('/db/table/:tableName', async (req, res) => {
    try {
        const tableName = sanitizeIdentifier(req.params.tableName);
        if (!tableName) {
            return res.status(400).json({ success: false, error: 'Invalid table name' });
        }

        const tableExistsRows = await safeQuery(
            `SELECT COUNT(*) AS count
             FROM information_schema.tables
             WHERE table_schema = DATABASE() AND table_name = ?`,
            [tableName],
            [{ count: 0 }]
        );

        if (!toNumber(tableExistsRows?.[0]?.count, 0)) {
            return res.status(404).json({ success: false, error: 'Table not found' });
        }

        const limit = Math.min(Math.max(toNumber(req.query.limit, 25), 1), 200);
        const rows = await safeQuery(`SELECT * FROM \`${tableName}\` LIMIT ${limit}`, [], []);

        return res.json({ success: true, table: tableName, limit, rows });
    } catch (err) {
        return res.status(500).json({ success: false, error: String(err.message || err) });
    }
});

router.post('/db/backup', async (_req, res) => {
    try {
        const backup = await buildSnapshotBackup();
        return res.json({ success: true, backup, message: 'Developer backup snapshot created' });
    } catch (err) {
        return res.status(500).json({ success: false, error: String(err.message || err) });
    }
});

router.post('/db/restore', async (req, res) => {
    const backupFile = String(req.body?.backupFile || '').trim();
    if (!backupFile) {
        return res.status(400).json({ success: false, error: 'backupFile is required' });
    }

    return res.json({
        success: true,
        safeMode: true,
        restored: false,
        message: 'Restore option is available in safe preview mode. Full restore is intentionally blocked in this environment.',
        backupFile
    });
});

router.post('/controls/maintenance', async (req, res) => {
    try {
        const current = await readDashboardState();
        const nextMode = typeof req.body?.enabled === 'boolean'
            ? !!req.body.enabled
            : !current.maintenanceMode;

        const nextState = {
            ...current,
            maintenanceMode: nextMode
        };

        await saveDashboardState(nextState);
        return res.json({ success: true, maintenanceMode: nextMode });
    } catch (err) {
        return res.status(500).json({ success: false, error: String(err.message || err) });
    }
});

router.post('/controls/logout-all', async (_req, res) => {
    try {
        await pool.query('UPDATE admin_sessions SET revoked_at = NOW() WHERE revoked_at IS NULL');
        return res.json({ success: true, message: 'All active admin sessions were revoked' });
    } catch (err) {
        return res.status(500).json({ success: false, error: String(err.message || err) });
    }
});

router.post('/controls/clear-cache', async (_req, res) => {
    try {
        await fs.writeFile(requestLogPath, '', 'utf8');
        return res.json({ success: true, message: 'Request-log cache cleared' });
    } catch (err) {
        return res.status(500).json({ success: false, error: String(err.message || err) });
    }
});

router.post('/controls/reset-otp', async (_req, res) => {
    try {
        await pool.query('UPDATE admin_login_otps SET consumed_at = NOW() WHERE consumed_at IS NULL');
        return res.json({ success: true, message: 'All pending OTP entries were reset' });
    } catch (err) {
        return res.status(500).json({ success: false, error: String(err.message || err) });
    }
});

router.post('/controls/features', async (req, res) => {
    try {
        const nextFeatures = req.body?.features;
        if (!nextFeatures || typeof nextFeatures !== 'object') {
            return res.status(400).json({ success: false, error: 'features payload is required' });
        }

        const current = await readDashboardState();
        const merged = {
            ...current,
            featureFlags: {
                ...current.featureFlags,
                ...nextFeatures
            }
        };

        await saveDashboardState(merged);
        return res.json({ success: true, features: merged.featureFlags });
    } catch (err) {
        return res.status(500).json({ success: false, error: String(err.message || err) });
    }
});

module.exports = router;



