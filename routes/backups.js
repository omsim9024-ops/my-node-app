const express = require('express');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const pool = require('../db');
const controlPool = require('../db-control');
const { getTenantById, getTenantDataPool } = require('../services/tenant-db-manager');

const router = express.Router();

const BACKUP_ROOT = path.join(__dirname, '..', 'backups');
const VALID_INTERVALS = new Set([1, 6, 12, 24]);
const DEFAULT_RETENTION = 30;

// legacy mapping of logical scope keys to table names. kept for
// compatibility with old policy records but not used by the new full-database
// backup implementation. Do not rely on these constants for active logic.
const SCOPE_TABLE_MAP = {
    students: 'students',
    enrollments: 'enrollments',
    sections: 'sections',
    school_years: 'school_years',
    teachers: 'teachers',
    teacher_assignments: 'teacher_section_assignments',
    registration_codes: 'registration_codes',
    notifications: 'notifications'
};

const ALL_SCOPE_KEYS = Object.keys(SCOPE_TABLE_MAP);

const schedulerHandles = new Map();
const runningBackups = new Set();

function parseTenantId(value) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function resolveTenantIdFromRequest(req) {
    return parseTenantId(req?.tenantId || req?.tenant?.id || req?.headers?.['x-tenant-id'] || req?.query?.tenantId || req?.query?.tenant_id);
}

function getTenantWhereClause(tenantId) {
    if (parseTenantId(tenantId)) {
        return { clause: 'tenant_id = ?', params: [Number(tenantId)] };
    }
    return { clause: 'tenant_id = 0', params: [] };
}

function schedulerKey(adminId, tenantId) {
    return `${parseTenantId(tenantId) || 0}:${Number(adminId) || 0}`;
}

async function resolveRuntimeBackupContext(tenantId) {
    const parsedTenantId = parseTenantId(tenantId);
    if (!parsedTenantId) {
        return {
            tenantId: null,
            tenant: null,
            dbPool: controlPool,
            isolationMode: 'row-level-tenant-id'
        };
    }

    const tenant = await getTenantById(parsedTenantId);
    if (!tenant || !tenant.id) {
        throw new Error('Invalid or unknown school tenant context.');
    }

    const isolationMode = String(tenant.isolationMode || '').trim().toLowerCase();
    if (isolationMode === 'database-per-tenant') {
        const tenantPool = await getTenantDataPool(tenant);
        if (!tenantPool) {
            throw new Error('Tenant database is not available for backups.');
        }
        return {
            tenantId: Number(tenant.id),
            tenant,
            dbPool: tenantPool,
            isolationMode: 'database-per-tenant'
        };
    }

    return {
        tenantId: Number(tenant.id),
        tenant,
        dbPool: controlPool,
        isolationMode: 'row-level-tenant-id'
    };
}

async function tableHasColumn(dbPool, tableName, columnName) {
    try {
        const [rows] = await dbPool.query(`SHOW COLUMNS FROM \`${tableName}\` LIKE ?`, [columnName]);
        return Array.isArray(rows) && rows.length > 0;
    } catch (_err) {
        return false;
    }
}

async function resolveTenantScopeColumn(dbPool, tableName) {
    if (await tableHasColumn(dbPool, tableName, 'tenant_id')) return 'tenant_id';
    if (await tableHasColumn(dbPool, tableName, 'school_id')) return 'school_id';
    return null;
}

async function backfillBackupTenantIds(dbPool) {
    // If the admins table doesn't exist yet, skip backfill (schema may still be initializing)
    try {
        await dbPool.query('SELECT 1 FROM admins LIMIT 1');
    } catch (_err) {
        return;
    }

    await dbPool.query(`
        UPDATE backup_policies bp
        LEFT JOIN admins a ON a.id = bp.admin_id
        SET bp.tenant_id = COALESCE(NULLIF(a.tenant_id, 0), bp.tenant_id, 0)
        WHERE bp.tenant_id IS NULL OR bp.tenant_id = 0
    `);

    await dbPool.query(`
        UPDATE backup_logs bl
        LEFT JOIN admins a ON a.id = bl.admin_id
        SET bl.tenant_id = COALESCE(NULLIF(a.tenant_id, 0), bl.tenant_id, 0)
        WHERE bl.tenant_id IS NULL OR bl.tenant_id = 0
    `);
}

