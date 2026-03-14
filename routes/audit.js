/**
 * Audit / Activity Log API
 *
 * Provides a simple audit trail of actions performed within the system.
 * This is intended to support the admin dashboard "Activity Log" feature.
 */

const express = require('express');
const controlPool = require('../db-control');
const jwt = require('jsonwebtoken');
const { requireAdminAuth } = require('./admin-auth');

const router = express.Router();

console.log('[Audit] router loaded');

async function ensureAuditLogsTable(poolInstance) {
    const poolToUse = poolInstance || controlPool;
    if (!poolToUse || typeof poolToUse.query !== 'function') return;

    try {
        await poolToUse.query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                tenant_id INT NULL,
                admin_id INT NULL,
                user_id INT NULL,
                user_role VARCHAR(100) NULL,
                action VARCHAR(255) NOT NULL,
                details TEXT NULL,
                ip_address VARCHAR(100) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_audit_tenant (tenant_id),
                INDEX idx_audit_admin (admin_id),
                INDEX idx_audit_created_at (created_at)
            )
        `);
    } catch (err) {
        console.error('[Audit] Failed to ensure audit_logs table exists:', err);
    }
}

function parseAdminIdFromBearerToken(req) {
    try {
        const header = String(req.headers.authorization || '').trim();
        if (!header.toLowerCase().startsWith('bearer ')) return null;
        const token = header.slice(7).trim();
        if (!token) return null;
        const decoded = jwt.decode(token);
        if (!decoded || typeof decoded !== 'object') return null;
        if (decoded.sub) return Number(decoded.sub) || null;
        return null;
    } catch (_err) {
        return null;
    }
}

/**
 * Record an entry to the audit log.
 *
 * @param {object} params
 * @param {number|null} params.tenantId
 * @param {number|null} params.adminId
 * @param {number|null} params.userId
 * @param {string|null} params.userRole
 * @param {string} params.action
 * @param {any} params.details
 * @param {string|null} params.ip
 */
async function recordAuditLog({ tenantId = null, adminId = null, userId = null, userRole = null, action, details = null, ip = null, poolInstance = null } = {}) {
    if (!action) return;
    try {
        await ensureAuditLogsTable(poolInstance);
        const detailsString = (details && typeof details !== 'string') ? JSON.stringify(details) : (details || null);
        const targetPool = poolInstance || controlPool;
        await targetPool.query(
            `INSERT INTO audit_logs (tenant_id, admin_id, user_id, user_role, action, details, ip_address)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [tenantId || null, adminId || null, userId || null, userRole || null, String(action || ''), detailsString, ip || null]
        );
    } catch (err) {
        console.error('[Audit] Failed to insert log record:', err);
    }
}

// Preflight support so browsers can POST JSON without requiring auth for OPTIONS.
router.options('/track', (req, res) => res.sendStatus(204));

// Record a custom audit event from the frontend (e.g., user UI interactions)
router.post('/track', async (req, res) => {
    console.log('[Audit Track] request', { url: req.originalUrl, method: req.method, auth: !!req.headers.authorization });
    try {
        const tenantId = Number(req.tenantId || 0) || null;
        const ip = String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim() || null;

        // Try to resolve an authenticated user from bearer token if present
        let userId = null;
        let userRole = null;
        const authHeader = String(req.headers.authorization || '').trim();
        if (authHeader.toLowerCase().startsWith('bearer ')) {
            try {
                const token = authHeader.slice(7).trim();
                const decoded = jwt.decode(token);
                if (decoded && typeof decoded === 'object') {
                    userId = Number(decoded.sub || decoded.id || decoded.userId || decoded.user_id || 0) || null;
                    userRole = String(decoded.role || decoded.type || decoded.userRole || '').trim() || null;
                }
            } catch (_err) {
                // ignore
            }
        }

        const action = String(req.body?.action || '').trim();
        const details = req.body?.details || null;

        if (!action) {
            return res.status(400).json({ error: 'Action is required' });
        }

        // If the client provided actor info, prefer that for user identity
        let providedUserId = userId;
        let providedUserRole = userRole;
        try {
            const actor = details && typeof details === 'object' ? details.actor : null;
            if (actor && typeof actor === 'object') {
                if (!providedUserId && (actor.id || actor.userId || actor.user_id)) {
                    providedUserId = Number(actor.id || actor.userId || actor.user_id) || providedUserId;
                }
                if (!providedUserRole && actor.role) {
                    providedUserRole = String(actor.role || '').trim() || providedUserRole;
                }
            }
        } catch (_err) {
            // ignore
        }

        await recordAuditLog({
            tenantId,
            adminId: null,
            userId: providedUserId,
            userRole: providedUserRole,
            action,
            details,
            ip
        });

        res.json({ success: true });
    } catch (err) {
        console.error('[Audit] Error tracking event:', err);
        res.status(500).json({ error: 'Failed to record audit event' });
    }
});

// Require admin authentication for audit access (listing logs)
router.use(requireAdminAuth);

// List audit log entries for the current tenant (if provided)
router.get('/logs', async (req, res) => {
    try {
        // Ensure audit table exists in the central control DB
        await ensureAuditLogsTable(controlPool);

        // Determine tenant filtering via explicit tenant context or query param
        const tenantId = Number(req.tenantId || 0) || null;
        const limit = Math.min(200, Math.max(10, Number(req.query.limit || 50)));

        const params = [];
        let query = `SELECT id, tenant_id, admin_id, user_id, user_role, action, details, ip_address, created_at
                     FROM audit_logs`;
        if (tenantId) {
            query += ` WHERE tenant_id = ?`;
            params.push(tenantId);
        }
        query += ` ORDER BY created_at DESC LIMIT ?`;
        params.push(limit);

        const [rows] = await controlPool.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error('[Audit] Error fetching logs:', err);
        res.status(500).json({ error: 'Failed to load activity log' });
    }
});

module.exports = router;
module.exports.recordAuditLog = recordAuditLog;
module.exports.parseAdminIdFromBearerToken = parseAdminIdFromBearerToken;
