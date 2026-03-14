const mysql = require('mysql2/promise');
require('dotenv').config();

const controlPool = require('../db-control');

const tenantPoolCache = new Map();
const DEFAULT_TENANT_CODE = String(process.env.DEFAULT_TENANT_CODE || process.env.SCHOOL_CODE || 'default-school')
    .trim()
    .toLowerCase();
const CONTROL_DB_NAME = String(process.env.DB_NAME || 'ratings').trim();

function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeIsolationMode(mode) {
    const value = String(mode || '').trim().toLowerCase();
    return value === 'database-per-tenant' ? 'database-per-tenant' : 'row-level-tenant-id';
}

function normalizeProvisioningStatus(status) {
    return String(status || '').trim().toLowerCase();
}

function normalizeTenantRecord(tenant) {
    if (!tenant) return tenant;
    const code = String(tenant.code || '').trim().toLowerCase();
    if (code !== DEFAULT_TENANT_CODE) return tenant;

    return {
        ...tenant,
        status: 'active',
        isolationMode: 'database-per-tenant',
        provisioningStatus: 'provisioned',
        dbName: String(tenant.dbName || CONTROL_DB_NAME).trim() || CONTROL_DB_NAME,
        dbHost: String(tenant.dbHost || process.env.DB_HOST || 'localhost').trim(),
        dbPort: toNumber(tenant.dbPort, toNumber(process.env.DB_PORT, 3306)),
        dbUser: String(tenant.dbUser || process.env.DB_USER || 'root').trim()
    };
}

function cacheKeyForConfig(config) {
    return [
        String(config.host || '').toLowerCase(),
        String(config.port || ''),
        String(config.user || ''),
        String(config.database || '').toLowerCase()
    ].join('|');
}

function parseDatabaseUrl(urlString) {
    if (!urlString) return null;
    try {
        const url = new URL(urlString);
        return {
            host: url.hostname,
            port: Number(url.port || 3306),
            user: url.username,
            password: url.password,
            database: url.pathname ? url.pathname.replace(/^\//, '') : ''
        };
    } catch (_err) {
        return null;
    }
}

function getEnvDbConfigDefaults() {
    // Similar behavior to db-control.js: support both DB_* and MYSQL_* env var naming,
    // plus optional URL-style credentials (Railway's DATABASE_URL / MYSQL_URL).
    const urlConfig = parseDatabaseUrl(process.env.MYSQL_URL || process.env.DATABASE_URL || process.env.RAILWAY_DATABASE_URL);

    const host = String(
        urlConfig?.host ||
        process.env.MYSQLHOST || process.env.MYSQL_HOST ||
        process.env.DB_HOST ||
        'localhost'
    ).trim();
    const port = toNumber(
        urlConfig?.port ||
        process.env.MYSQLPORT || process.env.MYSQL_PORT ||
        process.env.DB_PORT ||
        3306
    );
    const user = String(
        urlConfig?.user ||
        process.env.MYSQLUSER || process.env.MYSQL_USER ||
        process.env.MYSQL_ROOT_USER ||
        process.env.DB_USER ||
        'root'
    ).trim();
    const password = String(
        urlConfig?.password ||
        process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD ||
        process.env.MYSQL_ROOT_PASSWORD ||
        process.env.RAILWAY_DATABASE_PASSWORD ||
        process.env.DB_PASSWORD ||
        ''
    ).trim();
    const database = String(
        urlConfig?.database ||
        process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE ||
        process.env.DB_NAME ||
        ''
    ).trim();

    return { host, port, user, password, database };
}

function buildPoolConfigFromTenant(tenant) {
    const defaults = getEnvDbConfigDefaults();

    // If the tenant record includes a secret reference, try to resolve it from env vars
    let tenantPassword = defaults.password;
    if (!tenantPassword && tenant.dbSecretRef) {
        tenantPassword = process.env[tenant.dbSecretRef] || tenantPassword;
    }

    return {
        host: String(tenant.dbHost || defaults.host || 'localhost').trim(),
        port: toNumber(tenant.dbPort, defaults.port || 3306),
        user: String(tenant.dbUser || defaults.user || '').trim(),
        password: String(tenantPassword || '').trim(),
        database: String(tenant.dbName || defaults.database || '').trim(),
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    };
}

async function getTenantById(tenantId) {
    const parsedTenantId = toNumber(tenantId, 0);
    if (!parsedTenantId) return null;

    const [rows] = await controlPool.query(
        `SELECT *
         FROM tenants
         WHERE id = ?
         LIMIT 1`,
        [parsedTenantId]
    );

    if (!rows.length) return null;
    const row = rows[0];

    return {
        id: toNumber(row.id, 0),
        code: String(row.code || '').trim(),
        status: String(row.status || 'inactive').trim().toLowerCase(),
        isolationMode: normalizeIsolationMode(row.isolation_mode),
        provisioningStatus: normalizeProvisioningStatus(row.provisioning_status || 'not-started'),
        dbName: row.db_name ? String(row.db_name).trim() : null,
        dbHost: row.db_host ? String(row.db_host).trim() : null,
        dbPort: toNumber(row.db_port, 0) || null,
        dbUser: row.db_user ? String(row.db_user).trim() : null,
        dbSecretRef: row.db_secret_ref ? String(row.db_secret_ref).trim() : null
    };
}

async function getTenantDataPool(tenantLike) {
    const tenantRaw = tenantLike && tenantLike.id
        ? tenantLike
        : await getTenantById(tenantLike && tenantLike.tenantId ? tenantLike.tenantId : null);
    const tenant = normalizeTenantRecord(tenantRaw);

    if (!tenant || !tenant.id) return null;
    if (normalizeIsolationMode(tenant.isolationMode) !== 'database-per-tenant') return null;

    if (!tenant.dbName || normalizeProvisioningStatus(tenant.provisioningStatus) !== 'provisioned') {
        throw new Error('Tenant database is not provisioned yet');
    }

    const poolConfig = buildPoolConfigFromTenant(tenant);
    if (!poolConfig.database) {
        throw new Error('Tenant database name is missing');
    }

    const key = cacheKeyForConfig(poolConfig);
    if (tenantPoolCache.has(key)) {
        return tenantPoolCache.get(key);
    }

    const tenantPool = mysql.createPool(poolConfig);

    try {
        await tenantPool.query('SELECT 1');
    } catch (err) {
        // If we can't connect to the tenant database (e.g., access denied, missing user),
        // fall back to the control pool so the app continues to work.
        const { host, port, database, user } = poolConfig;
        console.warn('[TenantDB] Unable to connect to tenant database, falling back to control DB:', err.code || err.message);
        console.warn(`[TenantDB] attempted: host=${host}, port=${port}, database=${database}, user=${user}`);
        return null;
    }

    tenantPoolCache.set(key, tenantPool);
    return tenantPool;
}


module.exports = {
    getTenantById,
    getTenantDataPool
};



