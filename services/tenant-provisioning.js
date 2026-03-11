const mysql = require('mysql2/promise');
require('dotenv').config();

const CONTROL_DB_NAME = String(process.env.DB_NAME || 'ratings').trim();
const DEFAULT_TENANT_CODE = String(process.env.DEFAULT_TENANT_CODE || process.env.SCHOOL_CODE || 'default-school')
    .trim()
    .toLowerCase();

function sanitizeIdentifier(value) {
    const normalized = String(value || '').trim();
    if (!normalized) return null;
    if (!/^[A-Za-z0-9_]+$/.test(normalized)) return null;
    return normalized;
}

function sanitizeTenantCode(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

function buildTenantDatabaseName(tenantCode) {
    const code = sanitizeTenantCode(tenantCode);
    if (!code) return null;
    const base = `sms_tenant_${code.replace(/-/g, '_')}`;
    const safe = sanitizeIdentifier(base);
    if (!safe) return null;
    return safe.slice(0, 64);
}

async function createServerConnection() {
    return mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || ''
    });
}

async function cloneSchemaFromTemplate(adminConn, targetDbName, templateDbName = CONTROL_DB_NAME) {
    const safeTargetDb = sanitizeIdentifier(targetDbName);
    const safeTemplateDb = sanitizeIdentifier(templateDbName);

    if (!safeTargetDb || !safeTemplateDb) {
        throw new Error('Invalid source or target database identifier');
    }

    if (safeTargetDb === safeTemplateDb) {
        throw new Error('Tenant database cannot be the same as control database');
    }

    const [tables] = await adminConn.query(
        `SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = ? AND table_type = 'BASE TABLE'
         ORDER BY table_name ASC`,
        [safeTemplateDb]
    );

    const excludedTables = new Set([
        'tenants',
        'school_admin_assignments'
    ]);

    await adminConn.query(`SET FOREIGN_KEY_CHECKS = 0`);
    await adminConn.query(`USE \`${safeTargetDb}\``);

    let createdCount = 0;

    try {
        for (const row of tables || []) {
            const tableName = sanitizeIdentifier(row.TABLE_NAME || row.table_name);
            if (!tableName || excludedTables.has(tableName)) continue;

            const [ddlRows] = await adminConn.query(`SHOW CREATE TABLE \`${safeTemplateDb}\`.\`${tableName}\``);
            const ddl = ddlRows && ddlRows[0] ? (ddlRows[0]['Create Table'] || ddlRows[0]['Create table']) : null;
            if (!ddl) continue;

            const normalizedDdl = String(ddl).replace(
                /^CREATE TABLE\s+`[^`]+`/i,
                `CREATE TABLE \`${tableName}\``
            );

            await adminConn.query(normalizedDdl);
            createdCount += 1;
        }
    } finally {
        await adminConn.query(`SET FOREIGN_KEY_CHECKS = 1`);
    }

    return { createdTableCount: createdCount };
}

async function provisionTenantDatabase({ tenantCode, databaseName = null, templateDbName = CONTROL_DB_NAME }) {
    const normalizedTenantCode = sanitizeTenantCode(tenantCode);
    const safeDatabaseName = sanitizeIdentifier(databaseName) || buildTenantDatabaseName(tenantCode);
    if (!safeDatabaseName) {
        throw new Error('Unable to derive a valid tenant database name');
    }

    const safeControlDb = sanitizeIdentifier(CONTROL_DB_NAME);
    if (safeDatabaseName === safeControlDb && normalizedTenantCode === DEFAULT_TENANT_CODE) {
        return {
            databaseName: safeControlDb,
            createdTableCount: 0,
            host: process.env.DB_HOST || 'localhost',
            port: Number(process.env.DB_PORT || 3306),
            user: process.env.DB_USER || 'root'
        };
    }

    if (safeDatabaseName === safeControlDb) {
        throw new Error('Generated tenant database name conflicts with control database');
    }

    const adminConn = await createServerConnection();

    try {
        await adminConn.query(
            `CREATE DATABASE IF NOT EXISTS \`${safeDatabaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
        );

        const schemaResult = await cloneSchemaFromTemplate(adminConn, safeDatabaseName, templateDbName);

        return {
            databaseName: safeDatabaseName,
            createdTableCount: Number(schemaResult.createdTableCount || 0),
            host: process.env.DB_HOST || 'localhost',
            port: Number(process.env.DB_PORT || 3306),
            user: process.env.DB_USER || 'root'
        };
    } catch (err) {
        const dropOnFailure = String(process.env.TENANT_DB_DROP_ON_FAILURE || 'true').trim().toLowerCase() !== 'false';
        if (dropOnFailure) {
            try {
                await adminConn.query(`DROP DATABASE IF EXISTS \`${safeDatabaseName}\``);
            } catch (_dropErr) {}
        }
        throw err;
    } finally {
        await adminConn.end();
    }
}

async function dropTenantDatabase({ tenantCode, databaseName, force = false }) {
    const normalizedTenantCode = sanitizeTenantCode(tenantCode);
    const safeDatabaseName = sanitizeIdentifier(databaseName);
    const safeControlDb = sanitizeIdentifier(CONTROL_DB_NAME);

    if (!safeDatabaseName) {
        return { dropped: false, skipped: true, reason: 'missing-database-name' };
    }

    if (!force && normalizedTenantCode === DEFAULT_TENANT_CODE) {
        return { dropped: false, skipped: true, reason: 'default-tenant-database' };
    }

    if (!force && safeControlDb && safeDatabaseName === safeControlDb) {
        return { dropped: false, skipped: true, reason: 'control-database' };
    }

    const adminConn = await createServerConnection();
    try {
        await adminConn.query(`DROP DATABASE IF EXISTS \`${safeDatabaseName}\``);
        return { dropped: true, skipped: false, databaseName: safeDatabaseName };
    } finally {
        await adminConn.end();
    }
}

module.exports = {
    provisionTenantDatabase,
    buildTenantDatabaseName,
    dropTenantDatabase
};



