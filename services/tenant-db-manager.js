const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const controlPool = require('../db-control');

const tenantPoolCache = new Map();
const DEFAULT_TENANT_CODE = String(process.env.DEFAULT_TENANT_CODE || process.env.SCHOOL_CODE || 'default-school')
    .trim()
    .toLowerCase();
const CONTROL_DB_NAME = String(process.env.DB_NAME || 'ratings').trim();

function normalizeSqlStatements(raw) {
    const normalized = raw.replace(/\r\n/g, '\n');
    return normalized
        .split(';')
        .map((stmt) => stmt.trim())
        .filter((stmt) => stmt && !stmt.startsWith('--'));
}

async function applySchemaFile(pool, sqlFileRelativePath) {
    const sqlPath = path.join(__dirname, '..', sqlFileRelativePath);
    if (!fs.existsSync(sqlPath)) return;

    const raw = fs.readFileSync(sqlPath, 'utf8');
    const stmts = normalizeSqlStatements(raw);

    try {
        await pool.query('SET FOREIGN_KEY_CHECKS = 0');
    } catch (err) {
        console.warn('[TenantDB] failed to disable foreign key checks:', err.code || err.message);
    }

    let executed = 0;
    for (const stmt of stmts) {
        try {
            await pool.query(stmt);
            executed++;
        } catch (err) {
            console.warn('[TenantDB] schema statement failed:', err.code || err.message, '\n  stmt:', stmt.split('\n')[0]);
        }
    }

    try {
        await pool.query('SET FOREIGN_KEY_CHECKS = 1');
    } catch (err) {
        console.warn('[TenantDB] failed to re-enable foreign key checks:', err.code || err.message);
    }

    console.log(`[TenantDB] applied ${executed} statements from ${sqlFileRelativePath}`);
}

async function ensureCoreTablesOnPool(pool) {
    const statements = [
        `
        CREATE TABLE IF NOT EXISTS school_years (
            id INT AUTO_INCREMENT PRIMARY KEY,
            school_year VARCHAR(50) UNIQUE NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            is_active BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
        `,
        `
        CREATE TABLE IF NOT EXISTS admins (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(100) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            name VARCHAR(100) NOT NULL,
            role VARCHAR(50) NOT NULL,
            account_status VARCHAR(20) DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        `,
        `
        CREATE TABLE IF NOT EXISTS students (
            id INT AUTO_INCREMENT PRIMARY KEY,
            student_id VARCHAR(50) UNIQUE NOT NULL,
            first_name VARCHAR(100) NOT NULL,
            last_name VARCHAR(100) NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            password VARCHAR(255),
            grade_level VARCHAR(50),
            account_status VARCHAR(20) DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        `,
        `
        CREATE TABLE IF NOT EXISTS enrollments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            enrollment_id VARCHAR(50) UNIQUE NOT NULL,
            student_id INT NOT NULL,
            enrollment_data JSON,
            status VARCHAR(20) DEFAULT 'Pending',
            enrollment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_enroll_student (student_id),
            FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
        )
        `
    ];

    for (const stmt of statements) {
        try {
            await pool.query(stmt);
        } catch (err) {
            console.warn('[TenantDB] core table creation failed (non-fatal):', err.code || err.message);
        }
    }
}

function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeIsolationMode(mode) {
    // Allow overriding tenant isolation mode globally via env var to simplify deployments.
    // If ENABLE_TENANT_DB is set to 'true', allow database-per-tenant mode.
    const enableTenantDb = String(process.env.ENABLE_TENANT_DB || process.env.ENABLE_TENANT_DATABASE || '').trim().toLowerCase();
    const allowTenantDb = enableTenantDb === 'true' || enableTenantDb === '1';

    const value = String(mode || '').trim().toLowerCase();
    if (value === 'database-per-tenant' && allowTenantDb) {
        return 'database-per-tenant';
    }
    return 'row-level-tenant-id';
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
    const urlConfig = parseDatabaseUrl(
        process.env.MYSQL_URL ||
        process.env.DATABASE_URL ||
        process.env.RAILWAY_DATABASE_URL ||
        process.env.RAILWAY_MYSQL_URL
    );

    const host = String(
        urlConfig?.host ||
        process.env.MYSQLHOST || process.env.MYSQL_HOST ||
        process.env.RAILWAY_MYSQL_HOST ||
        process.env.DB_HOST ||
        'localhost'
    ).trim();
    const port = toNumber(
        urlConfig?.port ||
        process.env.MYSQLPORT || process.env.MYSQL_PORT ||
        process.env.RAILWAY_MYSQL_PORT ||
        process.env.DB_PORT ||
        3306
    );
    const user = String(
        urlConfig?.user ||
        process.env.MYSQLUSER || process.env.MYSQL_USER ||
        process.env.RAILWAY_MYSQL_USER ||
        process.env.DB_USER ||
        'root'
    ).trim();
    const password = String(
        urlConfig?.password ||
        process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD ||
        process.env.RAILWAY_MYSQL_PASSWORD ||
        process.env.RAILWAY_DATABASE_PASSWORD ||
        process.env.DB_PASSWORD ||
        ''
    ).trim();
    const database = String(
        urlConfig?.database ||
        process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE ||
        process.env.RAILWAY_MYSQL_DATABASE ||
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
        const { host, port, database, user } = poolConfig;
        console.warn('[TenantDB] Unable to connect to tenant database, falling back to control DB:', err.code || err.message);
        console.warn(`[TenantDB] attempted: host=${host}, port=${port}, database=${database}, user=${user}`);
        return null;
    }

    // Ensure tenant database has required core tables for basic operations.
    // If it doesn't, attempt to create them (schema file or minimal core tables).
    try {
        const [rows] = await tenantPool.query("SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'students' LIMIT 1");
        const studentsExists = Array.isArray(rows) && rows.length > 0;
        if (!studentsExists) {
            console.log('[TenantDB] Core tables missing in tenant database; applying schema.');
            await ensureCoreTablesOnPool(tenantPool);
            await applySchemaFile(tenantPool, 'schema-mysql.sql');
        }
    } catch (err) {
        console.warn('[TenantDB] Failed to ensure core schema in tenant DB:', err.code || err.message);
    }

    tenantPoolCache.set(key, tenantPool);
    return tenantPool;
}



module.exports = {
    getTenantById,
    getTenantDataPool
};



