const controlPool = require('../db-control');
const { setRequestDbPool } = require('../db-context');

const DEFAULT_TENANT_CODE = String(process.env.DEFAULT_TENANT_CODE || process.env.SCHOOL_CODE || 'default-school')
    .trim()
    .toLowerCase();
const CONTROL_DB_NAME = String(process.env.DB_NAME || 'ratings').trim();

const CACHE_TTL_MS = 30 * 1000;
let tenantTableCheckedAt = 0;
let tenantTableAvailable = null;
let defaultTenantCache = null;
let defaultTenantCacheAt = 0;

function normalizeCode(value) {
    return String(value || '').trim().toLowerCase();
}

function parseHost(hostHeader) {
    const host = String(hostHeader || '').trim().toLowerCase();
    if (!host) return '';
    return host.split(':')[0];
}

function extractSubdomain(host) {
    const normalized = parseHost(host);
    if (!normalized) return null;
    const parts = normalized.split('.').filter(Boolean);
    if (parts.length < 3) return null;
    return normalizeCode(parts[0]);
}

async function hasTenantsTable() {
    const now = Date.now();
    if (tenantTableAvailable !== null && (now - tenantTableCheckedAt) < CACHE_TTL_MS) {
        return tenantTableAvailable;
    }

    tenantTableCheckedAt = now;
    try {
        const [rows] = await controlPool.query(
            `SELECT 1
             FROM information_schema.tables
             WHERE table_schema = DATABASE() AND table_name = 'tenants'
             LIMIT 1`
        );
        tenantTableAvailable = Array.isArray(rows) && rows.length > 0;
        return tenantTableAvailable;
    } catch (_err) {
        tenantTableAvailable = false;
        return false;
    }
}

function mapTenantRow(row) {
    if (!row) return null;
    const mapped = {
        id: Number(row.id),
        code: String(row.code || '').trim(),
        name: String(row.name || '').trim(),
        status: String(row.status || 'active'),
        isDefault: Number(row.is_default || 0) === 1,
        isolationMode: String(row.isolation_mode || 'row-level-tenant-id').trim().toLowerCase(),
        dbName: row.db_name ? String(row.db_name).trim() : null,
        dbHost: row.db_host ? String(row.db_host).trim() : null,
        dbPort: Number(row.db_port || 0) || null,
        dbUser: row.db_user ? String(row.db_user).trim() : null,
        dbSecretRef: row.db_secret_ref ? String(row.db_secret_ref).trim() : null,
        provisioningStatus: String(row.provisioning_status || 'not-started').trim().toLowerCase()
    };

    if (normalizeCode(mapped.code) === DEFAULT_TENANT_CODE) {
        mapped.isolationMode = 'database-per-tenant';
        mapped.dbName = CONTROL_DB_NAME;
        mapped.dbHost = mapped.dbHost || String(process.env.DB_HOST || 'localhost').trim();
        mapped.dbPort = mapped.dbPort || Number(process.env.DB_PORT || 3306);
        mapped.dbUser = mapped.dbUser || String(process.env.DB_USER || 'root').trim();
        mapped.provisioningStatus = 'provisioned';
        if (String(mapped.status || '').trim().toLowerCase() !== 'active') {
            mapped.status = 'active';
        }
    }

    return mapped;
}

async function getDefaultTenant() {
    const now = Date.now();
    if (defaultTenantCache && (now - defaultTenantCacheAt) < CACHE_TTL_MS) {
        return defaultTenantCache;
    }

    if (!(await hasTenantsTable())) return null;

    const [rows] = await controlPool.query(
        `SELECT *
         FROM tenants
         WHERE status = 'active'
         ORDER BY is_default DESC, id ASC
         LIMIT 1`
    );

    defaultTenantCache = rows.length ? mapTenantRow(rows[0]) : null;
    defaultTenantCacheAt = now;
    return defaultTenantCache;
}

async function getTenantById(tenantId) {
    const parsed = Number(tenantId);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;

    if (!(await hasTenantsTable())) return null;

    const [rows] = await controlPool.query(
        `SELECT *
         FROM tenants
         WHERE id = ?
         LIMIT 1`,
        [parsed]
    );

    return rows.length ? mapTenantRow(rows[0]) : null;
}

async function getTenantByCode(code) {
    const normalized = normalizeCode(code);
    if (!normalized) return null;

    if (!(await hasTenantsTable())) return null;

    const [rows] = await controlPool.query(
        `SELECT *
         FROM tenants
         WHERE LOWER(code) = ?
         LIMIT 1`,
        [normalized]
    );

    return rows.length ? mapTenantRow(rows[0]) : null;
}

function resolveTenantHints(req) {
    const tenantIdHint = req.headers['x-tenant-id']
        || req.headers['x-school-id']
        || req.query?.tenantId
        || req.query?.tenant_id
        || req.query?.schoolId
        || req.query?.school_id
        || req.body?.tenantId
        || req.body?.tenant_id
        || req.body?.schoolId
        || req.body?.school_id
        || null;

    const tenantCodeHint = req.headers['x-tenant-code']
        || req.headers['x-school-code']
        || req.headers['x-school']
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
        || extractSubdomain(req.headers.host)
        || null;

    return {
        tenantIdHint,
        tenantCodeHint
    };
}

function hasExplicitTenantHint(req) {
    const { tenantIdHint, tenantCodeHint } = resolveTenantHints(req);
    return !!(tenantIdHint || tenantCodeHint);
}

async function resolveTenantForRequest(req, options = {}) {
    const {
        allowDefault = true,
        requireActive = true,
        fallbackToDefaultOnExplicitHint = false
    } = options;

    if (req.tenant && req.tenant.id) {
        if (!requireActive || String(req.tenant.status || '').toLowerCase() === 'active') {
            return req.tenant;
        }
    }

    const { tenantIdHint, tenantCodeHint } = resolveTenantHints(req);
    const explicitTenantHint = !!(tenantIdHint || tenantCodeHint);

    let tenant = null;
    if (tenantIdHint) {
        tenant = await getTenantById(tenantIdHint);
    }

    if (!tenant && tenantCodeHint) {
        tenant = await getTenantByCode(tenantCodeHint);
    }

    if (!tenant && allowDefault && (!explicitTenantHint || fallbackToDefaultOnExplicitHint)) {
        tenant = await getDefaultTenant();
    }

    if (!tenant) return null;

    if (requireActive && String(tenant.status || '').toLowerCase() !== 'active') {
        return null;
    }

    return tenant;
}

async function tenantContextMiddleware(req, _res, next) {
    try {
        setRequestDbPool(controlPool);
        const tenant = await resolveTenantForRequest(req, {
            allowDefault: true,
            requireActive: false,
            fallbackToDefaultOnExplicitHint: false
        });
        if (tenant) {
            req.tenant = tenant;
            req.tenantId = Number(tenant.id);
        }
    } catch (err) {
        console.warn('[tenant-context] failed to resolve tenant:', err && err.message ? err.message : err);
    }

    return next();
}

module.exports = {
    tenantContextMiddleware,
    resolveTenantForRequest,
    hasExplicitTenantHint
};