async function normalizeBackupTenantColumns(dbPool) {
    try {
        await dbPool.query('ALTER TABLE backup_policies MODIFY tenant_id INT NOT NULL DEFAULT 0');
    } catch (err) {
        console.warn('[Backups] backup_policies tenant_id normalize skipped:', err?.message || err);
    }

    try {
        await dbPool.query('ALTER TABLE backup_logs MODIFY tenant_id INT NOT NULL DEFAULT 0');
    } catch (err) {
        console.warn('[Backups] backup_logs tenant_id normalize skipped:', err?.message || err);
    }
}

async function ensureBackupTables(dbPool = pool) {
    // Create tables required for backups. Foreign keys are added separately to avoid
    // startup failures if the referenced tables do not yet exist.
    try {
        await dbPool.query(`
            CREATE TABLE IF NOT EXISTS backup_policies (
                admin_id INT PRIMARY KEY,
                tenant_id INT NULL,
                enabled TINYINT(1) DEFAULT 0,
                interval_hours INT DEFAULT 24,
                retention_count INT DEFAULT 30,
                scope_json LONGTEXT NOT NULL,
                last_run_at DATETIME NULL,
                next_run_at DATETIME NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_backup_policies_tenant (tenant_id)
            )
        `);
    } catch (err) {
        console.warn('[Backups] failed to create backup_policies table', err.code || err.message);
    }

    try {
        await dbPool.query(`
            CREATE TABLE IF NOT EXISTS backup_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                admin_id INT NOT NULL,
                tenant_id INT NULL,
                file_name VARCHAR(255) NOT NULL,
                file_path TEXT NOT NULL,
                file_size BIGINT DEFAULT 0,
                status VARCHAR(20) DEFAULT 'success',
                trigger_type VARCHAR(20) DEFAULT 'manual',
                scope_json LONGTEXT,
                error_message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_backup_logs_tenant (tenant_id),
                INDEX idx_backup_logs_admin_created (admin_id, created_at)
            )
        `);
    } catch (err) {
        console.warn('[Backups] failed to create backup_logs table', err.code || err.message);
    }

    // Add FK constraints if possible (safe to ignore failures when parent tables are missing)
    try {
        await dbPool.query(`
            ALTER TABLE backup_policies
            ADD CONSTRAINT fk_backup_policies_admin
                FOREIGN KEY (admin_id)
                REFERENCES admins(id)
                ON DELETE CASCADE
        `);
    } catch (_err) {
        // ignore
    }

    try {
        await dbPool.query(`
            ALTER TABLE backup_logs
            ADD CONSTRAINT fk_backup_logs_admin
                FOREIGN KEY (admin_id)
                REFERENCES admins(id)
                ON DELETE CASCADE
        `);
    } catch (_err) {
        // ignore
    }

    if (!(await tableHasColumn(dbPool, 'backup_policies', 'tenant_id'))) {
        await dbPool.query('ALTER TABLE backup_policies ADD COLUMN tenant_id INT NULL AFTER admin_id');
        await dbPool.query('CREATE INDEX idx_backup_policies_tenant ON backup_policies (tenant_id)');
    }

    if (!(await tableHasColumn(dbPool, 'backup_logs', 'tenant_id'))) {
        await dbPool.query('ALTER TABLE backup_logs ADD COLUMN tenant_id INT NULL AFTER admin_id');
        await dbPool.query('CREATE INDEX idx_backup_logs_tenant ON backup_logs (tenant_id)');
    }

    await backfillBackupTenantIds(dbPool);
    await normalizeBackupTenantColumns(dbPool);
}

function normalizeScope(scope) {
    // scope is no longer meaningful. always produce empty list to indicate a
    // full-database backup. kept for backwards-compatibility callers that still
    // reference the function.
    return [];
}

function buildDefaultPolicy(adminId) {
    return {
        admin_id: adminId,
        enabled: false,
        interval_hours: 24,
        retention_count: DEFAULT_RETENTION,
        // no per-table scope; backups always cover entire database
        scope: [],
        last_run_at: null,
        next_run_at: null
    };
}

