const express = require('express');
const pool = require('../db');
const router = express.Router();

const ALLOWED_STATUSES = new Set(['active', 'used', 'revoked', 'expired']);
let registrationCodeSchemaCache = null;

function generateRegistrationCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `TNHS-${code}`;
}

function normalizeStatus(value) {
    const status = String(value || '').trim().toLowerCase();
    return ALLOWED_STATUSES.has(status) ? status : '';
}

async function getRegistrationCodeSchema() {
    if (registrationCodeSchemaCache) return registrationCodeSchemaCache;

    const [columns] = await pool.query('SHOW COLUMNS FROM registration_codes');
    const set = new Set(columns.map(col => String(col.Field || '').toLowerCase()));

    registrationCodeSchemaCache = {
        hasDescription: set.has('description'),
        hasStatus: set.has('status'),
        hasUsedAt: set.has('used_at'),
        hasUsedBy: set.has('used_by'),
        hasUpdatedAt: set.has('updated_at'),
        hasIsActive: set.has('is_active'),
        hasUsageCount: set.has('usage_count'),
        hasUsageLimit: set.has('usage_limit')
    };

    return registrationCodeSchemaCache;
}

function usageCountExpr(schema) {
    return schema.hasUsageCount ? 'COALESCE(usage_count,0)' : '0';
}

function usageLimitExpr(schema) {
    return schema.hasUsageLimit ? 'COALESCE(usage_limit,1)' : '1';
}

function usedCondition(schema) {
    if (schema.hasUsedAt) return 'used_at IS NOT NULL';
    if (schema.hasUsageCount) return `${usageCountExpr(schema)} >= ${usageLimitExpr(schema)}`;
    return '0=1';
}

function unusedCondition(schema) {
    if (schema.hasUsedAt) return 'used_at IS NULL';
    if (schema.hasUsageCount) return `${usageCountExpr(schema)} < ${usageLimitExpr(schema)}`;
    return '1=1';
}

function activeCondition(schema) {
    if (schema.hasStatus) {
        // treat both 'active' and 'used' codes as usable under the new policy
        return "(status = 'active' OR status = 'used')";
    }
    if (schema.hasIsActive) return 'COALESCE(is_active,1) = 1';
    return '1=1';
}

function revokedCondition(schema) {
    if (schema.hasStatus) {
        // only an explicit "revoked" status makes a code invalid; other values
        // (including 'used' or 'expired') are handled elsewhere/allowed.
        return "status = 'revoked'";
    }
    if (schema.hasIsActive) return 'COALESCE(is_active,1) = 0';
    return '0=1';
}

function expiredCondition() {
    return 'expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP';
}

function statusCaseExpr(schema) {
    return `CASE
        WHEN ${usedCondition(schema)} THEN 'used'
        WHEN ${revokedCondition(schema)} THEN 'revoked'
        WHEN ${expiredCondition()} THEN 'expired'
        ELSE 'active'
    END`;
}

