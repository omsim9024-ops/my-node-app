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

function buildPoolConfigFromTenant(tenant) {
    return {
        host: String(tenant.dbHost || process.env.DB_HOST || 'localhost').trim(),
        port: toNumber(tenant.dbPort, toNumber(process.env.DB_PORT, 3306)),
        user: String(tenant.dbUser || process.env.DB_USER || 'root').trim(),
        password: process.env.DB_PASSWORD || '',
        database: String(tenant.dbName || '').trim(),
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
    await tenantPool.query('SELECT 1');
    tenantPoolCache.set(key, tenantPool);

    return tenantPool;
}

module.exports = {
    getTenantById,
    getTenantDataPool
};