async function getPolicy(adminId, runtimeContext = {}) {
    const dbPool = runtimeContext.dbPool || pool;
    const tenantId = parseTenantId(runtimeContext.tenantId);
    await ensureBackupTables(dbPool);
    const tenantPredicate = getTenantWhereClause(tenantId);
    const [rows] = await dbPool.query(
        `SELECT *
         FROM backup_policies
         WHERE admin_id = ? AND ${tenantPredicate.clause}
         LIMIT 1`,
        [adminId, ...tenantPredicate.params]
    );
    if (!rows.length) return buildDefaultPolicy(adminId);

    let scope = ALL_SCOPE_KEYS;
    try {
        scope = normalizeScope(JSON.parse(rows[0].scope_json || '[]'));
    } catch (_) {
        scope = ALL_SCOPE_KEYS;
    }

    return {
        admin_id: rows[0].admin_id,
        enabled: !!rows[0].enabled,
        interval_hours: Number(rows[0].interval_hours) || 24,
        retention_count: Number(rows[0].retention_count) || DEFAULT_RETENTION,
        // always indicate full-database (no individual scope)
        scope: [],
        last_run_at: rows[0].last_run_at || null,
        next_run_at: rows[0].next_run_at || null
    };
}

async function savePolicy(adminId, policyInput, runtimeContext = {}) {
    const dbPool = runtimeContext.dbPool || pool;
    const tenantId = parseTenantId(runtimeContext.tenantId);
    await ensureBackupTables(dbPool);

    const enabled = !!policyInput.enabled;
    const intervalHours = Number(policyInput.interval_hours);
    const normalizedInterval = VALID_INTERVALS.has(intervalHours) ? intervalHours : 24;
    const retentionCount = DEFAULT_RETENTION;
    // scope selection no longer meaningful; always use empty array to indicate full backup
    const scope = [];

    const nextRunAt = enabled
        ? new Date(Date.now() + normalizedInterval * 60 * 60 * 1000)
        : null;

    await dbPool.query(
        `INSERT INTO backup_policies (admin_id, tenant_id, enabled, interval_hours, retention_count, scope_json, next_run_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            tenant_id = VALUES(tenant_id),
            enabled = VALUES(enabled),
            interval_hours = VALUES(interval_hours),
            retention_count = VALUES(retention_count),
            scope_json = VALUES(scope_json),
            next_run_at = VALUES(next_run_at),
            updated_at = CURRENT_TIMESTAMP`,
        [adminId, tenantId || 0, enabled ? 1 : 0, normalizedInterval, retentionCount, JSON.stringify(scope), nextRunAt]
    );

    return getPolicy(adminId, runtimeContext);
}

async function ensureAdminExists(adminId, runtimeContext = {}) {
    const dbPool = runtimeContext.dbPool || pool;
    const tenantId = parseTenantId(runtimeContext.tenantId);

    if (tenantId && await tableHasColumn(dbPool, 'admins', 'tenant_id')) {
        const [rows] = await dbPool.query(
            'SELECT id FROM admins WHERE id = ? AND (tenant_id = ? OR tenant_id IS NULL) LIMIT 1',
            [adminId, tenantId]
        );
        return rows.length > 0;
    }

    const [rows] = await dbPool.query('SELECT id FROM admins WHERE id = ? LIMIT 1', [adminId]);
    return rows.length > 0;
}