router.post('/generate', async (req, res) => {
    // For this deployment we ONLY allow one active code at a time. The UI
    // will generate a single code and any previous active/unused codes are
    // automatically revoked so the new code is the only one teachers can use.
    const description = String(req.body?.description || '').trim();
    const requestedQty = Number.parseInt(req.body?.quantity, 10) || 1;
    const quantity = 1; // ignore requestedQty - always create exactly one

    if (requestedQty !== 1) {
        console.warn('[registration-codes] generate called with quantity', requestedQty, 'forcing to 1');
    }

    try {
        const schema = await getRegistrationCodeSchema();
        // revoke any existing active, unused codes before creating the new one
        try {
            if (schema.hasStatus) {
                await pool.query(
                    `UPDATE registration_codes
                     SET status = 'revoked'
                     WHERE ${activeCondition(schema)}
                       AND ${unusedCondition(schema)}
                       AND NOT (${expiredCondition()})`
                );
            }
            if (schema.hasIsActive) {
                await pool.query(
                    `UPDATE registration_codes
                     SET is_active = 0
                     WHERE ${activeCondition(schema)}
                       AND ${unusedCondition(schema)}
                       AND NOT (${expiredCondition()})`
                );
            }
        } catch (revErr) {
            console.error('[registration-codes] failed to revoke previous codes:', revErr);
        }

        const codes = [];

        for (let i = 0; i < quantity; i++) {
            let code = generateRegistrationCode();
            let isUnique = false;

            while (!isUnique) {
                const [existing] = await pool.query('SELECT id FROM registration_codes WHERE code = ? LIMIT 1', [code]);
                if (!existing || existing.length === 0) {
                    isUnique = true;
                } else {
                    code = generateRegistrationCode();
                }
            }

            const columns = ['code', 'created_at', 'expires_at'];
            const valuesSql = ['?', 'CURRENT_TIMESTAMP', 'CURRENT_TIMESTAMP + INTERVAL 90 DAY'];
            const params = [code];

            if (schema.hasDescription) {
                columns.push('description');
                valuesSql.push('?');
                params.push(description || null);
            }
            if (schema.hasStatus) {
                columns.push('status');
                valuesSql.push("'active'");
            }
            if (schema.hasIsActive) {
                columns.push('is_active');
                valuesSql.push('1');
            }

            const sql = `INSERT INTO registration_codes (${columns.join(', ')}) VALUES (${valuesSql.join(', ')})`;
            const [insertResult] = await pool.query(sql, params);

            codes.push({
                id: insertResult.insertId,
                code,
                description: description || null,
                status: 'active'
            });
        }

        res.status(201).json({
            success: true,
            message: `Generated ${quantity} registration code(s)`,
            codes
        });
    } catch (err) {
        console.error('Error generating registration codes:', err);
        res.status(500).json({ error: 'Failed to generate codes' });
    }
});

router.get('/list', async (req, res) => {
    const { status, used } = req.query;

    try {
        const schema = await getRegistrationCodeSchema();
        const params = [];
        const conditions = [];

        const normalizedStatus = normalizeStatus(status);
        if (normalizedStatus === 'active') {
            // show active even if it has been used
            conditions.push(`(${activeCondition(schema)} AND NOT (${expiredCondition()}))`);
        } else if (normalizedStatus === 'used') {
            conditions.push(`(${usedCondition(schema)})`);
        } else if (normalizedStatus === 'revoked') {
            conditions.push(`(${revokedCondition(schema)})`);
        } else if (normalizedStatus === 'expired') {
            conditions.push(`(${expiredCondition()} AND ${unusedCondition(schema)})`);
        }

        if (used === 'true') {
            conditions.push(`(${usedCondition(schema)})`);
        } else if (used === 'false') {
            conditions.push(`(${unusedCondition(schema)})`);
        }

        const descriptionExpr = schema.hasDescription ? 'description' : 'NULL';
        const usedAtExpr = schema.hasUsedAt ? 'used_at' : 'NULL';
        const usedByExpr = schema.hasUsedBy ? 'used_by' : 'NULL';

        let query = `
            SELECT
                id,
                code,
                ${descriptionExpr} AS description,
                ${statusCaseExpr(schema)} AS status,
                created_at,
                expires_at,
                ${usedAtExpr} AS used_at,
                ${usedByExpr} AS used_by
            FROM registration_codes
        `;

        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
        }

        query += ' ORDER BY created_at DESC';

        const [rows] = await pool.query(query, params);
        res.json({ success: true, codes: rows });
    } catch (err) {
        console.error('Error fetching registration codes:', err && err.stack ? err.stack : err);
        res.status(500).json({ error: 'Failed to fetch codes', details: err && err.message ? err.message : String(err) });
    }
});

router.post('/validate', async (req, res) => {
    const code = String(req.body?.code || '').trim().toUpperCase();

    if (!code) {
        return res.status(400).json({ error: 'Code is required' });
    }

    try {
        const schema = await getRegistrationCodeSchema();
        const fields = ['id', 'code', 'expires_at'];

        if (schema.hasStatus) fields.push('status');
        if (schema.hasIsActive) fields.push('is_active');
        if (schema.hasUsedAt) fields.push('used_at');
        if (schema.hasUsageCount) fields.push('usage_count');
        if (schema.hasUsageLimit) fields.push('usage_limit');

        const [rows] = await pool.query(
            `SELECT ${fields.join(', ')} FROM registration_codes WHERE code = ? LIMIT 1`,
            [code]
        );

        if (rows.length === 0) {
            return res.status(404).json({ valid: false, error: 'Registration code not found' });
        }

        const codeRecord = rows[0];

        // debug output to help diagnose disappearing-code issue
        console.log('[validate] codeRecord:', codeRecord);

        // supersede check removed - we only care if the code itself is valid
        // (this avoids accidental invalidation when multiple rows are present)

        const isExpired = codeRecord.expires_at && new Date(codeRecord.expires_at) < new Date();
        if (isExpired) {
            return res.status(400).json({ valid: false, error: 'This registration code has expired' });
        }

        const isRevoked = schema.hasStatus
            ? String(codeRecord.status || '').toLowerCase() === 'revoked'
            : (schema.hasIsActive ? Number(codeRecord.is_active || 0) !== 1 : false);

        if (isRevoked) {
            return res.status(400).json({ valid: false, error: 'This registration code is no longer valid' });
        }

        res.json({ valid: true, message: 'Registration code is valid', code: codeRecord.code });
    } catch (err) {
        console.error('Error validating registration code:', err);
        res.status(500).json({ error: 'Failed to validate code' });
    }
});

router.post('/use', async (req, res) => {
    const code = String(req.body?.code || '').trim().toUpperCase();
    // teacher_id is optional now; originally used for teacher registration tracking
    const teacherId = req.body?.teacher_id || null;

    if (!code) {
        return res.status(400).json({ error: 'Code is required' });
    }

    try {
        const schema = await getRegistrationCodeSchema();
        const setClauses = [];
        const params = [];

        // record a usage count but do not deactivate or mark as used
        if (schema.hasUsageCount) setClauses.push('usage_count = COALESCE(usage_count,0) + 1');
        // keep code active indefinitely until admin revokes/regenerates

        if (setClauses.length === 0) {
            return res.status(500).json({ error: 'Registration code schema is missing required fields' });
        }

        params.push(code);

        const [result] = await pool.query(
            `UPDATE registration_codes
             SET ${setClauses.join(', ')}
             WHERE code = ?
               AND ${activeCondition(schema)}
               AND NOT (${expiredCondition()})`,
            params
        );

        if (!result || result.affectedRows === 0) {
            return res.status(400).json({ error: 'Could not mark code as used' });
        }

        res.json({ success: true, message: 'Code successfully registered' });
    } catch (err) {
        console.error('Error marking code as used:', err);
        res.status(500).json({ error: 'Failed to register code' });
    }
});

router.put('/revoke/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const schema = await getRegistrationCodeSchema();
        const setClauses = [];

        if (schema.hasStatus) setClauses.push("status = 'revoked'");
        if (schema.hasIsActive) setClauses.push('is_active = 0');
        if (schema.hasUpdatedAt) setClauses.push('updated_at = CURRENT_TIMESTAMP');

        if (setClauses.length === 0) {
            return res.status(500).json({ error: 'Registration code schema is missing revocation fields' });
        }

        const [result] = await pool.query(
            `UPDATE registration_codes
             SET ${setClauses.join(', ')}
             WHERE id = ?
               AND ${activeCondition(schema)}
               AND ${unusedCondition(schema)}`,
            [id]
        );

        if (!result || result.affectedRows === 0) {
            return res.status(404).json({ error: 'Code not found or cannot be revoked' });
        }

        res.json({ success: true, message: 'Code revoked successfully' });
    } catch (err) {
        console.error('Error revoking registration code:', err);
        res.status(500).json({ error: 'Failed to revoke code' });
    }
});

router.get('/stats', async (req, res) => {
    try {
        const schema = await getRegistrationCodeSchema();
        const [rows] = await pool.query(`
            SELECT
                COUNT(*) as total,
                COUNT(CASE WHEN ${activeCondition(schema)} AND NOT (${expiredCondition()}) THEN 1 END) as available,
                COUNT(CASE WHEN ${usedCondition(schema)} THEN 1 END) as used,
                COUNT(CASE WHEN ${revokedCondition(schema)} THEN 1 END) as revoked,
                COUNT(CASE WHEN ${expiredCondition()} AND ${unusedCondition(schema)} THEN 1 END) as expired
            FROM registration_codes
        `);

        res.json({ success: true, stats: rows[0] || {} });
    } catch (err) {
        console.error('Error fetching code statistics:', err && err.stack ? err.stack : err);
        res.status(500).json({ error: 'Failed to fetch stats', details: err && err.message ? err.message : String(err) });
    }
});

module.exports = router;