// fallback when mysqldump binary is not available.  Generates a SQL script
// by iterating over every table, capturing create statements and insert data.
// This implementation aims for correctness but may be slower than the native
// tool; triggers/procedures are also included when possible.
async function generateSqlDump(dbPool, outputPath) {
    const config = (dbPool.config && dbPool.config.connectionConfig) || {};
    const database = config.database || process.env.DB_NAME;
    if (!database) throw new Error('Unable to determine database name for backup');

    let sql = '';
    const escapeFn = (dbPool.escape && typeof dbPool.escape === 'function')
        ? dbPool.escape.bind(dbPool)
        : require('mysql2').escape;
    // include drop/create database
    sql += `-- manual dump generated by fallback\n`;
    sql += `DROP DATABASE IF EXISTS \`${database}\`;\nCREATE DATABASE \`${database}\`;\nUSE \`${database}\`;\n\n`;

    // fetch tables
    const [tablesRows] = await dbPool.query("SHOW FULL TABLES WHERE Table_type='BASE TABLE'");
    const tableKey = Object.keys(tablesRows[0] || {})[0] || 'Tables_in_' + database;
    const tables = tablesRows.map(r => r[tableKey]);

    for (const tbl of tables) {
        const [[createRes]] = await dbPool.query(`SHOW CREATE TABLE \`${tbl}\``);
        const createStmt = createRes['Create Table'];
        sql += `DROP TABLE IF EXISTS \`${tbl}\`;\n${createStmt};\n\n`;

        const [rows] = await dbPool.query(`SELECT * FROM \`${tbl}\``);
        if (rows.length) {
            const cols = Object.keys(rows[0]).map(c => `\\\`${c}\\\``).join(', ');
            const values = rows.map(r => {
                const vals = Object.values(r).map(v => escapeFn(v));
                return `(${vals.join(',')})`;
            }).join(',\n');
            sql += `INSERT INTO \`${tbl}\` (${cols}) VALUES\n${values};\n\n`;
        }
    }

    // triggers
    const [trigs] = await dbPool.query('SHOW TRIGGERS');
    for (const t of trigs) {
        sql += `DROP TRIGGER IF EXISTS \`${t.Trigger}\`;\n${t['Statement'] || t['SQL Original Statement']};\n\n`;
    }

    // routines (procedures/functions)
    const [routines] = await dbPool.query(
        `SELECT ROUTINE_TYPE, ROUTINE_NAME, ROUTINE_DEFINITION, DTD_IDENTIFIER
         FROM information_schema.routines
         WHERE ROUTINE_SCHEMA = ?`,
        [database]
    );
    for (const r of routines) {
        sql += `DROP ${r.ROUTINE_TYPE} IF EXISTS \`${r.ROUTINE_NAME}\`;\n`;
        sql += `CREATE ${r.ROUTINE_TYPE} \`${r.ROUTINE_NAME}\` ${r.DTD_IDENTIFIER} ${r.ROUTINE_DEFINITION};\n\n`;
    }

    await fsp.writeFile(outputPath, sql, 'utf8');
}

async function createBackupSnapshot(adminId, scope, triggerType = 'manual', runtimeContext = {}) {
    // the backup API used to support a selectable scope of tables and returned a JSON 'snapshot'.
    // per new requirements, backups must always capture the entire database (schema + data) as
    // a single SQL dump file that can later be used to restore the database.  The supplied
    // `scope` argument is now ignored – we still record it in logs for backwards compatibility,
    // but the dump will include every table in the target database.

    const dbPool = runtimeContext.dbPool || pool;
    const tenantId = parseTenantId(runtimeContext.tenantId);
    const isolationMode = String(runtimeContext.isolationMode || '').trim().toLowerCase() || 'row-level-tenant-id';
    await ensureBackupTables(dbPool);

    if (!tenantId) {
        throw new Error('School tenant context is required for backups.');
    }

    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    const fileName = `backup-admin-${adminId}-${timestamp}.sql`;

    const adminDir = path.join(BACKUP_ROOT, `tenant-${tenantId}`, `admin-${adminId}`);
    const absolutePath = path.join(adminDir, fileName);
    const relativePath = path.relative(path.join(__dirname, '..'), absolutePath).replace(/\\/g, '/');

    let logId = null;

    try {
        const [logResult] = await dbPool.query(
            `INSERT INTO backup_logs (admin_id, tenant_id, file_name, file_path, status, trigger_type, scope_json)
             VALUES (?, ?, ?, ?, 'running', ?, ?)`,
            [adminId, tenantId || 0, fileName, relativePath, triggerType, JSON.stringify(scope || [])]
        );
        logId = logResult.insertId;

        // perform a full SQL dump of the connected database
        const config = (dbPool.config && dbPool.config.connectionConfig) || {};
        const host = config.host || process.env.DB_HOST || 'localhost';
        const port = config.port || '';
        const user = config.user || process.env.DB_USER || 'root';
        const password = config.password || process.env.DB_PASSWORD || '';
        const database = config.database || process.env.DB_NAME;
        if (!database) {
            throw new Error('Unable to determine database name for backup.');
        }

        const mysqldumpArgs = [
            '-h', host,
        ];
        if (port) mysqldumpArgs.push('-P', String(port));
        mysqldumpArgs.push('-u', user);
        if (password) mysqldumpArgs.push(`-p${password}`);
        // include routines/triggers and drop statements so the dump can be restored cleanly
        mysqldumpArgs.push('--routines', '--triggers', '--add-drop-database', '--add-drop-table',
            '--databases', database);

        await fsp.mkdir(adminDir, { recursive: true });
        try {
            await new Promise((resolve, reject) => {
                const child = require('child_process').spawn('mysqldump', mysqldumpArgs, { stdio: ['ignore', 'pipe', 'inherit'] });
                const out = fs.createWriteStream(absolutePath);
                child.stdout.pipe(out);
                child.on('error', reject);
                child.on('close', code => {
                    if (code === 0) resolve();
                    else reject(new Error(`mysqldump exited with code ${code}`));
                });
            });
        } catch (spawnErr) {
            // fall back to JS implementation if binary missing
            if (spawnErr && spawnErr.code === 'ENOENT') {
                console.warn('[Backups] mysqldump not found; using JS fallback dump');
                await generateSqlDump(dbPool, absolutePath);
            } else {
                throw spawnErr;
            }
        }

        const stats = await fsp.stat(absolutePath);
        const fileSize = stats.size;
        await dbPool.query(
            `UPDATE backup_logs
             SET status = 'success', file_size = ?, error_message = NULL
             WHERE id = ?`,
            [fileSize, logId]
        );

        return {
            id: logId,
            file_name: fileName,
            file_path: relativePath,
            file_size: fileSize,
            created_at: now.toISOString()
        };
    } catch (err) {
        if (logId) {
            await dbPool.query(
                `UPDATE backup_logs
                 SET status = 'failed', error_message = ?
                 WHERE id = ?`,
                [String(err.message || err), logId]
            );
        }
        throw err;
    }
}

async function pruneOldBackups(adminId, retentionCount = DEFAULT_RETENTION, runtimeContext = {}) {
    const dbPool = runtimeContext.dbPool || pool;
    const tenantId = parseTenantId(runtimeContext.tenantId);
    const keepCount = Number(retentionCount) > 0 ? Number(retentionCount) : DEFAULT_RETENTION;
    const tenantPredicate = getTenantWhereClause(tenantId);
    const [rows] = await dbPool.query(
        `SELECT id, file_path
         FROM backup_logs
         WHERE admin_id = ? AND status = 'success' AND ${tenantPredicate.clause}
         ORDER BY created_at DESC, id DESC`,
        [adminId, ...tenantPredicate.params]
    );

    if (rows.length <= keepCount) return;

    const toRemove = rows.slice(keepCount);
    for (const entry of toRemove) {
        try {
            const absolutePath = path.join(__dirname, '..', entry.file_path || '');
            if (fs.existsSync(absolutePath)) {
                await fsp.unlink(absolutePath);
            }
        } catch (_) {}
        await dbPool.query('DELETE FROM backup_logs WHERE id = ?', [entry.id]);
    }
}

function clearScheduler(adminId, tenantId) {
    const key = schedulerKey(adminId, tenantId);
    const existing = schedulerHandles.get(key);
    if (existing) {
        clearInterval(existing);
        schedulerHandles.delete(key);
    }
}

async function runScheduledBackup(adminId, runtimeContext = {}) {
    const runningKey = schedulerKey(adminId, runtimeContext.tenantId);
    if (runningBackups.has(runningKey)) return;
    runningBackups.add(runningKey);
    try {
        const resolved = await resolveRuntimeBackupContext(runtimeContext.tenantId);
        const context = {
            tenantId: resolved.tenantId,
            dbPool: resolved.dbPool,
            isolationMode: resolved.isolationMode
        };

        const policy = await getPolicy(adminId, context);
        if (!policy.enabled) return;

        await createBackupSnapshot(adminId, policy.scope, 'scheduled', context);
        await pruneOldBackups(adminId, policy.retention_count, context);

        const nextRunAt = new Date(Date.now() + Number(policy.interval_hours) * 60 * 60 * 1000);
        const tenantPredicate = getTenantWhereClause(context.tenantId);
        await context.dbPool.query(
            `UPDATE backup_policies
             SET last_run_at = NOW(), next_run_at = ?
             WHERE admin_id = ? AND ${tenantPredicate.clause}`,
            [nextRunAt, adminId, ...tenantPredicate.params]
        );
    } catch (err) {
        console.error(`[BackupScheduler] Failed for admin ${adminId}:`, err);
    } finally {
        runningBackups.delete(runningKey);
    }
}

async function applySchedulerForAdmin(adminId, runtimeContext = {}) {
    const resolved = await resolveRuntimeBackupContext(runtimeContext.tenantId);
    const context = {
        tenantId: resolved.tenantId,
        dbPool: resolved.dbPool,
        isolationMode: resolved.isolationMode
    };

    clearScheduler(adminId, context.tenantId);
    const policy = await getPolicy(adminId, context);
    if (!policy.enabled) return;

    const intervalMs = Number(policy.interval_hours) * 60 * 60 * 1000;
    if (!intervalMs || intervalMs <= 0) return;

    const handle = setInterval(() => {
        runScheduledBackup(adminId, { tenantId: context.tenantId });
    }, intervalMs);
    schedulerHandles.set(schedulerKey(adminId, context.tenantId), handle);
}

async function initializeBackupScheduler() {
    try {
        await ensureBackupTables(controlPool);
        const [rows] = await controlPool.query('SELECT admin_id, tenant_id FROM backup_policies WHERE enabled = 1');
        for (const row of rows) {
            await applySchedulerForAdmin(row.admin_id, { tenantId: row.tenant_id });
        }
        console.log(`[BackupScheduler] Loaded ${rows.length} active backup policy(ies)`);
    } catch (err) {
        console.error('[BackupScheduler] Initialization failed:', err);
    }
}

router.get('/policy/:adminId', async (req, res) => {
    const adminId = parseInt(req.params.adminId, 10);
    if (!adminId || Number.isNaN(adminId)) {
        return res.status(400).json({ error: 'Invalid admin ID' });
    }

    const tenantId = resolveTenantIdFromRequest(req);
    if (!tenantId) {
        return res.status(400).json({ error: 'School tenant context is required.' });
    }

    try {
        const runtime = await resolveRuntimeBackupContext(tenantId);
        const context = { tenantId: runtime.tenantId, dbPool: runtime.dbPool, isolationMode: runtime.isolationMode };

        if (!(await ensureAdminExists(adminId, context))) {
            return res.status(404).json({ error: 'Admin not found' });
        }
        const policy = await getPolicy(adminId, context);
        return res.status(200).json({ success: true, policy });
    } catch (err) {
        console.error('Error loading backup policy:', err);
        return res.status(500).json({ error: 'Failed to load backup policy' });
    }
});

router.put('/policy/:adminId', async (req, res) => {
    const adminId = parseInt(req.params.adminId, 10);
    if (!adminId || Number.isNaN(adminId)) {
        return res.status(400).json({ error: 'Invalid admin ID' });
    }

    const tenantId = resolveTenantIdFromRequest(req);
    if (!tenantId) {
        return res.status(400).json({ error: 'School tenant context is required.' });
    }

    try {
        const runtime = await resolveRuntimeBackupContext(tenantId);
        const context = { tenantId: runtime.tenantId, dbPool: runtime.dbPool, isolationMode: runtime.isolationMode };

        if (!(await ensureAdminExists(adminId, context))) {
            return res.status(404).json({ error: 'Admin not found' });
        }

        // note: policy.scope is still accepted for compatibility but not used by the
        // actual backup logic; every snapshot will include the full database.
        const policy = await savePolicy(adminId, req.body || {}, context);
        await applySchedulerForAdmin(adminId, { tenantId: context.tenantId });
        await pruneOldBackups(adminId, DEFAULT_RETENTION, context);

        return res.status(200).json({
            success: true,
            policy,
            message: 'Backup policy saved. System keeps the latest 30 backup files automatically.'
        });
    } catch (err) {
        console.error('Error saving backup policy:', err);
        return res.status(500).json({ error: 'Failed to save backup policy' });
    }
});

router.post('/run/:adminId', async (req, res) => {
    const adminId = parseInt(req.params.adminId, 10);
    if (!adminId || Number.isNaN(adminId)) {
        return res.status(400).json({ error: 'Invalid admin ID' });
    }

    const tenantId = resolveTenantIdFromRequest(req);
    if (!tenantId) {
        return res.status(400).json({ error: 'School tenant context is required.' });
    }

    try {
        const runtime = await resolveRuntimeBackupContext(tenantId);
        const context = { tenantId: runtime.tenantId, dbPool: runtime.dbPool, isolationMode: runtime.isolationMode };

        if (!(await ensureAdminExists(adminId, context))) {
            return res.status(404).json({ error: 'Admin not found' });
        }

        const policy = await getPolicy(adminId, context);
        // the front-end no longer sends a scope; backups are always full database dumps.
        const backup = await createBackupSnapshot(adminId, null, 'manual', context);
        await pruneOldBackups(adminId, DEFAULT_RETENTION, context);

        return res.status(200).json({
            success: true,
            backup,
            message: 'Backup created successfully. Latest 30 backup files retained.'
        });
    } catch (err) {
        console.error('Error creating manual backup:', err);
        return res.status(500).json({ error: 'Failed to create backup' });
    }
});

router.get('/history/:adminId', async (req, res) => {
    const adminId = parseInt(req.params.adminId, 10);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '30', 10), 1), 100);

    if (!adminId || Number.isNaN(adminId)) {
        return res.status(400).json({ error: 'Invalid admin ID' });
    }

    const tenantId = resolveTenantIdFromRequest(req);
    if (!tenantId) {
        return res.status(400).json({ error: 'School tenant context is required.' });
    }

    try {
        const runtime = await resolveRuntimeBackupContext(tenantId);
        const context = { tenantId: runtime.tenantId, dbPool: runtime.dbPool, isolationMode: runtime.isolationMode };

        if (!(await ensureAdminExists(adminId, context))) {
            return res.status(404).json({ error: 'Admin not found' });
        }

        const tenantPredicate = getTenantWhereClause(context.tenantId);

        const [rows] = await context.dbPool.query(
            `SELECT id, file_name, file_size, status, trigger_type, created_at
             FROM backup_logs
             WHERE admin_id = ? AND ${tenantPredicate.clause}
             ORDER BY created_at DESC
             LIMIT ?`,
            [adminId, ...tenantPredicate.params, limit]
        );

        return res.status(200).json({ success: true, history: rows });
    } catch (err) {
        console.error('Error loading backup history:', err);
        return res.status(500).json({ error: 'Failed to load backup history' });
    }
});

router.get('/download/:adminId/:backupId', async (req, res) => {
    const adminId = parseInt(req.params.adminId, 10);
    const backupId = parseInt(req.params.backupId, 10);

    if (!adminId || Number.isNaN(adminId) || !backupId || Number.isNaN(backupId)) {
        return res.status(400).json({ error: 'Invalid request' });
    }

    const tenantId = resolveTenantIdFromRequest(req);
    if (!tenantId) {
        return res.status(400).json({ error: 'School tenant context is required.' });
    }

    try {
        const runtime = await resolveRuntimeBackupContext(tenantId);
        const context = { tenantId: runtime.tenantId, dbPool: runtime.dbPool, isolationMode: runtime.isolationMode };
        const tenantPredicate = getTenantWhereClause(context.tenantId);

        const [rows] = await context.dbPool.query(
            `SELECT file_name, file_path, status
             FROM backup_logs
             WHERE id = ? AND admin_id = ? AND ${tenantPredicate.clause}
             LIMIT 1`,
            [backupId, adminId, ...tenantPredicate.params]
        );

        if (!rows.length) {
            return res.status(404).json({ error: 'Backup not found' });
        }

        const backup = rows[0];
        if (backup.status !== 'success') {
            return res.status(400).json({ error: 'Backup is not downloadable' });
        }

        const absolutePath = path.join(__dirname, '..', backup.file_path || '');
        if (!fs.existsSync(absolutePath)) {
            return res.status(404).json({ error: 'Backup file is missing' });
        }

        return res.download(absolutePath, backup.file_name);
    } catch (err) {
        console.error('Error downloading backup:', err);
        return res.status(500).json({ error: 'Failed to download backup' });
    }
});

router.initializeBackupScheduler = initializeBackupScheduler;
router.applySchedulerForAdmin = applySchedulerForAdmin;

module.exports = router;



